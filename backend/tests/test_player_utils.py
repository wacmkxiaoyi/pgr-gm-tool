from backend.app.services.player.utils import normalize_asset_path


def test_normalize_asset_path_preserves_atlas_directory_structure() -> None:
    assert normalize_asset_path(
        "Assets/Product/Texture/Atlas/UiNameplate/UiNameplateGold.png",
    ) == "/assets/atlas/uinameplate/uinameplategold.webp"


def test_normalize_asset_path_preserves_image_directory_structure() -> None:
    assert normalize_asset_path(
        "Assets/Product/Texture/Image/UiMedal/UiMedalIconSp7.png",
    ) == "/assets/image/uimedal/uimedaliconsp7.webp"


def test_normalize_asset_path_rejects_non_texture_paths() -> None:
    assert normalize_asset_path("Assets/Product/Audio/Bgm/Main.mp3") is None
