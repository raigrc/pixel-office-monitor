"""
Pixel Office Monitor — Office Tiles & Furniture Generator
Generates 16×16 tiles, furniture, and props for the office scene.
Run: python scripts/generate-office.py
"""
from PIL import Image, ImageDraw
import os

# Palette (warm modern office)
C = {
    "bg":         (15, 23, 42),       # #0F172A - deep navy
    "surface":    (30, 41, 59),       # #1E293B - dark slate
    "raised":     (36, 50, 77),       # #24324D
    "border":     (51, 65, 85),       # #334155
    "text":       (241, 245, 249),    # #F1F5F9
    "muted":      (148, 163, 184),    # #94A3B8
    "dim":        (100, 116, 139),    # #64748B
    "working":    (34, 197, 94),      # #22C55E - green
    "working_d":  (21, 128, 61),      # #15803D
    "typing":     (59, 130, 246),     # #3B82F6 - blue
    "accent":     (249, 115, 22),     # #F97316 - orange
    "error":      (239, 68, 68),      # #EF4444 - red
    "white":      (229, 231, 235),    # #E5E7EB
    "white_s":    (203, 213, 225),    # #CBD5E1
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
    "wood":       (146, 64, 14),      # #92400E - warm oak
    "wood_d":     (120, 53, 15),      # #78350F
    "wood_l":     (180, 100, 40),     # lighter oak
    "cream":      (245, 239, 228),    # #F5EFE4 - warm cream
    "sage":       (120, 145, 122),    # #78917A - sage green
    "terracotta": (190, 120, 96),     # #BE7860
    "black":      (15, 23, 42),
    "paper":      (254, 243, 199),    # #FEF3C7 - paper yellow
    "trans":      None,
}

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sprites", "office")

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
    """Warm cream carpet with subtle texture"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 16, C["cream"])
    # Subtle carpet texture
    for y in range(16):
        for x in range(16):
            if (x + y * 3) % 7 == 0:
                px(img, x, y, C["surface"])
            elif (x * 2 + y) % 11 == 0:
                px(img, x, y, C["raised"])
    save(img, os.path.join(OUT, "floor.png"))

def gen_wall_north():
    """North wall - vertical facing viewer"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 16, C["surface"])
    # Top edge - wall face
    rect(img, 0, 0, 16, 4, C["cream"])
    # Baseboard
    rect(img, 0, 12, 16, 4, C["wood_d"])
    rect(img, 0, 11, 16, 1, C["dim"])
    # Wall texture - vertical panels
    for x in range(0, 16, 4):
        for y in range(4, 11):
            px(img, x, y, C["raised"])
    # Top highlight
    rect(img, 0, 0, 16, 1, C["cream"])
    save(img, os.path.join(OUT, "wall-north.png"))

def gen_wall_south():
    """South wall - vertical facing away"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 16, C["surface"])
    # Bottom edge
    rect(img, 0, 12, 16, 4, C["cream"])
    rect(img, 0, 11, 16, 1, C["dim"])
    save(img, os.path.join(OUT, "wall-south.png"))

def gen_wall_east():
    """East wall - horizontal facing right"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 16, C["surface"])
    # Right edge
    rect(img, 12, 0, 4, 16, C["cream"])
    rect(img, 11, 0, 1, 16, C["dim"])
    save(img, os.path.join(OUT, "wall-east.png"))

def gen_wall_west():
    """West wall - horizontal facing left"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 16, C["surface"])
    # Left edge
    rect(img, 0, 0, 4, 16, C["cream"])
    rect(img, 3, 0, 1, 16, C["dim"])
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
    """Window - 32×32"""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    # Wall around window
    rect(img, 0, 0, 32, 32, C["surface"])
    # Window frame
    rect(img, 4, 4, 24, 24, C["wood_d"])
    rect(img, 6, 6, 20, 20, C["wood"])
    # Glass panes
    rect(img, 8, 8, 16, 16, C["cyan"])
    # Pane dividers
    rect(img, 15, 8, 2, 16, C["wood_d"])
    rect(img, 8, 15, 16, 2, C["wood_d"])
    # Window sill
    rect(img, 6, 26, 20, 2, C["wood_l"])
    rect(img, 6, 28, 20, 2, C["wood_d"])
    save(img, os.path.join(OUT, "window.png"))

def gen_partition():
    """Acoustic partition - 16×32"""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    rect(img, 0, 0, 16, 32, C["sage"])
    # Fabric texture
    for y in range(32):
        for x in range(16):
            if (x + y * 2) % 5 == 0:
                px(img, x, y, C["sage"])
    # Top cap
    rect(img, 0, 0, 16, 2, C["wood_d"])
    # Bottom base
    rect(img, 0, 30, 16, 2, C["wood_d"])
    save(img, os.path.join(OUT, "partition.png"))

# ============================================================
# 2. FURNITURE — various sizes
# ============================================================
def gen_desk_rear():
    """Desk rear (back of desk) - 64×64"""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    # Partition walls
    rect(img, 0, 0, 4, 56, C["dim"])
    rect(img, 60, 0, 4, 56, C["dim"])
    rect(img, 0, 0, 64, 2, C["border"])
    
    # Desk surface
    rect(img, 6, 28, 52, 16, C["cream"])
    rect(img, 6, 44, 52, 6, C["wood"])
    rect(img, 6, 28, 52, 1, C["wood_l"])
    rect(img, 6, 50, 52, 2, C["dim"])

    # NOTE: no baked monitor here — the dynamic monitor-base + monitor-screen
    # overlay owns those pixels (working/on/off variants). A baked copy would
    # ghost underneath the dynamic one.

    # Chair
    rect(img, 24, 52, 16, 6, C["wood_d"])
    rect(img, 26, 52, 12, 2, C["wood"])
    rect(img, 26, 56, 12, 4, C["wood_d"])
    # Chair wheels
    for wx in [24, 30, 34, 40]:
        px(img, wx, 60, C["dim"])
    
    save(img, os.path.join(OUT, "desk-rear.png"))

def gen_desk_front():
    """Desk front (front edge for depth) - 64×32"""
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    # Desk front face
    rect(img, 0, 0, 64, 24, C["wood"])
    rect(img, 0, 24, 64, 4, C["wood_d"])
    # Desk edge highlight
    rect(img, 0, 0, 64, 1, C["wood_l"])
    # Drawers
    for dx in [8, 24, 40]:
        rect(img, dx, 4, 12, 16, C["wood_d"])
        rect(img, dx + 1, 5, 10, 14, C["wood"])
        # Drawer handle
        rect(img, dx + 5, 11, 2, 2, C["metal"])
    
    save(img, os.path.join(OUT, "desk-front.png"))

def gen_chair():
    """Office chair - 16×16"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    # Chair back
    rect(img, 2, 0, 12, 6, C["wood_d"])
    rect(img, 4, 0, 8, 2, C["wood"])
    # Seat
    rect(img, 2, 6, 12, 4, C["wood"])
    rect(img, 3, 7, 10, 3, C["wood_l"])
    # Wheels
    for wx in [2, 13]:
        px(img, wx, 13, C["dim"])
        px(img, wx, 14, C["dim"])
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
    """Storage cabinet - 32×64"""
    img = Image.new("RGBA", (32, 64), (0, 0, 0, 0))
    # Cabinet body
    rect(img, 2, 0, 28, 60, C["wood"])
    rect(img, 3, 1, 26, 58, C["wood_l"])
    # Top
    rect(img, 0, 0, 32, 2, C["wood_d"])
    # Doors
    for dy in [4, 18, 32, 46]:
        rect(img, 4, dy, 10, 12, C["wood_d"])
        rect(img, 5, dy + 1, 8, 10, C["wood"])
        # Handle
        rect(img, 8, dy + 5, 2, 2, C["metal"])
        rect(img, 18, dy, 10, 12, C["wood_d"])
        rect(img, 19, dy + 1, 8, 10, C["wood"])
        rect(img, 22, dy + 5, 2, 2, C["metal"])
    # Base
    rect(img, 0, 60, 32, 4, C["wood_d"])
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
    """Whiteboard - 48×32"""
    img = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    # Frame
    rect(img, 0, 0, 48, 32, C["wood_d"])
    rect(img, 2, 2, 44, 28, C["white"])
    # Marker lines
    for y in [8, 14, 20]:
        rect(img, 4, y, 40, 1, C["blue"])
    # Marker tray
    rect(img, 4, 28, 20, 2, C["metal_d"])
    px(img, 5, 29, C["blue"])
    px(img, 7, 29, C["red"])
    px(img, 9, 29, C["green"])
    px(img, 11, 29, C["purple"])
    save(img, os.path.join(OUT, "whiteboard.png"))

def gen_coffee_machine():
    """Coffee machine - 16×24"""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    # Body
    rect(img, 2, 4, 12, 18, C["metal"])
    rect(img, 3, 5, 10, 16, C["metal_d"])
    # Water tank
    rect(img, 2, 4, 6, 6, C["surface"])
    rect(img, 3, 5, 4, 4, C["cyan"])
    # Brew head
    rect(img, 8, 4, 6, 4, C["metal"])
    rect(img, 9, 5, 4, 2, C["border"])
    # Buttons
    for dy in [12, 14, 16, 18]:
        px(img, 3, dy, C["working"])
        px(img, 4, dy, C["accent"])
    # Drip tray
    rect(img, 2, 22, 12, 2, C["metal_d"])
    save(img, os.path.join(OUT, "coffee-machine.png"))

def gen_meeting_table():
    """Meeting table - 64×48"""
    img = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
    # Table top
    rect(img, 4, 4, 56, 40, C["wood"])
    rect(img, 5, 5, 54, 38, C["wood_l"])
    rect(img, 5, 5, 54, 1, C["wood_l"])
    # Legs
    for lx, ly in [(6, 6), (52, 6), (6, 36), (52, 36)]:
        rect(img, lx, ly, 4, 4, C["wood_d"])
        rect(img, lx + 1, ly + 1, 2, 2, C["metal"])
    save(img, os.path.join(OUT, "meeting-table.png"))

def gen_meeting_chair():
    """Meeting chair - 16×16 (simpler)"""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rect(img, 3, 0, 10, 6, C["wood"])
    rect(img, 3, 6, 10, 4, C["wood"])
    for wx in [4, 11]:
        px(img, wx, 13, C["dim"])
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
    rect(img, 1, 4, 4, 3, (60, 30, 10))
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
def main():
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
    gen_coffee_machine()
    gen_meeting_table()
    gen_meeting_chair()
    
    # Props
    gen_task_folder()
    gen_task_folder_open()
    gen_coffee_cup()
    gen_clipboard()
    
    print(f"\nDone! All assets in {OUT}")

if __name__ == "__main__":
    main()
