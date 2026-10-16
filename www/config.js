/* NAS connection built into the app. The NAS is published over HTTPS by Tailscale Funnel,
   so phones don't need Tailscale. The password is added at build time from the
   NAS_PASSWORD GitHub secret – it is never stored in this repository. */
/* Admin and user permissions are set per person in the app (Settings → Users and permissions),
   and stored on the NAS – every phone runs the same app. */
window.FARM_DEFAULTS = {
  host: 'https://ugreen-nas.tail36489b.ts.net',
  port: '',
  folder: 'PigReports',
  user: 'pigapp',
  pass: ''
};
