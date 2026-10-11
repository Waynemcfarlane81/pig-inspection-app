/* ---------- NAS sync (WebDAV over Tailscale) ----------
   Layout on the NAS, inside the shared folder (e.g. PigReports):
     app-data/inspections/<id>.json   one file per inspection
     app-data/movements/<id>.json     one file per pig-number entry (count, in, out, sold, transfer)
     app-data/settings/<name>.json    shared lists: operatives, medications, poisons
     Reports/<yyyy>/<yyyy-mm>/<date time - name>.pdf
     Exports/pig-inspections-<date>.csv
   Everything is cached on the phone, so the app works with no signal; changes queue and send later. */
const NAS = (() => {
  const LS = 'pigInsp:';
  const lsGet = (k, d) => { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d } catch (e) { return d } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); return true } catch (e) { return false } };

  const native = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Farm;
  const DEF = Object.assign({ host: '', port: '5005', folder: 'PigReports', user: 'pigapp', pass: '' }, window.FARM_DEFAULTS || {});
  let cfg = lsGet('nas', null) || { ...DEF };
  // Fill gaps from the built-in details (e.g. a password typed later or built into a newer version)
  for (const k of Object.keys(DEF)) if (!cfg[k] && DEF[k]) cfg[k] = DEF[k];
  let queue = lsGet('queue', []);          // [{key, method, path, body?, bodyBase64?, contentType}]
  let cache = lsGet('cache', { inspections: {}, movements: {}, settings: {} });
  let state = { busy: false, lastSync: lsGet('lastSync', 0), lastError: '', online: true };
  const listeners = [];
  let foldersMade = false;

  const configured = () => !!(cfg.host && cfg.port && cfg.folder && cfg.user && cfg.pass);
  const enc = p => p.split('/').map(encodeURIComponent).join('/');
  const baseUrl = () => `http://${cfg.host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')}:${String(cfg.port).trim()}/${enc(cfg.folder.trim().replace(/^\/+|\/+$/g, ''))}`;
  const auth = () => 'Basic ' + btoa(unescape(encodeURIComponent(`${cfg.user}:${cfg.pass}`)));

  async function request(method, path, opts = {}) {
    const url = `${baseUrl()}/${enc(path)}`;
    const headers = { Authorization: auth(), ...(opts.headers || {}) };
    const contentType = opts.contentType || 'application/octet-stream';
    const n = native();
    if (n) {
      const r = await n.request({ url, method, headers, body: opts.body, bodyBase64: opts.bodyBase64, contentType });
      return { status: r.status, body: r.body || '' };
    }
    // Browser fallback (testing only – a real browser blocks this unless the server allows it)
    let body = opts.body;
    if (opts.bodyBase64) body = Uint8Array.from(atob(opts.bodyBase64), c => c.charCodeAt(0));
    if (body !== undefined) headers['Content-Type'] = contentType;
    const r = await fetch(url, { method, headers, body });
    return { status: r.status, body: await r.text() };
  }

  function explain(status) {
    if (status === 401 || status === 403) return 'The NAS refused the username or password, or pigapp has no Read/Write access to the folder.';
    if (status === 404) return 'The folder was not found on the NAS. Check the folder name (e.g. PigReports).';
    if (status === 405) return 'WebDAV did not accept the request. Check WebDAV is enabled on the NAS.';
    return `The NAS replied with error ${status}.`;
  }
  function netExplain(e) {
    const m = String(e && e.message || e || '');
    if (/refused/i.test(m)) return 'Connection refused – WebDAV is off on the NAS, or the port is wrong.';
    if (/timeout|timed out|unreachable|failed to connect|resolve/i.test(m)) return 'Can\'t reach the NAS – check Tailscale is switched on and the server address is right.';
    return 'Can\'t reach the NAS – check Tailscale is on. (' + m + ')';
  }

  async function ensureFolders() {
    if (foldersMade) return;
    for (const p of ['app-data', 'app-data/inspections', 'app-data/movements', 'app-data/settings', 'Reports', 'Exports']) {
      const r = await request('MKCOL', p + '/');
      if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error(explain(r.status));
      // 201 created, 405 already exists – both fine
    }
    foldersMade = true;
  }
  async function ensureDir(path) {
    const parts = path.split('/').slice(0, -1); let cur = '';
    for (const p of parts) { cur = cur ? cur + '/' + p : p; await request('MKCOL', cur + '/'); }
  }

  async function list(dir) {
    const body = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:getlastmodified/></d:prop></d:propfind>';
    const r = await request('PROPFIND', dir + '/', { body, contentType: 'application/xml; charset=utf-8', headers: { Depth: '1' } });
    if (r.status !== 207) throw new Error(explain(r.status));
    const doc = new DOMParser().parseFromString(r.body, 'application/xml');
    const out = [];
    for (const resp of Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))) {
      const href = (resp.getElementsByTagNameNS('DAV:', 'href')[0] || {}).textContent || '';
      const name = decodeURIComponent(href.replace(/\/+$/, '').split('/').pop());
      const etag = (resp.getElementsByTagNameNS('DAV:', 'getetag')[0] || {}).textContent || '';
      const mod = (resp.getElementsByTagNameNS('DAV:', 'getlastmodified')[0] || {}).textContent || '';
      if (name.endsWith('.json')) out.push({ name, id: name.slice(0, -5), tag: etag || mod });
    }
    return out;
  }

  function emit() { listeners.forEach(f => { try { f() } catch (e) { console.error(e) } }) }
  function saveCache() {
    if (!lsSet('cache', cache)) state.lastError = 'This phone\'s storage is full.';
  }

  /* ---- queue ---- */
  function enqueue(item) {
    queue = queue.filter(q => q.key !== item.key);   // newer change to the same file replaces the older one
    queue.push(item); lsSet('queue', queue);
  }
  async function flush() {
    while (queue.length) {
      const q = queue[0];
      if (q.method === 'PUT' && q.path.startsWith('Reports/')) await ensureDir(q.path);
      const r = await request(q.method, q.path, { body: q.body, bodyBase64: q.bodyBase64, contentType: q.contentType });
      const ok = (r.status >= 200 && r.status < 300) || (q.method === 'DELETE' && r.status === 404);
      if (!ok) throw new Error(explain(r.status));
      queue.shift(); lsSet('queue', queue); emit();
    }
  }

  /* ---- pull ---- */
  async function pullCollection(kind) {
    const files = await list('app-data/' + kind);
    const remote = new Set(files.map(f => f.id));
    const pendingDel = new Set(queue.filter(q => q.method === 'DELETE').map(q => q.key));
    const pendingPut = new Set(queue.filter(q => q.method === 'PUT').map(q => q.key));
    const local = cache[kind];
    const tags = cache[kind + 'Tags'] || (cache[kind + 'Tags'] = {});
    // Removed on another phone
    for (const id of Object.keys(local)) if (!remote.has(id) && !pendingPut.has(kind + '/' + id)) { delete local[id]; delete tags[id] }
    // New or changed
    const need = files.filter(f => !pendingDel.has(kind + '/' + f.id) && (!local[f.id] || (f.tag && tags[f.id] !== f.tag)));
    for (let i = 0; i < need.length; i += 4) {
      await Promise.all(need.slice(i, i + 4).map(async f => {
        const r = await request('GET', `app-data/${kind}/${f.name}`);
        if (r.status === 200) { try { local[f.id] = { ...JSON.parse(r.body), id: f.id }; tags[f.id] = f.tag } catch (e) { } }
      }));
    }
  }
  async function pullSettings() {
    for (const name of ['operatives', 'medications', 'poisons']) {
      if (queue.some(q => q.key === 'settings/' + name)) continue;   // our own change hasn't gone yet
      const r = await request('GET', `app-data/settings/${name}.json`);
      if (r.status === 200) { try { cache.settings[name] = JSON.parse(r.body) } catch (e) { } }
    }
  }

  async function sync() {
    if (state.busy || !configured()) { emit(); return }
    state.busy = true; emit();
    try {
      await ensureFolders();
      await flush();
      await pullCollection('inspections');
      await pullCollection('movements');
      await pullSettings();
      saveCache();
      state.lastSync = Date.now(); lsSet('lastSync', state.lastSync); state.lastError = ''; state.online = true;
    } catch (e) {
      state.online = false;
      state.lastError = e && e.message && !/^(TypeError|Failed to fetch)/.test(e.message) && /NAS|folder|WebDAV|password|storage/.test(e.message) ? e.message : netExplain(e);
    } finally { state.busy = false; emit() }
  }

  /* ---- public write API (instant locally, queued for the NAS) ---- */
  function newId() { return new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8) }
  function put(kind, rec) {
    const id = rec.id || newId(); const data = { ...rec, id };
    cache[kind][id] = data; saveCache();
    enqueue({ key: kind + '/' + id, method: 'PUT', path: `app-data/${kind}/${id}.json`, body: JSON.stringify(data, null, 1), contentType: 'application/json; charset=utf-8' });
    emit(); sync(); return data;
  }
  function remove(kind, id) {
    delete cache[kind][id]; saveCache();
    const k = kind + '/' + id;
    // A 404 on delete counts as done, so this is safe even if the file never reached the NAS
    enqueue({ key: k, method: 'DELETE', path: `app-data/${kind}/${id}.json` });
    emit(); sync();
  }
  function setSetting(name, value) {
    cache.settings[name] = value; saveCache();
    enqueue({ key: 'settings/' + name, method: 'PUT', path: `app-data/settings/${name}.json`, body: JSON.stringify(value, null, 1), contentType: 'application/json; charset=utf-8' });
    emit(); sync();
  }
  function putFile(path, opts) {
    enqueue({ key: 'file/' + path, method: 'PUT', path, ...opts });
    emit(); sync();
  }

  async function test(newCfg) {
    const old = cfg; cfg = { ...cfg, ...newCfg };
    try {
      const r = await request('PROPFIND', '', { body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>', contentType: 'application/xml', headers: { Depth: '0' } });
      if (r.status !== 207 && r.status !== 200) { cfg = old; return { ok: false, msg: explain(r.status) } }
      lsSet('nas', cfg); foldersMade = false;
      await ensureFolders();
      return { ok: true, msg: 'Connected to the NAS.' };
    } catch (e) { cfg = old; return { ok: false, msg: netExplain(e) } }
  }

  // Background triggers
  setInterval(() => { if (!document.hidden) sync() }, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync() });
  window.addEventListener('online', () => sync());

  return {
    get config() { return { ...cfg } }, configured, test, sync,
    get state() { return { ...state, queued: queue.length } },
    inspections: () => Object.values(cache.inspections),
    movements: () => Object.values(cache.movements),
    setting: (name, d) => cache.settings[name] !== undefined ? cache.settings[name] : d,
    put, remove, setSetting, putFile,
    onChange: f => listeners.push(f),
    isNative: () => !!native(),
    native,
    lsGet, lsSet
  };
})();
