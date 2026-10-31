"""Draw the Unfinished Sun app icon set from its measured geometry (100-unit box, angles clockwise from top)."""
import math, sys
from PIL import Image, ImageDraw

YELLOW, CHARCOAL = (247, 212, 94), (40, 39, 29)
RING_R, RING_W = 18.4, 8.5          # ring centre-line radius and thickness
RING_FROM, RING_TO = 40, 315        # painted arc, clockwise; the opening is 315 -> 40
RAYS = [(0, 19.2), (90, 22.4), (180, 22.4), (270, 22.4), (135, 22.0), (315, 16.6)]  # (angle, inner radius)
RAY_OUT, RAY_W = 32, 5
SS = 4                              # supersampling for smooth edges

def pt(a, r, c, u):
    t = math.radians(a)
    return (c + r * u * math.sin(t), c - r * u * math.cos(t))

def mark(size, fg, bg=None, scale=1.0):
    big = size * SS
    im = Image.new('RGBA', (big, big), bg + (255,) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u, c = big / 100 * scale, big / 2
    ro = (RING_R + RING_W / 2) * u
    d.arc([c - ro, c - ro, c + ro, c + ro], RING_FROM - 90, RING_TO - 90, fill=fg, width=round(RING_W * u))
    for a, rin in RAYS:
        n = math.radians(a + 90)
        ox, oy = RAY_W / 2 * u * math.sin(n), -RAY_W / 2 * u * math.cos(n)
        (x0, y0), (x1, y1) = pt(a, rin, c, u), pt(a, RAY_OUT, c, u)
        d.polygon([(x0 + ox, y0 + oy), (x1 + ox, y1 + oy), (x1 - ox, y1 - oy), (x0 - ox, y0 - oy)], fill=fg)
    return im.resize((size, size), Image.LANCZOS)

out = sys.argv[1] if len(sys.argv) > 1 else "assets/images"
mark(1024, YELLOW, CHARCOAL).convert('RGB').save(f'{out}/icon.png')                 # iOS + default: opaque, OS rounds the corners
mark(1024, YELLOW, scale=.86).save(f'{out}/android-icon-foreground.png')           # inside the adaptive-icon safe zone
mark(1024, (255, 255, 255), scale=.86).save(f'{out}/android-icon-monochrome.png')  # Android 13+ themed icons tint this
mark(512, YELLOW).save(f'{out}/splash-icon.png')                                   # on the charcoal splash background
mark(48, YELLOW, CHARCOAL).save(f'{out}/favicon.png')
print('ok')
