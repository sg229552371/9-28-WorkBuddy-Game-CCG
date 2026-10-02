# 项目开发指南（含手机端远程开发）

> **本文件是仓库内的「随身上下文」。** 任何设备上的新会话（尤其是手机端云端会话）
> 拿到本仓库后，**先读这一份**，即可恢复项目铁律、已踩过的坑、机制基线与测试基线。
> 本机技能目录 `~/.workbuddy/skills/` 与 `.workbuddy/`（记忆）**都不在仓库里**，
> 换设备不会同步 —— 所以关键知识一律沉淀到本文件与 `G_docs/` 内。

**线上试玩（手机浏览器直接打开）：** https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/

---

## 0. 手机端远程开发（电脑关机场景）

### 0.1 拿到仓库

```bash
git clone https://github.com/sg229552371/9-28-WorkBuddy-Game-CCG.git
cd 9-28-WorkBuddy-Game-CCG
```

仓库是 **PUBLIC**，clone 无需凭据。**推送才需要凭据**，见 0.4。

### 0.2 跑测试

```bash
bash run_tests.sh
```

脚本自动探测 `node`（PATH 优先，其次本机 WorkBuddy 托管运行时）。
**判绿 = 每个测试 `exit=0` 且 `bad=0`**。

单独跑一个：

```bash
node boss_test.js; echo "exit=$?"
```

### 0.3 环境差异（重要）

| 项 | 本机（Windows） | 手机端云端会话（Linux） |
| --- | --- | --- |
| node | `C:/Users/jinyishun/.workbuddy/binaries/node/versions/22.22.2-3/node.exe` | 直接用 `node` |
| shell | Git Bash | bash |
| 中文路径 | 注意编码 | 正常 |
| 本地预览 | `python -m http.server 8877 --bind 127.0.0.1` | 云端可起服务，但用 GitHub Pages 更方便试玩 |

**云端会话里不要写死 Windows 绝对路径**，一律用 `node`，或让 `run_tests.sh` 自己探测。

### 0.4 推送到 GitHub（手机端照抄）

> 仓库：**`sg229552371/9-28-WorkBuddy-Game-CCG`**（PUBLIC，分支 `main`）
> 账号：**`sg229552371`** ｜ 提交邮箱：**`55120967+sg229552371@users.noreply.github.com`**

#### A. 最省事：一键脚本（推荐）

```bash
bash push.sh "这次改了什么"
```

它依次做四件事：**跑 `run_tests.sh` → 不全绿就中止（什么都不提交）→ 全绿才 commit → push 并回读确认**。
推送被拒时它会直接打印修复命令，不用猜。

#### B. 手工三步（脚本不可用时）

```bash
bash run_tests.sh        # 1. 必须 bad=0，否则别推
git add -A
git commit -m "这次改了什么"
git push origin main     # 2. 推送
git log --oneline -1 origin/main   # 3. 回读确认远程就是刚提交的那条
```

#### C. 全新设备 / 新云端会话的首次准备（每个新会话做一次）

云端会话是**非交互**的，`git` 不会弹密码框，所以**必须把令牌写进远程地址**：

```bash
TOKEN="粘贴你的细粒度令牌"          # 见下方「建令牌」
git config --global user.name  "sg229552371"
git config --global user.email "55120967+sg229552371@users.noreply.github.com"

git clone https://$TOKEN@github.com/sg229552371/9-28-WorkBuddy-Game-CCG.git
cd 9-28-WorkBuddy-Game-CCG
git remote get-url origin           # 校验：必须含 9-28-WorkBuddy-Game-CCG.git
```

**建令牌**：GitHub → Settings → Developer settings → Fine-grained tokens →
`Repository access` 只勾 **`9-28-WorkBuddy-Game-CCG`** 这一个仓库 →
`Permissions` 只给 **Contents: Read and write** → 有效期设短。
**不要用全权限的经典 token**（泄漏影响面太大）。

#### D. 常见故障

**推送被拒（`rejected / non-fast-forward`）** —— 电脑端推过新提交了：

```bash
git pull --rebase origin main
bash run_tests.sh
git push origin main
```

**remote 指向了别的仓库 / 令牌过期**：

```bash
git remote set-url origin https://$TOKEN@github.com/sg229552371/9-28-WorkBuddy-Game-CCG.git
git remote -v
```

**确认自己改的是哪个分支**：

```bash
git branch --show-current   # 必须是 main
```

#### E. 另外两条路（不想用令牌时）

1. **GitHub Codespaces**（推荐做重活）：仓库页 → Code → Codespaces → 新建。
   得到完整 Linux 环境 + 终端 + node，**登录即有写权限、可直接 push、可跑测试**，手机浏览器可用。
2. **github.dev**：手机浏览器打开仓库页，把域名换成 `github.dev` 进入网页 VS Code，
   登录即有写权限，改完直接 Commit。适合改文档 / 调数值。

#### F. 两条注意

- 令牌写进 URL 只落在**那个沙箱的 `.git/config`** 里，`.git/` 从不被推送，**不会泄漏到仓库**。
  但用完建议在 GitHub 上撤销该令牌。
- `.workbuddy/`（项目记忆）与 `.agent_tmp/` 已在 `.gitignore` 中，**不会被推上去** ——
  所以手机端新写的记忆留在本地，长期知识要落到 `G_docs/`。

### 0.5 手机端试玩（GitHub Pages，**已开启**）

```
https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/
```

- **已开启并验证**（源 = `main` 分支根目录 `/`，`https_enforced`）。推到 `main` 后自动重新部署，
  首次生效约 1~2 分钟。
- 纯静态（`index.html` + `js/` + `css/` + `assets/`，无构建步骤），
  **代码里无绝对路径引用（无 `src="/…"`）**，所以部署在仓库名子路径下也正常 ——
  **新增资源必须继续用相对路径**，否则线上会 404。
- **这是验证「移动端表现」的唯一实用手段**（本机 `agent-browser` 起不来，见第 7 节）。
- 用 `gh api repos/sg229552371/9-28-WorkBuddy-Game-CCG/pages` 可查状态。

### 0.6 手机端开发的三条纪律

1. **先 `git pull` 再动手**，避免和电脑端改动分叉。
2. **改完必须跑 `bash run_tests.sh` 并确认 `bad=0`**，不要只看退出码。
3. **数值一律进 `CFG`（`js/config.js`）**，手机端改数值最容易手滑写进逻辑里。
4. 手机端**只适合做「单点小改」**：调数值、加一条配置、改文案、补文档。
   跨文件机制改动（战斗/存档/流程）留到电脑端做，手机端容易顾此失彼。

---

## 1. 铁律

1. **设计文档优先级**：`G_docs/game_design_proposal.md` 的**第十六章是「首版开发基准」**，
   与前面章节冲突时以第十六章为准。改文档前先确认用户只让改文档、还是文档+代码都要改。
2. **数值一律进 `CFG`**（`js/config.js`），逻辑里不写死可调数值。
3. **纯全局脚本**：ES5/ES6、`"use strict"`、无模块化、无构建工具、无框架。中文注释。
4. 界面是**深色主题**（不是浅色），新增样式沿用现有 CSS 变量与配色。

## 2. 文件职责（决定改哪个文件）

| 文件 | 职责 |
| --- | --- |
| `js/config.js` | 全部策划配置表 `CFG` |
| `js/core.js` | `U` 工具 / `EventBus` / `SpatialHash` / `Assets` / `SFX`（底层，慎改） |
| `js/game.js` | 实体与战斗：`G`、存档 `Meta`、`Player`/`Monster`/`Bullet`/`Drone`/`World` |
| `js/ui.js` | 界面渲染与交互（全局 `UI`） |
| `js/main.js` | 启动 / 输入 / 主循环 / 界面流程状态机（全局 `Game`） |
| `index.html` + `css/style.css` | DOM 界面层 + 样式 |
| `G_docs/game_design_proposal.md` | 策划设计文档（第十六章为基准，第十七章为 Boss 设计） |
| `run_tests.sh` | 全量测试运行器（跨平台；**加/删测试时同步改这里的 TESTS 清单**） |
| `push.sh` | 手机端一键推送：跑测试 → 全绿才 commit → push（用法 `bash push.sh "改了什么"`） |
| `G_docs/dev_guide.md` | 本文件（随身上下文；**改本文件时本机技能 `bagrogue-prototype-dev` 也要同步**） |

## 3. 验证流程（必做）

**首选一行命令：`bash run_tests.sh`**（仓库根，跨平台，自动探测 node）。全绿时退出码 0 并打印「全绿」，末尾给 `PASS 合计` 汇总 —— **当前基线 PASS 合计 = 472**。

核心要求：

- **必须同时看退出码与文本**：一部分测试用 `console.assert`（失败只写 stderr、**不改退出码**），
  另一部分用 `check()` 打 `PASS/FAIL` 并在收尾 `throw new Error("... FAILED")`。
  所以必须 `grep -ci "Assertion failed\|FAIL\|Error"` **并**检查退出码。
- ⚠️ **`pass=0` 不代表没有断言** —— `smoke_test` / `runtime_test` / `backpack_test` /
  `artisan_test` / `rift_test` / `extract_test` 走的是 `console.assert`（只打 `SMOKE OK` 之类），
  只能靠退出码 + `bad` 判定。**断言条数要数「以 `PASS ` 开头的行」**（`grep -c "^PASS "`），
  不是数 `PASS <数字>`。
- 改完**建议连跑 3 轮**看抖动（本项目踩过随机性导致的偶发失败）。

## 4. 必踩的坑（10 条，逐条都真踩过）

1. **`console.assert` 失败只写 stderr，不改退出码。** 只看「退出码 0」会漏掉真失败 ——
   必须 grep `Assertion failed`，stdout 和 stderr 都要看。
2. DOM 桩的 `innerHTML = ""` **必须清空 `children`**，否则重复 `renderXxx()` 会读到上一轮的旧节点。
3. 应用把 `disabled`、按钮文案写在 **innerHTML 字符串**里；桩不解析 HTML，
   所以只能断言 HTML 文本（正则抠 `<button ...>`），不能断言元素属性。
4. `getElementById` 在桩里会自动造元素 —— **「元素是否真的存在」必须另查 `index.html` 原文**
   （`matchAll(/\sid="([^"]+)"/g)`）。
5. `js/ui.js` / `js/main.js` 里**所有新增的 DOM 读写都要空值保护**，
   否则会弄红 `artisan_test.js` / `runtime_test.js`。
6. **给「持续型机制」加「暂停/冻结/一次性」语义，会打破既有测试的时间假设。**
   症状：测试跑 N 帧期待积累 N 秒进度，实际只积累一点点；或断言「某值 === 0」却拿到 `undefined`。
   根因是新状态闸门让 `update()` 提前 `return`（计时没推进、字段从未被赋值）。修法三件套：
   相关字段在**构造函数里显式初始化**；旧测试**显式跳过/等待**该阶段；**新增专项测试**覆盖新机制本身，
   **而不是把旧断言放松**。
7. **`a || b` 会把「合法的 0」当成缺失值。** 真实踩到：
   `r.stats.bossFightTime = runTime - (timeToBoss || runTime)`，当 `timeToBoss === 0` 时整段恒为 0。
   凡数值型字段做「缺失兜底」一律用显式判断：`const t0 = x === undefined ? fallback : x;`，
   必要时 `Math.max(0, ...)` 夹紧。改计时/统计类逻辑时优先 grep `||`。
8. **`Game.startRun(chars)` 只调 `computeWeaponDefaults()`，不调 `recomputeWeapon()`。**
   所以 `startRun` 之后直接读 `G.run.weapon.skill.row` / `.dmgMul` 会拿到**未按等级结算的原始默认值**
   （召唤/陷阱技能没有 `row`，报 `Cannot read properties of undefined (reading 'count')`）。
   测试里读武器数值前**必须手动补一次 `recomputeWeapon()`**。
9. **函数「只收 ID」还是「也收对象」要写清。** `skillEntry(skill, lv)` 故意同时接受 ID 字符串与技能对象；
   若只接受 ID 而调用方传了对象，`CFG.skills[对象]` 静默变 `undefined`，
   报错点会跑到几百行外。新增这类「查表 + 结算」入口时，直接在入口做
   `typeof x === "string" ? TABLE[x] : x`。
10. **本机沙箱禁止删除「带盘符前缀的临时路径」。** 测试脚本里用 `mktemp` 造临时文件再 `rm -f` 收尾，
   会打印 `[safe-delete][SAFE_DELETE_INVALID_PATH] embedded drive prefix is not allowed`，
   **累积几个测试后整个脚本卡死、被 SIGTERM 掐断**（症状：脚本无输出、退出码 1、signal SIGTERM，
   但日志文件里已有前几个测试的结果）。修法：**不要落临时文件**，用 `out=$(cmd 2>&1)` 命令替换捕获
   （`run_tests.sh` 已按此实现）。

### 渲染行为的确定性验证（node 里能验证画面）

桩的 `ctx` 用 `Proxy` 记录所有画布调用，即可断言「某个东西真的被画了」：

```js
const ctxCalls = [];
const ctxProxy = new Proxy({}, {
  get(t, p) { if (p in t) return t[p]; return (...a) => { ctxCalls.push([p, a]); }; },
  set(t, p, v) { t[p] = v; ctxCalls.push(["set:" + p, [v]]); return true; },
});
// 例：验证冻结期间的红色倒计时大字
ctxCalls.length = 0; step(120);
const redIdx = ctxCalls.findIndex(c => c[0] === "set:fillStyle" && String(c[1][0]) === "#ff3b3b");
const numIdx = ctxCalls.findIndex((c, i) => i > redIdx && c[0] === "fillText" && /^[123]$/.test(String(c[1][0])));
```

⚠️ **node 测试断言渲染时别用带反斜杠的正则** —— driver 常是模板字符串，`\(` / `\.` 会被吃掉
（踩过：`/^rgba\(255,255,255,0\.[0-9]+\)$/` 静默变成不带转义的捕获组，永远不匹配）。
用 `indexOf(...) === 0` 或数值比较代替。

## 5. 关键机制基线（改前必读，别改回去）

### 5.1 裂缝子地图 = 一次性投放场景
进场冻结 3 秒（`CFG.rift.freezeTime`，全员静止+无敌、红字 3/2/1 居中、任务限时暂停）→
倒计时归零**一次性投放** `tasks[].spawnCount` 只怪 + `eliteBase 3` 只 ED 精英 →
**之后不再增援**（完成/失败都不新增），剩余敌人留场可继续清剿。
裂缝的 `circles` 只是**投放区域**，不是刷新点。
`CFG.elites.convertChance`（主图）与 `riftChance`（裂缝）**均为 0**；
精英统一由 `CFG.eliteSpawn`（**仅主地图**调用 `updateEliteSpawn`）/ 裂缝进场一次性投放产生。
`enterRift` 事件里顺序不能乱：**先定 `G.run.riftTask`、先把玩家坐标移到子地图中心，
再 `new World(...,"rift")`** —— `setupRift()` 要读 `spawnCount` 并据此避让玩家。

### 5.2 撤离 = 撤离点雕像
**仅 Boss 击败后在 Boss 死亡位置**生成 `G.run.exitStatue = {x,y}`（**一张地图仅 1 个**，
场景掉落信标 `EXTRACT_BEACON` 已删除）。
⚠️ **读条口径（别再按「按 E / 移动打断」写）**：**任一小队成员站进雕像判定圈
（`CFG.extract.radius 100 × CFG.altarJudgeMul`）即自动读条 8 秒**，**不需要按键**（E 只做进度提示）；
**移动不再打断**；**圈内英雄全部离开 → 进度 1.2 倍速衰退**；**受击仍立即归零**（`heroTakeDamage`）；
雕像留原地可反复重读。
推进入口 = 全局 `updateExtractJudge(dt)`（`js/main.js` 主循环调用，**仅 `G.activeWorld.isMain` 时**）；
状态字段 `G.run.extractProgress / extractChanneling / extractHolder`。
别和 `exitBeacon`（工匠世界返回出口 3s）/ 裂缝 `returnBeacon`（5s）混淆。

### 5.3 判定圈统一规则（`heroInCircle` / `judgeChannel`，`js/game.js`）
**任一存活英雄**在圈内都能推进判定（不限队长）；但同一判定是**单一实例** ——
只有一份进度 + 一个持有者（`j.holder`），**多人同圈不加速、读满即消费**
（雕像 `splice` 掉 / 进度归零），**不会被第二个英雄重复触发**；
`decay` 默认 1.2（离开圈缓降），**裂缝返回信标传 `decay = 0`**（旧规则「离开圈进度保留」，`smoke_test` 有断言）。
`judgeChannel(j, x, y, radius, dt, channel, pKey, hKey, decay)` 的 `pKey/hKey` 用于沿用既有字段名
（`npcProgress` / `exitProgress` / `returnProgress` / `extractProgress`），
**改这些交互时别再各写一套判定**。

### 5.4 货币职责边界（已定）
局外 = **进化结晶**（角色等级 + 武器等级，且**武器等级 = 技能等级**）；
局内 = **金币**（刷新属性卡牌 / 购买武器模块 / 购买道具 / 工匠服务）。**工匠世界不提供武器升级**。
卡牌刷新 = 每局免费 2 次（`CFG.cardPool.refreshPerRun`）→ 之后每次 `CFG.cardPool.refreshCost` 120 金币；
刷新按钮点击绑定**唯一在 `js/main.js`**（`refreshCards()` 内部判款+toast），
`ui.js` 只负责文案三态，**别在 ui.js 再绑 onclick（会双 toast）**。

⚠️ **升级入口在「首页→主城 Hub→传送门出征」重构后已收敛到主城 NPC 面板，
不要写成「主菜单 → 局外成长」**（该独立界面 `#screen-meta` 已**有意移除**，
`ui_flow_test.js:81` 有断言 `!htmlIds.has("screen-meta") && !htmlIds.has("btn-main-meta")` 守这条）：

- **局外角色等级** → 主城**强化导师**（`UI.renderTrainer()`，DOM `#npc-crystals`），升级调 `Meta.levelUp`
- **武器 / 技能等级** → 主城**武器匠**（`UI.renderSmith()`，DOM `#npc-crystals-weapon`），升级调 `Meta.weaponUp`

两者都以进化结晶支付。
⚠️ `UI.renderMeta()`（`js/ui.js`，含 `#meta-char-list` / `#meta-crystals`）是**重构遗留的死函数**
—— 那些 DOM 已不存在，函数里 `if (!box) return` 直接返回；
但 `metaUpgradeLevel` / `metaUpgradeWeapon` **仍被上述两个 NPC 面板调用，不能删**。

### 5.5 技能/武器等级上限 = 100，曲线公式驱动
`CFG.weaponLevel`（`maxLv:100`、`basicMulPerLv:0.04`、`skillMulPerLv:0.06`、`costBase:120`、
`costGrowth:1.05`、`costRound:10`），**不再有 `CFG.weaponLevels` 手写表**；
统一走全局函数 `weaponLevelEntry(lv)`（`js/game.js` 顶部）。改曲线只动 CFG 参数。
技能设定参考 **《Path of Exile（流放之路）》技能石+辅助石**。

### 5.6 工匠雕像 = 雕像池 + 限制器 + 多触发条件（`CFG.artisan`）
触发条件（首次里程碑 / 进度每 25% / BOSS 击败 / 每 2 只精英 / 保底 90s）投「配额」→
限制器（同屏 1 座 / 使用后冷却 20s / 每关上限 6 座 / 配额就绪后 3~8s 随机延迟 / 距玩家 ≥300px）决定落地。
实现：`createArtisanPool()` / `updateArtisanPool(w, dt)` / `artisanFieldCount(w)`，
状态在 `G.run.artisanPool`，**只在主地图 update 里调用**。
**雕像使用后立即从地图移除，工匠子世界可无限次进入**（"无限次"由池的持续产出保证）。
测试见 `artisan_test.js` 阶段 6（含一关节奏模拟：应落 4~6 座）。

### 5.7 撤离结算 = 统一「固定价值 × 唯一折算率」
口径已统一，**别再按类别分比例**：`calcSettleConvert()` 遍历**背包 + 武器栏内全部物品**，
按 `Math.floor(it.value × CFG.settleConvert.valueRate)` 累加；`valueRate = 0.5`（**2 价值 = 1 结晶**）。
返回 `{chest, gear, item, card, total}` —— 注意 **`gear` = 装备/武器模块、`item` = 消耗品**
（与旧版 key 语义不同，ui.js 已同步）。
物品固定价值来源：宝箱 `CFG.chestQualities[].value`（20/60/150/400/1000）、装备 30×品质系数、
武器模块 45×品质系数、消耗品各自 `value`（保险契约 60、诅咒道具 40）、卡牌资产 `CFG.settleConvert.cardValue` 4/张。
**未开封宝箱不带出本体，但价值照常折算**；**保险契约无独立折算价**（走同一折算率 60→30）。
**局内经验与金币归零、不折算**（`coinPerCrystal`/`b.coin` 已删，别加回来）。

### 5.8 开箱只有一个入口：工匠世界
（文档-代码一致性高频坑）代码里 `UI.openChest()` 只挂在工匠世界界面，
**撤离结算没有任何开箱 / 拖拽分配 / 容量校验逻辑**。
文档中凡写「结算界面开箱」「带出后开箱」的都是旧稿，一律改为「折算为结晶」。

### 5.9 技能表 = 单表 + `cat` 分类（P1，已落地）
物理上只有一张 `CFG.skills`，用 `cat` 区分 `active`（主动，含普攻）/ `passive`（结构就绪但 0 条）/
`buff`（增益 BF00x）/ `debuff`（减益 DB00x）。**不物理拆 4 张表**（字段同构；PoE 亦然）。
`CFG.skillCat` 存中文标签。敌人技能也在这张表里（`cat:"active"` + `ai` 字段）。

### 5.10 技能等级效果三级填法（1~100 级，策划最多填 5 行）
1. **公式驱动**（连续值：伤害/CD/弹速/范围/生命）= 平铺字段 LV1 基础值，
   按 `CFG.weaponLevel` 线性成长（普攻 +4%/级、技能 +6%/级，可 `growth` 覆盖）；
2. **锚点插值**（整数离散值：弹道数/召唤数/穿透/弹射）= `anchors: { count:{1:3,25:4,60:5,100:6} }`，
   区间线性插值后取整；
3. 分段公式。

**统一入口 `skillEntry(skill, lv)`**（`js/game.js`），**同时接受技能 ID 字符串或技能对象**。
`anchorLerp` 取整规则：**锚点值全整数 → 向下取整；含小数 → 保留两位**。
**未声明 `kind` 的条目不吃等级伤害成长**（否则敌人技能会与怪物等级二次缩放）。
曲线唯一来源是 `weaponLevelEntry(lv)`，别另写一套。

### 5.11 技能 → 本局数值 = `resolveSkill(sk, lv, syn)`
`skillEntry` + 词条标签 + 武器模块连接/套装。词条生效规则**别搞反**：
**普攻吃除「伤害」外的全部标签**（弹道/冷却/弹速/穿透/弹射，因为普攻伤害是武器基础值）；
**主动技能只吃自己 `tags` 里声明过的标签**；武器模块阶段词缀仅技能向（`tagCalc(tag, true)`）。

### 5.12 术语映射（PoE → 本项目 → 代码，别再另建体系）
- **技能石 = 主动技能**（`CFG.skills` 里 `cat:"active"` + `kind:"skill"`，
  **绑定在武器上** = `CFG.weapons[].skills.skill`；**武器等级 = 技能等级**）
- **辅助石 = 武器模块**（= 旧「技能辅助石/装备模块/模组」，`CFG.moduleDefs`，
  代码标识符**仍为 `module`**）
- **技能栏多槽 = 局内武器栏**（`G.run.weaponInv`，4×3）

**改名只改外包装文案，不动结构。** ⚠️ 术语两次改名，**最终定名 = 武器模块**
（武器模块 → 技能辅助石 → **武器模块**）。批量替换两个坑：
①`stale()` 类「无残留」断言原来靠「不含『模块』二字」判据，改成「武器模块」后**判据失效**，
只能查「辅助石 / 模组 / 装备模块」；②组合词要单独收尾（「购买武器模块」不能被替换两次）。

**已由用户拍板的边界（别自行扩大/收窄）**：
1. **技能石只指主动技能**（`kind:"skill"`），**普攻 basic 不算技能石**；
2. **武器模块对普攻也生效**（普攻吃除「伤害」外的标签）；
3. 队友局内等级 = **共享队长的 `G.run.lv`**（不各自独立）；
4. 队友**武器等级各自独立**（`Meta.weaponLv(各自 id)`）。

### 5.13 武器栏 = 小队技能栏：武器模块对小队全体成员生效
`recomputeWeapon()`（`js/game.js`）是**全队解析中心**：内联 `resolveSet(heroDef)` 按各成员
**自己武器的 `skills`** + 各自 `heroDef.weaponLv` 解析，队长结果写 `G.run.weapon.basic/.skill`
（**保留原名，别改**：调用点与 UI 都依赖），队友结果缓存在 **`c.skills = {basic, skill}`**
（`createRun` 里 companions 有 `skills:null` 占位）。
`syn`（连接/套装）**全队共享**、`tagCalc` 对全队是同一份值，**标签过滤发生在 `resolveSkill` 内部按各技能 `tags`**。
→ 队友普攻走 `(c.skills && c.skills.basic) || CFG.skills[...]` 兜底（`updateCompanions`）。

**武器栏里两类物品都全队生效**：**武器模块 → 改技能**（上述 `c.skills`）、
**装备（属性件）→ 改属性**（`weaponGearBonus()` 汇总武器栏内 `kind:"gear"` 的 stats，
队长 `computeStats()` 与队友 `companionStats(c)` **同源读同一份**）。
队友承伤走 `companionStats(h).def`，队友移速走 `companionStats(c).spd * 1.15`，
队友 `hpMax` 在 `updateCompanions` 每帧同步（只涨上限、不补血，与队长一致）。

### 5.14 局内增益也对全队生效（别再按"只队长"写）
属性卡牌（`G.run.appliedCards`）+ 战争雕像 Buff（`G.run.buffs`）统一由 **`runBonus()`** 汇总，
返回 `{add, mul}` 两个通道（`add` = 卡牌 flat + Buff 吸血；`mul` = Buff 属性倍率 + 卡牌冷却缩减）。
**队长 `computeStats()` 与队友 `companionStats()` 都读它**，
结算式 `最终值 = (基础值 + 武器栏装备 + add) × mul`。
⚠️ **顺序敏感**：`atk` 是「Buff 乘算、卡牌加算」→ 必须写成 `(base+gear)*mul.atk + add.atk`，写反会改数值。

### 5.15 雕像由任一成员触发
祭坛进度判定用 `aliveHeroes().some(...)`，**队友在圈内也算**（`triggerAltar` 不区分触发者）；
效果写进 `G.run.buffs` 后全队共享。`execEffect` 的 `heal` 也已是**全队一起恢复**。
`giveChest` 仍进队长背包（背包只有一份）。

### 5.16 Buff 有等级，重复触发叠的是等级（别改回"push 多份"）
`r.buffs` 元素为 **`{ skillId, id, lv, remain }`**，同一条 Buff **只保留一份**；
效果由 `skillEntry(skillId, lv)` 的等级曲线给出（`runBonus()` 内解析，无 `skillId` 时回落旧 `stat/mul` 字段）。
`execEffect` 的 `randomBuff` = 命中同 `skillId` → `lv = min(maxLv, lv + inc)` + 刷新 `remain`；
`stackable:false` 时 `inc=0`（只刷新时间）。规则配置在 `CFG.buffLevel`，条目可覆盖 `stackable/maxLv`。
文案用 `buffEffectLabel(skillId, lv)`。
⚠️ **`cdMul` 这类"越小越快"的因子必须用 `anchors` 而非 `growth`** —— 公式外推会变负数（实测 Lv99 → −0.67）。

### 5.17 召唤物上限 / 陷阱数量上限 = 英雄属性
`CFG.heroes[].summonMax / trapMax`，缺省 `CFG.unitLimit`：**限制该类型技能的上限**，
`实际上限 = min(技能锚点数量, 英雄该属性)`（`unitCap(caster, kind, count)`）。
走**完整属性管线**（英雄基础 + 武器栏装备 + 局内增益，`ZERO_GEAR` / `runBonus().add` /
`computeStats` / `companionStats` 都有 `summonMax/trapMax`），`unitLimitOf(caster, kind)` 按成员取各自上限。
首版数值：召唤师 H007 = 6（= AT113 满级锚点）、陷阱师 H008 = 3（= AT114 满级锚点）、其它英雄 2 / 1。
⚠️ **`SkillSystem.castSummon/castTrap` 现在返回 `{n, cap}`**（`cast` 会展开成 `{kind, n, cap}`），
不再是数字；`cap <= 0` 时陷阱直接返回（防 `while (mine().length >= 0)` 死循环）。
**触碰队友施法 / 产物池断言时，期望值要按 `min(锚点, 英雄上限)` 算**。

### 5.18 产物归属（别加「倒下即回收」）
无人机**谁的技能就随谁**（环绕 owner；owner 倒下**不回退回收**，只在 `Drone.update` 里改为跟随队长）；
陷阱**留在原地**与布设者脱钩（布设者走开/倒下都照常原地等敌引爆）。

**吸血归属发射者**：`Bullet` 带 `owner`（由 `SkillSystem.castBullet(..., caster)` 传入），
命中时 `applyLifesteal(this.owner, this.dmg)` —— 队友输出回队友自己、队长输出回队长。
`applyLifesteal` 对 `owner === G.player` 或用 `!owner.isCompanion` 归队长。
**AOE 爆炸（`explode`）不参与直击吸血**，与旧口径一致。
队友的 `c.cdMul` / `c.lifesteal` 在 `updateCompanions` 每帧从 `companionStats(c)` 同步。

### 5.19 队友有独立能量池
companion 构造带 `energy/energyMax/regen = hd.energyMax/energyMax/energyRegen`；
`companionStats(c)` 返回 `energyMax`（英雄基础 + 武器栏装备 + `runBonus().add.energyMax`）与 `regen`；
`updateCompanions` 每帧 `c.energy = min(c.energyMax, c.energy + st.regen*dt)`。
**技能释放条件 = `c.skillTimer<=0 && c.energy >= cs.energy`，释放时扣自己的能量**。
改队友施法逻辑时别退回"只按 CD"。

### 5.20 AI 队友是全战斗单位
`updateCompanions` 里队友 **普攻 + 主动技能各自独立计时**（`c.fireTimer` / `c.skillTimer`，
`skillTimer` 在 `createRun` 里按 `(i+1)*CFG.team.skillStagger` 错峰）。
队友技能走同一个 `SkillSystem.cast`；`CFG.team.aiSkill=false` 可整体关掉。

### 5.21 产物池按成员隔离
`G.run.drones` / `G.run.traps` 是**全队共用容器**，但**计数与上限按 `owner === caster` 过滤**
（`Drone` 构造第 8 参 `owner`、陷阱对象 `owner` 字段）。
队友施放召唤**只补自己那一队**、陷阱超限**只回收自己名下**最旧的。
**别改回按池总量计数**（会让队友顶掉队长的编队）。
无人机**环绕自己的召唤者**（owner 倒下回退队长），子弹带 `owner` → 吸血回召唤者。

### 5.22 技能执行器 = `SkillSystem`（`js/game.js`）
`castBullet` / `castSummon` / `castTrap` / `cast`（按 `sk.type` 分发 bullet/summon/trap），
玩家、队友、召唤物共用。**不要再在 Player 里写释放逻辑**；Player 的 `fireBasic`/`fireSkill` 只是薄包装。

### 5.23 敌人技能已表化（组合，别再往怪物表加攻击参数）
`CFG.monsters[].skillList = ["AT2xx"]` 指向技能表，**攻击参数（fireCd/bulletSpd/keepDist/
chargeRange/telegraph/dashSpd/dashTime/chargeCd/boomCd/boomWarn/boomRadius/boomDmgMul/
minionCd/minionWave/touchCd）已全部从 `CFG.monsters` 删除**；
`type` 仍是 AI 行为标识（melee/ranged/charger/boss），技能条目的 `ai` 字段必须与之一致
（`skill_table_test.js` 会校验）。
构造时 `monsterAttackSkill(d, lv)` 把通用字段名归一化成 AI 别名（`cd` → touchCd/fireCd/chargeCd/boomCd；
`warnTime` → boomWarn；`radius` → boomRadius；`dmgMul` → atkMul），**显式别名优先**
（如 Boss 的 `touchCd:1.0` ≠ `cd:5.0`）。Monster 攻击分支与渲染（冲锋预警线、Boss 预警圈）都读 `this.ak.*` / `m.ak.*`。
**加新怪 = 怪物表一行 + 技能表一行，零代码**。

### 5.24 派生视图别手抄
`CFG.warBuffs`（战争雕像增益池）与 `CFG.curseItems.list`（诅咒道具）已改为
**从 `CFG.skills` 过滤派生**（`cat=buff&pool=war` / `cat=debuff&target=monster`）。
新增增益/诅咒只改技能表；注意 `CFG.warBuffs[].id` 用 `s.name`（中文名）保持显示不变。

### 5.25 工匠金币服务交易契约
`shopBuyModule()` / `shopBuyItem()` 定义在 `js/game.js`，返回 `{ok, msg}`，
**内部完成**判款、扣款、生成物品、背包满转 `r.pendingItems`，**不调 `UI.toast`**（由 ui.js 弹）。
新增商店项照此模式扩展。

### 5.26 Boss 弹幕化 + 阶段机（第十七章，样板批已落地）
Boss 从「血多的精英怪」变成**会发弹幕的 2 阶段 Boss**。

- **配招写在怪物表**（⚠️ 与文档 17.6 原稿的偏差：原稿说放技能表，落地改放**怪物表**）：
  `CFG.monsters[BSxxxx].phases = [{ hp, skills: ["AT2xx"] }, ...]` + `patternCd`。
  `phases[0].hp` **必须 1.0**（满血即生效）、`hp` 严格递减。
  `skillList[0]` 仍是**基础行为技能**（AT207~209 的圆形 AOE + 召唤），
  `skillList[1..]` 是弹幕招式、由 `phases` 编池
  （`skill_table_test` 会校验 skillList 里每条 ai 与 `type` 一致 → 弹幕招式必须 `cat:"active"` + `ai:"boss"`）。
- **6 种发射器 `PatternSystem`**（`js/game.js`，`SkillSystem` 旁）：
  `radial / spiral / fan / wave / ring / grid`。
  `shape(p, aimAng, spinAng)` 返回 `[{ang, spdMul, dx, dy}]` **纯几何（可单测，不需要 World）**；
  `emit(w, m, p, aimAng, spinAng)` 落实体并返回**实际发射数**。
- **护栏 `CFG.boss`**：`bulletBudget 40/秒`（滑动窗口用 **`m.bossClock`**，不是 `G.time`
  —— headless 测试里 `G.time` 不推进，用它会锁死预算）、`bulletCap 260`
  （只统计 `b.owner === m`，小怪弹不占额度）、`bulletLife 6`（**慢弹幕必须给 `life`**，
  Bullet 默认 2.2s 会在半场消失）、`phaseInvuln 1.2`、`color` 五色。
  超限按**等间隔抽取**裁剪（形状保持对称，别改成砍尾巴）。
- **电报时序**：`warnTime > 0` → 先 `patternWarnT` 倒计时（渲染白充能圈 / 扇面）→ 归零才 `bossFire()`；
  `warnTime = 0`（螺旋类持续招）冷却一到直接连发。招式按 `phase.skills[patternIdx % len]` 轮转，
  `patternIdx` 在 `bossFire` 里自增。
- **阶段机**：`bossPhase()` 取「最后一个 `hp >= 血量比` 的档位」；`bossPhaseTick()` 检测到
  `idx > phaseIdx` 才推进 → `phaseInvulnT = CFG.boss.phaseInvuln`（**无敌 + 停手，不清屏**），
  同时顺延 `boomTimer/minionTimer`（避免"无敌期间罚站后立刻挨打"）。
  `damageMonster()` 在 `m.phaseInvulnT > 0` 时**提前 return**（子弹照常被消耗）。
- **渲染**：白圈（放射 / 同心环 / 网格）、**白扇面**（fan / wave，用 `m.aimAng`）、
  白护盾环（半径 `m.r + 12`）；Boss 弹幕 `fillStyle #e6f4ff` + 描边（与小怪弹 `#c79bff` 区分）。

**端到端验证套路**：`boss_test` 的弹幕几何用例**不需要完整 World** ——
`PatternSystem.shape/emit` 是纯几何 + 预算，用
`fakeW() = { w, h, obstacles: [], enemyBullets: [], monsters: [], spawnMonster() }` +
`fakeM() = { x, y, atk, r, bossClock, d }` 就能单测；
阶段 / 电报 / 端到端用例才 `new Monster(id, x, y, lv)`（此时需要 `G.sprites` 与 `Game.startRun` 造出的 `G.run`）。
**渲染断言要先 `Game.loop(t)` 踢一次主循环**（`__raf` 由 loop 自己续接），否则 `step()` 拿不到 `global.__raf`。

### 5.27 陷阱 / 召唤物有「世界归属」（`world` 字段）
`G.run.drones` / `G.run.traps` 是全队共用容器，但每条产物记 `world`（`G.activeWorld` 快照）——
**只在所属世界更新 / 引爆 / 渲染 / 被索敌**（传送进裂缝/工匠世界，主图产物原地冻结，不会跟到子图）。
⚠️ **名下计数也按世界过滤**（`castSummon/castTrap` 的 `mine()`），否则子图施放会把主图产物顶掉。
`nearestTarget(w,x,y)` / `enemyTargets(w)` 第一参是世界，别传漏。

### 5.28 视线判定 `losClear(w, x0,y0,x1,y1)`
（`js/game.js`，segment vs AABB slab 法）：`nearestMonster` **优先返回视线可达的最近怪**
（玩家/队友/无人机不再朝障碍物倾泻弹药）；远程怪 `los=false` 时不开火、
距离带内则沿切向绕行抢视线（`m.strafeSide` 随机定侧）。加新远程行为时开火前必须查 `losClear`。

### 5.29 沿墙绕行（防卡障碍）
`resolveObstacles(e, w, bias)` 第三参 = 目标点。push 只恢复法向间隙不产生切向运动，
**正对顶墙（切向动量 < 30%）时沿墙向 bias 侧滑动**（每帧一份 `mag`）。
⚠️ **方向必须带粘性 `e._slideDir`**：目标恰在墙延长线上时切向符号每帧抖动，
无记忆会原地 ±1.9px 振荡（实测）；只有 `|切向距离| > 60px` 且反向才翻转。
位移记 `e._mdx/_mdy`（帧初→帧末），Player / 队友 / 怪物 / 主城形象四处都要记。

### 5.30 HUD 布局：自动战斗按钮在**左上**，不在右下
`#btn-autofight`（+ 展开的风格选择器 `#autofight-styles`）挂在 **`#hud-tl`**，
且**置于该容器首位** —— 这样它的位置不会被上方 Buff 图标（`#buff-area`）的增减挤动。
**别再挪回 `#hud-br`（右下）**：移动端右下是虚拟按钮 `#touch-btns`（背包/交互/技能，
`right:24px; bottom:56px`，大按钮 86px），会与 `#hud-br`（`right:20px; bottom:18px`）重叠遮挡。
现在 `#hud-br` 只剩「背包 (B)」。风格选择器因此改为 `justify-content:flex-start`（左对齐）。

### 5.31 `G_docs/ui/`（UI 布局线框 v1.0）已**有意移除**
原 4 个文件（`index.html` / `wireframe.css` / `wireframe.js` / `layout_plan.md`）是「阶段一 灰阶布局线框」的一次性交付，
已完成使命、**废弃移除**（可从 git 历史取回）。**别再往 `G_docs/ui/` 找界面布局稿** ——
布局现状以 `index.html` + `css/style.css` 的实际实现为准。

### 5.30 画布跨端（`fitCanvas`，`js/main.js`）
画布分辨率**跟随窗口比例**，**垂直视野固定 `CFG.camera.viewH=720`**
（画布高 = viewH × zoom = 1080）→ 角色物理大小跨端只由 zoom 决定；
宽随屏幕伸缩，竖屏按 `minAspect 0.75`（4:3）钳制。
旧版固定 1920×1080 再整体缩进窗口（手机竖屏只是屏幕中间一条小横带）是
「PC/手机视野与角色大小不一致」的根因，**别改回去**。
桩环境 `innerWidth` 可能缺失 → `|| 1920/1080` 兜底防 NaN。

## 6. 并行开发切分（已验证可用）

多路 Agent 并行时**按文件所有权切分**，一方不得碰另一方的文件：

- **战斗/数值线**：`js/config.js` + `js/game.js` + `js/main.js`
- **界面/样式线**：`js/ui.js` + `index.html` + `css/style.css`
- **文档线**：`G_docs/game_design_proposal.md`（永远可以独立并行，零冲突）

**跨文件状态必须先定「共享字段契约」再派单**（本会话验证有效，一次合并零冲突）：
例如 `G.run.exitStatue`、`G.run.scale`、`shopBuyModule() → {ok,msg}`、`CFG.cardPool.refreshCost`。
把契约原文写进给每个 Agent 的提示里，并注明「对方实现，你只按此调用」。

给每个 Agent 的提示里要写明：职责文件白名单、禁止改的文件、node 路径、验收命令、
以及「测试失败若指向你不负责的文件，先重跑一次，仍失败只记录不修」。

**并行收尾必做**：等所有 Agent 回来后再自己跑一次全套测试 + grep `Assertion failed`。
并行期间各自的「全绿」可能是对方尚未落地的瞬时状态；
另外要专门检查**重复事件绑定 / 重复 toast**（两个 Agent 可能给同一个按钮各绑一次 onclick）。

## 7. 本地预览

```bash
cd F:/AI-Game && python -m http.server 8877 --bind 127.0.0.1    # 用 run_in_background
```

- 必须走 HTTP：`file://` 下 canvas `getImageData` 被安全策略禁用，素材抠图会失效。
- 首次加载时 `G.state` 落点是主菜单 `#screen-main` → 关卡选择 → 角色选择 → 局内。
- **`agent-browser` 在本机起不来**（daemon 连接超时 / ERR_CONNECTION_REFUSED），
  不要指望它做界面验证，改用无头 DOM 桩测试。

## 8. 当前基线

测试 **16/16 全绿**，**PASS 合计 472**：

`smoke_test` / `runtime_test` / `backpack_test` / `econ_test` / `skill_module_test` /
`team_trigger_test` / `artisan_test` / `ui_flow_test` / `rift_test` / `extract_test` /
`shop_test` / **`skill_table_test`**（技能表 + 敌人技能表化 + 武器模块全队生效 + 装备全队 +
队友技能与独立能量池 + 局内增益全队/吸血归属 + 产物池隔离 + Buff 等级 +
英雄召唤物/陷阱上限 + 判定圈统一规则 + Boss 弹幕招式计数，**178 条**）/
**`autofight_test`**（托管 AI 三风格，41 条）/ **`mobile_test`**（移动端摇杆，14 条）/
**`boss_test`**（Boss 弹幕化 + 阶段机 + 护栏，**85 条**）/
**`bugfix_test`**（世界归属 + 视线判定 + 沿墙绕行 + 主城布局 + 画布跨端，**17 条**）。

跑测试前先确认这个基线，改完必须仍然全绿且 `bad=0`，改完建议连跑 3 轮看抖动。
⚠️ 改动队友施法/产物相关逻辑会连带撞到 `skill_table_test` 第十节（队友技能与能量）与产物池断言
—— **别放松断言**，按新规则改期望值。

### 组队类改动的端到端验证套路

`Game.startRun([...两个英雄])` → `G.run.companions[0]` → 往 `G.run.weaponInv.place(makeModule(...), x, y)` →
`recomputeWeapon()` 断言 `c.skills.*`；
要验「真的用上了」就造怪 + 清空弹池 + `c.fireTimer=0` + `updateCompanions(G.mainWorld, 0.016)`，
断言 `w.playerBullets.length`。
队友 `heroDef` 是 `applyOutLevel` 返回的**副本**，可直接改 `weaponLv` 做等级独立性测试，
不会污染 `CFG.heroes`。

## 9. 主线与遗留待办

**主线 = 内容铺量 + 数值填充**（不设期限）。

- **第十七章剩余**：17.7 第 3 步（激光实体 `LaserBeam` + 弹幕吞噬机制，含 `laserCap 6`、
  线段-圆命中）；第 4 步（BS0004~BS0010 配表）；17.9 待定 5 条。
- **内容铺量**：关卡 3 → 10+、怪物 11 → 17+、技能锚点数值填表；属性卡池本批未动。
- **待确认**：主城商人新位置 `(0.14, 0.62)`；竖屏视野变窄是刻意行为（如需全宽需竖版布局）。
