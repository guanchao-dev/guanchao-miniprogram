"""检查：页面 wxml 里用到的自定义组件，是否都在该页面的 json 里声明了。

开启 lazyCodeLoading: requiredComponents 后，只依赖 app.json 全局声明
在某些基础库版本下不会注入组件，页面会渲染失败（黑屏）。
"""
import io
import json
import os
import re

BUILTIN = {
    'view', 'text', 'image', 'button', 'input', 'scroll-view', 'swiper', 'swiper-item',
    'picker', 'navigator', 'form', 'label', 'checkbox', 'radio', 'switch', 'slider',
    'textarea', 'canvas', 'video', 'audio', 'map', 'cover-view', 'cover-image', 'icon',
    'progress', 'rich-text', 'web-view', 'movable-area', 'movable-view', 'open-data',
    'official-account', 'ad', 'camera', 'live-player', 'live-pusher',
    'functional-page-navigator', 'block', 'template', 'import', 'include', 'wxs', 'slot',
}


def main():
    comps = {}
    for base, dirs, files in os.walk('components'):
        for f in files:
            if f.endswith('.json'):
                name = os.path.basename(base)
                rel = os.path.join(base, f).replace(os.sep, '/')
                comps[name] = '/' + rel[:-5]
    print('自定义组件:', comps)
    print()

    problems = []
    for base, dirs, files in os.walk('pages'):
        for f in files:
            if not f.endswith('.wxml'):
                continue
            wxml_path = os.path.join(base, f).replace(os.sep, '/')
            wxml = io.open(wxml_path, encoding='utf-8').read()
            tags = set(re.findall(r'<([a-zA-Z][\w-]*)', wxml))
            custom = sorted(t for t in tags if t not in BUILTIN and t in comps)
            if not custom:
                continue
            jp = os.path.join(base, f[:-5] + '.json')
            declared = {}
            if os.path.exists(jp):
                try:
                    declared = (json.load(io.open(jp, encoding='utf-8')) or {}).get('usingComponents') or {}
                except Exception:
                    pass
            for c in custom:
                if c not in declared:
                    problems.append((wxml_path, c))

    if problems:
        for p, c in problems:
            print('  [缺失] %-46s 组件 %s' % (p, c))
    else:
        print('  OK：所有自定义组件都已在页面 json 中声明')


if __name__ == '__main__':
    main()
