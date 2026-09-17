from backend.app.services.player.player_characters import get_character_fashions_map


def test_removed_fashions_are_excluded_from_character_catalog() -> None:
    fashions = get_character_fashions_map()[1021003]
    fashion_ids = {fashion["Id"] for fashion in fashions}

    assert 6902301 not in fashion_ids
    assert {6210301, 6210306, 6210307}.issubset(fashion_ids)
