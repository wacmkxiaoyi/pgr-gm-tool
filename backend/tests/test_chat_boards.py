from backend.app.apis.schemas import AppInfoResponse, PlayerProfileResponse
from backend.app.services.player.chat_boards import get_chat_board_entires_map, is_unlocked_chat_board_active


def test_chat_board_entries_map_reads_requested_fields_and_normalizes_icon() -> None:
    entries = get_chat_board_entires_map()

    assert entries[25000001] == {
        "Name": "Basic Chat Frame",
        "WorldDesc": "Basic Chat Frame",
        "Icon": "/assets/image/uipanelplayerinfo/uichatframeicon5.webp",
    }


def test_unlocked_chat_board_activity_honors_permanent_and_expiring_records() -> None:
    assert is_unlocked_chat_board_active({"id": 25000001, "end_time": 0}, 1_000)
    assert is_unlocked_chat_board_active({"id": 25000002, "end_time": 1_001}, 1_000)
    assert not is_unlocked_chat_board_active({"id": 25000002, "end_time": 1_000}, 1_000)
    assert not is_unlocked_chat_board_active({"id": 25000002, "end_time": -1}, 1_000)
    assert not is_unlocked_chat_board_active({"id": 25000002}, 1_000)


def test_app_info_and_player_profile_expose_chat_board_state() -> None:
    app_info = AppInfoResponse.model_validate({
        "name": "test",
        "mongo_db": "test",
        "mongo_configured": True,
        "server_management_enabled": False,
        "server_controls_visible": False,
        "player_level_max": 1,
        "player_level_max_exp_map": {},
        "player_honor_level_max": 1,
        "player_honor_level_max_exp_map": {},
        "player_portrait_url_map": {},
        "player_portrait_frame_url_map": {},
        "player_portrait_name_map": {},
        "player_portrait_frame_name_map": {},
        "player_background_url_map": {},
        "player_background_name_map": {},
        "item_name_map": {},
        "equip_name_map": {},
        "weapon_type_name_map": {},
        "equip_star_map": {},
        "equip_site_map": {},
        "equippable_memory_nums": 6,
        "equip_icon_url_map": {},
        "character_log_name_map": {},
        "character_head_icon_url_map": {},
        "chat_board_entires_map": get_chat_board_entires_map(),
    })
    profile = PlayerProfileResponse.model_validate({
        "uid": 1,
        "current_chat_board_id": 25000002,
        "unlock_chat_boards": [25000001, 25000002],
    })

    assert app_info.chat_board_entires_map[25000001].Name == "Basic Chat Frame"
    assert profile.current_chat_board_id == 25000002
    assert profile.unlock_chat_boards == [25000001, 25000002]
