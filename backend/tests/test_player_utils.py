from backend.app.services.player.utils import normalize_asset_path


def test_normalize_asset_path_uses_webp_output() -> None:
    assert normalize_asset_path(
        "Assets/Product/Texture/Image/RolePlayerSp/RolePlayer01.png",
        "/assets/roleplayersp/",
    ) == "/assets/roleplayersp/roleplayer01.webp"
