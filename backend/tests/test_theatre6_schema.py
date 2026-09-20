from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime


def test_fixed_schema_materializes_theatre6_login_state() -> None:
    runtime = DatabaseSchemaRuntime()
    players = runtime.get_collection_schema("players")

    assert players is not None
    theatre6 = players.materialize_write({}, "theatre6")

    assert theatre6["activity_id"] == 0
    assert theatre6["current_mode"] == 0
    assert theatre6["next_run_id"] == 1
    assert theatre6["next_attempt_id"] == 1
    assert theatre6["receipt_high_water"] == -1
    assert theatre6["active_runs"] == []
    assert theatre6["pvp"] == {
        "authorized_season_id": 0,
        "initialized_season_id": 0,
        "authorized_time_ids": [],
        "rank_id": 0,
        "score": 0,
        "player_state": 0,
        "action_point": 0,
        "action_point_time": 0,
        "defense_files": [],
        "defense_buff_id": 0,
        "defense_update_time": 0,
        "matches": [],
        "next_match_uid": 1,
        "last_refresh_time": 0,
        "refresh_period_start": 0,
        "refresh_period_count": 0,
        "battle": None,
        "next_battle_id": 1,
        "pending_rank_reward_ids": [],
        "defense_version": 0,
        "pending_defense_outs": [],
        "applied_defense_watermarks": [],
        "current_rank_min_score": 0,
        "rewarded_ranks": [],
        "rank_records": [],
        "battle_records": [],
        "stats": {},
    }


def test_fixed_schema_preserves_theatre6_run_and_transaction_payloads() -> None:
    runtime = DatabaseSchemaRuntime()
    players = runtime.get_collection_schema("players")

    assert players is not None
    value = players.materialize_write(
        {
            "theatre6": {
                "active_runs": [{"k": 1, "v": {"native_attempt": {"entry_response": b"data"}}}],
                "pending_mutation": {"response": b"cached", "outcome": {"future_field": True}},
                "pvp": {"battle": {"entry_response": b"battle"}},
            }
        },
        "",
    )

    theatre6 = value["theatre6"]
    assert theatre6["active_runs"] == [{"k": 1, "v": {"native_attempt": {"entry_response": b"data"}}}]
    assert theatre6["pending_mutation"] == {"response": b"cached", "outcome": {"future_field": True}}
    assert theatre6["pvp"]["battle"] == {"entry_response": b"battle"}
