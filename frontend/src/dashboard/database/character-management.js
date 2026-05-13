import { app } from '../shared.js';

const { dom, state } = app;
const {
  databaseCharacterManagementSubnavButton,
  databaseCharacterManagementState,
  databaseCharacterManagementShell,
  databaseCharacterManagementTableShell,
  databaseCharacterManagementBody,
  databaseCharacterManagementSummary,
  databaseCharacterManagementActions,
  databaseCharacterManagementPrevButton,
  databaseCharacterManagementNextButton,
  databaseCharacterManagementPaginationLabel,
  databaseCharacterManagementJumpInput,
  databaseCharacterManagementJumpButton,
  databaseCharacterSearchInput,
  characterDetailModal,
  characterDetailCard,
  characterDetailCloseTargets,
  characterDetailMainIcon,
  characterDetailMainFashionShell,
  characterDetailMainFashionIcon,
  characterDetailMainFashionPlaceholder,
  characterDetailFashions,
  characterDetailWeapon,
  characterDetailMemories,
  characterDetailName,
  characterDetailEvolution,
  characterQualityEditModal,
  characterQualityEditCard,
  characterQualityEditCloseTargets,
  characterQualityEditQualitySelect,
  characterQualityEditStarSelect,
  characterQualityEditConfirmButton,
  characterLevelEditModal,
  characterLevelEditCard,
  characterLevelEditCloseTargets,
  characterLevelEditLevelInput,
  characterLevelEditExpInput,
  characterLevelEditConfirmButton,
  characterTrustEditModal,
  characterTrustEditCard,
  characterTrustEditCloseTargets,
  characterTrustEditHearts,
  characterTrustEditExpInput,
  characterTrustEditConfirmButton,
  characterGradeEditModal,
  characterGradeEditCard,
  characterGradeEditCloseTargets,
  characterGradeEditSelect,
  characterGradeEditConfirmButton,
  characterAwakenEditModal,
  characterAwakenEditCard,
  characterAwakenEditCloseTargets,
  characterAwakenEditLevelSelect,
  characterAwakenEditConfirmButton,
  characterSkillEditModal,
  characterSkillEditCard,
  characterSkillEditCloseTargets,
  characterSkillEditTitle,
  characterSkillEditLevelInput,
  characterSkillEditConfirmButton,
  characterDetailGrade,
  characterDetailAwaken,
  characterDetailLevel,
  characterDetailTrust,
  characterDetailInformation,
  characterDetailSkillsBody,
  characterDetailEnhanceSkillsBody,
  characterDetailEquipTooltip,
} = dom;

const CHARACTER_DETAIL_EQUIP_TOOLTIP_DELAY_MS = 500;
const CHARACTER_QUALITY_EDIT_OPTIONS = [1, 2, 3, 4, 5, 6];
const CHARACTER_AWAKEN_EDIT_OPTIONS = [1, 2, 3, 4, 5];

app.getCharacterGradeOptions = (characterId) => {
  const normalizedCharacterId = Number.isFinite(Number(characterId)) ? Number(characterId) : null;
  if (normalizedCharacterId === null) {
    return [];
  }

  const gradeNames = state.characterGradeNameMap?.[normalizedCharacterId] ?? state.characterGradeNameMap?.[String(normalizedCharacterId)];
  if (!Array.isArray(gradeNames)) {
    return [];
  }

  return gradeNames
    .map((label, index) => ({
      value: index + 1,
      label: typeof label === 'string' ? label.trim() : '',
    }))
    .filter((option) => option.label);
};

app.resolveCharacterGradeName = (characterId, grade, fallback = '--') => {
  const normalizedGrade = Number.isFinite(Number(grade)) ? Math.max(0, Math.floor(Number(grade))) : 0;
  if (normalizedGrade <= 0) {
    return fallback;
  }

  const matchedOption = app.getCharacterGradeOptions(characterId).find((option) => option.value === normalizedGrade);
  return matchedOption?.label || fallback;
};

app.getCharacterMaxLiberateLevel = (extraInfo) => {
  const maxLiberateLevel = Number(extraInfo?.MaxLiberateLevel);
  if (!Number.isFinite(maxLiberateLevel)) {
    return null;
  }

  return Math.min(5, Math.max(1, Math.floor(maxLiberateLevel)));
};

app.getCharacterAwakenSelectableOptions = (extraInfo) => {
  const maxLiberateLevel = app.getCharacterMaxLiberateLevel(extraInfo);
  if (maxLiberateLevel === null) {
    return [];
  }

  return CHARACTER_AWAKEN_EDIT_OPTIONS.filter((awakenLevel) => awakenLevel <= maxLiberateLevel);
};

app.getCharacterQualityBound = (extraInfo) => {
  if (!Array.isArray(extraInfo?.QualityBound) || extraInfo.QualityBound.length < 2) {
    return null;
  }

  const minQuality = Number(extraInfo.QualityBound[0]);
  const maxQuality = Number(extraInfo.QualityBound[1]);
  if (!Number.isFinite(minQuality) || !Number.isFinite(maxQuality)) {
    return null;
  }

  return [Math.max(1, minQuality), Math.min(6, maxQuality)];
};

app.getCharacterQualitySelectableOptions = (extraInfo) => {
  const qualityBound = app.getCharacterQualityBound(extraInfo);
  if (!qualityBound) {
    return [];
  }

  const [minQuality, maxQuality] = qualityBound;
  return CHARACTER_QUALITY_EDIT_OPTIONS.filter((quality) => quality >= minQuality && quality <= maxQuality);
};

app.getCharacterQualityEditState = () => {
  const item = state.currentCharacterDetailItem;
  const extraInfo = state.currentCharacterDetailExtraInfo;
  if (!item || !extraInfo || typeof extraInfo !== 'object') {
    return null;
  }

  const recordId = Number.isFinite(Number(item?._id ?? item?.record_id)) ? Number(item._id ?? item.record_id) : null;
  const quality = Number.isFinite(Number(item?.Quality)) ? Number(item.Quality) : 0;
  const star = Number.isFinite(Number(item?.Star)) ? Math.max(0, Number(item.Star)) : 0;
  const options = app.getCharacterQualitySelectableOptions(extraInfo);
  if (recordId === null || options.length === 0 || !options.includes(quality)) {
    return null;
  }

  return {
    item,
    recordId,
    quality,
    star,
    options,
  };
};

app.renderCharacterQualityStarOptions = (quality) => {
  if (!(characterQualityEditStarSelect instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedQuality = Number.isFinite(Number(quality)) ? Number(quality) : 0;
  const isSssPlus = normalizedQuality === 6;
  const starOptions = isSssPlus ? [0] : Array.from({ length: 10 }, (_, index) => index);
  characterQualityEditStarSelect.innerHTML = starOptions.map((starValue) => (
    `<option value="${starValue}">${app.escapeHtml(String(starValue))}</option>`
  )).join('');
  characterQualityEditStarSelect.disabled = isSssPlus || state.characterQualityEditPending;
};

app.syncCharacterQualityEditControls = () => {
  const editState = app.getCharacterQualityEditState();
  const isEditable = Boolean(editState);

  if (characterDetailEvolution instanceof HTMLElement) {
    characterDetailEvolution.classList.toggle('is-editable', isEditable);
    characterDetailEvolution.tabIndex = isEditable ? 0 : -1;
    characterDetailEvolution.setAttribute('role', isEditable ? 'button' : 'status');
    if (isEditable) {
      characterDetailEvolution.setAttribute('aria-label', app.translate('dashboard.characterDetailQualityEditTrigger'));
      characterDetailEvolution.title = app.translate('dashboard.characterDetailQualityEditTrigger');
    } else {
      characterDetailEvolution.removeAttribute('aria-label');
      characterDetailEvolution.removeAttribute('title');
    }
  }

  return editState;
};

app.populateCharacterQualityEditModal = () => {
  const editState = app.getCharacterQualityEditState();
  if (!editState) {
    return false;
  }

  if (characterQualityEditQualitySelect instanceof HTMLSelectElement) {
    characterQualityEditQualitySelect.className = `character-quality-edit-select ${app.getCharacterQualityClass(editState.quality)}`;
    characterQualityEditQualitySelect.innerHTML = editState.options.map((qualityOption) => (
      `<option value="${qualityOption}">${app.escapeHtml(app.getCharacterQualityLabel(qualityOption))}</option>`
    )).join('');
    characterQualityEditQualitySelect.value = String(editState.quality);
    characterQualityEditQualitySelect.disabled = state.characterQualityEditPending;
  }

  app.renderCharacterQualityStarOptions(editState.quality);

  if (characterQualityEditStarSelect instanceof HTMLSelectElement) {
    characterQualityEditStarSelect.value = String(editState.quality === 6 ? 0 : editState.star);
  }

  if (characterQualityEditConfirmButton instanceof HTMLButtonElement) {
    characterQualityEditConfirmButton.disabled = state.characterQualityEditPending;
    characterQualityEditConfirmButton.textContent = state.characterQualityEditPending
      ? app.translate('common.loading')
      : app.translate('common.confirm');
  }

  return true;
};

app.closeCharacterQualityEditModal = () => {
  if (!(characterQualityEditModal instanceof HTMLElement) || characterQualityEditModal.hidden) {
    return;
  }

  characterQualityEditModal.hidden = true;
  state.characterQualityEditPending = false;

  if (state.lastCharacterQualityEditTrigger instanceof HTMLElement) {
    state.lastCharacterQualityEditTrigger.focus();
    state.lastCharacterQualityEditTrigger = null;
  }

  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
};

app.openCharacterQualityEditModal = (trigger = null) => {
  if (!(characterQualityEditModal instanceof HTMLElement)) {
    return;
  }

  if (!app.populateCharacterQualityEditModal()) {
    return;
  }

  state.lastCharacterQualityEditTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  characterQualityEditModal.hidden = false;
  app.setBodyModalOpen(true);

  if (characterQualityEditQualitySelect instanceof HTMLSelectElement) {
    characterQualityEditQualitySelect.focus();
  } else if (characterQualityEditCard instanceof HTMLElement) {
    characterQualityEditCard.focus();
  }
};

app.getCharacterLevelBounds = (levelExpMap) => {
  if (!levelExpMap || typeof levelExpMap !== 'object') {
    return null;
  }

  const levels = Object.keys(levelExpMap)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (levels.length === 0) {
    return null;
  }

  return {
    minLevel: levels[0],
    maxLevel: levels[levels.length - 1],
  };
};

app.getCharacterExpLimit = (levelExpMap, level) => {
  const bounds = app.getCharacterLevelBounds(levelExpMap);
  if (!bounds || !Number.isFinite(Number(level))) {
    return null;
  }

  const normalizedLevel = Number(level);
  const rawLimit = Number(levelExpMap?.[normalizedLevel]);
  if (!Number.isFinite(rawLimit)) {
    return null;
  }

  return normalizedLevel === bounds.maxLevel ? rawLimit : Math.max(rawLimit - 1, 0);
};

app.getCharacterLevelEditState = () => {
  const item = state.currentCharacterDetailItem;
  const extraInfo = state.currentCharacterDetailExtraInfo;
  if (!item || !extraInfo || typeof extraInfo !== 'object') {
    return null;
  }

  const recordId = Number.isFinite(Number(item?._id ?? item?.record_id)) ? Number(item._id ?? item.record_id) : null;
  const level = Number.isFinite(Number(item?.Level)) ? Number(item.Level) : null;
  const exp = Number.isFinite(Number(extraInfo?.Exp)) ? Math.max(0, Number(extraInfo.Exp)) : 0;
  const levelExpMap = extraInfo?.LevelExpMap && typeof extraInfo.LevelExpMap === 'object' ? extraInfo.LevelExpMap : null;
  const bounds = app.getCharacterLevelBounds(levelExpMap);
  if (recordId === null || level === null || !bounds) {
    return null;
  }

  return {
    recordId,
    level,
    exp,
    levelExpMap,
    minLevel: bounds.minLevel,
    maxLevel: bounds.maxLevel,
  };
};

app.syncCharacterLevelEditExpInput = () => {
  if (!(characterLevelEditLevelInput instanceof HTMLInputElement) || !(characterLevelEditExpInput instanceof HTMLInputElement)) {
    return;
  }

  const editState = app.getCharacterLevelEditState();
  if (!editState) {
    return;
  }

  const selectedLevel = Number.parseInt(characterLevelEditLevelInput.value, 10);
  const effectiveLevel = Number.isFinite(selectedLevel) ? selectedLevel : editState.level;
  const maxExp = app.getCharacterExpLimit(editState.levelExpMap, effectiveLevel);
  if (!Number.isFinite(maxExp)) {
    characterLevelEditExpInput.min = '0';
    characterLevelEditExpInput.max = '0';
    return;
  }

  characterLevelEditExpInput.min = '0';
  characterLevelEditExpInput.max = String(maxExp);

  const currentExp = Number.parseInt(characterLevelEditExpInput.value, 10);
  if (!Number.isFinite(currentExp) || currentExp < 0) {
    characterLevelEditExpInput.value = '0';
    return;
  }

  if (currentExp > maxExp) {
    characterLevelEditExpInput.value = String(maxExp);
  }
};

app.syncCharacterLevelEditControls = () => {
  const editState = app.getCharacterLevelEditState();
  const isEditable = Boolean(editState);

  if (characterDetailLevel instanceof HTMLElement) {
    characterDetailLevel.classList.toggle('is-editable', isEditable);
    characterDetailLevel.tabIndex = isEditable ? 0 : -1;
    characterDetailLevel.setAttribute('role', isEditable ? 'button' : 'status');
    if (isEditable) {
      characterDetailLevel.setAttribute('aria-label', app.translate('dashboard.characterDetailLevelEditTrigger'));
      characterDetailLevel.title = app.translate('dashboard.characterDetailLevelEditTrigger');
    } else {
      characterDetailLevel.removeAttribute('aria-label');
      characterDetailLevel.removeAttribute('title');
    }
  }

  return editState;
};

app.populateCharacterLevelEditModal = () => {
  const editState = app.getCharacterLevelEditState();
  if (!editState || !(characterLevelEditLevelInput instanceof HTMLInputElement) || !(characterLevelEditExpInput instanceof HTMLInputElement)) {
    return false;
  }

  characterLevelEditLevelInput.min = String(editState.minLevel);
  characterLevelEditLevelInput.max = String(editState.maxLevel);
  characterLevelEditLevelInput.value = String(editState.level);
  characterLevelEditLevelInput.disabled = state.characterLevelEditPending;

  characterLevelEditExpInput.value = String(editState.exp);
  characterLevelEditExpInput.disabled = state.characterLevelEditPending;
  app.syncCharacterLevelEditExpInput();

  if (characterLevelEditConfirmButton instanceof HTMLButtonElement) {
    characterLevelEditConfirmButton.disabled = state.characterLevelEditPending;
    characterLevelEditConfirmButton.textContent = state.characterLevelEditPending
      ? app.translate('common.loading')
      : app.translate('common.confirm');
  }

  return true;
};

app.closeCharacterLevelEditModal = () => {
  if (!(characterLevelEditModal instanceof HTMLElement) || characterLevelEditModal.hidden) {
    return;
  }

  characterLevelEditModal.hidden = true;
  state.characterLevelEditPending = false;

  if (state.lastCharacterLevelEditTrigger instanceof HTMLElement) {
    state.lastCharacterLevelEditTrigger.focus();
    state.lastCharacterLevelEditTrigger = null;
  }

  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
};

app.openCharacterLevelEditModal = (trigger = null) => {
  if (!(characterLevelEditModal instanceof HTMLElement)) {
    return;
  }

  if (!app.populateCharacterLevelEditModal()) {
    return;
  }

  state.lastCharacterLevelEditTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  characterLevelEditModal.hidden = false;
  app.setBodyModalOpen(true);

  if (characterLevelEditLevelInput instanceof HTMLInputElement) {
    characterLevelEditLevelInput.focus();
  } else if (characterLevelEditCard instanceof HTMLElement) {
    characterLevelEditCard.focus();
  }
};

app.getCharacterTrustBounds = (trustExpMap = state.characterTrustExpMap) => {
  if (!trustExpMap || typeof trustExpMap !== 'object') {
    return null;
  }

  const levels = Object.keys(trustExpMap)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 8)
    .sort((left, right) => left - right);
  if (levels.length === 0) {
    return null;
  }

  return {
    minTrustLv: levels[0],
    maxTrustLv: Math.min(levels[levels.length - 1], 8),
  };
};

app.getCharacterTrustExpLimit = (trustExpMap, trustLv) => {
  const bounds = app.getCharacterTrustBounds(trustExpMap);
  if (!bounds || !Number.isFinite(Number(trustLv))) {
    return null;
  }

  const normalizedTrustLv = Number(trustLv);
  const rawLimit = Number(trustExpMap?.[normalizedTrustLv]);
  if (!Number.isFinite(rawLimit)) {
    return null;
  }

  return normalizedTrustLv === bounds.maxTrustLv ? rawLimit : Math.max(rawLimit - 1, 0);
};

app.getCharacterTrustEditState = () => {
  const item = state.currentCharacterDetailItem;
  const extraInfo = state.currentCharacterDetailExtraInfo;
  const trustExpMap = state.characterTrustExpMap && typeof state.characterTrustExpMap === 'object'
    ? state.characterTrustExpMap
    : null;
  if (!item || !extraInfo || typeof extraInfo !== 'object' || !trustExpMap) {
    return null;
  }

  const recordId = Number.isFinite(Number(item?._id ?? item?.record_id)) ? Number(item._id ?? item.record_id) : null;
  const bounds = app.getCharacterTrustBounds(trustExpMap);
  if (recordId === null || !bounds) {
    return null;
  }

  const rawTrustLv = Number.isFinite(Number(extraInfo?.TrustLv)) ? Math.max(0, Math.floor(Number(extraInfo.TrustLv))) : 0;
  const trustLv = Math.min(Math.max(rawTrustLv, bounds.minTrustLv), bounds.maxTrustLv);
  const trustExpLimit = app.getCharacterTrustExpLimit(trustExpMap, trustLv);
  if (!Number.isFinite(trustExpLimit)) {
    return null;
  }

  const rawTrustExp = Number.isFinite(Number(extraInfo?.TrustExp)) ? Math.max(0, Number(extraInfo.TrustExp)) : 0;

  return {
    recordId,
    trustLv,
    trustExp: Math.min(rawTrustExp, trustExpLimit),
    trustExpMap,
    minTrustLv: bounds.minTrustLv,
    maxTrustLv: bounds.maxTrustLv,
  };
};

app.renderCharacterTrustEditHearts = (selectedTrustLv) => {
  if (!(characterTrustEditHearts instanceof HTMLElement)) {
    return;
  }

  const editState = app.getCharacterTrustEditState();
  if (!editState) {
    characterTrustEditHearts.innerHTML = '';
    return;
  }

  const normalizedTrustLv = Number.isFinite(Number(selectedTrustLv))
    ? Math.min(Math.max(Number(selectedTrustLv), editState.minTrustLv), editState.maxTrustLv)
    : editState.trustLv;
  const selectedSymbol = app.getCharacterTrustSymbol(normalizedTrustLv) || '🤍';

  characterTrustEditHearts.innerHTML = Array.from({ length: editState.maxTrustLv }, (_, index) => {
    const trustLv = index + 1;
    const isSelected = trustLv <= normalizedTrustLv;
    const isCurrent = trustLv === normalizedTrustLv;
    const isDisabled = trustLv < editState.minTrustLv || state.characterTrustEditPending;
    const symbol = isSelected ? selectedSymbol : '🤍';
    return `
      <button
        type="button"
        class="character-trust-edit-heart${isSelected ? ' is-selected' : ''}"
        data-character-trust-level="${trustLv}"
        aria-label="${app.escapeHtml(app.translate('dashboard.characterDetailTrustLevelOption', { level: trustLv }))}"
        aria-pressed="${isCurrent ? 'true' : 'false'}"
        ${isDisabled ? 'disabled' : ''}
      >${symbol}</button>
    `;
  }).join('');

  characterTrustEditHearts.setAttribute('aria-label', app.translate('dashboard.characterDetailTrustEditTrigger'));
};

app.syncCharacterTrustEditExpInput = () => {
  if (!(characterTrustEditHearts instanceof HTMLElement) || !(characterTrustEditExpInput instanceof HTMLInputElement)) {
    return;
  }

  const editState = app.getCharacterTrustEditState();
  if (!editState) {
    return;
  }

  const selectedButton = characterTrustEditHearts.querySelector('[data-character-trust-level][aria-pressed="true"]');
  const selectedTrustLv = selectedButton instanceof HTMLButtonElement
    ? Number.parseInt(selectedButton.dataset.characterTrustLevel ?? '', 10)
    : editState.trustLv;
  const effectiveTrustLv = Number.isFinite(selectedTrustLv)
    ? Math.min(Math.max(selectedTrustLv, editState.minTrustLv), editState.maxTrustLv)
    : editState.trustLv;
  const maxExp = app.getCharacterTrustExpLimit(editState.trustExpMap, effectiveTrustLv);
  if (!Number.isFinite(maxExp)) {
    characterTrustEditExpInput.min = '0';
    characterTrustEditExpInput.max = '0';
    return;
  }

  characterTrustEditExpInput.min = '0';
  characterTrustEditExpInput.max = String(maxExp);

  const currentExp = Number.parseInt(characterTrustEditExpInput.value, 10);
  if (!Number.isFinite(currentExp) || currentExp < 0) {
    characterTrustEditExpInput.value = '0';
    return;
  }

  if (currentExp > maxExp) {
    characterTrustEditExpInput.value = String(maxExp);
  }
};

app.syncCharacterTrustEditControls = () => {
  const editState = app.getCharacterTrustEditState();
  const isEditable = Boolean(editState);

  if (characterDetailTrust instanceof HTMLElement) {
    characterDetailTrust.classList.toggle('is-editable', isEditable);
    characterDetailTrust.tabIndex = isEditable ? 0 : -1;
    characterDetailTrust.setAttribute('role', isEditable ? 'button' : 'status');
    if (isEditable) {
      characterDetailTrust.setAttribute('aria-label', app.translate('dashboard.characterDetailTrustEditTrigger'));
      characterDetailTrust.title = app.translate('dashboard.characterDetailTrustEditTrigger');
    } else {
      characterDetailTrust.removeAttribute('aria-label');
      characterDetailTrust.removeAttribute('title');
    }
  }

  return editState;
};

app.populateCharacterTrustEditModal = () => {
  const editState = app.getCharacterTrustEditState();
  if (!editState || !(characterTrustEditExpInput instanceof HTMLInputElement)) {
    return false;
  }

  app.renderCharacterTrustEditHearts(editState.trustLv);

  characterTrustEditExpInput.value = String(editState.trustExp);
  characterTrustEditExpInput.disabled = state.characterTrustEditPending;
  app.syncCharacterTrustEditExpInput();

  if (characterTrustEditConfirmButton instanceof HTMLButtonElement) {
    characterTrustEditConfirmButton.disabled = state.characterTrustEditPending;
    characterTrustEditConfirmButton.textContent = state.characterTrustEditPending
      ? app.translate('common.loading')
      : app.translate('common.confirm');
  }

  return true;
};

app.closeCharacterTrustEditModal = () => {
  if (!(characterTrustEditModal instanceof HTMLElement) || characterTrustEditModal.hidden) {
    return;
  }

  characterTrustEditModal.hidden = true;
  state.characterTrustEditPending = false;

  if (state.lastCharacterTrustEditTrigger instanceof HTMLElement) {
    state.lastCharacterTrustEditTrigger.focus();
    state.lastCharacterTrustEditTrigger = null;
  }

  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
};

app.openCharacterTrustEditModal = (trigger = null) => {
  if (!(characterTrustEditModal instanceof HTMLElement)) {
    return;
  }

  if (!app.populateCharacterTrustEditModal()) {
    return;
  }

  state.lastCharacterTrustEditTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  characterTrustEditModal.hidden = false;
  app.setBodyModalOpen(true);

  const selectedButton = characterTrustEditHearts instanceof HTMLElement
    ? characterTrustEditHearts.querySelector('[data-character-trust-level][aria-pressed="true"]')
    : null;
  if (selectedButton instanceof HTMLButtonElement) {
    selectedButton.focus();
  } else if (characterTrustEditExpInput instanceof HTMLInputElement) {
    characterTrustEditExpInput.focus();
  } else if (characterTrustEditCard instanceof HTMLElement) {
    characterTrustEditCard.focus();
  }
};

app.getCharacterGradeEditState = () => {
  const item = state.currentCharacterDetailItem;
  if (!item) {
    return null;
  }

  const recordId = Number.isFinite(Number(item?._id ?? item?.record_id)) ? Number(item._id ?? item.record_id) : null;
  const characterId = Number.isFinite(Number(item?.CharacterId ?? item?._id ?? item?.record_id)) ? Number(item.CharacterId ?? item._id ?? item.record_id) : null;
  const grade = Number.isFinite(Number(item?.Grade)) ? Math.max(1, Math.floor(Number(item.Grade))) : 0;
  const options = app.getCharacterGradeOptions(characterId);
  if (recordId === null || characterId === null || grade <= 0 || options.length === 0 || !options.some((option) => option.value === grade)) {
    return null;
  }

  return {
    recordId,
    characterId,
    grade,
    options,
  };
};

app.syncCharacterGradeEditControls = () => {
  const editState = app.getCharacterGradeEditState();
  const isEditable = Boolean(editState);

  if (characterDetailGrade instanceof HTMLElement) {
    characterDetailGrade.classList.toggle('is-editable', isEditable);
    characterDetailGrade.tabIndex = isEditable ? 0 : -1;
    characterDetailGrade.setAttribute('role', isEditable ? 'button' : 'status');
    if (isEditable) {
      characterDetailGrade.setAttribute('aria-label', app.translate('dashboard.characterDetailGradeEditTrigger'));
      characterDetailGrade.title = app.translate('dashboard.characterDetailGradeEditTrigger');
    } else {
      characterDetailGrade.removeAttribute('aria-label');
      characterDetailGrade.removeAttribute('title');
    }
  }

  return editState;
};

app.populateCharacterGradeEditModal = () => {
  const editState = app.getCharacterGradeEditState();
  if (!editState || !(characterGradeEditSelect instanceof HTMLSelectElement)) {
    return false;
  }

  characterGradeEditSelect.innerHTML = editState.options.map((option) => (
    `<option value="${option.value}">${app.escapeHtml(option.label)}</option>`
  )).join('');
  characterGradeEditSelect.value = String(editState.grade);
  characterGradeEditSelect.className = `character-quality-edit-select ${app.getCharacterGradeClass(editState.grade)}`;
  characterGradeEditSelect.disabled = state.characterGradeEditPending;

  if (characterGradeEditConfirmButton instanceof HTMLButtonElement) {
    characterGradeEditConfirmButton.disabled = state.characterGradeEditPending;
    characterGradeEditConfirmButton.textContent = state.characterGradeEditPending
      ? app.translate('common.loading')
      : app.translate('common.confirm');
  }

  return true;
};

app.closeCharacterGradeEditModal = () => {
  if (!(characterGradeEditModal instanceof HTMLElement) || characterGradeEditModal.hidden) {
    return;
  }

  characterGradeEditModal.hidden = true;
  state.characterGradeEditPending = false;

  if (state.lastCharacterGradeEditTrigger instanceof HTMLElement) {
    state.lastCharacterGradeEditTrigger.focus();
    state.lastCharacterGradeEditTrigger = null;
  }

  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
};

app.openCharacterGradeEditModal = (trigger = null) => {
  if (!(characterGradeEditModal instanceof HTMLElement)) {
    return;
  }

  if (!app.populateCharacterGradeEditModal()) {
    return;
  }

  state.lastCharacterGradeEditTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  characterGradeEditModal.hidden = false;
  app.setBodyModalOpen(true);

  if (characterGradeEditSelect instanceof HTMLSelectElement) {
    characterGradeEditSelect.focus();
  } else if (characterGradeEditCard instanceof HTMLElement) {
    characterGradeEditCard.focus();
  }
};

app.updateCharacterGrade = async () => {
  const editState = app.getCharacterGradeEditState();
  if (!editState || !(characterGradeEditSelect instanceof HTMLSelectElement)) {
    return;
  }

  const grade = Number.parseInt(characterGradeEditSelect.value, 10);
  if (!editState.options.some((option) => option.value === grade)) {
    app.openNoticeModal(app.translate('runtime.characterGradeUpdateInvalid'));
    return;
  }

  state.characterGradeEditPending = true;
  app.populateCharacterGradeEditModal();

  try {
    const payload = await app.apiFetch(`/api/database-characters/selected/${editState.recordId}/grade`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Grade: grade,
      }),
    });

    const updatedGrade = Number.isFinite(Number(payload?.Grade)) ? Math.max(1, Math.floor(Number(payload.Grade))) : grade;
    const updatedGradeName = app.resolveCharacterGradeName(editState.characterId, updatedGrade, '--');
    const currentRecordId = editState.recordId;

    state.characterManagementItems = Array.isArray(state.characterManagementItems)
      ? state.characterManagementItems.map((entry) => {
        const entryRecordId = Number.isFinite(Number(entry?._id ?? entry?.record_id)) ? Number(entry._id ?? entry.record_id) : null;
        if (entryRecordId !== currentRecordId) {
          return entry;
        }
        return {
          ...entry,
          Grade: updatedGrade,
          GradeName: updatedGradeName,
        };
      })
      : state.characterManagementItems;

    if (state.currentCharacterDetailItem) {
      state.currentCharacterDetailItem = {
        ...state.currentCharacterDetailItem,
        Grade: updatedGrade,
        GradeName: updatedGradeName,
      };
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }

    if (state.characterManagementHasLoaded && state.characterManagementItems.length > 0) {
      app.renderCharacterRows(state.characterManagementItems);
    }

    app.closeCharacterGradeEditModal();
    app.openSuccessModal(app.translate('runtime.characterGradeUpdateSuccess'), app.translate('runtime.characterGradeUpdateSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterGradeUpdateFailed'));
  } finally {
    state.characterGradeEditPending = false;
    if (characterGradeEditModal instanceof HTMLElement && !characterGradeEditModal.hidden) {
      app.populateCharacterGradeEditModal();
    }
  }
};

app.getCharacterAwakenEditState = () => {
  const item = state.currentCharacterDetailItem;
  const extraInfo = state.currentCharacterDetailExtraInfo;
  if (!item) {
    return null;
  }

  if (!extraInfo || typeof extraInfo !== 'object') {
    return null;
  }

  const recordId = Number.isFinite(Number(item?._id ?? item?.record_id)) ? Number(item._id ?? item.record_id) : null;
  const rawAwakenLevel = Number.isFinite(Number(item?.AwakenLevel)) ? Math.max(0, Math.floor(Number(item.AwakenLevel))) : 0;
  const awakenLevel = Math.min(Math.max(rawAwakenLevel, 1), 5);
  const options = app.getCharacterAwakenSelectableOptions(extraInfo);
  if (recordId === null) {
    return null;
  }

  if (options.length === 0 || !options.includes(awakenLevel)) {
    return null;
  }

  return {
    recordId,
    awakenLevel,
    options,
  };
};

app.syncCharacterAwakenEditControls = () => {
  const editState = app.getCharacterAwakenEditState();
  const isEditable = Boolean(editState);

  if (characterDetailAwaken instanceof HTMLElement) {
    characterDetailAwaken.classList.toggle('is-editable', isEditable);
    characterDetailAwaken.tabIndex = isEditable ? 0 : -1;
    characterDetailAwaken.setAttribute('role', isEditable ? 'button' : 'status');
    if (isEditable) {
      characterDetailAwaken.setAttribute('aria-label', app.translate('dashboard.characterDetailAwakenEditTrigger'));
      characterDetailAwaken.title = app.translate('dashboard.characterDetailAwakenEditTrigger');
    } else {
      characterDetailAwaken.removeAttribute('aria-label');
      characterDetailAwaken.removeAttribute('title');
    }
  }

  return editState;
};

app.populateCharacterAwakenEditModal = () => {
  const editState = app.getCharacterAwakenEditState();
  if (!editState || !(characterAwakenEditLevelSelect instanceof HTMLSelectElement)) {
    return false;
  }

  characterAwakenEditLevelSelect.innerHTML = editState.options.map((awakenOption) => (
    `<option value="${awakenOption}">${app.escapeHtml(app.getCharacterAwakenDisplay(awakenOption))}</option>`
  )).join('');
  characterAwakenEditLevelSelect.value = String(editState.awakenLevel);
  characterAwakenEditLevelSelect.className = `character-quality-edit-select ${app.getCharacterAwakenClass(editState.awakenLevel)}`;
  characterAwakenEditLevelSelect.disabled = state.characterAwakenEditPending;

  if (characterAwakenEditConfirmButton instanceof HTMLButtonElement) {
    characterAwakenEditConfirmButton.disabled = state.characterAwakenEditPending;
    characterAwakenEditConfirmButton.textContent = state.characterAwakenEditPending
      ? app.translate('common.loading')
      : app.translate('common.confirm');
  }

  return true;
};

app.closeCharacterAwakenEditModal = () => {
  if (!(characterAwakenEditModal instanceof HTMLElement) || characterAwakenEditModal.hidden) {
    return;
  }

  characterAwakenEditModal.hidden = true;
  state.characterAwakenEditPending = false;

  if (state.lastCharacterAwakenEditTrigger instanceof HTMLElement) {
    state.lastCharacterAwakenEditTrigger.focus();
    state.lastCharacterAwakenEditTrigger = null;
  }

  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
};

app.openCharacterAwakenEditModal = (trigger = null) => {
  if (!(characterAwakenEditModal instanceof HTMLElement)) {
    return;
  }

  if (!app.populateCharacterAwakenEditModal()) {
    return;
  }

  state.lastCharacterAwakenEditTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  characterAwakenEditModal.hidden = false;
  app.setBodyModalOpen(true);

  if (characterAwakenEditLevelSelect instanceof HTMLSelectElement) {
    characterAwakenEditLevelSelect.focus();
  } else if (characterAwakenEditCard instanceof HTMLElement) {
    characterAwakenEditCard.focus();
  }
};

app.updateCharacterAwaken = async () => {
  const editState = app.getCharacterAwakenEditState();
  if (!editState || !(characterAwakenEditLevelSelect instanceof HTMLSelectElement)) {
    return;
  }

  const awakenLevel = Number.parseInt(characterAwakenEditLevelSelect.value, 10);
  if (!editState.options.includes(awakenLevel)) {
    app.openNoticeModal(app.translate('runtime.characterAwakenUpdateInvalid'));
    return;
  }

  state.characterAwakenEditPending = true;
  app.populateCharacterAwakenEditModal();

  try {
    const payload = await app.apiFetch(`/api/database-characters/selected/${editState.recordId}/awaken`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        AwakenLevel: awakenLevel,
      }),
    });

    const updatedAwakenLevel = Number.isFinite(Number(payload?.AwakenLevel)) ? Number(payload.AwakenLevel) : awakenLevel;
    const currentRecordId = editState.recordId;

    state.characterManagementItems = Array.isArray(state.characterManagementItems)
      ? state.characterManagementItems.map((entry) => {
        const entryRecordId = Number.isFinite(Number(entry?._id ?? entry?.record_id)) ? Number(entry._id ?? entry.record_id) : null;
        if (entryRecordId !== currentRecordId) {
          return entry;
        }
        return {
          ...entry,
          AwakenLevel: updatedAwakenLevel,
        };
      })
      : state.characterManagementItems;

    if (state.currentCharacterDetailItem) {
      state.currentCharacterDetailItem = {
        ...state.currentCharacterDetailItem,
        AwakenLevel: updatedAwakenLevel,
      };
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }

    if (state.characterManagementHasLoaded && state.characterManagementItems.length > 0) {
      app.renderCharacterRows(state.characterManagementItems);
    }

    app.closeCharacterAwakenEditModal();
    app.openSuccessModal(app.translate('runtime.characterAwakenUpdateSuccess'), app.translate('runtime.characterAwakenUpdateSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterAwakenUpdateFailed'));
  } finally {
    state.characterAwakenEditPending = false;
    if (characterAwakenEditModal instanceof HTMLElement && !characterAwakenEditModal.hidden) {
      app.populateCharacterAwakenEditModal();
    }
  }
};

app.updateCharacterTrust = async () => {
  const editState = app.getCharacterTrustEditState();
  if (!editState || !(characterTrustEditHearts instanceof HTMLElement) || !(characterTrustEditExpInput instanceof HTMLInputElement)) {
    return;
  }

  const selectedButton = characterTrustEditHearts.querySelector('[data-character-trust-level][aria-pressed="true"]');
  const trustLv = selectedButton instanceof HTMLButtonElement
    ? Number.parseInt(selectedButton.dataset.characterTrustLevel ?? '', 10)
    : NaN;
  const trustExp = Number.parseInt(characterTrustEditExpInput.value, 10);
  if (!Number.isFinite(trustLv) || !Number.isFinite(trustExp) || trustExp < 0) {
    app.openNoticeModal(app.translate('runtime.characterTrustUpdateInvalid'));
    return;
  }

  if (trustLv < editState.minTrustLv || trustLv > editState.maxTrustLv) {
    app.openNoticeModal(app.translate('runtime.characterTrustUpdateInvalid'));
    return;
  }

  const maxExp = app.getCharacterTrustExpLimit(editState.trustExpMap, trustLv);
  if (!Number.isFinite(maxExp) || trustExp > maxExp) {
    app.openNoticeModal(app.translate('runtime.characterTrustUpdateInvalid'));
    return;
  }

  state.characterTrustEditPending = true;
  app.populateCharacterTrustEditModal();

  try {
    const payload = await app.apiFetch(`/api/database-characters/selected/${editState.recordId}/trust`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        TrustLv: trustLv,
        TrustExp: trustExp,
      }),
    });

    const updatedTrustLv = Number.isFinite(Number(payload?.TrustLv)) ? Number(payload.TrustLv) : trustLv;
    const updatedTrustExp = Number.isFinite(Number(payload?.TrustExp)) ? Number(payload.TrustExp) : trustExp;

    if (state.currentCharacterDetailExtraInfo && typeof state.currentCharacterDetailExtraInfo === 'object') {
      state.currentCharacterDetailExtraInfo = {
        ...state.currentCharacterDetailExtraInfo,
        TrustLv: updatedTrustLv,
        TrustExp: updatedTrustExp,
      };
    }

    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }

    app.closeCharacterTrustEditModal();
    app.openSuccessModal(app.translate('runtime.characterTrustUpdateSuccess'), app.translate('runtime.characterTrustUpdateSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterTrustUpdateFailed'));
  } finally {
    state.characterTrustEditPending = false;
    if (characterTrustEditModal instanceof HTMLElement && !characterTrustEditModal.hidden) {
      app.populateCharacterTrustEditModal();
    }
  }
};

app.handleCharacterQualityEditQualityChange = () => {
  if (!(characterQualityEditQualitySelect instanceof HTMLSelectElement)) {
    return;
  }

  const quality = Number.parseInt(characterQualityEditQualitySelect.value, 10);
  const normalizedQuality = Number.isFinite(quality) ? quality : 0;
  const previousStar = characterQualityEditStarSelect instanceof HTMLSelectElement
    ? Number.parseInt(characterQualityEditStarSelect.value, 10)
    : 0;
  characterQualityEditQualitySelect.className = `character-quality-edit-select ${app.getCharacterQualityClass(normalizedQuality)}`;
  app.renderCharacterQualityStarOptions(normalizedQuality);
  if (characterQualityEditStarSelect instanceof HTMLSelectElement) {
    const nextStar = normalizedQuality === 6
      ? 0
      : (Number.isFinite(previousStar) ? Math.min(Math.max(previousStar, 0), 9) : 0);
    characterQualityEditStarSelect.value = String(nextStar);
  }
};

app.updateCharacterQualityStar = async () => {
  const editState = app.getCharacterQualityEditState();
  if (!editState || !(characterQualityEditQualitySelect instanceof HTMLSelectElement) || !(characterQualityEditStarSelect instanceof HTMLSelectElement)) {
    return;
  }

  const quality = Number.parseInt(characterQualityEditQualitySelect.value, 10);
  const star = Number.parseInt(characterQualityEditStarSelect.value, 10);
  const normalizedQuality = Number.isFinite(quality) ? quality : NaN;
  const normalizedStar = Number.isFinite(star) ? star : NaN;

  if (!editState.options.includes(normalizedQuality)) {
    app.openNoticeModal(app.translate('runtime.characterQualityUpdateInvalid'));
    return;
  }

  if (normalizedQuality === 6 ? normalizedStar !== 0 : normalizedStar < 0 || normalizedStar > 9) {
    app.openNoticeModal(app.translate('runtime.characterQualityUpdateInvalid'));
    return;
  }

  state.characterQualityEditPending = true;
  app.populateCharacterQualityEditModal();

  try {
    const payload = await app.apiFetch(`/api/database-characters/selected/${editState.recordId}/evolution`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Quality: normalizedQuality,
        Star: normalizedQuality === 6 ? 0 : normalizedStar,
      }),
    });

    const updatedQuality = Number.isFinite(Number(payload?.Quality)) ? Number(payload.Quality) : normalizedQuality;
    const updatedStar = Number.isFinite(Number(payload?.Star)) ? Number(payload.Star) : (updatedQuality === 6 ? 0 : normalizedStar);
    const currentRecordId = editState.recordId;

    state.characterManagementItems = Array.isArray(state.characterManagementItems)
      ? state.characterManagementItems.map((entry) => {
        const entryRecordId = Number.isFinite(Number(entry?._id ?? entry?.record_id)) ? Number(entry._id ?? entry.record_id) : null;
        if (entryRecordId !== currentRecordId) {
          return entry;
        }
        return {
          ...entry,
          Quality: updatedQuality,
          Star: updatedStar,
        };
      })
      : state.characterManagementItems;

    if (state.currentCharacterDetailItem) {
      state.currentCharacterDetailItem = {
        ...state.currentCharacterDetailItem,
        Quality: updatedQuality,
        Star: updatedStar,
      };
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }

    if (state.characterManagementHasLoaded && state.characterManagementItems.length > 0) {
      app.renderCharacterRows(state.characterManagementItems);
    }

    app.closeCharacterQualityEditModal();
    app.openSuccessModal(app.translate('runtime.characterQualityUpdateSuccess'), app.translate('runtime.characterQualityUpdateSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterQualityUpdateFailed'));
  } finally {
    state.characterQualityEditPending = false;
    if (characterQualityEditModal instanceof HTMLElement && !characterQualityEditModal.hidden) {
      app.populateCharacterQualityEditModal();
    }
  }
};

app.updateCharacterLevelExp = async () => {
  const editState = app.getCharacterLevelEditState();
  if (!editState || !(characterLevelEditLevelInput instanceof HTMLInputElement) || !(characterLevelEditExpInput instanceof HTMLInputElement)) {
    return;
  }

  const level = Number.parseInt(characterLevelEditLevelInput.value, 10);
  const exp = Number.parseInt(characterLevelEditExpInput.value, 10);
  if (!Number.isFinite(level) || !Number.isFinite(exp) || exp < 0) {
    app.openNoticeModal(app.translate('runtime.characterLevelUpdateInvalid'));
    return;
  }

  if (level < editState.minLevel || level > editState.maxLevel) {
    app.openNoticeModal(app.translate('runtime.characterLevelMaxExceeded', {
      min: editState.minLevel,
      max: editState.maxLevel,
    }));
    return;
  }

  const maxExp = app.getCharacterExpLimit(editState.levelExpMap, level);
  if (!Number.isFinite(maxExp)) {
    app.openNoticeModal(app.translate('runtime.characterLevelUpdateInvalid'));
    return;
  }

  if (exp > maxExp) {
    app.openNoticeModal(app.translate('runtime.characterExpMaxExceeded', { max: maxExp }));
    return;
  }

  state.characterLevelEditPending = true;
  app.populateCharacterLevelEditModal();

  try {
    const payload = await app.apiFetch(`/api/database-characters/selected/${editState.recordId}/levelup`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Level: level,
        Exp: exp,
      }),
    });

    const updatedLevel = Number.isFinite(Number(payload?.Level)) ? Number(payload.Level) : level;
    const updatedExp = Number.isFinite(Number(payload?.Exp)) ? Number(payload.Exp) : exp;
    const currentRecordId = editState.recordId;

    state.characterManagementItems = Array.isArray(state.characterManagementItems)
      ? state.characterManagementItems.map((entry) => {
        const entryRecordId = Number.isFinite(Number(entry?._id ?? entry?.record_id)) ? Number(entry._id ?? entry.record_id) : null;
        if (entryRecordId !== currentRecordId) {
          return entry;
        }
        return {
          ...entry,
          Level: updatedLevel,
        };
      })
      : state.characterManagementItems;

    if (state.currentCharacterDetailItem) {
      state.currentCharacterDetailItem = {
        ...state.currentCharacterDetailItem,
        Level: updatedLevel,
      };
    }

    if (state.currentCharacterDetailExtraInfo && typeof state.currentCharacterDetailExtraInfo === 'object') {
      state.currentCharacterDetailExtraInfo = {
        ...state.currentCharacterDetailExtraInfo,
        Exp: updatedExp,
      };
    }

    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }

    if (state.characterManagementHasLoaded && state.characterManagementItems.length > 0) {
      app.renderCharacterRows(state.characterManagementItems);
    }

    app.closeCharacterLevelEditModal();
    app.openSuccessModal(app.translate('runtime.characterLevelUpdateSuccess'), app.translate('runtime.characterLevelUpdateSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterLevelUpdateFailed'));
  } finally {
    state.characterLevelEditPending = false;
    if (characterLevelEditModal instanceof HTMLElement && !characterLevelEditModal.hidden) {
      app.populateCharacterLevelEditModal();
    }
  }
};

app.getCharacterQualityLabel = (quality) => {
  const normalizedQuality = Number.isFinite(Number(quality)) ? Number(quality) : 0;
  const keyMap = {
    1: 'dashboard.characterQualityB',
    2: 'dashboard.characterQualityA',
    3: 'dashboard.characterQualityS',
    4: 'dashboard.characterQualitySS',
    5: 'dashboard.characterQualitySSS',
    6: 'dashboard.characterQualitySSSPlus',
  };
  return keyMap[normalizedQuality] ? app.translate(keyMap[normalizedQuality]) : '--';
};

app.getCharacterQualityDisplayLabel = (quality, star) => {
  const qualityLabel = app.getCharacterQualityLabel(quality);
  const normalizedStar = Number.isFinite(Number(star)) ? Math.max(0, Number(star)) : 0;
  if (normalizedStar === 0 || qualityLabel === '--') {
    return qualityLabel;
  }
  return `${qualityLabel}${normalizedStar}`;
};

app.getCharacterQualityClass = (quality) => {
  const normalizedQuality = Number.isFinite(Number(quality)) ? Number(quality) : 0;
  return `character-quality-tier-${Math.max(0, normalizedQuality)}`;
};

app.getCharacterGradeClass = (grade) => {
  const normalizedGrade = Number.isFinite(Number(grade)) ? Math.max(0, Number(grade)) : 0;
  if (normalizedGrade >= 14) return 'character-grade-tier-5';
  if (normalizedGrade >= 10) return 'character-grade-tier-4';
  if (normalizedGrade >= 7) return 'character-grade-tier-3';
  if (normalizedGrade >= 4) return 'character-grade-tier-2';
  if (normalizedGrade >= 2) return 'character-grade-tier-1';
  return 'character-grade-tier-0';
};

app.getCharacterAwakenClass = (awakenLevel) => {
  const normalizedAwakenLevel = Number.isFinite(Number(awakenLevel)) ? Math.max(0, Number(awakenLevel)) : 0;
  return `character-awaken-tier-${Math.min(normalizedAwakenLevel, 5)}`;
};

app.getCharacterIconEffectClass = (quality) => {
  const normalizedQuality = Number.isFinite(Number(quality)) ? Number(quality) : 0;
  if (normalizedQuality >= 6) return 'character-icon-tier-6';
  if (normalizedQuality >= 5) return 'character-icon-tier-5';
  if (normalizedQuality >= 4) return 'character-icon-tier-4';
  if (normalizedQuality >= 3) return 'character-icon-tier-3';
  return '';
};

app.getFashionQualityEffectClass = (quality) => {
  const normalizedQuality = Number.isFinite(Number(quality)) ? Number(quality) : 0;
  if (normalizedQuality >= 6) return 'fashion-quality-tier-6';
  if (normalizedQuality >= 5) return 'fashion-quality-tier-5';
  if (normalizedQuality >= 4) return 'fashion-quality-tier-4';
  if (normalizedQuality >= 3) return 'fashion-quality-tier-3';
  if (normalizedQuality >= 2) return 'fashion-quality-tier-2';
  return '';
};

app.normalizeCharacterFashions = (extraInfo) => {
  if (!Array.isArray(extraInfo?.Fashions)) {
    return [];
  }

  return extraInfo.Fashions.map((fashion) => {
    const id = Number.isFinite(Number(fashion?.Id)) ? Number(fashion.Id) : null;
    const quality = Number.isFinite(Number(fashion?.Quality)) ? Number(fashion.Quality) : 0;
    const bigIcon = typeof fashion?.BigIcon === 'string' && fashion.BigIcon.trim()
      ? fashion.BigIcon.trim()
      : '';
    const bigHeadIconFashion = typeof fashion?.BigHeadIconFashion === 'string' && fashion.BigHeadIconFashion.trim()
      ? fashion.BigHeadIconFashion.trim()
      : '';
    const name = typeof fashion?.Name === 'string' && fashion.Name.trim()
      ? fashion.Name.trim()
      : '--';
    const description = typeof fashion?.Description === 'string' && fashion.Description.trim()
      ? fashion.Description.trim()
      : '--';

    if (id === null || !bigIcon || !bigHeadIconFashion) {
      return null;
    }

    return {
      Id: id,
      Quality: quality,
      IsLock: Boolean(fashion?.IsLock),
      BigIcon: bigIcon,
      BigHeadIconFashion: bigHeadIconFashion,
      Name: name,
      Description: description,
    };
  }).filter((fashion) => Boolean(fashion));
};

app.getCharacterDetailFashionTooltipText = (fashion) => {
  if (!fashion || typeof fashion !== 'object') {
    return '';
  }

  return JSON.stringify({
    type: 'fashion',
    name: typeof fashion.Name === 'string' && fashion.Name.trim() ? fashion.Name.trim() : '--',
    description: typeof fashion.Description === 'string' && fashion.Description.trim() ? fashion.Description.trim() : '--',
    quality: Number.isFinite(Number(fashion.Quality)) ? Math.max(0, Number(fashion.Quality)) : 0,
  });
};

app.normalizeCharacterSkillList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const skillId = Number.isFinite(Number(entry?.SkillId)) ? Number(entry.SkillId) : null;
    if (skillId === null) {
      return null;
    }

    const name = typeof entry?.Name === 'string' && entry.Name.trim()
      ? entry.Name.trim()
      : '--';

    return {
      SkillId: skillId,
      Name: name,
      Level: Number.isFinite(Number(entry?.Level)) ? Math.max(0, Number(entry.Level)) : 0,
      MaxLevel: Number.isFinite(Number(entry?.MaxLevel)) ? Math.max(0, Number(entry.MaxLevel)) : 0,
    };
  }).filter((entry) => Boolean(entry));
};

app.getCharacterSkillSectionType = (tableBody) => {
  if (tableBody === characterDetailSkillsBody) {
    return 'normal';
  }

  if (tableBody === characterDetailEnhanceSkillsBody) {
    return 'enhance';
  }

  return null;
};

app.renderCharacterSkillTableRows = (items, tableBody, sectionType = app.getCharacterSkillSectionType(tableBody)) => {
  if (!(tableBody instanceof HTMLElement)) {
    return;
  }

  const normalizedItems = app.normalizeCharacterSkillList(items);
  if (normalizedItems.length === 0) {
    tableBody.innerHTML = '';
    return;
  }

  const rows = [];
  for (let index = 0; index < normalizedItems.length; index += 2) {
    const left = normalizedItems[index] ?? null;
    const right = normalizedItems[index + 1] ?? null;
    const renderNameCell = (entry) => `<td>${entry ? app.escapeHtml(entry.Name) : '--'}</td>`;
    const renderLevelCell = (entry) => {
      if (!entry) {
        return '<td>--</td>';
      }

      const levelText = entry.MaxLevel > 0
        ? `${entry.Level} / ${entry.MaxLevel}`
        : String(entry.Level);
      return `<td class="character-detail-skill-level is-editable" tabindex="0" role="button" data-character-skill-edit="${app.escapeHtml(sectionType || '')}" data-character-skill-id="${entry.SkillId}" aria-label="${app.escapeHtml(app.translate('dashboard.characterDetailSkillEditTrigger'))}" title="${app.escapeHtml(app.translate('dashboard.characterDetailSkillEditTrigger'))}">${app.escapeHtml(levelText)}</td>`;
    };

    rows.push(`<tr>${renderNameCell(left)}${renderLevelCell(left)}${renderNameCell(right)}${renderLevelCell(right)}</tr>`);
  }

  tableBody.innerHTML = rows.join('');
};

app.getCharacterSkillEditState = () => {
  const modalState = state.characterSkillEditState;
  const item = state.currentCharacterDetailItem;
  const extraInfo = state.currentCharacterDetailExtraInfo;
  if (!modalState || !item || !extraInfo || typeof extraInfo !== 'object') {
    return null;
  }

  const sectionType = modalState.sectionType === 'enhance' ? 'enhance' : 'normal';
  const list = sectionType === 'enhance'
    ? app.normalizeCharacterSkillList(extraInfo?.EnhanceSkillList)
    : app.normalizeCharacterSkillList(extraInfo?.SkillsList);
  const skillId = Number.isFinite(Number(modalState.skillId)) ? Number(modalState.skillId) : null;
  const recordId = Number.isFinite(Number(item?._id ?? item?.record_id)) ? Number(item._id ?? item.record_id) : null;
  if (skillId === null || recordId === null) {
    return null;
  }

  const entry = list.find((skill) => skill.SkillId === skillId) ?? null;
  if (!entry || entry.MaxLevel <= 0) {
    return null;
  }

  return {
    recordId,
    sectionType,
    skillId,
    name: entry.Name,
    level: Math.max(0, entry.Level),
    maxLevel: Math.max(0, entry.MaxLevel),
  };
};

app.populateCharacterSkillEditModal = () => {
  const editState = app.getCharacterSkillEditState();
  if (!editState || !(characterSkillEditLevelInput instanceof HTMLInputElement)) {
    return false;
  }

  if (characterSkillEditTitle instanceof HTMLElement) {
    const titleKey = editState.sectionType === 'enhance'
      ? 'dashboard.characterDetailEnhanceSkillEditTitle'
      : 'dashboard.characterDetailSkillEditTitle';
    const titleSeparator = String(state.locale || '').startsWith('zh') ? '：' : ': ';
    characterSkillEditTitle.textContent = `${app.translate(titleKey)}${titleSeparator}${editState.name || '--'}`;
  }

  characterSkillEditLevelInput.min = '0';
  characterSkillEditLevelInput.max = String(editState.maxLevel);
  characterSkillEditLevelInput.value = String(editState.level);
  characterSkillEditLevelInput.disabled = state.characterSkillEditPending;

  if (characterSkillEditConfirmButton instanceof HTMLButtonElement) {
    characterSkillEditConfirmButton.disabled = state.characterSkillEditPending;
    characterSkillEditConfirmButton.textContent = state.characterSkillEditPending
      ? app.translate('common.loading')
      : app.translate('common.confirm');
  }

  return true;
};

app.closeCharacterSkillEditModal = () => {
  if (!(characterSkillEditModal instanceof HTMLElement) || characterSkillEditModal.hidden) {
    return;
  }

  characterSkillEditModal.hidden = true;
  state.characterSkillEditPending = false;
  state.characterSkillEditState = null;

  if (state.lastCharacterSkillEditTrigger instanceof HTMLElement) {
    state.lastCharacterSkillEditTrigger.focus();
    state.lastCharacterSkillEditTrigger = null;
  }

  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
};

app.openCharacterSkillEditModal = (sectionType, skillId, trigger = null) => {
  if (!(characterSkillEditModal instanceof HTMLElement)) {
    return;
  }

  state.characterSkillEditState = {
    sectionType: sectionType === 'enhance' ? 'enhance' : 'normal',
    skillId,
  };

  if (!app.populateCharacterSkillEditModal()) {
    state.characterSkillEditState = null;
    return;
  }

  state.lastCharacterSkillEditTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  characterSkillEditModal.hidden = false;
  app.setBodyModalOpen(true);

  if (characterSkillEditLevelInput instanceof HTMLInputElement) {
    characterSkillEditLevelInput.focus();
    characterSkillEditLevelInput.select();
  } else if (characterSkillEditCard instanceof HTMLElement) {
    characterSkillEditCard.focus();
  }
};

app.updateCharacterSkillLevel = async () => {
  const editState = app.getCharacterSkillEditState();
  if (!editState || !(characterSkillEditLevelInput instanceof HTMLInputElement)) {
    return;
  }

  const level = Number.parseInt(characterSkillEditLevelInput.value, 10);
  if (!Number.isFinite(level) || level < 0 || level > editState.maxLevel) {
    app.openNoticeModal(app.translate('runtime.characterSkillUpdateInvalid'));
    return;
  }

  state.characterSkillEditPending = true;
  app.populateCharacterSkillEditModal();

  try {
    const endpoint = editState.sectionType === 'enhance' ? 'enhance-skill' : 'skill';
    const payload = await app.apiFetch(`/api/database-characters/selected/${editState.recordId}/${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        SkillId: editState.skillId,
        Level: level,
      }),
    });

    const updatedLevel = Number.isFinite(Number(payload?.Level)) ? Math.max(0, Number(payload.Level)) : level;
    const listKey = editState.sectionType === 'enhance' ? 'EnhanceSkillList' : 'SkillsList';
    if (state.currentCharacterDetailExtraInfo && typeof state.currentCharacterDetailExtraInfo === 'object') {
      const currentList = app.normalizeCharacterSkillList(state.currentCharacterDetailExtraInfo[listKey]);
      state.currentCharacterDetailExtraInfo = {
        ...state.currentCharacterDetailExtraInfo,
        [listKey]: currentList.map((entry) => (
          entry.SkillId === editState.skillId
            ? { ...entry, Level: updatedLevel }
            : entry
        )),
      };
    }

    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }

    app.closeCharacterSkillEditModal();
    app.openSuccessModal(app.translate('runtime.characterSkillUpdateSuccess'), app.translate('runtime.characterSkillUpdateSuccessTitle'));
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterSkillUpdateFailed'));
  } finally {
    state.characterSkillEditPending = false;
    if (characterSkillEditModal instanceof HTMLElement && !characterSkillEditModal.hidden) {
      app.populateCharacterSkillEditModal();
    }
  }
};

app.handleCharacterSkillEditActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const trigger = target.closest('[data-character-skill-edit]');
  if (!(trigger instanceof HTMLElement)) {
    return;
  }

  if (event.type === 'keydown' && event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  if (event.type === 'keydown') {
    event.preventDefault();
  }

  const sectionType = trigger.dataset.characterSkillEdit;
  const skillId = Number.parseInt(trigger.dataset.characterSkillId ?? '', 10);
  if (!Number.isFinite(skillId)) {
    return;
  }

  app.openCharacterSkillEditModal(sectionType, skillId, trigger);
};

app.renderCharacterFashionSlots = (fashions) => {
  if (!(characterDetailFashions instanceof HTMLElement)) {
    return;
  }

  const currentFashionId = Number.isFinite(Number(state.currentCharacterDetailExtraInfo?.CurrentFahionId))
    ? Number(state.currentCharacterDetailExtraInfo.CurrentFahionId)
    : null;
  const isPending = state.characterFashionSwitchPending;

  characterDetailFashions.innerHTML = Array.isArray(fashions) ? fashions.map((fashion, index) => {
    const qualityEffectClass = !fashion.IsLock ? app.getFashionQualityEffectClass(fashion.Quality) : '';
    const lockClass = fashion.IsLock ? ' is-locked' : '';
    const isSelected = currentFashionId !== null && fashion.Id === currentFashionId;
    const selectedClass = isSelected ? ' is-selected' : '';
    const pendingClass = isPending ? ' is-pending' : '';
    const tooltipText = app.escapeHtml(app.getCharacterDetailFashionTooltipText(fashion));
    const className = [
      'character-detail-slot',
      'character-detail-slot-small',
      'character-detail-fashion-slot',
      lockClass.trim(),
      selectedClass,
      pendingClass,
      qualityEffectClass,
    ].filter(Boolean).join(' ');
    const fashionName = typeof fashion.Name === 'string' && fashion.Name.trim() ? fashion.Name.trim() : '--';
    const actionText = fashion.IsLock
      ? app.translate('dashboard.characterDetailFashionUnlockAndSwitchAction', { name: fashionName })
      : app.translate('dashboard.characterDetailFashionSwitchAction', { name: fashionName });

    return `
      <div class="${className}" data-fashion-index="${index}" data-fashion-id="${fashion.Id}" data-character-detail-equip-slot data-equip-tooltip-text="${tooltipText}" role="button" tabindex="0" aria-label="${app.escapeHtml(actionText)}" aria-pressed="${currentFashionId !== null && fashion.Id === currentFashionId ? 'true' : 'false'}" aria-busy="${isPending ? 'true' : 'false'}" aria-disabled="${isPending ? 'true' : 'false'}">
        <div class="character-detail-fashion-slot-image"></div>
        ${isSelected ? `<span class="character-detail-fashion-slot-selected-label">${app.escapeHtml(app.translate('dashboard.characterDetailFashionSelected'))}</span>` : ''}
        ${fashion.IsLock ? '<span class="character-detail-fashion-slot-lock" aria-hidden="true">🔒</span>' : ''}
      </div>
    `;
  }).join('') : '';

  if (!Array.isArray(fashions) || fashions.length === 0) {
    return;
  }

  Array.from(characterDetailFashions.querySelectorAll('.character-detail-fashion-slot')).forEach((slot) => {
    if (!(slot instanceof HTMLElement)) {
      return;
    }
    const index = Number.parseInt(slot.dataset.fashionIndex ?? '', 10);
    const fashion = Number.isInteger(index) ? fashions[index] : null;
    const image = slot.querySelector('.character-detail-fashion-slot-image');
    if (!fashion || !(image instanceof HTMLElement)) {
      return;
    }
    image.style.backgroundImage = `url(".${fashion.BigIcon}")`;
  });
};

app.switchCharacterFashion = async (fashionIndex) => {
  if (state.characterFashionSwitchPending) {
    return;
  }

  const item = state.currentCharacterDetailItem;
  const extraInfo = state.currentCharacterDetailExtraInfo;
  const recordId = Number.isFinite(Number(item?._id ?? item?.record_id)) ? Number(item._id ?? item.record_id) : null;
  const fashions = Array.isArray(extraInfo?.Fashions) ? extraInfo.Fashions : [];
  const targetFashion = Number.isInteger(fashionIndex) ? fashions[fashionIndex] : null;
  const currentFashionId = Number.isFinite(Number(extraInfo?.CurrentFahionId)) ? Number(extraInfo.CurrentFahionId) : null;
  if (recordId === null || !targetFashion || (targetFashion.Id === currentFashionId && targetFashion.IsLock === false)) {
    return;
  }

  state.characterFashionSwitchPending = true;
  if (state.currentCharacterDetailItem) {
    app.populateCharacterDetailCard(state.currentCharacterDetailItem);
  }

  try {
    const payload = await app.apiFetch(`/api/database-characters/selected/${recordId}/fashion`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        FashionId: targetFashion.Id,
      }),
    });

    if (state.currentCharacterDetailExtraInfo && typeof state.currentCharacterDetailExtraInfo === 'object') {
      state.currentCharacterDetailExtraInfo = {
        ...state.currentCharacterDetailExtraInfo,
        CurrentFahionId: Number.isFinite(Number(payload?.CurrentFahionId))
          ? Number(payload.CurrentFahionId)
          : targetFashion.Id,
        Fashions: fashions.map((fashion) => {
          if (!fashion || typeof fashion !== 'object') {
            return fashion;
          }

          return fashion.Id === targetFashion.Id
            ? { ...fashion, IsLock: false }
            : fashion;
        }),
      };
    }

    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }

    app.openSuccessModal(
      app.translate('runtime.characterFashionUpdateSuccess', {
        name: typeof targetFashion.Name === 'string' && targetFashion.Name.trim() ? targetFashion.Name.trim() : '--',
      }),
      app.translate('runtime.characterFashionUpdateSuccessTitle'),
    );
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterFashionUpdateFailed'));
  } finally {
    state.characterFashionSwitchPending = false;
    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }
  }
};

app.handleCharacterFashionSlotActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !(characterDetailFashions instanceof HTMLElement)) {
    return;
  }

  const slot = target.closest('.character-detail-fashion-slot');
  if (!(slot instanceof HTMLElement) || !characterDetailFashions.contains(slot)) {
    return;
  }

  if (state.characterFashionSwitchPending || slot.getAttribute('aria-disabled') === 'true') {
    if (event.type === 'keydown') {
      event.preventDefault();
    }
    return;
  }

  if (event.type === 'keydown') {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
  }

  const index = Number.parseInt(slot.dataset.fashionIndex ?? '', 10);
  if (!Number.isInteger(index)) {
    return;
  }

  void app.switchCharacterFashion(index);
};

app.normalizeCharacterDetailEquip = (equip) => {
  const recordId = Number.isFinite(Number(equip?._id ?? equip?.record_id)) ? Number(equip._id ?? equip.record_id) : null;
  const templateId = Number.isFinite(Number(equip?.TemplateId)) ? Number(equip.TemplateId) : null;
  if (recordId === null || templateId === null) {
    return null;
  }

  return {
    _id: recordId,
    TemplateId: templateId,
    Breakthrough: Number.isFinite(Number(equip?.Breakthrough)) ? Math.max(0, Number(equip.Breakthrough)) : 0,
    Level: Number.isFinite(Number(equip?.Level)) ? Math.max(0, Number(equip.Level)) : null,
    Description: typeof equip?.Description === 'string' ? equip.Description.trim() : '',
    resonance_info: Array.isArray(equip?.resonance_info) ? equip.resonance_info : [],
    weapon_overrun_data: Object.prototype.hasOwnProperty.call(equip || {}, 'weapon_overrun_data')
      ? (equip.weapon_overrun_data && typeof equip.weapon_overrun_data === 'object' ? equip.weapon_overrun_data : null)
      : undefined,
  };
};

app.getCharacterDetailEquipIconClass = (templateId) => {
  const star = app.getWeaponStarByTemplateId(templateId);
  return Number.isFinite(star) && star >= 4 ? `weapon-icon-tier-${star}` : '';
};

app.getCharacterDetailMemorySlotCount = () => {
  const count = Number.isFinite(Number(state.equippableMemoryNums)) ? Math.max(0, Number(state.equippableMemoryNums)) : 0;
  if (count === 8) {
    return 8;
  }
  return 6;
};

app.getCharacterDetailMemoryColumnCount = () => {
  return app.getCharacterDetailMemorySlotCount() === 8 ? 4 : 3;
};

app.getCharacterDetailEquipTooltipText = (equip, isMemoryOverride = null) => {
  const normalizedEquip = app.normalizeCharacterDetailEquip(equip);
  if (!normalizedEquip) {
    return '';
  }

  const name = app.getWeaponNameByTemplateId(normalizedEquip.TemplateId);
  const star = app.getWeaponStarByTemplateId(normalizedEquip.TemplateId);
  const breakthrough = Number.isFinite(Number(normalizedEquip.Breakthrough)) ? Number(normalizedEquip.Breakthrough) : 0;
  const level = Number.isFinite(Number(normalizedEquip.Level)) ? Number(normalizedEquip.Level) : null;
  const supportsWeaponOverrun = Object.prototype.hasOwnProperty.call(equip || {}, 'weapon_overrun_data');
  const isMemory = typeof isMemoryOverride === 'boolean' ? isMemoryOverride : !supportsWeaponOverrun;
  const supportsResonance = app.hasWeaponResonanceConfig(normalizedEquip.TemplateId);

  return JSON.stringify({
    name,
    star: Number.isFinite(star) ? Math.max(0, Number(star)) : 0,
    breakthrough,
    level,
    description: normalizedEquip.Description || '--',
    resonanceInfo: Array.isArray(normalizedEquip.resonance_info) ? normalizedEquip.resonance_info : [],
    supportsResonance,
    weaponOverrunData: normalizedEquip.weapon_overrun_data && typeof normalizedEquip.weapon_overrun_data === 'object'
      ? normalizedEquip.weapon_overrun_data
      : null,
    supportsWeaponOverrun,
    isMemory,
  });
};

app.getCharacterDetailEquipTooltipLines = (payload) => {
  const lines = [];
  if (payload?.type === 'fashion') {
    const quality = Number.isFinite(Number(payload?.quality)) ? Math.max(0, Number(payload.quality)) : 0;
    const starDisplay = quality > 0 ? '★'.repeat(quality) : '--';
    const starClass = quality > 0 ? `fashion-star-tier-${Math.min(quality, 6)}` : 'character-detail-equip-tooltip-value-muted';

    lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(String(payload?.name || '--'))}</div>`);
    lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(app.translate('dashboard.characterDetailTooltipStar'))} <span class="character-detail-equip-tooltip-value character-detail-equip-tooltip-star ${starClass}">${app.escapeHtml(starDisplay)}</span></div>`);
    lines.push('<div class="character-detail-equip-tooltip-spacer" aria-hidden="true"></div>');
    lines.push(`<div class="character-detail-equip-tooltip-description">${app.escapeHtml(String(payload?.description || '--'))}</div>`);
    return lines;
  }

  const star = Number.isFinite(Number(payload?.star)) ? Math.max(0, Number(payload.star)) : 0;
  const breakthrough = Number.isFinite(Number(payload?.breakthrough)) ? Math.max(0, Number(payload.breakthrough)) : 0;
  const level = Number.isFinite(Number(payload?.level)) ? Math.max(0, Number(payload.level)) : null;
  const starClass = `weapon-star-tier-${Math.max(1, star)}`;
  const breakthroughClass = `weapon-detail-bt-tier-${Math.min(Math.max(breakthrough, 0), 4)}`;
  const starDisplay = '★'.repeat(Math.max(1, star || 1));
  const resonanceInfo = Array.isArray(payload?.resonanceInfo) ? payload.resonanceInfo : [];
  const isMemory = Boolean(payload?.isMemory);
  const supportsResonance = Boolean(payload?.supportsResonance);
  const supportsWeaponOverrun = Boolean(payload?.supportsWeaponOverrun);
  const resonanceSlots = isMemory ? [1, 2] : [1, 2, 3];

  lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(String(payload?.name || '--'))}</div>`);
  lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(app.translate('dashboard.characterDetailTooltipStar'))} <span class="character-detail-equip-tooltip-value character-detail-equip-tooltip-star ${star <= 1 ? 'character-detail-equip-tooltip-value-muted' : starClass}">${starDisplay}</span></div>`);
  lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(app.translate('dashboard.characterDetailTooltipBreakthrough'))} <span class="character-detail-equip-tooltip-value ${breakthrough <= 0 ? 'character-detail-equip-tooltip-value-muted' : breakthroughClass}">${breakthrough}</span></div>`);
  lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(app.translate('dashboard.characterDetailTooltipLevel'))} <span class="character-detail-equip-tooltip-value">${level ?? '--'}</span></div>`);

  if (supportsResonance) {
    resonanceSlots.forEach((slot) => {
      const entry = resonanceInfo.find((item) => Number(item?.slot) === slot) ?? null;
      const effectInfo = entry ? app.resolveResonanceEffectInfo(entry) : null;
      const effectName = effectInfo?.Name ? effectInfo.Name : '--';
      const slotLabel = app.getResonanceSlotLabel(slot, isMemory);
      lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(app.translate('dashboard.characterDetailTooltipResonanceSlot', { slot: slotLabel }))} <span class="character-detail-equip-tooltip-value">${app.escapeHtml(effectName)}</span></div>`);
    });
  }

  if (!isMemory && supportsWeaponOverrun) {
    const overrunSelection = app.getWeaponOverrunSelection({ weapon_overrun_data: payload.weaponOverrunData });
    const harmonyText = overrunSelection?.suitEntry?.Name
      ? `${String(overrunSelection.suitEntry.Name).trim()} (Lv. ${Number.isFinite(Number(overrunSelection.level)) ? Number(overrunSelection.level) : 0})`
      : app.translate('dashboard.weaponDetailOverrunInactive');
    lines.push(`<div class="character-detail-equip-tooltip-line">${app.escapeHtml(app.translate('dashboard.characterDetailTooltipHarmony'))} <span class="character-detail-equip-tooltip-value">${app.escapeHtml(harmonyText)}</span></div>`);
  }

  lines.push('<div class="character-detail-equip-tooltip-spacer" aria-hidden="true"></div>');
  lines.push(`<div class="character-detail-equip-tooltip-description">${app.escapeHtml(String(payload?.description || '--'))}</div>`);

  return lines;
};

app.renderCharacterDetailEquipSlot = (equip, sizeClass, site = null, isMemory = null) => {
  const normalizedEquip = app.normalizeCharacterDetailEquip(equip);
  if (!normalizedEquip) {
    return `<div class="character-detail-slot ${sizeClass} is-empty"></div>`;
  }

  const iconUrl = app.getWeaponIconByTemplateId(normalizedEquip.TemplateId);
  const equipName = app.getWeaponNameByTemplateId(normalizedEquip.TemplateId);
  const iconClass = app.getCharacterDetailEquipIconClass(normalizedEquip.TemplateId);
  const tooltipText = app.escapeHtml(app.getCharacterDetailEquipTooltipText(equip, isMemory));
  const siteAttr = Number.isFinite(Number(site)) ? ` data-memory-site="${Number(site)}"` : '';

  return `
    <div class="character-detail-slot ${sizeClass} character-detail-equip-slot${iconClass ? ` ${iconClass}` : ''}" data-character-detail-equip-slot data-equip-tooltip-text="${tooltipText}"${siteAttr}>
      ${iconUrl
        ? `<img class="character-detail-equip-icon" src=".${iconUrl}" alt="${app.escapeHtml(equipName)}">`
        : '<span class="character-detail-equip-icon character-detail-equip-icon-fallback" aria-hidden="true"></span>'}
    </div>
  `;
};

app.renderCharacterDetailWeaponSlot = (weapon) => {
  if (!(characterDetailWeapon instanceof HTMLElement)) {
    return;
  }

  characterDetailWeapon.innerHTML = app.renderCharacterDetailEquipSlot(weapon, 'character-detail-slot-medium', null, false);
};

app.renderCharacterDetailMemorySlots = (memories) => {
  if (!(characterDetailMemories instanceof HTMLElement)) {
    return;
  }

  const slotCount = app.getCharacterDetailMemorySlotCount();
  const columnCount = app.getCharacterDetailMemoryColumnCount();
  const siteToMemoryMap = new Map();
  (Array.isArray(memories) ? memories : []).forEach((memory) => {
    const normalizedMemory = app.normalizeCharacterDetailEquip(memory);
    if (!normalizedMemory) {
      return;
    }
    const site = Number.parseInt(app.getMemoryPositionByTemplateId(normalizedMemory.TemplateId), 10);
    if (!Number.isFinite(site) || site < 1 || site > slotCount || siteToMemoryMap.has(site)) {
      return;
    }
    siteToMemoryMap.set(site, memory);
  });

  characterDetailMemories.style.gridTemplateColumns = `repeat(${columnCount}, minmax(96px, 1fr))`;
  characterDetailMemories.innerHTML = Array.from({ length: slotCount }, (_, index) => {
    const site = index + 1;
    return app.renderCharacterDetailEquipSlot(siteToMemoryMap.get(site) ?? null, 'character-detail-slot-small', site, true);
  }).join('');
};

app.hideCharacterDetailEquipTooltip = () => {
  if (state.characterDetailEquipTooltipTimer) {
    window.clearTimeout(state.characterDetailEquipTooltipTimer);
    state.characterDetailEquipTooltipTimer = null;
  }

  if (characterDetailEquipTooltip instanceof HTMLElement) {
    if (characterDetailEquipTooltip.parentElement !== document.body) {
      document.body.appendChild(characterDetailEquipTooltip);
    }
    characterDetailEquipTooltip.hidden = true;
    characterDetailEquipTooltip.innerHTML = '';
  }

  state.characterDetailEquipTooltipTarget = null;
};

app.positionCharacterDetailEquipTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(characterDetailEquipTooltip instanceof HTMLElement)) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = characterDetailEquipTooltip.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const margin = 12;
  const gap = 10;
  let left = targetRect.right + gap;
  let top = targetRect.top + ((targetRect.height - tooltipRect.height) / 2);

  if (left + tooltipRect.width > viewportWidth - margin) {
    left = targetRect.left - tooltipRect.width - gap;
  }
  if (left < margin) {
    left = Math.max(margin, Math.min(targetRect.left, viewportWidth - tooltipRect.width - margin));
  }
  if (top < margin) {
    top = margin;
  } else if (top + tooltipRect.height > viewportHeight - margin) {
    top = viewportHeight - tooltipRect.height - margin;
  }

  characterDetailEquipTooltip.style.left = `${Math.round(left)}px`;
  characterDetailEquipTooltip.style.top = `${Math.round(top)}px`;
};

app.syncCharacterDetailEquipTooltipPosition = () => {
  if (!(state.characterDetailEquipTooltipTarget instanceof HTMLElement) || !(characterDetailEquipTooltip instanceof HTMLElement) || characterDetailEquipTooltip.hidden) {
    return;
  }

  app.positionCharacterDetailEquipTooltip(state.characterDetailEquipTooltipTarget);
};

app.showCharacterDetailEquipTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(characterDetailEquipTooltip instanceof HTMLElement)) {
    return;
  }

  const rawTooltipText = typeof target.dataset.equipTooltipText === 'string' ? target.dataset.equipTooltipText.trim() : '';
  if (!rawTooltipText) {
    app.hideCharacterDetailEquipTooltip();
    return;
  }

  let payload = null;
  try {
    payload = JSON.parse(rawTooltipText);
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object') {
    app.hideCharacterDetailEquipTooltip();
    return;
  }

  const tooltipLines = app.getCharacterDetailEquipTooltipLines(payload);

  if (characterDetailEquipTooltip.parentElement !== document.body) {
    document.body.appendChild(characterDetailEquipTooltip);
  }

  characterDetailEquipTooltip.innerHTML = tooltipLines.join('');
  characterDetailEquipTooltip.hidden = false;
  characterDetailEquipTooltip.style.left = '0px';
  characterDetailEquipTooltip.style.top = '0px';
  state.characterDetailEquipTooltipTarget = target;
  window.requestAnimationFrame(app.syncCharacterDetailEquipTooltipPosition);
};

app.scheduleCharacterDetailEquipTooltip = (target) => {
  app.hideCharacterDetailEquipTooltip();
  if (!(target instanceof HTMLElement)) {
    return;
  }

  state.characterDetailEquipTooltipTimer = window.setTimeout(() => {
    state.characterDetailEquipTooltipTimer = null;
    app.showCharacterDetailEquipTooltip(target);
  }, CHARACTER_DETAIL_EQUIP_TOOLTIP_DELAY_MS);
};

app.handleCharacterDetailEquipTooltipEvent = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const tooltipTarget = target.closest('[data-character-detail-equip-slot]');
  if (event.type === 'mouseover' || event.type === 'focusin') {
    if (tooltipTarget instanceof HTMLElement) {
      app.scheduleCharacterDetailEquipTooltip(tooltipTarget);
    }
    return;
  }

  if (event.type === 'mousemove') {
    if (tooltipTarget instanceof HTMLElement && state.characterDetailEquipTooltipTarget === tooltipTarget && characterDetailEquipTooltip instanceof HTMLElement && !characterDetailEquipTooltip.hidden) {
      app.syncCharacterDetailEquipTooltipPosition();
    }
    return;
  }

  if (event.type === 'mouseout' || event.type === 'focusout') {
    if (!(tooltipTarget instanceof HTMLElement)) {
      app.hideCharacterDetailEquipTooltip();
      return;
    }
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && tooltipTarget.contains(relatedTarget)) {
      return;
    }
    app.hideCharacterDetailEquipTooltip();
  }
};

app.getCharacterDetailExtraInfo = async (recordId) => {
  const payload = await app.apiFetch(`/api/database-characters/selected/${recordId}/extra-info`);
  return payload && typeof payload === 'object' ? payload : {};
};

app.getCharacterDetailGradeTier = (grade) => {
  const normalizedGrade = Number.isFinite(Number(grade)) ? Math.max(0, Number(grade)) : 0;
  if (normalizedGrade >= 14) return 5;
  if (normalizedGrade >= 10) return 4;
  if (normalizedGrade >= 7) return 3;
  if (normalizedGrade >= 4) return 2;
  if (normalizedGrade >= 2) return 1;
  return 0;
};

app.getCharacterAwakenDisplay = (awakenLevel) => {
  const normalizedAwakenLevel = Number.isFinite(Number(awakenLevel)) ? Math.max(0, Number(awakenLevel)) : 0;
  const awakenKeyMap = {
    0: 'dashboard.characterAwakenLevel1',
    1: 'dashboard.characterAwakenLevel1',
    2: 'dashboard.characterAwakenLevel2',
    3: 'dashboard.characterAwakenLevel3',
    4: 'dashboard.characterAwakenLevel4',
    5: 'dashboard.characterAwakenLevel5',
  };
  const awakenKey = awakenKeyMap[Math.min(normalizedAwakenLevel, 5)];
  return awakenKey ? app.translate(awakenKey) : app.translate('common.notAvailable');
};

app.getCharacterTrustSymbol = (trustLv) => {
  const normalizedTrustLv = Number.isFinite(Number(trustLv)) ? Math.max(0, Number(trustLv)) : 0;
  if (normalizedTrustLv <= 0) {
    return '';
  }
  if (normalizedTrustLv <= 2) {
    return '🖤';
  }
  if (normalizedTrustLv <= 4) {
    return '💛';
  }
  if (normalizedTrustLv === 5) {
    return '🧡';
  }
  if (normalizedTrustLv === 6) {
    return '❤️';
  }
  if (normalizedTrustLv === 7) {
    return '💓';
  }
  if (normalizedTrustLv === 8) {
    return '💗';
  }
  return '';
};

app.getCharacterTrustDisplay = (trustLv) => {
  const normalizedTrustLv = Number.isFinite(Number(trustLv)) ? Math.max(0, Math.floor(Number(trustLv))) : 0;
  const symbol = app.getCharacterTrustSymbol(normalizedTrustLv);
  if (!symbol || normalizedTrustLv <= 0) {
    return '--';
  }
  return Array.from({ length: normalizedTrustLv }, () => symbol).join(' ');
};

app.getMaxNumericMapKey = (source) => {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const numericKeys = Object.keys(source)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value));

  if (numericKeys.length === 0) {
    return null;
  }

  return Math.max(...numericKeys);
};

app.renderCompositeStatValue = ({
  currentValue,
  maxValue,
  currentClass = '',
  maxClass = '',
}) => {
  const currentText = currentValue === null || currentValue === undefined ? '--' : String(currentValue);
  const maxText = maxValue === null || maxValue === undefined ? '--' : String(maxValue);

  return `
    <span class="detail-stat-composite">
      <span class="detail-stat-current${currentClass ? ` ${currentClass}` : ''}">${app.escapeHtml(currentText)}</span>
      <span class="detail-stat-separator"> / </span>
      <span class="detail-stat-max${maxClass ? ` ${maxClass}` : ''}">${app.escapeHtml(maxText)}</span>
    </span>
  `;
};

app.setCharacterManagementState = (message, tone = '') => {
  if (databaseCharacterManagementState instanceof HTMLElement) {
    databaseCharacterManagementState.textContent = message;
    databaseCharacterManagementState.className = 'database-player-empty';
    if (tone) {
      databaseCharacterManagementState.classList.add(tone);
    }
    databaseCharacterManagementState.hidden = false;
  }

  if (databaseCharacterManagementShell instanceof HTMLElement) {
    databaseCharacterManagementShell.hidden = true;
  }
};

app.showCharacterManagementTable = () => {
  if (databaseCharacterManagementState instanceof HTMLElement) {
    databaseCharacterManagementState.hidden = true;
  }

  if (databaseCharacterManagementShell instanceof HTMLElement) {
    databaseCharacterManagementShell.hidden = false;
  }

  if (databaseCharacterManagementTableShell instanceof HTMLElement) {
    databaseCharacterManagementTableShell.hidden = false;
  }

  if (databaseCharacterManagementActions instanceof HTMLElement) {
    databaseCharacterManagementActions.hidden = false;
  }
};

app.updateCharacterManagementPagination = () => {
  if (databaseCharacterManagementPaginationLabel instanceof HTMLElement) {
    databaseCharacterManagementPaginationLabel.textContent = app.translate('dashboard.accountsPagination', {
      page: state.characterManagementTotalPages === 0 ? 0 : state.characterManagementCurrentPage,
      totalPages: state.characterManagementTotalPages,
    });
  }

  if (databaseCharacterManagementPrevButton instanceof HTMLButtonElement) {
    databaseCharacterManagementPrevButton.disabled = state.characterManagementLoading || state.characterManagementCurrentPage <= 1 || state.characterManagementTotalPages === 0 || !app.canAccessCharacterManagement();
  }

  if (databaseCharacterManagementNextButton instanceof HTMLButtonElement) {
    databaseCharacterManagementNextButton.disabled = state.characterManagementLoading || state.characterManagementTotalPages === 0 || state.characterManagementCurrentPage >= state.characterManagementTotalPages || !app.canAccessCharacterManagement();
  }

  const jumpDisabled = state.characterManagementLoading || state.characterManagementTotalPages === 0 || !app.canAccessCharacterManagement();

  if (databaseCharacterManagementJumpInput instanceof HTMLInputElement) {
    databaseCharacterManagementJumpInput.disabled = jumpDisabled;
  }

  if (databaseCharacterManagementJumpButton instanceof HTMLButtonElement) {
    databaseCharacterManagementJumpButton.disabled = jumpDisabled;
  }
};

app.submitCharacterManagementPageJump = () => {
  if (!(databaseCharacterManagementJumpInput instanceof HTMLInputElement)) {
    return;
  }

  const targetPage = app.normalizePaginationTargetPage(databaseCharacterManagementJumpInput.value, state.characterManagementTotalPages);
  databaseCharacterManagementJumpInput.value = '';

  if (targetPage === null || targetPage === state.characterManagementCurrentPage) {
    return;
  }

  void app.loadSelectedAccountCharacters(targetPage);
};

app.renderCharacterRows = (items) => {
  if (!(databaseCharacterManagementBody instanceof HTMLElement)) {
    return;
  }

  databaseCharacterManagementBody.innerHTML = Array.isArray(items) ? items.map((item) => {
    const characterId = item?.CharacterId ?? null;
    const characterName = app.getCharacterNameByCharacterId(characterId);
    const characterIconUrl = app.getCharacterIconByCharacterId(characterId);
    const recordId = Number.isFinite(Number(item?._id)) ? Number(item._id) : null;
    const quality = Number.isFinite(Number(item?.Quality)) ? Number(item.Quality) : 0;
    const star = Number.isFinite(Number(item?.Star)) ? Number(item.Star) : 0;
    const level = Number.isFinite(Number(item?.Level)) ? Number(item.Level) : null;
    const grade = Number.isFinite(Number(item?.Grade)) ? Number(item.Grade) : 0;
    const awakenLevel = Number.isFinite(Number(item?.AwakenLevel)) ? Number(item.AwakenLevel) : 0;
    const sequence = Number.isFinite(Number(item?.Sequence)) ? Number(item.Sequence) : null;
    const gradeName = typeof item?.GradeName === 'string' && item.GradeName.trim() ? item.GradeName.trim() : '--';
    const iconExtraClass = app.getCharacterIconEffectClass(quality);
    const isSupport = sequence === 1;
    const supportDisabled = state.characterManagementActionPendingRecordId === recordId
      || isSupport
      || recordId === null;

    return `
      <tr>
        <td>${sequence ?? '--'}</td>
        <td>${app.renderWeaponMediaCell(characterIconUrl, characterName, true, iconExtraClass)}</td>
        <td><span class="character-quality ${app.getCharacterQualityClass(quality)}">${app.escapeHtml(app.getCharacterQualityDisplayLabel(quality, star))}</span></td>
        <td>${level ?? '--'}</td>
        <td><span class="character-grade ${app.getCharacterGradeClass(grade)}">${app.escapeHtml(gradeName)}</span></td>
        <td><span class="character-awaken ${app.getCharacterAwakenClass(awakenLevel)}">${app.getCharacterAwakenDisplay(awakenLevel)}</span></td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button status-action-button-config" type="button" ${supportDisabled ? 'disabled' : ''} data-character-management-action="preferred" data-character-record-id="${recordId ?? ''}" data-character-sequence="${sequence ?? ''}" data-character-name="${app.escapeHtml(characterName)}">${app.translate('dashboard.characterManagementSetPreferred')}</button>
            <button class="status-action-button status-action-button-log" type="button" data-character-management-action="detail" data-character-record-id="${recordId ?? ''}">${app.translate('dashboard.characterManagementDetail')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') : '';
};

app._characterManagementSortFields = ['sequence', 'name', 'quality', 'level', 'grade', 'awaken_level'];

app._syncCharacterManagementSortArrows = () => {
  const table = document.querySelector('#database-character-management-section .character-management-table');
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.characterManagementSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.characterManagementSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleCharacterManagementSortClick = (sortField) => {
  if (!app._characterManagementSortFields.includes(sortField)) return;
  if (state.characterManagementSortBy === sortField) {
    state.characterManagementSortOrder = state.characterManagementSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.characterManagementSortBy = sortField;
    state.characterManagementSortOrder = 'asc';
  }
  app._syncCharacterManagementSortArrows();
};

app.resetCharacterManagementView = () => {
  state.characterManagementCurrentPage = 1;
  state.characterManagementTotalPages = 0;
  state.characterManagementHasLoaded = false;
  state.characterManagementLoading = false;
  state.characterManagementActionPendingRecordId = null;
  state.characterManagementItems = [];
  if (databaseCharacterManagementBody instanceof HTMLElement) {
    databaseCharacterManagementBody.innerHTML = '';
  }
  app.updateCharacterManagementPagination();
};

app.setCharacterSupport = async (recordId, characterName) => {
  if (!Number.isFinite(recordId) || state.characterManagementActionPendingRecordId !== null) {
    return;
  }

  state.characterManagementActionPendingRecordId = recordId;
  app.renderCharacterRows(state.characterManagementItems);

  try {
    await app.apiFetch(`/api/database-characters/selected/${recordId}/support`, {
      method: 'PUT',
    });
    app.openSuccessModal(
      app.translate('runtime.characterManagementSupportSetSuccess', { characterName }),
      app.translate('runtime.characterManagementSupportSetSuccessTitle'),
    );
    await app.loadSelectedAccountCharacters(1);
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterManagementSupportSetFailed'));
  } finally {
    state.characterManagementActionPendingRecordId = null;
    if (state.characterManagementHasLoaded && state.characterManagementItems.length > 0) {
      app.renderCharacterRows(state.characterManagementItems);
    }
  }
};

app.clearCharacterManagementKeyword = () => {
  state.characterManagementKeyword = '';
  if (databaseCharacterSearchInput instanceof HTMLInputElement) {
    databaseCharacterSearchInput.value = '';
  }
};

app.syncCharacterManagementKeywordInput = () => {
  if (databaseCharacterSearchInput instanceof HTMLInputElement) {
    databaseCharacterSearchInput.value = state.characterManagementKeyword;
  }
};

app.rerenderCharacterManagementLocale = () => {
  app._syncCharacterManagementSortArrows();
  app.syncCharacterManagementKeywordInput();

  if (app.canAccessCharacterManagement() && state.characterManagementHasLoaded) {
    void app.loadSelectedAccountCharacters(state.characterManagementCurrentPage);
  }
};

app.loadSelectedAccountCharacters = async (page = 1) => {
  if (!app.canAccessCharacterManagement() || state.characterManagementLoading) {
    app.updateCharacterManagementPagination();
    return;
  }

  state.characterManagementLoading = true;
  state.characterManagementCurrentPage = Math.max(1, page);
  app.updateCharacterManagementPagination();
  app.setCharacterManagementState(app.translate('dashboard.characterManagementLoading'), 'is-loading');

  try {
    const search = new URLSearchParams({
      page: String(state.characterManagementCurrentPage),
      page_size: '10',
    });
    if (state.characterManagementKeyword) {
      search.set('keyword', state.characterManagementKeyword);
    }
    search.set('sort_by', state.characterManagementSortBy);
    search.set('sort_order', state.characterManagementSortOrder);

    const payload = await app.apiFetch(`/api/database-characters/selected?${search.toString()}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.characterManagementItems = items;
    state.characterManagementCurrentPage = typeof payload?.page === 'number' ? payload.page : state.characterManagementCurrentPage;
    state.characterManagementTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    state.characterManagementHasLoaded = true;

    if (databaseCharacterManagementSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseCharacterManagementSummary.textContent = app.translate('dashboard.characterManagementSummaryTotal', { total });
      databaseCharacterManagementSummary.hidden = false;
    }

    if (items.length === 0) {
      if (databaseCharacterManagementBody instanceof HTMLElement) {
        databaseCharacterManagementBody.innerHTML = '';
      }
      app.setCharacterManagementState(app.translate('dashboard.characterManagementEmpty'), 'is-empty');
    } else {
      app.renderCharacterRows(items);
      app.showCharacterManagementTable();
    }
  } catch (error) {
    state.characterManagementTotalPages = 0;
    if (databaseCharacterManagementBody instanceof HTMLElement) {
      databaseCharacterManagementBody.innerHTML = '';
    }
    app.setCharacterManagementState(app.apiErrorMessage(error, 'runtime.characterManagementLoadFailed'), 'is-error');
  } finally {
    state.characterManagementLoading = false;
    app.updateCharacterManagementPagination();
  }
};

app.updateCharacterManagementAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);
  const accessible = app.canAccessCharacterManagement(payload);

  app.syncCharacterManagementKeywordInput();
  app._syncCharacterManagementSortArrows();

  if (databaseCharacterManagementSubnavButton instanceof HTMLButtonElement) {
    databaseCharacterManagementSubnavButton.disabled = !accessible;
    if (!healthy) {
      databaseCharacterManagementSubnavButton.title = app.translate('runtime.characterManagementAccessTitle');
    } else if (state.selectedAccountUid === null) {
      databaseCharacterManagementSubnavButton.title = app.translate('runtime.characterManagementNeedAccountTitle');
    } else {
      databaseCharacterManagementSubnavButton.title = '';
    }
  }

  if (databaseCharacterManagementSummary instanceof HTMLElement) {
    if (accessible && state.characterManagementHasLoaded) {
      databaseCharacterManagementSummary.hidden = false;
    } else if (accessible) {
      databaseCharacterManagementSummary.textContent = '';
      databaseCharacterManagementSummary.hidden = true;
    } else {
      databaseCharacterManagementSummary.textContent = !healthy
        ? app.translate('dashboard.characterManagementUnavailable')
        : app.translate('dashboard.characterManagementChooseAccount');
      databaseCharacterManagementSummary.hidden = false;
    }
  }

  if (!healthy) {
    app.resetCharacterManagementView();
    app.setCharacterManagementState(app.translate('dashboard.characterManagementUnavailable'), 'is-muted');
    if (app.isDatabaseCharacterManagementSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    return;
  }

  if (state.selectedAccountUid === null) {
    app.resetCharacterManagementView();
    app.setCharacterManagementState(app.translate('dashboard.characterManagementChooseAccount'), 'is-muted');
    if (app.isDatabaseCharacterManagementSectionActive()) {
      app.setActiveDatabaseTab('database-accounts-section');
    }
    return;
  }

  if (!state.characterManagementHasLoaded) {
    if (databaseCharacterManagementBody instanceof HTMLElement) {
      databaseCharacterManagementBody.innerHTML = '';
    }
    app.setCharacterManagementState(app.translate('dashboard.characterManagementReady'), 'is-muted');
    app.updateCharacterManagementPagination();
    return;
  }

  app.showCharacterManagementTable();
  app.updateCharacterManagementPagination();
};

app.handleCharacterManagementActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-character-management-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.disabled) {
    return;
  }

  const action = button.dataset.characterManagementAction;
  if (action === 'detail') {
    const recordId = Number.parseInt(button.dataset.characterRecordId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }

    app.openCharacterDetailModal(recordId, button);
    return;
  }

  if (action !== 'preferred') {
    return;
  }

  const recordId = Number.parseInt(button.dataset.characterRecordId ?? '', 10);
  const sequence = Number.parseInt(button.dataset.characterSequence ?? '', 10);
  if (!Number.isFinite(recordId) || sequence === 1) {
    return;
  }

  void app.setCharacterSupport(recordId, button.dataset.characterName ?? '--');
};

app.populateCharacterDetailCard = (item) => {
  const extraInfo = state.currentCharacterDetailExtraInfo && typeof state.currentCharacterDetailExtraInfo === 'object'
    ? state.currentCharacterDetailExtraInfo
    : {};
  const characterId = item?.CharacterId ?? null;
  const quality = Number.isFinite(Number(item?.Quality)) ? Number(item.Quality) : 0;
  const star = Number.isFinite(Number(item?.Star)) ? Math.max(0, Number(item.Star)) : 0;
  const grade = Number.isFinite(Number(item?.Grade)) ? Math.max(0, Number(item.Grade)) : 0;
  const awakenLevel = Number.isFinite(Number(item?.AwakenLevel)) ? Math.max(0, Number(item.AwakenLevel)) : 0;
  const level = Number.isFinite(Number(item?.Level)) ? Number(item.Level) : null;
  const trustLv = Number.isFinite(Number(extraInfo?.TrustLv)) ? Math.max(0, Number(extraInfo.TrustLv)) : null;
  const currentFahionId = Number.isFinite(Number(extraInfo?.CurrentFahionId)) ? Number(extraInfo.CurrentFahionId) : null;
  const fashions = app.normalizeCharacterFashions(extraInfo);
  const weapon = extraInfo?.Weapon && typeof extraInfo.Weapon === 'object' ? extraInfo.Weapon : null;
  const memories = Array.isArray(extraInfo?.Memories) ? extraInfo.Memories : [];
  const skills = Array.isArray(extraInfo?.SkillsList) ? extraInfo.SkillsList : [];
  const enhanceSkills = Array.isArray(extraInfo?.EnhanceSkillList) ? extraInfo.EnhanceSkillList : [];
  const currentFashion = currentFahionId === null
    ? null
    : fashions.find((fashion) => fashion.Id === currentFahionId) ?? null;
  const unlockedCurrentFashion = currentFashion && currentFashion.IsLock === false ? currentFashion : null;
  const introText = typeof extraInfo?.Intro === 'string' && extraInfo.Intro.trim()
    ? extraInfo.Intro.trim()
    : '--';
  const characterName = app.getCharacterNameByCharacterId(characterId);
  const iconUrl = app.getCharacterIconByCharacterId(characterId);
  const displayMainIconUrl = unlockedCurrentFashion?.BigHeadIconFashion || iconUrl;
  const gradeName = typeof item?.GradeName === 'string' && item.GradeName.trim() ? item.GradeName.trim() : '--';
  const qualityText = app.getCharacterQualityDisplayLabel(quality, star);
  const awakenText = app.getCharacterAwakenDisplay(awakenLevel);
  const trustText = app.getCharacterTrustDisplay(trustLv);
  const gradeTier = app.getCharacterDetailGradeTier(grade);
  const maxLevel = app.getMaxNumericMapKey(extraInfo?.LevelExpMap);
  const currentExp = Number.isFinite(Number(extraInfo?.Exp)) ? Math.max(0, Number(extraInfo.Exp)) : null;
  const currentExpLimit = level !== null ? app.getCharacterExpLimit(extraInfo?.LevelExpMap, level) : null;
  state.currentCharacterDetailItem = item;
  state.currentCharacterDetailExtraInfo = extraInfo;

  if (characterDetailCard instanceof HTMLElement) {
    if (quality >= 1 && quality <= 6) {
      characterDetailCard.dataset.qualityTier = String(quality);
      characterDetailCard.dataset.gradeTier = String(gradeTier);
    } else {
      delete characterDetailCard.dataset.qualityTier;
      delete characterDetailCard.dataset.gradeTier;
    }
  }

  if (characterDetailMainIcon instanceof HTMLImageElement) {
    if (displayMainIconUrl) {
      characterDetailMainIcon.src = `.${displayMainIconUrl}`;
      characterDetailMainIcon.alt = characterName;
      characterDetailMainIcon.hidden = false;
    } else {
      characterDetailMainIcon.src = '';
      characterDetailMainIcon.alt = '';
      characterDetailMainIcon.hidden = true;
    }
  }

  if (characterDetailMainFashionShell instanceof HTMLElement) {
    const fashionEffectClass = unlockedCurrentFashion ? app.getFashionQualityEffectClass(unlockedCurrentFashion.Quality) : '';
    characterDetailMainFashionShell.className = [
      'character-detail-main-fashion-shell',
      unlockedCurrentFashion ? 'is-filled' : '',
      fashionEffectClass,
    ].filter(Boolean).join(' ');
    characterDetailMainFashionShell.hidden = false;
  }

  if (characterDetailMainFashionIcon instanceof HTMLImageElement) {
    if (unlockedCurrentFashion) {
      characterDetailMainFashionIcon.src = `.${unlockedCurrentFashion.BigIcon}`;
      characterDetailMainFashionIcon.alt = unlockedCurrentFashion.Name || characterName;
      characterDetailMainFashionIcon.hidden = false;
    } else {
      characterDetailMainFashionIcon.src = '';
      characterDetailMainFashionIcon.alt = '';
      characterDetailMainFashionIcon.hidden = true;
    }
  }

  if (characterDetailMainFashionPlaceholder instanceof HTMLElement) {
    characterDetailMainFashionPlaceholder.hidden = Boolean(unlockedCurrentFashion);
  }

  app.renderCharacterFashionSlots(fashions);
  app.renderCharacterDetailWeaponSlot(weapon);
  app.renderCharacterDetailMemorySlots(memories);
  app.renderCharacterSkillTableRows(skills, characterDetailSkillsBody, 'normal');
  app.renderCharacterSkillTableRows(enhanceSkills, characterDetailEnhanceSkillsBody, 'enhance');

  const enhanceSkillsSection = characterDetailEnhanceSkillsBody instanceof HTMLElement
    ? characterDetailEnhanceSkillsBody.closest('.character-detail-section')
    : null;
  if (enhanceSkillsSection instanceof HTMLElement) {
    enhanceSkillsSection.hidden = enhanceSkills.length === 0;
  }

  if (characterDetailName instanceof HTMLElement) {
    characterDetailName.textContent = characterName;
  }

  if (characterDetailEvolution instanceof HTMLElement) {
    characterDetailEvolution.textContent = qualityText;
    characterDetailEvolution.className = `character-detail-evolution ${app.getCharacterQualityClass(quality)}`;
  }

  app.syncCharacterQualityEditControls();

  if (characterDetailGrade instanceof HTMLElement) {
    characterDetailGrade.textContent = app.resolveCharacterGradeName(characterId, grade, gradeName);
    characterDetailGrade.className = `character-detail-stat-value ${app.getCharacterGradeClass(grade)}`;
  }

  if (characterDetailAwaken instanceof HTMLElement) {
    characterDetailAwaken.textContent = awakenText;
    characterDetailAwaken.className = `character-detail-stat-value ${app.getCharacterAwakenClass(awakenLevel)}`;
  }

  if (characterDetailLevel instanceof HTMLElement) {
    characterDetailLevel.innerHTML = app.renderCompositeStatValue({
      currentValue: level,
      maxValue: maxLevel,
      currentClass: currentExp !== null && currentExpLimit !== null ? '' : '',
    });
    characterDetailLevel.className = 'character-detail-stat-value';
  }

  app.syncCharacterLevelEditControls();

  if (characterDetailTrust instanceof HTMLElement) {
    characterDetailTrust.textContent = trustText;
    characterDetailTrust.className = 'character-detail-stat-value character-detail-trust-value';
  }

  app.syncCharacterTrustEditControls();
  app.syncCharacterGradeEditControls();
  app.syncCharacterAwakenEditControls();

  if (characterDetailInformation instanceof HTMLElement) {
    characterDetailInformation.textContent = introText;
  }
};

app.closeCharacterDetailModal = () => {
  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    return;
  }

  app.closeCharacterQualityEditModal();
  app.closeCharacterLevelEditModal();
  app.closeCharacterTrustEditModal();
  app.closeCharacterGradeEditModal();
  app.closeCharacterAwakenEditModal();
  app.closeCharacterSkillEditModal();
  app.hideCharacterDetailEquipTooltip();
  characterDetailModal.hidden = true;
  app.setBodyModalOpen(false);
  state.currentCharacterDetailItem = null;
  state.currentCharacterDetailExtraInfo = null;
  state.characterDetailLoading = false;
  state.characterFashionSwitchPending = false;

  if (state.lastCharacterDetailTrigger instanceof HTMLElement) {
    state.lastCharacterDetailTrigger.focus();
    state.lastCharacterDetailTrigger = null;
  }
};

app.loadCharacterDetailExtraInfo = async (recordId) => {
  state.characterDetailLoading = true;
  try {
    const extraInfo = await app.getCharacterDetailExtraInfo(recordId);
    state.currentCharacterDetailExtraInfo = extraInfo;
    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }
  } finally {
    state.characterDetailLoading = false;
  }
};

app.openCharacterDetailModal = (recordId, triggerButton) => {
  if (!(characterDetailModal instanceof HTMLElement)) {
    return;
  }

  const item = state.characterManagementItems?.find(
    (i) => (i?._id ?? i?.record_id) === recordId
  );
  if (!item) {
    return;
  }

  state.lastCharacterDetailTrigger = triggerButton instanceof HTMLElement ? triggerButton : document.activeElement;
  state.currentCharacterDetailItem = item;
  state.currentCharacterDetailExtraInfo = null;
  state.characterFashionSwitchPending = false;
  app.hideCharacterDetailEquipTooltip();
  app.populateCharacterDetailCard(item);
  characterDetailModal.hidden = false;
  app.setBodyModalOpen(true);
  void app.loadCharacterDetailExtraInfo(recordId).catch((error) => {
    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }
    if (characterDetailModal instanceof HTMLElement && !characterDetailModal.hidden) {
      app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterManagementLoadFailed'));
    }
  });

  if (characterDetailCard instanceof HTMLElement) {
    characterDetailCard.focus();
  }
};

export const initDatabaseCharacterManagementFeature = () => {
  app._syncCharacterManagementSortArrows();

  if (databaseCharacterManagementShell instanceof HTMLElement) {
    databaseCharacterManagementShell.addEventListener('click', app.handleCharacterManagementActionClick);
  }

  if (databaseCharacterSearchInput instanceof HTMLInputElement) {
    databaseCharacterSearchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      state.characterManagementKeyword = databaseCharacterSearchInput.value.trim();
      state.characterManagementCurrentPage = 1;
      if (app.canAccessCharacterManagement()) {
        void app.loadSelectedAccountCharacters(1);
      }
    });
  }

  const characterManagementTable = document.querySelector('#database-character-management-section .character-management-table');
  if (characterManagementTable instanceof HTMLElement) {
    characterManagementTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (!(sortBtn instanceof HTMLButtonElement)) return;
      const sortField = sortBtn.dataset.sortField;
      if (!sortField) return;
      app._handleCharacterManagementSortClick(sortField);
      state.characterManagementCurrentPage = 1;
      if (app.canAccessCharacterManagement()) {
        void app.loadSelectedAccountCharacters(1);
      }
    });
  }

  if (databaseCharacterManagementPrevButton instanceof HTMLButtonElement) {
    databaseCharacterManagementPrevButton.addEventListener('click', () => {
      if (state.characterManagementCurrentPage > 1) {
        void app.loadSelectedAccountCharacters(state.characterManagementCurrentPage - 1);
      }
    });
  }

  if (databaseCharacterManagementNextButton instanceof HTMLButtonElement) {
    databaseCharacterManagementNextButton.addEventListener('click', () => {
      if (state.characterManagementCurrentPage < state.characterManagementTotalPages) {
        void app.loadSelectedAccountCharacters(state.characterManagementCurrentPage + 1);
      }
    });
  }

  if (databaseCharacterManagementJumpInput instanceof HTMLInputElement) {
    databaseCharacterManagementJumpInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      app.submitCharacterManagementPageJump();
    });
  }

  if (databaseCharacterManagementJumpButton instanceof HTMLButtonElement) {
    databaseCharacterManagementJumpButton.addEventListener('click', app.submitCharacterManagementPageJump);
  }

  characterDetailCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterDetailModal);
  });

  if (characterDetailCard instanceof HTMLElement) {
    ['mouseover', 'mousemove', 'mouseout', 'focusin', 'focusout'].forEach((eventName) => {
      characterDetailCard.addEventListener(eventName, app.handleCharacterDetailEquipTooltipEvent);
    });
  }

  if (characterDetailModal instanceof HTMLElement) {
    characterDetailModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterDetailModal();
      }
    });
  }

  if (characterDetailFashions instanceof HTMLElement) {
    characterDetailFashions.addEventListener('click', app.handleCharacterFashionSlotActivate);
    characterDetailFashions.addEventListener('keydown', app.handleCharacterFashionSlotActivate);
  }

  if (characterDetailEvolution instanceof HTMLElement) {
    characterDetailEvolution.addEventListener('click', () => {
      if (!characterDetailEvolution.classList.contains('is-editable')) {
        return;
      }
      app.openCharacterQualityEditModal(characterDetailEvolution);
    });
    characterDetailEvolution.addEventListener('keydown', (event) => {
      if (!characterDetailEvolution.classList.contains('is-editable')) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      app.openCharacterQualityEditModal(characterDetailEvolution);
    });
  }

  if (characterDetailLevel instanceof HTMLElement) {
    characterDetailLevel.addEventListener('click', () => {
      if (!characterDetailLevel.classList.contains('is-editable')) {
        return;
      }
      app.openCharacterLevelEditModal(characterDetailLevel);
    });
    characterDetailLevel.addEventListener('keydown', (event) => {
      if (!characterDetailLevel.classList.contains('is-editable')) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      app.openCharacterLevelEditModal(characterDetailLevel);
    });
  }

  if (characterDetailTrust instanceof HTMLElement) {
    characterDetailTrust.addEventListener('click', () => {
      if (!characterDetailTrust.classList.contains('is-editable')) {
        return;
      }
      app.openCharacterTrustEditModal(characterDetailTrust);
    });
    characterDetailTrust.addEventListener('keydown', (event) => {
      if (!characterDetailTrust.classList.contains('is-editable')) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      app.openCharacterTrustEditModal(characterDetailTrust);
    });
  }

  if (characterDetailGrade instanceof HTMLElement) {
    characterDetailGrade.addEventListener('click', () => {
      if (!characterDetailGrade.classList.contains('is-editable')) {
        return;
      }
      app.openCharacterGradeEditModal(characterDetailGrade);
    });
    characterDetailGrade.addEventListener('keydown', (event) => {
      if (!characterDetailGrade.classList.contains('is-editable')) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      app.openCharacterGradeEditModal(characterDetailGrade);
    });
  }

  if (characterDetailAwaken instanceof HTMLElement) {
    characterDetailAwaken.addEventListener('click', () => {
      if (!characterDetailAwaken.classList.contains('is-editable')) {
        return;
      }
      app.openCharacterAwakenEditModal(characterDetailAwaken);
    });
    characterDetailAwaken.addEventListener('keydown', (event) => {
      if (!characterDetailAwaken.classList.contains('is-editable')) {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      app.openCharacterAwakenEditModal(characterDetailAwaken);
    });
  }

  if (characterDetailSkillsBody instanceof HTMLElement) {
    characterDetailSkillsBody.addEventListener('click', app.handleCharacterSkillEditActivate);
    characterDetailSkillsBody.addEventListener('keydown', app.handleCharacterSkillEditActivate);
  }

  if (characterDetailEnhanceSkillsBody instanceof HTMLElement) {
    characterDetailEnhanceSkillsBody.addEventListener('click', app.handleCharacterSkillEditActivate);
    characterDetailEnhanceSkillsBody.addEventListener('keydown', app.handleCharacterSkillEditActivate);
  }

  characterQualityEditCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterQualityEditModal);
  });

  if (characterQualityEditQualitySelect instanceof HTMLSelectElement) {
    characterQualityEditQualitySelect.addEventListener('change', app.handleCharacterQualityEditQualityChange);
  }

  if (characterQualityEditConfirmButton instanceof HTMLButtonElement) {
    characterQualityEditConfirmButton.addEventListener('click', () => {
      void app.updateCharacterQualityStar();
    });
  }

  characterLevelEditCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterLevelEditModal);
  });

  if (characterLevelEditLevelInput instanceof HTMLInputElement) {
    characterLevelEditLevelInput.addEventListener('input', app.syncCharacterLevelEditExpInput);
    characterLevelEditLevelInput.addEventListener('change', app.syncCharacterLevelEditExpInput);
  }

  if (characterLevelEditConfirmButton instanceof HTMLButtonElement) {
    characterLevelEditConfirmButton.addEventListener('click', () => {
      void app.updateCharacterLevelExp();
    });
  }

  characterTrustEditCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterTrustEditModal);
  });

  if (characterTrustEditHearts instanceof HTMLElement) {
    characterTrustEditHearts.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest('[data-character-trust-level]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) {
        return;
      }

      const trustLv = Number.parseInt(button.dataset.characterTrustLevel ?? '', 10);
      if (!Number.isFinite(trustLv)) {
        return;
      }

      app.renderCharacterTrustEditHearts(trustLv);
      app.syncCharacterTrustEditExpInput();
      const nextSelectedButton = characterTrustEditHearts.querySelector(`[data-character-trust-level="${trustLv}"]`);
      if (nextSelectedButton instanceof HTMLButtonElement) {
        nextSelectedButton.focus();
      }
    });
    characterTrustEditHearts.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest('[data-character-trust-level]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) {
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      const trustLv = Number.parseInt(button.dataset.characterTrustLevel ?? '', 10);
      if (!Number.isFinite(trustLv)) {
        return;
      }

      app.renderCharacterTrustEditHearts(trustLv);
      app.syncCharacterTrustEditExpInput();
      const nextSelectedButton = characterTrustEditHearts.querySelector(`[data-character-trust-level="${trustLv}"]`);
      if (nextSelectedButton instanceof HTMLButtonElement) {
        nextSelectedButton.focus();
      }
    });
  }

  if (characterTrustEditExpInput instanceof HTMLInputElement) {
    characterTrustEditExpInput.addEventListener('input', app.syncCharacterTrustEditExpInput);
    characterTrustEditExpInput.addEventListener('change', app.syncCharacterTrustEditExpInput);
  }

  if (characterTrustEditConfirmButton instanceof HTMLButtonElement) {
    characterTrustEditConfirmButton.addEventListener('click', () => {
      void app.updateCharacterTrust();
    });
  }

  characterGradeEditCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterGradeEditModal);
  });

  if (characterGradeEditSelect instanceof HTMLSelectElement) {
    characterGradeEditSelect.addEventListener('change', () => {
      const grade = Number.parseInt(characterGradeEditSelect.value, 10);
      characterGradeEditSelect.className = `character-quality-edit-select ${app.getCharacterGradeClass(grade)}`;
    });
  }

  if (characterGradeEditConfirmButton instanceof HTMLButtonElement) {
    characterGradeEditConfirmButton.addEventListener('click', () => {
      void app.updateCharacterGrade();
    });
  }

  characterAwakenEditCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterAwakenEditModal);
  });

  if (characterAwakenEditLevelSelect instanceof HTMLSelectElement) {
    characterAwakenEditLevelSelect.addEventListener('change', () => {
      const awakenLevel = Number.parseInt(characterAwakenEditLevelSelect.value, 10);
      characterAwakenEditLevelSelect.className = `character-quality-edit-select ${app.getCharacterAwakenClass(awakenLevel)}`;
    });
  }

  if (characterAwakenEditConfirmButton instanceof HTMLButtonElement) {
    characterAwakenEditConfirmButton.addEventListener('click', () => {
      void app.updateCharacterAwaken();
    });
  }

  characterSkillEditCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterSkillEditModal);
  });

  if (characterSkillEditConfirmButton instanceof HTMLButtonElement) {
    characterSkillEditConfirmButton.addEventListener('click', () => {
      void app.updateCharacterSkillLevel();
    });
  }

  if (characterQualityEditModal instanceof HTMLElement) {
    characterQualityEditModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterQualityEditModal();
      }
    });
  }

  if (characterLevelEditModal instanceof HTMLElement) {
    characterLevelEditModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterLevelEditModal();
      }
    });
  }

  if (characterTrustEditModal instanceof HTMLElement) {
    characterTrustEditModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterTrustEditModal();
      }
    });
  }

  if (characterGradeEditModal instanceof HTMLElement) {
    characterGradeEditModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterGradeEditModal();
      }
    });
  }

  if (characterAwakenEditModal instanceof HTMLElement) {
    characterAwakenEditModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterAwakenEditModal();
      }
    });
  }

  if (characterSkillEditModal instanceof HTMLElement) {
    characterSkillEditModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        app.closeCharacterSkillEditModal();
        return;
      }

      if (event.key === 'Enter' && event.target === characterSkillEditLevelInput) {
        event.preventDefault();
        void app.updateCharacterSkillLevel();
      }
    });
  }

  window.addEventListener('resize', app.syncCharacterDetailEquipTooltipPosition);
  window.addEventListener('scroll', app.syncCharacterDetailEquipTooltipPosition, true);
};
