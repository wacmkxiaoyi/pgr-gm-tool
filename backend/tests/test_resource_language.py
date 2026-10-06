import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx

from backend.app.utils import resource_language as resources
from backend.app.utils.tsv_reader import TSVReader
from backend.app.services.player.player_items import get_item_name_map
from backend.scripts.tsv_fetcher import get_download_mapping
from backend.app.config import Settings
from backend.app.services import init_app


def test_mapping_preserves_cn_only_en_sources():
    mapping = get_download_mapping()
    assert mapping["EN/Character.tsv"].startswith("en/")
    assert mapping["CN/Character.tsv"].startswith("cn/")
    for table in ("Player.tsv", "HonorLevel.tsv", "Medal.tsv", "leveluptemplate/1.tsv",
                  "TeamRecommendCharacterTarget.tsv", "TeamRecommendBaseCharacter.tsv"):
        assert mapping[f"EN/{table}"] == mapping[f"CN/{table}"]


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
    assert default.json() == en.json()
