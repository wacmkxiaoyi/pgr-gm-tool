import { app } from '../shared.js';

const PLAYER_NAME_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9 _-]+$/;
const PLAYER_FIELD_LABELS = {
  name: 'runtime.playerFieldName',
  gender: 'runtime.playerFieldGender',
  likes: 'runtime.playerFieldLikes',
  level: 'runtime.playerFieldLevel',
};
const PLAYER_GENDER_OPTIONS = [
  { value: '2', labelKey: 'dashboard.playerGenderMale' },
  { value: '1', labelKey: 'dashboard.playerGenderFemale' },
];

const getPlayerFieldLabel = (field) => app.translate(PLAYER_FIELD_LABELS[field] ?? field);

const { dom, state } = app;
const {
  databasePlayerProfileSubnavButton,
  databasePlayerProfileState,
  databasePlayerProfileShell,
  databasePlayerProfileSummary,
  playerCardAvatarShell,
  playerCardAvatarRing,
  playerCardAvatarFrameImage,
  playerCardAvatarImage,
  playerCardAvatarFallback,
  playerCardName,
  playerCardInlineUid,
  playerCardGender,
  playerCardLikes,
  playerCardLevel,
  playerCardExp,
} = dom;

const PLAYER_PROFILE_EDITABLE_FIELDS = {
  name: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.name),
    getRawValue: (profile) => profile?.name ?? null,
    element: () => playerCardName,
    editorType: 'input',
    inputMode: 'text',
    normalize: (value) => String(value).trim(),
    validate: (value) => {
      if (value.length <= 0) {
        return app.translate('runtime.playerNameRequired');
      }

      return PLAYER_NAME_PATTERN.test(value) ? '' : app.translate('runtime.playerNameInvalid');
    },
  },
  gender: {
    displayValue: (profile) => app.getPlayerGenderLabel(profile?.gender ?? null),
    getRawValue: (profile) => profile?.gender ?? null,
    element: () => playerCardGender,
    editorType: 'select',
    normalize: (value) => String(value).trim(),
    validate: (value) => (value === '2' || value === '1' ? '' : app.translate('runtime.playerGenderInvalid')),
    options: PLAYER_GENDER_OPTIONS,
  },
  likes: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.likes),
    getRawValue: (profile) => profile?.likes ?? null,
    element: () => playerCardLikes,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => (/^\d+$/.test(value) ? '' : app.translate('runtime.playerLikesInvalid')),
  },
  level: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.level),
    getRawValue: (profile) => profile?.level ?? null,
    element: () => playerCardLevel,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => (/^\d+$/.test(value) ? '' : app.translate('runtime.playerLevelInvalid')),
  },
  head_portrait_id: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.head_portrait_id),
    getRawValue: (profile) => profile?.head_portrait_id ?? null,
    element: () => playerCardAvatarImage,
    editorType: 'picker',
  },
  head_frame_id: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.head_frame_id),
    getRawValue: (profile) => profile?.head_frame_id ?? null,
    element: () => playerCardAvatarFrameImage,
    editorType: 'picker',
  },
};

app.getPlayerProfileEditValue = (field) => {
  if (!state.playerProfileData) {
    return null;
  }

  if (field === 'head_portrait_id') {
    return state.playerProfileData.head_portrait_id ?? null;
  }

  if (field === 'head_frame_id') {
    return state.playerProfileData.head_frame_id ?? null;
  }

  return PLAYER_PROFILE_EDITABLE_FIELDS[field]?.getRawValue(state.playerProfileData) ?? null;
};

app.setPlayerEditableState = (field, editable) => {
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  const element = config?.element();
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.classList.toggle('is-editable', editable);
  element.setAttribute('tabindex', editable ? '0' : '-1');
  if (editable) {
    element.setAttribute('role', 'button');
    element.setAttribute('title', config?.editorType === 'picker' ? app.translate('runtime.playerEditPickerTitle', { label: app.getPortraitPickerLabel(field) }) : app.translate('runtime.playerEditInputTitle'));
  } else {
    element.removeAttribute('role');
    element.removeAttribute('title');
  }
};

app.syncPlayerEditableStates = () => {
  Object.entries(PLAYER_PROFILE_EDITABLE_FIELDS).forEach(([field, config]) => {
    const rawValue = config.getRawValue(state.playerProfileData);
    app.setPlayerEditableState(field, rawValue !== null && rawValue !== undefined);
  });
};

app.stopPlayerProfileEdit = (field) => {
  if (!state.playerProfileEditState || state.playerProfileEditState.field !== field) {
    return;
  }

  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  const element = config?.element();
  if (element instanceof HTMLElement) {
    element.classList.remove('is-editing');
  }

  state.playerProfileEditState = null;
  app.renderPlayerProfile(state.playerProfileData);
};

app.beginPlayerProfileEdit = (field) => {
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  const element = config?.element();
  const rawValue = config?.getRawValue(state.playerProfileData);

  if (!config || !(element instanceof HTMLElement) || rawValue === null || rawValue === undefined) {
    return;
  }

  if (config.editorType === 'picker') {
    app.openPlayerPortraitPicker(field);
    return;
  }

  if (state.playerProfileEditState?.field === field) {
    const existingInput = element.querySelector('input');
    if (existingInput instanceof HTMLInputElement) {
      existingInput.focus();
      existingInput.select();
      return;
    }
  }

  if (state.playerProfileEditState?.field && state.playerProfileEditState.field !== field) {
    app.stopPlayerProfileEdit(state.playerProfileEditState.field);
  }

  app.clearPlayerProfileSummaryMessage();
  state.playerProfileEditState = { field, pending: false };
  element.classList.add('is-editing');
  element.innerHTML = '';

  if (config.editorType === 'select') {
    const select = document.createElement('select');
    select.className = 'database-player-inline-select';
    select.setAttribute('aria-label', app.translate('runtime.playerEditAria', { label: getPlayerFieldLabel(field) }));

    const options = Array.isArray(config.options) ? config.options : [];
    select.innerHTML = options.map((option) => `<option value="${option.value}">${app.translate(option.labelKey ?? option.label ?? option.value)}</option>`).join('');
    select.value = String(rawValue);
    element.appendChild(select);
    select.focus();

    select.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void app.submitPlayerProfileEdit(field, select.value);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        app.stopPlayerProfileEdit(field);
      }
    });

    select.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (state.playerProfileEditState?.field === field && !state.playerProfileEditState.pending) {
          app.stopPlayerProfileEdit(field);
        }
      }, 0);
    });
    return;
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'database-player-inline-input';
  input.value = String(rawValue);
  input.inputMode = config.inputMode;
  input.setAttribute('aria-label', app.translate('runtime.playerEditAria', { label: getPlayerFieldLabel(field) }));
  element.appendChild(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void app.submitPlayerProfileEdit(field, input.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      app.stopPlayerProfileEdit(field);
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (state.playerProfileEditState?.field === field && !state.playerProfileEditState.pending) {
        app.stopPlayerProfileEdit(field);
      }
    }, 0);
  });
};

app.submitPlayerProfileEdit = async (field, nextValue) => {
  const currentState = state.playerProfileEditState;
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  if (!currentState || currentState.field !== field || !config) {
    return;
  }

  const normalizedValue = config.normalize(nextValue);
  const validationMessage = config.validate(normalizedValue);
  if (validationMessage) {
    app.openControlModal(validationMessage);
    return;
  }

  const currentRawValue = config.getRawValue(state.playerProfileData);
  let normalizedCurrentValue = String(currentRawValue);
  if (field === 'name') {
    normalizedCurrentValue = String(currentRawValue ?? '').trim();
  }
  if (normalizedCurrentValue === normalizedValue) {
    app.stopPlayerProfileEdit(field);
    return;
  }

  if (app.isGameServerHealthy() && !window.confirm(app.translate('runtime.playerEditConfirmRisk'))) {
    app.stopPlayerProfileEdit(field);
    return;
  }

  currentState.pending = true;
  const element = config.element();
  const editor = element instanceof HTMLElement ? element.querySelector('input, select') : null;
  if (editor instanceof HTMLInputElement || editor instanceof HTMLSelectElement) {
    editor.disabled = true;
  }

  const requestValue = field === 'name' ? normalizedValue : Number.parseInt(normalizedValue, 10);

  try {
    const payload = await app.apiFetch('/api/database-players/selected', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field, value: requestValue }),
    });

    state.playerProfileEditState = null;
    app.clearPlayerProfileSummaryMessage();
    app.renderPlayerProfile(payload);
  } catch (error) {
    currentState.pending = false;
    app.renderPlayerProfile(state.playerProfileData);
    app.openControlModal(app.apiErrorMessage(error, 'runtime.playerProfileUpdateFailed'));
  }
};

app.handlePlayerProfileFieldActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
    return;
  }

  const editableElement = target.closest('[data-player-edit-field]');
  if (!(editableElement instanceof HTMLElement)) {
    return;
  }

  const field = editableElement.dataset.playerEditField;
  if (!field || !PLAYER_PROFILE_EDITABLE_FIELDS[field] || !editableElement.classList.contains('is-editable')) {
    return;
  }

  app.beginPlayerProfileEdit(field);
};

app.resetPlayerCardAvatar = () => {
  if (playerCardAvatarImage instanceof HTMLImageElement) {
    playerCardAvatarImage.hidden = true;
    playerCardAvatarImage.removeAttribute('src');
  }

  if (playerCardAvatarFallback instanceof HTMLElement) {
    playerCardAvatarFallback.hidden = false;
  }
};

app.resetPlayerCardAvatarFrame = () => {
  if (playerCardAvatarFrameImage instanceof HTMLImageElement) {
    playerCardAvatarFrameImage.hidden = true;
    playerCardAvatarFrameImage.removeAttribute('src');
  }
};

app.setPlayerCardAvatar = (source) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  if (!(playerCardAvatarImage instanceof HTMLImageElement)) {
    return;
  }

  if (!normalizedSource) {
    app.resetPlayerCardAvatar();
    return;
  }

  playerCardAvatarImage.hidden = false;
  playerCardAvatarImage.src = normalizedSource;
  if (playerCardAvatarFallback instanceof HTMLElement) {
    playerCardAvatarFallback.hidden = true;
  }
};

app.setPlayerCardAvatarFrame = (source) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  if (!(playerCardAvatarFrameImage instanceof HTMLImageElement)) {
    return;
  }

  if (!normalizedSource) {
    app.resetPlayerCardAvatarFrame();
    return;
  }

  playerCardAvatarFrameImage.hidden = false;
  playerCardAvatarFrameImage.src = normalizedSource;
};

app.setPlayerProfileState = (message, tone = '') => {
  if (!(databasePlayerProfileState instanceof HTMLElement)) {
    return;
  }

  databasePlayerProfileState.textContent = message;
  databasePlayerProfileState.className = 'database-player-empty';
  if (tone) {
    databasePlayerProfileState.classList.add(tone);
  }
  databasePlayerProfileState.hidden = false;

  if (databasePlayerProfileShell instanceof HTMLElement) {
    databasePlayerProfileShell.hidden = true;
  }
};

app.setPlayerProfileSummaryMessage = (message, tone = '') => {
  if (!(databasePlayerProfileSummary instanceof HTMLElement)) {
    return;
  }

  const summaryMeta = databasePlayerProfileSummary.parentElement;
  databasePlayerProfileSummary.hidden = false;
  databasePlayerProfileSummary.textContent = message;
  databasePlayerProfileSummary.className = 'database-player-profile-summary';
  if (tone) {
    databasePlayerProfileSummary.classList.add(tone);
  }
  if (summaryMeta instanceof HTMLElement) {
    summaryMeta.hidden = false;
  }
};

app.clearPlayerProfileSummaryMessage = () => {
  if (!(databasePlayerProfileSummary instanceof HTMLElement)) {
    return;
  }

  const summaryMeta = databasePlayerProfileSummary.parentElement;
  databasePlayerProfileSummary.className = 'database-player-profile-summary';
  databasePlayerProfileSummary.textContent = '';
  databasePlayerProfileSummary.hidden = true;
  if (summaryMeta instanceof HTMLElement) {
    summaryMeta.hidden = true;
  }
};

app.showPlayerProfile = () => {
  if (databasePlayerProfileState instanceof HTMLElement) {
    databasePlayerProfileState.hidden = true;
  }

  if (databasePlayerProfileShell instanceof HTMLElement) {
    databasePlayerProfileShell.hidden = false;
  }
};

app.resetPlayerProfileView = () => {
  state.playerProfileData = null;
  state.playerProfileEditState = null;
  app.clearPlayerProfileSummaryMessage();

  if (playerCardName instanceof HTMLElement) {
    playerCardName.textContent = '--';
  }
  if (playerCardInlineUid instanceof HTMLElement) {
      playerCardInlineUid.textContent = `UID ${state.selectedAccountUid ?? app.translate('common.notAvailable')}`;
  }
  if (playerCardGender instanceof HTMLElement) {
    playerCardGender.textContent = '--';
  }
  if (playerCardLevel instanceof HTMLElement) {
    playerCardLevel.textContent = '--';
  }
  if (playerCardLikes instanceof HTMLElement) {
    playerCardLikes.textContent = '--';
  }
  if (playerCardExp instanceof HTMLElement) {
      playerCardExp.textContent = '0';
  }

  app.resetPlayerCardAvatarFrame();
  app.resetPlayerCardAvatar();
  app.syncPlayerEditableStates();
};

app.renderPlayerProfile = (profile) => {
  state.playerProfileData = profile;
  state.playerProfileEditState = null;
  app.clearPlayerProfileSummaryMessage();

  const genderLabel = app.getPlayerGenderLabel(profile?.gender ?? null);
  const levelLabel = app.formatPlayerFieldValue(profile?.level);
  const nameLabel = app.formatPlayerFieldValue(profile?.name);
  const likesLabel = app.formatPlayerFieldValue(profile?.likes);
  const profileUid = app.normalizeAccountUid(profile?.uid ?? state.selectedAccountUid);

  if (playerCardName instanceof HTMLElement) {
    playerCardName.textContent = nameLabel;
  }
  if (playerCardInlineUid instanceof HTMLElement) {
      playerCardInlineUid.textContent = `UID ${profileUid ?? app.translate('common.notAvailable')}`;
  }
  if (playerCardGender instanceof HTMLElement) {
    playerCardGender.textContent = genderLabel;
  }
  if (playerCardLevel instanceof HTMLElement) {
    playerCardLevel.textContent = levelLabel;
  }
  if (playerCardLikes instanceof HTMLElement) {
    playerCardLikes.textContent = likesLabel;
  }
  if (playerCardExp instanceof HTMLElement) {
    playerCardExp.textContent = '0';
  }

  app.setPlayerCardAvatar(app.getPlayerPortraitUrlByField('head_portrait_id', profile?.head_portrait_id ?? null));
  app.setPlayerCardAvatarFrame(app.getPlayerPortraitUrlByField('head_frame_id', profile?.head_frame_id ?? null));
  app.syncPlayerEditableStates();
  app.showPlayerProfile();
};

app.canAccessPlayerProfile = (payload = state.databaseHealthSnapshot) => app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null;

app.updatePlayerProfileAccess = (payload = state.databaseHealthSnapshot) => {
  const healthy = app.isDatabaseHealthy(payload);
  const accessible = app.canAccessPlayerProfile(payload);
  let summaryMessage = '';

  if (databasePlayerProfileSubnavButton instanceof HTMLButtonElement) {
    databasePlayerProfileSubnavButton.disabled = !accessible;
    if (!healthy) {
      databasePlayerProfileSubnavButton.title = app.translate('runtime.playerProfileAccessTitle');
    } else if (state.selectedAccountUid === null) {
      databasePlayerProfileSubnavButton.title = app.translate('runtime.playerProfileNeedAccountTitle');
    } else {
      databasePlayerProfileSubnavButton.title = '';
    }
  }

  if (databasePlayerProfileSummary instanceof HTMLElement) {
    const summaryMeta = databasePlayerProfileSummary.parentElement;
    if (!healthy) {
        summaryMessage = app.translate('dashboard.accountsUnavailable');
      } else if (state.selectedAccountUid === null) {
        summaryMessage = app.translate('dashboard.playerProfileChooseAccount');
      } else if (state.playerProfileLoading) {
        summaryMessage = app.translate('runtime.playerProfileLoading');
      }

    databasePlayerProfileSummary.textContent = summaryMessage;
    databasePlayerProfileSummary.hidden = summaryMessage.length <= 0;
    if (summaryMeta instanceof HTMLElement) {
      summaryMeta.hidden = summaryMessage.length <= 0;
    }
  }

  if (!(healthy && state.selectedAccountUid !== null)) {
    app.resetPlayerProfileView();
  }

  if (!healthy) {
    app.setPlayerProfileState(app.translate('runtime.playerProfileUnavailable'), 'is-muted');
    if (app.isDatabasePlayerProfileSectionActive()) {
      app.setActiveDatabaseTab('database-service-status-section');
    }
    return;
  }

  if (state.selectedAccountUid === null) {
    app.setPlayerProfileState(app.translate('dashboard.playerProfileChooseAccount'), 'is-muted');
    if (app.isDatabasePlayerProfileSectionActive()) {
      app.setActiveDatabaseTab('database-accounts-section');
    }
    return;
  }

  if (!state.playerProfileData) {
    app.setPlayerProfileState(state.playerProfileLoading ? app.translate('runtime.playerProfileLoading') : app.translate('runtime.playerProfilePrompt'), state.playerProfileLoading ? 'is-loading' : 'is-muted');
  }
};

app.loadSelectedPlayerProfile = async () => {
  if (!app.canAccessPlayerProfile() || state.playerProfileLoading) {
    app.updatePlayerProfileAccess();
    return;
  }

  state.playerProfileLoading = true;
  app.updatePlayerProfileAccess();
  app.setPlayerProfileState(app.translate('runtime.playerProfileLoading'), 'is-loading');

  try {
    const payload = await app.apiFetch('/api/database-players/selected');

    app.renderPlayerProfile(payload);
  } catch (error) {
    state.playerProfileData = null;
    app.setPlayerProfileState(app.apiErrorMessage(error, 'runtime.playerProfileLoadFailed'), 'is-error');
  } finally {
    state.playerProfileLoading = false;
    app.updatePlayerProfileAccess();
  }
};

export const initDatabasePlayerProfileFeature = () => {
  if (databasePlayerProfileShell instanceof HTMLElement) {
    databasePlayerProfileShell.addEventListener('click', app.handlePlayerProfileFieldActivate);
    databasePlayerProfileShell.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
        return;
      }

      event.preventDefault();
      app.handlePlayerProfileFieldActivate(event);
    });
  }

  if (playerCardAvatarImage instanceof HTMLImageElement) {
    playerCardAvatarImage.addEventListener('error', () => {
      app.resetPlayerCardAvatar();
    });
  }

  if (playerCardAvatarFrameImage instanceof HTMLImageElement) {
    playerCardAvatarFrameImage.addEventListener('error', () => {
      app.resetPlayerCardAvatarFrame();
    });
  }

  if (playerCardAvatarShell instanceof HTMLElement) {
    playerCardAvatarShell.addEventListener('click', (event) => {
      if (event.target instanceof HTMLElement && event.target.closest('.database-player-card-avatar-ring')) {
        return;
      }

      app.openPlayerPortraitPicker('head_portrait_id');
    });
  }

  if (playerCardAvatarRing instanceof HTMLElement) {
    playerCardAvatarRing.addEventListener('click', (event) => {
      event.stopPropagation();
      app.openPlayerPortraitPicker('head_frame_id');
    });
  }

  if (playerCardAvatarImage instanceof HTMLElement) {
    playerCardAvatarImage.addEventListener('click', (event) => {
      event.stopPropagation();
      app.openPlayerPortraitPicker('head_portrait_id');
    });
  }

  if (playerCardAvatarFrameImage instanceof HTMLElement) {
    playerCardAvatarFrameImage.addEventListener('click', (event) => {
      event.stopPropagation();
      app.openPlayerPortraitPicker('head_frame_id');
    });
  }
};
