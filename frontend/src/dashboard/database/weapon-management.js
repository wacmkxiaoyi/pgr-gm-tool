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
  databaseWeaponSortFieldSelect,
  databaseWeaponSortOrderSelect,
  databaseWeaponSearchInput,
  weaponDetailModal,
  weaponDetailCloseTargets,
  weaponDetailCard,
  weaponDetailIcon,
  weaponDetailName,
  weaponDetailType,
  weaponDetailStar,
  weaponDetailSkill,
  weaponDetailBreakthrough,
  weaponDetailLevel,
  weaponDetailExp,
  weaponDetailResonanceSection,
  weaponDetailResonanceBody,
  weaponDetailOverrunSection,
  weaponDetailOverrunContent,
} = dom;

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

  const name = state.weaponNameMap?.[templateId];
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

  const type = state.weaponTypeMap?.[templateId];
  return Number.isFinite(Number(type)) ? String(type) : '--';
};

app.getWeaponStarByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return null;
  }

  const star = state.weaponStarMap?.[templateId];
  return Number.isFinite(Number(star)) ? Math.max(0, Number(star)) : null;
};

app.getWeaponIconByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return '';
  }

  const url = state.weaponIconUrlMap?.[templateId];
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
  const imgClass = `weapon-management-icon${extraClass ? ` ${extraClass}` : ''}`;
  return `
    <div class="weapon-management-media-cell">
      ${iconUrl ? `<img class="${imgClass}" src=".${iconUrl}" alt="${safeLabel}">` : (showFallback ? '<span class="weapon-management-icon weapon-management-icon-fallback" aria-hidden="true"></span>' : '')}
      <span>${safeLabel}</span>
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
  const templateId = item?.TemplateId ?? null;
  const breakthrough = Number.isFinite(Number(item?.Breakthrough)) ? Math.max(0, Number(item.Breakthrough)) : 0;
  const level = Number.isFinite(Number(item?.Level)) ? Math.max(0, Number(item.Level)) : 0;

  if (templateId === null || templateId === undefined) {
    return null;
  }

  const stageMap = state.weaponBreakthroughLevelLimitMap?.[templateId];
  if (!stageMap || typeof stageMap !== 'object') {
    return null;
  }

  let total = level;
  for (let stage = 0; stage < breakthrough; stage += 1) {
    const levelLimit = stageMap?.[stage];
    if (!Number.isFinite(Number(levelLimit))) {
      return null;
    }
    total += Number(levelLimit);
  }

  return total;
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

app.syncWeaponManagementSortControls = () => {
  if (databaseWeaponSortFieldSelect instanceof HTMLSelectElement) {
    databaseWeaponSortFieldSelect.value = state.weaponManagementSortBy;
  }

  if (databaseWeaponSortOrderSelect instanceof HTMLSelectElement) {
    databaseWeaponSortOrderSelect.value = state.weaponManagementSortOrder;
  }
};

app.applyWeaponManagementSort = () => {
  const nextSortBy = databaseWeaponSortFieldSelect instanceof HTMLSelectElement ? databaseWeaponSortFieldSelect.value : state.weaponManagementSortBy;
  const nextSortOrder = databaseWeaponSortOrderSelect instanceof HTMLSelectElement ? databaseWeaponSortOrderSelect.value : state.weaponManagementSortOrder;
  state.weaponManagementSortBy = ['name', 'type', 'star', 'enhancement'].includes(nextSortBy) ? nextSortBy : 'character';
  state.weaponManagementSortOrder = nextSortOrder === 'desc' ? 'desc' : 'asc';
  app.syncWeaponManagementSortControls();
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
  app.syncWeaponManagementSortControls();
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
  app.syncWeaponManagementSortControls();

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
  const templateId = item?.TemplateId ?? null;
  const breakthrough = Number.isFinite(Number(item?.Breakthrough)) ? Math.max(0, Number(item.Breakthrough)) : 0;
  const level = Number.isFinite(Number(item?.Level)) ? Number(item.Level) : null;
  const currentLevelExp = Number.isFinite(Number(item?.Exp)) ? Number(item.Exp) : null;
  const currentLevelExpLimit = Number.isFinite(Number(item?.CurrentLevelExpLimit)) ? Number(item.CurrentLevelExpLimit) : null;
  const star = app.getWeaponStarByTemplateId(templateId);
  const iconUrl = app.getWeaponIconByTemplateId(templateId);
  const weaponName = app.getWeaponNameByTemplateId(templateId);
  const resonanceInfo = Array.isArray(item?.ResonanceInfo) ? item.ResonanceInfo : [];
  const hasOverrun = item?.WeaponOverrunData != null;
  const hasValidStar = Number.isFinite(star) && star >= 2 && star <= 6;
  const starTier = hasValidStar ? star : 2;
  const btTier = Math.min(Math.max(breakthrough, 0), 4);

  state.currentWeaponDetailItem = item;

  if (weaponDetailCard instanceof HTMLElement) {
    weaponDetailCard.dataset.starTier = starTier;
    weaponDetailCard.dataset.btTier = btTier;
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

  if (weaponDetailSkill instanceof HTMLElement) {
    const skillName = templateId != null ? state.weaponSkillNameMap?.[templateId] : null;
    const hasSkill = typeof skillName === 'string' && skillName.trim();
    weaponDetailSkill.textContent = hasSkill
      ? skillName.trim()
      : `(${app.translate('dashboard.weaponDetailNoSkill')})`;
    weaponDetailSkill.classList.toggle('is-empty', !hasSkill);
  }

  if (weaponDetailBreakthrough instanceof HTMLElement) {
    weaponDetailBreakthrough.textContent = breakthrough;
    weaponDetailBreakthrough.className = `weapon-detail-stat-value weapon-detail-bt-tier-${btTier}`;
    weaponDetailBreakthrough.classList.add('is-editable');
    weaponDetailBreakthrough.setAttribute('tabindex', '0');
    weaponDetailBreakthrough.setAttribute('role', 'button');
    const maxBtData = state.weaponBreakthroughMaxMap?.[templateId];
    weaponDetailBreakthrough.dataset.weaponBtMax = typeof maxBtData?.max_breakthrough === 'number' ? String(maxBtData.max_breakthrough) : '0';
    weaponDetailBreakthrough.dataset.weaponBtCurrent = String(breakthrough);
  }

  if (weaponDetailLevel instanceof HTMLElement) {
    weaponDetailLevel.textContent = level !== null ? String(level) : '--';
    weaponDetailLevel.className = 'weapon-detail-stat-value is-editable';
    weaponDetailLevel.setAttribute('tabindex', level !== null ? '0' : '-1');
    weaponDetailLevel.setAttribute('role', level !== null ? 'button' : '');
    const stageMap = state.weaponBreakthroughLevelLimitMap?.[templateId];
    const levelLimit = stageMap?.[breakthrough];
    weaponDetailLevel.dataset.weaponLevelMin = '1';
    weaponDetailLevel.dataset.weaponLevelMax = Number.isFinite(Number(levelLimit)) ? String(levelLimit) : '0';
    weaponDetailLevel.dataset.weaponLevelCurrent = level !== null ? String(level) : '';
  }

  if (weaponDetailExp instanceof HTMLElement) {
    if (currentLevelExp !== null && currentLevelExpLimit !== null) {
      weaponDetailExp.textContent = `${currentLevelExp} / ${currentLevelExpLimit}`;
      const btStageMap = state.weaponBreakthroughLevelLimitMap?.[templateId];
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
    weaponDetailResonanceSection.hidden = !(hasValidStar && star >= 5);
  }

  if (weaponDetailResonanceBody instanceof HTMLElement) {
    const rows = [1, 2, 3].map((slot) => {
      const entry = resonanceInfo.find((r) => r?.Slot === slot) ?? null;
      const slotText = slot;

      let effectText = '--';
      let characterText = '--';
      if (entry) {
        const type = Number(entry.Type);
        const templateId = Number(entry.TemplateId);
        if (type === 1 && state.attribPoolNameMap?.[templateId]) {
          effectText = state.attribPoolNameMap[templateId];
        } else if (type === 2 && state.characterSkillPoolNameMap?.[templateId]) {
          effectText = state.characterSkillPoolNameMap[templateId];
        } else if (type === 3 && state.weaponSkillNameMap?.[templateId]) {
          effectText = state.weaponSkillNameMap[templateId];
        } else {
          effectText = '未知';
        }

        const characterId = Number(entry.CharacterId);
        const characterName = app.getCharacterNameByCharacterId(characterId);
        const characterIconUrl = app.getCharacterIconByCharacterId(characterId);
        characterText = app.renderWeaponMediaCell(characterIconUrl, characterName);
      }

      return `
        <tr>
          <td>${slotText}</td>
          <td>${effectText}</td>
          <td>${characterText}</td>
        </tr>
      `;
    }).join('');
    weaponDetailResonanceBody.innerHTML = rows;
  }

  if (weaponDetailOverrunSection instanceof HTMLElement) {
    weaponDetailOverrunSection.hidden = !(hasValidStar && star >= 6 && hasOverrun);
  }

  if (weaponDetailOverrunContent instanceof HTMLElement) {
    weaponDetailOverrunContent.textContent = '--';
  }
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
    app.populateWeaponDetailCard(payload);

    const idx = state.weaponManagementItems?.findIndex(
      (i) => (i?._id ?? i?.record_id) === recordId
    );
    if (idx >= 0 && state.weaponManagementItems) {
      state.weaponManagementItems[idx] = payload;
      app.renderWeaponRows(state.weaponManagementItems);
    }
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
  app.populateWeaponDetailCard(item);
  weaponDetailModal.hidden = false;
  app.setBodyModalOpen(true);

  const closeButton = weaponDetailModal.querySelector('[data-weapon-detail-close]');
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
};

export const initDatabaseWeaponManagementFeature = () => {
  app.syncWeaponManagementSortControls();

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

  if (databaseWeaponSortFieldSelect instanceof HTMLSelectElement) {
    databaseWeaponSortFieldSelect.addEventListener('change', () => {
      app.applyWeaponManagementSort();
      state.weaponManagementCurrentPage = 1;
      if (app.canAccessWeaponManagement()) {
        void app.loadSelectedAccountWeapons(1);
      }
    });
  }

  if (databaseWeaponSortOrderSelect instanceof HTMLSelectElement) {
    databaseWeaponSortOrderSelect.addEventListener('change', () => {
      app.applyWeaponManagementSort();
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
    });
  }
};
