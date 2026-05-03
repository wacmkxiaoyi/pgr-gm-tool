import { app } from '../shared.js';

const { dom, state } = app;
const { logButton, logModal, logModalContent, logModalStatus, logModalPath, logModalCloseTargets, logModalClearButton } = dom;

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

app.replaceLogContent = (text) => {
  if (!(logModalContent instanceof HTMLElement)) {
    return;
  }

  logModalContent.textContent = typeof text === 'string' && text ? text : '日志文件当前没有内容。';
  window.requestAnimationFrame(app.scrollLogToBottom);
};

app.appendLogContent = (text) => {
  if (!(logModalContent instanceof HTMLElement) || typeof text !== 'string' || text.length === 0) {
    return;
  }

  const shouldStick = app.isLogPinnedToBottom();
  const hadPlaceholder = logModalContent.textContent === '点击“查看日志”后显示最近日志。' || logModalContent.textContent === '日志文件当前没有内容。';
  logModalContent.textContent = hadPlaceholder ? text : `${logModalContent.textContent}${text}`;

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

  if (!app.isLogModalOpen()) {
    return;
  }

  logModal.hidden = true;
  app.setBodyModalOpen(false);

  if (state.lastLogFocusedControl instanceof HTMLElement) {
    state.lastLogFocusedControl.focus();
  }
};

app.openLogModal = () => {
  if (!(logModal instanceof HTMLElement)) {
    return;
  }

  state.lastLogFocusedControl = document.activeElement;
  logModal.hidden = false;
  app.setBodyModalOpen(true);
  app.setLogConnectionState('连接中...', 'is-pending');

  const closeButton = logModal.querySelector('[data-server-log-close].login-modal-button');
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

app.startLogStream = () => {
  if (!(logButton instanceof HTMLButtonElement) || logButton.disabled) {
    return;
  }

  app.closeLogStream();
  app.openLogModal();
  app.replaceLogContent('正在加载最近日志...');
  state.logStreamEnded = false;

  const currentControls = app.getControlState(state.serverControlState);
  if (logModalPath instanceof HTMLElement) {
    const runtimeLogPath = typeof currentControls?.runtime_log_path === 'string' ? currentControls.runtime_log_path : '--';
    logModalPath.textContent = `运行日志: ${runtimeLogPath}`;
  }

  const eventSource = new EventSource('/api/server-control/logs', { withCredentials: true });
  state.logEventSource = eventSource;

  eventSource.addEventListener('open', () => {
    app.setLogConnectionState('实时跟随中', 'is-live');
  });

  eventSource.addEventListener('log-snapshot', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.replaceLogContent(payload?.text ?? '日志文件当前没有内容。');
  });

  eventSource.addEventListener('log-append', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.appendLogContent(payload?.text ?? '');
  });

  eventSource.addEventListener('log-reset', (event) => {
    const payload = app.parseLogEventPayload(event);
    app.replaceLogContent(payload?.text ?? '日志已刷新。');
  });

  eventSource.addEventListener('log-error', (event) => {
    const payload = app.parseLogEventPayload(event);
    if (payload?.message) {
      app.appendLogContent(`\n[日志流错误] ${payload.message}\n`);
    }
    app.setLogConnectionState('连接异常', 'is-error');
  });

  eventSource.addEventListener('log-end', (event) => {
    const payload = app.parseLogEventPayload(event);
    if (payload?.message) {
      app.appendLogContent(`\n[日志流结束] ${payload.message}\n`);
    }
    state.logStreamEnded = true;
    app.setLogConnectionState('已结束', 'is-ended');
    app.closeLogStream();
  });

  eventSource.onerror = () => {
    if (state.logStreamEnded) {
      return;
    }

    app.setLogConnectionState('连接中断，正在重连...', 'is-pending');
  };
};

export const initStatusLogFeature = () => {
  logModalCloseTargets.forEach((target) => {
    target.addEventListener('click', app.closeLogModal);
  });

  if (logModalClearButton instanceof HTMLButtonElement) {
    logModalClearButton.addEventListener('click', () => {
      app.replaceLogContent('日志显示已清空，等待新的日志输出...');
    });
  }
};
