import { app } from '../../shared.js';

const { dom, state } = app;
const {
  medalPickerOpenButton,
  medalPickerModal,
  medalPickerTitle,
  medalPickerEyebrow,
  medalPickerCurrent,
  medalPickerGrid,
  medalPickerConfirmButton,
  medalPickerCloseTargets,
} = dom;

const getEntries = () => Object.entries(state.medalEntiresMap ?? {})
  .map(([id, entry]) => ({ ...entry, Id: Number(id) }))
  .filter((entry) => Number.isFinite(entry.Id))
  .sort((left, right) => left.Id - right.Id);

app.closeMedalPicker = () => {
  if (!(medalPickerModal instanceof HTMLElement) || medalPickerModal.hidden) {
    state.medalPickerState = null;
    return;
  }
  medalPickerModal.hidden = true;
  app.setBodyModalOpen(false);
  state.medalPickerState = null;
  state.lastMedalPickerTrigger?.focus?.({ preventScroll: true });
};

app.renderMedalPicker = () => {
  if (!(medalPickerGrid instanceof HTMLElement) || !state.medalPickerState) return;
  const currentId = Number.isFinite(Number(state.playerProfileData?.current_medal_id))
    ? Number(state.playerProfileData.current_medal_id) : null;
  const currentEntry = getEntries().find((entry) => Number(entry.Id) === currentId);
  const unlocked = new Set((state.playerProfileData?.unlock_medals ?? []).map(Number));
  if (medalPickerTitle instanceof HTMLElement) medalPickerTitle.textContent = app.translate('runtime.medalPickerTitle');
  if (medalPickerEyebrow instanceof HTMLElement) medalPickerEyebrow.textContent = app.translate('runtime.medalPickerEyebrow');
  if (medalPickerCurrent instanceof HTMLElement) {
    medalPickerCurrent.innerHTML = `<span>${app.escapeHtml(app.translate('runtime.medalPickerCurrent'))}</span><strong>${app.escapeHtml(String(currentEntry?.Name || '--'))}</strong>`;
  }
  if (medalPickerConfirmButton instanceof HTMLButtonElement) {
    medalPickerConfirmButton.disabled = Boolean(state.medalPickerState.pending);
  }
  medalPickerGrid.innerHTML = getEntries().map((entry) => {
    const id = Number(entry.Id);
    const isSelected = state.medalPickerState.selectedId === id;
    const isLocked = !unlocked.has(id);
    const tooltip = JSON.stringify({ type: 'medal', name: entry.Name, description: entry.Desc });
    const image = entry.MedalImg ? `<img src=".${app.escapeHtml(String(entry.MedalImg))}" alt="">` : '<span class="medal-picker-empty-preview">--</span>';
    return `<button type="button" class="medal-picker-item${isSelected ? ' is-selected' : ''}" data-medal-id="${id}" data-character-detail-equip-slot data-equip-tooltip-text="${app.escapeHtml(tooltip)}" aria-pressed="${isSelected ? 'true' : 'false'}"><span class="medal-picker-preview">${image}${isLocked ? '<span class="character-detail-fashion-slot-lock" aria-hidden="true">🔒</span>' : ''}</span><strong>${app.escapeHtml(String(entry.Name || id))}</strong></button>`;
  }).join('');
};

app.openMedalPicker = () => {
  if (!(medalPickerModal instanceof HTMLElement)) return;
  const currentId = Number.isFinite(Number(state.playerProfileData?.current_medal_id)) ? Number(state.playerProfileData.current_medal_id) : null;
  state.lastMedalPickerTrigger = document.activeElement;
  state.medalPickerState = { selectedId: currentId, pending: false };
  medalPickerModal.hidden = false;
  app.setBodyModalOpen(true);
  app.renderMedalPicker();
  medalPickerGrid?.querySelector('.is-selected, button')?.focus();
};

const submit = async () => {
  if (!state.medalPickerState || !(medalPickerConfirmButton instanceof HTMLButtonElement)) return;
  if (state.medalPickerState.pending) return;
  state.medalPickerState.pending = true;
  medalPickerConfirmButton.disabled = true;
  try {
    const payload = await app.apiFetch('/api/database-players/selected', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'current_medal_id', value: state.medalPickerState.selectedId ?? 0 }),
    });
    app.closeMedalPicker();
    app.renderPlayerProfile(payload);
  } catch (error) {
    state.medalPickerState.pending = false;
    medalPickerConfirmButton.disabled = false;
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.playerProfileUpdateFailed'));
  }
};

export const initDatabaseMedalPickerFeature = () => {
  medalPickerOpenButton?.addEventListener('click', app.openMedalPicker);
  medalPickerCloseTargets.forEach((target) => target.addEventListener('click', app.closeMedalPicker));
  ['mouseover', 'mousemove', 'mouseout', 'focusin', 'focusout'].forEach((eventName) => {
    medalPickerModal?.addEventListener(eventName, app.handleCharacterDetailEquipTooltipEvent);
  });
  medalPickerGrid?.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-medal-id]') : null;
    if (!(button instanceof HTMLButtonElement) || !state.medalPickerState) return;
    const id = Number(button.dataset.medalId);
    const currentId = Number(state.playerProfileData?.current_medal_id);
    state.medalPickerState.selectedId = id === currentId ? null : id;
    app.renderMedalPicker();
  });
  medalPickerConfirmButton?.addEventListener('click', () => { void submit(); });
};
