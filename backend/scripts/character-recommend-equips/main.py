"""
scripts from AwakeningXY
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from pathlib import Path
import time

from utils import get_id_map_from_tsv, build_character_ids, build_ids_tsv


logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)

ASSETS_DIR = Path(__file__).resolve().parents[2] / 'assets'
EN_ASSETS_DIR = ASSETS_DIR / 'EN'

if __name__ == '__main__':
    attrib_skills_map = get_id_map_from_tsv(EN_ASSETS_DIR / 'AttribPool.tsv', ('Name',))
    character_id_map = get_id_map_from_tsv(EN_ASSETS_DIR / 'Character.tsv', ('LogName',))
    character_skills_map = get_id_map_from_tsv(
        EN_ASSETS_DIR / 'CharacterSkillUpgradeDes.tsv',
        ('Name',),
        id_field='SkillId',
        keep_first=True,
    )
    weapon_id_map = get_id_map_from_tsv(
        EN_ASSETS_DIR / 'Equip.tsv',
        ('Name',),
        id_prefix='2',
        id_value_fields=('WeaponSkillId',),
    )
    weapon_skills_map = get_id_map_from_tsv(EN_ASSETS_DIR / 'WeaponSkill.tsv', ('Name',))
    memory_id_map = get_id_map_from_tsv(EN_ASSETS_DIR / 'Equip.tsv', ('Name', 'Site'), id_prefix='3')
    cub_id_map = get_id_map_from_tsv(EN_ASSETS_DIR / 'Partner.tsv', ('Name',))

    ids_map = {}
    total = len(character_id_map)
    if total == 0:
        logger.info('No characters found, nothing to do.')
    else:
        max_workers = 4
        logger.info('Start fetching %d characters with %d workers', total, max_workers)
        started_at = time.perf_counter()

        completed = 0
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(build_character_ids, character, c_id, character_skills_map, weapon_id_map, cub_id_map, weapon_skills_map, memory_id_map, attrib_skills_map): (character, c_id)
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
                        'CUB': None,
                        'WeaponResonances': [],
                        'Memories': [],
                        'MemoryResonances': []
                    }

        elapsed = time.perf_counter() - started_at
        logger.info('Finished %d characters in %.2f seconds', total, elapsed)

    build_ids_tsv(ids_map, ASSETS_DIR / 'CharacterRecommendEquips.tsv')
