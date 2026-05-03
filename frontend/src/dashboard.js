import { app } from './dashboard/shared.js';
import './dashboard/navigation.js';
import './dashboard/modals.js';

import { initStatusFeature } from './dashboard/status/index.js';
import { initDatabaseFeature } from './dashboard/database/index.js';

const { state } = app;

const initGlobalKeyboardShortcuts = () => {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      app.closeControlModal();
      app.closeLogModal();
      app.closeConfigModal();
      app.closeAccountDeleteModal();
      app.closeAccountPasswordModal();
      app.closeLogoutConfirmModal();
      app.closePlayerPortraitPicker();
    }
  });
};

const startPolling = async () => {
  await app.loadAppInfo();

  const intervalSeconds = await app.loadStatus();
  await app.loadDatabaseStatus();
  await app.loadSelectedAccount();

  if (state.timerId) {
    window.clearInterval(state.timerId);
  }

  state.timerId = window.setInterval(() => {
    void app.loadStatus();
    void app.loadDatabaseStatus();
  }, Math.max(5, intervalSeconds) * 1000);
};

const initDashboard = () => {
  app.initNavigation();
  app.initSharedModals();
  initStatusFeature();
  initDatabaseFeature();
  initGlobalKeyboardShortcuts();

  app.updateNextHealthCheckLabel();
  app.updateDatabaseHealthCheckLabel();
  app.renderSelectedAccountBadge();
  app.resetPlayerProfileView();
  app.setConfigEditorValue('');
  app.setActiveDashboardPage('server-management');
  app.setActiveDatabaseTab('database-service-status-section');
  app.updateDatabaseAccountsAccess(null);

  state.countdownTimerId = window.setInterval(() => {
    app.updateNextHealthCheckLabel();
    app.updateDatabaseHealthCheckLabel();
  }, 1000);

  void startPolling();
};

initDashboard();
