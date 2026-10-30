// Run before styles load so a saved night theme is applied on the first paint.
(() => {
  try {
    document.documentElement.dataset.dashboardTheme =
      window.localStorage.getItem('dashboard-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    document.documentElement.dataset.dashboardTheme = 'light';
  }
})();
