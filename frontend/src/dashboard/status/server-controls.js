import { app } from '../shared.js';

const { dom, state } = app;
const { startButton, stopButton, logButton, configButton } = dom;

app.updateStatusActionButtons = (payload) => {
  if (!(startButton instanceof HTMLButtonElement) || !(stopButton instanceof HTMLButtonElement) || !(logButton instanceof HTMLButtonElement) || !(configButton instanceof HTMLButtonElement)) {
    return;
  }

  const controls = app.getControlState(payload?.controls);
  if (controls) {
    startButton.textContent = typeof controls.start_label_key === 'string' ? app.translate(controls.start_label_key) : app.translate('runtime.serverStart');
    startButton.disabled = Boolean(controls.start_disabled);
    stopButton.disabled = Boolean(controls.stop_disabled);
    logButton.disabled = Boolean(controls.log_disabled);
    configButton.disabled = Boolean(controls.start_disabled);
    state.serverControlState = controls;

    if (logButton.disabled && app.isLogModalOpen()) {
      app.appendLogContent(app.translate('runtime.serverLogClosedMessage'));
      app.setLogConnectionState(app.translate('runtime.serverLogClosedState'), 'is-ended');
      app.closeLogStream();
    }

    app.updateConfigEditorState();
    return;
  }

  const allHealthy = app.isSnapshotHealthy(payload);
  startButton.textContent = app.translate('runtime.serverStart');
  startButton.disabled = allHealthy;
  stopButton.disabled = !allHealthy;
  logButton.disabled = !allHealthy;
  configButton.disabled = allHealthy;
  state.serverControlState = null;
  app.updateConfigEditorState();
};

app.startServer = async () => {
  if (!(startButton instanceof HTMLButtonElement) || !state.serverControlsVisible) {
    return;
  }

  startButton.disabled = true;
  startButton.textContent = app.translate('runtime.serverStarting');
  stopButton.disabled = true;
  if (logButton instanceof HTMLButtonElement) {
    logButton.disabled = true;
  }
  if (configButton instanceof HTMLButtonElement) {
    configButton.disabled = true;
  }

  try {
    const payload = await app.apiFetch('/api/server-control/start', { method: 'POST' });

    const controls = app.getControlState(payload?.controls);
    app.updateStatusActionButtons({ controls });

    if (typeof controls?.startup_error === 'string' && controls.startup_error) {
      state.serverControlFailureMessage = controls.startup_error;
      app.openNoticeModal(app.resolveUiTextToken(controls.startup_error));
    }
  } catch (error) {
    const message = app.apiErrorMessage(error, 'runtime.serverStartFailed');
    state.serverControlFailureMessage = message;
    app.openNoticeModal(message);
    startButton.textContent = app.translate('runtime.serverStart');
    startButton.disabled = false;
    stopButton.disabled = true;
    if (logButton instanceof HTMLButtonElement) {
      logButton.disabled = true;
    }
    if (configButton instanceof HTMLButtonElement) {
      configButton.disabled = false;
    }
  }
};

app.stopServer = async () => {
  if (!(stopButton instanceof HTMLButtonElement) || !state.serverControlsVisible) {
    return;
  }

  stopButton.disabled = true;
  if (startButton instanceof HTMLButtonElement) {
    startButton.disabled = true;
  }
  if (logButton instanceof HTMLButtonElement) {
    logButton.disabled = true;
  }
  if (configButton instanceof HTMLButtonElement) {
    configButton.disabled = true;
  }

  try {
    const payload = await app.apiFetch('/api/server-control/stop', { method: 'POST' });

    const controls = app.getControlState(payload?.controls);
    app.updateStatusActionButtons({ controls });
    await app.loadStatus();
  } catch (error) {
    const message = app.apiErrorMessage(error, 'runtime.serverStopFailed');
    app.openNoticeModal(message);
    await app.loadStatus();
  }
};

export const initServerControlsFeature = () => {
  if (startButton instanceof HTMLButtonElement) {
    startButton.addEventListener('click', () => {
      if (app.getControlState(state.serverControlState)?.startup_state === 'starting') {
        return;
      }

      void app.startServer();
    });
  }

  if (stopButton instanceof HTMLButtonElement) {
    stopButton.addEventListener('click', () => {
      void app.stopServer();
    });
  }

  if (logButton instanceof HTMLButtonElement) {
    logButton.addEventListener('click', app.startLogStream);
  }

  if (configButton instanceof HTMLButtonElement) {
    configButton.addEventListener('click', () => {
      void app.openConfigEditor();
    });
  }
};
