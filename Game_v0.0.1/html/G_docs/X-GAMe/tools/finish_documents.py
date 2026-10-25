from pathlib import Path
import hashlib,json,re,shutil,datetime
R=Path('F:/AI-Game/Game_v0.0.1'); B=R/'G_docs/X-GAMe'; E=B/'evidence'
def put(p,s):
 p.parent.mkdir(parents=True,exist_ok=True); p.write_text(s.strip()+'\n',encoding='utf-8')
def read(p): return p.read_text(encoding='utf-8-sig')
# 保存本次写入前运行文件清单，旧证据不覆写。
runtime=sorted(list((R/'js').glob('*.js'))+list((R/'css').rglob('*.css'))+[R/'index.html'])
put(E/'runtime-continuation-before.json',json.dumps([{'Path':str(p),'Hash':hashlib.sha256(p.read_bytes()).hexdigest().upper()} for p in runtime],ensure_ascii=False,indent=2))
source=Path('C:/Users/jinyishun/AppData/Local/Temp/lobehub/shell/2026-10-12/31268/sh-12')
for src,dst in [('stdout.log','sh-12-failure.log'),('stderr.log','sh-12-stderr.log')]:
 if (source/src).is_file(): shutil.copyfile(source/src,E/dst)
put(E/'sh-12-provenance.json',json.dumps({'source':str(source),'copiedAt':datetime.datetime.now().astimezone().isoformat(),'files':[{'name':d,'sha256':hashlib.sha256((E/d).read_bytes()).hexdigest()} for d in ['sh-12-failure.log','sh-12-stderr.log'] if (E/d).exists()]},ensure_ascii=False,indent=2))
p=B/'03-inventory-economy.md'; s=read(p)
s=s.replace('`computeStats`、`calcDeathPenalty`相关定位','`computeStats`相关定位').replace('`calcSettleConvert`。','`calcSettleConvert`、`calcDeathPenalty`。')
s=s.replace('- 结晶来源存在“物品折算”与“Boss奖励”冲突；须由产品确认，再同时改蓝图、CFG、实现、测试，不能在交接卡里预批准。','- [玩法蓝图](../game_design_proposal.md)§19.8已批准Boss奖励与撤离物资折算双来源，不再提交“双来源是否成立”的重复决策。该节旧数值30与当前CFG的60、以及“全部物品”与遗迹秘宝排除的措辞，应分别追踪历史和适用边界；不得以书稿代替批准规则。')
s=s.replace('## 死亡与保险','当前数值快照：`CFG.outLevel.crystalBoss=60`（配置注释20.10从30调整到60），`valueRate=0.5`、`deathRatio=0.3`。蓝图§19.8的30属于历史文字，不能标成当前配置。`Meta.awardRun`在game，成功撤离的额外折算在main；“击败Boss时直接发放”的蓝图文字与统一结算时点是否一致，仍需逐入口验证，不据此宣称重复或漏发。\n\n## 死亡与保险')
put(p,s)
put(B/'00-reading-map.md','''# 00 阅读地图与权威边界

本书的编辑源是01～08分章及受控附录（受控索引、交接包、独占任务卡、审查报告）。[合订本](X-GAMe-v1.md)是自动生成的阅读副本，禁止直接改合订；具体汇编顺序见[显式清单](book-manifest.json)。修改源后执行 `python G_docs/X-GAMe/tools/build_book.py`，再以 `--check` 比较逐字节结果。

本书提供实现导航、证据与提案，不创造批准。本书及代码均不能覆盖用户已批准的工程合同、玩法规则；代码只说明目前实现。遇到冲突登记差异并回查原合同的适用范围，不把较新的书稿当作更高层合同。历史章节的取代标记继续有效。

| 阅读章 | 明确触发条件 | 读完应能回答 |
|---|---|---|
| [01 产品闭环](01-product-loop.md) | 改选人、开局、主流程或局内外边界 | run从哪里创建、怎样结束 |
| [02 战斗与模式](02-combat-modes.md) | 改怪物、伤害、主线、裂缝、无尽 | 哪个世界/时钟/结算入口负责 |
| [03 背包与经济](03-inventory-economy.md) | 改物品、装备、秘宝、死亡、保险或结晶 | 资产来源、消耗、折算、防重 |
| [04 水晶技能](04-crystal-skill.md) | 改任一技能子系统、等级、奖励 | 配置到施放、事件与事务边界 |
| [05 存档与表现](05-save-ui-assets.md) | 改持久化、UI、输入、资源 | 写对象、commit、刷新和消费链区别 |
| [06 架构与性能](06-performance-architecture.md) | 改主循环、对象池、剔除或画质 | 模拟不变量、共享文件所有权 |
| [07 验证与路线](07-verification-roadmap.md) | 选测试、交付、决定下一批 | 哪些证据已通过、哪些仍阻断 |
| [08 词表与快照](08-appendix-dictionary.md) | 跨模块命名、查配置或交接 | 真名、状态含义、生成方式 |

需要详细字段签名时只读[受控索引](controlled-references.md)中被触发的合同；需要未来拆任务时读[交接包](handoff-parallel.md)，其任务全部未启用。本轮质量证据见[审查报告](review-report.md)。
''')
put(B/'controlled-references.md','''# 受控规范与条件索引

批准规则仍在原文档。本索引仅把本书章节连接到原合同；不复制合同正文，也不以CFG实现值批准产品变更。改接口必须读取接口文档对应条目，不能只凭本书概述实现。

| 受控源 | 准确触发条件 | 本书章节 | 用法与权威 |
|---|---|---|---|
| [玩法蓝图](../game_design_proposal.md) | 改玩家规则、模式、死亡、结晶来源 | 01/02/03 | 查已批准条目与取代横幅；§19.8双来源已批准 |
| [技能总纲](../skill_system_master_v1.md) | 开始任何技能工作 | 04/05 | 先确定文档权威与当前范围 |
| [工程合同](../skill_system_development_contract_v1.0.md) | 改容量、阶段、事件、事务、迁移 | 04/05/08 | 已批准约束，本书提案不得覆盖 |
| [接口合同](../skill_system_interface_v1.md) | 新增/变更跨模块方法、字段或枚举 | 04/08 | 逐签名冻结；不得猜字段 |
| [水晶设计v0.5](../design_crystal_skill_system_v0.5.md) | 判断水晶规则、辅助匹配或旧系统冲突 | 04 | 与工程合同一起查适用范围 |
| [扩容规范](../skill_crystal_expansion_spec_v1.md) | 涉及冷却、弹速、灼烧、链锁、100级 | 04/07 | 历史批准专题；实施范围逐条核验 |
| [迁移表](../skill_migration_map_v0.1.md) | 读取旧模块/秘宝/存档 | 04/05 | 未映射资产保留与报告 |
| [数值表](../skill_balance_table_v0.1.md) | 调整技能参数或曲线 | 04/08 | 区分设计目标与CFG实际快照 |
| [UI规范](../skill_ui_spec_v0.1.md) | 改装配、详情、拒绝原因 | 04/05 | 按已批准交互，不绕奖励事务 |
| [开发规范](../dev_standard_and_playbook.md) | 改代码、拆任务、集成 | 全书 | 共享文件串行、门禁与交付纪律 |
| [机制及历史坑](../dev_guide.md) | 改具体机制、暂停或冻结 | 02/03/06/07 | 查对应机制与历史陷阱 |
| [测试索引](../../tests/README.md)、[实际门禁](../../run_tests.sh) | 选择或接入测试 | 07 | 运行结果才是测试事实 |
| [架构提案](../plan_architecture_and_ai_development_v1.md) | 讨论模块化/长期架构调整 | 06/07 | 只读待确认，不能据此直接开发 |

每次查阅记录：适用条款、代码符号、证据、实现状态、差异与后续动作。实现状态严格使用08章词表。标题里的版本号或“最新”不自动改变已批准条款优先级。
''')
put(B/'08-appendix-dictionary.md','''# 08 受控附录、接口词表与配置快照

## 目的、输入与输出
本章给跨模块沟通提供可查的名称、状态与数据快照生成方式。输入是版本化源码、已批准合同及测试证据；输出是无个人数据的CFG白名单快照和定位词表。它不是另一份接口合同，变更签名必须按[受控索引](controlled-references.md)读取原文。

## 实现状态词表
| 状态 | 必须具备的证据 | 不代表什么 |
|---|---|---|
| 已实现 | 定义和真实调用链可定位 | 不自动代表所有设备验收 |
| 部分实现 | 明确已有段落与未闭合段落 | 不允许把预期链路写成事实 |
| 待验证 | 观察/检索范围与下一步明确 | 不等于已证实bug |
| 批准目标 | 可回查用户批准或受控条款 | 不代表本轮批准代码改动 |
| 历史兼容 | 残留数据/消费分支及历史来源 | 不等于新玩家一定可达 |
| 未实现 | 在界定范围内有充分缺口证据 | 单次搜索无命中通常不够 |

任务的“完成”仅指任务验收；书稿完成不代表修复完成、接口冻结或发布通过。待批准提案不能出现在批准合同之上。

## 领域词表与符号定位
| 玩家/工程术语 | 实际符号或字段 | 所属边界 |
|---|---|---|
| 一局上下文 | `G.run`、`createRun`、`Game.startRun` | game/main；独立模式也需真实初始化 |
| 世界切换 | `G.activeWorld`、`G.mainWorld`、`G.riftWorld` | main/modes；不得跨世界保留目标 |
| 局外资产 | `Meta.data`、`Meta.commit` | game；写对象与持久化分开 |
| 遗迹秘宝 | `CFG.chips`、`chipInv`、`makeChip` | items；不是辅助水晶改名 |
| 水晶技能定义 | `CFG.skillSystem`、`initialSkillBindings` | config；当前仅H001迁入 |
| 施放层 | `cooldown`、`castTime` | 等级行；castTime消费待核验 |
| 效果参数 | `parameters` | 不把施放层字段塞入参数包 |
| 合并操作 | `operationId`；`add/multiply/min/max/exclusive` | compiler；稳定排序与顺序无关 |
| 事件约束 | `maxEventDepth/maxEventPerStep/maxDerivedPerEvent` | events；全局及策略限制同时执行 |
| 链式次数 | `chainLeft` | 节点参数；不等于事件深度 |
| 奖励事务 | `rewardId/optionId/randomState/groupVersion` | reward；候选锁定、防重复提交 |
| 迁移版本 | `SCHEMA_VERSION=2`、`__migratedTo` | save；幂等与原始数据保留 |
| 物资折算 | `calcSettleConvert` | modes；成功撤离调用在main |
| 死亡损失 | `calcDeathPenalty` | modes；宝箱与保险不同阶段 |
| 表现降档 | `PerfGuard`、`qualityLevel` | quality；不能削减实际伤害 |

这些是定位词，不声称每个名称都可从window访问。全局`const`、顶层函数和对象方法的可见性不同；测试须沿当前加载方式取值。

## 当前可复现配置快照
运行 `node G_docs/X-GAMe/tools/snapshot-config.cjs`，输出[白名单快照](evidence/config-snapshot.json)。脚本只在隔离Node VM中执行本项目纯配置文件；不加载game/main，不读取localStorage、不访问用户存档或凭据、不读取环境变量、不发网络请求。输出仅包含脚本中显式列出的CFG顶级键，函数字段被剔除；运行前应确认config仍为受信的纯数据配置。

白名单覆盖：英雄、武器、怪物、关卡/生成、主线/裂缝/无尽、背包/秘宝、保险/死亡/局外成长/折算、相机/触控/音频及skillSystem。数字从实际CFG执行结果导出，不把整份用户状态复制进文档。快照包含配置源码SHA256；它证明生成来源，不批准数值。

生成后校验：JSON能解析；英雄非空；技能启用字段、迁入名单、Boss奖励与深度预算可读取；源码Hash一致。缺失白名单键必须报错，不能悄悄输出空对象。若配置变更，先审查白名单，再重新生成；不要扩成`JSON.stringify(window)`。

## 文档工具与验收
[汇编清单](book-manifest.json)明确00、01～08、受控索引、交接包、任务卡与审查报告的顺序。`tools/build_book.py`为每份源加稳定前缀锚点，重写合订中的源文件片内链接；相对路径保持在同目录解析。`--check`发现源与合订不同直接非零退出，不改文件。

执行 `python G_docs/X-GAMe/tools/validate_book.py`：检查显式章节齐全、所有本书Markdown相对文件链接、片内锚点、命令内测试文件、任务所有权无重叠、共享文件只有集成人、合订与源逐字节一致。该脚本不联网验证外链，也不能替代人工规则审校。

## 异常、回滚与后续维护
发现锚点丢失、CFG键缺失、文件重叠或差异未登记，应阻断交接。先修编辑源再重建合订；不能只修生成副本。文档回滚只回退本轮确认属于自己的块或文件，保留用户其他修改。运行代码回滚必须在未来批准批次中逐文件制定，禁止`reset --hard`与`clean`。

当前快照、链接和所有权以[审查报告](review-report.md)实际执行结果为准。未来每次批准变更都要同步受影响分章、差异记录、快照与合订；不重写历史测试原件。
''')
# 仅增加入口与范围说明，保留原历史正文。
for rel,link in [('AGENTS.md','G_docs/X-GAMe/README.md'),('HANDOFF.md','G_docs/X-GAMe/README.md'),('G_docs/dev_standard_and_playbook.md','X-GAMe/README.md')]:
 p=R/rel;s=read(p)
 block=f'''\n> **2026-10-12 文档编书入口**：[X-GAMe项目书]({link})。需要开发参考时先按阅读地图进入分章，再按触发条件回查已批准合同；分章与受控附录为编辑源，合订由显式清单生成。书稿与未批准提案不高于原批准规则，代码只裁定实现事实。\n> **本轮范围**：仅`F:/AI-Game/Game_v0.0.1`内文档、证据与只读核验，不改运行代码、不commit/push/部署、不派发未来任务。下文发布流程用于获授权的代码交付，不能触发本轮发布。\n> **历史基线说明**：下文旧版号/93套4083/skill14或17等保留历史含义；本次已有全量绿测为94套/PASS4111/bad0、skill18，另有一次旧路径红测未诊断。当前CFG启用H001、十个技能文件（含playtest），verify_clone声明23个指纹但是否匹配以本轮审查结果为准。旧W0的9文件描述仍属历史批次。\n> **共享所有权**：config/core/index/css与game/main/combat/items/modes/run_tests全部只归主集成人串行处理；具体互斥卡见书内交接包。\n'''
 s=s.replace('\n', '\n'+block+'\n',1);put(p,s)
p=R/'G_docs/dev_standard_and_playbook.md';s=read(p).replace('外加一条：**代码是最终事实**——文档与代码不符时，**以代码为准并登记差异**。','外加一条：**代码是实现事实**——文档与代码不符时，记录实际实现并登记差异；玩法及接口是否应改变仍以已批准条款裁决，本书和代码均不自动覆盖批准合同。')
put(p,s)
print('已保存分章修订、入口、首次红测原件及续轮运行快照')
