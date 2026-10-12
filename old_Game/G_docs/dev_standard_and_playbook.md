# 开发规范 & 并行开发手册 v1

> 建立日期：2026-10-12 ｜ 对应代码版本：`APP_VERSION 20261045` ｜ 门禁基线：**93 套 / PASS 4083 / bad = 0**
>
> **本文件是「怎么做开发」的唯一入口。** 把原先散在 `AGENTS.md`、`G_docs/dev_guide.md`、
> `skill_system_development_contract_v1.0.md` 三处的**规范**提炼到这里，并固化**多线程并行开发流程**。
> 新会话要动手改代码 / 拆并行任务 → **先读本文件**；要查玩法规则 → 读 `game_design_proposal.md`。

---

## 0. 文档体系地图（谁管什么，别读错）

| 文档 | 管什么 | 什么时候读 |
|---|---|---|
| `AGENTS.md` | 项目速览 + 文件地图 + 快速定位表 | **新会话第一份** |
| **`G_docs/dev_standard_and_playbook.md`（本文件）** | **开发规范 + 并行流程** | 动手开发 / 拆任务前 |
| `G_docs/game_design_proposal.md` | 玩法规则总蓝图（**当前唯一方向 = 第二十章 水晶系统**） | 查玩法规则 |
| `G_docs/dev_guide.md` | 铁律 / 血泪坑 / 逐轮变更表 / 机制基线 | 改具体机制前 |
| `G_docs/skill_system_master_v1.md` | 技能系统权威索引（技能相关先读它） | 改技能系统 |
| `G_docs/skill_balance_table_v0.1.md` | 技能数值平衡表（现状/基准/待填） | 调技能数值 |
| `G_docs/skill_ui_spec_v0.1.md` | 技能 UI 规格（装配页 + 详情） | 做技能界面 |
| `G_docs/skill_migration_map_v0.1.md` | 旧模块/遗迹秘宝 → 水晶 迁移映射 | 做迁移/存档 |
| `G_docs/plan_*.md` | 分线方案（性能 / 无尽 / 重构） | 做对应分线 |
| `tests/README.md` | 测试套件分类索引 | 找 / 加测试 |
| `G_docs/archive/` | 归档（已取代的旧设计稿，**勿据此开发**） | 只做历史追溯 |

**文档权威优先级（冲突时按此裁决，不要自行调和）**：
```
用户明确确认的铁律  >  工程合同（skill_system_development_contract_v1.0）
                 >  玩法真源（design_crystal_skill_system_v0.5）
                 >  旧设计与代码注释
```
外加一条：**代码是最终事实**——文档与代码不符时，**以代码为准并登记差异**。

---

## 1. 技术约定（硬约束，不许破）

- 纯 **ES5/ES6 全局脚本**，文件头 `"use strict"`；**无模块化、无构建工具、无框架、无 npm 依赖**。
- **数据驱动**：**可调数值一律进 `js/config.js`（`CFG`）**，逻辑里**禁止写死数值**。
- **通用逻辑独立成块**，原入口只插**单行调用**（便于并行与回滚）。
- 中文注释；改代码即**同步更新对应文档**（见 §4 交付流程）。

### 1.1 文件职责（决定改哪个文件）

| 文件 | 职责 |
|---|---|
| `js/config.js` | **全部策划配置表 `CFG`** |
| `js/core.js` | 工具 `U`、`EventBus`、`SpatialHash`、`Assets`、`SFX`（底层，慎改） |
| `js/game.js` | 实体与战斗（`G`、`Meta`、`Player`/`Monster`/`Bullet`/`Drone`/`World`） |
| `js/combat.js` | 伤害结算、技能执行器、`monsterCap` 等战斗闸门 |
| `js/items.js` | 物品/属性（`computeStats` / `companionStats` / `makeChip` / 结算折算） |
| `js/ui.js` `js/ui-screens.js` `js/ui-panels.js` | 界面渲染与交互（全局 `UI`） |
| `js/main.js` | 启动 / 输入 / 主循环 / 界面流程状态机（全局 `Game`） |
| `index.html` + `css/style.css` | DOM 界面层 + 样式（**深色主题**） |
| `js/skill-*.js`（9 个） | **22.x 能量水晶技能系统**（加载序在 `js/main.js` 之前） |

---

## 2. 铁律（每条都真踩过，破一条红一次）

1. **改 `js/` / `css/` 后必须 bump 版本号，共 3 处**：
   `index.html` 的 `<meta name="app-version">` + **所有 `?v=` 引用** + `js/core.js` 的 `Assets.buildVersion`
   （第三处由 `cache_version_test` 守）。否则手机会**缓存新旧混合版本**。
2. **门禁唯一入口 `bash run_tests.sh`**；判据 = **`exit 0` 且 `bad = 0`**，断言条数以真实输出 `PASS 合计` 为准（**不要推算**）。
3. **测试用 `console.assert`，失败只写 stderr、不改退出码**——只看「退出码 0」会漏判，必须 grep `Assertion failed`。
4. **测试的 `PASS` 文案里不能出现英文 `error` / `FAIL` 子串**——会被门禁 `grep -ci "FAIL\|Error"` 误算成 `bad=1`（改用中文或连字符）。
5. **写测试断言前先问「它可能恒真吗」**——`every` 对空数组恒 true（空真断言是本项目高频坑）。
6. **测试要断言「取值 = 配表里的值」这个关系，不要写死「当前具体取值」**（换皮/调数值后假红）。新自检**直读真实 `CFG`**，不要用自造桩。
7. **字段名必须冻结到「取值词表级」**（`cd` vs `cooldown`、`maxRange` vs `range`…）；词表不冻结 → **静默降级，门禁全绿但行为错**。
8. **判定「死测试」不能只看「在不在 `run_tests.sh` 里」**——要查 ① `index.html` 是否仍加载该模块 ② 暴露的全局名在 `js/` 里还有几处调用。否则会误删**仍在运行**模块的回归测试。
9. **给「持续型机制」加「暂停/冻结/一次性」语义 = 高危改动**，按 §5.4「三件套」处理。
10. **渲染类断言先 `Game.loop(t)` 踢一次主循环**，否则 `global.__raf` 未登记 → 立刻 `TypeError`。

---

## 3. 验证与交付流程（每次都走）

```bash
# ① 语法自检（改动的每个 js）
node --check js/xxx.js

# ② 单套件先跑（快速反馈）
bash run_tests.sh --suite=skill      # 或 core / ui / feature / perf
node xxx_test.js                     # 单文件直跑

# ③ 全量门禁（提交前必跑，约 2.5 分钟）——判据 exit=0 且 bad=0
bash run_tests.sh

# ④ 异地完整性自检（比对 17 个核心文件 blob 哈希 + 版本 + 基线）
bash verify_clone.sh

# ⑤ 交付
git add -A && git commit -F <说明文件>       # 或 /commit
git push origin main
# ⑥ 重新发布托管站（主入口，push 后必须做）+ 指纹复验
```

- **主入口（独立部署，push 后必须重新发布）**：`https://bagrogue-shooter-85672.app.workbuddy.host/`（app id `wbapp_qPgoWdEdXQ36MX55fqp4Ki`）
- **备用（push 后 1~2 分钟自动最新）**：`https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/`

---

## 4. 交付前的「文档同步」检查（防止文档与代码分叉）

改完代码，**逐项自问**：

- [ ] 玩法变了？→ 更新 `game_design_proposal.md` 对应章节（**旧表述加「已被取代」横幅**，见 §6）。
- [ ] 机制变了？→ 更新 `dev_guide.md` 的机制基线 + 逐轮变更表。
- [ ] 技能系统变了？→ 更新 `skill_system_master_v1.md`。
- [ ] 测试套件数 / 断言数变了？→ 更新 `README.md`、`tests/README.md`、`dev_guide.md §8`、`AGENTS.md`、`verify_clone.sh`。
- [ ] 版本变了？→ `.workbuddy/memory/MEMORY.md` 与 `verify_clone.sh` 的期望值。

> **原则：文档不是「事后补」，是交付物的一部分。** 主设计文档出现「新旧两套说法并存」= 必须立刻标注取代（见 §6）。

---

## 5. 多线程并行开发方法（**已两次验证，后续一律沿用**）

### 5.1 为什么能并行

本项目的冲突**几乎只出在两处**：① **共享文件**（`config.js` / `index.html` / `css` / `core.js`）；
② **字段名/词表没冻结**。把这两点治住，其余文件可以放心并行。

### 5.2 六步流程（**标准流程，照抄**）

```
① 文档冻结    把需求写成「设计规格 + 接口冻结」：谁拥有哪个文件、命名规范、
              数据结构、字段名（到取值词表级）、原因码。产出一份规格文档 + 一份接口文档。
①.5 开发规范  按本文件 §1~§3 明确技术约定与门禁（新系统还要写迁移与存档口径）。
② 主会话串行  冻结共享文件（config.js / index.html / css / core.js）：
              新增 CFG 区块、脚本位、样式、版本 bump —— 这些不能并行。
③ 拆子任务    每路「只新建独立文件」，彼此零共享文件冲突；每路一张子任务卡（见 §5.3）。
④ 多路并行    N 路同时开工，各自只碰自己新建的文件。
⑤ 主会话串行集成  只做「单行接线」：在主循环 / 原入口插单行调用（配幂等标记 / 原型包装）。
⑥ 门禁验证    bash run_tests.sh 全绿 + 发布。
```

**铁则**：**共享文件由主会话串行改，其余并行；每路只新建独立文件。** 违反 = 冲突。

### 5.3 子任务卡模板（每路一份，可直接复制）

```markdown
### W<n> · <任务名>
- 拥有文件（只准改这些，且优先「新建」）：js/w<n>-xxx.js
- 输入：<要读的配置 / 接口 / 已冻结的数据结构>
- 产出：<新文件 + 暴露的全局符号 + 对外 API>
- 接线方式：<原型包装 / 单行调用 / 幂等标记>（不许改共享文件）
- 验收：<断言清单；新增测试文件名；不得放松旧断言>
- 禁止：改 config.js / index.html / css / core.js / 其他 W 的文件
```

### 5.4 高危改动「三件套」（加暂停/冻结/一次性语义必做）

给「持续型机制」新增暂停/冻结/一次性闸门时，**既有测试的时间假设会失效**。三件套：

1. 相关字段在**构造函数里显式初始化**（避免取到 `undefined`）；
2. 旧测试**显式跳过 / 等待**该阶段（如 `rw.freezeTimer = 0`，或真实帧推进到解冻）；
3. **新增一个专项测试**覆盖新机制本身，**而不是放松旧断言**。

### 5.5 成功先例（按此复刻）

| 批次 | 并行路数 | 关键做法 | 结果 |
|---|---|---|---|
| **21.19 深渊搭建** | 7 路 | W0 冻结 `CFG.endless.*` + 两屏 + 样式；W1~W7 各建独立文件；W8 主会话六处单行接线 | 门禁 2949→3176 全绿 |
| **22.x 水晶技能系统** | 5 路 | W0 冻结 9 文件所有权 / 命名 / 12 API / 6 数据结构 / 21 原因码；W1~W5 各建独立文件；W6 串行集成 | 门禁 3365→3778，W6 抓到并修复 8 个跨模块缺陷 |

---

## 6. 文档「取代」规范（防止新旧并存）

**新系统一定替代旧系统。** 当旧表述失效时，**必须**在旧章节顶部加横幅（不要直接删，保留追溯）：

```markdown
> 🔴 **第 <N> 代模型 · 已被第 <M> 章取代（YYYY-MM-DD 标注）**：<哪部分失效>，
> 以 §<M> 为准。原文保留仅供追溯。
```

并在主设计文档的**状态说明章（§18）**登记到**取代表**里。
归档废弃文件时：移动到 `G_docs/archive/`，**并在文件顶部加「已归档 · 已被取代，勿据此开发」**。

---

## 7. 快速命令

```bash
bash run_tests.sh              # 全量门禁（93 套 / 4083 / bad=0）
bash run_tests.sh --quick      # 仅 core
bash run_tests.sh --suite=ui   # 单套件
bash run_tests.sh --list       # 列出套件
bash verify_clone.sh           # 异地完整性自检

# 技能系统当前激活状态（应为 enabled:false）
grep -n "enabled:\|migratedHeroIds\|initialSkillBindings" js/config.js | head

# 本地预览（file:// 下素材抠图会被安全策略禁用，必须起 http）
python -m http.server 8000 --bind 127.0.0.1
```

> **本文件会随流程演进持续更新。** 每次并行开发的经验（踩坑 / 修正）应回写到 §2 铁律或 §5。
