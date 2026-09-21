from backend.app.apis.schemas import ChatEmojiEntryResponse, UnlockChatEmojisRequest
from backend.app.services.player.chat_emojis import get_emoji_entires_map


def test_chat_emoji_entries_use_connotation_description_and_normalize_icon() -> None:
    entries = get_emoji_entires_map()
    entry = entries[11000001]

    assert entry == {
        "Name": "Cheerful",
        "BigIcon": "/assets/image/iconexpression/iconexpressa1.webp",
        "WorldDesc": "One of the default stamps",
    }


def test_chat_emoji_api_schemas_accept_catalog_entries_and_ids() -> None:
    entry = ChatEmojiEntryResponse.model_validate({"Name": "Test", "BigIcon": None, "WorldDesc": "Description"})
    request = UnlockChatEmojisRequest.model_validate({"emoji_ids": [1, 2, 2]})

    assert entry.Name == "Test"
    assert request.emoji_ids == [1, 2, 2]
