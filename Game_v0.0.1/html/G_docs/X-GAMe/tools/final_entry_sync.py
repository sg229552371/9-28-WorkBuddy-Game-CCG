from pathlib import Path
import json,re
B=Path(__file__).resolve().parents[1];R=B.parents[1]
p=B/'ownership.json';o=json.loads(p.read_text(encoding='utf-8'))
for k,files in o['agents'].items():
 for f in files:
  if f.startswith('js/') and f not in o['integrator']:o['integrator'].append(f)
 o['agents'][k]=[f for f in files if not f.startswith('js/')]
p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=B/'task-cards.md';s=p.read_text(encoding='utf-8')
for f in ['mods/jes-skill-crystal/systems/skill-save.js','js/assets_manifest.js','mods/jes-skill-crystal/systems/skill-events.js']:s=s.replace('`'+f+'`, ','')
s=s.replace('实现文件只在该批批准确需修改时可写；不得把独占资格当成改动授权。','代理只新建该独占测试；既有实现文件由集成人串行修改。')
p.write_text(s,encoding='utf-8')
p=B/'handoff-parallel.md';s=p.read_text(encoding='utf-8').replace('A负责skill-save及独占测试；B负责assets_manifest及独占测试；C负责skill-events及独占测试；D仅负责经济闭环独占测试。','A/B/C/D只负责各自新建独占测试和接线建议；所有既有模块修改归集成人。')
s+='\n## 依赖DAG与文档变更归集\n\nW0文档基线 → W1串行核验与批次接口冻结 → W2[A存档测试 ∥ B资源测试 ∥ C事件测试 ∥ D经济测试] → W3集成人改既有模块与接线 → W4集成验收。任一任务依赖未冻结接口，留在W1；不能以书已冻结跳过批次冻结。\n\n集成人另独占mods/jes-skill-crystal/systems/skill-save.js、js/assets_manifest.js、mods/jes-skill-crystal/systems/skill-events.js及全部既有文档；代理提交“章节/原条款/证据/建议替换/接口影响”变更提案，由集成人去重裁决后统一写入。代理不得改书、合同或其他测试。\n'
p.write_text(s,encoding='utf-8')
for name in ['README.md','AGENTS.md','HANDOFF.md','G_docs/dev_standard_and_playbook.md','G_docs/game_design_proposal.md','G_docs/skill_system_master_v1.md']:
 p=R/name;s=p.read_text(encoding='utf-8-sig');link='X-GAMe/README.md' if name.startswith('G_docs/') else 'G_docs/X-GAMe/README.md'
 notice=f'> **X-GAMe v1现行入口**：先读[项目书]({link})及受控附录索引。项目书统筹规则与证据，详细批准合同作为受控附录；旧正文的入口优先级、测试计数、路径和发布状态属历史记录，冲突按书中登记处理。本轮副本基线为F:/AI-Game/Game_v0.0.1，未改变父仓库发布身份。\n\n'
 if 'X-GAMe v1现行入口' not in s:s=s.split('\n',1)[0]+'\n\n'+notice+s.split('\n',1)[1]
 if name=='README.md':
  s=s.replace('（**公开**；clone 无需登录，push 需令牌）','（私有；访问需要相应权限）').replace('测试文件 93 个（门禁全部编排 93 套','测试文件 94 个（本轮门禁编排 94 套').replace('全量：93 套，4083 条断言','全量：94 套，PASS 4111').replace('dev_guide.md    # 开发指南：铁律、已踩的坑、测试基线 ← 新会话先读这份','dev_guide.md    # 机制历史参考；新会话先读AGENTS与X-GAMe项目书').replace('| PC 本地工作区 | `D:/AI-game-All/HTML_TEST_002` |','| 本轮文档副本 | `F:/AI-Game/Game_v0.0.1`（父Git根F:/AI-Game） |')
 if name=='HANDOFF.md':s=s.replace('## 四、当前基线（实测）','## 四、历史快照基线（本轮现状见X-GAMe审查报告）').replace('（本地 = 远程 `origin/main`，工作区干净）','（历史记录，不能表示本轮本地/远程同步或工作区干净）')
 p.write_text(s,encoding='utf-8')
print('入口及任务所有权已同步')
