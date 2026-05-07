from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.utils.tsv_reader import TSVReader


ATTRIB_POOL_TSV_PATH = Path("resources/AttribPool.tsv")
CHARACTER_SKILL_POOL_TSV_PATH = Path("resources/CharacterSkillPool.tsv")


@lru_cache(maxsize=1)
def get_attrib_pool_name_map() -> dict[int, str]:
    reader = TSVReader(ATTRIB_POOL_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Id", "Name")[0]
    return {
        int(rid): str(val).strip()
        for rid, val in raw_map.items()
        if str(val).strip()
    }


@lru_cache(maxsize=1)
def get_character_skill_pool_name_map() -> dict[int, str]:
    reader = TSVReader(CHARACTER_SKILL_POOL_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Id", "Name")[0]
    return {
        int(rid): str(val).strip()
        for rid, val in raw_map.items()
        if str(val).strip()
    }
