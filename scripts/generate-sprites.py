"""
Pixel Office Monitor — Character Sprite Sheet Generator
Generates 32×32 frame sprite sheets for characters.
24 pose frames × 4 directions = 96 frames per character.
Run: python scripts/generate-sprites.py
"""
from PIL import Image, ImageDraw
import os

# Palette
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
    "wood":       (146, 64, 14),      # #92400E
    "wood_d":     (120, 53, 15),      # #78350F
    "paper":      (254, 243, 199),    # #FEF3C7
    "black":      (15, 23, 42),       # #0F172A
    "headset":    (17, 24, 39),       # #111827
    "laptop":     (55, 65, 81),       # #374151
    "laptop_d":   (31, 41, 55),       # #1F2937
    "hat_yellow": (245, 158, 11),     # #F59E0B
    "hat_d":      (217, 119, 6),      # #D97706
    "trans":      None,
}

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sprites", "characters")

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

def save(img, path):
    img.save(path)
    print(f"  saved {path} ({img.width}x{img.height})")

# Character definitions with unique visual traits
CHARACTERS = {
    "orchestrator": {
        "skin": C["skin"],
        "hair": C["hair_dark"],
        "shirt": C["accent"],      # Orange - lead color
        "pants": C["hair_dark"],
        "accessory": "headset",
    },
    "senior-engineer": {
        "skin": C["skin"],
        "hair": C["hair_brown"],
        "shirt": C["typing"],      # Blue - engineer
        "pants": C["hair_dark"],
        "accessory": "laptop",
    },
    "fallback": {
        "skin": C["skin"],
        "hair": C["hair_blond"],
        "shirt": C["muted"],       # Gray - generic
        "pants": C["hair_dark"],
        "accessory": None,
    },
}

# Frame dimensions
FRAME_W = 32
FRAME_H = 32
FRAMES_PER_ROW = 24
POSES = [
    ("idle", 4),      # 4 frames
    ("walk", 8),      # 8 frames (2 per direction)
    ("seat", 2),      # 2 frames
    ("work", 2),      # 2 frames
    ("give", 2),      # 2 frames
    ("receive", 2),   # 2 frames
    ("success", 2),   # 2 frames
    ("error", 2),     # 2 frames
]
DIRECTIONS = ["down", "left", "right", "up"]  # 4 directions

def draw_head(img, cx, cy, skin, hair, direction):
    # Head base (8x8)
    circle(img, cx, cy - 2, 4, skin)
    # Hair
    if direction == "down":
        # Hair on top
        for dx in range(-3, 4):
            for dy in range(-3, 0):
                if dx * dx + dy * dy <= 9:
                    px(img, cx + dx, cy - 4 + dy, hair)
    elif direction == "up":
        for dx in range(-3, 4):
            for dy in range(0, 3):
                if dx * dx + dy * dy <= 9:
                    px(img, cx + dx, cy - 4 + dy, hair)
    elif direction == "left":
        for dx in range(-3, 0):
            for dy in range(-3, 3):
                if dx * dx + dy * dy <= 9:
                    px(img, cx - 4 + dx, cy - 2 + dy, hair)
    else:  # right
        for dx in range(0, 4):
            for dy in range(-3, 3):
                if dx * dx + dy * dy <= 9:
                    px(img, cx + 4 + dx, cy - 2 + dy, hair)
    # Face features (front/side facings only; up shows back of head).
    # hy = vertical center of the head circle.
    hy = cy - 2
    eye = C["hair_dark"]
    if direction == "down":
        px(img, cx - 2, hy, eye)
        px(img, cx + 2, hy, eye)
        px(img, cx, hy + 2, eye)
    elif direction == "left":
        px(img, cx - 2, hy, eye)
    elif direction == "right":
        px(img, cx + 2, hy, eye)

def draw_body(img, cx, cy, shirt, pants, pose, frame, direction, accessory=None):
    # Body geometry (32px frame budget):
    #   head 2-12 (drawn by draw_head), neck, torso, legs 26-30.
    # Torso sits high so shoulders + hands clear the desk occlusion line
    # (character-local row ~20 at seated desks).
    # Work typing: right arm position alternates
    work_arm_shift = 0
    if pose == "work":
        work_arm_shift = 1 if frame == 1 else 0

    # Torso (7x10), raised to connect with the head
    torso_y = cy
    for dy in range(10):
        for dx in range(-3, 4):
            px(img, cx + dx, torso_y + dy, shirt)

    # Neck (bridges head bottom to torso top)
    rect(img, cx - 1, torso_y - 3, 2, 3, C["skin"])

    # Arms
    if pose == "walk":
        # Walking arm swing
        swing = 1 if (frame // 2) % 2 == 0 else -1
        if direction in ["left", "right"]:
            # Arms forward/back
            for dy in range(8):
                px(img, cx - 4 - swing, torso_y + dy, shirt)
                px(img, cx + 4 + swing, torso_y + dy, shirt)
        else:
            for dy in range(8):
                px(img, cx - 4, torso_y + dy + swing, shirt)
                px(img, cx + 4, torso_y + dy - swing, shirt)
    elif pose in ["give", "receive"]:
        # Arms extended
        reach = 4 if pose == "give" else -4
        for dy in range(6):
            px(img, cx + reach, torso_y + 2 + dy, shirt)
    elif pose == "work":
        # Typing pose — sleeves forward, hands ON the laptop (visible rows),
        # right hand shifts for the typing motion.
        for dy in range(6):
            px(img, cx - 3, torso_y + 2 + dy, shirt)
            px(img, cx + 3 + work_arm_shift, torso_y + 2 + dy, shirt)
        # Laptop in front, sunk into the desk line (lower rows hide behind it)
        rect(img, cx - 4, torso_y + 4, 10, 6, C["laptop"])
        screen_color = C["typing"] if work_arm_shift else C["surface"]
        rect(img, cx - 3, torso_y + 5, 8, 3, screen_color)
        # Hands (skin) typing on the laptop
        rect(img, cx - 4, torso_y + 5, 2, 2, C["skin"])
        rect(img, cx + 2 + work_arm_shift, torso_y + 5, 2, 2, C["skin"])
    else:
        # Idle/seat/seat-rest arms at sides, hands tucked low
        for dy in range(8):
            px(img, cx - 4, torso_y + dy, shirt)
            px(img, cx + 4, torso_y + dy, shirt)
        rect(img, cx - 4, torso_y + 8, 2, 2, C["skin"])
        rect(img, cx + 2, torso_y + 8, 2, 2, C["skin"])

    # Belt line between torso and legs (seated only; standing is contiguous)
    if pose in ["seat", "work"]:
        rect(img, cx - 3, torso_y + 10, 6, 2, pants)

    # Legs (rows 26-30, in-frame with a 1px gap)
    leg_y = 26
    if pose in ["seat", "work"]:
        # Seated - bent stub (hidden behind the desk in the office)
        rect(img, cx - 3, leg_y, 6, 4, pants)
    elif pose == "walk":
        # Walking legs
        step = frame % 4
        if step < 2:
            # Left forward
            rect(img, cx - 3, leg_y, 2, 5, pants)
            rect(img, cx + 1, leg_y + 1, 2, 4, pants)
        else:
            # Right forward
            rect(img, cx - 3, leg_y + 1, 2, 4, pants)
            rect(img, cx + 1, leg_y, 2, 5, pants)
    else:
        # Standing
        rect(img, cx - 3, leg_y, 2, 5, pants)
        rect(img, cx + 1, leg_y, 2, 5, pants)

    # Accessories
    if accessory == "headset" and pose != "walk":
        # Headset band across the forehead (above the eyes) + earpieces.
        # cy is already shifted by idle_bob from caller.
        rect(img, cx - 5, cy - 10, 12, 2, C["headset"])
        rect(img, cx - 5, cy - 8, 2, 4, C["headset"])
        rect(img, cx + 3, cy - 8, 2, 4, C["headset"])

def draw_character_frame(char_def, pose, frame, direction):
    """Draw a single 32×32 frame for a character."""
    img = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    cx, cy = 16, 16  # Center pivot (feet at y=30)

    # Idle breathing bob: frames 1 and 3 shift entire character 1px up
    idle_bob = -1 if pose == "idle" and frame in (1, 3) else 0

    # Adjust for pose
    if pose in ["seat", "work"]:
        cy = 14  # Seated higher

    # Draw in order: legs, body, head (for proper layering)
    draw_body(img, cx, cy + idle_bob, char_def["shirt"], char_def["pants"], pose, frame, direction, char_def["accessory"])
    draw_head(img, cx, cy - 6 + idle_bob, char_def["skin"], char_def["hair"], direction)

    # Feet position indicator (for reference)
    px(img, cx, 30, C["border"])

    return img

def generate_character_sprite_sheet(name, char_def):
    """Generate a sprite sheet for one character."""
    # Calculate sheet dimensions: 24 pose frames per row, 4 rows (directions)
    rows = len(DIRECTIONS)
    cols = FRAMES_PER_ROW
    sheet_w = FRAME_W * cols
    sheet_h = FRAME_H * rows
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    
    # For each direction (row)
    for row, direction in enumerate(DIRECTIONS):
        frame_idx = 0
        # For each pose
        for pose_name, frame_count in POSES:
            for f in range(frame_count):
                frame_img = draw_character_frame(char_def, pose_name, f, direction)
                x = frame_idx * FRAME_W
                y = row * FRAME_H
                sheet.paste(frame_img, (x, y))
                frame_idx += 1
        # Fill remaining with idle
        while frame_idx < cols:
            frame_img = draw_character_frame(char_def, "idle", 0, direction)
            x = frame_idx * FRAME_W
            y = row * FRAME_H
            sheet.paste(frame_img, (x, y))
            frame_idx += 1
    
    path = os.path.join(OUT, f"{name}.png")
    save(sheet, path)
    print(f"  Generated {name}.png: {sheet_w}×{sheet_h} ({rows} dirs × {cols} frames)")

def main():
    ensure_dirs()
    print("Generating character sprite sheets...")
    for name, char_def in CHARACTERS.items():
        generate_character_sprite_sheet(name, char_def)
    print(f"\nDone! All character sprites in {OUT}")

if __name__ == "__main__":
    main()
