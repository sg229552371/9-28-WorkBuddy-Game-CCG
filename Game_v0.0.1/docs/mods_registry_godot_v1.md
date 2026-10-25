# Godot 侧模块注册表 v1

> 唯一真源：Godot 工程（仓库根目录）的模块登记。HTML 侧注册表见 `HTLM/G_docs/mods_registry_v1.md`。
> 口径：平铺、`jes-` 前缀、模块不嵌套、新增/移动模块先登记。
> 全仓库决策日志唯一真源 = `HTLM/G_docs/decision_log_v1.md`。

| 模块 | 状态 | 内容 | 对应 HTML 真源 |
|---|---|---|---|
| `mods/jes-engine-core/` | ✅ P1 完成 | spatial_hash.gd / object_pool.gd / main.gd（变步长双钳制主循环）+ boot 自检场景 | js/core.js、js/pool.js、js/main.js |
| `mods/jes-skills/` | 🚧 骨架就绪（来自 skill-editor-godot-V201） | systems/skills+perf、content/gems（active/supports/triggers）、sandbox、tools、docs 三分区 | HTLM/mods/jes-skill-crystal（P3 对接 skill-*.js 对译产物） |
| `mods/jes-babel/` | 🚧 ✅ B/C/D 完成（主流程收口） | SRPG《巴别回路》核心：board_grid.gd（11×9 棋盘/5 形状取格）/unit_state.gd/combat_resolver.gd（朝向盾/护盾/wet/AoE/神罚）/turn_manager.gd（回合状态机）；数据表 cfg/srpg_*.json ×8 | docs/SRPG组队肉鸽策划书_v1.md |
| `tests/unit/` | ✅ GUT 门禁 | 19 用例（spatial_hash / object_pool / game_state） | mods/jes-quality-perf/tests/pool_test.js 等口径 |

## 改名记录

| 日期 | 变更 | 依据 |
|---|---|---|
| 2026-10-24 | `jes-engine-core-团队肉鸽-v0.0.01` → `jes-engine-core` | 口径「作者-功能」命名：引擎核心不含玩法语义；「团队肉鸽」是游戏定位，不是模块功能名。project.godot 主场景与测试 preload 路径同步修复 |
| 2026-10-24 | 技能模块定名 `jes-skills`（制作人拍板） | 对齐参考项目技能编辑器模块，HTLM 侧 jes-skill-crystal 保持不变 |
