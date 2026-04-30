const logoutButton = document.querySelector('.logout-button');
const layout = document.querySelector('.dashboard-layout');
const dashboardMain = document.querySelector('.dashboard-main');
const sidebarToggle = document.querySelector('.sidebar-toggle');
const sidebar = document.querySelector('#dashboard-sidebar');
const sdkGrid = document.querySelector('#sdk-status-grid');
const gameGrid = document.querySelector('#game-status-grid');
const serverVersionLabel = document.querySelector('#status-server-version');
const intervalLabel = document.querySelector('#status-interval');
const statusControls = document.querySelector('#status-controls');
const startButton = document.querySelector('.status-action-button-start');
const stopButton = document.querySelector('.status-action-button-stop');
const logButton = document.querySelector('.status-action-button-log');
const configButton = document.querySelector('.status-action-button-config');
const controlModal = document.querySelector('#server-control-modal');
const controlModalMessage = document.querySelector('#server-modal-message');
const controlModalCloseTargets = document.querySelectorAll('[data-server-modal-close]');
const logModal = document.querySelector('#server-log-modal');
const logModalContent = document.querySelector('#server-log-content');
const logModalStatus = document.querySelector('#server-log-status');
const logModalPath = document.querySelector('#server-log-path');
const logModalCloseTargets = document.querySelectorAll('[data-server-log-close]');
const logModalClearButton = document.querySelector('[data-server-log-clear]');
const configModal = document.querySelector('#server-config-modal');
const configModalStatus = document.querySelector('#server-config-status');
const configModalPath = document.querySelector('#server-config-path');
const configEditorInput = document.querySelector('#server-config-editor-input');
const configEditorHighlight = document.querySelector('#server-config-editor-highlight');
const configEditorGutter = document.querySelector('#server-config-editor-gutter');
const configFeedback = document.querySelector('#server-config-feedback');
const configModalCloseTargets = document.querySelectorAll('[data-server-config-close]');
const configReloadButton = document.querySelector('[data-server-config-reload]');
const configSaveButton = document.querySelector('[data-server-config-save]');

let serverControlsVisible = false;
let serverControlState = null;
let serverControlFailureMessage = null;
let lastFocusedControl = null;
let nextHealthCheckAtMs = null;
let logEventSource = null;
let lastLogFocusedControl = null;
let logStreamEnded = false;
let lastConfigFocusedControl = null;
let configEditorValue = '';
let configIsLoading = false;
let configIsSaving = false;
let configLoadedOnce = false;
let configLastSavedValue = '';

const CONFIG_EDITOR_EMPTY_HINT = '点击“修改配置”后加载 config.json。';

const jsonTokenRegex = /("(?:\\u[a-fA-F\d]{4}|\\[^u]|[^\\"])*")([\t ]*:)?|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:]/g;

const getControlState = (controls) => (controls && typeof controls === 'object' ? controls : null);

const stateMeta = {
  healthy: { label: '正常', className: 'status-ok' },
  unhealthy: { label: '异常', className: 'status-down' },
  unknown: { label: '未知', className: 'status-unknown' },
};

const historyStateClass = (state) => stateMeta[state]?.className ?? 'status-unknown';
const HISTORY_SLOT_COUNT = 10;

const getHistoryGrids = () => [sdkGrid, gameGrid].filter(Boolean);

const getServiceHealthState = (service) => service?.latest?.state ?? 'unknown';

const isServiceHealthy = (service) => getServiceHealthState(service) === 'healthy';

const isSnapshotHealthy = (payload) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const services = sections.flatMap((section) => (Array.isArray(section?.services) ? section.services : []));

  if (services.length === 0) {
    return false;
  }

  return services.every(isServiceHealthy);
};

const closeControlModal = () => {
  if (!controlModal || controlModal.hidden) {
    return;
  }

  controlModal.hidden = true;
  document.body.classList.remove('login-modal-open');

  if (lastFocusedControl instanceof HTMLElement) {
    lastFocusedControl.focus();
  }
};

const openControlModal = (message) => {
  if (!controlModal || !controlModalMessage) {
    return;
  }

  lastFocusedControl = document.activeElement;
  controlModalMessage.textContent = message;
  controlModal.hidden = false;
  document.body.classList.add('login-modal-open');

  const primaryButton = controlModal.querySelector('.login-modal-button');
  if (primaryButton instanceof HTMLElement) {
    primaryButton.focus();
  }
};

const setLogConnectionState = (label, stateClass = '') => {
  if (!(logModalStatus instanceof HTMLElement)) {
    return;
  }

  logModalStatus.textContent = label;
  logModalStatus.className = 'server-log-status';
  if (stateClass) {
    logModalStatus.classList.add(stateClass);
  }
};

const isLogModalOpen = () => logModal instanceof HTMLElement && !logModal.hidden;

const isLogPinnedToBottom = () => {
  if (!(logModalContent instanceof HTMLElement)) {
    return true;
  }

  const threshold = 24;
  return logModalContent.scrollTop + logModalContent.clientHeight >= logModalContent.scrollHeight - threshold;
};

const scrollLogToBottom = () => {
  if (!(logModalContent instanceof HTMLElement)) {
    return;
  }

  logModalContent.scrollTop = logModalContent.scrollHeight;
};

const replaceLogContent = (text) => {
  if (!(logModalContent instanceof HTMLElement)) {
    return;
  }

  logModalContent.textContent = typeof text === 'string' && text ? text : '日志文件当前没有内容。';
  window.requestAnimationFrame(scrollLogToBottom);
};

const appendLogContent = (text) => {
  if (!(logModalContent instanceof HTMLElement) || typeof text !== 'string' || text.length === 0) {
    return;
  }

  const shouldStick = isLogPinnedToBottom();
  const hadPlaceholder = logModalContent.textContent === '点击“查看日志”后显示最近日志。' || logModalContent.textContent === '日志文件当前没有内容。';
  logModalContent.textContent = hadPlaceholder ? text : `${logModalContent.textContent}${text}`;

  if (shouldStick) {
    window.requestAnimationFrame(scrollLogToBottom);
  }
};

const closeLogStream = () => {
  if (logEventSource instanceof EventSource) {
    logEventSource.close();
  }

  logEventSource = null;
};

const closeLogModal = () => {
  closeLogStream();
  logStreamEnded = false;

  if (!isLogModalOpen()) {
    return;
  }

  logModal.hidden = true;
  document.body.classList.remove('login-modal-open');

  if (lastLogFocusedControl instanceof HTMLElement) {
    lastLogFocusedControl.focus();
  }
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const renderConfigEditorHighlight = (text) => {
  if (!(configEditorHighlight instanceof HTMLElement)) {
    return;
  }

  const source = typeof text === 'string' ? text : '';
  const escaped = escapeHtml(source);
  const highlighted = escaped.replace(jsonTokenRegex, (token, stringToken, keySuffix) => {
    if (typeof stringToken === 'string' && stringToken.length > 0) {
      const suffix = typeof keySuffix === 'string' ? keySuffix : '';
      return `${suffix ? `<span class="token-key">${stringToken}</span><span class="token-punctuation">${suffix}</span>` : `<span class="token-string">${stringToken}</span>`}`;
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

const renderConfigEditorGutter = (text) => {
  if (!(configEditorGutter instanceof HTMLElement)) {
    return;
  }

  const lineCount = Math.max(1, String(text ?? '').split('\n').length);
  configEditorGutter.innerHTML = Array.from({ length: lineCount }, (_, index) => `<span>${index + 1}</span>`).join('');
};

const syncConfigEditorScroll = () => {
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

const setConfigStatus = (label, tone = '') => {
  if (!(configModalStatus instanceof HTMLElement)) {
    return;
  }

  configModalStatus.textContent = label;
  configModalStatus.className = 'server-config-status';
  if (tone) {
    configModalStatus.classList.add(tone);
  }
};

const setConfigFeedback = (message, tone = '') => {
  if (!(configFeedback instanceof HTMLElement)) {
    return;
  }

  configFeedback.textContent = message;
  configFeedback.className = 'server-config-feedback';
  if (tone) {
    configFeedback.classList.add(tone);
  }
};

const getConfigValidation = (text) => {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        message: 'config.json 顶层必须是 JSON 对象。',
      };
    }

    return {
      valid: true,
      message: 'JSON 语法正确，可以保存。',
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        valid: false,
        message: error.message || 'JSON 语法无效。',
      };
    }

    return {
      valid: false,
      message: 'JSON 语法无效。',
    };
  }
};

const updateConfigEditorState = () => {
  const text = configEditorValue;
  renderConfigEditorHighlight(text);
  renderConfigEditorGutter(text);
  syncConfigEditorScroll();

  const canEdit = configButton instanceof HTMLButtonElement ? !configButton.disabled : false;
  if (configEditorInput instanceof HTMLTextAreaElement) {
    configEditorInput.readOnly = configIsLoading || configIsSaving || !configLoadedOnce || !canEdit;
  }

  if (configReloadButton instanceof HTMLButtonElement) {
    configReloadButton.disabled = configIsLoading || configIsSaving;
  }

  if (!(configSaveButton instanceof HTMLButtonElement)) {
    return;
  }

  if (configIsLoading) {
    configSaveButton.disabled = true;
    setConfigStatus('加载中...', 'is-pending');
    setConfigFeedback('正在读取 config.json ...');
    return;
  }

  if (configIsSaving) {
    configSaveButton.disabled = true;
    setConfigStatus('保存中...', 'is-pending');
    setConfigFeedback('正在保存 config.json ...');
    return;
  }

  const validation = getConfigValidation(text);
  configSaveButton.disabled = !canEdit || !validation.valid || text === configLastSavedValue;

  if (!configLoadedOnce) {
    setConfigStatus('未加载');
    setConfigFeedback(CONFIG_EDITOR_EMPTY_HINT);
    return;
  }

  if (!canEdit) {
    setConfigStatus('只读', 'is-warning');
    setConfigFeedback('服务器已启动，当前仅允许查看配置。', 'is-warning');
    return;
  }

  if (validation.valid) {
    const dirty = text !== configLastSavedValue;
    setConfigStatus(dirty ? '已修改' : '已同步', dirty ? 'is-pending' : 'is-valid');
    setConfigFeedback(dirty ? '检测到未保存修改。' : validation.message, dirty ? 'is-pending' : 'is-valid');
    return;
  }

  setConfigStatus('语法错误', 'is-error');
  setConfigFeedback(validation.message, 'is-error');
};

const setConfigEditorValue = (text) => {
  configEditorValue = typeof text === 'string' ? text : '';
  if (configEditorInput instanceof HTMLTextAreaElement) {
    configEditorInput.value = configEditorValue;
  }
  updateConfigEditorState();
};

const isConfigModalOpen = () => configModal instanceof HTMLElement && !configModal.hidden;

const closeConfigModal = () => {
  if (!isConfigModalOpen()) {
    return;
  }

  configModal.hidden = true;
  document.body.classList.remove('login-modal-open');

  if (lastConfigFocusedControl instanceof HTMLElement) {
    lastConfigFocusedControl.focus();
  }
};

const openConfigModal = () => {
  if (!(configModal instanceof HTMLElement)) {
    return;
  }

  lastConfigFocusedControl = document.activeElement;
  configModal.hidden = false;
  document.body.classList.add('login-modal-open');

  if (configEditorInput instanceof HTMLTextAreaElement) {
    configEditorInput.focus();
  }
};

const loadServerConfig = async () => {
  if (configIsLoading) {
    return;
  }

  configIsLoading = true;
  updateConfigEditorState();

  try {
    const response = await fetch('/api/server-control/config', { credentials: 'include' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '读取配置文件失败。');
    }

    if (configModalPath instanceof HTMLElement) {
      configModalPath.textContent = `配置文件: ${payload?.path ?? '--'}`;
    }

    configLoadedOnce = true;
    configLastSavedValue = typeof payload?.text === 'string' ? payload.text : '';
    setConfigEditorValue(configLastSavedValue);
    setConfigStatus('已加载', 'is-valid');
    setConfigFeedback('config.json 已加载，可以开始编辑。', 'is-valid');
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取配置文件失败。';
    if (configModalPath instanceof HTMLElement) {
      configModalPath.textContent = '配置文件: --';
    }
    configLoadedOnce = false;
    configLastSavedValue = '';
    setConfigEditorValue('');
    setConfigStatus('加载失败', 'is-error');
    setConfigFeedback(message, 'is-error');
  } finally {
    configIsLoading = false;
    updateConfigEditorState();
  }
};

const saveServerConfig = async () => {
  if (!(configSaveButton instanceof HTMLButtonElement) || configSaveButton.disabled || configIsSaving) {
    return;
  }

  const validation = getConfigValidation(configEditorValue);
  if (!validation.valid) {
    setConfigStatus('语法错误', 'is-error');
    setConfigFeedback(validation.message, 'is-error');
    return;
  }

  configIsSaving = true;
  updateConfigEditorState();

  try {
    const response = await fetch('/api/server-control/config', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: configEditorValue }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '保存配置文件失败。');
    }

    configLoadedOnce = true;
    configLastSavedValue = typeof payload?.text === 'string' ? payload.text : configEditorValue;
    if (configModalPath instanceof HTMLElement) {
      configModalPath.textContent = `配置文件: ${payload?.path ?? '--'}`;
    }
    setConfigEditorValue(configLastSavedValue);
    setConfigStatus('已保存', 'is-valid');
    setConfigFeedback('配置已保存，后端已重新读取 config.json。', 'is-valid');
    await loadStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存配置文件失败。';
    setConfigStatus('保存失败', 'is-error');
    setConfigFeedback(message, 'is-error');
    await loadStatus();
  } finally {
    configIsSaving = false;
    updateConfigEditorState();
  }
};

const openConfigEditor = async () => {
  if (!(configButton instanceof HTMLButtonElement) || configButton.disabled) {
    return;
  }

  if (configModalPath instanceof HTMLElement) {
    configModalPath.textContent = '配置文件: --';
  }
  openConfigModal();
  await loadServerConfig();
};

const openLogModal = () => {
  if (!(logModal instanceof HTMLElement)) {
    return;
  }

  lastLogFocusedControl = document.activeElement;
  logModal.hidden = false;
  document.body.classList.add('login-modal-open');
  setLogConnectionState('连接中...', 'is-pending');

  const closeButton = logModal.querySelector('[data-server-log-close].login-modal-button');
  if (closeButton instanceof HTMLElement) {
    closeButton.focus();
  }
};

const parseLogEventPayload = (event) => {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
    return null;
  }

  try {
    return JSON.parse(event.data);
  } catch (error) {
    return null;
  }
};

const startLogStream = () => {
  if (!(logButton instanceof HTMLButtonElement) || logButton.disabled) {
    return;
  }

  closeLogStream();
  openLogModal();
  replaceLogContent('正在加载最近日志...');
  logStreamEnded = false;

  const currentControls = getControlState(serverControlState);
  if (logModalPath instanceof HTMLElement) {
    const runtimeLogPath = typeof currentControls?.runtime_log_path === 'string' ? currentControls.runtime_log_path : '--';
    logModalPath.textContent = `运行日志: ${runtimeLogPath}`;
  }

  const eventSource = new EventSource('/api/server-control/logs', { withCredentials: true });
  logEventSource = eventSource;

  eventSource.addEventListener('open', () => {
    setLogConnectionState('实时跟随中', 'is-live');
  });

  eventSource.addEventListener('log-snapshot', (event) => {
    const payload = parseLogEventPayload(event);
    replaceLogContent(payload?.text ?? '日志文件当前没有内容。');
  });

  eventSource.addEventListener('log-append', (event) => {
    const payload = parseLogEventPayload(event);
    appendLogContent(payload?.text ?? '');
  });

  eventSource.addEventListener('log-reset', (event) => {
    const payload = parseLogEventPayload(event);
    replaceLogContent(payload?.text ?? '日志已刷新。');
  });

  eventSource.addEventListener('log-error', (event) => {
    const payload = parseLogEventPayload(event);
    if (payload?.message) {
      appendLogContent(`\n[日志流错误] ${payload.message}\n`);
    }
    setLogConnectionState('连接异常', 'is-error');
  });

  eventSource.addEventListener('log-end', (event) => {
    const payload = parseLogEventPayload(event);
    if (payload?.message) {
      appendLogContent(`\n[日志流结束] ${payload.message}\n`);
    }
    logStreamEnded = true;
    setLogConnectionState('已结束', 'is-ended');
    closeLogStream();
  });

  eventSource.onerror = () => {
    if (logStreamEnded) {
      return;
    }

    setLogConnectionState('连接中断，正在重连...', 'is-pending');
  };
};

const updateStatusActionButtons = (payload) => {
  if (!(startButton instanceof HTMLButtonElement) || !(stopButton instanceof HTMLButtonElement) || !(logButton instanceof HTMLButtonElement) || !(configButton instanceof HTMLButtonElement)) {
    return;
  }

  const controls = getControlState(payload?.controls);
  if (controls) {
    startButton.textContent = typeof controls.start_label === 'string' ? controls.start_label : '启动';
    startButton.disabled = Boolean(controls.start_disabled);
    stopButton.disabled = Boolean(controls.stop_disabled);
    logButton.disabled = Boolean(controls.log_disabled);
    configButton.disabled = Boolean(controls.start_disabled);
    serverControlState = controls;

    if (logButton.disabled && isLogModalOpen()) {
      appendLogContent('\n[日志流结束] 服务器当前不可查看日志。\n');
      setLogConnectionState('已关闭', 'is-ended');
      closeLogStream();
    }

    updateConfigEditorState();
    return;
  }

  const allHealthy = isSnapshotHealthy(payload);
  startButton.textContent = '启动';
  startButton.disabled = allHealthy;
  stopButton.disabled = !allHealthy;
  logButton.disabled = !allHealthy;
  configButton.disabled = allHealthy;
  serverControlState = null;
  updateConfigEditorState();
};

const shouldHideHistoryGrid = (grid) => {
  if (!grid) {
    return false;
  }

  const historyItems = grid.querySelectorAll('.status-history-item:not(.is-empty)');
  if (historyItems.length === 0) {
    return false;
  }

  return Array.from(historyItems).some((item) => item.scrollWidth > item.clientWidth || item.scrollHeight > item.clientHeight);
};

const updateHistoryGridVisibility = (grid) => {
  if (!grid) {
    return;
  }

  grid.classList.toggle('is-collapsed', shouldHideHistoryGrid(grid));
};

const updateAllHistoryGridVisibility = () => {
  getHistoryGrids().forEach(updateHistoryGridVisibility);
};

let historyGridResizeObserver = null;

if (typeof ResizeObserver !== 'undefined') {
  historyGridResizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target instanceof HTMLElement) {
        updateHistoryGridVisibility(entry.target);
      }
    });
  });

  getHistoryGrids().forEach((grid) => {
    historyGridResizeObserver.observe(grid);
  });
}

window.addEventListener('resize', () => {
  window.requestAnimationFrame(updateAllHistoryGridVisibility);
});

const closeSidebar = () => {
  if (!layout || !sidebarToggle || !sidebar) {
    return;
  }

  layout.classList.remove('is-sidebar-open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
};

const focusContentStart = () => {
  if (!dashboardMain) {
    return;
  }

  dashboardMain.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (typeof dashboardMain.focus === 'function') {
    dashboardMain.focus({ preventScroll: true });
  }
};

if (sidebarToggle && layout && sidebar) {
  sidebarToggle.addEventListener('click', () => {
    const isOpen = layout.classList.toggle('is-sidebar-open');
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  });

  sidebar.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = event.currentTarget;
      const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') : null;

      if (href?.startsWith('#')) {
        event.preventDefault();
        closeSidebar();
        focusContentStart();
        return;
      }

      closeSidebar();
    });
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    logoutButton.disabled = true;
    logoutButton.textContent = '正在退出...';

    fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      window.location.assign('/login');
    });
  });
}

const formatTime = (iso) => {
  if (!iso) {
    return '暂无记录';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
};

const updateNextHealthCheckLabel = () => {
  if (!intervalLabel) {
    return;
  }

  if (typeof nextHealthCheckAtMs !== 'number') {
    intervalLabel.textContent = '距离下次健康检查: --';
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((nextHealthCheckAtMs - Date.now()) / 1000));
  intervalLabel.textContent = `距离下次健康检查: ${remainingSeconds}s`;
};

const renderCard = (item) => {
  const meta = stateMeta[item.latest?.state] ?? stateMeta.unknown;
  const checkedAt = item.latest?.checked_at ?? null;
  const latency = typeof item.latest?.latency_ms === 'number' ? `${item.latest.latency_ms} ms` : '未知耗时';
  const statusCode = typeof item.latest?.status_code === 'number' ? `HTTP ${item.latest.status_code}` : null;
  const history = Array.isArray(item.history) ? item.history.slice(0, HISTORY_SLOT_COUNT).reverse() : [];
  const emptySlots = Math.max(0, HISTORY_SLOT_COUNT - history.length);

  return `
    <article class="status-card status-card-${meta.className === 'status-ok' ? 'healthy' : meta.className === 'status-down' ? 'unhealthy' : 'muted'}">
      <div class="status-card-header">
        <strong class="status-card-name">${item.title}</strong>
        <span class="status-badge ${meta.className}">${meta.label}</span>
      </div>
      <div class="status-card-details">
        <strong>${item.url}</strong>
        <span>${item.latest?.message ?? '等待首次检查结果'}</span>
        <span>最近检查: ${formatTime(checkedAt)}</span>
        <span>耗时: ${latency}${statusCode ? ` · ${statusCode}` : ''}</span>
      </div>
      <div class="status-history-grid" aria-label="${item.title} 历史状态">
        ${Array.from({ length: emptySlots })
          .map(
            () => `
              <div class="status-history-item is-empty" aria-hidden="true"></div>
            `,
          )
          .join('')}
        ${history
          .map(
            (entry) => `
              <div class="status-history-item ${historyStateClass(entry.state)}" title="${formatTime(entry.checked_at)} · ${entry.message}">
                <span>${entry.state === 'healthy' ? '正常' : entry.state === 'unhealthy' ? '异常' : '未知'}</span>
                <small>${formatTime(entry.checked_at)}</small>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `;
};

const renderGrid = (grid, section) => {
  if (!grid) {
    return;
  }

  const services = Array.isArray(section?.services) ? section.services : [];
  grid.innerHTML = services.length > 0 ? services.map(renderCard).join('') : '';
  updateHistoryGridVisibility(grid);
};

const renderSnapshot = (payload) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const sdkSection = sections.find((section) => section.key === 'sdk');
  const gameSection = sections.find((section) => section.key === 'game');

  if (typeof payload?.interval_seconds === 'number') {
    nextHealthCheckAtMs = Date.now() + payload.interval_seconds * 1000;
    updateNextHealthCheckLabel();
  }

  if (serverVersionLabel) {
    serverVersionLabel.textContent = `服务器版本号: ${payload?.server_version ?? '--'}`;
  }

  if (statusControls instanceof HTMLElement) {
    statusControls.hidden = !serverControlsVisible;
  }

  const controls = getControlState(payload?.controls);
  if (controls?.visible === false) {
    serverControlsVisible = false;
    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = true;
    }
  } else if (controls?.visible === true) {
    serverControlsVisible = true;
    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = false;
    }
  }

  const startupError = controls?.startup_error;
  if (typeof startupError === 'string' && startupError && startupError !== serverControlFailureMessage) {
    serverControlFailureMessage = startupError;
    openControlModal(startupError);
  } else if (!startupError) {
    serverControlFailureMessage = null;
  }

  updateStatusActionButtons(payload);

  renderGrid(sdkGrid, sdkSection);
  renderGrid(gameGrid, gameSection);
  window.requestAnimationFrame(updateAllHistoryGridVisibility);
};

const loadStatus = async () => {
  try {
    const response = await fetch('/api/server-status', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('加载状态失败');
    }

    const payload = await response.json();
    renderSnapshot(payload);

    return typeof payload?.interval_seconds === 'number' ? payload.interval_seconds : 60;
  } catch (error) {
    nextHealthCheckAtMs = null;
    updateNextHealthCheckLabel();

    const currentControlState = getControlState(serverControlState);
    if (currentControlState?.startup_state === 'starting') {
      updateStatusActionButtons({ controls: currentControlState });
    } else {
      updateStatusActionButtons({ sections: [] });
    }

    renderGrid(sdkGrid, { services: [] });
    renderGrid(gameGrid, { services: [] });
    window.requestAnimationFrame(updateAllHistoryGridVisibility);
    return 60;
  }
};

const loadAppInfo = async () => {
  try {
    const response = await fetch('/api/app-info', { credentials: 'include' });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    serverControlsVisible = Boolean(payload?.server_controls_visible);
    if (!serverControlsVisible) {
      serverControlState = null;
    }

    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = !serverControlsVisible;
    }
  } catch (error) {
    serverControlsVisible = false;
    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = true;
    }
  }
};

let timerId = null;
let countdownTimerId = null;

const startServer = async () => {
  if (!(startButton instanceof HTMLButtonElement) || !serverControlsVisible) {
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

    const controls = getControlState(payload?.controls);
    updateStatusActionButtons({ controls });

    if (typeof controls?.startup_error === 'string' && controls.startup_error) {
      serverControlFailureMessage = controls.startup_error;
      openControlModal(controls.startup_error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器启动请求失败。';
    serverControlFailureMessage = message;
    openControlModal(message);
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

const stopServer = async () => {
  if (!(stopButton instanceof HTMLButtonElement) || !serverControlsVisible) {
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

    const controls = getControlState(payload?.controls);
    updateStatusActionButtons({ controls });
    await loadStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器停止请求失败。';
    openControlModal(message);
    await loadStatus();
  }
};

if (startButton instanceof HTMLButtonElement) {
  startButton.addEventListener('click', () => {
    if (getControlState(serverControlState)?.startup_state === 'starting') {
      return;
    }

    startServer();
  });
}

if (stopButton instanceof HTMLButtonElement) {
  stopButton.addEventListener('click', () => {
    stopServer();
  });
}

if (logButton instanceof HTMLButtonElement) {
  logButton.addEventListener('click', startLogStream);
}

if (configButton instanceof HTMLButtonElement) {
  configButton.addEventListener('click', () => {
    openConfigEditor();
  });
}

controlModalCloseTargets.forEach((target) => {
  target.addEventListener('click', closeControlModal);
});

logModalCloseTargets.forEach((target) => {
  target.addEventListener('click', closeLogModal);
});

configModalCloseTargets.forEach((target) => {
  target.addEventListener('click', closeConfigModal);
});

if (logModalClearButton instanceof HTMLButtonElement) {
  logModalClearButton.addEventListener('click', () => {
    replaceLogContent('日志显示已清空，等待新的日志输出...');
  });
}

if (configReloadButton instanceof HTMLButtonElement) {
  configReloadButton.addEventListener('click', () => {
    loadServerConfig();
  });
}

if (configSaveButton instanceof HTMLButtonElement) {
  configSaveButton.addEventListener('click', () => {
    saveServerConfig();
  });
}

if (configEditorInput instanceof HTMLTextAreaElement) {
  configEditorInput.addEventListener('input', (event) => {
    const target = event.currentTarget;
    configEditorValue = target instanceof HTMLTextAreaElement ? target.value : '';
    updateConfigEditorState();
  });

  configEditorInput.addEventListener('scroll', syncConfigEditorScroll);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeControlModal();
    closeLogModal();
    closeConfigModal();
  }
});

const scheduleReload = async () => {
  await loadAppInfo();

  const intervalSeconds = await loadStatus();
  if (timerId) {
    window.clearInterval(timerId);
  }

  timerId = window.setInterval(() => {
    loadStatus();
  }, Math.max(5, intervalSeconds) * 1000);
};

updateNextHealthCheckLabel();
countdownTimerId = window.setInterval(updateNextHealthCheckLabel, 1000);
setConfigEditorValue('');
scheduleReload();
