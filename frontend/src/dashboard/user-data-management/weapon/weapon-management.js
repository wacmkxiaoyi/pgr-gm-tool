import { app } from '../../shared.js';

const { dom, state } = app;
const {
  databaseWeaponManagementSubnavButton,
  databaseWeaponManagementState,
  databaseWeaponManagementShell,
  databaseWeaponManagementTableShell,
  databaseWeaponManagementBody,
  databaseWeaponManagementSummary,
  databaseequipManagementActions,
  databaseWeaponManagementPrevButton,
  databaseWeaponManagementNextButton,
  databaseWeaponManagementPaginationLabel,
  databaseWeaponManagementJumpInput,
  databaseWeaponManagementJumpButton,
  databaseWeaponSearchInput,
  equipDetailModal,
  equipDetailCloseTargets,
  equipDetailCard,
  equipDetailResonanceBody,
  equipDetailTooltip,
  weaponDetailOverrunContent,
  resonanceEffectTooltip,
  weaponResonanceCharacterPickerModal,
  weaponResonanceCharacterPickerSummary,
  weaponResonanceCharacterPickerGrid,
  weaponResonanceCharacterPickerConfirmButton,
  weaponResonanceCharacterPickerCloseTargets,
  weaponOverrunPickerModal,
  weaponOverrunPickerSummary,
  weaponOverrunPickerGrid,
  weaponOverrunPickerClearButton,
  weaponOverrunPickerConfirmButton,
  weaponOverrunPickerCloseTargets,
} = dom;

const WEAPON_DETAIL_TOOLTIP_DELAY_MS = 500;

app.escapeHtml = app.escapeHtml || ((value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;'));

app.stripMarkupText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/<color=.*?>/gi, '')
    .replace(/<\/color>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
};

app.resolveWeaponOverrunBackgroundPath = (value) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue) {
    return '';
  }

  if (/^(?:https?:)?\/\//i.test(normalizedValue) || normalizedValue.startsWith('data:')) {
    return normalizedValue;
  }

  if (normalizedValue.startsWith('./') || normalizedValue.startsWith('../')) {
    return normalizedValue;
  }

  if (normalizedValue.startsWith('/')) {
    return `.${normalizedValue}`;
  }

  return normalizedValue;
};

app.parseWeaponOverrunSkillDescription = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((text, index) => ({ pieces: (index + 1) * 2, text: app.stripMarkupText(text) }))
    .filter((entry) => entry.text);
};

app.getWeaponOverrunPieceLabel = (pieces) => {
  const normalizedPieces = Number.isFinite(Number(pieces)) ? Number(pieces) : 0;
  const key = normalizedPieces === 1
    ? 'dashboard.weaponDetailOverrunPieceSingle'
    : 'dashboard.weaponDetailOverrunPiecePlural';
  return app.translate(key, { count: normalizedPieces });
};

app.getWeaponOverrunSelection = (extraInfo = state.currentEquipDetailExtraInfo) => {
  const weaponOverrunData = extraInfo?.weapon_overrun_data;
  const level = Number.isFinite(Number(weaponOverrunData?.level)) ? Math.max(0, Number(weaponOverrunData.level)) : null;
  const choseSuit = Number.isFinite(Number(weaponOverrunData?.chose_suit)) ? Number(weaponOverrunData.chose_suit) : null;
  const suitEntry = choseSuit !== null ? state.weaponOverrunSuitEntriesMap?.[choseSuit] : null;

  return {
    weaponOverrunData,
    level,
    choseSuit,
    suitEntry: suitEntry && typeof suitEntry === 'object' ? suitEntry : null,
  };
};

app.getWeaponOverrunMatchCount = (suitId, extraInfo = state.currentEquipDetailExtraInfo) => {
  const currentMemoryIds = Array.isArray(extraInfo?.current_character_memories)
    ? new Set(extraInfo.current_character_memories.map(Number).filter(Number.isFinite))
    : null;
  const requiredMemoryIds = state.weaponOverrunSuitMemoryIdsMap?.[suitId];
  if (!currentMemoryIds || !(requiredMemoryIds && typeof requiredMemoryIds === 'object')) {
    return 0;
  }

  return Object.values(requiredMemoryIds)
    .map(Number)
    .filter(Number.isFinite)
    .filter((memoryId) => currentMemoryIds.has(memoryId))
    .length;
};

app.estimateWeaponOverrunPickerLineBudget = (rowCount) => {
  const normalizedRowCount = Number.isFinite(Number(rowCount)) ? Math.max(0, Number(rowCount)) : 0;
  if (normalizedRowCount <= 0) {
    return 0;
  }

  return Math.max(normalizedRowCount, 8);
};

app.estimateWeaponOverrunPickerRequiredLines = (text, charactersPerLine = 24) => {
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  if (!normalizedText) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalizedText.length / Math.max(1, charactersPerLine)));
};

app.allocateWeaponOverrunPickerLines = (descriptionRows) => {
  if (!Array.isArray(descriptionRows) || descriptionRows.length === 0) {
    return [];
  }

  const totalBudget = app.estimateWeaponOverrunPickerLineBudget(descriptionRows.length);
  const allocations = descriptionRows.map(() => 1);
  let remainingBudget = Math.max(0, totalBudget - descriptionRows.length);
  const greedyRows = descriptionRows
    .map((row, index) => ({
      index,
      pieces: row.pieces,
      requiredLines: app.estimateWeaponOverrunPickerRequiredLines(row.text),
    }))
    .sort((left, right) => right.pieces - left.pieces);

  for (const row of greedyRows) {
    if (remainingBudget <= 0) {
      break;
    }

    const additionalNeeded = Math.max(0, row.requiredLines - 1);
    if (additionalNeeded <= 0) {
      continue;
    }

    const granted = Math.min(additionalNeeded, remainingBudget);
    allocations[row.index] += granted;
    remainingBudget -= granted;
  }

  return allocations;
};

app.truncateWeaponOverrunPickerText = (text, lineCount, charactersPerLine = 24) => {
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  const safeLineCount = Number.isFinite(Number(lineCount)) ? Math.max(1, Number(lineCount)) : 1;
  if (!normalizedText) {
    return { text: '', truncated: false };
  }

  const maxCharacters = Math.max(8, safeLineCount * charactersPerLine);
  if (normalizedText.length <= maxCharacters) {
    return { text: normalizedText, truncated: false };
  }

  const ellipsisText = `${normalizedText.slice(0, Math.max(0, maxCharacters - 3)).trimEnd()}...`;
  return { text: ellipsisText, truncated: true };
};

app.buildWeaponOverrunCardMarkup = ({
  suitId = null,
  suitEntry = null,
  level = null,
  maxLevel = null,
  matchCount = 0,
  mode = 'detail',
  selected = false,
} = {}) => {
  const isPicker = mode === 'picker';
  if (!(suitEntry && typeof suitEntry === 'object')) {
    const classes = ['weapon-detail-overrun', 'weapon-detail-overrun-inactive'];
    if (isPicker) {
      classes.push('weapon-overrun-picker-card', 'weapon-overrun-picker-card-empty');
    }
    return `<div class="${classes.join(' ')}">${app.escapeHtml(app.translate('dashboard.weaponDetailOverrunInactive'))}</div>`;
  }

  const suitName = suitEntry?.Name ? String(suitEntry.Name).trim() : app.translate('common.notAvailable');
  const hasEditableLevel = !isPicker && Number.isFinite(Number(level)) && Number.isFinite(Number(maxLevel)) && Number(maxLevel) > 0;
  const titleText = isPicker ? suitName : suitName;
  const overrunLevelText = `Lv. ${level ?? 0}`;
  const descriptionRows = app.parseWeaponOverrunSkillDescription(suitEntry?.SkillDescription);
  const backgroundPath = app.resolveWeaponOverrunBackgroundPath(suitEntry?.WaferBagPath);
  const backgroundStyle = backgroundPath
    ? ` style="background-image: linear-gradient(140deg, rgba(9, 14, 30, 0.24), rgba(9, 14, 30, 0.54)), url('${app.escapeHtml(backgroundPath)}');"`
    : '';

  const lineBudgets = isPicker ? app.allocateWeaponOverrunPickerLines(descriptionRows) : [];
  const descMarkup = descriptionRows.length > 0
    ? `<div class="weapon-detail-overrun-lines${isPicker ? ' weapon-overrun-picker-lines' : ''}">${descriptionRows.map(({ pieces, text }, index) => {
        const escapedLabel = app.escapeHtml(app.getWeaponOverrunPieceLabel(pieces));
        const result = isPicker
          ? app.truncateWeaponOverrunPickerText(text, lineBudgets[index] ?? 1)
          : { text, truncated: false };
        const escapedText = app.escapeHtml(result.text);
        const tooltipAttr = result.truncated
          ? ` data-equip-tooltip-text="${app.escapeHtml(text)}" tabindex="0"`
          : '';
        const rowStyle = isPicker ? ` style="--weapon-overrun-picker-lines:${Math.max(1, lineBudgets[index] ?? 1)};"` : '';
        const isMatched = Number.isFinite(Number(matchCount)) && Number(matchCount) >= pieces;
        return `
          <div class="weapon-detail-overrun-line${isPicker ? ' weapon-overrun-picker-line' : ''}${isMatched ? ' is-matched' : ''}"${rowStyle}${tooltipAttr}>
            <strong class="weapon-detail-overrun-label">${escapedLabel}:</strong>
            <span class="weapon-detail-overrun-text${result.truncated ? ' is-truncated' : ''}">${escapedText}</span>
          </div>
        `;
      }).join('')}</div>`
    : '';

  const rootClasses = ['weapon-detail-overrun', 'weapon-detail-overrun-card'];
  if (isPicker) {
    rootClasses.push('weapon-overrun-picker-card');
    if (selected) {
      rootClasses.push('is-selected');
    }
  }

  return `
    <div class="${rootClasses.join(' ')}"${isPicker && Number.isFinite(Number(suitId)) ? ` data-weapon-overrun-picker-id="${Number(suitId)}" tabindex="0" role="button" aria-pressed="${selected ? 'true' : 'false'}"` : ''}>
      <div class="weapon-detail-overrun-surface${isPicker ? ' weapon-overrun-picker-surface' : ''}"${backgroundStyle}>
        <div class="weapon-detail-overrun-overlay${isPicker ? ' weapon-overrun-picker-overlay' : ''}">
          <div class="weapon-detail-overrun-title${isPicker ? ' weapon-overrun-picker-title' : ''}">
            <span class="weapon-detail-overrun-name">${app.escapeHtml(titleText)}</span>
            ${hasEditableLevel ? `<span class="equip-detail-stat-value weapon-detail-overrun-level is-editable" data-equip-edit-field="OverrunLevel" data-weapon-overrun-level-current="${Number(level)}" data-weapon-overrun-level-max="${Number(maxLevel)}" tabindex="0" role="button">${app.escapeHtml(overrunLevelText)}</span>` : (!isPicker ? `<span class="weapon-detail-overrun-level">${app.escapeHtml(overrunLevelText)}</span>` : '')}
          </div>
          ${descMarkup}
        </div>
      </div>
    </div>
  `;
};

app.renderWeaponOverrunPickerSummary = () => {
  if (!(weaponOverrunPickerSummary instanceof HTMLElement)) {
    return;
  }

  const selectedSuitId = Number(state._weaponOverrunPickerSelectedSuitId);
  const hasSelection = Number.isFinite(selectedSuitId) && selectedSuitId !== 0;
  const suitEntry = hasSelection ? state.weaponOverrunSuitEntriesMap?.[selectedSuitId] : null;
  const label = suitEntry?.Name ? String(suitEntry.Name).trim() : app.translate('common.unselected');

  weaponOverrunPickerSummary.innerHTML = `
    <div class="overrun-picker-summary-row">
      <span class="overrun-picker-summary-key">${app.escapeHtml(app.translate('dashboard.weaponDetailOverrunPickerCurrent'))}</span>
      <span class="overrun-picker-summary-value">${app.escapeHtml(label || app.translate('common.unselected'))}</span>
    </div>
  `;
};

app.renderWeaponOverrunPickerGrid = () => {
  if (!(weaponOverrunPickerGrid instanceof HTMLElement)) {
    return;
  }

  const selectedSuitId = Number(state._weaponOverrunPickerSelectedSuitId);
  const suitEntries = Object.entries(state.weaponOverrunSuitEntriesMap || {})
    .map(([idRaw, entry]) => ({
      id: Number(idRaw),
      entry,
      matchCount: app.getWeaponOverrunMatchCount(Number(idRaw)),
    }))
    .filter(({ id, entry }) => Number.isFinite(id) && entry && typeof entry === 'object')
    .sort((left, right) => right.matchCount - left.matchCount || left.id - right.id);

  weaponOverrunPickerGrid.innerHTML = suitEntries.map(({ id, entry, matchCount }) => app.buildWeaponOverrunCardMarkup({
    suitId: id,
    suitEntry: entry,
    matchCount,
    mode: 'picker',
    selected: id === selectedSuitId,
  })).join('');

  app.renderWeaponOverrunPickerSummary();
};

app.openWeaponOverrunPickerModal = (triggerButton) => {
  if (!(weaponOverrunPickerModal instanceof HTMLElement)) {
    return;
  }

  const selection = app.getWeaponOverrunSelection();
  state._weaponOverrunPickerOriginalSuitId = selection.choseSuit;
  state._weaponOverrunPickerSelectedSuitId = selection.choseSuit;
  state._weaponOverrunPickerTrigger = triggerButton instanceof HTMLElement ? triggerButton : document.activeElement;

  app.renderWeaponOverrunPickerGrid();
  weaponOverrunPickerModal.hidden = false;
  app.setBodyModalOpen(true);

  const selectedCard = weaponOverrunPickerGrid instanceof HTMLElement
    ? weaponOverrunPickerGrid.querySelector('.weapon-overrun-picker-card.is-selected')
    : null;
  if (selectedCard instanceof HTMLElement) {
    selectedCard.focus();
  } else if (weaponOverrunPickerClearButton instanceof HTMLButtonElement) {
    weaponOverrunPickerClearButton.focus();
  }
};

app.closeWeaponOverrunPickerModal = () => {
  if (weaponOverrunPickerConfirmButton instanceof HTMLButtonElement) {
    weaponOverrunPickerConfirmButton.disabled = false;
  }
  if (weaponOverrunPickerClearButton instanceof HTMLButtonElement) {
    weaponOverrunPickerClearButton.disabled = false;
  }

  if (weaponOverrunPickerModal instanceof HTMLElement) {
    weaponOverrunPickerModal.hidden = true;
  }
  app.hideEquipDetailTooltip();
  if (!(equipDetailModal instanceof HTMLElement) || equipDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }

  if (state._weaponOverrunPickerTrigger instanceof HTMLElement) {
    state._weaponOverrunPickerTrigger.focus();
  }

  state._weaponOverrunPickerOriginalSuitId = null;
  state._weaponOverrunPickerSelectedSuitId = null;
  state._weaponOverrunPickerTrigger = null;
};

app.submitWeaponOverrunSelection = async () => {
  const recordId = Number(state.currentEquipDetailItem?.record_id);
  if (!Number.isFinite(recordId) || recordId <= 0) {
    app.openNoticeModal(app.translate('dashboard.equipDetailCannotGetRecordId'), { title: app.translate('dashboard.equipDetailError'), tone: 'error' });
    return;
  }

  const selectedSuitId = Number(state._weaponOverrunPickerSelectedSuitId);
  const hasSelectedSuit = Number.isFinite(selectedSuitId) && selectedSuitId > 0;

  if (weaponOverrunPickerConfirmButton instanceof HTMLButtonElement) {
    weaponOverrunPickerConfirmButton.disabled = true;
  }
  if (weaponOverrunPickerClearButton instanceof HTMLButtonElement) {
    weaponOverrunPickerClearButton.disabled = true;
  }

  try {
    const payload = await app.apiFetch(`/api/database-weapons/selected/${recordId}/overrun`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chose_suit: hasSelectedSuit ? selectedSuitId : 0,
      }),
    });

    if (payload && typeof payload === 'object') {
      state.currentEquipDetailExtraInfo = payload;
      if (state.currentEquipDetailItem) {
        app.populateEquipDetailCard(state.currentEquipDetailItem, {
          detailMode: 'editable',
          source: state.currentEquipDetailSource,
        });
      }
    } else {
      await app.loadWeaponDetailExtraInfo(recordId);
    }

    app.closeWeaponOverrunPickerModal();
  } catch (error) {
    app.closeWeaponOverrunPickerModal();
    app.openWeaponOverrunPickerModal(weaponDetailOverrunContent);
    state._weaponOverrunPickerSelectedSuitId = hasSelectedSuit ? selectedSuitId : null;
    app.renderWeaponOverrunPickerGrid();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.equipsUpdateFailed'));
  }
};

app.handleWeaponOverrunPickerClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const card = target.closest('[data-weapon-overrun-picker-id]');
  if (!(card instanceof HTMLElement)) {
    return;
  }

  const suitId = Number(card.dataset.weaponOverrunPickerId);
  if (!Number.isFinite(suitId)) {
    return;
  }

  state._weaponOverrunPickerSelectedSuitId = suitId;
  app.renderWeaponOverrunPickerGrid();
};

app.renderWeaponOverrunContentInto = (container, extraInfo, { editable = false } = {}) => {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const { weaponOverrunData, level, suitEntry } = app.getWeaponOverrunSelection(extraInfo);
  const maxLevel = Number.isFinite(Number(weaponOverrunData?.max_level)) ? Number(weaponOverrunData.max_level) : null;
  if (!(weaponOverrunData && typeof weaponOverrunData === 'object')) {
    container.className = 'weapon-detail-overrun';
    container.textContent = '--';
    container.removeAttribute('tabindex');
    container.removeAttribute('role');
    delete container.dataset.overrunEditable;
    return;
  }

  if (!(suitEntry && typeof suitEntry === 'object')) {
    container.className = editable
      ? 'weapon-detail-overrun weapon-detail-overrun-inactive weapon-detail-overrun-editable'
      : 'weapon-detail-overrun weapon-detail-overrun-inactive';
    container.textContent = app.translate('dashboard.weaponDetailOverrunInactive');
    if (editable) {
      container.dataset.overrunEditable = 'inactive';
      container.setAttribute('tabindex', '0');
      container.setAttribute('role', 'button');
    } else {
      container.removeAttribute('tabindex');
      container.removeAttribute('role');
      delete container.dataset.overrunEditable;
    }
    return;
  }

  container.className = editable
    ? 'weapon-detail-overrun weapon-detail-overrun-host weapon-detail-overrun-editable'
    : 'weapon-detail-overrun weapon-detail-overrun-host';
  container.innerHTML = app.buildWeaponOverrunCardMarkup({
    suitEntry,
    level,
    maxLevel,
    matchCount: app.getWeaponOverrunMatchCount(weaponOverrunData?.chose_suit, extraInfo),
    mode: 'detail',
  });
  container.removeAttribute('tabindex');
  container.removeAttribute('role');
  if (editable) {
    container.dataset.overrunEditable = 'active';
  } else {
    delete container.dataset.overrunEditable;
  }
};

app.renderWeaponOverrunContent = (extraInfo) => {
  if (!(weaponDetailOverrunContent instanceof HTMLElement)) {
    return;
  }

  app.renderWeaponOverrunContentInto(weaponDetailOverrunContent, extraInfo, { editable: true });
};

app.resolveWeaponSkillName = (templateId) => {
  const entry = (state.weaponSkillEntriesMap || {})[templateId];
  if (entry && typeof entry === 'object') {
    return String(entry.Name || '').trim();
  }
  return '';
};

app.resolveWeaponSkillDescription = (templateId) => {
  const entry = (state.weaponSkillEntriesMap || {})[templateId];
  if (entry && typeof entry === 'object') {
    return String(entry.Description || '').trim();
  }
  return '';
};


app.setWeaponManagementState = (message, tone = '') => {
  if (databaseWeaponManagementState instanceof HTMLElement) {
    databaseWeaponManagementState.textContent = message;
    databaseWeaponManagementState.className = 'database-player-empty';
    if (tone) {
      databaseWeaponManagementState.classList.add(tone);
    }
    databaseWeaponManagementState.hidden = false;
  }

  if (databaseWeaponManagementShell instanceof HTMLElement) {
    databaseWeaponManagementShell.hidden = true;
  }
};

app.showWeaponManagementTable = () => {
  if (databaseWeaponManagementState instanceof HTMLElement) {
    databaseWeaponManagementState.hidden = true;
  }

  if (databaseWeaponManagementShell instanceof HTMLElement) {
    databaseWeaponManagementShell.hidden = false;
  }

  if (databaseWeaponManagementTableShell instanceof HTMLElement) {
    databaseWeaponManagementTableShell.hidden = false;
  }

  if (databaseequipManagementActions instanceof HTMLElement) {
    databaseequipManagementActions.hidden = false;
  }
};

app.getWeaponTypeByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return '--';
  }

  const typeName = state.weaponTypeNameMap?.[templateId];
  if (typeof typeName === 'string' && typeName.trim()) {
    return typeName.trim();
  }

  return '--';
};

app.getWeaponDetailExtraInfo = async (recordId) => {
  const payload = await app.apiFetch(`/api/database-weapons/selected/${recordId}/extra-info`);
  return payload && typeof payload === 'object' ? payload : {};
};

app.updateWeaponManagementPagination = () => {
  if (databaseWeaponManagementPaginationLabel instanceof HTMLElement) {
    databaseWeaponManagementPaginationLabel.textContent = app.translate('dashboard.accountsPagination', {
      page: state.weaponManagementTotalPages === 0 ? 0 : state.weaponManagementCurrentPage,
      totalPages: state.weaponManagementTotalPages,
    });
  }

  if (databaseWeaponManagementPrevButton instanceof HTMLButtonElement) {
    databaseWeaponManagementPrevButton.disabled = state.weaponManagementLoading || state.weaponManagementCurrentPage <= 1 || state.weaponManagementTotalPages === 0 || !app.canAccessWeaponManagement();
  }

  if (databaseWeaponManagementNextButton instanceof HTMLButtonElement) {
    databaseWeaponManagementNextButton.disabled = state.weaponManagementLoading || state.weaponManagementTotalPages === 0 || state.weaponManagementCurrentPage >= state.weaponManagementTotalPages || !app.canAccessWeaponManagement();
  }

  const jumpDisabled = state.weaponManagementLoading || state.weaponManagementTotalPages === 0 || !app.canAccessWeaponManagement();

  if (databaseWeaponManagementJumpInput instanceof HTMLInputElement) {
    databaseWeaponManagementJumpInput.disabled = jumpDisabled;
  }

  if (databaseWeaponManagementJumpButton instanceof HTMLButtonElement) {
    databaseWeaponManagementJumpButton.disabled = jumpDisabled;
  }
};

app.submitWeaponManagementPageJump = () => {
  if (!(databaseWeaponManagementJumpInput instanceof HTMLInputElement)) {
    return;
  }

  const targetPage = app.normalizePaginationTargetPage(databaseWeaponManagementJumpInput.value, state.weaponManagementTotalPages);
  databaseWeaponManagementJumpInput.value = '';

  if (targetPage === null || targetPage === state.weaponManagementCurrentPage) {
    return;
  }

  void app.loadSelectedAccountWeapons(targetPage);
};

app.renderWeaponRows = (items) => {
  if (!(databaseWeaponManagementBody instanceof HTMLElement)) {
    return;
  }

  databaseWeaponManagementBody.innerHTML = Array.isArray(items) ? items.map((item, index) => {
    const recordId = item?.record_id ?? null;
    const templateId = item?.TemplateId ?? null;
    const weaponName = app.getEquipNameByTemplateId(templateId);
    const iconUrl = app.getEquipIconByTemplateId(templateId);
    const characterId = item?.CharacterId ?? null;
    const characterName = app.getCharacterNameByCharacterId(characterId);
    const characterIconUrl = app.getCharacterIconByCharacterId(characterId);
    const isEquipped = Number(characterId) !== 0;
    const rowNumber = ((state.weaponManagementCurrentPage - 1) * 10) + index + 1;
    const star = app.getEquipStarByTemplateId(templateId);
    const iconExtraClass = (Number.isFinite(star) && star >= 4) ? `equip-icon-tier-${star}` : '';
    return `
      <tr>
        <td>${rowNumber}</td>
        <td>${app.renderEquipMediaCell(iconUrl, weaponName, true, iconExtraClass)}</td>
        <td>${app.getWeaponTypeByTemplateId(templateId)}</td>
        <td>${app.renderEquipStar(templateId)}</td>
        <td>${app.renderEquipMediaCell(characterIconUrl, characterName, false)}</td>
        <td>${app.renderEquipEnhancementLevel(item)}</td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button status-action-button-log" type="button" data-equip-management-action="detail" data-weapon-record-id="${recordId ?? ''}">${app.translate('dashboard.equipManagementDetail')}</button>
            <button class="status-action-button status-action-button-stop" type="button" data-equip-management-action="delete" data-weapon-record-id="${recordId ?? ''}" data-weapon-template-id="${templateId ?? ''}" data-weapon-name="${weaponName}" data-weapon-character-id="${characterId ?? ''}" data-weapon-character-name="${characterName}" ${isEquipped ? 'disabled' : ''}>${app.translate('dashboard.equipManagementDelete')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') : '';
};

app.reloadWeaponManagementCurrentPage = async () => {
  const targetPage = Math.max(1, state.weaponManagementCurrentPage);
  await app.loadSelectedAccountWeapons(targetPage);
  if (state.weaponManagementTotalPages > 0 && state.weaponManagementCurrentPage > state.weaponManagementTotalPages) {
    await app.loadSelectedAccountWeapons(state.weaponManagementTotalPages);
  }
};

app._weaponManagementSortFields = ['name', 'character', 'type', 'star', 'enhancement'];

app._syncWeaponManagementSortArrows = () => {
  const table = document.querySelector('#database-equip-management-section .equip-management-table');
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.weaponManagementSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.weaponManagementSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleWeaponManagementSortClick = (sortField) => {
  if (!app._weaponManagementSortFields.includes(sortField)) return;
  if (state.weaponManagementSortBy === sortField) {
    state.weaponManagementSortOrder = state.weaponManagementSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.weaponManagementSortBy = sortField;
    state.weaponManagementSortOrder = 'asc';
  }
  app._syncWeaponManagementSortArrows();
};

app.resetWeaponManagementView = () => {
  state.weaponManagementCurrentPage = 1;
  state.weaponManagementTotalPages = 0;
  state.weaponManagementHasLoaded = false;
  state.weaponManagementLoading = false;
  state.weaponManagementItems = [];
  if (databaseWeaponManagementBody instanceof HTMLElement) {
    databaseWeaponManagementBody.innerHTML = '';
  }
  app.updateWeaponManagementPagination();
};

app.clearWeaponManagementKeyword = () => {
  state.weaponManagementKeyword = '';
  if (databaseWeaponSearchInput instanceof HTMLInputElement) {
    databaseWeaponSearchInput.value = '';
  }
};

app.syncWeaponManagementKeywordInput = () => {
  if (databaseWeaponSearchInput instanceof HTMLInputElement) {
    databaseWeaponSearchInput.value = state.weaponManagementKeyword;
  }
};

app.rerenderWeaponManagementLocale = () => {
  app._syncWeaponManagementSortArrows();
  app.syncWeaponManagementKeywordInput();

  if (app.canAccessWeaponManagement() && state.weaponManagementHasLoaded) {
    void app.loadSelectedAccountWeapons(state.weaponManagementCurrentPage);
  }
};

app.loadSelectedAccountWeapons = async (page = 1) => {
  if (!app.canAccessWeaponManagement() || state.weaponManagementLoading) {
    app.updateWeaponManagementPagination();
    return;
  }

  state.weaponManagementLoading = true;
  state.weaponManagementCurrentPage = Math.max(1, page);
  app.updateWeaponManagementPagination();
  app.setWeaponManagementState(app.translate('dashboard.weaponManagementLoading'), 'is-loading');

  try {
    const search = new URLSearchParams({
      page: String(state.weaponManagementCurrentPage),
      page_size: '10',
    });
    if (state.weaponManagementKeyword) {
      search.set('keyword', state.weaponManagementKeyword);
    }
    search.set('sort_by', state.weaponManagementSortBy);
    search.set('sort_order', state.weaponManagementSortOrder);

    const payload = await app.apiFetch(`/api/database-weapons/selected?${search.toString()}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.weaponManagementItems = items;
    state.weaponManagementCurrentPage = typeof payload?.page === 'number' ? payload.page : state.weaponManagementCurrentPage;
    state.weaponManagementTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    state.weaponManagementHasLoaded = true;

    if (databaseWeaponManagementSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseWeaponManagementSummary.textContent = app.translate('dashboard.weaponManagementSummaryTotal', { total });
      databaseWeaponManagementSummary.hidden = false;
    }

    if (items.length === 0) {
      if (databaseWeaponManagementBody instanceof HTMLElement) {
        databaseWeaponManagementBody.innerHTML = '';
      }
      app.setWeaponManagementState(app.translate('dashboard.weaponManagementEmpty'), 'is-empty');
    } else {
      app.renderWeaponRows(items);
      app.showWeaponManagementTable();
    }
  } catch (error) {
    state.weaponManagementTotalPages = 0;
    if (databaseWeaponManagementBody instanceof HTMLElement) {
      databaseWeaponManagementBody.innerHTML = '';
    }
    app.setWeaponManagementState(app.apiErrorMessage(error, 'runtime.equipManagementLoadFailed'), 'is-error');
  } finally {
    state.weaponManagementLoading = false;
    app.updateWeaponManagementPagination();
  }
};

app.updateWeaponManagementAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);
  const accessible = app.canAccessWeaponManagement(payload);

  app.syncWeaponManagementKeywordInput();
  app._syncWeaponManagementSortArrows();

  if (databaseWeaponManagementSubnavButton instanceof HTMLButtonElement) {
    databaseWeaponManagementSubnavButton.disabled = !accessible;
    if (!healthy) {
      databaseWeaponManagementSubnavButton.title = app.translate('runtime.weaponManagementAccessTitle');
    } else if (state.selectedAccountUid === null) {
      databaseWeaponManagementSubnavButton.title = app.translate('runtime.weaponManagementNeedAccountTitle');
    } else {
      databaseWeaponManagementSubnavButton.title = '';
    }
  }

  if (databaseWeaponManagementSummary instanceof HTMLElement) {
    if (accessible && state.weaponManagementHasLoaded) {
      databaseWeaponManagementSummary.hidden = false;
    } else if (accessible) {
      databaseWeaponManagementSummary.textContent = '';
      databaseWeaponManagementSummary.hidden = true;
    } else {
      databaseWeaponManagementSummary.textContent = !healthy
        ? app.translate('dashboard.weaponManagementUnavailable')
        : app.translate('dashboard.weaponManagementChooseAccount');
      databaseWeaponManagementSummary.hidden = false;
    }
  }

  if (!healthy) {
    app.resetWeaponManagementView();
    app.setWeaponManagementState(app.translate('dashboard.weaponManagementUnavailable'), 'is-muted');
    if (app.isDatabaseWeaponManagementSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    return;
  }

  if (state.selectedAccountUid === null) {
    app.resetWeaponManagementView();
    app.setWeaponManagementState(app.translate('dashboard.weaponManagementChooseAccount'), 'is-muted');
    if (app.isDatabaseWeaponManagementSectionActive()) {
      app.setActiveDatabaseTab('database-accounts-section');
    }
    return;
  }

  if (!state.weaponManagementHasLoaded) {
    if (databaseWeaponManagementBody instanceof HTMLElement) {
      databaseWeaponManagementBody.innerHTML = '';
    }
    app.setWeaponManagementState(app.translate('dashboard.weaponManagementReady'), 'is-muted');
    app.updateWeaponManagementPagination();
    return;
  }

  app.showWeaponManagementTable();
  app.updateWeaponManagementPagination();
};

app.handleequipManagementActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-equip-management-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.dataset.equipManagementAction === 'clear') {
    app.openClearWeaponsModal(state.weaponManagementKeyword.trim(), button);
    return;
  }

  if (button.dataset.equipManagementAction === 'add-weapon') {
    app.openWeaponAddModal(button);
    return;
  }

  if (button.dataset.equipManagementAction === 'detail') {
    const recordId = Number.parseInt(button.dataset.weaponRecordId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }
    app.openWeaponDetailModal(recordId, button);
    return;
  }

  if (button.dataset.equipManagementAction === 'delete') {
    const recordId = Number.parseInt(button.dataset.weaponRecordId ?? '', 10);
    const characterId = Number.parseInt(button.dataset.weaponCharacterId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }

    if (Number.isFinite(characterId) && characterId !== 0) {
      app.openNoticeModal(app.translate('runtime.equipsDeleteEquippedForbidden'));
      return;
    }

    app.openWeaponDeleteModal({
      recordId,
      templateId: button.dataset.weaponTemplateId ?? '--',
      weaponName: button.dataset.weaponName ?? app.translate('common.notAvailable'),
      characterName: button.dataset.weaponCharacterName ?? app.translate('common.notAvailable'),
    }, button);
  }
};

app.populateWeaponDetailCard = (item) => {
  app.populateEquipDetailCard(item, {
    viewKey: 'shared',
    detailMode: 'editable',
    source: state.currentEquipDetailSource,
  });
};

app.closeWeaponDetailModal = () => {
  if (!(equipDetailModal instanceof HTMLElement) || equipDetailModal.hidden) {
    return;
  }

  if (state.equipDetailEditState) {
    app.stopEquipDetailFieldEdit(state.equipDetailEditState.field);
  }

  equipDetailModal.hidden = true;
  const keepBodyLocked = (dom.characterDetailModal instanceof HTMLElement && !dom.characterDetailModal.hidden)
    || (dom.characterWeaponSwitchModal instanceof HTMLElement && !dom.characterWeaponSwitchModal.hidden)
    || (dom.characterMemorySwitchModal instanceof HTMLElement && !dom.characterMemorySwitchModal.hidden);
  if (!keepBodyLocked) {
    app.setBodyModalOpen(false);
  }
  state.currentEquipDetailItem = null;
  state.currentEquipDetailExtraInfo = null;
  state.currentEquipDetailMode = 'weapon';
  state.currentEquipDetailSource = null;
  state.equipDetailLoading = false;
  state._equipResonanceEditSlots = {};
  state._equipResonancePendingEffect = {};
  state._equipResonancePendingAwake = {};
  state._equipResonancePendingCharacter = {};
  state._weaponOverrunPickerOriginalSuitId = null;
  state._weaponOverrunPickerSelectedSuitId = null;
  state._weaponOverrunPickerTrigger = null;
  if (weaponOverrunPickerModal instanceof HTMLElement) {
    weaponOverrunPickerModal.hidden = true;
  }
  app.hideEquipDetailTooltip();

  if (state.lastEquipDetailTrigger instanceof HTMLElement) {
    state.lastEquipDetailTrigger.focus();
    state.lastEquipDetailTrigger = null;
  }
};

app.stopEquipDetailFieldEdit = (field) => {
  if (!state.equipDetailEditState || state.equipDetailEditState.field !== field) {
    return;
  }

  const element = document.querySelector(`[data-equip-edit-field="${field}"]`);
  if (element instanceof HTMLElement) {
    element.classList.remove('is-editing');
  }

  state.equipDetailEditState = null;
  if (state.currentEquipDetailItem) {
    app.populateEquipDetailCard(state.currentEquipDetailItem, {
      detailMode: 'editable',
      source: state.currentEquipDetailSource,
    });
  }
};

app.loadWeaponDetailExtraInfo = async (recordId) => {
  state.equipDetailLoading = true;
  try {
    const extraInfo = await app.getWeaponDetailExtraInfo(recordId);
    state.currentEquipDetailExtraInfo = extraInfo;
    if (state.currentEquipDetailItem) {
      app.populateEquipDetailCard(state.currentEquipDetailItem, {
        detailMode: 'editable',
        source: state.currentEquipDetailSource,
      });
    }
  } finally {
    state.equipDetailLoading = false;
  }
};

app.refreshEquipDetailSourceViews = async (recordId, { rerenderSourceRows = true } = {}) => {
  const source = state.currentEquipDetailSource;

  if (source === 'character-weapon-switch') {
    if (rerenderSourceRows) {
      app.renderCharacterWeaponSwitchCurrent();
      app.renderCharacterWeaponSwitchRows();
    }
    const characterRecordId = Number(state.currentCharacterDetailItem?.record_id);
    if (Number.isFinite(characterRecordId) && characterRecordId > 0) {
      await app.loadCharacterDetailExtraInfo(characterRecordId);
    }
    await app.reloadWeaponManagementCurrentPage?.();
    return;
  }

  if (source === 'character-memory-switch') {
    if (rerenderSourceRows) {
      app.renderCharacterMemorySwitchCurrent();
      app.renderCharacterMemorySwitchRows();
    }
    const characterRecordId = Number(state.currentCharacterDetailItem?.record_id);
    if (Number.isFinite(characterRecordId) && characterRecordId > 0) {
      await app.loadCharacterDetailExtraInfo(characterRecordId);
    }
    await app.reloadMemoryManagementCurrentPage?.();
    return;
  }

  if (source === 'memory-management') {
    if (rerenderSourceRows) {
      app.renderMemoryRows(state.memoryManagementItems);
    }
    return;
  }

  if (rerenderSourceRows) {
    app.renderWeaponRows(state.weaponManagementItems);
  }
};

app.beginEquipDetailFieldEdit = (field) => {
  const element = document.querySelector(`[data-equip-edit-field="${field}"]`);
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (!element.classList.contains('is-editable')) {
    return;
  }

  if (state.equipDetailEditState?.field === field) {
    const existingInput = element.querySelector('input');
    if (existingInput instanceof HTMLInputElement) {
      existingInput.focus();
      existingInput.select();
      return;
    }
  }

  if (state.equipDetailEditState?.field && state.equipDetailEditState.field !== field) {
    app.stopEquipDetailFieldEdit(state.equipDetailEditState.field);
  }

  const item = state.currentEquipDetailItem;
  if (!item) {
    return;
  }

  let rawValue = '';
  if (field === 'Breakthrough') {
    rawValue = String(element.dataset.equipBtCurrent ?? '');
  } else if (field === 'Level') {
    rawValue = String(element.dataset.equipLevelCurrent ?? '');
  } else if (field === 'Exp') {
    rawValue = String(element.dataset.equipExpCurrent ?? '');
  } else if (field === 'OverrunLevel') {
    if (state.currentEquipDetailMode === 'memory') {
      return;
    }
    rawValue = String(element.dataset.weaponOverrunLevelCurrent ?? '');
  }

  state.equipDetailEditState = { field, pending: false };
  element.classList.add('is-editing');
  element.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'equip-detail-inline-input';
  input.value = rawValue;
  input.inputMode = 'numeric';
  element.appendChild(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void app.submitEquipDetailFieldEdit(field, input.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      app.stopEquipDetailFieldEdit(field);
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (state.equipDetailEditState?.field === field && !state.equipDetailEditState.pending) {
        app.stopEquipDetailFieldEdit(field);
      }
    }, 0);
  });
};

app.submitEquipDetailFieldEdit = async (field, nextValue) => {
  const currentState = state.equipDetailEditState;
  if (!currentState || currentState.field !== field) {
    return;
  }

  const item = state.currentEquipDetailItem;
  if (!item) {
    return;
  }

  const element = document.querySelector(`[data-equip-edit-field="${field}"]`);
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const rawValue = String(nextValue).trim();
  if (!/^\d+$/.test(rawValue)) {
    const invalidKey = field === 'Breakthrough'
      ? 'runtime.weaponBreakthroughInvalid'
      : field === 'Level'
        ? 'runtime.equipsLevelBelowMin'
        : field === 'Exp'
          ? 'runtime.equipsExpBelowMin'
          : 'runtime.weaponOverrunLevelBelowMin';
    app.openNoticeModal(app.translate(invalidKey));
    return;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  const recordId = item.record_id;

  if (field === 'Breakthrough') {
    const btMax = Number.parseInt(element.dataset.equipBtMax ?? '0', 10);
    if (parsedValue < 0 || parsedValue > btMax) {
      app.openNoticeModal(app.translate('runtime.weaponBreakthroughMaxExceeded', { max: btMax }));
      return;
    }
  } else if (field === 'Level') {
    const levelMin = Number.parseInt(element.dataset.equipLevelMin ?? '1', 10);
    const levelMax = Number.parseInt(element.dataset.equipLevelMax ?? '0', 10);
    if (parsedValue < levelMin || parsedValue > levelMax) {
      app.openNoticeModal(app.translate('runtime.equipsLevelAboveLimit', { max: levelMax }));
      return;
    }
  } else if (field === 'Exp') {
    const expMax = Number.parseInt(element.dataset.equipExpMax ?? '0', 10);
    if (parsedValue < 0 || parsedValue > expMax) {
      app.openNoticeModal(app.translate('runtime.equipsExpAboveLimit', { max: expMax }));
      return;
    }
  } else if (field === 'OverrunLevel') {
    if (state.currentEquipDetailMode === 'memory') {
      return;
    }
    const overrunLevelMax = Number.parseInt(element.dataset.weaponOverrunLevelMax ?? '0', 10);
    if (parsedValue <= 0) {
      app.openNoticeModal(app.translate('runtime.weaponOverrunLevelBelowMin'));
      return;
    }
    if (parsedValue > overrunLevelMax) {
      app.openNoticeModal(app.translate('runtime.weaponOverrunLevelAboveLimit', { max: overrunLevelMax }));
      return;
    }
  }

  currentState.pending = true;
  const editor = element.querySelector('input');
  if (editor instanceof HTMLInputElement) {
    editor.disabled = true;
  }

  try {
    const basePath = state.currentEquipDetailMode === 'memory' ? '/api/database-memories/selected' : '/api/database-weapons/selected';
    const payload = await app.apiFetch(field === 'OverrunLevel' ? `${basePath}/${recordId}/overrun` : `${basePath}/${recordId}/enhance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(field === 'OverrunLevel'
        ? {
            level: parsedValue,
          }
        : {
            field: field.toLowerCase(),
            value: parsedValue,
          }),
    });

    state.equipDetailEditState = null;

    if (field !== 'OverrunLevel') {
      app.replaceEquipDetailSourceItem(recordId, payload);
      state.currentEquipDetailItem = payload;
    }

    if (state.currentEquipDetailMode === 'memory') {
      await app.loadMemoryDetailExtraInfo(recordId);
    } else {
      await app.loadWeaponDetailExtraInfo(recordId);
    }

    await app.refreshEquipDetailSourceViews(recordId);
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      currentState.pending = false;
      app.stopEquipDetailFieldEdit(field);
      return;
    }

    state.equipDetailEditState = null;
    app.populateEquipDetailCard(state.currentEquipDetailItem, {
      detailMode: 'editable',
      source: state.currentEquipDetailSource,
    });
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.equipsUpdateFailed'));
  }
};


app.handleWeaponOverrunActivate = (event) => {
  if (state.currentEquipDetailMode === 'memory') {
    return;
  }
  const target = event.target;
  if (!(target instanceof HTMLElement) || !(weaponDetailOverrunContent instanceof HTMLElement)) {
    return;
  }

  const trigger = target.closest('#weapon-detail-overrun-content, .weapon-detail-overrun-surface');
  if (!(trigger instanceof HTMLElement) || !weaponDetailOverrunContent.contains(trigger)) {
    return;
  }

  const mode = weaponDetailOverrunContent.dataset.overrunEditable;
  if (!mode) {
    return;
  }

  if (mode === 'active') {
    const levelTrigger = target.closest('[data-equip-edit-field="OverrunLevel"]');
    if (levelTrigger instanceof HTMLElement) {
      return;
    }

    const blockedText = target.closest('.weapon-detail-overrun-title, .weapon-detail-overrun-line, .weapon-detail-overrun-label, .weapon-detail-overrun-text');
    if (blockedText instanceof HTMLElement) {
      return;
    }

    const surface = target.closest('.weapon-detail-overrun-surface');
    if (!(surface instanceof HTMLElement)) {
      return;
    }
  }

    app.openWeaponOverrunPickerModal(weaponDetailOverrunContent);
};

app.handleEquipDetailFieldActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
    return;
  }

  const editableElement = target.closest('[data-equip-edit-field]');
  if (!(editableElement instanceof HTMLElement)) {
    return;
  }

  const field = editableElement.dataset.equipEditField;
  if (!field || !editableElement.classList.contains('is-editable')) {
    return;
  }

  app.beginEquipDetailFieldEdit(field);
};

app.openWeaponDetailModal = (recordId, triggerButton) => {
  if (!(equipDetailModal instanceof HTMLElement)) {
    return;
  }

  const opened = app.openEquipDetailModal({
    recordId,
    equipType: 'weapon',
    source: 'equip-management',
    trigger: triggerButton,
  });
  if (!opened) {
    return;
  }

  equipDetailModal.hidden = false;
  app.setBodyModalOpen(true);
  void app.loadWeaponDetailExtraInfo(recordId).catch((error) => {
    if (state.currentEquipDetailItem) {
      app.populateEquipDetailCard(state.currentEquipDetailItem, {
        viewKey: 'shared',
        detailMode: 'editable',
        source: 'equip-management',
      });
    }
    if (equipDetailModal instanceof HTMLElement && !equipDetailModal.hidden) {
      app.openNoticeModal(app.apiErrorMessage(error, 'runtime.equipManagementLoadFailed'));
    }
  });

  if (equipDetailCard instanceof HTMLElement) {
    equipDetailCard.focus();
  }
};

export const initDatabaseWeaponManagementFeature = () => {
  app._syncWeaponManagementSortArrows();

  if (databaseWeaponManagementShell instanceof HTMLElement) {
    databaseWeaponManagementShell.addEventListener('click', app.handleequipManagementActionClick);
  }

  if (databaseWeaponSearchInput instanceof HTMLInputElement) {
    databaseWeaponSearchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      state.weaponManagementKeyword = databaseWeaponSearchInput.value.trim();
      state.weaponManagementCurrentPage = 1;
      if (app.canAccessWeaponManagement()) {
        void app.loadSelectedAccountWeapons(1);
      }
    });
  }

  const weaponManagementTable = document.querySelector('#database-equip-management-section .equip-management-table');
  if (weaponManagementTable instanceof HTMLElement) {
    weaponManagementTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (!(sortBtn instanceof HTMLButtonElement)) return;
      const sortField = sortBtn.dataset.sortField;
      if (!sortField) return;
      app._handleWeaponManagementSortClick(sortField);
      state.weaponManagementCurrentPage = 1;
      if (app.canAccessWeaponManagement()) {
        void app.loadSelectedAccountWeapons(1);
      }
    });
  }

  if (databaseWeaponManagementPrevButton instanceof HTMLButtonElement) {
    databaseWeaponManagementPrevButton.addEventListener('click', () => {
      if (state.weaponManagementCurrentPage > 1) {
        void app.loadSelectedAccountWeapons(state.weaponManagementCurrentPage - 1);
      }
    });
  }

  if (databaseWeaponManagementNextButton instanceof HTMLButtonElement) {
    databaseWeaponManagementNextButton.addEventListener('click', () => {
      if (state.weaponManagementCurrentPage < state.weaponManagementTotalPages) {
        void app.loadSelectedAccountWeapons(state.weaponManagementCurrentPage + 1);
      }
    });
  }

  if (databaseWeaponManagementJumpInput instanceof HTMLInputElement) {
    databaseWeaponManagementJumpInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      app.submitWeaponManagementPageJump();
    });
  }

  if (databaseWeaponManagementJumpButton instanceof HTMLButtonElement) {
    databaseWeaponManagementJumpButton.addEventListener('click', app.submitWeaponManagementPageJump);
  }

  equipDetailCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeWeaponDetailModal);
  });

  if (equipDetailModal instanceof HTMLElement) {
    equipDetailModal.addEventListener('click', app.handleEquipDetailFieldActivate);
    equipDetailModal.addEventListener('click', app.handleEquipResonanceActionClick);
    equipDetailModal.addEventListener('click', app.handleEquipResonanceEffectCellClick);
    equipDetailModal.addEventListener('click', app.handleEquipResonanceAwakeToggleClick);
    equipDetailModal.addEventListener('click', app.handleEquipResonanceBoundCharacterClick);
    equipDetailModal.addEventListener('click', app.handleWeaponOverrunActivate);
    equipDetailModal.addEventListener('mouseover', app.handleEquipDetailTooltipEvent);
    equipDetailModal.addEventListener('mouseout', app.handleEquipDetailTooltipEvent);
    equipDetailModal.addEventListener('mousemove', app.handleEquipDetailTooltipEvent);
    equipDetailModal.addEventListener('focusin', app.handleEquipDetailTooltipEvent);
    equipDetailModal.addEventListener('focusout', app.handleEquipDetailTooltipEvent);
    equipDetailModal.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
        return;
      }

      event.preventDefault();
      app.handleEquipDetailFieldActivate(event);

      if (event.target instanceof HTMLElement && event.target.closest('#weapon-detail-overrun-content')) {
        app.handleWeaponOverrunActivate(event);
      }
    });
    equipDetailModal.addEventListener('scroll', app.hideEquipDetailTooltip, true);
  }

  weaponOverrunPickerCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeWeaponOverrunPickerModal);
  });

  if (weaponOverrunPickerGrid instanceof HTMLElement) {
    weaponOverrunPickerGrid.addEventListener('click', app.handleWeaponOverrunPickerClick);
  }

  if (weaponOverrunPickerClearButton instanceof HTMLButtonElement) {
    weaponOverrunPickerClearButton.addEventListener('click', () => {
      state._weaponOverrunPickerSelectedSuitId = null;
      app.renderWeaponOverrunPickerGrid();
    });
  }

  if (weaponOverrunPickerConfirmButton instanceof HTMLButtonElement) {
    weaponOverrunPickerConfirmButton.addEventListener('click', () => {
      void app.submitWeaponOverrunSelection();
    });
  }

  if (weaponOverrunPickerModal instanceof HTMLElement) {
    weaponOverrunPickerModal.addEventListener('mouseover', app.handleEquipDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('mouseout', app.handleEquipDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('mousemove', app.handleEquipDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('focusin', app.handleEquipDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('focusout', app.handleEquipDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === weaponOverrunPickerModal || target.classList.contains('shared-modal-backdrop')) {
        app.closeWeaponOverrunPickerModal();
      }
    });

    weaponOverrunPickerModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        app.closeWeaponOverrunPickerModal();
        return;
      }

      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('[data-weapon-overrun-picker-id]')) {
        event.preventDefault();
        void app.submitWeaponOverrunSelection();
      }
    });
  }
};
