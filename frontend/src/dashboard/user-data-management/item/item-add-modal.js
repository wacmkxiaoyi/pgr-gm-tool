import { app } from '../../shared.js';

const { dom, state } = app;
const {
  itemAddModal,
  itemAddSearchInput,
  itemAddTableBody,
  itemAddEmptyState,
  itemAddCloseTargets,
  itemAddSubmitButton,
} = dom;

const ITEM_ADD_VISIBLE_LIMIT = 200;

app.getAddableItemCatalog = () => {
  return Object.entries(state.itemNameMap ?? {})
    .map(([itemId, itemName]) => ({
      itemId: Number.parseInt(itemId, 10),
      itemName: String(itemName ?? '').trim(),
    }))
    .filter((item) => Number.isFinite(item.itemId) && item.itemId > 18 && item.itemName);
};

app._itemAddSortFields = ['item_id', 'name'];

app._syncItemAddSortArrows = () => {
  const table = itemAddModal instanceof HTMLElement ? itemAddModal.querySelector('.item-add-table') : null;
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.itemAddSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.itemAddSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleItemAddSortClick = (sortField) => {
  if (!app._itemAddSortFields.includes(sortField)) return;
  if (state.itemAddSortBy === sortField) {
    state.itemAddSortOrder = state.itemAddSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.itemAddSortBy = sortField;
    state.itemAddSortOrder = 'asc';
  }
  app._syncItemAddSortArrows();
};

app.compareItemAddCatalogEntries = (left, right) => {
  if (state.itemAddSortBy === 'name') {
    const nameComparison = left.itemName.localeCompare(right.itemName, state.locale, {
      numeric: true,
      sensitivity: 'base',
    });
    if (nameComparison !== 0) {
      return nameComparison;
    }
  } else {
    const idComparison = left.itemId - right.itemId;
    if (idComparison !== 0) {
      return idComparison;
    }
  }

  return left.itemId - right.itemId;
};

app.getFilteredAddableItemCatalog = () => {
  const keyword = state.itemAddSearchKeyword.trim().toLowerCase();
  const direction = state.itemAddSortOrder === 'desc' ? -1 : 1;
  return app.getAddableItemCatalog()
    .filter((item) => !keyword || item.itemName.toLowerCase().includes(keyword))
    .sort((left, right) => app.compareItemAddCatalogEntries(left, right) * direction)
    .slice(0, ITEM_ADD_VISIBLE_LIMIT);
};

app.renderItemAddModalRows = () => {
  if (!(itemAddTableBody instanceof HTMLElement) || !(itemAddEmptyState instanceof HTMLElement)) {
    return;
  }

  const items = app.getFilteredAddableItemCatalog();
  itemAddTableBody.innerHTML = items.map((item) => {
    const draftQuantity = state.itemAddDraftQuantities?.[item.itemId] ?? '';
    const validationMessage = draftQuantity ? app.validateItemQuantity(draftQuantity) : '';
    return `
      <tr>
        <td>${item.itemId}</td>
        <td>${item.itemName}</td>
        <td>
          <input
            class="item-add-quantity-input${validationMessage ? ' is-invalid' : ''}"
            type="text"
            inputmode="numeric"
            data-item-add-quantity-input="true"
            data-item-id="${item.itemId}"
            value="${draftQuantity}"
          >
        </td>
      </tr>
    `;
  }).join('');

  itemAddEmptyState.hidden = items.length > 0;
};

app.resetItemAddModalState = () => {
  state.itemAddSearchKeyword = '';
  state.itemAddSortBy = 'item_id';
  state.itemAddSortOrder = 'asc';
  state.itemAddDraftQuantities = {};
  state.itemAddSubmitting = false;
  if (itemAddSearchInput instanceof HTMLInputElement) {
    itemAddSearchInput.value = '';
  }
};

app.closeItemAddModal = () => {
  app.resetItemAddModalState();
  if (!(itemAddModal instanceof HTMLElement) || itemAddModal.hidden) {
    return;
  }

  itemAddModal.hidden = true;
  app.setBodyModalOpen(false);
  if (state.lastItemAddTrigger instanceof HTMLElement) {
    state.lastItemAddTrigger.focus();
  }
};

app.openItemAddModal = (trigger) => {
  if (!(itemAddModal instanceof HTMLElement)) {
    return;
  }

  state.lastItemAddTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetItemAddModalState();
  app._syncItemAddSortArrows();
  app.renderItemAddModalRows();
  itemAddModal.hidden = false;
  app.setBodyModalOpen(true);
  if (itemAddSearchInput instanceof HTMLInputElement) {
    itemAddSearchInput.focus();
  }
};

app.collectItemAddPayload = () => {
  const entries = Object.entries(state.itemAddDraftQuantities ?? {});
  const items = [];
  for (const [itemIdRaw, quantityRaw] of entries) {
    const normalizedQuantity = String(quantityRaw ?? '').trim();
    if (!normalizedQuantity) {
      continue;
    }

    const validationMessage = app.validateItemQuantity(normalizedQuantity);
    if (validationMessage) {
      return { error: validationMessage, items: [] };
    }

    items.push({
      item_id: Number.parseInt(itemIdRaw, 10),
      quantity: Number.parseInt(normalizedQuantity, 10),
    });
  }

  if (items.length === 0) {
    return { error: app.translate('dashboard.itemAddNoSelection'), items: [] };
  }

  return { error: '', items };
};

app.submitItemAddModal = async () => {
  if (!(itemAddSubmitButton instanceof HTMLButtonElement) || state.itemAddSubmitting) {
    return;
  }

  const { error, items } = app.collectItemAddPayload();
  if (error) {
    app.openNoticeModal(error);
    return;
  }

  state.itemAddSubmitting = true;
  itemAddSubmitButton.disabled = true;

  try {
    const payload = await app.apiFetch('/api/database-items/selected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    app.closeItemAddModal();
    app.openSuccessModal(
      app.translate('runtime.itemAddSuccess', {
        addedCount: payload?.added_count ?? 0,
        createdCount: payload?.created_count ?? 0,
        updatedCount: payload?.updated_count ?? 0,
      }),
      app.translate('runtime.itemAddSuccessTitle'),
    );
    await app.reloadItemManagementCurrentPage();
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.itemAddFailed'));
  } finally {
    state.itemAddSubmitting = false;
    if (itemAddSubmitButton instanceof HTMLButtonElement) {
      itemAddSubmitButton.disabled = false;
    }
  }
};

export const initDatabaseItemAddModalFeature = () => {
  itemAddCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeItemAddModal);
  });

  if (itemAddSearchInput instanceof HTMLInputElement) {
    itemAddSearchInput.addEventListener('input', () => {
      state.itemAddSearchKeyword = itemAddSearchInput.value.trim();
      app.renderItemAddModalRows();
    });
  }

  const itemAddTable = itemAddModal instanceof HTMLElement ? itemAddModal.querySelector('.item-add-table') : null;
  if (itemAddTable instanceof HTMLElement) {
    itemAddTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (sortBtn instanceof HTMLButtonElement && sortBtn.dataset.sortField) {
        app._handleItemAddSortClick(sortBtn.dataset.sortField);
        app.renderItemAddModalRows();
      }
    });
  }

  if (itemAddTableBody instanceof HTMLElement) {
    itemAddTableBody.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.dataset.itemAddQuantityInput !== 'true') {
        return;
      }

      const itemId = target.dataset.itemId;
      if (!itemId) {
        return;
      }

      state.itemAddDraftQuantities[itemId] = target.value;
      const validationMessage = target.value.trim() ? app.validateItemQuantity(target.value) : '';
      target.classList.toggle('is-invalid', Boolean(validationMessage));
    });
  }

  if (itemAddSubmitButton instanceof HTMLButtonElement) {
    itemAddSubmitButton.addEventListener('click', () => {
      void app.submitItemAddModal();
    });
  }
};
