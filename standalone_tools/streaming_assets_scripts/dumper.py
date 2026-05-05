"""
Modification version, origin script from Yon: https://discord.com/channels/1109243478325596250/1115067916342276146/1489988922845958326
"""

import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import UnityPy

key = bytes.fromhex("587865636f6472506547616b61326536")
UnityPy.set_assetbundle_decrypt_key(key)

input_path = Path(r"resource\matrix")
output_path = Path(r"")
max_workers = min(32, max(1, (os.cpu_count() or 1) * 4))

write_lock = threading.Lock() 
latest_write_index = {}


def write_bytes(dest: Path, payload: bytes, bundle_index: int) -> bool:
    with write_lock:
        previous_index = latest_write_index.get(dest)
        if previous_index is not None and previous_index > bundle_index:
            return False

        latest_write_index[dest] = bundle_index
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            f.write(payload)
        return True


def save_image(dest: Path, image, bundle_index: int) -> bool:
    with write_lock:
        previous_index = latest_write_index.get(dest)
        if previous_index is not None and previous_index > bundle_index:
            return False

        latest_write_index[dest] = bundle_index
        dest.parent.mkdir(parents=True, exist_ok=True)
        image.save(dest)
        return True


def process_bundle(bundle_index: int, total_bundles: int, decoded_path: Path):
    env = UnityPy.load(str(decoded_path))
    extracted = 0

    for path, obj in env.container.items():
        norm_path = path.replace("\\", "/")
        dest_rel = Path(*norm_path.split("/"))
        data = obj.read()

        if obj.type.name == "TextAsset":
            dest = output_path / dest_rel
            if write_bytes(dest, data.m_Script.encode("utf-8", errors="surrogateescape"), bundle_index):
                extracted += 1

        elif obj.type.name == "Texture2D":
            dest = (output_path / dest_rel).with_suffix(".png")
            if save_image(dest, data.image, bundle_index):
                extracted += 1

        elif obj.type.name == "Sprite":
            dest = (output_path / dest_rel).with_suffix(".png")
            if save_image(dest, data.image, bundle_index):
                extracted += 1

    return bundle_index, total_bundles, decoded_path.name, extracted


def main():
    decoded_files = sorted(input_path.glob("*.uab"))
    print(f"Scanning {len(decoded_files)} decoded .uab files with {max_workers} threads")

    total_extracted = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(process_bundle, idx, len(decoded_files), decoded_path): decoded_path
            for idx, decoded_path in enumerate(decoded_files, 1)
        }

        for future in as_completed(futures):
            decoded_path = futures[future]

            try:
                bundle_index, total_bundles, bundle_name, extracted = future.result()
                if extracted > 0:
                    print(f"[{bundle_index}/{total_bundles}] {bundle_name}: extracted {extracted} files")
                    total_extracted += extracted
            except Exception as e:
                print(f"[!] Failed to process {decoded_path.name}: {e}")

    print(f"\nExtraction complete! Total files extracted: {total_extracted}")


if __name__ == "__main__":
    main()
