from __future__ import annotations

from functools import lru_cache
from typing import Any

from backend.app.config import settings
from backend.app.services.player.constants import ATTRIB_POOL_TSV_PATH, CHARACTER_GRADE_TSV_PATH, CHARACTER_QUALITY_TSV_PATH, CHARACTER_RECOMMEND_EQUIPS_TSV_PATH, CHARACTER_SKILL_GROUP_TSV_PATH, CHARACTER_SKILL_LEVEL_EFFECT_TSV_PATH, CHARACTER_SKILL_POOL_TSV_PATH, CHARACTER_SKILL_TSV_PATH, CHARACTER_SKILL_UPGRADE_DES_TSV_PATH, CHARACTER_TRUST_EXP_TSV_PATH, CHARACTER_TSV_PATH, ENHANCE_SKILL_GROUP_TSV_PATH, ENHANCE_SKILL_LEVEL_EFFECT_TSV_PATH, ENHANCE_SKILL_TSV_PATH, ENHANCE_SKILL_UPGRADE_DES_TSV_PATH, EXHIBITION_REWARD_TSV_PATH, FASHION_TSV_PATH, FIXED_CHARACTER_MAX_MEMORY_RESONANCES, ICON_TOOLS_ASSET_PREFIX, ROLE_CHARACTER_ASSET_PREFIX
from backend.app.services.player.equips import get_breakthrough_levelup_template_map, get_equip_awake_template_id_set, get_equip_breakthrough_max_map, get_equip_site_map
from backend.app.services.player.equips.weapon import get_weapon_overrun_max_level_map, get_weapon_overrun_suit_memory_ids_map
from backend.app.services.player.levelup_template import get_level_per_exp, get_levelup_template_max_level, get_level_exp_map
from backend.app.services.player.utils import extract_int_list, normalize_asset_path, normalize_int_text_map, parse_int
from backend.app.utils.tsv_reader import TSVReader


REMOVED_FASHION_IDS = {6902301}


def _build_skill_entry(template_id: Any, name: Any, description: Any) -> dict[str, Any] | None:
    normalized_template_id = parse_int(template_id)
    if normalized_template_id is None:
        return None

    normalized_name = str(name or "").strip()
    normalized_description = str(description or "").strip()
    return {
        "TemplateId": normalized_template_id,
        "Name": normalized_name,
        "Description": normalized_description,
    }


def _get_container_columns(reader: TSVReader, base_column: str, legacy_indexes: range) -> list[str]:
    columns = list(reader.data[0]) if reader.data else []
    if base_column in columns:
        return [base_column]
    return [f"{base_column}[{index}]" for index in legacy_indexes]


def _parse_skill_level_id(value: Any) -> tuple[int, int] | None:
    text = str(value or "").strip()
    if len(text) < 3 or not text.isdigit():
        return None

    skill_id = parse_int(text[:-2])
    level = parse_int(text[-2:])
    if skill_id is None or level is None:
        return None
    return skill_id, level


def _build_character_skill_ids_map(character_skill_tsv_path: Any, skill_group_tsv_path: Any) -> dict[int, list[int]]:
    character_skill_reader = TSVReader(character_skill_tsv_path, typed=True)
    skill_group_columns = _get_container_columns(character_skill_reader, "SkillGroupId", range(1, 17))
    character_skill_group_table = character_skill_reader.get_sub_table("CharacterId", skill_group_columns)
    character_skill_group_ids_map: dict[int, list[int]] = {}

    for character_id_raw, row in character_skill_group_table.items():
        character_id = parse_int(character_id_raw)
        if character_id is None:
            continue

        character_skill_group_ids_map[character_id] = extract_int_list(row, skill_group_columns, dedupe=True)

    skill_group_reader = TSVReader(skill_group_tsv_path, typed=True)
    skill_columns = _get_container_columns(skill_group_reader, "SkillId", range(3))
    skill_group_table = skill_group_reader.get_sub_table("Id", skill_columns)
    skill_group_skill_ids_map: dict[int, list[int]] = {}

    for group_id_raw, row in skill_group_table.items():
        group_id = parse_int(group_id_raw)
        if group_id is None:
            continue

        skill_group_skill_ids_map[group_id] = extract_int_list(row, skill_columns, dedupe=True)

    normalized_map: dict[int, list[int]] = {}
    for character_id, group_ids in character_skill_group_ids_map.items():
        skill_ids: list[int] = []
        seen_skill_ids: set[int] = set()
        for group_id in group_ids:
            for skill_id in skill_group_skill_ids_map.get(group_id, []):
                if skill_id in seen_skill_ids:
                    continue
                seen_skill_ids.add(skill_id)
                skill_ids.append(skill_id)

        normalized_map[character_id] = skill_ids

    return normalized_map


def _build_skill_entries_map(level_effect_tsv_path: Any, upgrade_des_tsv_path: Any) -> dict[int, dict[str, int | str]]:
    level_effect_reader = TSVReader(level_effect_tsv_path, typed=True)
    upgrade_des_reader = TSVReader(upgrade_des_tsv_path, typed=True)
    max_level_map: dict[int, int] = {}
    name_map: dict[int, str] = {}

    for row in level_effect_reader.data:
        if not isinstance(row, dict):
            continue

        skill_id = parse_int(row.get("SkillId"))
        level = parse_int(row.get("Level"))
        if skill_id is None or level is None:
            skill_level = _parse_skill_level_id(row.get("SkillLevelId"))
            if skill_level is not None:
                skill_id, level = skill_level
        if skill_id is None or level is None:
            continue

        max_level_map[skill_id] = max(max_level_map.get(skill_id, 0), level)

    for row in upgrade_des_reader.data:
        if not isinstance(row, dict):
            continue

        skill_id = parse_int(row.get("SkillId"))
        if skill_id is None or skill_id in name_map:
            continue

        name = str(row.get("Name", "")).strip()
        if not name:
            continue

        name_map[skill_id] = name

    return {
        skill_id: {
            "MaxLevel": max_level_map.get(skill_id, 0),
            "Name": name_map.get(skill_id, ""),
        }
        for skill_id in sorted(set(max_level_map) | set(name_map))
    }


@lru_cache(maxsize=1)
def get_character_levelup_template_map() -> dict[int, int]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Id", "LevelUpTemplateId")[0]
    normalized_map: dict[int, int] = {}

    for character_id_raw, levelup_template_id_raw in raw_map.items():
        character_id = parse_int(character_id_raw)
        levelup_template_id = parse_int(levelup_template_id_raw)

        if character_id is None or levelup_template_id is None:
            continue

        normalized_map[character_id] = levelup_template_id

    return normalized_map

@lru_cache(maxsize=1)
def get_character_equip_type_map() -> dict[int, int]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Id", "EquipType")[0]
    normalized_map: dict[int, int] = {}

    for character_id_raw, equip_type_raw in raw_map.items():
        character_id = parse_int(character_id_raw)
        equip_type = parse_int(equip_type_raw)

        if character_id is None or equip_type is None:
            continue

        normalized_map[character_id] = equip_type

    return normalized_map

@lru_cache(maxsize=1)
def get_attrib_pool_entries_map() -> dict[int, list[dict[str, Any]]]:
    reader = TSVReader(ATTRIB_POOL_TSV_PATH, typed=True)
    normalized_map: dict[int, list[dict[str, Any]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = parse_int(row.get("PoolId"))
        if pool_id is None:
            continue

        entry = _build_skill_entry(row.get("Id"), row.get("Name"), row.get("Description"))
        if entry is None:
            continue

        normalized_map.setdefault(pool_id, []).append(entry)

    return normalized_map

@lru_cache(maxsize=1)
def get_character_skill_group_ids_map() -> dict[int, list[int]]:
    reader = TSVReader(CHARACTER_SKILL_TSV_PATH, typed=True)
    skill_group_columns = _get_container_columns(reader, "SkillGroupId", range(1, 17))
    skill_group_table = reader.get_sub_table("CharacterId", skill_group_columns)
    normalized_map: dict[int, list[int]] = {}

    for character_id_raw, row in skill_group_table.items():
        character_id = parse_int(character_id_raw)
        if character_id is None:
            continue

        normalized_map[character_id] = extract_int_list(row, skill_group_columns, dedupe=True)

    return normalized_map


@lru_cache(maxsize=1)
def get_character_skill_group_skill_ids_map() -> dict[int, list[int]]:
    reader = TSVReader(CHARACTER_SKILL_GROUP_TSV_PATH, typed=True)
    skill_columns = _get_container_columns(reader, "SkillId", range(3))
    skill_group_table = reader.get_sub_table("Id", skill_columns)
    normalized_map: dict[int, list[int]] = {}

    for group_id_raw, row in skill_group_table.items():
        group_id = parse_int(group_id_raw)
        if group_id is None:
            continue

        normalized_map[group_id] = extract_int_list(row, skill_columns, dedupe=True)

    return normalized_map


@lru_cache(maxsize=1)
def get_character_skill_ids_map() -> dict[int, list[int]]:
    return _build_character_skill_ids_map(CHARACTER_SKILL_TSV_PATH, CHARACTER_SKILL_GROUP_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_skill_entries_map() -> dict[int, dict[str, int | str]]:
    return _build_skill_entries_map(CHARACTER_SKILL_LEVEL_EFFECT_TSV_PATH, CHARACTER_SKILL_UPGRADE_DES_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_skill_pool_entries_map() -> dict[int, dict[int, list[dict[str, Any]]]]:
    reader = TSVReader(CHARACTER_SKILL_POOL_TSV_PATH, typed=True)
    character_skill_ids_map = get_character_skill_ids_map()
    pool_skill_entry_map: dict[int, dict[int, dict[str, Any]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = parse_int(row.get("PoolId"))
        if pool_id is None:
            continue

        entry = _build_skill_entry(row.get("SkillId"), row.get("Name"), row.get("Description"))
        if entry is None:
            continue

        pool_skill_entry_map.setdefault(pool_id, {})[entry["TemplateId"]] = entry

    normalized_map: dict[int, dict[int, list[dict[str, Any]]]] = {}
    for pool_id, skill_entry_map in pool_skill_entry_map.items():
        character_entries_map: dict[int, list[dict[str, Any]]] = {}
        for character_id, skill_ids in character_skill_ids_map.items():
            entries = [skill_entry_map[skill_id] for skill_id in skill_ids if skill_id in skill_entry_map]
            if entries:
                character_entries_map[character_id] = entries

        normalized_map[pool_id] = character_entries_map

    return normalized_map

@lru_cache(maxsize=1)
def get_character_enhance_skill_ids_map() -> dict[int, list[int]]:
    return _build_character_skill_ids_map(ENHANCE_SKILL_TSV_PATH, ENHANCE_SKILL_GROUP_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_enhance_skill_entries_map() -> dict[int, dict[str, int | str]]:
    return _build_skill_entries_map(ENHANCE_SKILL_LEVEL_EFFECT_TSV_PATH, ENHANCE_SKILL_UPGRADE_DES_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_grade_name_map() -> dict[int, list[str]]:
    reader = TSVReader(CHARACTER_GRADE_TSV_PATH, typed=True)
    rows = reader.select(["CharacterId", "Grade", "GradeName"])
    grade_pairs: dict[int, list[tuple[int, str]]] = {}

    for row in rows:
        character_id = parse_int(row.get("CharacterId"))
        grade = parse_int(row.get("Grade"))
        grade_name = str(row.get("GradeName", "")).strip()

        if character_id is None or grade is None or not grade_name:
            continue

        grade_pairs.setdefault(character_id, []).append((grade, grade_name))

    return {
        character_id: [name for _, name in sorted(pairs, key=lambda pair: pair[0])]
        for character_id, pairs in grade_pairs.items()
    }


@lru_cache(maxsize=1)
def get_character_quality_bound_map() -> dict[int, list[int]]:
    reader = TSVReader(CHARACTER_QUALITY_TSV_PATH, typed=True)
    rows = reader.select(["CharacterId", "Quality"])
    quality_values: dict[int, list[int]] = {}

    for row in rows:
        character_id = parse_int(row.get("CharacterId"))
        quality = parse_int(row.get("Quality"))

        if character_id is None or quality is None:
            continue

        quality_values.setdefault(character_id, []).append(quality)

    return {
        character_id: [min(values), max(values)]
        for character_id, values in quality_values.items()
    }


@lru_cache(maxsize=1)
def get_character_trust_exp_map() -> dict[int, dict[int, int]]:
    reader = TSVReader(CHARACTER_TRUST_EXP_TSV_PATH, typed=True)
    normalized_map: dict[int, dict[int, int]] = {}

    for row in reader.select(["CharacterId", "TrustLv", "Exp"]):
        character_id = parse_int(row.get("CharacterId"))
        trust_level = parse_int(row.get("TrustLv"))
        exp = parse_int(row.get("Exp"))
        if character_id is None or trust_level is None or exp is None:
            continue

        normalized_map.setdefault(character_id, {})[trust_level] = exp

    return normalized_map


@lru_cache(maxsize=1)
def get_character_exhibitions_map() -> dict[int, list[int]]:
    reader = TSVReader(EXHIBITION_REWARD_TSV_PATH, typed=True)
    rows = reader.select(["CharacterId", "Id"])
    exhibition_ids: dict[int, list[int]] = {}

    for row in rows:
        character_id = parse_int(row.get("CharacterId"))
        exhibition_id = parse_int(row.get("Id"))

        if character_id is None or exhibition_id is None:
            continue

        exhibition_ids.setdefault(character_id, []).append(exhibition_id)

    return {
        character_id: sorted(ids)
        for character_id, ids in exhibition_ids.items()
    }


@lru_cache(maxsize=1)
def get_character_max_liberate_level_map() -> dict[int, int]:
    reader = TSVReader(EXHIBITION_REWARD_TSV_PATH, typed=True)
    normalized_map: dict[int, int] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = parse_int(row.get("CharacterId"))
        level_id = parse_int(row.get("LevelId"))
        if character_id is None or level_id is None:
            continue

        normalized_map[character_id] = max(normalized_map.get(character_id, 0), level_id)

    return normalized_map


@lru_cache(maxsize=1)
def get_character_log_name_map() -> dict[int, str]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "LogName")[0])


@lru_cache(maxsize=1)
def get_character_head_icon_url_map() -> dict[int, str]:
    reader = TSVReader(FASHION_TSV_PATH, typed=True)
    normalized_map: dict[int, str] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = parse_int(row.get("CharacterId"))
        fashion_id = parse_int(row.get("Id"))
        if character_id is None or fashion_id is None or fashion_id in REMOVED_FASHION_IDS:
            continue

        if character_id in normalized_map:
            continue

        asset_path = normalize_asset_path(str(row.get("BigHeadIcon", "")), ROLE_CHARACTER_ASSET_PREFIX)
        if asset_path is None:
            continue

        normalized_map[character_id] = asset_path

    return normalized_map


@lru_cache(maxsize=1)
def get_character_Intro_map() -> dict[int, str]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "Intro")[0])


@lru_cache(maxsize=1)
def get_character_fashions_map() -> dict[int, list[dict[str, int | str]]]:
    reader = TSVReader(FASHION_TSV_PATH, typed=True)
    normalized_map: dict[int, list[dict[str, int | str]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = parse_int(row.get("CharacterId"))
        fashion_id = parse_int(row.get("Id"))
        quality = parse_int(row.get("Quality"))

        if character_id is None or fashion_id is None or quality is None or fashion_id in REMOVED_FASHION_IDS:
            continue

        big_icon = normalize_asset_path(str(row.get("BigIcon", "")), ICON_TOOLS_ASSET_PREFIX)
        big_head_icon_fashion = normalize_asset_path(str(row.get("BigHeadIconFashion", "")), ROLE_CHARACTER_ASSET_PREFIX)

        if big_icon is None or big_head_icon_fashion is None:
            continue

        normalized_map.setdefault(character_id, []).append(
            {
                "Id": fashion_id,
                "Quality": quality,
                "BigIcon": big_icon,
                "BigHeadIconFashion": big_head_icon_fashion,
                'Name': row.get('Name', ''),
                'Description': row.get('WorldDescription', '')
            }
        )

    return normalized_map

@lru_cache(maxsize=1)
def get_character_default_weapon_map() -> dict[int, int]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Id", "EquipId")[0]
    normalized_map: dict[int, int] = {}

    for character_id_raw, equip_id_raw in raw_map.items():
        character_id = parse_int(character_id_raw)
        equip_id = parse_int(equip_id_raw)

        if character_id is None or equip_id is None:
            continue

        normalized_map[character_id] = equip_id

    return normalized_map

@lru_cache(maxsize=1)
def get_character_recommend_equips_map() -> dict[int, dict[str, Any]]:
    reader = TSVReader(CHARACTER_RECOMMEND_EQUIPS_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table(
        "Id",
        ["WeaponId", "WeaponResonances", "Memories", "MemoryResonances"],
    )
    normalized_map: dict[int, dict[str, Any]] = {}

    for character_id_raw, row in raw_table.items():
        character_id = parse_int(character_id_raw)
        weapon_id = parse_int(row.get("WeaponId"))

        if character_id is None or weapon_id is None:
            continue

        weapon_resonances = row.get("WeaponResonances")
        memories = row.get("Memories")
        memory_resonances = row.get("MemoryResonances")

        normalized_map[character_id] = {
            "WeaponId": weapon_id,
            "WeaponResonances": weapon_resonances if isinstance(weapon_resonances, list) else [],
            "Memories": memories if isinstance(memories, list) else [],
            "MemoryResonances": memory_resonances if isinstance(memory_resonances, list) else [],
        }

    return normalized_map

def _normalize_resonance_entry(raw_entry: Any, *, slot: int, character_id: int) -> dict[str, int] | None:
    if not isinstance(raw_entry, dict):
        return None

    entry_type = parse_int(raw_entry.get("Type"))
    template_id = parse_int(raw_entry.get("TemplateId"))
    if entry_type is None or entry_type <= 0 or template_id is None or template_id <= 0:
        return None

    return {
        "Slot": slot,
        "Type": entry_type,
        "TemplateId": template_id,
        "CharacterId": character_id,
    }

def _resolve_equip_max_level_exp(template_id: int, breakthrough: int) -> dict[str, int] | None:
    template_stage_map = get_breakthrough_levelup_template_map().get(template_id)
    if not isinstance(template_stage_map, dict):
        return None

    levelup_template_id = parse_int(template_stage_map.get(breakthrough))
    if levelup_template_id is None:
        return None

    max_level = get_levelup_template_max_level(levelup_template_id)
    if max_level is None:
        return None

    per_exp = get_level_per_exp(levelup_template_id, max_level)
    if per_exp is None:
        return None

    return {
        "Level": max_level,
        "Exp": per_exp,
    }


def _choose_weapon_overrun_suit(memory_template_ids: list[int]) -> int | None:
    suit_memory_ids_map = get_weapon_overrun_suit_memory_ids_map()
    if not memory_template_ids or not suit_memory_ids_map:
        return None

    equipped_memory_counts: dict[int, int] = {}
    for template_id in memory_template_ids:
        equipped_memory_counts[template_id] = equipped_memory_counts.get(template_id, 0) + 1

    best_suit_id: int | None = None
    best_sort_key: tuple[int, int] | None = None
    for suit_id, slot_memory_map in suit_memory_ids_map.items():
        if not isinstance(slot_memory_map, dict):
            continue

        matched_count = sum(
            1
            for memory_id_raw in slot_memory_map.values()
            for memory_id in [parse_int(memory_id_raw)]
            if memory_id is not None and equipped_memory_counts.get(memory_id, 0) > 0
        )
        if matched_count <= 0:
            continue

        sort_key = (matched_count, -suit_id)
        if best_sort_key is None or sort_key > best_sort_key:
            best_sort_key = sort_key
            best_suit_id = suit_id

    return best_suit_id


@lru_cache(maxsize=1)
def get_character_max_template_map() -> dict[int, dict[str, Any]]:
    character_quality_bound_map = get_character_quality_bound_map()
    character_grade_name_map = get_character_grade_name_map()
    character_trust_exp_map = get_character_trust_exp_map()
    character_levelup_template_map = get_character_levelup_template_map()
    character_max_liberate_level_map = get_character_max_liberate_level_map()
    character_exhibitions_map = get_character_exhibitions_map()
    character_fashions_map = get_character_fashions_map()
    character_recommend_equips_map = get_character_recommend_equips_map()
    character_skill_ids_map = get_character_skill_ids_map()
    character_skill_entries_map = get_character_skill_entries_map()
    character_enhance_skill_ids_map = get_character_enhance_skill_ids_map()
    character_enhance_skill_entries_map = get_character_enhance_skill_entries_map()
    equip_breakthrough_max_map = get_equip_breakthrough_max_map()
    awake_supported_template_ids = get_equip_awake_template_id_set()
    weapon_overrun_max_level_map = get_weapon_overrun_max_level_map()

    normalized_map: dict[int, dict[str, Any]] = {}
    for character_id, recommend_equips in character_recommend_equips_map.items():
        quality_bound = character_quality_bound_map.get(character_id)
        grade_names = character_grade_name_map.get(character_id, [])
        levelup_template_id = character_levelup_template_map.get(character_id)
        max_liberate_level = character_max_liberate_level_map.get(character_id)
        if not isinstance(quality_bound, list) or len(quality_bound) != 2 or not grade_names or levelup_template_id is None or max_liberate_level is None:
            continue

        trust_exp_map = character_trust_exp_map.get(character_id, {})
        trust_levels = sorted(level for level in trust_exp_map if level > 0)
        max_trust_level = trust_levels[-1] if trust_levels else None

        level_exp_map = get_level_exp_map(levelup_template_id)
        character_max_level = max(list(level_exp_map.keys()))
        character_max_level_exp = level_exp_map[character_max_level]

        max_quality = quality_bound[1]
        max_grade = len(grade_names)
        exhibitions = [
            exhibition_id
            for raw_exhibition_id in character_exhibitions_map.get(character_id, [])
            for exhibition_id in [parse_int(raw_exhibition_id)]
            if exhibition_id is not None
        ]
        fashions = [fashion for fashion in character_fashions_map.get(character_id, []) if isinstance(fashion, dict)]
        chosen_fashion = max(
            fashions,
            key=lambda fashion: (parse_int(fashion.get("Quality")) or 0, parse_int(fashion.get("Id")) or 0),
            default=None,
        )
        chosen_fashion_id = parse_int(chosen_fashion.get("Id")) if isinstance(chosen_fashion, dict) else None
        unlock_fashion_ids = [
            fashion_id
            for fashion in fashions
            for fashion_id in [parse_int(fashion.get("Id"))]
            if fashion_id is not None
        ]

        memories = recommend_equips.get("Memories") if isinstance(recommend_equips.get("Memories"), list) else []
        memory_resonances = recommend_equips.get("MemoryResonances") if isinstance(recommend_equips.get("MemoryResonances"), list) else []
        memory_templates: list[dict[str, Any]] = []
        resolved_memory_template_ids: list[int] = []
        memory_ids_by_site: dict[int, int] = {}
        for raw_memory_template_id in memories:
            memory_template_id = parse_int(raw_memory_template_id)
            if memory_template_id is None:
                continue

            memory_site = parse_int(get_equip_site_map().get(memory_template_id))
            if memory_site is None or memory_site < 1 or memory_site > 6:
                continue
            memory_ids_by_site[memory_site] = memory_template_id

        for memory_site, memory_template_id in sorted(memory_ids_by_site.items()):
            site_index = memory_site - 1

            max_breakthrough = equip_breakthrough_max_map.get(memory_template_id, {}).get("max_breakthrough", 0)
            memory_level_exp = _resolve_equip_max_level_exp(memory_template_id, max_breakthrough)
            if memory_level_exp is None:
                continue

            resonance_info: list[dict[str, int]] = []
            awake_slots: list[int] = []
            for slot_index, raw_slot_entries in enumerate(
                FIXED_CHARACTER_MAX_MEMORY_RESONANCES
                if settings.max_character_use_fix_memory_resonance
                else memory_resonances
            ):
                if not isinstance(raw_slot_entries, list) or not raw_slot_entries:
                    continue

                raw_entry = raw_slot_entries[site_index % len(raw_slot_entries)]
                normalized_entry = _normalize_resonance_entry(raw_entry, slot=slot_index + 1, character_id=character_id)
                if normalized_entry is None:
                    continue

                resonance_info.append(normalized_entry)
                if memory_template_id in awake_supported_template_ids:
                    awake_slots.append(slot_index + 1)

            memory_templates.append({
                "TemplateId": memory_template_id,
                "CharacterId": character_id,
                "Breakthrough": max_breakthrough,
                "Level": memory_level_exp["Level"],
                "Exp": memory_level_exp["Exp"],
                "ResonanceInfo": resonance_info,
                "AwakeSlotList": sorted(set(awake_slots)),
            })
            resolved_memory_template_ids.append(memory_template_id)

        weapon_template_id = parse_int(recommend_equips.get("WeaponId"))
        weapon_template: dict[str, Any] | None = None
        if weapon_template_id is not None:
            max_breakthrough = equip_breakthrough_max_map.get(weapon_template_id, {}).get("max_breakthrough", 0)
            weapon_level_exp = _resolve_equip_max_level_exp(weapon_template_id, max_breakthrough)
            if weapon_level_exp is not None:
                weapon_resonances = recommend_equips.get("WeaponResonances") if isinstance(recommend_equips.get("WeaponResonances"), list) else []
                resonance_info = [
                    normalized_entry
                    for slot_index, raw_entry in enumerate(weapon_resonances)
                    for normalized_entry in [_normalize_resonance_entry(raw_entry, slot=slot_index + 1, character_id=character_id)]
                    if normalized_entry is not None
                ]
                awake_slots = sorted({entry["Slot"] for entry in resonance_info if weapon_template_id in awake_supported_template_ids})
                overrun_suit_id = _choose_weapon_overrun_suit(resolved_memory_template_ids)
                overrun_data: dict[str, Any] = {}
                max_overrun_level = weapon_overrun_max_level_map.get(weapon_template_id)
                if max_overrun_level is not None:
                    overrun_data["Level"] = max_overrun_level
                if overrun_suit_id is not None:
                    overrun_data["ActiveSuits"] = [overrun_suit_id]
                    overrun_data["ChoseSuit"] = overrun_suit_id

                weapon_template = {
                    "TemplateId": weapon_template_id,
                    "CharacterId": character_id,
                    "Breakthrough": max_breakthrough,
                    "Level": weapon_level_exp["Level"],
                    "Exp": weapon_level_exp["Exp"],
                    "ResonanceInfo": resonance_info,
                    "AwakeSlotList": awake_slots,
                    "WeaponOverrunData": overrun_data,
                }

        skill_list = [
            {"_id": skill_id, "Level": parse_int(character_skill_entries_map.get(skill_id, {}).get("MaxLevel")) or 0}
            for skill_id in character_skill_ids_map.get(character_id, [])
            if (parse_int(character_skill_entries_map.get(skill_id, {}).get("MaxLevel")) or 0) > 0
        ]
        enhance_skill_list = [
            {"_id": skill_id, "Level": parse_int(character_enhance_skill_entries_map.get(skill_id, {}).get("MaxLevel")) or 0}
            for skill_id in character_enhance_skill_ids_map.get(character_id, [])
            if (parse_int(character_enhance_skill_entries_map.get(skill_id, {}).get("MaxLevel")) or 0) > 0
        ]

        normalized_map[character_id] = {
            "character": {
                "Quality": max_quality,
                "Star": 0 if max_quality == 6 else 9,
                "Grade": max_grade,
                "TrustLv": max_trust_level,
                "TrustExp": trust_exp_map.get(max_trust_level, 0) if max_trust_level is not None else 0,
                "LiberateLv": max_liberate_level,
                "Level": character_max_level,
                "Exp": character_max_level_exp,
                "SkillList": skill_list,
                "EnhanceSkillList": enhance_skill_list,
            },
            "awaken": {
                "GatherRewards": exhibitions[:max_liberate_level],
            },
            "fashion": {
                "UnlockFashionIds": unlock_fashion_ids,
                "SelectedFashionId": chosen_fashion_id,
            },
            "memories": memory_templates,
            "weapon": weapon_template,
        }

    return normalized_map
