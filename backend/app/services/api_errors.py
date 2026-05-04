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
