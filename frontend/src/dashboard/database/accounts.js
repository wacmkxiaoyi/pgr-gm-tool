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
  databaseSelectedAccountLabel,
} = dom;

app.renderSelectedAccountBadge = () => {
  if (databaseSelectedAccountLabel instanceof HTMLElement) {
    databaseSelectedAccountLabel.textContent = `已选定用户：${state.selectedAccountUid ?? '--'}`;
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

      button.textContent = isSelected ? '已选定' : (isPending ? '选定中...' : '选定');
      button.disabled = isSelected || isPending || state.accountSelectionPendingUid !== null;
      button.classList.toggle('is-selected', isSelected);
    });
  }

  app.renderSelectedAccountBadge();
};

app.setSelectedAccountUid = (uid) => {
  state.selectedAccountUid = app.normalizeAccountUid(uid);
  app.updateAccountSelectionUi();
  app.resetPlayerProfileView();
  app.updatePlayerProfileAccess();
  if (app.isDatabasePlayerProfileSectionActive() && app.canAccessPlayerProfile()) {
    void app.loadSelectedPlayerProfile();
  }
};

app.clearSelectedAccount = async () => {
  try {
    const response = await fetch('/api/database-accounts/selection', {
      method: 'DELETE',
      credentials: 'include',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '清空已选定用户失败');
    }

    app.setSelectedAccountUid(payload?.selected_uid ?? null);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '清空已选定用户失败');
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
    databaseAccountsPaginationLabel.textContent = `第 ${state.accountsTotalPages === 0 ? 0 : state.accountsCurrentPage} / ${state.accountsTotalPages} 页`;
  }

  if (databaseAccountsPrevButton instanceof HTMLButtonElement) {
    databaseAccountsPrevButton.disabled = state.accountsLoading || state.accountsCurrentPage <= 1 || state.accountsTotalPages === 0 || !app.isDatabaseHealthy();
  }

  if (databaseAccountsNextButton instanceof HTMLButtonElement) {
    databaseAccountsNextButton.disabled = state.accountsLoading || state.accountsTotalPages === 0 || state.accountsCurrentPage >= state.accountsTotalPages || !app.isDatabaseHealthy();
  }
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
          <button class="status-action-button status-action-button-log" type="button" data-account-action="select" data-account-uid="${item?.uid ?? ''}">选定</button>
          <button class="status-action-button status-action-button-config" type="button" data-account-action="password" data-account-uid="${item?.uid ?? ''}" data-account-username="${item?.username ?? ''}">重置密码</button>
          <button class="status-action-button status-action-button-stop" type="button" data-account-action="delete" data-account-uid="${item?.uid ?? ''}" data-account-username="${item?.username ?? ''}">删除</button>
        </div>
      </td>
    </tr>
  `).join('');

  app.updateAccountSelectionUi();
};

app.loadSelectedAccount = async () => {
  try {
    const response = await fetch('/api/database-accounts/selection', { credentials: 'include' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '加载已选定用户失败');
    }

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
    app.openControlModal('数据库服务未处于正常状态，暂时无法选定账户。');
    return;
  }

  state.accountSelectionPendingUid = normalizedUid;
  app.updateAccountSelectionUi();

  try {
    const response = await fetch('/api/database-accounts/selection', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: normalizedUid }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '选定账户失败');
    }

    app.setSelectedAccountUid(payload?.selected_uid ?? normalizedUid);
  } catch (error) {
    app.openControlModal(error instanceof Error ? error.message : '选定账户失败');
  } finally {
    state.accountSelectionPendingUid = null;
    app.updateAccountSelectionUi();
  }
};

app.updateDatabaseAccountsAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);

  if (databaseAccountsSubnavButton instanceof HTMLButtonElement) {
    databaseAccountsSubnavButton.disabled = !healthy;
    databaseAccountsSubnavButton.title = healthy ? '' : '仅在数据库服务正常时允许查看账号管理';
  }

  if (databaseAccountsSummary instanceof HTMLElement) {
    databaseAccountsSummary.textContent = healthy
      ? (state.accountsHasLoaded ? '账户列表已加载，每页 25 条' : '数据库服务正常，可查看账户列表')
      : '仅在数据库服务正常时可查看';
  }

  if (!healthy) {
    state.accountsTotalPages = 0;
    app.updateAccountsPagination();
    if (databaseAccountsBody instanceof HTMLElement) {
      databaseAccountsBody.innerHTML = '';
    }
    app.setAccountsState('数据库服务正常后可查看账户列表。', 'is-muted');

    if (app.isDatabaseAccountsSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    app.updatePlayerProfileAccess(payload);
    return;
  }

  app.updateAccountsPagination();
  app.updatePlayerProfileAccess(payload);
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
  app.setAccountsState('正在加载账户列表...', 'is-loading');

  try {
    const response = await fetch(`/api/database-accounts?page=${state.accountsCurrentPage}&page_size=25`, { credentials: 'include' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '加载账户列表失败');
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.accountsCurrentPage = typeof payload?.page === 'number' ? payload.page : state.accountsCurrentPage;
    state.accountsTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    state.accountsHasLoaded = true;

    if (databaseAccountsSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseAccountsSummary.textContent = `共 ${total} 个账户，每页 25 条`;
    }

    if (items.length === 0) {
      if (databaseAccountsBody instanceof HTMLElement) {
        databaseAccountsBody.innerHTML = '';
      }
      app.setAccountsState('暂无账户数据。', 'is-empty');
    } else {
      app.renderAccountRows(items);
      app.showAccountsTable();
    }
  } catch (error) {
    state.accountsTotalPages = 0;
    if (databaseAccountsBody instanceof HTMLElement) {
      databaseAccountsBody.innerHTML = '';
    }
    app.setAccountsState(error instanceof Error ? error.message : '加载账户列表失败', 'is-error');
  } finally {
    state.accountsLoading = false;
    app.updateAccountsPagination();
  }
};

export const initDatabaseAccountsFeature = () => {
  if (databaseAccountsBody instanceof HTMLElement) {
    databaseAccountsBody.addEventListener('click', app.handleAccountActionClick);
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
};
