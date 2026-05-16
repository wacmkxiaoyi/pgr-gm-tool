import { app } from '../../shared.js';

const { dom, state } = app;
const {
  stageSkipModal,
  stageSkipSearchInput,
  stageSkipTableBody,
  stageSkipEmptyState,
  stageSkipCloseTargets,
  stageSkipSubmitButton,
} = dom;

const STAGE_SKIP_VISIBLE_LIMIT = 500;

app.getStageSkipSearchPriority = (keyword, item) => {
  if (!keyword) {
    return 0;
  }

  const stageName = String(item?.stageName ?? '').trim().toLowerCase();
  if (stageName.includes(keyword)) {
    return 0;
  }

  const stageIdText = String(item?.stageId ?? '').trim().toLowerCase();
  if (stageIdText.includes(keyword)) {
    return 1;
  }

  const stageDescription = String(item?.stageDescription ?? '').trim().toLowerCase();
  if (stageDescription.includes(keyword)) {
    return 2;
  }

  return null;
};

app._stageSkipSortFields = ['stage_id', 'name'];

app._syncStageSkipSortArrows = () => {
  const table = stageSkipModal instanceof HTMLElement ? stageSkipModal.querySelector('.stage-skip-table') : null;
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.stageSkipSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.stageSkipSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleStageSkipSortClick = (sortField) => {
  if (!app._stageSkipSortFields.includes(sortField)) return;
  if (state.stageSkipSortBy === sortField) {
    state.stageSkipSortOrder = state.stageSkipSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.stageSkipSortBy = sortField;
    state.stageSkipSortOrder = 'asc';
  }
  app._syncStageSkipSortArrows();
};

app.compareStageSkipCatalogEntries = (left, right) => {
  if (state.stageSkipSortBy === 'name') {
    const comparison = left.stageName.localeCompare(right.stageName, state.locale, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) {
      return comparison;
    }
  } else {
    const comparison = left.stageId - right.stageId;
    if (comparison !== 0) {
      return comparison;
    }
  }

  return left.stageId - right.stageId;
};

app.getFilteredStageSkipCatalog = () => {
  const keyword = state.stageSkipSearchKeyword.trim().toLowerCase();
  const direction = state.stageSkipSortOrder === 'asc' ? 1 : -1;
  return (state.stageSkipCatalog ?? [])
    .map((item) => ({
      item,
      searchPriority: app.getStageSkipSearchPriority(keyword, item),
    }))
    .filter(({ searchPriority }) => searchPriority !== null)
    .sort((left, right) => {
      if (left.searchPriority !== right.searchPriority) {
        return left.searchPriority - right.searchPriority;
      }

      return app.compareStageSkipCatalogEntries(left.item, right.item) * direction;
    })
    .map(({ item }) => item)
    .slice(0, STAGE_SKIP_VISIBLE_LIMIT);
};

app.renderStageSkipModalRows = () => {
  if (!(stageSkipTableBody instanceof HTMLElement) || !(stageSkipEmptyState instanceof HTMLElement)) {
    return;
  }

  const items = app.getFilteredStageSkipCatalog();
  const selectedStageIds = new Set(state.stageSkipSelectedStageIds ?? []);
  stageSkipTableBody.innerHTML = items.map((item) => {
    const selected = selectedStageIds.has(item.stageId);
    const stageDescription = item.stageDescription || '--';
    return `
      <tr class="weapon-add-row${selected ? ' is-selected' : ''}" data-stage-skip-row="true" data-stage-id="${item.stageId}">
        <td>${item.stageId}</td>
        <td>${app.escapeHtml(item.stageName || '--')}</td>
        <td>
          <span class="stage-skip-description">${app.escapeHtml(stageDescription)}</span>
        </td>
        <td>
          <input
            class="weapon-add-checkbox"
            type="checkbox"
            data-stage-skip-select="true"
            data-stage-id="${item.stageId}"
            ${selected ? 'checked' : ''}
          >
        </td>
      </tr>
    `;
  }).join('');

  stageSkipEmptyState.hidden = items.length > 0;
  if (stageSkipSubmitButton instanceof HTMLButtonElement) {
    stageSkipSubmitButton.disabled = state.stageSkipLoading || state.stageSkipSubmitting || (state.stageSkipCatalog?.length ?? 0) === 0;
    stageSkipSubmitButton.textContent = app.translate('runtime.stageSkipSubmit');
  }
};

app.resetStageSkipModalState = () => {
  state.stageSkipSearchKeyword = '';
  state.stageSkipSortBy = 'stage_id';
  state.stageSkipSortOrder = 'asc';
  state.stageSkipSelectedStageIds = [];
  state.stageSkipSubmitting = false;
  state.stageSkipLoading = false;
  state.stageSkipCatalog = [];
  if (stageSkipSearchInput instanceof HTMLInputElement) {
    stageSkipSearchInput.value = '';
  }
};

app.closeStageSkipModal = () => {
  app.resetStageSkipModalState();
  if (!(stageSkipModal instanceof HTMLElement) || stageSkipModal.hidden) {
    return;
  }

  stageSkipModal.hidden = true;
  app.setBodyModalOpen(false);
  if (state.lastStageSkipTrigger instanceof HTMLElement) {
    state.lastStageSkipTrigger.focus();
  }
};

app.loadStageSkipCatalog = async () => {
  if (!state.stageEntriesMap || Object.keys(state.stageEntriesMap).length === 0) {
    throw new Error(app.translate('runtime.stageSkipLoadFailed'));
  }

  const payload = await app.apiFetch('/api/database-stages/selected/cleared-ids');
  const clearedStageIds = new Set(Array.isArray(payload?.stage_ids) ? payload.stage_ids.map((stageId) => Number.parseInt(String(stageId), 10)) : []);
  state.stageSkipCatalog = Object.entries(state.stageEntriesMap ?? {})
    .map(([stageId, entry]) => ({
      stageId: Number.parseInt(stageId, 10),
      stageName: String(entry?.Name ?? '').trim(),
      stageDescription: String(entry?.Description ?? '').trim(),
    }))
    .filter((item) => Number.isFinite(item.stageId) && !clearedStageIds.has(item.stageId));
};

app.openStageSkipModal = async (trigger) => {
  if (!(stageSkipModal instanceof HTMLElement)) {
    return;
  }

  state.lastStageSkipTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetStageSkipModalState();
  state.stageSkipLoading = true;
  app._syncStageSkipSortArrows();
  stageSkipModal.hidden = false;
  app.setBodyModalOpen(true);
  if (stageSkipSubmitButton instanceof HTMLButtonElement) {
    stageSkipSubmitButton.disabled = true;
  }

  try {
    await app.loadStageSkipCatalog();
    app.renderStageSkipModalRows();
    if (stageSkipSearchInput instanceof HTMLInputElement) {
      stageSkipSearchInput.focus();
    }
  } catch (error) {
    app.closeStageSkipModal();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.stageSkipLoadFailed'));
    return;
  } finally {
    state.stageSkipLoading = false;
    app.renderStageSkipModalRows();
  }
};

app.submitStageSkipModal = async () => {
  if (!(stageSkipSubmitButton instanceof HTMLButtonElement) || state.stageSkipSubmitting) {
    return;
  }

  const stageIds = Array.from(new Set((state.stageSkipSelectedStageIds ?? [])
    .map((stageId) => Number.parseInt(String(stageId), 10))
    .filter((stageId) => Number.isFinite(stageId))));

  if (stageIds.length === 0) {
    app.openNoticeModal(app.translate('dashboard.stageSkipNoSelection'));
    return;
  }

  state.stageSkipSubmitting = true;
  stageSkipSubmitButton.disabled = true;
  stageSkipSubmitButton.textContent = app.translate('runtime.stageSkipSubmit');

  try {
    const payload = await app.apiFetch('/api/database-stages/selected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stage_ids: stageIds }),
    });

    app.closeStageSkipModal();
    app.openSuccessModal(
      app.translate('runtime.stageSkipSuccess', {
        count: payload?.added_count ?? stageIds.length,
      }),
      app.translate('runtime.stageSkipSuccessTitle'),
    );
    await app.reloadStageManagementCurrentPage();
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.stageSkipSubmitFailed'));
  } finally {
    state.stageSkipSubmitting = false;
    if (stageSkipSubmitButton instanceof HTMLButtonElement) {
      stageSkipSubmitButton.disabled = false;
    }
  }
};

export const initDatabaseStageSkipModalFeature = () => {
  stageSkipCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeStageSkipModal);
  });

  if (stageSkipSearchInput instanceof HTMLInputElement) {
    stageSkipSearchInput.addEventListener('input', () => {
      state.stageSkipSearchKeyword = stageSkipSearchInput.value.trim();
      app.renderStageSkipModalRows();
    });
  }

  const stageSkipTable = stageSkipModal instanceof HTMLElement ? stageSkipModal.querySelector('.stage-skip-table') : null;
  if (stageSkipTable instanceof HTMLElement) {
    stageSkipTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (sortBtn instanceof HTMLButtonElement && sortBtn.dataset.sortField) {
        app._handleStageSkipSortClick(sortBtn.dataset.sortField);
        app.renderStageSkipModalRows();
      }
    });
  }

  if (stageSkipTableBody instanceof HTMLElement) {
    stageSkipTableBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const row = target.closest('[data-stage-skip-row="true"]');
      if (!(row instanceof HTMLElement)) {
        return;
      }

      const stageId = Number.parseInt(row.dataset.stageId ?? '', 10);
      if (!Number.isFinite(stageId)) {
        return;
      }

      if (target instanceof HTMLInputElement && target.dataset.stageSkipSelect === 'true') {
        return;
      }

      const selectedStageIds = new Set(state.stageSkipSelectedStageIds ?? []);
      if (selectedStageIds.has(stageId)) {
        selectedStageIds.delete(stageId);
      } else {
        selectedStageIds.add(stageId);
      }

      state.stageSkipSelectedStageIds = Array.from(selectedStageIds);
      app.renderStageSkipModalRows();
    });

    stageSkipTableBody.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.dataset.stageSkipSelect !== 'true') {
        return;
      }

      const stageId = Number.parseInt(target.dataset.stageId ?? '', 10);
      if (!Number.isFinite(stageId)) {
        return;
      }

      const selectedStageIds = new Set(state.stageSkipSelectedStageIds ?? []);
      if (target.checked) {
        selectedStageIds.add(stageId);
      } else {
        selectedStageIds.delete(stageId);
      }

      state.stageSkipSelectedStageIds = Array.from(selectedStageIds);
      const row = target.closest('[data-stage-skip-row="true"]');
      if (row instanceof HTMLElement) {
        row.classList.toggle('is-selected', target.checked);
      }
    });
  }

  if (stageSkipSubmitButton instanceof HTMLButtonElement) {
    stageSkipSubmitButton.addEventListener('click', () => {
      void app.submitStageSkipModal();
    });
  }
};
