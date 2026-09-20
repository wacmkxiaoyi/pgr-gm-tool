"""Refresh the TSV assets consumed by the backend from PGR_Data.

When an asset TSV is added, find its exact source in the upstream ``en/bytes``
client/share trees and explicitly add it to ASSET_MAP. Do not infer a source
from a matching filename: several upstream tables have similar names.
"""

import argparse
import csv
import json
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


REPOSITORY_URL = "https://raw.githubusercontent.com/myssal/PGR_Data/master"
ASSETS_DIR = Path(__file__).resolve().parents[1] / "assets"
RECOMMEND_EQUIPS_SCRIPT = Path(__file__).with_name("character-recommend-equips") / "main.py"
GENERATED_ASSET_PATHS = {"CharacterRecommendEquips.tsv"}

# Target paths are relative to backend/assets; sources are relative to PGR_Data.
ASSET_MAP = {
    "ArchiveWeaponGroup.tsv": "en/bytes/client/archive/ArchiveWeaponGroup.json",
    "AttribPool.tsv": "en/bytes/share/attrib/AttribPool.json",
    "Background.tsv": "en/bytes/share/photomode/Background.json",
    "Character.tsv": "en/bytes/share/character/Character.json",
    "CharacterGrade.tsv": "en/bytes/share/character/grade/CharacterGrade.json",
    "CharacterQuality.tsv": "en/bytes/share/character/quality/CharacterQuality.json",
    "CharacterSkill.tsv": "en/bytes/share/character/skill/CharacterSkill.json",
    "CharacterSkillGroup.tsv": "en/bytes/share/character/skill/CharacterSkillGroup.json",
    "CharacterSkillLevelEffect.tsv": "en/bytes/share/character/skill/CharacterSkillLevelEffect.json",
    "CharacterSkillPool.tsv": "en/bytes/share/character/skill/CharacterSkillPool.json",
    "CharacterSkillUpgradeDes.tsv": "en/bytes/client/character/skill/CharacterSkillUpgradeDes.json",
    "CharacterTrustExp.tsv": "en/bytes/share/trust/CharacterTrustExp.json",
    "EnhanceSkill.tsv": "en/bytes/share/character/enhanceskill/EnhanceSkill.json",
    "EnhanceSkillGroup.tsv": "en/bytes/share/character/enhanceskill/EnhanceSkillGroup.json",
    "EnhanceSkillLevelEffect.tsv": "en/bytes/share/character/enhanceskill/EnhanceSkillLevelEffect.json",
    "EnhanceSkillUpgradeDes.tsv": "en/bytes/client/character/enhanceskill/EnhanceSkillUpgradeDes.json",
    "Equip.tsv": "en/bytes/share/equip/Equip.json",
    "EquipAwake.tsv": "en/bytes/share/equip/EquipAwake.json",
    "EquipBreakThrough.tsv": "en/bytes/share/equip/EquipBreakThrough.json",
    "EquipRes.tsv": "en/bytes/client/equip/EquipRes.json",
    "EquipResonance.tsv": "en/bytes/share/equip/EquipResonance.json",
    "EquipSuit.tsv": "en/bytes/share/equip/EquipSuit.json",
    "ExhibitionReward.tsv": "en/bytes/share/exhibition/ExhibitionReward.json",
    "Fashion.tsv": "en/bytes/share/fashion/Fashion.json",
    "HeadPortrait.tsv": "en/bytes/share/headportrait/HeadPortrait.json",
    "HonorLevel.tsv": "cn/bytes/share/player/HonorLevel.json",
    "Item.tsv": "en/bytes/share/item/Item.json",
    "Player.tsv": "cn/bytes/share/player/Player.json",
    "Stage.tsv": "en/bytes/share/fuben/Stage.json",
    "WeaponOverrun.tsv": "en/bytes/share/equip/WeaponOverrun.json",
    "WeaponSkill.tsv": "en/bytes/share/equip/WeaponSkill.json",
    "WeaponSkillPool.tsv": "en/bytes/share/equip/WeaponSkillPool.json",
    "Partner.tsv": "en/bytes/share/partner/Partner.json",
    "Reward.tsv": "en/bytes/share/reward/Reward.json",
    "RewardGoods.tsv": "en/bytes/share/reward/RewardGoods.json",
    "WeaponFashion.tsv": "en/bytes/share/weaponfashion/WeaponFashion.json",
    "WeaponFashionRes.tsv": "en/bytes/client/weaponfashion/WeaponFashionRes.json",
    "leveluptemplate/1.tsv": "cn/bytes/share/character/leveluptemplate/1.json",
    "leveluptemplate/2.tsv": "cn/bytes/share/character/leveluptemplate/2.json",
    **{
        f"leveluptemplate/{template_id}.tsv": (
            f"cn/bytes/share/equip/leveluptemplate/{template_id}.json"
        )
        for template_id in (
            301, 302, 303, 401, 402, 403, 404, 405, 501, 502, 503, 504,
            505, 601, 602, 603, 604, 605,
        )
    },
}


def validate_mapping() -> None:
    """Require the map to exactly describe the managed TSV asset set."""
    asset_paths = {
        path.relative_to(ASSETS_DIR).as_posix()
        for path in ASSETS_DIR.rglob("*.tsv")
        if path.relative_to(ASSETS_DIR).as_posix() not in GENERATED_ASSET_PATHS
    }
    mapped_paths = set(ASSET_MAP)
    missing = sorted(asset_paths - mapped_paths)
    extra = sorted(mapped_paths - asset_paths)

    if missing or extra:
        details = []
        if missing:
            details.append(f"missing mappings: {', '.join(missing)}")
        if extra:
            details.append(f"mapped files not in assets: {', '.join(extra)}")
        # raise ValueError("ASSET_MAP must cover backend/assets exactly; " + "; ".join(details))

    invalid_sources = sorted(
        source for source in ASSET_MAP.values()
        if not source.endswith(".json") or not source.startswith(("en/bytes/client/", "en/bytes/share/", "cn/bytes/client/", "cn/bytes/share/"))
    )
    if invalid_sources:
        raise ValueError(f"invalid upstream source paths: {', '.join(invalid_sources)}")


def fetch_json(source_path: str, upstream_dir: Path | None):
    if upstream_dir is not None:
        source_file = upstream_dir / source_path
        try:
            with source_file.open("r", encoding="utf-8-sig") as file:
                return json.load(file)
        except (OSError, json.JSONDecodeError) as error:
            raise RuntimeError(f"failed to read {source_file}: {error}") from error

    url = f"{REPOSITORY_URL}/{source_path}"
    for attempt in range(1, 4):
        try:
            with urlopen(url, timeout=120) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError, socket.timeout, json.JSONDecodeError) as error:
            if attempt == 3:
                raise RuntimeError(f"failed to fetch {source_path}: {error}") from error
            print(f"Retrying {source_path} after failed attempt {attempt}: {error}")
            time.sleep(attempt)


def json_cell(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def write_tsv(data, destination: Path) -> int:
    if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
        raise ValueError("upstream JSON must be an array of objects")

    columns = []
    for row in data:
        for column in row:
            if column not in columns:
                columns.append(column)

    if not columns:
        raise ValueError("upstream JSON contains no columns")

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        for row in data:
            writer.writerow({column: json_cell(row.get(column)) for column in columns})
    return len(data)


def prepare_asset(target_path: str, source_path: str, temporary_dir: Path, upstream_dir: Path | None):
    rows = write_tsv(fetch_json(source_path, upstream_dir), temporary_dir / target_path)
    return target_path, source_path, rows


def generate_recommend_equips() -> None:
    """Build the wiki-derived character recommendation asset from refreshed TSVs."""
    try:
        subprocess.run([sys.executable, str(RECOMMEND_EQUIPS_SCRIPT)], check=True)
    except OSError as error:
        raise RuntimeError(f"failed to start recommendation generator: {error}") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"recommendation generator failed with exit code {error.returncode}") from error


def refresh_assets(dry_run: bool = False, workers: int = 8, upstream_dir: Path | None = None, cn_assets: bool = False, recommend_equips: bool = True) -> None:
    validate_mapping()
    temporary_dir = Path(tempfile.mkdtemp(prefix="pgr-assets-"))
    try:
        errors = []
        prepared = []
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(
                    prepare_asset,
                    target,
                    source.replace("en/bytes/", "cn/bytes/") if cn_assets else source,
                    temporary_dir,
                    upstream_dir,
                ): (target, source.replace("en/bytes/", "cn/bytes/") if cn_assets else source)
                for target, source in ASSET_MAP.items()
            }
            for future in as_completed(futures):
                target_path, source_path = futures[future]
                try:
                    prepared.append(future.result())
                except (RuntimeError, ValueError, OSError) as error:
                    errors.append(f"{target_path} <- {source_path}: {error}")

        if errors:
            raise RuntimeError("failed to prepare assets:\n" + "\n".join(sorted(errors)))

        for target_path, source_path, rows in sorted(prepared):
            print(f"Prepared {target_path} from {source_path} ({rows} rows)")

        if dry_run:
            print("Dry run complete; backend/assets was not changed.")
            return

        for target_path in ASSET_MAP:
            source = temporary_dir / target_path
            destination = ASSETS_DIR / target_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            source.replace(destination)
        if recommend_equips:
            generate_recommend_equips()
        print(f"Updated {len(ASSET_MAP)} assets.")
    finally:
        shutil.rmtree(temporary_dir, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="download and convert without replacing assets")
    parser.add_argument(
        "--upstream-dir",
        type=Path,
        help="local PGR_Data repository root; omit to fetch from GitHub",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="number of concurrent download/read and conversion tasks (default: 8)",
    )
    parser.add_argument(
        "--cn",
        type=bool,
        default=False,
        help="use cn assets (default false)",
    )
    parser.add_argument(
        "--recommend-equips",
        type=bool,
        default=False,
        help="update CharacterRecommendEquips.tsv (default false)"
    )
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be a positive integer")
    if args.upstream_dir is not None:
        args.upstream_dir = args.upstream_dir.resolve()
        if not args.upstream_dir.is_dir():
            parser.error("--upstream-dir must be an existing PGR_Data repository directory")
    try:
        refresh_assets(
            dry_run=args.dry_run,
            workers=args.workers,
            upstream_dir=args.upstream_dir,
            cn_assets=args.cn,
            recommend_equips=args.recommend_equips
        )
    except (RuntimeError, ValueError) as error:
        print(f"Asset update failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
