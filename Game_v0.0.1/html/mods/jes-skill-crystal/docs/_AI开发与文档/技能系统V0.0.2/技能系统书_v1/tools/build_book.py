# -*- coding: utf-8 -*-
"""技能系统书 v1 · 合订器

用法：
  python tools/build_book.py           生成合订本
  python tools/build_book.py --check   校验合订本与源逐字节一致（不改文件）
"""
from pathlib import Path
import json, sys

B = Path(__file__).resolve().parents[1]
BOOK_NAME = '技能系统书-v1.md'


def render():
    names = json.loads((B / 'book-manifest.json').read_text(encoding='utf-8'))
    parts = []
    for n in names:
        if n == BOOK_NAME:
            continue
        p = B / n
        if not p.exists():
            raise SystemExit('缺少源文件：%s' % n)
        parts.append(p.read_text(encoding='utf-8').strip())
    return '\n\n---\n\n'.join(parts) + '\n'


if __name__ == '__main__':
    text = render()
    out = B / BOOK_NAME
    if '--check' in sys.argv:
        ok = out.exists() and out.read_bytes() == text.encode('utf-8')
        print('合订一致=' + str(ok))
        sys.exit(0 if ok else 1)
    out.write_bytes(text.encode('utf-8'))
    print('合订字符=%d' % len(text))
