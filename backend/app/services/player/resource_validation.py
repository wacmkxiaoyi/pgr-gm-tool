"""Cross-table diagnostics using the same TSVReader as runtime resource loading."""

from backend.app.utils.resource_language import language_cache as lru_cache

from backend.app.services.player import player_characters as characters
from backend.app.services.player.equips import get_equip_site_map
from backend.app.services.player.levelup_template import get_level_exp_map
from backend.app.services.player.utils import extract_int_list, parse_int
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=1)
def get_resource_issues() -> list[dict[str, object]]:
    issues: list[dict[str, object]] = []

    def missing(table: str, resource_id: int, dependency: str, reference: object) -> None:
        issues.append({"table": table, "id": resource_id, "dependency": dependency, "reference": reference})

    qualities = characters.get_character_quality_bound_map()
    grades = characters.get_character_grade_name_map()
    add_configs = characters.get_character_add_config_map()
    templates = characters.get_character_levelup_template_map()
    for character_id in characters.get_character_log_name_map():
        if character_id not in qualities:
            missing("Character", character_id, "CharacterQuality", character_id)
        if not grades.get(character_id):
            missing("Character", character_id, "CharacterGrade", character_id)
        if character_id not in add_configs:
            missing("Character", character_id, "add_defaults", character_id)
        template_id = templates.get(character_id)
        try:
            levels = get_level_exp_map(template_id) if template_id is not None else {}
        except FileNotFoundError:
            levels = {}
        if not levels:
            missing("Character", character_id, "leveluptemplate", template_id)

    for source, group_source in (
        ("CharacterSkill", "CharacterSkillGroup"), ("EnhanceSkill", "EnhanceSkillGroup"),
    ):
        groups = {parse_int(row.get("Id")): row for row in TSVReader(f"assets/{group_source}.tsv", typed=True).data}
        entries = characters.get_character_skill_entries_map() if source == "CharacterSkill" else characters.get_character_enhance_skill_entries_map()
        for row in TSVReader(f"assets/{source}.tsv", typed=True).data:
            character_id = parse_int(row.get("CharacterId"))
            if character_id is None:
                continue
            for group_id in extract_int_list(row, ["SkillGroupId"], dedupe=True):
                if group_id not in groups:
                    missing(source, character_id, group_source, group_id)
                    continue
                for skill_id in extract_int_list(groups[group_id], ["SkillId"], dedupe=True):
                    if skill_id not in entries:
                        missing(group_source, group_id, f"{source}LevelEffect", skill_id)

    shared = {parse_int(row.get("Id")) for row in TSVReader("assets/WeaponFashion.tsv", typed=True).data}
    display = {parse_int(row.get("Id")) for row in TSVReader("assets/WeaponFashionRes.tsv", typed=True).data}
    for fashion_id in sorted((shared ^ display) - {None}):
        missing("WeaponFashion" if fashion_id in shared else "WeaponFashionRes", fashion_id,
                "WeaponFashionRes" if fashion_id in shared else "WeaponFashion", fashion_id)

    sites = get_equip_site_map()
    partners = {parse_int(row.get("Id")) for row in TSVReader("assets/Partner.tsv", typed=True).data}
    for row in TSVReader("assets/CharacterRecommendEquips.tsv", typed=True).data:
        character_id = parse_int(row.get("Id"))
        if character_id is None:
            continue
        weapon = parse_int(row.get("WeaponId"))
        if weapon not in sites or parse_int(sites.get(weapon)) not in (None, 0):
            missing("CharacterRecommendEquips", character_id, "Equip.Weapon", weapon)
        for memory_id in extract_int_list(row, ["Memories"]):
            if memory_id not in sites or parse_int(sites.get(memory_id)) not in range(1, 7):
                missing("CharacterRecommendEquips", character_id, "Equip.Memory", memory_id)
        cub = parse_int(row.get("CUB"))
        if cub is not None and cub > 0 and cub not in partners:
            missing("CharacterRecommendEquips", character_id, "Partner", cub)
    max_templates = characters.get_character_max_template_map()
    for character_id in characters.get_character_log_name_map():
        if character_id not in max_templates:
            missing("Character", character_id, "max_template", character_id)
    return issues


if __name__ == "__main__":
    import json

    print(json.dumps(get_resource_issues(), ensure_ascii=False, indent=2))
