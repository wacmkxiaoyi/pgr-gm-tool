import { app } from '../../shared.js';

const { dom, state } = app;
const {
  characterDetailMemories,
  characterDetailModal,
  characterMemorySwitchModal,
  characterMemorySwitchCloseTargets,
  characterMemorySwitchCurrent,
  characterMemorySwitchSearchInput,
  characterMemorySwitchTableBody,
  characterMemorySwitchEmptyState,
  characterMemorySwitchSaveButton,
} = dom;

const CHARACTER_MEMORY_SWITCH_SORT_FIELDS = ['name', 'character', 'star', 'enhancement'];

app.getCharacterMemorySwitchSearchPriority = (keyword, item) => {
  if (!keyword) {
    return 0;
  }

  const memoryName = app.getEquipNameByTemplateId(item?.TemplateId).toLowerCase();
  if (memoryName.includes(keyword)) {
    return 0;
  }

  const characterName = app.getCharacterNameByCharacterId(item?.CharacterId).toLowerCase();
  if (characterName.includes(keyword)) {
    return 1;
  }

  return null;
};

app.compareCharacterMemorySwitchItems = (left, right) => {
  const leftName = app.getEquipNameByTemplateId(left?.TemplateId);
  const rightName = app.getEquipNameByTemplateId(right?.TemplateId);
  const sortBy = state.characterMemorySwitchSortBy;

  if (sortBy === 'character') {
    const comparison = app.getCharacterNameByCharacterId(left?.CharacterId).localeCompare(
      app.getCharacterNameByCharacterId(right?.CharacterId),
      state.locale,
      { numeric: true, sensitivity: 'base' },
    );
    if (comparison !== 0) {
      return comparison;
    }
  } else if (sortBy === 'star') {
    const comparison = (app.getEquipStarByTemplateId(left?.TemplateId) ?? 0) - (app.getEquipStarByTemplateId(right?.TemplateId) ?? 0);
    if (comparison !== 0) {
      return comparison;
    }
  } else if (sortBy === 'enhancement') {
    const comparison = (app.getEquipEnhancementLevel(left) ?? -1) - (app.getEquipEnhancementLevel(right) ?? -1);
    if (comparison !== 0) {
      return comparison;
    }
  } else {
    const comparison = leftName.localeCompare(rightName, state.locale, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) {
      return comparison;
    }
  }

  const fallbackComparison = leftName.localeCompare(rightName, state.locale, { numeric: true, sensitivity: 'base' });
  if (fallbackComparison !== 0) {
    return fallbackComparison;
  }

  return Number(left?.record_id ?? 0) - Number(right?.record_id ?? 0);
};

app.getFilteredCharacterMemorySwitchItems = () => {
  const keyword = state.characterMemorySwitchSearchKeyword.trim().toLowerCase();
  const direction = state.characterMemorySwitchSortOrder === 'asc' ? 1 : -1;
  return (Array.isArray(state.characterMemorySwitchItems) ? state.characterMemorySwitchItems : [])
    .map((item) => ({ item, searchPriority: app.getCharacterMemorySwitchSearchPriority(keyword, item) }))
    .filter(({ searchPriority }) => searchPriority !== null)
    .sort((left, right) => {
      if (left.searchPriority !== right.searchPriority) {
        return left.searchPriority - right.searchPriority;
      }
      return app.compareCharacterMemorySwitchItems(left.item, right.item) * direction;
    })
    .map(({ item }) => item);
};

app.scrollCharacterMemorySwitchSelectionIntoView = (recordId) => {
  if (!(characterMemorySwitchTableBody instanceof HTMLElement)) {
    return false;
  }

  const normalizedRecordId = Number(recordId);
  if (!Number.isFinite(normalizedRecordId) || normalizedRecordId <= 0) {
    return false;
  }

  const row = characterMemorySwitchTableBody.querySelector(`[data-character-memory-switch-row="true"][data-memory-record-id="${normalizedRecordId}"]`);
  if (!(row instanceof HTMLElement)) {
    return false;
  }

  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  row.focus({ preventScroll: true });
  return true;
};

app.syncCharacterMemorySwitchSortArrows = () => {
  const table = characterMemorySwitchModal instanceof HTMLElement ? characterMemorySwitchModal.querySelector('.character-memory-switch-table') : null;
  if (!(table instanceof HTMLElement)) {
    return;
  }

  table.querySelectorAll('.column-sort-btn').forEach((button) => {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const arrow = button.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) {
      return;
    }
    if (button.dataset.characterMemorySwitchSortField === state.characterMemorySwitchSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.characterMemorySwitchSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app.handleCharacterMemorySwitchSortClick = (sortField) => {
  if (!CHARACTER_MEMORY_SWITCH_SORT_FIELDS.includes(sortField)) {
    return;
  }

  if (state.characterMemorySwitchSortBy === sortField) {
    state.characterMemorySwitchSortOrder = state.characterMemorySwitchSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.characterMemorySwitchSortBy = sortField;
    state.characterMemorySwitchSortOrder = sortField === 'star' ? 'desc' : 'asc';
  }
  app.syncCharacterMemorySwitchSortArrows();
};

app.renderCharacterMemorySwitchCurrent = () => {
  if (!(characterMemorySwitchCurrent instanceof HTMLElement)) {
    return;
  }

  const currentMemory = state.characterMemorySwitchCurrentMemory;
  if (!currentMemory) {
    characterMemorySwitchCurrent.innerHTML = `<div class="character-equip-switch-current-empty">${app.escapeHtml(app.translate('dashboard.characterMemorySwitchCurrentEmpty'))}</div>`;
    return;
  }

  const templateId = currentMemory.TemplateId;
  const memoryName = app.getEquipNameByTemplateId(templateId);
  const iconUrl = app.getEquipIconByTemplateId(templateId);
  const star = app.getEquipStarByTemplateId(templateId);
  const iconClass = Number.isFinite(star) && star >= 4 ? `equip-icon-tier-${star}` : '';
  const selectedRecordId = Number(state.characterMemorySwitchSelectedRecordId);
  const currentRecordId = Number(currentMemory?.record_id ?? 0);
  const tagKey = selectedRecordId > 0 && currentRecordId === selectedRecordId
    ? 'dashboard.characterMemorySwitchSelected'
    : 'dashboard.characterMemorySwitchCurrent';

  characterMemorySwitchCurrent.innerHTML = `
    <button class="character-equip-switch-current-card" type="button" data-character-memory-switch-current-card="true">
      ${app.renderEquipMediaCell(iconUrl, memoryName, true, iconClass)}
      <span class="character-equip-switch-current-tag">${app.escapeHtml(app.translate(tagKey))}</span>
    </button>
  `;
};

app.renderCharacterMemorySwitchRows = () => {
  if (!(characterMemorySwitchTableBody instanceof HTMLElement) || !(characterMemorySwitchEmptyState instanceof HTMLElement)) {
    return;
  }

  const items = app.getFilteredCharacterMemorySwitchItems();
  const selectedRecordId = Number(state.characterMemorySwitchSelectedRecordId);
  characterMemorySwitchTableBody.innerHTML = items.map((item) => {
    const recordId = Number(item?.record_id ?? 0);
    const templateId = item?.TemplateId;
    const iconUrl = app.getEquipIconByTemplateId(templateId);
    const memoryName = app.getEquipNameByTemplateId(templateId);
    const characterName = app.getCharacterNameByCharacterId(item?.CharacterId);
    const characterIconUrl = app.getCharacterIconByCharacterId(item?.CharacterId);
    const star = app.getEquipStarByTemplateId(templateId);
    const iconClass = Number.isFinite(star) && star >= 4 ? `equip-icon-tier-${star}` : '';
    const isSelected = recordId === selectedRecordId;
    return `
      <tr class="character-weapon-switch-row${isSelected ? ' is-selected' : ''}" tabindex="0" data-character-memory-switch-row="true" data-memory-record-id="${recordId}">
        <td>${app.renderEquipMediaCell(iconUrl, memoryName, true, iconClass)}</td>
        <td>${app.renderEquipMediaCell(characterIconUrl, characterName, false)}</td>
        <td>${app.renderEquipStar(templateId)}</td>
        <td>${app.renderEquipEnhancementLevel(item)}</td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button ${isSelected ? 'status-action-button-stop' : 'status-action-button-config'}" type="button" data-character-memory-switch-action="select" data-memory-record-id="${recordId}">${app.translate(isSelected ? 'dashboard.characterMemorySwitchSelected' : 'dashboard.characterMemorySwitchSelect')}</button>
            <button class="status-action-button status-action-button-log" type="button" data-character-memory-switch-action="detail" data-memory-record-id="${recordId}">${app.translate('dashboard.characterMemorySwitchDetail')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  characterMemorySwitchEmptyState.hidden = items.length > 0;
};

app.resetCharacterMemorySwitchState = () => {
  state.characterMemorySwitchLoading = false;
  state.characterMemorySwitchSubmitting = false;
  state.characterMemorySwitchItems = [];
  state.characterMemorySwitchSearchKeyword = '';
  state.characterMemorySwitchSortBy = 'star';
  state.characterMemorySwitchSortOrder = 'desc';
  state.characterMemorySwitchSelectedRecordId = null;
  state.characterMemorySwitchCurrentMemory = null;
  state.characterMemorySwitchSlot = null;
  if (characterMemorySwitchSearchInput instanceof HTMLInputElement) {
    characterMemorySwitchSearchInput.value = '';
  }
};

app.closeCharacterMemorySwitchModal = () => {
  app.closeWeaponDetailModal?.();
  if (characterMemorySwitchModal instanceof HTMLElement) {
    characterMemorySwitchModal.hidden = true;
  }
  const keepBodyLocked = characterDetailModal instanceof HTMLElement && !characterDetailModal.hidden;
  if (!keepBodyLocked) {
    app.setBodyModalOpen(false);
  }
  app.resetCharacterMemorySwitchState();
  if (state.lastCharacterMemorySwitchTrigger instanceof HTMLElement) {
    state.lastCharacterMemorySwitchTrigger.focus();
  }
  state.lastCharacterMemorySwitchTrigger = null;
};

app.loadCharacterMemorySwitchCandidates = async () => {
  const recordId = Number(state.currentCharacterDetailItem?.record_id);
  const slot = Number(state.characterMemorySwitchSlot);
  if (!Number.isFinite(recordId) || recordId <= 0 || !Number.isFinite(slot) || slot <= 0) {
    return;
  }

  state.characterMemorySwitchLoading = true;
  try {
    const search = new URLSearchParams({ slot: String(slot) });
    const payload = await app.apiFetch(`/api/database-characters/selected/${recordId}/memory-candidates?${search.toString()}`);
    state.characterMemorySwitchItems = Array.isArray(payload?.items) ? payload.items : [];
    state.characterMemorySwitchCurrentMemory = payload?.current_memory && typeof payload.current_memory === 'object' ? payload.current_memory : null;
    state.characterMemorySwitchSelectedRecordId = Number(payload?.current_memory?.record_id ?? 0) || null;
    app.renderCharacterMemorySwitchCurrent();
    app.renderCharacterMemorySwitchRows();
  } catch (error) {
    app.closeCharacterMemorySwitchModal();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterMemorySwitchLoadFailed'));
  } finally {
    state.characterMemorySwitchLoading = false;
  }
};

app.openCharacterMemorySwitchModal = (slot, trigger) => {
  if (!(characterMemorySwitchModal instanceof HTMLElement) || !state.currentCharacterDetailItem) {
    return;
  }

  app.closeWeaponDetailModal?.();
  state.lastCharacterMemorySwitchTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetCharacterMemorySwitchState();
  state.characterMemorySwitchSlot = Number(slot);
  app.syncCharacterMemorySwitchSortArrows();
  app.renderCharacterMemorySwitchCurrent();
  app.renderCharacterMemorySwitchRows();
  characterMemorySwitchModal.hidden = false;
  app.setBodyModalOpen(true);
  void app.loadCharacterMemorySwitchCandidates();
  if (characterMemorySwitchSearchInput instanceof HTMLInputElement) {
    characterMemorySwitchSearchInput.focus();
  }
};

app.submitCharacterMemorySwitch = async () => {
  if (state.characterMemorySwitchSubmitting) {
    return;
  }

  const characterRecordId = Number(state.currentCharacterDetailItem?.record_id);
  const memoryRecordId = Number(state.characterMemorySwitchSelectedRecordId);
  const slot = Number(state.characterMemorySwitchSlot);
  const hasSelection = Number.isFinite(memoryRecordId) && memoryRecordId > 0;

  state.characterMemorySwitchSubmitting = true;
  if (characterMemorySwitchSaveButton instanceof HTMLButtonElement) {
    characterMemorySwitchSaveButton.disabled = true;
  }

  try {
    await app.apiFetch(`/api/database-characters/selected/${characterRecordId}/memory`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ MemoryRecordId: hasSelection ? memoryRecordId : null, Slot: slot }),
    });
    await app.loadCharacterDetailExtraInfo(characterRecordId);
    await app.reloadMemoryManagementCurrentPage?.();
    app.closeCharacterMemorySwitchModal();
    app.openSuccessModal(app.translate('runtime.characterMemorySwitchSaveSuccess'), app.translate('runtime.characterMemorySwitchSaveSuccessTitle'));
  } catch (error) {
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterMemorySwitchSaveFailed'));
  } finally {
    state.characterMemorySwitchSubmitting = false;
    if (characterMemorySwitchSaveButton instanceof HTMLButtonElement) {
      characterMemorySwitchSaveButton.disabled = false;
    }
  }
};

app.handleCharacterMemorySwitchActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionButton = target.closest('[data-character-memory-switch-action]');
  if (!(actionButton instanceof HTMLButtonElement)) {
    return;
  }

  const recordId = Number(actionButton.dataset.memoryRecordId);
  if (!Number.isFinite(recordId)) {
    return;
  }

  if (actionButton.dataset.characterMemorySwitchAction === 'select') {
    app.handleCharacterMemorySwitchSelectionChange(recordId);
    return;
  }

  if (actionButton.dataset.characterMemorySwitchAction === 'detail') {
    const opened = app.openEquipDetailModal({
      recordId,
      equipType: 'memory',
      source: 'character-memory-switch',
      trigger: actionButton,
    });
    if (opened && dom.equipDetailModal instanceof HTMLElement) {
      dom.equipDetailModal.hidden = false;
      app.setBodyModalOpen(true);
      void app.loadMemoryDetailExtraInfo(recordId).catch((error) => {
        if (state.currentEquipDetailItem) {
          app.populateEquipDetailCard(state.currentEquipDetailItem, {
            viewKey: 'shared',
            detailMode: 'editable',
            source: state.currentEquipDetailSource,
          });
        }
        if (dom.equipDetailModal instanceof HTMLElement && !dom.equipDetailModal.hidden) {
          app.openNoticeModal(app.apiErrorMessage(error, 'runtime.equipManagementLoadFailed'));
        }
      });
      if (dom.equipDetailCard instanceof HTMLElement) {
        dom.equipDetailCard.focus();
      }
    }
  }
};

app.handleCharacterMemorySwitchRowActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.closest('[data-character-memory-switch-action]')) {
    return;
  }

  const row = target.closest('[data-character-memory-switch-row="true"]');
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const recordId = Number(row.dataset.memoryRecordId);
  if (!Number.isFinite(recordId)) {
    return;
  }

  app.handleCharacterMemorySwitchSelectionChange(recordId);
};

app.handleCharacterMemorySwitchCurrentClick = () => {
  const currentRecordId = Number(state.characterMemorySwitchCurrentMemory?.record_id ?? 0);
  if (!Number.isFinite(currentRecordId) || currentRecordId <= 0) {
    return;
  }

  const currentMemoryVisible = app.getFilteredCharacterMemorySwitchItems().some((item) => {
    const recordId = Number(item?.record_id ?? 0);
    return recordId === currentRecordId;
  });
  if (!currentMemoryVisible) {
    return;
  }

  app.scrollCharacterMemorySwitchSelectionIntoView(currentRecordId);
};

app.handleCharacterMemorySwitchSelectionChange = (recordId) => {
  if (!Number.isFinite(recordId)) {
    return;
  }

  state.characterMemorySwitchSelectedRecordId = Number(state.characterMemorySwitchSelectedRecordId) === recordId ? null : recordId;
  app.renderCharacterMemorySwitchCurrent();
  app.renderCharacterMemorySwitchRows();
};

app.rerenderCharacterMemorySwitchLocale = () => {
  if (characterMemorySwitchModal instanceof HTMLElement && !characterMemorySwitchModal.hidden) {
    app.syncCharacterMemorySwitchSortArrows();
    app.renderCharacterMemorySwitchCurrent();
    app.renderCharacterMemorySwitchRows();
  }
};

export const initDatabaseCharacterMemorySwitchFeature = () => {
  if (characterDetailMemories instanceof HTMLElement) {
    characterDetailMemories.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const trigger = target.closest('[data-character-detail-memory-trigger]');
      if (!(trigger instanceof HTMLButtonElement)) {
        return;
      }
      const slot = Number(trigger.dataset.memorySlot);
      if (!Number.isFinite(slot)) {
        return;
      }
      event.preventDefault();
      app.openCharacterMemorySwitchModal(slot, trigger);
    });
    characterDetailMemories.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const trigger = target.closest('[data-character-detail-memory-trigger]');
      if (!(trigger instanceof HTMLButtonElement)) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      const slot = Number(trigger.dataset.memorySlot);
      if (!Number.isFinite(slot)) {
        return;
      }
      event.preventDefault();
      app.openCharacterMemorySwitchModal(slot, trigger);
    });
  }

  characterMemorySwitchCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterMemorySwitchModal);
  });

  if (characterMemorySwitchSearchInput instanceof HTMLInputElement) {
    characterMemorySwitchSearchInput.addEventListener('input', () => {
      state.characterMemorySwitchSearchKeyword = characterMemorySwitchSearchInput.value.trim();
      app.renderCharacterMemorySwitchRows();
    });
    characterMemorySwitchSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
      }
    });
  }

  if (characterMemorySwitchCurrent instanceof HTMLElement) {
    characterMemorySwitchCurrent.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest('[data-character-memory-switch-current-card="true"]')) {
        return;
      }
      app.handleCharacterMemorySwitchCurrentClick();
    });
  }

  const switchTable = characterMemorySwitchModal instanceof HTMLElement ? characterMemorySwitchModal.querySelector('.character-memory-switch-table') : null;
  if (switchTable instanceof HTMLElement) {
    switchTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const sortButton = target.closest('.column-sort-btn');
      if (!(sortButton instanceof HTMLButtonElement)) {
        return;
      }
      const sortField = sortButton.dataset.characterMemorySwitchSortField;
      if (!sortField) {
        return;
      }
      app.handleCharacterMemorySwitchSortClick(sortField);
      app.renderCharacterMemorySwitchRows();
    });
  }

  if (characterMemorySwitchTableBody instanceof HTMLElement) {
    characterMemorySwitchTableBody.addEventListener('click', (event) => {
      app.handleCharacterMemorySwitchActionClick(event);
      app.handleCharacterMemorySwitchRowActivate(event);
    });
  }

  if (characterMemorySwitchSaveButton instanceof HTMLButtonElement) {
    characterMemorySwitchSaveButton.addEventListener('click', () => {
      void app.submitCharacterMemorySwitch();
    });
  }

  if (characterMemorySwitchModal instanceof HTMLElement) {
    characterMemorySwitchModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterMemorySwitchModal();
      }
    });
  }
};
