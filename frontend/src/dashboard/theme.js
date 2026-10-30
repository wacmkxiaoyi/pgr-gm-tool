import { applyI18n, getLocale, subscribeLocaleChange } from '../i18n.js';

export const initThemeControl = () => {
  const root = document.documentElement;
  const button = document.querySelector('#dashboard-theme-toggle');
  if (!button) return;

  const updateLabel = () => {
    const key =
      root.dataset.dashboardTheme === 'dark'
        ? 'dashboard.switchToLightTheme'
        : 'dashboard.switchToDarkTheme';
    button.dataset.i18nTitle = key;
    button.dataset.i18nAriaLabel = key;
    applyI18n(button.parentElement, getLocale());
  };

  const setTheme = (theme) => {
    root.dataset.dashboardTheme = theme === 'dark' ? 'dark' : 'light';
    updateLabel();
  };

  button.addEventListener('click', () => {
    setTheme(root.dataset.dashboardTheme === 'dark' ? 'light' : 'dark');
    try {
      window.localStorage.setItem('dashboard-theme', root.dataset.dashboardTheme);
    } catch {
      // Switching still works when browser storage is unavailable.
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'dashboard-theme' || event.key === null) setTheme(event.newValue);
  });
  subscribeLocaleChange(updateLabel);
  updateLabel();
};
