# 08 受控附录、接口词表与配置快照

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

白名单实际覆盖六个顶级键：heroes、levels、outLevel、skillSystem、camera、chips；完整键名目录另存keysAvailable。其他武器、怪物、模式、保险、触控和音频数值须按源码定位回查，当前快照不声称完整导出。快照包含配置源码SHA256，用于复现来源，不批准数值。

生成后校验：JSON能解析；英雄非空；技能启用字段、迁入名单、Boss奖励与深度预算可读取；源码Hash一致。缺失白名单键必须报错，不能悄悄输出空对象。若配置变更，先审查白名单，再重新生成；不要扩成`JSON.stringify(window)`。

## 文档工具与验收
[汇编清单](book-manifest.json)明确00、01～08、受控索引、交接包、任务卡与审查报告的顺序。`tools/build_book.py`按清单拼接原文，以分隔线分章；合订中的章节链接仍指向同目录编辑源，不重写标题锚点。`--check`发现源与合订不同直接非零退出，不改文件。

执行 `python G_docs/X-GAMe/tools/validate_book.py`：检查显式章节齐全、所有本书Markdown相对文件链接、片内锚点、任务所有权无重叠、共享文件只有集成人、合订与源逐字节一致。该脚本不联网验证外链，也不能替代人工规则审校。

## 异常、回滚与后续维护
发现锚点丢失、CFG键缺失、文件重叠或差异未登记，应阻断交接。先修编辑源再重建合订；不能只修生成副本。文档回滚只回退本轮确认属于自己的块或文件，保留用户其他修改。运行代码回滚必须在未来批准批次中逐文件制定，禁止`reset --hard`与`clean`。

当前快照、链接和所有权以[审查报告](review-report.md)实际执行结果为准。未来每次批准变更都要同步受影响分章、差异记录、快照与合订；不重写历史测试原件。
