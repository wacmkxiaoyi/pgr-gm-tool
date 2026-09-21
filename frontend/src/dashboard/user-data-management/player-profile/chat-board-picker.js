import { app } from '../../shared.js';

const { dom, state } = app;
const {
  chatBoardPickerOpenButton,
  chatBoardPickerModal,
  chatBoardPickerTitle,
  chatBoardPickerEyebrow,
  chatBoardPickerCurrent,
  chatBoardPickerGrid,
  chatBoardPickerConfirmButton,
  chatBoardPickerCloseTargets,
} = dom;

const getEntries = () => Object.entries(state.chatBoardEntiresMap ?? {})
  .map(([id, entry]) => ({ ...entry, Id: Number(id) }))
  .filter((entry) => Number.isFinite(entry.Id))
  .sort((left, right) => left.Id - right.Id);

app.closeChatBoardPicker = () => {
  if (!(chatBoardPickerModal instanceof HTMLElement) || chatBoardPickerModal.hidden) {
    state.chatBoardPickerState = null;
    return;
  }
  chatBoardPickerModal.hidden = true;
  app.setBodyModalOpen(false);
  state.chatBoardPickerState = null;
  state.lastChatBoardPickerTrigger?.focus?.({ preventScroll: true });
};

app.renderChatBoardPicker = () => {
  if (!(chatBoardPickerGrid instanceof HTMLElement) || !state.chatBoardPickerState) return;
  const currentId = Number(state.playerProfileData?.current_chat_board_id);
  const currentEntry = getEntries().find((entry) => entry.Id === currentId);
  const unlocked = new Set((state.playerProfileData?.unlock_chat_boards ?? []).map(Number));
  if (chatBoardPickerTitle instanceof HTMLElement) chatBoardPickerTitle.textContent = app.translate('runtime.chatBoardPickerTitle');
  if (chatBoardPickerEyebrow instanceof HTMLElement) chatBoardPickerEyebrow.textContent = app.translate('runtime.chatBoardPickerEyebrow');
  if (chatBoardPickerCurrent instanceof HTMLElement) {
    chatBoardPickerCurrent.innerHTML = `<span>${app.escapeHtml(app.translate('runtime.chatBoardPickerCurrent'))}</span><strong>${app.escapeHtml(String(currentEntry?.Name || '--'))}</strong>`;
  }
  if (chatBoardPickerConfirmButton instanceof HTMLButtonElement) {
    chatBoardPickerConfirmButton.disabled = Boolean(state.chatBoardPickerState.pending);
  }
  chatBoardPickerGrid.innerHTML = getEntries().map((entry) => {
    const isSelected = state.chatBoardPickerState.selectedId === entry.Id;
    const isLocked = !unlocked.has(entry.Id);
    const tooltip = JSON.stringify({ type: 'chatBoard', name: entry.Name, description: entry.WorldDesc });
    const image = entry.Icon ? `<img src=".${app.escapeHtml(String(entry.Icon))}" alt="">` : '<span class="chat-board-picker-empty-preview">--</span>';
    return `<button type="button" class="chat-board-picker-item${isSelected ? ' is-selected' : ''}" data-chat-board-id="${entry.Id}" data-character-detail-equip-slot data-equip-tooltip-text="${app.escapeHtml(tooltip)}" aria-pressed="${isSelected ? 'true' : 'false'}"><span class="chat-board-picker-preview">${image}${isLocked ? '<span class="character-detail-fashion-slot-lock" aria-hidden="true">🔒</span>' : ''}</span><strong>${app.escapeHtml(String(entry.Name || entry.Id))}</strong></button>`;
  }).join('');
};

app.openChatBoardPicker = () => {
  if (!(chatBoardPickerModal instanceof HTMLElement)) return;
  const currentId = Number(state.playerProfileData?.current_chat_board_id);
  if (!Number.isFinite(currentId)) return;
  state.lastChatBoardPickerTrigger = document.activeElement;
  state.chatBoardPickerState = { selectedId: currentId, pending: false };
  chatBoardPickerModal.hidden = false;
  app.setBodyModalOpen(true);
  app.renderChatBoardPicker();
  chatBoardPickerGrid?.querySelector('.is-selected, button')?.focus();
};

const submit = async () => {
  if (!state.chatBoardPickerState || !(chatBoardPickerConfirmButton instanceof HTMLButtonElement)) return;
  if (state.chatBoardPickerState.pending) return;
  state.chatBoardPickerState.pending = true;
  chatBoardPickerConfirmButton.disabled = true;
  try {
    const payload = await app.apiFetch('/api/database-players/selected', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'current_chat_board_id', value: state.chatBoardPickerState.selectedId }),
    });
    app.closeChatBoardPicker();
    app.renderPlayerProfile(payload);
  } catch (error) {
    state.chatBoardPickerState.pending = false;
    chatBoardPickerConfirmButton.disabled = false;
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.playerProfileUpdateFailed'));
  }
};

export const initDatabaseChatBoardPickerFeature = () => {
  chatBoardPickerOpenButton?.addEventListener('click', app.openChatBoardPicker);
  chatBoardPickerCloseTargets.forEach((target) => target.addEventListener('click', app.closeChatBoardPicker));
  ['mouseover', 'mousemove', 'mouseout', 'focusin', 'focusout'].forEach((eventName) => {
    chatBoardPickerModal?.addEventListener(eventName, app.handleCharacterDetailEquipTooltipEvent);
  });
  chatBoardPickerGrid?.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-chat-board-id]') : null;
    if (!(button instanceof HTMLButtonElement) || !state.chatBoardPickerState) return;
    const id = Number(button.dataset.chatBoardId);
    if (!Number.isFinite(id)) return;
    state.chatBoardPickerState.selectedId = id;
    app.renderChatBoardPicker();
  });
  chatBoardPickerConfirmButton?.addEventListener('click', () => { void submit(); });
};
