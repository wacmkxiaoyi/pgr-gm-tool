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
    intervalLabel.textContent = app.translate('dashboard.nextHealthCheckIdle');
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((state.nextHealthCheckAtMs - Date.now()) / 1000));
  intervalLabel.textContent = app.translate('dashboard.nextHealthCheck', { seconds: remainingSeconds });
};

app.updateDatabaseHealthCheckLabel = () => {
  if (!databaseIntervalLabel) {
    return;
  }

  if (typeof state.nextDatabaseHealthCheckAtMs !== 'number') {
    databaseIntervalLabel.textContent = app.translate('dashboard.databaseStatusIntervalIdle');
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((state.nextDatabaseHealthCheckAtMs - Date.now()) / 1000));
  databaseIntervalLabel.textContent = app.translate('dashboard.databaseStatusInterval', { seconds: remainingSeconds });
};

app.renderCard = (item) => {
  const meta = constants.stateMeta[item.latest?.state] ?? constants.stateMeta.unknown;
  const badgeLabel = app.getStatusLabel(item.latest?.state);
  const checkedAt = item.latest?.checked_at ?? null;
  const latency = typeof item.latest?.latency_ms === 'number' ? `${item.latest.latency_ms} ms` : app.translate('dashboard.statusUnknownLatency');
  const statusCode = typeof item.latest?.status_code === 'number' ? `HTTP ${item.latest.status_code}` : null;
  const history = Array.isArray(item.history) ? item.history.slice(0, constants.HISTORY_SLOT_COUNT).reverse() : [];
  const emptySlots = Math.max(0, constants.HISTORY_SLOT_COUNT - history.length);

  return `
    <article class="status-card status-card-${meta.className === 'status-ok' ? 'healthy' : meta.className === 'status-down' ? 'unhealthy' : 'muted'}">
      <div class="status-card-details">
        <div class="status-card-details-header">
          <strong>${item.url}</strong>
          <span class="status-badge ${meta.className}">${badgeLabel}</span>
        </div>
        <span>${item.latest?.message ? app.resolveUiTextToken(item.latest.message) : app.translate('dashboard.statusFirstCheckPending')}</span>
        <span>${app.translate('dashboard.statusLastChecked', { time: app.formatTime(checkedAt) })}</span>
        <span>${app.translate('dashboard.statusLatency', { latency: `${latency}${statusCode ? ` · ${statusCode}` : ''}` })}</span>
      </div>
      <div class="status-history-grid" aria-label="${app.translate('dashboard.statusHistoryAria', { title: item.title })}">
        ${Array.from({ length: emptySlots })
          .map(() => '<div class="status-history-item is-empty" aria-hidden="true"></div>')
          .join('')}
        ${history
          .map(
            (entry) => `
              <div class="status-history-item ${app.historyStateClass(entry.state)}" title="${app.formatTime(entry.checked_at)} · ${app.resolveUiTextToken(entry.message)}">
                <span>${app.getStatusLabel(entry.state)}</span>
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
    serverVersionLabel.textContent = app.translate('dashboard.serverVersion', { version: payload?.server_version ?? app.translate('common.notAvailable') });
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
    app.openNoticeModal(app.resolveUiTextToken(startupError));
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
  if (app.isDatabaseCharacterManagementSectionActive()) {
    app.updateCharacterManagementAccess(payload);
    if (app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null) {
      void app.loadSelectedAccountCharacters(state.characterManagementCurrentPage);
    }
  }
  if (app.isDatabaseWeaponManagementSectionActive()) {
    app.updateWeaponManagementAccess(payload);
    if (app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null) {
      void app.loadSelectedAccountWeapons(state.weaponManagementCurrentPage);
    }
  }
  if (app.isDatabaseItemManagementSectionActive()) {
    app.updateItemManagementAccess(payload);
    if (app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null) {
      void app.loadSelectedAccountItems(state.itemManagementCurrentPage);
    }
  }
  window.requestAnimationFrame(app.updateAllHistoryGridVisibility);
};

app.loadStatus = async () => {
  try {
    const payload = await app.apiFetch('/api/server-status');
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
    const payload = await app.apiFetch('/api/app-info');
    state.serverControlsVisible = Boolean(payload?.server_controls_visible);
    state.playerLevelMax = Number.isFinite(Number(payload?.player_level_max)) ? Math.max(0, Number(payload.player_level_max)) : 0;
    state.playerLevelMaxExpMap = payload?.player_level_max_exp_map && typeof payload.player_level_max_exp_map === 'object' ? payload.player_level_max_exp_map : {};
    state.playerPortraitUrlMap = payload?.player_portrait_url_map && typeof payload.player_portrait_url_map === 'object' ? payload.player_portrait_url_map : {};
    state.playerPortraitFrameUrlMap = payload?.player_portrait_frame_url_map && typeof payload.player_portrait_frame_url_map === 'object' ? payload.player_portrait_frame_url_map : {};
    state.playerPortraitNameMap = payload?.player_portrait_name_map && typeof payload.player_portrait_name_map === 'object' ? payload.player_portrait_name_map : {};
    state.playerPortraitFrameNameMap = payload?.player_portrait_frame_name_map && typeof payload.player_portrait_frame_name_map === 'object' ? payload.player_portrait_frame_name_map : {};
    state.playerBackgroundUrlMap = payload?.player_background_url_map && typeof payload.player_background_url_map === 'object' ? payload.player_background_url_map : {};
    state.playerBackgroundNameMap = payload?.player_background_name_map && typeof payload.player_background_name_map === 'object' ? payload.player_background_name_map : {};
    state.itemNameMap = payload?.item_name_map && typeof payload.item_name_map === 'object' ? payload.item_name_map : {};
    state.equipNameMap = payload?.equip_name_map && typeof payload.equip_name_map === 'object' ? payload.equip_name_map : {};
    state.weaponTypeNameMap = payload?.weapon_type_name_map && typeof payload.weapon_type_name_map === 'object' ? payload.weapon_type_name_map : {};
    state.equipStarMap = payload?.equip_star_map && typeof payload.equip_star_map === 'object' ? payload.equip_star_map : {};
    state.equipSiteMap = payload?.equip_site_map && typeof payload.equip_site_map === 'object' ? payload.equip_site_map : {};
    state.equippableMemoryNums = Number.isFinite(Number(payload?.equippable_memory_nums)) ? Math.max(0, Number(payload.equippable_memory_nums)) : 0;
    state.equipIconUrlMap = payload?.equip_icon_url_map && typeof payload.equip_icon_url_map === 'object' ? payload.equip_icon_url_map : {};
    state.characterLogNameMap = payload?.character_log_name_map && typeof payload.character_log_name_map === 'object' ? payload.character_log_name_map : {};
    state.characterHeadIconUrlMap = payload?.character_head_icon_url_map && typeof payload.character_head_icon_url_map === 'object' ? payload.character_head_icon_url_map : {};
    state.characterGradeNameMap = payload?.character_grade_name_map && typeof payload.character_grade_name_map === 'object' ? payload.character_grade_name_map : {};
    state.characterTrustExpMap = payload?.character_trust_exp_map && typeof payload.character_trust_exp_map === 'object' ? payload.character_trust_exp_map : {};
    state.weaponSkillEntriesMap = payload?.weapon_skill_entries_map && typeof payload.weapon_skill_entries_map === 'object' ? payload.weapon_skill_entries_map : {};
    state.weaponOverrunSuitEntriesMap = payload?.weapon_overrun_suit_entries_map && typeof payload.weapon_overrun_suit_entries_map === 'object' ? payload.weapon_overrun_suit_entries_map : {};
    state.weaponSkillPoolEntriesMap = payload?.weapon_skill_pool_entries_map && typeof payload.weapon_skill_pool_entries_map === 'object' ? payload.weapon_skill_pool_entries_map : {};
    state.attribPoolEntriesMap = payload?.attrib_pool_entries_map && typeof payload.attrib_pool_entries_map === 'object' ? payload.attrib_pool_entries_map : {};
    state.characterSkillPoolEntriesMap = payload?.character_skill_pool_entries_map && typeof payload.character_skill_pool_entries_map === 'object' ? payload.character_skill_pool_entries_map : {};
    state.equipResonanceMap = payload?.equip_resonance_map && typeof payload.equip_resonance_map === 'object' ? payload.equip_resonance_map : {};
    if (typeof app.buildResonanceResolveIndices === 'function') {
      app.buildResonanceResolveIndices();
    }
    if (!state.serverControlsVisible) {
      state.serverControlState = null;
    }

    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = !state.serverControlsVisible;
    }
  } catch {
    state.serverControlsVisible = false;
    state.playerLevelMax = 0;
    state.playerLevelMaxExpMap = {};
    state.itemNameMap = {};
    state.equipNameMap = {};
    state.weaponTypeNameMap = {};
    state.equipStarMap = {};
    state.equipSiteMap = {};
    state.equippableMemoryNums = 0;
    state.equipIconUrlMap = {};
    state.characterLogNameMap = {};
    state.characterHeadIconUrlMap = {};
    state.characterGradeNameMap = {};
    state.characterTrustExpMap = {};
    state.weaponSkillEntriesMap = {};
    state.weaponOverrunSuitEntriesMap = {};
    state.weaponSkillPoolEntriesMap = {};
    state.attribPoolEntriesMap = {};
    state.characterSkillPoolEntriesMap = {};
    state.equipResonanceMap = {};
    if (statusControls instanceof HTMLElement) {
      statusControls.hidden = true;
    }
  }
};

app.loadDatabaseStatus = async () => {
  try {
    const payload = await app.apiFetch('/api/database-status');
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
