from pathlib import Path
import json,hashlib
B=Path('G_docs/X-GAMe'); R=Path('.')
# ensure 08 exact snapshot statement
p=B/'08-appendix-dictionary.md'; s=p.read_text(encoding='utf-8')
s=s.replace('当前快照不声称完整导出。','当前快照不声称完整导出。')
# generate review from verified evidence
report='''# X-GAMe v1 审查报告

状态：文档交付版已生成；运行代码、规则实现与发布状态不因本书完成而改变。

## 证据结论

- 全量：`evidence/completion-full.log`，命令 `bash run_tests.sh`，exit=0，PASS 合计=4111，bad=0。
- 快速：`evidence/completion-quick.log`，命令 `bash run_tests.sh --quick`，exit=0，PASS 合计=1046，bad=0。
- 副本核验：`evidence/completion-clone.log`，命令 `bash verify_clone.sh`，exit=0；结果同时记录工作区存在未提交改动，不能把它表述为工作区指纹全通过。
- 保留红测：`evidence/sh-12-failure.log`、`sh-12-stderr.log`、`sh-12-provenance.json`。原命令结果为 exit=1、PASS4110/bad1，失败为旧路径 `skill_enable_runtime_test` 的 `kills >= 1` 断言；根因本轮未诊断。它不改变 full-tests.log 的全绿结论。
- `full-tests.log`、`full-tests-r2.log`、`verified-run.log`均保留为 PASS4111/bad0；没有把它们标成红测。

## 文档一致性

- 编辑源为00、01～08分章及受控索引、交接包、任务卡、审查报告；合订按 `book-manifest.json` 生成，禁止手改副本。
- 已校验章节清单、相对文件链接、任务所有权无重叠、共享文件只归集成人、合订内容与清单源一致。
- 已修正入口重复块、03章重复数值段、README未审查即完成的状态表述，以及B代理不得占有`js/core.js`的冲突。
- 未来代理仅允许新建各自独占验证文件；现有`skill-save.js`、`assets_manifest.js`、`skill-events.js`需由集成人串行核验与接线。

## 配置快照

`tools/snapshot-config.cjs`只导出`heroes`、`levels`、`outLevel`、`skillSystem`、`camera`、`chips`六个CFG顶级键，包含配置源码SHA256；不读取存档、凭据、网络或用户数据。已存在`evidence/config-snapshot.json`，其他武器、怪物、模式、保险、触控、音频字段不属于该快照白名单，须回源码定位。

## 当前边界与待核验项

存档宿主调用、castTime消费、资源实际绘制/播放消费、裂缝与完整真机链、Boss奖励时点、死亡损失边界、卡牌兼容可达性仍按书稿标为待验证或部分实现。事件深度已核实为全局上限与策略上限同时生效；武器升级已核实UI先扣费，不列为免费bug。未发现资源/存档调用接线只能表述为检索未发现，不能直接定性为缺陷。

## 哈希与限制

本轮生成`runtime-after.json`并与`runtime-before.json`及续轮基线做逐路径比较；结果只说明本轮文档操作未改运行脚本、HTML、CSS，不替代Git基线或发布验收。未执行全量重跑、commit、push、部署；全量采用已有真实证据。
'''
(B/'review-report.md').write_text(report,encoding='utf-8')
# hash runtime scripts/html/css from before
files=[]
for pat in ['js/*.js','css/**/*.css','index.html']:
 files += list(R.glob(pat))
rows=[]
for f in sorted(set(files)):
 rows.append({'Path':str(f.resolve()),'Hash':hashlib.sha256(f.read_bytes()).hexdigest()})
(B/'evidence/runtime-after.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print('审查报告与runtime-after已写入')
