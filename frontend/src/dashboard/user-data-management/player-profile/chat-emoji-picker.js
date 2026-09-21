import { app } from '../../shared.js';

const { dom, state } = app;
const {
  chatEmojiPickerOpenButton,
  chatEmojiPickerModal,
  chatEmojiPickerTitle,
  chatEmojiPickerEyebrow,
  chatEmojiPickerGrid,
  chatEmojiPickerUnlockAllButton,
  chatEmojiPickerConfirmButton,
  chatEmojiPickerCloseTargets,
} = dom;

const getEntries = () => Object.entries(state.chatEmojiPickerState?.entries ?? {})
  .map(([id, entry]) => ({ ...entry, Id: Number(id) }))
  .filter((entry) => Number.isFinite(entry.Id))
  .sort((left, right) => left.Id - right.Id);

app.closeChatEmojiPicker = () => {
  if (!(chatEmojiPickerModal instanceof HTMLElement) || chatEmojiPickerModal.hidden) {
    state.chatEmojiPickerState = null;
    return;
  }
  chatEmojiPickerModal.hidden = true;
  app.setBodyModalOpen(false);
  state.chatEmojiPickerState = null;
  state.lastChatEmojiPickerTrigger?.focus?.({ preventScroll: true });
};

app.renderChatEmojiPicker = () => {
  if (!(chatEmojiPickerGrid instanceof HTMLElement) || !state.chatEmojiPickerState) return;
  const entries = getEntries();
  const selectedIds = state.chatEmojiPickerState.selectedIds;
  if (chatEmojiPickerTitle instanceof HTMLElement) chatEmojiPickerTitle.textContent = app.translate('runtime.chatEmojiPickerTitle');
  if (chatEmojiPickerEyebrow instanceof HTMLElement) chatEmojiPickerEyebrow.textContent = app.translate('runtime.chatEmojiPickerEyebrow');
  if (chatEmojiPickerUnlockAllButton instanceof HTMLButtonElement) {
    chatEmojiPickerUnlockAllButton.textContent = app.translate('runtime.chatEmojiPickerUnlockAll');
    chatEmojiPickerUnlockAllButton.disabled = state.chatEmojiPickerState.pending || entries.length === 0;
  }
  if (chatEmojiPickerConfirmButton instanceof HTMLButtonElement) {
    chatEmojiPickerConfirmButton.textContent = app.translate('runtime.chatEmojiPickerConfirm');
    chatEmojiPickerConfirmButton.disabled = state.chatEmojiPickerState.pending || selectedIds.size === 0;
  }
  chatEmojiPickerGrid.innerHTML = entries.map((entry) => {
    const isSelected = selectedIds.has(entry.Id);
    const tooltip = JSON.stringify({ type: 'chatEmoji', name: entry.Name, description: entry.WorldDesc });
    const image = entry.BigIcon ? `<img src=".${app.escapeHtml(String(entry.BigIcon))}" alt="">` : '<span class="chat-emoji-picker-empty-preview">--</span>';
    return `<button type="button" class="chat-emoji-picker-item${isSelected ? ' is-selected' : ''}" data-chat-emoji-id="${entry.Id}" data-character-detail-equip-slot data-equip-tooltip-text="${app.escapeHtml(tooltip)}" aria-pressed="${isSelected ? 'true' : 'false'}"><span class="chat-emoji-picker-preview">${image}</span><strong>${app.escapeHtml(String(entry.Name || entry.Id))}</strong></button>`;
  }).join('');
};

app.openChatEmojiPicker = async () => {
  if (!(chatEmojiPickerModal instanceof HTMLElement) || state.chatEmojiPickerState?.pending) return;
  state.lastChatEmojiPickerTrigger = document.activeElement;
  state.chatEmojiPickerState = { entries: {}, selectedIds: new Set(), pending: true };
  chatEmojiPickerModal.hidden = false;
  app.setBodyModalOpen(true);
  app.renderChatEmojiPicker();
  try {
    const entries = await app.apiFetch('/api/database-players/selected/chat-emojis/locked');
    if (!state.chatEmojiPickerState) return;
    state.chatEmojiPickerState.entries = entries && typeof entries === 'object' ? entries : {};
    state.chatEmojiPickerState.pending = false;
    if (getEntries().length === 0) {
      app.closeChatEmojiPicker();
      app.openNoticeModal(app.translate('runtime.chatEmojiPickerAllOwned'));
      return;
    }
    app.renderChatEmojiPicker();
    chatEmojiPickerGrid?.querySelector('button')?.focus();
  } catch (error) {
    app.closeChatEmojiPicker();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.chatEmojiPickerLoadFailed'));
  }
};

const submit = async (unlockAll = false) => {
  if (!state.chatEmojiPickerState || state.chatEmojiPickerState.pending) return;
  const emojiIds = unlockAll ? getEntries().map((entry) => entry.Id) : Array.from(state.chatEmojiPickerState.selectedIds);
  if (emojiIds.length === 0) return;
  state.chatEmojiPickerState.pending = true;
  app.renderChatEmojiPicker();
  try {
    await app.apiFetch('/api/database-players/selected/chat-emojis/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji_ids: emojiIds }),
    });
    app.closeChatEmojiPicker();
  } catch (error) {
    state.chatEmojiPickerState.pending = false;
    app.renderChatEmojiPicker();
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.chatEmojiPickerUnlockFailed'));
  }
};

export const initDatabaseChatEmojiPickerFeature = () => {
  chatEmojiPickerOpenButton?.addEventListener('click', () => { void app.openChatEmojiPicker(); });
  chatEmojiPickerCloseTargets.forEach((target) => target.addEventListener('click', app.closeChatEmojiPicker));
  ['mouseover', 'mousemove', 'mouseout', 'focusin', 'focusout'].forEach((eventName) => {
    chatEmojiPickerModal?.addEventListener(eventName, app.handleCharacterDetailEquipTooltipEvent);
  });
  chatEmojiPickerGrid?.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-chat-emoji-id]') : null;
    if (!(button instanceof HTMLButtonElement) || !state.chatEmojiPickerState || state.chatEmojiPickerState.pending) return;
    const id = Number(button.dataset.chatEmojiId);
    if (!Number.isFinite(id)) return;
    const { selectedIds } = state.chatEmojiPickerState;
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    app.renderChatEmojiPicker();
  });
  chatEmojiPickerConfirmButton?.addEventListener('click', () => { void submit(); });
  chatEmojiPickerUnlockAllButton?.addEventListener('click', () => { void submit(true); });
};
