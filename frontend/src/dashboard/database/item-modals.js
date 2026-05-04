import { app } from '../shared.js';

const { dom, state } = app;
const {
  itemDeleteModal,
  itemDeleteTitle,
  itemDeleteMessage,
  itemDeleteCloseTargets,
  itemDeleteConfirmButton,
} = dom;

app.closeItemDeleteModal = () => {
  state.pendingDeleteItem = null;
  state.pendingClearItemsKeyword = null;
  if (!(itemDeleteModal instanceof HTMLElement) || itemDeleteModal.hidden) {
    return;
  }

  itemDeleteModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastDeleteItemFocusedControl instanceof HTMLElement) {
    state.lastDeleteItemFocusedControl.focus();
  }
};

app.openItemDeleteModal = (item, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = item;
  state.pendingClearItemsKeyword = null;
  state.lastDeleteItemFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.itemDeleteTitle');
  itemDeleteMessage.textContent = app.translate('runtime.itemDeleteConfirm', {
    itemName: item?.itemName ?? app.translate('common.notAvailable'),
    itemId: item?.itemId ?? app.translate('common.notAvailable'),
    quantity: item?.quantity ?? app.translate('common.notAvailable'),
  });
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.itemDeleteSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openClearItemsModal = (keyword, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingClearItemsKeyword = keyword;
  state.lastDeleteItemFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.itemClearTitle');
  itemDeleteMessage.textContent = keyword
    ? app.translate('runtime.itemClearConfirm', { keyword })
    : app.translate('runtime.itemClearAllConfirm');
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.itemClearSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.confirmDeleteOrClearItems = async () => {
  if (!(itemDeleteConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  itemDeleteConfirmButton.disabled = true;

  try {
    if (state.pendingDeleteItem) {
      const { itemId, itemName } = state.pendingDeleteItem;
      await app.apiFetch(`/api/database-items/selected/${itemId}`, {
        method: 'DELETE',
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(app.translate('runtime.itemDeleteSuccess', { itemName, itemId }), app.translate('runtime.itemDeleteSuccessTitle'));
      await app.reloadItemManagementCurrentPage();
      return;
    }

    if (state.pendingClearItemsKeyword !== null) {
      const keyword = state.pendingClearItemsKeyword;
      const payload = await app.apiFetch('/api/database-items/selected', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword }),
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(
        keyword
          ? app.translate('runtime.itemClearSuccess', { keyword, count: payload?.deleted_count ?? 0 })
          : app.translate('runtime.itemClearAllSuccess', { count: payload?.deleted_count ?? 0 }),
        app.translate('runtime.itemClearSuccessTitle'),
      );
      state.itemManagementCurrentPage = 1;
      await app.loadSelectedAccountItems(1);
      return;
    }

    app.closeItemDeleteModal();
  } catch (error) {
    const fallbackKey = state.pendingDeleteItem ? 'runtime.itemDeleteFailed' : 'runtime.itemClearFailed';
    app.closeItemDeleteModal();
    app.openControlModal(app.apiErrorMessage(
      error,
      fallbackKey,
    ));
  } finally {
    itemDeleteConfirmButton.disabled = false;
  }
};

export const initDatabaseItemModalFeature = () => {
  itemDeleteCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeItemDeleteModal);
  });

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.addEventListener('click', () => {
      void app.confirmDeleteOrClearItems();
    });
  }
};
