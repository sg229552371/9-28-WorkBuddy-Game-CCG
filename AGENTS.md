# AGENTS.md —— 新会话第一份要读的文件

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
| 工作区（PC 本地） | `D:/AI-game-All/HTML_TEST_002` |
| 试玩链接（正式·唯一） | `https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/` |
| 门禁 | `bash run_tests.sh`（全量 63 项 / 2928 断言）· `bash run_tests.sh --quick` |
| 交付 | 每轮：门禁全绿 → commit → patch → 发布 → 给的试玩链接 |

### 铁律（违反必出事）

1. **数值一律进 `CFG`**（`js/config.js`），逻辑里不硬编码
2. **新增逻辑放文件末尾独立区块**；现有函数只插**单行调用**（§5.45）
3. **多代理并行时文件所有权切分**：每代理独占文件集，禁跨文件改
4. **门禁口径**：每项 `exit=0 且 bad=0`；**PASS 文案绝不能含英文 "error"**（用中文「错误」）
5. **CSS 改动必须三处同步**：主规则 / `@media (orientation: portrait)` / `body.portrait`
6. **改任何 js 脚本后要 bump 版本号**：`index.html` 里 10 处 `?v=YYYYMMDD` + `<meta name="app-version">`

---

## 二、文件地图（`js/` 14 个文件）

加载顺序 = 下表从上到下（**index.html 里的脚本序，改动前务必对齐**）。

| # | 文件 | 行数 | 职责 | 关键符号 |
|---|---|---|---|---|
| 1 | `config.js` | 2032 | **纯数据表**（英雄/怪/芯片/关卡/曲线/UI 常量）| `CFG` |
| 2 | `core.js` | 595 | 工具 / 事件总线 / 空间哈希 | `U`、`EventBus`、`SpatialHash` |
| 3 | `pool.js` | 120 | 通用对象池 | `Pool.makePool` |
| 4 | `game.js` | 1521 | **全局状态 G** / run 构建 / 存档 Meta / 玩家·队友·无人机 | `G`、`Meta`、`createRun`、`Player` |
| 5 | `items.js` | 1130 | 背包 / 装备 / 芯片 / 属性计算 | `Inventory`、`recomputeWeapon`、`computeStats` |
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
| 17 | `main.js` | 1224 | **宿主 Game** / 主循环 / 输入 / 启动 | `Game`、`loop`、`boot` |

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
| CSS 布局 | `css/style.css` | **记得三处同步**（铁律 5）|

---

## 四、门禁与验收

```bash
# 日常开发（快）
bash run_tests.sh --quick          # 3.4s，core + 冒烟
# 交付前（必须全绿）
bash run_tests.sh                  # 8.6s，2661 断言
bash run_tests.sh --suite=ui       # 单套件
bash run_tests.sh --list           # 列出套件
```

**判绿标准**：每项 `exit=0` 且 `bad=0`，汇总行 `PASS 合计 = N   bad = 0 / 全绿`。
`bad` = `grep -ci "Assertion failed\|FAIL\|Error"`。

**真机验收脚本**（Playwright，需先起 `python3 -m http.server 8123`）：
`render_opt_check.py`（渲染帧耗）· `stress_check.py`（压测三档）· `endless_e2e_check.py`（无尽全链）· `quality_ui_check.py`（画质设置页）

---

## 五、血泪坑（详情看 `G_docs/dev_guide.md` 第 10.3 节，共 24 条）

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
2. 多代理并行开发（文件所有权切分）→ 集成
3. `bash run_tests.sh` 全绿 + 真机 e2e 验证
4. 补 `G_docs/dev_guide.md`（当轮一句话 + 新坑）
5. commit → `git format-patch` 导出到 `/workspace/00NN-*.patch`
6. `node <发布skill>/scripts/publish.js --dir <项目>` 发布 → **给的试玩链接**

## 七、归档位置

| 内容 | 位置 |
|---|---|
| 历史 patch | `/workspace/00NN-*.patch` + `/workspace/archive/` |
| 旧截图 | `/workspace/*.png` + `/workspace/archive/` |
| 旧轮次 dev_guide | `G_docs/archive/` |
| 重构前快照 | `/workspace/archive/js_pre_refactor_21_16/` |
