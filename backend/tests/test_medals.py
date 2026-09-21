from backend.app.apis.schemas import AppInfoResponse, PlayerProfileResponse
from backend.app.services.player.medals import get_medal_entires_map, is_unlocked_medal_active


def test_medal_entries_map_reads_required_fields_and_normalizes_image() -> None:
    entries = get_medal_entires_map()

    assert entries[1] == {
        "Name": "王牌指挥勋章",
        "Desc": "在任何组织中，“王牌”都具有着非同凡响的分量，这枚“王牌指挥”勋章正是对那些在各种任务中都能进行出色指挥，起到关键作用之人的认可。",
        "MedalImg": "/assets/image/uimedal/uimedalicon1.webp",
    }


def test_unlocked_medal_activity_honors_permanent_and_expiring_records() -> None:
    assert is_unlocked_medal_active({"id": 1, "time": 100, "keep_time": 0}, 1_000)
    assert is_unlocked_medal_active({"id": 6, "time": 100, "keep_time": 10}, 109)
    assert not is_unlocked_medal_active({"id": 6, "time": 100, "keep_time": 10}, 110)
    assert not is_unlocked_medal_active({"id": 6, "time": 100, "keep_time": -1}, 100)


def test_app_info_and_player_profile_expose_medal_state() -> None:
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
        "medal_entires_map": get_medal_entires_map(),
    })
    profile = PlayerProfileResponse.model_validate({"uid": 1, "current_medal_id": 6, "unlock_medals": [1, 6]})

    assert app_info.medal_entires_map[1].Name == "王牌指挥勋章"
    assert profile.current_medal_id == 6
    assert profile.unlock_medals == [1, 6]
