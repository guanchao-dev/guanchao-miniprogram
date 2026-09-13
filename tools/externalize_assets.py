"""把小程序里的图片资源引用改成走服务器，减小主包体积。

- 把 .wxml / .ts 里的 "/assets/xxx" 替换成 "https://<域名>/api/v1/static/assets/xxx"
- 不动 app.json（tabBar 图标微信强制要求本地文件，不能走网络）
- 不动 .wxss（wxss 的 background-image 不支持网络图片）
- 幂等：已经是网络地址的不会再替换

前置条件：图片已上传到服务器静态资源目录（由部署环境配置，不在此记录路径）。
每次前端重新发版后重跑一次即可。
"""
import os
import re
import sys

DOMAIN = 'https://www.blueakaiwu.cn'
PREFIX = DOMAIN + '/api/v1/static'
OLD = '/assets/'
NEW = PREFIX + '/assets/'

SKIP_PARTS = ('resources', '.git', 'docs', 'tools', 'node_modules',
              'sketch', 'sketch-imgs', 'raw', '_crops', 'miniprogram_npm')
TARGET_EXT = ('.wxml', '.ts')


def main():
    changed = []
    for base, dirs, files in os.walk('.'):
        parts = base.replace(os.sep, '/').split('/')
        if any(p in SKIP_PARTS for p in parts):
            continue
        for f in files:
            if not f.lower().endswith(TARGET_EXT):
                continue
            p = os.path.join(base, f)
            try:
                src = open(p, encoding='utf-8').read()
            except Exception:
                continue
            # 已经是网络地址的跳过（避免二次替换）
            tmp = src.replace(NEW, '\x00PLACEHOLDER\x00')
            if OLD not in tmp:
                continue
            n = tmp.count(OLD)
            out = tmp.replace(OLD, NEW).replace('\x00PLACEHOLDER\x00', NEW)
            if out != src:
                open(p, 'w', encoding='utf-8', newline='\n').write(out)
                changed.append((p, n))

    for p, n in changed:
        print('  %-45s %d 处' % (p, n))
    print('\n共修改 %d 个文件，替换 %d 处引用' % (len(changed), sum(n for _, n in changed)))


if __name__ == '__main__':
    main()
