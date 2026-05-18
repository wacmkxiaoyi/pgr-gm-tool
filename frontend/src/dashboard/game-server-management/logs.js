import { app } from '../shared.js';

const { dom, state } = app;
const { logButton, logModal, logModalContent, logModalStatus, logModalPath, logModalCloseTargets, logModalClearButton } = dom;
const logLinePattern = /^\[(.*?)\]\[(.*?)\]\[(.*?)\]:\s?(.*)$/;

app.setLogConnectionState = (label, stateClass = '') => {
  if (!(logModalStatus instanceof HTMLElement)) {
    return;
  }

  logModalStatus.textContent = label;
  logModalStatus.className = 'server-log-status';
  if (stateClass) {
    logModalStatus.classList.add(stateClass);
  }
};

app.isLogModalOpen = () => logModal instanceof HTMLElement && !logModal.hidden;

app.isLogPinnedToBottom = () => {
  if (!(logModalContent instanceof HTMLElement)) {
    return true;
  }

  const threshold = 24;
  return logModalContent.scrollTop + logModalContent.clientHeight >= logModalContent.scrollHeight - threshold;
};

app.scrollLogToBottom = () => {
  if (!(logModalContent instanceof HTMLElement)) {
    return;
  }

  logModalContent.scrollTop = logModalContent.scrollHeight;
};

app.classifyLogSeverity = (level) => {
  const normalizedLevel = typeof level === 'string' ? level.toUpperCase() : '';

  if (normalizedLevel === 'ERROR' || normalizedLevel === 'FATAL') {
    return 'severity-error';
  }

  if (normalizedLevel === 'WARN' || normalizedLevel === 'WARNING') {
    return 'severity-warn';
  }

  if (normalizedLevel === 'INFO') {
    return 'severity-info';
  }

  if (normalizedLevel === 'DEBUG' || normalizedLevel === 'TRACE') {
    return 'severity-debug';
  }

  return 'severity-generic';
};

app.classifyLogSource = (source) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';

  if (normalizedSource === 'Server') {
    return 'source-server';
  }

  if (normalizedSource === 'SDKServer') {
    return 'source-sdkserver';
  }

  return 'source-generic';
};

app.createLogPart = (className, text) => {
  const part = document.createElement('span');
  part.className = className;
  part.textContent = text;
  return part;
};

app.renderLogLine = (line) => {
  const row = document.createElement('span');
  row.className = 'server-log-line severity-generic source-generic';

  if (typeof line !== 'string' || line.length === 0) {
    row.classList.add('is-blank');
    row.textContent = ' ';
    return row;
  }

  const match = line.match(logLinePattern);
  if (!match) {
    row.classList.add('is-plain');
    row.appendChild(app.createLogPart('server-log-message', line));
    return row;
  }

  const [, timestamp, level, source, message] = match;
  row.className = `server-log-line ${app.classifyLogSeverity(level)} ${app.classifyLogSource(source)}`;
  row.appendChild(app.createLogPart('server-log-time', `[${timestamp}]`));
  row.appendChild(app.createLogPart('server-log-level', `[${level}]`));
  row.appendChild(app.createLogPart('server-log-source', `[${source}]`));
  row.appendChild(app.createLogPart('server-log-separator', ': '));
  row.appendChild(app.createLogPart('server-log-message', message));
  return row;
};

app.renderLogContent = (text) => {
  if (!(logModalContent instanceof HTMLElement)) {
    return;
  }

  const content = typeof text === 'string' && text ? text : app.translate('runtime.serverLogEmpty');
  state.logText = content;

  const fragment = document.createDocumentFragment();
  const lines = content.split(/\r?\n/);

  lines.forEach((line) => {
    fragment.appendChild(app.renderLogLine(line));
  });

  logModalContent.replaceChildren(fragment);
};

app.replaceLogContent = (text) => {
  if (!(logModalContent instanceof HTMLElement)) {
    return;
  }

  app.renderLogContent(text);
  window.requestAnimationFrame(app.scrollLogToBottom);
};

app.appendLogContent = (text) => {
  if (!(logModalContent instanceof HTMLElement) || typeof text !== 'string' || text.length === 0) {
    return;
  }

  const shouldStick = app.isLogPinnedToBottom();
  const currentContent = typeof state.logText === 'string' ? state.logText : '';
  const initialPlaceholder = app.translate('runtime.serverLogInitialContent');
  const emptyPlaceholder = app.translate('runtime.serverLogEmpty');
  const hadPlaceholder = currentContent === initialPlaceholder || currentContent === emptyPlaceholder || !currentContent;
  app.renderLogContent(hadPlaceholder ? text : `${currentContent}${text}`);

  if (shouldStick) {
    window.requestAnimationFrame(app.scrollLogToBottom);
  }
};

app.closeLogStream = () => {
  if (state.logEventSource instanceof EventSource) {
    state.logEventSource.close();
  }

  state.logEventSource = null;
};

app.closeLogModal = () => {
  app.closeLogStream();
  state.logStreamEnded = false;
  state.logText = '';

  if (!app.isLogModalOpen()) {
    return;
  }

  logModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastLogTrigger instanceof HTMLElement) {
    state.lastLogTrigger.focus();
  }
};

app.openLogModal = () => {
  if (!(logModal instanceof HTMLElement)) {
    return;
  }

  state.lastLogTrigger = document.activeElement;
  logModal.hidden = false;
  app.setBodyModalOpen(true);
  app.setLogConnectionState(app.translate('runtime.serverLogConnecting'), 'is-pending');

  const closeButton = logModal.querySelector('[data-server-log-modal-close].shared-modal-button');
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
};

app.parseLogEventPayload = (event) => {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
    return null;
  }

  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
};

app.resolveLogEventMessage = (payload, fallbackKey) => {
  if (payload?.code) {
    return app.apiErrorMessage(app.createApiError(payload), fallbackKey);
  }

  if (payload?.message) {
    return app.resolveUiTextToken(payload.message);
  }

  return app.translate(fallbackKey);
};

app.startLogStream = () => {
  if (!(logButton instanceof HTMLButtonElement) || logButton.disabled) {
    return;
  }

  app.closeLogStream();
  app.openLogModal();
  app.replaceLogContent(app.translate('runtime.serverLogLoading'));
  state.logStreamEnded = false;

  const currentControls = app.getControlState(state.serverControlState);
  if (logModalPath instanceof HTMLElement) {
      const runtimeLogPath = typeof currentControls?.runtime_log_path === 'string' ? currentControls.runtime_log_path : app.translate('common.notAvailable');
      logModalPath.textContent = app.translate('runtime.serverLogPath', { path: runtimeLogPath });
  }

  const eventSource = new EventSource('/api/server-control/logs', { withCredentials: true });
  state.logEventSource = eventSource;

  eventSource.addEventListener('open', () => {
    app.setLogConnectionState(app.translate('runtime.serverLogLive'), 'is-live');
  });

  eventSource.addEventListener('log-snapshot', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.replaceLogContent(payload?.text ?? app.translate('runtime.serverLogEmpty'));
  });

  eventSource.addEventListener('log-append', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.appendLogContent(payload?.text ?? '');
  });

  eventSource.addEventListener('log-reset', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.replaceLogContent(payload?.text ?? app.translate('runtime.serverLogRefreshed'));
  });

  eventSource.addEventListener('log-error', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.appendLogContent(app.translate('runtime.serverLogStreamError', { message: app.resolveLogEventMessage(payload, 'runtime.serverLogFileReadFailed') }));
    app.setLogConnectionState(app.translate('runtime.serverLogErrorState'), 'is-error');
  });

  eventSource.addEventListener('log-end', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.appendLogContent(app.translate('runtime.serverLogStreamEnded', { message: app.resolveLogEventMessage(payload, 'runtime.serverLogStreamEndedApi') }));
    state.logStreamEnded = true;
    app.setLogConnectionState(app.translate('runtime.serverLogEndedState'), 'is-ended');
    app.closeLogStream();
  });

  eventSource.onerror = () => {
    if (state.logStreamEnded) {
      return;
    }

    app.setLogConnectionState(app.translate('runtime.serverLogReconnecting'), 'is-pending');
  };
};

export const initStatusLogFeature = () => {
  logModalCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeLogModal);
  });

  if (logModalClearButton instanceof HTMLButtonElement) {
    logModalClearButton.addEventListener('click', () => {
      app.replaceLogContent(app.translate('runtime.serverLogCleared'));
    });
  }
};
