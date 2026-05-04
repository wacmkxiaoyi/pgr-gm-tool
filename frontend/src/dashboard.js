import { applyI18n, getLocale, subscribeLocaleChange, t } from './i18n.js';
import { app } from './dashboard/shared.js';
import './dashboard/navigation.js';
import './dashboard/modals.js';

import { initStatusFeature } from './dashboard/status/index.js';
import { initDatabaseFeature } from './dashboard/database/index.js';

const { state } = app;

const renderDashboardStaticState = () => {
  const title = document.querySelector('title');
  if (title) {
    title.textContent = t('dashboard.title', {}, state.locale);
  }
};

const rerenderLocaleSensitiveViews = () => {
  renderDashboardStaticState();
  app.updateNextHealthCheckLabel();
  app.updateDatabaseHealthCheckLabel();
  app.renderSelectedAccountBadge();
  app.updateDatabaseAccountsAccess();
  app.updatePlayerProfileAccess();
  app.updateItemManagementAccess();
  app.updateStatusActionButtons({ controls: app.getControlState(state.serverControlState), sections: state.latestStatusSnapshot?.sections ?? [] });

  if (state.latestStatusSnapshot) {
    app.renderSnapshot(state.latestStatusSnapshot);
  }

  if (state.databaseHealthSnapshot) {
    app.renderDatabaseSnapshot(state.databaseHealthSnapshot);
  }

  if (state.playerProfileData) {
    app.renderPlayerProfile(state.playerProfileData);
  }

  app.queuePlayerCardBackgroundAspectSync?.();

  if (state.playerPortraitPickerState) {
    app.renderPlayerPortraitPicker();
  }
};

const initGlobalKeyboardShortcuts = () => {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      app.closeControlModal();
      app.closeLogModal();
      app.closeConfigModal();
      app.closeAccountDeleteModal();
      app.closeItemAddModal();
      app.closeItemDeleteModal();
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
  const locale = getLocale();
  state.locale = locale;
  applyI18n(document, locale);
  subscribeLocaleChange((nextLocale) => {
    state.locale = nextLocale;
    applyI18n(document, nextLocale);
    rerenderLocaleSensitiveViews();
  });

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
  app.updateItemManagementAccess(null);
  renderDashboardStaticState();

  state.countdownTimerId = window.setInterval(() => {
    app.updateNextHealthCheckLabel();
    app.updateDatabaseHealthCheckLabel();
  }, 1000);

  void startPolling();
};

initDashboard();
