# mods 模块注册表 v1（唯一真源）

> **口径来源**：沿用 `skill-editor-godot-V201/docs/目录结构与模块口径_v1.md` 的规则——
> `mods/` 下平铺，一个目录 = 一个模块，命名 `作者-功能`（作者前缀 `jes`），模块之间不嵌套。
> **新增/移动模块前必读本文；新增模块必须在下表登记，否则视为不存在。**
> 裁定：制作人（金弋顺）2026-10-24 批准全量归档方案；执行记录见 `decision_log_v1.md`。

---

## 一、总原则

**`js/` = 引擎核心层（游戏宿主），`mods/` = 玩法功能模块。**
引擎不是玩法模块，不进 mods（与参考项目 `project.godot/addons` 留根目录同构）。
模块内标准形态：`systems/`（运行时 js）、`tests/`（测试）、`tools/`（py 工具）、
`docs/_AI开发与文档/`（模块设计文档）——按需建，不塞空目录。

## 二、模块注册表

| 模块目录 | 功能 | 状态 | systems（js） | 依赖 | 说明 |
|---|---|---|---|---|---|
| `mods/jes-skill-crystal` | 技能水晶系统 | 正式 | 10 个 `skill-*.js` | 无尽（加载序在其后） | 22.x 能量水晶技能系统；接口契约见 `docs/_AI开发与文档/skill_system_interface_v1.md`；设计正本见同目录 `技能系统V0.0.2/` |
| `mods/jes-endless` | 无尽/深渊模式 | 正式 | `endless.js`、affix/arena/record/team、`hud_endless.js`、`ui-abyss*.js`（8 个） | 引擎核心 | 波次/词缀/祭坛/组队/战绩/HUD/深渊 UI |
| `mods/jes-rift` | 裂隙撤离 | 正式 | 无（逻辑在引擎 `modes.js`） | 引擎核心 | 仅收测试/工具/文档；抽取玩法判定在 `js/modes.js` |
| `mods/jes-season` | 赛季系统 | 正式 | 无（逻辑在引擎 `modes.js`） | 引擎核心 | 赛季循环与结算 |
| `mods/jes-heroes` | 英雄体系 | 正式 | 无（逻辑在引擎 `game.js/items.js`） | 引擎核心 | 12 角重做、自动战斗、头像立绘 |
| `mods/jes-inventory` | 背包/装备/经济 | 正式 | 无（逻辑在引擎 `items.js`） | 引擎核心 | 背包、芯片、经济、升级、经济保险 |
| `mods/jes-artisan` | 工匠系统 | 正式 | 无 | 引擎核心 | 工匠合成 UI 与逻辑测试 |
| `mods/jes-city` | 主城/商店/解锁 | 正式 | 无 | 引擎核心 | 商店、解锁按钮/信息、NPC |
| `mods/jes-quality-perf` | 画质与性能 | 正式 | 无（`js/quality.js` 留引擎层） | 引擎核心 | 画质三档、性能压测、渲染优化 |
| `mods/jes-engine-core` | 引擎核心（宿主） | 正式 | 无（宿主 js 留 `js/`） | — | smoke/战斗规则/Boss/UI/移动端/关卡内容/资源加载等宿主级测试与文档 |

> 依赖栏口径：mods 玩法 js 由 `index.html` 按固定顺序加载（在引擎 js 之后）；
> 跨模块读取一旦确认，必须回本文登记并说明读取方式。

## 三、加载顺序（index.html script 序，改动前必对齐）

1. `js/` 引擎 16 个：config → core → pool → game → items → combat → modes → render → stress
2. `mods/jes-endless/systems/` 8 个：endless → hud_endless → ui → ui-screens → ui-panels → quality → rewards → affix/arena/record/team → ui-abyss*
3. `mods/jes-skill-crystal/systems/` 10 个：skill-config → compiler → damage → events → scheduler → runtime → reward → presenter → save → playtest
4. `js/main.js` 最后（宿主启动）

## 四、门禁

`bash run_tests.sh`（106 套，测试已分散在 `mods/*/tests/`，运行器自动按名字全 mods 搜索；
根目录裸名仍兼容）。判绿标准不变：每项 `exit=0` 且 `bad=0`。
