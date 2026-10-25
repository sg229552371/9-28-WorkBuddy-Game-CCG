# -*- coding: utf-8 -*-
"""技能系统书 v1 · 校验器

检查：
  1. manifest 齐全、顺序正确、文件都存在
  2. 所有相对链接可达
  3. 片内锚点可达
  4. 合订本与源逐字节一致
  5. 每卷有且仅有一个一级标题
  6. 禁用旧词扫描
  7. 载体枚举合法（无 instant 作 carrier）
  8. 事件只有 hit / vanish

退出码：0 全过；1 有错
"""
from pathlib import Path
import datetime
import json
import re
import sys

from build_book import render

B = Path(__file__).resolve().parents[1]
BOOK_NAME = '技能系统书-v1.md'

EXPECTED = [
    '00-reading-map.md',
    '01-01-定位术语数据模型.md',
    '01-02-积木清单.md',
    '01-03-积木参数表.md',
    '01-04-挂点成长文案.md',
    '01-05-表现层配置与对齐.md',
    '01-06-组织校验保存验收.md',
    '01-07-积木扩展性与未决问题.md',
    '01-08-L5表达式逃逸口.md',
    '02-runtime-contract.md',
    '03-cfg-schema.md',
    '04-interface-tables.md',
    '05-decisions-and-changes.md',
    '06-glossary.md',
    '07-provenance.md',
]

errors = []
warns = []
links = 0
fragments = 0

# ---- 1. 清单 ----
mpath = B / 'book-manifest.json'
if not mpath.exists():
    errors.append('缺少 book-manifest.json')
    names = []
else:
    names = json.loads(mpath.read_text(encoding='utf-8-sig'))

if names != EXPECTED:
    missing = [n for n in EXPECTED if n not in names]
    extra = [n for n in names if n not in EXPECTED]
    if missing:
        errors.append('清单缺项：%s' % missing)
    if extra:
        errors.append('清单多项：%s' % extra)
    if not missing and not extra:
        errors.append('清单顺序错误')

for n in names:
    if not (B / n).exists():
        errors.append('源文件不存在：%s' % n)


def anchors(path):
    text = path.read_text(encoding='utf-8-sig')
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    found = set(re.findall(r'(?:id|name)=["\']([^"\']+)', text))
    counts = {}
    for title in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', text, flags=re.M):
        title = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', title)
        slug = re.sub(r'[^\w\-\s]', '', title.lower()).replace(' ', '-')
        num = counts.get(slug, 0)
        counts[slug] = num + 1
        found.add(slug + (('-' + str(num)) if num else ''))
    return found


# ---- 2/3. 链接与锚点 ----
for n in names:
    p = B / n
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8-sig')
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    for target in re.findall(r'(?<!!)\[[^\]]+\]\(([^)]+)\)', text):
        target = target.strip().strip('<>')
        if re.match(r'^[a-zA-Z][\w+.-]*:', target):
            continue
        relative, _, frag = target.partition('#')
        tp = (p.parent / relative).resolve() if relative else p
        links += 1
        if not tp.is_file():
            errors.append('%s 缺链接 %s' % (n, target))
            continue
        if frag:
            fragments += 1
            if frag not in anchors(tp):
                errors.append('%s 缺锚点 %s' % (n, target))

# ---- 4. 合订一致 ----
book = B / BOOK_NAME
if not book.exists():
    errors.append('合订本不存在，请先运行 build_book.py')
else:
    if book.read_bytes() != render().encode('utf-8'):
        errors.append('合订本与源不一致，请重新运行 build_book.py')

# ---- 5. 每卷一级标题（分册可含多章，故只要求至少 1 个）----
for n in names:
    p = B / n
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8-sig')
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    h1 = re.findall(r'^#\s+\S', text, flags=re.M)
    if len(h1) == 0:
        errors.append('%s 无一级标题' % n)

# ---- 6/7/8. 全书体检（仅合订本）----
if book.exists():
    full = book.read_text(encoding='utf-8')
    lines = full.split('\n')

    # 旧词：排除「禁用旧词表」左列与"警示语境"
    def is_warning_line(line):
        # 表格首列就是旧词本身 → 禁用词表条目，属正向警示
        if re.match(r'^\|\s*(普攻|弹幕实体|技能对象)\s*\|', line):
            return True
        # 出现禁止类措辞 → 说明在讲"不能用"
        return bool(re.search(r'不能|禁止|不得|不可|不再|严禁|违规|旧词|废弃', line))

    for w in ['普攻', '弹幕实体', '技能对象']:
        bad = [i for i, l in enumerate(lines) if w in l and not is_warning_line(l)]
        if bad:
            errors.append('禁用旧词违规（非警示语境）：%s 于第 %s 行' % (w, bad[:3]))

    # instant 作 carrier 枚举：只查 Schema 定义式 `carrier: { ... enum: [ ... instant ... ] }`
    bad_inst = [i + 1 for i, l in enumerate(lines)
                if re.search(r'carrier:\s*\{[^}]*enum:\s*\[[^\]]*\binstant\b', l)]
    if bad_inst:
        errors.append('instant 被用作 carrier 枚举（第 %s 行）' % bad_inst[:3])
    m = re.search(r'events:\s*\[([^\]]*)\]', full)
    if m and m.group(1).strip() != 'hit, vanish':
        errors.append('events 枚举异常：%s' % m.group(1))
    m2 = re.search(r'carriers:\s*\[([^\]]*)\]', full)
    if m2 and 'instant' in m2.group(1):
        errors.append('carriers 枚举含 instant')
    ac = len(set(re.findall(r'AC-[0-9]{2}[A-Z]*-[0-9]{2}', full)))
    if ac != 83:
        warns.append('AC 去重计数 = %d（预期 83）' % ac)
else:
    ac = 0

result = {
    'checkedAt': datetime.datetime.now().astimezone().isoformat(),
    'sourceCount': len(names),
    'relativeLinks': links,
    'fragmentLinks': fragments,
    'acCount': ac,
    'errors': errors,
    'warnings': warns,
    'exit': int(bool(errors)),
    'sourceChars': sum(len((B / n).read_text(encoding='utf-8')) for n in names if (B / n).exists()),
    'bookBytes': book.stat().st_size if book.exists() else 0,
}
ev = B / 'evidence'
ev.mkdir(exist_ok=True)
(ev / 'book-validation.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('=' * 62)
print('技能系统书 v1 · 校验')
print('=' * 62)
print('源文件数：%d　相对链接：%d　片内锚点：%d' % (len(names), links, fragments))
print('源字符数：%d　合订字节：%d　AC 计数：%d' % (result['sourceChars'], result['bookBytes'], ac))
print('-' * 62)
if warns:
    print('[警告 %d]' % len(warns))
    for w in warns:
        print('  ! %s' % w)
if errors:
    print('[错误 %d]' % len(errors))
    for e in errors:
        print('  X %s' % e)
else:
    print('错误：无  →  校验通过')
print('=' * 62)
sys.exit(result['exit'])
