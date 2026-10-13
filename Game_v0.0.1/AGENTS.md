# AGENTS.md —— 新会话第一份要读的文件

> **2026-10-12 文档编书入口**：[X-GAMe项目书](G_docs/X-GAMe/README.md)。需要开发参考时先按阅读地图进入分章，再按触发条件回查已批准合同；分章与受控附录为编辑源，合订由显式清单生成。书稿与未批准提案不高于原批准规则，代码只裁定实现事实。
> **本轮范围**：仅`F:/AI-Game/Game_v0.0.1`内文档、证据与只读核验，不改运行代码、不commit/push/部署、不派发未来任务。下文发布流程用于获授权的代码交付，不能触发本轮发布。
> **历史基线说明**：下文旧版号/93套4083/skill14或17等保留历史含义；本次已有全量绿测为94套/PASS4111/bad0、skill18，另有一次旧路径红测未诊断。当前CFG启用H001、十个技能文件（含playtest），verify_clone声明23个指纹但是否匹配以本轮审查结果为准。旧W0的9文件描述仍属历史批次。
> **共享所有权**：config/core/index/css与game/main/combat/items/modes/run_tests全部只归主集成人串行处理；具体互斥卡见书内交接包。


> **读这份就够恢复了。** 不要一上来整读 `js/` 下的文件（最大的有 2000 行）。
> 需要细节时按「第四节 常用定位表」走：`grep -n` 定位 → `Read offset/limit` 局部读。

---

## 一、项目速览

**《弹幕射击 Roguelike × 背包肉鸽 × 轻度搜打撤》** —— 纯静态 HTML5 Canvas 游戏，竖屏优先（390×844）。

| 项 | 值 |
|---|---|
| 技术栈 | 纯静态 HTML + 全局脚本（**无模块化/无打包**）+ Canvas 2D |
| 语言风格 | ES5/ES6、`"use strict"`、**中文注释**、`CFG` 收口所有数值 |
| GitHub 仓库（唯一真源） | `https://github.com/sg229552371/9-28-WorkBuddy-Game-CCG`（私有 · `main`）|
| 工作区（云端沙箱） | `/workspace/9-28-WorkBuddy-Game-CCG` |
| 工作区（PC 本地 · 当前） | `F:/AI-Game` |
| 工作区（另一台 PC · 历史） | `D:/AI-game-All/HTML_TEST_002` |
| **试玩链接（正式·主入口）** | `https://bagrogue-shooter-85672.app.workbuddy.host/`（WorkBuddy 托管站 · 国内手机优先）|
| ⚠️ 已冻结域名 | `bagrogue-shooter.app.workbuddy.host` / `ae6c0d4fb9b5c352d.app.workbuddy.host`（**别再写**）|
| 试玩链接（备用·自动最新） | `https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/`（Pages · push 即生效）|
| 门禁 | `bash run_tests.sh`（当前实测 **106 套 / PASS4494 / bad=0**；94套/4111、93套/4083 为历史基线）· `bash run_tests.sh --quick` |
| 交付 | 每轮：门禁全绿 → commit → push → **重新发布托管站（从仓库根 `F:/AI-Game`）** → 给的试玩链接 |

> ⚠️ **托管站是独立部署，不会自动跟随 GitHub**。用户以它为主入口 → 每轮改完 **必须重新发布**，否则手机上玩到的是旧版（此坑已踩过一次）。
> ⚠️ **重新发布必须从仓库根 `F:/AI-Game` 发布**（主入口 app 绑定的是仓库根；根 `index.html` 是跳转壳 → `Game_v0.0.1/index.html`）。从 `Game_v0.0.1/` 目录直接发布会**新建一个 app/新链接**（实测得到 `bagrogue-shooter-08025…`），而不是更新主入口。

### 铁律（违反必出事）

1. **数值一律进 `CFG`**（`js/config.js`），逻辑里不硬编码
2. **新增逻辑放文件末尾独立区块**；现有函数只插**单行调用**（§5.45）
3. **多代理并行时文件所有权切分**：每代理独占文件集，禁跨文件改
4. **门禁口径**：每项 `exit=0 且 bad=0`；**PASS 文案绝不能含英文 "error"**（用中文「错误」）
5. **CSS 改动必须三处同步**：主规则 / `@media (orientation: portrait)` / `body.portrait`
6. **改任何 js 脚本后要 bump 版本号**：`index.html` 里 10 处 `?v=YYYYMMDD` + `<meta name="app-version">`
7. **拍板即回写**（🔴 2026-10-12 立规）：用户每做一次取舍 → 当轮**必须** ① 在 `G_docs/decision_log_v1.md` **新增一行**；② 在**权威章节**做**替换或新增**（玩法 → `game_design_proposal.md`；机制 → `dev_guide.md`；工程 → 合同/接口文档）；替换时旧表述加「**已被取代**」横幅。
   **禁止只把拍板记在对话里**——依据 `plan_architecture_and_ai_development_v1.md` §5/§6。

---

## 二、文件地图（`js/` 34 个文件）

加载顺序 = 下表从上到下（**index.html 里的脚本序，改动前务必对齐**，`index.html` 共挂 33 个 `<script src="js/...">`）。
`js/skill-*.js`（17~26）为 **22.x 能量水晶技能系统**，必须在 `js/main.js`（27）**之前**加载。

> 🔑 **开发规范 + 并行开发手册 = `G_docs/dev_standard_and_playbook.md`**（技术约定 / 铁律 / 门禁 / 交付流程 / **多线程并行六步法**）。
> 动手改代码或拆并行任务**先读它**。
> 🔑 **技能系统总纲 = `G_docs/skill_system_master_v1.md`**（文档权威层级 / 核心规则 / 代码落点 / 进度 / 缺口）。
> 做技能系统相关开发**先读它**；不确定的规则/字段一律回查真源，**别凭记忆联想**。
> 📌 **玩法规则唯一蓝图 = `G_docs/game_design_proposal.md`**；**当前唯一技能方向 = 其第二十章「能量水晶技能系统」**（旧章节均已标注取代）。
> 下表为**主链路** 27 个；另有 7 个未列表：`endless-affix.js` / `endless-arena.js` / `endless-record.js` / `endless-team.js` / `ui-abyss.js` / `ui-abyss-pause.js` / `assets_manifest.js`。
> ⚠️ 表中「行数」为**近似值**，会随版本变化；以 `wc -l` 实测为准。

| # | 文件 | 行数 | 职责 | 关键符号 |
|---|---|---|---|---|
| 1 | `config.js` | 3132 | **纯数据表**（英雄/怪/遗迹秘宝/关卡/曲线/UI 常量/**`CFG.skillSystem`**）| `CFG` |
| 2 | `core.js` | 595 | 工具 / 事件总线 / 空间哈希 | `U`、`EventBus`、`SpatialHash` |
| 3 | `pool.js` | 120 | 通用对象池 | `Pool.makePool` |
| 4 | `game.js` | 1521 | **全局状态 G** / run 构建 / 存档 Meta / 玩家·队友·无人机 | `G`、`Meta`、`createRun`、`Player` |
| 5 | `items.js` | 1130 | 背包 / 装备 / 遗迹秘宝 / 属性计算 | `Inventory`、`recomputeWeapon`、`computeStats` |
| 6 | `combat.js` | 1134 | 战斗结算 / 技能 / 弹幕 / 特效 | `SkillSystem`、`damageMonster`、`explode`、`FX` |
| 7 | `modes.js` | 993 | 关卡机制 / 毒圈 / 撤离 / 赛季 / 深渊门 | `updateExtractJudge`、`enterEndless` |
| 8 | `render.js` | 771 | 渲染全部 | `render`、`renderCity`、`renderHazard` |
| 9 | `stress.js` | 356 | 性能压测场景（`?stress=` 直达）| `StressHarness` |
| 10 | `endless.js` | 289 | **无尽模式核心**（波次/刷怪/难度曲线）| `Endless` |
| 11 | `hud_endless.js` | 125 | 无尽 HUD（左上角三项）| `renderEndlessHud` |
| 12 | `ui.js` | 1008 | UI 基础（屏幕切换/HUD/选人/首页）| `UI`（`const UI = {...}`）|
| 13 | `ui-screens.js` | 1164 | UI 屏幕层（主城/工匠/图鉴/背包/结算）| `Object.assign(UI, {...})` |
| 14 | `ui-panels.js` | 464 | UI 面板（TIPS/立绘/赛季/无尽面板）| 挂 `UI.*` |
| 15 | `quality.js` | 306 | 画质三档 + 自动降档 + 性能护栏 | `PerfGuard`、`_defaultQuality` |
| 16 | `rewards.js` | 311 | 无尽奖励 / 结算包装（monkey-patch）| `EndlessReward` |
| 17 | `skill-config.js` | 870 | 技能配置校验器（21 原因码 / 冻结 / 策略解析）| `SkillConfig` |
| 18 | `skill-compiler.js` | 959 | 辅助编译器（6 阶段 / 4 执行器 / 合并全序 / 图校验 / 技能安装预览）| `SupportCompiler` |
| 19 | `skill-damage.js` | 381 | 伤害公式 + 五类命中额度 + 区域积分 | `SkillDamage` |
| 20 | `skill-events.js` | 323 | 事件队列（FIFO / 深度·预算护栏 / 去重）| `SkillEvents` |
| 21 | `skill-scheduler.js` | 234 | 每技能独立冷却 / 索敌（`maxRange`）/ 无目标施放（`requiresTarget`）/ 施放快照 | `SkillScheduler` |
| 22 | `skill-runtime.js` | 828 | 运行时九段单步 / 扫掠碰撞 / 派生 / 回收 | `SkillRuntime` |
| 23 | `skill-reward.js` | 412 | 奖励事务（合并池 / 升级 / 满槽 / 兜底）| `SkillReward` |
| 24 | `skill-presenter.js` | 294 | 面板矩阵 / 详情文案 / 原因码中文化 | `SkillPresenter` |
| 25 | `skill-save.js` | 212 | 存档序列化 / 迁移报告 / 幂等补偿 | `SkillSave` |
| 26 | `skill-playtest.js` | 454 | **技能系统试玩通电**（`?skill=` 才生效：开关+懒注入初始技能+雕像授予稀有技能+可视化叠加）| `SkillPlaytest` |
| 27 | `main.js` | 1292 | **宿主 Game** / 主循环 / 输入 / 启动 | `Game`、`loop`、`boot` |

> ⚠️ `ui.js` 的 `const UI` 只能定义一次；`ui-screens.js`/`ui-panels.js` 用 `Object.assign(UI, ...)` 挂载 → **必须后加载**。

---

## 三、常用定位表（「我要改 X → 去哪」）

| 我要改… | 文件 | 搜索关键词 |
|---|---|---|
| 任何数值/曲线/概率 | `config.js` | `CFG.<模块>` |
| 英雄属性/技能公式 | `items.js` | `computeStats`、`resolveSkill` |
| 伤害/暴击/命中结算 | `combat.js` | `damageMonster`、`calcDamage` |
| 怪物 AI / 移动 | `combat.js` 或 `game.js` | `Monster`、`update(` |
| 刷怪 / 波次 / 关卡节奏 | `modes.js`、`endless.js` | `spawn`、`waveCap` |
| 毒圈 / 撤离 / 补给 | `modes.js` | `hazard`、`extract`、`supply` |
| 渲染 / 性能 / 剔除 | `render.js` | `render`、`cullMargin` |
| 无尽模式玩法 | `endless.js` | `Endless.` |
| 无尽 HUD 显示 | `hud_endless.js` | `renderEndlessHud` |
| 界面布局 / 面板 | `ui.js`、`ui-screens.js` | `UI.renderXxx` |
| 画质 / 自动降档 | `quality.js` | `qualityLevel`、`_autoDowngrade` |
| 结算 / 奖励 / 结晶 | `rewards.js`、`modes.js` | `EndlessReward`、`publishCrystalReport` |
| 主循环 / 启动 / 输入 | `main.js` | `Game.loop`、`bindTouch` |
| **技能水晶：编译/配置** | `skill-compiler.js`、`skill-config.js` | `SupportCompiler.compile`、`CFG.skillSystem` |
| **技能水晶：伤害/命中/运行时** | `skill-damage.js`、`skill-runtime.js` | `SkillDamage.resolve`、`SkillRuntime.updateAll` |
| **技能水晶：奖励/存档迁移/UI 文案** | `skill-reward.js`、`skill-save.js`、`skill-presenter.js` | `SkillReward.build`、`SkillSave.migrate` |
| CSS 布局 | `css/style.css` | **记得三处同步**（铁律 5）|

---

## 四、门禁与验收

```bash
# 日常开发（快）
bash run_tests.sh --quick          # 3.4s，core + 冒烟
# 交付前（必须全绿）
bash run_tests.sh                  # 全量，93 套 / 4083 断言（含 skill 套件 17 个）
bash run_tests.sh --suite=skill    # SKILL 套件单跑（14 个）
bash run_tests.sh --suite=ui       # 单套件
bash run_tests.sh --list           # 列出套件
```

**判绿标准**：每项 `exit=0` 且 `bad=0`，汇总行 `PASS 合计 = N   bad = 0 / 全绿`。
`bad` = `grep -ci "Assertion failed\|FAIL\|Error"`。

**真机验收脚本**（Playwright，需先起 `python3 -m http.server 8123`）：
`render_opt_check.py`（渲染帧耗）· `stress_check.py`（压测三档）· `endless_e2e_check.py`（无尽全链）· `quality_ui_check.py`（画质设置页）

---

## 五、血泪坑（详情看 `G_docs/dev_guide.md` 第 10.3 节，共 31 条）

最常踩的 6 条：
- **坑 4**：PASS 文案含英文 "error" 会让门禁误判失败
- **坑 5**：新增逻辑必须放文件末尾独立区块，现有函数只插单行调用
- **坑 1**：CSS 三处同步（**多个** portrait 媒体块，改前先数清楚）
- **坑 13**：`CFG.heroes[i]` 索引是全库隐性契约，物理序不可动（展示序走 `heroDisplayOrder`）
- **坑 16**：复用真实类铺场（压测/无尽）必须 `isMain=false` + 自定义 kind 才走空世界分支
- **坑 21**：创建独立模式世界必须复用 `startRun` 建完整 run 上下文，否则渲染崩

---

## 六、交付流程（每轮）

1. 定方案（写 `G_docs/plan_*.md`）→ 用户确认关键选项
2. **多代理并行开发**（按 `G_docs/dev_standard_and_playbook.md` §5 六步法：文档冻结 → 主会话冻结共享文件 → 拆子任务 → 并行 → 串行集成）
3. `bash run_tests.sh` 全绿 + 真机 e2e 验证
4. **决策回写**（铁律 7）：本轮所有拍板 → `G_docs/decision_log_v1.md` 新增行 + 权威章节更新（新决策 2026-10-12 起强制）
5. **同步文档**：玩法变 → `game_design_proposal.md`（旧表述加「已被取代」横幅）；机制变 → `dev_guide.md`；技能变 → `skill_system_master_v1.md`；数字变 → 各 README / `verify_clone.sh`
6. commit → push 到 GitHub（远程 `main`；异地自检用 `bash verify_clone.sh`）
7. **重新发布托管站**（WorkBuddy 托管站是独立部署，不跟随 GitHub）→ **给的试玩链接**

## 七、归档位置

| 内容 | 位置 |
|---|---|
| 历史 patch | `/workspace/00NN-*.patch` + `/workspace/archive/` |
| 旧截图 | `/workspace/*.png` + `/workspace/archive/` |
| 旧轮次 dev_guide | `G_docs/archive/` |
| 重构前快照 | `/workspace/archive/js_pre_refactor_21_16/` |

