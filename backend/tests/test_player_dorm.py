from backend.app.services.player import player_dorm
from backend.app.utils.resource_language import resource_language


def test_dorm_template_counts_include_repeats_across_all_rows(tmp_path, monkeypatch):
    table = tmp_path / "DormTemplate.tsv"
    table.write_text(
        "Id\tFurnitureId\tIsShow\n"
        "20\t[10,20,30]\t\n"
        "201\t[10,40,40,40]\ttrue\n"
        "202\t[40,40,50]\tfalse\n"
        "203\t[]\ttrue\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(player_dorm, "DORM_TEMPLATE_TSV_PATH", table)
    helpers = (player_dorm.get_base_furniture_list, player_dorm.get_furniture_template_count_map)
    for helper in helpers:
        helper.cache_clear()
    try:
        assert player_dorm.get_base_furniture_list() == [10, 20, 30]
        assert player_dorm.get_furniture_template_count_map() == {10: 2, 20: 1, 30: 1, 40: 5, 50: 1}
        for helper in helpers:
            assert helper() is helper()
    finally:
        for helper in helpers:
            helper.cache_clear()


def test_real_dorm_template_caches_are_language_isolated():
    helpers = (player_dorm.get_base_furniture_list, player_dorm.get_furniture_template_count_map)
    token = resource_language.set("EN")
    try:
        en_base, en_counts = [helper() for helper in helpers]
        cn_token = resource_language.set("CN")
        try:
            cn_base, cn_counts = [helper() for helper in helpers]
            assert cn_base == en_base == [8101004, 8301004, 8201004]
            assert cn_base is not en_base
            assert cn_counts == en_counts
            assert cn_counts is not en_counts
            assert cn_counts[8612002] == 6
            assert cn_counts[8101004] == 1
            assert cn_counts[8612017] == 2
            assert player_dorm.get_base_furniture_list() is cn_base
            assert player_dorm.get_furniture_template_count_map() is cn_counts
        finally:
            resource_language.reset(cn_token)
        assert player_dorm.get_base_furniture_list() is en_base
        assert player_dorm.get_furniture_template_count_map() is en_counts
    finally:
        resource_language.reset(token)


def test_furniture_create_max_attr_filters_consumption_and_combines_duplicate_types(tmp_path, monkeypatch):
    table = tmp_path / "FurnitureCreateAttr.tsv"
    table.write_text(
        "FurnitureType\tMinConsume\tAttrTotal\n"
        "25001\t9\t[999]\n"
        "25001\t10\t[200,100,150]\n"
        "25001\t10\t[120,180]\n"
        "25002\t10\t[40,80,60]\n"
        "25003\t10\t[]\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(player_dorm, "FURNITURE_CREATE_ATTR_TSV_PATH", table)
    player_dorm.get_furniture_create_max_attr_map.cache_clear()
    try:
        assert player_dorm.get_furniture_create_max_attr_map() == {25001: 200, 25002: 80}
    finally:
        player_dorm.get_furniture_create_max_attr_map.cache_clear()


def test_furniture_maps_read_cn_fields_and_keep_language_caches_separate():
    en = player_dorm.get_furniture_entries_map()
    token = resource_language.set("CN")
    try:
        cn = player_dorm.get_furniture_entries_map()
        assert cn[8301004] == {
            "Name": "浅色天花板",
            "Desc": "非常普通的制式天花板，看久了让人昏昏欲睡。",
            "TypeId": 25003,
            "SuitId": 4,
        }
        assert cn is player_dorm.get_furniture_entries_map()
        assert cn != en
        assert player_dorm.get_furniture_type_entires_map()[25001] == {"CategoryName": "地板", "MajorType": 1}
        assert player_dorm.get_furniture_type_entires_map()[25008] == {"CategoryName": "椅子", "MajorType": 2}
        assert player_dorm.get_furniture_suit_name_map()[4] == "基础套装"
        assert player_dorm.get_furniture_additional_attr_entries_map()[101] == {
            "AddScore": 30,
            "Introduce": "美观值增加15点，舒适值增加15点",
        }
        cn_templates = player_dorm.get_dorm_template_entries_map()
        assert cn_templates[20] == {"Name": "空宿舍", "FurnitureId": [8101004, 8301004, 8201004]}
        assert cn_templates[201]["FurnitureId"].count(8612002) == 6
        assert player_dorm.get_dorm_template_entries_map() is cn_templates
    finally:
        resource_language.reset(token)
    assert player_dorm.get_furniture_entries_map() is en
    assert player_dorm.get_dorm_template_entries_map()[20]["Name"] == "Empty Dormitory"
