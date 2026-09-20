import { applyI18n, getLocale, subscribeLocaleChange, t } from './i18n.js';
import { app } from './dashboard/shared.js';
import './dashboard/navigation.js';
import './dashboard/modals.js';

import { initStatusFeature } from './dashboard/game-server-management/index.js';
import { initDatabaseFeature } from './dashboard/user-data-management/index.js';

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
  app.updateCharacterManagementAccess();
  app.updateItemManagementAccess();
  app.updateStageManagementAccess();
  app.updateWeaponManagementAccess();
  app.updateMemoryManagementAccess();
  app.rerenderCharacterManagementLocale?.();
  app.rerenderCharacterAddLocale?.();
  app.rerenderCharacterWeaponSwitchLocale?.();
  app.rerenderCharacterMemorySwitchLocale?.();
  app.rerenderItemManagementLocale?.();
  app.rerenderStageManagementLocale?.();
  app.rerenderWeaponManagementLocale?.();
  app.rerenderMemoryManagementLocale?.();
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
      app.closeNoticeModal();
      app.closeLogModal();
      app.closeConfigModal();
      app.closeAccountDeleteModal();
      app.closeItemAddModal();
      app.closeItemDeleteModal();
      app.closeAccountPasswordModal();
      app.closeLogoutConfirmModal();
      app.closePlayerPortraitPicker();
      app.closeCharacterAddModal?.();
      app.closeWeaponDetailModal?.();
      app.closeCharacterDetailModal?.();
      app.closeCharacterWeaponSwitchModal?.();
      app.closeCharacterQualityEditModal?.();
      app.closeCharacterTrustEditModal?.();
    }
  });
};

const clearStatusPollingTimer = () => {
  if (state.statusPollingTimerId) {
    window.clearTimeout(state.statusPollingTimerId);
    state.statusPollingTimerId = null;
  }
};

const clearDatabaseStatusPollingTimer = () => {
  if (state.databaseStatusPollingTimerId) {
    window.clearTimeout(state.databaseStatusPollingTimerId);
    state.databaseStatusPollingTimerId = null;
  }
};

const scheduleStatusPolling = (intervalSeconds) => {
  clearStatusPollingTimer();
  if (!state.healthPollingReady || !state.serverManagementEnabled || !app.isServerManagementPageActive()) {
    return;
  }

  state.statusPollingTimerId = window.setTimeout(() => {
    void refreshStatusPolling();
  }, Math.max(5, Number(intervalSeconds) || 60) * 1000);
};

const scheduleDatabaseStatusPolling = (intervalSeconds) => {
  clearDatabaseStatusPollingTimer();
  if (!state.healthPollingReady || !app.isDatabaseManagementPageActive() || !app.isDatabaseStatusSectionActive()) {
    return;
  }

  state.databaseStatusPollingTimerId = window.setTimeout(() => {
    void refreshDatabaseStatusPolling();
  }, Math.max(5, Number(intervalSeconds) || 60) * 1000);
};

const refreshStatusPolling = async () => {
  if (!state.healthPollingReady || !state.serverManagementEnabled || !app.isServerManagementPageActive()) {
    clearStatusPollingTimer();
    return;
  }

  if (state.statusPollingRequestInFlight) {
    return;
  }

  state.statusPollingRequestInFlight = true;
  try {
    const intervalSeconds = await app.loadStatus();
    scheduleStatusPolling(intervalSeconds);
  } finally {
    state.statusPollingRequestInFlight = false;
  }
};

const refreshDatabaseStatusPolling = async () => {
  if (!state.healthPollingReady || !app.isDatabaseManagementPageActive() || !app.isDatabaseStatusSectionActive()) {
    clearDatabaseStatusPollingTimer();
    return;
  }

  if (state.databaseStatusPollingRequestInFlight) {
    return;
  }

  state.databaseStatusPollingRequestInFlight = true;
  try {
    const intervalSeconds = await app.loadDatabaseStatus();
    scheduleDatabaseStatusPolling(intervalSeconds);
  } finally {
    state.databaseStatusPollingRequestInFlight = false;
  }
};

app.refreshHealthPolling = () => {
  if (!state.healthPollingReady) {
    return;
  }

  if (state.serverManagementEnabled && app.isServerManagementPageActive()) {
    if (!state.statusPollingTimerId) {
      void refreshStatusPolling();
    }
  } else {
    clearStatusPollingTimer();
  }

  if (app.isDatabaseManagementPageActive() && app.isDatabaseStatusSectionActive()) {
    if (!state.databaseStatusPollingTimerId) {
      void refreshDatabaseStatusPolling();
    }
  } else {
    clearDatabaseStatusPollingTimer();
  }
};

const startPolling = async () => {
  await app.loadAppInfo();
  app.setActiveDashboardPage(state.serverManagementEnabled ? 'server-management' : 'database-management');
  await app.loadSelectedAccount();
  state.healthPollingReady = true;
  app.refreshHealthPolling();
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
  app.setActiveDashboardPage('database-management');
  app.setActiveDatabaseTab('database-service-status-section');
  app.updateDatabaseAccountsAccess(null);
  app.updateMemoryManagementAccess(null);
  app.updateItemManagementAccess(null);
  renderDashboardStaticState();

  state.countdownTimerId = window.setInterval(() => {
    app.updateNextHealthCheckLabel();
    app.updateDatabaseHealthCheckLabel();
  }, 1000);

  void startPolling();
};

initDashboard();
