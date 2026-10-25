# X-GAMe v1 审查报告

状态：v1文档交付完成。此结论只覆盖项目书与交接材料；运行实现、真机验收和发布状态不因本书完成而改变。

## 本轮真实测试

| 执行 | 开始—结束（北京时间，2026-10-12） | 结果 | 证据 |
|---|---|---|---|
| `bash run_tests.sh` | 16:54:17—16:55:13 | 94套，exit=0，PASS4111，bad=0 | [全量日志](evidence/completion-full.log)、[退出码](evidence/completion-full.exit) |
| `bash run_tests.sh --quick` | 16:55:13—16:55:31 | exit=0，PASS1046，bad=0；仅core与冒烟 | [快速日志](evidence/completion-quick.log)、[退出码](evidence/completion-quick.exit) |
| `bash verify_clone.sh` | 16:55:31—16:55:38 | exit=0；23项HEAD指纹检查，包含工作区脏状态提示 | [副本日志](evidence/completion-clone.log)、[退出码](evidence/completion-clone.exit) |

同目录`.started/.finished`保存各次时间。上述全量是在本轮编书任务中真实执行，最终审校没有再覆盖或重跑这些日志。副本检查不是工作树文件全通过证明，也不证明本副本获得发布身份。

保留[早先失败摘要](evidence/sh-12-failure.log)、[标准错误](evidence/sh-12-stderr.log)与[来源及SHA256](evidence/sh-12-provenance.json)：exit=1、PASS4110/bad1，`skill_enable_runtime_test`旧路径10秒`kills >= 1`断言失败，根因未诊断。该文件是原shell保留的摘要，不冒充完整逐套件红测日志。后续绿测不取消此稳定性风险。`full-tests.log`、`full-tests-r2.log`、`verified-run.log`另保留绿证据；其中`full-tests.exit`原始异常文本`0n`未改写，不作为有效退出码。

## 审查范围与结果

最终执行`tools/build_book.py`、`tools/validate_book.py`及`tools/build_book.py --check`。机器结果在[最终文档检查](evidence/document-validation-final.json)，包括13源清单、全部本书Markdown相对链接、锚点（当前无片内链接）、四代理新文件互斥、共享文件归集成人、测试文件存在性、快照源哈希、红测副本哈希、合订逐字节一致。入口文档仅检查本轮新增导航，不声称校验全部历史正文链接；外网链接不联网检查。

人工复核01—08章目的、规则、状态转换、边界、配置来源、代码符号、验收、当前状态与下一步；复核受控附录冲突说明及并行W0—W4依赖。书中系统验收步骤是未来操作要求，不能误读为本轮已跑真机。四个未来测试文件尚未创建，任务卡明确等待W1冻结。

修正：重复入口与经济段、将现有三个模块错误分配给代理的所有权、把配置值当批准设计的措辞、castTime/存档/资源过度完成表述。武器升级UI实际先扣费；事件全局及策略深度同时限制，均不再列为已证实缺陷。

## 工具失败与更正记录

中途`finalize_review.py`因已替换文本不存在抛ValueError；之后命令成功不抵消该失败。该文件及`finish_documents.py`、`complete_package.py`属于历史一次性工具，不可重跑，它们可能覆盖人工审查结果。维护仅使用README列出的汇编、校验与快照工具。

最终校验器曾因NUL字节无法解析，已重写并实际执行成功。早先哈希比较因摘要大小写及34/36文件范围混用产生误报；更正工具`tools/compare_runtime.py`分别按基线范围、BOM安全读取、统一摘要大小写。保留历史证据，不把误报解释为代码改动。

## 配置、实现差异与决策

[配置快照](evidence/config-snapshot.json)只导出heroes、levels、outLevel、skillSystem、camera、chips六个顶级键，附源码SHA256；不读取用户存档或凭据。其余数值按章节定位回CFG。当前技能enabled=true，仅H001迁入；版本标识20261046作为不透明版本串，不解释为日期。

保守裁决：维持原有弹幕射击、背包构筑、轻度搜打撤与静态Canvas技术栈；不新增联网商业化。项目书是开发参考入口与实现事实汇编；已批准细则仍按受控索引逐条适用并保持更高权威，未批准架构方案仍为提案。代码仅记录实现事实，不能自动推翻设计。书冻结与未来批次接口冻结分开，禁止跳过W1。

未解决：旧英雄路径红测根因、SkillSave宿主持久化闭环、castTime调度消费、资源清单实际绘制/播放链、裂缝/无尽真机全链、Boss结晶发放时点、死亡损失与旧规则冲突、卡牌兼容可达性。先核验再定最小修复；不能因搜索未发现就宣布缺陷。

## 运行文件与交付边界

[运行哈希比较](evidence/runtime-hash-comparison.json)：原始34JS和续轮36文件分别changed=[]、missing=[]。这证明对应基线范围内运行文件未改，不等于父仓库工作树全干净。Git范围检查仅见本副本文档入口与新书目录变化；未执行commit、push、部署或改父级其他版本。

可交付程度：可将README、合订本和并行交接包交给其他AI开展只读恢复、W1核验和批次冻结；不代表所有修复已获实现授权或可以直接同时开写，也不代表游戏可发布。全量通过与红测风险、未跑真机在同一报告保留。

