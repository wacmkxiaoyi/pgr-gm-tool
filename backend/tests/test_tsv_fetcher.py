from backend.scripts import tsv_fetcher


def test_generate_recommend_equips_runs_generator(monkeypatch) -> None:
    calls = []

    def run(command, check):
        calls.append((command, check))

    monkeypatch.setattr(tsv_fetcher.subprocess, "run", run)

    tsv_fetcher.generate_recommend_equips()

    assert calls == [([tsv_fetcher.sys.executable, str(tsv_fetcher.RECOMMEND_EQUIPS_SCRIPT)], True)]


def test_refresh_generates_recommend_equips_after_replacing_assets(tmp_path, monkeypatch) -> None:
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    target = assets_dir / "Table.tsv"
    target.write_text("previous content\n", encoding="utf-8")
    generated = []

    def prepare_asset(target_path, source_path, temporary_dir, upstream_dir):
        output = temporary_dir / target_path
        output.write_text("updated content\n", encoding="utf-8")
        return target_path, source_path, 1

    monkeypatch.setattr(tsv_fetcher, "ASSETS_DIR", assets_dir)
    monkeypatch.setattr(tsv_fetcher, "ASSET_MAP", {"Table.tsv": "en/bytes/share/Table.json"})
    monkeypatch.setattr(tsv_fetcher, "validate_mapping", lambda: None)
    monkeypatch.setattr(tsv_fetcher, "prepare_asset", prepare_asset)
    monkeypatch.setattr(tsv_fetcher, "generate_recommend_equips", lambda: generated.append(True))

    tsv_fetcher.refresh_assets(workers=1)

    assert target.read_text(encoding="utf-8") == "updated content\n"
    assert generated == [True]


def test_dry_run_does_not_generate_recommend_equips(tmp_path, monkeypatch) -> None:
    generated = []

    def prepare_asset(target_path, source_path, temporary_dir, upstream_dir):
        (temporary_dir / target_path).write_text("prepared\n", encoding="utf-8")
        return target_path, source_path, 1

    monkeypatch.setattr(tsv_fetcher, "ASSET_MAP", {"Table.tsv": "en/bytes/share/Table.json"})
    monkeypatch.setattr(tsv_fetcher, "validate_mapping", lambda: None)
    monkeypatch.setattr(tsv_fetcher, "prepare_asset", prepare_asset)
    monkeypatch.setattr(tsv_fetcher, "generate_recommend_equips", lambda: generated.append(True))

    tsv_fetcher.refresh_assets(dry_run=True, workers=1)

    assert generated == []
