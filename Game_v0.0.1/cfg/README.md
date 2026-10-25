# cfg/ —— 数据真源目录

> 口径铁律：数值一律进配置表，逻辑里不硬编码（与 HTML 版 `js/config.js` 的 `CFG` 同规）。

本目录存放从 HTML 版 `js/config.js` 的 `CFG` 导出的 JSON 数据表，按模块拆分：

| 计划文件 | 来源（js/config.js） | 归属模块 |
|---|---|---|
| `skill_system.json` | `CFG.skillSystem` | mods/jes-skill-crystal |
| `heroes.json` | `CFG.heroes` | mods/jes-heroes |
| `monsters.json` | 怪物表 | mods/jes-engine-core |
| `levels.json` | 关卡表 | mods/jes-engine-core |
| `endless.json` | `CFG.endless` | mods/jes-endless |
| `season.json` | `CFG.season` | mods/jes-season |
| `economy.json` | 经济/芯片表 | mods/jes-inventory |
| `ui.json` | UI 常量 | mods/jes-engine-core |

导出工具：P2 阶段提供 `tools/export_cfg.mjs`（Node 读 js/config.js → 写本目录）。
加载方：`autoload/cfg.gd`（启动时全量读入 `Cfg.tables`）。

规则：
- 一个 JSON 文件 = 一张表 = 一个模块消费；跨模块读表先回 `docs/迁移总纲_v1.md` 登记。
- 键名保持英文（机器匹配），注释与说明写在 HTML 版源表里，不复制到 JSON。
