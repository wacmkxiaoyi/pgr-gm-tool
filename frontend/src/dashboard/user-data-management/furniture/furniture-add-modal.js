import { app } from '../../shared.js';

const { state } = app;
const el = (id) => document.getElementById(id);
const modal = el('furniture-add-modal');
const picker = el('furniture-additions-modal');
const text = (key, params = {}) => app.translate(`dashboard.furniture${key}`, params);
const escape = (value) => app.escapeHtml(String(value ?? '--'));
const attrs = ['beauty', 'comfort', 'utility'].map((key) => el(`furniture-attr-${key}`));
const selection = { ids: new Set(), sort: 'name', order: 'asc' };
const additions = { ids: new Set(), sort: 'id', order: 'asc' };
let mode = 'furniture';
let chosenAdditions = [];
let uid = null;
let trigger = null;
let submitting = false;

const syncAttributes = () => {
  const custom = modal.querySelector('[name="furniture-attr-mode"]:checked').value === 'custom';
  attrs.forEach((input) => { input.disabled = !custom || submitting; });
  el('furniture-custom-inputs').classList.toggle('is-disabled', !custom);
  el('furniture-auto-description').classList.toggle('is-disabled', custom);
};

const syncAdditions = () => {
  app.hideStageDescriptionTooltip?.();
  const button = el('furniture-additions-open');
  button.textContent = chosenAdditions.length
    ? text('ExtraSelected', { count: chosenAdditions.length, ids: chosenAdditions.join(', ') }) : text('None');
  button.dataset.stageTooltipText = chosenAdditions.length
    ? chosenAdditions.map((id) => `${id}：${state.furnitureAdditionalAttrEntriesMap?.[id]?.Introduce || '--'}`).join('\n')
    : text('ExtraNone');
};

const renderCatalog = (extra = false) => {
  const container = extra ? picker : modal;
  const model = extra ? additions : selection;
  const keyword = el(extra ? 'furniture-additions-search' : 'furniture-add-search').value.trim().toLowerCase();
  const grouped = !extra && (mode === 'template' || mode === 'suit');
  const rows = extra
    ? Object.entries(state.furnitureAdditionalAttrEntriesMap ?? {}).map(([id, resource]) => ({ id: Number(id), description: resource.Introduce || '--' }))
    : mode === 'template' ? Object.entries(state.dormTemplateEntriesMap ?? {}).map(([id, resource]) => ({ id: Number(id), name: resource.Name || '--' }))
    : mode === 'suit' ? Object.entries(state.furnitureSuitNameMap ?? {})
      .filter(([id]) => Object.values(state.furnitureEntriesMap ?? {}).some((resource) => resource.SuitId === Number(id)))
      .map(([id, name]) => ({ id: Number(id), name: name || '--' }))
    : Object.entries(state.furnitureEntriesMap ?? {}).map(([id, resource]) => ({
      id: Number(id), name: resource.Name || '--',
      type: state.furnitureTypeEntiresMap?.[resource.TypeId]?.CategoryName || '--',
      suit: state.furnitureSuitNameMap?.[resource.SuitId] || '--',
    }));
  const filtered = rows.filter((row) => Object.entries(row).some(([key, value]) => (extra || key !== 'id') && String(value).toLowerCase().includes(keyword)));
  filtered.sort((left, right) => {
    const comparison = model.sort === 'id' ? left.id - right.id
      : String(left[model.sort]).localeCompare(String(right[model.sort]), state.locale, { numeric: true, sensitivity: 'base' });
    return (comparison || left.id - right.id) * (model.order === 'asc' ? 1 : -1);
  });
  app.hideStageDescriptionTooltip?.();
  el(extra ? 'furniture-additions-body' : 'furniture-add-body').innerHTML = filtered.map((row) => {
    const checked = model.ids.has(row.id);
    const cells = extra ? `<td>${row.id}</td><td><span class="stage-management-description" data-stage-tooltip-text="${escape(row.description)}" tabindex="0">${escape(row.description)}</span></td>`
      : grouped ? `<td>${escape(row.name)}</td>` : `<td>${escape(row.name)}</td><td>${escape(row.type)}</td><td>${escape(row.suit)}</td>`;
    return `<tr class="weapon-add-row${checked ? ' is-selected' : ''}" data-furniture-choice="${row.id}">${cells}<td><input type="checkbox" class="weapon-add-checkbox" data-furniture-select="${row.id}" aria-label="${escape(extra ? `${row.id}: ${row.description}` : row.name)}" ${checked ? 'checked' : ''}></td></tr>`;
  }).join('');
  el(extra ? 'furniture-additions-empty' : 'furniture-add-empty').hidden = filtered.length > 0;
  container.querySelectorAll('.column-sort-btn').forEach((button) => {
    const arrow = button.querySelector('.column-sort-arrow');
    arrow.hidden = button.dataset.sortField !== model.sort;
    arrow.classList.toggle('desc', model.order === 'desc');
  });
};

const syncMode = () => {
  const grouped = mode === 'template' || mode === 'suit';
  const table = modal.querySelector('.furniture-add-table');
  table.classList.toggle('is-group-mode', grouped);
  table.querySelectorAll('colgroup col, thead th').forEach((cell, index) => {
    const column = index % 4;
    cell.hidden = grouped && (column === 1 || column === 2);
  });
  el('furniture-add-search').hidden = mode === 'all';
  el('furniture-add-table-shell').hidden = mode === 'all';
  el('furniture-unlock-description').hidden = mode !== 'all';
  const searchKey = mode === 'template' ? 'TemplateSearch' : mode === 'suit' ? 'SuitSearch' : 'AddSearch';
  el('furniture-add-search').dataset.i18nPlaceholder = `dashboard.furniture${searchKey}`;
  el('furniture-add-search').placeholder = text(searchKey);
};

app.closeFurnitureAdditionsModal = () => {
  if (picker.hidden || submitting) return;
  picker.hidden = true;
  app.hideStageDescriptionTooltip?.();
  app.setBodyModalOpen(!modal.hidden);
  el('furniture-additions-open').focus();
};

app.closeFurnitureAddModal = (force = false) => {
  if (submitting && force !== true) return;
  picker.hidden = true;
  if (modal.hidden) return;
  modal.hidden = true;
  uid = null;
  app.hideStageDescriptionTooltip?.();
  app.setBodyModalOpen(false);
  trigger?.focus();
};

app.handleFurnitureAddEscape = () => {
  if ((!modal.hidden || !picker.hidden) && !el('player-mutation-risk-modal').hidden) {
    app.closePlayerMutationRiskModal();
    app.setBodyModalOpen(true);
    return true;
  }
  if ((!modal.hidden || !picker.hidden) && !el('notice-modal').hidden) {
    app.closeNoticeModal();
    app.setBodyModalOpen(true);
    return true;
  }
  if (!picker.hidden) { app.closeFurnitureAdditionsModal(); return true; }
  if (!modal.hidden) { app.closeFurnitureAddModal(); return true; }
  return false;
};

app.openFurnitureAddModal = (button) => {
  if (!app.canAccessFurnitureManagement() || state.furnitureManagement.loading || state.furnitureManagement.submitting || submitting) return;
  uid = state.selectedAccountUid;
  trigger = button;
  selection.ids = new Set();
  mode = 'furniture';
  selection.sort = 'name'; selection.order = 'asc';
  chosenAdditions = [321, 322].filter((id) => state.furnitureAdditionalAttrEntriesMap?.[id]);
  el('furniture-unlock-all').checked = false;
  el('furniture-by-template').checked = false;
  el('furniture-by-suit').checked = false;
  el('furniture-add-search').value = '';
  el('furniture-add-search').hidden = false;
  el('furniture-add-table-shell').hidden = false;
  el('furniture-unlock-description').hidden = true;
  el('furniture-advanced').open = false;
  modal.querySelector('[name="furniture-attr-mode"][value="auto"]').checked = true;
  attrs.forEach((input) => { input.value = '0'; });
  syncMode(); syncAttributes(); syncAdditions(); renderCatalog();
  modal.hidden = false;
  app.setBodyModalOpen(true);
  el('furniture-add-search').focus();
};

const setSubmitting = (value) => {
  submitting = value;
  state.furnitureManagement.submitting = value;
  modal.querySelectorAll('button, input').forEach((control) => { control.disabled = value; });
  syncAttributes();
  app.syncFurnitureManagementControls();
};

app.submitFurnitureAddModal = async () => {
  if (submitting || modal.hidden || !app.canAccessFurnitureManagement() || uid !== state.selectedAccountUid) return;
  const unlockAll = el('furniture-unlock-all').checked;
  if (!unlockAll && !selection.ids.size) { app.openNoticeModal(text(mode === 'furniture' ? 'AddNoSelection' : 'GroupNoSelection')); return; }
  const attrMode = modal.querySelector('[name="furniture-attr-mode"]:checked').value;
  const values = attrs.map((input) => Number(input.value));
  if (attrMode === 'custom' && attrs.some((input, index) => !input.value.trim() || !input.checkValidity() || !Number.isInteger(values[index]) || values[index] < 0 || values[index] > 9999999)) {
    app.openNoticeModal(text('InvalidAttributes')); return;
  }
  const requestUid = uid;
  const requestId = state.furnitureManagement.requestId;
  const ids = [...selection.ids].sort((a, b) => a - b);
  const payload = { config_ids: mode === 'furniture' ? ids : [], unlock_all: unlockAll,
    attr_mode: attrMode, attr_list: attrMode === 'custom' ? values : null, addition_ids: [...chosenAdditions] };
  if (mode === 'template') payload.template_ids = ids;
  if (mode === 'suit') payload.suit_ids = ids;
  setSubmitting(true);
  try {
    const result = await app.apiFetch('/api/database-furnitures/selected', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (requestUid !== state.selectedAccountUid || requestId !== state.furnitureManagement.requestId) return;
    app.closeFurnitureAddModal();
    app.openSuccessModal(text(unlockAll ? 'Unlocked' : 'Added', { count: result.added_count }));
    await app.loadSelectedAccountFurnitures();
  } catch (error) {
    if (requestUid === state.selectedAccountUid && requestId === state.furnitureManagement.requestId && !app.isMutationRiskCancelled(error)) {
      app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.furnitureMutationFailed'));
    }
  } finally {
    setSubmitting(false);
    if (requestUid !== state.selectedAccountUid && app.isDatabaseFurnitureManagementSectionActive()) void app.loadSelectedAccountFurnitures();
    if (!modal.hidden) app.setBodyModalOpen(true);
  }
};

const bindCatalog = (extra) => {
  const container = extra ? picker : modal;
  const model = extra ? additions : selection;
  const table = container.querySelector('table');
  el(extra ? 'furniture-additions-search' : 'furniture-add-search').addEventListener('input', () => renderCatalog(extra));
  table.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement) || submitting) return;
    const button = event.target.closest('.column-sort-btn');
    if (button) {
      model.order = model.sort === button.dataset.sortField && model.order === 'asc' ? 'desc' : 'asc';
      model.sort = button.dataset.sortField;
      renderCatalog(extra); return;
    }
    const row = event.target.closest('[data-furniture-choice]');
    if (!row || event.target instanceof HTMLInputElement) return;
    const id = Number(row.dataset.furnitureChoice);
    if (model.ids.has(id)) model.ids.delete(id); else model.ids.add(id);
    const checkbox = row.querySelector('input');
    checkbox.checked = model.ids.has(id);
    row.classList.toggle('is-selected', checkbox.checked);
  });
  table.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.furnitureSelect || submitting) return;
    const id = Number(input.dataset.furnitureSelect);
    if (input.checked) model.ids.add(id); else model.ids.delete(id);
    input.closest('tr').classList.toggle('is-selected', input.checked);
  });
};

export const initDatabaseFurnitureAddModalFeature = () => {
  // Closing an overlay must keep scrolling locked while its parent stays open.
  const overlayObserver = new MutationObserver(() => {
    if (!modal.hidden) app.setBodyModalOpen(true);
  });
  ['notice-modal', 'player-mutation-risk-modal'].forEach((id) => overlayObserver.observe(el(id), { attributes: true, attributeFilter: ['hidden'] }));
  el('furniture-add').addEventListener('click', (event) => app.openFurnitureAddModal(event.currentTarget));
  modal.querySelectorAll('[data-furniture-add-close]').forEach((button) => button.addEventListener('click', () => app.closeFurnitureAddModal()));
  picker.querySelectorAll('[data-furniture-additions-close]').forEach((button) => button.addEventListener('click', app.closeFurnitureAdditionsModal));
  const modeInputs = [['furniture-unlock-all', 'all'], ['furniture-by-template', 'template'], ['furniture-by-suit', 'suit']];
  modeInputs.forEach(([id, selectedMode]) => el(id).addEventListener('change', (event) => {
    mode = event.target.checked ? selectedMode : 'furniture';
    modeInputs.forEach(([otherId]) => { if (otherId !== id) el(otherId).checked = false; });
    selection.ids = new Set();
    selection.sort = 'name'; selection.order = 'asc';
    el('furniture-add-search').value = '';
    syncMode(); renderCatalog();
  }));
  modal.querySelectorAll('[name="furniture-attr-mode"]').forEach((input) => input.addEventListener('change', syncAttributes));
  el('furniture-additions-open').addEventListener('click', () => {
    if (submitting) return;
    additions.ids = new Set(chosenAdditions);
    additions.sort = 'id'; additions.order = 'asc';
    el('furniture-additions-search').value = '';
    renderCatalog(true);
    picker.hidden = false;
    app.setBodyModalOpen(true);
    el('furniture-additions-search').focus();
  });
  el('furniture-additions-submit').addEventListener('click', () => {
    chosenAdditions = [...additions.ids];
    syncAdditions();
    app.closeFurnitureAdditionsModal();
  });
  el('furniture-add-submit').addEventListener('click', () => void app.submitFurnitureAddModal());
  ['mouseover', 'focusin', 'mousemove', 'mouseout', 'focusout'].forEach((type) => {
    el('furniture-additions-open').addEventListener(type, app.handleStageDescriptionTooltipEvent);
  });
  bindCatalog(false); bindCatalog(true);
  ['mouseover', 'focusin', 'mousemove', 'mouseout', 'focusout'].forEach((type) => {
    picker.addEventListener(type, (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest('[data-stage-tooltip-text]') : null;
      if (target && (type === 'mouseout' || type === 'focusout' || target.scrollWidth > target.clientWidth)) app.handleStageDescriptionTooltipEvent(event);
    });
  });
};
