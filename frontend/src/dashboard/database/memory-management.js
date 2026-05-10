import { app } from '../shared.js';

const { dom, state } = app;
const {
  databaseMemoryManagementSubnavButton,
  databaseMemoryManagementState,
  databaseMemoryManagementShell,
  databaseMemoryManagementTableShell,
  databaseMemoryManagementBody,
  databaseMemoryManagementSummary,
  databaseMemoryManagementActions,
  databaseMemoryManagementPrevButton,
  databaseMemoryManagementNextButton,
  databaseMemoryManagementPaginationLabel,
  databaseMemoryManagementJumpInput,
  databaseMemoryManagementJumpButton,
  databaseMemorySearchInput,
} = dom;

app.getMemoryPositionByTemplateId = (templateId) => {
  if (templateId === null || templateId === undefined) {
    return '--';
  }

  const site = state.equipSiteMap?.[templateId];
  const normalized = String(site ?? '').trim();
  if (!normalized || normalized === '0') {
    return '--';
  }

  return normalized;
};

app.setMemoryManagementState = (message, tone = '') => {
  if (databaseMemoryManagementState instanceof HTMLElement) {
    databaseMemoryManagementState.textContent = message;
    databaseMemoryManagementState.className = 'accounts-state database-player-empty';
    if (tone) {
      databaseMemoryManagementState.classList.add(tone);
    }
    databaseMemoryManagementState.hidden = false;
  }

  if (databaseMemoryManagementTableShell instanceof HTMLElement) {
    databaseMemoryManagementTableShell.hidden = true;
  }

  if (databaseMemoryManagementActions instanceof HTMLElement) {
    databaseMemoryManagementActions.hidden = true;
  }
};

app.showMemoryManagementTable = () => {
  if (databaseMemoryManagementState instanceof HTMLElement) {
    databaseMemoryManagementState.hidden = true;
  }

  if (databaseMemoryManagementTableShell instanceof HTMLElement) {
    databaseMemoryManagementTableShell.hidden = false;
  }

  if (databaseMemoryManagementActions instanceof HTMLElement) {
    databaseMemoryManagementActions.hidden = false;
  }
};

app.updateMemoryManagementPagination = () => {
  if (databaseMemoryManagementPaginationLabel instanceof HTMLElement) {
    databaseMemoryManagementPaginationLabel.textContent = app.translate('dashboard.accountsPagination', {
      page: state.memoryManagementTotalPages === 0 ? 0 : state.memoryManagementCurrentPage,
      totalPages: state.memoryManagementTotalPages,
    });
  }

  if (databaseMemoryManagementPrevButton instanceof HTMLButtonElement) {
    databaseMemoryManagementPrevButton.disabled = state.memoryManagementLoading || state.memoryManagementCurrentPage <= 1 || state.memoryManagementTotalPages === 0 || !app.canAccessMemoryManagement();
  }

  if (databaseMemoryManagementNextButton instanceof HTMLButtonElement) {
    databaseMemoryManagementNextButton.disabled = state.memoryManagementLoading || state.memoryManagementTotalPages === 0 || state.memoryManagementCurrentPage >= state.memoryManagementTotalPages || !app.canAccessMemoryManagement();
  }

  const jumpDisabled = state.memoryManagementLoading || state.memoryManagementTotalPages === 0 || !app.canAccessMemoryManagement();

  if (databaseMemoryManagementJumpInput instanceof HTMLInputElement) {
    databaseMemoryManagementJumpInput.disabled = jumpDisabled;
  }

  if (databaseMemoryManagementJumpButton instanceof HTMLButtonElement) {
    databaseMemoryManagementJumpButton.disabled = jumpDisabled;
  }
};

app.submitMemoryManagementPageJump = () => {
  if (!(databaseMemoryManagementJumpInput instanceof HTMLInputElement)) {
    return;
  }

  const targetPage = app.normalizePaginationTargetPage(databaseMemoryManagementJumpInput.value, state.memoryManagementTotalPages);
  databaseMemoryManagementJumpInput.value = '';

  if (targetPage === null || targetPage === state.memoryManagementCurrentPage) {
    return;
  }

  void app.loadSelectedAccountMemories(targetPage);
};

app.renderMemoryRows = (items) => {
  if (!(databaseMemoryManagementBody instanceof HTMLElement)) {
    return;
  }

  databaseMemoryManagementBody.innerHTML = Array.isArray(items) ? items.map((item, index) => {
    const recordId = item?._id ?? item?.record_id ?? null;
    const templateId = item?.TemplateId ?? null;
    const memoryName = app.getWeaponNameByTemplateId(templateId);
    const iconUrl = app.getWeaponIconByTemplateId(templateId);
    const positionLabel = app.getMemoryPositionByTemplateId(templateId);
    const characterId = item?.CharacterId ?? null;
    const characterName = app.getCharacterNameByCharacterId(characterId);
    const characterIconUrl = app.getCharacterIconByCharacterId(characterId);
    const isEquipped = Number(characterId) !== 0;
    const rowNumber = ((state.memoryManagementCurrentPage - 1) * 10) + index + 1;
    const star = app.getWeaponStarByTemplateId(templateId);
    const iconExtraClass = (Number.isFinite(star) && star >= 4) ? `weapon-icon-tier-${star}` : '';
    return `
      <tr>
        <td>${rowNumber}</td>
        <td>${app.renderWeaponMediaCell(iconUrl, memoryName, true, iconExtraClass)}</td>
        <td>${app.escapeHtml(positionLabel)}</td>
        <td>${app.renderWeaponStar(templateId)}</td>
        <td>${app.renderWeaponMediaCell(characterIconUrl, characterName, false)}</td>
        <td>${app.renderWeaponEnhancementLevel(item)}</td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button status-action-button-log" type="button" data-memory-management-action="detail" data-memory-record-id="${recordId ?? ''}">${app.translate('dashboard.weaponManagementDetail')}</button>
            <button class="status-action-button status-action-button-stop" type="button" data-memory-management-action="delete" data-memory-record-id="${recordId ?? ''}" data-memory-template-id="${templateId ?? ''}" data-memory-name="${memoryName}" data-memory-character-id="${characterId ?? ''}" data-memory-character-name="${characterName}" ${isEquipped ? 'disabled' : ''}>${app.translate('dashboard.weaponManagementDelete')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') : '';
};

app.reloadMemoryManagementCurrentPage = async () => {
  const targetPage = Math.max(1, state.memoryManagementCurrentPage);
  await app.loadSelectedAccountMemories(targetPage);
  if (state.memoryManagementTotalPages > 0 && state.memoryManagementCurrentPage > state.memoryManagementTotalPages) {
    await app.loadSelectedAccountMemories(state.memoryManagementTotalPages);
  }
};

app._memoryManagementSortFields = ['name', 'character', 'position', 'star', 'enhancement'];

app._syncMemoryManagementSortArrows = () => {
  const table = document.querySelector('#database-memory-management-section .weapon-management-table');
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.memoryManagementSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.memoryManagementSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleMemoryManagementSortClick = (sortField) => {
  if (!app._memoryManagementSortFields.includes(sortField)) return;
  if (state.memoryManagementSortBy === sortField) {
    state.memoryManagementSortOrder = state.memoryManagementSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.memoryManagementSortBy = sortField;
    state.memoryManagementSortOrder = 'asc';
  }
  app._syncMemoryManagementSortArrows();
};

app.resetMemoryManagementView = () => {
  state.memoryManagementCurrentPage = 1;
  state.memoryManagementTotalPages = 0;
  state.memoryManagementHasLoaded = false;
  state.memoryManagementLoading = false;
  state.memoryManagementItems = [];
  if (databaseMemoryManagementBody instanceof HTMLElement) {
    databaseMemoryManagementBody.innerHTML = '';
  }
  app.updateMemoryManagementPagination();
};

app.clearMemoryManagementKeyword = () => {
  state.memoryManagementKeyword = '';
  if (databaseMemorySearchInput instanceof HTMLInputElement) {
    databaseMemorySearchInput.value = '';
  }
};

app.syncMemoryManagementKeywordInput = () => {
  if (databaseMemorySearchInput instanceof HTMLInputElement) {
    databaseMemorySearchInput.value = state.memoryManagementKeyword;
  }
};

app.rerenderMemoryManagementLocale = () => {
  app._syncMemoryManagementSortArrows();
  app.syncMemoryManagementKeywordInput();

  if (app.canAccessMemoryManagement() && state.memoryManagementHasLoaded) {
    void app.loadSelectedAccountMemories(state.memoryManagementCurrentPage);
  }
};

app.loadSelectedAccountMemories = async (page = 1) => {
  if (!app.canAccessMemoryManagement() || state.memoryManagementLoading) {
    app.updateMemoryManagementPagination();
    return;
  }

  state.memoryManagementLoading = true;
  state.memoryManagementCurrentPage = Math.max(1, page);
  app.updateMemoryManagementPagination();
  app.setMemoryManagementState(app.translate('dashboard.memoryManagementLoading'), 'is-loading');

  try {
    const search = new URLSearchParams({
      page: String(state.memoryManagementCurrentPage),
      page_size: '10',
    });
    if (state.memoryManagementKeyword) {
      search.set('keyword', state.memoryManagementKeyword);
    }
    search.set('sort_by', state.memoryManagementSortBy);
    search.set('sort_order', state.memoryManagementSortOrder);

    const payload = await app.apiFetch(`/api/database-memories/selected?${search.toString()}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.memoryManagementItems = items;
    state.memoryManagementCurrentPage = typeof payload?.page === 'number' ? payload.page : state.memoryManagementCurrentPage;
    state.memoryManagementTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    state.memoryManagementHasLoaded = true;

    if (databaseMemoryManagementSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseMemoryManagementSummary.textContent = app.translate('dashboard.memoryManagementSummaryTotal', { total });
      databaseMemoryManagementSummary.hidden = false;
    }

    if (items.length === 0) {
      if (databaseMemoryManagementBody instanceof HTMLElement) {
        databaseMemoryManagementBody.innerHTML = '';
      }
      app.setMemoryManagementState(app.translate('dashboard.memoryManagementEmpty'), 'is-empty');
    } else {
      app.renderMemoryRows(items);
      app.showMemoryManagementTable();
    }
  } catch (error) {
    state.memoryManagementTotalPages = 0;
    if (databaseMemoryManagementBody instanceof HTMLElement) {
      databaseMemoryManagementBody.innerHTML = '';
    }
    app.setMemoryManagementState(app.apiErrorMessage(error, 'runtime.weaponManagementLoadFailed'), 'is-error');
  } finally {
    state.memoryManagementLoading = false;
    app.updateMemoryManagementPagination();
  }
};

app.updateMemoryManagementAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);
  const accessible = app.canAccessMemoryManagement(payload);

  app.syncMemoryManagementKeywordInput();
  app._syncMemoryManagementSortArrows();

  if (databaseMemoryManagementSubnavButton instanceof HTMLButtonElement) {
    databaseMemoryManagementSubnavButton.disabled = !accessible;
    if (!healthy) {
      databaseMemoryManagementSubnavButton.title = app.translate('runtime.memoryManagementAccessTitle');
    } else if (state.selectedAccountUid === null) {
      databaseMemoryManagementSubnavButton.title = app.translate('runtime.memoryManagementNeedAccountTitle');
    } else {
      databaseMemoryManagementSubnavButton.title = '';
    }
  }

  if (databaseMemoryManagementSummary instanceof HTMLElement) {
    if (accessible && state.memoryManagementHasLoaded) {
      databaseMemoryManagementSummary.hidden = false;
    } else if (accessible) {
      databaseMemoryManagementSummary.textContent = '';
      databaseMemoryManagementSummary.hidden = true;
    } else {
      databaseMemoryManagementSummary.textContent = !healthy
        ? app.translate('dashboard.memoryManagementUnavailable')
        : app.translate('dashboard.memoryManagementChooseAccount');
      databaseMemoryManagementSummary.hidden = false;
    }
  }

  if (!healthy) {
    app.resetMemoryManagementView();
    app.setMemoryManagementState(app.translate('dashboard.memoryManagementUnavailable'), 'is-muted');
    if (app.isDatabaseMemoryManagementSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    return;
  }

  if (state.selectedAccountUid === null) {
    app.resetMemoryManagementView();
    app.setMemoryManagementState(app.translate('dashboard.memoryManagementChooseAccount'), 'is-muted');
    if (app.isDatabaseMemoryManagementSectionActive()) {
      app.setActiveDatabaseTab('database-accounts-section');
    }
    return;
  }

  if (!state.memoryManagementHasLoaded) {
    if (databaseMemoryManagementBody instanceof HTMLElement) {
      databaseMemoryManagementBody.innerHTML = '';
    }
    app.setMemoryManagementState(app.translate('dashboard.memoryManagementReady'), 'is-muted');
    app.updateMemoryManagementPagination();
    return;
  }

  app.showMemoryManagementTable();
  app.updateMemoryManagementPagination();
};

app.openMemoryDetailModal = (recordId, triggerButton) => {
  const item = state.memoryManagementItems?.find((i) => (i?._id ?? i?.record_id) === recordId);
  if (!item) {
    return;
  }

  state.currentEquipDetailMode = 'memory';
  state.lastWeaponDetailFocusedControl = triggerButton instanceof HTMLElement ? triggerButton : document.activeElement;
  state.currentWeaponDetailItem = item;
  state.currentWeaponDetailExtraInfo = null;
  app.populateWeaponDetailCard(item);
  dom.weaponDetailModal.hidden = false;
  app.setBodyModalOpen(true);
  void app.loadMemoryDetailExtraInfo(recordId).catch((error) => {
    if (state.currentWeaponDetailItem) {
      app.populateWeaponDetailCard(state.currentWeaponDetailItem);
    }
    if (dom.weaponDetailModal instanceof HTMLElement && !dom.weaponDetailModal.hidden) {
      app.openControlModal(app.apiErrorMessage(error, 'runtime.weaponManagementLoadFailed'));
    }
  });

  if (dom.weaponDetailCard instanceof HTMLElement) {
    dom.weaponDetailCard.focus();
  }
};

app.getMemoryDetailExtraInfo = async (recordId) => {
  const payload = await app.apiFetch(`/api/database-memories/selected/${recordId}/extra-info`);
  return payload && typeof payload === 'object' ? payload : {};
};

app.loadMemoryDetailExtraInfo = async (recordId) => {
  state.weaponDetailLoading = true;
  try {
    const extraInfo = await app.getMemoryDetailExtraInfo(recordId);
    state.currentWeaponDetailExtraInfo = extraInfo;
    if (state.currentWeaponDetailItem) {
      app.populateWeaponDetailCard(state.currentWeaponDetailItem);
    }
  } finally {
    state.weaponDetailLoading = false;
  }
};

app.confirmMemoryResonanceChange = async (recordId) => {
  await app.loadMemoryDetailExtraInfo(recordId);
};

app.handleMemoryManagementActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-memory-management-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.dataset.memoryManagementAction === 'clear') {
    app.openClearMemoriesModal(state.memoryManagementKeyword.trim(), button);
    return;
  }

  if (button.dataset.memoryManagementAction === 'add-memory') {
    app.openMemoryAddModal(button);
    return;
  }

  if (button.dataset.memoryManagementAction === 'detail') {
    const recordId = Number.parseInt(button.dataset.memoryRecordId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }
    app.openMemoryDetailModal(recordId, button);
    return;
  }

  if (button.dataset.memoryManagementAction === 'delete') {
    const recordId = Number.parseInt(button.dataset.memoryRecordId ?? '', 10);
    const characterId = Number.parseInt(button.dataset.memoryCharacterId ?? '', 10);
    if (!Number.isFinite(recordId)) {
      return;
    }

    if (Number.isFinite(characterId) && characterId !== 0) {
      app.openControlModal(app.translate('runtime.equipsDeleteEquippedForbidden'));
      return;
    }

    app.openMemoryDeleteModal({
      recordId,
      templateId: button.dataset.memoryTemplateId ?? '--',
      memoryName: button.dataset.memoryName ?? app.translate('common.notAvailable'),
      characterName: button.dataset.memoryCharacterName ?? app.translate('common.notAvailable'),
    }, button);
  }
};

export const initDatabaseMemoryManagementFeature = () => {
  app._syncMemoryManagementSortArrows();

  if (databaseMemoryManagementShell instanceof HTMLElement) {
    databaseMemoryManagementShell.addEventListener('click', app.handleMemoryManagementActionClick);
  }

  if (databaseMemorySearchInput instanceof HTMLInputElement) {
    databaseMemorySearchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      state.memoryManagementKeyword = databaseMemorySearchInput.value.trim();
      state.memoryManagementCurrentPage = 1;
      if (app.canAccessMemoryManagement()) {
        void app.loadSelectedAccountMemories(1);
      }
    });
  }

  const memoryManagementTable = document.querySelector('#database-memory-management-section .weapon-management-table');
  if (memoryManagementTable instanceof HTMLElement) {
    memoryManagementTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (!(sortBtn instanceof HTMLButtonElement)) return;
      const sortField = sortBtn.dataset.sortField;
      if (!sortField) return;
      app._handleMemoryManagementSortClick(sortField);
      state.memoryManagementCurrentPage = 1;
      if (app.canAccessMemoryManagement()) {
        void app.loadSelectedAccountMemories(1);
      }
    });
  }

  if (databaseMemoryManagementPrevButton instanceof HTMLButtonElement) {
    databaseMemoryManagementPrevButton.addEventListener('click', () => {
      if (state.memoryManagementCurrentPage > 1) {
        void app.loadSelectedAccountMemories(state.memoryManagementCurrentPage - 1);
      }
    });
  }

  if (databaseMemoryManagementNextButton instanceof HTMLButtonElement) {
    databaseMemoryManagementNextButton.addEventListener('click', () => {
      if (state.memoryManagementCurrentPage < state.memoryManagementTotalPages) {
        void app.loadSelectedAccountMemories(state.memoryManagementCurrentPage + 1);
      }
    });
  }

  if (databaseMemoryManagementJumpInput instanceof HTMLInputElement) {
    databaseMemoryManagementJumpInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      app.submitMemoryManagementPageJump();
    });
  }

  if (databaseMemoryManagementJumpButton instanceof HTMLButtonElement) {
    databaseMemoryManagementJumpButton.addEventListener('click', app.submitMemoryManagementPageJump);
  }
};
