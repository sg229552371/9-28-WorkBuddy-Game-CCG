from pathlib import Path
import json,datetime
R=Path('F:/AI-Game/Game_v0.0.1'); B=R/'G_docs/X-GAMe'
def put(name,text):
 p=B/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text.strip()+'\n',encoding='utf-8')
shared=['js/config.js','js/core.js','index.html','css/style.css','js/game.js','js/main.js','js/combat.js','js/items.js','js/modes.js','run_tests.sh']
cards=[('A-save',['js/skill-save.js','xgame_save_integration_test.js'],'技能存档','先确认局内技能是否应跨局保存、保存时机和迁移合同；沿saveTo/loadFrom到Meta.commit逐入口核验，不把未发现调用当成已证实故障。','保存→刷新→恢复施放；未知ID保留、迁移两次幂等、持久化失败不覆盖原数据。'),('B-assets',['js/assets_manifest.js','xgame_assets_consumption_test.js'],'资源消费','枚举清单定义、页面加载、AssetHooks初始化和实际绘制/播放证据；先区分既有Assets/SFX路径。','HTTP成功/404/超时、缓存命中、音频手势限制、实际画面或声音与回退。'),('C-events',['js/skill-events.js','xgame_event_limits_test.js'],'事件边界','保持全局深度与策略深度同时约束；chainLeft及everyHit定向豁免独立核对。当前语义已核实，不预设需要修复。','全局2/策略3仍受2约束；更严策略、生效预算、去重、同链与跨链、固定种子确定性。'),('D-economy',['xgame_economy_flow_test.js'],'经济闭环','使用真实UI扣费入口及Meta；双来源已批准，当前Boss60、折算0.5、死亡0.3；卡牌旧存档可达性另列。','撤离/死亡/重复结算；宝箱先丢、保险件数、固定随机、秘宝不折算、武器升级先扣费。')]
put('ownership.json',json.dumps({'status':'proposal-not-dispatched','integrator':shared,'agents':{k:files for k,files,_,_,_ in cards}},ensure_ascii=False,indent=2))
text='# 可复制任务卡（未来提案，未派发）\n\n所有卡依赖W1串行报告、用户对该批目标的批准和接口冻结记录。缺任一输入即停在证据/提案，不开始实现。路径均相对项目根；下列新测试目前不存在，是未来独占交付物。任何卡不允许改共享文件、其他代理文件或全局门禁。\n'
for key,files,title,inputs,accept in cards:
 text+=f'''\n## {key}：{title}\n\n复制本节及下方共同约束作为任务提示。\n\n- 依赖/输入：W1基线、批准条款、接口冻结表、相关章节与现有测试；{inputs}\n- 唯一写入所有权：{', '.join('`'+x+'`' for x in files)}。实现文件只在该批批准确需修改时可写；不得把独占资格当成改动授权。\n- 输出：限定文件补丁、真实执行命令/退出码/断言输出、已覆盖与未覆盖边界、交给集成人的接线需求（只描述，不改共享文件）。输出通过主会话收集；不得擅建共享报告。\n- 验收：{accept} 专属测试直接用 `node {files[-1]}`，并检查标准错误断言；不擅改run_tests。\n- 接口：沿用原合同与实际定义；输入/输出字段和失败结果在W1逐签名冻结。未核实字段写“待冻结”，不得发明save/asset接口。\n- 阻断：缺失批准、接口变化、需要越界写文件、发现用户同期改动时，提交冲突定位及最小方案，等待主集成人决策。\n'''
text+='''\n## 共同约束与完成证据\n\n只在批准批次工作；新逻辑末尾独立区块，旧入口单行调用，可调值由集成人放入CFG。交接必须含修改路径、基线Hash、补丁、测试日志及未解决问题；没有真实刷新或画面证据就标待验证。禁止commit/push/部署、reset --hard、clean、全量覆盖目录。先比较基线和当前文件，用户同期修改保留；有冲突时逐块合并，回滚仅撤自己的已确认块。\n'''
put('task-cards.md',text)
put('handoff-parallel.md','''# 并行开发交接包（未启用提案）

## W0/W1 串行核验和冻结
集成人先读AGENTS、HANDOFF、开发规范、本书和[受控索引](controlled-references.md)。本轮仅文档，不派发任务。未来先取得批次目标批准，保存Git根与子目录前缀、工作树状态及运行文件Hash；保留用户已有改动。确认旧路径红测、存档时机、资源加载消费、经济结算时点/卡牌可达性。事件深度已确认全局与策略双约束，后续核验测试覆盖，不再把“优先级未知”当阻断事实。

输出串行冻结记录：批准条款、精确文件集合、接口实际签名/字段/枚举、输入输出/失败语义、接线需求、专属测试、验收与回滚。书稿完成不等于冻结记录完成。未核验问题只能提交诊断提案；不可先写假接口后要求下游配合。

## W2 互斥任务
使用[可复制任务卡](task-cards.md)，机器可检验集合见[所有权清单](ownership.json)。A负责skill-save及独占测试；B负责assets_manifest及独占测试；C负责skill-events及独占测试；D仅负责经济闭环独占测试。只读访问可以重叠，写入路径不重叠。B不拥有core。

## W3 主集成人串行接线清单
仅集成人拥有 `js/config.js`、`js/core.js`、`index.html`、`css/style.css`、`js/game.js`、`js/main.js`、`js/combat.js`、`js/items.js`、`js/modes.js`、`run_tests.sh`。

1. config：批准数值、功能开关、预算与白名单快照；不得顺手开放新功能。
2. core/index：资源加载顺序、初始化、消费入口及失败回退；清单存在不等于渲染成功。
3. game/main：保存对象、commit、恢复时机、真实startRun与模式生命周期；不提前决定局内技能跨局保留。
4. combat/items/modes：事件及结算必要接线，保险/折算/重复触发的真实入口。
5. CSS：主规则、全部相关portrait媒体块及body.portrait一致；UI需求超出已分配文件时重新冻结所有权。
6. run_tests：审阅代理专属测试后串行挂载，防重复和恒真断言。
7. 版本：未来运行文件改动才同步meta app-version、所有?v=及Assets.buildVersion。本轮不改版本。
8. 文档：同步批准源受影响条款、分章、差异、配置快照，再重建合订。

## W4 验收与失败处理
顺序：语法→独占测试→quick→相关suite→全量→真实浏览器/手机链。要求exit=0且bad=0；真机结论不能由Node断言替代。保留失败原始日志，修复后新增证据；不覆写红测。

所有权重叠、接口未冻结、用户修改冲突、规则未批准时停止相关支线，其余独立只读核验可继续。集成前逐文件比较基线Hash；回滚使用本批补丁的逆向且逐块核对，不覆盖用户改动、不改历史指纹来凑绿、不执行reset/clean。commit/push/独立托管发布只在未来明确授权交付范围内执行，本包不能自动触发发布。
''')
put('README.md','''# X-GAMe 开发参考书

状态：书稿已落盘，最终质量检查进行中；以[审查报告](review-report.md)的实际结果为准。仅文档交付，未批准或派发开发任务。

从[00阅读地图](00-reading-map.md)进入01～08分章；连续阅读用[自动合订本](X-GAMe-v1.md)。分章及受控附录是唯一编辑源，合订不手改。批准规则仍在[受控索引](controlled-references.md)连接的合同，书稿不能覆盖它们。

[差异路线](07-verification-roadmap.md) · [并行包](handoff-parallel.md) · [任务卡](task-cards.md) · [配置与词表](08-appendix-dictionary.md) · [审查报告](review-report.md)。

项目根执行：`python G_docs/X-GAMe/tools/build_book.py`；检查用 `python G_docs/X-GAMe/tools/validate_book.py`；配置生成用 `node G_docs/X-GAMe/tools/snapshot-config.cjs`。详见08章。
''')
manifest=['00-reading-map.md']+[next(B.glob(f'{i:02d}-*.md')).name for i in range(1,9)]+['controlled-references.md','handoff-parallel.md','task-cards.md','review-report.md']
put('book-manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
put('review-report.md','# 审查报告\n\n最终核验进行中；尚未标记完成。\n')
print('导航、任务卡、互斥所有权和汇编清单已落盘')
