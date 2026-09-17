import pytest

from backend.app.utils.tsv_reader import TSVReader


def test_get_maps_rejects_missing_columns_without_query(tmp_path) -> None:
    path = tmp_path / "table.tsv"
    path.write_text("Id\tName\n1\tExample\n", encoding="utf-8")

    reader = TSVReader(path, typed=True)

    with pytest.raises(ValueError, match="Missing"):
        reader.get_maps("Missing", "Name")


def test_get_sub_table_rejects_missing_columns_without_query(tmp_path) -> None:
    path = tmp_path / "table.tsv"
    path.write_text("Id\tName\n1\tExample\n", encoding="utf-8")

    reader = TSVReader(path, typed=True)

    with pytest.raises(ValueError, match="Missing"):
        reader.get_sub_table("Id", "Missing")
