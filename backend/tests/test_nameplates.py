from backend.app.apis.schemas import AppInfoResponse, PlayerProfileResponse
from backend.app.db.models.player_profile import PlayerProfileRecord
from backend.app.services.db_schema_runtime import get_database_schema_runtime
from backend.app.services.player.nameplates import get_nameplate_content_map, get_nameplate_entires_map


def test_nameplate_content_map_reads_id_and_text() -> None:
    content_map = get_nameplate_content_map()

    assert content_map[1] == "Test Nameplate {0}"


def test_nameplate_entries_resolve_text_and_normalize_assets() -> None:
    entries = get_nameplate_entires_map()
    entry = entries[17000001]

    assert entry == {
        "Id": 17000001,
        "NameplateQuality": 1,
        "Name": "Test Nameplate 1",
        "Title": "Nameplate 1",
        "Description": "Repeated Replaceable - Test Nameplate",
        "IconType": 2,
        "Icon": "/assets/atlas/uinameplate/uinameplategold.webp",
        "BackBoard": "/assets/atlas/uinameplate/uinameplategold.webp",
        "OutLineColor": None,
    }


def test_app_info_accepts_nameplate_entries_with_optional_assets() -> None:
    response = AppInfoResponse.model_validate({
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
        "nameplate_entires_map": get_nameplate_entires_map(),
    })

    entry = response.nameplate_entires_map[17000001]
    assert entry.Icon is not None
    assert entry.OutLineColor is None


def test_player_profile_response_exposes_nameplate_state() -> None:
    response = PlayerProfileResponse.model_validate({
        "uid": 1,
        "current_wear_nameplate": 17000001,
        "unlock_nameplates": [17000001, 17000002],
    })

    assert response.current_wear_nameplate == 17000001
    assert response.unlock_nameplates == [17000001, 17000002]


def test_player_profile_response_allows_nameplate_state_to_override_record_defaults() -> None:
    profile = PlayerProfileRecord(uid=1)
    response = PlayerProfileResponse(**{
        **profile.model_dump(),
        "current_wear_nameplate": 17000001,
        "unlock_nameplates": [17000001],
    })

    assert response.current_wear_nameplate == 17000001
    assert response.unlock_nameplates == [17000001]


def test_nameplate_fields_belong_to_characters_schema() -> None:
    runtime = get_database_schema_runtime()
    characters_schema = runtime.get_collection_schema("characters")
    players_schema = runtime.get_collection_schema("players")

    assert characters_schema is not None
    assert players_schema is not None
    assert characters_schema.allows_update_path("nameplates")
    assert characters_schema.allows_update_path("current_wear_nameplate")
    assert not players_schema.allows_update_path("nameplates")
    assert not players_schema.allows_update_path("current_wear_nameplate")
