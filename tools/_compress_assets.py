"""压缩小程序包内的图片资源，减小主包体积。

- PNG：量化到 256 色调色板（保留透明），插画类通常能减 60~75%
- JPG：超过 200KB 的降质量重存
- 原图备份到 resources/_backup_assets/（该目录在 packOptions.ignore 里，不会被打包）
- 只有新文件更小（< 原体积 95%）才替换
"""
import io
import os
import shutil

from PIL import Image

SKIP_PARTS = ('resources', '.git', 'docs', 'tools', 'node_modules', 'raw', '_crops',
              'sketch', 'sketch-imgs', 'miniprogram_npm')
BACKUP = os.path.join('resources', '_backup_assets')

saved_png = [0, 0]   # [原总大小, 新总大小]
saved_jpg = [0, 0]


def backup(path):
    dst = os.path.join(BACKUP, path)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        shutil.copy2(path, dst)


def compress_png(path):
    orig = os.path.getsize(path)
    try:
        im = Image.open(path)
        im.load()
    except Exception:
        return
    best = None
    # 方案 A：量化到 256 色（保留 alpha）
    try:
        q = im.convert('RGBA').quantize(colors=256, method=Image.FASTOCTREE)
        buf = io.BytesIO()
        q.save(buf, format='PNG', optimize=True)
        best = buf.getvalue()
    except Exception:
        pass
    # 方案 B：单纯 optimize 重存
    try:
        buf2 = io.BytesIO()
        im.save(buf2, format='PNG', optimize=True)
        data2 = buf2.getvalue()
        if best is None or len(data2) < len(best):
            best = data2
    except Exception:
        pass

    if best is None or len(best) >= orig * 0.95:
        saved_png[0] += orig
        saved_png[1] += orig
        return
    backup(path)
    with open(path, 'wb') as f:
        f.write(best)
    saved_png[0] += orig
    saved_png[1] += len(best)


def compress_jpg(path, max_kb=195):
    orig = os.path.getsize(path)
    if orig <= max_kb * 1024:
        saved_jpg[0] += orig
        saved_jpg[1] += orig
        return
    try:
        im = Image.open(path).convert('RGB')
    except Exception:
        return
    quality = 78
    best = None
    while quality >= 40:
        buf = io.BytesIO()
        im.save(buf, format='JPEG', quality=quality, optimize=True)
        if len(buf.getvalue()) <= max_kb * 1024:
            best = buf.getvalue()
            break
        quality -= 8
    if best is None or len(best) >= orig * 0.95:
        saved_jpg[0] += orig
        saved_jpg[1] += orig
        return
    backup(path)
    with open(path, 'wb') as f:
        f.write(best)
    saved_jpg[0] += orig
    saved_jpg[1] += len(best)


def main():
    for base, dirs, files in os.walk('.'):
        parts = base.replace(os.sep, '/').split('/')
        if any(p in SKIP_PARTS for p in parts):
            continue
        for f in files:
            low = f.lower()
            p = os.path.join(base, f)
            if low.endswith('.png'):
                compress_png(p)
            elif low.endswith(('.jpg', '.jpeg')):
                compress_jpg(p)

    print('PNG: %d KB -> %d KB (省 %d KB)' % (
        saved_png[0] // 1024, saved_png[1] // 1024, (saved_png[0] - saved_png[1]) // 1024))
    print('JPG: %d KB -> %d KB (省 %d KB)' % (
        saved_jpg[0] // 1024, saved_jpg[1] // 1024, (saved_jpg[0] - saved_jpg[1]) // 1024))
    print('原图备份在 %s' % BACKUP)


if __name__ == '__main__':
    main()
