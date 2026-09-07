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


files = [
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-medal.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-tide.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-calendar.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-fish.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-gear.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-nearby.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-pin.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-quiz1.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-quiz2.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-quiz3.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\home\home-search.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-booking.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-gear.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-help.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-posts.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-records.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-remind.png"),
    Path(r"C:\Users\panda\Desktop\sea\assets\profile\profile-settings.png"),
]

for f in files:
    if f.name == "home-tide.png":
        clear_bg(f, is_cream)
    else:
        clear_bg(f, is_near_white)

for f in files[:3]:
    print("check", f.name, Image.open(f).convert("RGBA").getpixel((0, 0)))
