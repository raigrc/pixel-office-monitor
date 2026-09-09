"""
Pixel Office Monitor — PNG Asset Generator
Generates all pixel art PNGs for the office revamp.
Uses Pillow. Run: python scripts/generate-assets.py
Palette matches CHAR_TO_HEX from Sprite.tsx.
"""
from PIL import Image, ImageDraw
import os

# === Palette (from Sprite.tsx CHAR_TO_HEX) ===
C = {
    "bg":         (15, 23, 42),       # #0F172A
    "surface":    (30, 41, 59),       # #1E293B
    "raised":     (36, 50, 77),       # #24324D
    "border":     (51, 65, 85),       # #334155
    "text":       (241, 245, 249),    # #F1F5F9
    "muted":      (148, 163, 184),    # #94A3B8
    "dim":        (100, 116, 139),    # #64748B
    "working":    (34, 197, 94),      # #22C55E
    "working_d":  (21, 128, 61),      # #15803D
    "typing":     (59, 130, 246),     # #3B82F6
    "accent":     (249, 115, 22),     # #F97316
    "error":      (239, 68, 68),      # #EF4444
    "white":      (229, 231, 235),    # #E5E7EB (lab coat)
    "white_s":    (203, 213, 225),    # #CBD5E1 (coat shadow)
    "skin":       (245, 208, 169),    # #F5D0A9
    "hair_dark":  (26, 31, 46),       # #1A1F2E
    "hair_brown": (75, 46, 20),       # #4B2E14
    "hair_blond": (251, 191, 36),     # #FBBF24
    "yellow":     (253, 230, 138),    # #FDE68A
    "yellow_d":   (250, 204, 21),     # #FACC15
    "red":        (239, 68, 68),      # #EF4444
    "blue":       (59, 130, 246),     # #3B82F6
    "blue_l":     (96, 165, 250),     # #60A5FA
    "blue_d":     (29, 78, 216),      # #1D4ED8
    "green":      (34, 197, 94),      # #22C55E
    "green_d":    (21, 128, 61),      # #15803D
    "purple":     (139, 92, 246),     # #8B5CF6
    "purple_d":   (91, 33, 182),      # #5B21B6
    "cyan":       (125, 211, 252),    # #7DD3FC
    "metal":      (226, 232, 240),    # #E2E8F0
    "metal_d":    (148, 163, 184),    # #94A3B8
    "wood":       (146, 64, 14),      # #92400E
    "wood_d":     (120, 53, 15),      # #78350F
    "paper":      (254, 243, 199),    # #FEF3C7
    "black":      (15, 23, 42),       # #0F172A
    "headset":    (17, 24, 39),       # #111827
    "laptop":     (55, 65, 81),       # #374151
    "laptop_d":   (31, 41, 55),       # #1F2937
    "hat_yellow": (245, 158, 11),     # #F59E0B
    "hat_d":      (217, 119, 6),      # #D97706
    "trans":      None,               # transparent
}

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sprites")
PROPS = os.path.join(OUT, "props")
MONITORS = os.path.join(OUT, "monitors")

def ensure_dirs():
    for d in [OUT, PROPS, MONITORS]:
        os.makedirs(d, exist_ok=True)

def px(img, x, y, color):
    """Set a single pixel. color = (r,g,b) or None for transparent."""
    if 0 <= x < img.width and 0 <= y < img.height:
        if color is None:
            img.putpixel((x, y), (0, 0, 0, 0))
        else:
            img.putpixel((x, y), color + (255,))

def rect(img, x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, color)

def save(img, path):
    img.save(path)
    print(f"  saved {path} ({img.width}x{img.height})")

# ============================================================
# 1. FLOOR TILE — 32×32 top-down office carpet
# ============================================================
def gen_floor_tile():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    # Base carpet
    rect(img, 0, 0, 32, 32, C["bg"])
    # Tile grid lines (subtle)
    for x in range(32):
        px(img, x, 0, C["border"])
        px(img, x, 31, C["border"])
    for y in range(32):
        px(img, 0, y, C["border"])
        px(img, 31, y, C["border"])
    # Inner carpet texture — subtle dots
    for y in range(1, 31):
        for x in range(1, 31):
            if (x + y) % 8 == 0:
                px(img, x, y, C["surface"])
            elif (x * 3 + y * 7) % 16 == 0:
                px(img, x, y, C["raised"])
    # Corner accent dots
    for cx, cy in [(4, 4), (28, 4), (4, 28), (28, 28)]:
        px(img, cx, cy, C["dim"])
    save(img, os.path.join(OUT, "floor-tile.png"))

# ============================================================
# 2. WALL TILE — 32×32 top-down wall segment
# ============================================================
def gen_wall_tile():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    # Wall body
    rect(img, 0, 0, 32, 32, C["surface"])
    # Top edge (wall face)
    rect(img, 0, 0, 32, 4, C["border"])
    # Baseboard
    rect(img, 0, 28, 32, 4, C["bg"])
    rect(img, 0, 27, 32, 1, C["dim"])
    # Wall texture — vertical lines
    for x in range(0, 32, 8):
        for y in range(4, 27):
            px(img, x, y, C["raised"])
    # Top highlight
    rect(img, 0, 0, 32, 1, C["dim"])
    save(img, os.path.join(OUT, "wall-tile.png"))

# ============================================================
# 3. DOOR TILE — 32×32 pixel art door (top-down with angle)
# ============================================================
def gen_door_tile():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    # Floor underneath
    rect(img, 0, 0, 32, 32, C["bg"])
    # Door frame
    rect(img, 4, 0, 24, 32, C["dim"])
    rect(img, 6, 2, 20, 28, C["surface"])
    # Door panel
    rect(img, 8, 4, 16, 24, C["border"])
    # Door handle
    rect(img, 20, 14, 2, 4, C["metal"])
    px(img, 21, 15, C["metal_d"])
    # Door hinge hints
    px(img, 8, 6, C["metal_d"])
    px(img, 8, 24, C["metal_d"])
    # Threshold
    rect(img, 6, 28, 20, 2, C["dim"])
    save(img, os.path.join(OUT, "door-tile.png"))

# ============================================================
# 4. CUBICLE FRAME — 64×64 top-down with 3/4 angle
# ============================================================
def gen_cubicle_frame(working=False):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    wc = C["working"] if working else C["border"]
    wc_d = C["working_d"] if working else C["dim"]

    # === Partition walls (left + right) ===
    rect(img, 0, 0, 4, 56, C["dim"])     # left wall
    rect(img, 60, 0, 4, 56, C["dim"])    # right wall
    # Wall top edge
    rect(img, 0, 0, 64, 2, C["border"])

    # === Desk surface (top-down, 3/4 angle) ===
    # Desk top face
    rect(img, 6, 28, 52, 16, C["surface"])
    # Desk front face (gives depth)
    rect(img, 6, 44, 52, 6, C["border"])
    # Desk edge highlight
    rect(img, 6, 28, 52, 1, C["dim"])
    # Desk shadow
    rect(img, 6, 50, 52, 2, C["bg"])

    # === Monitor (on desk, facing viewer) ===
    # Monitor back
    rect(img, 22, 16, 20, 14, C["black"])
    # Monitor screen
    screen_color = wc if working else C["surface"]
    rect(img, 23, 17, 18, 11, screen_color)
    # Monitor screen content glow
    if working:
        rect(img, 24, 18, 16, 9, C["working_d"])
        # Screen highlight
        rect(img, 24, 18, 16, 1, C["working"])
    else:
        # Dim screen
        rect(img, 24, 18, 16, 1, C["raised"])
    # Monitor stand
    rect(img, 30, 30, 4, 2, C["dim"])
    rect(img, 28, 31, 8, 1, C["dim"])

    # === Chair (behind desk, partially visible) ===
    # Chair back
    rect(img, 24, 52, 16, 6, C["raised"])
    rect(img, 26, 52, 12, 2, C["border"])
    # Chair seat
    rect(img, 26, 56, 12, 4, C["border"])
    # Chair wheels
    px(img, 24, 60, C["dim"])
    px(img, 30, 60, C["dim"])
    px(img, 34, 60, C["dim"])
    px(img, 40, 60, C["dim"])

    # === Working glow effect ===
    if working:
        # Green glow around monitor
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if dx == 0 and dy == 0:
                    continue
                # Subtle glow pixels around screen
                x, y = 22 + dx, 16 + dy
                if 0 <= x < 64 and 0 <= y < 64:
                    existing = img.getpixel((x, y))
                    if existing[3] > 0:
                        # Blend green glow
                        r = min(255, existing[0] // 2 + C["working"][0] // 2)
                        g = min(255, existing[1] // 2 + C["working"][1] // 2)
                        b = min(255, existing[2] // 2 + C["working"][2] // 2)
                        px(img, x, y, (r, g, b))

    suffix = "working" if working else "idle"
    save(img, os.path.join(OUT, f"cubicle-{suffix}.png"))

# ============================================================
# 5. DESK PROPS — 16×16 or 24×24 per agent
# ============================================================
def gen_props():
    # --- server-rack.png (24×16) ---
    img = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
    rect(img, 2, 0, 20, 16, C["border"])      # rack body
    rect(img, 3, 1, 18, 14, C["surface"])     # rack inner
    # Rack units
    for y in [2, 5, 8, 11]:
        rect(img, 4, y, 16, 2, C["raised"])
        # LED indicators
        px(img, 18, y, C["working"])
        px(img, 18, y + 1, C["green_d"])
    # Rack rails
    rect(img, 3, 0, 1, 16, C["dim"])
    rect(img, 20, 0, 1, 16, C["dim"])
    save(img, os.path.join(PROPS, "server-rack.png"))

    # --- neural-orb.png (8×8) ---
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    rect(img, 2, 1, 4, 6, C["green"])
    rect(img, 1, 2, 6, 4, C["green"])
    rect(img, 3, 3, 2, 2, C["white"])         # highlight
    px(img, 2, 2, C["working"])
    px(img, 5, 5, C["green_d"])
    save(img, os.path.join(PROPS, "neural-orb.png"))

    # --- blueprint-scroll.png (16×20) ---
    img = Image.new("RGBA", (16, 20), (0, 0, 0, 0))
    rect(img, 2, 0, 12, 20, C["blue_l"])      # scroll body
    rect(img, 3, 1, 10, 18, C["blue"])        # paper
    # Blueprint lines
    for y in range(3, 18, 3):
        rect(img, 4, y, 8, 1, C["blue_d"])
    # Grid lines
    for x in range(5, 12, 3):
        rect(img, x, 2, 1, 16, C["blue_d"])
    # Scroll rolls top/bottom
    rect(img, 1, 0, 14, 2, C["blue_l"])
    rect(img, 1, 18, 14, 2, C["blue_l"])
    save(img, os.path.join(PROPS, "blueprint-scroll.png"))

    # --- t-square.png (16×4) ---
    img = Image.new("RGBA", (16, 4), (0, 0, 0, 0))
    rect(img, 0, 1, 16, 2, C["metal"])        # ruler body
    rect(img, 0, 0, 16, 1, C["metal_d"])      # top edge
    # Measurement marks
    for x in range(0, 16, 2):
        px(img, x, 0, C["border"])
    save(img, os.path.join(PROPS, "t-square.png"))

    # --- wrench.png (4×16) ---
    img = Image.new("RGBA", (4, 16), (0, 0, 0, 0))
    rect(img, 1, 6, 2, 10, C["metal"])        # handle
    rect(img, 0, 0, 4, 6, C["metal"])         # head
    rect(img, 1, 1, 2, 4, C["surface"])       # jaw opening
    px(img, 0, 0, C["metal_d"])
    px(img, 3, 0, C["metal_d"])
    save(img, os.path.join(PROPS, "wrench.png"))

    # --- cable-coil.png (8×8) ---
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    rect(img, 1, 1, 6, 6, C["dim"])
    rect(img, 2, 2, 4, 4, C["border"])
    rect(img, 3, 3, 2, 2, C["surface"])
    px(img, 0, 3, C["working"])
    px(img, 7, 4, C["typing"])
    save(img, os.path.join(PROPS, "cable-coil.png"))

    # --- headset.png (12×8) ---
    img = Image.new("RGBA", (12, 8), (0, 0, 0, 0))
    # Headband
    rect(img, 2, 0, 8, 2, C["headset"])
    # Ear cups
    rect(img, 0, 2, 3, 4, C["headset"])
    rect(img, 9, 2, 3, 4, C["headset"])
    # Cushions
    rect(img, 1, 3, 1, 2, C["dim"])
    rect(img, 10, 3, 1, 2, C["dim"])
    # Mic boom
    rect(img, 0, 6, 2, 1, C["dim"])
    px(img, 0, 7, C["metal"])
    save(img, os.path.join(PROPS, "headset.png"))

    # --- paper-stack.png (12×12) ---
    img = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    # Stack of papers
    rect(img, 1, 2, 10, 10, C["paper"])
    rect(img, 0, 3, 10, 10, C["white"])
    rect(img, 2, 1, 10, 10, C["paper"])
    # Text lines
    for y in range(4, 11, 2):
        rect(img, 3, y, 6, 1, C["muted"])
    save(img, os.path.join(PROPS, "paper-stack.png"))

    # --- pen.png (2×12) ---
    img = Image.new("RGBA", (2, 12), (0, 0, 0, 0))
    rect(img, 0, 0, 2, 10, C["border"])       # body
    rect(img, 0, 10, 2, 2, C["typing"])       # tip
    px(img, 0, 0, C["metal"])                  # cap
    save(img, os.path.join(PROPS, "pen.png"))

    # --- clipboard.png (8×12) ---
    img = Image.new("RGBA", (8, 12), (0, 0, 0, 0))
    rect(img, 0, 1, 8, 11, C["yellow"])       # board
    rect(img, 1, 2, 6, 9, C["paper"])         # paper
    # Clip
    rect(img, 2, 0, 4, 2, C["metal"])
    px(img, 3, 0, C["metal_d"])
    # Lines
    for y in range(4, 10, 2):
        rect(img, 2, y, 4, 1, C["muted"])
    save(img, os.path.join(PROPS, "clipboard.png"))

    # --- coffee-mug.png (6×8) ---
    img = Image.new("RGBA", (6, 8), (0, 0, 0, 0))
    rect(img, 0, 2, 4, 6, C["wood"])          # mug body
    rect(img, 1, 3, 2, 4, C["wood_d"])        # inner
    # Handle
    px(img, 4, 3, C["wood"])
    px(img, 5, 3, C["wood"])
    px(img, 5, 4, C["wood"])
    px(img, 5, 5, C["wood"])
    px(img, 4, 5, C["wood"])
    # Coffee surface
    rect(img, 1, 3, 2, 1, (60, 30, 10))
    # Steam
    px(img, 1, 0, C["white"])
    px(img, 2, 1, C["white"])
    save(img, os.path.join(PROPS, "coffee-mug.png"))

    # --- magnifier.png (8×8) ---
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    # Lens frame
    rect(img, 1, 0, 5, 5, C["metal"])
    rect(img, 2, 1, 3, 3, C["cyan"])
    px(img, 3, 2, C["white"])                  # highlight
    # Handle
    px(img, 5, 5, C["wood"])
    px(img, 6, 6, C["wood"])
    px(img, 7, 7, C["wood"])
    save(img, os.path.join(PROPS, "magnifier.png"))

    # --- stamp.png (6×8) ---
    img = Image.new("RGBA", (6, 8), (0, 0, 0, 0))
    rect(img, 0, 0, 6, 3, C["error"])         # handle
    rect(img, 1, 3, 4, 2, C["metal"])         # shaft
    rect(img, 0, 5, 6, 3, C["error"])         # stamp face
    rect(img, 1, 6, 4, 1, C["white"])         # ink
    save(img, os.path.join(PROPS, "stamp.png"))

    # --- book-stack.png (12×12) ---
    img = Image.new("RGBA", (12, 12), (0, 0, 0, 0))
    # Stack of books (different colors)
    rect(img, 1, 0, 10, 3, C["purple"])       # book 1
    rect(img, 0, 3, 10, 3, C["blue"])         # book 2
    rect(img, 2, 6, 10, 3, C["green_d"])      # book 3
    rect(img, 1, 9, 10, 3, C["typing"])       # book 4
    # Spines
    for y in [1, 4, 7, 10]:
        px(img, 1, y, C["white"])
    save(img, os.path.join(PROPS, "book-stack.png"))

    # --- globe.png (8×8) ---
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    rect(img, 1, 0, 6, 7, C["typing"])        # globe body
    rect(img, 2, 1, 4, 5, C["blue_l"])        # ocean
    # Continents
    rect(img, 3, 2, 2, 2, C["green"])
    px(img, 2, 4, C["green"])
    px(img, 5, 3, C["green"])
    # Stand
    rect(img, 3, 7, 2, 1, C["metal"])
    save(img, os.path.join(PROPS, "globe.png"))

    # --- padlock.png (6×8) ---
    img = Image.new("RGBA", (6, 8), (0, 0, 0, 0))
    # Shackle
    rect(img, 1, 0, 4, 3, C["metal"])
    rect(img, 2, 0, 2, 2, C["surface"])
    # Body
    rect(img, 0, 3, 6, 5, C["yellow_d"])
    rect(img, 1, 4, 4, 3, C["yellow"])
    # Keyhole
    px(img, 3, 5, C["black"])
    px(img, 3, 6, C["black"])
    save(img, os.path.join(PROPS, "padlock.png"))

    # --- camera.png (8×6) ---
    img = Image.new("RGBA", (8, 6), (0, 0, 0, 0))
    rect(img, 0, 1, 8, 5, C["border"])        # body
    rect(img, 1, 2, 6, 3, C["surface"])       # face
    # Lens
    rect(img, 2, 2, 3, 3, C["headset"])
    rect(img, 3, 3, 1, 1, C["typing"])        # lens glow
    # Flash
    px(img, 6, 2, C["yellow"])
    # Mount
    rect(img, 3, 0, 2, 1, C["dim"])
    save(img, os.path.join(PROPS, "camera.png"))

    # --- laptop.png (12×6) ---
    img = Image.new("RGBA", (12, 6), (0, 0, 0, 0))
    # Screen (tilted back)
    rect(img, 1, 0, 10, 3, C["laptop"])
    rect(img, 2, 0, 8, 2, C["surface"])       # screen
    px(img, 3, 1, C["green"])                  # cursor
    # Base
    rect(img, 0, 3, 12, 3, C["laptop_d"])
    rect(img, 1, 4, 10, 1, C["laptop"])       # keyboard area
    # Keys hint
    for x in range(2, 10, 2):
        px(img, x, 4, C["dim"])
    save(img, os.path.join(PROPS, "laptop.png"))

    # --- hard-hat.png (10×6) ---
    img = Image.new("RGBA", (10, 6), (0, 0, 0, 0))
    rect(img, 1, 0, 8, 4, C["hat_yellow"])    # dome
    rect(img, 0, 3, 10, 2, C["hat_d"])        # brim
    rect(img, 0, 5, 10, 1, C["hat_yellow"])   # brim bottom
    # Highlight
    rect(img, 3, 1, 4, 1, C["yellow"])
    save(img, os.path.join(PROPS, "hard-hat.png"))

    # --- toolbox.png (10×8) ---
    img = Image.new("RGBA", (10, 8), (0, 0, 0, 0))
    rect(img, 0, 2, 10, 6, C["error"])        # box body
    rect(img, 1, 3, 8, 4, C["red"])           # inner
    # Handle
    rect(img, 3, 0, 4, 2, C["metal"])
    rect(img, 4, 0, 2, 1, C["surface"])
    # Latch
    rect(img, 4, 3, 2, 1, C["metal"])
    save(img, os.path.join(PROPS, "toolbox.png"))

    # --- compass.png (8×8) ---
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    # Compass body
    rect(img, 1, 1, 6, 6, C["metal"])
    rect(img, 2, 2, 4, 4, C["paper"])
    # Cardinal points
    px(img, 3, 1, C["error"])                  # N
    px(img, 3, 6, C["border"])                 # S
    px(img, 1, 3, C["border"])                 # W
    px(img, 6, 3, C["border"])                 # E
    # Needle
    px(img, 3, 3, C["error"])
    px(img, 4, 3, C["red"])
    px(img, 3, 4, C["typing"])
    px(img, 4, 4, C["blue"])
    save(img, os.path.join(PROPS, "compass.png"))

    # --- binoculars.png (10×6) ---
    img = Image.new("RGBA", (10, 6), (0, 0, 0, 0))
    # Barrels
    rect(img, 0, 1, 4, 4, C["headset"])
    rect(img, 6, 1, 4, 4, C["headset"])
    # Bridge
    rect(img, 4, 2, 2, 2, C["dim"])
    # Lenses
    rect(img, 0, 2, 2, 2, C["cyan"])
    rect(img, 8, 2, 2, 2, C["cyan"])
    # Highlights
    px(img, 0, 2, C["white"])
    px(img, 8, 2, C["white"])
    save(img, os.path.join(PROPS, "binoculars.png"))

    # --- map.png (12×8) ---
    img = Image.new("RGBA", (12, 8), (0, 0, 0, 0))
    rect(img, 0, 0, 12, 8, C["paper"])        # paper
    # Map lines
    rect(img, 1, 1, 10, 1, C["muted"])
    rect(img, 1, 3, 8, 1, C["muted"])
    rect(img, 1, 5, 10, 1, C["muted"])
    # Route dots
    px(img, 3, 2, C["error"])
    px(img, 7, 4, C["error"])
    px(img, 5, 6, C["working"])
    # Route lines
    rect(img, 3, 2, 4, 1, C["accent"])
    rect(img, 7, 2, 1, 2, C["accent"])
    save(img, os.path.join(PROPS, "map.png"))

# ============================================================
# 6. MONITOR SCREENS — 16×8 per agent
# ============================================================
def gen_monitors():
    screens = {
        "ai-systems": lambda img: _neural_screen(img),
        "architect": lambda img: _blueprint_screen(img),
        "automation-engineer": lambda img: _workflow_screen(img),
        "devops": lambda img: _terminal_screen(img),
        "documentation": lambda img: _doc_screen(img),
        "project-manager": lambda img: _checklist_screen(img),
        "qa-engineer": lambda img: _test_screen(img),
        "researcher": lambda img: _search_screen(img),
        "security-reviewer": lambda img: _shield_screen(img),
        "senior-engineer": lambda img: _code_screen(img),
        "build": lambda img: _build_screen(img),
        "plan": lambda img: _plan_screen(img),
        "general": lambda img: _terminal_screen(img),
        "explore": lambda img: _tree_screen(img),
        "scout": lambda img: _docs_screen(img),
    }
    for name, draw_fn in screens.items():
        img = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
        # Monitor frame
        rect(img, 0, 0, 16, 8, C["border"])
        rect(img, 1, 1, 14, 6, C["surface"])
        draw_fn(img)
        save(img, os.path.join(MONITORS, f"{name}.png"))

def _neural_screen(img):
    """AI Systems — neural network nodes"""
    # Nodes
    px(img, 3, 2, C["working"])
    px(img, 7, 3, C["green"])
    px(img, 11, 2, C["working"])
    px(img, 5, 5, C["green"])
    px(img, 9, 5, C["working"])
    # Connections
    rect(img, 4, 2, 3, 1, C["green_d"])
    rect(img, 8, 2, 3, 1, C["green_d"])
    rect(img, 3, 3, 2, 2, C["green_d"])
    rect(img, 7, 4, 2, 1, C["green_d"])

def _blueprint_screen(img):
    """Architect — blueprint schematic"""
    rect(img, 2, 2, 12, 4, C["blue_d"])
    rect(img, 3, 3, 4, 2, C["blue_l"])
    rect(img, 9, 3, 4, 2, C["blue_l"])
    rect(img, 7, 3, 2, 1, C["typing"])
    # Grid
    for x in range(2, 14, 3):
        px(img, x, 2, C["blue_l"])
        px(img, x, 5, C["blue_l"])

def _workflow_screen(img):
    """Automation — n8n workflow nodes"""
    rect(img, 2, 2, 3, 2, C["accent"])
    rect(img, 7, 2, 3, 2, C["typing"])
    rect(img, 12, 2, 3, 2, C["working"])
    # Arrows
    rect(img, 5, 3, 2, 1, C["muted"])
    rect(img, 10, 3, 2, 1, C["muted"])

def _terminal_screen(img):
    """DevOps/General — terminal with LEDs"""
    # Terminal lines
    for y in [2, 3, 4, 5]:
        w = 8 + (y % 3) * 2
        rect(img, 2, y, min(w, 12), 1, C["green"] if y == 2 else C["muted"])
    # LEDs
    px(img, 13, 2, C["working"])
    px(img, 14, 2, C["green_d"])
    px(img, 13, 4, C["working"])

def _doc_screen(img):
    """Documentation — document text"""
    rect(img, 3, 1, 10, 6, C["paper"])
    for y in range(2, 7, 1):
        w = 6 + (y % 3) * 2
        rect(img, 4, y, min(w, 8), 1, C["muted"])

def _checklist_screen(img):
    """Project Manager — checklist"""
    items = [(2, C["working"]), (3, C["working"]), (4, C["muted"]), (5, C["muted"])]
    for y, color in items:
        px(img, 2, y, C["working"] if color == C["working"] else C["border"])
        rect(img, 4, y, 8, 1, C["muted"])

def _test_screen(img):
    """QA — test results grid"""
    for row in range(2, 6):
        for col in range(2, 14, 2):
            c = C["working"] if (row + col) % 3 != 0 else C["error"]
            px(img, col, row, c)

def _search_screen(img):
    """Researcher — search results"""
    for y in [2, 3, 4, 5]:
        rect(img, 3, y, 10, 1, C["muted"])
    px(img, 2, 2, C["typing"])

def _shield_screen(img):
    """Security — shield status"""
    rect(img, 6, 1, 4, 5, C["typing"])
    rect(img, 7, 2, 2, 3, C["blue_l"])
    px(img, 7, 3, C["working"])
    px(img, 3, 5, C["working"])
    rect(img, 4, 5, 1, 1, C["muted"])

def _code_screen(img):
    """Senior Engineer — code editor"""
    for y in [2, 3, 4, 5]:
        indent = (y % 3) * 2
        rect(img, 2 + indent, y, 4, 1, C["typing"])
        rect(img, 7 + indent, y, 3, 1, C["green"] if y % 2 == 0 else C["purple"])

def _build_screen(img):
    """Build — build status bar"""
    rect(img, 2, 3, 12, 2, C["border"])
    rect(img, 2, 3, 8, 2, C["working"])
    px(img, 11, 3, C["yellow"])
    px(img, 12, 4, C["yellow"])

def _plan_screen(img):
    """Plan — plan outline"""
    rect(img, 3, 2, 10, 4, C["blue_d"])
    rect(img, 4, 3, 3, 1, C["blue_l"])
    rect(img, 4, 5, 5, 1, C["blue_l"])
    rect(img, 8, 3, 4, 1, C["blue_l"])

def _tree_screen(img):
    """Explore — directory tree"""
    # Tree structure
    px(img, 2, 2, C["muted"])
    rect(img, 3, 2, 2, 1, C["muted"])
    px(img, 3, 3, C["muted"])
    rect(img, 4, 3, 3, 1, C["green"])
    px(img, 3, 4, C["muted"])
    rect(img, 4, 4, 4, 1, C["typing"])
    px(img, 3, 5, C["muted"])
    rect(img, 4, 5, 2, 1, C["purple"])

def _docs_screen(img):
    """Scout — external docs"""
    rect(img, 2, 1, 12, 6, C["paper"])
    rect(img, 3, 2, 8, 1, C["border"])
    for y in range(3, 6):
        rect(img, 3, y, 10, 1, C["muted"])

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    ensure_dirs()
    print("Generating pixel art assets...")
    gen_floor_tile()
    gen_wall_tile()
    gen_door_tile()
    gen_cubicle_frame(working=False)
    gen_cubicle_frame(working=True)
    gen_props()
    gen_monitors()
    print(f"\nDone! All assets in {OUT}")
    print(f"  Floor/Wall/Door tiles: {OUT}/*.png")
    print(f"  Cubicle frames: {OUT}/cubicle-*.png")
    print(f"  Desk props: {PROPS}/*.png ({len(os.listdir(PROPS))} files)")
    print(f"  Monitor screens: {MONITORS}/*.png ({len(os.listdir(MONITORS))} files)")
