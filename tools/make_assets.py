"""Generate optimized logos, the apple-touch icon and the 1200x630 social share image.

Source: assets/logo-master.png (the emblem from the company profile deck).
Usage: python tools/make_assets.py   (needs Pillow)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"
master = Image.open(A / "logo-master.png").convert("RGBA")

# --- Logos ------------------------------------------------------------------
for size, name in ((84, "logo-84.webp"), (480, "logo-480.webp")):
    master.resize((size, size), Image.LANCZOS).save(A / name, "WEBP", quality=88, method=6)
master.resize((320, 320), Image.LANCZOS).save(A / "logo.png", optimize=True)  # fallback / schema logo
bg = Image.new("RGBA", (180, 180), (20, 57, 58, 255))
bg.alpha_composite(master.resize((160, 160), Image.LANCZOS), (10, 10))
bg.convert("RGB").save(A / "apple-touch-icon.png", optimize=True)


# --- Social share image -------------------------------------------------------
def font(names, size):
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


W, H = 1200, 630
img = Image.new("RGB", (W, H))
px = img.load()
for y in range(H):  # diagonal teal gradient
    for x in range(0, W):
        t = (x / W * 0.6 + y / H * 0.4)
        px[x, y] = (int(31 - 18 * t), int(75 - 32 * t), int(76 - 32 * t))

rings = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(rings)
rnd = random.Random(7)
for cx, cy, n in ((900, 330, 11), (1150, 40, 6)):
    for k in range(n):
        rx, ry = 40 + k * 42 + rnd.randint(0, 10), 26 + k * 30 + rnd.randint(0, 8)
        copper = k % 4 == 3
        d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry),
                  outline=(192, 133, 82, 150) if copper else (143, 184, 178, 60), width=3 if copper else 2)
img.paste(rings, (0, 0), rings)

# soft glow behind the emblem
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((700, 130, 1100, 530), fill=(192, 133, 82, 70))
glow = glow.filter(ImageFilter.GaussianBlur(60))
img.paste(glow, (0, 0), glow)
img.paste(master.resize((340, 340), Image.LANCZOS), (730, 145), master.resize((340, 340), Image.LANCZOS))

draw = ImageDraw.Draw(img)
bold = font(["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"], 92)
semi = font(["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"], 50)
mono = font(["consola.ttf", "cour.ttf", "DejaVuSansMono.ttf"], 22)
cream, copper, mist = (244, 242, 238), (192, 133, 82), (143, 184, 178)

draw.text((80, 120), "GEOSPATIAL · IoT · ENVIRONMENTAL ANALYTICS", font=mono, fill=mist)
draw.text((80, 170), "Terra", font=bold, fill=cream)
draw.text((80 + draw.textlength("Terra", font=bold), 170), "INT", font=bold, fill=copper)
draw.text((80, 280), "Transforming Data", font=semi, fill=cream)
draw.text((80, 340), "into Decisions.", font=semi, fill=copper)
draw.line((80, 450, 140, 450), fill=copper, width=3)
draw.text((160, 438), "terraintsystems.com  ·  New Delhi, India", font=mono, fill=mist)

img.save(A / "og-image.png", optimize=True)
for f in ("logo-84.webp", "logo-480.webp", "logo.png", "apple-touch-icon.png", "og-image.png"):
    print(f, (A / f).stat().st_size // 1024, "KB")
