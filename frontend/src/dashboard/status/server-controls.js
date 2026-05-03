import { app } from '../shared.js';

const { dom, state } = app;
const { startButton, stopButton, logButton, configButton } = dom;

app.updateStatusActionButtons = (payload) => {
  if (!(startButton instanceof HTMLButtonElement) || !(stopButton instanceof HTMLButtonElement) || !(logButton instanceof HTMLButtonElement) || !(configButton instanceof HTMLButtonElement)) {
    return;
  }

  const controls = app.getControlState(payload?.controls);
  if (controls) {
    startButton.textContent = typeof controls.start_label === 'string' ? controls.start_label : '启动';
    startButton.disabled = Boolean(controls.start_disabled);
    stopButton.disabled = Boolean(controls.stop_disabled);
    logButton.disabled = Boolean(controls.log_disabled);
    configButton.disabled = Boolean(controls.start_disabled);
    state.serverControlState = controls;

    if (logButton.disabled && app.isLogModalOpen()) {
      app.appendLogContent('\n[日志流结束] 服务器当前不可查看日志。\n');
      app.setLogConnectionState('已关闭', 'is-ended');
      app.closeLogStream();
    }

    app.updateConfigEditorState();
    return;
  }

  const allHealthy = app.isSnapshotHealthy(payload);
  startButton.textContent = '启动';
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
  startButton.textContent = '启动中...';
  stopButton.disabled = true;
  if (logButton instanceof HTMLButtonElement) {
    logButton.disabled = true;
  }
  if (configButton instanceof HTMLButtonElement) {
    configButton.disabled = true;
  }

  try {
    const response = await fetch('/api/server-control/start', {
      method: 'POST',
      credentials: 'include',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '服务器启动请求失败。');
    }

    const controls = app.getControlState(payload?.controls);
    app.updateStatusActionButtons({ controls });

    if (typeof controls?.startup_error === 'string' && controls.startup_error) {
      state.serverControlFailureMessage = controls.startup_error;
      app.openControlModal(controls.startup_error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器启动请求失败。';
    state.serverControlFailureMessage = message;
    app.openControlModal(message);
    startButton.textContent = '启动';
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
    const response = await fetch('/api/server-control/stop', {
      method: 'POST',
      credentials: 'include',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '服务器停止请求失败。');
    }

    const controls = app.getControlState(payload?.controls);
    app.updateStatusActionButtons({ controls });
    await app.loadStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器停止请求失败。';
    app.openControlModal(message);
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
