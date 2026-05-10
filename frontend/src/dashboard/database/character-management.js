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
} = dom;

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
        <td><span class="character-quality ${app.getCharacterQualityClass(quality)}">${app.escapeHtml(app.getCharacterQualityLabel(quality))}</span></td>
        <td>${level ?? '--'}</td>
        <td><span class="character-grade ${app.getCharacterGradeClass(grade)}">${app.escapeHtml(gradeName)}</span></td>
        <td><span class="character-awaken ${app.getCharacterAwakenClass(awakenLevel)}">${awakenLevel}</span></td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button status-action-button-config" type="button" ${supportDisabled ? 'disabled' : ''} data-character-management-action="preferred" data-character-record-id="${recordId ?? ''}" data-character-sequence="${sequence ?? ''}" data-character-name="${app.escapeHtml(characterName)}">${app.translate('dashboard.characterManagementSetPreferred')}</button>
            <button class="status-action-button status-action-button-log" type="button" disabled data-character-management-action="detail">${app.translate('dashboard.characterManagementDetail')}</button>
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
};
