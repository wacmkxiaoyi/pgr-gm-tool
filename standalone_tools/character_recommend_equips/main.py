"""
scripts from AwakeningXY
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import os
import time

from utils import get_id_map_from_csv, build_character_ids, build_ids_tsv


logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)

if __name__ == '__main__':
    attrib_skills_map = get_id_map_from_csv('resources/attrib_skills.csv')
    character_id_map = get_id_map_from_csv('resources/characters.csv')
    character_skills_map = get_id_map_from_csv('resources/character_skills.csv')
    weapon_id_map = get_id_map_from_csv('resources/weapons.csv')
    weapon_skills_map = get_id_map_from_csv('resources/weapon_skills.csv')
    memory_id_map = get_id_map_from_csv('resources/memories.csv')

    ids_map = {}
    total = len(character_id_map)
    if total == 0:
        logger.info('No characters found, nothing to do.')
    else:
        max_workers = min(32, (os.cpu_count() or 1) + 4)
        logger.info('Start fetching %d characters with %d workers', total, max_workers)
        started_at = time.perf_counter()

        completed = 0
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(build_character_ids, character, c_id, character_skills_map, weapon_id_map, weapon_skills_map, memory_id_map, attrib_skills_map): (character, c_id)
                for character, c_id in character_id_map.items()
            }

            for future in as_completed(future_map):
                character, c_id = future_map[future]
                completed += 1
                try:
                    resolved_id, row = future.result()
                    ids_map[resolved_id] = row
                    logger.info('Completed %d/%d: %s -> %s', completed, total, character, resolved_id)
                except Exception as exc:
                    logger.exception('Failed %d/%d: %s (%s)', completed, total, character, exc)
                    ids_map[c_id] = {
                        'WeaponId': None,
                        'WeaponResonances': [],
                        'Memories': [],
                        'MemoryResonances': []
                    }

        elapsed = time.perf_counter() - started_at
        logger.info('Finished %d characters in %.2f seconds', total, elapsed)

    build_ids_tsv(ids_map, 'results.tsv')
