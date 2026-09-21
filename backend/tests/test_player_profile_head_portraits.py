from backend.app.services.player.player_profile import (
    HeadPortraitValidity,
    get_player_portrait_frame_validity_map,
    get_player_portrait_validity_map,
    is_player_head_resource_active,
)


def test_portrait_and_frame_validity_maps_are_separate() -> None:
    portrait_map = get_player_portrait_validity_map()
    frame_map = get_player_portrait_frame_validity_map()

    assert portrait_map
    assert frame_map
    assert all(isinstance(entry, HeadPortraitValidity) for entry in portrait_map.values())
    assert all(isinstance(entry, HeadPortraitValidity) for entry in frame_map.values())


def test_head_resource_validity_honors_limit_type_and_expiry() -> None:
    owned = {"LeftCount": 2, "BeginTime": 100}

    assert is_player_head_resource_active(HeadPortraitValidity(duration=0, limit_type=0), owned, 999999)
    assert is_player_head_resource_active(HeadPortraitValidity(duration=10, limit_type=1), owned, 120)
    assert not is_player_head_resource_active(HeadPortraitValidity(duration=10, limit_type=1), owned, 121)
    assert not is_player_head_resource_active(HeadPortraitValidity(duration=10, limit_type=2), owned, 100)
