"""Build layered 48px character atlases from permanent project source art."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from PIL import Image


ROOT: Final = Path(__file__).resolve().parents[1]
ASSET_ROOT: Final = ROOT / "assets" / "characters"
LAYER_ROOT: Final = ASSET_ROOT / "layers"
DEFAULT_OUTPUT: Final = ROOT / "public" / "sprites" / "characters"
CONTACT_SHEET: Final = ROOT / "docs" / "character-sprites-contact-sheet.png"
CONTACT_INDEX: Final = ROOT / "docs" / "character-sprites-contact-sheet.json"

MARKERS: Final = {
    "skin": (255, 0, 255, 255),
    "skinShadow": (192, 0, 192, 255),
    "hair": (0, 255, 0, 255),
    "hairShadow": (0, 128, 0, 255),
    "top": (255, 0, 0, 255),
    "topShadow": (128, 0, 0, 255),
    "bottom": (0, 0, 255, 255),
    "bottomShadow": (0, 0, 128, 255),
    "detail": (255, 255, 0, 255),
    "detailShadow": (128, 128, 0, 255),
    "accessory": (255, 128, 0, 255),
    "accessoryShadow": (128, 64, 0, 255),
    "highlight": (255, 255, 255, 255),
    "outline": (32, 0, 32, 255),
}
RESERVED_RGB: Final = {value[:3] for value in MARKERS.values()}


class SpriteValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class SpriteContract:
    frame_width: int
    frame_height: int
    columns: int
    rows: int
    atlas_width: int
    atlas_height: int
    frame_count: int
    directions: tuple[str, ...]
    layer_order: tuple[str, ...]
    anchor_x: int
    anchor_y: int
    max_opaque_width: int
    max_opaque_height: int


@dataclass(frozen=True)
class Appearance:
    layers: dict[str, str]
    palette: dict[str, tuple[int, int, int, int]]


def load_json(path: Path) -> object:
    try:
        with path.open("r", encoding="utf-8") as source:
            return json.load(source)
    except (OSError, json.JSONDecodeError) as error:
        raise SpriteValidationError(f"Cannot read {path.relative_to(ROOT)}: {error}") from error


def require_mapping(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise SpriteValidationError(f"{label} must be a JSON object")
    return value


def require_integer(mapping: dict[str, object], key: str, label: str) -> int:
    value = mapping.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise SpriteValidationError(f"{label}.{key} must be a positive integer")
    return value


def require_nonnegative_integer(mapping: dict[str, object], key: str, label: str) -> int:
    value = mapping.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise SpriteValidationError(f"{label}.{key} must be a non-negative integer")
    return value


def require_string_list(value: object, label: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not value or not all(isinstance(item, str) and item for item in value):
        raise SpriteValidationError(f"{label} must be a non-empty string array")
    if len(value) != len(set(value)):
        raise SpriteValidationError(f"{label} contains duplicates")
    return tuple(value)


def parse_contract() -> SpriteContract:
    source = require_mapping(load_json(ASSET_ROOT / "sprite-contract.json"), "sprite contract")
    frame = require_mapping(source.get("frame"), "sprite contract.frame")
    atlas = require_mapping(source.get("atlas"), "sprite contract.atlas")
    anchor = require_mapping(source.get("anchor"), "sprite contract.anchor")
    bounds = require_mapping(source.get("opaqueBodyBounds"), "sprite contract.opaqueBodyBounds")
    directions = require_string_list(source.get("directions"), "sprite contract.directions")
    layer_order = require_string_list(source.get("layerOrder"), "sprite contract.layerOrder")
    poses = require_mapping(source.get("poses"), "sprite contract.poses")
    expected_poses = {
        "idle": (0, 3),
        "walk": (4, 11),
        "seat": (12, 13),
        "work": (14, 15),
        "give": (16, 17),
        "receive": (18, 19),
        "success": (20, 21),
        "error": (22, 23),
    }
    parsed_poses: dict[str, tuple[int, int]] = {}
    for name, value in poses.items():
        entry = require_mapping(value, f"sprite contract.poses.{name}")
        parsed_poses[name] = (
            require_nonnegative_integer(entry, "start", f"sprite contract.poses.{name}"),
            require_nonnegative_integer(entry, "end", f"sprite contract.poses.{name}"),
        )
    if parsed_poses != expected_poses:
        raise SpriteValidationError(f"Pose ranges changed: {parsed_poses!r}")

    contract = SpriteContract(
        frame_width=require_integer(frame, "width", "sprite contract.frame"),
        frame_height=require_integer(frame, "height", "sprite contract.frame"),
        columns=require_integer(frame, "columns", "sprite contract.frame"),
        rows=require_integer(frame, "rows", "sprite contract.frame"),
        atlas_width=require_integer(atlas, "width", "sprite contract.atlas"),
        atlas_height=require_integer(atlas, "height", "sprite contract.atlas"),
        frame_count=require_integer(atlas, "frames", "sprite contract.atlas"),
        directions=directions,
        layer_order=layer_order,
        anchor_x=require_integer(anchor, "x", "sprite contract.anchor"),
        anchor_y=require_integer(anchor, "y", "sprite contract.anchor"),
        max_opaque_width=require_integer(bounds, "maxWidth", "sprite contract.opaqueBodyBounds"),
        max_opaque_height=require_integer(bounds, "maxHeight", "sprite contract.opaqueBodyBounds"),
    )
    if (contract.frame_width, contract.frame_height, contract.columns, contract.rows) != (48, 48, 24, 4):
        raise SpriteValidationError("Frame contract must stay 48x48, 24 columns, and 4 rows")
    if contract.directions != ("down", "left", "right", "up"):
        raise SpriteValidationError("Direction rows must stay down, left, right, up")
    if (contract.anchor_x, contract.anchor_y) != (24, 46):
        raise SpriteValidationError("Character anchor must stay at x24 y46")
    if contract.atlas_width != contract.frame_width * contract.columns or contract.atlas_height != contract.frame_height * contract.rows:
        raise SpriteValidationError("Atlas dimensions do not match frame grid")
    if contract.frame_count != contract.columns * contract.rows:
        raise SpriteValidationError("Atlas frame count does not match frame grid")
    return contract


def parse_hex_color(value: object, label: str) -> tuple[int, int, int, int]:
    if not isinstance(value, str) or len(value) != 7 or not value.startswith("#"):
        raise SpriteValidationError(f"{label} must use #RRGGBB")
    try:
        return tuple(bytes.fromhex(value[1:])) + (255,)
    except ValueError as error:
        raise SpriteValidationError(f"{label} contains an invalid color") from error


def parse_appearances(contract: SpriteContract) -> dict[str, Appearance]:
    catalog = require_mapping(load_json(ASSET_ROOT / "appearances.json"), "appearance catalog")
    source = require_mapping(catalog.get("appearances"), "appearance catalog.appearances")
    appearances: dict[str, Appearance] = {}
    for key, raw_appearance in source.items():
        appearance = require_mapping(raw_appearance, f"appearance {key}")
        raw_layers = require_mapping(appearance.get("layers"), f"appearance {key}.layers")
        if set(raw_layers) != set(contract.layer_order) or not all(isinstance(value, str) and value for value in raw_layers.values()):
            raise SpriteValidationError(f"Appearance {key} must reference every contract layer once")
        raw_palette = require_mapping(appearance.get("palette"), f"appearance {key}.palette")
        if set(raw_palette) != set(MARKERS):
            missing = sorted(set(MARKERS) - set(raw_palette))
            extra = sorted(set(raw_palette) - set(MARKERS))
            raise SpriteValidationError(f"Appearance {key} palette mismatch; missing={missing}, extra={extra}")
        layers = {layer: raw_layers[layer] for layer in contract.layer_order}
        palette = {name: parse_hex_color(raw_palette[name], f"appearance {key}.palette.{name}") for name in MARKERS}
        if RESERVED_RGB.intersection(color[:3] for color in palette.values()):
            raise SpriteValidationError(f"Appearance {key} palette uses a reserved source marker color")
        appearances[key] = Appearance(layers=layers, palette=palette)
    return appearances


def validate_provenance(appearances: dict[str, Appearance]) -> None:
    source = require_mapping(load_json(LAYER_ROOT / "provenance.json"), "layer provenance")
    if source.get("origin") != "project-original":
        raise SpriteValidationError("Layer provenance must mark source art project-original")
    if source.get("reviewed") is not True or not isinstance(source.get("reviewedBy"), str) or not source.get("reviewedBy"):
        raise SpriteValidationError("Layer provenance must record completed review")
    if source.get("externalSources") != [] or source.get("licenses") != []:
        raise SpriteValidationError("Character layers cannot include downloaded or licensed sources")
    required = set(require_string_list(source.get("requiredAppearances"), "layer provenance.requiredAppearances"))
    actual = set(appearances)
    if actual != required:
        raise SpriteValidationError(f"Known-role coverage mismatch; missing={sorted(required - actual)}, extra={sorted(actual - required)}")
    if "fallback" not in actual:
        raise SpriteValidationError("Appearance catalog must include fallback")
    referenced_layers = {
        (LAYER_ROOT / layer_name / f"{style_name}.png").relative_to(LAYER_ROOT)
        for appearance in appearances.values()
        for layer_name, style_name in appearance.layers.items()
    }
    source_layers = {path.relative_to(LAYER_ROOT) for path in LAYER_ROOT.glob("*/*.png")}
    if referenced_layers != source_layers:
        raise SpriteValidationError(
            f"Layer inventory mismatch; missing={sorted(map(str, referenced_layers - source_layers))}, unused={sorted(map(str, source_layers - referenced_layers))}"
        )


def registry_keys(path: Path, start_marker: str, end_marker: str) -> set[str]:
    source = path.read_text(encoding="utf-8")
    start = source.find(start_marker)
    end = source.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise SpriteValidationError(f"Cannot locate role registry in {path.relative_to(ROOT)}")
    block = source[start:end]
    matches = re.findall(r'^  (?:(?:"([a-z0-9-]+)")|([a-z][a-z0-9-]*)):\s*\{', block, flags=re.MULTILINE)
    keys = {quoted or plain for quoted, plain in matches}
    if not keys:
        raise SpriteValidationError(f"No role keys found in {path.relative_to(ROOT)}")
    return keys


def validate_registry_coverage(appearances: dict[str, Appearance]) -> None:
    agent_keys = registry_keys(ROOT / "src" / "lib" / "agents.ts", "const AGENT_MAP", "// Fallback intern")
    agent_keys.update(("intern", "unknown"))
    identity_keys = registry_keys(
        ROOT / "src" / "lib" / "agent-visual-identity.ts",
        "export const AGENT_VISUAL_IDENTITIES",
        "satisfies Record<string, AgentVisualIdentity>",
    )
    if agent_keys != identity_keys:
        raise SpriteValidationError(
            f"Authoritative role registries disagree; agents-only={sorted(agent_keys - identity_keys)}, identities-only={sorted(identity_keys - agent_keys)}"
        )
    appearance_keys = set(appearances) - {"fallback"}
    if appearance_keys != agent_keys:
        raise SpriteValidationError(
            f"Known-role appearance coverage mismatch; missing={sorted(agent_keys - appearance_keys)}, extra={sorted(appearance_keys - agent_keys)}"
        )


def index_source(layer: Image.Image, source_path: Path, contract: SpriteContract) -> Image.Image:
    if layer.mode != "RGBA":
        raise SpriteValidationError(f"Layer {source_path.relative_to(ROOT)} must be RGBA, got {layer.mode}")
    if layer.size != (contract.atlas_width, contract.atlas_height):
        raise SpriteValidationError(f"Layer {source_path.relative_to(ROOT)} must be {contract.atlas_width}x{contract.atlas_height}, got {layer.size}")
    marker_indexes = {color: index for index, color in enumerate(MARKERS.values(), start=1)}
    rgba = layer.tobytes()
    indexes = bytearray(layer.width * layer.height)
    has_opaque_pixel = False
    for pixel_index, offset in enumerate(range(0, len(rgba), 4)):
        opacity = rgba[offset + 3]
        if opacity == 0:
            continue
        if opacity != 255:
            raise SpriteValidationError(f"Layer {source_path.relative_to(ROOT)} must use binary alpha")
        color = (rgba[offset], rgba[offset + 1], rgba[offset + 2], opacity)
        marker_index = marker_indexes.get(color)
        if marker_index is None:
            raise SpriteValidationError(f"Layer {source_path.relative_to(ROOT)} contains undeclared source color {color}")
        indexes[pixel_index] = marker_index
        has_opaque_pixel = True
    if not has_opaque_pixel:
        raise SpriteValidationError(f"Layer {source_path.relative_to(ROOT)} must not be empty")
    return Image.frombytes("P", layer.size, bytes(indexes))


def recolor(indexed_layer: Image.Image, palette: dict[str, tuple[int, int, int, int]]) -> Image.Image:
    palette_bytes = [0, 0, 0]
    for name in MARKERS:
        palette_bytes.extend(palette[name][:3])
    palette_bytes.extend([0] * (768 - len(palette_bytes)))
    colored = indexed_layer.copy()
    colored.putpalette(palette_bytes)
    colored.info["transparency"] = bytes([0] + [255] * 255)
    return colored.convert("RGBA")


def load_recolored_layer(
    layer_name: str,
    style_name: str,
    palette: dict[str, tuple[int, int, int, int]],
    contract: SpriteContract,
    cache: dict[tuple[str, str, tuple[tuple[str, tuple[int, int, int, int]], ...]], Image.Image],
    source_cache: dict[tuple[str, str], Image.Image],
) -> Image.Image:
    cache_key = (layer_name, style_name, tuple(palette.items()))
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    source_key = (layer_name, style_name)
    indexed_source = source_cache.get(source_key)
    if indexed_source is None:
        source_path = LAYER_ROOT / layer_name / f"{style_name}.png"
        if not source_path.is_file():
            raise SpriteValidationError(f"Missing referenced layer {source_path.relative_to(ROOT)}")
        with Image.open(source_path) as source:
            source.load()
            indexed_source = index_source(source, source_path, contract)
        source_cache[source_key] = indexed_source
    result = recolor(indexed_source, palette)
    cache[cache_key] = result
    return result


def opaque_bounds(frame: Image.Image) -> tuple[int, int, int, int] | None:
    return frame.getchannel("A").getbbox()


def validate_final(atlas: Image.Image, key: str, contract: SpriteContract) -> None:
    if atlas.mode != "RGBA" or atlas.size != (contract.atlas_width, contract.atlas_height):
        raise SpriteValidationError(f"Final atlas {key} violates RGBA atlas dimensions")
    alpha_values = set(atlas.getchannel("A").get_flattened_data())
    if not alpha_values.issubset({0, 255}) or alpha_values != {0, 255}:
        raise SpriteValidationError(f"Final atlas {key} must contain transparent gutters and binary opaque pixels")
    for red, green, blue, opacity in atlas.get_flattened_data():
        if opacity and (red, green, blue) in RESERVED_RGB:
            raise SpriteValidationError(f"Final atlas {key} leaked reserved source marker {(red, green, blue)}")
    seen_frames = 0
    for row in range(contract.rows):
        for column in range(contract.columns):
            frame = atlas.crop((
                column * contract.frame_width,
                row * contract.frame_height,
                (column + 1) * contract.frame_width,
                (row + 1) * contract.frame_height,
            ))
            bounds = opaque_bounds(frame)
            if bounds is None:
                raise SpriteValidationError(f"Final atlas {key} has empty frame row={row} column={column}")
            left, top, right, bottom = bounds
            width = right - left
            height = bottom - top
            if width > contract.max_opaque_width or height > contract.max_opaque_height:
                raise SpriteValidationError(
                    f"Final atlas {key} frame row={row} column={column} has opaque bounds {width}x{height}, max {contract.max_opaque_width}x{contract.max_opaque_height}"
                )
            if bottom - 1 > contract.anchor_y:
                raise SpriteValidationError(f"Final atlas {key} draws below y{contract.anchor_y} anchor")
            seen_frames += 1
    if seen_frames != contract.frame_count:
        raise SpriteValidationError(f"Final atlas {key} has {seen_frames} frames, expected {contract.frame_count}")


def compose_atlas(
    key: str,
    appearance: Appearance,
    contract: SpriteContract,
    cache: dict[tuple[str, str, tuple[tuple[str, tuple[int, int, int, int]], ...]], Image.Image],
    source_cache: dict[tuple[str, str], Image.Image],
    validate: bool = True,
) -> Image.Image:
    atlas = Image.new("RGBA", (contract.atlas_width, contract.atlas_height), (0, 0, 0, 0))
    for layer_name in contract.layer_order:
        atlas.alpha_composite(load_recolored_layer(layer_name, appearance.layers[layer_name], appearance.palette, contract, cache, source_cache))
    if validate:
        validate_final(atlas, key, contract)
    return atlas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=9)


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_contact_sheet(atlases: dict[str, Image.Image], contract: SpriteContract) -> tuple[Image.Image, dict[str, object]]:
    samples = (
        ("down-idle", 0, 0),
        ("side-walk", 2, 6),
        ("down-work", 0, 14),
        ("down-success", 0, 20),
        ("down-error", 0, 22),
    )
    keys = tuple(sorted(atlases))
    sheet = Image.new("RGBA", (len(samples) * contract.frame_width, len(keys) * contract.frame_height), (0, 0, 0, 0))
    for row, key in enumerate(keys):
        atlas = atlases[key]
        for column, (_, direction_row, frame_column) in enumerate(samples):
            sample = atlas.crop((
                frame_column * contract.frame_width,
                direction_row * contract.frame_height,
                (frame_column + 1) * contract.frame_width,
                (direction_row + 1) * contract.frame_height,
            ))
            sheet.alpha_composite(sample, (column * contract.frame_width, row * contract.frame_height))
    index = {
        "frameWidth": contract.frame_width,
        "frameHeight": contract.frame_height,
        "columns": [sample[0] for sample in samples],
        "rows": list(keys),
    }
    return sheet, index


def manifest_bytes(keys: tuple[str, ...], contract: SpriteContract, digests: dict[str, str]) -> bytes:
    character_meta = {
        key: {
            "path": f"/sprites/characters/{key}.png",
            "width": contract.atlas_width,
            "height": contract.atlas_height,
            "frames": contract.frame_count,
            "frameWidth": contract.frame_width,
            "frameHeight": contract.frame_height,
            "anchor": {"x": contract.anchor_x, "y": contract.anchor_y},
            "sha256": digests[key],
        }
        for key in keys
    }
    manifest = {
        "version": 1,
        "fallbackKey": "fallback",
        "directions": list(contract.directions),
        "characters": character_meta,
    }
    return (json.dumps(manifest, indent=2, ensure_ascii=True) + "\n").encode("utf-8")


def index_bytes(index: dict[str, object]) -> bytes:
    return (json.dumps(index, indent=2, ensure_ascii=True) + "\n").encode("utf-8")


def generate(output: Path) -> tuple[dict[str, Path], Path, Path]:
    contract = parse_contract()
    appearances = parse_appearances(contract)
    validate_provenance(appearances)
    validate_registry_coverage(appearances)
    output.mkdir(parents=True, exist_ok=True)
    cache: dict[tuple[str, str, tuple[tuple[str, tuple[int, int, int, int]], ...]], Image.Image] = {}
    source_cache: dict[tuple[str, str], Image.Image] = {}
    atlases: dict[str, Image.Image] = {}
    output_files: dict[str, Path] = {}
    digests: dict[str, str] = {}
    for key in sorted(appearances):
        atlas = compose_atlas(key, appearances[key], contract, cache, source_cache)
        repeated = compose_atlas(key, appearances[key], contract, cache, source_cache, validate=False)
        if hashlib.sha256(atlas.tobytes()).digest() != hashlib.sha256(repeated.tobytes()).digest():
            raise SpriteValidationError(f"Atlas composition is not deterministic for {key}")
        destination = output / f"{key}.png"
        save_png(atlas, destination)
        atlases[key] = atlas
        output_files[key] = destination
        digests[key] = file_digest(destination)
    manifest_path = output / "manifest.json"
    manifest_path.write_bytes(manifest_bytes(tuple(sorted(appearances)), contract, digests))
    contact, index = build_contact_sheet(atlases, contract)
    contact_path = output / "contact-sheet.png"
    index_path = output / "contact-sheet.json"
    save_png(contact, contact_path)
    index_path.write_bytes(index_bytes(index))
    return output_files, contact_path, index_path


def compare_file(expected: Path, actual: Path) -> None:
    if not actual.is_file():
        raise SpriteValidationError(f"Missing committed output {actual.relative_to(ROOT)}")
    if expected.read_bytes() != actual.read_bytes():
        raise SpriteValidationError(
            f"Committed output {actual.relative_to(ROOT)} is stale; expected sha256={file_digest(expected)}, actual sha256={file_digest(actual)}"
        )


def check_committed_outputs() -> None:
    with tempfile.TemporaryDirectory(prefix="pixel-office-sprites-") as temporary:
        temporary_output = Path(temporary)
        output_files, contact_path, index_path = generate(temporary_output)
        for key, expected in output_files.items():
            compare_file(expected, DEFAULT_OUTPUT / f"{key}.png")
        expected_names = {f"{key}.png" for key in output_files} | {"manifest.json"}
        actual_names = {path.name for path in DEFAULT_OUTPUT.iterdir() if path.is_file()}
        if actual_names != expected_names:
            raise SpriteValidationError(
                f"Committed character output inventory mismatch; missing={sorted(expected_names - actual_names)}, extra={sorted(actual_names - expected_names)}"
            )
        compare_file(temporary_output / "manifest.json", DEFAULT_OUTPUT / "manifest.json")
        compare_file(contact_path, CONTACT_SHEET)
        compare_file(index_path, CONTACT_INDEX)
    print(f"Sprite outputs verified: {len(output_files)} atlases, 96 frames each, deterministic RGBA")


def write_outputs(output: Path, custom_output: bool) -> None:
    output_files, generated_contact, generated_index = generate(output)
    if not custom_output:
        CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(generated_contact, CONTACT_SHEET)
        shutil.copyfile(generated_index, CONTACT_INDEX)
        generated_contact.unlink()
        generated_index.unlink()
    total_bytes = sum(path.stat().st_size for path in output_files.values())
    print(f"Generated {len(output_files)} character atlases in {output}")
    print(f"Atlas bytes: {total_bytes}; contract: 1152x192, 96 frames, RGBA")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Validate committed output without changing it")
    mode.add_argument("--output", type=Path, help="Write all generated files to another directory")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.check:
            check_committed_outputs()
        else:
            output = args.output.resolve() if args.output else DEFAULT_OUTPUT
            write_outputs(output, custom_output=args.output is not None)
    except SpriteValidationError as error:
        print(f"Sprite validation failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
