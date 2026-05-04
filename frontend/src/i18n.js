const STORAGE_KEY = 'wacmk-pgr-locale';
const DEFAULT_LOCALE = 'zh-CN';
const SUPPORTED_LOCALES = ['zh-CN', 'en-US'];

const messages = {
  'zh-CN': {
    common: {
      appName: 'WACMK PGR Management',
      localeZh: '中文',
      localeEn: 'English',
      confirm: '确认',
      cancel: '取消',
      close: '关闭',
      gotIt: '知道了',
      loading: '加载中...',
      success: '操作成功',
      prompt: '提示',
      notAvailable: '--',
    },
    login: {
      title: '登录',
      username: '账号',
      usernamePlaceholder: '请输入账号',
      password: '密码',
      passwordPlaceholder: '请输入密码',
      submit: '登录',
      submitting: '正在进入后台...',
      authenticating: '正在验证身份...',
      emptyFields: '请输入账号和密码。',
      failedEyebrow: '登录失败',
      failedTitle: '请检查账号和密码',
      invalidCredentials: '账号或密码错误，请重新输入。',
      switcherLabel: '语言',
    },
    dashboard: {
      title: '游戏服务器管理',
      sidebarAria: '后台导航',
      sidebarSubtitle: '管理后台',
      sidebarServerManagement: '游戏服务器管理',
      sidebarDatabaseManagement: '用户数据管理',
      sidebarHealthy: '系统运行正常',
      logout: '退出登录',
      logoutPending: '正在退出...',
      serverStop: '停止',
      serverViewLogs: '查看日志',
      serverEditConfig: '修改配置',
      toggleSidebar: '切换侧边栏',
      serverVersion: '服务器版本号: {version}',
      nextHealthCheck: '距离下次健康检查: {seconds}s',
      nextHealthCheckIdle: '距离下次健康检查: --',
      databaseSubnavAria: '用户数据管理次级导航',
      databaseStatusTab: '数据库状态',
      accountsTab: '账号管理',
      playerProfileTab: '用户名片',
      itemManagementTab: '道具管理',
      selectedUser: '已选定用户识别码：{uid}',
      databaseStatusTitle: '数据库状态',
      databaseStatusInterval: '距离下次健康检查: {seconds}s',
      databaseStatusIntervalIdle: '距离下次健康检查: --',
      accountsTitle: '账号管理',
      accountsDescription: '展示 MongoDB 中 accounts 集合的账户数据，每页固定 10 条记录。',
      accountsUnavailable: '仅在数据库服务正常时可查看',
      accountsReady: '数据库服务正常，可查看账户列表',
      accountsLoaded: '账户列表已加载，每页 10 条',
      accountsStateReady: '数据库服务正常后可查看账户列表。',
      accountsStateLoading: '正在加载账户列表...',
      accountsStateEmpty: '暂无账户数据。',
      accountsSummaryTotal: '共 {total} 个账户，每页 10 条',
      accountsPagination: '第 {page} / {totalPages} 页',
      accountsPrev: '上一页',
      accountsNext: '下一页',
      accountsUid: '识别码',
      accountsUsername: '用户名',
      accountsAction: '操作',
      accountSelect: '选定',
      accountSelected: '已选定',
      accountSelecting: '选定中...',
      accountResetPassword: '重置密码',
      accountDelete: '删除',
      playerProfileTitle: '用户名片',
      playerProfileChooseAccount: '请先在账号管理中选定一个用户。',
      itemManagementTitle: '道具管理',
      itemManagementDescription: '当前分栏用于管理选定用户的道具数据。',
      itemManagementChooseAccount: '请先在账号管理中选定一个用户。',
      itemManagementUnavailable: '仅在数据库服务正常且已选定用户时可查看',
      itemManagementReady: '进入该分栏后可查看当前选定用户的道具列表。',
      itemManagementLoading: '正在加载道具列表...',
      itemManagementEmpty: '当前用户暂无可展示道具。',
      itemManagementSummaryTotal: '共 {total} 个道具，每页 10 条',
      itemManagementItemId: '物品 ID',
      itemManagementItemName: '名字',
      itemManagementQuantity: '数量',
      itemManagementAction: '操作',
      itemManagementClear: '清空物品',
      itemManagementSearchPlaceholder: '输入道具名后回车搜索',
      itemManagementDelete: '删除',
      itemManagementAddItem: '新增物品',
      itemManagementQuantityEditTitle: '点击后按回车确认修改数量',
      itemAddEmpty: '当前没有匹配的物品。',
      itemAddNoSelection: '请至少填写一个要新增的物品数量。',
      playerCardAria: '用户名片',
      playerFrameAlt: '玩家头像框',
      playerAvatarAlt: '玩家头像',
      playerName: '昵称',
      playerLikes: '点赞',
      playerGender: '性别',
      playerStatsAria: '玩家阶级与经验',
      playerLevel: '阶级',
      playerExp: '经验',
      statusSdkTitle: 'SDK 服务器状态',
      statusSdkHint: 'HTTP / HTTPS 检查',
      statusGameTitle: '游戏服务器状态',
      statusGameHint: 'TCP 连接检查',
      statusUnknownLatency: '未知耗时',
      statusFirstCheckPending: '等待首次检查结果',
      statusLastChecked: '最近检查: {time}',
      statusLatency: '耗时: {latency}',
      statusHistoryAria: '{title} 历史状态',
      statusLoadFailed: '加载状态失败',
      databaseStatusLoadFailed: '加载数据库状态失败',
      statusNoRecords: '暂无记录',
      stateHealthy: '正常',
      stateUnhealthy: '异常',
      stateUnknown: '未知',
      playerGenderUnset: '未设置',
      playerGenderFemale: '女',
      playerGenderMale: '男',
      portraitFrame: '头像框',
      portrait: '头像',
      background: '背景',
      configEditorEmptyHint: '点击“修改配置”后加载 config.json。',
      configJsonRootInvalid: 'config.json 顶层必须是 JSON 对象。',
      configJsonValid: 'JSON 语法正确，可以保存。',
      configJsonInvalid: 'JSON 语法无效。',
      configStatusLoading: '加载中...',
      configFeedbackLoading: '正在读取 config.json ...',
      configStatusSaving: '保存中...',
      configFeedbackSaving: '正在保存 config.json ...',
      configStatusIdle: '未加载',
      configStatusReadonly: '只读',
      configFeedbackReadonly: '服务器已启动，当前仅允许查看配置。',
      configStatusDirty: '已修改',
      configStatusSynced: '已同步',
      configFeedbackDirty: '检测到未保存修改。',
      configStatusSyntaxError: '语法错误',
      configReadFailed: '读取配置文件失败。',
      configPath: '配置文件: {path}',
      configStatusLoaded: '已加载',
      configFeedbackLoaded: 'config.json 已加载，可以开始编辑。',
      configStatusLoadFailed: '加载失败',
      configSaveFailed: '保存配置文件失败。',
      configStatusSaved: '已保存',
      configFeedbackSaved: '配置已保存，后端已重新读取 config.json。',
      configStatusSaveFailed: '保存失败',
      modalTitleDefault: '操作提示',
      modalEyebrowDefault: '提示',
      modalSuccessTitle: '操作成功',
      modalSuccessEyebrow: '操作成功',
      logoutConfirmEyebrow: '退出确认',
      logoutConfirmTitle: '确认退出登录',
      logoutConfirmMessage: '确认退出当前登录状态吗？',
      logoutConfirmSubmit: '确认退出',
      controlAcknowledge: '知道了',
      languageSwitcherLabel: '语言',
    },
    runtime: {
      apiUnknown: '请求失败，请稍后重试。',
      apiValidationFailed: '请求参数校验失败。',
      apiInvalidJson: '请求体格式无效。',
      authInvalidCredentials: '账号或密码错误，请重新输入。',
      authSessionInvalid: '当前会话未登录或已失效。',
      databaseUnhealthyAccountsAccess: '数据库服务未处于正常状态，暂时无法访问账号管理。',
      databaseUnhealthyAccountSelection: '数据库服务未处于正常状态，暂时无法选定账户。',
      databaseUnhealthyPasswordReset: '数据库服务未处于正常状态，暂时无法重置密码。',
      databaseUnhealthyPlayerView: '数据库服务未处于正常状态，暂时无法查看用户名片。',
      databaseUnhealthyPlayerUpdate: '数据库服务未处于正常状态，暂时无法修改用户名片。',
      accountNotFound: '未找到对应 UID 的账户。',
      accountSelectionRequired: '请先在账号管理中选定一个用户。',
      accountSelectedMissing: '当前选定用户已不存在，请重新选择。',
      accountPasswordTooShortApi: '新密码长度必须大于等于 6 位。',
      playerNotFound: '未找到对应 UID 的用户名片。',
      playerFieldNotEditable: '当前字段不允许修改。',
      playerIntegerInvalid: '请输入有效的整数。',
      playerValueBelowZero: '数值不能小于 0。',
      playerPortraitIdInvalid: '请输入有效的头像 ID。',
      playerPortraitIdBelowZero: '头像 ID 不能小于 0。',
      playerPortraitNotFound: '未找到对应头像资源。',
      playerFrameIdInvalid: '请输入有效的头像框 ID。',
      playerFrameIdBelowZero: '头像框 ID 不能小于 0。',
      playerFrameNotFound: '未找到对应头像框资源。',
      playerBackgroundIdInvalid: '请输入有效的背景 ID。',
      playerBackgroundIdBelowZero: '背景 ID 不能小于 0。',
      playerBackgroundNotFound: '未找到对应背景资源。',
      serverLogsUnavailable: '服务器未处于可查看日志状态。',
      serverConfigUnavailable: '未找到可用的服务器配置。',
      serverConfigReadonlyWhileRunning: '服务器启动时不允许修改配置。',
      serverConfigNotFound: '未找到配置文件：{path}',
      serverConfigReadFailedApi: '读取配置文件失败。',
      serverConfigInvalidJsonApi: 'JSON 格式无效：{reason}（第 {line} 行，第 {column} 列）',
      serverConfigRootNotObject: '配置文件顶层必须是 JSON 对象。',
      serverConfigSaveFailedApi: '保存配置文件失败。',
      serverStartCommandFailed: '启动命令执行失败。',
      serverStartProcessNotDetected: '未检测到服务器进程，启动失败。',
      serverBinaryMissing: '服务器启动文件不存在，无法执行启动操作。',
      serverLogFileMissingApi: '未找到运行时日志文件：{path}',
      serverLogFileReadFailedApi: '读取日志文件失败：{reason}',
      serverLogStreamEndedApi: '日志流已结束。',
      serverLogStreamStoppedApi: '服务器已停止，日志流已结束。',
      serverLogFileDeletedApi: '日志文件已不存在。',
      databaseUnhealthySelectBlocked: '数据库服务未处于正常状态，暂时无法选定账户。',
      clearSelectedAccountFailed: '清空已选定用户失败',
      loadSelectedAccountFailed: '加载已选定用户失败',
      selectAccountFailed: '选定账户失败',
      loadAccountsFailed: '加载账户列表失败',
      accountsAccessTitle: '仅在数据库服务正常时允许查看账号管理',
      playerProfileAccessTitle: '仅在数据库服务正常时允许查看用户名片',
      playerProfileNeedAccountTitle: '请先在账号管理中选定一个用户',
      itemManagementAccessTitle: '仅在数据库服务正常且已选定用户时允许查看道具管理',
      itemManagementNeedAccountTitle: '请先在账号管理中选定一个用户',
      playerProfileUnavailable: '数据库服务正常后可查看用户名片。',
      playerProfilePrompt: '进入该分栏后可查看当前选定用户的玩家资料。',
      playerProfileLoading: '正在加载玩家资料...',
      playerProfileLoadFailed: '加载用户名片失败',
      itemManagementClearPending: '清空物品功能暂未实现。',
      itemManagementAddPending: '新增物品功能暂未实现。',
      itemDeleteEyebrow: '道具操作',
      itemDeleteTitle: '确认删除物品',
      itemDeleteDefaultMessage: '确认执行当前道具操作吗？',
      itemDeleteSubmit: '确认删除',
      itemDeleteConfirm: '确认删除物品 {itemName}（ID {itemId}，数量 {quantity}）吗？',
      itemDeleteSuccessTitle: '删除完成',
      itemDeleteSuccess: '已删除物品 {itemName}（ID {itemId}）。',
      itemDeleteFailed: '删除物品失败',
      itemClearTitle: '确认清空物品',
      itemClearSubmit: '确认清空',
      itemClearConfirm: '确认清空当前搜索“{keyword}”命中的所有可删除物品吗？',
      itemClearAllConfirm: '确认清空当前账号下所有可删除物品吗？',
      itemClearSuccessTitle: '清空完成',
      itemClearSuccess: '已清空搜索“{keyword}”命中的 {count} 个物品。',
      itemClearAllSuccess: '已清空当前账号下 {count} 个可删除物品。',
      itemClearFailed: '清空物品失败',
      itemDeleteProtected: 'ID 为 1 - 18 的物品不允许删除。',
      itemUpdateProtected: 'ID 为 1 - 18 的物品不允许修改数量。',
      itemQuantityInvalid: '请输入 1 到 99999 之间的整数。',
      itemQuantityMin: '物品数量不能小于 1。',
      itemQuantityMax: '物品数量不能大于 99999。',
      itemQuantityUpdateFailed: '修改物品数量失败',
      itemAddEyebrow: '新增物品',
      itemAddTitle: '选择要新增的物品',
      itemAddDescription: '通过搜索选择物品，并在数量列填写 1 到 99999 之间的整数后提交。',
      itemAddSearchPlaceholder: '输入物品名进行搜索',
      itemAddSubmit: '确认新增',
      itemAddSuccessTitle: '新增完成',
      itemAddSuccess: '已处理 {addedCount} 种物品，其中新增 {createdCount} 种，累加 {updatedCount} 种。',
      itemAddFailed: '新增物品失败',
      playerFieldName: '昵称',
      playerFieldGender: '性别',
      playerFieldLikes: '点赞',
      playerFieldLevel: '阶级',
      playerNameRequired: '昵称不能为空。',
      playerNameInvalid: '昵称仅允许中文、英文、数字、空格、下划线和短横线。',
      playerGenderInvalid: '性别仅允许为男或女。',
      playerLikesInvalid: '点赞必须为大于等于 0 的整数。',
      playerLevelInvalid: '阶级必须为大于等于 0 的整数。',
      playerEditPickerTitle: '点击后选择{label}',
      playerEditInputTitle: '点击后按回车确认修改',
      playerEditAria: '编辑{label}',
      playerEditConfirmRisk: '游戏服务器尚未关闭，改动可能不生效，且有可能损坏原始数据！',
      playerProfileUpdateFailed: '修改用户名片失败',
      portraitPickerTitle: '选择{label}',
      portraitPickerEyebrow: '{label}选择',
      portraitPickerCurrent: '当前使用：{name}',
      portraitPickerMissing: '请选择一个可用资源。',
      accountPasswordDefaultFeedback: '密码长度需大于等于 6 位。',
      accountPasswordTarget: '目标账户：UID {uid}（用户名 {username}）',
      accountPasswordTooShort: '新密码长度必须大于等于 6 位。',
      accountPasswordMismatch: '两次输入的密码不一致。',
      accountPasswordValid: '密码校验通过，可以提交。',
      accountPasswordResetFailed: '重置密码失败',
      accountPasswordResetSuccessTitle: '密码重置成功',
      accountPasswordResetSuccess: 'UID {uid} 的密码已重置。',
      accountDeleteConfirm: '确认删除 UID {uid}（用户名 {username}）吗？',
      accountDeleteRemainingEmpty: '当前页账户已全部移除，重新进入账号管理后可重新加载。',
      accountDeleteSuccessTitle: '删除完成',
      accountDeleteSuccess: 'UID {uid} 已从当前列表移除。',
      accountDeleteFailed: '删除账户失败',
      serverLogClosedMessage: '\n[日志流结束] 服务器当前不可查看日志。\n',
      serverLogClosedState: '已关闭',
      serverLogConnecting: '连接中...',
      serverLogErrorState: '连接异常',
      serverLogEndedState: '已结束',
      serverLogReconnecting: '连接中断，正在重连...',
      serverStart: '启动',
      serverStop: '停止',
      serverStarting: '启动中...',
      serverStartFailed: '服务器启动请求失败。',
      serverStopFailed: '服务器停止请求失败。',
      serverLogLoading: '正在加载最近日志...',
      serverLogEmpty: '日志文件当前没有内容。',
      serverLogRefreshed: '日志已刷新。',
      serverLogStreamError: '\n[日志流错误] {message}\n',
      serverLogStreamEnded: '\n[日志流结束] {message}\n',
      serverLogCleared: '日志显示已清空，等待新的日志输出...',
      serverLogLive: '实时日志',
      serverLogTitle: '服务器日志',
      serverLogDisconnected: '未连接',
      serverLogPath: '日志文件: {path}',
      serverLogInitialContent: '点击“查看日志”后显示最近日志。',
      serverLogClear: '清空显示',
      configModalEyebrow: 'JSON 配置',
      configModalTitle: '修改服务器配置',
      configModalIdle: '未加载',
      configModalPath: '配置文件: {path}',
      configModalDescription: '仅在服务器未启动时允许保存，保存前会校验 JSON 语法。',
      configEditorAria: 'config.json 编辑器',
      configReload: '重新加载',
      configSave: '保存',
      accountDeleteEyebrow: '删除确认',
      accountDeleteTitle: '确认删除账户',
      accountDeleteDefaultMessage: '确认删除该账户吗？',
      accountDeleteSubmit: '确认删除',
      accountPasswordEyebrow: '密码管理',
      accountPasswordTitle: '重置密码',
      accountPasswordDescription: '请为指定账户设置新的密码。',
      accountPasswordNew: '新密码',
      accountPasswordConfirm: '确认新密码',
      playerPickerResourceEyebrow: '资源选择',
      playerPickerResourceTitle: '选择资源',
      playerPickerResourceDescription: '请选择要应用到玩家名片上的资源。',
      playerPickerConfirm: '确认',
    },
  },
  'en-US': {
    common: {
      appName: 'WACMK PGR Management',
      localeZh: '中文',
      localeEn: 'English',
      confirm: 'Confirm',
      cancel: 'Cancel',
      close: 'Close',
      gotIt: 'OK',
      loading: 'Loading...',
      success: 'Success',
      prompt: 'Notice',
      notAvailable: '--',
    },
    login: {
      title: 'Sign In',
      username: 'Username',
      usernamePlaceholder: 'Enter username',
      password: 'Password',
      passwordPlaceholder: 'Enter password',
      submit: 'Sign In',
      submitting: 'Opening dashboard...',
      authenticating: 'Verifying credentials...',
      emptyFields: 'Please enter both username and password.',
      failedEyebrow: 'Sign-in failed',
      failedTitle: 'Check your username and password',
      invalidCredentials: 'Incorrect username or password. Please try again.',
      switcherLabel: 'Language',
    },
    dashboard: {
      title: 'Game Server Management',
      sidebarAria: 'Dashboard navigation',
      sidebarSubtitle: 'Admin dashboard',
      sidebarServerManagement: 'Game Server Management',
      sidebarDatabaseManagement: 'User Data Management',
      sidebarHealthy: 'System operating normally',
      logout: 'Sign Out',
      logoutPending: 'Signing out...',
      serverStop: 'Stop',
      serverViewLogs: 'View Logs',
      serverEditConfig: 'Edit Config',
      toggleSidebar: 'Toggle sidebar',
      serverVersion: 'Server version: {version}',
      nextHealthCheck: 'Next health check in: {seconds}s',
      nextHealthCheckIdle: 'Next health check in: --',
      databaseSubnavAria: 'User Data Management secondary navigation',
      databaseStatusTab: 'Database Status',
      accountsTab: 'Accounts',
      playerProfileTab: 'User Card',
      itemManagementTab: 'Items',
      selectedUser: 'Selected user UID: {uid}',
      databaseStatusTitle: 'Database Status',
      databaseStatusInterval: 'Next health check in: {seconds}s',
      databaseStatusIntervalIdle: 'Next health check in: --',
      accountsTitle: 'Accounts',
      accountsDescription: 'Displays account records from the MongoDB accounts collection, 10 rows per page.',
      accountsUnavailable: 'Available only when the database service is healthy',
      accountsReady: 'Database service is healthy and account data is available',
      accountsLoaded: 'Account list loaded, 10 rows per page',
      accountsStateReady: 'Account data will be available once the database service is healthy.',
      accountsStateLoading: 'Loading account list...',
      accountsStateEmpty: 'No account data available.',
      accountsSummaryTotal: '{total} accounts total, 10 per page',
      accountsPagination: 'Page {page} / {totalPages}',
      accountsPrev: 'Previous',
      accountsNext: 'Next',
      accountsUid: 'UID',
      accountsUsername: 'Username',
      accountsAction: 'Actions',
      accountSelect: 'Select',
      accountSelected: 'Selected',
      accountSelecting: 'Selecting...',
      accountResetPassword: 'Reset Password',
      accountDelete: 'Delete',
      playerProfileTitle: 'User Card',
      playerProfileChooseAccount: 'Select an account in the Accounts tab first.',
      itemManagementTitle: 'Item Management',
      itemManagementDescription: 'This tab is used to manage item data for the selected user.',
      itemManagementChooseAccount: 'Select an account in the Accounts tab first.',
      itemManagementUnavailable: 'Available only when the database service is healthy and a user is selected',
      itemManagementReady: 'Open this tab to view the item list for the currently selected user.',
      itemManagementLoading: 'Loading item list...',
      itemManagementEmpty: 'No eligible items are available for the current user.',
      itemManagementSummaryTotal: '{total} items total, 10 per page',
      itemManagementItemId: 'Item ID',
      itemManagementItemName: 'Name',
      itemManagementQuantity: 'Quantity',
      itemManagementAction: 'Actions',
      itemManagementClear: 'Clear Items',
      itemManagementSearchPlaceholder: 'Type an item name and press Enter',
      itemManagementDelete: 'Delete',
      itemManagementAddItem: 'Add Item',
      itemManagementQuantityEditTitle: 'Click, then press Enter to confirm the quantity change',
      itemAddEmpty: 'No matching items are available.',
      itemAddNoSelection: 'Enter a quantity for at least one item before submitting.',
      playerCardAria: 'User card',
      playerFrameAlt: 'Player frame',
      playerAvatarAlt: 'Player avatar',
      playerName: 'Nickname',
      playerLikes: 'Likes',
      playerGender: 'Gender',
      playerStatsAria: 'Player level and experience',
      playerLevel: 'Level',
      playerExp: 'Experience',
      statusSdkTitle: 'SDK Server Status',
      statusSdkHint: 'HTTP / HTTPS checks',
      statusGameTitle: 'Game Server Status',
      statusGameHint: 'TCP connectivity checks',
      statusUnknownLatency: 'Latency unknown',
      statusFirstCheckPending: 'Waiting for the first health check result',
      statusLastChecked: 'Last checked: {time}',
      statusLatency: 'Latency: {latency}',
      statusHistoryAria: '{title} history',
      statusLoadFailed: 'Failed to load server status',
      databaseStatusLoadFailed: 'Failed to load database status',
      statusNoRecords: 'No records yet',
      stateHealthy: 'Healthy',
      stateUnhealthy: 'Unhealthy',
      stateUnknown: 'Unknown',
      playerGenderUnset: 'Unset',
      playerGenderFemale: 'Female',
      playerGenderMale: 'Male',
      portraitFrame: 'Frame',
      portrait: 'Avatar',
      background: 'Background',
      configEditorEmptyHint: 'Click "Edit Config" to load config.json.',
      configJsonRootInvalid: 'The top-level value in config.json must be a JSON object.',
      configJsonValid: 'JSON syntax is valid and ready to save.',
      configJsonInvalid: 'Invalid JSON syntax.',
      configStatusLoading: 'Loading...',
      configFeedbackLoading: 'Reading config.json ...',
      configStatusSaving: 'Saving...',
      configFeedbackSaving: 'Saving config.json ...',
      configStatusIdle: 'Not loaded',
      configStatusReadonly: 'Read-only',
      configFeedbackReadonly: 'The server is running, so the config is view-only right now.',
      configStatusDirty: 'Modified',
      configStatusSynced: 'In sync',
      configFeedbackDirty: 'Unsaved changes detected.',
      configStatusSyntaxError: 'Syntax error',
      configReadFailed: 'Failed to read the config file.',
      configPath: 'Config file: {path}',
      configStatusLoaded: 'Loaded',
      configFeedbackLoaded: 'config.json is loaded and ready to edit.',
      configStatusLoadFailed: 'Load failed',
      configSaveFailed: 'Failed to save the config file.',
      configStatusSaved: 'Saved',
      configFeedbackSaved: 'Configuration saved and config.json was reloaded by the backend.',
      configStatusSaveFailed: 'Save failed',
      modalTitleDefault: 'Action Notice',
      modalEyebrowDefault: 'Notice',
      modalSuccessTitle: 'Success',
      modalSuccessEyebrow: 'Success',
      logoutConfirmEyebrow: 'Sign-out confirmation',
      logoutConfirmTitle: 'Confirm sign out',
      logoutConfirmMessage: 'Do you want to sign out of the current session?',
      logoutConfirmSubmit: 'Sign Out',
      controlAcknowledge: 'OK',
      languageSwitcherLabel: 'Language',
    },
    runtime: {
      apiUnknown: 'Request failed. Please try again later.',
      apiValidationFailed: 'Request validation failed.',
      apiInvalidJson: 'Request body format is invalid.',
      authInvalidCredentials: 'Incorrect username or password. Please try again.',
      authSessionInvalid: 'The current session is not authenticated or has expired.',
      databaseUnhealthyAccountsAccess: 'The database service is not healthy, so account management is unavailable.',
      databaseUnhealthyAccountSelection: 'The database service is not healthy, so account selection is unavailable.',
      databaseUnhealthyPasswordReset: 'The database service is not healthy, so password reset is unavailable.',
      databaseUnhealthyPlayerView: 'The database service is not healthy, so the user card is unavailable.',
      databaseUnhealthyPlayerUpdate: 'The database service is not healthy, so the user card cannot be updated.',
      accountNotFound: 'No account was found for the specified UID.',
      accountSelectionRequired: 'Select an account in account management first.',
      accountSelectedMissing: 'The selected account no longer exists. Please select another one.',
      accountPasswordTooShortApi: 'The new password must be at least 6 characters long.',
      playerNotFound: 'No user card was found for the specified UID.',
      playerFieldNotEditable: 'This field cannot be edited.',
      playerIntegerInvalid: 'Enter a valid integer.',
      playerValueBelowZero: 'The value cannot be less than 0.',
      playerPortraitIdInvalid: 'Enter a valid portrait ID.',
      playerPortraitIdBelowZero: 'Portrait ID cannot be less than 0.',
      playerPortraitNotFound: 'The requested portrait resource was not found.',
      playerFrameIdInvalid: 'Enter a valid frame ID.',
      playerFrameIdBelowZero: 'Frame ID cannot be less than 0.',
      playerFrameNotFound: 'The requested frame resource was not found.',
      playerBackgroundIdInvalid: 'Enter a valid background ID.',
      playerBackgroundIdBelowZero: 'Background ID cannot be less than 0.',
      playerBackgroundNotFound: 'The requested background resource was not found.',
      serverLogsUnavailable: 'Server logs are not available in the current state.',
      serverConfigUnavailable: 'No server configuration is available.',
      serverConfigReadonlyWhileRunning: 'Server configuration cannot be modified while the server is running.',
      serverConfigNotFound: 'Configuration file not found: {path}',
      serverConfigReadFailedApi: 'Failed to read the configuration file.',
      serverConfigInvalidJsonApi: 'Invalid JSON format: {reason} (line {line}, column {column})',
      serverConfigRootNotObject: 'The top-level value of the configuration file must be a JSON object.',
      serverConfigSaveFailedApi: 'Failed to save the configuration file.',
      serverStartCommandFailed: 'Failed to run the server start command.',
      serverStartProcessNotDetected: 'No server process was detected after startup.',
      serverBinaryMissing: 'The server executable is missing, so startup is unavailable.',
      serverLogFileMissingApi: 'Runtime log file not found: {path}',
      serverLogFileReadFailedApi: 'Failed to read the log file: {reason}',
      serverLogStreamEndedApi: 'The log stream has ended.',
      serverLogStreamStoppedApi: 'The server has stopped and the log stream has ended.',
      serverLogFileDeletedApi: 'The log file no longer exists.',
      databaseUnhealthySelectBlocked: 'The database service is not healthy, so this account cannot be selected right now.',
      clearSelectedAccountFailed: 'Failed to clear the selected account',
      loadSelectedAccountFailed: 'Failed to load the selected account',
      selectAccountFailed: 'Failed to select the account',
      loadAccountsFailed: 'Failed to load the account list',
      accountsAccessTitle: 'Accounts are available only when the database service is healthy',
      playerProfileAccessTitle: 'User card is available only when the database service is healthy',
      playerProfileNeedAccountTitle: 'Select an account in the Accounts tab first',
      itemManagementAccessTitle: 'Item management is available only when the database service is healthy and a user is selected',
      itemManagementNeedAccountTitle: 'Select an account in the Accounts tab first',
      playerProfileUnavailable: 'The user card becomes available once the database service is healthy.',
      playerProfilePrompt: 'Open this tab to view the user card for the currently selected account.',
      playerProfileLoading: 'Loading user card...',
      playerProfileLoadFailed: 'Failed to load user card',
      itemManagementClearPending: 'The clear items feature is not implemented yet.',
      itemManagementAddPending: 'The add item feature is not implemented yet.',
      itemDeleteEyebrow: 'Item Action',
      itemDeleteTitle: 'Confirm Item Deletion',
      itemDeleteDefaultMessage: 'Confirm this item action?',
      itemDeleteSubmit: 'Delete',
      itemDeleteConfirm: 'Delete item {itemName} (ID {itemId}, quantity {quantity})?',
      itemDeleteSuccessTitle: 'Deletion complete',
      itemDeleteSuccess: 'Deleted item {itemName} (ID {itemId}).',
      itemDeleteFailed: 'Failed to delete the item',
      itemClearTitle: 'Confirm Clear Items',
      itemClearSubmit: 'Clear',
      itemClearConfirm: 'Clear all deletable items matching the current search "{keyword}"?',
      itemClearAllConfirm: 'Clear all deletable items for the current account?',
      itemClearSuccessTitle: 'Clear complete',
      itemClearSuccess: 'Cleared {count} items matching "{keyword}".',
      itemClearAllSuccess: 'Cleared {count} deletable items for the current account.',
      itemClearFailed: 'Failed to clear items',
      itemDeleteProtected: 'Items with IDs from 1 to 18 cannot be deleted.',
      itemUpdateProtected: 'Items with IDs from 1 to 18 cannot have their quantity updated.',
      itemQuantityInvalid: 'Enter an integer between 1 and 99999.',
      itemQuantityMin: 'Item quantity cannot be less than 1.',
      itemQuantityMax: 'Item quantity cannot exceed 99999.',
      itemQuantityUpdateFailed: 'Failed to update the item quantity',
      itemAddEyebrow: 'Add Items',
      itemAddTitle: 'Choose Items to Add',
      itemAddDescription: 'Search for items and enter an integer from 1 to 99999 in the quantity column before submitting.',
      itemAddSearchPlaceholder: 'Search by item name',
      itemAddSubmit: 'Add Items',
      itemAddSuccessTitle: 'Items added',
      itemAddSuccess: 'Processed {addedCount} item types: created {createdCount}, updated {updatedCount}.',
      itemAddFailed: 'Failed to add items',
      playerFieldName: 'Nickname',
      playerFieldGender: 'Gender',
      playerFieldLikes: 'Likes',
      playerFieldLevel: 'Level',
      playerNameRequired: 'Nickname is required.',
      playerNameInvalid: 'Nickname may contain only Chinese or English characters, numbers, spaces, underscores, and hyphens.',
      playerGenderInvalid: 'Gender must be either male or female.',
      playerLikesInvalid: 'Likes must be an integer greater than or equal to 0.',
      playerLevelInvalid: 'Level must be an integer greater than or equal to 0.',
      playerEditPickerTitle: 'Click to choose {label}',
      playerEditInputTitle: 'Click, then press Enter to confirm',
      playerEditAria: 'Edit {label}',
      playerEditConfirmRisk: 'The game server is still running. Changes may not take effect and may damage source data. Continue?',
      playerProfileUpdateFailed: 'Failed to update user card',
      portraitPickerTitle: 'Choose {label}',
      portraitPickerEyebrow: '{label} picker',
      portraitPickerCurrent: 'Currently used: {name}',
      portraitPickerMissing: 'Choose an available resource first.',
      accountPasswordDefaultFeedback: 'Password length must be at least 6 characters.',
      accountPasswordTarget: 'Target account: UID {uid} (username {username})',
      accountPasswordTooShort: 'The new password must be at least 6 characters long.',
      accountPasswordMismatch: 'The two password entries do not match.',
      accountPasswordValid: 'Password validation passed. Ready to submit.',
      accountPasswordResetFailed: 'Failed to reset the password',
      accountPasswordResetSuccessTitle: 'Password reset complete',
      accountPasswordResetSuccess: 'Password for UID {uid} has been reset.',
      accountDeleteConfirm: 'Delete UID {uid} (username {username})?',
      accountDeleteRemainingEmpty: 'All accounts on the current page were removed. Re-enter the Accounts tab to reload.',
      accountDeleteSuccessTitle: 'Deletion complete',
      accountDeleteSuccess: 'UID {uid} has been removed from the current list.',
      accountDeleteFailed: 'Failed to delete the account',
      serverLogClosedMessage: '\n[Log stream ended] Server logs are currently unavailable.\n',
      serverLogClosedState: 'Closed',
      serverLogConnecting: 'Connecting...',
      serverLogErrorState: 'Connection error',
      serverLogEndedState: 'Ended',
      serverLogReconnecting: 'Connection lost, retrying...',
      serverStart: 'Start',
      serverStop: 'Stop',
      serverStarting: 'Starting...',
      serverStartFailed: 'Failed to send the server start request.',
      serverStopFailed: 'Failed to send the server stop request.',
      serverLogLoading: 'Loading recent logs...',
      serverLogEmpty: 'The log file is currently empty.',
      serverLogRefreshed: 'Logs refreshed.',
      serverLogStreamError: '\n[Log stream error] {message}\n',
      serverLogStreamEnded: '\n[Log stream ended] {message}\n',
      serverLogCleared: 'Log view cleared. Waiting for new output...',
      serverLogLive: 'Live Logs',
      serverLogTitle: 'Server Logs',
      serverLogDisconnected: 'Disconnected',
      serverLogPath: 'Log file: {path}',
      serverLogInitialContent: 'Click "View Logs" to show recent log output.',
      serverLogClear: 'Clear View',
      configModalEyebrow: 'JSON Config',
      configModalTitle: 'Edit Server Config',
      configModalIdle: 'Not loaded',
      configModalPath: 'Config file: {path}',
      configModalDescription: 'Saving is allowed only while the server is stopped. JSON syntax is validated before save.',
      configEditorAria: 'config.json editor',
      configReload: 'Reload',
      configSave: 'Save',
      accountDeleteEyebrow: 'Delete confirmation',
      accountDeleteTitle: 'Confirm account deletion',
      accountDeleteDefaultMessage: 'Delete this account?',
      accountDeleteSubmit: 'Delete',
      accountPasswordEyebrow: 'Password management',
      accountPasswordTitle: 'Reset password',
      accountPasswordDescription: 'Set a new password for the specified account.',
      accountPasswordNew: 'New password',
      accountPasswordConfirm: 'Confirm new password',
      playerPickerResourceEyebrow: 'Resource picker',
      playerPickerResourceTitle: 'Choose resource',
      playerPickerResourceDescription: 'Choose the resource to apply to the player card.',
      playerPickerConfirm: 'Confirm',
    },
  },
};

const listeners = new Set();

const interpolate = (template, params = {}) => {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (params[key] ?? `{${key}}`));
};

const getNestedValue = (source, key) => {
  return String(key)
    .split('.')
    .reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), source);
};

export const normalizeLocale = (locale) => {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
};

export const getLocale = () => {
  try {
    return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
};

export const t = (key, params = {}, locale = getLocale()) => {
  const activeLocale = normalizeLocale(locale);
  const resolved = getNestedValue(messages[activeLocale], key) ?? getNestedValue(messages[DEFAULT_LOCALE], key) ?? key;
  return interpolate(resolved, params);
};

export const formatWithLocale = (value, locale = getLocale(), options) => {
  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(value);
};

export const setLocale = (locale) => {
  const nextLocale = normalizeLocale(locale);

  try {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  } catch {
    // Ignore storage errors and still apply locale for this session.
  }

  document.documentElement.lang = nextLocale;
  listeners.forEach((listener) => listener(nextLocale));
  return nextLocale;
};

export const subscribeLocaleChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const applyElementTranslation = (element, locale) => {
  const textKey = element.dataset.i18n;
  const placeholderKey = element.dataset.i18nPlaceholder;
  const titleKey = element.dataset.i18nTitle;
  const ariaLabelKey = element.dataset.i18nAriaLabel;
  const altKey = element.dataset.i18nAlt;
  const params = element.dataset.i18nParams ? JSON.parse(element.dataset.i18nParams) : {};

  if (textKey) {
    element.textContent = t(textKey, params, locale);
  }

  if (placeholderKey && 'placeholder' in element) {
    element.placeholder = t(placeholderKey, params, locale);
  }

  if (titleKey) {
    element.setAttribute('title', t(titleKey, params, locale));
  }

  if (ariaLabelKey) {
    element.setAttribute('aria-label', t(ariaLabelKey, params, locale));
  }

  if (altKey) {
    element.setAttribute('alt', t(altKey, params, locale));
  }
};

export const applyI18n = (root = document, locale = getLocale()) => {
  const scope = root instanceof Document ? root : root.ownerDocument ?? document;
  scope.documentElement.lang = normalizeLocale(locale);

  const elements = root.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-alt]');
  elements.forEach((element) => applyElementTranslation(element, locale));

  const switchers = root.querySelectorAll('[data-locale-switcher]');
  switchers.forEach((switcher) => {
    if (switcher instanceof HTMLSelectElement) {
      switcher.value = normalizeLocale(locale);
    }
  });
};

export const initLocaleControls = (root = document, onChange) => {
  root.querySelectorAll('[data-locale-switcher]').forEach((switcher) => {
    switcher.addEventListener('change', (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }

      const locale = setLocale(target.value);
      applyI18n(document, locale);
      if (typeof onChange === 'function') {
        onChange(locale);
      }
    });
  });
};

export const initI18n = (root = document, onChange) => {
  const locale = getLocale();
  applyI18n(root, locale);
  initLocaleControls(root, onChange);
  return locale;
};

export const i18nMessages = messages;

const API_ERROR_TRANSLATION_KEYS = {
  'request.validation_failed': 'runtime.apiValidationFailed',
  'request.invalid_json': 'runtime.apiInvalidJson',
  'auth.invalid_credentials': 'runtime.authInvalidCredentials',
  'auth.session_invalid': 'runtime.authSessionInvalid',
  'database.unhealthy_accounts_access': 'runtime.databaseUnhealthyAccountsAccess',
  'database.unhealthy_account_selection': 'runtime.databaseUnhealthyAccountSelection',
  'database.unhealthy_password_reset': 'runtime.databaseUnhealthyPasswordReset',
  'database.unhealthy_player_view': 'runtime.databaseUnhealthyPlayerView',
  'database.unhealthy_player_update': 'runtime.databaseUnhealthyPlayerUpdate',
  'account.not_found': 'runtime.accountNotFound',
  'account.selection_required': 'runtime.accountSelectionRequired',
  'account.selected_account_missing': 'runtime.accountSelectedMissing',
  'account.password_too_short': 'runtime.accountPasswordTooShortApi',
  'player.not_found': 'runtime.playerNotFound',
  'player.field_not_editable': 'runtime.playerFieldNotEditable',
  'player.name_required': 'runtime.playerNameRequired',
  'player.name_invalid': 'runtime.playerNameInvalid',
  'player.gender_invalid': 'runtime.playerGenderInvalid',
  'player.integer_invalid': 'runtime.playerIntegerInvalid',
  'player.value_below_zero': 'runtime.playerValueBelowZero',
  'player.portrait_id_invalid': 'runtime.playerPortraitIdInvalid',
  'player.portrait_id_below_zero': 'runtime.playerPortraitIdBelowZero',
  'player.portrait_not_found': 'runtime.playerPortraitNotFound',
  'player.frame_id_invalid': 'runtime.playerFrameIdInvalid',
  'player.frame_id_below_zero': 'runtime.playerFrameIdBelowZero',
  'player.frame_not_found': 'runtime.playerFrameNotFound',
  'player.background_id_invalid': 'runtime.playerBackgroundIdInvalid',
  'player.background_id_below_zero': 'runtime.playerBackgroundIdBelowZero',
  'player.background_not_found': 'runtime.playerBackgroundNotFound',
  'server.logs_unavailable': 'runtime.serverLogsUnavailable',
  'server.config_unavailable': 'runtime.serverConfigUnavailable',
  'server.config_readonly_while_running': 'runtime.serverConfigReadonlyWhileRunning',
  'server.config_not_found': 'runtime.serverConfigNotFound',
  'server.config_read_failed': 'runtime.serverConfigReadFailedApi',
  'server.config_invalid_json': 'runtime.serverConfigInvalidJsonApi',
  'server.config_root_not_object': 'runtime.serverConfigRootNotObject',
  'server.config_save_failed': 'runtime.serverConfigSaveFailedApi',
  'server.start_command_failed': 'runtime.serverStartCommandFailed',
  'server.start_process_not_detected': 'runtime.serverStartProcessNotDetected',
  'server.binary_missing': 'runtime.serverBinaryMissing',
  'server.log_file_missing': 'runtime.serverLogFileMissingApi',
  'server.log_file_read_failed': 'runtime.serverLogFileReadFailedApi',
  'server.log_stream_ended': 'runtime.serverLogStreamEndedApi',
  'server.log_stream_stopped': 'runtime.serverLogStreamStoppedApi',
  'server.log_file_deleted': 'runtime.serverLogFileDeletedApi',
  'server.binary_missing': 'runtime.serverBinaryMissing',
};

export class ApiError extends Error {
  constructor({ code, details, message, status }) {
    super(message || code || 'api_error');
    this.name = 'ApiError';
    this.code = code || null;
    this.details = details && typeof details === 'object' ? details : null;
    this.status = Number.isFinite(status) ? status : null;
  }
}

export const getLocalizedApiErrorMessage = (error, locale = getLocale(), fallbackKey = 'runtime.apiUnknown') => {
  if (error instanceof ApiError && error.code) {
    const translationKey = API_ERROR_TRANSLATION_KEYS[error.code];
    if (translationKey) {
      return t(translationKey, error.details ?? {}, locale);
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t(fallbackKey, {}, locale);
};

export const parseApiErrorPayload = (payload, status) => {
  if (payload && typeof payload === 'object') {
    return new ApiError({
      code: typeof payload.code === 'string' ? payload.code : null,
      details: payload.details,
      message: typeof payload.message === 'string' ? payload.message : null,
      status,
    });
  }

  return new ApiError({ status });
};

export const apiFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('Accept-Language', getLocale());

  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw parseApiErrorPayload(payload, response.status);
  }

  return payload;
};

export const resolveUiTextToken = (token, locale = getLocale()) => {
  if (typeof token !== 'string' || !token) {
    return token;
  }

  try {
    const payload = JSON.parse(token);
    if (payload && typeof payload === 'object' && typeof payload.key === 'string') {
      return getLocalizedApiErrorMessage(new ApiError({ code: payload.key, details: payload.details, message: null, status: null }), locale);
    }
  } catch {
    return token;
  }

  return token;
};
