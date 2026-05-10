import { app } from '../shared.js';

const { dom, state } = app;
const {
  memoryAddModal,
  memoryAddSearchInput,
  memoryAddTableBody,
  memoryAddEmptyState,
  memoryAddCloseTargets,
  memoryAddSubmitButton,
} = dom;

const MEMORY_ADD_VISIBLE_LIMIT = 200;

app.getMemoryAddSearchPriority = (keyword, item) => {
  if (!keyword) {
    return 0;
  }

  const memoryName = String(item?.memoryName ?? '').trim().toLowerCase();
  if (memoryName.includes(keyword)) {
    return 0;
  }

  return null;
};

app.getAddableMemoryCatalog = () => {
  return Object.entries(state.equipNameMap ?? {})
    .map(([templateId, memoryName]) => {
      const normalizedTemplateId = Number.parseInt(templateId, 10);
      const positionLabel = app.getMemoryPositionByTemplateId(normalizedTemplateId);
      return {
        templateId: normalizedTemplateId,
        memoryName: String(memoryName ?? '').trim(),
        memoryPositionLabel: positionLabel,
        memoryStar: app.getWeaponStarByTemplateId(normalizedTemplateId) ?? 0,
        memoryIconUrl: app.getWeaponIconByTemplateId(normalizedTemplateId),
      };
    })
    .filter((item) => Number.isFinite(item.templateId) && item.memoryName && item.memoryPositionLabel !== '--');
};

app._memoryAddSortFields = ['star', 'name', 'position'];

app._syncMemoryAddSortArrows = () => {
  const table = memoryAddModal instanceof HTMLElement ? memoryAddModal.querySelector('.weapon-add-table') : null;
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.memoryAddSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.memoryAddSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleMemoryAddSortClick = (sortField) => {
  if (!app._memoryAddSortFields.includes(sortField)) return;
  if (state.memoryAddSortBy === sortField) {
    state.memoryAddSortOrder = state.memoryAddSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.memoryAddSortBy = sortField;
    state.memoryAddSortOrder = 'asc';
  }
  app._syncMemoryAddSortArrows();
};

app.compareMemoryAddCatalogEntries = (left, right) => {
  if (state.memoryAddSortBy === 'name') {
    const comparison = left.memoryName.localeCompare(right.memoryName, state.locale, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) {
      return comparison;
    }
  } else if (state.memoryAddSortBy === 'position') {
    const comparison = Number(left.memoryPositionLabel) - Number(right.memoryPositionLabel);
    if (comparison !== 0) {
      return comparison;
    }
  } else {
    const comparison = left.memoryStar - right.memoryStar;
    if (comparison !== 0) {
      return comparison;
    }
  }

  const nameComparison = left.memoryName.localeCompare(right.memoryName, state.locale, { numeric: true, sensitivity: 'base' });
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.templateId - right.templateId;
};

app.getFilteredAddableMemoryCatalog = () => {
  const keyword = state.memoryAddSearchKeyword.trim().toLowerCase();
  const direction = state.memoryAddSortOrder === 'asc' ? 1 : -1;
  return app.getAddableMemoryCatalog()
    .map((item) => ({
      item,
      searchPriority: app.getMemoryAddSearchPriority(keyword, item),
    }))
    .filter(({ searchPriority }) => searchPriority !== null)
    .sort((left, right) => {
      if (left.searchPriority !== right.searchPriority) {
        return left.searchPriority - right.searchPriority;
      }

      return app.compareMemoryAddCatalogEntries(left.item, right.item) * direction;
    })
    .map(({ item }) => item)
    .slice(0, MEMORY_ADD_VISIBLE_LIMIT);
};

app.renderMemoryAddModalRows = () => {
  if (!(memoryAddTableBody instanceof HTMLElement) || !(memoryAddEmptyState instanceof HTMLElement)) {
    return;
  }

  const items = app.getFilteredAddableMemoryCatalog();
  const selectedTemplateIds = new Set(state.memoryAddSelectedTemplateIds ?? []);
  memoryAddTableBody.innerHTML = items.map((item) => {
    const selected = selectedTemplateIds.has(item.templateId);
    return `
      <tr class="weapon-add-row${selected ? ' is-selected' : ''}" data-memory-add-row="true" data-template-id="${item.templateId}">
        <td>${app.renderWeaponMediaCell(item.memoryIconUrl, item.memoryName)}</td>
        <td>${app.escapeHtml(item.memoryPositionLabel)}</td>
        <td>${app.renderWeaponStar(item.templateId)}</td>
        <td>
          <input
            class="weapon-add-checkbox"
            type="checkbox"
            data-memory-add-select="true"
            data-template-id="${item.templateId}"
            ${selected ? 'checked' : ''}
          >
        </td>
      </tr>
    `;
  }).join('');

  memoryAddEmptyState.hidden = items.length > 0;
};

app.resetMemoryAddModalState = () => {
  state.memoryAddSearchKeyword = '';
  state.memoryAddSortBy = 'star';
  state.memoryAddSortOrder = 'desc';
  state.memoryAddSelectedTemplateIds = [];
  state.memoryAddSubmitting = false;
  if (memoryAddSearchInput instanceof HTMLInputElement) {
    memoryAddSearchInput.value = '';
  }
};

app.closeMemoryAddModal = () => {
  app.resetMemoryAddModalState();
  if (!(memoryAddModal instanceof HTMLElement) || memoryAddModal.hidden) {
    return;
  }

  memoryAddModal.hidden = true;
  app.setBodyModalOpen(false);
  if (state.lastAddMemoryFocusedControl instanceof HTMLElement) {
    state.lastAddMemoryFocusedControl.focus();
  }
};

app.openMemoryAddModal = (trigger) => {
  if (!(memoryAddModal instanceof HTMLElement)) {
    return;
  }

  state.lastAddMemoryFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetMemoryAddModalState();
  app._syncMemoryAddSortArrows();
  app.renderMemoryAddModalRows();
  memoryAddModal.hidden = false;
  app.setBodyModalOpen(true);
  if (memoryAddSearchInput instanceof HTMLInputElement) {
    memoryAddSearchInput.focus();
  }
};

app.submitMemoryAddModal = async () => {
  if (!(memoryAddSubmitButton instanceof HTMLButtonElement) || state.memoryAddSubmitting) {
    return;
  }

  const templateIds = Array.from(new Set((state.memoryAddSelectedTemplateIds ?? [])
    .map((templateId) => Number.parseInt(String(templateId), 10))
    .filter((templateId) => Number.isFinite(templateId))));

  if (templateIds.length === 0) {
    app.openControlModal(app.translate('dashboard.memoryAddNoSelection'));
    return;
  }

  state.memoryAddSubmitting = true;
  memoryAddSubmitButton.disabled = true;

  try {
    const payload = await app.apiFetch('/api/database-memories/selected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_ids: templateIds }),
    });

    app.closeMemoryAddModal();
    app.openSuccessModal(
      app.translate('runtime.memoryAddSuccess', {
        addedCount: payload?.added_count ?? templateIds.length,
      }),
      app.translate('runtime.memoryAddSuccessTitle'),
    );
    await app.reloadMemoryManagementCurrentPage();
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openControlModal(app.apiErrorMessage(error, 'runtime.memoryAddFailed'));
  } finally {
    state.memoryAddSubmitting = false;
    if (memoryAddSubmitButton instanceof HTMLButtonElement) {
      memoryAddSubmitButton.disabled = false;
    }
  }
};

export const initDatabaseMemoryAddModalFeature = () => {
  memoryAddCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeMemoryAddModal);
  });

  if (memoryAddSearchInput instanceof HTMLInputElement) {
    memoryAddSearchInput.addEventListener('input', () => {
      state.memoryAddSearchKeyword = memoryAddSearchInput.value.trim();
      app.renderMemoryAddModalRows();
    });
  }

  const memoryAddTable = memoryAddModal instanceof HTMLElement ? memoryAddModal.querySelector('.weapon-add-table') : null;
  if (memoryAddTable instanceof HTMLElement) {
    memoryAddTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (sortBtn instanceof HTMLButtonElement && sortBtn.dataset.sortField) {
        app._handleMemoryAddSortClick(sortBtn.dataset.sortField);
        app.renderMemoryAddModalRows();
      }
    });
  }

  if (memoryAddTableBody instanceof HTMLElement) {
    memoryAddTableBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const row = target.closest('[data-memory-add-row="true"]');
      if (!(row instanceof HTMLElement)) {
        return;
      }

      const templateId = Number.parseInt(row.dataset.templateId ?? '', 10);
      if (!Number.isFinite(templateId)) {
        return;
      }

      if (target instanceof HTMLInputElement && target.dataset.memoryAddSelect === 'true') {
        return;
      }

      const selectedTemplateIds = new Set(state.memoryAddSelectedTemplateIds ?? []);
      if (selectedTemplateIds.has(templateId)) {
        selectedTemplateIds.delete(templateId);
      } else {
        selectedTemplateIds.add(templateId);
      }

      state.memoryAddSelectedTemplateIds = Array.from(selectedTemplateIds);
      app.renderMemoryAddModalRows();
    });

    memoryAddTableBody.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.dataset.memoryAddSelect !== 'true') {
        return;
      }

      const templateId = Number.parseInt(target.dataset.templateId ?? '', 10);
      if (!Number.isFinite(templateId)) {
        return;
      }

      const selectedTemplateIds = new Set(state.memoryAddSelectedTemplateIds ?? []);
      if (target.checked) {
        selectedTemplateIds.add(templateId);
      } else {
        selectedTemplateIds.delete(templateId);
      }

      state.memoryAddSelectedTemplateIds = Array.from(selectedTemplateIds);
      const row = target.closest('[data-memory-add-row="true"]');
      if (row instanceof HTMLElement) {
        row.classList.toggle('is-selected', target.checked);
      }
    });
  }

  if (memoryAddSubmitButton instanceof HTMLButtonElement) {
    memoryAddSubmitButton.addEventListener('click', () => {
      void app.submitMemoryAddModal();
    });
  }
};
