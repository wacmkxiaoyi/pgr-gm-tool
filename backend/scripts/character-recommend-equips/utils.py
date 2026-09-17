from __future__ import annotations

import csv
import logging
import re
import json
import threading
import time
from pathlib import Path
from typing import Dict, Optional

import requests
from bs4 import BeautifulSoup

from constants import WIKI_URL


logger = logging.getLogger(__name__)


REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0",
}

REQUEST_LOCK = threading.Lock()
next_request_at = 0.0


def get_id_map_from_tsv(
    path: Path | str,
    key_fields: tuple[str, ...],
    id_field: str = "Id",
    id_prefix: str | None = None,
    id_value_fields: tuple[str, ...] = (),
    keep_first: bool = False,
) -> Dict[str, int]:
    """Build an ID mapping from selected columns in a TSV resource."""

    path = Path(path)
    id_map: Dict[str, int] = {}

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        if reader.fieldnames is None:
            return id_map

        for row in reader:
            key = ":".join((row.get(field) or "").strip() for field in key_fields)
            id_value = (row.get(id_field) or "").strip()
            if id_prefix and not id_value.startswith(id_prefix):
                continue
            if any(
                (row.get(field) or "").strip() != id_value
                for field in id_value_fields
            ):
                continue
            if not key or not id_value:
                continue

            if keep_first and key in id_map:
                continue
            id_map[key] = int(id_value)

    return id_map


def fetch_recommend_table(character_full_name) -> Dict[str, Optional[str]]:
    """Fetch recommended weapon, CUB, and memory placement data from wiki.

    The target page is built from ``WIKI_URL`` and ``f"/character_full_name"``.

    Returns:
        A dictionary with keys:
        - weapon
        - CUB
        - weapon_resonances
        - memories
        - memory_resonances

    Missing items are returned as ``None``.
    """
    if character_full_name == 'No. 21: XXI':
        character_full_name = 'No.21: XXI'


    url = f"{WIKI_URL.rstrip('/')}/{'_'.join(character_full_name.split(' '))}"
    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)
    global next_request_at
    for attempt in range(3):
        try:
            with REQUEST_LOCK:
                delay = next_request_at - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
                next_request_at = time.monotonic() + 0.5
            response = session.get(url, timeout=15)
            if response.status_code not in (403, 429):
                response.raise_for_status()
                break
        except requests.RequestException as exc:
            if attempt == 2:
                raise
            logger.warning(
                'Request for %s failed (%s); retrying in %d seconds',
                character_full_name,
                exc,
                2 ** attempt,
            )
        else:
            if attempt == 2:
                response.raise_for_status()
            logger.warning(
                'Request for %s returned %d; retrying in %d seconds',
                character_full_name,
                response.status_code,
                2 ** attempt,
            )
        time.sleep(2 ** attempt)

    soup = BeautifulSoup(response.text, "html.parser")

    result: Dict[str, Optional[str]] = {
        "weapon": None,
        "CUB": None,
        "weapon_resonances": [],
        "memories": [],
        "memory_resonances": []
    }

    for p in soup.find_all("p"):
        text = p.get_text(" ", strip=True)
        if character_full_name == 'Discord: Secator':
            result["weapon"] = 'Osseous Guillotine'
        elif text.startswith("Optimal Weapon:"):
            link = p.find("a")
            if link:
                result["weapon"] = link.get_text(strip=True)
        elif text.startswith("Optimal CUB:"):
            link = p.find("a")
            if link:
                result["CUB"] = link.get_text(strip=True)

    for h2 in soup.find_all("h2"):
        h2_id = h2.get("id") or ""
        if not re.fullmatch(r"Weapon_Resonance_.+", h2_id):
            continue

        column_container = h2.find_next("div", class_="column-container")
        if column_container is None:
            continue

        column_left = column_container.find("div", class_="column-left")
        if column_left is None:
            continue

        resonance_titles = []
        for cb_container in column_left.find_all("div", class_="cb-container", recursive=False):
            title_div = cb_container.find("div", class_="cb-title")
            if title_div is None:
                continue

            title_text = title_div.get_text(" ", strip=True)
            title_text = re.sub(r"^\s*\d+\.\s*", "", title_text)
            if title_text:
                resonance_titles.append(title_text)

        for title in resonance_titles[:3]:
            result["weapon_resonances"].append(title)
        break

    memory_title = None
    for title_div in soup.find_all("div", class_="cb-title"):
        if title_div.get_text(" ", strip=True) == "Memory Placement":
            memory_title = title_div
            break

    if character_full_name == 'Haicma: Starveil':
        result['memories'] = ['Isabel'] * 6
    elif memory_title is not None:
        memory_text = memory_title.find_next_sibling("div", class_="cb-text")
        if memory_text is None:
            memory_text = memory_title.find_next("div", class_="cb-text")

        if memory_text is not None:
            table = memory_text.find("table", class_="wikitable")
            if table is not None:
                for td in table.find_all("td"):
                    link = td.find("a")
                    if link is None:
                        continue
                    result['memories'].append(link.get("title") or link.get_text(strip=True))

    for title_div in soup.find_all("div", class_="cb-title"):
        if title_div.get_text(" ", strip=True) != "Memory Resonance":
            continue

        resonance_text = title_div.find_next_sibling("div", class_="cb-text")
        if resonance_text is None:
            resonance_text = title_div.find_next("div", class_="cb-text")

        if resonance_text is None:
            break

        for slot_label in ("Top Resonance Slot (1):", "Bottom Resonance Slot (2):"):
            label_span = resonance_text.find("span", string=lambda value: value and slot_label in value)
            if label_span is None:
                continue

            value_span = label_span.find_next("span")
            if value_span is None:
                continue

            result[f"memory_resonances"].append(value_span.get_text(strip=True).rstrip(":"))

        break

    return result


def build_ids_tsv(ids_map: Dict[int, Dict[str, Optional[int]]], output_path: Path | str) -> None:
    """Write the id mapping table to TSV in the expected header order."""

    output_path = Path(output_path)
    fieldnames = [
        "Id",
        "WeaponId",
        "CUB",
        "WeaponResonances",
        "Memories",
        "MemoryResonances",
    ]

    def format_cell(value):
        if isinstance(value, str):
            return value
        if value is None:
            return "null"
        return json.dumps(value, ensure_ascii=False)

    with output_path.open("w", encoding="utf-8-sig", newline="") as f:
        f.write("\t".join(fieldnames) + "\n")

        for id_value in sorted(ids_map):
            row = {"Id": id_value}
            row.update(ids_map[id_value])
            f.write("\t".join(format_cell(row.get(key)) for key in fieldnames) + "\n")

def get_resonance(name, attrib_skills_map, character_skills_map, weapon_skills_map):
    if not name or name == 'Unset':
        return {
            'Type': 0,
            'TemplateId': None
        }
    
    for i, skills_map in enumerate((attrib_skills_map, character_skills_map, weapon_skills_map), 1):
        if name in skills_map:
            return {
                'Type': i,
                'TemplateId': skills_map[name]
            }
        
    logger.warning(f'Resonance skill `{name}` id not found')
    return {
        'Type': 0,
        'TemplateId': None
    }

 
def build_character_ids(character_full_name: str, c_id: int, character_skills_map, weapon_id_map, cub_id_map, weapon_skills_map, memory_id_map, attrib_skills_map):
    logger.info('Fetching %s', character_full_name)

    recommend_table = fetch_recommend_table(character_full_name)

    row = {}

    weapon = recommend_table.get('weapon')
    if weapon_id := weapon_id_map.get(weapon):
        row['WeaponId'] = weapon_id
    else:
        row['WeaponId'] = None
        logger.warning(f'Weapon `{weapon}` id not found')

    cub = recommend_table.get('CUB')
    if cub is None:
        row['CUB'] = None
    elif cub_id := cub_id_map.get(cub):
        row['CUB'] = cub_id
    else:
        row['CUB'] = None
        logger.error('CUB `%s` id not found', cub)

    weapon_resonances = recommend_table.get('weapon_resonances')
    if len(weapon_resonances) < 3:
        weapon_resonances += ['Unset'] * (3 - len(weapon_resonances))

    row['WeaponResonances'] = [
        get_resonance(resonance_name.strip(), attrib_skills_map, character_skills_map, weapon_skills_map)
        for resonance_name in weapon_resonances[:3]
    ]

    row['Memories'] = []
    memories = recommend_table.get('memories')
    if len(memories) < 6:
        memories += ['Unset'] * (6 - len(memories))
    for i, memory_name in enumerate(memories[:6], 1):
        if memory_name == 'PhilipII':
            memory_name = 'Philip II'
        elif memory_name == 'DaVinci':
            memory_name = 'Da Vinci'
        elif memory_name == 'Wuan':
            memory_name = 'Wu\'an'
        elif memory_name == 'Marcco':
            memory_name = 'Marco'
        elif memory_name == 'ChangWuzi':
            memory_name = 'Chang Wuzi'
        elif memory_name == 'Alphons':
            memory_name = 'Alphonse'

        if memory_id := memory_id_map.get(f'{memory_name}:{i}'):
            row['Memories'].append(memory_id)
        else:
            row['Memories'].append(None)
            if memory_name != 'Unset':
                logger.warning(f'Memory `{memory_name}` id not found')

    row['MemoryResonances'] = []
    memory_resonances = recommend_table.get(f'memory_resonances')
    if len(memory_resonances) < 2:
        memory_resonances += ['Unset'] * (6 - len(memories))
    for memory_resonance_skill_names in memory_resonances[:2]:
        if ' + ' in memory_resonance_skill_names:
            memory_resonance_skill_names = [
                memory_resonance_skill_name.rsplit('x')[0]
                for memory_resonance_skill_name in memory_resonance_skill_names.split(' + ')
            ]
        elif ' / ' in memory_resonance_skill_names:
            memory_resonance_skill_names = memory_resonance_skill_names.split(' / ')[0]
        elif memory_resonance_skill_names == 'Signature - Supernova Blast':
            memory_resonance_skill_names = 'Signature - Supernova Burst'
        elif memory_resonance_skill_names == 'Space Walk/Tank':
            memory_resonance_skill_names = 'Space Walk'
        elif memory_resonance_skill_names in ('Core Passive', 'Class Passive'):
            memory_resonance_skill_names = 'ATK Boost'
        elif memory_resonance_skill_names == 'Frost - Treated Blade':
            memory_resonance_skill_names = 'Frost-Treated Blade'
        elif memory_resonance_skill_names == 'Magnetic Pole Explosion':
            memory_resonance_skill_names = 'Magnetic Blast'
        elif memory_resonance_skill_names == 'Hacking Sequence':
            memory_resonance_skill_names = 'Signature - Hacking Sequence'
        elif memory_resonance_skill_names == 'Devastator':
            memory_resonance_skill_names = 'Signature - Devastator'
        elif memory_resonance_skill_names in ('ATK', 'Any ATK'):
            memory_resonance_skill_names = 'Ex - Precision Attack'
        elif memory_resonance_skill_names == 'Corporality of Peafowl, Spirit of Dragon':
            memory_resonance_skill_names = 'Marvel'
        
        if not isinstance(memory_resonance_skill_names, list):
            memory_resonance_skill_names = [memory_resonance_skill_names]

        result = [
            get_resonance(memory_resonance_skill_name.replace('—', '-').strip(), attrib_skills_map, character_skills_map, weapon_skills_map)
            for memory_resonance_skill_name in memory_resonance_skill_names
        ]
        row['MemoryResonances'].append(result)

    return c_id, row
