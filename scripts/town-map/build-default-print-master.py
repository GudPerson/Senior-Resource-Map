#!/usr/bin/env python3
"""Build 100% OneMap Default print-only chunks outside the client bundle."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image


Image.MAX_IMAGE_PIXELS = None

ZOOM = 19
TILE_SIZE = 256
CHUNK_TILES = 15
JPEG_QUALITY = 95
MAP_BACKGROUND = (244, 242, 237)
DEFAULT_SOURCE_ROOT = Path("/Users/sweetbuns/Documents/SG MAP")
DEFAULT_PLAN = DEFAULT_SOURCE_ROOT / "output/static-town-maps/islandwide-town-plate-plan.json"
DEFAULT_TILE_ROOT = DEFAULT_SOURCE_ROOT / "output/onemap-tiles-atlas-z18-19"
DEFAULT_FALLBACK_TILE_ROOT = DEFAULT_SOURCE_ROOT / "output/onemap-tiles-cck-z18-19"
DEFAULT_SUPPLEMENTAL_TILE_ROOT = Path(
    "/Users/sweetbuns/CareAroundSG-print-assets/source-cache/onemap-default-z19"
)
TILE_JSON_URL = "https://www.onemap.gov.sg/maps/json/raster/tilejson/2.2.0/Default.json"
DEFAULT_OUTPUT_ROOT = Path(
    os.environ.get(
        "TOWN_MAP_PRINT_DEFAULT_OUTPUT_ROOT",
        "/Users/sweetbuns/CareAroundSG-print-assets/default",
    )
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def lon_lat_to_world_pixel(longitude: float, latitude: float) -> tuple[float, float]:
    world_size = TILE_SIZE * (2**ZOOM)
    safe_latitude = max(-85.05112878, min(85.05112878, latitude))
    sine = math.sin(math.radians(safe_latitude))
    return (
        ((longitude + 180.0) / 360.0) * world_size,
        (0.5 - math.log((1.0 + sine) / (1.0 - sine)) / (4.0 * math.pi)) * world_size,
    )


def world_pixel_to_lon_lat(x: float, y: float) -> tuple[float, float]:
    world_size = TILE_SIZE * (2**ZOOM)
    longitude = (x / world_size) * 360.0 - 180.0
    mercator_y = math.pi - (2.0 * math.pi * y) / world_size
    latitude = math.degrees(math.atan(math.sinh(mercator_y)))
    return longitude, latitude


def flatten_tile(tile: Image.Image) -> Image.Image:
    rgba = tile.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (*MAP_BACKGROUND, 255))
    background.alpha_composite(rgba)
    return background.convert("RGB")


def find_tile(tile_roots: list[Path], x: int, y: int) -> Path | None:
    for root in tile_roots:
        candidate = root / str(ZOOM) / str(x) / f"{y}.png"
        if candidate.is_file():
            return candidate
    return None


def required_tiles(plate: dict[str, object]) -> list[tuple[int, int]]:
    west, south, east, north = (float(value) for value in plate["bounds"])
    left, top = lon_lat_to_world_pixel(west, north)
    right, bottom = lon_lat_to_world_pixel(east, south)
    return [
        (x, y)
        for x in range(math.floor(left / TILE_SIZE), math.floor((right - 1) / TILE_SIZE) + 1)
        for y in range(math.floor(top / TILE_SIZE), math.floor((bottom - 1) / TILE_SIZE) + 1)
    ]


def fetch_bytes(url: str, attempts: int = 4) -> bytes:
    request = Request(url, headers={"User-Agent": "CareAround-print-master-builder/1.0"})
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=30) as response:
                content_type = response.headers.get("Content-Type", "").lower()
                payload = response.read()
            if not content_type.startswith("image/") or not payload.startswith(b"\x89PNG\r\n\x1a\n"):
                raise RuntimeError(f"OneMap returned an invalid PNG response for {url}")
            with Image.open(BytesIO(payload)) as image:
                image.verify()
            with Image.open(BytesIO(payload)) as image:
                if image.size != (TILE_SIZE, TILE_SIZE):
                    raise RuntimeError(f"OneMap returned {image.size} for {url}; expected {(TILE_SIZE, TILE_SIZE)}")
            return payload
        except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as error:
            if attempt == attempts - 1:
                raise RuntimeError(f"Could not fetch {url}: {error}") from error
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def hydrate_missing_tiles(
    plates: list[dict[str, object]],
    tile_roots: list[Path],
    supplemental_root: Path,
    workers: int,
) -> int:
    accepted = os.environ.get("ONEMAP_DEVELOPER_AGREEMENT_ACCEPTED", "").strip().lower()
    if accepted not in {"yes", "true", "1"}:
        raise RuntimeError(
            "Refusing to download OneMap tiles. Set ONEMAP_DEVELOPER_AGREEMENT_ACCEPTED=yes "
            "only after confirming the OneMap developer agreement."
        )
    request = Request(TILE_JSON_URL, headers={"User-Agent": "CareAround-print-master-builder/1.0"})
    with urlopen(request, timeout=30) as response:
        tilejson = json.loads(response.read().decode("utf-8"))
    template = tilejson.get("tiles", [""])[0]
    if not template:
        raise RuntimeError("OneMap TileJSON did not include a tile URL template")

    missing = sorted({
        coordinate
        for plate in plates
        for coordinate in required_tiles(plate)
        if find_tile(tile_roots, *coordinate) is None
    })
    if not missing:
        return 0
    supplemental_root.mkdir(parents=True, exist_ok=True)

    def download(coordinate: tuple[int, int]) -> None:
        x, y = coordinate
        target = supplemental_root / str(ZOOM) / str(x) / f"{y}.png"
        if target.is_file() and target.stat().st_size > 0:
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        url = template.replace("{z}", str(ZOOM)).replace("{x}", str(x)).replace("{y}", str(y))
        payload = fetch_bytes(url)
        temporary = target.with_suffix(".png.tmp")
        temporary.write_bytes(payload)
        temporary.replace(target)

    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(download, coordinate) for coordinate in missing]
        for future in concurrent.futures.as_completed(futures):
            future.result()
            completed += 1
            if completed == 1 or completed % 250 == 0 or completed == len(missing):
                print(f"Fetched {completed}/{len(missing)} missing official OneMap tiles", flush=True)
    return len(missing)


def build_plate(plate: dict[str, object], tile_roots: list[Path], output_root: Path, rebuild: bool) -> dict[str, object]:
    plate_id = str(plate["id"]).upper()
    west, south, east, north = (float(value) for value in plate["bounds"])
    left, top = lon_lat_to_world_pixel(west, north)
    right, bottom = lon_lat_to_world_pixel(east, south)
    xmin = math.floor(left / TILE_SIZE)
    ymin = math.floor(top / TILE_SIZE)
    xmax = math.floor((right - 1) / TILE_SIZE)
    ymax = math.floor((bottom - 1) / TILE_SIZE)
    chunk_root = output_root / "chunks" / f"{plate_id}-s100-q{JPEG_QUALITY}"
    manifest_root = output_root / "manifests"
    chunk_root.mkdir(parents=True, exist_ok=True)
    manifest_root.mkdir(parents=True, exist_ok=True)

    chunks: list[dict[str, object]] = []
    total_rows = math.ceil((ymax - ymin + 1) / CHUNK_TILES)
    for row_number, tile_y in enumerate(range(ymin, ymax + 1, CHUNK_TILES), start=1):
        tile_y_end = min(tile_y + CHUNK_TILES - 1, ymax)
        for tile_x in range(xmin, xmax + 1, CHUNK_TILES):
            tile_x_end = min(tile_x + CHUNK_TILES - 1, xmax)
            chunk_left = tile_x * TILE_SIZE
            chunk_top = tile_y * TILE_SIZE
            crop_left = max(0, math.floor(left - chunk_left))
            crop_top = max(0, math.floor(top - chunk_top))
            crop_right = min((tile_x_end - tile_x + 1) * TILE_SIZE, math.ceil(right - chunk_left))
            crop_bottom = min((tile_y_end - tile_y + 1) * TILE_SIZE, math.ceil(bottom - chunk_top))
            width = crop_right - crop_left
            height = crop_bottom - crop_top
            name = f"z{ZOOM}-{tile_x}-{tile_y}-{tile_x_end}-{tile_y_end}.jpg"
            target = chunk_root / name
            if rebuild or not target.is_file():
                mosaic = Image.new(
                    "RGB",
                    ((tile_x_end - tile_x + 1) * TILE_SIZE, (tile_y_end - tile_y + 1) * TILE_SIZE),
                    MAP_BACKGROUND,
                )
                for x in range(tile_x, tile_x_end + 1):
                    for y in range(tile_y, tile_y_end + 1):
                        tile_path = find_tile(tile_roots, x, y)
                        if tile_path is None:
                            searched = ", ".join(str(root) for root in tile_roots)
                            raise RuntimeError(f"Missing source tile for {plate_id}: z{ZOOM}/{x}/{y} under {searched}")
                        with Image.open(tile_path) as tile:
                            mosaic.paste(flatten_tile(tile), ((x - tile_x) * TILE_SIZE, (y - tile_y) * TILE_SIZE))
                cropped = mosaic.crop((crop_left, crop_top, crop_right, crop_bottom))
                cropped.save(
                    target,
                    "JPEG",
                    quality=JPEG_QUALITY,
                    subsampling=0,
                    optimize=True,
                    progressive=False,
                )
            with Image.open(target) as image:
                if image.size != (width, height):
                    raise RuntimeError(f"Unexpected print chunk size: {target} {image.size} != {(width, height)}")
            world_bounds = [
                chunk_left + crop_left,
                chunk_top + crop_top,
                chunk_left + crop_right,
                chunk_top + crop_bottom,
            ]
            chunk_west, chunk_north = world_pixel_to_lon_lat(world_bounds[0], world_bounds[1])
            chunk_east, chunk_south = world_pixel_to_lon_lat(world_bounds[2], world_bounds[3])
            chunks.append({
                "id": target.stem,
                "url": target.relative_to(output_root).as_posix(),
                "left": world_bounds[0],
                "top": world_bounds[1],
                "right": world_bounds[2],
                "bottom": world_bounds[3],
                "width": width,
                "height": height,
                "bounds": [chunk_west, chunk_south, chunk_east, chunk_north],
                "bytes": target.stat().st_size,
                "sha256": sha256_file(target),
            })
        print(f"{plate_id}: prepared print-master row {row_number}/{total_rows}", flush=True)

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    manifest = {
        "schema": "carearound.print-master/v1",
        "edition": "onemap-default-100-print-master-v1",
        "generated_at": generated_at,
        "id": plate_id,
        "name": plate.get("name", plate_id),
        "planning_areas": plate.get("planning_areas", []),
        "bounds": [west, south, east, north],
        "source_retention_scale": 1.0,
        "source": {
            "provider": "OneMap",
            "style": "Default",
            "zoom": ZOOM,
            "detail_equivalent_zoom": ZOOM,
            "display_grid": f"EPSG:3857 world pixels at zoom {ZOOM}",
        },
        "presentation": {"backgroundColor": "#f4f2ed"},
        "attribution": {
            "text": "OneMap (c) contributors | Singapore Land Authority",
            "required_visible": True,
        },
        "jpeg_quality": JPEG_QUALITY,
        "native_width_px": round(right - left),
        "native_height_px": round(bottom - top),
        "chunks": chunks,
        "integrity": {
            "algorithm": "sha256",
            "chunk_count": len(chunks),
            "total_bytes": sum(int(chunk["bytes"]) for chunk in chunks),
        },
    }
    manifest_path = manifest_root / f"{plate_id.lower()}-default-print-master-100.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{plate_id}: {len(chunks)} chunks -> {manifest_path}", flush=True)
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plate-id", action="append", help="Plate ID; repeat or use ALL (default W01)")
    parser.add_argument("--plan", type=Path, default=DEFAULT_PLAN)
    parser.add_argument("--tile-root", type=Path, default=DEFAULT_TILE_ROOT)
    parser.add_argument("--fallback-tile-root", type=Path, default=DEFAULT_FALLBACK_TILE_ROOT)
    parser.add_argument("--supplemental-tile-root", type=Path, default=DEFAULT_SUPPLEMENTAL_TILE_ROOT)
    parser.add_argument("--fetch-missing", action="store_true")
    parser.add_argument("--fetch-workers", type=int, default=10)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--rebuild", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    plates = {str(plate["id"]).upper(): plate for plate in plan["plates"]}
    requested = [value.upper() for value in (args.plate_id or ["W01"])]
    selected = list(plates) if "ALL" in requested else requested
    missing = [plate_id for plate_id in selected if plate_id not in plates]
    if missing:
        raise RuntimeError(f"Unknown plate IDs: {', '.join(missing)}")
    args.output_root.mkdir(parents=True, exist_ok=True)
    if args.fetch_workers < 1 or args.fetch_workers > 16:
        raise RuntimeError("--fetch-workers must be between 1 and 16")
    tile_roots = [args.tile_root, args.fallback_tile_root, args.supplemental_tile_root]
    selected_plates = [plates[plate_id] for plate_id in selected]
    if args.fetch_missing:
        hydrate_missing_tiles(selected_plates, tile_roots, args.supplemental_tile_root, args.fetch_workers)
    records = [build_plate(plate, tile_roots, args.output_root, args.rebuild) for plate in selected_plates]
    index = {
        "schema": "carearound.print-master-collection/v1",
        "edition": "onemap-default-100-print-master-v1",
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source_retention_scale": 1.0,
        "surface_count": len(records),
        "surfaces": [{
            "id": record["id"],
            "bounds": record["bounds"],
            "manifest": f"manifests/{record['id'].lower()}-default-print-master-100.json",
            "chunk_count": len(record["chunks"]),
        } for record in records],
    }
    (args.output_root / "print-master-index.json").write_text(
        json.dumps(index, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
