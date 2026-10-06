"""Language-local CUB configuration; no player records are modified here."""

from __future__ import annotations

from backend.app.services.player.equips.constants import (
    PARTNER_BREAK_THROUGH_TSV_PATH,
    PARTNER_MAIN_SKILL_GROUP_TSV_PATH,
    PARTNER_PASSIVE_SKILL_GROUP_TSV_PATH,
    PARTNER_QUALITY_TSV_PATH,
    PARTNER_SKILL_INFO_TSV_PATH,
    PARTNER_SKILL_TSV_PATH,
    PARTNER_TSV_PATH,
)
from backend.app.services.player.levelup_template import get_level_exp_map
from backend.app.services.player.utils import extract_int_list, normalize_asset_path, parse_int
from backend.app.utils.resource_language import language_cache as lru_cache
from backend.app.utils.tsv_reader import TSVReader
from backend.app.db.models.player_equips import PartnerItemRecord


def build_partner_item_record(row: dict) -> PartnerItemRecord | None:
    record_id = parse_int(row.get("_id"))
    template_id = parse_int(row.get("TemplateId"))
    if record_id is None or template_id is None:
        return None
    quality = parse_int(row.get("Quality")) or 0
    schedule = parse_int(row.get("StarSchedule")) or 0
    thresholds = get_partner_star_schedule_options_map().get(template_id, {}).get(quality, [])
    breakthrough = parse_int(row.get("BreakThrough")) or 0
    level = parse_int(row.get("Level")) or 0
    return PartnerItemRecord(
        record_id=record_id, TemplateId=template_id,
        CharacterId=parse_int(row.get("CharacterId")) or 0, Quality=quality,
        Star=max((i for i, threshold in enumerate(thresholds) if schedule >= threshold), default=0) if quality < 6 else 0,
        Level=level, Exp=parse_int(row.get("Exp")) or 0, BreakThrough=breakthrough,
        EnhancementLevel=max(0, level) + sum(limit for stage, limit in get_partner_breakthrough_level_limit_map().get(template_id, {}).items() if stage < breakthrough),
    )


@lru_cache(maxsize=1)
def get_partner_entries_map() -> dict[int, dict[str, int | str | list[int]]]:
    table = TSVReader(PARTNER_TSV_PATH, typed=True).get_sub_table(
        "Id", ["Name", "Desc", "Icon", "InitQuality", "RecommendElement"],
    )
    result: dict[int, dict[str, int | str | list[int]]] = {}
    for raw_id, row in table.items():
        partner_id = parse_int(raw_id)
        quality = parse_int(row.get("InitQuality"))
        if partner_id is None or quality is None:
            continue
        result[partner_id] = {
            "Name": str(row.get("Name") or "").strip(),
            "Desc": str(row.get("Desc") or "").strip(),
            "Icon": normalize_asset_path(row.get("Icon")) or "",
            "InitQuality": quality,
            "RecommendElement": extract_int_list(row, ["RecommendElement"], dedupe=True),
        }
    return result


@lru_cache(maxsize=1)
def get_partner_name_map() -> dict[int, str]:
    return {partner_id: str(row["Name"]) for partner_id, row in get_partner_entries_map().items()}


@lru_cache(maxsize=1)
def get_partner_descriptions_map() -> dict[int, str]:
    return {partner_id: str(row["Desc"]) for partner_id, row in get_partner_entries_map().items()}


@lru_cache(maxsize=1)
def get_partner_icon_url_map() -> dict[int, str]:
    return {partner_id: str(row["Icon"]) for partner_id, row in get_partner_entries_map().items()}


@lru_cache(maxsize=1)
def get_partner_breakthrough_entries_map() -> dict[int, dict[int, dict[str, int]]]:
    rows = TSVReader(PARTNER_BREAK_THROUGH_TSV_PATH, typed=True).select(
        ["PartnerId", "BreakTimes", "LevelLimit", "LevelUpTemplateId"],
    )
    result: dict[int, dict[int, dict[str, int]]] = {}
    for row in rows:
        partner_id = parse_int(row.get("PartnerId"))
        raw_times = row.get("BreakTimes")
        times = 0 if raw_times in (None, "") else parse_int(raw_times)
        limit = parse_int(row.get("LevelLimit"))
        template_id = parse_int(row.get("LevelUpTemplateId"))
        if any(value is None for value in (partner_id, times, limit, template_id)):
            continue
        result.setdefault(partner_id, {})[times] = {
            "LevelLimit": limit,
            "LevelUpTemplateId": template_id,
        }
    return result


@lru_cache(maxsize=1)
def get_partner_breakthrough_level_limit_map() -> dict[int, dict[int, int]]:
    return {
        partner_id: {times: row["LevelLimit"] for times, row in stages.items()}
        for partner_id, stages in get_partner_breakthrough_entries_map().items()
    }


@lru_cache(maxsize=1)
def get_partner_breakthrough_levelup_template_map() -> dict[int, dict[int, int]]:
    return {
        partner_id: {times: row["LevelUpTemplateId"] for times, row in stages.items()}
        for partner_id, stages in get_partner_breakthrough_entries_map().items()
    }


@lru_cache(maxsize=1)
def get_partner_breakthrough_max_map() -> dict[int, dict[str, int]]:
    return {
        partner_id: {"max_breakthrough": max(stages), "max_level_limit": stages[max(stages)]}
        for partner_id, stages in get_partner_breakthrough_level_limit_map().items()
        if stages
    }


@lru_cache(maxsize=1)
def get_partner_level_exp_map() -> dict[int, dict[int, dict[int, int]]]:
    """Partner -> breakthrough -> level -> per-level Exp (not cumulative AllExp)."""
    templates: dict[int, dict[int, int]] = {}
    result: dict[int, dict[int, dict[int, int]]] = {}
    for partner_id, stages in get_partner_breakthrough_entries_map().items():
        result[partner_id] = {}
        for times, row in stages.items():
            template_id = row["LevelUpTemplateId"]
            if template_id not in templates:
                templates[template_id] = get_level_exp_map(template_id)
            # Templates extend past the CUB stage cap; LevelLimit is authoritative.
            result[partner_id][times] = {
                level: exp for level, exp in templates[template_id].items()
                if 1 <= level <= row["LevelLimit"]
            }
    return result


@lru_cache(maxsize=1)
def get_partner_breakthrough_max_level_exp_map() -> dict[int, dict[int, dict[str, int]]]:
    limits = get_partner_breakthrough_level_limit_map()
    return {
        partner_id: {
            times: {"Level": limits[partner_id][times], "Exp": levels[limits[partner_id][times]]}
            for times, levels in stages.items()
            if limits[partner_id][times] in levels
        }
        for partner_id, stages in get_partner_level_exp_map().items()
    }


@lru_cache(maxsize=1)
def get_partner_skill_config_map() -> dict[int, dict[str, int | list[int]]]:
    columns = ["DefaultMainSkillGroupId", "MainSkillGroupId", "PassiveSkillGroupId"]
    table = TSVReader(PARTNER_SKILL_TSV_PATH, typed=True).get_sub_table("PartnerId", columns)
    result: dict[int, dict[str, int | list[int]]] = {}
    for raw_id, row in table.items():
        partner_id = parse_int(raw_id)
        default_group = parse_int(row.get("DefaultMainSkillGroupId"))
        if partner_id is None or default_group is None:
            continue
        result[partner_id] = {
            "DefaultMainSkillGroupId": default_group,
            "MainSkillGroupId": extract_int_list(row, ["MainSkillGroupId"], dedupe=True),
            "PassiveSkillGroupId": extract_int_list(row, ["PassiveSkillGroupId"], dedupe=True),
        }
    return result


@lru_cache(maxsize=1)
def get_partner_main_skill_group_entries_map() -> dict[int, dict[str, list[int]]]:
    table = TSVReader(PARTNER_MAIN_SKILL_GROUP_TSV_PATH, typed=True).get_sub_table(
        "Id", ["SkillId", "Element"],
    )
    return {
        group_id: {
            "SkillId": extract_int_list(row, ["SkillId"]),
            "Element": extract_int_list(row, ["Element"]),
        }
        for raw_id, row in table.items()
        for group_id in [parse_int(raw_id)] if group_id is not None
    }


@lru_cache(maxsize=1)
def get_partner_main_skill_group_skill_ids_map() -> dict[int, list[int]]:
    return {group_id: row["SkillId"] for group_id, row in get_partner_main_skill_group_entries_map().items()}


@lru_cache(maxsize=1)
def get_partner_main_skill_group_element_skill_ids_map() -> dict[int, dict[int, int]]:
    """Main group -> element -> concrete skill ID, retaining authored positions."""
    return {
        group_id: dict(zip(row["Element"], row["SkillId"]))
        for group_id, row in get_partner_main_skill_group_entries_map().items()
    }


@lru_cache(maxsize=1)
def get_partner_passive_skill_group_skill_ids_map() -> dict[int, list[int]]:
    table = TSVReader(PARTNER_PASSIVE_SKILL_GROUP_TSV_PATH, typed=True).get_sub_table("Id", "SkillId")
    return {
        group_id: extract_int_list(row, ["SkillId"], dedupe=True)
        for raw_id, row in table.items()
        for group_id in [parse_int(raw_id)] if group_id is not None
    }


def _build_partner_skill_groups_map(field: str, groups: dict[int, list[int]]) -> dict[int, list[list[int]]]:
    return {
        partner_id: [groups.get(group_id, []) for group_id in row[field]]
        for partner_id, row in get_partner_skill_config_map().items()
    }


@lru_cache(maxsize=1)
def get_partner_main_skill_groups_map() -> dict[int, list[list[int]]]:
    return _build_partner_skill_groups_map("MainSkillGroupId", get_partner_main_skill_group_skill_ids_map())


@lru_cache(maxsize=1)
def get_partner_passive_skill_groups_map() -> dict[int, list[list[int]]]:
    return _build_partner_skill_groups_map("PassiveSkillGroupId", get_partner_passive_skill_group_skill_ids_map())


def _flatten_skill_groups(groups: dict[int, list[list[int]]]) -> dict[int, list[int]]:
    return {
        partner_id: list(dict.fromkeys(skill_id for group in skill_groups for skill_id in group))
        for partner_id, skill_groups in groups.items()
    }


@lru_cache(maxsize=1)
def get_partner_main_skill_ids_map() -> dict[int, list[int]]:
    return _flatten_skill_groups(get_partner_main_skill_groups_map())


@lru_cache(maxsize=1)
def get_partner_passive_skill_ids_map() -> dict[int, list[int]]:
    return _flatten_skill_groups(get_partner_passive_skill_groups_map())


@lru_cache(maxsize=1)
def get_partner_skill_level_entries_map() -> dict[int, dict[int, dict[str, str]]]:
    rows = TSVReader(PARTNER_SKILL_INFO_TSV_PATH, typed=True).select(
        ["SkillId", "Level", "Name", "Desc", "Icon"],
    )
    result: dict[int, dict[int, dict[str, str]]] = {}
    for row in rows:
        skill_id = parse_int(row.get("SkillId"))
        level = parse_int(row.get("Level"))
        if skill_id is None or level is None:
            continue
        result.setdefault(skill_id, {})[level] = {
            "Name": str(row.get("Name") or "").strip(),
            "Desc": str(row.get("Desc") or "").strip(),
            "Icon": normalize_asset_path(row.get("Icon")) or "",
        }
    return result


@lru_cache(maxsize=1)
def get_partner_skill_max_level_map() -> dict[int, int]:
    return {skill_id: max(levels) for skill_id, levels in get_partner_skill_level_entries_map().items() if levels}


@lru_cache(maxsize=1)
def get_partner_skill_entries_map() -> dict[int, dict[str, int | str]]:
    """Skill summary with first-level text; level-specific text is available separately."""
    return {
        skill_id: {**levels[min(levels)], "MaxLevel": max(levels)}
        for skill_id, levels in get_partner_skill_level_entries_map().items() if levels
    }


@lru_cache(maxsize=1)
def get_partner_quality_entries_map() -> dict[int, dict[int, dict[str, int | list[int]]]]:
    list_columns = ["EvolutionCostItemId", "EvolutionCostItemCount", "StarCostChipCount", "AttrId"]
    rows = TSVReader(PARTNER_QUALITY_TSV_PATH, typed=True).select(
        ["PartnerId", "Quality", "SkillColumnCount", *list_columns],
    )
    result: dict[int, dict[int, dict[str, int | list[int]]]] = {}
    for row in rows:
        partner_id = parse_int(row.get("PartnerId"))
        quality = parse_int(row.get("Quality"))
        count = parse_int(row.get("SkillColumnCount"))
        if any(value is None for value in (partner_id, quality, count)):
            continue
        result.setdefault(partner_id, {})[quality] = {
            "SkillColumnCount": count,
            **{column: extract_int_list(row, [column]) for column in list_columns},
        }
    return result


@lru_cache(maxsize=1)
def get_partner_quality_bound_map() -> dict[int, list[int]]:
    return {
        partner_id: [min(qualities), max(qualities)]
        for partner_id, qualities in get_partner_quality_entries_map().items() if qualities
    }


@lru_cache(maxsize=1)
def get_partner_element_skill_entiers_map() -> dict[int, list[dict[str, object]]]:
    """Element-indexed switch catalog; group membership is filtered per partner."""
    skills = get_partner_skill_entries_map()
    result: dict[int, list[dict[str, object]]] = {}
    for group_id, elements in get_partner_main_skill_group_element_skill_ids_map().items():
        for element, skill_id in elements.items():
            entry = skills.get(skill_id)
            if entry:
                result.setdefault(element, []).append({
                    "skill_group_id": group_id, "skill_id": skill_id,
                    "name": entry["Name"], "Desc": entry["Desc"],
                })
    return result


@lru_cache(maxsize=1)
def get_partner_main_skill_group_ids_map() -> dict[int, list[int]]:
    return {pid: list(row["MainSkillGroupId"]) for pid, row in get_partner_skill_config_map().items()}


@lru_cache(maxsize=1)
def get_partner_recommended_main_skill_entries_map() -> dict[int, list[dict[str, object]]]:
    catalog = get_partner_element_skill_entiers_map()
    groups = get_partner_main_skill_group_ids_map()
    return {
        pid: [row for element in entry["RecommendElement"] for row in catalog.get(element, [])
              if row["skill_group_id"] in groups.get(pid, [])]
        for pid, entry in get_partner_entries_map().items()
    }


@lru_cache(maxsize=1)
def get_partner_star_schedule_options_map() -> dict[int, dict[int, list[int]]]:
    """UI stars 0..5 map to cumulative progress; terminal quality retains full progress."""
    result = {}
    for pid, qualities in get_partner_quality_entries_map().items():
        previous = 0
        result[pid] = {}
        for quality, row in sorted(qualities.items()):
            thresholds = row["StarCostChipCount"]
            result[pid][quality] = [previous, *thresholds] if thresholds else [previous]
            if thresholds:
                previous = thresholds[-1]
    return result


@lru_cache(maxsize=1)
def get_partner_max_template_map() -> dict[int, dict[str, object]]:
    """Pure max targets; MainSkill/PassiveSkill are skill-ID -> level maps, not save records."""
    breakthroughs = get_partner_breakthrough_max_map()
    level_exp = get_partner_breakthrough_max_level_exp_map()
    qualities = get_partner_quality_bound_map()
    skill_levels = get_partner_skill_max_level_map()
    main = get_partner_main_skill_ids_map()
    passive = get_partner_passive_skill_ids_map()
    result: dict[int, dict[str, object]] = {}
    for partner_id in get_partner_entries_map():
        if partner_id not in breakthroughs or partner_id not in qualities:
            continue
        times = breakthroughs[partner_id]["max_breakthrough"]
        stage = level_exp.get(partner_id, {}).get(times)
        main_groups = get_partner_main_skill_groups_map().get(partner_id, [])
        passive_groups = get_partner_passive_skill_groups_map().get(partner_id, [])
        if stage is None or not main_groups or not passive_groups or any(not group for group in [*main_groups, *passive_groups]):
            continue
        if any(skill_levels.get(skill_id, 0) <= 0 for skill_id in [*main[partner_id], *passive[partner_id]]):
            continue
        result[partner_id] = {
            "Quality": qualities[partner_id][1],
            "Breakthrough": times,
            **stage,
            "MainSkill": {skill_id: skill_levels[skill_id] for skill_id in main[partner_id]},
            "PassiveSkill": {skill_id: skill_levels[skill_id] for skill_id in passive[partner_id]},
        }
    return result


def build_partner_max_save_template(partner_id: int) -> dict | None:
    """Ownership-independent save fields; callers cache and copy these per instance."""
    target = get_partner_max_template_map().get(partner_id)
    config = get_partner_skill_config_map().get(partner_id)
    if not target or not config:
        return None
    recommended = get_partner_recommended_main_skill_entries_map().get(partner_id, [])
    active = next((row for row in recommended if row["skill_group_id"] == config["DefaultMainSkillGroupId"]),
                  recommended[0] if recommended else None)
    if active is None or active["skill_id"] not in target["MainSkill"]:
        return None
    quality = target["Quality"]
    schedule = get_partner_star_schedule_options_map().get(partner_id, {}).get(quality, [])
    if not schedule:
        return None
    capacity = get_partner_quality_entries_map()[partner_id][quality]["SkillColumnCount"]
    return {
        "TemplateId": partner_id, "Quality": quality, "StarSchedule": schedule[-1],
        "BreakThrough": target["Breakthrough"], "Level": target["Level"], "Exp": target["Exp"],
        "SkillList": [
            {"_id": active["skill_id"], "Level": target["MainSkill"][active["skill_id"]], "Type": 1, "IsWear": True},
            *[{"_id": skill_id, "Level": level, "Type": 2, "IsWear": index < capacity}
              for index, (skill_id, level) in enumerate(target["PassiveSkill"].items())],
        ],
        "UnlockSkillGroup": list(config["MainSkillGroupId"]),
    }
