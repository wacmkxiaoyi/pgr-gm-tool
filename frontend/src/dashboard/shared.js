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
  databaseWeaponManagementSubnavButton: document.querySelector('#database-equip-management-subnav'),
  databaseMemoryManagementSubnavButton: document.querySelector('#database-memory-management-subnav'),
  databaseItemManagementSubnavButton: document.querySelector('#database-item-management-subnav'),
  databaseStageManagementSubnavButton: document.querySelector('#database-stage-management-subnav'),
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
  databaseCharacterFillButton: document.querySelector('#database-character-fill'),
  databaseCharacterAddButton: document.querySelector('#database-character-add'),
  databaseCharacterSearchInput: document.querySelector('#database-character-search-input'),
  databaseWeaponManagementState: document.querySelector('#database-equip-management-state'),
  databaseWeaponManagementShell: document.querySelector('#database-equip-management-shell'),
  databaseWeaponManagementTableShell: document.querySelector('#database-equip-management-table-shell'),
  databaseWeaponManagementBody: document.querySelector('#database-equip-management-body'),
  databaseWeaponManagementSummary: document.querySelector('#database-equip-management-summary'),
  databaseWeaponManagementPrevButton: document.querySelector('#database-equip-management-prev'),
  databaseWeaponManagementNextButton: document.querySelector('#database-equip-management-next'),
  databaseWeaponManagementPaginationLabel: document.querySelector('#database-equip-management-pagination'),
  databaseWeaponManagementJumpInput: document.querySelector('#database-equip-management-jump-input'),
  databaseWeaponManagementJumpButton: document.querySelector('#database-equip-management-jump-button'),
  databaseequipManagementActions: document.querySelector('#database-weapon-actions'),
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
  equipDetailModal: document.querySelector('#equip-detail-modal'),
  equipDetailCard: document.querySelector('.equip-detail-card'),
  equipDetailCloseTargets: document.querySelectorAll('[data-equip-detail-modal-close]'),
  equipDetailIcon: document.querySelector('#equip-detail-icon'),
  equipDetailName: document.querySelector('#equip-detail-name'),
  equipDetailType: document.querySelector('#equip-detail-type'),
  equipDetailStar: document.querySelector('#equip-detail-star'),
  equipDetailDescriptionSection: document.querySelector('#equip-detail-description-section'),
  equipDetailDescription: document.querySelector('#equip-detail-description'),
  weaponDetailSkillSection: document.querySelector('#weapon-detail-skill-section'),
  weaponDetailSkillName: document.querySelector('#weapon-detail-skill-name'),
  weaponDetailSkillDescription: document.querySelector('#weapon-detail-skill-description'),
  equipDetailBreakthrough: document.querySelector('#equip-detail-breakthrough'),
  equipDetailLevel: document.querySelector('#equip-detail-level'),
  equipDetailExp: document.querySelector('#equip-detail-exp'),
  equipDetailResonanceSection: document.querySelector('#equip-detail-resonance-section'),
  equipDetailResonanceBody: document.querySelector('#equip-detail-resonance-body'),
  equipDetailTooltip: document.querySelector('#equip-detail-tooltip'),
  weaponDetailOverrunSection: document.querySelector('#weapon-detail-overrun-section'),
  weaponDetailOverrunContent: document.querySelector('#weapon-detail-overrun-content'),
  characterDetailModal: document.querySelector('#character-detail-modal'),
  characterDetailCard: document.querySelector('.character-detail-card'),
  characterDetailCloseTargets: document.querySelectorAll('[data-character-detail-modal-close]'),
  characterDetailMainIcon: document.querySelector('#character-detail-main-icon'),
  characterDetailMainFashionShell: document.querySelector('#character-detail-main-fashion-shell'),
  characterDetailMainFashionIcon: document.querySelector('#character-detail-main-fashion-icon'),
  characterDetailMainFashionPlaceholder: document.querySelector('#character-detail-main-fashion-placeholder'),
  characterDetailFashions: document.querySelector('#character-detail-fashions'),
  characterDetailWeapon: document.querySelector('#character-detail-weapon'),
  characterMemorySwitchModal: document.querySelector('#character-memory-switch-modal'),
  characterMemorySwitchCloseTargets: document.querySelectorAll('[data-character-memory-switch-modal-close]'),
  characterMemorySwitchCurrent: document.querySelector('#character-memory-switch-current'),
  characterMemorySwitchSearchInput: document.querySelector('#character-memory-switch-search-input'),
  characterMemorySwitchTableBody: document.querySelector('#character-memory-switch-table-body'),
  characterMemorySwitchEmptyState: document.querySelector('#character-memory-switch-empty-state'),
  characterMemorySwitchSaveButton: document.querySelector('#character-memory-switch-save'),
  characterWeaponSwitchModal: document.querySelector('#character-weapon-switch-modal'),
  characterWeaponSwitchCloseTargets: document.querySelectorAll('[data-character-weapon-switch-modal-close]'),
  characterWeaponSwitchCurrent: document.querySelector('#character-weapon-switch-current'),
  characterWeaponSwitchSearchInput: document.querySelector('#character-weapon-switch-search-input'),
  characterWeaponSwitchTableBody: document.querySelector('#character-equip-switch-table-body'),
  characterWeaponSwitchEmptyState: document.querySelector('#character-weapon-switch-empty-state'),
  characterWeaponSwitchSaveButton: document.querySelector('#character-weapon-switch-save'),
  characterDetailMemories: document.querySelector('#character-detail-memories'),
  characterDetailMaxAllButton: document.querySelector('#character-detail-max-all'),
  characterDetailName: document.querySelector('#character-detail-name'),
  characterDetailEvolution: document.querySelector('#character-detail-evolution'),
  characterQualityEditModal: document.querySelector('#character-quality-edit-modal'),
  characterQualityEditCard: document.querySelector('#character-quality-edit-card'),
  characterQualityEditCloseTargets: document.querySelectorAll('[data-character-quality-edit-modal-close]'),
  characterQualityEditQualitySelect: document.querySelector('#character-quality-edit-quality'),
  characterQualityEditStarSelect: document.querySelector('#character-quality-edit-star'),
  characterQualityEditConfirmButton: document.querySelector('#character-quality-edit-confirm'),
  characterLevelEditModal: document.querySelector('#character-level-edit-modal'),
  characterLevelEditCard: document.querySelector('#character-level-edit-card'),
  characterLevelEditCloseTargets: document.querySelectorAll('[data-character-level-edit-modal-close]'),
  characterLevelEditLevelInput: document.querySelector('#character-level-edit-level'),
  characterLevelEditExpInput: document.querySelector('#character-level-edit-exp'),
  characterLevelEditConfirmButton: document.querySelector('#character-level-edit-confirm'),
  characterTrustEditModal: document.querySelector('#character-trust-edit-modal'),
  characterTrustEditCard: document.querySelector('#character-trust-edit-card'),
  characterTrustEditCloseTargets: document.querySelectorAll('[data-character-trust-edit-modal-close]'),
  characterTrustEditHearts: document.querySelector('#character-trust-edit-hearts'),
  characterTrustEditExpInput: document.querySelector('#character-trust-edit-exp'),
  characterTrustEditConfirmButton: document.querySelector('#character-trust-edit-confirm'),
  characterGradeEditModal: document.querySelector('#character-grade-edit-modal'),
  characterGradeEditCard: document.querySelector('#character-grade-edit-card'),
  characterGradeEditCloseTargets: document.querySelectorAll('[data-character-grade-edit-modal-close]'),
  characterGradeEditSelect: document.querySelector('#character-grade-edit-grade'),
  characterGradeEditConfirmButton: document.querySelector('#character-grade-edit-confirm'),
  characterAwakenEditModal: document.querySelector('#character-awaken-edit-modal'),
  characterAwakenEditCard: document.querySelector('#character-awaken-edit-card'),
  characterAwakenEditCloseTargets: document.querySelectorAll('[data-character-awaken-edit-modal-close]'),
  characterAwakenEditLevelSelect: document.querySelector('#character-awaken-edit-level'),
  characterAwakenEditConfirmButton: document.querySelector('#character-awaken-edit-confirm'),
  characterSkillEditModal: document.querySelector('#character-skill-edit-modal'),
  characterSkillEditCard: document.querySelector('#character-skill-edit-card'),
  characterSkillEditCloseTargets: document.querySelectorAll('[data-character-skill-edit-modal-close]'),
  characterSkillEditTitle: document.querySelector('#character-skill-edit-title'),
  characterSkillEditLevelInput: document.querySelector('#character-skill-edit-level'),
  characterSkillEditConfirmButton: document.querySelector('#character-skill-edit-confirm'),
  characterDetailGrade: document.querySelector('#character-detail-grade'),
  characterDetailAwaken: document.querySelector('#character-detail-awaken'),
  characterDetailLevel: document.querySelector('#character-detail-level'),
  characterDetailTrust: document.querySelector('#character-detail-trust'),
  characterDetailInformation: document.querySelector('#character-detail-information'),
  characterDetailSkillsBody: document.querySelector('#character-detail-skills-body'),
  characterDetailEnhanceSkillsBody: document.querySelector('#character-detail-enhance-skills-body'),
  characterDetailEquipTooltip: document.querySelector('#character-detail-equip-tooltip'),
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
  databaseStageManagementState: document.querySelector('#database-stage-management-state'),
  databaseStageManagementShell: document.querySelector('#database-stage-management-shell'),
  databaseStageManagementTableShell: document.querySelector('#database-stage-management-table-shell'),
  databaseStageManagementBody: document.querySelector('#database-stage-management-body'),
  databaseStageManagementSummary: document.querySelector('#database-stage-management-summary'),
  databaseStageManagementPrevButton: document.querySelector('#database-stage-management-prev'),
  databaseStageManagementNextButton: document.querySelector('#database-stage-management-next'),
  databaseStageManagementPaginationLabel: document.querySelector('#database-stage-management-pagination'),
  databaseStageManagementJumpInput: document.querySelector('#database-stage-management-jump-input'),
  databaseStageManagementJumpButton: document.querySelector('#database-stage-management-jump-button'),
  databaseStageManagementActions: document.querySelector('#database-stage-actions'),
  databaseStageClearButton: document.querySelector('#database-stage-clear'),
  databaseStageSearchInput: document.querySelector('#database-stage-search-input'),
  databaseStageSkipButton: document.querySelector('#database-stage-skip'),
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
  playerPortraitPickerCloseTargets: document.querySelectorAll('[data-player-portrait-picker-modal-close]'),
  playerPortraitPickerCancelButton: document.querySelector('.player-portrait-picker-cancel'),
  characterAddModal: document.querySelector('#character-add-modal'),
  characterAddTitle: document.querySelector('#character-add-title'),
  characterAddEyebrow: document.querySelector('#character-add-eyebrow'),
  characterAddDescription: document.querySelector('#character-add-description'),
  characterAddCurrent: document.querySelector('#character-add-current'),
  characterAddGrid: document.querySelector('#character-add-grid'),
  characterAddConfirmButton: document.querySelector('#character-add-confirm'),
  characterAddCloseTargets: document.querySelectorAll('[data-character-add-modal-close]'),
  characterAddCancelButton: document.querySelector('.character-add-cancel'),
  serverVersionLabel: document.querySelector('#status-server-version'),
  intervalLabel: document.querySelector('#status-interval'),
  databaseIntervalLabel: document.querySelector('#database-status-interval'),
  databaseRepairButton: document.querySelector('#database-repair-button'),
  statusControls: document.querySelector('#status-controls'),
  startButton: document.querySelector('.status-action-button-start'),
  stopButton: document.querySelector('.status-action-button-stop'),
  logButton: document.querySelector('.status-action-button-log'),
  configButton: document.querySelector('.status-action-button-config'),
  noticeModal: document.querySelector('#notice-modal'),
  noticeModalMessage: document.querySelector('#notice-modal-message'),
  noticeModalIcon: document.querySelector('#notice-modal-icon'),
  noticeModalEyebrow: document.querySelector('#notice-modal-eyebrow'),
  noticeModalCloseTargets: document.querySelectorAll('[data-notice-modal-close]'),
  logModal: document.querySelector('#server-log-modal'),
  logModalContent: document.querySelector('#server-log-content'),
  logModalStatus: document.querySelector('#server-log-status'),
  logModalPath: document.querySelector('#server-log-path'),
  logModalCloseTargets: document.querySelectorAll('[data-server-log-modal-close]'),
  logModalClearButton: document.querySelector('[data-server-log-clear]'),
  configModal: document.querySelector('#server-config-modal'),
  configModalStatus: document.querySelector('#server-config-status'),
  configModalPath: document.querySelector('#server-config-path'),
  configEditorInput: document.querySelector('#server-config-editor-input'),
  configEditorHighlight: document.querySelector('#server-config-editor-highlight'),
  configEditorGutter: document.querySelector('#server-config-editor-gutter'),
  configFeedback: document.querySelector('#server-config-feedback'),
  configModalCloseTargets: document.querySelectorAll('[data-server-config-modal-close]'),
  configReloadButton: document.querySelector('[data-server-config-reload]'),
  configSaveButton: document.querySelector('[data-server-config-save]'),
  accountDeleteModal: document.querySelector('#account-delete-modal'),
  accountDeleteMessage: document.querySelector('#account-delete-message'),
  accountDeleteCloseTargets: document.querySelectorAll('[data-account-delete-modal-close]'),
  accountDeleteConfirmButton: document.querySelector('#account-delete-confirm'),
  itemDeleteModal: document.querySelector('#item-delete-modal'),
  itemDeleteTitle: document.querySelector('#item-delete-title'),
  itemDeleteMessage: document.querySelector('#item-delete-message'),
  itemDeleteCloseTargets: document.querySelectorAll('[data-item-delete-modal-close]'),
  itemDeleteConfirmButton: document.querySelector('#item-delete-confirm'),
  itemAddModal: document.querySelector('#item-add-modal'),
  itemAddSearchInput: document.querySelector('#item-add-search-input'),
  itemAddTableBody: document.querySelector('#item-add-table-body'),
  itemAddEmptyState: document.querySelector('#item-add-empty-state'),
  itemAddCloseTargets: document.querySelectorAll('[data-item-add-modal-close]'),
  itemAddSubmitButton: document.querySelector('#item-add-submit'),
  weaponAddModal: document.querySelector('#weapon-add-modal'),
  weaponAddSearchInput: document.querySelector('#weapon-add-search-input'),
  weaponAddTableBody: document.querySelector('#weapon-add-table-body'),
  weaponAddEmptyState: document.querySelector('#weapon-add-empty-state'),
  weaponAddCloseTargets: document.querySelectorAll('[data-weapon-add-modal-close]'),
  weaponAddSubmitButton: document.querySelector('#weapon-add-submit'),
  stageSkipModal: document.querySelector('#stage-skip-modal'),
  stageSkipSearchInput: document.querySelector('#stage-skip-search-input'),
  stageSkipTableBody: document.querySelector('#stage-skip-table-body'),
  stageSkipEmptyState: document.querySelector('#stage-skip-empty-state'),
  stageSkipCloseTargets: document.querySelectorAll('[data-stage-skip-modal-close]'),
  stageSkipSubmitButton: document.querySelector('#stage-skip-submit'),
  stageDescriptionTooltip: document.querySelector('#stage-description-tooltip'),
  memoryAddModal: document.querySelector('#memory-add-modal'),
  memoryAddSearchInput: document.querySelector('#memory-add-search-input'),
  memoryAddTableBody: document.querySelector('#memory-add-table-body'),
  memoryAddEmptyState: document.querySelector('#memory-add-empty-state'),
  memoryAddCloseTargets: document.querySelectorAll('[data-memory-add-modal-close]'),
  memoryAddSubmitButton: document.querySelector('#memory-add-submit'),
  resonanceEffectModal: document.querySelector('#resonance-effect-modal'),
  resonanceEffectSearchInput: document.querySelector('#resonance-effect-search-input'),
  resonanceEffectSortNameBtn: document.querySelector('#resonance-effect-sort-name'),
  resonanceEffectSortArrow: document.querySelector('#resonance-effect-sort-arrow'),
  resonanceEffectTableBody: document.querySelector('#resonance-effect-table-body'),
  resonanceEffectEmptyState: document.querySelector('#resonance-effect-empty-state'),
  resonanceEffectCloseTargets: document.querySelectorAll('[data-resonance-effect-modal-close]'),
  resonanceEffectConfirmButton: document.querySelector('#resonance-effect-confirm'),
  resonanceEffectTooltip: document.querySelector('#resonance-effect-tooltip'),
  weaponResonanceCharacterPickerModal: document.querySelector('#weapon-resonance-character-picker-modal'),
  weaponResonanceCharacterPickerSummary: document.querySelector('#weapon-resonance-character-picker-summary'),
  weaponResonanceCharacterPickerGrid: document.querySelector('#weapon-resonance-character-picker-grid'),
  weaponResonanceCharacterPickerConfirmButton: document.querySelector('#equip-resonance-character-picker-confirm'),
  weaponResonanceCharacterPickerCloseTargets: document.querySelectorAll('[data-equip-resonance-character-picker-modal-close]'),
  weaponOverrunPickerModal: document.querySelector('#weapon-overrun-picker-modal'),
  weaponOverrunPickerSummary: document.querySelector('#weapon-overrun-picker-summary'),
  weaponOverrunPickerGrid: document.querySelector('#weapon-overrun-picker-grid'),
  weaponOverrunPickerClearButton: document.querySelector('#weapon-overrun-picker-clear'),
  weaponOverrunPickerConfirmButton: document.querySelector('#weapon-overrun-picker-confirm'),
  weaponOverrunPickerCloseTargets: document.querySelectorAll('[data-weapon-overrun-picker-modal-close]'),
  accountPasswordModal: document.querySelector('#account-password-modal'),
  accountPasswordTarget: document.querySelector('#account-password-target'),
  accountPasswordInput: document.querySelector('#account-password-input'),
  accountPasswordConfirmInput: document.querySelector('#account-password-confirm-input'),
  accountPasswordFeedback: document.querySelector('#account-password-feedback'),
  accountPasswordCloseTargets: document.querySelectorAll('[data-account-password-modal-close]'),
  accountPasswordConfirmButton: document.querySelector('#account-password-confirm'),
  logoutConfirmModal: document.querySelector('#logout-confirm-modal'),
  logoutConfirmCloseTargets: document.querySelectorAll('[data-logout-confirm-modal-close]'),
  logoutConfirmSubmitButton: document.querySelector('#logout-confirm-submit'),
  playerMutationRiskModal: document.querySelector('#player-mutation-risk-modal'),
  playerMutationRiskMessage: document.querySelector('#player-mutation-risk-message'),
  playerMutationRiskDontShow: document.querySelector('#player-mutation-risk-dont-show'),
  playerMutationRiskConfirmButton: document.querySelector('#player-mutation-risk-confirm'),
  playerMutationRiskCloseTargets: document.querySelectorAll('[data-player-mutation-risk-modal-close]'),
  playerMutationRiskResetButton: document.querySelector('#player-mutation-risk-reset'),
};

export const state = {
  serverControlsVisible: false,
  serverControlState: null,
  serverControlFailureMessage: null,
  lastNoticeTrigger: null,
  nextHealthCheckAtMs: null,
  nextDatabaseHealthCheckAtMs: null,
  databaseRepairPending: false,
  logEventSource: null,
  lastLogTrigger: null,
  logStreamEnded: false,
  lastConfigTrigger: null,
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
  lastPlayerPortraitPickerTrigger: null,
  characterAddState: null,
  lastCharacterAddTrigger: null,
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
  characterTrustExpMap: {},
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
  lastCharacterDetailTrigger: null,
  currentCharacterDetailItem: null,
  currentCharacterDetailExtraInfo: null,
  characterDetailLoading: false,
  characterMemorySwitchLoading: false,
  characterMemorySwitchSubmitting: false,
  characterMemorySwitchItems: [],
  characterMemorySwitchSearchKeyword: '',
  characterMemorySwitchSortBy: 'star',
  characterMemorySwitchSortOrder: 'desc',
  characterMemorySwitchSelectedRecordId: null,
  characterMemorySwitchCurrentMemory: null,
  characterMemorySwitchSlot: null,
  lastCharacterMemorySwitchTrigger: null,
  characterWeaponSwitchLoading: false,
  characterWeaponSwitchSubmitting: false,
  characterWeaponSwitchItems: [],
  characterWeaponSwitchSearchKeyword: '',
  characterWeaponSwitchSortBy: 'star',
  characterWeaponSwitchSortOrder: 'desc',
  characterWeaponSwitchSelectedRecordId: null,
  characterWeaponSwitchCurrentWeapon: null,
  lastCharacterWeaponSwitchTrigger: null,
  characterFashionSwitchPending: false,
  characterQualityEditPending: false,
  lastCharacterQualityEditTrigger: null,
  characterLevelEditPending: false,
  lastCharacterLevelEditTrigger: null,
  characterTrustEditPending: false,
  lastCharacterTrustEditTrigger: null,
  characterGradeEditPending: false,
  lastCharacterGradeEditTrigger: null,
  characterAwakenEditPending: false,
  lastCharacterAwakenEditTrigger: null,
  characterSkillEditPending: false,
  characterSkillEditState: null,
  lastCharacterSkillEditTrigger: null,
  equippableMemoryNums: 0,
  characterDetailEquipTooltipTarget: null,
  characterDetailEquipTooltipTimer: null,
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
  lastEquipDetailTrigger: null,
  currentEquipDetailItem: null,
  currentEquipDetailExtraInfo: null,
  currentEquipDetailMode: 'weapon',
  currentEquipDetailSource: null,
  equipDetailLoading: false,
  equipDetailEditState: null,
  equipDetailTooltipTarget: null,
  equipDetailTooltipTimer: null,
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
  stageEntriesMap: {},
  stageManagementCurrentPage: 1,
  stageManagementTotalPages: 0,
  stageManagementHasLoaded: false,
  stageManagementLoading: false,
  stageManagementKeyword: '',
  stageManagementSortBy: 'stage_id',
  stageManagementSortOrder: 'asc',
  stageDescriptionTooltipTarget: null,
  stageDescriptionTooltipTimer: null,
  latestStatusSnapshot: null,
  pendingDeleteAccount: null,
  lastAccountDeleteTrigger: null,
  pendingDeleteItem: null,
  pendingDeleteStage: null,
  pendingDeleteWeapon: null,
  pendingDeleteMemory: null,
  pendingCharacterMaxAll: null,
  pendingCharacterManagementMaxAll: false,
  pendingDeleteWeaponResonance: null,
  pendingClearItemsKeyword: null,
  pendingClearStages: false,
  pendingClearWeaponsKeyword: null,
  pendingClearMemoriesKeyword: null,
  lastItemDeleteTrigger: null,
  itemAddSearchKeyword: '',
  itemAddSortBy: 'item_id',
  itemAddSortOrder: 'asc',
  itemAddDraftQuantities: {},
  itemAddSubmitting: false,
  lastItemAddTrigger: null,
  weaponAddSearchKeyword: '',
  weaponAddSortBy: 'star',
  weaponAddSortOrder: 'desc',
  weaponAddSelectedTemplateIds: [],
  weaponAddSubmitting: false,
  stageSkipSearchKeyword: '',
  stageSkipSortBy: 'stage_id',
  stageSkipSortOrder: 'asc',
  stageSkipSelectedStageIds: [],
  stageSkipSubmitting: false,
  stageSkipLoading: false,
  stageSkipCatalog: [],
  lastStageSkipTrigger: null,
  memoryAddSearchKeyword: '',
  memoryAddSortBy: 'star',
  memoryAddSortOrder: 'desc',
  memoryAddSelectedTemplateIds: [],
  memoryAddSubmitting: false,
  _resonanceEffectModalActiveSlot: null,
  _resonanceEffectModalSortOrder: 'asc',
  _resonanceEffectModalSearchKeyword: '',
  _resonanceEffectModalSelectedEntry: null,
  _equipResonancePendingEffect: {},
  _equipResonanceEditSlots: {},
  _equipResonancePendingAwake: {},
  _equipResonanceCharacterPickerSlot: null,
  _equipResonanceCharacterPickerSelectedId: null,
  _equipResonancePendingCharacter: {},
  lastWeaponAddTrigger: null,
  lastMemoryAddTrigger: null,
  pendingPasswordAccount: null,
  lastPasswordTrigger: null,
  lastLogoutTrigger: null,
  locale: getLocale(),
  mutationRiskResolve: null,
  healthPollingReady: false,
  statusPollingTimerId: null,
  databaseStatusPollingTimerId: null,
  statusPollingRequestInFlight: false,
  databaseStatusPollingRequestInFlight: false,
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
  getActiveDatabaseTabButton: () => dom.databaseTabButtons.find((button) => button.classList.contains('is-active')) ?? null,
  isServerManagementPageActive: () => app.getActiveDashboardPage()?.dataset.dashboardPanel === 'server-management',
  isDatabaseManagementPageActive: () => app.getActiveDashboardPage()?.dataset.dashboardPanel === 'database-management',
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
  isDatabaseStatusSectionActive: () => {
    return app.getActiveDatabaseTabButton()?.dataset.databaseTab === 'database-service-status-section';
  },
  isDatabasePlayerProfileSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-player-profile-section');
  },
  isDatabaseCharacterManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-character-management-section');
  },
  isDatabaseWeaponManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-equip-management-section');
  },
  isDatabaseMemoryManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-memory-management-section');
  },
  isDatabaseItemManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-item-management-section');
  },
  isDatabaseStageManagementSectionActive: () => {
    return dom.databaseTabButtons.some((button) => button.classList.contains('is-active') && button.dataset.databaseTab === 'database-stage-management-section');
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
  canAccessStageManagement: (payload = state.databaseHealthSnapshot) => app.isDatabaseHealthy(payload) && state.selectedAccountUid !== null,
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
    document.body.classList.toggle('shared-modal-open', open);
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
