import csv
import json
from pathlib import Path

from backend.scripts import tsv_fetcher


def test_asset_map_covers_current_assets() -> None:
    assets = {
        path.relative_to(tsv_fetcher.ASSETS_DIR).as_posix()
        for path in tsv_fetcher.ASSETS_DIR.rglob("*.tsv")
    }

    assert set(tsv_fetcher.get_download_mapping()) == assets
    tsv_fetcher.validate_mapping()


def test_prepare_asset_reads_local_json_and_preserves_nested_values(tmp_path: Path) -> None:
    upstream_dir = tmp_path / "bytes"
    source_file = upstream_dir / "en/bytes/share/example/Table.json"
    source_file.parent.mkdir(parents=True)
    source_file.write_text(
        json.dumps([{"Id": 1, "Values": ["first", 2], "Settings": {"enabled": True}, "None": None}]),
        encoding="utf-8",
    )

    output_dir = tmp_path / "output"
    target, source, rows = tsv_fetcher.prepare_asset(
        "example.tsv", "en/bytes/share/example/Table.json", output_dir, upstream_dir
    )

    with (output_dir / target).open("r", encoding="utf-8-sig", newline="") as file:
        written_rows = list(csv.DictReader(file, delimiter="\t"))

    assert (target, source, rows) == ("example.tsv", "en/bytes/share/example/Table.json", 1)
    assert written_rows == [
        {"Id": "1", "Values": '["first",2]', "Settings": '{"enabled":true}', "None": ""}
    ]


def test_refresh_does_not_replace_assets_when_preparation_fails(tmp_path: Path, monkeypatch) -> None:
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    target = assets_dir / "Table.tsv"
    target.write_text("previous content\n", encoding="utf-8")
    for language in ("EN", "CN"):
        (assets_dir / language).mkdir()
        (assets_dir / language / "Table.tsv").write_text(f"previous {language}\n", encoding="utf-8")
    # EN prepares successfully, but a missing CN source must prevent replacement.
    source = tmp_path / "bytes/en/bytes/share/missing/Table.json"
    source.parent.mkdir(parents=True)
    source.write_text('[{"Id": 1}]', encoding="utf-8")
    monkeypatch.setattr(tsv_fetcher, "ASSETS_DIR", assets_dir)
    monkeypatch.setattr(tsv_fetcher, "ASSET_MAP", {"Table.tsv": "en/bytes/share/missing/Table.json"})

    try:
        tsv_fetcher.refresh_assets(upstream_dir=tmp_path / "bytes", workers=2)
    except RuntimeError as error:
        assert "Table.tsv" in str(error)
    else:
        raise AssertionError("refresh_assets should fail when the source file is absent")

    assert target.read_text(encoding="utf-8") == "previous content\n"
    for language in ("EN", "CN"):
        assert (assets_dir / language / "Table.tsv").read_text(encoding="utf-8") == f"previous {language}\n"
