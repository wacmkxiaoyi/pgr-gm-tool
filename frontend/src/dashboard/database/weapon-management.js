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
  databaseWeaponSortFieldSelect,
  databaseWeaponSortOrderSelect,
  databaseWeaponSearchInput,
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

app.renderWeaponMediaCell = (iconUrl, label, showFallback = true) => {
  const safeLabel = typeof label === 'string' && label.trim() ? label.trim() : '--';
  return `
    <div class="weapon-management-media-cell">
      ${iconUrl ? `<img class="weapon-management-icon" src=".${iconUrl}" alt="${safeLabel}">` : (showFallback ? '<span class="weapon-management-icon weapon-management-icon-fallback" aria-hidden="true"></span>' : '')}
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
    return `
      <tr>
        <td>${rowNumber}</td>
        <td>${app.renderWeaponMediaCell(iconUrl, weaponName)}</td>
        <td>${app.renderWeaponMediaCell(characterIconUrl, characterName, false)}</td>
        <td>${app.getWeaponTypeByTemplateId(templateId)}</td>
        <td>${app.renderWeaponStar(templateId)}</td>
        <td>${app.renderWeaponEnhancementLevel(item)}</td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button status-action-button-log" type="button" data-weapon-management-action="detail">${app.translate('dashboard.weaponManagementDetail')}</button>
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
    app.openControlModal(app.translate('runtime.weaponManagementDetailPending'));
    return;
  }

  if (button.dataset.weaponManagementAction === 'delete') {
    const recordId = Number.parseInt(button.dataset.weaponRecordId ?? '', 10);
    const characterId = Number.parseInt(button.dataset.weaponCharacterId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }

    if (Number.isFinite(characterId) && characterId !== 0) {
      app.openControlModal(app.translate('runtime.weaponDeleteEquippedForbidden'));
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
};
