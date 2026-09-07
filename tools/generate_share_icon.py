"""Generate the Lucide Share 2 icon as an antialiased PNG.

Icon design: Lucide Contributors, ISC License
https://github.com/lucide-icons/lucide
"""

from pathlib import Path

from PIL import Image, ImageDraw


SCALE = 4
SIZE = 64
OUT = Path(__file__).resolve().parents[1] / "assets" / "icons" / "share-lucide.png"

image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)


def point(x, y):
    return x * SCALE, y * SCALE


def circle(x, y, radius):
    draw.ellipse(
        (
            (x - radius) * SCALE,
            (y - radius) * SCALE,
            (x + radius) * SCALE,
            (y + radius) * SCALE,
        ),
        outline="#FFFFFF",
        width=4 * SCALE,
    )


draw.line(
    [point(20, 34), point(43, 20)],
    fill="#FFFFFF",
    width=4 * SCALE,
)
draw.line(
    [point(20, 34), point(43, 48)],
    fill="#FFFFFF",
    width=4 * SCALE,
)
circle(15, 34, 6)
circle(49, 16, 6)
circle(49, 52, 6)

OUT.parent.mkdir(parents=True, exist_ok=True)
image.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(OUT, optimize=True)
