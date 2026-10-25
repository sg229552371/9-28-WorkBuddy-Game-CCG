from pathlib import Path
import datetime
import hashlib
import json
import re
import sys
from urllib.parse import unquote

from build_book import render

B = Path(__file__).resolve().parents[1]
R = B.parents[1]
errors = []
links = 0
fragments = 0

expected = [
    '00-reading-map.md', '01-product-loop.md', '02-combat-modes.md',
    '03-inventory-economy.md', '04-crystal-skill.md', '05-save-ui-assets.md',
    '06-performance-architecture.md', '07-verification-roadmap.md',
    '08-appendix-dictionary.md', '09-incident-prevention.md', 'controlled-references.md',
    'handoff-parallel.md', 'task-cards.md', 'review-report.md'
]
names = json.loads((B / 'book-manifest.json').read_text(encoding='utf-8-sig'))
if names != expected:
    errors.append('合订清单不完整或顺序错误')


def anchors(path):
    text = path.read_text(encoding='utf-8-sig')
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    found = set(re.findall(r'(?:id|name)=["\']([^"\']+)', text))
    counts = {}
    for title in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', text, flags=re.M):
        title = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', title)
        slug = re.sub(r'[^\w\-\s]', '', title.lower()).replace(' ', '-')
        number = counts.get(slug, 0)
        counts[slug] = number + 1
        found.add(slug + (('-' + str(number)) if number else ''))
    return found


files = list(B.glob('*.md')) + [R / 'README.md', R / 'AGENTS.md', R / 'HANDOFF.md', R / 'G_docs/dev_standard_and_playbook.md']
for path in files:
    text = path.read_text(encoding='utf-8-sig')
    if path.parent != B:
        text = '\n'.join(line for line in text.splitlines() if 'X-GAMe' in line)
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    for target in re.findall(r'(?<!!)\[[^\]]+\]\(([^)]+)\)', text):
        target = unquote(target.strip().strip('<>'))
        if re.match(r'^[a-zA-Z][\w+.-]*:', target):
            continue
        relative, _, fragment = target.partition('#')
        target_path = (path.parent / relative).resolve() if relative else path
        links += 1
        if not target_path.is_file():
            errors.append(f'{path.name} 缺少链接 {target}')
            continue
        if fragment:
            fragments += 1
            if fragment not in anchors(target_path):
                errors.append(f'{path.name} 缺少锚点 {target}')

ownership = json.loads((B / 'ownership.json').read_text(encoding='utf-8'))
seen = {}
for owner, paths in [('integrator', ownership['integrator'])] + list(ownership['agents'].items()):
    for path in paths:
        if path in seen:
            errors.append(f'所有权重叠 {path}')
        seen[path] = owner
        if owner != 'integrator' and (R / path).exists():
            errors.append(f'代理占有既有文件 {path}')
for path in ownership['integrator']:
    if seen.get(path) != 'integrator':
        errors.append(f'共享文件未归集成 {path}')

book = B / 'X-GAMe-v1.md'
if book.read_bytes() != render().encode('utf-8'):
    errors.append('合订字节内容不一致')

for name in names[:9]:
    text = (B / name).read_text(encoding='utf-8')
    for script in re.findall(r'node\s+([\w-]+\.js)', text):
        if not (R / script).exists() and not (B / script).exists():
            errors.append(f'现有测试文件不存在 {script}')

snapshot = json.loads((B / 'evidence/config-snapshot.json').read_text(encoding='utf-8'))
required_keys = {'heroes', 'levels', 'outLevel', 'skillSystem', 'camera', 'chips'}
if set(snapshot['values']) != required_keys:
    errors.append('配置快照白名单不符')
if not snapshot['values']['heroes']:
    errors.append('英雄快照为空')
if snapshot['sha256'] != hashlib.sha256((R / 'js/config.js').read_bytes()).hexdigest():
    errors.append('配置快照源码Hash不符')

provenance = json.loads((B / 'evidence/sh-12-provenance.json').read_text(encoding='utf-8'))
for item in provenance['files']:
    evidence_path = B / 'evidence' / item['name']
    if hashlib.sha256(evidence_path.read_bytes()).hexdigest() != item['sha256']:
        errors.append(f'红测证据Hash不符 {item["name"]}')

result = {
    'checkedAt': datetime.datetime.now().astimezone().isoformat(),
    'sourceCount': len(names),
    'markdownCount': len(files),
    'relativeLinks': links,
    'fragmentLinks': fragments,
    'ownershipPaths': len(seen),
    'errors': errors,
    'exit': int(bool(errors)),
    'sourceChars': sum(len((B / name).read_text(encoding='utf-8')) for name in names),
    'bookBytes': book.stat().st_size,
}
(B / 'evidence/document-validation-final.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
sys.exit(result['exit'])
