import { app } from '../shared.js';

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
    .filter((item) => Number.isFinite(item.itemId) && item.itemId > 18 && item.itemName)
    .sort((left, right) => left.itemId - right.itemId);
};

app.getFilteredAddableItemCatalog = () => {
  const keyword = state.itemAddSearchKeyword.trim().toLowerCase();
  const catalog = app.getAddableItemCatalog();
  if (!keyword) {
    return catalog.slice(0, ITEM_ADD_VISIBLE_LIMIT);
  }

  return catalog
    .filter((item) => item.itemName.toLowerCase().includes(keyword))
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
  if (state.lastAddItemFocusedControl instanceof HTMLElement) {
    state.lastAddItemFocusedControl.focus();
  }
};

app.openItemAddModal = (trigger) => {
  if (!(itemAddModal instanceof HTMLElement)) {
    return;
  }

  state.lastAddItemFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetItemAddModalState();
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
    app.openControlModal(error);
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
    app.openControlModal(app.apiErrorMessage(error, 'runtime.itemAddFailed'));
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
