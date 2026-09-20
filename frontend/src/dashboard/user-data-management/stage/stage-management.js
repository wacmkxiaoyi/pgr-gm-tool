import { app } from '../../shared.js';

const { dom, state } = app;
const {
  databaseStageManagementSubnavButton,
  databaseStageManagementState,
  databaseStageManagementShell,
  databaseStageManagementTableShell,
  databaseStageManagementBody,
  databaseStageManagementSummary,
  databaseStageManagementActions,
  databaseStageManagementPrevButton,
  databaseStageManagementNextButton,
  databaseStageManagementPaginationLabel,
  databaseStageManagementJumpInput,
  databaseStageManagementJumpButton,
  databaseStageSearchInput,
  stageDescriptionTooltip,
} = dom;

const STAGE_TOOLTIP_DELAY_MS = 180;

app.getStageEntryById = (stageId) => {
  if (stageId === null || stageId === undefined) {
    return null;
  }

  const entry = state.stageEntriesMap?.[stageId];
  return entry && typeof entry === 'object' ? entry : null;
};

app.getStageNameById = (stageId) => {
  const name = app.getStageEntryById(stageId)?.Name;
  return typeof name === 'string' && name.trim() ? name.trim() : '--';
};

app.getStageDescriptionById = (stageId) => {
  const description = app.getStageEntryById(stageId)?.Description;
  return typeof description === 'string' && description.trim() ? description.trim() : '--';
};

app.setStageManagementState = (message, tone = '') => {
  if (databaseStageManagementState instanceof HTMLElement) {
    databaseStageManagementState.textContent = message;
    databaseStageManagementState.className = 'database-player-empty';
    if (tone) {
      databaseStageManagementState.classList.add(tone);
    }
    databaseStageManagementState.hidden = false;
  }

  if (databaseStageManagementShell instanceof HTMLElement) {
    databaseStageManagementShell.hidden = true;
  }

  if (databaseStageManagementTableShell instanceof HTMLElement) {
    databaseStageManagementTableShell.hidden = true;
  }

  if (databaseStageManagementActions instanceof HTMLElement) {
    databaseStageManagementActions.hidden = true;
  }
};

app.showStageManagementTable = () => {
  if (databaseStageManagementState instanceof HTMLElement) {
    databaseStageManagementState.hidden = true;
  }

  if (databaseStageManagementShell instanceof HTMLElement) {
    databaseStageManagementShell.hidden = false;
  }

  if (databaseStageManagementTableShell instanceof HTMLElement) {
    databaseStageManagementTableShell.hidden = false;
  }

  if (databaseStageManagementActions instanceof HTMLElement) {
    databaseStageManagementActions.hidden = false;
  }
};

app.updateStageManagementPagination = () => {
  if (databaseStageManagementPaginationLabel instanceof HTMLElement) {
    databaseStageManagementPaginationLabel.textContent = app.translate('dashboard.accountsPagination', {
      page: state.stageManagementTotalPages === 0 ? 0 : state.stageManagementCurrentPage,
      totalPages: state.stageManagementTotalPages,
    });
  }

  if (databaseStageManagementPrevButton instanceof HTMLButtonElement) {
    databaseStageManagementPrevButton.disabled = state.stageManagementLoading || state.stageManagementCurrentPage <= 1 || state.stageManagementTotalPages === 0 || !app.canAccessStageManagement();
  }

  if (databaseStageManagementNextButton instanceof HTMLButtonElement) {
    databaseStageManagementNextButton.disabled = state.stageManagementLoading || state.stageManagementTotalPages === 0 || state.stageManagementCurrentPage >= state.stageManagementTotalPages || !app.canAccessStageManagement();
  }

  const jumpDisabled = state.stageManagementLoading || state.stageManagementTotalPages === 0 || !app.canAccessStageManagement();
  if (databaseStageManagementJumpInput instanceof HTMLInputElement) {
    databaseStageManagementJumpInput.disabled = jumpDisabled;
  }

  if (databaseStageManagementJumpButton instanceof HTMLButtonElement) {
    databaseStageManagementJumpButton.disabled = jumpDisabled;
  }
};

app.submitStageManagementPageJump = () => {
  if (!(databaseStageManagementJumpInput instanceof HTMLInputElement)) {
    return;
  }

  const targetPage = app.normalizePaginationTargetPage(databaseStageManagementJumpInput.value, state.stageManagementTotalPages);
  databaseStageManagementJumpInput.value = '';
  if (targetPage === null || targetPage === state.stageManagementCurrentPage) {
    return;
  }

  void app.loadSelectedAccountStages(targetPage);
};

app.renderStageRows = (items) => {
  if (!(databaseStageManagementBody instanceof HTMLElement)) {
    return;
  }

  databaseStageManagementBody.innerHTML = Array.isArray(items) ? items.map((item) => {
    const stageId = Number.parseInt(String(item?.stage_id ?? ''), 10);
    const safeStageId = Number.isFinite(stageId) ? stageId : null;
    const stageName = app.getStageNameById(safeStageId);
    const stageDescription = app.getStageDescriptionById(safeStageId);
    const escapedDescription = app.escapeHtml(stageDescription);
    const tooltipAttr = stageDescription && stageDescription !== '--'
      ? ` data-stage-tooltip-text="${escapedDescription}" tabindex="0"`
      : '';

    return `
      <tr>
        <td>${safeStageId ?? '--'}</td>
        <td>${app.escapeHtml(stageName)}</td>
        <td>
          <span class="stage-management-description"${tooltipAttr}>${escapedDescription}</span>
        </td>
        <td>
          <div class="accounts-row-actions">
            <button class="status-action-button status-action-button-stop" type="button" data-stage-management-action="delete" data-stage-id="${safeStageId ?? ''}" data-stage-name="${app.escapeHtml(stageName)}">${app.translate('dashboard.stageManagementDelete')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') : '';
};

app._stageManagementSortFields = ['stage_id', 'name'];

app._syncStageManagementSortArrows = () => {
  const table = document.querySelector('#database-stage-management-section .stage-management-table');
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.stageManagementSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.stageManagementSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleStageManagementSortClick = (sortField) => {
  if (!app._stageManagementSortFields.includes(sortField)) return;
  if (state.stageManagementSortBy === sortField) {
    state.stageManagementSortOrder = state.stageManagementSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.stageManagementSortBy = sortField;
    state.stageManagementSortOrder = 'asc';
  }
  app._syncStageManagementSortArrows();
};

app.resetStageManagementView = () => {
  state.stageManagementCurrentPage = 1;
  state.stageManagementTotalPages = 0;
  state.stageManagementHasLoaded = false;
  state.stageManagementLoading = false;
  app.hideStageDescriptionTooltip();
  if (databaseStageManagementBody instanceof HTMLElement) {
    databaseStageManagementBody.innerHTML = '';
  }
  app.updateStageManagementPagination();
};

app.clearStageManagementKeyword = () => {
  state.stageManagementKeyword = '';
  if (databaseStageSearchInput instanceof HTMLInputElement) {
    databaseStageSearchInput.value = '';
  }
};

app.syncStageManagementKeywordInput = () => {
  if (databaseStageSearchInput instanceof HTMLInputElement) {
    databaseStageSearchInput.value = state.stageManagementKeyword;
  }
};

app.rerenderStageManagementLocale = () => {
  app._syncStageManagementSortArrows();
  app.syncStageManagementKeywordInput();
  if (app.canAccessStageManagement() && state.stageManagementHasLoaded) {
    void app.loadSelectedAccountStages(state.stageManagementCurrentPage);
  }
};

app.loadSelectedAccountStages = async (page = 1) => {
  if (!app.canAccessStageManagement() || state.stageManagementLoading) {
    app.updateStageManagementPagination();
    return;
  }

  state.stageManagementLoading = true;
  state.stageManagementCurrentPage = Math.max(1, page);
  app.updateStageManagementPagination();
  app.setStageManagementState(app.translate('dashboard.stageManagementLoading'), 'is-loading');

  try {
    const search = new URLSearchParams({
      page: String(state.stageManagementCurrentPage),
      page_size: '10',
      sort_by: state.stageManagementSortBy,
      sort_order: state.stageManagementSortOrder,
    });
    if (state.stageManagementKeyword) {
      search.set('keyword', state.stageManagementKeyword);
    }

    const payload = await app.apiFetch(`/api/database-stages/selected?${search.toString()}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.stageManagementCurrentPage = typeof payload?.page === 'number' ? payload.page : state.stageManagementCurrentPage;
    state.stageManagementTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    state.stageManagementHasLoaded = true;

    if (databaseStageManagementSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseStageManagementSummary.textContent = app.translate('dashboard.stageManagementSummaryTotal', { total });
      databaseStageManagementSummary.hidden = false;
    }

    if (items.length === 0) {
      if (databaseStageManagementBody instanceof HTMLElement) {
        databaseStageManagementBody.innerHTML = '';
      }
      app.setStageManagementState(app.translate('dashboard.stageManagementEmpty'), 'is-empty');
    } else {
      app.renderStageRows(items);
      app.showStageManagementTable();
    }
  } catch (error) {
    state.stageManagementTotalPages = 0;
    if (databaseStageManagementBody instanceof HTMLElement) {
      databaseStageManagementBody.innerHTML = '';
    }
    app.setStageManagementState(app.apiErrorMessage(error, 'runtime.stageManagementLoadFailed'), 'is-error');
  } finally {
    state.stageManagementLoading = false;
    app.updateStageManagementPagination();
  }
};

app.reloadStageManagementCurrentPage = async () => {
  const targetPage = Math.max(1, state.stageManagementCurrentPage);
  await app.loadSelectedAccountStages(targetPage);
  if (state.stageManagementTotalPages > 0 && state.stageManagementCurrentPage > state.stageManagementTotalPages) {
    await app.loadSelectedAccountStages(state.stageManagementTotalPages);
  }
};

app.updateStageManagementAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);
  const accessible = app.canAccessStageManagement(payload);

  app.syncStageManagementKeywordInput();
  app._syncStageManagementSortArrows();

  if (databaseStageManagementSubnavButton instanceof HTMLButtonElement) {
    databaseStageManagementSubnavButton.disabled = !accessible;
    if (!healthy) {
      databaseStageManagementSubnavButton.title = app.translate('runtime.stageManagementAccessTitle');
    } else if (state.selectedAccountUid === null) {
      databaseStageManagementSubnavButton.title = app.translate('runtime.stageManagementNeedAccountTitle');
    } else {
      databaseStageManagementSubnavButton.title = '';
    }
  }

  if (databaseStageManagementSummary instanceof HTMLElement) {
    if (accessible && state.stageManagementHasLoaded) {
      databaseStageManagementSummary.hidden = false;
    } else if (accessible) {
      databaseStageManagementSummary.textContent = '';
      databaseStageManagementSummary.hidden = true;
    } else {
      databaseStageManagementSummary.textContent = !healthy
        ? app.translate('dashboard.stageManagementUnavailable')
        : app.translate('dashboard.stageManagementChooseAccount');
      databaseStageManagementSummary.hidden = false;
    }
  }

  if (!healthy) {
    app.resetStageManagementView();
    app.setStageManagementState(app.translate('dashboard.stageManagementUnavailable'), 'is-muted');
    if (app.isDatabaseStageManagementSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    return;
  }

  if (state.selectedAccountUid === null) {
    app.resetStageManagementView();
    app.setStageManagementState(app.translate('dashboard.stageManagementChooseAccount'), 'is-muted');
    if (app.isDatabaseStageManagementSectionActive()) {
      app.setActiveDatabaseTab('database-accounts-section');
    }
    return;
  }

  if (!state.stageManagementHasLoaded) {
    if (databaseStageManagementBody instanceof HTMLElement) {
      databaseStageManagementBody.innerHTML = '';
    }
    app.setStageManagementState(app.translate('dashboard.stageManagementReady'), 'is-muted');
    app.updateStageManagementPagination();
    return;
  }

  app.showStageManagementTable();
  app.updateStageManagementPagination();
};

app.hideStageDescriptionTooltip = () => {
  if (state.stageDescriptionTooltipTimer) {
    window.clearTimeout(state.stageDescriptionTooltipTimer);
    state.stageDescriptionTooltipTimer = null;
  }

  if (stageDescriptionTooltip instanceof HTMLElement) {
    if (stageDescriptionTooltip.parentElement !== document.body) {
      document.body.appendChild(stageDescriptionTooltip);
    }
    stageDescriptionTooltip.hidden = true;
    stageDescriptionTooltip.textContent = '';
  }

  state.stageDescriptionTooltipTarget = null;
};

app.positionStageDescriptionTooltip = () => {
  if (!(stageDescriptionTooltip instanceof HTMLElement) || stageDescriptionTooltip.hidden) {
    return;
  }

  const target = state.stageDescriptionTooltipTarget;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = stageDescriptionTooltip.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const margin = 12;
  const gap = 8;

  let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
  let top = targetRect.bottom + gap;

  if (left < margin) left = margin;
  else if (left + tooltipRect.width > viewportWidth - margin) left = viewportWidth - tooltipRect.width - margin;

  if (top + tooltipRect.height > viewportHeight - margin) {
    const above = targetRect.top - tooltipRect.height - gap;
    top = above >= margin ? above : margin;
  }

  if (top < margin) top = margin;
  stageDescriptionTooltip.style.left = `${Math.round(left)}px`;
  stageDescriptionTooltip.style.top = `${Math.round(top)}px`;
};

app.showStageDescriptionTooltip = (target) => {
  if (!(target instanceof HTMLElement) || !(stageDescriptionTooltip instanceof HTMLElement)) {
    return;
  }

  const text = typeof target.dataset.stageTooltipText === 'string' ? target.dataset.stageTooltipText.trim() : '';
  if (!text) {
    app.hideStageDescriptionTooltip();
    return;
  }

  if (stageDescriptionTooltip.parentElement !== document.body) {
    document.body.appendChild(stageDescriptionTooltip);
  }

  stageDescriptionTooltip.textContent = text;
  stageDescriptionTooltip.hidden = false;
  stageDescriptionTooltip.style.left = '0px';
  stageDescriptionTooltip.style.top = '0px';
  state.stageDescriptionTooltipTarget = target;
  window.requestAnimationFrame(app.positionStageDescriptionTooltip);
};

app.scheduleStageDescriptionTooltip = (target) => {
  app.hideStageDescriptionTooltip();
  if (!(target instanceof HTMLElement)) {
    return;
  }

  state.stageDescriptionTooltipTimer = window.setTimeout(() => {
    state.stageDescriptionTooltipTimer = null;
    app.showStageDescriptionTooltip(target);
  }, STAGE_TOOLTIP_DELAY_MS);
};

app.handleStageDescriptionTooltipEvent = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const tooltipTarget = target.closest('[data-stage-tooltip-text]');

  if (event.type === 'mouseover' || event.type === 'focusin') {
    if (tooltipTarget instanceof HTMLElement) {
      app.scheduleStageDescriptionTooltip(tooltipTarget);
    }
    return;
  }

  if (event.type === 'mousemove') {
    if (tooltipTarget instanceof HTMLElement && state.stageDescriptionTooltipTarget === tooltipTarget && stageDescriptionTooltip instanceof HTMLElement && !stageDescriptionTooltip.hidden) {
      app.positionStageDescriptionTooltip();
    }
    return;
  }

  if (event.type === 'mouseout' || event.type === 'focusout') {
    if (!(tooltipTarget instanceof HTMLElement)) {
      app.hideStageDescriptionTooltip();
      return;
    }

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && tooltipTarget.contains(relatedTarget)) {
      return;
    }

    app.hideStageDescriptionTooltip();
  }
};

app.handleStageManagementActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-stage-management-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (button.dataset.stageManagementAction === 'clear') {
    app.openClearStagesModal(button);
    return;
  }

  if (button.dataset.stageManagementAction === 'skip') {
    void app.openStageSkipModal(button);
    return;
  }

  if (button.dataset.stageManagementAction === 'delete') {
    const stageId = Number.parseInt(button.dataset.stageId ?? '', 10);
    if (!Number.isFinite(stageId)) {
      return;
    }

    app.openStageDeleteModal({
      stageId,
      stageName: button.dataset.stageName ?? app.getStageNameById(stageId),
    }, button);
  }
};

export const initDatabaseStageManagementFeature = () => {
  app._syncStageManagementSortArrows();

  if (databaseStageManagementShell instanceof HTMLElement) {
    databaseStageManagementShell.addEventListener('click', app.handleStageManagementActionClick);
    databaseStageManagementShell.addEventListener('mouseover', app.handleStageDescriptionTooltipEvent);
    databaseStageManagementShell.addEventListener('mousemove', app.handleStageDescriptionTooltipEvent);
    databaseStageManagementShell.addEventListener('mouseout', app.handleStageDescriptionTooltipEvent);
    databaseStageManagementShell.addEventListener('focusin', app.handleStageDescriptionTooltipEvent);
    databaseStageManagementShell.addEventListener('focusout', app.handleStageDescriptionTooltipEvent);
  }

  if (databaseStageSearchInput instanceof HTMLInputElement) {
    databaseStageSearchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      state.stageManagementKeyword = databaseStageSearchInput.value.trim();
      state.stageManagementCurrentPage = 1;
      if (app.canAccessStageManagement()) {
        void app.loadSelectedAccountStages(1);
      }
    });
  }

  const stageManagementTable = document.querySelector('#database-stage-management-section .stage-management-table');
  if (stageManagementTable instanceof HTMLElement) {
    stageManagementTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (!(sortBtn instanceof HTMLButtonElement)) return;
      const sortField = sortBtn.dataset.sortField;
      if (!sortField) return;
      app._handleStageManagementSortClick(sortField);
      state.stageManagementCurrentPage = 1;
      if (app.canAccessStageManagement()) {
        void app.loadSelectedAccountStages(1);
      }
    });
  }

  if (databaseStageManagementPrevButton instanceof HTMLButtonElement) {
    databaseStageManagementPrevButton.addEventListener('click', () => {
      if (state.stageManagementCurrentPage > 1) {
        void app.loadSelectedAccountStages(state.stageManagementCurrentPage - 1);
      }
    });
  }

  if (databaseStageManagementNextButton instanceof HTMLButtonElement) {
    databaseStageManagementNextButton.addEventListener('click', () => {
      if (state.stageManagementCurrentPage < state.stageManagementTotalPages) {
        void app.loadSelectedAccountStages(state.stageManagementCurrentPage + 1);
      }
    });
  }

  if (databaseStageManagementJumpInput instanceof HTMLInputElement) {
    databaseStageManagementJumpInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      app.submitStageManagementPageJump();
    });
  }

  if (databaseStageManagementJumpButton instanceof HTMLButtonElement) {
    databaseStageManagementJumpButton.addEventListener('click', app.submitStageManagementPageJump);
  }

  window.addEventListener('scroll', app.positionStageDescriptionTooltip, true);
  window.addEventListener('resize', app.positionStageDescriptionTooltip);
};
