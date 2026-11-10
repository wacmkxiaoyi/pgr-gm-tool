import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx
import pytest

from backend.app.utils import resource_language as resources
from backend.app.utils.tsv_reader import TSVReader
from backend.app.services.player.player_items import get_item_name_map
from backend.scripts.tsv_fetcher import get_download_mapping
from backend.app.config import Settings
from backend.app.services import init_app


def test_mapping_uses_native_language_sources():
    mapping = get_download_mapping()
    assert mapping["EN/Character.tsv"].startswith("en/")
    assert mapping["CN/Character.tsv"].startswith("cn/")
    for table in ("Player.tsv", "HonorLevel.tsv", "Medal.tsv", "leveluptemplate/1.tsv",
                  "TeamRecommendCharacterTarget.tsv", "TeamRecommendBaseCharacter.tsv",
                  "Config.tsv", "ExhibitionLimit.tsv"):
        assert mapping[f"EN/{table}"].startswith("en/")
        assert mapping[f"CN/{table}"] == mapping[f"EN/{table}"].replace("en/", "cn/", 1)


@pytest.mark.parametrize('language', ['EN', 'CN'])
def test_refreshed_resources_resolve_previously_supplemented_records(language):
    from backend.app.services.player.resource_validation import get_resource_issues
    from backend.app.services.player import player_characters as characters
    from backend.app.services.player.equips.partner import build_partner_max_save_template
    from backend.app.services.player.equips import get_weapon_fashion_id_entries_map
    from backend.app.services.player.nameplates import get_nameplate_entires_map

    token = resources.resource_language.set(language)
    try:
        assert get_resource_issues() == []
        for character_id in (1411003, 1421003, 1431003):
            assert characters.get_character_quality_bound_map()[character_id] == [3, 6]
            assert len(characters.get_character_grade_name_map()[character_id]) == 14
            assert character_id in characters.get_character_max_template_map()
        for partner_id in (16420000, 16430000, 16440000):
            assert build_partner_max_save_template(partner_id) is not None
        for fashion_id in (12530003, 12630002, 12690001):
            assert get_weapon_fashion_id_entries_map()[fashion_id]['Name']
        assert get_nameplate_entires_map()[17064707]['Name']
    finally:
        resources.resource_language.reset(token)


def test_reader_selects_language_and_explicit_resource_path(tmp_path, monkeypatch):
    monkeypatch.setattr(resources, "BACKEND_DIR", tmp_path)
    for language, name in (("EN", "English"), ("CN", "Chinese")):
        directory = tmp_path / "assets" / language
        directory.mkdir(parents=True)
        (directory / "Item.tsv").write_text(f"Id\tName\n1\t{name}\n", encoding="utf-8")
    get_item_name_map.cache_clear()
    try:
        en = get_item_name_map()
        token = resources.resource_language.set("CN")
        try:
            assert get_item_name_map() == {1: "Chinese"}
            assert TSVReader("assets/EN/Item.tsv").data[0]["Name"] == "English"
        finally:
            resources.resource_language.reset(token)
        assert get_item_name_map() is en
        assert en == {1: "English"}
        get_item_name_map.cache_clear()
        assert get_item_name_map() is not en
    finally:
        get_item_name_map.cache_clear()


def test_middleware_isolates_concurrent_requests_and_sync_workers():
    app = FastAPI()
    app.add_middleware(resources.ResourceLanguageMiddleware)

    @app.get("/async")
    async def asynchronous():
        before = resources.resource_language.get()
        await asyncio.sleep(0.01)
        return [before, resources.resource_language.get()]

    @app.get("/sync")
    def synchronous():
        return resources.resource_language.get()

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
            responses = await asyncio.gather(*[
                client.get("/async", headers={"Accept-Language": locale})
                for locale in ("zh-CN", "en-US") * 5
            ])
            assert [response.json() for response in responses] == [["CN", "CN"], ["EN", "EN"]] * 5

    asyncio.run(run())
    client = TestClient(app)
    assert client.get("/sync", headers={"Accept-Language": "zh-CN"}).json() == "CN"
    assert client.get("/sync").json() == "EN"
    assert resources.resource_language.get() == "EN"


def test_app_info_switches_real_tables_without_polluting_default_cache():
    app = FastAPI()
    init_app(app, Settings({"ENABLE_SERVER_MANAGEMENT": "false"}))
    client = TestClient(app)
    en = client.get("/api/app-info", headers={"Accept-Language": "en-US"})
    cn = client.get("/api/app-info", headers={"Accept-Language": "zh-CN"})
    default = client.get("/api/app-info")
    assert en.status_code == cn.status_code == default.status_code == 200
    assert en.json()["item_name_map"] != cn.json()["item_name_map"]
    assert en.json()["character_log_name_map"] != cn.json()["character_log_name_map"]
    for field in (
        "furniture_entries_map",
        "dorm_template_entries_map",
        "furniture_type_entires_map",
        "furniture_suit_name_map",
        "furniture_additional_attr_entries_map",
    ):
        assert en.json()[field]
        assert cn.json()[field]
        assert en.json()[field] != cn.json()[field]
    assert cn.json()["furniture_entries_map"]["8301004"]["Desc"] == "非常普通的制式天花板，看久了让人昏昏欲睡。"
    assert "furniture_create_max_attr_map" not in cn.json()
    assert cn.json()["furniture_type_entires_map"]["25001"] == {"CategoryName": "地板", "MajorType": 1}
    assert en.json()["furniture_type_entires_map"]["25001"]["MajorType"] == 1
    assert cn.json()["dorm_template_entries_map"]["20"] == {
        "Name": "空宿舍", "FurnitureId": [8101004, 8301004, 8201004],
    }
    assert en.json()["dorm_template_entries_map"]["20"]["Name"] == "Empty Dormitory"
    assert cn.json()["dorm_template_entries_map"]["201"]["FurnitureId"].count(8612002) == 6
    assert default.json() == en.json()
