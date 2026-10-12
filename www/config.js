/* NAS connection built into the app. The NAS is published over HTTPS by Tailscale Funnel,
   so phones don't need Tailscale. The password is added at build time from the
   NAS_PASSWORD GitHub secret – it is never stored in this repository. */
/* 'manager' = full app. 'worker' = can't record, change or delete pig numbers or delete inspections.
   The build makes both versions from this file. */
window.FARM_ROLE = 'manager';
window.FARM_DEFAULTS = {
  host: 'https://ugreen-nas.tail36489b.ts.net',
  port: '',
  folder: 'PigReports',
  user: 'pigapp',
  pass: ''
};
