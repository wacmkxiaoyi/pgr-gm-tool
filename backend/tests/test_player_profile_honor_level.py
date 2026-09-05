from backend.app.services.player.player_profile import get_player_honor_level_max, get_player_honor_level_max_exp_map


def test_honor_level_max_exp_map_is_populated_and_sorted() -> None:
    honor_level_max_exp_map = get_player_honor_level_max_exp_map()

    assert honor_level_max_exp_map
    assert list(honor_level_max_exp_map) == sorted(honor_level_max_exp_map)
    assert all(level >= 0 and max_exp >= 0 for level, max_exp in honor_level_max_exp_map.items())
    assert get_player_honor_level_max() == max(honor_level_max_exp_map)
