import { app } from '../shared.js';

const { dom, state } = app;
const {
  weaponAddModal,
  weaponAddSearchInput,
  weaponAddSortFieldSelect,
  weaponAddSortOrderSelect,
  weaponAddTableBody,
  weaponAddEmptyState,
  weaponAddCloseTargets,
  weaponAddSubmitButton,
} = dom;

const WEAPON_ADD_VISIBLE_LIMIT = 200;

app.getWeaponAddSearchPriority = (keyword, item) => {
  if (!keyword) {
    return 0;
  }

  const weaponName = String(item?.weaponName ?? '').trim().toLowerCase();
  if (weaponName.includes(keyword)) {
    return 0;
  }

  const weaponTypeLabel = String(item?.weaponTypeLabel ?? '').trim().toLowerCase();
  if (weaponTypeLabel.includes(keyword)) {
    return 1;
  }

  return null;
};

app.getAddableWeaponCatalog = () => {
  return Object.entries(state.weaponNameMap ?? {})
    .map(([templateId, weaponName]) => {
      const normalizedTemplateId = Number.parseInt(templateId, 10);
      return {
        templateId: normalizedTemplateId,
        weaponName: String(weaponName ?? '').trim(),
        weaponTypeLabel: app.getWeaponTypeByTemplateId(normalizedTemplateId),
        weaponStar: app.getWeaponStarByTemplateId(normalizedTemplateId) ?? 0,
        weaponIconUrl: app.getWeaponIconByTemplateId(normalizedTemplateId),
      };
    })
    .filter((item) => Number.isFinite(item.templateId) && item.weaponName && ['', '0'].includes(String(state.weaponSiteMap?.[item.templateId] ?? '').trim()));
};

app.syncWeaponAddSortControls = () => {
  if (weaponAddSortFieldSelect instanceof HTMLSelectElement) {
    weaponAddSortFieldSelect.value = state.weaponAddSortBy;
  }

  if (weaponAddSortOrderSelect instanceof HTMLSelectElement) {
    weaponAddSortOrderSelect.value = state.weaponAddSortOrder;
  }
};

app.applyWeaponAddSort = () => {
  const nextSortBy = weaponAddSortFieldSelect instanceof HTMLSelectElement ? weaponAddSortFieldSelect.value : state.weaponAddSortBy;
  const nextSortOrder = weaponAddSortOrderSelect instanceof HTMLSelectElement ? weaponAddSortOrderSelect.value : state.weaponAddSortOrder;
  state.weaponAddSortBy = ['name', 'type'].includes(nextSortBy) ? nextSortBy : 'star';
  state.weaponAddSortOrder = nextSortOrder === 'asc' ? 'asc' : 'desc';
  app.syncWeaponAddSortControls();
};

app.compareWeaponAddCatalogEntries = (left, right) => {
  if (state.weaponAddSortBy === 'name') {
    const comparison = left.weaponName.localeCompare(right.weaponName, state.locale, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) {
      return comparison;
    }
  } else if (state.weaponAddSortBy === 'type') {
    const comparison = left.weaponTypeLabel.localeCompare(right.weaponTypeLabel, state.locale, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) {
      return comparison;
    }
  } else {
    const comparison = left.weaponStar - right.weaponStar;
    if (comparison !== 0) {
      return comparison;
    }
  }

  const nameComparison = left.weaponName.localeCompare(right.weaponName, state.locale, { numeric: true, sensitivity: 'base' });
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.templateId - right.templateId;
};

app.getFilteredAddableWeaponCatalog = () => {
  const keyword = state.weaponAddSearchKeyword.trim().toLowerCase();
  const direction = state.weaponAddSortOrder === 'asc' ? 1 : -1;
  return app.getAddableWeaponCatalog()
    .map((item) => ({
      item,
      searchPriority: app.getWeaponAddSearchPriority(keyword, item),
    }))
    .filter(({ searchPriority }) => searchPriority !== null)
    .sort((left, right) => {
      if (left.searchPriority !== right.searchPriority) {
        return left.searchPriority - right.searchPriority;
      }

      return app.compareWeaponAddCatalogEntries(left.item, right.item) * direction;
    })
    .map(({ item }) => item)
    .slice(0, WEAPON_ADD_VISIBLE_LIMIT);
};

app.renderWeaponAddModalRows = () => {
  if (!(weaponAddTableBody instanceof HTMLElement) || !(weaponAddEmptyState instanceof HTMLElement)) {
    return;
  }

  const items = app.getFilteredAddableWeaponCatalog();
  const selectedTemplateIds = new Set(state.weaponAddSelectedTemplateIds ?? []);
  weaponAddTableBody.innerHTML = items.map((item) => {
    const selected = selectedTemplateIds.has(item.templateId);
    return `
      <tr class="weapon-add-row${selected ? ' is-selected' : ''}" data-weapon-add-row="true" data-template-id="${item.templateId}">
        <td>${app.renderWeaponMediaCell(item.weaponIconUrl, item.weaponName)}</td>
        <td>${item.weaponTypeLabel}</td>
        <td>${app.renderWeaponStar(item.templateId)}</td>
        <td>
          <input
            class="weapon-add-checkbox"
            type="checkbox"
            data-weapon-add-select="true"
            data-template-id="${item.templateId}"
            ${selected ? 'checked' : ''}
          >
        </td>
      </tr>
    `;
  }).join('');

  weaponAddEmptyState.hidden = items.length > 0;
};

app.resetWeaponAddModalState = () => {
  state.weaponAddSearchKeyword = '';
  state.weaponAddSortBy = 'star';
  state.weaponAddSortOrder = 'desc';
  state.weaponAddSelectedTemplateIds = [];
  state.weaponAddSubmitting = false;
  if (weaponAddSearchInput instanceof HTMLInputElement) {
    weaponAddSearchInput.value = '';
  }

  app.syncWeaponAddSortControls();
};

app.closeWeaponAddModal = () => {
  app.resetWeaponAddModalState();
  if (!(weaponAddModal instanceof HTMLElement) || weaponAddModal.hidden) {
    return;
  }

  weaponAddModal.hidden = true;
  app.setBodyModalOpen(false);
  if (state.lastAddWeaponFocusedControl instanceof HTMLElement) {
    state.lastAddWeaponFocusedControl.focus();
  }
};

app.openWeaponAddModal = (trigger) => {
  if (!(weaponAddModal instanceof HTMLElement)) {
    return;
  }

  state.lastAddWeaponFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetWeaponAddModalState();
  app.renderWeaponAddModalRows();
  weaponAddModal.hidden = false;
  app.setBodyModalOpen(true);
  if (weaponAddSearchInput instanceof HTMLInputElement) {
    weaponAddSearchInput.focus();
  }
};

app.submitWeaponAddModal = async () => {
  if (!(weaponAddSubmitButton instanceof HTMLButtonElement) || state.weaponAddSubmitting) {
    return;
  }

  const templateIds = Array.from(new Set((state.weaponAddSelectedTemplateIds ?? [])
    .map((templateId) => Number.parseInt(String(templateId), 10))
    .filter((templateId) => Number.isFinite(templateId))));

  if (templateIds.length === 0) {
    app.openControlModal(app.translate('dashboard.weaponAddNoSelection'));
    return;
  }

  state.weaponAddSubmitting = true;
  weaponAddSubmitButton.disabled = true;

  try {
    const payload = await app.apiFetch('/api/database-weapons/selected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template_ids: templateIds }),
    });

    app.closeWeaponAddModal();
    app.openSuccessModal(
      app.translate('runtime.weaponAddSuccess', {
        addedCount: payload?.added_count ?? templateIds.length,
      }),
      app.translate('runtime.weaponAddSuccessTitle'),
    );
    await app.reloadWeaponManagementCurrentPage();
  } catch (error) {
    app.openControlModal(app.apiErrorMessage(error, 'runtime.weaponAddFailed'));
  } finally {
    state.weaponAddSubmitting = false;
    if (weaponAddSubmitButton instanceof HTMLButtonElement) {
      weaponAddSubmitButton.disabled = false;
    }
  }
};

export const initDatabaseWeaponAddModalFeature = () => {
  app.syncWeaponAddSortControls();

  weaponAddCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeWeaponAddModal);
  });

  if (weaponAddSearchInput instanceof HTMLInputElement) {
    weaponAddSearchInput.addEventListener('input', () => {
      state.weaponAddSearchKeyword = weaponAddSearchInput.value.trim();
      app.renderWeaponAddModalRows();
    });
  }

  if (weaponAddSortFieldSelect instanceof HTMLSelectElement) {
    weaponAddSortFieldSelect.addEventListener('change', () => {
      app.applyWeaponAddSort();
      app.renderWeaponAddModalRows();
    });
  }

  if (weaponAddSortOrderSelect instanceof HTMLSelectElement) {
    weaponAddSortOrderSelect.addEventListener('change', () => {
      app.applyWeaponAddSort();
      app.renderWeaponAddModalRows();
    });
  }

  if (weaponAddTableBody instanceof HTMLElement) {
    weaponAddTableBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const row = target.closest('[data-weapon-add-row="true"]');
      if (!(row instanceof HTMLElement)) {
        return;
      }

      const templateId = Number.parseInt(row.dataset.templateId ?? '', 10);
      if (!Number.isFinite(templateId)) {
        return;
      }

      if (target instanceof HTMLInputElement && target.dataset.weaponAddSelect === 'true') {
        return;
      }

      const selectedTemplateIds = new Set(state.weaponAddSelectedTemplateIds ?? []);
      if (selectedTemplateIds.has(templateId)) {
        selectedTemplateIds.delete(templateId);
      } else {
        selectedTemplateIds.add(templateId);
      }

      state.weaponAddSelectedTemplateIds = Array.from(selectedTemplateIds);
      app.renderWeaponAddModalRows();
    });

    weaponAddTableBody.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.dataset.weaponAddSelect !== 'true') {
        return;
      }

      const templateId = Number.parseInt(target.dataset.templateId ?? '', 10);
      if (!Number.isFinite(templateId)) {
        return;
      }

      const selectedTemplateIds = new Set(state.weaponAddSelectedTemplateIds ?? []);
      if (target.checked) {
        selectedTemplateIds.add(templateId);
      } else {
        selectedTemplateIds.delete(templateId);
      }

      state.weaponAddSelectedTemplateIds = Array.from(selectedTemplateIds);
      const row = target.closest('[data-weapon-add-row="true"]');
      if (row instanceof HTMLElement) {
        row.classList.toggle('is-selected', target.checked);
      }
    });
  }

  if (weaponAddSubmitButton instanceof HTMLButtonElement) {
    weaponAddSubmitButton.addEventListener('click', () => {
      void app.submitWeaponAddModal();
    });
  }
};
