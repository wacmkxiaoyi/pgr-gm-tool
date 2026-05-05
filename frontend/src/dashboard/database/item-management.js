import { app } from '../shared.js';

const { dom, state } = app;
const ITEM_QUANTITY_MIN = 1;
const ITEM_QUANTITY_MAX = 99999;
const {
  databaseItemManagementSubnavButton,
  databaseItemManagementState,
  databaseItemManagementShell,
  databaseItemManagementTableShell,
  databaseItemManagementBody,
  databaseItemManagementSummary,
  databaseItemManagementActions,
  databaseItemManagementPrevButton,
  databaseItemManagementNextButton,
  databaseItemManagementPaginationLabel,
  databaseItemSortFieldSelect,
  databaseItemSortOrderSelect,
  databaseItemSearchInput,
} = dom;

app.setItemManagementState = (message, tone = '') => {
  if (databaseItemManagementState instanceof HTMLElement) {
    databaseItemManagementState.textContent = message;
    databaseItemManagementState.className = 'database-player-empty';
    if (tone) {
      databaseItemManagementState.classList.add(tone);
    }
    databaseItemManagementState.hidden = false;
  }

  if (databaseItemManagementShell instanceof HTMLElement) {
    databaseItemManagementShell.hidden = true;
  }
};

app.showItemManagementTable = () => {
  if (databaseItemManagementState instanceof HTMLElement) {
    databaseItemManagementState.hidden = true;
  }

  if (databaseItemManagementShell instanceof HTMLElement) {
    databaseItemManagementShell.hidden = false;
  }

  if (databaseItemManagementTableShell instanceof HTMLElement) {
    databaseItemManagementTableShell.hidden = false;
  }

  if (databaseItemManagementActions instanceof HTMLElement) {
    databaseItemManagementActions.hidden = false;
  }
};

app.getItemNameById = (itemId) => {
  if (itemId === null || itemId === undefined) {
    return '--';
  }

  const name = state.itemNameMap?.[itemId];
  return typeof name === 'string' && name.trim() ? name : '--';
};

app.updateItemManagementPagination = () => {
  if (databaseItemManagementPaginationLabel instanceof HTMLElement) {
    databaseItemManagementPaginationLabel.textContent = app.translate('dashboard.accountsPagination', {
      page: state.itemManagementTotalPages === 0 ? 0 : state.itemManagementCurrentPage,
      totalPages: state.itemManagementTotalPages,
    });
  }

  if (databaseItemManagementPrevButton instanceof HTMLButtonElement) {
    databaseItemManagementPrevButton.disabled = state.itemManagementLoading || state.itemManagementCurrentPage <= 1 || state.itemManagementTotalPages === 0 || !app.canAccessItemManagement();
  }

  if (databaseItemManagementNextButton instanceof HTMLButtonElement) {
    databaseItemManagementNextButton.disabled = state.itemManagementLoading || state.itemManagementTotalPages === 0 || state.itemManagementCurrentPage >= state.itemManagementTotalPages || !app.canAccessItemManagement();
  }
};

app.renderItemRows = (items) => {
  if (!(databaseItemManagementBody instanceof HTMLElement)) {
    return;
  }

  databaseItemManagementBody.innerHTML = Array.isArray(items) ? items.map((item) => `
    <tr>
      <td>${item?.item_id ?? '--'}</td>
      <td>${app.getItemNameById(item?.item_id)}</td>
      <td>
        <span class="item-management-quantity is-editable" tabindex="0" role="button" title="${app.translate('dashboard.itemManagementQuantityEditTitle')}" data-item-edit-quantity="true" data-item-id="${item?.item_id ?? ''}" data-item-quantity="${item?.quantity ?? ''}">${item?.quantity ?? '--'}</span>
      </td>
      <td>
        <div class="accounts-row-actions">
          <button class="status-action-button status-action-button-stop" type="button" data-item-management-action="delete" data-item-id="${item?.item_id ?? ''}" data-item-name="${app.getItemNameById(item?.item_id)}" data-item-quantity="${item?.quantity ?? ''}">${app.translate('dashboard.itemManagementDelete')}</button>
        </div>
      </td>
    </tr>
  `).join('') : '';
};

app.syncItemManagementSortControls = () => {
  if (databaseItemSortFieldSelect instanceof HTMLSelectElement) {
    databaseItemSortFieldSelect.value = state.itemManagementSortBy;
  }

  if (databaseItemSortOrderSelect instanceof HTMLSelectElement) {
    databaseItemSortOrderSelect.value = state.itemManagementSortOrder;
  }
};

app.applyItemManagementSort = () => {
  const nextSortBy = databaseItemSortFieldSelect instanceof HTMLSelectElement ? databaseItemSortFieldSelect.value : state.itemManagementSortBy;
  const nextSortOrder = databaseItemSortOrderSelect instanceof HTMLSelectElement ? databaseItemSortOrderSelect.value : state.itemManagementSortOrder;
  state.itemManagementSortBy = nextSortBy === 'name' || nextSortBy === 'quantity' ? nextSortBy : 'item_id';
  state.itemManagementSortOrder = nextSortOrder === 'desc' ? 'desc' : 'asc';
  app.syncItemManagementSortControls();
};

app.reloadItemManagementCurrentPage = async () => {
  const targetPage = Math.max(1, state.itemManagementCurrentPage);
  await app.loadSelectedAccountItems(targetPage);
  if (state.itemManagementTotalPages > 0 && state.itemManagementCurrentPage > state.itemManagementTotalPages) {
    await app.loadSelectedAccountItems(state.itemManagementTotalPages);
  }
};

app.stopItemQuantityEdit = (itemId) => {
  if (!state.itemManagementEditState || state.itemManagementEditState.itemId !== itemId) {
    return;
  }

  const quantityElement = databaseItemManagementBody?.querySelector(`span[data-item-edit-quantity="true"][data-item-id="${itemId}"]`);
  if (quantityElement instanceof HTMLElement) {
    quantityElement.classList.remove('is-editing');
    quantityElement.textContent = quantityElement.dataset.itemQuantity ?? '--';
  }

  state.itemManagementEditState = null;
};

app.validateItemQuantity = (value) => {
  const normalizedValue = String(value ?? '').trim();
  if (!/^\d+$/.test(normalizedValue)) {
    return app.translate('runtime.itemQuantityInvalid');
  }

  const quantity = Number.parseInt(normalizedValue, 10);
  if (!Number.isFinite(quantity)) {
    return app.translate('runtime.itemQuantityInvalid');
  }

  if (quantity < ITEM_QUANTITY_MIN) {
    return app.translate('runtime.itemQuantityMin');
  }

  if (quantity > ITEM_QUANTITY_MAX) {
    return app.translate('runtime.itemQuantityMax');
  }

  return '';
};

app.beginItemQuantityEdit = (quantityElement) => {
  if (!(quantityElement instanceof HTMLElement)) {
    return;
  }

  const itemId = Number.parseInt(quantityElement.dataset.itemId ?? '', 10);
  const rawQuantity = quantityElement.dataset.itemQuantity ?? '';
  if (!Number.isFinite(itemId)) {
    return;
  }

  if (itemId >= 1 && itemId <= 18) {
    app.openControlModal(app.translate('runtime.itemUpdateProtected'));
    return;
  }

  if (state.itemManagementEditState?.itemId === itemId) {
    const existingInput = quantityElement.querySelector('input');
    if (existingInput instanceof HTMLInputElement) {
      existingInput.focus();
      existingInput.select();
    }
    return;
  }

  if (state.itemManagementEditState?.itemId) {
    app.stopItemQuantityEdit(state.itemManagementEditState.itemId);
  }

  state.itemManagementEditState = { itemId, pending: false };
  quantityElement.classList.add('is-editing');
  quantityElement.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'database-item-inline-input';
  input.value = String(rawQuantity);
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', app.translate('dashboard.itemManagementQuantity'));
  quantityElement.appendChild(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void app.submitItemQuantityEdit(itemId, rawQuantity, input.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      app.stopItemQuantityEdit(itemId);
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (state.itemManagementEditState?.itemId === itemId && !state.itemManagementEditState.pending) {
        app.stopItemQuantityEdit(itemId);
      }
    }, 0);
  });
};

app.submitItemQuantityEdit = async (itemId, currentQuantity, nextValue) => {
  const currentState = state.itemManagementEditState;
  if (!currentState || currentState.itemId !== itemId) {
    return;
  }

  const normalizedValue = String(nextValue ?? '').trim();
  const validationMessage = app.validateItemQuantity(normalizedValue);
  if (validationMessage) {
    app.openControlModal(validationMessage);
    return;
  }

  if (String(currentQuantity).trim() === normalizedValue) {
    app.stopItemQuantityEdit(itemId);
    return;
  }

  currentState.pending = true;
  const editor = databaseItemManagementBody?.querySelector(`span[data-item-edit-quantity="true"][data-item-id="${itemId}"] input`);
  if (editor instanceof HTMLInputElement) {
    editor.disabled = true;
  }

  try {
    await app.apiFetch(`/api/database-items/selected/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: Number.parseInt(normalizedValue, 10) }),
    });

    state.itemManagementEditState = null;
    await app.reloadItemManagementCurrentPage();
  } catch (error) {
    currentState.pending = false;
    await app.reloadItemManagementCurrentPage();
    app.openControlModal(app.apiErrorMessage(error, 'runtime.itemQuantityUpdateFailed'));
  }
};

app.handleItemQuantityActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
    return;
  }

  const quantityElement = target.closest('[data-item-edit-quantity]');
  if (!(quantityElement instanceof HTMLElement)) {
    return;
  }

  app.beginItemQuantityEdit(quantityElement);
};

app.resetItemManagementView = () => {
  state.itemManagementCurrentPage = 1;
  state.itemManagementTotalPages = 0;
  state.itemManagementHasLoaded = false;
  state.itemManagementLoading = false;
  state.itemManagementEditState = null;
  if (databaseItemManagementBody instanceof HTMLElement) {
    databaseItemManagementBody.innerHTML = '';
  }
  app.updateItemManagementPagination();
};

app.clearItemManagementKeyword = () => {
  state.itemManagementKeyword = '';
  if (databaseItemSearchInput instanceof HTMLInputElement) {
    databaseItemSearchInput.value = '';
  }
};

app.syncItemManagementKeywordInput = () => {
  if (databaseItemSearchInput instanceof HTMLInputElement) {
    databaseItemSearchInput.value = state.itemManagementKeyword;
  }
};

app.rerenderItemManagementLocale = () => {
  app.syncItemManagementSortControls();
  app.syncItemManagementKeywordInput();

  if (app.canAccessItemManagement() && state.itemManagementHasLoaded) {
    void app.loadSelectedAccountItems(state.itemManagementCurrentPage);
  }
};

app.loadSelectedAccountItems = async (page = 1) => {
  if (!app.canAccessItemManagement() || state.itemManagementLoading) {
    app.updateItemManagementPagination();
    return;
  }

  state.itemManagementLoading = true;
  state.itemManagementCurrentPage = Math.max(1, page);
  app.updateItemManagementPagination();
  app.setItemManagementState(app.translate('dashboard.itemManagementLoading'), 'is-loading');

  try {
    const search = new URLSearchParams({
      page: String(state.itemManagementCurrentPage),
      page_size: '10',
    });
    if (state.itemManagementKeyword) {
      search.set('keyword', state.itemManagementKeyword);
    }
    search.set('sort_by', state.itemManagementSortBy);
    search.set('sort_order', state.itemManagementSortOrder);

    const payload = await app.apiFetch(`/api/database-items/selected?${search.toString()}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.itemManagementCurrentPage = typeof payload?.page === 'number' ? payload.page : state.itemManagementCurrentPage;
    state.itemManagementTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    state.itemManagementHasLoaded = true;

    if (databaseItemManagementSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseItemManagementSummary.textContent = app.translate('dashboard.itemManagementSummaryTotal', { total });
      databaseItemManagementSummary.hidden = false;
    }

    if (items.length === 0) {
      if (databaseItemManagementBody instanceof HTMLElement) {
        databaseItemManagementBody.innerHTML = '';
      }
      app.setItemManagementState(app.translate('dashboard.itemManagementEmpty'), 'is-empty');
    } else {
      app.renderItemRows(items);
      app.showItemManagementTable();
    }
  } catch (error) {
    state.itemManagementTotalPages = 0;
    if (databaseItemManagementBody instanceof HTMLElement) {
      databaseItemManagementBody.innerHTML = '';
    }
    app.setItemManagementState(app.apiErrorMessage(error, 'runtime.loadAccountsFailed'), 'is-error');
  } finally {
    state.itemManagementLoading = false;
    app.updateItemManagementPagination();
  }
};

app.updateItemManagementAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);
  const accessible = app.canAccessItemManagement(payload);

  app.syncItemManagementKeywordInput();
  app.syncItemManagementSortControls();

  if (databaseItemManagementSubnavButton instanceof HTMLButtonElement) {
    databaseItemManagementSubnavButton.disabled = !accessible;
    if (!healthy) {
      databaseItemManagementSubnavButton.title = app.translate('runtime.itemManagementAccessTitle');
    } else if (state.selectedAccountUid === null) {
      databaseItemManagementSubnavButton.title = app.translate('runtime.itemManagementNeedAccountTitle');
    } else {
      databaseItemManagementSubnavButton.title = '';
    }
  }

  if (databaseItemManagementSummary instanceof HTMLElement) {
    if (accessible && state.itemManagementHasLoaded) {
      databaseItemManagementSummary.hidden = false;
    } else if (accessible) {
      databaseItemManagementSummary.textContent = '';
      databaseItemManagementSummary.hidden = true;
    } else {
      databaseItemManagementSummary.textContent = !healthy
        ? app.translate('dashboard.itemManagementUnavailable')
        : app.translate('dashboard.itemManagementChooseAccount');
      databaseItemManagementSummary.hidden = false;
    }
  }

  if (!healthy) {
    app.resetItemManagementView();
    app.setItemManagementState(app.translate('dashboard.itemManagementUnavailable'), 'is-muted');
    if (app.isDatabaseItemManagementSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    return;
  }

  if (state.selectedAccountUid === null) {
    app.resetItemManagementView();
    app.setItemManagementState(app.translate('dashboard.itemManagementChooseAccount'), 'is-muted');
    if (app.isDatabaseItemManagementSectionActive()) {
      app.setActiveDatabaseTab('database-accounts-section');
    }
    return;
  }

  if (!state.itemManagementHasLoaded) {
    if (databaseItemManagementBody instanceof HTMLElement) {
      databaseItemManagementBody.innerHTML = '';
    }
    app.setItemManagementState(app.translate('dashboard.itemManagementReady'), 'is-muted');
    app.updateItemManagementPagination();
    return;
  }

  app.showItemManagementTable();
  app.updateItemManagementPagination();
};

app.handleItemManagementActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-item-management-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.dataset.itemManagementAction === 'clear') {
    app.openClearItemsModal(state.itemManagementKeyword.trim(), button);
    return;
  }

  if (button.dataset.itemManagementAction === 'add-item') {
    app.openItemAddModal(button);
    return;
  }

  if (button.dataset.itemManagementAction === 'delete') {
    const itemId = Number.parseInt(button.dataset.itemId ?? '', 10);
    if (!Number.isFinite(itemId)) {
      return;
    }

    if (itemId >= 1 && itemId <= 18) {
      app.openControlModal(app.translate('runtime.itemDeleteProtected'));
      return;
    }

    app.openItemDeleteModal({
      itemId,
      itemName: button.dataset.itemName ?? app.getItemNameById(itemId),
      quantity: button.dataset.itemQuantity ?? '--',
    }, button);
  }
};

export const initDatabaseItemManagementFeature = () => {
  app.syncItemManagementSortControls();

  if (databaseItemManagementShell instanceof HTMLElement) {
    databaseItemManagementShell.addEventListener('click', app.handleItemManagementActionClick);
    databaseItemManagementShell.addEventListener('click', app.handleItemQuantityActivate);
    databaseItemManagementShell.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
        return;
      }

      const quantityElement = target.closest('[data-item-edit-quantity]');
      if (!(quantityElement instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      app.beginItemQuantityEdit(quantityElement);
    });
  }

  if (databaseItemSearchInput instanceof HTMLInputElement) {
    databaseItemSearchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      state.itemManagementKeyword = databaseItemSearchInput.value.trim();
      state.itemManagementCurrentPage = 1;
      if (app.canAccessItemManagement()) {
        void app.loadSelectedAccountItems(1);
      }
    });
  }

  if (databaseItemSortFieldSelect instanceof HTMLSelectElement) {
    databaseItemSortFieldSelect.addEventListener('change', () => {
      app.applyItemManagementSort();
      state.itemManagementCurrentPage = 1;
      if (app.canAccessItemManagement()) {
        void app.loadSelectedAccountItems(1);
      }
    });
  }

  if (databaseItemSortOrderSelect instanceof HTMLSelectElement) {
    databaseItemSortOrderSelect.addEventListener('change', () => {
      app.applyItemManagementSort();
      state.itemManagementCurrentPage = 1;
      if (app.canAccessItemManagement()) {
        void app.loadSelectedAccountItems(1);
      }
    });
  }

  if (databaseItemManagementPrevButton instanceof HTMLButtonElement) {
    databaseItemManagementPrevButton.addEventListener('click', () => {
      if (state.itemManagementCurrentPage > 1) {
        void app.loadSelectedAccountItems(state.itemManagementCurrentPage - 1);
      }
    });
  }

  if (databaseItemManagementNextButton instanceof HTMLButtonElement) {
    databaseItemManagementNextButton.addEventListener('click', () => {
      if (state.itemManagementCurrentPage < state.itemManagementTotalPages) {
        void app.loadSelectedAccountItems(state.itemManagementCurrentPage + 1);
      }
    });
  }
};
