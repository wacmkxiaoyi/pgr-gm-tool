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
  characterDetailMainFashionIcon,
  characterDetailFashions,
  characterDetailWeapon,
  characterDetailMemories,
  characterDetailName,
  characterDetailEvolution,
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

    if (id === null || !bigIcon || !bigHeadIconFashion) {
      return null;
    }

    return {
      Id: id,
      Quality: quality,
      IsLock: Boolean(fashion?.IsLock),
      BigIcon: bigIcon,
      BigHeadIconFashion: bigHeadIconFashion,
    };
  }).filter((fashion) => Boolean(fashion));
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

app.renderCharacterSkillTableRows = (items, tableBody) => {
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
      return `<td>${app.escapeHtml(levelText)}</td>`;
    };

    rows.push(`<tr>${renderNameCell(left)}${renderLevelCell(left)}${renderNameCell(right)}${renderLevelCell(right)}</tr>`);
  }

  tableBody.innerHTML = rows.join('');
};

app.renderCharacterFashionSlots = (fashions) => {
  if (!(characterDetailFashions instanceof HTMLElement)) {
    return;
  }

  characterDetailFashions.innerHTML = Array.isArray(fashions) ? fashions.map((fashion, index) => {
    const qualityEffectClass = !fashion.IsLock ? app.getFashionQualityEffectClass(fashion.Quality) : '';
    const lockClass = fashion.IsLock ? ' is-locked' : '';
    const className = [
      'character-detail-slot',
      'character-detail-slot-small',
      'character-detail-fashion-slot',
      lockClass.trim(),
      qualityEffectClass,
    ].filter(Boolean).join(' ');

    return `
      <div class="${className}" data-fashion-index="${index}">
        <div class="character-detail-fashion-slot-image"></div>
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
    1: 'dashboard.characterAwakenLevel1',
    2: 'dashboard.characterAwakenLevel2',
    3: 'dashboard.characterAwakenLevel3',
    4: 'dashboard.characterAwakenLevel4',
    5: 'dashboard.characterAwakenLevel5',
  };
  const awakenKey = awakenKeyMap[Math.min(normalizedAwakenLevel, 5)];
  return awakenKey ? app.translate(awakenKey) : '--';
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

    app.openControlModal(app.apiErrorMessage(error, 'runtime.characterManagementSupportSetFailed'));
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

  if (characterDetailMainFashionIcon instanceof HTMLElement) {
    const fashionEffectClass = unlockedCurrentFashion ? app.getFashionQualityEffectClass(unlockedCurrentFashion.Quality) : '';
    characterDetailMainFashionIcon.className = [
      'character-detail-main-fashion-icon',
      unlockedCurrentFashion ? 'is-filled' : '',
      fashionEffectClass,
    ].filter(Boolean).join(' ');
    characterDetailMainFashionIcon.style.backgroundImage = unlockedCurrentFashion
      ? `url(".${unlockedCurrentFashion.BigIcon}")`
      : '';
    characterDetailMainFashionIcon.hidden = false;
  }

  app.renderCharacterFashionSlots(fashions);
  app.renderCharacterDetailWeaponSlot(weapon);
  app.renderCharacterDetailMemorySlots(memories);
  app.renderCharacterSkillTableRows(skills, characterDetailSkillsBody);
  app.renderCharacterSkillTableRows(enhanceSkills, characterDetailEnhanceSkillsBody);

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

  if (characterDetailGrade instanceof HTMLElement) {
    characterDetailGrade.textContent = gradeName;
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
    });
    characterDetailLevel.className = 'character-detail-stat-value';
  }

  if (characterDetailTrust instanceof HTMLElement) {
    characterDetailTrust.textContent = trustText;
    characterDetailTrust.className = 'character-detail-stat-value character-detail-trust-value';
  }

  if (characterDetailInformation instanceof HTMLElement) {
    characterDetailInformation.textContent = introText;
  }
};

app.closeCharacterDetailModal = () => {
  if (!(characterDetailModal instanceof HTMLElement) || characterDetailModal.hidden) {
    return;
  }

  app.hideCharacterDetailEquipTooltip();
  characterDetailModal.hidden = true;
  app.setBodyModalOpen(false);
  state.currentCharacterDetailItem = null;
  state.currentCharacterDetailExtraInfo = null;
  state.characterDetailLoading = false;

  if (state.lastCharacterDetailFocusedControl instanceof HTMLElement) {
    state.lastCharacterDetailFocusedControl.focus();
    state.lastCharacterDetailFocusedControl = null;
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

  state.lastCharacterDetailFocusedControl = triggerButton instanceof HTMLElement ? triggerButton : document.activeElement;
  state.currentCharacterDetailItem = item;
  state.currentCharacterDetailExtraInfo = null;
  app.hideCharacterDetailEquipTooltip();
  app.populateCharacterDetailCard(item);
  characterDetailModal.hidden = false;
  app.setBodyModalOpen(true);
  void app.loadCharacterDetailExtraInfo(recordId).catch((error) => {
    if (state.currentCharacterDetailItem) {
      app.populateCharacterDetailCard(state.currentCharacterDetailItem);
    }
    if (characterDetailModal instanceof HTMLElement && !characterDetailModal.hidden) {
      app.openControlModal(app.apiErrorMessage(error, 'runtime.characterManagementLoadFailed'));
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

  window.addEventListener('resize', app.syncCharacterDetailEquipTooltipPosition);
  window.addEventListener('scroll', app.syncCharacterDetailEquipTooltipPosition, true);
};
