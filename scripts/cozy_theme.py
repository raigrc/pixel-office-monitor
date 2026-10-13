"""Read Cozy Automation Studio theme data for Pillow asset generators."""

import json
from pathlib import Path


THEME_PATH = Path(__file__).resolve().parents[1] / "src" / "lib" / "cozy-theme.json"


def load_cozy_theme():
    """Load canonical theme JSON without importing application code."""
    with THEME_PATH.open(encoding="utf-8") as theme_file:
        theme = json.load(theme_file)
    if not isinstance(theme, dict):
        raise ValueError("Cozy theme root must be an object")
    return theme


def hex_to_rgb(hex_color):
    """Convert a canonical #RRGGBB token to a Pillow RGB tuple."""
    if not isinstance(hex_color, str) or len(hex_color) != 7 or not hex_color.startswith("#"):
        raise ValueError(f"Invalid theme color: {hex_color!r}")
    try:
        return tuple(int(hex_color[index:index + 2], 16) for index in (1, 3, 5))
    except ValueError as error:
        raise ValueError(f"Invalid theme color: {hex_color!r}") from error
