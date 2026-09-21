import { app } from '../../shared.js';

const { dom, state } = app;
const {
  scoreTitlePickerOpenButton,
  scoreTitlePickerModal,
  scoreTitlePickerTitle,
  scoreTitlePickerEyebrow,
  scoreTitlePickerGrid,
  scoreTitlePickerUnlockAllButton,
  scoreTitlePickerConfirmButton,
  scoreTitlePickerCloseTargets,
} = dom;

const getEntries = () => Object.entries(state.scoreTitlePickerState?.entries ?? {})
  .map(([id, entry]) => ({ ...entry, Id: Number(id) }))
  .filter((entry) => Number.isFinite(entry.Id))
  .sort((left, right) => left.Id - right.Id);

app.closeScoreTitlePicker = () => {
  if (!(scoreTitlePickerModal instanceof HTMLElement) || scoreTitlePickerModal.hidden) {
    state.scoreTitlePickerState = null;
    return;
  }
  scoreTitlePickerModal.hidden = true;
  app.setBodyModalOpen(false);
  state.scoreTitlePickerState = null;
  state.lastScoreTitlePickerTrigger?.focus?.({ preventScroll: true });
};

app.renderScoreTitlePicker = () => {
  if (!(scoreTitlePickerGrid instanceof HTMLElement) || !state.scoreTitlePickerState) return;
  const entries = getEntries();
  const selectedIds = state.scoreTitlePickerState.selectedIds;
  if (scoreTitlePickerTitle instanceof HTMLElement) scoreTitlePickerTitle.textContent = app.translate('runtime.scoreTitlePickerTitle');
  if (scoreTitlePickerEyebrow instanceof HTMLElement) scoreTitlePickerEyebrow.textContent = app.translate('runtime.scoreTitlePickerEyebrow');
  if (scoreTitlePickerUnlockAllButton instanceof HTMLButtonElement) {
    scoreTitlePickerUnlockAllButton.textContent = app.translate('runtime.scoreTitlePickerUnlockAll');
    scoreTitlePickerUnlockAllButton.disabled = state.scoreTitlePickerState.pending || entries.length === 0;
  }
  if (scoreTitlePickerConfirmButton instanceof HTMLButtonElement) {
    scoreTitlePickerConfirmButton.textContent = app.translate('runtime.scoreTitlePickerConfirm');
    scoreTitlePickerConfirmButton.disabled = state.scoreTitlePickerState.pending || selectedIds.size === 0;
  }
  scoreTitlePickerGrid.innerHTML = entries.map((entry) => {
    const isSelected = selectedIds.has(entry.Id);
    const quality = Number(entry.MaxQuality) || 0;
    const tooltip = JSON.stringify({ type: 'scoreTitle', name: entry.Name, quality, description: entry.WorldDesc });
    const image = entry.MedalImg ? `<img src=".${app.escapeHtml(String(entry.MedalImg))}" alt="">` : '<span class="score-title-picker-empty-preview">--</span>';
    return `<button type="button" class="score-title-picker-item${isSelected ? ' is-selected' : ''}" data-score-title-id="${entry.Id}" data-character-detail-equip-slot data-equip-tooltip-text="${app.escapeHtml(tooltip)}" aria-pressed="${isSelected ? 'true' : 'false'}"><span class="score-title-picker-preview ${app.getNameplateQualityEffectClass(quality)}">${image}</span><strong>${app.escapeHtml(String(entry.Name || entry.Id))}</strong></button>`;
  }).join('');
};

app.openScoreTitlePicker = async () => {
  if (!(scoreTitlePickerModal instanceof HTMLElement) || state.scoreTitlePickerState?.pending) return;
  state.lastScoreTitlePickerTrigger = document.activeElement;
  state.scoreTitlePickerState = { entries: {}, selectedIds: new Set(), pending: true };
  scoreTitlePickerModal.hidden = false;
  app.setBodyModalOpen(true);
  app.renderScoreTitlePicker();
  try {
    const entries = await app.apiFetch('/api/database-players/selected/score-titles/locked');
    if (!state.scoreTitlePickerState) return;
    state.scoreTitlePickerState.entries = entries && typeof entries === 'object' ? entries : {};
    state.scoreTitlePickerState.pending = false;
    if (getEntries().length === 0) {
      app.closeScoreTitlePicker();
      app.openNoticeModal(app.translate('runtime.scoreTitlePickerAllOwned'));
      return;
    }
    app.renderScoreTitlePicker();
    scoreTitlePickerGrid?.querySelector('button')?.focus();
  } catch (error) {
    app.closeScoreTitlePicker();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.scoreTitlePickerLoadFailed'));
  }
};

const submit = async (unlockAll = false) => {
  if (!state.scoreTitlePickerState || state.scoreTitlePickerState.pending) return;
  const titleIds = unlockAll ? getEntries().map((entry) => entry.Id) : Array.from(state.scoreTitlePickerState.selectedIds);
  if (titleIds.length === 0) return;
  state.scoreTitlePickerState.pending = true;
  app.renderScoreTitlePicker();
  try {
    await app.apiFetch('/api/database-players/selected/score-titles/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title_ids: titleIds }),
    });
    app.closeScoreTitlePicker();
  } catch (error) {
    state.scoreTitlePickerState.pending = false;
    app.renderScoreTitlePicker();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.scoreTitlePickerUnlockFailed'));
  }
};

export const initDatabaseScoreTitlePickerFeature = () => {
  scoreTitlePickerOpenButton?.addEventListener('click', () => { void app.openScoreTitlePicker(); });
  scoreTitlePickerCloseTargets.forEach((target) => target.addEventListener('click', app.closeScoreTitlePicker));
  ['mouseover', 'mousemove', 'mouseout', 'focusin', 'focusout'].forEach((eventName) => {
    scoreTitlePickerModal?.addEventListener(eventName, app.handleCharacterDetailEquipTooltipEvent);
  });
  scoreTitlePickerGrid?.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-score-title-id]') : null;
    if (!(button instanceof HTMLButtonElement) || !state.scoreTitlePickerState || state.scoreTitlePickerState.pending) return;
    const id = Number(button.dataset.scoreTitleId);
    if (!Number.isFinite(id)) return;
    const { selectedIds } = state.scoreTitlePickerState;
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    app.renderScoreTitlePicker();
  });
  scoreTitlePickerConfirmButton?.addEventListener('click', () => { void submit(); });
  scoreTitlePickerUnlockAllButton?.addEventListener('click', () => { void submit(true); });
};
