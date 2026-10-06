import { app } from '../../shared.js';

const { state } = app;
const byId = (id) => document.getElementById(id);
const panel = byId('database-partner-management-section');
const shell = byId('partner-shell');
const body = byId('partner-body');
const addModal = byId('partner-add-modal');
const deleteModal = byId('partner-delete-modal');
const tooltip = byId('partner-description-tooltip');
const view = {
  page: 1, totalPages: 0, items: [], loaded: false, loading: false,
  keyword: '', sort: 'character', order: 'asc', generation: 0,
  selected: new Set(), addSort: 'quality', addOrder: 'desc',
  submitting: false, pendingDelete: null, mutationUid: null,
  lastAddTrigger: null, lastDeleteTrigger: null, tooltipTimer: null,
};

const text = (key, params = {}) => app.translate(`dashboard.${key}`, params);
const entry = (id) => state.partnerEntriesMap?.[id] ?? {};
const qualityMarkup = (quality, star = 0) => `<span class="character-quality ${app.getCharacterQualityClass(quality)}">${app.escapeHtml(app.getCharacterQualityDisplayLabel(quality, quality < 6 ? star : 0))}</span>`;
const media = (id, quality) => app.renderEquipMediaCell(entry(id).Icon ?? '', entry(id).Name ?? '--', true, app.getCharacterIconEffectClass(quality));
const syncArrows = (root, field, order) => root.querySelectorAll('.column-sort-btn').forEach((button) => {
  const arrow = button.querySelector('.column-sort-arrow');
  arrow.hidden = button.dataset.sortField !== field;
  arrow.classList.toggle('desc', order === 'desc');
});

app.canAccessPartnerManagement = (payload = state.databaseHealthSnapshot) => app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null;
app.isDatabasePartnerManagementSectionActive = () => !panel.hidden;

const updatePagination = () => {
  byId('partner-pagination').textContent = app.translate('dashboard.accountsPagination', { page: view.totalPages ? view.page : 0, totalPages: view.totalPages });
  byId('partner-prev').disabled = view.loading || view.page <= 1 || !app.canAccessPartnerManagement();
  byId('partner-next').disabled = view.loading || view.page >= view.totalPages || !app.canAccessPartnerManagement();
  byId('partner-jump').disabled = view.loading || !view.totalPages;
  byId('partner-jump-button').disabled = view.loading || !view.totalPages;
};

const renderRows = () => {
  body.innerHTML = view.items.map((item, index) => `
    <tr>
      <td>${(view.page - 1) * 10 + index + 1}</td>
      <td>${media(item.TemplateId, item.Quality)}</td>
      <td>${qualityMarkup(item.Quality, item.Star)}</td>
      <td>${app.renderEquipEnhancementLevel({ ...item, Breakthrough: item.BreakThrough })}</td>
      <td>${app.renderEquipMediaCell(app.getCharacterIconByCharacterId(item.CharacterId), app.getCharacterNameByCharacterId(item.CharacterId), false)}</td>
      <td><div class="accounts-row-actions">
        <button class="status-action-button status-action-button-log" type="button" data-partner-detail="${item.record_id}">${app.translate('dashboard.equipManagementDetail')}</button>
        <button class="status-action-button status-action-button-stop" type="button" data-partner-delete="${item.record_id}" ${item.CharacterId || view.submitting ? 'disabled' : ''}>${app.translate('dashboard.equipManagementDelete')}</button>
      </div></td>
    </tr>`).join('');
};

app.resetPartnerManagementView = () => {
  app.closeCharacterPartnerSwitchModal?.();
  view.generation += 1;
  Object.assign(view, { page: 1, totalPages: 0, items: [], loaded: false, loading: false, keyword: '' });
  byId('partner-search').value = '';
  body.innerHTML = '';
  byId('partner-summary').textContent = '';
  app.closePartnerAddModal();
  app.closePartnerDeleteModal();
  app.closePartnerDetailModal?.();
  updatePagination();
};

app.updatePartnerManagementAccess = (payload = state.databaseHealthSnapshot) => {
  const accessible = app.canAccessPartnerManagement(payload);
  byId('database-partner-management-subnav').disabled = !accessible;
  if (!accessible) {
    app.resetPartnerManagementView();
    shell.hidden = true;
    byId('partner-state').hidden = false;
    byId('partner-state').textContent = text(app.isDatabaseHealthy(payload) ? 'partnerChooseAccount' : 'partnerUnavailable');
    if (app.isDatabasePartnerManagementSectionActive()) app.setActiveDatabaseTab(app.isDatabaseHealthy(payload) ? 'database-accounts-section' : 'database-service-status-section');
  } else if (!view.loaded) {
    byId('partner-state').hidden = false;
    byId('partner-state').textContent = text('partnerReady');
  }
  syncArrows(panel, view.sort, view.order);
  updatePagination();
};

app.loadSelectedAccountPartners = async (page = view.page) => {
  if (!app.canAccessPartnerManagement()) return;
  const generation = ++view.generation;
  const uid = state.selectedAccountUid;
  view.loading = true;
  updatePagination();
  byId('partner-state').hidden = false;
  byId('partner-state').textContent = app.translate('common.loading');
  try {
    const params = new URLSearchParams({ page: String(page), page_size: '10', keyword: view.keyword, sort_by: view.sort, sort_order: view.order });
    const payload = await app.apiFetch(`/api/database-partners/selected?${params}`);
    if (generation !== view.generation || uid !== state.selectedAccountUid) return;
    view.page = payload.page;
    view.totalPages = payload.total_pages;
    if (view.totalPages && view.page > view.totalPages) {
      await app.loadSelectedAccountPartners(view.totalPages);
      return;
    }
    view.items = payload.items ?? [];
    view.loaded = true;
    shell.hidden = false;
    byId('partner-state').hidden = view.items.length > 0;
    byId('partner-state').textContent = text('partnerEmpty');
    byId('partner-summary').textContent = text('partnerSummary', { total: payload.total });
    renderRows();
  } catch (error) {
    if (generation !== view.generation || uid !== state.selectedAccountUid) return;
    byId('partner-state').textContent = app.apiErrorMessage(error, 'dashboard.partnerLoadFailed');
    body.innerHTML = '';
  } finally {
    if (generation === view.generation) {
      view.loading = false;
      updatePagination();
    }
  }
};

const hideTooltip = () => {
  window.clearTimeout(view.tooltipTimer);
  tooltip.hidden = true;
  tooltip.textContent = '';
};
const showTooltip = (target) => {
  hideTooltip();
  view.tooltipTimer = window.setTimeout(() => {
    if (!target.isConnected || addModal.hidden) return;
    tooltip.textContent = target.dataset.partnerDescription;
    tooltip.hidden = false;
    const rect = target.getBoundingClientRect();
    const tip = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - tip.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, rect.bottom + tip.height + 8 < window.innerHeight ? rect.bottom + 8 : rect.top - tip.height - 8)}px`;
  }, 180);
};

const renderAddRows = () => {
  hideTooltip();
  const keyword = byId('partner-add-search').value.trim().toLowerCase();
  const rows = Object.entries(state.partnerEntriesMap ?? {}).map(([id, value]) => ({ id: Number(id), ...value }))
    .filter((row) => [row.Name, row.Desc].some((value) => String(value).toLowerCase().includes(keyword)))
    .sort((left, right) => {
      const primary = view.addSort === 'quality' ? left.InitQuality - right.InitQuality
        : String(view.addSort === 'description' ? left.Desc : left.Name).localeCompare(String(view.addSort === 'description' ? right.Desc : right.Name), state.locale);
      return (primary || left.Name.localeCompare(right.Name, state.locale) || left.id - right.id) * (view.addOrder === 'asc' ? 1 : -1);
    });
  byId('partner-add-body').innerHTML = rows.map((row) => {
    const description = app.stripMarkupText(row.Desc);
    return `<tr data-partner-add-row="${row.id}" class="${view.selected.has(row.id) ? 'is-selected' : ''}">
      <td>${media(row.id, row.InitQuality)}</td>
      <td><span class="partner-add-description" data-partner-description="${app.escapeHtml(description)}" tabindex="0">${app.escapeHtml(description)}</span></td>
      <td>${qualityMarkup(row.InitQuality)}</td>
      <td><input type="checkbox" class="weapon-add-checkbox" data-partner-select="${row.id}" aria-label="${app.escapeHtml(row.Name)}" ${view.selected.has(row.id) ? 'checked' : ''}></td>
    </tr>`;
  }).join('');
  byId('partner-add-empty').hidden = rows.length > 0;
  syncArrows(addModal, view.addSort, view.addOrder);
};

app.closePartnerAddModal = () => {
  if (view.submitting) return;
  hideTooltip();
  if (addModal.hidden) return;
  addModal.hidden = true;
  view.selected.clear();
  app.setBodyModalOpen(false);
  view.lastAddTrigger?.focus();
};
app.closePartnerDeleteModal = () => {
  if (view.submitting || deleteModal.hidden) return;
  deleteModal.hidden = true;
  view.pendingDelete = null;
  app.setBodyModalOpen(false);
  view.lastDeleteTrigger?.focus();
};

const openDelete = (recordId, trigger) => {
  view.mutationUid = state.selectedAccountUid;
  view.lastDeleteTrigger = trigger;
  view.pendingDelete = { recordId, keyword: view.keyword };
  byId('partner-delete-title').textContent = text(recordId === null ? 'partnerClear' : 'partnerDeleteTitle');
  deleteModal.querySelector('.shared-modal-actions').classList.toggle('shared-modal-actions-split', recordId === null);
  const item = view.items.find((row) => row.record_id === recordId);
  byId('partner-delete-message').textContent = recordId === null
    ? text(view.keyword ? 'partnerClearConfirm' : 'partnerClearAllConfirm', { keyword: view.keyword })
    : text('partnerDeleteConfirm', { name: entry(item?.TemplateId).Name ?? '--' });
  deleteModal.hidden = false;
  app.setBodyModalOpen(true);
  byId('partner-delete-submit').focus();
};

const mutate = async (kind) => {
  if (view.submitting || !app.canAccessPartnerManagement() || view.mutationUid !== state.selectedAccountUid) return;
  const uid = view.mutationUid;
  const pending = view.pendingDelete;
  const ids = [...view.selected];
  if (kind === 'add' && !ids.length) { app.openNoticeModal(text('partnerNoSelection')); return; }
  if (kind !== 'add' && !pending) return;
  view.submitting = true;
  byId('partner-add-submit').disabled = true;
  byId('partner-delete-submit').disabled = true;
  try {
    const isClear = kind === 'delete' && pending.recordId === null;
    const path = kind === 'add' || isClear ? '' : `/${pending.recordId}`;
    const options = { method: kind === 'add' ? 'POST' : 'DELETE' };
    if (kind === 'add' || isClear) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(kind === 'add' ? { template_ids: ids } : { keyword: pending.keyword });
    }
    const payload = await app.apiFetch(`/api/database-partners/selected${path}`, options);
    view.submitting = false;
    app.closePartnerAddModal();
    app.closePartnerDeleteModal();
    if (uid !== state.selectedAccountUid) return;
    app.openSuccessModal(text(kind === 'add' ? 'partnerAdded' : isClear ? 'partnerCleared' : 'partnerDeleted', { count: kind === 'add' ? payload.added_count : payload.deleted_count }));
    await app.loadSelectedAccountPartners();
  } catch (error) {
    if (!app.isMutationRiskCancelled(error)) app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.partnerFailed'));
  } finally {
    view.submitting = false;
    byId('partner-add-submit').disabled = false;
    byId('partner-delete-submit').disabled = false;
  }
};

export const initDatabasePartnerManagementFeature = () => {
  document.body.appendChild(tooltip);
  app.updatePartnerManagementAccess();
  panel.addEventListener('click', (event) => {
    const sort = event.target.closest('.column-sort-btn');
    if (sort) {
      view.order = view.sort === sort.dataset.sortField && view.order === 'asc' ? 'desc' : 'asc';
      view.sort = sort.dataset.sortField;
      syncArrows(panel, view.sort, view.order);
      void app.loadSelectedAccountPartners(1);
    }
    const remove = event.target.closest('[data-partner-delete]');
    const detail = event.target.closest('[data-partner-detail]');
    if (detail) void app.openPartnerDetailModal(Number(detail.dataset.partnerDetail), detail);
    if (remove && !remove.disabled) openDelete(Number(remove.dataset.partnerDelete), remove);
  });
  byId('partner-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { view.keyword = event.target.value.trim(); void app.loadSelectedAccountPartners(1); }
  });
  byId('partner-search').addEventListener('input', (event) => {
    if (!event.target.value) { view.keyword = ''; void app.loadSelectedAccountPartners(1); }
  });
  byId('partner-prev').addEventListener('click', () => void app.loadSelectedAccountPartners(view.page - 1));
  byId('partner-next').addEventListener('click', () => void app.loadSelectedAccountPartners(view.page + 1));
  const jump = () => {
    const page = app.normalizePaginationTargetPage(byId('partner-jump').value, view.totalPages);
    if (page !== null) void app.loadSelectedAccountPartners(page);
    byId('partner-jump').value = '';
  };
  byId('partner-jump-button').addEventListener('click', jump);
  byId('partner-jump').addEventListener('keydown', (event) => { if (event.key === 'Enter') jump(); });
  byId('partner-clear').addEventListener('click', (event) => openDelete(null, event.currentTarget));
  byId('partner-add').addEventListener('click', (event) => {
    view.mutationUid = state.selectedAccountUid;
    view.lastAddTrigger = event.currentTarget;
    view.selected.clear();
    view.addSort = 'quality'; view.addOrder = 'desc';
    byId('partner-add-search').value = '';
    renderAddRows(); addModal.hidden = false; app.setBodyModalOpen(true); byId('partner-add-search').focus();
  });
  byId('partner-add-search').addEventListener('input', renderAddRows);
  addModal.addEventListener('click', (event) => {
    const sort = event.target.closest('.column-sort-btn');
    if (sort) {
      view.addOrder = view.addSort === sort.dataset.sortField && view.addOrder === 'asc' ? 'desc' : 'asc';
      view.addSort = sort.dataset.sortField; renderAddRows(); return;
    }
    if (event.target.closest('[data-partner-description]') || event.target.matches('[data-partner-select]')) return;
    const row = event.target.closest('[data-partner-add-row]');
    if (row) { const id = Number(row.dataset.partnerAddRow); view.selected.has(id) ? view.selected.delete(id) : view.selected.add(id); renderAddRows(); }
  });
  addModal.addEventListener('change', (event) => {
    if (!event.target.matches('[data-partner-select]')) return;
    const id = Number(event.target.dataset.partnerSelect);
    event.target.checked ? view.selected.add(id) : view.selected.delete(id);
    event.target.closest('tr').classList.toggle('is-selected', event.target.checked);
  });
  for (const type of ['mouseover', 'focusin']) addModal.addEventListener(type, (event) => {
    const target = event.target.closest('[data-partner-description]');
    if (target) showTooltip(target);
  });
  for (const type of ['mouseout', 'focusout']) addModal.addEventListener(type, hideTooltip);
  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', hideTooltip);
  document.querySelectorAll('[data-partner-add-close]').forEach((target) => target.addEventListener('click', app.closePartnerAddModal));
  document.querySelectorAll('[data-partner-delete-close]').forEach((target) => target.addEventListener('click', app.closePartnerDeleteModal));
  byId('partner-add-submit').addEventListener('click', () => void mutate('add'));
  byId('partner-delete-submit').addEventListener('click', () => void mutate('delete'));
};
