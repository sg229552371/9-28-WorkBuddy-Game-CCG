from pathlib import Path
import json,re
B=Path('G_docs/X-GAMe');R=Path('.')
p=B/'README.md';s=p.read_text(encoding='utf-8');s=s[:s.index('\n本书是项目总入口')]+'\n本书是开发参考入口，不改变已批准合同的效力。未来批次接口需另行串行冻结。\n';s=s.replace('状态：v1文档交付版','状态：v1审校收口中');p.write_text(s,encoding='utf-8')
p=B/'ownership.json';o=json.loads(p.read_text());
for k,paths in o['agents'].items():
 for f in paths[:]:
  if f.startswith('js/'):
   o['integrator'].append(f);paths.remove(f)
p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=B/'task-cards.md';s=p.read_text(encoding='utf-8')
for f in ['mods/jes-skill-crystal/systems/skill-save.js','js/assets_manifest.js','mods/jes-skill-crystal/systems/skill-events.js']:s=s.replace('`'+f+'`, ','')
s=s.replace('实现文件只在该批批准确需修改时可写；不得把独占资格当成改动授权。','仅新建上述独占测试；所有既有模块修改和宿主接线归集成人。')
p.write_text(s,encoding='utf-8')
p=B/'handoff-parallel.md';s=p.read_text(encoding='utf-8').replace('A负责skill-save及独占测试；B负责assets_manifest及独占测试；C负责skill-events及独占测试；D仅负责经济闭环独占测试。','A/B/C/D分别只新建存档、资源、事件、经济独占测试；既有skill-save、assets_manifest、skill-events模块及所有宿主接线只归集成人。');s=s.replace('`run_tests.sh`。','`run_tests.sh`、`mods/jes-skill-crystal/systems/skill-save.js`、`js/assets_manifest.js`、`mods/jes-skill-crystal/systems/skill-events.js`。');p.write_text(s,encoding='utf-8')
p=R/'README.md';s=p.read_text(encoding='utf-8-sig');s='> 开发参考入口：[X-GAMe](G_docs/X-GAMe/README.md)。批准规则不变；当前副本`F:/AI-Game/Game_v0.0.1`，Git根在父目录。下列旧环境路径为历史记录，当前证据见书内审查报告。\n\n'+s;p.write_text(s,encoding='utf-8')
print('权威边界、独占文件与根入口已修正')
