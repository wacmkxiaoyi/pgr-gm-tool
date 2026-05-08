import { app } from '../shared.js';

const { dom, state, constants } = app;
const {
  configButton,
  configModal,
  configModalStatus,
  configModalPath,
  configEditorInput,
  configEditorHighlight,
  configEditorGutter,
  configFeedback,
  configModalCloseTargets,
  configReloadButton,
  configSaveButton,
} = dom;

app.escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

app.renderConfigEditorHighlight = (text) => {
  if (!(configEditorHighlight instanceof HTMLElement)) {
    return;
  }

  const source = typeof text === 'string' ? text : '';
  const escaped = app.escapeHtml(source);
  const highlighted = escaped.replace(constants.jsonTokenRegex, (token, stringToken, keySuffix) => {
    if (typeof stringToken === 'string' && stringToken.length > 0) {
      const suffix = typeof keySuffix === 'string' ? keySuffix : '';
      return suffix ? `<span class="token-key">${stringToken}</span><span class="token-punctuation">${suffix}</span>` : `<span class="token-string">${stringToken}</span>`;
    }

    if (token === '{' || token === '}' || token === '[' || token === ']' || token === ':' || token === ',') {
      return `<span class="token-punctuation">${token}</span>`;
    }

    if (token === 'true' || token === 'false') {
      return `<span class="token-boolean">${token}</span>`;
    }

    if (token === 'null') {
      return `<span class="token-null">${token}</span>`;
    }

    if (/^-?\d/.test(token)) {
      return `<span class="token-number">${token}</span>`;
    }

    return token;
  });

  configEditorHighlight.innerHTML = `${highlighted || ' '}\n`;
};

app.renderConfigEditorGutter = (text) => {
  if (!(configEditorGutter instanceof HTMLElement)) {
    return;
  }

  const lineCount = Math.max(1, String(text ?? '').split('\n').length);
  configEditorGutter.innerHTML = Array.from({ length: lineCount }, (_, index) => `<span>${index + 1}</span>`).join('');
};

app.syncConfigEditorScroll = () => {
  if (!(configEditorInput instanceof HTMLTextAreaElement)) {
    return;
  }

  const top = configEditorInput.scrollTop;
  const left = configEditorInput.scrollLeft;

  if (configEditorHighlight instanceof HTMLElement) {
    configEditorHighlight.scrollTop = top;
    configEditorHighlight.scrollLeft = left;
  }

  if (configEditorGutter instanceof HTMLElement) {
    configEditorGutter.scrollTop = top;
  }
};

app.setConfigStatus = (label, tone = '') => {
  if (!(configModalStatus instanceof HTMLElement)) {
    return;
  }

  configModalStatus.textContent = label;
  configModalStatus.className = 'server-config-status';
  if (tone) {
    configModalStatus.classList.add(tone);
  }
};

app.setConfigFeedback = (message, tone = '') => {
  if (!(configFeedback instanceof HTMLElement)) {
    return;
  }

  configFeedback.textContent = message;
  configFeedback.className = 'server-config-feedback';
  if (tone) {
    configFeedback.classList.add(tone);
  }
};

app.getConfigValidation = (text) => {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          valid: false,
          message: app.translate('dashboard.configJsonRootInvalid'),
        };
      }

      return {
        valid: true,
        message: app.translate('dashboard.configJsonValid'),
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          valid: false,
          message: error.message || app.translate('dashboard.configJsonInvalid'),
        };
      }

      return {
        valid: false,
        message: app.translate('dashboard.configJsonInvalid'),
      };
    }
  };

app.updateConfigEditorState = () => {
  const text = state.configEditorValue;
  app.renderConfigEditorHighlight(text);
  app.renderConfigEditorGutter(text);
  app.syncConfigEditorScroll();

  const canEdit = configButton instanceof HTMLButtonElement ? !configButton.disabled : false;
  if (configEditorInput instanceof HTMLTextAreaElement) {
    configEditorInput.readOnly = state.configIsLoading || state.configIsSaving || !state.configLoadedOnce || !canEdit;
  }

  if (configReloadButton instanceof HTMLButtonElement) {
    configReloadButton.disabled = state.configIsLoading || state.configIsSaving;
  }

  if (!(configSaveButton instanceof HTMLButtonElement)) {
    return;
  }

  if (state.configIsLoading) {
    configSaveButton.disabled = true;
    app.setConfigStatus(app.translate('dashboard.configStatusLoading'), 'is-pending');
    app.setConfigFeedback(app.translate('dashboard.configFeedbackLoading'));
    return;
  }

  if (state.configIsSaving) {
    configSaveButton.disabled = true;
    app.setConfigStatus(app.translate('dashboard.configStatusSaving'), 'is-pending');
    app.setConfigFeedback(app.translate('dashboard.configFeedbackSaving'));
    return;
  }

  const validation = app.getConfigValidation(text);
  configSaveButton.disabled = !canEdit || !validation.valid || text === state.configLastSavedValue;

  if (!state.configLoadedOnce) {
    app.setConfigStatus(app.translate('dashboard.configStatusIdle'));
    app.setConfigFeedback(app.translate(constants.CONFIG_EDITOR_EMPTY_HINT));
    return;
  }

  if (!canEdit) {
    app.setConfigStatus(app.translate('dashboard.configStatusReadonly'), 'is-warning');
    app.setConfigFeedback(app.translate('dashboard.configFeedbackReadonly'), 'is-warning');
    return;
  }

  if (validation.valid) {
    const dirty = text !== state.configLastSavedValue;
    app.setConfigStatus(dirty ? app.translate('dashboard.configStatusDirty') : app.translate('dashboard.configStatusSynced'), dirty ? 'is-pending' : 'is-valid');
    app.setConfigFeedback(dirty ? app.translate('dashboard.configFeedbackDirty') : validation.message, dirty ? 'is-pending' : 'is-valid');
    return;
  }

  app.setConfigStatus(app.translate('dashboard.configStatusSyntaxError'), 'is-error');
  app.setConfigFeedback(validation.message, 'is-error');
};

app.setConfigEditorValue = (text) => {
  state.configEditorValue = typeof text === 'string' ? text : '';
  if (configEditorInput instanceof HTMLTextAreaElement) {
    configEditorInput.value = state.configEditorValue;
  }
  app.updateConfigEditorState();
};

app.isConfigModalOpen = () => configModal instanceof HTMLElement && !configModal.hidden;

app.closeConfigModal = () => {
  if (!app.isConfigModalOpen()) {
    return;
  }

  configModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastConfigFocusedControl instanceof HTMLElement) {
    state.lastConfigFocusedControl.focus();
  }
};

app.openConfigModal = () => {
  if (!(configModal instanceof HTMLElement)) {
    return;
  }

  state.lastConfigFocusedControl = document.activeElement;
  configModal.hidden = false;
  app.setBodyModalOpen(true);

  if (configEditorInput instanceof HTMLTextAreaElement) {
    configEditorInput.focus();
  }
};

app.loadServerConfig = async () => {
  if (state.configIsLoading) {
    return;
  }

  state.configIsLoading = true;
  app.updateConfigEditorState();

  try {
    const payload = await app.apiFetch('/api/server-control/config');

    if (configModalPath instanceof HTMLElement) {
      configModalPath.textContent = app.translate('dashboard.configPath', { path: payload?.path ?? app.translate('common.notAvailable') });
    }

    state.configLoadedOnce = true;
    state.configLastSavedValue = typeof payload?.text === 'string' ? payload.text : '';
    app.setConfigEditorValue(state.configLastSavedValue);
    app.setConfigStatus(app.translate('dashboard.configStatusLoaded'), 'is-valid');
    app.setConfigFeedback(app.translate('dashboard.configFeedbackLoaded'), 'is-valid');
  } catch (error) {
    const message = app.apiErrorMessage(error, 'dashboard.configReadFailed');
    if (configModalPath instanceof HTMLElement) {
      configModalPath.textContent = app.translate('dashboard.configPath', { path: app.translate('common.notAvailable') });
    }
    state.configLoadedOnce = false;
    state.configLastSavedValue = '';
    app.setConfigEditorValue('');
    app.setConfigStatus(app.translate('dashboard.configStatusLoadFailed'), 'is-error');
    app.setConfigFeedback(message, 'is-error');
  } finally {
    state.configIsLoading = false;
    app.updateConfigEditorState();
  }
};

app.saveServerConfig = async () => {
  if (!(configSaveButton instanceof HTMLButtonElement) || configSaveButton.disabled || state.configIsSaving) {
    return;
  }

  const validation = app.getConfigValidation(state.configEditorValue);
  if (!validation.valid) {
    app.setConfigStatus(app.translate('dashboard.configStatusSyntaxError'), 'is-error');
    app.setConfigFeedback(validation.message, 'is-error');
    return;
  }

  state.configIsSaving = true;
  app.updateConfigEditorState();

  try {
    const payload = await app.apiFetch('/api/server-control/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: state.configEditorValue }),
    });

    state.configLoadedOnce = true;
    state.configLastSavedValue = typeof payload?.text === 'string' ? payload.text : state.configEditorValue;
    if (configModalPath instanceof HTMLElement) {
      configModalPath.textContent = app.translate('dashboard.configPath', { path: payload?.path ?? app.translate('common.notAvailable') });
    }
    app.setConfigEditorValue(state.configLastSavedValue);
    app.setConfigStatus(app.translate('dashboard.configStatusSaved'), 'is-valid');
    app.setConfigFeedback(app.translate('dashboard.configFeedbackSaved'), 'is-valid');
    await app.loadStatus();
  } catch (error) {
    const message = app.apiErrorMessage(error, 'dashboard.configSaveFailed');
    app.setConfigStatus(app.translate('dashboard.configStatusSaveFailed'), 'is-error');
    app.setConfigFeedback(message, 'is-error');
    await app.loadStatus();
  } finally {
    state.configIsSaving = false;
    app.updateConfigEditorState();
  }
};

app.openConfigEditor = async () => {
  if (!(configButton instanceof HTMLButtonElement) || configButton.disabled) {
    return;
  }

  if (configModalPath instanceof HTMLElement) {
    configModalPath.textContent = app.translate('dashboard.configPath', { path: app.translate('common.notAvailable') });
  }
  app.openConfigModal();
  await app.loadServerConfig();
};

export const initStatusConfigFeature = () => {
  configModalCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeConfigModal);
  });

  if (configReloadButton instanceof HTMLButtonElement) {
    configReloadButton.addEventListener('click', () => {
      void app.loadServerConfig();
    });
  }

  if (configSaveButton instanceof HTMLButtonElement) {
    configSaveButton.addEventListener('click', () => {
      void app.saveServerConfig();
    });
  }

  if (configEditorInput instanceof HTMLTextAreaElement) {
    configEditorInput.addEventListener('input', (event) => {
      const target = event.currentTarget;
      state.configEditorValue = target instanceof HTMLTextAreaElement ? target.value : '';
      app.updateConfigEditorState();
    });

    configEditorInput.addEventListener('scroll', app.syncConfigEditorScroll);
  }
};
