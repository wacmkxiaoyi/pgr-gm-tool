from backend.app.apis.schemas import ScoreTitleEntryResponse, UnlockScoreTitlesRequest
from backend.app.services.player.score_titles import get_score_title_entires_map


def test_score_title_entries_fall_back_to_initial_quality_and_normalize_medal_image() -> None:
    entry = get_score_title_entires_map()[13000001]

    assert entry == {
        "Name": "Vassago Toy",
        "MaxQuality": 3,
        "WorldDesc": "Nanami made this toy based on the fierce Vassago after Gray Raven defeated it. Kamui always found new ways to play it.",
        "MedalImg": "/assets/image/uicollection/iconcollection004.webp",
    }


def test_score_title_entries_use_highest_defined_quality() -> None:
    entry = get_score_title_entires_map()[13000400]

    assert entry["MaxQuality"] == 5


def test_score_title_api_schemas_accept_catalog_entries_and_ids() -> None:
    entry = ScoreTitleEntryResponse.model_validate({"Name": "Test", "MaxQuality": 5, "WorldDesc": "Description", "MedalImg": None})
    request = UnlockScoreTitlesRequest.model_validate({"title_ids": [1, 2, 2]})

    assert entry.MaxQuality == 5
    assert request.title_ids == [1, 2, 2]
