#!/usr/bin/env python3
"""Build the bounded Discover-only 80%-linear fixed-surface derivative pilot."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from PIL import Image


Image.MAX_IMAGE_PIXELS = None

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_ROOT = (
    REPO_ROOT / "output" / "town-map-proof" / "discover-derivative-pilot"
)
SOURCE_ROOTS = {
    ("native", "default"): "https://maps.carearound.sg/v2/native-scale-20260722/default",
    ("native", "gray"): "https://maps.carearound.sg/v2/native-scale-20260722/gray",
    ("overview", "default"): "https://maps.carearound.sg/v3/zoom14-atlas-20260730/default",
    ("overview", "gray"): "https://maps.carearound.sg/v3/zoom14-atlas-20260730/gray",
}
SURFACE_IDS = {
    "native": ("C02", "W04"),
    "overview": ("SG14",),
}
LINEAR_SCALE = 0.8
JPEG_QUALITY = 95
JPEG_SUBSAMPLING = 0
DERIVATIVE_EDITION = "discover-derivative-v1"
CHUNK_CANONICALIZATION = (
    'UTF-8 lines "<sha256>  <filename>\\n", sorted by filename'
)
USER_AGENT = "CareAroundSG-Discover-Derivative-Pilot/1"


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
    temporary_path = path.with_suffix(path.suffix + ".part")
    temporary_path.write_bytes(content)
    temporary_path.replace(path)
    return {"byteSize": len(content), "sha256": sha256_bytes(content)}


def fetch_bytes(url: str, attempts: int = 4) -> bytes:
    require(
        url.startswith("https://maps.carearound.sg/"),
        f"Refusing non-CareAround map source: {url}",
    )
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=45) as response:
                require(response.status == 200, f"Unexpected HTTP {response.status}: {url}")
                return response.read()
        except (OSError, urllib.error.URLError, ValueError) as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(0.5 * (2**attempt))
    raise RuntimeError(f"Unable to fetch {url}: {last_error}")


def fetch_json(url: str) -> tuple[dict[str, Any], bytes]:
    payload = fetch_bytes(url)
    value = json.loads(payload)
    require(isinstance(value, dict), f"Expected JSON object: {url}")
    return value, payload


def safe_asset_path(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    require(
        value and not path.is_absolute() and ".." not in path.parts,
        f"Unsafe asset path: {value}",
    )
    return path


def join_url(base_url: str, relative_path: str) -> str:
    path = safe_asset_path(relative_path)
    return f"{base_url.rstrip('/')}/{path.as_posix()}"


def chunk_set_sha256(chunks: list[dict[str, Any]]) -> str:
    canonical = "".join(
        f"{chunk['sha256']}  {PurePosixPath(chunk['url']).name}\n"
        for chunk in sorted(chunks, key=lambda item: PurePosixPath(item["url"]).name)
    )
    return sha256_bytes(canonical.encode("utf-8"))


def surface_set_sha256(rows: list[dict[str, Any]]) -> str:
    canonical = "".join(
        (
            f"{row['id']}  {row['version']}  {row['manifestSha256']}  "
            f"{row['chunkSetSha256']}\n"
        )
        for row in sorted(rows, key=lambda item: item["id"])
    )
    return sha256_bytes(canonical.encode("utf-8"))


def target_profile(source_profile: str, source_scale: float) -> tuple[str, str, float]:
    target_scale = round(source_scale * LINEAR_SCALE, 4)
    if source_profile == "urban-50" and math.isclose(source_scale, 0.5):
        return "discover-native-40", "40% z19 Discover derivative", target_scale
    if source_profile == "sparse-40" and math.isclose(source_scale, 0.4):
        return "discover-native-32", "32% z19 Discover derivative", target_scale
    if source_profile == "overview-25" and math.isclose(source_scale, 0.25):
        return (
            "discover-overview-20",
            "20% z19 zoom-14 Discover derivative",
            target_scale,
        )
    raise ValueError(
        f"Unsupported derivative source profile: {source_profile} at {source_scale}"
    )


def target_chunk_size(chunk: dict[str, Any], retained_scale: float) -> tuple[int, int]:
    left, top, right, bottom = chunk["worldPixelBounds"]
    width = round((right - left) * retained_scale)
    height = round((bottom - top) * retained_scale)
    require(width > 0 and height > 0, f"Invalid target dimensions for {chunk['id']}")
    return width, height


def existing_chunk_is_reusable(
    target_path: Path,
    existing_chunk: dict[str, Any] | None,
    source_chunk: dict[str, Any],
    target_size: tuple[int, int],
) -> bool:
    if (
        not target_path.is_file()
        or not existing_chunk
        or existing_chunk.get("sourceSha256") != source_chunk.get("sha256")
        or existing_chunk.get("pixelSize") != list(target_size)
        or existing_chunk.get("byteSize") != target_path.stat().st_size
        or existing_chunk.get("sha256") != sha256_file(target_path)
    ):
        return False
    try:
        with Image.open(target_path) as image:
            return image.size == target_size and image.format == "JPEG"
    except OSError:
        return False


def prepare_chunk(
    source_base_url: str,
    surface_base_path: str,
    source_chunk: dict[str, Any],
    retained_scale: float,
    target_root: Path,
    existing_chunk: dict[str, Any] | None,
) -> dict[str, Any]:
    relative_path = safe_asset_path(source_chunk["url"])
    require(relative_path.suffix.lower() in {".jpg", ".jpeg"}, "Chunk is not JPEG")
    target_size = target_chunk_size(source_chunk, retained_scale)
    target_path = target_root.joinpath(*relative_path.parts)

    if existing_chunk_is_reusable(
        target_path,
        existing_chunk,
        source_chunk,
        target_size,
    ):
        return existing_chunk

    source_url = join_url(
        source_base_url,
        f"{surface_base_path.rstrip('/')}/{relative_path.as_posix()}",
    )
    source_bytes = fetch_bytes(source_url)
    require(
        len(source_bytes) == source_chunk["byteSize"],
        f"Source byte-size drift: {source_chunk['id']}",
    )
    require(
        sha256_bytes(source_bytes) == source_chunk["sha256"],
        f"Source hash drift: {source_chunk['id']}",
    )

    with Image.open(io.BytesIO(source_bytes)) as source_image:
        require(
            source_image.size == tuple(source_chunk["pixelSize"]),
            f"Source pixel-size drift: {source_chunk['id']}",
        )
        derivative = source_image.convert("RGB").resize(
            target_size,
            Image.Resampling.LANCZOS,
        )
        target_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = target_path.with_suffix(target_path.suffix + ".part")
        derivative.save(
            temporary_path,
            "JPEG",
            quality=JPEG_QUALITY,
            subsampling=JPEG_SUBSAMPLING,
            optimize=True,
        )
        temporary_path.replace(target_path)

    target_bytes = target_path.stat().st_size
    target_sha256 = sha256_file(target_path)
    return {
        **source_chunk,
        "pixelSize": list(target_size),
        "byteSize": target_bytes,
        "sha256": target_sha256,
        "sourceSha256": source_chunk["sha256"],
    }


def existing_chunks_for_source(
    manifest_path: Path,
    source_manifest_sha256: str,
) -> dict[str, dict[str, Any]]:
    if not manifest_path.is_file():
        return {}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    derivative = manifest.get("source", {}).get("derivative", {})
    if derivative.get("sourceManifestSha256") != source_manifest_sha256:
        return {}
    return {
        chunk["id"]: chunk
        for chunk in manifest.get("chunks", [])
        if isinstance(chunk, dict) and isinstance(chunk.get("id"), str)
    }


def prepare_surface(
    *,
    source_base_url: str,
    source_index: dict[str, Any],
    source_index_sha256: str,
    source_entry: dict[str, Any],
    output_collection_root: Path,
    workers: int,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    surface_id = source_entry["id"]
    manifest_path = safe_asset_path(source_entry["manifestPath"])
    source_manifest, source_manifest_bytes = fetch_json(
        join_url(source_base_url, manifest_path.as_posix())
    )
    source_manifest_sha256 = sha256_bytes(source_manifest_bytes)
    require(source_manifest_sha256 == source_entry["manifestSha256"], f"{surface_id} manifest hash drift")
    require(source_manifest.get("map", {}).get("id") == surface_id, f"{surface_id} identity drift")
    require(
        source_manifest.get("map", {}).get("style", "default")
        == source_index["collection"].get("style", "default"),
        f"{surface_id} style drift",
    )
    require(
        len(source_manifest.get("chunks", []))
        == source_manifest.get("transport", {}).get("chunkCount"),
        f"{surface_id} chunk-count drift",
    )
    require(
        sum(chunk["byteSize"] for chunk in source_manifest["chunks"])
        == source_manifest["transport"]["totalBytes"],
        f"{surface_id} transport drift",
    )

    source_profile = source_manifest["source"]["profile"]
    source_scale = source_manifest["source"]["retainedScale"]
    profile, profile_label, retained_scale = target_profile(source_profile, source_scale)
    target_surface_root = output_collection_root / "surfaces" / surface_id
    target_manifest_path = target_surface_root / "manifest.json"
    reusable_chunks = existing_chunks_for_source(
        target_manifest_path,
        source_manifest_sha256,
    )

    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        jobs = {
            executor.submit(
                prepare_chunk,
                source_base_url,
                source_entry["assetBasePath"],
                chunk,
                retained_scale,
                target_surface_root,
                reusable_chunks.get(chunk["id"]),
            ): chunk["id"]
            for chunk in source_manifest["chunks"]
        }
        for completed, future in enumerate(as_completed(jobs), start=1):
            result = future.result()
            results[result["id"]] = result
            if completed == 1 or completed % 100 == 0 or completed == len(jobs):
                print(
                    f"{source_index['collection']['style']} {surface_id}: "
                    f"prepared {completed}/{len(jobs)} chunks",
                    flush=True,
                )

    chunks = [results[chunk["id"]] for chunk in source_manifest["chunks"]]
    chunks_sha256 = chunk_set_sha256(chunks)
    total_bytes = sum(chunk["byteSize"] for chunk in chunks)
    column_widths: dict[int, int] = {}
    row_heights: dict[int, int] = {}
    for chunk in chunks:
        width, height = chunk["pixelSize"]
        require(
            column_widths.setdefault(chunk["column"], width) == width,
            f"{surface_id} column width drift",
        )
        require(
            row_heights.setdefault(chunk["row"], height) == height,
            f"{surface_id} row height drift",
        )

    nominal_world_bounds = source_manifest["source"]["worldPixelBounds"]["nominal"]
    retained_dimensions = {
        "nominal": [
            round((nominal_world_bounds[2] - nominal_world_bounds[0]) * retained_scale),
            round((nominal_world_bounds[3] - nominal_world_bounds[1]) * retained_scale),
        ],
        "chunkGrid": [
            sum(column_widths[index] for index in sorted(column_widths)),
            sum(row_heights[index] for index in sorted(row_heights)),
        ],
    }
    style = source_index["collection"].get("style", "default")
    version_style = "-gray" if style == "gray" else ""
    scale_percent = round(retained_scale * 100)
    version = (
        f"{surface_id.lower()}-discover{version_style}-s{scale_percent}-q95-g1-"
        f"{chunks_sha256[:16]}"
    )

    manifest = json.loads(json.dumps(source_manifest))
    manifest["map"]["version"] = version
    manifest["source"]["retainedScale"] = retained_scale
    manifest["source"]["profile"] = profile
    manifest["source"]["profileLabel"] = profile_label
    manifest["source"]["readability"]["rasterResampled"] = True
    manifest["source"]["readability"]["embeddedImageStreamsPreserved"] = False
    manifest["source"]["derivative"] = {
        "edition": DERIVATIVE_EDITION,
        "scope": "discover-only",
        "linearScale": LINEAR_SCALE,
        "resampling": "LANCZOS",
        "sourceProfile": source_profile,
        "sourceRetainedScale": source_scale,
        "sourceManifestSha256": source_manifest_sha256,
        "sourceCollectionManifestSha256": source_index_sha256,
    }
    manifest["retainedPixelDimensions"] = retained_dimensions
    manifest["transport"] = {
        "chunkCount": len(chunks),
        "totalBytes": total_bytes,
    }
    manifest["integrity"]["chunkCount"] = len(chunks)
    manifest["integrity"]["chunkBytes"] = total_bytes
    manifest["integrity"]["chunkSetSha256"] = chunks_sha256
    manifest["integrity"]["chunkSetCanonicalization"] = CHUNK_CANONICALIZATION
    manifest["integrity"]["derivativeSourceManifestSha256"] = source_manifest_sha256
    manifest["integrity"]["derivativeSourceCollectionManifestSha256"] = source_index_sha256
    manifest["chunks"] = chunks

    manifest_meta = write_json(target_manifest_path, manifest)
    entry = json.loads(json.dumps(source_entry))
    entry.update(
        {
            "version": version,
            "profile": profile,
            "retainedScale": retained_scale,
            "retainedPixelDimensions": retained_dimensions["chunkGrid"],
            "chunkCount": len(chunks),
            "totalBytes": total_bytes,
            "chunkSetSha256": chunks_sha256,
            "manifestSha256": manifest_meta["sha256"],
        }
    )
    source_decoded_bytes = sum(
        chunk["pixelSize"][0] * chunk["pixelSize"][1] * 4
        for chunk in source_manifest["chunks"]
    )
    derivative_decoded_bytes = sum(
        chunk["pixelSize"][0] * chunk["pixelSize"][1] * 4
        for chunk in chunks
    )
    evidence = {
        "id": surface_id,
        "style": style,
        "sourceProfile": source_profile,
        "profile": profile,
        "sourceRetainedScale": source_scale,
        "retainedScale": retained_scale,
        "chunkCount": len(chunks),
        "sourceTransportBytes": source_manifest["transport"]["totalBytes"],
        "derivativeTransportBytes": total_bytes,
        "sourceDecodedBytes": source_decoded_bytes,
        "derivativeDecodedBytes": derivative_decoded_bytes,
        "decodedRatio": derivative_decoded_bytes / source_decoded_bytes,
        "sourceManifestSha256": source_manifest_sha256,
        "manifestSha256": manifest_meta["sha256"],
        "chunkSetSha256": chunks_sha256,
    }
    return manifest, entry, evidence


def collection_bounds(manifests: list[dict[str, Any]]) -> list[float]:
    bounds = [manifest["bounds"]["surface"] for manifest in manifests]
    return [
        min(value[0] for value in bounds),
        min(value[1] for value in bounds),
        max(value[2] for value in bounds),
        max(value[3] for value in bounds),
    ]


def prepare_collection(
    tier: str,
    style: str,
    output_root: Path,
    workers: int,
) -> list[dict[str, Any]]:
    source_base_url = SOURCE_ROOTS[(tier, style)]
    source_index, source_index_bytes = fetch_json(f"{source_base_url}/manifest.json")
    source_index_sha256 = sha256_bytes(source_index_bytes)
    require(
        source_index.get("schema") == "carearound.fixed-town-surface-index",
        f"Unexpected {tier}/{style} source schema",
    )
    require(
        source_index.get("collection", {}).get("style", "default") == style,
        f"Unexpected {tier}/{style} source style",
    )
    entries_by_id = {
        entry["id"]: entry for entry in source_index.get("surfaces", [])
    }
    missing = [surface_id for surface_id in SURFACE_IDS[tier] if surface_id not in entries_by_id]
    require(not missing, f"Missing {tier}/{style} surfaces: {', '.join(missing)}")

    output_collection_root = output_root / tier / style
    manifests = []
    entries = []
    evidence = []
    for surface_id in SURFACE_IDS[tier]:
        manifest, entry, surface_evidence = prepare_surface(
            source_base_url=source_base_url,
            source_index=source_index,
            source_index_sha256=source_index_sha256,
            source_entry=entries_by_id[surface_id],
            output_collection_root=output_collection_root,
            workers=workers,
        )
        manifests.append(manifest)
        entries.append(entry)
        evidence.append(surface_evidence)

    set_sha256 = surface_set_sha256(entries)
    index = {
        "schema": "carearound.fixed-town-surface-index",
        "schemaVersion": 1,
        "collection": {
            "id": f"sg-discover-derivative-{tier}",
            "name": f"Singapore Discover {tier.title()} Derivative",
            "style": style,
            "version": f"sg-discover-{tier}-{style}-{set_sha256[:16]}",
        },
        "bounds": {"surface": collection_bounds(manifests)},
        "source": source_index["source"],
        "attribution": source_index["attribution"],
        "transport": {
            "surfaceCount": len(entries),
            "chunkCount": sum(entry["chunkCount"] for entry in entries),
            "totalBytes": sum(entry["totalBytes"] for entry in entries),
        },
        "integrity": {
            "algorithm": "sha256",
            "surfaceSetSha256": set_sha256,
            "sourceCollectionManifestSha256": source_index_sha256,
        },
        "surfaces": entries,
    }
    if "overview" in source_index.get("collection", {}):
        index["collection"]["overview"] = source_index["collection"]["overview"]
    write_json(output_collection_root / "manifest.json", index)
    return evidence


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    output_root = args.output_root.expanduser().resolve()
    require(1 <= args.workers <= 16, "--workers must be between 1 and 16")
    if output_root == DEFAULT_OUTPUT_ROOT.resolve():
        output_root.mkdir(parents=True, exist_ok=True)
    else:
        require(
            output_root != Path.home() and output_root != Path("/"),
            f"Unsafe output root: {output_root}",
        )
        output_root.mkdir(parents=True, exist_ok=True)

    evidence = []
    for tier, style in (
        ("native", "default"),
        ("native", "gray"),
        ("overview", "default"),
        ("overview", "gray"),
    ):
        evidence.extend(prepare_collection(tier, style, output_root, args.workers))

    validation = {
        "schema": "carearound.discover-derivative-pilot-validation",
        "schemaVersion": 1,
        "generatedAt": utc_now(),
        "status": "generated-pending-visual-uat",
        "scope": {
            "tiers": ["native", "overview"],
            "styles": ["default", "gray"],
            "nativeSurfaceIds": list(SURFACE_IDS["native"]),
            "overviewSurfaceIds": list(SURFACE_IDS["overview"]),
        },
        "linearScale": LINEAR_SCALE,
        "expectedDecodedRatio": LINEAR_SCALE**2,
        "surfaces": evidence,
    }
    write_json(output_root / "validation.json", validation)
    print(
        f"Discover derivative pilot prepared at {output_root} "
        f"({len(evidence)} surface/style records)",
        flush=True,
    )


if __name__ == "__main__":
    main()
