from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException


@dataclass(slots=True)
class AppError(Exception):
    code: str
    status_code: int
    details: dict[str, Any] | None = None


ERROR_MESSAGES = {
    'auth.invalid_credentials': {
        'zh-CN': '账号或密码错误。',
        'en-US': 'Incorrect username or password.',
    },
    'auth.session_invalid': {
        'zh-CN': '当前会话未登录或已失效。',
        'en-US': 'The current session is not authenticated or has expired.',
    },
    'database.unhealthy_accounts_access': {
        'zh-CN': '数据库服务未处于正常状态，暂时无法访问账号管理。',
        'en-US': 'The database service is not healthy, so account management is unavailable.',
    },
    'database.unhealthy_account_selection': {
        'zh-CN': '数据库服务未处于正常状态，暂时无法选定账户。',
        'en-US': 'The database service is not healthy, so account selection is unavailable.',
    },
    'database.unhealthy_password_reset': {
        'zh-CN': '数据库服务未处于正常状态，暂时无法重置密码。',
        'en-US': 'The database service is not healthy, so password reset is unavailable.',
    },
    'database.unhealthy_player_view': {
        'zh-CN': '数据库服务未处于正常状态，暂时无法查看玩家信息。',
        'en-US': 'The database service is not healthy, so the player profile is unavailable.',
    },
    'database.unhealthy_player_update': {
        'zh-CN': '数据库服务未处于正常状态，暂时无法修改玩家信息。',
        'en-US': 'The database service is not healthy, so the player profile cannot be updated.',
    },
    'account.not_found': {
        'zh-CN': '未找到对应 UID 的账户。',
        'en-US': 'No account was found for the specified UID.',
    },
    'account.selection_required': {
        'zh-CN': '请先在账号管理中选定一个用户。',
        'en-US': 'Select an account in account management first.',
    },
    'account.selected_account_missing': {
        'zh-CN': '当前选定用户已不存在，请重新选择。',
        'en-US': 'The selected account no longer exists. Please select another one.',
    },
    'account.password_too_short': {
        'zh-CN': '新密码长度必须大于等于 6 位。',
        'en-US': 'The new password must be at least 6 characters long.',
    },
    'player.not_found': {
        'zh-CN': '未找到对应 UID 的玩家信息。',
        'en-US': 'No player profile was found for the specified UID.',
    },
    'player.field_not_editable': {
        'zh-CN': '当前字段不允许修改。',
        'en-US': 'This field cannot be edited.',
    },
    'player.name_required': {
        'zh-CN': '昵称不能为空。',
        'en-US': 'Nickname is required.',
    },
    'player.name_invalid': {
        'zh-CN': '昵称仅允许中文、英文、数字、空格、下划线和短横线。',
        'en-US': 'Nickname may contain only Chinese or English characters, numbers, spaces, underscores, and hyphens.',
    },
    'player.gender_invalid': {
        'zh-CN': '性别仅允许为男或女。',
        'en-US': 'Gender must be either male or female.',
    },
    'player.integer_invalid': {
        'zh-CN': '请输入有效的整数。',
        'en-US': 'Enter a valid integer.',
    },
    'player.value_below_zero': {
        'zh-CN': '数值不能小于 0。',
        'en-US': 'The value cannot be less than 0.',
    },
    'player.level_above_max': {
        'zh-CN': '等级不能超过最大等级 {max}。',
        'en-US': 'Level cannot exceed the maximum level {max}.',
    },
    'player.level_missing': {
        'zh-CN': '当前玩家等级缺失，无法校验经验上限。',
        'en-US': 'The current player level is missing, so the EXP limit cannot be validated.',
    },
    'player.level_not_defined': {
        'zh-CN': '等级 {level} 未在玩家等级表中定义。',
        'en-US': 'Level {level} is not defined in the player level table.',
    },
    'player.exp_above_max': {
        'zh-CN': '当前等级允许的最大经验值为 {max}。',
        'en-US': 'The maximum EXP allowed for the current level is {max}.',
    },
    'player.value_above_int32_max': {
        'zh-CN': '数值不能超过 32 位整数上限 {max}。',
        'en-US': 'The value cannot exceed the 32-bit integer limit {max}.',
    },
    'player.portrait_id_invalid': {
        'zh-CN': '请输入有效的头像 ID。',
        'en-US': 'Enter a valid portrait ID.',
    },
    'player.portrait_id_below_zero': {
        'zh-CN': '头像 ID 不能小于 0。',
        'en-US': 'Portrait ID cannot be less than 0.',
    },
    'player.portrait_not_found': {
        'zh-CN': '未找到对应头像资源。',
        'en-US': 'The requested portrait resource was not found.',
    },
    'player.frame_id_invalid': {
        'zh-CN': '请输入有效的头像框 ID。',
        'en-US': 'Enter a valid frame ID.',
    },
    'player.frame_id_below_zero': {
        'zh-CN': '头像框 ID 不能小于 0。',
        'en-US': 'Frame ID cannot be less than 0.',
    },
    'player.frame_not_found': {
        'zh-CN': '未找到对应头像框资源。',
        'en-US': 'The requested frame resource was not found.',
    },
    'database.unhealthy_item_update': {
        'zh-CN': '数据库服务未处于正常状态，暂时无法修改道具。',
        'en-US': 'The database service is not healthy, so item changes are unavailable.',
    },
    'item.delete_protected': {
        'zh-CN': 'ID 为 1 - 18 的物品不允许删除。',
        'en-US': 'Items with IDs from 1 to 18 cannot be deleted.',
    },
    'item.not_found': {
        'zh-CN': '未找到对应物品，或该物品不属于当前选定用户。',
        'en-US': 'The item was not found or does not belong to the selected user.',
    },
    'stage.not_found': {
        'zh-CN': '未找到对应战场，或该战场不属于当前选定用户。',
        'en-US': 'The stage was not found or does not belong to the selected user.',
    },
    'stage.add_empty': {
        'zh-CN': '请至少选择一个要跳过的战场。',
        'en-US': 'Choose at least one stage before submitting.',
    },
    'stage.add_stage_not_found': {
        'zh-CN': '存在未识别的战场 ID。',
        'en-US': 'One or more stage IDs are not recognized.',
    },
    'weapon.not_found': {
        'zh-CN': '未找到对应武器，或该武器不属于当前选定用户。',
        'en-US': 'The weapon was not found or does not belong to the selected user.',
    },
    'weapon.delete_equipped_forbidden': {
        'zh-CN': '已穿戴的武器不允许删除。',
        'en-US': 'Equipped weapons cannot be deleted.',
    },
    'weapon.add_template_invalid': {
        'zh-CN': '所选武器模板无效或不可用。',
        'en-US': 'The selected weapon template is invalid or unavailable.',
    },
    'weapon.equips_missing': {
        'zh-CN': '当前用户缺少可参考的武器数据，无法新增武器。',
        'en-US': 'No existing weapon data was found for the current user.',
    },
    'weapon.add_failed': {
        'zh-CN': '新增武器失败。',
        'en-US': 'Failed to add weapons.',
    },
    'character.equip_type_invalid': {
        'zh-CN': '当前角色缺少有效的武器类型，无法切换武器。',
        'en-US': 'The current character has no valid weapon type, so weapon switching is unavailable.',
    },
    'character.weapon_type_mismatch': {
        'zh-CN': '所选武器与当前角色的武器类型不匹配。',
        'en-US': 'The selected weapon type does not match the current character.',
    },
    'character.weapon_swap_requires_weapon': {
        'zh-CN': '当前角色没有可交还的武器，无法取用其他角色已穿戴的武器。',
        'en-US': 'The current character needs a weapon to return before taking another character\'s equipped weapon.',
    },
    'character.add_invalid': {
        'zh-CN': '角色 ID 无效，或缺少进化、默认涂装、默认武器配置，暂时无法添加。',
        'en-US': 'The character ID is invalid or its quality, default fashion, or default weapon configuration is missing.',
    },
    'character.max_template_not_found': {
        'zh-CN': '当前角色缺少完整的培养或推荐装备配置，暂时无法拉满。',
        'en-US': 'Complete progression or recommended equipment data is missing for this character.',
    },
    'equips.resonance_not_found': {
        'zh-CN': '未找到对应共鸣槽位数据。',
        'en-US': 'The requested resonance slot data was not found.',
    },
    'item.keyword_required_for_clear': {
        'zh-CN': '请先输入搜索条件后再清空物品。',
        'en-US': 'Enter a search keyword before clearing items.',
    },
    'item.update_protected': {
        'zh-CN': 'ID 为 1 - 18 的物品不允许修改数量。',
        'en-US': 'Items with IDs from 1 to 18 cannot have their quantity updated.',
    },
    'item.quantity_invalid': {
        'zh-CN': '请输入有效的物品数量。',
        'en-US': 'Enter a valid item quantity.',
    },
    'item.quantity_below_min': {
        'zh-CN': '物品数量不能小于 1。',
        'en-US': 'Item quantity cannot be less than 1.',
    },
    'item.quantity_above_max': {
        'zh-CN': '物品数量不能大于 99999。',
        'en-US': 'Item quantity cannot exceed 99999.',
    },
    'item.add_empty': {
        'zh-CN': '请至少填写一个要新增的物品。',
        'en-US': 'Add at least one item before submitting.',
    },
    'item.add_protected': {
        'zh-CN': 'ID 为 1 - 18 的物品不允许新增。',
        'en-US': 'Items with IDs from 1 to 18 cannot be added.',
    },
    'item.add_item_not_found': {
        'zh-CN': '存在未识别的物品 ID。',
        'en-US': 'One or more item IDs are not recognized.',
    },
    'item.add_quantity_invalid': {
        'zh-CN': '请输入有效的新增数量。',
        'en-US': 'Enter a valid quantity to add.',
    },
    'item.add_quantity_below_min': {
        'zh-CN': '新增数量不能小于 1。',
        'en-US': 'Added quantity cannot be less than 1.',
    },
    'item.add_quantity_above_max': {
        'zh-CN': '新增数量不能大于 99999。',
        'en-US': 'Added quantity cannot exceed 99999.',
    },
    'item.add_total_above_max': {
        'zh-CN': '新增后物品总数不能大于 99999。',
        'en-US': 'The total item quantity after adding cannot exceed 99999.',
    },
    'server.logs_unavailable': {
        'zh-CN': '服务器未处于可查看日志状态。',
        'en-US': 'Server logs are not available in the current state.',
    },
    'server.config_unavailable': {
        'zh-CN': '未找到可用的服务器配置。',
        'en-US': 'No server configuration is available.',
    },
    'server.config_readonly_while_running': {
        'zh-CN': '服务器启动时不允许修改配置。',
        'en-US': 'Server configuration cannot be modified while the server is running.',
    },
    'server.config_not_found': {
        'zh-CN': '未找到配置文件。',
        'en-US': 'Configuration file not found.',
    },
    'server.config_read_failed': {
        'zh-CN': '读取配置文件失败。',
        'en-US': 'Failed to read the configuration file.',
    },
    'server.config_invalid_json': {
        'zh-CN': 'JSON 格式无效。',
        'en-US': 'Invalid JSON format.',
    },
    'server.config_root_not_object': {
        'zh-CN': '配置文件顶层必须是 JSON 对象。',
        'en-US': 'The top-level value of the configuration file must be a JSON object.',
    },
    'server.config_save_failed': {
        'zh-CN': '保存配置文件失败。',
        'en-US': 'Failed to save the configuration file.',
    },
    'server.start_command_failed': {
        'zh-CN': '启动命令执行失败。',
        'en-US': 'Failed to run the server start command.',
    },
    'server.start_process_not_detected': {
        'zh-CN': '未检测到服务器进程，启动失败。',
        'en-US': 'No server process was detected after startup.',
    },
    'server.binary_missing': {
        'zh-CN': '服务器启动文件不存在，无法执行启动操作。',
        'en-US': 'The server executable is missing, so startup is unavailable.',
    },
    'server.log_file_missing': {
        'zh-CN': '未找到运行时日志文件。',
        'en-US': 'Runtime log file not found.',
    },
    'server.log_file_read_failed': {
        'zh-CN': '读取日志文件失败。',
        'en-US': 'Failed to read the log file.',
    },
    'server.log_stream_ended': {
        'zh-CN': '日志流已结束。',
        'en-US': 'The log stream has ended.',
    },
    'server.log_stream_stopped': {
        'zh-CN': '服务器已停止，日志流已结束。',
        'en-US': 'The server has stopped and the log stream has ended.',
    },
    'server.log_file_deleted': {
        'zh-CN': '日志文件已不存在。',
        'en-US': 'The log file no longer exists.',
    },
    'request.validation_failed': {
        'zh-CN': '请求参数校验失败。',
        'en-US': 'Request validation failed.',
    },
    'request.invalid_json': {
        'zh-CN': '请求体不是有效的 JSON。',
        'en-US': 'Request body is not valid JSON.',
    },
    'internal.server_error': {
        'zh-CN': '服务器内部错误。',
        'en-US': 'Internal server error.',
    },
};


def normalize_locale(value: str | None) -> str:
    if value and value.lower().startswith('en'):
        return 'en-US'
    return 'zh-CN'


def get_error_message(code: str, locale: str, *, fallback: str | None = None) -> str:
    messages = ERROR_MESSAGES.get(code)
    if not messages:
        return fallback or code
    return messages.get(normalize_locale(locale), messages['zh-CN'])


def app_error(status_code: int, code: str, details: dict[str, Any] | None = None) -> AppError:
    return AppError(code=code, status_code=status_code, details=details)


def raise_http_error(status_code: int, code: str, details: dict[str, Any] | None = None) -> None:
    raise AppError(code=code, status_code=status_code, details=details)


def convert_http_exception(error: HTTPException) -> tuple[str, dict[str, Any] | None, str | None]:
    detail = error.detail
    if isinstance(detail, dict):
        code = str(detail.get('code') or 'internal.server_error')
        details = detail.get('details') if isinstance(detail.get('details'), dict) else None
        message = str(detail.get('message')) if isinstance(detail.get('message'), str) else None
        return code, details, message
    if isinstance(detail, str):
        return 'internal.server_error', None, detail
    return 'internal.server_error', None, None
