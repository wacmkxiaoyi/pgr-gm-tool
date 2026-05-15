import { app } from '../../shared.js';

const { dom, state } = app;
const {
  equipDetailCard,
  equipDetailIcon,
  equipDetailName,
  equipDetailType,
  equipDetailStar,
  equipDetailDescriptionSection,
  equipDetailDescription,
  weaponDetailSkillSection,
  weaponDetailSkillName,
  weaponDetailSkillDescription,
  equipDetailBreakthrough,
  equipDetailLevel,
  equipDetailExp,
  equipDetailResonanceSection,
  equipDetailResonanceBody,
  weaponDetailOverrunSection,
  weaponDetailOverrunContent,
} = dom;

const equipDetailAwakeHeader = document.querySelector('#equip-detail-awake-header');
const equipDetailResonanceTable = equipDetailResonanceSection instanceof HTMLElement
  ? equipDetailResonanceSection.querySelector('.equip-detail-resonance-table')
  : null;

const detailViewRegistry = {
  shared: {
    card: equipDetailCard,
    icon: equipDetailIcon,
    name: equipDetailName,
    type: equipDetailType,
    star: equipDetailStar,
    descriptionSection: equipDetailDescriptionSection,
    description: equipDetailDescription,
    skillSection: weaponDetailSkillSection,
    skillName: weaponDetailSkillName,
    skillDescription: weaponDetailSkillDescription,
    breakthrough: equipDetailBreakthrough,
    level: equipDetailLevel,
    exp: equipDetailExp,
    resonanceSection: equipDetailResonanceSection,
    resonanceBody: equipDetailResonanceBody,
    resonanceTable: equipDetailResonanceTable,
    awakeHeader: equipDetailAwakeHeader,
    overrunSection: weaponDetailOverrunSection,
    overrunContent: weaponDetailOverrunContent,
  },
};

app.getEquipNameByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return '--';
  }

  const name = state.equipNameMap?.[templateId];
  return typeof name === 'string' && name.trim() ? name : '--';
};

app.getEquipStarByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return null;
  }

  const star = state.equipStarMap?.[templateId];
  return Number.isFinite(Number(star)) ? Math.max(0, Number(star)) : null;
};

app.getEquipIconByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return '';
  }

  const url = state.equipIconUrlMap?.[templateId];
  return typeof url === 'string' ? url : '';
};

app.renderEquipMediaCell = (iconUrl, label, showFallback = true, extraClass = '') => {
  const safeLabel = typeof label === 'string' && label.trim() ? label.trim() : '--';
  const escapedLabel = app.escapeHtml(safeLabel);
  const imgClass = `equip-management-icon${extraClass ? ` ${extraClass}` : ''}`;
  return `
    <div class="equip-management-media-cell">
      ${iconUrl ? `<img class="${imgClass}" src=".${iconUrl}" alt="${escapedLabel}">` : (showFallback ? '<span class="equip-management-icon equip-management-icon-fallback" aria-hidden="true"></span>' : '')}
      <span>${escapedLabel}</span>
    </div>
  `;
};

app.renderEquipStar = (templateId) => {
  const star = app.getEquipStarByTemplateId(templateId);
  if (!Number.isFinite(star) || star <= 0) {
    return '<span class="equip-management-star is-empty">--</span>';
  }

  return `<span class="equip-management-star equip-star-tier-${star}">${'★'.repeat(star)}</span>`;
};

app.getEquipEnhancementLevel = (item) => {
  const cachedEnhancementLevel = Number(item?.EnhancementLevel);
  if (Number.isFinite(cachedEnhancementLevel)) {
    return Math.max(0, cachedEnhancementLevel);
  }

  return null;
};

app.renderEquipEnhancementLevel = (item) => {
  const enhancementLevel = app.getEquipEnhancementLevel(item);
  if (!Number.isFinite(enhancementLevel)) {
    return '<span class="equip-management-enhancement is-empty">--</span>';
  }

  const breakthrough = Number.isFinite(Number(item?.Breakthrough)) ? Math.max(0, Number(item.Breakthrough)) : 0;
  const colorTier = Math.min(Math.max(breakthrough, 0), 4);
  return `<span class="equip-management-enhancement equip-enhancement-tier-${colorTier}">${enhancementLevel}</span>`;
};

app.hasEquipResonanceConfig = (templateId) => {
  if (!Number.isFinite(Number(templateId))) {
    return false;
  }

  const resonanceMap = state.equipResonanceMap;
  return resonanceMap && typeof resonanceMap === 'object'
    ? Object.prototype.hasOwnProperty.call(resonanceMap, templateId)
    : false;
};

app.getCurrentEquipDetailRecordId = () => {
  const recordId = Number(state.currentEquipDetailItem?._id ?? state.currentEquipDetailItem?.record_id);
  return Number.isFinite(recordId) && recordId > 0 ? recordId : null;
};

app.getEquipDetailView = (viewKey = 'shared') => detailViewRegistry[viewKey] || detailViewRegistry.shared;

app.getEquipDetailSourceItems = (source = state.currentEquipDetailSource) => {
  if (source === 'memory-management') {
    return Array.isArray(state.memoryManagementItems) ? state.memoryManagementItems : [];
  }

  if (source === 'character-memory-switch') {
    return Array.isArray(state.characterMemorySwitchItems) ? state.characterMemorySwitchItems : [];
  }

  if (source === 'character-weapon-switch') {
    return Array.isArray(state.characterWeaponSwitchItems) ? state.characterWeaponSwitchItems : [];
  }

  return Array.isArray(state.weaponManagementItems) ? state.weaponManagementItems : [];
};

app.setEquipDetailSourceItems = (items, source = state.currentEquipDetailSource) => {
  if (!Array.isArray(items)) {
    return;
  }

  if (source === 'memory-management') {
    state.memoryManagementItems = items;
    return;
  }

  if (source === 'character-memory-switch') {
    state.characterMemorySwitchItems = items;
    return;
  }

  if (source === 'character-weapon-switch') {
    state.characterWeaponSwitchItems = items;
    return;
  }

  state.weaponManagementItems = items;
};

app.replaceEquipDetailSourceItem = (recordId, nextItem, source = state.currentEquipDetailSource) => {
  const items = app.getEquipDetailSourceItems(source);
  const nextRecordId = Number(recordId);
  if (!Number.isFinite(nextRecordId) || !items.length || !nextItem || typeof nextItem !== 'object') {
    return false;
  }

  const index = items.findIndex((item) => Number(item?._id ?? item?.record_id) === nextRecordId);
  if (index < 0) {
    return false;
  }

  const nextItems = [...items];
  nextItems[index] = nextItem;
  app.setEquipDetailSourceItems(nextItems, source);
  return true;
};

app.findEquipDetailItemBySource = (recordId, source, equipType) => {
  const nextRecordId = Number(recordId);
  if (!Number.isFinite(nextRecordId) || nextRecordId <= 0) {
    return null;
  }

  const resolvedSource = source || (equipType === 'memory' ? 'memory-management' : 'equip-management');
  const items = app.getEquipDetailSourceItems(resolvedSource);
  return items.find((item) => Number(item?._id ?? item?.record_id) === nextRecordId) ?? null;
};

app.openEquipDetailModal = ({ recordId, equipType = 'weapon', source = null, trigger = null }) => {
  const item = app.findEquipDetailItemBySource(recordId, source, equipType);
  if (!item) {
    return false;
  }

  state.currentEquipDetailMode = equipType === 'memory' ? 'memory' : 'weapon';
  state.currentEquipDetailSource = source || (state.currentEquipDetailMode === 'memory' ? 'memory-management' : 'equip-management');
  state.lastEquipDetailTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  state.currentEquipDetailItem = item;
  state.currentEquipDetailExtraInfo = null;
  app.populateEquipDetailCard(item, {
    viewKey: 'shared',
    detailMode: 'editable',
    source: state.currentEquipDetailSource,
  });
  return true;
};

app.getEquipDetailConfig = (options = {}) => {
  const detailMode = options.detailMode || 'editable';
  const equipType = options.equipType || (state.currentEquipDetailMode === 'memory' ? 'memory' : 'weapon');
  const extraInfo = options.extraInfo && typeof options.extraInfo === 'object'
    ? options.extraInfo
    : (state.currentEquipDetailExtraInfo && typeof state.currentEquipDetailExtraInfo === 'object' ? state.currentEquipDetailExtraInfo : {});
  const templateId = options.item?.TemplateId ?? null;
  const slotCount = options.slotCount ?? (equipType === 'memory' ? 2 : 3);
  const hasAwakeConfig = app.hasEquipAwakeSlotConfig(extraInfo);
  const hasResonanceInfo = extraInfo && Object.prototype.hasOwnProperty.call(extraInfo, 'resonance_info');
  const hasResonanceConfig = options.showResonance === undefined
    ? (hasResonanceInfo && app.hasEquipResonanceConfig(templateId))
    : Boolean(options.showResonance);

  return {
    detailMode,
    equipType,
    viewKey: options.viewKey || 'shared',
    source: options.source || state.currentEquipDetailSource,
    slotCount,
    showDescription: options.showDescription !== false,
    showSkill: options.showSkill ?? (equipType === 'weapon'),
    showResonance: hasResonanceConfig,
    showAwake: options.showAwake ?? hasAwakeConfig,
    showOverrun: options.showOverrun ?? (equipType === 'weapon' && Object.prototype.hasOwnProperty.call(extraInfo, 'weapon_overrun_data')),
    showResonanceActions: options.showResonanceActions ?? (detailMode === 'editable'),
    editableFields: options.editableFields ?? (detailMode === 'editable'),
    editableResonance: options.editableResonance ?? (detailMode === 'editable'),
  };
};

app.renderEquipDetailResonanceRows = (item, extraInfo, config) => {
  const isMemoryMode = config.equipType === 'memory';
  const resonanceInfo = Array.isArray(extraInfo?.resonance_info) ? extraInfo.resonance_info : [];
  const awakeSlots = Array.isArray(extraInfo?.awake_slot_list) ? extraInfo.awake_slot_list.map((value) => Number(value)) : [];
  const slots = Array.from({ length: config.slotCount }, (_, index) => index + 1);
  const unselectedLabel = app.translate('common.unselected');

  return slots.map((slot) => {
    const entry = resonanceInfo.find((value) => Number(value?.slot) === slot) ?? null;
    const slotText = app.getEquipResonanceSlotLabel(slot, isMemoryMode);
    let effectText = '--';
    let characterText = '--';
    let awakeText = '--';
    const isEditing = config.editableResonance && Boolean(state._equipResonanceEditSlots?.[slot]);
    const effectState = app.getEffectiveEquipResonanceEffectSelection(slot);
    const canDelete = config.editableResonance ? app.hasEquipResonanceSlotData(slot) : false;

    let effectName = null;
    let effectDescription = '';
    if (isEditing) {
      effectName = effectState.effect?.name || unselectedLabel;
      effectDescription = effectState.effect?.description || '';
    } else if (entry) {
      const effectInfo = app.resolveResonanceEffectInfo(entry);
      effectName = effectInfo?.Name ? effectInfo.Name : app.translate('dashboard.unknown');
      effectDescription = app.stripMarkupText(effectInfo?.Description);
    }

    if (effectName) {
      const escapedEffectName = app.escapeHtml(effectName);
      const escapedEffectDescription = app.escapeHtml(effectDescription);
      effectText = effectDescription
        ? `<span class="equip-detail-effect-name" data-effect-description="${escapedEffectDescription}"${isEditing ? ' data-resonance-edit-effect' : ''} tabindex="0">${escapedEffectName}</span>`
        : `<span class="equip-detail-effect-name"${isEditing ? ' data-resonance-edit-effect' : ''} tabindex="0">${escapedEffectName}</span>`;
    }

    {
      const pendingCharacterId = state._equipResonancePendingCharacter?.[slot];
      const effectiveCharacterId = isEditing && pendingCharacterId != null
        ? Number(pendingCharacterId)
        : Number(entry?.character_id);
      const noAvatar = !Number.isFinite(effectiveCharacterId) || effectiveCharacterId === 0;
      const characterName = isEditing && noAvatar
        ? unselectedLabel
        : app.getCharacterNameByCharacterId(effectiveCharacterId);
      const characterIconUrl = app.getCharacterIconByCharacterId(effectiveCharacterId);

      if (isEditing) {
        const mediaCell = app.renderEquipMediaCell(characterIconUrl, characterName, !noAvatar);
        characterText = `<span class="equip-detail-bound-char is-editable" data-resonance-bind-char tabindex="0" role="button">${mediaCell}</span>`;
      } else {
        characterText = app.renderEquipMediaCell(characterIconUrl, characterName, !noAvatar);
      }
    }

    if (config.showAwake) {
      if (config.editableResonance) {
        awakeText = app.renderEquipResonanceAwakeCellContent(slot, extraInfo);
      } else if (entry) {
        const awakeChecked = awakeSlots.includes(slot);
        awakeText = `<span class="equip-detail-awake-indicator ${awakeChecked ? 'is-checked' : 'is-crossed'}">${awakeChecked ? '✓' : '×'}</span>`;
      }
    }

  const actionCell = config.showResonanceActions
      ? `
        <td>
          <div class="equip-detail-resonance-actions">
            ${isEditing ? `
            <button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-cancel" type="button" data-resonance-action="cancel-editing">${app.translate('dashboard.equipDetailResonanceCancel')}</button>
             <button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-save" type="button" data-resonance-action="save-resonance" ${app.canSaveEquipResonanceSlot(slot) ? '' : 'disabled'}>${app.translate('dashboard.equipDetailResonanceSave')}</button>
            ` : `
            <button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-edit" type="button" data-resonance-action="start-editing">${app.translate('dashboard.equipDetailResonanceEdit')}</button>
            <button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-delete" type="button" data-resonance-action="delete-resonance" ${canDelete ? '' : 'disabled'}>${app.translate('dashboard.equipDetailResonanceDelete')}</button>
            `}
          </div>
        </td>`
      : '';

    return `
      <tr class="${isEditing ? 'resonance-row-editing' : ''}" data-resonance-slot="${slot}">
        <td>${slotText}</td>
        <td>${effectText}</td>
        <td>${characterText}</td>
        ${config.showAwake ? `<td>${awakeText}</td>` : ''}
        ${actionCell}
      </tr>
    `;
  }).join('');
};

app.populateEquipDetailCard = (item, options = {}) => {
  const extraInfo = options.extraInfo && typeof options.extraInfo === 'object'
    ? options.extraInfo
    : (state.currentEquipDetailExtraInfo && typeof state.currentEquipDetailExtraInfo === 'object' ? state.currentEquipDetailExtraInfo : {});
  const config = app.getEquipDetailConfig({ ...options, item, extraInfo });
  const view = app.getEquipDetailView(config.viewKey);
  const templateId = item?.TemplateId ?? null;
  const breakthrough = Number.isFinite(Number(item?.Breakthrough)) ? Math.max(0, Number(item.Breakthrough)) : 0;
  const level = Number.isFinite(Number(item?.Level)) ? Number(item.Level) : null;
  const currentLevelExp = Number.isFinite(Number(item?.Exp)) ? Number(item.Exp) : null;
  const currentLevelExpLimit = Number.isFinite(Number(extraInfo?.current_level_exp_limit)) ? Number(extraInfo.current_level_exp_limit) : null;
  const star = app.getEquipStarByTemplateId(templateId);
  const iconUrl = app.getEquipIconByTemplateId(templateId);
  const equipName = app.getEquipNameByTemplateId(templateId);
  const hasValidStar = Number.isFinite(star) && star >= 2 && star <= 6;
  const btTier = Math.min(Math.max(breakthrough, 0), 4);
  const equipDescription = app.stripMarkupText(extraInfo?.description || '');
  const hasDescription = config.showDescription && Boolean(equipDescription);
  const skillName = app.resolveWeaponSkillName(templateId);
  const skillDescription = app.stripMarkupText(app.resolveWeaponSkillDescription(templateId));
  const hasSkill = config.showSkill && Boolean(skillName);
  const stageMap = extraInfo?.breakthrough_level_limit_map && typeof extraInfo.breakthrough_level_limit_map === 'object'
    ? extraInfo.breakthrough_level_limit_map
    : null;
  const maxBreakthrough = app.getMaxNumericMapKey(stageMap);
  const currentBreakthroughLevelLimit = Number.isFinite(Number(stageMap?.[breakthrough]))
    ? Number(stageMap[breakthrough])
    : null;
  const maxBreakthroughTier = Math.min(Math.max(Number.isFinite(maxBreakthrough) ? maxBreakthrough : 0, 0), 4);

  state.currentEquipDetailItem = item;
  state.currentEquipDetailExtraInfo = extraInfo;
  state.currentEquipDetailMode = config.equipType;
  state.currentEquipDetailSource = config.source || state.currentEquipDetailSource;

  if (view.awakeHeader instanceof HTMLElement) {
    view.awakeHeader.hidden = !config.showAwake;
  }

  if (view.resonanceTable instanceof HTMLElement) {
    view.resonanceTable.classList.toggle('has-awake-column', config.showAwake);
    view.resonanceTable.classList.toggle('has-actions-column', config.showResonanceActions);
  }

  if (view.card instanceof HTMLElement) {
    if (hasValidStar) {
      view.card.dataset.starTier = String(star);
      view.card.dataset.btTier = String(btTier);
    } else {
      delete view.card.dataset.starTier;
      delete view.card.dataset.btTier;
    }
  }

  if (view.icon instanceof HTMLImageElement) {
    view.icon.src = iconUrl ? `.${iconUrl}` : '';
    view.icon.alt = equipName;
  }
  if (view.name instanceof HTMLElement) {
    view.name.textContent = equipName;
  }
  if (view.type instanceof HTMLElement) {
    const typeName = config.equipType === 'memory' ? app.getMemoryPositionByTemplateId(templateId) : app.getWeaponTypeByTemplateId(templateId);
    if (config.equipType === 'memory') {
      const positionLabel = app.translate('dashboard.memoryManagementPosition');
      view.type.textContent = `[${positionLabel}: ${typeName}]`;
    } else {
      view.type.textContent = `[${typeName}]`;
    }
  }
  if (view.star instanceof HTMLElement) {
    if (hasValidStar) {
      view.star.textContent = '★'.repeat(star);
      view.star.className = `equip-detail-star equip-detail-star-tier-${star}`;
      view.star.style.color = '';
    } else {
      view.star.textContent = '--';
      view.star.className = 'equip-detail-star';
      view.star.style.color = 'var(--muted)';
    }
  }
  if (view.descriptionSection instanceof HTMLElement) {
    view.descriptionSection.hidden = !hasDescription;
  }
  if (view.description instanceof HTMLElement) {
    view.description.textContent = hasDescription ? equipDescription : '';
  }
  if (view.skillSection instanceof HTMLElement) {
    view.skillSection.hidden = !hasSkill;
  }
  if (view.skillName instanceof HTMLElement) {
    view.skillName.textContent = hasSkill ? skillName : '--';
  }
  if (view.skillDescription instanceof HTMLElement) {
    view.skillDescription.textContent = hasSkill ? (skillDescription || app.translate('dashboard.equipDetailNoSkill')) : '--';
  }
  if (view.breakthrough instanceof HTMLElement) {
    view.breakthrough.innerHTML = app.renderCompositeStatValue({
      currentValue: breakthrough,
      maxValue: maxBreakthrough,
      currentClass: `equip-detail-bt-tier-${btTier}`,
      maxClass: Number.isFinite(maxBreakthrough) ? `equip-detail-bt-tier-${maxBreakthroughTier}` : '',
    });
    if (config.editableFields) {
      view.breakthrough.className = 'equip-detail-stat-value is-editable';
      view.breakthrough.setAttribute('tabindex', '0');
      view.breakthrough.setAttribute('role', 'button');
    } else {
      view.breakthrough.className = 'equip-detail-stat-value';
      view.breakthrough.removeAttribute('tabindex');
      view.breakthrough.removeAttribute('role');
    }
    view.breakthrough.dataset.equipBtMax = Number.isFinite(maxBreakthrough) ? String(maxBreakthrough) : '0';
    view.breakthrough.dataset.equipBtCurrent = String(breakthrough);
  }
  if (view.level instanceof HTMLElement) {
    view.level.innerHTML = app.renderCompositeStatValue({ currentValue: level, maxValue: currentBreakthroughLevelLimit });
    if (config.editableFields) {
      view.level.className = 'equip-detail-stat-value is-editable';
      view.level.setAttribute('tabindex', level !== null ? '0' : '-1');
      view.level.setAttribute('role', level !== null ? 'button' : '');
    } else {
      view.level.className = 'equip-detail-stat-value';
      view.level.removeAttribute('tabindex');
      view.level.removeAttribute('role');
    }
    view.level.dataset.equipLevelMin = '1';
    view.level.dataset.equipLevelMax = Number.isFinite(currentBreakthroughLevelLimit) ? String(currentBreakthroughLevelLimit) : '0';
    view.level.dataset.equipLevelCurrent = level !== null ? String(level) : '';
  }
  if (view.exp instanceof HTMLElement) {
    if (currentLevelExp !== null && currentLevelExpLimit !== null) {
      view.exp.textContent = `${currentLevelExp} / ${currentLevelExpLimit}`;
      const btStageMap = extraInfo?.breakthrough_level_limit_map;
      const currentLevelLimit = btStageMap?.[breakthrough];
      const isMaxLevel = Number.isFinite(Number(currentLevelLimit)) && level === Number(currentLevelLimit);
      view.exp.dataset.equipExpMax = String(currentLevelExpLimit - (isMaxLevel ? 0 : 1));
    } else {
      view.exp.textContent = '--';
      view.exp.dataset.equipExpMax = '0';
    }
    if (config.editableFields) {
      view.exp.className = 'equip-detail-stat-value is-editable';
      const hasValidExp = currentLevelExp !== null;
      view.exp.setAttribute('tabindex', hasValidExp ? '0' : '-1');
      view.exp.setAttribute('role', hasValidExp ? 'button' : '');
    } else {
      view.exp.className = 'equip-detail-stat-value';
      view.exp.removeAttribute('tabindex');
      view.exp.removeAttribute('role');
    }
    view.exp.dataset.equipExpCurrent = currentLevelExp !== null ? String(currentLevelExp) : '';
  }
  if (view.resonanceSection instanceof HTMLElement) {
    view.resonanceSection.hidden = !config.showResonance;
  }
  if (view.resonanceBody instanceof HTMLElement) {
    view.resonanceBody.innerHTML = config.showResonance ? app.renderEquipDetailResonanceRows(item, extraInfo, config) : '';
  }
  if (view.overrunSection instanceof HTMLElement) {
    view.overrunSection.hidden = !config.showOverrun;
  }
  if (view.overrunContent instanceof HTMLElement) {
    if (config.showOverrun && config.equipType === 'weapon') {
      app.renderWeaponOverrunContentInto(view.overrunContent, extraInfo, {
        editable: config.viewKey === 'shared' && config.detailMode === 'editable',
      });
    } else {
      view.overrunContent.className = 'weapon-detail-overrun';
      view.overrunContent.textContent = '--';
      view.overrunContent.removeAttribute('tabindex');
      view.overrunContent.removeAttribute('role');
      delete view.overrunContent.dataset.overrunEditable;
    }
  }
};
