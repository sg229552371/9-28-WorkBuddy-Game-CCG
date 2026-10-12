# HANDOFF.md —— 交接上手页

> **本页不是规则源。** 规则真源 = `AGENTS.md`（第一份要读）+ `G_docs/*`。
> 本页只做四件事：**说清这是什么 → 让你 3 分钟跑起来 → 指到该读的真源 → 报当前基线状态**。
> 两者冲突时以真源为准；本页数字以**实测**为准（实测日期见文末）。

---

## 一、这是什么

《弹幕射击 Roguelike × 背包肉鸽 × 轻度搜打撤》—— 纯静态 **HTML5 + Canvas 2D** 原型，
**无模块化、无打包工具、无框架**；数据驱动，所有可调数值收口在 `CFG`（`js/config.js`）。
HTML 原型用于验证玩法与布局，引擎迁移是后续议题。

| 项 | 值 |
|---|---|
| 仓库（唯一真源） | `https://github.com/sg229552371/9-28-WorkBuddy-Game-CCG`（`main`） |
| 本机工作区 | `F:/AI-Game` |
| 试玩（正式主入口） | `https://bagrogue-shooter-85672.app.workbuddy.host/` |
| 试玩（备用·自动最新） | `https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/` |

> ⚠️ 托管站是**独立部署，不跟随 GitHub**。改完必须**重新发布**，否则手机上玩的还是旧版。
> ⚠️ `bagrogue-shooter.app.workbuddy.host` 与 `ae6c0d4fb9b5c352d.app.workbuddy.host` **已冻结，别再写**。

---

## 二、三分钟上手

```bash
bash run_tests.sh --quick     # 快速冒烟（几秒）
bash run_tests.sh             # 交付前全量门禁（约 2.5~3 分钟）
bash verify_clone.sh          # 新克隆/异地自检（比对核心文件指纹 + 版本号 + 基线）
python -m http.server 8123    # 本地起服务 → 浏览器开 http://127.0.0.1:8123/
```

**判绿标准**：每项 `exit = 0` **且** `bad = 0`；断言条数以真实输出的 `PASS 合计` 为准（**不要推算**）。

> 🔴 **门禁全绿 ≠ 游戏能玩。** 跨模块「启用 / 分流 / 接线」类改动**必须**配一套真实主循环测试兜底
> （本项目 = `skill_enable_runtime_test.js`：加载全部脚本 → 真实 `startRun` → 推进主循环 → 断言 `kills ≥ 1`）。
> 这条是血泪第 40 条，代价一次全绿发布但玩家打开完全不能玩。

---

## 三、真源导航（该读哪个）

| 我要… | 读这个 |
|---|---|
| **恢复上下文 / 找入口（第一份）** | `AGENTS.md` |
| 技术约定 / 铁律 / 门禁 / **并行开发六步法** | `G_docs/dev_standard_and_playbook.md` |
| 玩法规则唯一蓝图 | `G_docs/game_design_proposal.md`（当前技能方向 = **第二十章「能量水晶技能系统」**，旧章节已标注取代） |
| **技能系统总纲**（做技能先读） | `G_docs/skill_system_master_v1.md` |
| 技能契约 / 接口真源 | `G_docs/skill_system_development_contract_v1.0.md`、`skill_system_interface_v1.md` |
| 技能数值表 / 迁移映射 | `G_docs/skill_balance_table_v0.1.md`、`skill_migration_map_v0.1.md` |
| **血泪坑清单（40 条）** | `G_docs/dev_guide.md` §10.3 |
| 架构改进方案（**只读·待确认**） | `G_docs/plan_architecture_and_ai_development_v1.md` |
| 提交 | `push.sh` |

---

## 四、当前基线（实测）

| 项 | 值 |
|---|---|
| 快照 | `3761e8a`（本地 = 远程 `origin/main`，工作区干净） |
| APP_VERSION | `20261046` |
| 门禁 | **94 套 / PASS 4111 / bad = 0** |
| skill 套件 | **18 个**（`bash run_tests.sh --suite=skill`） |
| 核心文件指纹 | `verify_clone.sh` 内 **23 个** |
| `js/` 文件数 | **34** 个 |
| `index.html` 脚本 | **33** 个 `<script src="js/...">` |
| 版本串 | **35 处 `?v=`** + 1 处 `<meta name="app-version">`（共 36 处需同步） |
| 玩家可玩态 | H001 猎手**默认走能量水晶新路径**（无需 `?skill=1`）；其余英雄仍走旧路径 |

---

## 五、⚠️ 已知文档数字过时（打开时先核对）

`AGENTS.md` 下列数字**落后于实测**，看到时以本页 / 实测为准：

| 位置 | 文档写的 | 实测 |
|---|---|---|
| §一 门禁行 | 93 套 / 4083 断言 | **94 套 / 4111** |
| §一 铁律 6 | `?v=` **10 处** | **35 处**（另 meta 1 处） |
| §四 门禁 | 93 套 / 4083，含 skill 套件 17 个 | **94 套 / 4111，skill 18 个** |
| §四 | `--suite=skill` 14 个 | **18 个** |
| §五 | 血泪共 **31 条** | **40 条** |

（`js/` 34 个文件、33 个 `<script>` 两项**正确**，无需改。）

---

## 六、若本文件夹是「副本」

本仓库计划拆成两个文件夹（老旧 / 最新）。若你打开的是其中一份，**先登记**：

- 副本名称：`__________`（例如 `AI-Game-old` / `AI-Game-latest`）
- 角色：☐ 冻结留档（**只修致命 bug，不接受功能改动**）　☐ 活跃演进（继续开发）
- 共同起点：**`3761e8a`** —— 两份必须同源，便于互相对照

**给冻结份的建议**：保持 `bash verify_clone.sh` 通过即可，不再 bump 版本号、不再发布。

**给活跃份的建议**：文件夹 / 仓库名改变后，**重建** `verify_clone.sh` 快照与门禁基线
（`EXPECT_FILES` 哈希 + `EXPECT_VERSION` **两处都要改**，只改一处会报「❌ 不一致」，血泪 39）；
部署目标若换，`AGENTS.md` 顶部的试玩链接表也要同步。

---

*实测日期 2026-10-12 · 依据命令：`git rev-parse HEAD` / `bash verify_clone.sh` / `bash run_tests.sh`*
