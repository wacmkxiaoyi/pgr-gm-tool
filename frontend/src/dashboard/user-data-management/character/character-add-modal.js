import { app } from '../../shared.js';

const { dom, state } = app;
const {
  characterAddModal,
  characterAddTitle,
  characterAddEyebrow,
  characterAddDescription,
  characterAddCurrent,
  characterAddGrid,
  characterAddConfirmButton,
  characterAddCloseTargets,
  characterAddCancelButton,
} = dom;

app.resetCharacterAddState = () => {
  state.characterAddState = null;
};

app.closeCharacterAddModal = () => {
  if (!(characterAddModal instanceof HTMLElement) || characterAddModal.hidden) {
    app.resetCharacterAddState();
    state.lastCharacterAddTrigger = null;
    return;
  }

  characterAddModal.hidden = true;
  app.setBodyModalOpen(false);
  app.resetCharacterAddState();

  if (state.lastCharacterAddTrigger instanceof HTMLElement) {
    state.lastCharacterAddTrigger.focus({ preventScroll: true });
  }
  state.lastCharacterAddTrigger = null;
};

app.getCharacterAddEntries = () => {
  const ids = Array.isArray(state.characterAddState?.availableCharacterIds)
    ? state.characterAddState.availableCharacterIds
    : [];

  return ids
    .map((characterId) => {
      const id = Number(characterId);
      if (!Number.isFinite(id) || id <= 0) {
        return null;
      }

      return {
        id,
        name: app.getCharacterNameByCharacterId(id),
        iconUrl: app.getCharacterIconByCharacterId(id),
      };
    })
    .filter(Boolean);
};

app.renderCharacterAddCurrent = () => {
  if (!(characterAddCurrent instanceof HTMLElement)) {
    return;
  }

  const selectedId = Number(state.characterAddState?.selectedCharacterId);
  if (!Number.isFinite(selectedId) || selectedId <= 0) {
    characterAddCurrent.innerHTML = `
      <div class="character-add-summary-row">
        <span class="character-add-summary-key">${app.escapeHtml(app.translate('dashboard.characterManagementAddCurrent'))}</span>
        <span class="character-add-summary-value">${app.escapeHtml(app.translate('common.unselected'))}</span>
      </div>
    `;
    return;
  }

  const selectedName = app.getCharacterNameByCharacterId(selectedId);
  const selectedIconUrl = app.getCharacterIconByCharacterId(selectedId);
  const escapedLabel = app.escapeHtml(app.translate('dashboard.characterManagementAddCurrent'));
  const escapedName = app.escapeHtml(selectedName || '--');
  const previewAlt = app.escapeHtml(selectedName || '--');

  characterAddCurrent.innerHTML = `
    <div class="character-add-summary-row">
      <span class="character-add-summary-key">${escapedLabel}</span>
      <span class="character-add-summary-value">
        <span class="character-add-summary-value-media">
          <span class="character-add-summary-value-label">${escapedName}</span>
          ${selectedIconUrl ? `<img class="character-add-summary-value-icon" src=".${selectedIconUrl}" alt="${previewAlt}">` : ''}
        </span>
      </span>
    </div>
  `;
};

app.renderCharacterAddModal = () => {
  if (!(characterAddGrid instanceof HTMLElement) || !state.characterAddState) {
    return;
  }

  if (characterAddTitle instanceof HTMLElement) {
    characterAddTitle.textContent = app.translate('runtime.characterManagementAddPickerTitle');
  }

  if (characterAddEyebrow instanceof HTMLElement) {
    characterAddEyebrow.textContent = app.translate('runtime.characterManagementAddPickerEyebrow');
  }

  if (characterAddDescription instanceof HTMLElement) {
    characterAddDescription.textContent = app.translate('runtime.characterManagementAddPickerDescription');
  }

  app.renderCharacterAddCurrent();

  const selectedId = Number(state.characterAddState.selectedCharacterId);
  const submitting = Boolean(state.characterAddState.submitting);
  const entries = app.getCharacterAddEntries();
  if (entries.length === 0) {
    characterAddGrid.innerHTML = '';
  }
  characterAddGrid.innerHTML = entries.map((entry) => {
    const isSelected = entry.id === selectedId;
    const escapedName = app.escapeHtml(entry.name || '--');
    return `
      <button type="button" class="character-picker-item${isSelected ? ' is-selected' : ''}" data-character-add-id="${entry.id}"${submitting ? ' disabled' : ''}>
        <span class="character-picker-item-preview">
          ${entry.iconUrl ? `<img src=".${entry.iconUrl}" alt="${escapedName}">` : ''}
        </span>
        <strong>${escapedName}</strong>
      </button>
    `;
  }).join('');

  if (characterAddConfirmButton instanceof HTMLButtonElement) {
    characterAddConfirmButton.disabled = submitting || !Number.isFinite(selectedId) || selectedId <= 0;
  }

  if (characterAddCancelButton instanceof HTMLButtonElement) {
    characterAddCancelButton.disabled = submitting;
  }
};

app.loadCharacterAddCandidates = async () => {
  const payload = await app.apiFetch('/api/database-characters/available');
  const availableCharacterIds = Array.isArray(payload?.character_ids)
    ? payload.character_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  return availableCharacterIds;
};

app.openCharacterAddModal = async (trigger = null) => {
  if (!(characterAddModal instanceof HTMLElement) || !app.canAccessCharacterManagement()) {
    return;
  }

  state.lastCharacterAddTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  app.resetCharacterAddState();

  try {
    const availableCharacterIds = await app.loadCharacterAddCandidates();
    if (availableCharacterIds.length === 0) {
      state.lastCharacterAddTrigger = null;
      app.openNoticeModal(app.translate('runtime.characterManagementAddAllOwned'));
      return;
    }

    state.characterAddState = {
      availableCharacterIds,
      selectedCharacterId: availableCharacterIds[0] ?? null,
      submitting: false,
    };

    characterAddModal.hidden = false;
    app.setBodyModalOpen(true);
    app.renderCharacterAddModal();

    const firstSelected = characterAddGrid.querySelector('.is-selected') ?? characterAddGrid.querySelector('button');
    if (firstSelected instanceof HTMLElement) {
      firstSelected.focus();
    } else if (characterAddConfirmButton instanceof HTMLButtonElement) {
      characterAddConfirmButton.focus();
    }
  } catch (error) {
    state.lastCharacterAddTrigger = null;
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterManagementAddLoadFailed'));
  }
};

app.handleCharacterAddSelectionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !state.characterAddState) {
    return;
  }

  const button = target.closest('[data-character-add-id]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const selectedId = Number.parseInt(button.dataset.characterAddId ?? '', 10);
  if (!Number.isFinite(selectedId) || selectedId <= 0) {
    return;
  }

  state.characterAddState.selectedCharacterId = selectedId;
  app.renderCharacterAddModal();
};

app.submitCharacterAdd = async () => {
  if (!state.characterAddState || state.characterAddState.submitting) {
    return;
  }

  const selectedId = Number(state.characterAddState?.selectedCharacterId);
  if (!Number.isFinite(selectedId) || selectedId <= 0) {
    app.openNoticeModal(app.translate('runtime.characterManagementAddNeedSelection'));
    return;
  }

  state.characterAddState.submitting = true;
  app.renderCharacterAddModal();

  try {
    await app.apiFetch('/api/database-characters/selected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ CharacterId: selectedId }),
    });

    const characterName = app.getCharacterNameByCharacterId(selectedId) || '--';
    app.closeCharacterAddModal();
    app.openSuccessModal(
      app.translate('runtime.characterManagementAddSuccess', { characterName }),
      app.translate('runtime.characterManagementAddSuccessTitle'),
    );
    await app.loadSelectedAccountCharacters(state.characterManagementCurrentPage || 1);
  } catch (error) {
    if (app.isMutationRiskCancelled(error)) {
      return;
    }

    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.characterManagementAddFailed'));
  } finally {
    if (state.characterAddState) {
      state.characterAddState.submitting = false;
      app.renderCharacterAddModal();
    }
  }
};

app.rerenderCharacterAddLocale = () => {
  if (state.characterAddState) {
    app.renderCharacterAddModal();
  }
};

export const initDatabaseCharacterAddModalFeature = () => {
  characterAddCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeCharacterAddModal);
  });

  if (characterAddGrid instanceof HTMLElement) {
    characterAddGrid.addEventListener('click', app.handleCharacterAddSelectionClick);
  }

  if (characterAddConfirmButton instanceof HTMLButtonElement) {
    characterAddConfirmButton.addEventListener('click', app.submitCharacterAdd);
  }

  if (characterAddCancelButton instanceof HTMLButtonElement) {
    characterAddCancelButton.addEventListener('click', app.closeCharacterAddModal);
  }

  if (characterAddModal instanceof HTMLElement) {
    characterAddModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target === characterAddModal || target.classList.contains('shared-modal-backdrop')) {
        app.closeCharacterAddModal();
      }
    });

    characterAddModal.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('[data-character-add-id]')) {
        event.preventDefault();
        app.submitCharacterAdd();
      }
    });
  }
};
