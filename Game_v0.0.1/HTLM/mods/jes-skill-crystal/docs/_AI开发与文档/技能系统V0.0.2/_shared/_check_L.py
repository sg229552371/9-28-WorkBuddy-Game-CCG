# -*- coding: utf-8 -*-
import io, re, os

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "技能系统_需求交接包_2026-10-18", "01_主书稿_运行时契约")
TARGET = os.path.join(D, "全新技能系统设计书_v0.2.md")
BAK = TARGET + ".bak_v027"

new = io.open(TARGET, encoding="utf-8").read()
old = io.open(BAK, encoding="utf-8").read()

print("=" * 66)
print("B 类补丁 apply 后复跑校验")
print("=" * 66)
print("[1] AC 去重计数 : %d  (应 83)  %s" % (
    len(set(re.findall(r'AC-[0-9]{2}[A-Z]*-[0-9]{2}', new))),
    "OK" if len(set(re.findall(r'AC-[0-9]{2}[A-Z]*-[0-9]{2}', new))) == 83 else "FAIL"))

for pat, name, expect in [
    (r'events:\s*\[([^\]]*)\]', 'events', '[hit, vanish]'),
    (r'carriers:\s*\[([^\]]*)\]', 'carriers', 'none, self, independent, attached'),
]:
    m = re.search(pat, new)
    got = m.group(1).strip() if m else "(未匹配)"
    print("[%s] %-12s : %s   %s" % (
        '2' if name == 'events' else '3', name, got,
        "OK" if got == expect else "FAIL(应 %s)" % expect))

ids = ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09',
       'D-90', 'D-91', 'D-92', 'D-104', 'D-105']
bad = 0
for d in ids:
    ro = [l for l in old.split('\n') if re.match(r'^\|\s*' + d + r'\s*\|', l)]
    rn = [l for l in new.split('\n') if re.match(r'^\|\s*' + d + r'\s*\|', l)]
    if len(ro) != 1 or len(rn) != 1 or ro[0] != rn[0]:
        print("   X %s old=%d new=%d" % (d, len(ro), len(rn)))
        bad += 1
print("[4] 14条已确认决策 : %s" % ("逐字未动 OK" if bad == 0 else "%d 处改动 FAIL" % bad))

oldw = {w: len([l for l in new.split('\n') if w in l]) for w in ['普攻', '弹幕实体', '技能对象']}
print("[5] 旧词 : %s  %s" % (oldw, "OK" if sum(oldw.values()) == 0 else "检查"))

inst = len(re.findall(r'carrier[^\n|]*instant', new))
print("[6] instant 作 carrier 枚举残留 : %d  %s" % (inst, "OK" if inst == 0 else "FAIL"))

print()
print("物理行数 : %d -> %d" % (old.count('\n') + 1, new.count('\n') + 1))
print("「2026-10-18 第 2 轮」标注出现 : %d 次" % new.count('2026-10-18 第 2 轮'))
print("大小 : %d -> %d 字节" % (len(old.encode('utf-8')), len(new.encode('utf-8'))))
