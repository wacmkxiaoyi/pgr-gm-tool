import { app } from '../../shared.js';

const { state } = app;
const byId = (id) => document.getElementById(id);
const panel = byId('database-furniture-management-section');
const modal = byId('furniture-delete-modal');
const text = (key, params = {}) => app.translate(`dashboard.furniture${key}`, params);
const view = state.furnitureManagement;
const sortFields = [
  'record_id',
  'name',
  'type',
  'description',
  'suit',
  'beauty',
  'comfort',
  'utility',
];
const entry = (item) => state.furnitureEntriesMap?.[item?.config_id] ?? {};
const isDeleteProtected = (item) =>
  state.furnitureTypeEntiresMap?.[entry(item).TypeId]?.MajorType === 1 && item?.dormitory_id !== -1;
const escape = (value) => app.escapeHtml(String(value ?? '--'));

app.canAccessFurnitureManagement = (payload = state.databaseHealthSnapshot) =>
  app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null;
app.isDatabaseFurnitureManagementSectionActive = () => panel.classList.contains('is-active');

const syncControls = () => {
  const blocked = !app.canAccessFurnitureManagement() || view.loading || view.submitting;
  byId('furniture-prev').disabled = blocked || view.page <= 1 || !view.totalPages;
  byId('furniture-next').disabled = blocked || view.page >= view.totalPages;
  byId('furniture-jump').disabled = blocked || !view.totalPages;
  byId('furniture-jump-submit').disabled = blocked || !view.totalPages;
  byId('furniture-clear').disabled = blocked;
  byId('furniture-add').disabled = blocked;
  byId('furniture-search').disabled = blocked;
  byId('furniture-pagination').textContent = app.translate('dashboard.accountsPagination', {
    page: view.totalPages ? view.page : 0,
    totalPages: view.totalPages,
  });
  panel.querySelectorAll('[data-furniture-delete]').forEach((button) => {
    const item = view.items.find((row) => row.record_id === Number(button.dataset.furnitureDelete));
    const protectedItem = isDeleteProtected(item);
    button.disabled = blocked || protectedItem;
    button.title = protectedItem ? text('DeleteProtected') : '';
  });
  panel.querySelectorAll('.column-sort-btn').forEach((button) => {
    const arrow = button.querySelector('.column-sort-arrow');
    arrow.hidden = button.dataset.sortField !== view.sort;
    arrow.classList.toggle('desc', view.order === 'desc');
    button.disabled = blocked;
  });
};

app.syncFurnitureManagementControls = syncControls;

const setMessage = (message, tone = 'is-muted') => {
  const element = byId('furniture-state');
  element.textContent = message;
  element.className = `database-player-empty ${tone}`;
  element.hidden = false;
};

const renderRows = () => {
  app.hideStageDescriptionTooltip();
  const tooltipCell = (value) => /* HTML */ `
    <span
      class="stage-management-description"
      data-stage-tooltip-text="${escape(value)}"
      tabindex="0"
    >
      ${escape(value)}
    </span>
  `;
  byId('furniture-body').innerHTML = view.items
    .map((item) => {
      const resource = entry(item);
      const addition =
        item.addition === 0
          ? text('None')
          : state.furnitureAdditionalAttrEntriesMap?.[item.addition]?.Introduce || '--';
      return /* HTML */ `
        <tr>
          <td>${escape(item.record_id)}</td>
          <td>${escape(resource.Name || '--')}</td>
          <td>${escape(state.furnitureTypeEntiresMap?.[resource.TypeId]?.CategoryName || '--')}</td>
          <td>${tooltipCell(resource.Desc || '--')}</td>
          <td>${escape(state.furnitureSuitNameMap?.[resource.SuitId] || '--')}</td>
          <td>${escape(item.beauty)}</td>
          <td>${escape(item.comfort)}</td>
          <td>${escape(item.utility)}</td>
          <td>${tooltipCell(addition)}</td>
          <td>
            <div class="accounts-row-actions">
              <button
                class="status-action-button status-action-button-stop"
                type="button"
                data-furniture-delete="${item.record_id}"
              >
                ${app.translate('dashboard.itemManagementDelete')}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
};

app.closeFurnitureDeleteModal = () => {
  if (view.submitting || modal.hidden) return;
  modal.hidden = true;
  view.pending = null;
  app.setBodyModalOpen(false);
  view.trigger?.focus();
};

app.resetFurnitureManagementView = () => {
  view.requestId += 1;
  view.loading = false;
  view.loaded = false;
  view.page = 1;
  view.totalPages = 0;
  view.items = [];
  app.hideStageDescriptionTooltip?.();
  app.closeFurnitureDeleteModal();
  app.closeFurnitureAddModal?.(true);
  byId('furniture-body').innerHTML = '';
  byId('furniture-shell').hidden = true;
  syncControls();
};

app.clearFurnitureManagementKeyword = () => {
  view.keyword = '';
  byId('furniture-search').value = '';
};

app.updateFurnitureManagementAccess = (payload = state.databaseHealthSnapshot) => {
  const accessible = app.canAccessFurnitureManagement(payload);
  const healthy = app.isDatabaseHealthy(payload);
  const button = byId('database-furniture-management-subnav');
  button.disabled = !accessible;
  button.title = accessible ? '' : text(healthy ? 'ChooseAccount' : 'Unavailable');
  if (!accessible) {
    app.resetFurnitureManagementView();
    const message = text(healthy ? 'ChooseAccount' : 'Unavailable');
    byId('furniture-summary').textContent = message;
    setMessage(message);
    if (app.isDatabaseFurnitureManagementSectionActive())
      app.setActiveDatabaseTab(
        healthy ? 'database-accounts-section' : 'database-service-status-section',
      );
  } else if (!view.loaded && !view.loading) {
    byId('furniture-summary').textContent = '';
    setMessage(text('Ready'));
  }
  syncControls();
};

app.loadSelectedAccountFurnitures = async (page = view.page) => {
  if (!app.canAccessFurnitureManagement() || view.loading || view.submitting) return;
  const uid = state.selectedAccountUid;
  const requestId = ++view.requestId;
  view.loading = true;
  syncControls();
  app.hideStageDescriptionTooltip();
  setMessage(text('Loading'), 'is-loading');
  try {
    const params = new URLSearchParams({
      page: String(page),
      page_size: '10',
      sort_by: view.sort,
      sort_order: view.order,
    });
    if (view.keyword) params.set('keyword', view.keyword);
    const payload = await app.apiFetch(`/api/database-furnitures/selected?${params}`);
    if (uid !== state.selectedAccountUid || requestId !== view.requestId) return;
    view.items = Array.isArray(payload.items) ? payload.items : [];
    view.page = payload.page;
    view.totalPages = payload.total_pages;
    view.loaded = true;
    byId('furniture-summary').textContent = text('Summary', { total: payload.total });
    byId('furniture-shell').hidden = false;
    renderRows();
    // Keep search and actions available when the list is empty.
    byId('furniture-state').hidden = view.items.length > 0;
    if (!view.items.length) setMessage(text('Empty'), 'is-empty');
  } catch (error) {
    if (uid !== state.selectedAccountUid || requestId !== view.requestId) return;
    view.loaded = false;
    view.items = [];
    view.totalPages = 0;
    byId('furniture-body').innerHTML = '';
    byId('furniture-summary').textContent = '';
    byId('furniture-shell').hidden = true;
    setMessage(app.apiErrorMessage(error, 'dashboard.furnitureLoadFailed'), 'is-error');
  } finally {
    if (requestId === view.requestId) {
      view.loading = false;
      syncControls();
    }
  }
};

const openDelete = (recordId, trigger) => {
  if (!app.canAccessFurnitureManagement() || view.loading || view.submitting) return;
  const item = view.items.find((row) => row.record_id === recordId);
  if (recordId !== null && (!item || isDeleteProtected(item))) return;
  view.pending = { recordId, uid: state.selectedAccountUid };
  view.trigger = trigger;
  app.hideStageDescriptionTooltip();
  byId('furniture-delete-title').textContent = text(
    recordId === null ? 'ClearTitle' : 'DeleteTitle',
  );
  byId('furniture-delete-message').textContent =
    recordId === null
      ? text('ClearConfirm')
      : text('DeleteConfirm', { name: entry(item).Name || '--', id: recordId });
  modal.hidden = false;
  app.setBodyModalOpen(true);
  byId('furniture-delete-submit').focus();
};

const confirmDelete = async () => {
  const pending = view.pending;
  if (
    !pending ||
    view.submitting ||
    !app.canAccessFurnitureManagement() ||
    pending.uid !== state.selectedAccountUid
  )
    return;
  if (pending.recordId !== null) {
    const item = view.items.find((row) => row.record_id === pending.recordId);
    if (!item || isDeleteProtected(item)) {
      app.closeFurnitureDeleteModal();
      if (item) app.openNoticeModal(text('DeleteProtected'));
      return;
    }
  }
  view.submitting = true;
  byId('furniture-delete-submit').disabled = true;
  modal.querySelectorAll('[data-furniture-modal-close]').forEach((button) => {
    if (button instanceof HTMLButtonElement) button.disabled = true;
  });
  syncControls();
  try {
    const result = await app.apiFetch(
      `/api/database-furnitures/selected/${pending.recordId === null ? 'unused' : pending.recordId}`,
      { method: 'DELETE' },
    );
    view.submitting = false;
    app.closeFurnitureDeleteModal();
    if (pending.uid !== state.selectedAccountUid) return;
    app.openSuccessModal(
      text(pending.recordId === null ? 'Cleared' : 'Deleted', { count: result.deleted_count }),
    );
    await app.loadSelectedAccountFurnitures();
  } catch (error) {
    view.submitting = false;
    app.closeFurnitureDeleteModal();
    if (!app.isMutationRiskCancelled(error))
      app.openNoticeModal(app.apiErrorMessage(error, 'dashboard.furnitureMutationFailed'));
  } finally {
    view.submitting = false;
    byId('furniture-delete-submit').disabled = false;
    modal.querySelectorAll('[data-furniture-modal-close]').forEach((button) => {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    });
    syncControls();
  }
};

export const initDatabaseFurnitureManagementFeature = () => {
  app.updateFurnitureManagementAccess();
  panel.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    const sort = event.target.closest('.column-sort-btn');
    if (
      sort instanceof HTMLButtonElement &&
      !sort.disabled &&
      sortFields.includes(sort.dataset.sortField)
    ) {
      view.order = view.sort === sort.dataset.sortField && view.order === 'asc' ? 'desc' : 'asc';
      view.sort = sort.dataset.sortField;
      void app.loadSelectedAccountFurnitures(1);
    }
    const remove = event.target.closest('[data-furniture-delete]');
    if (remove instanceof HTMLButtonElement && !remove.disabled)
      openDelete(Number(remove.dataset.furnitureDelete), remove);
  });
  byId('furniture-clear').addEventListener('click', (event) =>
    openDelete(null, event.currentTarget),
  );
  byId('furniture-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      view.keyword = event.target.value.trim();
      void app.loadSelectedAccountFurnitures(1);
    }
  });
  byId('furniture-search').addEventListener('input', (event) => {
    if (!event.target.value) {
      view.keyword = '';
      void app.loadSelectedAccountFurnitures(1);
    }
  });
  byId('furniture-prev').addEventListener(
    'click',
    () => void app.loadSelectedAccountFurnitures(view.page - 1),
  );
  byId('furniture-next').addEventListener(
    'click',
    () => void app.loadSelectedAccountFurnitures(view.page + 1),
  );
  const jump = () => {
    const page = app.normalizePaginationTargetPage(byId('furniture-jump').value, view.totalPages);
    byId('furniture-jump').value = '';
    if (page !== null && page !== view.page) void app.loadSelectedAccountFurnitures(page);
  };
  byId('furniture-jump-submit').addEventListener('click', jump);
  byId('furniture-jump').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      jump();
    }
  });
  modal
    .querySelectorAll('[data-furniture-modal-close]')
    .forEach((target) => target.addEventListener('click', app.closeFurnitureDeleteModal));
  byId('furniture-delete-submit').addEventListener('click', () => void confirmDelete());
  // Reuse the existing description tooltip behavior, only for truncated text.
  ['mouseover', 'focusin', 'mousemove', 'mouseout', 'focusout'].forEach((type) => {
    panel.addEventListener(type, (event) => {
      const target =
        event.target instanceof HTMLElement
          ? event.target.closest('[data-stage-tooltip-text]')
          : null;
      if (
        target &&
        (type === 'mouseout' || type === 'focusout' || target.scrollWidth > target.clientWidth)
      )
        app.handleStageDescriptionTooltipEvent(event);
    });
  });
};
