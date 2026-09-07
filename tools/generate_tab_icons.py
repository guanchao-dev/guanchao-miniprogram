from pathlib import Path

from PIL import Image, ImageDraw


SIZE = 81
SCALE = 4
OUT = Path(__file__).resolve().parents[1] / "assets" / "tab"

INK = "#7F8B99"
BLACK = "#17212B"
BLUE = "#087CFF"
CYAN = "#00C8D7"
YELLOW = "#FFD438"


def canvas():
    image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def points(values):
    return [(x * SCALE, y * SCALE) for x, y in values]


def line(draw, values, fill, width=5):
    draw.line(points(values), fill=fill, width=width * SCALE, joint="curve")


def polygon(draw, values, fill, outline=None, width=0):
    draw.polygon(points(values), fill=fill)
    if outline and width:
        line(draw, [*values, values[0]], outline, width)


def ellipse(draw, box, fill=None, outline=None, width=1):
    draw.ellipse(
        tuple(value * SCALE for value in box),
        fill=fill,
        outline=outline,
        width=width * SCALE,
    )


def save(image, name):
    image.resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(
        OUT / name, optimize=True
    )


def home(active):
    image, draw = canvas()
    stroke = BLACK if active else INK
    body = BLUE if active else None
    roof = [(17, 39), (40.5, 16), (64, 39)]
    house = [(21, 36), (21, 65), (60, 65), (60, 36)]

    if active:
        polygon(draw, house, body)
        polygon(draw, roof, CYAN)
        polygon(draw, [(34, 48), (47, 48), (47, 65), (34, 65)], YELLOW)

    line(draw, roof, stroke)
    line(draw, [(21, 38), (21, 65), (60, 65), (60, 38)], stroke)
    line(draw, [(34, 65), (34, 48), (47, 48), (47, 65)], stroke, 4)
    save(image, "home-active.png" if active else "home.png")


def achieve(active):
    image, draw = canvas()
    stroke = BLACK if active else INK

    ellipse(draw, (17, 12, 64, 59), fill=BLUE if active else None, outline=stroke, width=5)
    ellipse(draw, (25, 20, 56, 51), fill="#FFFFFF" if active else None, outline=stroke, width=4)

    star = [
        (40.5, 24),
        (45.5, 34),
        (57, 35.5),
        (48.5, 43.5),
        (51, 55),
        (40.5, 49.5),
        (30, 55),
        (32.5, 43.5),
        (24, 35.5),
        (35.5, 34),
    ]
    polygon(draw, star, YELLOW if active else None)
    line(draw, [*star, star[0]], stroke, 3)

    left_ribbon = [(31, 53), (25, 69), (38, 64), (40.5, 52)]
    right_ribbon = [(40.5, 52), (43, 64), (56, 69), (50, 53)]
    if active:
        polygon(draw, left_ribbon, CYAN)
        polygon(draw, right_ribbon, CYAN)
    line(draw, [*left_ribbon, left_ribbon[0]], stroke, 3)
    line(draw, [*right_ribbon, right_ribbon[0]], stroke, 3)
    save(image, "achieve-active.png" if active else "achieve.png")


def profile(active):
    image, draw = canvas()
    stroke = BLACK if active else INK

    ellipse(
        draw,
        (29, 12, 52, 35),
        fill=CYAN if active else None,
        outline=stroke,
        width=4,
    )

    shoulders = [
        (15, 68),
        (17, 62),
        (21, 57),
        (27, 53),
        (34, 50),
        (40.5, 49),
        (47, 50),
        (54, 53),
        (60, 57),
        (64, 62),
        (66, 68),
    ]
    if active:
        polygon(draw, [*shoulders, (15, 68)], BLUE)
    line(draw, shoulders, stroke, 4)
    line(draw, [(15, 68), (66, 68)], stroke, 4)
    save(image, "profile-active.png" if active else "profile.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for draw_icon in (home, achieve, profile):
        draw_icon(False)
        draw_icon(True)
