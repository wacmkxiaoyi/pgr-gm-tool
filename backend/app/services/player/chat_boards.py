from __future__ import annotations

from backend.app.utils.resource_language import language_cache as lru_cache

from backend.app.services.player.constants import CHAT_BOARD_TSV_PATH
from backend.app.services.player.utils import normalize_asset_path, parse_int
from backend.app.utils.tsv_reader import TSVReader

DEFAULT_CHAT_BOARD_ID = 25000001


@lru_cache(maxsize=1)
def get_chat_board_entires_map() -> dict[int, dict[str, str | None]]:
    reader = TSVReader(CHAT_BOARD_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table("Id", ["Name", "WorldDesc", "Icon"])
    entries_map: dict[int, dict[str, str | None]] = {}

    for raw_id, row in raw_table.items():
        chat_board_id = parse_int(raw_id)
        if chat_board_id is None or chat_board_id <= 0:
            continue
        entries_map[chat_board_id] = {
            "Name": str(row.get("Name") or ""),
            "WorldDesc": str(row.get("WorldDesc") or ""),
            "Icon": normalize_asset_path(row.get("Icon")),
        }

    return entries_map


def is_unlocked_chat_board_active(unlocked_chat_board: object, now_unix_seconds: int) -> bool:
    if not isinstance(unlocked_chat_board, dict):
        return False
    end_time = parse_int(unlocked_chat_board.get("end_time"))
    return end_time is not None and (end_time == 0 or end_time > now_unix_seconds)
