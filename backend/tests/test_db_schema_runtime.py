from backend.app.services.db_schema_runtime import CompiledCollectionSchema, DatabaseSchemaRuntime
from backend.app.services.player.player_equips_service import _normalize_awake_slot_list


def test_object_node_prefers_its_own_default_when_missing() -> None:
    schema = CompiledCollectionSchema(
        {
            "WeaponOverrunData": {
                "type": "object",
                "default": {},
                "schema": {
                    "Level": {"type": "number", "default": 0},
                    "ActiveSuits": {
                        "type": "array",
                        "default": [],
                        "schema": {"type": "number", "default": 0},
                    },
                    "ChoseSuit": {"type": "number", "default": 0},
                },
            }
        }
    )

    sanitized = schema.materialize_write({}, "")

    assert sanitized == {"WeaponOverrunData": {}}


def test_existing_object_still_fills_missing_child_defaults() -> None:
    schema = CompiledCollectionSchema(
        {
            "WeaponOverrunData": {
                "type": "object",
                "default": {},
                "schema": {
                    "Level": {"type": "number", "default": 0},
                    "ActiveSuits": {"type": "array", "default": []},
                    "ChoseSuit": {"type": "number", "default": 0},
                },
            }
        }
    )

    sanitized = schema.materialize_write({"WeaponOverrunData": {"Level": 3}}, "")

    assert sanitized == {
        "WeaponOverrunData": {
            "Level": 3,
            "ActiveSuits": [],
            "ChoseSuit": 0,
        }
    }


def test_object_without_own_default_still_builds_from_children() -> None:
    schema = CompiledCollectionSchema(
        {
            "Nested": {
                "type": "object",
                "schema": {
                    "Enabled": {"type": "boolean", "default": False},
                    "Values": {"type": "array", "default": []},
                },
            }
        }
    )

    sanitized = schema.materialize_write({}, "")

    assert sanitized == {"Nested": {"Enabled": False, "Values": []}}


def test_array_node_keeps_using_its_own_default_when_missing() -> None:
    schema = CompiledCollectionSchema(
        {
            "ActiveSuits": {
                "type": "array",
                "default": [],
                "schema": {"type": "number", "default": 0},
            }
        }
    )

    sanitized = schema.materialize_write({}, "")

    assert sanitized == {"ActiveSuits": []}


def test_scalar_array_keeps_integer_items_when_materialized() -> None:
    schema = CompiledCollectionSchema(
        {
            "WeaponOverrunData": {
                "type": "object",
                "default": {},
                "schema": {
                    "ActiveSuits": {
                        "type": "array",
                        "default": [],
                        "schema": {"type": "number", "default": 0},
                    },
                },
            }
        }
    )

    sanitized = schema.materialize_write(
        {"WeaponOverrunData": {"ActiveSuits": [100101]}},
        "",
    )

    assert sanitized == {"WeaponOverrunData": {"ActiveSuits": [100101]}}


def test_player_data_scalar_arrays_materialize_as_numbers() -> None:
    runtime = DatabaseSchemaRuntime("4.0")
    player_schema = runtime.get_collection_schema("players")

    assert player_schema is not None
    materialized = player_schema.materialize_write(
        {
            "Marks": [1, 2],
            "GuideData": [3, 4],
            "Communications": [102, 103],
        },
        "player_data",
    )
    assert {
        field: materialized[field]
        for field in ("Marks", "GuideData", "Communications")
    } == {
        "Marks": [1, 2],
        "GuideData": [3, 4],
        "Communications": [102, 103],
    }


def test_equip_awake_slot_list_materializes_as_numbers() -> None:
    runtime = DatabaseSchemaRuntime("4.0")
    characters_schema = runtime.get_collection_schema("characters")

    assert characters_schema is not None
    assert characters_schema.materialize_write(
        {"AwakeSlotList": [1, 2]},
        "equips.0",
    )["AwakeSlotList"] == [1, 2]


def test_awake_slot_list_normalization_rejects_legacy_objects() -> None:
    assert _normalize_awake_slot_list([1, {"_id": 2}, {"Slot": 3}], {1, 2, 3}) == [1]


def test_opaque_object_schema_preserves_service_owned_fields() -> None:
    schema = CompiledCollectionSchema({"ServiceState": {"type": "object", "default": {}}})

    assert schema.materialize_write(
        {"ServiceState": {"FutureField": {"Nested": [1, 2]}}},
        "",
    ) == {"ServiceState": {"FutureField": {"Nested": [1, 2]}}}


def test_version_47_schema_includes_new_collection_and_service_state() -> None:
    runtime = DatabaseSchemaRuntime("4.7")
    player_schema = runtime.get_collection_schema("players")

    assert runtime.has_collection("boss_inshot_rank_entries")
    assert player_schema is not None
    assert player_schema.allows_field("version47_envelope.instrument_bindings.0.k")
    assert player_schema.allows_field("version47_pbr.stage_records.0.v.history_max_wave")
    assert player_schema.allows_field("stage_bookmark_data") is False
    assert player_schema.materialize_write(
        {"theatre6": {"Data": {"FutureField": True}}},
        "",
    )["theatre6"] == {"Data": {"FutureField": True}}


def test_version_40_schema_does_not_include_version_47_collection() -> None:
    assert not DatabaseSchemaRuntime("4.0").has_collection("boss_inshot_rank_entries")


def test_version_47_preserves_nullable_nested_service_state() -> None:
    runtime = DatabaseSchemaRuntime("4.7")
    player_schema = runtime.get_collection_schema("players")

    assert player_schema is not None
    assert player_schema.materialize_write(
        {"version47_pbr": {"segment_settle": None}},
        "",
    )["version47_pbr"]["segment_settle"] is None


def test_version_47_materializes_nested_player_state() -> None:
    runtime = DatabaseSchemaRuntime("4.7")
    player_schema = runtime.get_collection_schema("players")

    assert player_schema is not None
    materialized = player_schema.materialize_write(
        {
            "red_point_records": {"GameNoticeInfos": [{"NoticeId": "notice"}]},
            "team_prefabs": [{"TeamId": 3, "TeamData": [{"k": 1, "v": 1021001}]}],
            "version47_pbr": {"segment_settle": {"shop_data": {"shop_id": 7}}},
        },
        "",
    )

    assert materialized["red_point_records"]["GameNoticeInfos"] == [{
        "NoticeId": "notice", "ModifyTime": 0, "EndTime": 0,
    }]
    assert materialized["team_prefabs"][0]["TeamData"] == [{"k": 1, "v": 1021001}]
    assert materialized["version47_pbr"]["segment_settle"]["shop_data"]["sell_items"] == []
