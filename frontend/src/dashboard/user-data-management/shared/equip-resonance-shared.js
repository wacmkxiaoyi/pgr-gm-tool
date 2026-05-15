import { app } from '../../shared.js';

const { dom, state } = app;
const {
  equipDetailModal,
  equipDetailResonanceBody,
  equipDetailTooltip,
  resonanceEffectTooltip,
  weaponResonanceCharacterPickerModal,
  weaponResonanceCharacterPickerSummary,
  weaponResonanceCharacterPickerGrid,
  weaponResonanceCharacterPickerConfirmButton,
  weaponResonanceCharacterPickerCloseTargets,
} = dom;

const EQUIP_DETAIL_TOOLTIP_DELAY_MS = 500;

app.buildEquipResonanceResolveIndices = () => {
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

  const characterSkillByCharTemplate = {};
  const characterSkillPoolEntriesMap = state.characterSkillPoolEntriesMap || {};
  for (const entriesByCharacter of Object.values(characterSkillPoolEntriesMap)) {
    if (typeof entriesByCharacter !== 'object' || entriesByCharacter === null) continue;
    for (const [charIdRaw, entries] of Object.entries(entriesByCharacter)) {
      const charId = Number(charIdRaw);
      if (!Number.isFinite(charId) || !Array.isArray(entries)) continue;
      for (const entry of entries) {
        const tid = Number(entry?.TemplateId);
        if (!Number.isFinite(tid)) continue;
        const key = `${charId}_${tid}`;
        characterSkillByCharTemplate[key] = {
          Name: String(entry?.Name || '').trim(),
          Description: String(entry?.Description || '').trim(),
        };
      }
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
  state._characterSkillByCharTemplate = characterSkillByCharTemplate;
  state._weaponSkillByCharTemplate = weaponSkillByCharTemplate;
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
    if (!Number.isFinite(characterId)) return null;
    const key = `${characterId}_${templateId}`;
    return state._characterSkillByCharTemplate?.[key] || null;
  }

  if (type === 3) {
    if (!Number.isFinite(characterId)) return null;
    const key = `${characterId}_${templateId}`;
    return state._weaponSkillByCharTemplate?.[key] || null;
  }

  return null;
};

app.getPendingEquipResonanceEffectState = (slot) => {
  const pendingEffectMap = state._equipResonancePendingEffect;
  if (!pendingEffectMap || !Object.prototype.hasOwnProperty.call(pendingEffectMap, slot)) {
    return { hasPending: false, effect: null };
  }

  const pendingEffect = pendingEffectMap[slot];
  return {
    hasPending: true,
    effect: pendingEffect && typeof pendingEffect === 'object' ? pendingEffect : null,
  };
};

app.getEffectiveEquipResonanceEffectSelection = (slot) => {
  const pendingState = app.getPendingEquipResonanceEffectState(slot);
  if (pendingState.hasPending) {
    return pendingState;
  }

  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
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

app.hasEquipResonanceSlotData = (slot) => {
  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
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

app.canSaveEquipResonanceSlot = (slot) => {
  if (!state._equipResonanceEditSlots?.[slot]) {
    return true;
  }

  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharacterId = state._equipResonancePendingCharacter?.[slot];
  const characterId = pendingCharacterId != null
    ? Number(pendingCharacterId)
    : Number(entry?.character_id);
  if (!Number.isFinite(characterId)) {
    return false;
  }

  const effectState = app.getEffectiveEquipResonanceEffectSelection(slot);
  return Number.isFinite(Number(effectState.effect?.type))
    && Number.isFinite(Number(effectState.effect?.template_id));
};

app.getEquipAwakeSlotList = (extraInfo = state.currentEquipDetailExtraInfo) => {
  return Array.isArray(extraInfo?.awake_slot_list)
    ? extraInfo.awake_slot_list
      .map((slot) => Number(slot))
      .filter((slot) => Number.isFinite(slot))
    : [];
};

app.hasEquipAwakeSlotConfig = (extraInfo = state.currentEquipDetailExtraInfo) => Object.prototype.hasOwnProperty.call(extraInfo || {}, 'awake_slot_list');

app.getEffectiveEquipResonanceAwakeState = (slot) => {
  if (state._equipResonancePendingAwake && Object.prototype.hasOwnProperty.call(state._equipResonancePendingAwake, slot)) {
    return Boolean(state._equipResonancePendingAwake[slot]);
  }

  return app.getEquipAwakeSlotList().includes(Number(slot));
};

app.getEquipResonanceSlotLabel = (slot, isMemoryMode = state.currentEquipDetailMode === 'memory') => {
  const normalizedSlot = Number(slot);

  if (isMemoryMode) {
    return normalizedSlot === 1
      ? app.translate('dashboard.equipDetailSlotTop')
      : app.translate('dashboard.equipDetailSlotBottom');
  }

  if (normalizedSlot === 1) {
    return app.translate('dashboard.equipDetailSlotTop');
  }

  if (normalizedSlot === 2) {
    return app.translate('dashboard.equipDetailSlotMiddle');
  }

  return app.translate('dashboard.equipDetailSlotBottom');
};

app.renderEquipResonanceAwakeCellContent = (slot) => {
  if (!app.hasEquipAwakeSlotConfig()) {
    return '--';
  }

  const isEditing = state._equipResonanceEditSlots?.[slot];
  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;

  const checked = app.getEffectiveEquipResonanceAwakeState(slot);
  if (isEditing) {
    return `<label class="equip-detail-awake-toggle"><input class="equip-detail-awake-checkbox" type="checkbox" data-resonance-awake-toggle ${checked ? 'checked' : ''}><span>${checked ? '✓' : ''}</span></label>`;
  }

  if (!entry) {
    return '--';
  }

  return `<span class="equip-detail-awake-indicator ${checked ? 'is-checked' : 'is-crossed'}" aria-label="${checked ? 'checked' : 'crossed'}">${checked ? '✓' : '×'}</span>`;
};

app.renderEquipResonanceAwakeCell = (slot) => {
  if (!app.hasEquipAwakeSlotConfig()) return;
  if (!(equipDetailResonanceBody instanceof HTMLElement)) return;
  const row = equipDetailResonanceBody.querySelector(`tr[data-resonance-slot="${slot}"]`);
  if (!(row instanceof HTMLElement)) return;
  const awakeCell = row.querySelector('td:nth-child(4)');
  if (!(awakeCell instanceof HTMLElement)) return;
  awakeCell.innerHTML = app.renderEquipResonanceAwakeCellContent(slot);
};

app.buildEquipResonanceEffectCatalog = (equipTemplateId, characterId, slot) => {
  const resonanceData = state.equipResonanceMap?.[equipTemplateId];
  if (!Array.isArray(resonanceData) || resonanceData.length < 3) {
    return [];
  }

  const slotIndex = Number(slot) - 1;
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    return [];
  }

  const seen = new Set();
  const catalog = [];
  const addIfNew = (item) => {
    const key = `${item.type}_${item.template_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    catalog.push(item);
  };

  const normalizedCharacterId = Number(characterId);

  const attribPoolId = Number(resonanceData[0]?.[slotIndex]);
  if (Number.isFinite(attribPoolId)) {
    const entries = state.attribPoolEntriesMap?.[attribPoolId];
    if (Array.isArray(entries)) {
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
  }

  const charSkillPoolId = Number(resonanceData[1]?.[slotIndex]);
  if (Number.isFinite(charSkillPoolId)) {
    const entries = state.characterSkillPoolEntriesMap?.[charSkillPoolId]?.[normalizedCharacterId];
    if (Array.isArray(entries)) {
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
  }

  const weaponSkillPoolId = Number(resonanceData[2]?.[slotIndex]);
  if (Number.isFinite(normalizedCharacterId) && Number.isFinite(weaponSkillPoolId)) {
    const poolEntries = state.weaponSkillPoolEntriesMap?.[weaponSkillPoolId];
    if (poolEntries && typeof poolEntries === 'object') {
      const skillIds = poolEntries[normalizedCharacterId];
      if (Array.isArray(skillIds)) {
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
  }

  return catalog;
};

app.getEquipResonanceEffectModalDom = () => {
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

app.renderEquipResonanceEffectModalRows = () => {
  const els = app.getEquipResonanceEffectModalDom();
  if (!(els.tableBody instanceof HTMLElement) || !(els.emptyState instanceof HTMLElement)) {
    return;
  }

  const currentItem = state.currentEquipDetailItem;
  const slot = state._resonanceEffectModalActiveSlot;
  if (currentItem == null || !Number.isFinite(slot)) {
    els.tableBody.innerHTML = '';
    els.emptyState.hidden = false;
    return;
  }

  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharacterId = state._equipResonancePendingCharacter?.[slot];
  const characterId = pendingCharacterId != null
    ? Number(pendingCharacterId)
    : Number(entry?.character_id);
  if (!Number.isFinite(characterId)) {
    els.tableBody.innerHTML = '';
    els.emptyState.hidden = false;
    return;
  }

  const catalog = app.buildEquipResonanceEffectCatalog(Number(currentItem.TemplateId), characterId, slot);
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

app.syncEquipResonanceEffectSortArrow = () => {
  const els = app.getEquipResonanceEffectModalDom();
  if (els.sortArrow instanceof HTMLElement) {
    els.sortArrow.classList.toggle('desc', state._resonanceEffectModalSortOrder === 'desc');
  }
};

app.openEquipResonanceEffectModal = (slot) => {
  if (!Number.isFinite(slot)) return;

  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharId = state._equipResonancePendingCharacter?.[slot];
  const characterId = pendingCharId != null
    ? Number(pendingCharId)
    : Number(entry?.character_id);
  if (!Number.isFinite(characterId)) {
    app.openNoticeModal(app.translate('dashboard.equipDetailResonanceBindCharFirst'), { title: app.translate('dashboard.equipDetailCannotSelect'), tone: 'error' });
    return;
  }

  const currentItem = state.currentEquipDetailItem;
  if (currentItem == null || !Number.isFinite(Number(currentItem.TemplateId))) {
    app.openNoticeModal(app.translate('dashboard.equipDetailCannotGetEquipInfo'), { title: app.translate('dashboard.equipDetailError'), tone: 'error' });
    return;
  }

  state._resonanceEffectModalActiveSlot = slot;
  state._resonanceEffectModalSearchKeyword = '';
  state._resonanceEffectModalSortOrder = 'asc';
  const pendingState = app.getPendingEquipResonanceEffectState(slot);
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

  const els = app.getEquipResonanceEffectModalDom();
  if (els.searchInput instanceof HTMLInputElement) {
    els.searchInput.value = '';
  }
  app.syncEquipResonanceEffectSortArrow();
  app.renderEquipResonanceEffectModalRows();

  if (els.modal instanceof HTMLElement) {
    els.modal.hidden = false;
    app.setBodyModalOpen(true);
    if (els.searchInput instanceof HTMLInputElement) {
      els.searchInput.focus();
    }
  }
};

app.closeEquipResonanceEffectModal = (confirm) => {
  if (confirm) {
    const selected = state._resonanceEffectModalSelectedEntry;
    const slot = state._resonanceEffectModalActiveSlot;
    if (selected != null && Number.isFinite(slot)) {
      if (!state._equipResonancePendingEffect) {
        state._equipResonancePendingEffect = {};
      }
      state._equipResonancePendingEffect[slot] = {
        type: Number(selected.type),
        template_id: Number(selected.template_id),
        name: selected.name,
        description: selected.description,
      };
      app.renderEquipResonanceEffectCell(slot);
      app.renderEquipResonanceRowActionCell(slot);
    }
  }

  const els = app.getEquipResonanceEffectModalDom();
  app.hideResonanceDescriptionTooltip();
  if (els.modal instanceof HTMLElement) {
    els.modal.hidden = true;
  }
  if (!(equipDetailModal instanceof HTMLElement) || equipDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
  state._resonanceEffectModalActiveSlot = null;
  state._resonanceEffectModalSearchKeyword = '';
  state._resonanceEffectModalSelectedEntry = null;
};

app.renderEquipResonanceEffectCell = (slot) => {
  if (!(equipDetailResonanceBody instanceof HTMLElement)) return;
  const row = equipDetailResonanceBody.querySelector(`tr[data-resonance-slot="${slot}"]`);
  if (!(row instanceof HTMLElement)) return;
  const effectCell = row.querySelector('td:nth-child(2)');
  if (!(effectCell instanceof HTMLElement)) return;

  const isEditing = state._equipResonanceEditSlots?.[slot];
  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const effectState = app.getEffectiveEquipResonanceEffectSelection(slot);
  const unselectedLabel = app.translate('common.unselected');

  let displayName = '--';
  if (isEditing) {
    displayName = effectState.effect?.name || unselectedLabel;
  } else if (entry) {
    const effectInfo = app.resolveResonanceEffectInfo(entry);
    displayName = effectInfo?.Name ? effectInfo.Name : app.translate('dashboard.unknown');
  }

  const escapedName = app.escapeHtml(displayName);
  if (isEditing) {
    const effectDescription = effectState.effect?.description || '';
    const escapedDesc = app.escapeHtml(effectDescription);
    effectCell.innerHTML = effectDescription
      ? `<span class="equip-detail-effect-name" data-resonance-edit-effect data-effect-description="${escapedDesc}" tabindex="0">${escapedName}</span>`
      : `<span class="equip-detail-effect-name" data-resonance-edit-effect tabindex="0">${escapedName}</span>`;
  } else {
    const effectDescription = entry ? app.stripMarkupText(app.resolveResonanceEffectInfo(entry)?.Description) : '';
    const escapedDesc = app.escapeHtml(effectDescription);
    effectCell.innerHTML = entry
      ? (effectDescription
        ? `<span class="equip-detail-effect-name" data-effect-description="${escapedDesc}" tabindex="0">${escapedName}</span>`
        : `<span class="equip-detail-effect-name" tabindex="0">${escapedName}</span>`)
      : escapedName;
  }
};

app.renderEquipResonanceBoundCharacterCell = (slot) => {
  if (!(equipDetailResonanceBody instanceof HTMLElement)) return;
  const row = equipDetailResonanceBody.querySelector(`tr[data-resonance-slot="${slot}"]`);
  if (!(row instanceof HTMLElement)) return;
  const charCell = row.querySelector('td:nth-child(3)');
  if (!(charCell instanceof HTMLElement)) return;

  const isEditing = state._equipResonanceEditSlots?.[slot];
  const pendingCharacterId = state._equipResonancePendingCharacter?.[slot];
  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
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
    const mediaCell = app.renderEquipMediaCell(characterIconUrl, characterName, !noAvatar);
    charCell.innerHTML = `<span class="equip-detail-bound-char is-editable" data-resonance-bind-char tabindex="0" role="button">${mediaCell}</span>`;
  } else {
    charCell.innerHTML = app.renderEquipMediaCell(characterIconUrl, characterName, !noAvatar);
  }
};

app.renderEquipCharacterPickerSummary = () => {
  if (!(weaponResonanceCharacterPickerSummary instanceof HTMLElement)) return;

  const equippedCharacterId = Number(state.currentEquipDetailItem?.CharacterId);
  const hasEquippedCharacter = Number.isFinite(equippedCharacterId) && equippedCharacterId !== 0;

  const selectedCharacterId = Number(state._equipResonanceCharacterPickerSelectedId);
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
        <span class="character-picker-summary-key">${app.escapeHtml(app.translate('dashboard.equipDetailBoundCharacter'))}</span>
        ${renderSummaryValue(app.translate('dashboard.equipDetailCharPickerEquippedCharacter'), app.getCharacterIconByCharacterId(equippedCharacterId), true)}
      </div>
    `);
  }

  rows.push(`
    <div class="character-picker-summary-row">
      <span class="character-picker-summary-key">${app.escapeHtml(app.translate('dashboard.equipDetailCharPickerTitle'))}</span>
      ${renderSummaryValue(selectedCharacterName, selectedCharacterIconUrl)}
    </div>
  `);

  weaponResonanceCharacterPickerSummary.innerHTML = rows.join('');
  weaponResonanceCharacterPickerSummary.hidden = false;
};

app.openEquipCharacterPickerModal = (slot) => {
  if (!Number.isFinite(slot)) return;
  if (!(weaponResonanceCharacterPickerModal instanceof HTMLElement)) return;

  const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
    ? state.currentEquipDetailExtraInfo.resonance_info
    : [];
  const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
  const pendingCharacterId = state._equipResonancePendingCharacter?.[slot];
  const currentCharacterId = pendingCharacterId != null
    ? Number(pendingCharacterId)
    : Number(entry?.character_id);

  state._equipResonanceCharacterPickerSlot = slot;
  state._equipResonanceCharacterPickerSelectedId = Number.isFinite(currentCharacterId) ? currentCharacterId : null;

  app.renderEquipCharacterPickerGrid();
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

app.closeEquipCharacterPickerModal = (confirm) => {
  if (confirm) {
    const selectedId = state._equipResonanceCharacterPickerSelectedId;
    const slot = state._equipResonanceCharacterPickerSlot;
    if (Number.isFinite(selectedId) && Number.isFinite(slot)) {
      if (!state._equipResonancePendingCharacter) {
        state._equipResonancePendingCharacter = {};
      }
      state._equipResonancePendingCharacter[slot] = selectedId;

      const equipTemplateId = Number(state.currentEquipDetailItem?.TemplateId);
      if (Number.isFinite(equipTemplateId)) {
        const catalog = app.buildEquipResonanceEffectCatalog(equipTemplateId, selectedId, slot);
        const effectState = app.getEffectiveEquipResonanceEffectSelection(slot);
        const currentEffect = effectState.effect
          ? { type: Number(effectState.effect.type), template_id: Number(effectState.effect.template_id) }
          : null;
        if (currentEffect) {
          const compatible = catalog.some(
            (item) => Number(item.type) === currentEffect.type && Number(item.template_id) === currentEffect.template_id,
          );
          if (!compatible) {
            if (!state._equipResonancePendingEffect) {
              state._equipResonancePendingEffect = {};
            }
            state._equipResonancePendingEffect[slot] = null;
          }
        }
      }
      app.renderEquipResonanceEffectCell(slot);
      app.renderEquipResonanceBoundCharacterCell(slot);
      app.renderEquipResonanceRowActionCell(slot);
    }
  }

  if (weaponResonanceCharacterPickerModal instanceof HTMLElement) {
    weaponResonanceCharacterPickerModal.hidden = true;
  }
  if (!(equipDetailModal instanceof HTMLElement) || equipDetailModal.hidden) {
    app.setBodyModalOpen(false);
  }
  state._equipResonanceCharacterPickerSlot = null;
  state._equipResonanceCharacterPickerSelectedId = null;
};

app.renderEquipCharacterPickerGrid = () => {
  if (!(weaponResonanceCharacterPickerGrid instanceof HTMLElement)) return;

  const characterNameMap = state.characterLogNameMap || {};
  const characterIconMap = state.characterHeadIconUrlMap || {};
  const selectedId = state._equipResonanceCharacterPickerSelectedId;

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

  app.renderEquipCharacterPickerSummary();

  if (weaponResonanceCharacterPickerConfirmButton instanceof HTMLButtonElement) {
    weaponResonanceCharacterPickerConfirmButton.disabled = !Number.isFinite(selectedId);
  }
};

app.handleEquipCharacterPickerClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest('[data-character-picker-id]');
  if (!(button instanceof HTMLElement)) return;

  const selectedId = Number(button.dataset.characterPickerId);
  if (!Number.isFinite(selectedId)) return;

  state._equipResonanceCharacterPickerSelectedId = selectedId;
  app.renderEquipCharacterPickerGrid();
};

app.handleEquipCharacterPickerSummaryClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const quickSelectButton = target.closest('[data-character-picker-equipment-select]');
  if (!(quickSelectButton instanceof HTMLElement)) return;

  const equippedCharacterId = Number(state.currentEquipDetailItem?.CharacterId);
  if (!Number.isFinite(equippedCharacterId) || equippedCharacterId === 0) return;

  state._equipResonanceCharacterPickerSelectedId = equippedCharacterId;
  app.renderEquipCharacterPickerGrid();
};

app.handleEquipResonanceBoundCharacterClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const charBtn = target.closest('[data-resonance-bind-char]');
  if (!(charBtn instanceof HTMLElement)) return;

  const row = charBtn.closest('tr[data-resonance-slot]');
  if (!(row instanceof HTMLElement)) return;

  const slot = Number(row.dataset.resonanceSlot);
  if (!Number.isFinite(slot)) return;

  app.openEquipCharacterPickerModal(slot);
};

app.hideEquipDetailTooltip = () => {
  if (state.equipDetailTooltipTimer) {
    window.clearTimeout(state.equipDetailTooltipTimer);
    state.equipDetailTooltipTimer = null;
  }

  if (equipDetailTooltip instanceof HTMLElement) {
    if (equipDetailTooltip.parentElement !== document.body) {
      document.body.appendChild(equipDetailTooltip);
    }
    equipDetailTooltip.hidden = true;
    equipDetailTooltip.textContent = '';
  }

  state.equipDetailTooltipTarget = null;
};

app.positionEquipDetailTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(equipDetailTooltip instanceof HTMLElement)) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = equipDetailTooltip.getBoundingClientRect();
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

  equipDetailTooltip.style.left = `${Math.round(left)}px`;
  equipDetailTooltip.style.top = `${Math.round(top)}px`;
};

app.syncEquipDetailTooltipPosition = () => {
  if (!(state.equipDetailTooltipTarget instanceof HTMLElement) || !(equipDetailTooltip instanceof HTMLElement) || equipDetailTooltip.hidden) {
    return;
  }

  app.positionEquipDetailTooltip(state.equipDetailTooltipTarget);
};

app.showEquipDetailTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(equipDetailTooltip instanceof HTMLElement)) {
    return;
  }

  const row = target.closest('tr[data-resonance-slot]');
  if (row instanceof HTMLElement && row.classList.contains('resonance-row-editing')) {
    app.hideEquipDetailTooltip();
    return;
  }

  const description = typeof target.dataset.equipTooltipText === 'string' && target.dataset.equipTooltipText.trim()
    ? target.dataset.equipTooltipText.trim()
    : (typeof target.dataset.effectDescription === 'string'
      ? target.dataset.effectDescription.trim()
      : '');
  if (!description) {
    app.hideEquipDetailTooltip();
    return;
  }

  if (equipDetailTooltip.parentElement !== document.body) {
    document.body.appendChild(equipDetailTooltip);
  }

  equipDetailTooltip.textContent = description;
  equipDetailTooltip.hidden = false;
  equipDetailTooltip.style.left = '0px';
  equipDetailTooltip.style.top = '0px';
  state.equipDetailTooltipTarget = target;
  window.requestAnimationFrame(app.syncEquipDetailTooltipPosition);
};

app.scheduleEquipDetailTooltip = (target) => {
  app.hideEquipDetailTooltip();
  if (!(target instanceof HTMLElement)) {
    return;
  }

  state.equipDetailTooltipTimer = window.setTimeout(() => {
    state.equipDetailTooltipTimer = null;
    app.showEquipDetailTooltip(target);
  }, EQUIP_DETAIL_TOOLTIP_DELAY_MS);
};

app.hideResonanceDescriptionTooltip = () => {
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

app.positionResonanceDescriptionTooltip = () => {
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

app.showResonanceDescriptionTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(resonanceEffectTooltip instanceof HTMLElement)) return;
  const fullDesc = target.getAttribute('data-full-description') || '';
  if (!fullDesc.trim()) {
    app.hideResonanceDescriptionTooltip();
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
    app.positionResonanceDescriptionTooltip();
  });
};

app.scheduleResonanceDescriptionTooltip = (target) => {
  app.hideResonanceDescriptionTooltip();
  if (!(target instanceof HTMLElement)) return;
  state._resonanceDescTooltipTimer = window.setTimeout(() => {
    state._resonanceDescTooltipTimer = null;
    app.showResonanceDescriptionTooltip(target);
  }, EQUIP_DETAIL_TOOLTIP_DELAY_MS);
};

app.handleResonanceDescriptionTooltipEvent = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const descCell = target.closest('.resonance-effect-description');
  if (!(descCell instanceof HTMLElement)) {
    app.hideResonanceDescriptionTooltip();
    return;
  }
  if (event.type === 'mouseover' || event.type === 'focusin') {
    app.scheduleResonanceDescriptionTooltip(descCell);
  } else if (event.type === 'mousemove') {
    if (state._resonanceDescTooltipTarget === descCell && resonanceEffectTooltip instanceof HTMLElement && !resonanceEffectTooltip.hidden) {
      app.positionResonanceDescriptionTooltip();
    }
  } else if (event.type === 'mouseout' || event.type === 'focusout') {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && descCell.contains(relatedTarget)) return;
    app.hideResonanceDescriptionTooltip();
  }
};

app.handleEquipDetailTooltipEvent = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const tooltipTarget = target.closest('.equip-detail-effect-name, [data-equip-tooltip-text]');
  const row = tooltipTarget instanceof HTMLElement ? tooltipTarget.closest('tr[data-resonance-slot]') : null;
  if (row instanceof HTMLElement && row.classList.contains('resonance-row-editing')) {
    app.hideEquipDetailTooltip();
    return;
  }

  if (event.type === 'mouseover' || event.type === 'focusin') {
    if (tooltipTarget instanceof HTMLElement) {
      app.scheduleEquipDetailTooltip(tooltipTarget);
    }
    return;
  }

  if (event.type === 'mousemove') {
    if (tooltipTarget instanceof HTMLElement && state.equipDetailTooltipTarget === tooltipTarget && equipDetailTooltip instanceof HTMLElement && !equipDetailTooltip.hidden) {
      app.syncEquipDetailTooltipPosition();
    }
    return;
  }

  if (event.type === 'mouseout' || event.type === 'focusout') {
    if (!(tooltipTarget instanceof HTMLElement)) {
      app.hideEquipDetailTooltip();
      return;
    }

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && tooltipTarget.contains(relatedTarget)) {
      return;
    }

    app.hideEquipDetailTooltip();
  }
};

app.renderEquipResonanceRowActionCell = (slot) => {
  if (!(equipDetailResonanceBody instanceof HTMLElement)) {
    return;
  }

  const row = equipDetailResonanceBody.querySelector(`tr[data-resonance-slot="${slot}"]`);
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const actionCell = row.querySelector('td:last-child');
  if (!(actionCell instanceof HTMLElement)) {
    return;
  }

  const isEditing = state._equipResonanceEditSlots?.[slot];
  row.classList.toggle('resonance-row-editing', isEditing);
  const canSave = app.canSaveEquipResonanceSlot(slot);
  const canDelete = app.hasEquipResonanceSlotData(slot);

  actionCell.innerHTML = isEditing
    ? `<div class="equip-detail-resonance-actions"><button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-cancel" type="button" data-resonance-action="cancel-editing">${app.translate('dashboard.equipDetailResonanceCancel')}</button><button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-save" type="button" data-resonance-action="save-resonance" ${canSave ? '' : 'disabled'}>${app.translate('dashboard.equipDetailResonanceSave')}</button></div>`
    : `<div class="equip-detail-resonance-actions"><button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-edit" type="button" data-resonance-action="start-editing">${app.translate('dashboard.equipDetailResonanceEdit')}</button><button class="equip-detail-resonance-action-btn equip-detail-resonance-action-btn-delete" type="button" data-resonance-action="delete-resonance" ${canDelete ? '' : 'disabled'}>${app.translate('dashboard.equipDetailResonanceDelete')}</button></div>`;

  app.renderEquipResonanceEffectCell(slot);
  app.renderEquipResonanceBoundCharacterCell(slot);
  app.renderEquipResonanceAwakeCell(slot);
};

app.handleEquipResonanceActionClick = (event) => {
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

  if (!state._equipResonanceEditSlots) {
    state._equipResonanceEditSlots = {};
  }

  if (action === 'start-editing') {
    state._equipResonanceEditSlots[slot] = true;
    if (state._equipResonancePendingEffect) {
      delete state._equipResonancePendingEffect[slot];
    }
    if (state._equipResonancePendingAwake) {
      delete state._equipResonancePendingAwake[slot];
    }
    if (state._equipResonancePendingCharacter) {
      delete state._equipResonancePendingCharacter[slot];
    }
    app.renderEquipResonanceRowActionCell(slot);
    return;
  }

  if (action === 'cancel-editing') {
    delete state._equipResonanceEditSlots[slot];
    if (state._equipResonancePendingEffect) {
      delete state._equipResonancePendingEffect[slot];
    }
    if (state._equipResonancePendingAwake) {
      delete state._equipResonancePendingAwake[slot];
    }
    if (state._equipResonancePendingCharacter) {
      delete state._equipResonancePendingCharacter[slot];
    }
    app.renderEquipResonanceRowActionCell(slot);
    return;
  }

  if (action === 'save-resonance') {
    const resonanceInfo = Array.isArray(state.currentEquipDetailExtraInfo?.resonance_info)
      ? state.currentEquipDetailExtraInfo.resonance_info
      : [];
    const entry = resonanceInfo.find((r) => Number(r?.slot) === slot) ?? null;
    const pendingCharacterId = state._equipResonancePendingCharacter?.[slot];
    const characterId = pendingCharacterId != null
      ? Number(pendingCharacterId)
      : Number(entry?.character_id);
    if (!Number.isFinite(characterId)) {
      app.openNoticeModal(app.translate('dashboard.weaponDetailResonanceBindCharBeforeSave'), { title: app.translate('dashboard.equipDetailCannotSave'), tone: 'error' });
      return;
    }

    const effectState = app.getEffectiveEquipResonanceEffectSelection(slot);
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
      app.openNoticeModal(app.translate('dashboard.weaponDetailResonanceSelectEffectBeforeSave'), { title: app.translate('dashboard.equipDetailCannotSave'), tone: 'error' });
      return;
    }

    const awakeChanged = app.hasEquipAwakeSlotConfig()
      && state._equipResonancePendingAwake
      && Object.prototype.hasOwnProperty.call(state._equipResonancePendingAwake, slot);
    const dataChanged = pendingCharacterId != null
      || effectState.hasPending
      || awakeChanged
      || !Number.isFinite(entry?.character_id)
      || !Number.isFinite(entry?.type)
      || !Number.isFinite(entry?.template_id);
    if (!dataChanged) {
      delete state._equipResonanceEditSlots[slot];
      app.renderEquipResonanceRowActionCell(slot);
      return;
    }

    const recordId = app.getCurrentEquipDetailRecordId();
    if (recordId === null) {
      app.openNoticeModal(app.translate('dashboard.equipDetailCannotGetRecordId'), { title: app.translate('dashboard.equipDetailError'), tone: 'error' });
      return;
    }

    void (async () => {
      try {
        const basePath = state.currentEquipDetailMode === 'memory' ? '/api/database-memories/selected' : '/api/database-weapons/selected';
        const requestBody = {
          Slot: slot,
          Type: effectType,
          TemplateId: effectTemplateId,
          CharacterId: characterId,
        };
        if (app.hasEquipAwakeSlotConfig()) {
          requestBody.Awake = app.getEffectiveEquipResonanceAwakeState(slot);
        }

        await app.apiFetch(`${basePath}/${recordId}/resonance`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        delete state._equipResonanceEditSlots[slot];
        if (state._equipResonancePendingEffect) {
          delete state._equipResonancePendingEffect[slot];
        }
        if (state._equipResonancePendingAwake) {
          delete state._equipResonancePendingAwake[slot];
        }
        if (state._equipResonancePendingCharacter) {
          delete state._equipResonancePendingCharacter[slot];
        }
        if (state.currentEquipDetailMode === 'memory') {
          await app.loadMemoryDetailExtraInfo(recordId);
        } else {
          await app.loadWeaponDetailExtraInfo(recordId);
        }
        await app.refreshEquipDetailSourceViews(recordId, { rerenderSourceRows: true });
      } catch (error) {
        if (app.isMutationRiskCancelled(error)) {
          return;
        }
        app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.equipDetailResonanceSaveFailed'));
      }
    })();
    return;
  }

  if (action === 'delete-resonance') {
    if (!app.hasEquipResonanceSlotData(slot)) {
      return;
    }

    const recordId = app.getCurrentEquipDetailRecordId();
    if (recordId === null) {
      app.openNoticeModal(app.translate('dashboard.equipDetailCannotGetRecordId'), { title: app.translate('dashboard.equipDetailError'), tone: 'error' });
      return;
    }

    state.pendingDeleteWeaponResonance = {
      recordId,
      slot,
      slotLabel: app.getEquipResonanceSlotLabel(slot),
      weaponName: app.getEquipNameByTemplateId(state.currentEquipDetailItem?.TemplateId),
      detailMode: state.currentEquipDetailMode,
    };
    app.openWeaponResonanceDeleteModal({
      slot: app.getEquipResonanceSlotLabel(slot),
      weaponName: app.getEquipNameByTemplateId(state.currentEquipDetailItem?.TemplateId),
    }, actionButton);
  }
};

app.handleEquipResonanceEffectCellClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const effectBtn = target.closest('[data-resonance-edit-effect]');
  if (!(effectBtn instanceof HTMLElement)) return;

  const row = effectBtn.closest('tr[data-resonance-slot]');
  if (!(row instanceof HTMLElement)) return;

  const slot = Number(row.dataset.resonanceSlot);
  if (!Number.isFinite(slot)) return;

  app.openEquipResonanceEffectModal(slot);
};

app.handleEquipResonanceAwakeToggleClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const checkbox = target.closest('[data-resonance-awake-toggle]');
  if (!(checkbox instanceof HTMLInputElement)) return;

  const row = checkbox.closest('tr[data-resonance-slot]');
  if (!(row instanceof HTMLElement)) return;

  const slot = Number(row.dataset.resonanceSlot);
  if (!Number.isFinite(slot)) return;

  if (!state._equipResonancePendingAwake) {
    state._equipResonancePendingAwake = {};
  }
  state._equipResonancePendingAwake[slot] = checkbox.checked;
  app.renderEquipResonanceAwakeCell(slot);
};

app.initEquipResonanceSharedFeature = () => {
  const resonanceEls = app.getEquipResonanceEffectModalDom();
  if (resonanceEls.searchInput instanceof HTMLInputElement) {
    resonanceEls.searchInput.addEventListener('input', () => {
      if (resonanceEls.modal instanceof HTMLElement && resonanceEls.modal.hidden) return;
      state._resonanceEffectModalSearchKeyword = resonanceEls.searchInput?.value?.trim() ?? '';
      app.renderEquipResonanceEffectModalRows();
    });
  }

  if (resonanceEls.sortNameBtn instanceof HTMLElement) {
    resonanceEls.sortNameBtn.addEventListener('click', () => {
      if (resonanceEls.modal instanceof HTMLElement && resonanceEls.modal.hidden) return;
      state._resonanceEffectModalSortOrder = state._resonanceEffectModalSortOrder === 'asc' ? 'desc' : 'asc';
      app.syncEquipResonanceEffectSortArrow();
      app.renderEquipResonanceEffectModalRows();
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
      app.renderEquipResonanceEffectModalRows();
    });
  }

  if (resonanceEls.confirmButton instanceof HTMLElement) {
    resonanceEls.confirmButton.addEventListener('click', () => app.closeEquipResonanceEffectModal(true));
  }

  resonanceEls.closeTargets.forEach((target) => {
    target.addEventListener('click', () => app.closeEquipResonanceEffectModal(false));
  });

  if (resonanceEls.modal instanceof HTMLElement) {
    resonanceEls.modal.addEventListener('mouseover', app.handleResonanceDescriptionTooltipEvent);
    resonanceEls.modal.addEventListener('mouseout', app.handleResonanceDescriptionTooltipEvent);
    resonanceEls.modal.addEventListener('mousemove', app.handleResonanceDescriptionTooltipEvent);
    resonanceEls.modal.addEventListener('focusin', app.handleResonanceDescriptionTooltipEvent);
    resonanceEls.modal.addEventListener('focusout', app.handleResonanceDescriptionTooltipEvent);
  }

  window.addEventListener('scroll', app.hideEquipDetailTooltip, true);
  window.addEventListener('resize', app.hideEquipDetailTooltip);

  weaponResonanceCharacterPickerCloseTargets.forEach((target) => {
    target.addEventListener('click', () => app.closeEquipCharacterPickerModal(false));
  });

  if (weaponResonanceCharacterPickerSummary instanceof HTMLElement) {
    weaponResonanceCharacterPickerSummary.addEventListener('click', app.handleEquipCharacterPickerSummaryClick);
  }

  if (weaponResonanceCharacterPickerGrid instanceof HTMLElement) {
    weaponResonanceCharacterPickerGrid.addEventListener('click', app.handleEquipCharacterPickerClick);
  }

  if (weaponResonanceCharacterPickerConfirmButton instanceof HTMLButtonElement) {
    weaponResonanceCharacterPickerConfirmButton.addEventListener('click', () => {
      app.closeEquipCharacterPickerModal(true);
    });
  }

  if (weaponResonanceCharacterPickerModal instanceof HTMLElement) {
    weaponResonanceCharacterPickerModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === weaponResonanceCharacterPickerModal || target.classList.contains('shared-modal-backdrop')) {
        app.closeEquipCharacterPickerModal(false);
      }
    });

    weaponResonanceCharacterPickerModal.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('[data-character-picker-id]')) {
        event.preventDefault();
        app.closeEquipCharacterPickerModal(true);
      }
    });
  }
};

export const initDatabaseEquipResonanceSharedFeature = () => {
  app.initEquipResonanceSharedFeature();
};

app.buildResonanceResolveIndices = app.buildEquipResonanceResolveIndices;
