#!/usr/bin/env python3
"""Build a viewport-complete zoom-14 fixed-surface atlas from the local OneMap cache."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps


Image.MAX_IMAGE_PIXELS = None

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE_ROOT = Path(
    "/Users/sweetbuns/Documents/SG MAP/output/onemap-tiles-z11-17"
)
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "output" / "town-map-proof" / "zoom14-atlas"
SOURCE_ZOOM = 17
MANIFEST_ZOOM = 19
TARGET_DISPLAY_ZOOM = 14
TILE_SIZE = 256
RETAINED_SCALE = 0.25
CHUNK_TILE_SPAN_Z19 = 16
CHUNK_PIXEL_SIZE = round(CHUNK_TILE_SPAN_Z19 * TILE_SIZE * RETAINED_SCALE)
JPEG_QUALITY = 95
JPEG_SUBSAMPLING = 0
GENERATOR_VERSION = 1
SURFACE_ID = "SG14"
ATLAS_EDITION = "zoom14-overview-atlas-v1"
CHUNK_CANONICALIZATION = (
    'UTF-8 lines "<sha256>  <filename>\\n", sorted by filename'
)
STYLES = ("default", "gray")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2) + "\n").encode("utf-8")


def write_json(path: Path, value: object) -> dict[str, Any]:
    content = json_bytes(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return {"byteSize": len(content), "sha256": sha256_bytes(content)}


def world_pixel_to_lng(x: float, zoom: int = MANIFEST_ZOOM) -> float:
    world_size = TILE_SIZE * (2**zoom)
    return (x / world_size) * 360 - 180


def world_pixel_to_lat(y: float, zoom: int = MANIFEST_ZOOM) -> float:
    world_size = TILE_SIZE * (2**zoom)
    mercator = math.pi * (1 - (2 * y) / world_size)
    return math.degrees(math.atan(math.sinh(mercator)))


def world_bounds_to_wsen(bounds: list[int]) -> list[float]:
    left, top, right, bottom = bounds
    return [
        world_pixel_to_lng(left),
        world_pixel_to_lat(bottom),
        world_pixel_to_lng(right),
        world_pixel_to_lat(top),
    ]


def discover_tiles(source_root: Path) -> tuple[list[Path], dict[str, int]]:
    zoom_root = source_root / str(SOURCE_ZOOM)
    require(zoom_root.is_dir(), f"Missing OneMap zoom-{SOURCE_ZOOM} cache: {zoom_root}")
    tiles = sorted(
        (
            path
            for path in zoom_root.glob("*/*.png")
            if path.parent.name.isdigit() and path.stem.isdigit()
        ),
        key=lambda path: (int(path.parent.name), int(path.stem)),
    )
    require(tiles, f"No OneMap zoom-{SOURCE_ZOOM} tiles found in {zoom_root}")
    x_values = [int(path.parent.name) for path in tiles]
    y_values = [int(path.stem) for path in tiles]
    bounds = {
        "xMin": min(x_values),
        "xMax": max(x_values),
        "yMin": min(y_values),
        "yMax": max(y_values),
    }
    expected_count = (
        (bounds["xMax"] - bounds["xMin"] + 1)
        * (bounds["yMax"] - bounds["yMin"] + 1)
    )
    require(
        len(tiles) == expected_count,
        f"OneMap zoom-{SOURCE_ZOOM} cache is incomplete: {len(tiles)}/{expected_count} tiles",
    )
    return tiles, bounds


def build_source_inventory(tiles: list[Path], source_root: Path, workers: int) -> str:
    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        jobs = {
            executor.submit(sha256_file, path): path
            for path in tiles
        }
        rows = [
            (
                path.relative_to(source_root).as_posix(),
                job.result(),
                path.stat().st_size,
            )
            for job, path in jobs.items()
        ]
    rows.sort()
    canonical = "".join(
        f"{digest}  {size}  {relative_path}\n"
        for relative_path, digest, size in rows
    )
    return sha256_bytes(canonical.encode("utf-8"))


def chunk_set_sha256(chunks: list[dict[str, Any]]) -> str:
    canonical = "".join(
        f"{chunk['sha256']}  {Path(chunk['url']).name}\n"
        for chunk in sorted(chunks, key=lambda item: Path(item["url"]).name)
    )
    return sha256_bytes(canonical.encode("utf-8"))


def save_jpeg(image: Image.Image, path: Path) -> None:
    temporary_path = path.with_suffix(path.suffix + ".part")
    image.save(
        temporary_path,
        "JPEG",
        quality=JPEG_QUALITY,
        subsampling=JPEG_SUBSAMPLING,
        optimize=True,
    )
    temporary_path.replace(path)


def prepare_chunk(
    source_root: Path,
    output_root: Path,
    tile_bounds: dict[str, int],
    row: int,
    column: int,
    rebuild: bool,
) -> dict[str, dict[str, Any]]:
    x19_start = tile_bounds["xMin"] * 4 + column * CHUNK_TILE_SPAN_Z19
    y19_start = tile_bounds["yMin"] * 4 + row * CHUNK_TILE_SPAN_Z19
    x19_limit = (tile_bounds["xMax"] + 1) * 4
    y19_limit = (tile_bounds["yMax"] + 1) * 4
    x19_end_exclusive = min(x19_limit, x19_start + CHUNK_TILE_SPAN_Z19)
    y19_end_exclusive = min(y19_limit, y19_start + CHUNK_TILE_SPAN_Z19)
    width = round((x19_end_exclusive - x19_start) * TILE_SIZE * RETAINED_SCALE)
    height = round((y19_end_exclusive - y19_start) * TILE_SIZE * RETAINED_SCALE)
    require(width > 0 and height > 0, "Atlas chunk has invalid dimensions")

    x17_start = x19_start // 4
    y17_start = y19_start // 4
    x17_end_exclusive = math.ceil(x19_end_exclusive / 4)
    y17_end_exclusive = math.ceil(y19_end_exclusive / 4)
    canvas = Image.new("RGB", (width, height), "#ffffff")
    for y17 in range(y17_start, y17_end_exclusive):
        for x17 in range(x17_start, x17_end_exclusive):
            tile_path = source_root / str(SOURCE_ZOOM) / str(x17) / f"{y17}.png"
            require(tile_path.is_file(), f"Missing source tile: {tile_path}")
            with Image.open(tile_path) as tile:
                tile_rgb = tile.convert("RGB")
                left = (x17 - x17_start) * TILE_SIZE
                top = (y17 - y17_start) * TILE_SIZE
                canvas.paste(tile_rgb, (left, top))

    chunk_id = (
        f"z19-{x19_start}-{y19_start}-"
        f"{x19_end_exclusive - 1}-{y19_end_exclusive - 1}"
    )
    world_bounds = [x19_start * TILE_SIZE, y19_start * TILE_SIZE,
                    x19_end_exclusive * TILE_SIZE, y19_end_exclusive * TILE_SIZE]
    common = {
        "id": chunk_id,
        "url": f"chunks/{chunk_id}.jpg",
        "row": row,
        "column": column,
        "bounds": world_bounds_to_wsen(world_bounds),
        "worldPixelBounds": world_bounds,
        "pixelSize": [width, height],
    }
    results = {}
    for style in STYLES:
        target_path = output_root / style / "surfaces" / SURFACE_ID / common["url"]
        if rebuild:
            target_path.unlink(missing_ok=True)
        if not target_path.is_file():
            target_path.parent.mkdir(parents=True, exist_ok=True)
            output_image = canvas if style == "default" else ImageOps.grayscale(canvas).convert("RGB")
            save_jpeg(output_image, target_path)
        with Image.open(target_path) as generated:
            require(
                generated.size == (width, height),
                f"Generated chunk size mismatch: {target_path}",
            )
        results[style] = {
            **common,
            "byteSize": target_path.stat().st_size,
            "sha256": sha256_file(target_path),
        }
    return results


def build_manifest(
    style: str,
    chunks: list[dict[str, Any]],
    tile_bounds: dict[str, int],
    source_manifest_sha256: str,
    source_collection_sha256: str,
) -> dict[str, Any]:
    x19_min = tile_bounds["xMin"] * 4
    x19_max = (tile_bounds["xMax"] + 1) * 4
    y19_min = tile_bounds["yMin"] * 4
    y19_max = (tile_bounds["yMax"] + 1) * 4
    surface_world_bounds = [
        x19_min * TILE_SIZE,
        y19_min * TILE_SIZE,
        x19_max * TILE_SIZE,
        y19_max * TILE_SIZE,
    ]
    surface_bounds = world_bounds_to_wsen(surface_world_bounds)
    chunk_columns = math.ceil((x19_max - x19_min) / CHUNK_TILE_SPAN_Z19)
    chunk_rows = math.ceil((y19_max - y19_min) / CHUNK_TILE_SPAN_Z19)
    retained_dimensions = [
        round((surface_world_bounds[2] - surface_world_bounds[0]) * RETAINED_SCALE),
        round((surface_world_bounds[3] - surface_world_bounds[1]) * RETAINED_SCALE),
    ]
    total_bytes = sum(chunk["byteSize"] for chunk in chunks)
    chunks_sha256 = chunk_set_sha256(chunks)
    version = (
        f"{SURFACE_ID.lower()}-atlas-z17-{style}-s25-q95-g{GENERATOR_VERSION}-"
        f"{chunks_sha256[:16]}"
    )
    source = {
        "provider": "OneMap",
        "crs": "EPSG:3857",
        "zoom": MANIFEST_ZOOM,
        "tileSize": TILE_SIZE,
        "retainedScale": RETAINED_SCALE,
        "jpegQuality": JPEG_QUALITY,
        "jpegChromaSubsampling": "4:4:4",
        "generatorVersion": GENERATOR_VERSION,
        "profile": "overview-25",
        "profileLabel": "25% z19 zoom-14 overview",
        "onemapNativeLabels": True,
        "hdbOverlay": False,
        "cartographicRenderZoom": SOURCE_ZOOM,
        "labelTarget": "native OneMap zoom-17 proportions",
        "readabilityPercent": 175,
        "nativePixelDimensions": [
            surface_world_bounds[2] - surface_world_bounds[0],
            surface_world_bounds[3] - surface_world_bounds[1],
        ],
        "worldPixelBounds": {
            "nominal": surface_world_bounds,
            "surface": surface_world_bounds,
        },
        "tileGrid": {
            "columns": x19_max - x19_min,
            "rows": y19_max - y19_min,
            "sourceTiles": (
                (tile_bounds["xMax"] - tile_bounds["xMin"] + 1)
                * (tile_bounds["yMax"] - tile_bounds["yMin"] + 1)
            ),
            "chunkColumns": chunk_columns,
            "chunkRows": chunk_rows,
            "chunkCount": len(chunks),
        },
        "readability": {
            "edition": ATLAS_EDITION,
            "scaleFactor": 1,
            "rasterResampled": False,
            "embeddedImageStreamsPreserved": False,
            "textPreserved": True,
            "contentPreserved": True,
        },
        "overview": {
            "edition": ATLAS_EDITION,
            "targetDisplayZoom": TARGET_DISPLAY_ZOOM,
            "sourceCartographicRenderZoom": SOURCE_ZOOM,
            "sourceRetainedScale": 1,
            "resampling": "NONE",
            "sourceManifestSha256": source_manifest_sha256,
            "sourceCollectionManifestSha256": source_collection_sha256,
            "coverage": "complete rectangular authorised OneMap zoom-17 tile cache",
        },
    }
    if style == "gray":
        source["style"] = "Grey"
        source["overview"]["colourDerivation"] = "grayscale from authorised default atlas"

    return {
        "schema": "carearound.fixed-town-surface",
        "schemaVersion": 1,
        "map": {
            "id": SURFACE_ID,
            "name": "Singapore Zoom-14 Detailed Map Atlas",
            "style": style,
            "version": version,
        },
        "planningAreas": ["Singapore"],
        "bounds": {
            "nominal": surface_bounds,
            "surface": surface_bounds,
        },
        "retainedPixelDimensions": {
            "nominal": retained_dimensions,
            "chunkGrid": retained_dimensions,
        },
        "source": source,
        "attribution": {
            "required": True,
            "text": "OneMap © contributors | Singapore Land Authority",
            "html": '<a href="https://www.onemap.gov.sg/">OneMap</a> © contributors | Singapore Land Authority',
            "logoUrl": "https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png",
        },
        "presentation": {
            "backgroundColor": "#f4f2ed" if style == "default" else "#f3f4f6",
        },
        "transport": {
            "chunkCount": len(chunks),
            "totalBytes": total_bytes,
        },
        "integrity": {
            "algorithm": "sha256",
            "chunkCount": len(chunks),
            "chunkBytes": total_bytes,
            "chunkSetSha256": chunks_sha256,
            "chunkSetCanonicalization": CHUNK_CANONICALIZATION,
            "sourceManifestSha256": source_manifest_sha256,
            "sourceCollectionManifestSha256": source_collection_sha256,
        },
        "chunks": chunks,
    }


def inset_bounds_for_viewport(
    surface_world_bounds: list[int],
    width: int,
    height: int,
) -> list[float]:
    scale = 2 ** (MANIFEST_ZOOM - TARGET_DISPLAY_ZOOM)
    half_width = width * scale / 2
    half_height = height * scale / 2
    inset = [
        round(surface_world_bounds[0] + half_width),
        round(surface_world_bounds[1] + half_height),
        round(surface_world_bounds[2] - half_width),
        round(surface_world_bounds[3] - half_height),
    ]
    return world_bounds_to_wsen(inset)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()

    source_root = args.source_root.expanduser().resolve()
    output_root = args.output_root.expanduser().resolve()
    require(source_root.is_dir(), f"Source root does not exist: {source_root}")
    require(args.workers > 0, "--workers must be greater than zero")
    if args.rebuild:
        shutil.rmtree(output_root, ignore_errors=True)

    tilejson_path = source_root / "tilejson.json"
    require(tilejson_path.is_file(), f"Missing OneMap tilejson: {tilejson_path}")
    tilejson = json.loads(tilejson_path.read_text(encoding="utf-8"))
    require(tilejson.get("maxzoom") == SOURCE_ZOOM, "OneMap cache max zoom must be 17")
    require(tilejson.get("crs") == "EPSG:3857", "OneMap cache CRS must be EPSG:3857")
    require("Singapore Land Authority" in tilejson.get("attribution", ""), "OneMap attribution is missing")

    tiles, tile_bounds = discover_tiles(source_root)
    source_manifest_sha256 = sha256_file(tilejson_path)
    source_collection_sha256 = build_source_inventory(tiles, source_root, args.workers)
    chunk_columns = math.ceil(
        ((tile_bounds["xMax"] - tile_bounds["xMin"] + 1) * 4)
        / CHUNK_TILE_SPAN_Z19
    )
    chunk_rows = math.ceil(
        ((tile_bounds["yMax"] - tile_bounds["yMin"] + 1) * 4)
        / CHUNK_TILE_SPAN_Z19
    )

    style_chunks: dict[str, list[dict[str, Any]]] = {style: [] for style in STYLES}
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        jobs = [
            executor.submit(
                prepare_chunk,
                source_root,
                output_root,
                tile_bounds,
                row,
                column,
                args.rebuild,
            )
            for row in range(chunk_rows)
            for column in range(chunk_columns)
        ]
        for completed, job in enumerate(as_completed(jobs), start=1):
            result = job.result()
            for style in STYLES:
                style_chunks[style].append(result[style])
            if completed == 1 or completed % 100 == 0 or completed == len(jobs):
                print(f"Prepared {completed}/{len(jobs)} atlas chunks per style", flush=True)

    x19_min = tile_bounds["xMin"] * 4
    x19_max = (tile_bounds["xMax"] + 1) * 4
    y19_min = tile_bounds["yMin"] * 4
    y19_max = (tile_bounds["yMax"] + 1) * 4
    surface_world_bounds = [
        x19_min * TILE_SIZE,
        y19_min * TILE_SIZE,
        x19_max * TILE_SIZE,
        y19_max * TILE_SIZE,
    ]
    styles = []
    for style in STYLES:
        chunks = sorted(style_chunks[style], key=lambda chunk: (chunk["row"], chunk["column"]))
        manifest = build_manifest(
            style,
            chunks,
            tile_bounds,
            source_manifest_sha256,
            source_collection_sha256,
        )
        surface_root = output_root / style / "surfaces" / SURFACE_ID
        manifest_result = write_json(surface_root / "manifest.json", manifest)
        index_entry = {
            "id": SURFACE_ID,
            "name": manifest["map"]["name"],
            "style": style,
            "version": manifest["map"]["version"],
            "profile": "overview-25",
            "retainedScale": RETAINED_SCALE,
            "planningAreas": manifest["planningAreas"],
            "bounds": manifest["bounds"],
            "manifestPath": f"surfaces/{SURFACE_ID}/manifest.json",
            "assetBasePath": f"surfaces/{SURFACE_ID}",
            "retainedPixelDimensions": manifest["retainedPixelDimensions"]["chunkGrid"],
            "manifestSha256": manifest_result["sha256"],
            "manifestBytes": manifest_result["byteSize"],
            "chunkCount": manifest["transport"]["chunkCount"],
            "totalBytes": manifest["transport"]["totalBytes"],
            "chunkSetSha256": manifest["integrity"]["chunkSetSha256"],
        }
        index = {
            "schema": "carearound.fixed-town-surface-index",
            "schemaVersion": 1,
            "collection": {
                "id": "sg-zoom14-overview-atlas",
                "name": "Singapore Zoom-14 Detailed Map Atlas",
                "style": style,
                "version": (
                    f"sg-overview-atlas-{style}-"
                    f"{manifest_result['sha256'][:16]}"
                ),
                "overview": {
                    "edition": ATLAS_EDITION,
                    "targetDisplayZoom": TARGET_DISPLAY_ZOOM,
                },
            },
            "bounds": manifest["bounds"],
            "source": {
                "provider": "OneMap",
                "crs": "EPSG:3857",
                "zoom": MANIFEST_ZOOM,
                "tileSize": TILE_SIZE,
                "readabilityPercent": 175,
            },
            "attribution": manifest["attribution"],
            "transport": {
                "surfaceCount": 1,
                "chunkCount": manifest["transport"]["chunkCount"],
                "totalBytes": manifest["transport"]["totalBytes"],
            },
            "surfaces": [index_entry],
        }
        index_result = write_json(output_root / style / "manifest.json", index)
        styles.append({
            "style": style,
            "surfaceCount": 1,
            "chunkCount": manifest["transport"]["chunkCount"],
            "chunkBytes": manifest["transport"]["totalBytes"],
            "manifestSha256": manifest_result["sha256"],
            "indexSha256": index_result["sha256"],
            "version": index["collection"]["version"],
        })

    validation = {
        "schema": "carearound.zoom14-overview-atlas-validation/v1",
        "generatedAt": utc_now(),
        "status": "pass",
        "sourceRoot": str(source_root),
        "outputRoot": str(output_root),
        "sourceManifestSha256": source_manifest_sha256,
        "sourceCollectionManifestSha256": source_collection_sha256,
        "sourceZoom": SOURCE_ZOOM,
        "targetDisplayZoom": TARGET_DISPLAY_ZOOM,
        "retainedScale": RETAINED_SCALE,
        "chunkPixelSize": CHUNK_PIXEL_SIZE,
        "tileBounds": tile_bounds,
        "surfaceBounds": world_bounds_to_wsen(surface_world_bounds),
        "supportedViewportCenterBounds": {
            "interactive-1200x650": inset_bounds_for_viewport(surface_world_bounds, 1200, 650),
            "print-1480x720": inset_bounds_for_viewport(surface_world_bounds, 1480, 720),
            "desktop-1800x900": inset_bounds_for_viewport(surface_world_bounds, 1800, 900),
        },
        "styles": styles,
    }
    write_json(output_root / "validation.json", validation)
    print(json.dumps(validation, indent=2))


if __name__ == "__main__":
    main()
