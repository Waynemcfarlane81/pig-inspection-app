/* ---------- Performance tab: figures and graphs from all inspections on the NAS ---------- */
(function(){
  const DAY=864e5;
  const isoAdd=(iso,n)=>addDays(iso,n);
  const pct=(a,b)=>b>0?a/b*100:null;
  const fmtPct=v=>v==null?'–':(v<10?v.toFixed(1):Math.round(v))+'%';
  const fmtN=v=>Number.isInteger(v)?String(v):(+v.toFixed(1)).toString();
  const mondayOf=iso=>{const d=new Date(iso+'T12:00:00');const wd=(d.getDay()+6)%7;return isoAdd(iso,-wd)};
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const shortDate=iso=>{const[,m,d]=iso.split('-');return `${+d} ${MONTHS[+m-1]}`};

  function fillAreaSelect(force){
    const sel=$('st-area'); if(sel.options.length&&!force)return;
    const cur=sel.value;
    sel.innerHTML='<option value="all">All areas</option>'+LOCS.map(l=>`<option value="${l.k}">${esc(l.n)}</option>`).join('');
    sel.value=LOCS.some(l=>l.k===cur)?cur:'all';
  }
  window.fillStatsAreas=()=>fillAreaSelect(true);

  /* Daily pig numbers (end of each day) for the chosen areas, in one pass over the events */
  function dailyStock(start,end,keys){
    const ev=stockEvents(); const s={}; LOCS.forEach(l=>s[l.k]=0);
    const out={}; let i=0;
    for(let d=start; d<=end; d=isoAdd(d,1)){
      const lim=`${d}T23:59|999999999999999`;
      while(i<ev.length&&evKey(ev[i])<=lim){const e=ev[i++],q=+e.qty||0; if(!(e.area in s))s[e.area]=0;
        if(e.type==='count')s[e.area]=q; else if(e.type==='in')s[e.area]+=q;
        else if(e.type==='transfer'){s[e.area]-=q;if(e.toArea in s)s[e.toArea]+=q} else s[e.area]-=q}
      out[d]={total:keys.reduce((a,k)=>a+Math.max(0,s[k]),0),byArea:Object.fromEntries(keys.map(k=>[k,Math.max(0,s[k])]))};
    }
    return out;
  }

  function compute(){
    const P=$('st-period').value, areaSel=$('st-area').value;
    const keys=areaSel==='all'?LOCS.map(l=>l.k):[areaSel];
    const end=todayISO();
    let start;
    if(P==='all'){const dates=[...history.map(h=>h.date),...movements.map(m=>m.date)].filter(Boolean).sort(); start=dates[0]||end}
    else start=isoAdd(end,-(+P-1));
    const days=Math.round((new Date(end+'T12:00:00')-new Date(start+'T12:00:00'))/DAY)+1;
    const monthly=days>100;
    const bucketOf=d=>monthly?d.slice(0,7):mondayOf(d);
    const insp=history.filter(h=>h.date>=start&&h.date<=end);
    const stock=dailyStock(start,end,keys);
    // Only days after pig numbers were first recorded count towards averages
    const firstTrack=movements.map(m=>m.date).filter(Boolean).sort()[0]||null;
    const dayList=Object.keys(stock).filter(d=>firstTrack&&d>=firstTrack);
    const firstInsp=history.map(h=>h.date).filter(Boolean).sort()[0]||end;
    const coverFrom=firstInsp>start?firstInsp:start;
    const coverDays=Math.max(0,Math.round((new Date(end+'T12:00:00')-new Date(coverFrom+'T12:00:00'))/DAY)+1);
    const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    const avgStock=avg(dayList.map(d=>stock[d].total));
    const areaAvg={}; keys.forEach(k=>areaAvg[k]=avg(dayList.map(d=>stock[d].byArea[k])));

    // Buckets
    const buckets=new Map();
    for(const d of Object.keys(stock)){const b=bucketOf(d); if(!buckets.has(b))buckets.set(b,{key:b,days:[],dead:0,med:0,insp:0}); if(firstTrack&&d>=firstTrack)buckets.get(b).days.push(stock[d].total)}
    const area={}; keys.forEach(k=>area[k]={dead:0,med:0,rodent:0,done:0,checks:0});
    const reasons={}, medicines={}, ops={};
    let dead=0,med=0,doneSum=0,doneN=0,rodentInsp=0;
    const inspDays=new Set();
    for(const h of insp){
      inspDays.add(h.date);
      const b=buckets.get(bucketOf(h.date)); if(b)b.insp++;
      const op=ops[h.name]||(ops[h.name]={n:0,done:0,checks:0,dead:0,last:''});
      op.n++; if(h.date>op.last)op.last=h.date;
      let rodentHere=false;
      for(const k of keys){
        const s=(h.locs||{})[k]; if(!s)continue;
        const dd=+s.dead||0; dead+=dd; area[k].dead+=dd; op.dead+=dd; if(b)b.dead+=dd;
        for(const t of treats(s)){
          const c=+t.medCount||0; med+=c; area[k].med+=c; if(b)b.med+=c;
          const r=t.medReason||'Not recorded'; reasons[r]=(reasons[r]||0)+c;
          const mn=t.medName||t.serial||'Not recorded'; const m=medicines[mn]||(medicines[mn]={pigs:0,ml:0}); m.pigs+=c; m.ml+=totalMl(t);
        }
        const di=doneItems(k,s,h); const f=di.filter(Boolean).length/di.length;
        doneSum+=f; doneN++; area[k].done+=f; area[k].checks++; op.done+=f; op.checks++;
        if(h.rodent&&h.rodent.areas&&(h.rodent.areas[k]||{}).evidence){area[k].rodent++;rodentHere=true}
      }
      if(rodentHere)rodentInsp++;
    }
    const bl=[...buckets.values()].map(b=>({...b,avgStock:avg(b.days),label:monthly?`${MONTHS[+b.key.slice(5)-1]} ${b.key.slice(2,4)}`:shortDate(b.key)}));
    return {start,end,days,monthly,keys,insp,avgStock,areaAvg,dead,med,doneSum,doneN,rodentInsp,missed:Math.max(0,coverDays-inspDays.size),firstTrack,dayList,
      buckets:bl,area,reasons,medicines,ops,stock,nowStock:stockNow(),areaSel};
  }

  /* Vertical bar chart drawn at the container's real width so text stays readable */
  function barChart(id,items,{color='var(--bar)',unit=''}={}){
    const el=$(id); if(!el)return;
    const W=Math.max(280,el.clientWidth||320), H=190, padL=34, padR=8, padT=18, padB=28;
    const max=Math.max(1,...items.map(i=>i.v));
    const nice=(()=>{const raw=max/4,p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p;return (m<=1?1:m<=2?2:m<=5?5:10)*p})();
    const top=Math.ceil(max/nice)*nice;
    const n=items.length, slot=(W-padL-padR)/Math.max(1,n), bw=Math.max(3,Math.min(36,slot*0.62));
    const yv=v=>padT+(H-padT-padB)*(1-v/top);
    let g='';
    for(let t=0;t<=top+1e-9;t+=nice){const y=yv(t);g+=`<line x1="${padL}" x2="${W-padR}" y1="${y}" y2="${y}" class="grid"/><text x="${padL-6}" y="${y+4}" class="ax" text-anchor="end">${fmtN(t)}</text>`}
    const every=Math.ceil(n/7);
    const showVals=n<=14;
    items.forEach((it,i)=>{
      const x=padL+slot*i+(slot-bw)/2, y=yv(it.v), h=Math.max(0,H-padB-y);
      if(it.v>0){const r=Math.min(4,bw/2,h);g+=`<path d="M${x},${H-padB} V${y+r} Q${x},${y} ${x+r},${y} H${x+bw-r} Q${x+bw},${y} ${x+bw},${y+r} V${H-padB} Z" style="fill:${color}"/>`}
      if(showVals&&it.v>0)g+=`<text x="${x+bw/2}" y="${y-5}" class="val" text-anchor="middle">${fmtN(it.v)}</text>`;
      if(i%every===0||i===n-1)g+=`<text x="${x+bw/2}" y="${H-padB+16}" class="ax" text-anchor="middle">${esc(it.label)}</text>`;
      g+=`<rect x="${padL+slot*i}" y="${padT}" width="${slot}" height="${H-padT-padB}" class="hit" data-tip="${esc(it.tip)}"><title>${esc(it.tip)}</title></rect>`;
    });
    g+=`<line x1="${padL}" x2="${W-padR}" y1="${H-padB}" y2="${H-padB}" class="base"/>`;
    el.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="tip-out">Tap a bar for details</div>`;
  }
  /* Line chart for pig numbers over time */
  function lineChart(id,pts){
    const el=$(id); if(!el)return;
    const W=Math.max(280,el.clientWidth||320), H=170, padL=40, padR=10, padT=14, padB=26;
    const max=Math.max(1,...pts.map(p=>p.v)), n=pts.length;
    const nice=(()=>{const raw=max/4,p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p;return (m<=1?1:m<=2?2:m<=5?5:10)*p})();
    const top=Math.ceil(max/nice)*nice;
    const xv=i=>padL+(W-padL-padR)*(n<=1?0.5:i/(n-1)), yv=v=>padT+(H-padT-padB)*(1-v/top);
    let g='';
    for(let t=0;t<=top+1e-9;t+=nice){const y=yv(t);g+=`<line x1="${padL}" x2="${W-padR}" y1="${y}" y2="${y}" class="grid"/><text x="${padL-6}" y="${y+4}" class="ax" text-anchor="end">${fmtN(t)}</text>`}
    g+=`<path d="${pts.map((p,i)=>`${i?'L':'M'}${xv(i).toFixed(1)},${yv(p.v).toFixed(1)}`).join(' ')}" class="ln"/>`;
    const ticks=Math.min(5,n); for(let k=0;k<ticks;k++){const i=Math.round(k*(n-1)/Math.max(1,ticks-1));g+=`<text x="${xv(i)}" y="${H-8}" class="ax" text-anchor="${k===0?'start':k===ticks-1?'end':'middle'}">${esc(shortDate(pts[i].d))}</text>`}
    const last=pts[n-1]; if(last)g+=`<circle cx="${xv(n-1)}" cy="${yv(last.v)}" r="4" class="dot"/>`;
    const slot=(W-padL-padR)/Math.max(1,n);
    pts.forEach((p,i)=>{g+=`<rect x="${xv(i)-slot/2}" y="${padT}" width="${slot}" height="${H-padT-padB}" class="hit" data-tip="${esc(`${fmtDate(p.d)}: ${p.v} pigs`)}"></rect>`});
    el.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="tip-out">Tap the line for the number on a day</div>`;
  }
  function hbars(rows,{fmt=v=>fmtN(v),color='var(--bar)'}={}){
    if(!rows.length)return '<div class="hint">Nothing recorded in this period.</div>';
    const max=Math.max(...rows.map(r=>r.v),1);
    return `<div class="hbars">${rows.map(r=>`<div class="hb-row"><span class="hb-l">${esc(r.label)}</span><span class="hb-track"><span class="hb-bar" style="width:${Math.max(2,r.v/max*100)}%;background:${color}"></span></span><span class="hb-v">${fmt(r.v,r)}</span></div>`).join('')}</div>`;
  }
  const tile=(label,value,sub,cls='')=>`<div class="tile ${cls}"><div class="tile-l">${label}</div><div class="tile-v">${value}</div>${sub?`<div class="tile-s">${sub}</div>`:''}</div>`;

  window.renderStats=function(){
    fillAreaSelect();
    const out=$('stats-out');
    if(!history.length&&!movements.length){out.innerHTML='<div class="empty">Graphs appear here once inspections are saved. Record pig numbers in the Pigs tab so the app can work out mortality and medication rates.</div>';return}
    const c=compute();
    const mort=pct(c.dead,c.avgStock), medR=pct(c.med,c.avgStock), done=c.doneN?c.doneSum/c.doneN*100:null;
    const nowTotal=c.keys.reduce((a,k)=>a+Math.max(0,c.nowStock[k]),0);
    const noStock=c.avgStock<=0;
    let h=`<div class="hint" style="margin:-4px 0 10px">${fmtDate(c.start)} to ${fmtDate(c.end)} · ${c.days} day${c.days===1?'':'s'}${c.areaSel==='all'?'':' · '+esc(areaName(c.areaSel))}</div>`;
    if(noStock)h+=`<div class="panel alert-panel" style="margin-bottom:12px"><b>Percentages need pig numbers.</b> Go to the Pigs tab and do a stock count for each area – then mortality % and medication % will appear.</div>`;
    h+=`<div class="tiles">
      ${tile('Pigs now',nowTotal,noStock?'':`Average ${Math.round(c.avgStock)} in period`)}
      ${tile('Dead pigs',c.dead,mort!=null?`${fmtPct(mort)} mortality`:'',c.dead?'bad':'')}
      ${tile('Pigs medicated',c.med,medR!=null?`${fmtPct(medR)} of pigs`:'')}
      ${tile('Inspections',c.insp.length,c.missed>0?`<span class="n">${c.missed} day${c.missed===1?'':'s'} missed</span>`:'Every day covered')}
      ${tile('Checks completed',done==null?'–':fmtPct(done),'Bedding, drinkers, feed',done!=null&&done<90?'warn':'')}
      ${tile('Rodent sightings',c.rodentInsp,`inspection${c.rodentInsp===1?'':'s'} with evidence`,c.rodentInsp?'bad':'')}
    </div>`;
    const per=c.monthly?'month':'week';
    h+=`<div class="panel chart-panel"><h3>Dead pigs per ${per}</h3><div class="chart" id="ch-dead"></div></div>`;
    h+=`<div class="panel chart-panel"><h3>Pigs medicated per ${per}</h3><div class="chart" id="ch-med"></div></div>`;
    h+=`<div class="panel chart-panel"><h3>Pigs on the farm${c.areaSel==='all'?'':' – '+esc(areaName(c.areaSel))}</h3><div class="chart" id="ch-stock"></div></div>`;
    // By area table
    h+=`<div class="panel chart-panel"><h3>By area</h3><div style="overflow-x:auto"><table class="stat-table"><thead><tr><th>Area</th><th>Pigs now</th><th>Dead</th><th>Mortality</th><th>Medicated</th><th>Med. rate</th><th>Checks done</th><th>Rodents</th></tr></thead><tbody>
      ${c.keys.map(k=>{const a=c.area[k],av=c.areaAvg[k];const m=pct(a.dead,av),r=pct(a.med,av),d=a.checks?a.done/a.checks*100:null;
        return `<tr><td><b>${esc(areaName(k))}</b></td><td>${Math.max(0,c.nowStock[k])}</td><td${a.dead?' class="n"':''}>${a.dead}</td><td>${fmtPct(m)}</td><td>${a.med}</td><td>${fmtPct(r)}</td><td${d!=null&&d<90?' class="n"':''}>${fmtPct(d)}</td><td${a.rodent?' class="n"':''}>${a.rodent||'–'}</td></tr>`}).join('')}
      </tbody></table></div><div class="hint" style="margin-top:6px">Mortality and medication rate = pigs in the period ÷ average number of pigs in the area.</div></div>`;
    h+=`<div class="panel chart-panel"><h3>Why pigs were medicated</h3>${hbars(Object.entries(c.reasons).map(([k,v])=>({label:k,v})).sort((a,b)=>b.v-a.v),{fmt:v=>`${v} pig${v===1?'':'s'}`})}</div>`;
    h+=`<div class="panel chart-panel"><h3>Medicine used</h3>${hbars(Object.entries(c.medicines).map(([k,v])=>({label:k,v:v.ml,pigs:v.pigs})).sort((a,b)=>b.v-a.v),{fmt:(v,r)=>`${fmtN(v)} ml · ${r.pigs} pigs`})}</div>`;
    const opRows=Object.entries(c.ops).sort((a,b)=>b[1].n-a[1].n);
    h+=`<div class="panel chart-panel"><h3>Operatives</h3>${opRows.length?`<div style="overflow-x:auto"><table class="stat-table"><thead><tr><th>Operative</th><th>Inspections</th><th>Checks done</th><th>Dead recorded</th><th>Last inspection</th></tr></thead><tbody>
      ${opRows.map(([n,o])=>{const d=o.checks?o.done/o.checks*100:null;return `<tr><td><b>${esc(n)}</b></td><td>${o.n}</td><td${d!=null&&d<90?' class="n"':''}>${fmtPct(d)}</td><td>${o.dead}</td><td>${fmtDate(o.last)}</td></tr>`}).join('')}
      </tbody></table></div>`:'<div class="hint">No inspections in this period.</div>'}</div>`;
    out.innerHTML=h;
    barChart('ch-dead',c.buckets.map(b=>({v:b.dead,label:b.label,tip:`${c.monthly?b.label:'Week of '+b.label}: ${b.dead} dead${b.avgStock?` · ${fmtPct(pct(b.dead,b.avgStock))} of ${Math.round(b.avgStock)} pigs`:''} · ${b.insp} inspection${b.insp===1?'':'s'}`})),{color:'var(--loss)'});
    barChart('ch-med',c.buckets.map(b=>({v:b.med,label:b.label,tip:`${c.monthly?b.label:'Week of '+b.label}: ${b.med} pigs medicated${b.avgStock?` · ${fmtPct(pct(b.med,b.avgStock))} of pigs`:''}`})));
    if(c.dayList.length)lineChart('ch-stock',c.dayList.map(d=>({d,v:c.stock[d].total}))); else $('ch-stock').innerHTML='<div class="hint">Record a stock count in the Pigs tab to start this graph.</div>';
  };
  document.addEventListener('click',e=>{
    const t=e.target.closest('#stats-out [data-tip]'); if(!t)return;
    const box=t.closest('.chart').querySelector('.tip-out'); if(box)box.textContent=t.dataset.tip;
    t.closest('svg').querySelectorAll('.hit.on').forEach(x=>x.classList.remove('on')); t.classList.add('on');
  });
  ['st-period','st-area'].forEach(id=>$(id).addEventListener('change',()=>renderStats()));
  let rt; window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(!$('view-stats').hidden)renderStats()},200)});
})();
