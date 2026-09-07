from PIL import Image
from collections import deque
from pathlib import Path


def clear_bg(path, predicate):
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    visited = [[False] * h for _ in range(w)]
    q = deque()
    starts = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    for x, y in starts:
        if predicate(px[x, y]):
            q.append((x, y))
            visited[x][y] = True
    cleared = 0
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        cleared += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                visited[nx][ny] = True
                if predicate(px[nx, ny]):
                    q.append((nx, ny))
    img.save(path)
    print(f"cleared {cleared} -> {Path(path).name}")


def is_near_white(c, thresh=235, chroma=30):
    r, g, b, a = c
    if a < 8:
        return False
    mn = min(r, g, b)
    mx = max(r, g, b)
    return mn >= thresh and (mx - mn) <= chroma


def is_cream(c):
    r, g, b, a = c
    if a < 8:
        return False
    return r > 238 and g > 228 and b > 215 and abs(r - g) < 22 and abs(g - b) < 28


# 资源根目录：默认取仓库内 assets/，可用环境变量 ASSETS_DIR 覆盖
import os
ASSETS = Path(os.environ.get("ASSETS_DIR", Path(__file__).resolve().parent.parent / "assets"))

files = [
    ASSETS / "profile" / "profile-medal.png",
    ASSETS / "home" / "home-tide.png",
    ASSETS / "home" / "home-calendar.png",
    ASSETS / "home" / "home-fish.png",
    ASSETS / "home" / "home-gear.png",
    ASSETS / "home" / "home-nearby.png",
    ASSETS / "home" / "home-pin.png",
    ASSETS / "home" / "home-quiz1.png",
    ASSETS / "home" / "home-quiz2.png",
    ASSETS / "home" / "home-quiz3.png",
    ASSETS / "home" / "home-search.png",
    ASSETS / "profile" / "profile-booking.png",
    ASSETS / "profile" / "profile-gear.png",
    ASSETS / "profile" / "profile-help.png",
    ASSETS / "profile" / "profile-posts.png",
    ASSETS / "profile" / "profile-records.png",
    ASSETS / "profile" / "profile-remind.png",
    ASSETS / "profile" / "profile-settings.png",
]

for f in files:
    if f.name == "home-tide.png":
        clear_bg(f, is_cream)
    else:
        clear_bg(f, is_near_white)

for f in files[:3]:
    print("check", f.name, Image.open(f).convert("RGBA").getpixel((0, 0)))
