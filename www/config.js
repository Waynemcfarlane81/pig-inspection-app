/* NAS connection built into the app. The password is added at build time from the
   NAS_PASSWORD GitHub secret – it is never stored in this repository. */
window.FARM_DEFAULTS = {
  host: '100.81.3.68',
  port: '5005',
  folder: 'PigReports',
  user: 'pigapp',
  pass: ''
};
