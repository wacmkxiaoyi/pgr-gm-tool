import { app } from '../shared.js';

const { dom, state } = app;
const {
  databaseAccountsSubnavButton,
  databaseAccountsState,
  databaseAccountsTableShell,
  databaseAccountsBody,
  databaseAccountsSummary,
  databaseAccountsPrevButton,
  databaseAccountsNextButton,
  databaseAccountsPaginationLabel,
  databaseAccountsJumpInput,
  databaseAccountsJumpButton,
  databaseAccountsSearchInput,
  databaseSelectedAccountLabel,
} = dom;

app.renderSelectedAccountBadge = () => {
  if (databaseSelectedAccountLabel instanceof HTMLElement) {
    databaseSelectedAccountLabel.textContent = app.translate('dashboard.selectedUser', { uid: state.selectedAccountUid ?? app.translate('common.notAvailable') });
  }
};

app.updateAccountSelectionUi = () => {
  if (databaseAccountsBody instanceof HTMLElement) {
    Array.from(databaseAccountsBody.querySelectorAll('[data-account-action="select"]')).forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const uid = app.normalizeAccountUid(button.dataset.accountUid);
      const isSelected = uid !== null && uid === state.selectedAccountUid;
      const isPending = uid !== null && uid === state.accountSelectionPendingUid;

      button.textContent = isSelected ? app.translate('dashboard.accountSelected') : (isPending ? app.translate('dashboard.accountSelecting') : app.translate('dashboard.accountSelect'));
      button.disabled = isSelected || isPending || state.accountSelectionPendingUid !== null;
      button.classList.toggle('is-selected', isSelected);
    });
  }

  app.renderSelectedAccountBadge();
};

app.setSelectedAccountUid = (uid) => {
  const previousUid = state.selectedAccountUid;
  state.selectedAccountUid = app.normalizeAccountUid(uid);
  app.updateAccountSelectionUi();
  app.resetPlayerProfileView();
  if (previousUid !== state.selectedAccountUid) {
    app.clearWeaponManagementKeyword();
    app.resetWeaponManagementView();
    app.clearItemManagementKeyword();
    app.resetItemManagementView();
  }
  app.updatePlayerProfileAccess();
  app.updateWeaponManagementAccess();
  app.updateItemManagementAccess();
  if (app.isDatabasePlayerProfileSectionActive() && app.canAccessPlayerProfile()) {
    void app.loadSelectedPlayerProfile();
  }
  if (app.isDatabaseWeaponManagementSectionActive() && app.canAccessWeaponManagement()) {
    void app.loadSelectedAccountWeapons(1);
  }
  if (app.isDatabaseItemManagementSectionActive() && app.canAccessItemManagement()) {
    void app.loadSelectedAccountItems(1);
  }
};

app.clearSelectedAccount = async () => {
  try {
    const payload = await app.apiFetch('/api/database-accounts/selection', {
      method: 'DELETE',
    });

    app.setSelectedAccountUid(payload?.selected_uid ?? null);
  } catch (error) {
    throw new Error(app.apiErrorMessage(error, 'runtime.clearSelectedAccountFailed'));
  }
};

app.setAccountsState = (message, tone = '') => {
  if (databaseAccountsState instanceof HTMLElement) {
    databaseAccountsState.textContent = message;
    databaseAccountsState.className = 'accounts-state';
    if (tone) {
      databaseAccountsState.classList.add(tone);
    }
    databaseAccountsState.hidden = false;
  }

  if (databaseAccountsTableShell instanceof HTMLElement) {
    databaseAccountsTableShell.hidden = true;
  }
};

app.showAccountsTable = () => {
  if (databaseAccountsState instanceof HTMLElement) {
    databaseAccountsState.hidden = true;
  }

  if (databaseAccountsTableShell instanceof HTMLElement) {
    databaseAccountsTableShell.hidden = false;
  }
};

app.updateAccountsPagination = () => {
  if (databaseAccountsPaginationLabel instanceof HTMLElement) {
    databaseAccountsPaginationLabel.textContent = app.translate('dashboard.accountsPagination', {
      page: state.accountsTotalPages === 0 ? 0 : state.accountsCurrentPage,
      totalPages: state.accountsTotalPages,
    });
  }

  if (databaseAccountsPrevButton instanceof HTMLButtonElement) {
    databaseAccountsPrevButton.disabled = state.accountsLoading || state.accountsCurrentPage <= 1 || state.accountsTotalPages === 0 || !app.isDatabaseHealthy();
  }

  if (databaseAccountsNextButton instanceof HTMLButtonElement) {
    databaseAccountsNextButton.disabled = state.accountsLoading || state.accountsTotalPages === 0 || state.accountsCurrentPage >= state.accountsTotalPages || !app.isDatabaseHealthy();
  }

  const jumpDisabled = state.accountsLoading || state.accountsTotalPages === 0 || !app.isDatabaseHealthy();

  if (databaseAccountsJumpInput instanceof HTMLInputElement) {
    databaseAccountsJumpInput.disabled = jumpDisabled;
  }

  if (databaseAccountsJumpButton instanceof HTMLButtonElement) {
    databaseAccountsJumpButton.disabled = jumpDisabled;
  }
};

app.submitAccountsPageJump = () => {
  if (!(databaseAccountsJumpInput instanceof HTMLInputElement)) {
    return;
  }

  const targetPage = app.normalizePaginationTargetPage(databaseAccountsJumpInput.value, state.accountsTotalPages);
  databaseAccountsJumpInput.value = '';

  if (targetPage === null || targetPage === state.accountsCurrentPage) {
    return;
  }

  void app.loadDatabaseAccounts(targetPage);
};

app.renderAccountRows = (items) => {
  if (!(databaseAccountsBody instanceof HTMLElement)) {
    return;
  }

  databaseAccountsBody.innerHTML = items.map((item) => `
    <tr>
      <td>${item?.uid ?? '--'}</td>
      <td>${item?.username ?? '--'}</td>
      <td>
        <div class="accounts-row-actions">
          <button class="status-action-button status-action-button-log" type="button" data-account-action="select" data-account-uid="${item?.uid ?? ''}">${app.translate('dashboard.accountSelect')}</button>
          <button class="status-action-button status-action-button-config" type="button" data-account-action="password" data-account-uid="${item?.uid ?? ''}" data-account-username="${item?.username ?? ''}">${app.translate('dashboard.accountResetPassword')}</button>
          <button class="status-action-button status-action-button-stop" type="button" data-account-action="delete" data-account-uid="${item?.uid ?? ''}" data-account-username="${item?.username ?? ''}">${app.translate('dashboard.accountDelete')}</button>
        </div>
      </td>
    </tr>
  `).join('');

  app.updateAccountSelectionUi();
};

app._accountsSortFields = ['uid', 'username'];

app._syncAccountsSortArrows = () => {
  const table = document.querySelector('#database-accounts-section .accounts-table');
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.accountsSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.accountsSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleAccountsSortClick = (sortField) => {
  if (!app._accountsSortFields.includes(sortField)) return;
  if (state.accountsSortBy === sortField) {
    state.accountsSortOrder = state.accountsSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.accountsSortBy = sortField;
    state.accountsSortOrder = 'asc';
  }
  app._syncAccountsSortArrows();
};

app.syncAccountsKeywordInput = () => {
  if (databaseAccountsSearchInput instanceof HTMLInputElement) {
    databaseAccountsSearchInput.value = state.accountsKeyword;
  }
};

app.loadSelectedAccount = async () => {
  try {
    const payload = await app.apiFetch('/api/database-accounts/selection');

    app.setSelectedAccountUid(payload?.selected_uid ?? null);
  } catch {
    app.setSelectedAccountUid(null);
  }
};

app.selectDatabaseAccount = async (uid) => {
  const normalizedUid = app.normalizeAccountUid(uid);
  if (normalizedUid === null || state.accountSelectionPendingUid !== null) {
    return;
  }

  if (!app.isDatabaseHealthy()) {
    app.openControlModal(app.translate('runtime.databaseUnhealthySelectBlocked'));
    return;
  }

  state.accountSelectionPendingUid = normalizedUid;
  app.updateAccountSelectionUi();

  try {
    const payload = await app.apiFetch('/api/database-accounts/selection', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: normalizedUid }),
    });

    app.setSelectedAccountUid(payload?.selected_uid ?? normalizedUid);
    if (app.canAccessPlayerProfile()) {
      app.setActiveDatabaseTab('database-player-profile-section');
      void app.loadSelectedPlayerProfile();
    }
  } catch (error) {
    app.openControlModal(app.apiErrorMessage(error, 'runtime.selectAccountFailed'));
  } finally {
    state.accountSelectionPendingUid = null;
    app.updateAccountSelectionUi();
  }
};

app.updateDatabaseAccountsAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);

  app.syncAccountsKeywordInput();
  app._syncAccountsSortArrows();

  if (databaseAccountsSubnavButton instanceof HTMLButtonElement) {
    databaseAccountsSubnavButton.disabled = !healthy;
    databaseAccountsSubnavButton.title = healthy ? '' : app.translate('runtime.accountsAccessTitle');
  }

  if (databaseAccountsSummary instanceof HTMLElement) {
    databaseAccountsSummary.textContent = healthy
      ? (state.accountsHasLoaded ? app.translate('dashboard.accountsLoaded') : app.translate('dashboard.accountsReady'))
      : app.translate('dashboard.accountsUnavailable');
  }

  if (!healthy) {
    state.accountsTotalPages = 0;
    app.updateAccountsPagination();
    if (databaseAccountsBody instanceof HTMLElement) {
      databaseAccountsBody.innerHTML = '';
    }
    app.setAccountsState(app.translate('dashboard.accountsStateReady'), 'is-muted');

    if (app.isDatabaseAccountsSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    app.updatePlayerProfileAccess(payload);
    app.updateWeaponManagementAccess(payload);
    app.updateItemManagementAccess(payload);
    return;
  }

  app.updateAccountsPagination();
  app.updatePlayerProfileAccess(payload);
  app.updateWeaponManagementAccess(payload);
  app.updateItemManagementAccess(payload);
};

app.handleAccountActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-account-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.dataset.accountAction === 'select') {
    void app.selectDatabaseAccount(button.dataset.accountUid);
    return;
  }

  if (button.dataset.accountAction === 'password') {
    app.openAccountPasswordModal({
      uid: app.normalizeAccountUid(button.dataset.accountUid),
      username: button.dataset.accountUsername ?? '',
    }, button);
    return;
  }

  if (button.dataset.accountAction === 'delete') {
    app.openAccountDeleteModal({
      uid: app.normalizeAccountUid(button.dataset.accountUid),
      username: button.dataset.accountUsername ?? '',
    }, button);
  }
};

app.loadDatabaseAccounts = async (page = 1) => {
  if (!app.isDatabaseHealthy() || state.accountsLoading) {
    app.updateAccountsPagination();
    return;
  }

  state.accountsLoading = true;
  state.accountsCurrentPage = Math.max(1, page);
  app.updateAccountsPagination();
  app.setAccountsState(app.translate('dashboard.accountsStateLoading'), 'is-loading');

  try {
    const params = new URLSearchParams({
      page: String(state.accountsCurrentPage),
      page_size: '10',
      sort_by: state.accountsSortBy,
      sort_order: state.accountsSortOrder,
    });
    if (state.accountsKeyword) {
      params.set('keyword', state.accountsKeyword);
    }
    const payload = await app.apiFetch(`/api/database-accounts?${params.toString()}`);

    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.accountsCurrentPage = typeof payload?.page === 'number' ? payload.page : state.accountsCurrentPage;
    state.accountsTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    state.accountsHasLoaded = true;

    if (databaseAccountsSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseAccountsSummary.textContent = app.translate('dashboard.accountsSummaryTotal', { total });
    }

    if (items.length === 0) {
      if (databaseAccountsBody instanceof HTMLElement) {
        databaseAccountsBody.innerHTML = '';
      }
      app.setAccountsState(app.translate('dashboard.accountsStateEmpty'), 'is-empty');
    } else {
      app.renderAccountRows(items);
      app.showAccountsTable();
    }
  } catch (error) {
    state.accountsTotalPages = 0;
    if (databaseAccountsBody instanceof HTMLElement) {
      databaseAccountsBody.innerHTML = '';
    }
    app.setAccountsState(app.apiErrorMessage(error, 'runtime.loadAccountsFailed'), 'is-error');
  } finally {
    state.accountsLoading = false;
    app.updateAccountsPagination();
  }
};

export const initDatabaseAccountsFeature = () => {
  if (databaseAccountsBody instanceof HTMLElement) {
    databaseAccountsBody.addEventListener('click', app.handleAccountActionClick);
  }

  if (databaseAccountsSearchInput instanceof HTMLInputElement) {
    databaseAccountsSearchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      state.accountsKeyword = databaseAccountsSearchInput.value.trim();
      state.accountsCurrentPage = 1;
      if (app.isDatabaseHealthy()) {
        void app.loadDatabaseAccounts(1);
      }
    });
  }

  const accountsTable = document.querySelector('#database-accounts-section .accounts-table');
  if (accountsTable instanceof HTMLElement) {
    accountsTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (!(sortBtn instanceof HTMLButtonElement)) return;
      const sortField = sortBtn.dataset.sortField;
      if (!sortField) return;
      app._handleAccountsSortClick(sortField);
      state.accountsCurrentPage = 1;
      if (app.isDatabaseHealthy()) {
        void app.loadDatabaseAccounts(1);
      }
    });
  }

  if (databaseAccountsPrevButton instanceof HTMLButtonElement) {
    databaseAccountsPrevButton.addEventListener('click', () => {
      if (state.accountsCurrentPage > 1) {
        void app.loadDatabaseAccounts(state.accountsCurrentPage - 1);
      }
    });
  }

  if (databaseAccountsNextButton instanceof HTMLButtonElement) {
    databaseAccountsNextButton.addEventListener('click', () => {
      if (state.accountsCurrentPage < state.accountsTotalPages) {
        void app.loadDatabaseAccounts(state.accountsCurrentPage + 1);
      }
    });
  }

  if (databaseAccountsJumpInput instanceof HTMLInputElement) {
    databaseAccountsJumpInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      app.submitAccountsPageJump();
    });
  }

  if (databaseAccountsJumpButton instanceof HTMLButtonElement) {
    databaseAccountsJumpButton.addEventListener('click', app.submitAccountsPageJump);
  }
};
