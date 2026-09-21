import { app } from '../../shared.js';

const PLAYER_NAME_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9 _-]+$/;
const PLAYER_FIELD_LABELS = {
  name: 'runtime.playerFieldName',
  gender: 'runtime.playerFieldGender',
  likes: 'runtime.playerFieldLikes',
  level: 'runtime.playerFieldLevel',
  honor_level: 'runtime.playerFieldHonorLevel',
  exp: 'runtime.playerFieldExp',
  money: 'runtime.playerFieldMoney',
  serum: 'runtime.playerFieldSerum',
  black_card: 'runtime.playerFieldBlackCard',
  rainbow_card: 'runtime.playerFieldRainbowCard',
};
const getPlayerFieldLabel = (field) => app.translate(PLAYER_FIELD_LABELS[field] ?? field);

const { dom, state } = app;
const {
  databasePlayerProfileSubnavButton,
  databasePlayerProfileState,
  databasePlayerProfileShell,
  databasePlayerProfileSummary,
  playerCard,
  playerCardBackground,
  playerCardAvatarShell,
  playerCardAvatarRing,
  playerCardAvatarFrameImage,
  playerCardAvatarFrameHitbox,
  playerCardAvatarImage,
  playerCardAvatarFallback,
  playerCardName,
  playerCardGender,
  playerCardLikes,
  playerCardLevel,
  playerCardLevelLabel,
  playerCardHonorBar,
  playerCardHonorLevel,
  playerCardExp,
  playerCardMoney,
  playerCardSerum,
  playerCardBlackCard,
  playerCardRainbowCard,
} = dom;

const PLAYER_CARD_MIN_ASPECT_RATIO = 1.2;
const PLAYER_CARD_MAX_ASPECT_RATIO = 2.6;
const PLAYER_CARD_MOBILE_BREAKPOINT = 640;
const PLAYER_INT32_MAX = 2147483647;

const getConfiguredPlayerLevelMax = () => {
  const parsedMax = Number.parseInt(String(state.playerLevelMax ?? ''), 10);
  return Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : 0;
};

const getConfiguredPlayerLevelExpMax = (levelValue) => {
  const normalizedLevel = Number.parseInt(String(levelValue ?? ''), 10);
  if (!Number.isFinite(normalizedLevel) || normalizedLevel < 0) {
    return null;
  }

  const rawMaxExp = state.playerLevelMaxExpMap?.[normalizedLevel];
  const parsedMaxExp = Number.parseInt(String(rawMaxExp ?? ''), 10);
  return Number.isFinite(parsedMaxExp) && parsedMaxExp >= 0 ? parsedMaxExp : null;
};

const getPlayerLevelInputMax = () => getConfiguredPlayerLevelMax();

const getConfiguredPlayerHonorLevelMax = () => {
  const parsedMax = Number.parseInt(String(state.playerHonorLevelMax ?? ''), 10);
  return Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : 0;
};

const isPlayerAtLevelMax = (profile) => {
  const level = Number.parseInt(String(profile?.level ?? ''), 10);
  return level === getConfiguredPlayerLevelMax();
};

const getConfiguredPlayerHonorLevelExpMax = (honorLevelValue) => {
  const honorLevel = Number.parseInt(String(honorLevelValue ?? ''), 10);
  const rawMaxExp = state.playerHonorLevelMaxExpMap?.[honorLevel];
  const parsedMaxExp = Number.parseInt(String(rawMaxExp ?? ''), 10);
  return Number.isFinite(parsedMaxExp) && parsedMaxExp >= 0 ? parsedMaxExp : null;
};

const getPlayerExpInputMax = (profile) => {
  if (isPlayerAtLevelMax(profile)) {
    const honorLevel = Number.parseInt(String(profile?.honor_level ?? ''), 10) || 1;
    const maxExp = getConfiguredPlayerHonorLevelExpMax(honorLevel);
    if (maxExp === null) {
      return null;
    }
    return honorLevel >= getConfiguredPlayerHonorLevelMax() ? maxExp : Math.max(0, maxExp - 1);
  }

  const levelMax = getConfiguredPlayerLevelMax();
  const currentLevel = Number.parseInt(String(profile?.level ?? ''), 10);
  if (!Number.isFinite(currentLevel) || currentLevel < 0) {
    return null;
  }

  const configuredMaxExp = getConfiguredPlayerLevelExpMax(currentLevel);
  if (configuredMaxExp === null) {
    return null;
  }

  if (currentLevel >= levelMax) {
    return configuredMaxExp;
  }

  return Math.max(0, configuredMaxExp - 1);
};

const getPlayerExpDisplayMax = (profile) => (isPlayerAtLevelMax(profile)
  ? getConfiguredPlayerHonorLevelExpMax(Number.parseInt(String(profile?.honor_level ?? ''), 10) || 1)
  : getConfiguredPlayerLevelExpMax(profile?.level));

const validateNonNegativeInteger = (value, invalidKey) => (/^\d+$/.test(value) ? '' : app.translate(invalidKey));

const validateInt32Field = (value, invalidKey) => {
  const invalidMessage = validateNonNegativeInteger(value, invalidKey);
  if (invalidMessage) {
    return invalidMessage;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (parsedValue > PLAYER_INT32_MAX) {
    return app.translate('runtime.playerValueAboveInt32Max', { max: PLAYER_INT32_MAX });
  }

  return '';
};

const getPlayerExpProgress = (profile) => {
  const exp = Number.parseInt(String(profile?.exp ?? ''), 10);
  const maxExp = getPlayerExpDisplayMax(profile);
  if (!Number.isFinite(exp) || exp < 0 || !Number.isFinite(maxExp) || maxExp <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, exp / maxExp));
};

const getPlayerExpDisplayValue = (profile) => {
  const expLabel = app.formatPlayerFieldValue(profile?.exp ?? 0);
  const maxExpLabel = app.formatPlayerFieldValue(getPlayerExpDisplayMax(profile));
  return `${expLabel} / ${maxExpLabel}`;
};

const getPlayerLevelProgress = (profile) => {
  const level = Number.parseInt(String(profile?.level ?? ''), 10);
  const levelMax = getConfiguredPlayerLevelMax();
  if (!Number.isFinite(level) || level < 0 || levelMax <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, level / levelMax));
};

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
    displayValue: (profile) => app.getPlayerGenderLabel(profile?.gender),
    getRawValue: (profile) => profile?.gender ?? null,
    element: () => playerCardGender,
    editorType: 'select',
    options: [
      { value: 1, labelKey: 'dashboard.playerGenderFemale' },
      { value: 2, labelKey: 'dashboard.playerGenderMale' },
    ],
    normalize: (value) => String(value).trim(),
    validate: (value) => (value === '1' || value === '2' ? '' : app.translate('runtime.playerGenderInvalid')),
  },
  likes: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.likes),
    getRawValue: (profile) => profile?.likes ?? null,
    element: () => playerCardLikes,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => validateInt32Field(value, 'runtime.playerLikesInvalid'),
  },
  level: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.level),
    getRawValue: (profile) => profile?.level ?? null,
    element: () => (isPlayerAtLevelMax(state.playerProfileData) ? playerCardHonorLevel : playerCardLevel),
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => {
      if (!/^\d+$/.test(value)) {
        return app.translate('runtime.playerLevelInvalid');
      }

      const parsedValue = Number.parseInt(value, 10);
      const maxLevel = getPlayerLevelInputMax();
      if (parsedValue > maxLevel) {
        return app.translate('runtime.playerLevelAboveMax', { max: maxLevel });
      }

      return '';
    },
  },
  honor_level: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.honor_level),
    getRawValue: (profile) => (isPlayerAtLevelMax(profile) ? profile?.honor_level ?? null : null),
    element: () => (isPlayerAtLevelMax(state.playerProfileData) ? playerCardLevel : playerCardHonorLevel),
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => {
      if (!/^\d+$/.test(value)) {
        return app.translate('runtime.playerHonorLevelInvalid');
      }

      const parsedValue = Number.parseInt(value, 10);
      const maxLevel = getConfiguredPlayerHonorLevelMax();
      if (parsedValue > maxLevel) {
        return app.translate('runtime.playerHonorLevelAboveMax', { max: maxLevel });
      }

      return '';
    },
  },
  exp: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.exp ?? 0),
    getRawValue: (profile) => profile?.exp ?? 0,
    element: () => playerCardExp,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => {
      if (!/^\d+$/.test(value)) {
        return app.translate('runtime.playerExpInvalid');
      }

      const parsedValue = Number.parseInt(value, 10);
      const maxExp = getPlayerExpInputMax(state.playerProfileData);
      if (maxExp !== null && parsedValue > maxExp) {
        return app.translate('runtime.playerExpAboveMax', { max: maxExp });
      }

      return '';
    },
  },
  money: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.money ?? 0),
    getRawValue: (profile) => profile?.money ?? 0,
    element: () => playerCardMoney,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => validateInt32Field(value, 'runtime.playerMoneyInvalid'),
  },
  serum: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.serum ?? 0),
    getRawValue: (profile) => profile?.serum ?? 0,
    element: () => playerCardSerum,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => validateInt32Field(value, 'runtime.playerSerumInvalid'),
  },
  black_card: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.black_card ?? 0),
    getRawValue: (profile) => profile?.black_card ?? 0,
    element: () => playerCardBlackCard,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => validateInt32Field(value, 'runtime.playerBlackCardInvalid'),
  },
  rainbow_card: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.rainbow_card ?? 0),
    getRawValue: (profile) => profile?.rainbow_card ?? 0,
    element: () => playerCardRainbowCard,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => validateInt32Field(value, 'runtime.playerRainbowCardInvalid'),
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
  use_background_id: {
    displayValue: (profile) => app.formatPlayerFieldValue(profile?.use_background_id),
    getRawValue: (profile) => profile?.use_background_id ?? null,
    element: () => playerCard,
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

  if (field === 'use_background_id') {
    return state.playerProfileData.use_background_id ?? null;
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
    element.setAttribute('title', config?.editorType === 'picker' ? app.translate('runtime.playerEditPickerTitle', { label: app.getPlayerResourceLabel(field) }) : app.translate('runtime.playerEditInputTitle'));
  } else {
    element.removeAttribute('role');
    element.removeAttribute('title');
  }

  if (field === 'use_background_id' && playerCardBackground instanceof HTMLElement) {
    playerCardBackground.classList.toggle('is-editable', editable);
    if (editable) {
      playerCardBackground.setAttribute('title', app.translate('runtime.playerEditPickerTitle', { label: app.getPlayerResourceLabel(field) }));
    } else {
      playerCardBackground.removeAttribute('title');
    }
  }

  if (field === 'head_frame_id') {
    if (playerCardAvatarRing instanceof HTMLElement) {
      playerCardAvatarRing.classList.toggle('is-editable', editable);
      playerCardAvatarRing.setAttribute('tabindex', editable ? '0' : '-1');
      if (editable) {
        playerCardAvatarRing.setAttribute('role', 'button');
      } else {
        playerCardAvatarRing.removeAttribute('role');
      }
      if (editable) {
        playerCardAvatarRing.setAttribute('title', app.translate('runtime.playerEditPickerTitle', { label: app.getPlayerResourceLabel(field) }));
      } else {
        playerCardAvatarRing.removeAttribute('title');
      }
    }

    if (playerCardAvatarFrameHitbox instanceof HTMLButtonElement) {
      playerCardAvatarFrameHitbox.classList.toggle('is-editable', editable);
      playerCardAvatarFrameHitbox.disabled = !editable;
      playerCardAvatarFrameHitbox.tabIndex = editable ? 0 : -1;
      if (editable) {
        playerCardAvatarFrameHitbox.setAttribute('title', app.translate('runtime.playerEditPickerTitle', { label: app.getPlayerResourceLabel(field) }));
      } else {
        playerCardAvatarFrameHitbox.removeAttribute('title');
      }
    }
  }
};

app.syncPlayerCardLevelTheme = (levelValue) => {
  if (!(playerCard instanceof HTMLElement)) {
    return;
  }

  const parsedLevel = Number.parseInt(String(levelValue ?? ''), 10);
  const normalizedLevel = Number.isFinite(parsedLevel) ? Math.max(0, parsedLevel) : 0;
  const levelCap = getConfiguredPlayerLevelMax();
  const progress = levelCap > 0 ? Math.min(1, normalizedLevel / levelCap) : 0;
  const hue = 192 + (progress * 108);
  const angle = 210 + Math.round(progress * 96);
  const glowAlpha = 0.28 + (progress * 0.34);
  const shadowAlpha = 0.2 + (progress * 0.18);
  const expBorderAlpha = 0.28 + (progress * 0.22);

  playerCard.style.setProperty('--player-level-progress', progress.toFixed(3));
  playerCard.style.setProperty('--player-level-angle', `${angle}deg`);
  playerCard.style.setProperty('--player-level-core-start', `hsla(${Math.round(hue - 22)} 92% 64% / ${0.2 + (progress * 0.16)})`);
  playerCard.style.setProperty('--player-level-core-end', `hsla(${Math.round(hue + 12)} 95% 60% / ${0.26 + (progress * 0.18)})`);
  playerCard.style.setProperty('--player-level-ring-start', `hsla(${Math.round(hue - 28)} 100% 66% / 0.92)`);
  playerCard.style.setProperty('--player-level-ring-mid', `hsla(${Math.round(hue + 4)} 98% 64% / 0.96)`);
  playerCard.style.setProperty('--player-level-ring-end', `hsla(${Math.round(hue + 44)} 100% 72% / ${0.78 + (progress * 0.16)})`);
  playerCard.style.setProperty('--player-level-glow', `hsla(${Math.round(hue - 16)} 100% 62% / ${glowAlpha.toFixed(3)})`);
  playerCard.style.setProperty('--player-level-shadow', `hsla(${Math.round(hue + 10)} 92% 52% / ${shadowAlpha.toFixed(3)})`);
  playerCard.style.setProperty('--player-level-exp-start', `hsla(${Math.round(hue - 26)} 42% 10% / 0.9)`);
  playerCard.style.setProperty('--player-level-exp-end', `hsla(${Math.round(hue + 8)} 56% 18% / ${0.72 + (progress * 0.12)})`);
  playerCard.style.setProperty('--player-level-exp-border', `hsla(${Math.round(hue - 10)} 100% 72% / ${expBorderAlpha.toFixed(3)})`);
};

app.syncPlayerCardExpProgress = (profile) => {
  if (!(playerCard instanceof HTMLElement)) {
    return;
  }

  const progress = getPlayerExpProgress(profile);
  playerCard.style.setProperty('--player-exp-progress', progress.toFixed(3));
};

app.syncPlayerCardHonorLevel = (profile) => {
  const available = isPlayerAtLevelMax(profile);
  if (playerCardHonorBar instanceof HTMLElement) {
    playerCardHonorBar.hidden = !available;
  }
  if (playerCardHonorLevel instanceof HTMLElement) {
    playerCardHonorLevel.textContent = available ? app.formatPlayerFieldValue(profile?.level) : '--';
  }
  if (playerCard instanceof HTMLElement) {
    playerCard.style.setProperty('--player-honor-progress', getPlayerLevelProgress(profile).toFixed(3));
  }
};

app.syncPlayerEditableStates = () => {
  Object.entries(PLAYER_PROFILE_EDITABLE_FIELDS).forEach(([field, config]) => {
    const rawValue = config.getRawValue(state.playerProfileData);
    app.setPlayerEditableState(field, rawValue !== null && rawValue !== undefined);
  });
};

app.restorePlayerProfileFieldDisplay = (field, profile = state.playerProfileData) => {
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  const element = config?.element();
  if (!config || !(element instanceof HTMLElement)) {
    return;
  }

  element.classList.remove('is-editing');

  if (config.editorType === 'picker') {
    return;
  }

  element.textContent = config.displayValue(profile);
};

app.stopPlayerProfileEdit = (field) => {
  if (!state.playerProfileEditState || state.playerProfileEditState.field !== field) {
    return;
  }

  state.playerProfileEditState = null;
  app.restorePlayerProfileFieldDisplay(field);
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

    const existingSelect = element.querySelector('select');
    if (existingSelect instanceof HTMLSelectElement) {
      existingSelect.focus();
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

    select.addEventListener('change', () => {
      void app.submitPlayerProfileEdit(field, select.value);
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
    app.openNoticeModal(validationMessage);
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
    if (app.isMutationRiskCancelled(error)) {
      currentState.pending = false;
      app.stopPlayerProfileEdit(field);
      return;
    }

    currentState.pending = false;
    app.renderPlayerProfile(state.playerProfileData);
    app.openNoticeModal(app.apiErrorMessage(error, 'runtime.playerProfileUpdateFailed'));
  }
};

app.handlePlayerProfileFieldActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.tagName === 'INPUT' || target.tagName === 'SELECT') {
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

app.resetPlayerCardBackground = () => {
  if (!(playerCardBackground instanceof HTMLElement)) {
    return;
  }

  state.playerCardBackgroundSource = '';
  playerCardBackground.style.removeProperty('background-image');
  playerCardBackground.hidden = true;
  state.playerCardBackgroundAspectRatio = null;
  app.syncPlayerCardBackgroundAspect();
};

app.clearPlayerCardInlineSize = () => {
  if (!(playerCard instanceof HTMLElement)) {
    return;
  }

  playerCard.style.removeProperty('width');
  playerCard.style.removeProperty('max-width');
  playerCard.style.removeProperty('min-height');
};

app.queuePlayerCardBackgroundAspectSync = () => {
  if (state.playerCardResizeRafId) {
    window.cancelAnimationFrame(state.playerCardResizeRafId);
  }

  state.playerCardResizeRafId = window.requestAnimationFrame(() => {
    state.playerCardResizeRafId = null;
    app.syncPlayerCardBackgroundAspect();
  });
};

app.resolvePlayerBackgroundAspectRatio = (source) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  if (!normalizedSource) {
    state.playerCardBackgroundAspectRatio = null;
    app.queuePlayerCardBackgroundAspectSync();
    return;
  }

  const cachedAspectRatio = state.playerBackgroundAspectRatioMap[normalizedSource];
  if (Number.isFinite(cachedAspectRatio) && cachedAspectRatio > 0) {
    state.playerCardBackgroundAspectRatio = cachedAspectRatio;
    app.queuePlayerCardBackgroundAspectSync();
    return;
  }

  const image = new Image();
  image.addEventListener('load', () => {
    const naturalWidth = Number(image.naturalWidth);
    const naturalHeight = Number(image.naturalHeight);
    if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
      return;
    }

    const aspectRatio = naturalWidth / naturalHeight;
    state.playerBackgroundAspectRatioMap[normalizedSource] = aspectRatio;
    if (typeof playerCardBackground?.style?.backgroundImage === 'string' && playerCardBackground.style.backgroundImage.includes(normalizedSource)) {
      state.playerCardBackgroundAspectRatio = aspectRatio;
      app.queuePlayerCardBackgroundAspectSync();
    }
  });
  image.src = normalizedSource;
};

app.syncPlayerCardBackgroundAspect = () => {
  if (!(playerCard instanceof HTMLElement) || !(databasePlayerProfileShell instanceof HTMLElement) || playerCard.hidden || databasePlayerProfileShell.hidden) {
    return;
  }

  if (window.innerWidth <= PLAYER_CARD_MOBILE_BREAKPOINT) {
    app.clearPlayerCardInlineSize();
    return;
  }

  const rawAspectRatio = state.playerCardBackgroundAspectRatio;
  if (!Number.isFinite(rawAspectRatio) || rawAspectRatio <= 0) {
    app.clearPlayerCardInlineSize();
    return;
  }

  const targetAspectRatio = Math.min(PLAYER_CARD_MAX_ASPECT_RATIO, Math.max(PLAYER_CARD_MIN_ASPECT_RATIO, rawAspectRatio));
  app.clearPlayerCardInlineSize();

  const shellRect = databasePlayerProfileShell.getBoundingClientRect();
  const cardRect = playerCard.getBoundingClientRect();
  const maxWidth = Math.floor(shellRect.width);
  const baseHeight = Math.ceil(cardRect.height);
  if (!Number.isFinite(maxWidth) || maxWidth <= 0 || !Number.isFinite(baseHeight) || baseHeight <= 0) {
    return;
  }

  const idealWidth = Math.ceil(baseHeight * targetAspectRatio);
  const appliedWidth = Math.max(Math.ceil(cardRect.width), Math.min(maxWidth, idealWidth));
  const appliedHeight = Math.max(baseHeight, Math.ceil(appliedWidth / targetAspectRatio));

  playerCard.style.width = '100%';
  playerCard.style.maxWidth = `${appliedWidth}px`;
  playerCard.style.minHeight = `${appliedHeight}px`;
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

app.setPlayerCardBackground = (source) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  if (!(playerCardBackground instanceof HTMLElement)) {
    return;
  }

  if (normalizedSource === state.playerCardBackgroundSource) {
    return;
  }

  if (!normalizedSource) {
    state.playerCardBackgroundSource = '';
    app.resetPlayerCardBackground();
    return;
  }

  state.playerCardBackgroundSource = normalizedSource;
  playerCardBackground.hidden = false;
  playerCardBackground.style.backgroundImage = `linear-gradient(145deg, rgba(12, 18, 38, 0.18), rgba(12, 18, 38, 0.58)), url("${normalizedSource}")`;
  app.resolvePlayerBackgroundAspectRatio(normalizedSource);
  app.queuePlayerCardBackgroundAspectSync();
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
  if (playerCardGender instanceof HTMLElement) {
    playerCardGender.textContent = '--';
  }
  if (playerCardLevel instanceof HTMLElement) {
    playerCardLevel.textContent = '--';
    playerCardLevel.dataset.playerEditField = 'level';
  }
  if (playerCardLevelLabel instanceof HTMLElement) {
    playerCardLevelLabel.textContent = app.translate('dashboard.playerLevel');
  }
  if (playerCardHonorLevel instanceof HTMLElement) {
    playerCardHonorLevel.textContent = '--';
  }
  if (playerCardLikes instanceof HTMLElement) {
    playerCardLikes.textContent = '--';
  }
  if (playerCardExp instanceof HTMLElement) {
    playerCardExp.textContent = '-- / --';
  }
  if (playerCardMoney instanceof HTMLElement) {
    playerCardMoney.textContent = '0';
  }
  if (playerCardSerum instanceof HTMLElement) {
    playerCardSerum.textContent = '0';
  }
  if (playerCardBlackCard instanceof HTMLElement) {
    playerCardBlackCard.textContent = '0';
  }
  if (playerCardRainbowCard instanceof HTMLElement) {
    playerCardRainbowCard.textContent = '0';
  }

  app.resetPlayerCardAvatarFrame();
  app.resetPlayerCardAvatar();
  app.resetPlayerCardBackground();
  app.syncPlayerCardLevelTheme(0);
  app.syncPlayerCardExpProgress(null);
  app.syncPlayerCardHonorLevel(null);
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

  if (playerCardName instanceof HTMLElement) {
    playerCardName.textContent = nameLabel;
  }
  if (playerCardGender instanceof HTMLElement) {
    playerCardGender.textContent = genderLabel;
  }
  if (playerCardLevel instanceof HTMLElement) {
    playerCardLevel.textContent = isPlayerAtLevelMax(profile) ? app.formatPlayerFieldValue(profile?.honor_level) : levelLabel;
    playerCardLevel.dataset.playerEditField = isPlayerAtLevelMax(profile) ? 'honor_level' : 'level';
  }
  if (playerCardLevelLabel instanceof HTMLElement) {
    playerCardLevelLabel.textContent = app.translate(isPlayerAtLevelMax(profile) ? 'dashboard.playerHonorLevel' : 'dashboard.playerLevel');
  }
  if (playerCardHonorLevel instanceof HTMLElement) {
    playerCardHonorLevel.dataset.playerEditField = 'level';
  }
  if (playerCardLikes instanceof HTMLElement) {
    playerCardLikes.textContent = likesLabel;
  }
  if (playerCardExp instanceof HTMLElement) {
    playerCardExp.textContent = getPlayerExpDisplayValue(profile);
  }
  if (playerCardMoney instanceof HTMLElement) {
    playerCardMoney.textContent = app.formatPlayerFieldValue(profile?.money ?? 0);
  }
  if (playerCardSerum instanceof HTMLElement) {
    playerCardSerum.textContent = app.formatPlayerFieldValue(profile?.serum ?? 0);
  }
  if (playerCardBlackCard instanceof HTMLElement) {
    playerCardBlackCard.textContent = app.formatPlayerFieldValue(profile?.black_card ?? 0);
  }
  if (playerCardRainbowCard instanceof HTMLElement) {
    playerCardRainbowCard.textContent = app.formatPlayerFieldValue(profile?.rainbow_card ?? 0);
  }

  app.setPlayerCardAvatar(app.getPlayerResourceUrlByField('head_portrait_id', profile?.head_portrait_id ?? null));
  app.setPlayerCardAvatarFrame(app.getPlayerResourceUrlByField('head_frame_id', profile?.head_frame_id ?? null));
  app.setPlayerCardBackground(app.getPlayerResourceUrlByField('use_background_id', profile?.use_background_id ?? null));
  app.syncPlayerCardLevelTheme(profile?.level);
  app.syncPlayerCardExpProgress(profile);
  app.syncPlayerCardHonorLevel(profile);
  app.syncPlayerEditableStates();
  app.showPlayerProfile();
};

app.handlePlayerCardBackgroundActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const ignoreSelector = [
    '.database-player-card-avatar-shell',
    '.database-player-card-copy .database-player-card-resources',
    '.database-player-card-level-orb',
    '.database-player-card-exp-bar',
    '[data-player-edit-field]',
    'input',
    'select',
    'button',
  ].join(', ');

  if (target !== playerCardBackground && target.closest(ignoreSelector)) {
    return;
  }

  event.stopPropagation();
  app.openPlayerPortraitPicker('use_background_id');
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

  const hasRenderedProfile = Boolean(state.playerProfileData);
  state.playerProfileLoading = true;
  app.updatePlayerProfileAccess();
  if (!hasRenderedProfile) {
    app.setPlayerProfileState(app.translate('runtime.playerProfileLoading'), 'is-loading');
  }

  try {
    const payload = await app.apiFetch('/api/database-players/selected');

    app.renderPlayerProfile(payload);
  } catch (error) {
    if (!hasRenderedProfile) {
      state.playerProfileData = null;
      app.setPlayerProfileState(app.apiErrorMessage(error, 'runtime.playerProfileLoadFailed'), 'is-error');
    }
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

  if (playerCard instanceof HTMLElement) {
    playerCard.addEventListener('click', app.handlePlayerCardBackgroundActivate);
  }

  if (playerCardBackground instanceof HTMLElement) {
    playerCardBackground.addEventListener('click', app.handlePlayerCardBackgroundActivate);
  }

  if (playerCardAvatarFrameHitbox instanceof HTMLButtonElement) {
    playerCardAvatarFrameHitbox.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      app.openPlayerPortraitPicker('head_frame_id');
    });
  }

  const playerCardAvatarStage = playerCardAvatarShell?.querySelector('.database-player-card-avatar-stage');

  if (playerCardAvatarStage instanceof HTMLElement) {
    playerCardAvatarStage.addEventListener('click', (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (event.target.closest('.database-player-card-appearance-actions')) {
        return;
      }

      if (
        event.target.closest('.database-player-card-avatar-image')
        || event.target.closest('.database-player-card-avatar-fallback')
      ) {
        event.stopPropagation();
        app.openPlayerPortraitPicker('head_portrait_id');
        return;
      }

      if (event.target.closest('.database-player-card-avatar-ring')) {
        event.stopPropagation();
        app.openPlayerPortraitPicker('head_frame_id');
      }
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

  window.addEventListener('resize', app.queuePlayerCardBackgroundAspectSync);
};
