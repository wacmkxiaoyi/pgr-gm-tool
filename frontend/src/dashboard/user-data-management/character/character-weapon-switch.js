import { app } from '../../shared.js';

const { dom, state } = app;
const {
  characterDetailWeapon,
  characterDetailModal,
  characterWeaponSwitchModal,
  characterWeaponSwitchCloseTargets,
  characterWeaponSwitchCurrent,
  characterWeaponSwitchSearchInput,
  characterWeaponSwitchTableBody,
  characterWeaponSwitchEmptyState,
  characterWeaponSwitchSaveButton,
} = dom;

const CHARACTER_WEAPON_SWITCH_SORT_FIELDS = ['name', 'character', 'star', 'enhancement'];

app.getCharacterWeaponSwitchSearchPriority = (keyword, item) => {
  if (!keyword) {
    return 0;
  }

  const weaponName = app.getEquipNameByTemplateId(item?.TemplateId).toLowerCase();
  if (weaponName.includes(keyword)) {
    return 0;
  }

  const characterName = app.getCharacterNameByCharacterId(item?.CharacterId).toLowerCase();
  if (characterName.includes(keyword)) {
    return 1;
  }

  return null;
};

app.compareCharacterWeaponSwitchItems = (left, right) => {
  const leftName = app.getEquipNameByTemplateId(left?.TemplateId);
  const rightName = app.getEquipNameByTemplateId(right?.TemplateId);
  const sortBy = state.characterWeaponSwitchSortBy;

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

app.getFilteredCharacterWeaponSwitchItems = () => {
  const keyword = state.characterWeaponSwitchSearchKeyword.trim().toLowerCase();
  const direction = state.characterWeaponSwitchSortOrder === 'asc' ? 1 : -1;
  return (Array.isArray(state.characterWeaponSwitchItems) ? state.characterWeaponSwitchItems : [])
    .map((item) => ({ item, searchPriority: app.getCharacterWeaponSwitchSearchPriority(keyword, item) }))
    .filter(({ searchPriority }) => searchPriority !== null)
    .sort((left, right) => {
      if (left.searchPriority !== right.searchPriority) {
        return left.searchPriority - right.searchPriority;
      }
      return app.compareCharacterWeaponSwitchItems(left.item, right.item) * direction;
    })
    .map(({ item }) => item);
};

app.syncCharacterWeaponSwitchSortArrows = () => {
  const table = characterWeaponSwitchModal instanceof HTMLElement ? characterWeaponSwitchModal.querySelector('.character-equip-switch-table') : null;
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
    if (button.dataset.characterWeaponSwitchSortField === state.characterWeaponSwitchSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.characterWeaponSwitchSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app.handleCharacterWeaponSwitchSortClick = (sortField) => {
  if (!CHARACTER_WEAPON_SWITCH_SORT_FIELDS.includes(sortField)) {
    return;
  }

  if (state.characterWeaponSwitchSortBy === sortField) {
    state.characterWeaponSwitchSortOrder = state.characterWeaponSwitchSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.characterWeaponSwitchSortBy = sortField;
    state.characterWeaponSwitchSortOrder = sortField === 'star' ? 'desc' : 'asc';
  }
  app.syncCharacterWeaponSwitchSortArrows();
};

app.scrollCharacterWeaponSwitchSelectionIntoView = (recordId) => {
  if (!(characterWeaponSwitchTableBody instanceof HTMLElement)) {
    return false;
  }

  const normalizedRecordId = Number(recordId);
  if (!Number.isFinite(normalizedRecordId) || normalizedRecordId <= 0) {
    return false;
  }

  const row = characterWeaponSwitchTableBody.querySelector(`[data-character-weapon-switch-row="true"][data-weapon-record-id="${normalizedRecordId}"]`);
  if (!(row instanceof HTMLElement)) {
    return false;
  }

  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  row.focus({ preventScroll: true });
  return true;
};

app.renderCharacterWeaponSwitchCurrent = () => {
  if (!(characterWeaponSwitchCurrent instanceof HTMLElement)) {
    return;
  }

  const currentWeapon = state.characterWeaponSwitchCurrentWeapon;
  if (!currentWeapon) {
    characterWeaponSwitchCurrent.innerHTML = `<div class="character-equip-switch-current-empty">${app.escapeHtml(app.translate('dashboard.characterEquipSwitchCurrentEmpty'))}</div>`;
    return;
  }

  const templateId = currentWeapon.TemplateId;
  const weaponName = app.getEquipNameByTemplateId(templateId);
  const iconUrl = app.getEquipIconByTemplateId(templateId);
  const star = app.getEquipStarByTemplateId(templateId);
  const iconClass = Number.isFinite(star) && star >= 4 ? `equip-icon-tier-${star}` : '';
  const selectedRecordId = Number(state.characterWeaponSwitchSelectedRecordId);
  const currentRecordId = Number(currentWeapon?.record_id ?? 0);
  const tagKey = selectedRecordId > 0 && currentRecordId === selectedRecordId
    ? 'dashboard.characterWeaponSwitchSelected'
    : 'dashboard.characterEquipSwitchCurrent';

  characterWeaponSwitchCurrent.innerHTML = `
    <button class="character-equip-switch-current-card" type="button" data-character-weapon-switch-current-card="true">
      ${app.renderEquipMediaCell(iconUrl, weaponName, true, iconClass)}
      <span class="character-equip-switch-current-tag">${app.escapeHtml(app.translate(tagKey))}</span>
    </button>
  `;
};

app.renderCharacterWeaponSwitchRows = () => {
  if (!(characterWeaponSwitchTableBody instanceof HTMLElement) || !(characterWeaponSwitchEmptyState instanceof HTMLElement)) {
    return;
  }

  const items = app.getFilteredCharacterWeaponSwitchItems();
  const selectedRecordId = Number(state.characterWeaponSwitchSelectedRecordId);
  characterWeaponSwitchTableBody.innerHTML = items.map((item) => {
    const recordId = Number(item?.record_id ?? 0);
    const templateId = item?.TemplateId;
    const iconUrl = app.getEquipIconByTemplateId(templateId);
    const weaponName = app.getEquipNameByTemplateId(templateId);
    const characterName = app.getCharacterNameByCharacterId(item?.CharacterId);
    const characterIconUrl = app.getCharacterIconByCharacterId(item?.CharacterId);
    const star = app.getEquipStarByTemplateId(templateId);
    const iconClass = Number.isFinite(star) && star >= 4 ? `equip-icon-tier-${star}` : '';
    const isSelected = recordId === selectedRecordId;
    return `
      <tr class="character-weapon-switch-row${isSelected ? ' is-selected' : ''}" tabindex="0" data-character-weapon-switch-row="true" data-weapon-record-id="${recordId}">
        <td>${app.renderEquipMediaCell(iconUrl, weaponName, true, iconClass)}</td>
        <td>${app.renderEquipMediaCell(characterIconUrl, characterName, false)}</td>
        <td>${app.renderEquipStar(templateId)}</td>
        <td>${app.renderEquipEnhancementLevel(item)}</td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button ${isSelected ? 'status-action-button-stop' : 'status-action-button-config'}" type="button" data-character-weapon-switch-action="select" data-weapon-record-id="${recordId}">${app.translate(isSelected ? 'dashboard.characterWeaponSwitchSelected' : 'dashboard.characterWeaponSwitchSelect')}</button>
            <button class="status-action-button status-action-button-log" type="button" data-character-weapon-switch-action="detail" data-weapon-record-id="${recordId}">${app.translate('dashboard.characterWeaponSwitchDetail')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  characterWeaponSwitchEmptyState.hidden = items.length > 0;
};

app.resetCharacterWeaponSwitchState = () => {
  state.characterWeaponSwitchLoading = false;
  state.characterWeaponSwitchSubmitting = false;
  state.characterWeaponSwitchItems = [];
  state.characterWeaponSwitchSearchKeyword = '';
  state.characterWeaponSwitchSortBy = 'star';
  state.characterWeaponSwitchSortOrder = 'desc';
  state.characterWeaponSwitchSelectedRecordId = null;
  state.characterWeaponSwitchCurrentWeapon = null;
  if (characterWeaponSwitchSearchInput instanceof HTMLInputElement) {
    characterWeaponSwitchSearchInput.value = '';
  }
};

app.closeCharacterWeaponSwitchModal = () => {
  app.closeWeaponDetailModal?.();
  if (characterWeaponSwitchModal instanceof HTMLElement) {
    characterWeaponSwitchModal.hidden = true;
  }
  const keepBodyLocked = characterDetailModal instanceof HTMLElement && !characterDetailModal.hidden;
  if (!keepBodyLocked) {
    app.setBodyModalOpen(false);
  }
  app.resetCharacterWeaponSwitchState();
  if (state.lastCharacterWeaponSwitchTrigger instanceof HTMLElement) {
    state.lastCharacterWeaponSwitchTrigger.focus();
  }
  state.lastCharacterWeaponSwitchTrigger = null;
};

app.loadCharacterWeaponSwitchCandidates = async () => {
  const recordId = Number(state.currentCharacterDetailItem?.record_id);
  if (!Number.isFinite(recordId) || recordId <= 0) {
    return;
  }

  state.characterWeaponSwitchLoading = true;
  try {
    const payload = await app.apiFetch(`/api/database-characters/selected/${recordId}/weapon-candidates`);
    state.characterWeaponSwitchItems = Array.isArray(payload?.items) ? payload.items : [];
    state.characterWeaponSwitchCurrentWeapon = payload?.current_weapon && typeof payload.current_weapon === 'object' ? payload.current_weapon : null;
    state.characterWeaponSwitchSelectedRecordId = Number(payload?.current_weapon?.record_id ?? 0) || null;
    app.renderCharacterWeaponSwitchCurrent();
    app.renderCharacterWeaponSwitchRows();
  } catch (error) {
    app.closeCharacterWeaponSwitchModal();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterWeaponSwitchLoadFailed'));
  } finally {
    state.characterWeaponSwitchLoading = false;
  }
};

app.openCharacterWeaponSwitchModal = (trigger) => {
  if (!(characterWeaponSwitchModal instanceof HTMLElement) || !state.currentCharacterDetailItem) {
    return;
  }

  app.closeWeaponDetailModal?.();
  state.lastCharacterWeaponSwitchTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetCharacterWeaponSwitchState();
  app.syncCharacterWeaponSwitchSortArrows();
  app.renderCharacterWeaponSwitchCurrent();
  app.renderCharacterWeaponSwitchRows();
  characterWeaponSwitchModal.hidden = false;
  app.setBodyModalOpen(true);
  void app.loadCharacterWeaponSwitchCandidates();
  if (characterWeaponSwitchSearchInput instanceof HTMLInputElement) {
    characterWeaponSwitchSearchInput.focus();
  }
};

app.submitCharacterWeaponSwitch = async () => {
  if (state.characterWeaponSwitchSubmitting) {
    return;
  }

  const characterRecordId = Number(state.currentCharacterDetailItem?.record_id);
  const weaponRecordId = Number(state.characterWeaponSwitchSelectedRecordId);
  if (!Number.isFinite(weaponRecordId) || weaponRecordId <= 0) {
    app.openNoticeModal(app.translate('runtime.characterWeaponSwitchNeedSelection'));
    return;
  }

  state.characterWeaponSwitchSubmitting = true;
  if (characterWeaponSwitchSaveButton instanceof HTMLButtonElement) {
    characterWeaponSwitchSaveButton.disabled = true;
  }

  try {
    await app.apiFetch(`/api/database-characters/selected/${characterRecordId}/weapon`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ WeaponRecordId: weaponRecordId }),
    });
    await app.loadCharacterDetailExtraInfo(characterRecordId);
    await app.reloadWeaponManagementCurrentPage?.();
    app.closeCharacterWeaponSwitchModal();
    app.openSuccessModal(app.translate('runtime.characterWeaponSwitchSaveSuccess'), app.translate('runtime.characterWeaponSwitchSaveSuccessTitle'));
  } catch (error) {
    const fallbackKey = error instanceof Error && /weapon_type_mismatch|equip_type_invalid/.test(String(error.message))
      ? 'runtime.characterWeaponSwitchTypeMismatch'
      : 'runtime.characterWeaponSwitchSaveFailed';
    app.openNoticeModal(app.apiErrorMessage(error, fallbackKey));
  } finally {
    state.characterWeaponSwitchSubmitting = false;
    if (characterWeaponSwitchSaveButton instanceof HTMLButtonElement) {
      characterWeaponSwitchSaveButton.disabled = false;
    }
  }
};

app.handleCharacterWeaponSwitchActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionButton = target.closest('[data-character-weapon-switch-action]');
  if (!(actionButton instanceof HTMLButtonElement)) {
    return;
  }

  const recordId = Number(actionButton.dataset.weaponRecordId);
  if (!Number.isFinite(recordId)) {
    return;
  }

  if (actionButton.dataset.characterWeaponSwitchAction === 'select') {
    app.handleCharacterWeaponSwitchSelectionChange(recordId);
    return;
  }

  if (actionButton.dataset.characterWeaponSwitchAction === 'detail') {
    const opened = app.openEquipDetailModal({
      recordId,
      equipType: 'weapon',
      source: 'character-weapon-switch',
      trigger: actionButton,
    });
    if (opened && characterWeaponSwitchModal instanceof HTMLElement) {
      characterWeaponSwitchModal.hidden = false;
      app.setBodyModalOpen(true);
      void app.loadWeaponDetailExtraInfo(recordId).catch((error) => {
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
      if (dom.equipDetailModal instanceof HTMLElement) {
        dom.equipDetailModal.hidden = false;
      }
      if (dom.equipDetailCard instanceof HTMLElement) {
        dom.equipDetailCard.focus();
      }
    }
  }
};

app.handleCharacterWeaponSwitchRowActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.closest('[data-character-weapon-switch-action]')) {
    return;
  }

  const row = target.closest('[data-character-weapon-switch-row="true"]');
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const recordId = Number(row.dataset.weaponRecordId);
  if (!Number.isFinite(recordId)) {
    return;
  }

  app.handleCharacterWeaponSwitchSelectionChange(recordId);
};

app.handleCharacterWeaponSwitchCurrentClick = () => {
  const currentRecordId = Number(state.characterWeaponSwitchCurrentWeapon?.record_id ?? 0);
  if (!Number.isFinite(currentRecordId) || currentRecordId <= 0) {
    return;
  }

  const currentWeaponVisible = app.getFilteredCharacterWeaponSwitchItems().some((item) => {
    const recordId = Number(item?.record_id ?? 0);
    return recordId === currentRecordId;
  });
  if (!currentWeaponVisible) {
    return;
  }

  app.scrollCharacterWeaponSwitchSelectionIntoView(currentRecordId);
};

app.handleCharacterWeaponSwitchSelectionChange = (recordId) => {
  if (!Number.isFinite(recordId)) {
    return;
  }

  state.characterWeaponSwitchSelectedRecordId = recordId;
  app.renderCharacterWeaponSwitchCurrent();
  app.renderCharacterWeaponSwitchRows();
};

app.rerenderCharacterWeaponSwitchLocale = () => {
  if (characterWeaponSwitchModal instanceof HTMLElement && !characterWeaponSwitchModal.hidden) {
    app.syncCharacterWeaponSwitchSortArrows();
    app.renderCharacterWeaponSwitchCurrent();
    app.renderCharacterWeaponSwitchRows();
  }
};

export const initDatabaseCharacterWeaponSwitchFeature = () => {
  if (characterDetailWeapon instanceof HTMLElement) {
    characterDetailWeapon.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const trigger = target.closest('[data-character-detail-weapon-trigger]');
      if (!(trigger instanceof HTMLButtonElement)) {
        return;
      }
      event.preventDefault();
      app.openCharacterWeaponSwitchModal(trigger);
    });
    characterDetailWeapon.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const trigger = target.closest('[data-character-detail-weapon-trigger]');
      if (!(trigger instanceof HTMLButtonElement)) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      app.openCharacterWeaponSwitchModal(trigger);
    });
  }

  characterWeaponSwitchCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterWeaponSwitchModal);
  });

  if (characterWeaponSwitchSearchInput instanceof HTMLInputElement) {
    characterWeaponSwitchSearchInput.addEventListener('input', () => {
      state.characterWeaponSwitchSearchKeyword = characterWeaponSwitchSearchInput.value.trim();
      app.renderCharacterWeaponSwitchRows();
    });
    characterWeaponSwitchSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
      }
    });
  }

  if (characterWeaponSwitchCurrent instanceof HTMLElement) {
    characterWeaponSwitchCurrent.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest('[data-character-weapon-switch-current-card="true"]')) {
        return;
      }
      app.handleCharacterWeaponSwitchCurrentClick();
    });
  }

  const switchTable = characterWeaponSwitchModal instanceof HTMLElement ? characterWeaponSwitchModal.querySelector('.character-equip-switch-table') : null;
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
      const sortField = sortButton.dataset.characterWeaponSwitchSortField;
      if (!sortField) {
        return;
      }
      app.handleCharacterWeaponSwitchSortClick(sortField);
      app.renderCharacterWeaponSwitchRows();
    });
  }

  if (characterWeaponSwitchTableBody instanceof HTMLElement) {
    characterWeaponSwitchTableBody.addEventListener('click', (event) => {
      app.handleCharacterWeaponSwitchActionClick(event);
      app.handleCharacterWeaponSwitchRowActivate(event);
    });
  }

  if (characterWeaponSwitchSaveButton instanceof HTMLButtonElement) {
    characterWeaponSwitchSaveButton.addEventListener('click', () => {
      void app.submitCharacterWeaponSwitch();
    });
  }

  if (characterWeaponSwitchModal instanceof HTMLElement) {
    characterWeaponSwitchModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterWeaponSwitchModal();
      }
    });
  }

};
