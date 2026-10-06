import csv
import json
import sys

import pytest

from backend.scripts import tsv_fetcher


def test_refresh_replaces_both_datasets_and_removes_legacy_table(tmp_path, monkeypatch) -> None:
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    target = assets_dir / "Table.tsv"
    target.write_text("previous content\n", encoding="utf-8")

    def prepare_asset(target_path, source_path, temporary_dir, upstream_dir):
        output = temporary_dir / target_path
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("updated content\n", encoding="utf-8")
        return target_path, source_path, 1

    monkeypatch.setattr(tsv_fetcher, "ASSETS_DIR", assets_dir)
    monkeypatch.setattr(tsv_fetcher, "ASSET_MAP", {"Table.tsv": "en/bytes/share/Table.json"})
    monkeypatch.setattr(tsv_fetcher, "validate_mapping", lambda: None)
    monkeypatch.setattr(tsv_fetcher, "prepare_asset", prepare_asset)

    tsv_fetcher.refresh_assets(workers=1)

    assert not target.exists()
    for language in ("EN", "CN"):
        assert (assets_dir / language / "Table.tsv").read_text(encoding="utf-8") == "updated content\n"


def test_dry_run_does_not_replace_assets(tmp_path, monkeypatch) -> None:
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    target = assets_dir / "Table.tsv"
    target.write_text("previous content\n", encoding="utf-8")
    monkeypatch.setattr(tsv_fetcher, "ASSETS_DIR", assets_dir)

    def prepare_asset(target_path, source_path, temporary_dir, upstream_dir):
        (temporary_dir / target_path).parent.mkdir(parents=True, exist_ok=True)
        (temporary_dir / target_path).write_text("prepared\n", encoding="utf-8")
        return target_path, source_path, 1

    monkeypatch.setattr(tsv_fetcher, "ASSET_MAP", {"Table.tsv": "en/bytes/share/Table.json"})
    monkeypatch.setattr(tsv_fetcher, "validate_mapping", lambda: None)
    monkeypatch.setattr(tsv_fetcher, "prepare_asset", prepare_asset)

    tsv_fetcher.refresh_assets(dry_run=True, workers=1)

    assert target.read_text(encoding="utf-8") == "previous content\n"
    assert not (assets_dir / "EN").exists()


def test_main_rejects_removed_recommend_equips_option(monkeypatch) -> None:
    monkeypatch.setattr(sys, "argv", ["tsv_fetcher.py", "--recommend-equips", "true"])
    with pytest.raises(SystemExit) as error:
        tsv_fetcher.main()
    assert error.value.code == 2


def test_main_requires_from_json_and_to_tsv_together(monkeypatch) -> None:
    monkeypatch.setattr(sys, "argv", ["tsv_fetcher.py", "--from-json", "Emoji.json"])

    with pytest.raises(SystemExit) as error:
        tsv_fetcher.main()

    assert error.value.code == 2


def test_main_converts_local_json_to_tsv(tmp_path, monkeypatch) -> None:
    source = tmp_path / "Emoji.json"
    source.write_text(
        json.dumps([{"Id": 1, "Values": ["first", 2], "Enabled": True, "None": None}]),
        encoding="utf-8",
    )
    assets_dir = tmp_path / "assets"
    monkeypatch.setattr(tsv_fetcher, "ASSETS_DIR", assets_dir)
    monkeypatch.setattr(
        sys,
        "argv",
        ["tsv_fetcher.py", "--from-json", str(source), "--to-tsv", "CN/nested/Emoji.tsv"],
    )

    assert tsv_fetcher.main() == 0

    with (assets_dir / "CN/nested/Emoji.tsv").open("r", encoding="utf-8-sig", newline="") as file:
        assert list(csv.DictReader(file, delimiter="\t")) == [
            {"Id": "1", "Values": '["first",2]', "Enabled": "true", "None": ""}
        ]


def test_main_local_json_dry_run_does_not_replace_tsv(tmp_path, monkeypatch) -> None:
    source = tmp_path / "Emoji.json"
    source.write_text(json.dumps([{"Id": 1}]), encoding="utf-8")
    assets_dir = tmp_path / "assets"
    target = assets_dir / "EN/Emoji.tsv"
    target.parent.mkdir(parents=True)
    target.write_text("previous content\n", encoding="utf-8")
    monkeypatch.setattr(tsv_fetcher, "ASSETS_DIR", assets_dir)
    monkeypatch.setattr(
        sys,
        "argv",
        ["tsv_fetcher.py", "--dry-run", "--from-json", str(source), "--to-tsv", "EN/Emoji.tsv"],
    )

    assert tsv_fetcher.main() == 0

    assert target.read_text(encoding="utf-8") == "previous content\n"
