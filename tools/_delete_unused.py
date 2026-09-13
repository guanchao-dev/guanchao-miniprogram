"""删除未被引用的图片 + assets 下的设计源目录。

保护范围：只删 assets/ 下和 resources/_backup_assets/ 下的文件；
resources/ 里的设计源稿一律不动。
"""
import os
import shutil

# 整目录删除（设计源，不是 app 资源）
DESIGN_DIRS = [
    'assets/sketch',
    'assets/sketch-imgs',
    'assets/raw',
    'assets/_crops',
    'assets/icons/home',
    'resources/_backup_assets',
]

IMAGE_EXT = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')
CODE_EXT = ('.wxml', '.ts', '.js', '.wxss', '.json', '.wxs')
SKIP_DIRS = ('.git', 'node_modules', 'miniprogram_npm')


def code_text():
    chunks = []
    for base, dirs, files in os.walk('.'):
        parts = base.replace(os.sep, '/').split('/')
        if any(p in SKIP_DIRS for p in parts):
            continue
        for f in files:
            if f.lower().endswith(CODE_EXT):
                p = os.path.join(base, f)
                try:
                    chunks.append(open(p, encoding='utf-8', errors='ignore').read())
                except Exception:
                    pass
    return '\n'.join(chunks)


def main():
    code = code_text()
    freed = 0
    deleted_files = 0
    deleted_dirs = 0

    # 1) 整目录删
    for d in DESIGN_DIRS:
        if not os.path.isdir(d):
            continue
        size = 0
        for base, _, files in os.walk(d):
            for f in files:
                size += os.path.getsize(os.path.join(base, f))
        shutil.rmtree(d)
        freed += size
        deleted_dirs += 1
        print('  删除目录 %-34s %6.1f MB' % (d, size / 1024 / 1024))

    # 2) 删未被引用的单张图（只动 assets/）
    for base, dirs, files in os.walk('assets'):
        for f in files:
            if not f.lower().endswith(IMAGE_EXT):
                continue
            p = os.path.join(base, f).replace('\\', '/')
            hit = (p in code) or (('/' + p) in code) or (f in code)
            if hit:
                continue
            size = os.path.getsize(p)
            os.remove(p)
            freed += size
            deleted_files += 1
            print('  删除文件 %-50s %6.0f KB' % (p, size / 1024))

    print()
    print('共删除 %d 个目录、%d 个文件，释放 %.1f MB' % (
        deleted_dirs, deleted_files, freed / 1024 / 1024))


if __name__ == '__main__':
    main()
