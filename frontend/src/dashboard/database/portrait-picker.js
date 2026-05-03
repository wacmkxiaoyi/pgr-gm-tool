import { app } from '../shared.js';

const { dom, state } = app;
const {
  playerPortraitPickerModal,
  playerPortraitPickerTitle,
  playerPortraitPickerEyebrow,
  playerPortraitPickerCurrent,
  playerPortraitPickerGrid,
  playerPortraitPickerConfirmButton,
  playerPortraitPickerCloseTargets,
  playerPortraitPickerCancelButton,
} = dom;

app.closePlayerPortraitPicker = () => {
  if (!(playerPortraitPickerModal instanceof HTMLElement) || playerPortraitPickerModal.hidden) {
    state.playerPortraitPickerState = null;
    state.playerProfileEditState = null;
    return;
  }

  playerPortraitPickerModal.hidden = true;
  app.setBodyModalOpen(false);
  state.playerPortraitPickerState = null;
  state.playerProfileEditState = null;

  if (state.lastFocusedControl instanceof HTMLElement) {
    state.lastFocusedControl.focus();
  }
};

app.renderPlayerPortraitPicker = () => {
  if (!(playerPortraitPickerGrid instanceof HTMLElement) || !state.playerPortraitPickerState) {
    return;
  }

  const { field } = state.playerPortraitPickerState;
  const { entries, totalPages } = app.getPortraitPickerPages(field);
  state.playerPortraitPickerState.page = 1;
  state.playerPortraitPickerState.pageSize = app.getPortraitPickerPageSize();
  state.playerPortraitPickerState.totalPages = totalPages;

  if (playerPortraitPickerTitle instanceof HTMLElement) {
    playerPortraitPickerTitle.textContent = `选择${app.getPortraitPickerLabel(field)}`;
  }
  if (playerPortraitPickerEyebrow instanceof HTMLElement) {
    playerPortraitPickerEyebrow.textContent = `${app.getPortraitPickerLabel(field)}选择`;
  }
  if (playerPortraitPickerCurrent instanceof HTMLElement) {
    playerPortraitPickerCurrent.textContent = `当前选择：${app.getPortraitPickerCurrentName(field)}`;
  }
  if (playerPortraitPickerConfirmButton instanceof HTMLButtonElement) {
    playerPortraitPickerConfirmButton.disabled = !Number.isFinite(state.playerPortraitPickerState.selectedId);
  }

  playerPortraitPickerGrid.innerHTML = entries.map((entry) => {
    const isSelected = entry.id === state.playerPortraitPickerState.selectedId;
    const url = entry.url || app.getPlayerPortraitUrlByField(field, entry.id);
    const name = app.getPlayerPortraitNameByField(field, entry.id) || String(entry.id);
    return `
      <button type="button" class="player-portrait-picker-item ${isSelected ? 'is-selected' : ''}" data-player-portrait-id="${entry.id}">
        <span class="player-portrait-picker-item-preview">
          <img src="${url}" alt="${app.getPortraitPickerLabel(field)} ${entry.id}">
        </span>
        <strong>${name}</strong>
      </button>
    `;
  }).join('');
};

app.openPlayerPortraitPicker = (field) => {
  const currentValue = app.getPlayerProfileEditValue(field);
  if (currentValue === null || currentValue === undefined) {
    return;
  }

  const availableEntries = app.getPortraitPickerEntries(field);
  const initialSelectedId = availableEntries.some((entry) => entry.id === currentValue) ? currentValue : null;

  if (state.playerProfileEditState?.field && state.playerProfileEditState.field !== field) {
    app.stopPlayerProfileEdit(state.playerProfileEditState.field);
  }

  state.lastFocusedControl = document.activeElement;
  state.playerProfileEditState = { field, pending: false };
  state.playerPortraitPickerState = {
    field,
    page: 1,
    pageSize: app.getPortraitPickerPageSize(),
    totalPages: 1,
    selectedId: initialSelectedId,
  };

  if (playerPortraitPickerModal instanceof HTMLElement) {
    playerPortraitPickerModal.hidden = false;
    app.setBodyModalOpen(true);
    app.renderPlayerPortraitPicker();
    const firstSelected = playerPortraitPickerGrid?.querySelector?.('.is-selected') ?? playerPortraitPickerGrid?.querySelector?.('button');
    if (firstSelected instanceof HTMLElement) {
      firstSelected.focus();
    } else if (playerPortraitPickerConfirmButton instanceof HTMLButtonElement) {
      playerPortraitPickerConfirmButton.focus();
    }
  }
};

app.submitPlayerPortraitPicker = async () => {
  if (!state.playerPortraitPickerState || !state.playerPortraitPickerState.field) {
    return;
  }

  const { field, selectedId } = state.playerPortraitPickerState;
  const currentValue = app.getPlayerProfileEditValue(field);
  if (currentValue === selectedId) {
    app.closePlayerPortraitPicker();
    return;
  }

  if (selectedId === null || selectedId === undefined) {
    app.openControlModal('请选择一个可用资源。');
    return;
  }

  if (app.isGameServerHealthy() && !window.confirm('游戏服务器尚未关闭，改动可能不生效，且有可能损坏原始数据！')) {
    app.closePlayerPortraitPicker();
    return;
  }

  if (!(playerPortraitPickerConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  playerPortraitPickerConfirmButton.disabled = true;

  try {
    const response = await fetch('/api/database-players/selected', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field, value: selectedId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '修改玩家信息失败');
    }

    app.closePlayerPortraitPicker();
    app.clearPlayerProfileSummaryMessage();
    app.renderPlayerProfile(payload);
  } catch (error) {
    playerPortraitPickerConfirmButton.disabled = false;
    app.openControlModal(error instanceof Error ? error.message : '修改玩家信息失败');
  }
};

app.handlePlayerPortraitPickerClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-player-portrait-id]');
  if (!(button instanceof HTMLButtonElement) || !state.playerPortraitPickerState) {
    return;
  }

  const selectedId = app.normalizePortraitId(button.dataset.playerPortraitId);
  if (selectedId === null) {
    return;
  }

  state.playerPortraitPickerState.selectedId = selectedId;
  app.renderPlayerPortraitPicker();
};

export const initDatabasePortraitPickerFeature = () => {
  playerPortraitPickerCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closePlayerPortraitPicker);
  });

  if (playerPortraitPickerGrid instanceof HTMLElement) {
    playerPortraitPickerGrid.addEventListener('click', app.handlePlayerPortraitPickerClick);
  }

  if (playerPortraitPickerConfirmButton instanceof HTMLButtonElement) {
    playerPortraitPickerConfirmButton.addEventListener('click', () => {
      void app.submitPlayerPortraitPicker();
    });
  }

  if (playerPortraitPickerCancelButton instanceof HTMLButtonElement) {
    playerPortraitPickerCancelButton.addEventListener('click', app.closePlayerPortraitPicker);
  }

  if (playerPortraitPickerModal instanceof HTMLElement) {
    playerPortraitPickerModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target === playerPortraitPickerModal || target.classList.contains('login-modal-backdrop')) {
        app.closePlayerPortraitPicker();
      }
    });

    playerPortraitPickerModal.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('[data-player-portrait-id]')) {
        event.preventDefault();
        void app.submitPlayerPortraitPicker();
      }
    });
  }
};
