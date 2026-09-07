from PIL import Image
from pathlib import Path
import os

# 资源根目录：默认取仓库内 assets/，可用环境变量 ASSETS_DIR 覆盖
ASSETS = Path(os.environ.get("ASSETS_DIR", Path(__file__).resolve().parent.parent / "assets"))

roots = [
    ASSETS / "home",
    ASSETS / "profile",
    ASSETS / "badges",
    ASSETS / "icons",
    ASSETS / "tab",
    ASSETS / "achieve",
]

skip_dirs = {"raw", "sketch", "sketch-imgs", "_crops", "home"}  # assets/icons/home is junk


def compress(path: Path, max_side=512):
    if any(part in skip_dirs for part in path.parts if part == "icons"):
        # only skip assets/icons/home
        if "icons" in path.parts and path.parent.name == "home":
            return
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    # keep transparency
    before = path.stat().st_size
    img.save(path, format="PNG", optimize=True)
    after = path.stat().st_size
    print(f"{path.name}: {before/1024:.0f}KB -> {after/1024:.0f}KB ({img.size[0]}x{img.size[1]})")


for root in roots:
    if not root.exists():
        continue
    for p in root.rglob("*.png"):
        if "icons" in p.parts and p.parent.name == "home":
            continue
        if any(x in p.parts for x in ("raw", "sketch", "sketch-imgs", "_crops")):
            continue
        try:
            side_by_root = {
                "home": 192,
                "profile": 160,
                "badges": 160,
                "icons": 128,
                "tab": 81,
                "achieve": 256,
            }
            side = side_by_root.get(root.name, 256)
            if p.name == "home-hero-mascot.png":
                side = 256
            elif p.name == "home-tide.png":
                side = 384
            compress(p, max_side=side)
        except Exception as e:
            print("fail", p, e)

total = 0
for root in roots:
    for p in root.rglob("*.png"):
        if any(x in p.parts for x in ("raw", "sketch", "sketch-imgs", "_crops")):
            continue
        if "icons" in p.parts and p.parent.name == "home":
            continue
        total += p.stat().st_size
print(f"packed-ish total: {total/1024/1024:.2f} MB")
