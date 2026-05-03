import { app } from '../shared.js';

const { dom, state, constants } = app;
const { sdkGrid, gameGrid, databaseGrid, serverVersionLabel, intervalLabel, databaseIntervalLabel, statusControls } = dom;

app.shouldHideHistoryGrid = (grid) => {
  if (!grid) {
    return false;
  }

  const historyItems = grid.querySelectorAll('.status-history-item:not(.is-empty)');
  if (historyItems.length === 0) {
    return false;
  }

  return Array.from(historyItems).some((item) => item.scrollWidth > item.clientWidth || item.scrollHeight > item.clientHeight);
};

app.updateHistoryGridVisibility = (grid) => {
  if (!grid) {
    return;
  }

  grid.classList.toggle('is-collapsed', app.shouldHideHistoryGrid(grid));
};

app.updateAllHistoryGridVisibility = () => {
  app.getHistoryGrids().forEach(app.updateHistoryGridVisibility);
};

app.isSnapshotHealthy = (payload) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const services = sections.flatMap((section) => (Array.isArray(section?.services) ? section.services : []));

  if (services.length === 0) {
    return false;
  }

  return services.every(app.isServiceHealthy);
};

app.updateNextHealthCheckLabel = () => {
  if (!intervalLabel) {
    return;
  }

  if (typeof state.nextHealthCheckAtMs !== 'number') {
    intervalLabel.textContent = '距离下次健康检查: --';
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((state.nextHealthCheckAtMs - Date.now()) / 1000));
  intervalLabel.textContent = `距离下次健康检查: ${remainingSeconds}s`;
};

app.updateDatabaseHealthCheckLabel = () => {
  if (!databaseIntervalLabel) {
    return;
  }

  if (typeof state.nextDatabaseHealthCheckAtMs !== 'number') {
    databaseIntervalLabel.textContent = '距离下次健康检查: --';
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((state.nextDatabaseHealthCheckAtMs - Date.now()) / 1000));
  databaseIntervalLabel.textContent = `距离下次健康检查: ${remainingSeconds}s`;
};

app.renderCard = (item) => {
  const meta = constants.stateMeta[item.latest?.state] ?? constants.stateMeta.unknown;
  const checkedAt = item.latest?.checked_at ?? null;
  const latency = typeof item.latest?.latency_ms === 'number' ? `${item.latest.latency_ms} ms` : '未知耗时';
  const statusCode = typeof item.latest?.status_code === 'number' ? `HTTP ${item.latest.status_code}` : null;
  const history = Array.isArray(item.history) ? item.history.slice(0, constants.HISTORY_SLOT_COUNT).reverse() : [];
  const emptySlots = Math.max(0, constants.HISTORY_SLOT_COUNT - history.length);

  return `
    <article class="status-card status-card-${meta.className === 'status-ok' ? 'healthy' : meta.className === 'status-down' ? 'unhealthy' : 'muted'}">
      <div class="status-card-header">
        <strong class="status-card-name">${item.title}</strong>
        <span class="status-badge ${meta.className}">${meta.label}</span>
      </div>
      <div class="status-card-details">
        <strong>${item.url}</strong>
        <span>${item.latest?.message ?? '等待首次检查结果'}</span>
        <span>最近检查: ${app.formatTime(checkedAt)}</span>
        <span>耗时: ${latency}${statusCode ? ` · ${statusCode}` : ''}</span>
      </div>
      <div class="status-history-grid" aria-label="${item.title} 历史状态">
        ${Array.from({ length: emptySlots })
          .map(() => '<div class="status-history-item is-empty" aria-hidden="true"></div>')
          .join('')}
        ${history
          .map(
            (entry) => `
              <div class="status-history-item ${app.historyStateClass(entry.state)}" title="${app.formatTime(entry.checked_at)} · ${entry.message}">
                <span>${entry.state === 'healthy' ? '正常' : entry.state === 'unhealthy' ? '异常' : '未知'}</span>
                <small>${app.formatTime(entry.checked_at)}</small>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `;
};

app.renderGrid = (grid, section) => {
  if (!grid) {
    return;
  }

  const services = Array.isArray(section?.services) ? section.services : [];
  grid.innerHTML = services.length > 0 ? services.map(app.renderCard).join('') : '';
  app.updateHistoryGridVisibility(grid);
};

app.renderSnapshot = (payload) => {
  state.latestStatusSnapshot = payload;
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const sdkSection = sections.find((section) => section.key === 'sdk');
  const gameSection = sections.find((section) => section.key === 'game');

  if (typeof payload?.interval_seconds === 'number') {
    state.nextHealthCheckAtMs = Date.now() + payload.interval_seconds * 1000;
    app.updateNextHealthCheckLabel();
  }

  if (serverVersionLabel) {
    serverVersionLabel.textContent = `服务器版本号: ${payload?.server_version ?? '--'}`;
  }

  if (statusControls instanceof HTMLElement) {
    statusControls.hidden = !state.serverControlsVisible;
  }

  const controls = app.getControlState(payload?.controls);
  if (controls?.visible === false) {
    state.serverControlsVisible = false;
    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = true;
    }
  } else if (controls?.visible === true) {
    state.serverControlsVisible = true;
    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = false;
    }
  }

  const startupError = controls?.startup_error;
  if (typeof startupError === 'string' && startupError && startupError !== state.serverControlFailureMessage) {
    state.serverControlFailureMessage = startupError;
    app.openControlModal(startupError);
  } else if (!startupError) {
    state.serverControlFailureMessage = null;
  }

  app.updateStatusActionButtons(payload);
  app.renderGrid(sdkGrid, sdkSection);
  app.renderGrid(gameGrid, gameSection);
  window.requestAnimationFrame(app.updateAllHistoryGridVisibility);
};

app.renderDatabaseSnapshot = (payload) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const databaseSection = sections.find((section) => section.key === 'database') ?? sections[0];
  const wasHealthy = app.isDatabaseHealthy(state.databaseHealthSnapshot);
  state.databaseHealthSnapshot = payload;

  if (typeof payload?.interval_seconds === 'number') {
    state.nextDatabaseHealthCheckAtMs = Date.now() + payload.interval_seconds * 1000;
    app.updateDatabaseHealthCheckLabel();
  }

  app.renderGrid(databaseGrid, databaseSection);
  app.updateDatabaseAccountsAccess(payload);
  if (!wasHealthy && app.isDatabaseHealthy(payload) && app.isDatabaseAccountsSectionActive()) {
    void app.loadDatabaseAccounts(state.accountsCurrentPage);
  }
  if (app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null && app.isDatabasePlayerProfileSectionActive()) {
    void app.loadSelectedPlayerProfile();
  }
  window.requestAnimationFrame(app.updateAllHistoryGridVisibility);
};

app.loadStatus = async () => {
  try {
    const response = await fetch('/api/server-status', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('加载状态失败');
    }

    const payload = await response.json();
    app.renderSnapshot(payload);
    return typeof payload?.interval_seconds === 'number' ? payload.interval_seconds : 60;
  } catch {
    state.nextHealthCheckAtMs = null;
    app.updateNextHealthCheckLabel();

    const currentControlState = app.getControlState(state.serverControlState);
    if (currentControlState?.startup_state === 'starting') {
      app.updateStatusActionButtons({ controls: currentControlState });
    } else {
      app.updateStatusActionButtons({ sections: [] });
    }

    app.renderGrid(sdkGrid, { services: [] });
    app.renderGrid(gameGrid, { services: [] });
    window.requestAnimationFrame(app.updateAllHistoryGridVisibility);
    return 60;
  }
};

app.loadAppInfo = async () => {
  try {
    const response = await fetch('/api/app-info', { credentials: 'include' });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    state.serverControlsVisible = Boolean(payload?.server_controls_visible);
    state.playerPortraitUrlMap = payload?.player_portrait_url_map && typeof payload.player_portrait_url_map === 'object' ? payload.player_portrait_url_map : {};
    state.playerPortraitFrameUrlMap = payload?.player_portrait_frame_url_map && typeof payload.player_portrait_frame_url_map === 'object' ? payload.player_portrait_frame_url_map : {};
    state.playerPortraitNameMap = payload?.player_portrait_name_map && typeof payload.player_portrait_name_map === 'object' ? payload.player_portrait_name_map : {};
    state.playerPortraitFrameNameMap = payload?.player_portrait_frame_name_map && typeof payload.player_portrait_frame_name_map === 'object' ? payload.player_portrait_frame_name_map : {};
    if (!state.serverControlsVisible) {
      state.serverControlState = null;
    }

    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = !state.serverControlsVisible;
    }
  } catch {
    state.serverControlsVisible = false;
    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = true;
    }
  }
};

app.loadDatabaseStatus = async () => {
  try {
    const response = await fetch('/api/database-status', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('加载数据库状态失败');
    }

    const payload = await response.json();
    app.renderDatabaseSnapshot(payload);
    return typeof payload?.interval_seconds === 'number' ? payload.interval_seconds : 60;
  } catch {
    state.databaseHealthSnapshot = null;
    state.nextDatabaseHealthCheckAtMs = null;
    app.updateDatabaseHealthCheckLabel();
    app.renderGrid(databaseGrid, { services: [] });
    app.updateDatabaseAccountsAccess(null);
    window.requestAnimationFrame(app.updateAllHistoryGridVisibility);
    return 60;
  }
};

export const initStatusHealthFeature = () => {
  if (typeof ResizeObserver !== 'undefined') {
    state.historyGridResizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target instanceof HTMLElement) {
          app.updateHistoryGridVisibility(entry.target);
        }
      });
    });

    app.getHistoryGrids().forEach((grid) => {
      state.historyGridResizeObserver.observe(grid);
    });
  }

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(app.updateAllHistoryGridVisibility);
  });
};
