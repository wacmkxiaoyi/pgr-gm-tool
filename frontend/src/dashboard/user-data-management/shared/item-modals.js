import { app } from '../../shared.js';

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
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  if (typeof app.hideStageDescriptionTooltip === 'function') {
    app.hideStageDescriptionTooltip();
  }
  if (!(itemDeleteModal instanceof HTMLElement) || itemDeleteModal.hidden) {
    return;
  }

  itemDeleteModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastItemDeleteTrigger instanceof HTMLElement) {
    state.lastItemDeleteTrigger.focus();
  }
};

app.openItemDeleteModal = (item, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = item;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
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

app.openStageDeleteModal = (stage, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = stage;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.stageDeleteTitle');
  itemDeleteMessage.textContent = app.translate('runtime.stageDeleteConfirm', {
    stageName: stage?.stageName ?? app.translate('common.notAvailable'),
    stageId: stage?.stageId ?? app.translate('common.notAvailable'),
  });
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.stageDeleteSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openWeaponResonanceDeleteModal = (payload, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.weaponResonanceDeleteTitle');
  itemDeleteMessage.textContent = app.translate('runtime.weaponResonanceDeleteConfirm', {
    weaponName: payload?.weaponName ?? app.translate('common.notAvailable'),
    slot: payload?.slot ?? app.translate('common.notAvailable'),
  });
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.weaponResonanceDeleteSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openWeaponDeleteModal = (weapon, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = weapon;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.weaponDeleteTitle');
  itemDeleteMessage.textContent = app.translate('runtime.weaponDeleteConfirm', {
    weaponName: weapon?.weaponName ?? app.translate('common.notAvailable'),
    templateId: weapon?.templateId ?? app.translate('common.notAvailable'),
    characterName: weapon?.characterName ?? app.translate('common.notAvailable'),
  });
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.weaponDeleteSubmit');
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
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = keyword;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
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

app.openClearStagesModal = (trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = true;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.stageClearTitle');
  itemDeleteMessage.textContent = app.translate('runtime.stageClearConfirm');
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.stageClearSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openClearWeaponsModal = (keyword, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = keyword;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.weaponClearTitle');
  itemDeleteMessage.textContent = keyword
    ? app.translate('runtime.weaponClearConfirm', { keyword })
    : app.translate('runtime.weaponClearAllConfirm');
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.weaponClearSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openMemoryDeleteModal = (memory, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = memory;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.memoryDeleteTitle');
  itemDeleteMessage.textContent = app.translate('runtime.memoryDeleteConfirm', {
    memoryName: memory?.memoryName ?? app.translate('common.notAvailable'),
    templateId: memory?.templateId ?? app.translate('common.notAvailable'),
    characterName: memory?.characterName ?? app.translate('common.notAvailable'),
  });
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.memoryDeleteSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openClearMemoriesModal = (keyword, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = keyword;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.memoryClearTitle');
  itemDeleteMessage.textContent = keyword
    ? app.translate('runtime.memoryClearConfirm', { keyword })
    : app.translate('runtime.memoryClearAllConfirm');
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.memoryClearSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openCharacterMaxAllModal = (character, trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = character;
  state.pendingCharacterManagementMaxAll = false;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.characterDetailMaxAllConfirmTitle');
  itemDeleteMessage.textContent = app.translate('runtime.characterDetailMaxAllConfirm', {
    characterName: character?.characterName ?? app.translate('common.notAvailable'),
  });
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.characterDetailMaxAllConfirmSubmit');
  }
  itemDeleteModal.hidden = false;
  app.setBodyModalOpen(true);

  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.focus();
  }
};

app.openCharacterManagementMaxAllModal = (trigger) => {
  if (!(itemDeleteModal instanceof HTMLElement) || !(itemDeleteMessage instanceof HTMLElement) || !(itemDeleteTitle instanceof HTMLElement)) {
    return;
  }

  state.pendingDeleteItem = null;
  state.pendingDeleteStage = null;
  state.pendingDeleteWeapon = null;
  state.pendingDeleteMemory = null;
  state.pendingCharacterMaxAll = null;
  state.pendingCharacterManagementMaxAll = true;
  state.pendingDeleteWeaponResonance = null;
  state.pendingClearItemsKeyword = null;
  state.pendingClearStages = false;
  state.pendingClearWeaponsKeyword = null;
  state.pendingClearMemoriesKeyword = null;
  state.lastItemDeleteTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  itemDeleteTitle.textContent = app.translate('runtime.characterManagementMaxAllConfirmTitle');
  itemDeleteMessage.textContent = app.translate('runtime.characterManagementMaxAllConfirm');
  if (itemDeleteConfirmButton instanceof HTMLButtonElement) {
    itemDeleteConfirmButton.textContent = app.translate('runtime.characterManagementMaxAllConfirmSubmit');
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

    if (state.pendingDeleteStage) {
      const { stageId, stageName } = state.pendingDeleteStage;
      await app.apiFetch(`/api/database-stages/selected/${stageId}`, {
        method: 'DELETE',
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(app.translate('runtime.stageDeleteSuccess', { stageName, stageId }), app.translate('runtime.stageDeleteSuccessTitle'));
      await app.reloadStageManagementCurrentPage();
      return;
    }

    if (state.pendingDeleteWeapon) {
      const { recordId, weaponName, templateId } = state.pendingDeleteWeapon;
      await app.apiFetch(`/api/database-weapons/selected/${recordId}`, {
        method: 'DELETE',
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(app.translate('runtime.weaponDeleteSuccess', { weaponName, templateId }), app.translate('runtime.weaponDeleteSuccessTitle'));
      await app.reloadWeaponManagementCurrentPage();
      return;
    }

    if (state.pendingDeleteMemory) {
      const { recordId, memoryName, templateId } = state.pendingDeleteMemory;
      await app.apiFetch(`/api/database-memories/selected/${recordId}`, {
        method: 'DELETE',
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(app.translate('runtime.memoryDeleteSuccess', { memoryName, templateId }), app.translate('runtime.memoryDeleteSuccessTitle'));
      await app.reloadMemoryManagementCurrentPage();
      return;
    }

    if (state.pendingCharacterMaxAll) {
      const { recordId } = state.pendingCharacterMaxAll;
      app.closeItemDeleteModal();
      await app.executeCharacterMaxAll(recordId);
      return;
    }

    if (state.pendingCharacterManagementMaxAll) {
      const payload = await app.apiFetch('/api/database-characters/selected/max-all', {
        method: 'PUT',
      });
      app.closeItemDeleteModal();
      app.closeCharacterDetailModal?.();
      app.openSuccessModal(
        app.translate('runtime.characterManagementMaxAllSuccess', {
          count: payload?.character_count ?? 0,
          equipCount: payload?.equip_count ?? 0,
          gatherRewardCount: payload?.gather_reward_count ?? 0,
          skipped: (payload?.skipped_character_ids ?? []).join(', ') || '0',
        }),
        app.translate('runtime.characterManagementMaxAllSuccessTitle'),
      );
      await app.loadSelectedAccountCharacters(1);
      return;
    }

    if (state.pendingDeleteWeaponResonance) {
      const { recordId, slot, slotLabel, weaponName, detailMode } = state.pendingDeleteWeaponResonance;
      const basePath = detailMode === 'memory' ? '/api/database-memories/selected' : '/api/database-weapons/selected';
      await app.apiFetch(`${basePath}/${recordId}/resonance/${slot}`, {
        method: 'DELETE',
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(
        app.translate('runtime.weaponResonanceDeleteSuccess', { weaponName, slot: slotLabel ?? slot }),
        app.translate('runtime.weaponResonanceDeleteSuccessTitle'),
      );
      delete state._weaponResonanceEditSlots?.[slot];
      delete state._weaponResonancePendingEffect?.[slot];
      delete state._weaponResonancePendingAwake?.[slot];
      delete state._weaponResonancePendingCharacter?.[slot];
      if (detailMode === 'memory') {
        await app.loadMemoryDetailExtraInfo(recordId);
      } else {
        await app.loadWeaponDetailExtraInfo(recordId);
      }
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

    if (state.pendingClearStages) {
      const payload = await app.apiFetch('/api/database-stages/selected', {
        method: 'DELETE',
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(
        app.translate('runtime.stageClearSuccess', { count: payload?.deleted_count ?? 0 }),
        app.translate('runtime.stageClearSuccessTitle'),
      );
      state.stageManagementCurrentPage = 1;
      await app.loadSelectedAccountStages(1);
      return;
    }

    if (state.pendingClearWeaponsKeyword !== null) {
      const keyword = state.pendingClearWeaponsKeyword;
      const payload = await app.apiFetch('/api/database-weapons/selected', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword }),
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(
        keyword
          ? app.translate('runtime.weaponClearSuccess', { keyword, count: payload?.deleted_count ?? 0 })
          : app.translate('runtime.weaponClearAllSuccess', { count: payload?.deleted_count ?? 0 }),
        app.translate('runtime.weaponClearSuccessTitle'),
      );
      await app.reloadWeaponManagementCurrentPage();
      return;
    }

    if (state.pendingClearMemoriesKeyword !== null) {
      const keyword = state.pendingClearMemoriesKeyword;
      const payload = await app.apiFetch('/api/database-memories/selected', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword }),
      });
      app.closeItemDeleteModal();
      app.openSuccessModal(
        keyword
          ? app.translate('runtime.memoryClearSuccess', { keyword, count: payload?.deleted_count ?? 0 })
          : app.translate('runtime.memoryClearAllSuccess', { count: payload?.deleted_count ?? 0 }),
        app.translate('runtime.memoryClearSuccessTitle'),
      );
      await app.reloadMemoryManagementCurrentPage();
      return;
    }
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    const fallbackKey = state.pendingDeleteItem
      ? 'runtime.itemDeleteFailed'
      : state.pendingDeleteStage
        ? 'runtime.stageDeleteFailed'
      : state.pendingDeleteWeapon
        ? 'runtime.weaponDeleteFailed'
        : state.pendingDeleteMemory
          ? 'runtime.memoryDeleteFailed'
          : state.pendingCharacterMaxAll
            ? 'runtime.characterDetailMaxAllFailed'
            : state.pendingCharacterManagementMaxAll
              ? 'runtime.characterManagementMaxAllFailed'
            : state.pendingDeleteWeaponResonance
              ? 'runtime.weaponResonanceDeleteFailed'
              : state.pendingClearStages
                ? 'runtime.stageClearFailed'
              : state.pendingClearWeaponsKeyword !== null
                ? 'runtime.weaponClearFailed'
                : state.pendingClearMemoriesKeyword !== null
                  ? 'runtime.memoryClearFailed'
                  : 'runtime.itemClearFailed';
    app.closeItemDeleteModal();
    app.openNoticeModal(app.apiErrorMessage(
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
