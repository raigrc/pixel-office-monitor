"""
Pixel Office Monitor — Office Tiles & Furniture Generator
Generates 16×16 tiles, furniture, and props for the office scene.
Run: python scripts/generate-office.py
"""
import argparse
import os
from pathlib import Path

from PIL import Image, ImageDraw

from cozy_theme import hex_to_rgb, load_cozy_theme

THEME = load_cozy_theme()


def mix(first, second, second_weight):
    """Blend two canonical theme colors into a deterministic shade."""
    return tuple(
        round(a + (b - a) * second_weight)
        for a, b in zip(first, second)
    )


UI = {key: hex_to_rgb(value) for key, value in THEME["ui"].items()}
SEMANTIC = {key: hex_to_rgb(value) for key, value in THEME["semantic"].items()}
ENVIRONMENT = {key: hex_to_rgb(value) for key, value in THEME["environment"].items()}
SESSION = [hex_to_rgb(value) for value in THEME["sessionPalette"]]

# Office assets derive every hue from the canonical Cozy Automation Studio theme.
C = {
    "bg": UI["canvas"],
    "surface": UI["surface"],
    "raised": UI["raised"],
    "border": UI["border"],
    "text": UI["text"],
    "muted": UI["muted"],
    "dim": UI["dim"],
    "working": SEMANTIC["working"],
    "working_d": mix(SEMANTIC["working"], UI["canvas"], 0.42),
    "typing": SEMANTIC["selection"],
    "accent": SEMANTIC["waiting"],
    "error": SEMANTIC["error"],
    "white": UI["text"],
    "white_s": UI["muted"],
    "skin": mix(ENVIRONMENT["floor"], UI["text"], 0.3),
    "hair_dark": mix(UI["canvas"], UI["raised"], 0.35),
    "hair_brown": mix(ENVIRONMENT["woodDark"], UI["canvas"], 0.28),
    "hair_blond": SEMANTIC["waiting"],
    "yellow": ENVIRONMENT["lamp"],
    "yellow_d": mix(ENVIRONMENT["lamp"], ENVIRONMENT["wood"], 0.25),
    "red": SEMANTIC["error"],
    "blue": SEMANTIC["selection"],
    "blue_l": mix(SEMANTIC["selection"], UI["text"], 0.25),
    "blue_d": mix(SEMANTIC["selection"], UI["canvas"], 0.4),
    "green": SEMANTIC["working"],
    "green_d": mix(SEMANTIC["working"], UI["canvas"], 0.42),
    "purple": SEMANTIC["delegationActive"],
    "purple_d": SEMANTIC["delegationPending"],
    "cyan": ENVIRONMENT["monitorIdle"],
    "metal": ENVIRONMENT["metal"],
    "metal_d": mix(ENVIRONMENT["metal"], UI["canvas"], 0.32),
    "wood": ENVIRONMENT["wood"],
    "wood_d": ENVIRONMENT["woodDark"],
    "wood_l": mix(ENVIRONMENT["wood"], ENVIRONMENT["floor"], 0.25),
    "cream": ENVIRONMENT["floor"],
    "sage": ENVIRONMENT["plant"],
    "terracotta": SESSION[0],
    "black": UI["canvas"],
    "paper": mix(ENVIRONMENT["floor"], UI["text"], 0.45),
    "outline": mix(ENVIRONMENT["woodDark"], UI["canvas"], 0.34),
    "shadow": mix(ENVIRONMENT["floor"], UI["canvas"], 0.38),
    "wall": mix(ENVIRONMENT["floor"], UI["text"], 0.14),
    "wall_side": mix(ENVIRONMENT["floor"], ENVIRONMENT["woodDark"], 0.18),
    "fabric": mix(ENVIRONMENT["plant"], ENVIRONMENT["floor"], 0.28),
    "fabric_dark": mix(ENVIRONMENT["plant"], UI["canvas"], 0.28),
    "trans":      None,
}

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "public" / "sprites" / "office"
OUT = str(DEFAULT_OUT)

def ensure_dirs():
    os.makedirs(OUT, exist_ok=True)

def px(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        if color is None:
            img.putpixel((x, y), (0, 0, 0, 0))
        else:
            img.putpixel((x, y), color + (255,))

def rect(img, x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, color)

def polygon(img, points, color):
    """Draw one hard-edged pixel polygon with integer coordinates."""
    if color is None:
        fill = (0, 0, 0, 0)
    else:
        fill = color + (255,)
    ImageDraw.Draw(img).polygon(points, fill=fill)

def circle(img, cx, cy, r, color):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                px(img, cx + dx, cy + dy, color)

def line(img, x1, y1, x2, y2, color):
    # Bresenham
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)
    sx = 1 if x1 < x2 else -1
    sy = 1 if y1 < y2 else -1
    err = dx - dy
    while True:
        px(img, x1, y1, color)
        if x1 == x2 and y1 == y2:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x1 += sx
        if e2 < dx:
            err += dx
            y1 += sy

def save(img, path):
    img.save(path)
    print(f"  saved {path} ({img.width}x{img.height})")

# ============================================================
# 1. FLOOR TILES — 16×16
# ============================================================
def gen_floor_tile():
    """Warm cream tile with quiet grout and sparse flecks."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 16, C["cream"])
    floor_shadow = mix(C["cream"], C["wood_d"], 0.12)
    floor_highlight = mix(C["cream"], C["white"], 0.2)
    rect(img, 0, 15, 16, 1, floor_shadow)
    rect(img, 15, 0, 1, 16, floor_shadow)
    rect(img, 0, 0, 15, 1, floor_highlight)
    for x, y in [(3, 5), (11, 3), (7, 11), (13, 13)]:
        px(img, x, y, floor_shadow)
    save(img, os.path.join(OUT, "floor.png"))

def gen_wall_north():
    """North wall with a 5px cap and a warm front face."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 1, C["outline"])
    rect(img, 0, 1, 16, 4, C["cream"])
    rect(img, 0, 5, 16, 9, C["wall"])
    rect(img, 0, 5, 16, 1, C["wall_side"])
    rect(img, 0, 13, 16, 1, C["outline"])
    rect(img, 0, 14, 16, 2, C["wood_d"])
    px(img, 7, 8, C["wall_side"])
    save(img, os.path.join(OUT, "wall-north.png"))

def gen_wall_south():
    """South wall with visible inner cap."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 2, C["wood_d"])
    rect(img, 0, 2, 16, 1, C["outline"])
    rect(img, 0, 3, 16, 8, C["wall_side"])
    rect(img, 0, 11, 16, 4, C["cream"])
    rect(img, 0, 15, 16, 1, C["outline"])
    save(img, os.path.join(OUT, "wall-south.png"))

def gen_wall_east():
    """East wall with a bright inward cap and shaded outer face."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 4, 16, C["cream"])
    rect(img, 4, 0, 1, 16, C["outline"])
    rect(img, 5, 0, 10, 16, C["wall_side"])
    rect(img, 15, 0, 1, 16, C["outline"])
    save(img, os.path.join(OUT, "wall-east.png"))

def gen_wall_west():
    """West wall with shaded side face and inward cap."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 1, 16, C["outline"])
    rect(img, 1, 0, 10, 16, C["wall_side"])
    rect(img, 11, 0, 1, 16, C["outline"])
    rect(img, 12, 0, 4, 16, C["cream"])
    save(img, os.path.join(OUT, "wall-west.png"))

def gen_door_closed():
    """Closed door - 16×32"""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    # Floor
    rect(img, 0, 0, 16, 32, C["cream"])
    # Door frame
    rect(img, 2, 0, 12, 32, C["wood_d"])
    rect(img, 4, 2, 8, 28, C["wood"])
    # Door panel
    rect(img, 4, 4, 8, 24, C["wood"])
    # Door handle
    rect(img, 10, 14, 2, 4, C["metal"])
    px(img, 11, 15, C["metal_d"])
    # Hinges
    px(img, 4, 6, C["metal_d"])
    px(img, 4, 24, C["metal_d"])
    # Threshold
    rect(img, 4, 28, 8, 2, C["wood_d"])
    save(img, os.path.join(OUT, "door-closed.png"))

def gen_door_open():
    """Open door - 16×32 (door swung open 90 deg)"""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    # Floor
    rect(img, 0, 0, 16, 32, C["cream"])
    # Door frame
    rect(img, 2, 0, 12, 32, C["wood_d"])
    # Door swung open - shows edge
    rect(img, 4, 4, 2, 24, C["wood"])  # Door edge visible
    # Door handle on edge
    px(img, 5, 15, C["metal"])
    # Hinges
    px(img, 4, 6, C["metal_d"])
    px(img, 4, 24, C["metal_d"])
    # Threshold
    rect(img, 4, 28, 8, 2, C["wood_d"])
    save(img, os.path.join(OUT, "door-open.png"))

def gen_window():
    """Transparent-paned 32×24 window frame for stage-colored glass."""
    img = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    rect(img, 1, 0, 30, 2, C["outline"])
    rect(img, 0, 2, 32, 18, C["wood_d"])
    rect(img, 3, 4, 26, 13, C["trans"])
    rect(img, 15, 4, 2, 13, C["wood_d"])
    rect(img, 3, 10, 26, 2, C["wood_d"])
    rect(img, 1, 18, 30, 2, C["outline"])
    polygon(img, [(0, 20), (28, 20), (32, 23), (4, 23)], C["wood_l"])
    rect(img, 4, 23, 28, 1, C["outline"])
    save(img, os.path.join(OUT, "window.png"))

def gen_partition():
    """Angled acoustic partition with a visible top cap."""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    polygon(img, [(0, 4), (12, 0), (16, 3), (4, 7)], C["wood_l"])
    line(img, 0, 4, 12, 0, C["outline"])
    rect(img, 0, 5, 4, 25, C["fabric_dark"])
    polygon(img, [(4, 7), (16, 3), (16, 27), (4, 31)], C["fabric"])
    line(img, 4, 7, 16, 3, C["outline"])
    line(img, 4, 31, 16, 27, C["outline"])
    save(img, os.path.join(OUT, "partition.png"))

# ============================================================
# 2. FURNITURE — various sizes
# ============================================================
def gen_desk_rear():
    """Layer behind actor: cubicle shell, desktop, notes, chair, and shadow."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    # Southeast footprint shadow, kept inside the shared 64px contract.
    polygon(img, [(8, 36), (58, 36), (64, 42), (64, 59), (14, 59), (8, 53)], C["shadow"])

    # Warm back wall and acoustic side dividers. Verticals remain vertical.
    rect(img, 3, 7, 56, 22, C["outline"])
    rect(img, 5, 9, 52, 18, C["wall"])
    polygon(img, [(3, 7), (8, 3), (61, 3), (57, 7)], C["cream"])
    line(img, 8, 3, 61, 3, C["outline"])
    rect(img, 1, 9, 6, 39, C["fabric_dark"])
    polygon(img, [(1, 9), (5, 5), (10, 8), (7, 12)], C["wood_l"])
    rect(img, 2, 12, 4, 34, C["fabric"])
    rect(img, 57, 9, 6, 39, C["fabric_dark"])
    polygon(img, [(57, 9), (61, 5), (64, 7), (60, 12)], C["wood_l"])
    rect(img, 58, 12, 4, 34, C["fabric"])

    # Shelf, books, and pinned notes turn each cubicle into a tiny room.
    rect(img, 10, 12, 18, 2, C["outline"])
    polygon(img, [(10, 10), (27, 10), (30, 12), (13, 12)], C["wood_l"])
    rect(img, 13, 6, 3, 4, C["sage"])
    rect(img, 17, 5, 3, 5, C["terracotta"])
    rect(img, 21, 7, 4, 3, C["paper"])
    rect(img, 35, 10, 8, 7, C["paper"])
    px(img, 39, 11, C["wood_d"])
    rect(img, 46, 12, 7, 6, C["yellow"])
    px(img, 49, 13, C["outline"])

    # Angled desktop. Dynamic monitor, plant, lamp, and DeskDecor stay separate.
    polygon(img, [(7, 29), (56, 29), (61, 34), (12, 34)], C["outline"])
    polygon(img, [(8, 30), (55, 30), (59, 34), (12, 34)], C["cream"])
    rect(img, 12, 35, 47, 7, C["wood"])
    rect(img, 12, 35, 47, 2, C["wood_l"])
    rect(img, 56, 35, 3, 7, C["wood_d"])
    rect(img, 12, 42, 47, 2, C["outline"])

    # Chair depth stays behind the actor and in front of the desk underside.
    polygon(img, [(23, 44), (37, 44), (42, 49), (28, 49)], C["outline"])
    polygon(img, [(25, 44), (37, 44), (40, 47), (28, 47)], C["fabric"])
    rect(img, 27, 48, 14, 9, C["fabric_dark"])
    rect(img, 29, 49, 10, 6, C["fabric"])
    rect(img, 33, 57, 2, 4, C["metal_d"])
    rect(img, 27, 60, 14, 2, C["outline"])
    px(img, 25, 62, C["outline"])
    px(img, 42, 62, C["outline"])
    
    save(img, os.path.join(OUT, "desk-rear.png"))

def gen_desk_front():
    """Layer in front of actor: thick wood face and recessed nameplate."""
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    polygon(img, [(2, 0), (58, 0), (64, 5), (8, 5)], C["outline"])
    polygon(img, [(3, 1), (57, 1), (61, 4), (8, 4)], C["wood_l"])
    rect(img, 2, 5, 62, 19, C["outline"])
    rect(img, 3, 6, 56, 17, C["wood"])
    rect(img, 59, 6, 5, 17, C["wood_d"])
    rect(img, 3, 21, 61, 3, C["wood_d"])
    # Recessed plate aligns with the existing DOM label at local y=9.
    rect(img, 6, 7, 52, 13, C["outline"])
    rect(img, 8, 9, 48, 9, C["wood_d"])
    rect(img, 9, 10, 46, 1, C["wood_l"])
    rect(img, 12, 24, 52, 3, C["shadow"])
    
    save(img, os.path.join(OUT, "desk-front.png"))

def gen_chair():
    """Compact angled office chair."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    polygon(img, [(2, 2), (11, 0), (14, 3), (5, 5)], C["outline"])
    polygon(img, [(3, 2), (11, 1), (13, 3), (5, 4)], C["fabric"])
    rect(img, 4, 5, 10, 5, C["fabric_dark"])
    polygon(img, [(2, 9), (11, 7), (15, 10), (6, 12)], C["fabric"])
    rect(img, 8, 12, 2, 2, C["metal_d"])
    line(img, 4, 14, 13, 14, C["outline"])
    px(img, 3, 15, C["outline"])
    px(img, 14, 15, C["outline"])
    save(img, os.path.join(OUT, "chair.png"))

def gen_monitor_base():
    """Monitor stand/base - 16×16"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    # Body matches the 16px screen-state overlays. Keeping both assets the
    # same width prevents colored screen pixels from hanging past the bezel.
    rect(img, 0, 0, 16, 10, C["black"])
    rect(img, 1, 1, 14, 8, C["surface"])
    # Stand
    rect(img, 6, 10, 4, 4, C["dim"])
    rect(img, 4, 14, 8, 1, C["dim"])
    save(img, os.path.join(OUT, "monitor-base.png"))

def gen_monitor_screen():
    """Monitor screen states - 16×8 × 3 frames"""
    for state in ["off", "on", "working"]:
        img = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
        # Screen frame
        rect(img, 0, 0, 16, 8, C["border"])
        if state == "off":
            rect(img, 1, 1, 14, 6, C["surface"])
        elif state == "on":
            rect(img, 1, 1, 14, 6, C["surface"])
            rect(img, 2, 2, 12, 4, C["raised"])
        else:  # working
            rect(img, 1, 1, 14, 6, C["surface"])
            rect(img, 2, 2, 12, 4, C["working_d"])
            rect(img, 2, 2, 12, 1, C["working"])
        save(img, os.path.join(OUT, f"monitor-screen-{state}.png"))

def gen_storage():
    """Right-rail storage wall with shallow top and side planes."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    polygon(img, [(2, 5), (40, 0), (47, 5), (9, 10)], C["outline"])
    polygon(img, [(4, 5), (40, 2), (44, 5), (9, 8)], C["wood_l"])
    rect(img, 9, 9, 38, 50, C["outline"])
    rect(img, 10, 10, 32, 48, C["wood"])
    rect(img, 42, 10, 5, 48, C["wood_d"])
    for dy in [13, 34]:
        for dx in [13, 28]:
            rect(img, dx, dy, 12, 17, C["wood_d"])
            rect(img, dx + 2, dy + 2, 8, 13, C["wood_l"])
            px(img, dx + 8, dy + 8, C["metal"])
    rect(img, 7, 58, 40, 3, C["outline"])
    rect(img, 12, 61, 36, 3, C["shadow"])
    save(img, os.path.join(OUT, "storage.png"))

def gen_plant():
    """Office plant - 16×24"""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    # Pot
    rect(img, 3, 18, 10, 6, C["terracotta"])
    rect(img, 4, 18, 8, 5, C["wood_d"])
    # Soil
    rect(img, 4, 18, 8, 1, C["wood_d"])
    # Leaves
    for dy in range(12):
        for dx in range(-3 + dy // 3, 4 - dy // 3):
            if (dx + dy) % 2 == 0:
                px(img, 8 + dx, 17 - dy, C["green"])
                px(img, 8 + dx, 17 - dy, C["green_d"])
    # Highlight leaves
    for dy in range(3):
        for dx in range(-1, 2):
            px(img, 8 + dx, 17 - dy, C["green_l"] if "green_l" in C else C["green"])
    save(img, os.path.join(OUT, "plant.png"))

def gen_lamp():
    """Desk lamp - 8×16"""
    img = Image.new("RGBA", (8, 16), (0, 0, 0, 0))
    # Base
    rect(img, 2, 14, 4, 2, C["metal"])
    # Stem
    rect(img, 3, 4, 2, 10, C["metal"])
    # Shade
    rect(img, 0, 0, 8, 4, C["metal_d"])
    rect(img, 1, 1, 6, 2, C["metal"])
    # Light glow
    rect(img, 1, 6, 6, 2, C["yellow"])
    px(img, 3, 3, C["yellow_d"])
    save(img, os.path.join(OUT, "lamp.png"))

def gen_whiteboard():
    """Low-profile meeting whiteboard - 48×24."""
    img = Image.new("RGBA", (48, 24), (0, 0, 0, 0))
    rect(img, 1, 1, 46, 20, C["outline"])
    rect(img, 3, 3, 42, 16, C["paper"])
    rect(img, 5, 6, 14, 1, C["muted"])
    rect(img, 5, 10, 22, 1, C["sage"])
    rect(img, 29, 6, 12, 8, C["wall_side"])
    rect(img, 31, 8, 8, 1, C["sage"])
    rect(img, 31, 11, 5, 1, C["wood"])
    polygon(img, [(1, 21), (43, 21), (47, 24), (5, 24)], C["metal_d"])
    px(img, 8, 22, C["metal"])
    px(img, 11, 22, C["wood"])
    save(img, os.path.join(OUT, "whiteboard.png"))

def gen_corkboard():
    """Compact task board with restrained status notes - 48×32."""
    img = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    cork = mix(C["wood"], C["cream"], 0.38)
    rect(img, 0, 0, 48, 32, C["wood_d"])
    rect(img, 2, 2, 44, 28, cork)
    for x, y, color in [
        (6, 6, C["paper"]),
        (18, 5, C["cream"]),
        (30, 7, C["wall"]),
        (10, 18, C["sage"]),
        (25, 17, C["paper"]),
    ]:
        rect(img, x, y, 8, 7, color)
        px(img, x + 4, y + 1, C["wood_d"])
    rect(img, 37, 17, 5, 7, C["wood_d"])
    save(img, os.path.join(OUT, "corkboard.png"))

def gen_wall_shelf():
    """Oak utility shelf with papers, books, and one mug - 48×16."""
    img = Image.new("RGBA", (48, 16), (0, 0, 0, 0))
    polygon(img, [(2, 11), (42, 11), (47, 14), (7, 14)], C["outline"])
    polygon(img, [(4, 11), (41, 11), (44, 13), (7, 13)], C["wood_l"])
    rect(img, 7, 5, 9, 6, C["paper"])
    rect(img, 8, 4, 8, 1, C["white"])
    for x, height, color in [(21, 8, C["sage"]), (25, 6, C["terracotta"]), (29, 9, C["blue_d"])]:
        rect(img, x, 11 - height, 3, height, color)
    rect(img, 37, 7, 6, 4, C["cream"])
    rect(img, 42, 8, 2, 2, C["cream"])
    rect(img, 38, 7, 4, 1, C["wood_d"])
    save(img, os.path.join(OUT, "wall-shelf.png"))

def gen_coffee_machine():
    """Coffee machine with a 4px top plane."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    polygon(img, [(1, 4), (11, 0), (15, 3), (5, 7)], C["outline"])
    polygon(img, [(3, 4), (11, 2), (13, 3), (5, 5)], C["metal"])
    rect(img, 4, 6, 11, 16, C["outline"])
    rect(img, 5, 7, 8, 14, C["metal_d"])
    rect(img, 7, 9, 5, 4, C["surface"])
    rect(img, 8, 10, 3, 2, C["cyan"])
    px(img, 6, 15, C["cyan"])
    px(img, 8, 15, C["metal"])
    rect(img, 8, 17, 3, 4, C["cream"])
    rect(img, 5, 21, 10, 2, C["outline"])
    rect(img, 8, 23, 8, 1, C["shadow"])
    save(img, os.path.join(OUT, "coffee-machine.png"))

def gen_coffee_counter():
    """Coffee counter - 48×24."""
    img = Image.new("RGBA", (48, 24), (0, 0, 0, 0))
    polygon(img, [(1, 4), (40, 0), (47, 5), (8, 9)], C["outline"])
    polygon(img, [(3, 4), (39, 2), (44, 5), (8, 7)], C["cream"])
    rect(img, 8, 8, 39, 13, C["wood"])
    rect(img, 9, 9, 31, 11, C["wood_l"])
    rect(img, 40, 8, 7, 13, C["wood_d"])
    rect(img, 13, 11, 10, 7, C["wood_d"])
    rect(img, 26, 11, 10, 7, C["wood_d"])
    rect(img, 12, 21, 36, 3, C["shadow"])
    save(img, os.path.join(OUT, "coffee-counter.png"))

def gen_sofa():
    """Lounge sofa - 48×32."""
    img = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    polygon(img, [(2, 9), (39, 3), (47, 9), (10, 15)], C["outline"])
    polygon(img, [(4, 9), (38, 5), (44, 9), (10, 13)], C["fabric"])
    rect(img, 9, 13, 38, 12, C["outline"])
    rect(img, 11, 14, 30, 9, C["fabric_dark"])
    rect(img, 12, 15, 13, 7, C["fabric"])
    rect(img, 27, 15, 13, 7, C["fabric"])
    rect(img, 41, 13, 6, 12, C["fabric_dark"])
    rect(img, 6, 12, 6, 13, C["fabric_dark"])
    rect(img, 10, 25, 38, 3, C["outline"])
    rect(img, 13, 28, 35, 4, C["shadow"])
    save(img, os.path.join(OUT, "sofa.png"))

def gen_meeting_table():
    """Meeting table - 40×24."""
    img = Image.new("RGBA", (40, 24), (0, 0, 0, 0))
    polygon(img, [(1, 6), (31, 1), (39, 7), (9, 13)], C["outline"])
    polygon(img, [(3, 6), (31, 3), (36, 7), (9, 11)], C["wood_l"])
    rect(img, 9, 12, 30, 5, C["wood"])
    rect(img, 11, 17, 3, 5, C["wood_d"])
    rect(img, 33, 17, 3, 5, C["wood_d"])
    rect(img, 13, 22, 27, 2, C["shadow"])
    save(img, os.path.join(OUT, "meeting-table.png"))

def gen_common_room_furniture():
    img = Image.new("RGBA", (64, 24), (0, 0, 0, 0))
    rect(img, 5, 21, 59, 3, C["shadow"])
    rect(img, 2, 6, 60, 15, C["outline"])
    rect(img, 4, 7, 55, 12, C["wood"])
    for x in [5, 23, 41]:
        rect(img, x, 8, 16, 10, C["wood_l"])
        rect(img, x + 10, 11, 4, 1, C["wood_d"])
    polygon(img, [(0, 4), (58, 1), (63, 5), (4, 8)], C["outline"])
    polygon(img, [(2, 4), (58, 2), (61, 5), (4, 6)], C["cream"])
    rect(img, 9, 1, 10, 3, C["paper"])
    rect(img, 23, 0, 3, 4, C["sage"])
    rect(img, 27, 1, 3, 3, C["terracotta"])
    save(img, os.path.join(OUT, "credenza.png"))

    img = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    rect(img, 8, 20, 24, 3, C["shadow"])
    rect(img, 7, 13, 3, 7, C["wood_d"])
    rect(img, 26, 12, 3, 8, C["wood_d"])
    polygon(img, [(1, 6), (23, 2), (31, 8), (9, 14)], C["outline"])
    polygon(img, [(3, 6), (23, 4), (28, 8), (9, 12)], C["wood_l"])
    rect(img, 10, 5, 8, 4, C["paper"])
    rect(img, 11, 6, 5, 1, C["terracotta"])
    rect(img, 22, 6, 3, 3, C["cream"])
    px(img, 23, 6, C["wood_d"])
    save(img, os.path.join(OUT, "lounge-table.png"))

    img = Image.new("RGBA", (56, 40), (0, 0, 0, 0))
    rect(img, 12, 36, 44, 4, C["shadow"])
    for x in [10, 46]:
        rect(img, x, 24, 4, 12, C["wood_d"])
    polygon(img, [(1, 8), (43, 1), (55, 12), (13, 23)], C["outline"])
    polygon(img, [(3, 8), (43, 3), (52, 12), (13, 21)], C["wood_l"])
    polygon(img, [(13, 23), (55, 12), (55, 18), (13, 29)], C["wood"])
    line(img, 14, 25, 53, 16, C["wood_d"])
    for x, y in [(13, 8), (35, 6), (30, 15)]:
        rect(img, x, y, 9, 4, C["paper"])
        rect(img, x + 2, y + 1, 5, 1, C["metal"])
    rect(img, 25, 10, 4, 3, C["sage"])
    save(img, os.path.join(OUT, "conference-table.png"))


def gen_meeting_chair():
    """Meeting chair - 12×12."""
    img = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    polygon(img, [(1, 3), (8, 0), (11, 3), (4, 6)], C["outline"])
    polygon(img, [(2, 3), (8, 1), (10, 3), (4, 5)], C["fabric"])
    rect(img, 4, 6, 7, 3, C["fabric_dark"])
    px(img, 4, 11, C["outline"])
    px(img, 10, 10, C["outline"])
    save(img, os.path.join(OUT, "meeting-chair.png"))

# ============================================================
# 3. PROPS — various sizes
# ============================================================
def gen_task_folder():
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    rect(img, 0, 1, 8, 7, C["yellow"])
    rect(img, 1, 2, 6, 5, C["paper"])
    rect(img, 1, 2, 6, 1, C["yellow_d"])
    # Tab
    rect(img, 1, 0, 4, 2, C["yellow_d"])
    save(img, os.path.join(OUT, "task-folder.png"))

def gen_task_folder_open():
    img = Image.new("RGBA", (12, 8), (0, 0, 0, 0))
    rect(img, 0, 2, 12, 6, C["yellow"])
    rect(img, 1, 3, 10, 4, C["paper"])
    rect(img, 1, 3, 10, 1, C["yellow_d"])
    rect(img, 1, 0, 10, 2, C["yellow_d"])
    save(img, os.path.join(OUT, "task-folder-open.png"))

def gen_coffee_cup():
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    rect(img, 0, 2, 6, 6, C["white"])
    rect(img, 1, 3, 4, 4, C["cream"])
    px(img, 6, 3, C["wood"])
    px(img, 6, 4, C["wood"])
    # Coffee
    rect(img, 1, 4, 4, 3, mix(C["wood_d"], C["bg"], 0.35))
    # Steam
    px(img, 3, 0, C["white"])
    save(img, os.path.join(OUT, "coffee-cup.png"))

def gen_clipboard():
    img = Image.new("RGBA", (8, 12), (0, 0, 0, 0))
    rect(img, 0, 1, 8, 11, C["yellow"])
    rect(img, 1, 2, 6, 9, C["paper"])
    rect(img, 2, 0, 4, 2, C["metal"])
    px(img, 3, 0, C["metal_d"])
    for y in [4, 6, 8]:
        rect(img, 2, y, 4, 1, C["muted"])
    save(img, os.path.join(OUT, "clipboard.png"))

# ============================================================
# MAIN
# ============================================================
def parse_args():
    parser = argparse.ArgumentParser(description="Generate deterministic 2D office pixel assets")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUT,
        help="Directory receiving generated PNG files",
    )
    return parser.parse_args()


def main():
    global OUT
    args = parse_args()
    OUT = str(args.output.resolve())
    os.makedirs(OUT, exist_ok=True)
    print("Generating office tiles & furniture...")
    
    # Tiles
    gen_floor_tile()
    gen_wall_north()
    gen_wall_south()
    gen_wall_east()
    gen_wall_west()
    gen_door_closed()
    gen_door_open()
    gen_window()
    gen_partition()
    
    # Furniture
    gen_desk_rear()
    gen_desk_front()
    gen_chair()
    gen_monitor_base()
    gen_monitor_screen()
    gen_storage()
    gen_plant()
    gen_lamp()
    gen_whiteboard()
    gen_corkboard()
    gen_wall_shelf()
    gen_coffee_machine()
    gen_coffee_counter()
    gen_sofa()
    gen_meeting_table()
    gen_meeting_chair()
    gen_common_room_furniture()
    
    # Props
    gen_task_folder()
    gen_task_folder_open()
    gen_coffee_cup()
    gen_clipboard()
    
    print(f"\nDone! All assets in {OUT}")

if __name__ == "__main__":
    main()
