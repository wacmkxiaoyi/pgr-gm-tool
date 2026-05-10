import { ApiError, apiFetch, getLocale, getLocalizedApiErrorMessage, resolveUiTextToken, subscribeLocaleChange, t } from '../i18n.js';

const selectAll = (selector) => Array.from(document.querySelectorAll(selector));

export const dom = {
  logoutButton: document.querySelector('.logout-button'),
  layout: document.querySelector('.dashboard-layout'),
  dashboardMain: document.querySelector('.dashboard-main'),
  sidebarToggle: document.querySelector('.sidebar-toggle'),
  sidebar: document.querySelector('#dashboard-sidebar'),
  sidebarLinks: selectAll('[data-dashboard-page]'),
  dashboardPages: selectAll('[data-dashboard-panel]'),
  sdkGrid: document.querySelector('#sdk-status-grid'),
  gameGrid: document.querySelector('#game-status-grid'),
  databaseGrid: document.querySelector('#database-status-grid'),
  databaseAccountsSubnavButton: document.querySelector('#database-accounts-subnav'),
  databasePlayerProfileSubnavButton: document.querySelector('#database-player-profile-subnav'),
  databaseCharacterManagementSubnavButton: document.querySelector('#database-character-management-subnav'),
  databaseWeaponManagementSubnavButton: document.querySelector('#database-weapon-management-subnav'),
  databaseMemoryManagementSubnavButton: document.querySelector('#database-memory-management-subnav'),
  databaseItemManagementSubnavButton: document.querySelector('#database-item-management-subnav'),
  databaseTabButtons: selectAll('[data-database-tab]'),
  databaseTabPanels: selectAll('[data-database-tab-panel]'),
  databaseAccountsState: document.querySelector('#database-accounts-state'),
  databaseAccountsTableShell: document.querySelector('#database-accounts-table-shell'),
  databaseAccountsBody: document.querySelector('#database-accounts-body'),
  databaseAccountsSummary: document.querySelector('#database-accounts-summary'),
  databaseAccountsPrevButton: document.querySelector('#database-accounts-prev'),
  databaseAccountsNextButton: document.querySelector('#database-accounts-next'),
  databaseAccountsPaginationLabel: document.querySelector('#database-accounts-pagination'),
  databaseAccountsJumpInput: document.querySelector('#database-accounts-jump-input'),
  databaseAccountsJumpButton: document.querySelector('#database-accounts-jump-button'),
  databaseAccountsSearchInput: document.querySelector('#database-accounts-search-input'),
  databaseSelectedAccountLabel: document.querySelector('#database-selected-account'),
  databasePlayerProfileState: document.querySelector('#database-player-profile-state'),
  databasePlayerProfileShell: document.querySelector('#database-player-profile-shell'),
  databasePlayerProfileSummary: document.querySelector('#database-player-profile-summary'),
  databaseCharacterManagementState: document.querySelector('#database-character-management-state'),
  databaseCharacterManagementShell: document.querySelector('#database-character-management-shell'),
  databaseCharacterManagementTableShell: document.querySelector('#database-character-management-table-shell'),
  databaseCharacterManagementBody: document.querySelector('#database-character-management-body'),
  databaseCharacterManagementSummary: document.querySelector('#database-character-management-summary'),
  databaseCharacterManagementPrevButton: document.querySelector('#database-character-management-prev'),
  databaseCharacterManagementNextButton: document.querySelector('#database-character-management-next'),
  databaseCharacterManagementPaginationLabel: document.querySelector('#database-character-management-pagination'),
  databaseCharacterManagementJumpInput: document.querySelector('#database-character-management-jump-input'),
  databaseCharacterManagementJumpButton: document.querySelector('#database-character-management-jump-button'),
  databaseCharacterManagementActions: document.querySelector('#database-character-actions'),
  databaseCharacterSearchInput: document.querySelector('#database-character-search-input'),
  databaseWeaponManagementState: document.querySelector('#database-weapon-management-state'),
  databaseWeaponManagementShell: document.querySelector('#database-weapon-management-shell'),
  databaseWeaponManagementTableShell: document.querySelector('#database-weapon-management-table-shell'),
  databaseWeaponManagementBody: document.querySelector('#database-weapon-management-body'),
  databaseWeaponManagementSummary: document.querySelector('#database-weapon-management-summary'),
  databaseWeaponManagementPrevButton: document.querySelector('#database-weapon-management-prev'),
  databaseWeaponManagementNextButton: document.querySelector('#database-weapon-management-next'),
  databaseWeaponManagementPaginationLabel: document.querySelector('#database-weapon-management-pagination'),
  databaseWeaponManagementJumpInput: document.querySelector('#database-weapon-management-jump-input'),
  databaseWeaponManagementJumpButton: document.querySelector('#database-weapon-management-jump-button'),
  databaseWeaponManagementActions: document.querySelector('#database-weapon-actions'),
  databaseWeaponClearButton: document.querySelector('#database-weapon-clear'),
  databaseWeaponSearchInput: document.querySelector('#database-weapon-search-input'),
  databaseWeaponAddButton: document.querySelector('#database-weapon-add'),
  databaseMemoryManagementState: document.querySelector('#database-memory-management-state'),
  databaseMemoryManagementShell: document.querySelector('#database-memory-management-shell'),
  databaseMemoryManagementTableShell: document.querySelector('#database-memory-management-table-shell'),
  databaseMemoryManagementBody: document.querySelector('#database-memory-management-body'),
  databaseMemoryManagementSummary: document.querySelector('#database-memory-management-summary'),
  databaseMemoryManagementPrevButton: document.querySelector('#database-memory-management-prev'),
  databaseMemoryManagementNextButton: document.querySelector('#database-memory-management-next'),
  databaseMemoryManagementPaginationLabel: document.querySelector('#database-memory-management-pagination'),
  databaseMemoryManagementJumpInput: document.querySelector('#database-memory-management-jump-input'),
  databaseMemoryManagementJumpButton: document.querySelector('#database-memory-management-jump-button'),
  databaseMemoryManagementActions: document.querySelector('#database-memory-actions'),
  databaseMemoryClearButton: document.querySelector('#database-memory-clear'),
  databaseMemorySearchInput: document.querySelector('#database-memory-search-input'),
  databaseMemoryAddButton: document.querySelector('#database-memory-add'),
  weaponDetailModal: document.querySelector('#weapon-detail-modal'),
  weaponDetailCard: document.querySelector('.weapon-detail-card'),
  weaponDetailCloseTargets: document.querySelectorAll('[data-weapon-detail-close]'),
  weaponDetailIcon: document.querySelector('#weapon-detail-icon'),
  weaponDetailName: document.querySelector('#weapon-detail-name'),
  weaponDetailType: document.querySelector('#weapon-detail-type'),
  weaponDetailStar: document.querySelector('#weapon-detail-star'),
  weaponDetailDescriptionSection: document.querySelector('#weapon-detail-description-section'),
  weaponDetailDescription: document.querySelector('#weapon-detail-description'),
  weaponDetailSkillSection: document.querySelector('#weapon-detail-skill-section'),
  weaponDetailSkillName: document.querySelector('#weapon-detail-skill-name'),
  weaponDetailSkillDescription: document.querySelector('#weapon-detail-skill-description'),
  weaponDetailBreakthrough: document.querySelector('#weapon-detail-breakthrough'),
  weaponDetailLevel: document.querySelector('#weapon-detail-level'),
  weaponDetailExp: document.querySelector('#weapon-detail-exp'),
  weaponDetailResonanceSection: document.querySelector('#weapon-detail-resonance-section'),
  weaponDetailResonanceBody: document.querySelector('#weapon-detail-resonance-body'),
  weaponDetailOverrunSection: document.querySelector('#weapon-detail-overrun-section'),
  weaponDetailOverrunContent: document.querySelector('#weapon-detail-overrun-content'),
  weaponDetailTooltip: document.querySelector('#weapon-detail-tooltip'),
  databaseItemManagementState: document.querySelector('#database-item-management-state'),
  databaseItemManagementShell: document.querySelector('#database-item-management-shell'),
  databaseItemManagementTableShell: document.querySelector('#database-item-management-table-shell'),
  databaseItemManagementBody: document.querySelector('#database-item-management-body'),
  databaseItemManagementSummary: document.querySelector('#database-item-management-summary'),
  databaseItemManagementPrevButton: document.querySelector('#database-item-management-prev'),
  databaseItemManagementNextButton: document.querySelector('#database-item-management-next'),
  databaseItemManagementPaginationLabel: document.querySelector('#database-item-management-pagination'),
  databaseItemManagementJumpInput: document.querySelector('#database-item-management-jump-input'),
  databaseItemManagementJumpButton: document.querySelector('#database-item-management-jump-button'),
  databaseItemManagementActions: document.querySelector('#database-item-actions'),
  databaseItemClearButton: document.querySelector('#database-item-clear'),
  databaseItemSearchShell: document.querySelector('#database-item-search-shell'),
  databaseItemSearchInput: document.querySelector('#database-item-search-input'),
  databaseItemAddButton: document.querySelector('#database-item-add'),
  playerCard: document.querySelector('.database-player-card'),
  playerCardBackground: document.querySelector('#player-card-background'),
  playerCardAvatarShell: document.querySelector('.database-player-card-avatar-shell'),
  playerCardAvatarRing: document.querySelector('.database-player-card-avatar-ring'),
  playerCardAvatarFrameImage: document.querySelector('#player-card-avatar-frame-image'),
  playerCardAvatarFrameHitbox: document.querySelector('#player-card-avatar-frame-hitbox'),
  playerCardAvatarImage: document.querySelector('#player-card-avatar-image'),
  playerCardAvatarFallback: document.querySelector('#player-card-avatar-fallback'),
  playerCardName: document.querySelector('#player-card-name'),
  playerCardGender: document.querySelector('#player-card-gender'),
  playerCardLikes: document.querySelector('#player-card-likes'),
  playerCardLevel: document.querySelector('#player-card-level'),
  playerCardExp: document.querySelector('#player-card-exp'),
  playerCardMoney: document.querySelector('#player-card-money'),
  playerCardSerum: document.querySelector('#player-card-serum'),
  playerCardBlackCard: document.querySelector('#player-card-black-card'),
  playerCardRainbowCard: document.querySelector('#player-card-rainbow-card'),
  playerPortraitPickerModal: document.querySelector('#player-portrait-picker-modal'),
  playerPortraitPickerTitle: document.querySelector('#player-portrait-picker-title'),
  playerPortraitPickerEyebrow: document.querySelector('#player-portrait-picker-eyebrow'),
  playerPortraitPickerIcon: document.querySelector('#player-portrait-picker-icon'),
  playerPortraitPickerDescription: document.querySelector('#player-portrait-picker-description'),
  playerPortraitPickerCurrent: document.querySelector('#player-portrait-picker-current'),
  playerPortraitPickerGrid: document.querySelector('#player-portrait-picker-grid'),
  playerPortraitPickerConfirmButton: document.querySelector('#player-portrait-picker-confirm'),
  playerPortraitPickerCloseTargets: document.querySelectorAll('[data-player-portrait-picker-close]'),
  playerPortraitPickerCancelButton: document.querySelector('.player-portrait-picker-cancel'),
  serverVersionLabel: document.querySelector('#status-server-version'),
  intervalLabel: document.querySelector('#status-interval'),
  databaseIntervalLabel: document.querySelector('#database-status-interval'),
  statusControls: document.querySelector('#status-controls'),
  startButton: document.querySelector('.status-action-button-start'),
  stopButton: document.querySelector('.status-action-button-stop'),
  logButton: document.querySelector('.status-action-button-log'),
  configButton: document.querySelector('.status-action-button-config'),
  controlModal: document.querySelector('#server-control-modal'),
  controlModalMessage: document.querySelector('#server-modal-message'),
  controlModalIcon: document.querySelector('#server-modal-icon'),
  controlModalEyebrow: document.querySelector('#server-modal-eyebrow'),
  controlModalCloseTargets: document.querySelectorAll('[data-server-modal-close]'),
  logModal: document.querySelector('#server-log-modal'),
  logModalContent: document.querySelector('#server-log-content'),
  logModalStatus: document.querySelector('#server-log-status'),
  logModalPath: document.querySelector('#server-log-path'),
  logModalCloseTargets: document.querySelectorAll('[data-server-log-close]'),
  logModalClearButton: document.querySelector('[data-server-log-clear]'),
  configModal: document.querySelector('#server-config-modal'),
  configModalStatus: document.querySelector('#server-config-status'),
  configModalPath: document.querySelector('#server-config-path'),
  configEditorInput: document.querySelector('#server-config-editor-input'),
  configEditorHighlight: document.querySelector('#server-config-editor-highlight'),
  configEditorGutter: document.querySelector('#server-config-editor-gutter'),
  configFeedback: document.querySelector('#server-config-feedback'),
  configModalCloseTargets: document.querySelectorAll('[data-server-config-close]'),
  configReloadButton: document.querySelector('[data-server-config-reload]'),
  configSaveButton: document.querySelector('[data-server-config-save]'),
  accountDeleteModal: document.querySelector('#account-delete-modal'),
  accountDeleteMessage: document.querySelector('#account-delete-message'),
  accountDeleteCloseTargets: document.querySelectorAll('[data-account-delete-close]'),
  accountDeleteConfirmButton: document.querySelector('#account-delete-confirm'),
  itemDeleteModal: document.querySelector('#item-delete-modal'),
  itemDeleteTitle: document.querySelector('#item-delete-title'),
  itemDeleteMessage: document.querySelector('#item-delete-message'),
  itemDeleteCloseTargets: document.querySelectorAll('[data-item-delete-close]'),
  itemDeleteConfirmButton: document.querySelector('#item-delete-confirm'),
  itemAddModal: document.querySelector('#item-add-modal'),
  itemAddSearchInput: document.querySelector('#item-add-search-input'),
  itemAddTableBody: document.querySelector('#item-add-table-body'),
  itemAddEmptyState: document.querySelector('#item-add-empty-state'),
  itemAddCloseTargets: document.querySelectorAll('[data-item-add-close]'),
  itemAddSubmitButton: document.querySelector('#item-add-submit'),
  weaponAddModal: document.querySelector('#weapon-add-modal'),
  weaponAddSearchInput: document.querySelector('#weapon-add-search-input'),
  weaponAddTableBody: document.querySelector('#weapon-add-table-body'),
  weaponAddEmptyState: document.querySelector('#weapon-add-empty-state'),
  weaponAddCloseTargets: document.querySelectorAll('[data-weapon-add-close]'),
  weaponAddSubmitButton: document.querySelector('#weapon-add-submit'),
  memoryAddModal: document.querySelector('#memory-add-modal'),
  memoryAddSearchInput: document.querySelector('#memory-add-search-input'),
  memoryAddTableBody: document.querySelector('#memory-add-table-body'),
  memoryAddEmptyState: document.querySelector('#memory-add-empty-state'),
  memoryAddCloseTargets: document.querySelectorAll('[data-memory-add-close]'),
  memoryAddSubmitButton: document.querySelector('#memory-add-submit'),
  resonanceEffectModal: document.querySelector('#resonance-effect-modal'),
  resonanceEffectSearchInput: document.querySelector('#resonance-effect-search-input'),
  resonanceEffectSortNameBtn: document.querySelector('#resonance-effect-sort-name'),
  resonanceEffectSortArrow: document.querySelector('#resonance-effect-sort-arrow'),
  resonanceEffectTableBody: document.querySelector('#resonance-effect-table-body'),
  resonanceEffectEmptyState: document.querySelector('#resonance-effect-empty-state'),
  resonanceEffectCloseTargets: document.querySelectorAll('[data-resonance-effect-close]'),
  resonanceEffectConfirmButton: document.querySelector('#resonance-effect-confirm'),
  resonanceEffectTooltip: document.querySelector('#resonance-effect-tooltip'),
  weaponResonanceCharacterPickerModal: document.querySelector('#weapon-resonance-character-picker-modal'),
  weaponResonanceCharacterPickerSummary: document.querySelector('#weapon-resonance-character-picker-summary'),
  weaponResonanceCharacterPickerGrid: document.querySelector('#weapon-resonance-character-picker-grid'),
  weaponResonanceCharacterPickerConfirmButton: document.querySelector('#weapon-resonance-character-picker-confirm'),
  weaponResonanceCharacterPickerCloseTargets: document.querySelectorAll('[data-weapon-resonance-character-picker-close]'),
  weaponOverrunPickerModal: document.querySelector('#weapon-overrun-picker-modal'),
  weaponOverrunPickerSummary: document.querySelector('#weapon-overrun-picker-summary'),
  weaponOverrunPickerGrid: document.querySelector('#weapon-overrun-picker-grid'),
  weaponOverrunPickerClearButton: document.querySelector('#weapon-overrun-picker-clear'),
  weaponOverrunPickerConfirmButton: document.querySelector('#weapon-overrun-picker-confirm'),
  weaponOverrunPickerCloseTargets: document.querySelectorAll('[data-weapon-overrun-picker-close]'),
  accountPasswordModal: document.querySelector('#account-password-modal'),
  accountPasswordTarget: document.querySelector('#account-password-target'),
  accountPasswordInput: document.querySelector('#account-password-input'),
  accountPasswordConfirmInput: document.querySelector('#account-password-confirm-input'),
  accountPasswordFeedback: document.querySelector('#account-password-feedback'),
  accountPasswordCloseTargets: document.querySelectorAll('[data-account-password-close]'),
  accountPasswordConfirmButton: document.querySelector('#account-password-confirm'),
  logoutConfirmModal: document.querySelector('#logout-confirm-modal'),
  logoutConfirmCloseTargets: document.querySelectorAll('[data-logout-confirm-close]'),
  logoutConfirmSubmitButton: document.querySelector('#logout-confirm-submit'),
  playerMutationRiskModal: document.querySelector('#player-mutation-risk-modal'),
  playerMutationRiskMessage: document.querySelector('#player-mutation-risk-message'),
  playerMutationRiskDontShow: document.querySelector('#player-mutation-risk-dont-show'),
  playerMutationRiskConfirmButton: document.querySelector('#player-mutation-risk-confirm'),
  playerMutationRiskCloseTargets: document.querySelectorAll('[data-player-mutation-risk-close]'),
  playerMutationRiskResetButton: document.querySelector('#player-mutation-risk-reset'),
};

export const state = {
  serverControlsVisible: false,
  serverControlState: null,
  serverControlFailureMessage: null,
  lastFocusedControl: null,
  nextHealthCheckAtMs: null,
  nextDatabaseHealthCheckAtMs: null,
  logEventSource: null,
  lastLogFocusedControl: null,
  logStreamEnded: false,
  lastConfigFocusedControl: null,
  configEditorValue: '',
  configIsLoading: false,
  configIsSaving: false,
  configLoadedOnce: false,
  configLastSavedValue: '',
  databaseHealthSnapshot: null,
  accountsCurrentPage: 1,
  accountsTotalPages: 0,
  accountsHasLoaded: false,
  accountsLoading: false,
  accountsSortBy: 'uid',
  accountsSortOrder: 'asc',
  accountsKeyword: '',
  selectedAccountUid: null,
  accountSelectionPendingUid: null,
  playerProfileLoading: false,
  playerProfileData: null,
  playerProfileEditState: null,
  playerPortraitPickerState: null,
  playerLevelMax: 0,
  playerLevelMaxExpMap: {},
  playerPortraitUrlMap: {},
  playerPortraitFrameUrlMap: {},
  playerPortraitNameMap: {},
  playerPortraitFrameNameMap: {},
  playerBackgroundUrlMap: {},
  playerBackgroundNameMap: {},
  itemNameMap: {},
  equipNameMap: {},
  weaponTypeNameMap: {},
  equipStarMap: {},
  equipSiteMap: {},
  equipIconUrlMap: {},
  characterLogNameMap: {},
  characterHeadIconUrlMap: {},
  characterGradeNameMap: {},
  weaponSkillEntriesMap: {},
  weaponOverrunSuitEntriesMap: {},
  weaponSkillPoolEntriesMap: {},
  attribPoolEntriesMap: {},
  characterSkillPoolEntriesMap: {},
  equipResonanceMap: {},
  playerBackgroundAspectRatioMap: {},
  playerCardBackgroundSource: '',
  playerCardBackgroundAspectRatio: null,
  playerCardResizeRafId: null,
  playerProfileScrollRestoreY: null,
  characterManagementCurrentPage: 1,
  characterManagementTotalPages: 0,
  characterManagementHasLoaded: false,
  characterManagementLoading: false,
  characterManagementActionPendingRecordId: null,
  characterManagementItems: [],
  characterManagementKeyword: '',
  characterManagementSortBy: 'sequence',
  characterManagementSortOrder: 'asc',
  weaponManagementCurrentPage: 1,
  weaponManagementTotalPages: 0,
  weaponManagementHasLoaded: false,
  weaponManagementLoading: false,
  weaponManagementItems: [],
  weaponManagementKeyword: '',
  memoryManagementCurrentPage: 1,
  memoryManagementTotalPages: 0,
  memoryManagementHasLoaded: false,
  memoryManagementLoading: false,
  memoryManagementItems: [],
  memoryManagementKeyword: '',
  lastWeaponDetailFocusedControl: null,
  currentWeaponDetailItem: null,
  currentWeaponDetailExtraInfo: null,
  currentEquipDetailMode: 'weapon',
  weaponDetailLoading: false,
  weaponManagementSortBy: 'character',
  weaponManagementSortOrder: 'asc',
  memoryManagementSortBy: 'character',
  memoryManagementSortOrder: 'asc',
  itemManagementCurrentPage: 1,
  itemManagementTotalPages: 0,
  itemManagementHasLoaded: false,
  itemManagementLoading: false,
  itemManagementKeyword: '',
  itemManagementSortBy: 'item_id',
  itemManagementSortOrder: 'asc',
  itemManagementEditState: null,
  latestStatusSnapshot: null,
  pendingDeleteAccount: null,
  lastDeleteFocusedControl: null,
  pendingDeleteItem: null,
  pendingDeleteWeapon: null,
  pendingDeleteMemory: null,
  pendingDeleteWeaponResonance: null,
  pendingClearItemsKeyword: null,
  pendingClearWeaponsKeyword: null,
  pendingClearMemoriesKeyword: null,
  lastDeleteItemFocusedControl: null,
  itemAddSearchKeyword: '',
  itemAddSortBy: 'item_id',
  itemAddSortOrder: 'asc',
  itemAddDraftQuantities: {},
  itemAddSubmitting: false,
  lastAddItemFocusedControl: null,
  weaponAddSearchKeyword: '',
  weaponAddSortBy: 'star',
  weaponAddSortOrder: 'desc',
  weaponAddSelectedTemplateIds: [],
  weaponAddSubmitting: false,
  memoryAddSearchKeyword: '',
  memoryAddSortBy: 'star',
  memoryAddSortOrder: 'desc',
  memoryAddSelectedTemplateIds: [],
  memoryAddSubmitting: false,
  _resonanceEffectModalActiveSlot: null,
  _resonanceEffectModalSortOrder: 'asc',
  _resonanceEffectModalSearchKeyword: '',
  _resonanceEffectModalSelectedEntry: null,
  _weaponResonancePendingEffect: {},
  _weaponResonanceEditSlots: {},
  _weaponResonancePendingAwake: {},
  _weaponResonanceCharacterPickerSlot: null,
  _weaponResonanceCharacterPickerSelectedId: null,
  _weaponResonancePendingCharacter: {},
  lastAddWeaponFocusedControl: null,
  lastAddMemoryFocusedControl: null,
  pendingPasswordAccount: null,
  lastPasswordFocusedControl: null,
  lastLogoutFocusedControl: null,
  locale: getLocale(),
  mutationRiskResolve: null,
  timerId: null,
  countdownTimerId: null,
  historyGridResizeObserver: null,
};

export const constants = {
  CONFIG_EDITOR_EMPTY_HINT: 'dashboard.configEditorEmptyHint',
  HISTORY_SLOT_COUNT: 10,
  SKIP_MUTATION_RISK_KEY: 'wacmk-pgr-skip-mutation-risk',
  databaseMutationMethods: new Set(['POST', 'PUT', 'PATCH', 'DELETE']),
  mutationRiskBypassPaths: new Set(['/api/database-accounts/selection']),
  jsonTokenRegex: /("(?:\\u[a-fA-F\d]{4}|\\[^u]|[^\\"])*")([\t ]*:)?|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:]/g,
  stateMeta: {
    healthy: { labelKey: 'dashboard.stateHealthy', className: 'status-ok' },
    unhealthy: { labelKey: 'dashboard.stateUnhealthy', className: 'status-down' },
    unknown: { labelKey: 'dashboard.stateUnknown', className: 'status-unknown' },
  },
};

export const app = { dom, state, constants };

Object.assign(app, {
  MutationRiskCancelledError: class MutationRiskCancelledError extends Error {
    constructor() {
      super('Mutation risk confirmation cancelled');
      this.name = 'MutationRiskCancelledError';
    }
  },
  getControlState: (controls) => (controls && typeof controls === 'object' ? controls : null),
  historyStateClass: (serviceState) => constants.stateMeta[serviceState]?.className ?? 'status-unknown',
  getStatusLabel: (serviceState) => t(constants.stateMeta[serviceState]?.labelKey ?? constants.stateMeta.unknown.labelKey, {}, state.locale),
  getHistoryGrids: () => [dom.sdkGrid, dom.gameGrid, dom.databaseGrid].filter(Boolean),
  getActiveDashboardPage: () => dom.dashboardPages.find((page) => page.classList.contains('is-active')) ?? null,
  getServiceHealthState: (service) => service?.latest?.state ?? 'unknown',
  isServiceHealthy: (service) => app.getServiceHealthState(service) === 'healthy',
  getDatabaseSection: (payload) => {
    const sections = Array.isArray(payload?.sections) ? payload.sections : [];
    return sections.find((section) => section?.key === 'database') ?? sections[0] ?? null;
  },
  getDatabasePrimaryService: (payload) => {
    const section = app.getDatabaseSection(payload);
    const services = Array.isArray(section?.services) ? section.services : [];
    return services[0] ?? null;
  },
  isDatabaseHealthy: (payload = state.databaseHealthSnapshot) => app.isServiceHealthy(app.getDatabasePrimaryService(payload)),
  isDatabaseAccountsSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-accounts-section');
  },
  isDatabasePlayerProfileSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-player-profile-section');
  },
  isDatabaseCharacterManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-character-management-section');
  },
  isDatabaseWeaponManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-weapon-management-section');
  },
  isDatabaseMemoryManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-memory-management-section');
  },
  isDatabaseItemManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-item-management-section');
  },
  normalizeAccountUid: (value) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  },
  getPlayerGenderLabel: (gender) => {
    if (gender === 0) {
      return t('dashboard.playerGenderUnset', {}, state.locale);
    }

    if (gender === 1) {
      return t('dashboard.playerGenderFemale', {}, state.locale);
    }

    if (gender === 2) {
      return t('dashboard.playerGenderMale', {}, state.locale);
    }

    return t('common.notAvailable', {}, state.locale);
  },
  formatPlayerFieldValue: (value) => {
    if (value === null || value === undefined || value === '') {
      return '--';
    }

    return String(value);
  },
  normalizePlayerResourceId: (value) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  },
  getPlayerResourceMapByField: (field) => {
    if (field === 'head_frame_id') {
      return state.playerPortraitFrameUrlMap;
    }

    if (field === 'use_background_id') {
      return state.playerBackgroundUrlMap;
    }

    return state.playerPortraitUrlMap;
  },
  getPlayerResourceNameMapByField: (field) => {
    if (field === 'head_frame_id') {
      return state.playerPortraitFrameNameMap;
    }

    if (field === 'use_background_id') {
      return state.playerBackgroundNameMap;
    }

    return state.playerPortraitNameMap;
  },
  getPlayerResourceUrlByField: (field, id) => {
    if (id === null || id === undefined) {
      return '';
    }

    const map = app.getPlayerResourceMapByField(field);
    return typeof map?.[id] === 'string' ? map[id] : '';
  },
  getPlayerResourceNameByField: (field, id) => {
    if (id === null || id === undefined) {
      return '';
    }

    const map = app.getPlayerResourceNameMapByField(field);
    return typeof map?.[id] === 'string' ? map[id] : '';
  },
  getPlayerResourcePickerEntries: (field) => {
    const map = app.getPlayerResourceMapByField(field);
    return Object.entries(map)
      .map(([id, url]) => ({ id: app.normalizePlayerResourceId(id), url: typeof url === 'string' ? url : '' }))
      .filter((item) => item.id !== null)
      .sort((left, right) => left.id - right.id);
  },
  getPlayerResourceLabel: (field) => {
    if (field === 'head_frame_id') {
      return t('dashboard.portraitFrame', {}, state.locale);
    }

    if (field === 'use_background_id') {
      return t('dashboard.background', {}, state.locale);
    }

    return t('dashboard.portrait', {}, state.locale);
  },
  getPlayerResourceCurrentValue: (field) => {
    if (!state.playerProfileData) {
      return null;
    }

    if (field === 'head_frame_id') {
      return state.playerProfileData.head_frame_id ?? null;
    }

    if (field === 'use_background_id') {
      return state.playerProfileData.use_background_id ?? null;
    }

    return state.playerProfileData.head_portrait_id ?? null;
  },
  getPlayerResourceCurrentName: (field) => {
    const currentValue = app.getPlayerResourceCurrentValue(field);
    return app.getPlayerResourceNameByField(field, currentValue) || (currentValue === null ? t('common.notAvailable', {}, state.locale) : String(currentValue));
  },
  getPlayerResourcePickerPageSize: () => {
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
  },
  getPlayerResourcePickerPages: (field) => {
    const entries = app.getPlayerResourcePickerEntries(field);
    return { entries, totalPages: 1 };
  },
  canEditPlayerField: (field) => {
    const value = app.getPlayerProfileEditValue(field);
    return value !== null && value !== undefined;
  },
  canAccessWeaponManagement: (payload = state.databaseHealthSnapshot) => app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null,
  canAccessCharacterManagement: (payload = state.databaseHealthSnapshot) => app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null,
  canAccessMemoryManagement: (payload = state.databaseHealthSnapshot) => app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null,
  canAccessItemManagement: (payload = state.databaseHealthSnapshot) => app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null,
  getApiRequestMethod: (init = {}) => String(init?.method ?? 'GET').toUpperCase(),
  getApiRequestPath: (input) => {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof URL) {
      return `${input.pathname}${input.search}`;
    }

    if (input instanceof Request) {
      try {
        const url = new URL(input.url, window.location.origin);
        return `${url.pathname}${url.search}`;
      } catch {
        return input.url;
      }
    }

    return String(input ?? '');
  },
  isDatabaseMutationRequest: (input, init = {}) => {
    const method = app.getApiRequestMethod(init);
    if (!constants.databaseMutationMethods.has(method)) {
      return false;
    }

    const path = app.getApiRequestPath(input);
    if (!path.startsWith('/api/database-')) {
      return false;
    }

    const pathname = path.split('?')[0];
    return !constants.mutationRiskBypassPaths.has(pathname);
  },
  isMutationRiskCancelled: (error) => error instanceof app.MutationRiskCancelledError,
  confirmPlayerMutationRisk: async () => {
    if (!app.isGameServerHealthy()) {
      return true;
    }

    if (localStorage.getItem(constants.SKIP_MUTATION_RISK_KEY) === '1') {
      return true;
    }

    return new Promise((resolve) => {
      state.mutationRiskResolve = resolve;
      app.openPlayerMutationRiskModal();
    });
  },
  resetPlayerMutationRiskSkip: () => {
    localStorage.removeItem(constants.SKIP_MUTATION_RISK_KEY);
    if (dom.playerMutationRiskResetButton instanceof HTMLElement) {
      dom.playerMutationRiskResetButton.hidden = true;
    }
  },
  getGameSection: (payload = state.latestStatusSnapshot) => {
    const sections = Array.isArray(payload?.sections) ? payload.sections : [];
    return sections.find((section) => section?.key === 'game') ?? null;
  },
  isGameServerHealthy: (payload = state.latestStatusSnapshot) => app.isServiceHealthy(app.getGameSection(payload)?.services?.[0]),
  formatTime: (iso) => {
    if (!iso) {
      return t('dashboard.statusNoRecords', {}, state.locale);
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }

    return date.toLocaleString(state.locale, { hour12: false });
  },
  setBodyModalOpen: (open) => {
    document.body.classList.toggle('login-modal-open', open);
  },
  translate: (key, params = {}) => t(key, params, state.locale),
  apiFetch: async (input, init = {}) => {
    if (app.isDatabaseMutationRequest(input, init)) {
      const confirmed = await app.confirmPlayerMutationRisk();
      if (!confirmed) {
        throw new app.MutationRiskCancelledError();
      }
    }

    return apiFetch(input, init);
  },
  apiErrorMessage: (error, fallbackKey = 'runtime.apiUnknown') => getLocalizedApiErrorMessage(error, state.locale, fallbackKey),
  resolveUiTextToken: (token) => resolveUiTextToken(token, state.locale),
  createApiError: (payload, status = null) => new ApiError({ code: payload?.code, details: payload?.details, message: payload?.message, status }),
  normalizePaginationTargetPage: (value, totalPages) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    const safeTotalPages = Number.isFinite(Number(totalPages)) ? Math.max(0, Number(totalPages)) : 0;
    if (safeTotalPages <= 0) {
      return null;
    }

    return Math.min(Math.max(parsed, 1), safeTotalPages);
  },
});

subscribeLocaleChange((locale) => {
  state.locale = locale;
});
