const logoutButton = document.querySelector('.logout-button');
const layout = document.querySelector('.dashboard-layout');
const dashboardMain = document.querySelector('.dashboard-main');
const sidebarToggle = document.querySelector('.sidebar-toggle');
const sidebar = document.querySelector('#dashboard-sidebar');
const sidebarLinks = Array.from(document.querySelectorAll('[data-dashboard-page]'));
const dashboardPages = Array.from(document.querySelectorAll('[data-dashboard-panel]'));
const sdkGrid = document.querySelector('#sdk-status-grid');
const gameGrid = document.querySelector('#game-status-grid');
const databaseGrid = document.querySelector('#database-status-grid');
const databaseAccountsSubnavButton = document.querySelector('#database-accounts-subnav');
const databasePlayerProfileSubnavButton = document.querySelector('#database-player-profile-subnav');
const databaseTabButtons = Array.from(document.querySelectorAll('[data-database-tab]'));
const databaseTabPanels = Array.from(document.querySelectorAll('[data-database-tab-panel]'));
const databaseAccountsState = document.querySelector('#database-accounts-state');
const databaseAccountsTableShell = document.querySelector('#database-accounts-table-shell');
const databaseAccountsBody = document.querySelector('#database-accounts-body');
const databaseAccountsSummary = document.querySelector('#database-accounts-summary');
const databaseAccountsPrevButton = document.querySelector('#database-accounts-prev');
const databaseAccountsNextButton = document.querySelector('#database-accounts-next');
const databaseAccountsPaginationLabel = document.querySelector('#database-accounts-pagination');
const databaseSelectedAccountLabel = document.querySelector('#database-selected-account');
const databasePlayerProfileState = document.querySelector('#database-player-profile-state');
const databasePlayerProfileShell = document.querySelector('#database-player-profile-shell');
const databasePlayerProfileSummary = document.querySelector('#database-player-profile-summary');
const playerCardAvatarShell = document.querySelector('.database-player-card-avatar-shell');
const playerCardAvatarRing = document.querySelector('.database-player-card-avatar-ring');
const playerCardAvatarFrameImage = document.querySelector('#player-card-avatar-frame-image');
const playerCardAvatarImage = document.querySelector('#player-card-avatar-image');
const playerCardAvatarFallback = document.querySelector('#player-card-avatar-fallback');
const playerCardName = document.querySelector('#player-card-name');
const playerCardInlineUid = document.querySelector('#player-card-inline-uid');
const playerCardGender = document.querySelector('#player-card-gender');
const playerCardLikes = document.querySelector('#player-card-likes');
const playerCardLevel = document.querySelector('#player-card-level');
const playerCardExp = document.querySelector('#player-card-exp');
const playerPortraitPickerModal = document.querySelector('#player-portrait-picker-modal');
const playerPortraitPickerTitle = document.querySelector('#player-portrait-picker-title');
const playerPortraitPickerEyebrow = document.querySelector('#player-portrait-picker-eyebrow');
const playerPortraitPickerIcon = document.querySelector('#player-portrait-picker-icon');
const playerPortraitPickerDescription = document.querySelector('#player-portrait-picker-description');
const playerPortraitPickerCurrent = document.querySelector('#player-portrait-picker-current');
const playerPortraitPickerGrid = document.querySelector('#player-portrait-picker-grid');
const playerPortraitPickerConfirmButton = document.querySelector('#player-portrait-picker-confirm');
const playerPortraitPickerCloseTargets = document.querySelectorAll('[data-player-portrait-picker-close]');
const playerPortraitPickerCancelButton = document.querySelector('.player-portrait-picker-cancel');
const serverVersionLabel = document.querySelector('#status-server-version');
const intervalLabel = document.querySelector('#status-interval');
const databaseIntervalLabel = document.querySelector('#database-status-interval');
const statusControls = document.querySelector('#status-controls');
const startButton = document.querySelector('.status-action-button-start');
const stopButton = document.querySelector('.status-action-button-stop');
const logButton = document.querySelector('.status-action-button-log');
const configButton = document.querySelector('.status-action-button-config');
const controlModal = document.querySelector('#server-control-modal');
const controlModalMessage = document.querySelector('#server-modal-message');
const controlModalIcon = document.querySelector('#server-modal-icon');
const controlModalEyebrow = document.querySelector('#server-modal-eyebrow');
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
const accountDeleteModal = document.querySelector('#account-delete-modal');
const accountDeleteMessage = document.querySelector('#account-delete-message');
const accountDeleteCloseTargets = document.querySelectorAll('[data-account-delete-close]');
const accountDeleteConfirmButton = document.querySelector('#account-delete-confirm');
const accountPasswordModal = document.querySelector('#account-password-modal');
const accountPasswordTarget = document.querySelector('#account-password-target');
const accountPasswordInput = document.querySelector('#account-password-input');
const accountPasswordConfirmInput = document.querySelector('#account-password-confirm-input');
const accountPasswordFeedback = document.querySelector('#account-password-feedback');
const accountPasswordCloseTargets = document.querySelectorAll('[data-account-password-close]');
const accountPasswordConfirmButton = document.querySelector('#account-password-confirm');
const logoutConfirmModal = document.querySelector('#logout-confirm-modal');
const logoutConfirmCloseTargets = document.querySelectorAll('[data-logout-confirm-close]');
const logoutConfirmSubmitButton = document.querySelector('#logout-confirm-submit');

let serverControlsVisible = false;
let serverControlState = null;
let serverControlFailureMessage = null;
let lastFocusedControl = null;
let nextHealthCheckAtMs = null;
let nextDatabaseHealthCheckAtMs = null;
let logEventSource = null;
let lastLogFocusedControl = null;
let logStreamEnded = false;
let lastConfigFocusedControl = null;
let configEditorValue = '';
let configIsLoading = false;
let configIsSaving = false;
let configLoadedOnce = false;
let configLastSavedValue = '';
let databaseHealthSnapshot = null;
let accountsCurrentPage = 1;
let accountsTotalPages = 0;
let accountsHasLoaded = false;
let accountsLoading = false;
let selectedAccountUid = null;
let accountSelectionPendingUid = null;
let playerProfileLoading = false;
let playerProfileData = null;
let playerProfileEditState = null;
let playerPortraitPickerState = null;
let playerPortraitUrlMap = {};
let playerPortraitFrameUrlMap = {};
let playerPortraitNameMap = {};
let playerPortraitFrameNameMap = {};
let latestStatusSnapshot = null;
let pendingDeleteAccount = null;
let lastDeleteFocusedControl = null;
let pendingPasswordAccount = null;
let lastPasswordFocusedControl = null;
let lastLogoutFocusedControl = null;

const PLAYER_NAME_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9 _-]+$/;
const PLAYER_FIELD_LABELS = {
  name: '昵称',
  gender: '性别',
  likes: '点赞',
  level: '等级',
};
const PLAYER_GENDER_OPTIONS = [
  { value: '0', label: '男' },
  { value: '1', label: '女' },
];

const PLAYER_PROFILE_EDITABLE_FIELDS = {
  name: {
    displayValue: (profile) => formatPlayerFieldValue(profile?.name),
    getRawValue: (profile) => profile?.name ?? null,
    element: () => playerCardName,
    editorType: 'input',
    inputMode: 'text',
    normalize: (value) => String(value).trim(),
    validate: (value) => {
      if (value.length <= 0) {
        return '昵称不能为空。';
      }

      return PLAYER_NAME_PATTERN.test(value) ? '' : '昵称仅允许中文、英文、数字、空格、下划线和短横线。';
    },
  },
  gender: {
    displayValue: (profile) => getPlayerGenderLabel(profile?.gender ?? null),
    getRawValue: (profile) => profile?.gender ?? null,
    element: () => playerCardGender,
    editorType: 'select',
    normalize: (value) => String(value).trim(),
    validate: (value) => value === '0' || value === '1' ? '' : '性别仅允许为男或女。',
    options: PLAYER_GENDER_OPTIONS,
  },
  likes: {
    displayValue: (profile) => formatPlayerFieldValue(profile?.likes),
    getRawValue: (profile) => profile?.likes ?? null,
    element: () => playerCardLikes,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => /^\d+$/.test(value) ? '' : '点赞必须为大于等于 0 的整数。',
  },
  level: {
    displayValue: (profile) => formatPlayerFieldValue(profile?.level),
    getRawValue: (profile) => profile?.level ?? null,
    element: () => playerCardLevel,
    editorType: 'input',
    inputMode: 'numeric',
    normalize: (value) => String(value).trim(),
    validate: (value) => /^\d+$/.test(value) ? '' : '等级必须为大于等于 0 的整数。',
  },
  head_portrait_id: {
    displayValue: (profile) => formatPlayerFieldValue(profile?.head_portrait_id),
    getRawValue: (profile) => profile?.head_portrait_id ?? null,
    element: () => playerCardAvatarImage,
    editorType: 'picker',
  },
  head_frame_id: {
    displayValue: (profile) => formatPlayerFieldValue(profile?.head_frame_id),
    getRawValue: (profile) => profile?.head_frame_id ?? null,
    element: () => playerCardAvatarFrameImage,
    editorType: 'picker',
  },
};

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

const getHistoryGrids = () => [sdkGrid, gameGrid, databaseGrid].filter(Boolean);

const getActiveDashboardPage = () => dashboardPages.find((page) => page.classList.contains('is-active')) ?? null;

const getServiceHealthState = (service) => service?.latest?.state ?? 'unknown';

const isServiceHealthy = (service) => getServiceHealthState(service) === 'healthy';

const getDatabaseSection = (payload) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  return sections.find((section) => section?.key === 'database') ?? sections[0] ?? null;
};

const getDatabasePrimaryService = (payload) => {
  const section = getDatabaseSection(payload);
  const services = Array.isArray(section?.services) ? section.services : [];
  return services[0] ?? null;
};

const isDatabaseHealthy = (payload = databaseHealthSnapshot) => isServiceHealthy(getDatabasePrimaryService(payload));

const isDatabaseAccountsSectionActive = () => {
  return databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-accounts-section');
};

const isDatabasePlayerProfileSectionActive = () => {
  return databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-player-profile-section');
};

const normalizeAccountUid = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPlayerGenderLabel = (gender) => {
  if (gender === 0) {
    return '男';
  }

  if (gender === 1) {
    return '女';
  }

  return '--';
};

const formatPlayerFieldValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  return String(value);
};

const normalizePortraitId = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPlayerPortraitUrlByField = (field, id) => {
  if (id === null || id === undefined) {
    return '';
  }

  const map = field === 'head_frame_id' ? playerPortraitFrameUrlMap : playerPortraitUrlMap;
  return typeof map?.[id] === 'string' ? map[id] : '';
};

const getPlayerPortraitNameByField = (field, id) => {
  if (id === null || id === undefined) {
    return '';
  }

  const map = field === 'head_frame_id' ? playerPortraitFrameNameMap : playerPortraitNameMap;
  return typeof map?.[id] === 'string' ? map[id] : '';
};

const getPortraitPickerMap = (field) => (field === 'head_frame_id' ? playerPortraitFrameUrlMap : playerPortraitUrlMap);

const getPortraitPickerEntries = (field) => {
  const map = getPortraitPickerMap(field);
  return Object.entries(map)
    .map(([id, url]) => ({ id: normalizePortraitId(id), url: typeof url === 'string' ? url : '' }))
    .filter((item) => item.id !== null)
    .sort((left, right) => left.id - right.id);
};

const getPortraitPickerLabel = (field) => (field === 'head_frame_id' ? '头像框' : '头像');

const getPortraitPickerCurrentValue = (field) => {
  if (!playerProfileData) {
    return null;
  }

  return field === 'head_frame_id' ? playerProfileData.head_frame_id ?? null : playerProfileData.head_portrait_id ?? null;
};

const getPortraitPickerCurrentName = (field) => {
  const currentValue = getPortraitPickerCurrentValue(field);
  return getPlayerPortraitNameByField(field, currentValue) || (currentValue === null ? '--' : String(currentValue));
};

const getPortraitPickerPageSize = () => {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 720;
  const cardWidth = 126;
  const cardHeight = 144;
  const gap = 12;
  const horizontalPadding = 84;
  const verticalPadding = 280;
  const columns = Math.max(2, Math.floor((viewportWidth - horizontalPadding) / (cardWidth + gap)));
  const rows = Math.max(2, Math.floor((viewportHeight - verticalPadding) / (cardHeight + gap)));
  return Math.max(4, columns * rows);
};

const getPortraitPickerPages = (field) => {
  const entries = getPortraitPickerEntries(field);
  return { entries, totalPages: 1 };
};

const getPlayerProfileEditValue = (field) => {
  if (!playerProfileData) {
    return null;
  }

  if (field === 'head_portrait_id') {
    return playerProfileData.head_portrait_id ?? null;
  }

  if (field === 'head_frame_id') {
    return playerProfileData.head_frame_id ?? null;
  }

  return PLAYER_PROFILE_EDITABLE_FIELDS[field]?.getRawValue(playerProfileData) ?? null;
};

const getGameSection = (payload = latestStatusSnapshot) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  return sections.find((section) => section?.key === 'game') ?? null;
};

const isGameServerHealthy = (payload = latestStatusSnapshot) => isServiceHealthy(getGameSection(payload)?.services?.[0]);

const setPlayerEditableState = (field, editable) => {
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  const element = config?.element();
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.classList.toggle('is-editable', editable);
  element.setAttribute('tabindex', editable ? '0' : '-1');
  if (editable) {
    element.setAttribute('role', 'button');
    element.setAttribute('title', config?.editorType === 'picker' ? `点击后选择${getPortraitPickerLabel(field)}` : '点击后按回车确认修改');
  } else {
    element.removeAttribute('role');
    element.removeAttribute('title');
  }
};

const syncPlayerEditableStates = () => {
  Object.entries(PLAYER_PROFILE_EDITABLE_FIELDS).forEach(([field, config]) => {
    const rawValue = config.getRawValue(playerProfileData);
    setPlayerEditableState(field, rawValue !== null && rawValue !== undefined);
  });
};

const stopPlayerProfileEdit = (field) => {
  if (!playerProfileEditState || playerProfileEditState.field !== field) {
    return;
  }

  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  const element = config?.element();
  if (element instanceof HTMLElement) {
    element.classList.remove('is-editing');
  }

  playerProfileEditState = null;
  renderPlayerProfile(playerProfileData);
};

const beginPlayerProfileEdit = (field) => {
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  const element = config?.element();
  const rawValue = config?.getRawValue(playerProfileData);

  if (!config || !(element instanceof HTMLElement) || rawValue === null || rawValue === undefined) {
    return;
  }

  if (config.editorType === 'picker') {
    openPlayerPortraitPicker(field);
    return;
  }

  if (playerProfileEditState?.field === field) {
    const existingInput = element.querySelector('input');
    if (existingInput instanceof HTMLInputElement) {
      existingInput.focus();
      existingInput.select();
      return;
    }
  }

  if (playerProfileEditState?.field && playerProfileEditState.field !== field) {
    stopPlayerProfileEdit(playerProfileEditState.field);
  }

  clearPlayerProfileSummaryMessage();

  playerProfileEditState = { field, pending: false };
  element.classList.add('is-editing');
  element.innerHTML = '';

  if (config.editorType === 'select') {
    const select = document.createElement('select');
    select.className = 'database-player-inline-select';
    select.setAttribute('aria-label', `编辑${PLAYER_FIELD_LABELS[field] ?? field}`);

    const options = Array.isArray(config.options) ? config.options : [];
    select.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
    select.value = String(rawValue);
    element.appendChild(select);
    select.focus();

    select.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submitPlayerProfileEdit(field, select.value);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        stopPlayerProfileEdit(field);
      }
    });

    select.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (playerProfileEditState?.field === field && !playerProfileEditState.pending) {
          stopPlayerProfileEdit(field);
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
  input.setAttribute('aria-label', `编辑${PLAYER_FIELD_LABELS[field] ?? field}`);
  element.appendChild(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitPlayerProfileEdit(field, input.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      stopPlayerProfileEdit(field);
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (playerProfileEditState?.field === field && !playerProfileEditState.pending) {
        stopPlayerProfileEdit(field);
      }
    }, 0);
  });
};

const submitPlayerProfileEdit = async (field, nextValue) => {
  const currentState = playerProfileEditState;
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  if (!currentState || currentState.field !== field || !config) {
    return;
  }

  const normalizedValue = config.normalize(nextValue);
  const validationMessage = config.validate(normalizedValue);
  if (validationMessage) {
    openControlModal(validationMessage);
    return;
  }

  const currentRawValue = config.getRawValue(playerProfileData);
  let normalizedCurrentValue = String(currentRawValue);
  if (field === 'name') {
    normalizedCurrentValue = String(currentRawValue ?? '').trim();
  }
  if (normalizedCurrentValue === normalizedValue) {
    stopPlayerProfileEdit(field);
    return;
  }

  if (isGameServerHealthy() && !window.confirm('游戏服务器尚未关闭，改动可能不生效，且有可能损坏原始数据！')) {
    stopPlayerProfileEdit(field);
    return;
  }

  currentState.pending = true;
  const element = config.element();
  const editor = element instanceof HTMLElement ? element.querySelector('input, select') : null;
  if (editor instanceof HTMLInputElement || editor instanceof HTMLSelectElement) {
    editor.disabled = true;
  }

  let requestValue;
  if (field === 'name') {
    requestValue = normalizedValue;
  } else {
    requestValue = Number.parseInt(normalizedValue, 10);
  }

  try {
    const response = await fetch('/api/database-players/selected', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        field,
        value: requestValue,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '修改玩家信息失败');
    }

    playerProfileEditState = null;
    clearPlayerProfileSummaryMessage();
    renderPlayerProfile(payload);
  } catch (error) {
    currentState.pending = false;
    renderPlayerProfile(playerProfileData);
    openControlModal(error instanceof Error ? error.message : '修改玩家信息失败');
  }
};

const closePlayerPortraitPicker = () => {
  if (!(playerPortraitPickerModal instanceof HTMLElement) || playerPortraitPickerModal.hidden) {
    playerPortraitPickerState = null;
    playerProfileEditState = null;
    return;
  }

  playerPortraitPickerModal.hidden = true;
  document.body.classList.remove('login-modal-open');
  playerPortraitPickerState = null;
  playerProfileEditState = null;

  if (lastFocusedControl instanceof HTMLElement) {
    lastFocusedControl.focus();
  }
};

const renderPlayerPortraitPicker = () => {
  if (!(playerPortraitPickerGrid instanceof HTMLElement) || !playerPortraitPickerState) {
    return;
  }

  const { field } = playerPortraitPickerState;
  const { entries, totalPages } = getPortraitPickerPages(field);
  playerPortraitPickerState.page = 1;
  playerPortraitPickerState.pageSize = getPortraitPickerPageSize();
  playerPortraitPickerState.totalPages = totalPages;

  if (playerPortraitPickerTitle instanceof HTMLElement) {
    playerPortraitPickerTitle.textContent = `选择${getPortraitPickerLabel(field)}`;
  }
  if (playerPortraitPickerEyebrow instanceof HTMLElement) {
    playerPortraitPickerEyebrow.textContent = `${getPortraitPickerLabel(field)}选择`;
  }
  if (playerPortraitPickerDescription instanceof HTMLElement) {
    playerPortraitPickerDescription.textContent = `请选择要应用到玩家名片上的${getPortraitPickerLabel(field)}。`;
  }
  if (playerPortraitPickerCurrent instanceof HTMLElement) {
    playerPortraitPickerCurrent.textContent = `当前选择：${getPortraitPickerCurrentName(field)}`;
  }
  if (playerPortraitPickerConfirmButton instanceof HTMLButtonElement) {
    playerPortraitPickerConfirmButton.disabled = !Number.isFinite(playerPortraitPickerState.selectedId);
  }

  playerPortraitPickerGrid.innerHTML = entries.map((entry) => {
    const isSelected = entry.id === playerPortraitPickerState.selectedId;
    const url = entry.url || getPlayerPortraitUrlByField(field, entry.id);
    const name = getPlayerPortraitNameByField(field, entry.id) || String(entry.id);
    return `
      <button type="button" class="player-portrait-picker-item ${isSelected ? 'is-selected' : ''}" data-player-portrait-id="${entry.id}">
        <span class="player-portrait-picker-item-preview">
          <img src="${url}" alt="${getPortraitPickerLabel(field)} ${entry.id}">
        </span>
        <strong>${name}</strong>
      </button>
    `;
  }).join('');
};

const openPlayerPortraitPicker = (field) => {
  const config = PLAYER_PROFILE_EDITABLE_FIELDS[field];
  if (!config) {
    return;
  }

  const currentValue = getPlayerProfileEditValue(field);
  if (currentValue === null || currentValue === undefined) {
    return;
  }

  const availableEntries = getPortraitPickerEntries(field);
  const initialSelectedId = availableEntries.some((entry) => entry.id === currentValue) ? currentValue : null;

  if (playerProfileEditState?.field && playerProfileEditState.field !== field) {
    stopPlayerProfileEdit(playerProfileEditState.field);
  }

  lastFocusedControl = document.activeElement;
  playerProfileEditState = { field, pending: false };
  playerPortraitPickerState = {
    field,
    page: 1,
    pageSize: getPortraitPickerPageSize(),
    totalPages: 1,
    selectedId: initialSelectedId,
  };

  if (playerPortraitPickerModal instanceof HTMLElement) {
    playerPortraitPickerModal.hidden = false;
    document.body.classList.add('login-modal-open');
    renderPlayerPortraitPicker();
    const firstSelected = playerPortraitPickerGrid?.querySelector?.('.is-selected') ?? playerPortraitPickerGrid?.querySelector?.('button');
    if (firstSelected instanceof HTMLElement) {
      firstSelected.focus();
    } else if (playerPortraitPickerConfirmButton instanceof HTMLButtonElement) {
      playerPortraitPickerConfirmButton.focus();
    }
  }
};

const submitPlayerPortraitPicker = async () => {
  if (!playerPortraitPickerState || !playerPortraitPickerState.field) {
    return;
  }

  const { field, selectedId } = playerPortraitPickerState;
  const currentValue = getPlayerProfileEditValue(field);
  if (currentValue === selectedId) {
    closePlayerPortraitPicker();
    return;
  }

  if (selectedId === null || selectedId === undefined) {
    openControlModal('请选择一个可用资源。');
    return;
  }

  if (isGameServerHealthy() && !window.confirm('游戏服务器尚未关闭，改动可能不生效，且有可能损坏原始数据！')) {
    closePlayerPortraitPicker();
    return;
  }

  if (!(playerPortraitPickerConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  playerPortraitPickerConfirmButton.disabled = true;

  try {
    const response = await fetch('/api/database-players/selected', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        field,
        value: selectedId,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '修改玩家信息失败');
    }

    closePlayerPortraitPicker();
    clearPlayerProfileSummaryMessage();
    renderPlayerProfile(payload);
  } catch (error) {
    playerPortraitPickerConfirmButton.disabled = false;
    openControlModal(error instanceof Error ? error.message : '修改玩家信息失败');
  }
};

const handlePlayerPortraitPickerClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-player-portrait-id]');
  if (!(button instanceof HTMLButtonElement) || !playerPortraitPickerState) {
    return;
  }

  const selectedId = normalizePortraitId(button.dataset.playerPortraitId);
  if (selectedId === null) {
    return;
  }

  playerPortraitPickerState.selectedId = selectedId;
  renderPlayerPortraitPicker();
};

const handlePlayerProfileFieldActivate = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.tagName === 'INPUT') {
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

  beginPlayerProfileEdit(field);
};

const resetPlayerCardAvatar = () => {
  if (playerCardAvatarImage instanceof HTMLImageElement) {
    playerCardAvatarImage.hidden = true;
    playerCardAvatarImage.removeAttribute('src');
  }

  if (playerCardAvatarFallback instanceof HTMLElement) {
    playerCardAvatarFallback.hidden = false;
  }
};

const resetPlayerCardAvatarFrame = () => {
  if (playerCardAvatarFrameImage instanceof HTMLImageElement) {
    playerCardAvatarFrameImage.hidden = true;
    playerCardAvatarFrameImage.removeAttribute('src');
  }
};

const setPlayerCardAvatar = (source) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  if (!(playerCardAvatarImage instanceof HTMLImageElement)) {
    return;
  }

  if (!normalizedSource) {
    resetPlayerCardAvatar();
    return;
  }

  playerCardAvatarImage.hidden = false;
  playerCardAvatarImage.src = normalizedSource;
  if (playerCardAvatarFallback instanceof HTMLElement) {
    playerCardAvatarFallback.hidden = true;
  }
};

const setPlayerCardAvatarFrame = (source) => {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  if (!(playerCardAvatarFrameImage instanceof HTMLImageElement)) {
    return;
  }

  if (!normalizedSource) {
    resetPlayerCardAvatarFrame();
    return;
  }

  playerCardAvatarFrameImage.hidden = false;
  playerCardAvatarFrameImage.src = normalizedSource;
};

const setPlayerProfileState = (message, tone = '') => {
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

const setPlayerProfileSummaryMessage = (message, tone = '') => {
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

const clearPlayerProfileSummaryMessage = () => {
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

const showPlayerProfile = () => {
  if (databasePlayerProfileState instanceof HTMLElement) {
    databasePlayerProfileState.hidden = true;
  }

  if (databasePlayerProfileShell instanceof HTMLElement) {
    databasePlayerProfileShell.hidden = false;
  }
};

const resetPlayerProfileView = () => {
  playerProfileData = null;
  playerProfileEditState = null;
  clearPlayerProfileSummaryMessage();

  if (playerCardName instanceof HTMLElement) {
    playerCardName.textContent = '--';
  }

  if (playerCardInlineUid instanceof HTMLElement) {
    playerCardInlineUid.textContent = `UID ${selectedAccountUid ?? '--'}`;
  }

  if (playerCardGender instanceof HTMLElement) {
    playerCardGender.textContent = '--';
  }

  if (playerCardLevel instanceof HTMLElement) {
    playerCardLevel.textContent = '--';
  }

  if (playerCardLikes instanceof HTMLElement) {
    playerCardLikes.textContent = '--';
  }

  if (playerCardExp instanceof HTMLElement) {
    playerCardExp.textContent = '0';
  }

  resetPlayerCardAvatarFrame();
  resetPlayerCardAvatar();
  syncPlayerEditableStates();
};

const renderPlayerProfile = (profile) => {
  playerProfileData = profile;
  playerProfileEditState = null;
  clearPlayerProfileSummaryMessage();

  const genderLabel = getPlayerGenderLabel(profile?.gender ?? null);
  const levelLabel = formatPlayerFieldValue(profile?.level);
  const nameLabel = formatPlayerFieldValue(profile?.name);
  const likesLabel = formatPlayerFieldValue(profile?.likes);
  const profileUid = normalizeAccountUid(profile?.uid ?? selectedAccountUid);

  if (playerCardName instanceof HTMLElement) {
    playerCardName.textContent = nameLabel;
  }

  if (playerCardInlineUid instanceof HTMLElement) {
    playerCardInlineUid.textContent = `UID ${profileUid ?? '--'}`;
  }

  if (playerCardGender instanceof HTMLElement) {
    playerCardGender.textContent = genderLabel;
  }

  if (playerCardLevel instanceof HTMLElement) {
    playerCardLevel.textContent = levelLabel;
  }

  if (playerCardLikes instanceof HTMLElement) {
    playerCardLikes.textContent = likesLabel;
  }

  if (playerCardExp instanceof HTMLElement) {
    playerCardExp.textContent = '0';
  }

  setPlayerCardAvatar(getPlayerPortraitUrlByField('head_portrait_id', profile?.head_portrait_id ?? null));
  setPlayerCardAvatarFrame(getPlayerPortraitUrlByField('head_frame_id', profile?.head_frame_id ?? null));
  syncPlayerEditableStates();

  showPlayerProfile();
};

const canAccessPlayerProfile = (payload = databaseHealthSnapshot) => isDatabaseHealthy(payload) && selectedAccountUid !== null;

const updatePlayerProfileAccess = (payload = databaseHealthSnapshot) => {
  const healthy = isDatabaseHealthy(payload);
  const accessible = canAccessPlayerProfile(payload);
  let summaryMessage = '';

  if (databasePlayerProfileSubnavButton instanceof HTMLButtonElement) {
    databasePlayerProfileSubnavButton.disabled = !accessible;
    if (!healthy) {
      databasePlayerProfileSubnavButton.title = '仅在数据库服务正常时允许查看玩家信息';
    } else if (selectedAccountUid === null) {
      databasePlayerProfileSubnavButton.title = '请先在账号管理中选定一个用户';
    } else {
      databasePlayerProfileSubnavButton.title = '';
    }
  }

  if (databasePlayerProfileSummary instanceof HTMLElement) {
    const summaryMeta = databasePlayerProfileSummary.parentElement;
    if (!healthy) {
      summaryMessage = '仅在数据库服务正常时可查看';
    } else if (selectedAccountUid === null) {
      summaryMessage = '请先在账号管理中选定一个用户';
    } else if (playerProfileLoading) {
      summaryMessage = '正在加载玩家资料...';
    }

    databasePlayerProfileSummary.textContent = summaryMessage;
    databasePlayerProfileSummary.hidden = summaryMessage.length <= 0;
    if (summaryMeta instanceof HTMLElement) {
      summaryMeta.hidden = summaryMessage.length <= 0;
    }
  }

  if (!(healthy && selectedAccountUid !== null)) {
    resetPlayerProfileView();
  }

  if (!healthy) {
    setPlayerProfileState('数据库服务正常后可查看玩家信息。', 'is-muted');
    if (isDatabasePlayerProfileSectionActive()) {
      setActiveDatabaseTab('database-service-status-section');
    }
    return;
  }

  if (selectedAccountUid === null) {
    setPlayerProfileState('请先在账号管理中选定一个用户。', 'is-muted');
    if (isDatabasePlayerProfileSectionActive()) {
      setActiveDatabaseTab('database-accounts-section');
    }
    return;
  }

  if (!playerProfileData) {
    setPlayerProfileState(playerProfileLoading ? '正在加载玩家资料...' : '进入该分栏后可查看当前选定用户的玩家资料。', playerProfileLoading ? 'is-loading' : 'is-muted');
  }
};

const loadSelectedPlayerProfile = async () => {
  if (!canAccessPlayerProfile() || playerProfileLoading) {
    updatePlayerProfileAccess();
    return;
  }

  playerProfileLoading = true;
  updatePlayerProfileAccess();
  setPlayerProfileState('正在加载玩家资料...', 'is-loading');

  try {
    const response = await fetch('/api/database-players/selected', { credentials: 'include' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '加载玩家信息失败');
    }

    renderPlayerProfile(payload);
  } catch (error) {
    playerProfileData = null;
    setPlayerProfileState(error instanceof Error ? error.message : '加载玩家信息失败', 'is-error');
  } finally {
    playerProfileLoading = false;
    updatePlayerProfileAccess();
  }
};

const renderSelectedAccountBadge = () => {
  if (databaseSelectedAccountLabel instanceof HTMLElement) {
    databaseSelectedAccountLabel.textContent = `已选定用户：${selectedAccountUid ?? '--'}`;
  }
};

const updateAccountSelectionUi = () => {
  if (databaseAccountsBody instanceof HTMLElement) {
    Array.from(databaseAccountsBody.querySelectorAll('[data-account-action="select"]')).forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const uid = normalizeAccountUid(button.dataset.accountUid);
      const isSelected = uid !== null && uid === selectedAccountUid;
      const isPending = uid !== null && uid === accountSelectionPendingUid;

      button.textContent = isSelected ? '已选定' : (isPending ? '选定中...' : '选定');
      button.disabled = isSelected || isPending || accountSelectionPendingUid !== null;
      button.classList.toggle('is-selected', isSelected);
    });
  }

  renderSelectedAccountBadge();
};

const setSelectedAccountUid = (uid) => {
  selectedAccountUid = normalizeAccountUid(uid);
  updateAccountSelectionUi();
  resetPlayerProfileView();
  updatePlayerProfileAccess();
  if (isDatabasePlayerProfileSectionActive() && canAccessPlayerProfile()) {
    void loadSelectedPlayerProfile();
  }
};

const clearSelectedAccount = async () => {
  try {
    const response = await fetch('/api/database-accounts/selection', {
      method: 'DELETE',
      credentials: 'include',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '清空已选定用户失败');
    }

    setSelectedAccountUid(payload?.selected_uid ?? null);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '清空已选定用户失败');
  }
};

const setAccountPasswordFeedback = (message, tone = '') => {
  if (!(accountPasswordFeedback instanceof HTMLElement)) {
    return;
  }

  accountPasswordFeedback.textContent = message;
  accountPasswordFeedback.className = 'account-password-feedback';
  if (tone) {
    accountPasswordFeedback.classList.add(tone);
  }
};

const resetAccountPasswordForm = () => {
  if (accountPasswordInput instanceof HTMLInputElement) {
    accountPasswordInput.value = '';
  }
  if (accountPasswordConfirmInput instanceof HTMLInputElement) {
    accountPasswordConfirmInput.value = '';
  }
  setAccountPasswordFeedback('密码长度需大于等于 6 位。');
};

const closeAccountPasswordModal = () => {
  pendingPasswordAccount = null;
  resetAccountPasswordForm();
  if (!(accountPasswordModal instanceof HTMLElement) || accountPasswordModal.hidden) {
    return;
  }

  accountPasswordModal.hidden = true;
  document.body.classList.remove('login-modal-open');

  if (lastPasswordFocusedControl instanceof HTMLElement) {
    lastPasswordFocusedControl.focus();
  }
};

const openAccountPasswordModal = (account, trigger) => {
  if (!(accountPasswordModal instanceof HTMLElement)) {
    return;
  }

  pendingPasswordAccount = account;
  lastPasswordFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  if (accountPasswordTarget instanceof HTMLElement) {
    const username = typeof account?.username === 'string' && account.username ? account.username : '--';
    accountPasswordTarget.textContent = `目标账户：UID ${account.uid ?? '--'}（用户名 ${username}）`;
  }
  resetAccountPasswordForm();
  accountPasswordModal.hidden = false;
  document.body.classList.add('login-modal-open');

  if (accountPasswordInput instanceof HTMLInputElement) {
    accountPasswordInput.focus();
  }
};

const getAccountPasswordValidationMessage = () => {
  const password = accountPasswordInput instanceof HTMLInputElement ? accountPasswordInput.value : '';
  const confirmPassword = accountPasswordConfirmInput instanceof HTMLInputElement ? accountPasswordConfirmInput.value : '';

  if (password.length < 6) {
    return { valid: false, message: '新密码长度必须大于等于 6 位。' };
  }

  if (password !== confirmPassword) {
    return { valid: false, message: '两次输入的密码不一致。' };
  }

  return { valid: true, message: '密码校验通过，可以提交。' };
};

const updateAccountPasswordValidationState = () => {
  const validation = getAccountPasswordValidationMessage();
  setAccountPasswordFeedback(validation.message, validation.valid ? 'is-valid' : 'is-error');
  return validation.valid;
};

const submitAccountPasswordReset = async () => {
  if (!pendingPasswordAccount || !(accountPasswordConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  const valid = updateAccountPasswordValidationState();
  if (!valid) {
    return;
  }

  const targetUid = pendingPasswordAccount.uid;
  const password = accountPasswordInput instanceof HTMLInputElement ? accountPasswordInput.value : '';
  accountPasswordConfirmButton.disabled = true;

  try {
    const response = await fetch('/api/database-accounts/password', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: pendingPasswordAccount.uid,
        password,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '重置密码失败');
    }

    closeAccountPasswordModal();
    openSuccessModal(`UID ${targetUid} 的密码已重置。`, '密码重置成功');
  } catch (error) {
    setAccountPasswordFeedback(error instanceof Error ? error.message : '重置密码失败', 'is-error');
  } finally {
    accountPasswordConfirmButton.disabled = false;
  }
};

const closeAccountDeleteModal = () => {
  pendingDeleteAccount = null;
  if (!(accountDeleteModal instanceof HTMLElement) || accountDeleteModal.hidden) {
    return;
  }

  accountDeleteModal.hidden = true;
  document.body.classList.remove('login-modal-open');

  if (lastDeleteFocusedControl instanceof HTMLElement) {
    lastDeleteFocusedControl.focus();
  }
};

const openAccountDeleteModal = (account, trigger) => {
  if (!(accountDeleteModal instanceof HTMLElement) || !(accountDeleteMessage instanceof HTMLElement)) {
    return;
  }

  pendingDeleteAccount = account;
  lastDeleteFocusedControl = trigger instanceof HTMLElement ? trigger : document.activeElement;
  const username = typeof account?.username === 'string' && account.username ? account.username : '--';
  accountDeleteMessage.textContent = `确认删除 UID ${account.uid ?? '--'}（用户名 ${username}）吗？`;
  accountDeleteModal.hidden = false;
  document.body.classList.add('login-modal-open');

  if (accountDeleteConfirmButton instanceof HTMLButtonElement) {
    accountDeleteConfirmButton.focus();
  }
};

const removeAccountRow = (uid) => {
  if (!(databaseAccountsBody instanceof HTMLElement)) {
    return;
  }

  const row = databaseAccountsBody.querySelector(`button[data-account-action="select"][data-account-uid="${uid}"]`)?.closest('tr');
  if (row instanceof HTMLElement) {
    row.remove();
  }

  const remainingRows = databaseAccountsBody.querySelectorAll('tr').length;
  if (remainingRows === 0) {
    setAccountsState('当前页账户已全部移除，重新进入账号管理后可重新加载。', 'is-empty');
  }

  updateAccountSelectionUi();
};

const confirmDeleteAccount = async () => {
  if (!pendingDeleteAccount || !(accountDeleteConfirmButton instanceof HTMLButtonElement)) {
    return;
  }

  const targetUid = pendingDeleteAccount.uid;
  accountDeleteConfirmButton.disabled = true;

  try {
    if (normalizeAccountUid(pendingDeleteAccount.uid) === selectedAccountUid) {
      await clearSelectedAccount();
    }

    removeAccountRow(pendingDeleteAccount.uid);
    closeAccountDeleteModal();
    openSuccessModal(`UID ${targetUid} 已从当前列表移除。`, '删除完成');
  } catch (error) {
    closeAccountDeleteModal();
    openControlModal(error instanceof Error ? error.message : '删除账户失败');
  } finally {
    accountDeleteConfirmButton.disabled = false;
  }
};

const setActiveDatabaseTab = (tabId) => {
  let matched = false;

  databaseTabButtons.forEach((button) => {
    const isActive = button.dataset.databaseTab === tabId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      matched = true;
    }
  });

  databaseTabPanels.forEach((panel) => {
    const isActive = panel.dataset.databaseTabPanel === tabId;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  if (!matched && databaseTabButtons.length > 0) {
    const fallback = databaseTabButtons[0].dataset.databaseTab;
    if (fallback && fallback !== tabId) {
      setActiveDatabaseTab(fallback);
    }
  }
};

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

  if (controlModalIcon instanceof HTMLElement) {
    controlModalIcon.textContent = '!';
    controlModalIcon.classList.remove('is-success');
  }

  if (controlModalEyebrow instanceof HTMLElement) {
    controlModalEyebrow.textContent = '提示';
    controlModalEyebrow.classList.remove('is-success');
  }

  if (lastFocusedControl instanceof HTMLElement) {
    lastFocusedControl.focus();
  }
};

const openControlModal = (message, options = {}) => {
  if (!controlModal || !controlModalMessage) {
    return;
  }

  const titleElement = controlModal.querySelector('#server-modal-title');
  const {
    title = '操作提示',
    eyebrow = '提示',
    icon = '!',
    tone = 'default',
  } = options;

  lastFocusedControl = document.activeElement;
  if (titleElement instanceof HTMLElement) {
    titleElement.textContent = title;
  }
  if (controlModalIcon instanceof HTMLElement) {
    controlModalIcon.textContent = icon;
    controlModalIcon.classList.toggle('is-success', tone === 'success');
  }
  if (controlModalEyebrow instanceof HTMLElement) {
    controlModalEyebrow.textContent = eyebrow;
    controlModalEyebrow.classList.toggle('is-success', tone === 'success');
  }
  controlModalMessage.textContent = message;
  controlModal.hidden = false;
  document.body.classList.add('login-modal-open');

  const primaryButton = controlModal.querySelector('.login-modal-button');
  if (primaryButton instanceof HTMLElement) {
    primaryButton.focus();
  }
};

const openSuccessModal = (message, title = '操作成功') => {
  openControlModal(message, {
    title,
    eyebrow: '操作成功',
    icon: '✓',
    tone: 'success',
  });
};

const closeLogoutConfirmModal = () => {
  if (!(logoutConfirmModal instanceof HTMLElement) || logoutConfirmModal.hidden) {
    return;
  }

  logoutConfirmModal.hidden = true;
  document.body.classList.remove('login-modal-open');

  if (logoutButton instanceof HTMLButtonElement) {
    logoutButton.disabled = false;
    logoutButton.textContent = '退出登录';
  }

  if (lastLogoutFocusedControl instanceof HTMLElement) {
    lastLogoutFocusedControl.focus();
  }
};

const openLogoutConfirmModal = () => {
  if (!(logoutConfirmModal instanceof HTMLElement)) {
    return;
  }

  lastLogoutFocusedControl = document.activeElement;
  logoutConfirmModal.hidden = false;
  document.body.classList.add('login-modal-open');

  if (logoutConfirmSubmitButton instanceof HTMLButtonElement) {
    logoutConfirmSubmitButton.focus();
  }
};

const submitLogout = async () => {
  if (!(logoutConfirmSubmitButton instanceof HTMLButtonElement)) {
    return;
  }

  logoutConfirmSubmitButton.disabled = true;
  if (logoutButton instanceof HTMLButtonElement) {
    logoutButton.disabled = true;
    logoutButton.textContent = '正在退出...';
  }

  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    window.location.assign('/login');
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

const setActiveDashboardPage = (pageKey) => {
  let matched = false;

  sidebarLinks.forEach((link) => {
    const isActive = link.dataset.dashboardPage === pageKey;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      matched = true;
    }
  });

  dashboardPages.forEach((page) => {
    const isActive = page.dataset.dashboardPanel === pageKey;
    page.classList.toggle('is-active', isActive);
    page.hidden = !isActive;
  });

  if (!matched && sidebarLinks.length > 0) {
    const fallbackPage = sidebarLinks[0].dataset.dashboardPage;
    if (fallbackPage && fallbackPage !== pageKey) {
      setActiveDashboardPage(fallbackPage);
    }
  }
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

  sidebarLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = event.currentTarget;
      const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') : null;
      const pageKey = target instanceof HTMLElement ? target.dataset.dashboardPage : null;

      if (pageKey) {
        event.preventDefault();
        setActiveDashboardPage(pageKey);
        closeSidebar();
        focusContentStart();
        return;
      }

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
    openLogoutConfirmModal();
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

const updateDatabaseHealthCheckLabel = () => {
  if (!databaseIntervalLabel) {
    return;
  }

  if (typeof nextDatabaseHealthCheckAtMs !== 'number') {
    databaseIntervalLabel.textContent = '距离下次健康检查: --';
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((nextDatabaseHealthCheckAtMs - Date.now()) / 1000));
  databaseIntervalLabel.textContent = `距离下次健康检查: ${remainingSeconds}s`;
};

const setAccountsState = (message, tone = '') => {
  if (databaseAccountsState instanceof HTMLElement) {
    databaseAccountsState.textContent = message;
    databaseAccountsState.className = 'accounts-state';
    if (tone) {
      databaseAccountsState.classList.add(tone);
    }
    databaseAccountsState.hidden = false;
  }

  if (databaseAccountsTableShell instanceof HTMLElement) {
    databaseAccountsTableShell.hidden = true;
  }
};

const showAccountsTable = () => {
  if (databaseAccountsState instanceof HTMLElement) {
    databaseAccountsState.hidden = true;
  }

  if (databaseAccountsTableShell instanceof HTMLElement) {
    databaseAccountsTableShell.hidden = false;
  }
};

const updateAccountsPagination = () => {
  if (databaseAccountsPaginationLabel instanceof HTMLElement) {
    databaseAccountsPaginationLabel.textContent = `第 ${accountsTotalPages === 0 ? 0 : accountsCurrentPage} / ${accountsTotalPages} 页`;
  }

  if (databaseAccountsPrevButton instanceof HTMLButtonElement) {
    databaseAccountsPrevButton.disabled = accountsLoading || accountsCurrentPage <= 1 || accountsTotalPages === 0 || !isDatabaseHealthy();
  }

  if (databaseAccountsNextButton instanceof HTMLButtonElement) {
    databaseAccountsNextButton.disabled = accountsLoading || accountsTotalPages === 0 || accountsCurrentPage >= accountsTotalPages || !isDatabaseHealthy();
  }
};

const renderAccountRows = (items) => {
  if (!(databaseAccountsBody instanceof HTMLElement)) {
    return;
  }

  databaseAccountsBody.innerHTML = items.map((item) => `
    <tr>
      <td>${item?.uid ?? '--'}</td>
      <td>${item?.username ?? '--'}</td>
      <td>
        <div class="accounts-row-actions">
          <button class="status-action-button status-action-button-log" type="button" data-account-action="select" data-account-uid="${item?.uid ?? ''}">选定</button>
          <button class="status-action-button status-action-button-config" type="button" data-account-action="password" data-account-uid="${item?.uid ?? ''}" data-account-username="${item?.username ?? ''}">重置密码</button>
          <button class="status-action-button status-action-button-stop" type="button" data-account-action="delete" data-account-uid="${item?.uid ?? ''}" data-account-username="${item?.username ?? ''}">删除</button>
        </div>
      </td>
    </tr>
  `).join('');

  updateAccountSelectionUi();
};

const loadSelectedAccount = async () => {
  try {
    const response = await fetch('/api/database-accounts/selection', { credentials: 'include' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '加载已选定用户失败');
    }

    setSelectedAccountUid(payload?.selected_uid ?? null);
  } catch {
    setSelectedAccountUid(null);
  }
};

const selectDatabaseAccount = async (uid) => {
  const normalizedUid = normalizeAccountUid(uid);
  if (normalizedUid === null || accountSelectionPendingUid !== null) {
    return;
  }

  if (!isDatabaseHealthy()) {
    openControlModal('数据库服务未处于正常状态，暂时无法选定账户。');
    return;
  }

  accountSelectionPendingUid = normalizedUid;
  updateAccountSelectionUi();

  try {
    const response = await fetch('/api/database-accounts/selection', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: normalizedUid }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '选定账户失败');
    }

    setSelectedAccountUid(payload?.selected_uid ?? normalizedUid);
  } catch (error) {
    openControlModal(error instanceof Error ? error.message : '选定账户失败');
  } finally {
    accountSelectionPendingUid = null;
    updateAccountSelectionUi();
  }
};

const updateDatabaseAccountsAccess = (payload = databaseHealthSnapshot) => {
  const healthy = isDatabaseHealthy(payload);

  if (databaseAccountsSubnavButton instanceof HTMLButtonElement) {
    databaseAccountsSubnavButton.disabled = !healthy;
    databaseAccountsSubnavButton.title = healthy ? '' : '仅在数据库服务正常时允许查看账号管理';
  }

  if (databaseAccountsSummary instanceof HTMLElement) {
    databaseAccountsSummary.textContent = healthy
      ? (accountsHasLoaded ? '账户列表已加载，每页 25 条' : '数据库服务正常，可查看账户列表')
      : '仅在数据库服务正常时可查看';
  }

  if (!healthy) {
    accountsTotalPages = 0;
    updateAccountsPagination();
    if (databaseAccountsBody instanceof HTMLElement) {
      databaseAccountsBody.innerHTML = '';
    }
    setAccountsState('数据库服务正常后可查看账户列表。', 'is-muted');

    if (isDatabaseAccountsSectionActive()) {
      setActiveDatabaseTab('database-service-status-section');
    }
    updatePlayerProfileAccess(payload);
    return;
  }

  updateAccountsPagination();
  updatePlayerProfileAccess(payload);
};

const handleAccountActionClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('[data-account-action]');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const labels = {
    select: '选定',
    password: '重置密码',
    delete: '删除',
  };
  if (button.dataset.accountAction === 'select') {
    void selectDatabaseAccount(button.dataset.accountUid);
    return;
  }

  if (button.dataset.accountAction === 'password') {
    openAccountPasswordModal({
      uid: normalizeAccountUid(button.dataset.accountUid),
      username: button.dataset.accountUsername ?? '',
    }, button);
    return;
  }

  if (button.dataset.accountAction === 'delete') {
    openAccountDeleteModal({
      uid: normalizeAccountUid(button.dataset.accountUid),
      username: button.dataset.accountUsername ?? '',
    }, button);
    return;
  }

  const action = labels[button.dataset.accountAction] ?? '该操作';
  openControlModal(`${action} 功能暂未接入后端逻辑。`);
};

const loadDatabaseAccounts = async (page = 1) => {
  if (!isDatabaseHealthy() || accountsLoading) {
    updateAccountsPagination();
    return;
  }

  accountsLoading = true;
  accountsCurrentPage = Math.max(1, page);
  updateAccountsPagination();
  setAccountsState('正在加载账户列表...', 'is-loading');

  try {
    const response = await fetch(`/api/database-accounts?page=${accountsCurrentPage}&page_size=25`, { credentials: 'include' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.detail || '加载账户列表失败');
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    accountsCurrentPage = typeof payload?.page === 'number' ? payload.page : accountsCurrentPage;
    accountsTotalPages = typeof payload?.total_pages === 'number' ? payload.total_pages : 0;
    accountsHasLoaded = true;

    if (databaseAccountsSummary instanceof HTMLElement) {
      const total = typeof payload?.total === 'number' ? payload.total : items.length;
      databaseAccountsSummary.textContent = `共 ${total} 个账户，每页 25 条`;
    }

    if (items.length === 0) {
      if (databaseAccountsBody instanceof HTMLElement) {
        databaseAccountsBody.innerHTML = '';
      }
      setAccountsState('暂无账户数据。', 'is-empty');
    } else {
      renderAccountRows(items);
      showAccountsTable();
    }
  } catch (error) {
    accountsTotalPages = 0;
    if (databaseAccountsBody instanceof HTMLElement) {
      databaseAccountsBody.innerHTML = '';
    }
    setAccountsState(error instanceof Error ? error.message : '加载账户列表失败', 'is-error');
  } finally {
    accountsLoading = false;
    updateAccountsPagination();
  }
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
  latestStatusSnapshot = payload;
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

const renderDatabaseSnapshot = (payload) => {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const databaseSection = sections.find((section) => section.key === 'database') ?? sections[0];
  const wasHealthy = isDatabaseHealthy(databaseHealthSnapshot);
  databaseHealthSnapshot = payload;

  if (typeof payload?.interval_seconds === 'number') {
    nextDatabaseHealthCheckAtMs = Date.now() + payload.interval_seconds * 1000;
    updateDatabaseHealthCheckLabel();
  }

  renderGrid(databaseGrid, databaseSection);
  updateDatabaseAccountsAccess(payload);
  if (!wasHealthy && isDatabaseHealthy(payload) && isDatabaseAccountsSectionActive()) {
    loadDatabaseAccounts(accountsCurrentPage);
  }
  if (isDatabaseHealthy(payload) && selectedAccountUid !== null && isDatabasePlayerProfileSectionActive()) {
    loadSelectedPlayerProfile();
  }
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
    playerPortraitUrlMap = payload?.player_portrait_url_map && typeof payload.player_portrait_url_map === 'object' ? payload.player_portrait_url_map : {};
    playerPortraitFrameUrlMap = payload?.player_portrait_frame_url_map && typeof payload.player_portrait_frame_url_map === 'object' ? payload.player_portrait_frame_url_map : {};
    playerPortraitNameMap = payload?.player_portrait_name_map && typeof payload.player_portrait_name_map === 'object' ? payload.player_portrait_name_map : {};
    playerPortraitFrameNameMap = payload?.player_portrait_frame_name_map && typeof payload.player_portrait_frame_name_map === 'object' ? payload.player_portrait_frame_name_map : {};
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

const loadDatabaseStatus = async () => {
  try {
    const response = await fetch('/api/database-status', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('加载数据库状态失败');
    }

    const payload = await response.json();
    renderDatabaseSnapshot(payload);

    return typeof payload?.interval_seconds === 'number' ? payload.interval_seconds : 60;
  } catch (error) {
    databaseHealthSnapshot = null;
    nextDatabaseHealthCheckAtMs = null;
    updateDatabaseHealthCheckLabel();
    renderGrid(databaseGrid, { services: [] });
    updateDatabaseAccountsAccess(null);
    window.requestAnimationFrame(updateAllHistoryGridVisibility);
    return 60;
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

accountDeleteCloseTargets.forEach((target) => {
  target.addEventListener('click', closeAccountDeleteModal);
});

accountPasswordCloseTargets.forEach((target) => {
  target.addEventListener('click', closeAccountPasswordModal);
});

logoutConfirmCloseTargets.forEach((target) => {
  target.addEventListener('click', closeLogoutConfirmModal);
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

if (accountDeleteConfirmButton instanceof HTMLButtonElement) {
  accountDeleteConfirmButton.addEventListener('click', () => {
    void confirmDeleteAccount();
  });
}

if (accountPasswordConfirmButton instanceof HTMLButtonElement) {
  accountPasswordConfirmButton.addEventListener('click', () => {
    void submitAccountPasswordReset();
  });
}

if (logoutConfirmSubmitButton instanceof HTMLButtonElement) {
  logoutConfirmSubmitButton.addEventListener('click', () => {
    void submitLogout();
  });
}

if (accountPasswordInput instanceof HTMLInputElement) {
  accountPasswordInput.addEventListener('input', updateAccountPasswordValidationState);
}

if (accountPasswordConfirmInput instanceof HTMLInputElement) {
  accountPasswordConfirmInput.addEventListener('input', updateAccountPasswordValidationState);
}

if (databaseAccountsBody instanceof HTMLElement) {
  databaseAccountsBody.addEventListener('click', handleAccountActionClick);
}

if (databasePlayerProfileShell instanceof HTMLElement) {
  databasePlayerProfileShell.addEventListener('click', handlePlayerProfileFieldActivate);
  databasePlayerProfileShell.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
      return;
    }

    event.preventDefault();
    handlePlayerProfileFieldActivate(event);
  });
}

if (playerCardAvatarImage instanceof HTMLImageElement) {
  playerCardAvatarImage.addEventListener('error', () => {
    resetPlayerCardAvatar();
  });
}

if (playerCardAvatarFrameImage instanceof HTMLImageElement) {
  playerCardAvatarFrameImage.addEventListener('error', () => {
    resetPlayerCardAvatarFrame();
  });
}

if (playerCardAvatarShell instanceof HTMLElement) {
  playerCardAvatarShell.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('.database-player-card-avatar-ring')) {
      return;
    }

    openPlayerPortraitPicker('head_portrait_id');
  });
}

if (playerCardAvatarRing instanceof HTMLElement) {
  playerCardAvatarRing.addEventListener('click', (event) => {
    event.stopPropagation();
    openPlayerPortraitPicker('head_frame_id');
  });
}

if (playerCardAvatarImage instanceof HTMLElement) {
  playerCardAvatarImage.addEventListener('click', (event) => {
    event.stopPropagation();
    openPlayerPortraitPicker('head_portrait_id');
  });
}

if (playerCardAvatarFrameImage instanceof HTMLElement) {
  playerCardAvatarFrameImage.addEventListener('click', (event) => {
    event.stopPropagation();
    openPlayerPortraitPicker('head_frame_id');
  });
}

playerPortraitPickerCloseTargets.forEach((target) => {
  target.addEventListener('click', closePlayerPortraitPicker);
});

if (playerPortraitPickerGrid instanceof HTMLElement) {
  playerPortraitPickerGrid.addEventListener('click', handlePlayerPortraitPickerClick);
}

if (playerPortraitPickerConfirmButton instanceof HTMLButtonElement) {
  playerPortraitPickerConfirmButton.addEventListener('click', () => {
    void submitPlayerPortraitPicker();
  });
}

if (playerPortraitPickerCancelButton instanceof HTMLButtonElement) {
  playerPortraitPickerCancelButton.addEventListener('click', closePlayerPortraitPicker);
}

if (playerPortraitPickerModal instanceof HTMLElement) {
  playerPortraitPickerModal.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target === playerPortraitPickerModal || target.classList.contains('login-modal-backdrop')) {
      closePlayerPortraitPicker();
    }
  });
}

if (playerPortraitPickerModal instanceof HTMLElement) {
  playerPortraitPickerModal.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('[data-player-portrait-id]')) {
      event.preventDefault();
      void submitPlayerPortraitPicker();
    }
  });
}

if (databaseAccountsPrevButton instanceof HTMLButtonElement) {
  databaseAccountsPrevButton.addEventListener('click', () => {
    if (accountsCurrentPage > 1) {
      loadDatabaseAccounts(accountsCurrentPage - 1);
    }
  });
}

if (databaseAccountsNextButton instanceof HTMLButtonElement) {
  databaseAccountsNextButton.addEventListener('click', () => {
    if (accountsCurrentPage < accountsTotalPages) {
      loadDatabaseAccounts(accountsCurrentPage + 1);
    }
  });
}

databaseTabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button instanceof HTMLButtonElement && button.disabled) {
      return;
    }

    const tabId = button.dataset.databaseTab;
    if (!tabId) {
      return;
    }

    setActiveDatabaseTab(tabId);
    if (tabId === 'database-accounts-section' && isDatabaseHealthy()) {
      loadDatabaseAccounts(accountsCurrentPage);
      return;
    }

    if (tabId === 'database-player-profile-section' && canAccessPlayerProfile()) {
      loadSelectedPlayerProfile();
    }
  });
});

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
    closeAccountDeleteModal();
    closeAccountPasswordModal();
    closeLogoutConfirmModal();
    closePlayerPortraitPicker();
  }
});

const scheduleReload = async () => {
  await loadAppInfo();

  const intervalSeconds = await loadStatus();
  await loadDatabaseStatus();
  await loadSelectedAccount();
  if (timerId) {
    window.clearInterval(timerId);
  }

  timerId = window.setInterval(() => {
    loadStatus();
    loadDatabaseStatus();
  }, Math.max(5, intervalSeconds) * 1000);
};

updateNextHealthCheckLabel();
updateDatabaseHealthCheckLabel();
renderSelectedAccountBadge();
resetPlayerProfileView();
countdownTimerId = window.setInterval(() => {
  updateNextHealthCheckLabel();
  updateDatabaseHealthCheckLabel();
}, 1000);
setConfigEditorValue('');
setActiveDashboardPage('server-management');
setActiveDatabaseTab('database-service-status-section');
updateDatabaseAccountsAccess(null);
scheduleReload();
