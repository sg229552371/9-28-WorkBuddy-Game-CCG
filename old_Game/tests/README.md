# 测试索引

**全部测试平铺在本目录 `tests/`**（2026-10-12 从仓库根移入；运行命令不变）。
运行方式：

```bash
bash run_tests.sh          # 全量 94 套（推荐）
node tests/<name>_test.js  # 单项（需在仓库子目录根执行）
```

> 目录内现有 **94 个 `_test.js`**，门禁**全部编排（94 套）**，口径统一、无差集。
> 🔑 **技能系统 18 套**（`skill_*` 等）的总纲索引见 `G_docs/skill_system_master_v1.md`。
>
> 🗂 **2026-10-12 瘦身**：测试从仓库根移入本目录。为不破坏测试内的相对路径，
> 所有 `path.join(__dirname, "js", ...)` 已改写为 `path.join(__dirname, "..", "js", ...)`；
> `run_tests.sh` 已内置 `cd "$(dirname "$0")"` 并改跑 `tests/<name>_test.js`，
> 从任意目录调用都正常。**新增测试请放进本目录，并在 `run_tests.sh` 里写裸文件名。**
>
> 历史注记（2026-10-09 已纠正）：21.20「层级退役」曾把 `endless_affix_test` /
> `endless_arena_test` / `endless_record_test` / `endless_team_test` 连同真正已下线的
> `endless_tier_test` 一起从门禁摘掉。但**前 4 个模块至今仍被 `index.html` 加载并在运行**
> （`EndlessRecord` 就是战绩榜在用的模块，被调用 10 处），摘掉等于白丢 115 条覆盖 ——
> 已全部加回。**别再把它们当成「死测试」。**
> 下面的分类索引目前只覆盖其中一部分（**待补全**）。

> **判绿标准**：`exit=0` 且 `bad=0`。`bad` 由 run_tests.sh 用
> `grep -ci "Assertion failed\|FAIL\|Error"` 统计 —— 所以**测试 PASS 文案里不要出现英文 `error`**。

---

## 核心链路（冒烟 / 运行 / 存档）

| 文件 | 覆盖内容 |
|---|---|
| `smoke_test.js` | 全链路冒烟：启动 → 出征 → 战斗 → 撤离 → 回城 |
| `runtime_test.js` | 运行时主干：读条、判定圈、通关结算 |
| `mobile_test.js` | 竖屏适配：触屏控件、缩放、safe-area |
| `bugfix_test.js` | 历史 bug 回归防线（各修复的防复发断言） |

## 战斗系统

| 文件 | 覆盖内容 |
|---|---|
| `boss_test.js` | Boss 战：阶段切换、技能、结算 |
| `boss_ux_test.js` | Boss 体验四件套：贴图区分 / 吞噬反馈 / 招式名横幅 / 转阶段宝箱 |
| `laser_test.js` | 激光/射线类武器 |
| `freeze_test.js` | 冻结机制 |
| `exp_test.js` | 经验与升级结算 |
| `levelup_test.js` | 升级弹窗、英雄池候选、入槽逻辑 |
| `autofight_test.js` | 自动战斗 / 托管逻辑 |

## 技能 · 遗迹秘宝 · 卡牌

| 文件 | 覆盖内容 |
|---|---|
| `skill_table_test.js` | 技能表全量（AT101~233）数据校验 |
| `skill_module_test.js` | 技能模块槽：装载、词条、浮窗 |
| `team_trigger_test.js` | 小队技能触发链 |
| `chip_test.js` | 遗迹秘宝体系 |
| `chip_behavior_test.js` | 遗迹秘宝行为（触发、叠层） |
| `shop_test.js` | 商店：刷新、卡牌售卖 |
| `grant_test.js` | 奖励发放链路 |

## 背包 · 经济 · 成长

| 文件 | 覆盖内容 |
|---|---|
| `backpack_test.js` | 背包：格子、堆叠、重量 |
| `econ_test.js` | 局内外资源转化 |
| `meta_growth_test.js` | 局外成长：升级曲线、材料 |

## 关卡 · 撤离 · 地图

| 文件 | 覆盖内容 |
|---|---|
| `level_content_test.js` | 关卡 3→10 内容、毒圈/补给配置 |
| `level_tuning_test.js` | 难度曲线单调性、数值区间、配置自检 |
| `extract_test.js` | 撤离：波次、护盾、负重读条 |
| `rift_test.js` | 裂隙子地图 |
| `artisan_test.js` | 工匠地图（无敌人）与属性卡牌 |

## 角色 · 界面 · 流程

| 文件 | 覆盖内容 |
|---|---|
| `hero_roster_test.js` | 12 角铺量、定位分组（4/4/4）、解锁规则 |
| `hero_kit_test.js` | 属性说明表（statNames/statDesc）、近战扇形引擎、特色技能零重复、`scaleBy` 属性成长、辅助三件套 |
| `unlock_ui_test.js` | 解锁链路 UI（选人置灰、结晶解锁） |
| `ui_flow_test.js` | 界面流转：首页 → 主城 → 出征 |
| `ui_v2_test.js` | UI 重构（v2）全量 |
| `content_test.js` | 内容表数据完整性 |

## 素材 · 性能 · 稳定性

| 文件 | 覆盖内容 |
|---|---|
| `audio_sprite_test.js` | 音效（WebAudio 程序化合成）与精灵装载 |
| `sprite_view_test.js` | 36 精灵键渲染视图 |
| `perf_test.js` | 压测报告：100 子弹/80 特效/80 角色（自包含，不 require 源码） |
| `perf_asset_test.js` | 素材加载：fit 代理图算法、分帧、进度契约 |
| `perf_guard_test.js` | PerfGuard 帧护栏、诊断面板 |
| `boot_guard_test.js` | 首屏看门狗、错误面板、内联兜底 |
| `cache_version_test.js` | 版本号、缓存自愈强刷 |

---

## 新增测试的流程

1. 在**本目录（`tests/`）**建 `<name>_test.js`（参考现有文件的 `vm` 沙箱写法）。
2. 输出格式：每行 `PASS xxx` / `失败 xxx`，末尾打印 `PASS 合计 = N   失败数 = M`，
   且 `M > 0` 时 `throw` 让进程非零退出。
3. **手动把裸文件名（不带 `.js`）加入 `run_tests.sh` 对应套件变量**（`CORE` / `UI` / `FEATURE` / `PERF` / `SKILL`）。
4. 跑 `bash run_tests.sh` 确认全绿。
