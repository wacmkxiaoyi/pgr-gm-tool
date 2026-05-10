import { app } from '../shared.js';

const { dom, state } = app;
const {
  databaseWeaponManagementSubnavButton,
  databaseWeaponManagementState,
  databaseWeaponManagementShell,
  databaseWeaponManagementTableShell,
  databaseWeaponManagementBody,
  databaseWeaponManagementSummary,
  databaseWeaponManagementActions,
  databaseWeaponManagementPrevButton,
  databaseWeaponManagementNextButton,
  databaseWeaponManagementPaginationLabel,
  databaseWeaponManagementJumpInput,
  databaseWeaponManagementJumpButton,
  databaseWeaponSearchInput,
  weaponDetailModal,
  weaponDetailCloseTargets,
  weaponDetailCard,
  weaponDetailIcon,
  weaponDetailName,
  weaponDetailType,
  weaponDetailStar,
  weaponDetailSkillSection,
  weaponDetailSkillName,
  weaponDetailSkillDescription,
  weaponDetailBreakthrough,
  weaponDetailLevel,
  weaponDetailExp,
  weaponDetailResonanceSection,
  weaponDetailResonanceBody,
  weaponDetailOverrunSection,
  weaponDetailOverrunContent,
  weaponDetailTooltip,
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
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([piecesRaw, text]) => {
        const pieces = Number(piecesRaw);
        const description = app.stripMarkupText(text);
        if (!Number.isFinite(pieces) || !description) {
          return null;
        }

        return { pieces, text: description };
      })
      .filter(Boolean)
      .sort((left, right) => left.pieces - right.pieces);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return [];
  }

  try {
    const parsedJson = JSON.parse(normalizedValue);
    return app.parseWeaponOverrunSkillDescription(parsedJson);
  } catch {
    // Fall through to handle the TSV-style map syntax.
  }

  const rows = [];
  const pairPattern = /([0-9]+)\s*:\s*('((?:\\'|[^'])*)'|"((?:\\"|[^"])*)")/g;
  let match = pairPattern.exec(normalizedValue);

  while (match) {
    const pieces = Number(match[1]);
    const rawText = typeof match[3] === 'string' && match[3] !== ''
      ? match[3]
      : (typeof match[4] === 'string' ? match[4] : '');
    const description = app.stripMarkupText(rawText.replace(/\\'/g, "'").replace(/\\"/g, '"'));

    if (Number.isFinite(pieces) && description) {
      rows.push({ pieces, text: description });
    }

    match = pairPattern.exec(normalizedValue);
  }

  return rows.sort((left, right) => left.pieces - right.pieces);
};

app.getWeaponOverrunPieceLabel = (pieces) => {
  const normalizedPieces = Number.isFinite(Number(pieces)) ? Number(pieces) : 0;
  const key = normalizedPieces === 1
    ? 'dashboard.weaponDetailOverrunPieceSingle'
    : 'dashboard.weaponDetailOverrunPiecePlural';
  return app.translate(key, { count: normalizedPieces });
};

app.getWeaponOverrunSelection = (extraInfo = state.currentWeaponDetailExtraInfo) => {
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
  const titleText = isPicker ? suitName : `${suitName} (Lv. ${level ?? 0})`;
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
          ? ` data-weapon-tooltip-text="${app.escapeHtml(text)}" tabindex="0"`
          : '';
        const rowStyle = isPicker ? ` style="--weapon-overrun-picker-lines:${Math.max(1, lineBudgets[index] ?? 1)};"` : '';
        return `
          <div class="weapon-detail-overrun-line${isPicker ? ' weapon-overrun-picker-line' : ''}"${rowStyle}${tooltipAttr}>
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
          <div class="weapon-detail-overrun-title${isPicker ? ' weapon-overrun-picker-title' : ''}">${app.escapeHtml(titleText)}</div>
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
    .map(([idRaw, entry]) => ({ id: Number(idRaw), entry }))
    .filter(({ id, entry }) => Number.isFinite(id) && entry && typeof entry === 'object')
    .sort((left, right) => left.id - right.id);

  weaponOverrunPickerGrid.innerHTML = suitEntries.map(({ id, entry }) => app.buildWeaponOverrunCardMarkup({
    suitId: id,
    suitEntry: entry,
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
  app.hideWeaponDetailTooltip();
  if (!(weaponDetailModal instanceof HTMLElement) || weaponDetailModal.hidden) {
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
  const recordId = Number(state.currentWeaponDetailItem?._id ?? state.currentWeaponDetailItem?.record_id);
  if (!Number.isFinite(recordId) || recordId <= 0) {
    app.openControlModal(app.translate('dashboard.weaponDetailCannotGetRecordId'), { title: app.translate('dashboard.weaponDetailError'), tone: 'error' });
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
      state.currentWeaponDetailExtraInfo = payload;
      if (state.currentWeaponDetailItem) {
        app.populateWeaponDetailCard(state.currentWeaponDetailItem);
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
    app.openControlModal(app.apiErrorMessage(error, 'runtime.equipsUpdateFailed'));
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

app.renderWeaponOverrunContent = (extraInfo) => {
  if (!(weaponDetailOverrunContent instanceof HTMLElement)) {
    return;
  }

  const { weaponOverrunData, level, suitEntry } = app.getWeaponOverrunSelection(extraInfo);
  if (!(weaponOverrunData && typeof weaponOverrunData === 'object')) {
    weaponDetailOverrunContent.className = 'weapon-detail-overrun';
    weaponDetailOverrunContent.textContent = '--';
    delete weaponDetailOverrunContent.dataset.overrunEditable;
    return;
  }

  if (!(suitEntry && typeof suitEntry === 'object')) {
    weaponDetailOverrunContent.className = 'weapon-detail-overrun weapon-detail-overrun-inactive weapon-detail-overrun-editable';
    weaponDetailOverrunContent.textContent = app.translate('dashboard.weaponDetailOverrunInactive');
    weaponDetailOverrunContent.dataset.overrunEditable = 'inactive';
    weaponDetailOverrunContent.setAttribute('tabindex', '0');
    weaponDetailOverrunContent.setAttribute('role', 'button');
    return;
  }

  weaponDetailOverrunContent.className = 'weapon-detail-overrun weapon-detail-overrun-host weapon-detail-overrun-editable';
  weaponDetailOverrunContent.dataset.overrunEditable = 'active';
  weaponDetailOverrunContent.removeAttribute('tabindex');
  weaponDetailOverrunContent.removeAttribute('role');
  weaponDetailOverrunContent.innerHTML = app.buildWeaponOverrunCardMarkup({ suitEntry, level, mode: 'detail' });
};

app.buildResonanceResolveIndices = () => {
  const attribByTemplate = {};
  const attribPoolEntriesMap = state.attribPoolEntriesMap || {};
  for (const entries of Object.values(attribPoolEntriesMap)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const tid = Number(entry?.TemplateId);
      if (!Number.isFinite(tid)) continue;
      attribByTemplate[tid] = {
        Name: String(entry?.Name || '').trim(),
        Description: String(entry?.Description || '').trim(),
      };
    }
  }

  const characterSkillByTemplate = {};
  const characterSkillPoolEntriesMap = state.characterSkillPoolEntriesMap || {};
  for (const entries of Object.values(characterSkillPoolEntriesMap)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const tid = Number(entry?.TemplateId);
      if (!Number.isFinite(tid)) continue;
      characterSkillByTemplate[tid] = {
        Name: String(entry?.Name || '').trim(),
        Description: String(entry?.Description || '').trim(),
      };
    }
  }

  const weaponSkillByCharTemplate = {};
  const weaponSkillPoolEntriesMap = state.weaponSkillPoolEntriesMap || {};
  const weaponSkillEntriesMap = state.weaponSkillEntriesMap || {};
  for (const pool of Object.values(weaponSkillPoolEntriesMap)) {
    if (typeof pool !== 'object' || pool === null) continue;
    for (const [charIdRaw, skillIds] of Object.entries(pool)) {
      const charId = Number(charIdRaw);
      if (!Number.isFinite(charId) || !Array.isArray(skillIds)) continue;
      for (const skillId of skillIds) {
        const sid = Number(skillId);
        if (!Number.isFinite(sid)) continue;
        const key = `${charId}_${sid}`;
        if (weaponSkillByCharTemplate[key]) continue;
        const entry = weaponSkillEntriesMap[sid];
        weaponSkillByCharTemplate[key] = entry && typeof entry === 'object'
          ? {
              Name: String(entry.Name || '').trim(),
              Description: String(entry.Description || '').trim(),
            }
          : { Name: '', Description: '' };
      }
    }
  }

  state._attribByTemplate = attribByTemplate;
  state._characterSkillByTemplate = characterSkillByTemplate;
  state._weaponSkillByCharTemplate = weaponSkillByCharTemplate;
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

app.resolveResonanceEffectInfo = (resonanceEntry) => {
  const type = Number(resonanceEntry?.type);
  const templateId = Number(resonanceEntry?.template_id);
  const characterId = Number(resonanceEntry?.character_id);
  if (!Number.isFinite(type) || !Number.isFinite(templateId)) return null;

  if (type === 1) {
    return state._attribByTemplate?.[templateId] || null;
  }

  if (type === 2) {
    return state._characterSkillByTemplate?.[templateId] || null;
  }

  if (type === 3) {
    if (!Number.isFinite(characterId)) return null;
    const key = `${characterId}_${templateId}`;
    return state._weaponSkillByCharTemplate?.[key] || null;
  }

  return null;
};

app.getPendingResonanceEffectState = (slot) => {
  const pendingEffectMap = state._weaponResonancePendingEffect;
  if (!pendingEffectMap || !Object.prototype.hasOwnProperty.call(pendingEffectMap, slot)) {
    return { hasPending: false, effect: null };
  }

  const pendingEffect = pendingEffectMap[slot];
  return {
    hasPending: true,
    effect: pendingEffect && typeof pendingEffect === 'object' ? pendingEffect : null,
  };
};

app.getEffectiveResonanceEffectSelection = (slot) => {
  const pendingState = app.getPendingResonanceEffectState(slot);
  if (pendingState.hasPending) {
    return pendingState;
  }

  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  if (!entry) {
    return { hasPending: false, effect: null };
  }

  const effectInfo = app.resolveResonanceEffectInfo(entry);
  return {
    hasPending: false,
    effect: {
      type: Number(entry.type),
      template_id: Number(entry.template_id),
      name: effectInfo?.Name || '',
      description: app.stripMarkupText(effectInfo?.Description),
    },
  };
};

app.hasResonanceSlotData = (slot) => {
  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  if (!entry) {
    return false;
  }

  const hasEffect = Number.isFinite(Number(entry.type))
    && Number.isFinite(Number(entry.template_id));
  const characterId = Number(entry.character_id);
  const hasCharacter = Number.isFinite(characterId) && characterId > 0;

  return hasEffect || hasCharacter;
};

app.getCurrentWeaponDetailRecordId = () => {
  const recordId = Number(state.currentWeaponDetailItem?._id ?? state.currentWeaponDetailItem?.record_id);
  return Number.isFinite(recordId) ? recordId : null;
};

app.canSaveResonanceSlot = (slot) => {
  if (!state._weaponResonanceEditSlots?.[slot]) {
    return true;
  }

  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharacterId = state._weaponResonancePendingCharacter?.[slot];
  const characterId = pendingCharacterId != null
    ? Number(pendingCharacterId)
    : Number(entry?.character_id);
  if (!Number.isFinite(characterId)) {
    return false;
  }

  const effectState = app.getEffectiveResonanceEffectSelection(slot);
  return Number.isFinite(Number(effectState.effect?.type))
    && Number.isFinite(Number(effectState.effect?.template_id));
};

app.hasWeaponResonanceConfig = (weaponTemplateId) => {
  if (!Number.isFinite(Number(weaponTemplateId))) {
    return false;
  }

  const resonanceMap = state.equipResonanceMap;
  return resonanceMap && typeof resonanceMap === 'object'
    ? Object.prototype.hasOwnProperty.call(resonanceMap, weaponTemplateId)
    : false;
};

app.buildResonanceEffectCatalog = (weaponTemplateId, characterId) => {
  const resonanceData = state.equipResonanceMap?.[weaponTemplateId];
  if (!Array.isArray(resonanceData) || resonanceData.length < 3) {
    return [];
  }

  const seen = new Set();
  const addIfNew = (item) => {
    const key = `${item.type}_${item.template_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    catalog.push(item);
  };

  const catalog = [];
  const normalizedCharacterId = Number(characterId);

  const attribPoolIds = resonanceData[0] || [];
  for (const poolId of attribPoolIds) {
    const entries = state.attribPoolEntriesMap?.[poolId];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const templateId = Number(entry.TemplateId);
      if (!Number.isFinite(templateId)) continue;
      addIfNew({
        type: 1,
        template_id: templateId,
        name: String(entry.Name ?? ''),
        description: String(entry.Description ?? ''),
      });
    }
  }

  const charSkillPoolIds = resonanceData[1] || [];
  for (const poolId of charSkillPoolIds) {
    const entries = state.characterSkillPoolEntriesMap?.[poolId];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const templateId = Number(entry.TemplateId);
      if (!Number.isFinite(templateId)) continue;
      addIfNew({
        type: 2,
        template_id: templateId,
        name: String(entry.Name ?? ''),
        description: String(entry.Description ?? ''),
      });
    }
  }

  const weaponSkillPoolIds = resonanceData[2] || [];
  if (Number.isFinite(normalizedCharacterId)) {
    for (const poolId of weaponSkillPoolIds) {
      const poolEntries = state.weaponSkillPoolEntriesMap?.[poolId];
      if (!poolEntries || typeof poolEntries !== 'object') continue;
      const skillIds = poolEntries[normalizedCharacterId];
      if (!Array.isArray(skillIds)) continue;
      for (const skillId of skillIds) {
        const skillNum = Number(skillId);
        if (!Number.isFinite(skillNum)) continue;
        const skillEntry = state.weaponSkillEntriesMap?.[skillNum];
        if (!skillEntry || typeof skillEntry !== 'object') continue;
        addIfNew({
          type: 3,
          template_id: skillNum,
          name: String(skillEntry.Name ?? ''),
          description: String(skillEntry.Description ?? ''),
        });
      }
    }
  }

  return catalog;
};

app._getResonanceEffectModalDom = () => {
  const { dom: d } = app;
  return {
    modal: d.resonanceEffectModal,
    searchInput: d.resonanceEffectSearchInput,
    sortNameBtn: d.resonanceEffectSortNameBtn,
    sortArrow: d.resonanceEffectSortArrow,
    tableBody: d.resonanceEffectTableBody,
    emptyState: d.resonanceEffectEmptyState,
    closeTargets: d.resonanceEffectCloseTargets,
    confirmButton: d.resonanceEffectConfirmButton,
  };
};

app.renderResonanceEffectModalRows = () => {
  const els = app._getResonanceEffectModalDom();
  if (!(els.tableBody instanceof HTMLElement) || !(els.emptyState instanceof HTMLElement)) {
    return;
  }

  const currentItem = state.currentWeaponDetailItem;
  const slot = state._resonanceEffectModalActiveSlot;
  if (currentItem == null || !Number.isFinite(slot)) {
    els.tableBody.innerHTML = '';
    els.emptyState.hidden = false;
    return;
  }

  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharacterId = state._weaponResonancePendingCharacter?.[slot];
  const characterId = pendingCharacterId != null
    ? Number(pendingCharacterId)
    : Number(entry?.character_id);
  if (!Number.isFinite(characterId)) {
    els.tableBody.innerHTML = '';
    els.emptyState.hidden = false;
    return;
  }

  const catalog = app.buildResonanceEffectCatalog(Number(currentItem.TemplateId), characterId);
  if (catalog.length === 0) {
    els.tableBody.innerHTML = '';
    els.emptyState.hidden = false;
    return;
  }

  const keyword = (state._resonanceEffectModalSearchKeyword || '').trim().toLowerCase();
  const sortOrder = state._resonanceEffectModalSortOrder === 'desc' ? -1 : 1;
  const selectedEntry = state._resonanceEffectModalSelectedEntry;

  let filtered = catalog;
  if (keyword) {
    filtered = catalog.map((item) => {
      const nameLower = item.name.toLowerCase();
      const descLower = item.description.toLowerCase();
      let priority = null;
      if (nameLower.includes(keyword)) {
        priority = 0;
      } else if (descLower.includes(keyword)) {
        priority = 1;
      }
      return { item, priority };
    }).filter(({ priority }) => priority !== null);
  } else {
    filtered = catalog.map((item) => ({ item, priority: 0 }));
  }

  filtered.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const nameCmp = a.item.name.localeCompare(b.item.name, undefined, { sensitivity: 'base' });
    return nameCmp * sortOrder;
  });

  els.tableBody.innerHTML = filtered.map(({ item }) => {
    const isSelected = selectedEntry != null
      && Number(selectedEntry.type) === Number(item.type)
      && Number(selectedEntry.template_id) === Number(item.template_id);
    const escapedName = app.escapeHtml(item.name);
    const escapedDesc = app.escapeHtml(app.stripMarkupText(item.description));
    const fullDesc = app.stripMarkupText(item.description);
    const escapedFullDesc = String(fullDesc).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return `
      <tr class="resonance-effect-table-row${isSelected ? ' is-selected' : ''}"
          data-resonance-effect-type="${item.type}"
          data-resonance-effect-template-id="${item.template_id}">
        <td class="resonance-effect-name">${escapedName}</td>
        <td class="resonance-effect-description" data-full-description="${escapedFullDesc}">${escapedDesc}</td>
        <td>
          <input class="resonance-effect-radio" type="radio"
                 name="resonance-effect-radio"
                 data-resonance-effect-type="${item.type}"
                 data-resonance-effect-template-id="${item.template_id}"
                 ${isSelected ? 'checked' : ''}>
        </td>
      </tr>
    `;
  }).join('');
  els.emptyState.hidden = filtered.length > 0;
};

app._syncResonanceEffectSortArrow = () => {
  const els = app._getResonanceEffectModalDom();
  if (els.sortArrow instanceof HTMLElement) {
    els.sortArrow.classList.toggle('desc', state._resonanceEffectModalSortOrder === 'desc');
  }
};

app.openResonanceEffectModal = (slot) => {
  if (!Number.isFinite(slot)) return;

  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharId = state._weaponResonancePendingCharacter?.[slot];
  const characterId = pendingCharId != null
    ? Number(pendingCharId)
    : Number(entry?.character_id);
  if (!Number.isFinite(characterId)) {
    app.openControlModal(app.translate('dashboard.weaponDetailResonanceBindCharFirst'), { title: app.translate('dashboard.weaponDetailCannotSelect'), tone: 'error' });
    return;
  }

  const currentItem = state.currentWeaponDetailItem;
  if (currentItem == null || !Number.isFinite(Number(currentItem.TemplateId))) {
    app.openControlModal(app.translate('dashboard.weaponDetailCannotGetWeaponInfo'), { title: app.translate('dashboard.weaponDetailError'), tone: 'error' });
    return;
  }

  state._resonanceEffectModalActiveSlot = slot;
  state._resonanceEffectModalSearchKeyword = '';
  state._resonanceEffectModalSortOrder = 'asc';
  const pendingState = app.getPendingResonanceEffectState(slot);
  if (pendingState.effect) {
    state._resonanceEffectModalSelectedEntry = pendingState.effect;
  } else if (!pendingState.hasPending && entry && Number.isFinite(Number(entry.type)) && Number.isFinite(Number(entry.template_id))) {
    const effectInfo = app.resolveResonanceEffectInfo(entry);
    state._resonanceEffectModalSelectedEntry = {
      type: Number(entry.type),
      template_id: Number(entry.template_id),
      name: effectInfo?.Name || '',
      description: app.stripMarkupText(effectInfo?.Description),
    };
  } else {
    state._resonanceEffectModalSelectedEntry = null;
  }

  const els = app._getResonanceEffectModalDom();
  if (els.searchInput instanceof HTMLInputElement) {
    els.searchInput.value = '';
  }
  app._syncResonanceEffectSortArrow();
  app.renderResonanceEffectModalRows();

  if (els.modal instanceof HTMLElement) {
    els.modal.hidden = false;
    app.setBodyModalOpen(true);
    if (els.searchInput instanceof HTMLInputElement) {
      els.searchInput.focus();
    }
  }
};

app.closeResonanceEffectModal = (confirm) => {
  if (confirm) {
    const selected = state._resonanceEffectModalSelectedEntry;
    const slot = state._resonanceEffectModalActiveSlot;
    if (selected != null && Number.isFinite(slot)) {
      if (!state._weaponResonancePendingEffect) {
        state._weaponResonancePendingEffect = {};
      }
      state._weaponResonancePendingEffect[slot] = {
        type: Number(selected.type),
        template_id: Number(selected.template_id),
        name: selected.name,
        description: selected.description,
      };
      app._renderResonanceEffectCell(slot);
      app._renderResonanceRowActionCell(slot);
    }
  }

  const els = app._getResonanceEffectModalDom();
  app._hideResonanceDescTooltip();
  if (els.modal instanceof HTMLElement) {
    els.modal.hidden = true;
  }
  if (!(weaponDetailModal instanceof HTMLElement) || weaponDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
  state._resonanceEffectModalActiveSlot = null;
  state._resonanceEffectModalSearchKeyword = '';
  state._resonanceEffectModalSelectedEntry = null;
};

app._renderResonanceEffectCell = (slot) => {
  if (!(weaponDetailResonanceBody instanceof HTMLElement)) return;
  const row = weaponDetailResonanceBody.querySelector(`tr[data-resonance-slot="${slot}"]`);
  if (!(row instanceof HTMLElement)) return;
  const effectCell = row.querySelector('td:nth-child(2)');
  if (!(effectCell instanceof HTMLElement)) return;

  const isEditing = state._weaponResonanceEditSlots?.[slot];
  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const effectState = app.getEffectiveResonanceEffectSelection(slot);
  const unselectedLabel = app.translate('common.unselected');

  let displayName = '--';
  if (isEditing) {
    displayName = effectState.effect?.name || unselectedLabel;
  } else if (entry) {
    const effectInfo = app.resolveResonanceEffectInfo(entry);
    displayName = (effectInfo?.Name) ? effectInfo.Name : app.translate('dashboard.unknown');
  }

  const escapedName = app.escapeHtml(displayName);
  if (isEditing) {
    const effectDescription = effectState.effect?.description || '';
    const escapedDesc = app.escapeHtml(effectDescription);
    effectCell.innerHTML = effectDescription
      ? `<span class="weapon-detail-effect-name" data-resonance-edit-effect data-effect-description="${escapedDesc}" tabindex="0">${escapedName}</span>`
      : `<span class="weapon-detail-effect-name" data-resonance-edit-effect tabindex="0">${escapedName}</span>`;
  } else {
    const effectDescription = entry ? app.stripMarkupText(app.resolveResonanceEffectInfo(entry)?.Description) : '';
    const escapedDesc = app.escapeHtml(effectDescription);
    effectCell.innerHTML = entry
      ? (effectDescription
        ? `<span class="weapon-detail-effect-name" data-effect-description="${escapedDesc}" tabindex="0">${escapedName}</span>`
        : `<span class="weapon-detail-effect-name" tabindex="0">${escapedName}</span>`)
      : escapedName;
  }
};

app._renderResonanceBoundCharacterCell = (slot) => {
  if (!(weaponDetailResonanceBody instanceof HTMLElement)) return;
  const row = weaponDetailResonanceBody.querySelector(`tr[data-resonance-slot="${slot}"]`);
  if (!(row instanceof HTMLElement)) return;
  const charCell = row.querySelector('td:nth-child(3)');
  if (!(charCell instanceof HTMLElement)) return;

  const isEditing = state._weaponResonanceEditSlots?.[slot];
  const pendingCharacterId = state._weaponResonancePendingCharacter?.[slot];
  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;

  const effectiveCharacterId = pendingCharacterId != null
    ? Number(pendingCharacterId)
    : Number(entry?.character_id);
  const noAvatar = !Number.isFinite(effectiveCharacterId) || effectiveCharacterId === 0;

  const characterName = isEditing && noAvatar
    ? app.translate('common.unselected')
    : app.getCharacterNameByCharacterId(effectiveCharacterId);
  const characterIconUrl = app.getCharacterIconByCharacterId(effectiveCharacterId);

  if (isEditing) {
    const mediaCell = app.renderWeaponMediaCell(characterIconUrl, characterName, !noAvatar);
    charCell.innerHTML = `<span class="weapon-detail-bound-char is-editable" data-resonance-bind-char tabindex="0" role="button">${mediaCell}</span>`;
  } else {
    charCell.innerHTML = app.renderWeaponMediaCell(characterIconUrl, characterName, !noAvatar);
  }
};

app.renderCharacterPickerSummary = () => {
  if (!(weaponResonanceCharacterPickerSummary instanceof HTMLElement)) return;

  const equippedCharacterId = Number(state.currentWeaponDetailItem?.CharacterId);
  const hasEquippedCharacter = Number.isFinite(equippedCharacterId) && equippedCharacterId !== 0;

  const selectedCharacterId = Number(state._weaponResonanceCharacterPickerSelectedId);
  const hasSelectedCharacter = Number.isFinite(selectedCharacterId) && selectedCharacterId !== 0;
  const selectedCharacterName = hasSelectedCharacter
    ? app.getCharacterNameByCharacterId(selectedCharacterId)
    : app.translate('common.unselected');
  const selectedCharacterIconUrl = hasSelectedCharacter
    ? app.getCharacterIconByCharacterId(selectedCharacterId)
    : '';

  const renderSummaryValue = (label, iconUrl, isQuickSelect = false) => {
    const safeLabel = typeof label === 'string' && label.trim() ? label.trim() : '--';
    const escapedLabel = app.escapeHtml(safeLabel);
    const media = `<span class="character-picker-summary-value-media"><span class="character-picker-summary-value-label">${escapedLabel}</span>${iconUrl ? `<img class="character-picker-summary-value-icon" src=".${iconUrl}" alt="${escapedLabel}">` : ''}</span>`;

    if (!isQuickSelect) {
      return `<span class="character-picker-summary-value">${media}</span>`;
    }

    return `<button type="button" class="character-picker-summary-value character-picker-summary-quick-select" data-character-picker-equipment-select="true">${media}</button>`;
  };

  const rows = [];
  if (hasEquippedCharacter) {
    rows.push(`
      <div class="character-picker-summary-row">
        <span class="character-picker-summary-key">${app.escapeHtml(app.translate('dashboard.weaponDetailBoundCharacter'))}</span>
        ${renderSummaryValue(app.translate('dashboard.weaponDetailCharPickerEquippedCharacter'), app.getCharacterIconByCharacterId(equippedCharacterId), true)}
      </div>
    `);
  }

  rows.push(`
    <div class="character-picker-summary-row">
      <span class="character-picker-summary-key">${app.escapeHtml(app.translate('dashboard.weaponDetailCharPickerTitle'))}</span>
      ${renderSummaryValue(selectedCharacterName, selectedCharacterIconUrl)}
    </div>
  `);

  weaponResonanceCharacterPickerSummary.innerHTML = rows.join('');
  weaponResonanceCharacterPickerSummary.hidden = false;
};

app.openCharacterPickerModal = (slot) => {
  if (!Number.isFinite(slot)) return;
  if (!(weaponResonanceCharacterPickerModal instanceof HTMLElement)) return;

  const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
    ? state.currentWeaponDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharacterId = state._weaponResonancePendingCharacter?.[slot];
  const currentCharacterId = pendingCharacterId != null
    ? Number(pendingCharacterId)
    : Number(entry?.character_id);

  state._weaponResonanceCharacterPickerSlot = slot;
  state._weaponResonanceCharacterPickerSelectedId = Number.isFinite(currentCharacterId) ? currentCharacterId : null;

  app.renderCharacterPickerGrid();
  weaponResonanceCharacterPickerModal.hidden = false;
  app.setBodyModalOpen(true);

  const firstSelected = weaponResonanceCharacterPickerGrid instanceof HTMLElement
    ? weaponResonanceCharacterPickerGrid.querySelector('.is-selected')
    : null;
  if (firstSelected instanceof HTMLElement) {
    firstSelected.focus();
  } else if (weaponResonanceCharacterPickerConfirmButton instanceof HTMLButtonElement) {
    weaponResonanceCharacterPickerConfirmButton.focus();
  }
};

app.closeCharacterPickerModal = (confirm) => {
  if (confirm) {
    const selectedId = state._weaponResonanceCharacterPickerSelectedId;
    const slot = state._weaponResonanceCharacterPickerSlot;
    if (Number.isFinite(selectedId) && Number.isFinite(slot)) {
      if (!state._weaponResonancePendingCharacter) {
        state._weaponResonancePendingCharacter = {};
      }
      state._weaponResonancePendingCharacter[slot] = selectedId;

      const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
        ? state.currentWeaponDetailExtraInfo.resonance_info
        : [];
      const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
      const weaponTemplateId = Number(state.currentWeaponDetailItem?.TemplateId);
      if (Number.isFinite(weaponTemplateId)) {
        const catalog = app.buildResonanceEffectCatalog(weaponTemplateId, selectedId);
        const effectState = app.getEffectiveResonanceEffectSelection(slot);
        const currentEffect = effectState.effect
          ? { type: Number(effectState.effect.type), template_id: Number(effectState.effect.template_id) }
          : null;
        if (currentEffect) {
          const compatible = catalog.some(
            (item) => Number(item.type) === currentEffect.type && Number(item.template_id) === currentEffect.template_id,
          );
          if (!compatible) {
            if (!state._weaponResonancePendingEffect) {
              state._weaponResonancePendingEffect = {};
            }
            state._weaponResonancePendingEffect[slot] = null;
          }
        }
      }
      app._renderResonanceEffectCell(slot);
      app._renderResonanceBoundCharacterCell(slot);
      app._renderResonanceRowActionCell(slot);
    }
  }

  if (weaponResonanceCharacterPickerModal instanceof HTMLElement) {
    weaponResonanceCharacterPickerModal.hidden = true;
  }
  if (!(weaponDetailModal instanceof HTMLElement) || weaponDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
  state._weaponResonanceCharacterPickerSlot = null;
  state._weaponResonanceCharacterPickerSelectedId = null;
};

app.renderCharacterPickerGrid = () => {
  if (!(weaponResonanceCharacterPickerGrid instanceof HTMLElement)) return;

  const characterNameMap = state.characterLogNameMap || {};
  const characterIconMap = state.characterHeadIconUrlMap || {};
  const selectedId = state._weaponResonanceCharacterPickerSelectedId;

  const characterIds = Object.keys(characterNameMap)
    .map(Number)
    .filter((id) => Number.isFinite(id) && typeof characterIconMap[id] === 'string' && characterIconMap[id].trim() !== '')
    .sort((a, b) => a - b);

  weaponResonanceCharacterPickerGrid.innerHTML = characterIds.map((id) => {
    const isSelected = id === selectedId;
    const name = characterNameMap[id] || String(id);
    const iconUrl = `.${characterIconMap[id]}`;
    const escapedName = app.escapeHtml(name);
    return `
      <button type="button" class="character-picker-item${isSelected ? ' is-selected' : ''}" data-character-picker-id="${id}">
        <span class="character-picker-item-preview">
          <img src="${iconUrl}" alt="${escapedName}">
        </span>
        <strong>${escapedName}</strong>
      </button>
    `;
  }).join('');

  app.renderCharacterPickerSummary();

  if (weaponResonanceCharacterPickerConfirmButton instanceof HTMLButtonElement) {
    weaponResonanceCharacterPickerConfirmButton.disabled = !Number.isFinite(selectedId);
  }
};

app.handleCharacterPickerClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest('[data-character-picker-id]');
  if (!(button instanceof HTMLElement)) return;

  const selectedId = Number(button.dataset.characterPickerId);
  if (!Number.isFinite(selectedId)) return;

  state._weaponResonanceCharacterPickerSelectedId = selectedId;
  app.renderCharacterPickerGrid();
};

app.handleCharacterPickerSummaryClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const quickSelectButton = target.closest('[data-character-picker-equipment-select]');
  if (!(quickSelectButton instanceof HTMLElement)) return;

  const equippedCharacterId = Number(state.currentWeaponDetailItem?.CharacterId);
  if (!Number.isFinite(equippedCharacterId) || equippedCharacterId === 0) return;

  state._weaponResonanceCharacterPickerSelectedId = equippedCharacterId;
  app.renderCharacterPickerGrid();
};

app.handleResonanceBoundCharacterClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const charBtn = target.closest('[data-resonance-bind-char]');
  if (!(charBtn instanceof HTMLElement)) return;

  const row = charBtn.closest('tr[data-resonance-slot]');
  if (!(row instanceof HTMLElement)) return;

  const slot = Number(row.dataset.resonanceSlot);
  if (!Number.isFinite(slot)) return;

  app.openCharacterPickerModal(slot);
};

app.hideWeaponDetailTooltip = () => {
  if (state.weaponDetailTooltipTimer) {
    window.clearTimeout(state.weaponDetailTooltipTimer);
    state.weaponDetailTooltipTimer = null;
  }

  if (weaponDetailTooltip instanceof HTMLElement) {
    if (weaponDetailTooltip.parentElement !== document.body) {
      document.body.appendChild(weaponDetailTooltip);
    }
    weaponDetailTooltip.hidden = true;
    weaponDetailTooltip.textContent = '';
  }

  state.weaponDetailTooltipTarget = null;
};

app.positionWeaponDetailTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(weaponDetailTooltip instanceof HTMLElement)) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = weaponDetailTooltip.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const margin = 12;
  const gap = 10;
  const preferredTop = targetRect.bottom + gap;
  const fallbackTop = targetRect.top - tooltipRect.height - gap;

  let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
  let top = preferredTop;

  if (left < margin) {
    left = margin;
  } else if (left + tooltipRect.width > viewportWidth - margin) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  if (top + tooltipRect.height > viewportHeight - margin && fallbackTop >= margin) {
    top = fallbackTop;
  }

  if (top < margin) {
    top = margin;
  }

  weaponDetailTooltip.style.left = `${Math.round(left)}px`;
  weaponDetailTooltip.style.top = `${Math.round(top)}px`;
};

app.syncWeaponDetailTooltipPosition = () => {
  if (!(state.weaponDetailTooltipTarget instanceof HTMLElement) || !(weaponDetailTooltip instanceof HTMLElement) || weaponDetailTooltip.hidden) {
    return;
  }

  app.positionWeaponDetailTooltip(state.weaponDetailTooltipTarget);
};

app.showWeaponDetailTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(weaponDetailTooltip instanceof HTMLElement)) {
    return;
  }

  const row = target.closest('tr[data-resonance-slot]');
  if (row instanceof HTMLElement && row.classList.contains('resonance-row-editing')) {
    app.hideWeaponDetailTooltip();
    return;
  }

  const description = typeof target.dataset.weaponTooltipText === 'string' && target.dataset.weaponTooltipText.trim()
    ? target.dataset.weaponTooltipText.trim()
    : (typeof target.dataset.effectDescription === 'string'
      ? target.dataset.effectDescription.trim()
      : '');
  if (!description) {
    app.hideWeaponDetailTooltip();
    return;
  }

  if (weaponDetailTooltip.parentElement !== document.body) {
    document.body.appendChild(weaponDetailTooltip);
  }

  weaponDetailTooltip.textContent = description;
  weaponDetailTooltip.hidden = false;
  weaponDetailTooltip.style.left = '0px';
  weaponDetailTooltip.style.top = '0px';
  state.weaponDetailTooltipTarget = target;
  window.requestAnimationFrame(app.syncWeaponDetailTooltipPosition);
};

app.scheduleWeaponDetailTooltip = (target) => {
  app.hideWeaponDetailTooltip();
  if (!(target instanceof HTMLElement)) {
    return;
  }

  state.weaponDetailTooltipTimer = window.setTimeout(() => {
    state.weaponDetailTooltipTimer = null;
    app.showWeaponDetailTooltip(target);
  }, WEAPON_DETAIL_TOOLTIP_DELAY_MS);
};

app._hideResonanceDescTooltip = () => {
  if (state._resonanceDescTooltipTimer) {
    window.clearTimeout(state._resonanceDescTooltipTimer);
    state._resonanceDescTooltipTimer = null;
  }
  if (resonanceEffectTooltip instanceof HTMLElement) {
    if (resonanceEffectTooltip.parentElement !== document.body) {
      document.body.appendChild(resonanceEffectTooltip);
    }
    resonanceEffectTooltip.hidden = true;
    resonanceEffectTooltip.textContent = '';
  }
  state._resonanceDescTooltipTarget = null;
};

app._positionResonanceDescTooltip = () => {
  if (!(resonanceEffectTooltip instanceof HTMLElement) || resonanceEffectTooltip.hidden) return;

  const target = state._resonanceDescTooltipTarget;
  if (!(target instanceof HTMLElement)) return;

  const targetRect = target.getBoundingClientRect();
  const tipRect = resonanceEffectTooltip.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const margin = 12;
  const gap = 8;
  let left = targetRect.left + (targetRect.width / 2) - (tipRect.width / 2);
  let top = targetRect.bottom + gap;

  if (left < margin) left = margin;
  else if (left + tipRect.width > vw - margin) left = vw - tipRect.width - margin;
  if (top + tipRect.height > vh - margin) {
    const above = targetRect.top - tipRect.height - gap;
    top = above >= margin ? above : margin;
  }

  if (top < margin) top = margin;
  resonanceEffectTooltip.style.left = `${Math.round(left)}px`;
  resonanceEffectTooltip.style.top = `${Math.round(top)}px`;
};

app._showResonanceDescTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(resonanceEffectTooltip instanceof HTMLElement)) return;
  const fullDesc = target.getAttribute('data-full-description') || '';
  if (!fullDesc.trim()) {
    app._hideResonanceDescTooltip();
    return;
  }
  if (resonanceEffectTooltip.parentElement !== document.body) {
    document.body.appendChild(resonanceEffectTooltip);
  }
  resonanceEffectTooltip.textContent = fullDesc;
  resonanceEffectTooltip.hidden = false;
  resonanceEffectTooltip.style.left = '0px';
  resonanceEffectTooltip.style.top = '0px';
  state._resonanceDescTooltipTarget = target;
  window.requestAnimationFrame(() => {
    app._positionResonanceDescTooltip();
  });
};

app._scheduleResonanceDescTooltip = (target) => {
  app._hideResonanceDescTooltip();
  if (!(target instanceof HTMLElement)) return;
  state._resonanceDescTooltipTimer = window.setTimeout(() => {
    state._resonanceDescTooltipTimer = null;
    app._showResonanceDescTooltip(target);
  }, WEAPON_DETAIL_TOOLTIP_DELAY_MS);
};

app.handleResonanceDescTooltipEvent = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const descCell = target.closest('.resonance-effect-description');
  if (!(descCell instanceof HTMLElement)) {
    app._hideResonanceDescTooltip();
    return;
  }
  if (event.type === 'mouseover' || event.type === 'focusin') {
    app._scheduleResonanceDescTooltip(descCell);
  } else if (event.type === 'mousemove') {
    if (state._resonanceDescTooltipTarget === descCell && resonanceEffectTooltip instanceof HTMLElement && !resonanceEffectTooltip.hidden) {
      app._positionResonanceDescTooltip();
    }
  } else if (event.type === 'mouseout' || event.type === 'focusout') {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && descCell.contains(relatedTarget)) return;
    app._hideResonanceDescTooltip();
  }
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

  if (databaseWeaponManagementActions instanceof HTMLElement) {
    databaseWeaponManagementActions.hidden = false;
  }
};

app.getWeaponNameByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return '--';
  }

  const name = state.equipNameMap?.[templateId];
  return typeof name === 'string' && name.trim() ? name : '--';
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

app.getWeaponStarByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return null;
  }

  const star = state.equipStarMap?.[templateId];
  return Number.isFinite(Number(star)) ? Math.max(0, Number(star)) : null;
};

app.getWeaponIconByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return '';
  }

  const url = state.equipIconUrlMap?.[templateId];
  return typeof url === 'string' ? url : '';
};

app.getCharacterNameByCharacterId = (characterId) => {
  if (characterId === null || characterId === undefined || Number(characterId) === 0) {
    return '--';
  }

  const name = state.characterLogNameMap?.[characterId];
  return typeof name === 'string' && name.trim() ? name : '--';
};

app.getCharacterIconByCharacterId = (characterId) => {
  if (characterId === null || characterId === undefined || Number(characterId) === 0) {
    return '';
  }

  const url = state.characterHeadIconUrlMap?.[characterId];
  return typeof url === 'string' ? url : '';
};

app.renderWeaponMediaCell = (iconUrl, label, showFallback = true, extraClass = '') => {
  const safeLabel = typeof label === 'string' && label.trim() ? label.trim() : '--';
  const escapedLabel = app.escapeHtml(safeLabel);
  const imgClass = `weapon-management-icon${extraClass ? ` ${extraClass}` : ''}`;
  return `
    <div class="weapon-management-media-cell">
      ${iconUrl ? `<img class="${imgClass}" src=".${iconUrl}" alt="${escapedLabel}">` : (showFallback ? '<span class="weapon-management-icon weapon-management-icon-fallback" aria-hidden="true"></span>' : '')}
      <span>${escapedLabel}</span>
    </div>
  `;
};

app.renderWeaponStar = (templateId) => {
  const star = app.getWeaponStarByTemplateId(templateId);
  if (!Number.isFinite(star) || star <= 0) {
    return '<span class="weapon-management-star is-empty">--</span>';
  }

  return `<span class="weapon-management-star weapon-star-tier-${star}">${'★'.repeat(star)}</span>`;
};

app.getWeaponEnhancementLevel = (item) => {
  const cachedEnhancementLevel = Number(item?.EnhancementLevel);
  if (Number.isFinite(cachedEnhancementLevel)) {
    return Math.max(0, cachedEnhancementLevel);
  }

  return null;
};

app.renderWeaponEnhancementLevel = (item) => {
  const enhancementLevel = app.getWeaponEnhancementLevel(item);
  if (!Number.isFinite(enhancementLevel)) {
    return '<span class="weapon-management-enhancement is-empty">--</span>';
  }

  const breakthrough = Number.isFinite(Number(item?.Breakthrough)) ? Math.max(0, Number(item.Breakthrough)) : 0;
  const colorTier = Math.min(Math.max(breakthrough, 0), 4);
  return `<span class="weapon-management-enhancement weapon-enhancement-tier-${colorTier}">${enhancementLevel}</span>`;
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
    const recordId = item?._id ?? item?.record_id ?? null;
    const templateId = item?.TemplateId ?? null;
    const weaponName = app.getWeaponNameByTemplateId(templateId);
    const iconUrl = app.getWeaponIconByTemplateId(templateId);
    const characterId = item?.CharacterId ?? null;
    const characterName = app.getCharacterNameByCharacterId(characterId);
    const characterIconUrl = app.getCharacterIconByCharacterId(characterId);
    const isEquipped = Number(characterId) !== 0;
    const rowNumber = ((state.weaponManagementCurrentPage - 1) * 10) + index + 1;
    const star = app.getWeaponStarByTemplateId(templateId);
    const iconExtraClass = (Number.isFinite(star) && star >= 4) ? `weapon-icon-tier-${star}` : '';
    return `
      <tr>
        <td>${rowNumber}</td>
        <td>${app.renderWeaponMediaCell(iconUrl, weaponName, true, iconExtraClass)}</td>
        <td>${app.getWeaponTypeByTemplateId(templateId)}</td>
        <td>${app.renderWeaponStar(templateId)}</td>
        <td>${app.renderWeaponMediaCell(characterIconUrl, characterName, false)}</td>
        <td>${app.renderWeaponEnhancementLevel(item)}</td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button status-action-button-log" type="button" data-weapon-management-action="detail" data-weapon-record-id="${recordId ?? ''}">${app.translate('dashboard.weaponManagementDetail')}</button>
            <button class="status-action-button status-action-button-stop" type="button" data-weapon-management-action="delete" data-weapon-record-id="${recordId ?? ''}" data-weapon-template-id="${templateId ?? ''}" data-weapon-name="${weaponName}" data-weapon-character-id="${characterId ?? ''}" data-weapon-character-name="${characterName}" ${isEquipped ? 'disabled' : ''}>${app.translate('dashboard.weaponManagementDelete')}</button>
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
  const table = document.querySelector('#database-weapon-management-section .weapon-management-table');
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
    app.setWeaponManagementState(app.apiErrorMessage(error, 'runtime.weaponManagementLoadFailed'), 'is-error');
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

app.handleWeaponManagementActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-weapon-management-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.dataset.weaponManagementAction === 'clear') {
    app.openClearWeaponsModal(state.weaponManagementKeyword.trim(), button);
    return;
  }

  if (button.dataset.weaponManagementAction === 'add-weapon') {
    app.openWeaponAddModal(button);
    return;
  }

  if (button.dataset.weaponManagementAction === 'detail') {
    const recordId = Number.parseInt(button.dataset.weaponRecordId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }
    app.openWeaponDetailModal(recordId, button);
    return;
  }

  if (button.dataset.weaponManagementAction === 'delete') {
    const recordId = Number.parseInt(button.dataset.weaponRecordId ?? '', 10);
    const characterId = Number.parseInt(button.dataset.weaponCharacterId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }

    if (Number.isFinite(characterId) && characterId !== 0) {
      app.openControlModal(app.translate('runtime.equipsDeleteEquippedForbidden'));
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
  const extraInfo = state.currentWeaponDetailExtraInfo && typeof state.currentWeaponDetailExtraInfo === 'object'
    ? state.currentWeaponDetailExtraInfo
    : {};
  const templateId = item?.TemplateId ?? null;
  const breakthrough = Number.isFinite(Number(item?.Breakthrough)) ? Math.max(0, Number(item.Breakthrough)) : 0;
  const level = Number.isFinite(Number(item?.Level)) ? Number(item.Level) : null;
  const currentLevelExp = Number.isFinite(Number(item?.Exp)) ? Number(item.Exp) : null;
  const currentLevelExpLimit = Number.isFinite(Number(extraInfo?.current_level_exp_limit)) ? Number(extraInfo.current_level_exp_limit) : null;
  const star = app.getWeaponStarByTemplateId(templateId);
  const iconUrl = app.getWeaponIconByTemplateId(templateId);
  const weaponName = app.getWeaponNameByTemplateId(templateId);
  const resonanceInfo = Array.isArray(extraInfo?.resonance_info) ? extraInfo.resonance_info : [];
  const hasValidStar = Number.isFinite(star) && star >= 2 && star <= 6;
  const btTier = Math.min(Math.max(breakthrough, 0), 4);
  const skillName = app.resolveWeaponSkillName(templateId);
  const skillDescription = app.stripMarkupText(app.resolveWeaponSkillDescription(templateId));
  const hasSkill = Boolean(skillName);
  const hasResonanceConfig = app.hasWeaponResonanceConfig(templateId);

  state.currentWeaponDetailItem = item;

  if (weaponDetailCard instanceof HTMLElement) {
    if (hasValidStar) {
      weaponDetailCard.dataset.starTier = star;
      weaponDetailCard.dataset.btTier = btTier;
    } else {
      delete weaponDetailCard.dataset.starTier;
      delete weaponDetailCard.dataset.btTier;
    }
  }

  if (weaponDetailIcon instanceof HTMLImageElement) {
    weaponDetailIcon.src = iconUrl ? `.${iconUrl}` : '';
    weaponDetailIcon.alt = weaponName;
  }

  if (weaponDetailName instanceof HTMLElement) {
    weaponDetailName.textContent = weaponName;
  }

  if (weaponDetailType instanceof HTMLElement) {
    const typeName = app.getWeaponTypeByTemplateId(templateId);
    weaponDetailType.textContent = `[${typeName}]`;
  }

  if (weaponDetailStar instanceof HTMLElement) {
    if (hasValidStar) {
      weaponDetailStar.textContent = '★'.repeat(star);
      weaponDetailStar.className = `weapon-detail-star weapon-detail-star-tier-${star}`;
    } else {
      weaponDetailStar.textContent = '--';
      weaponDetailStar.className = 'weapon-detail-star';
      weaponDetailStar.style.color = 'var(--muted)';
    }
  }

  if (weaponDetailSkillSection instanceof HTMLElement) {
    weaponDetailSkillSection.hidden = !hasSkill;
  }

  if (weaponDetailSkillName instanceof HTMLElement) {
    weaponDetailSkillName.textContent = hasSkill ? skillName : '--';
  }

  if (weaponDetailSkillDescription instanceof HTMLElement) {
    weaponDetailSkillDescription.textContent = hasSkill
      ? (skillDescription || app.translate('dashboard.weaponDetailNoSkill'))
      : '--';
  }

  if (weaponDetailBreakthrough instanceof HTMLElement) {
    weaponDetailBreakthrough.textContent = breakthrough;
    weaponDetailBreakthrough.className = `weapon-detail-stat-value weapon-detail-bt-tier-${btTier}`;
    weaponDetailBreakthrough.classList.add('is-editable');
    weaponDetailBreakthrough.setAttribute('tabindex', '0');
    weaponDetailBreakthrough.setAttribute('role', 'button');
    weaponDetailBreakthrough.dataset.weaponBtMax = Number.isFinite(Number(extraInfo?.max_breakthrough)) ? String(extraInfo.max_breakthrough) : '0';
    weaponDetailBreakthrough.dataset.weaponBtCurrent = String(breakthrough);
  }

  if (weaponDetailLevel instanceof HTMLElement) {
    weaponDetailLevel.textContent = level !== null ? String(level) : '--';
    weaponDetailLevel.className = 'weapon-detail-stat-value is-editable';
    weaponDetailLevel.setAttribute('tabindex', level !== null ? '0' : '-1');
    weaponDetailLevel.setAttribute('role', level !== null ? 'button' : '');
    const stageMap = extraInfo?.breakthrough_level_limit_map;
    const levelLimit = stageMap?.[breakthrough];
    weaponDetailLevel.dataset.weaponLevelMin = '1';
    weaponDetailLevel.dataset.weaponLevelMax = Number.isFinite(Number(levelLimit)) ? String(levelLimit) : '0';
    weaponDetailLevel.dataset.weaponLevelCurrent = level !== null ? String(level) : '';
  }

  if (weaponDetailExp instanceof HTMLElement) {
    if (currentLevelExp !== null && currentLevelExpLimit !== null) {
      weaponDetailExp.textContent = `${currentLevelExp} / ${currentLevelExpLimit}`;
      const btStageMap = extraInfo?.breakthrough_level_limit_map;
      const currentLevelLimit = btStageMap?.[breakthrough];
      const isMaxLevel = Number.isFinite(Number(currentLevelLimit)) && level === Number(currentLevelLimit);
      weaponDetailExp.dataset.weaponExpMax = String(currentLevelExpLimit - (isMaxLevel ? 0 : 1));
    } else {
      weaponDetailExp.textContent = '--';
      weaponDetailExp.dataset.weaponExpMax = '0';
    }
    weaponDetailExp.className = 'weapon-detail-stat-value is-editable';
    const hasValidExp = currentLevelExp !== null;
    weaponDetailExp.setAttribute('tabindex', hasValidExp ? '0' : '-1');
    weaponDetailExp.setAttribute('role', hasValidExp ? 'button' : '');
    weaponDetailExp.dataset.weaponExpCurrent = currentLevelExp !== null ? String(currentLevelExp) : '';
  }

  if (weaponDetailResonanceSection instanceof HTMLElement) {
    weaponDetailResonanceSection.hidden = !(extraInfo && 'resonance_info' in extraInfo && hasResonanceConfig);
  }

  if (weaponDetailResonanceBody instanceof HTMLElement) {
    if (!(extraInfo && 'resonance_info' in extraInfo && hasResonanceConfig)) {
      weaponDetailResonanceBody.innerHTML = '';
    } else {
      const rows = [1, 2, 3].map((slot) => {
        const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
        const slotText = slot;
        const unselectedLabel = app.translate('common.unselected');

        let effectText = '--';
        let characterText = '--';
        const isEditing = state._weaponResonanceEditSlots?.[slot];
        const effectState = app.getEffectiveResonanceEffectSelection(slot);
        const canDelete = app.hasResonanceSlotData(slot);

        let effectName = null;
        let effectDescription = '';
        if (isEditing) {
          effectName = effectState.effect?.name || unselectedLabel;
          effectDescription = effectState.effect?.description || '';
        } else if (entry) {
          const effectInfo = app.resolveResonanceEffectInfo(entry);
          effectName = (effectInfo?.Name) ? effectInfo.Name : app.translate('dashboard.unknown');
          effectDescription = app.stripMarkupText(effectInfo?.Description);
        }

        if (effectName) {
          const escapedEffectName = app.escapeHtml(effectName);
          const escapedEffectDescription = app.escapeHtml(effectDescription);

          effectText = effectDescription
            ? `<span class="weapon-detail-effect-name" data-effect-description="${escapedEffectDescription}"${isEditing ? ' data-resonance-edit-effect' : ''} tabindex="0">${escapedEffectName}</span>`
            : `<span class="weapon-detail-effect-name"${isEditing ? ' data-resonance-edit-effect' : ''} tabindex="0">${escapedEffectName}</span>`;
        }

        {
          const pendingCharacterId = state._weaponResonancePendingCharacter?.[slot];
          const effectiveCharacterId = pendingCharacterId != null
            ? Number(pendingCharacterId)
            : Number(entry?.character_id);
          const noAvatar = !Number.isFinite(effectiveCharacterId) || effectiveCharacterId === 0;
          const characterName = isEditing && noAvatar
            ? unselectedLabel
            : app.getCharacterNameByCharacterId(effectiveCharacterId);
          const characterIconUrl = app.getCharacterIconByCharacterId(effectiveCharacterId);

          if (isEditing) {
            const mediaCell = app.renderWeaponMediaCell(characterIconUrl, characterName, !noAvatar);
            characterText = `<span class="weapon-detail-bound-char is-editable" data-resonance-bind-char tabindex="0" role="button">${mediaCell}</span>`;
          } else {
            characterText = app.renderWeaponMediaCell(characterIconUrl, characterName, !noAvatar);
          }
        }

        return `
          <tr class="${isEditing ? 'resonance-row-editing' : ''}" data-resonance-slot="${slot}">
            <td>${slotText}</td>
            <td>${effectText}</td>
            <td>${characterText}</td>
            <td>
              <div class="weapon-detail-resonance-actions">
                ${isEditing ? `
                <button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-cancel" type="button" data-resonance-action="cancel-editing">${app.translate('dashboard.weaponDetailResonanceCancel')}</button>
                <button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-save" type="button" data-resonance-action="save-resonance" ${app.canSaveResonanceSlot(slot) ? '' : 'disabled'}>${app.translate('dashboard.weaponDetailResonanceSave')}</button>
                ` : `
                <button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-edit" type="button" data-resonance-action="start-editing">${app.translate('dashboard.weaponDetailResonanceEdit')}</button>
                <button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-delete" type="button" data-resonance-action="delete-resonance" ${canDelete ? '' : 'disabled'}>${app.translate('dashboard.weaponDetailResonanceDelete')}</button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
      weaponDetailResonanceBody.innerHTML = rows;
    }
  }

  if (weaponDetailOverrunSection instanceof HTMLElement) {
    weaponDetailOverrunSection.hidden = !(extraInfo && 'weapon_overrun_data' in extraInfo);
  }

  app.renderWeaponOverrunContent(extraInfo);
};

app.closeWeaponDetailModal = () => {
  if (!(weaponDetailModal instanceof HTMLElement) || weaponDetailModal.hidden) {
    return;
  }

  if (state.weaponDetailEditState) {
    app.stopWeaponDetailFieldEdit(state.weaponDetailEditState.field);
  }

  weaponDetailModal.hidden = true;
  app.setBodyModalOpen(false);
  state.currentWeaponDetailItem = null;
  state.currentWeaponDetailExtraInfo = null;
  state.weaponDetailLoading = false;
  state._weaponResonanceEditSlots = {};
  state._weaponResonancePendingEffect = {};
  state._weaponResonancePendingCharacter = {};
  state._weaponOverrunPickerOriginalSuitId = null;
  state._weaponOverrunPickerSelectedSuitId = null;
  state._weaponOverrunPickerTrigger = null;
  if (weaponOverrunPickerModal instanceof HTMLElement) {
    weaponOverrunPickerModal.hidden = true;
  }
  app.hideWeaponDetailTooltip();

  if (state.lastWeaponDetailFocusedControl instanceof HTMLElement) {
    state.lastWeaponDetailFocusedControl.focus();
    state.lastWeaponDetailFocusedControl = null;
  }
};

app.stopWeaponDetailFieldEdit = (field) => {
  if (!state.weaponDetailEditState || state.weaponDetailEditState.field !== field) {
    return;
  }

  const element = document.querySelector(`[data-weapon-edit-field="${field}"]`);
  if (element instanceof HTMLElement) {
    element.classList.remove('is-editing');
  }

  state.weaponDetailEditState = null;
  if (state.currentWeaponDetailItem) {
    app.populateWeaponDetailCard(state.currentWeaponDetailItem);
  }
};

app.loadWeaponDetailExtraInfo = async (recordId) => {
  state.weaponDetailLoading = true;
  try {
    const extraInfo = await app.getWeaponDetailExtraInfo(recordId);
    state.currentWeaponDetailExtraInfo = extraInfo;
    if (state.currentWeaponDetailItem) {
      app.populateWeaponDetailCard(state.currentWeaponDetailItem);
    }
  } finally {
    state.weaponDetailLoading = false;
  }
};

app.beginWeaponDetailFieldEdit = (field) => {
  const element = document.querySelector(`[data-weapon-edit-field="${field}"]`);
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (!element.classList.contains('is-editable')) {
    return;
  }

  if (state.weaponDetailEditState?.field === field) {
    const existingInput = element.querySelector('input');
    if (existingInput instanceof HTMLInputElement) {
      existingInput.focus();
      existingInput.select();
      return;
    }
  }

  if (state.weaponDetailEditState?.field && state.weaponDetailEditState.field !== field) {
    app.stopWeaponDetailFieldEdit(state.weaponDetailEditState.field);
  }

  const item = state.currentWeaponDetailItem;
  if (!item) {
    return;
  }

  let rawValue = '';
  if (field === 'Breakthrough') {
    rawValue = String(element.dataset.weaponBtCurrent ?? '');
  } else if (field === 'Level') {
    rawValue = String(element.dataset.weaponLevelCurrent ?? '');
  } else if (field === 'Exp') {
    rawValue = String(element.dataset.weaponExpCurrent ?? '');
  }

  state.weaponDetailEditState = { field, pending: false };
  element.classList.add('is-editing');
  element.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'weapon-detail-inline-input';
  input.value = rawValue;
  input.inputMode = 'numeric';
  element.appendChild(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void app.submitWeaponDetailFieldEdit(field, input.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      app.stopWeaponDetailFieldEdit(field);
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (state.weaponDetailEditState?.field === field && !state.weaponDetailEditState.pending) {
        app.stopWeaponDetailFieldEdit(field);
      }
    }, 0);
  });
};

app.submitWeaponDetailFieldEdit = async (field, nextValue) => {
  const currentState = state.weaponDetailEditState;
  if (!currentState || currentState.field !== field) {
    return;
  }

  const item = state.currentWeaponDetailItem;
  if (!item) {
    return;
  }

  const element = document.querySelector(`[data-weapon-edit-field="${field}"]`);
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const rawValue = String(nextValue).trim();
  if (!/^\d+$/.test(rawValue)) {
    app.openControlModal(app.translate(field === 'Breakthrough' ? 'runtime.weaponBreakthroughInvalid' : field === 'Level' ? 'runtime.equipsLevelBelowMin' : 'runtime.equipsExpBelowMin'));
    return;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  const recordId = item._id ?? item.record_id;

  if (field === 'Breakthrough') {
    const btMax = Number.parseInt(element.dataset.weaponBtMax ?? '0', 10);
    if (parsedValue < 0 || parsedValue > btMax) {
      app.openControlModal(app.translate('runtime.weaponBreakthroughMaxExceeded', { max: btMax }));
      return;
    }
  } else if (field === 'Level') {
    const levelMin = Number.parseInt(element.dataset.weaponLevelMin ?? '1', 10);
    const levelMax = Number.parseInt(element.dataset.weaponLevelMax ?? '0', 10);
    if (parsedValue < levelMin || parsedValue > levelMax) {
      app.openControlModal(app.translate('runtime.equipsLevelAboveLimit', { max: levelMax }));
      return;
    }
  } else if (field === 'Exp') {
    const expMax = Number.parseInt(element.dataset.weaponExpMax ?? '0', 10);
    if (parsedValue < 0 || parsedValue > expMax) {
      app.openControlModal(app.translate('runtime.equipsExpAboveLimit', { max: expMax }));
      return;
    }
  }

  currentState.pending = true;
  const editor = element.querySelector('input');
  if (editor instanceof HTMLInputElement) {
    editor.disabled = true;
  }

  try {
    const payload = await app.apiFetch(`/api/database-weapons/selected/${recordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        field: field.toLowerCase(),
        value: parsedValue,
      }),
    });

    state.weaponDetailEditState = null;

    const idx = state.weaponManagementItems?.findIndex(
      (i) => (i?._id ?? i?.record_id) === recordId
    );
    if (idx >= 0 && state.weaponManagementItems) {
      state.weaponManagementItems[idx] = payload;
      state.currentWeaponDetailItem = payload;
      app.renderWeaponRows(state.weaponManagementItems);
    }

    await app.loadWeaponDetailExtraInfo(recordId);
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      currentState.pending = false;
      app.stopWeaponDetailFieldEdit(field);
      return;
    }

    state.weaponDetailEditState = null;
    app.populateWeaponDetailCard(state.currentWeaponDetailItem);
    app.openControlModal(app.apiErrorMessage(error, 'runtime.equipsUpdateFailed'));
  }
};

app._renderResonanceRowActionCell = (slot) => {
  if (!(weaponDetailResonanceBody instanceof HTMLElement)) {
    return;
  }

  const row = weaponDetailResonanceBody.querySelector(`tr[data-resonance-slot="${slot}"]`);
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const actionCell = row.querySelector('td:last-child');
  if (!(actionCell instanceof HTMLElement)) {
    return;
  }

  const isEditing = state._weaponResonanceEditSlots?.[slot];
  row.classList.toggle('resonance-row-editing', isEditing);
  const canSave = app.canSaveResonanceSlot(slot);
  const canDelete = app.hasResonanceSlotData(slot);

  actionCell.innerHTML = isEditing
    ? `<div class="weapon-detail-resonance-actions"><button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-cancel" type="button" data-resonance-action="cancel-editing">${app.translate('dashboard.weaponDetailResonanceCancel')}</button><button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-save" type="button" data-resonance-action="save-resonance" ${canSave ? '' : 'disabled'}>${app.translate('dashboard.weaponDetailResonanceSave')}</button></div>`
    : `<div class="weapon-detail-resonance-actions"><button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-edit" type="button" data-resonance-action="start-editing">${app.translate('dashboard.weaponDetailResonanceEdit')}</button><button class="weapon-detail-resonance-action-btn weapon-detail-resonance-action-btn-delete" type="button" data-resonance-action="delete-resonance" ${canDelete ? '' : 'disabled'}>${app.translate('dashboard.weaponDetailResonanceDelete')}</button></div>`;

  app._renderResonanceEffectCell(slot);
  app._renderResonanceBoundCharacterCell(slot);
};

app.handleResonanceActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionButton = target.closest('[data-resonance-action]');
  if (!(actionButton instanceof HTMLElement)) {
    return;
  }

  const action = actionButton.dataset.resonanceAction;
  const row = actionButton.closest('tr[data-resonance-slot]');
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const slot = Number(row.dataset.resonanceSlot);
  if (!Number.isFinite(slot)) {
    return;
  }

  if (!state._weaponResonanceEditSlots) {
    state._weaponResonanceEditSlots = {};
  }

  if (action === 'start-editing') {
    state._weaponResonanceEditSlots[slot] = true;
    if (state._weaponResonancePendingEffect) {
      delete state._weaponResonancePendingEffect[slot];
    }
    if (state._weaponResonancePendingCharacter) {
      delete state._weaponResonancePendingCharacter[slot];
    }
    app._renderResonanceRowActionCell(slot);
    return;
  }

  if (action === 'cancel-editing') {
    delete state._weaponResonanceEditSlots[slot];
    if (state._weaponResonancePendingEffect) {
      delete state._weaponResonancePendingEffect[slot];
    }
    if (state._weaponResonancePendingCharacter) {
      delete state._weaponResonancePendingCharacter[slot];
    }
    app._renderResonanceRowActionCell(slot);
    return;
  }

  if (action === 'save-resonance') {
    const resonanceInfo = Array.isArray(state.currentWeaponDetailExtraInfo?.resonance_info)
      ? state.currentWeaponDetailExtraInfo.resonance_info
      : [];
    const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
    const pendingCharacterId = state._weaponResonancePendingCharacter?.[slot];
    const characterId = pendingCharacterId != null
      ? Number(pendingCharacterId)
      : Number(entry?.character_id);
    if (!Number.isFinite(characterId)) {
      app.openControlModal(app.translate('dashboard.weaponDetailResonanceBindCharBeforeSave'), { title: app.translate('dashboard.weaponDetailCannotSave'), tone: 'error' });
      return;
    }

    const effectState = app.getEffectiveResonanceEffectSelection(slot);
    let effectType;
    let effectTemplateId;
    if (effectState.effect) {
      effectType = Number(effectState.effect.type);
      effectTemplateId = Number(effectState.effect.template_id);
    } else if (!effectState.hasPending && entry) {
      effectType = Number(entry.type);
      effectTemplateId = Number(entry.template_id);
    }
    if (!Number.isFinite(effectType) || !Number.isFinite(effectTemplateId)) {
      app.openControlModal(app.translate('dashboard.weaponDetailResonanceSelectEffectBeforeSave'), { title: app.translate('dashboard.weaponDetailCannotSave'), tone: 'error' });
      return;
    }

    const dataChanged = pendingCharacterId != null
      || effectState.hasPending
      || !Number.isFinite(entry?.character_id)
      || !Number.isFinite(entry?.type)
      || !Number.isFinite(entry?.template_id);
    if (!dataChanged) {
      delete state._weaponResonanceEditSlots[slot];
      app._renderResonanceRowActionCell(slot);
      return;
    }

    const recordId = app.getCurrentWeaponDetailRecordId();
    if (recordId === null) {
      app.openControlModal(app.translate('dashboard.weaponDetailCannotGetRecordId'), { title: app.translate('dashboard.weaponDetailError'), tone: 'error' });
      return;
    }

    void (async () => {
      try {
        await app.apiFetch(`/api/database-weapons/selected/${recordId}/resonance`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Slot: slot,
            Type: effectType,
            TemplateId: effectTemplateId,
            CharacterId: characterId,
          }),
        });
        delete state._weaponResonanceEditSlots[slot];
        if (state._weaponResonancePendingEffect) {
          delete state._weaponResonancePendingEffect[slot];
        }
        if (state._weaponResonancePendingCharacter) {
          delete state._weaponResonancePendingCharacter[slot];
        }
        await app.loadWeaponDetailExtraInfo(recordId);
      } catch (error) {
        if (app.isMutationRiskCancelled(error)) {
          return;
        }
        app.openControlModal(app.apiErrorMessage(error, 'dashboard.weaponDetailResonanceSaveFailed'));
      }
    })();
    return;
  }

  if (action === 'delete-resonance') {
    if (!app.hasResonanceSlotData(slot)) {
      return;
    }

    const recordId = app.getCurrentWeaponDetailRecordId();
    if (recordId === null) {
      app.openControlModal(app.translate('dashboard.weaponDetailCannotGetRecordId'), { title: app.translate('dashboard.weaponDetailError'), tone: 'error' });
      return;
    }

    state.pendingDeleteWeaponResonance = {
      recordId,
      slot,
      weaponName: app.getWeaponNameByTemplateId(state.currentWeaponDetailItem?.TemplateId),
    };
    app.openWeaponResonanceDeleteModal({
      slot,
      weaponName: app.getWeaponNameByTemplateId(state.currentWeaponDetailItem?.TemplateId),
    }, actionButton);
    return;
  }
};

app.handleResonanceEffectCellClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const effectBtn = target.closest('[data-resonance-edit-effect]');
  if (!(effectBtn instanceof HTMLElement)) return;

  const row = effectBtn.closest('tr[data-resonance-slot]');
  if (!(row instanceof HTMLElement)) return;

  const slot = Number(row.dataset.resonanceSlot);
  if (!Number.isFinite(slot)) return;

  app.openResonanceEffectModal(slot);
};

app.handleWeaponDetailTooltipEvent = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const tooltipTarget = target.closest('.weapon-detail-effect-name, [data-weapon-tooltip-text]');
  const row = tooltipTarget instanceof HTMLElement ? tooltipTarget.closest('tr[data-resonance-slot]') : null;
  if (row instanceof HTMLElement && row.classList.contains('resonance-row-editing')) {
    app.hideWeaponDetailTooltip();
    return;
  }

  if (event.type === 'mouseover' || event.type === 'focusin') {
    if (tooltipTarget instanceof HTMLElement) {
      app.scheduleWeaponDetailTooltip(tooltipTarget);
    }
    return;
  }

  if (event.type === 'mousemove') {
    if (tooltipTarget instanceof HTMLElement && state.weaponDetailTooltipTarget === tooltipTarget && weaponDetailTooltip instanceof HTMLElement && !weaponDetailTooltip.hidden) {
      app.syncWeaponDetailTooltipPosition();
    }
    return;
  }

  if (event.type === 'mouseout' || event.type === 'focusout') {
    if (!(tooltipTarget instanceof HTMLElement)) {
      app.hideWeaponDetailTooltip();
      return;
    }

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && tooltipTarget.contains(relatedTarget)) {
      return;
    }

    app.hideWeaponDetailTooltip();
  }
};

app.handleWeaponOverrunActivate = (event) => {
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

app.handleWeaponDetailFieldActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
    return;
  }

  const editableElement = target.closest('[data-weapon-edit-field]');
  if (!(editableElement instanceof HTMLElement)) {
    return;
  }

  const field = editableElement.dataset.weaponEditField;
  if (!field || !editableElement.classList.contains('is-editable')) {
    return;
  }

  app.beginWeaponDetailFieldEdit(field);
};

app.openWeaponDetailModal = (recordId, triggerButton) => {
  if (!(weaponDetailModal instanceof HTMLElement)) {
    return;
  }

  const item = state.weaponManagementItems?.find(
    (i) => (i?._id ?? i?.record_id) === recordId
  );
  if (!item) {
    return;
  }

  state.lastWeaponDetailFocusedControl = triggerButton instanceof HTMLElement ? triggerButton : document.activeElement;
  state.currentWeaponDetailItem = item;
  state.currentWeaponDetailExtraInfo = null;
  app.populateWeaponDetailCard(item);
  weaponDetailModal.hidden = false;
  app.setBodyModalOpen(true);
  void app.loadWeaponDetailExtraInfo(recordId).catch((error) => {
    if (state.currentWeaponDetailItem) {
      app.populateWeaponDetailCard(state.currentWeaponDetailItem);
    }
    if (weaponDetailModal instanceof HTMLElement && !weaponDetailModal.hidden) {
      app.openControlModal(app.apiErrorMessage(error, 'runtime.weaponManagementLoadFailed'));
    }
  });

  if (weaponDetailCard instanceof HTMLElement) {
    weaponDetailCard.focus();
  }
};

export const initDatabaseWeaponManagementFeature = () => {
  app._syncWeaponManagementSortArrows();

  if (databaseWeaponManagementShell instanceof HTMLElement) {
    databaseWeaponManagementShell.addEventListener('click', app.handleWeaponManagementActionClick);
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

  const weaponManagementTable = document.querySelector('#database-weapon-management-section .weapon-management-table');
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

  weaponDetailCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeWeaponDetailModal);
  });

  if (weaponDetailModal instanceof HTMLElement) {
    weaponDetailModal.addEventListener('click', app.handleWeaponDetailFieldActivate);
    weaponDetailModal.addEventListener('click', app.handleResonanceActionClick);
    weaponDetailModal.addEventListener('click', app.handleResonanceEffectCellClick);
    weaponDetailModal.addEventListener('click', app.handleResonanceBoundCharacterClick);
    weaponDetailModal.addEventListener('click', app.handleWeaponOverrunActivate);
    weaponDetailModal.addEventListener('mouseover', app.handleWeaponDetailTooltipEvent);
    weaponDetailModal.addEventListener('mouseout', app.handleWeaponDetailTooltipEvent);
    weaponDetailModal.addEventListener('mousemove', app.handleWeaponDetailTooltipEvent);
    weaponDetailModal.addEventListener('focusin', app.handleWeaponDetailTooltipEvent);
    weaponDetailModal.addEventListener('focusout', app.handleWeaponDetailTooltipEvent);
    weaponDetailModal.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
        return;
      }

      event.preventDefault();
      app.handleWeaponDetailFieldActivate(event);

      if (event.target instanceof HTMLElement && event.target.closest('#weapon-detail-overrun-content')) {
        app.handleWeaponOverrunActivate(event);
      }
    });
    weaponDetailModal.addEventListener('scroll', app.hideWeaponDetailTooltip, true);
  }

  const resonanceEls = app._getResonanceEffectModalDom();
  if (resonanceEls.searchInput instanceof HTMLInputElement) {
    resonanceEls.searchInput.addEventListener('input', () => {
      if (resonanceEls.modal instanceof HTMLElement && resonanceEls.modal.hidden) return;
      state._resonanceEffectModalSearchKeyword = resonanceEls.searchInput?.value?.trim() ?? '';
      app.renderResonanceEffectModalRows();
    });
  }

  if (resonanceEls.sortNameBtn instanceof HTMLElement) {
    resonanceEls.sortNameBtn.addEventListener('click', () => {
      if (resonanceEls.modal instanceof HTMLElement && resonanceEls.modal.hidden) return;
      state._resonanceEffectModalSortOrder = state._resonanceEffectModalSortOrder === 'asc' ? 'desc' : 'asc';
      app._syncResonanceEffectSortArrow();
      app.renderResonanceEffectModalRows();
    });
  }

  if (resonanceEls.tableBody instanceof HTMLElement) {
    resonanceEls.tableBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest('tr[data-resonance-effect-type]');
      if (!(row instanceof HTMLElement)) return;
      const effectType = Number(row.dataset.resonanceEffectType);
      const templateId = Number(row.dataset.resonanceEffectTemplateId);
      if (!Number.isFinite(effectType) || !Number.isFinite(templateId)) return;
      const nameCell = row.querySelector('.resonance-effect-name');
      const effectName = nameCell instanceof HTMLElement ? nameCell.textContent?.trim() ?? '' : '';
      const descCell = row.querySelector('.resonance-effect-description');
      const effectDescription = descCell instanceof HTMLElement ? descCell.textContent?.trim() ?? '' : '';
      state._resonanceEffectModalSelectedEntry = { type: effectType, template_id: templateId, name: effectName, description: effectDescription };
      app.renderResonanceEffectModalRows();
    });
  }

  if (resonanceEls.confirmButton instanceof HTMLElement) {
    resonanceEls.confirmButton.addEventListener('click', () => app.closeResonanceEffectModal(true));
  }

  resonanceEls.closeTargets.forEach((target) => {
    target.addEventListener('click', () => app.closeResonanceEffectModal(false));
  });

  if (resonanceEls.modal instanceof HTMLElement) {
    resonanceEls.modal.addEventListener('mouseover', app.handleResonanceDescTooltipEvent);
    resonanceEls.modal.addEventListener('mouseout', app.handleResonanceDescTooltipEvent);
    resonanceEls.modal.addEventListener('mousemove', app.handleResonanceDescTooltipEvent);
    resonanceEls.modal.addEventListener('focusin', app.handleResonanceDescTooltipEvent);
    resonanceEls.modal.addEventListener('focusout', app.handleResonanceDescTooltipEvent);
  }

  window.addEventListener('scroll', app.hideWeaponDetailTooltip, true);
  window.addEventListener('resize', app.hideWeaponDetailTooltip);

  weaponResonanceCharacterPickerCloseTargets.forEach((target) => {
    target.addEventListener('click', () => app.closeCharacterPickerModal(false));
  });

  if (weaponResonanceCharacterPickerSummary instanceof HTMLElement) {
    weaponResonanceCharacterPickerSummary.addEventListener('click', app.handleCharacterPickerSummaryClick);
  }

  if (weaponResonanceCharacterPickerGrid instanceof HTMLElement) {
    weaponResonanceCharacterPickerGrid.addEventListener('click', app.handleCharacterPickerClick);
  }

  if (weaponResonanceCharacterPickerConfirmButton instanceof HTMLButtonElement) {
    weaponResonanceCharacterPickerConfirmButton.addEventListener('click', () => {
      app.closeCharacterPickerModal(true);
    });
  }

  if (weaponResonanceCharacterPickerModal instanceof HTMLElement) {
    weaponResonanceCharacterPickerModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === weaponResonanceCharacterPickerModal || target.classList.contains('login-modal-backdrop')) {
        app.closeCharacterPickerModal(false);
      }
    });

    weaponResonanceCharacterPickerModal.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('[data-character-picker-id]')) {
        event.preventDefault();
        app.closeCharacterPickerModal(true);
      }
    });
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
    weaponOverrunPickerModal.addEventListener('mouseover', app.handleWeaponDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('mouseout', app.handleWeaponDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('mousemove', app.handleWeaponDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('focusin', app.handleWeaponDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('focusout', app.handleWeaponDetailTooltipEvent);
    weaponOverrunPickerModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === weaponOverrunPickerModal || target.classList.contains('login-modal-backdrop')) {
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
