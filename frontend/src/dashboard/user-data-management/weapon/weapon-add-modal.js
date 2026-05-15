import { app } from '../../shared.js';

const { dom, state } = app;
const {
  weaponAddModal,
  weaponAddSearchInput,
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
  return Object.entries(state.equipNameMap ?? {})
    .map(([templateId, weaponName]) => {
      const normalizedTemplateId = Number.parseInt(templateId, 10);
      return {
        templateId: normalizedTemplateId,
        weaponName: String(weaponName ?? '').trim(),
        weaponTypeLabel: app.getWeaponTypeByTemplateId(normalizedTemplateId),
        weaponStar: app.getEquipStarByTemplateId(normalizedTemplateId) ?? 0,
        weaponIconUrl: app.getEquipIconByTemplateId(normalizedTemplateId),
      };
    })
    .filter((item) => Number.isFinite(item.templateId) && item.weaponName && ['', '0'].includes(String(state.equipSiteMap?.[item.templateId] ?? '').trim()));
};

app._weaponAddSortFields = ['star', 'name', 'type'];

app._syncWeaponAddSortArrows = () => {
  const table = weaponAddModal instanceof HTMLElement ? weaponAddModal.querySelector('.weapon-add-table') : null;
  if (!(table instanceof HTMLElement)) return;
  const buttons = table.querySelectorAll('.column-sort-btn');
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const arrow = btn.querySelector('.column-sort-arrow');
    if (!(arrow instanceof HTMLElement)) return;
    if (btn.dataset.sortField === state.weaponAddSortBy) {
      arrow.hidden = false;
      arrow.classList.toggle('desc', state.weaponAddSortOrder === 'desc');
    } else {
      arrow.hidden = true;
      arrow.classList.remove('desc');
    }
  });
};

app._handleWeaponAddSortClick = (sortField) => {
  if (!app._weaponAddSortFields.includes(sortField)) return;
  if (state.weaponAddSortBy === sortField) {
    state.weaponAddSortOrder = state.weaponAddSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.weaponAddSortBy = sortField;
    state.weaponAddSortOrder = 'asc';
  }
  app._syncWeaponAddSortArrows();
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
        <td>${app.renderEquipMediaCell(item.weaponIconUrl, item.weaponName)}</td>
        <td>${item.weaponTypeLabel}</td>
        <td>${app.renderEquipStar(item.templateId)}</td>
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
};

app.closeWeaponAddModal = () => {
  app.resetWeaponAddModalState();
  if (!(weaponAddModal instanceof HTMLElement) || weaponAddModal.hidden) {
    return;
  }

  weaponAddModal.hidden = true;
  app.setBodyModalOpen(false);
  if (state.lastWeaponAddTrigger instanceof HTMLElement) {
    state.lastWeaponAddTrigger.focus();
  }
};

app.openWeaponAddModal = (trigger) => {
  if (!(weaponAddModal instanceof HTMLElement)) {
    return;
  }

  state.lastWeaponAddTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetWeaponAddModalState();
  app._syncWeaponAddSortArrows();
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
    app.openNoticeModal(app.translate('dashboard.weaponAddNoSelection'));
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
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.equipsAddFailed'));
  } finally {
    state.weaponAddSubmitting = false;
    if (weaponAddSubmitButton instanceof HTMLButtonElement) {
      weaponAddSubmitButton.disabled = false;
    }
  }
};

export const initDatabaseWeaponAddModalFeature = () => {
  weaponAddCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeWeaponAddModal);
  });

  if (weaponAddSearchInput instanceof HTMLInputElement) {
    weaponAddSearchInput.addEventListener('input', () => {
      state.weaponAddSearchKeyword = weaponAddSearchInput.value.trim();
      app.renderWeaponAddModalRows();
    });
  }

  const weaponAddTable = weaponAddModal instanceof HTMLElement ? weaponAddModal.querySelector('.weapon-add-table') : null;
  if (weaponAddTable instanceof HTMLElement) {
    weaponAddTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const sortBtn = target.closest('.column-sort-btn');
      if (sortBtn instanceof HTMLButtonElement && sortBtn.dataset.sortField) {
        app._handleWeaponAddSortClick(sortBtn.dataset.sortField);
        app.renderWeaponAddModalRows();
      }
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
