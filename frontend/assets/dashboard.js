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
const updatedLabel = document.querySelector('#status-last-updated');

let serverControlsVisible = false;

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

const updateStatusActionButtons = (payload) => {
  if (!(startButton instanceof HTMLButtonElement) || !(stopButton instanceof HTMLButtonElement)) {
    return;
  }

  const allHealthy = isSnapshotHealthy(payload);
  startButton.disabled = allHealthy;
  stopButton.disabled = !allHealthy;
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

  if (intervalLabel && typeof payload?.interval_seconds === 'number') {
    intervalLabel.textContent = `健康检查时间间隔: ${payload.interval_seconds}s`;
  }

  if (serverVersionLabel) {
    serverVersionLabel.textContent = `服务器版本号: ${payload?.server_version ?? '--'}`;
  }

  if (updatedLabel) {
    updatedLabel.textContent = `更新时间: ${formatTime(payload?.checked_at)}`;
  }

  if (statusControls instanceof HTMLElement) {
    statusControls.hidden = !serverControlsVisible;
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
    if (updatedLabel) {
      updatedLabel.textContent = error.message;
    }
    updateStatusActionButtons({ sections: [] });
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

scheduleReload();
