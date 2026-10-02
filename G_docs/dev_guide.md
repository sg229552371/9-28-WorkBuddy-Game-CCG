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

**首选一行命令：`bash run_tests.sh`**（仓库根，跨平台，自动探测 node）。全绿时退出码 0 并打印「全绿」，末尾给 `PASS 合计` 汇总 —— **当前基线 PASS 合计 = 749**。

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
⚠️ `metaUpgradeLevel` / `metaUpgradeWeapon` **仍被上述两个 NPC 面板调用，不能删**。
（原 `UI.renderMeta()` 死函数及其 DOM `#meta-char-list` / `#meta-crystals` 已在重构中删除，
相关 CSS 一并清理；详见 5.31。）

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
`updateCompanions` 里队友只有**主动技能计时**（`c.skillTimer`，`createRun` 里按
`(i+1)*CFG.team.skillStagger` 错峰）——19.1 普攻移除后 `c.fireTimer` 已退役。
队友技能走同一个 `SkillSystem.cast`；`CFG.team.aiSkill=false` 可整体关掉（关掉后完全沉默）。

### 5.21 产物池按成员隔离
`G.run.drones` / `G.run.traps` 是**全队共用容器**，但**计数与上限按 `owner === caster` 过滤**
（`Drone` 构造第 8 参 `owner`、陷阱对象 `owner` 字段）。
队友施放召唤**只补自己那一队**、陷阱超限**只回收自己名下**最旧的。
**别改回按池总量计数**（会让队友顶掉队长的编队）。
无人机**环绕自己的召唤者**（owner 倒下回退队长），子弹带 `owner` → 吸血回召唤者。

### 5.22 技能执行器 = `SkillSystem`（`js/game.js`）
`castBullet` / `castSummon` / `castTrap` / `cast`（按 `sk.type` 分发 bullet/summon/trap），
玩家、队友、召唤物共用。**不要再在 Player 里写释放逻辑**；Player 的 `fireSkill` 只是薄包装
（`fireBasic` 已随普攻移除删除，见 §5.41）。

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

### 5.32 物品入包 = 唯一入口 `grantItemToRun()`（别再内联手抄）
**所有「把一件物品放进背包」的路径统一走 `grantItemToRun(r, item, opts)`**（`js/game.js`）：
保险先叠加未满堆叠 → 宝箱按品质叠堆（`tryStackChest`）→ 找空位放置（`findSpot`+`place`）→ 放不下时按 `opts.full` 决定去向。

`opts.full` 两种语义（**别搞混，这是两个不同规则**）：
- **`"pending"`（默认）**：放进 `r.pendingItems`（工匠待分配区）——**工匠世界 / 开箱 / 商店购买**用；
- **`"discard"`**：**直接丢弃不保留**——**主地图**用（精英掉落 `onMonsterKilled`、战争雕像 `giveChest`：
  主地图没有待分配区，满背包只能作废并 toast）。

返回值：`true` = 已入背包（含叠加）；`false` = 未入背包（pending 时已进待分配区 / discard 时已丢弃）。
**六处历史内联重复已全部收敛**（原 `game.js` 两处用了
`tryStackChest(item) || (() => {…})()` 的 IIFE 绕过既有函数）。新增入包场景直接调用本函数，
**不要再去 `r.backpack.tryStackChest(...) || findSpot(...)` 手抄一遍**。
回归测试见 `grant_test.js`（30 条，覆盖 A 保险叠加 / B 宝箱叠堆 / C 入包 / D 待分配 / E 满包优先级 / G 商店）。

### 5.33 画布跨端（`fitCanvas`，`js/main.js`）
画布分辨率**跟随窗口比例**，**垂直视野固定 `CFG.camera.viewH=720`**
（画布高 = viewH × zoom = 1080）→ 角色物理大小跨端只由 zoom 决定；
宽随屏幕伸缩，竖屏按 `minAspect 0.75`（4:3）钳制。
旧版固定 1920×1080 再整体缩进窗口（手机竖屏只是屏幕中间一条小横带）是
「PC/手机视野与角色大小不一致」的根因，**别改回去**。
桩环境 `innerWidth` 可能缺失 → `|| 1920/1080` 兜底防 NaN。

### 5.34 主关卡开场冻结（出征「停留 3 秒」）
`World.setupMain()` 末尾设 `this.freezeTimer = CFG.levelFreeze.freezeTime`（**3.0 秒**），
规则与裂缝开场冻结**完全一致**（复用同一套闸门，见 5.1）：`World.update()` 见 `freezeTimer > 0`
即 **提前 `return`**（怪物/子弹/祭坛/拾取/伤害结算全停），`main.js` 主循环同步跳过玩家与同伴更新
（且清零移动意图防解冻滑行）→ **"全员无敌"是结构性保证，不是 invuln 标记**；
倒计时红字 3/2/1 + 压暗遮罩由 `render()` 绘制（与裂缝共用同一段，判据 `fw.freezeTimer > 0`）。

- **作用域：仅主关卡**。工匠世界是无敌人安全区**不冻结**；裂缝走自己的 `CFG.rift.freezeTime`。
- 首波怪在 `setupMain` 里**照常投放**（冻结期间场上有敌人但静止不动）。
- ⚠️ **改动「持续型机制」的时间假设是高频坑（§4.6）**：本机制落地时一次性弄红 7 个测试文件 30 条断言
  —— 根因是测试「`startRun` 后立刻 `step(N)`」期待 N 帧进度，而前 3 秒被冻结吃掉。
  **修法（三件套）**：① `freezeTimer` 在 `World` 构造函数显式初始化（已做）；
  ② 旧测试在 `startRun` 后调用 **`Game.skipIntroFreeze()`** 显式跳过（新加的测试辅助方法，
  放在 `js/main.js`，同时清 `G.mainWorld` 与 `G.activeWorld` 的冻结）；
  ③ **新增专项测试 `freeze_test.js`（28 条）** 覆盖冻结机制本身 —— **不是把旧断言放松**。
- ⚠️ **`rift_test.js` 不要加 `skipIntroFreeze()`** —— 它专门验证裂缝冻结，需真实等待 3 秒走完。

### 5.35 左上角 HUD 三块内容别叠在一起（头像栏 / 自动战斗 / Buff）

`#city-avatar-bar`（`left:16px; top:12px`）与 `#hud-tl`（`left:20px; top:16px`）**都锚定左上角**，
`#hud-tl` 内含「自动战斗按钮 + 风格选择器 + 状态 Buff 图标」。
若不处理，三者会在战斗时叠成一团。
- **修法**：`#hud:not(.city-mode) .hidden-in-battle { display:none; }` ——
  `index.html` 里 `#city-avatar-bar` 一直带 `class="hidden-in-battle"`，但**此前 CSS 里没有这条规则**
  （死类名），导致战斗时头像栏没被真正隐藏。**主城模式（`.city-mode`）下才显示头像栏**，
  同时 `#hud.city-mode` 会隐藏 `#hud-tl`，二者互斥、不共存。
- `#hud-tl` 改为 `flex-direction:column; gap:8px`（纵向排布，避免依赖 margin 撑开）。
- `#buff-area` 加 `flex-wrap:wrap; max-width:420px`（Buff 多了换行，不横向溢出）。
- 回归：`freeze_test` / `ui_flow_test` / 全量断言（当时 530，现基线 749）。

### 5.36 🔴 第十九章 = v2 重构基准（优先级高于第十六章）

设计文档新增**第十九章「战斗重构：芯片体系」**，与第八章 / 第十六章冲突时**以第十九章为准**。
第十八章是「施工标记表」，列出旧章节的失效条款，接手前先扫一眼。

**🟡 当前状态 = 配置/文档 + 第 1/2 步已落地**：`CFG` 已就位（`js/config.js` 顶部「★ 第十九章 规则重做」段），
第 1 步（普攻移除/经验曲线）与第 2 步（冷却制）战斗逻辑已接入（§5.41 / §5.42）；
**第 3/4 步（模块槽/芯片战斗侧）逻辑尚未接入**，UI 侧壳子已就位（§5.42 契约）。

新增配置块（全部为**预留**，逻辑侧未读取）：

| 配置 | 内容 |
| ---- | ---- |
| `CFG.basicAttack` | 普攻移除开关（`removed: true`） |
| `CFG.heroRoles` | 英雄三定位 output/defense/recovery + `byHero` 映射（三者**都有伤害**，防御/恢复是**低伤害**） |
| `CFG.skillResource` | 技能资源 = 冷却制（`mode: "cooldown"`） |
| `CFG.levelUp` | 经验来源 `participation` + 前期快后期慢曲线 + 4 选 1 |
| `CFG.moduleSlot` | 每英雄 4 模块槽，不限个数，同名叠加上限 9 级 |
| `CFG.modulePool` | 每英雄独立模块池（4 选 1 的候选来源） |
| `CFG.chips` / `chipSources` / `chipCodex` / `chipForge` | 芯片系统 / 来源 / 图鉴 / 芯片工坊 |
| `CFG.invLayout` | 同屏上下并列：搜刮背包（上）+ 芯片背包（下） |

标注废弃（**保留结构防报错**，逻辑侧不再读取）：`CFG.cardPool.removed`、`CFG.moduleSets.removed`、
`CFG.moduleLevel.linkBonus`、`CFG.weaponGrid`（旧尺寸）、`CFG.settleConvert.cardValue`、
`CFG.outLevel.crystalKill`（19.8 已定：结晶来源 = 击杀 BOSS + 撤离彻底折算并存，小怪击杀退役）。

### 5.37 🔴 给「被遍历的配置对象」加标记字段必须同步加守卫

`CFG.moduleSets` 加 `removed: true` 后，`js/game.js` 的 `moduleSynergy()` 遍历时把它当套装读 →
`TypeError: Cannot read properties of undefined (reading 'includes')`，
**一次性弄红 6 个测试文件**（smoke / runtime / backpack / econ / skill_module / skill_table）。

修法（已落地，`js/game.js:462`）：

```js
for (const sid in CFG.moduleSets) {
  const set = CFG.moduleSets[sid];
  if (!set || !set.members) continue;      // 跳过非套装条目（如 removed 标记位）
  const n = mods.filter(m => set.members.includes(m.defId)).length;
```

**规则**：往任何**会被 `for...in` / `Object.keys` 遍历**的 CFG 表里加"元字段"（`removed` / `note` / `desc`），
**必须同时给遍历点加守卫**。否则就是 §4.6 那类"改配置炸一片"的坑。

### 5.38 芯片背包口径（第十九章，待实现）

- **原武器栏（4×3）→ 芯片背包（6×5）**，配置读 `CFG.chips.grid`（`CFG.weaponGrid` 是旧值，别再用）。
- 与搜刮背包**同屏上下并列**（`CFG.invLayout`），不是标签页切换。
- 芯片 = **局内资产，出局消失**（`carryOut: false`），**不参与撤离折算**。
- 效果形式：**白蓝 = 纯数值放大；紫金 = 附加行为**（弹射/灼烧/分裂/传导）。
  行为芯片需代码侧新增"行为积木"，实现成本最高，**建议先做数值芯片打通链路**。

### 5.39 模块叠层口径必须与 `moduleLevel.maxLv` 同步

`CFG.moduleSlot.maxLv`（9）与 `CFG.moduleLevel.maxLv`（9）是**同一个上限的两处表达**。
改一处必须改另一处，否则"模块 9 级"与"阶段词缀解锁到第 3 阶段"会对不上。

### 5.40 ✅ 能量池退役的连带面（第十九章 19.3，已落地）

技能改冷却制后，以下都要一起处理（**别只删技能门槛**）：
- 英雄属性 `energyMax` / `energyRegen`（条目可保留，但不参与技能门槛）
- **队友独立能量池**（§5.19）整体作废
- HUD 左上**能量条 → 技能冷却环**（13.1 条款变更）
- 属性卡牌里的能量条目（随卡牌一起删）

### 5.41 ✅ 第 1 步已落地：普攻移除 + 技能全自动 + 经验/结晶新口径（19.1 / 19.4 / 19.8）

**别改回去**，以下是与旧版的关键差异（`exp_test` 34 条锁定）：

- **普攻移除**：`Player.fireBasic` 已删除；`updateCompanions` 的队友普攻分支已删除。
  英雄/队友**唯一输出 = 主动技能**；敌人侧 basic 条目保留（`CFG.basicAttack.keepEntriesForMonster`）。
- **技能全自动**：释放条件 = 冷却好 + 能量够 + 有目标，**不再看 `G.run.autoFight` 或 Space**。
  「自动战斗」按钮只剩**走位托管**语义。`CFG.skills2.autoCast` 已退役留存。
- **经验曲线公式化**：`expNextFor(lv)` 读 `CFG.levelUp.curve`（fastEarly：base 8 / growth 1.32 /
  softCap 12 级内 ×0.7 / maxLv 99）；`createRun` 初始 `expNext: expNextFor(1)`。
  经验宝石仍是**中立掉落物 → 队池**（"参与伤害即给"由拾取制天然满足，没有击杀者归属）。
- **升级奖励**：不再 `cardAssets++`（恒 0，卡牌通道自然冻结）；改为 `runBonus()` 按
  `(lv-1) × CFG.levelUp.baseStatGain` 给全队即时属性（队长 `computeStats` 与队友 `companionStats` 自动吃到）。
- **结晶口径（19.8）**：`Meta.awardRun` 只发 **BOSS 结晶**（`crystalBoss`），`kills × crystalKill` 已删；
  撤离折算（`conv.total`）在 `main.js` 结算处**另行叠加**；死亡 = `floor(crystalBoss × deathRatio)`、
  折算不发生。`crystalKill` 字段保留但**禁止新代码引用**。
- **测试改法记录**：`skill_table_test` 队友普攻断言改为「无 isSkill=false 子弹」；
  `aiSkill=false` 从「只普攻」改为「完全沉默」；`autofight_test` 场景 1/2 重写为「关闭态也自动放 +
  Space 无施法语义」。都是**换期望值，没放松断言**。
- ~~⚠️ 中间态手感~~：**第 2 步（冷却制）已落地**（见 §5.42），能量门槛已摘除，本警告失效。

### 5.42 ✅ 第 2 步 + 界面 6 件套已落地：冷却制 + 定位徽章 + 升级弹窗 + 维修无人机

**三线并行批次产出**（A 战斗线 / B 界面线 / C 文档线，契约先行，合并验收基线 638）：

- **冷却制落地（19.3，A 线）**：`Player.update` 技能条件改为 `if (target && this.skillTimer <= 0)` ——
  **能量门槛摘除**；`fireSkill` 不再扣能量；能量恢复循环停掉；`updateCompanions` 删能量检查/扣费/regen
  （错峰 `skillStagger` 保留）。`CFG.skills2.autoCast` 注释标「🔴 19.1 已退役」。
- **维修无人机（A 线）**：`Drone` 构造加 `repair = false` 参数 + `repairDroneTick()`
  （每 `CFG.skills2.repairDrone.repairInterval` 秒治疗 HP 比例最低己方成员，绿字、夹紧 hpMax）；
  召唤判定：`sk.repair === true || repairIds.indexOf(sk.id) >= 0`（js/game.js:685）。
- **exp_test 34 → 58 条**：新增第八/九节（冷却制 + 定位映射 + 维修无人机行为）；
  第 34 条改「能量不再被消耗」。
- **UI 6 件套（B 线，`ui_v2_test` 49 条锁定）**：
  1. `updateSkillCd()` 技能冷却环（`#hud-skill-cd`，ui.js:234）
  2. `heroRole` 定位徽章（output/defense/recovery）
  3. `onLevelUpChoice(candidates, onPick)` 升级 4 选 1 弹窗（ui.js:50，手机端触点 ≥64px）
  4. 背包三段布局：搜刮区 / 芯片 6×5 / 模块槽 4 格
  5. 工匠页新增「芯片工坊」页签（`chipForgeService` / `_renderForgeList`）
  6. 芯片图鉴页 + 首页入口（`showChipCodex` / `renderChipCodex`）
- **UI 接入契约（战斗侧待接线）**：`UI.onLevelUpChoice` / `G.run.chipInv` / `G.run.heroModules` /
  `Game.chipForge` 已就位，**等第 3/4 步战斗逻辑按 19.10/19.11 规格接入**。
- **C 线施工图**：设计文档新增 **19.10（模块槽规格）/ 19.11（芯片规格）/ 19.12（行为积木契约）**，
  共 23 小节 + **48 条验收断言清单**——第 3/4/5 步战斗侧派单直接引用。
- **代理踩坑记录（B 线自述）**：`_chipInv` 三级回退（chipInv→weaponInv→骨架）避免战斗侧未接前
  `tagCalc` 崩；`_dropTarget` 保留 `#grid-weapon` 别名兼容旧 `backpack_test`。
  **并行窗口期红测试 ≠ 真回归**：A 线曾报 `backpack_test bad=4`（`srcInv.remove is not a function`），
  是 B 线半成品所致，B 线自愈——**合并后统一验收才算数**。
- ⚠️ **git 事故记录**：沙箱休眠恢复后 `.git` 被重置为空仓库（工作树完好）。
  恢复法：镜像拉 `3403a32` tarball → `git init` 基线提交 → 工作树覆盖 → 重新生成 patch。
  **patch 交付物必须始终留存 `/workspace/_changes/`**，git 历史丢了也能重建。

### 5.43 🔴 升级 4 选 1 的暂停闸门 = §4.6 坑的第三次翻版（必修）

**症状**：第 3 步落地后 `extract_test` 4 条红（读条不推进）。诊断输出
`paused=true / queue=[1,1,1,1,1] / lv=6`——`damageMonster(boss, 999999)` 一把给爆经验 →
升到 LV6 → 队列堆 5 个待选 → `Game.paused=true` → 主循环跳过世界更新 → 读条只推进 1 帧。

**这是 §4.6 / §5.34 的同一类问题**：给持续型机制加暂停语义 → 时间假设测试全崩。**必做四件套**：

1. **显式初始化**：`Game.paused = false` 在 `startRun` 里重置（不能只靠对象字面量初值）。
2. **提供跳过闸门**：`Game.skipLevelUpChoice()` —— 清空 `G.run.modulePoolState[*].queue` +
   `paused=false` + `UI.onLevelUpChoiceClose()`。
3. **旧测试显式跳过**：`startRun` 后紧跟 `Game.skipLevelUpChoice()`（与 `skipIntroFreeze()` 并列）。
4. **⚠️ 中段触发的升级必须持续跳过**：只在开头调一次**不够**——杀 Boss / 拾经验宝石都会中途升级。
   **正解是改测试的 `step(n)`**：
   ```js
   function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t);
     if (Game.paused && Game.skipLevelUpChoice) Game.skipLevelUpChoice(); } }
   ```
   `extract_test` 用此法后 4 条转绿。**其他涉及「杀怪/拾宝 → 继续 step」的测试同样要套用**。

**无 UI 环境不存在此问题**：`presentLevelUpChoice` 在 `UI.onLevelUpChoice` 缺失时走默认路径
（自动选第一个非置灰候选），**永不悬挂**——这是刻意设计的降级路径，别删。

### 5.44 性能目标实测（`perf_test.js`，逻辑层）

用户目标 **100 子弹/秒 + 80 特效 + 80 角色同屏**，逻辑层压测结论（Node 无头，帧预算 16.6ms）：

| 压测项 | P99 耗时 | 占帧预算 | 判定 |
| ------ | -------- | -------- | ---- |
| 子弹层（100 发/秒 × 60s） | 0.135ms | **0.8%** | ✅ 大幅达标 |
| 特效层（80 并发） | 0.021ms | **0.1%** | ✅ 大幅达标 |
| 角色层（81 个一帧 update） | 0.194ms | **1.2%** | ✅ 达标 |
| 对象池 vs `new` | — | — | 吞吐 **5.81×**（563ms→97ms），堆更平稳 |

**结论：逻辑层远不是瓶颈（合计 <2% 预算），风险全在渲染层**（`drawImage` 调用数与缩放采样）。
- **渲染层无法无头测**，`perf_test.js` 输出末尾附了浏览器端验证指引（DevTools Performance 面板
  逐步操作 + Chrome tracing 关键指标 + 可注入的 `renderMs` 埋点方案）。
- 优化方向已列：离屏 Canvas 预渲染 sprite / 图集合批 / 分层 Canvas / 关 `shadowBlur`。
- 📌 **不要**把 `perf_test` 加进 `run_tests.sh`（性能压测不进回归门禁）。

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

测试 **22/22 全绿**，**PASS 合计 = 749**：

`smoke_test` / `runtime_test` / `backpack_test` / `econ_test` / `skill_module_test` /
`team_trigger_test` / `artisan_test` / `ui_flow_test` / `rift_test` / `extract_test` /
`shop_test` / **`skill_table_test`**（技能表 + 敌人技能表化 + 武器模块全队生效 + 装备全队 +
队友技能与独立能量池 + 局内增益全队/吸血归属 + 产物池隔离 + Buff 等级 +
英雄召唤物/陷阱上限 + 判定圈统一规则 + Boss 弹幕招式计数，**178 条**）/
**`autofight_test`**（托管 AI 三风格，42 条）/ **`mobile_test`**（移动端摇杆，14 条）/
**`boss_test`**（Boss 弹幕化 + 阶段机 + 护栏，**85 条**）/
**`bugfix_test`**（世界归属 + 视线判定 + 沿墙绕行 + 主城布局 + 画布跨端，**17 条**）/
**`grant_test`**（物品入包四分支行为锁定，**30 条**）/ **`freeze_test`**（主关卡开场冻结，**28 条**）/
**`exp_test`**（第 1/2 步战斗主链路：普攻移除 / 技能全自动冷却制 / 经验曲线 / 升级属性 / 结晶口径 /
维修无人机 / 定位映射，**58 条**）/
**`ui_v2_test`**（界面 6 件套：冷却环 / 定位徽章 / 升级 4 选 1 弹窗 / 三段布局 / 芯片工坊 / 图鉴，**49 条**）/
**`levelup_test`**（第 3 步模块槽：heroModules / 池过滤 / 4 选 1 入槽 / 槽满置灰 / 属性小包兜底 / 全队生效，**50 条**）/
**`chip_test`**（第 4 步芯片：makeChip / chipInv 6×5 / 宝箱商店接入 / tagCalc 统一词条链 / chipForge 三服务 / 负重，**61 条**）。
（另有 `perf_test.js`——**不入回归门禁**，用 `node perf_test.js` 手动跑性能压测，见 §5.44）

跑测试前先确认这个基线，改完必须仍然全绿且 `bad=0`，改完建议连跑 3 轮看抖动。
⚠️ 改动队友施法/产物相关逻辑会连带撞到 `skill_table_test` 第十节（队友技能与能量）与产物池断言
—— **别放松断言**，按新规则改期望值。
⚠️ **给「持续型机制」加开场所冻结/暂停语义会一次性弄红大量测试**（§4.6 / §5.34）：
主关卡开场冻结落地时弄红 7 个文件 30 条断言。新增此类机制时，同步给受影响的 `startRun` 后加
`Game.skipIntroFreeze()`，并**补专项测试**而不是放松旧断言。

### 组队类改动的端到端验证套路

`Game.startRun([...两个英雄])` → `G.run.companions[0]` → 往 `G.run.weaponInv.place(makeModule(...), x, y)` →
`recomputeWeapon()` 断言 `c.skills.*`；
要验「真的用上了」就造怪 + 清空弹池 + `c.energy=c.energyMax; c.skillTimer=0` +
`updateCompanions(G.mainWorld, 0.016)`，断言 `w.playerBullets`（19.1 后只有技能弹，全部 `isSkill=true`）。
队友 `heroDef` 是 `applyOutLevel` 返回的**副本**，可直接改 `weaponLv` 做等级独立性测试，
不会污染 `CFG.heroes`。

## 9. 主线与遗留待办

**主线 = 内容铺量 + 数值填充**（不设期限）。

- **第十七章剩余**：17.7 第 3 步（激光实体 `LaserBeam` + 弹幕吞噬机制，含 `laserCap 6`、
  线段-圆命中）；第 4 步（BS0004~BS0010 配表）；17.9 待定 5 条。
- **内容铺量**：关卡 3 → 10+、怪物 11 → 17+、技能锚点数值填表；属性卡池本批未动。
- **🔴 v2 重构（第十九章）落地顺序**（配置+文档已完成）：
  1. ✅ **删普攻 + 改经验来源**（参与伤害即给）+ AI 改放技能 + crystalKill 退役 —— **已落地**（见 §5.41，当时基线 565）
  2. ✅ **英雄三定位 + 技能冷却制**（能量池退役 + 维修无人机 + 冷却环）—— **已落地**（见 §5.42，基线 638）
  3. ✅ **升级 4 选 1 + 模块池**（heroModules / 池过滤 / 槽满置灰 / 属性小包兜底）—— **已落地**（§5.43，`levelup_test` 50 条）
  4. ✅ **芯片系统战斗侧**（makeChip / chipInv / 宝箱商店接入 / tagCalc 统一词条链 / chipForge 三服务）
     —— **已落地**（`chip_test` 61 条）；行为芯片（紫/金）仅数据通路骨架
  5. ✅ **UI 改造**：芯片背包 6×5 + 上下并列布局 + 芯片工坊 + 芯片图鉴 —— **已落地**（`ui_v2_test` 49 条）
  - ⚠️ 每步都要跑全量测试；**改完必须仍是 `22/22 全绿 / bad=0`（PASS 749）**。
  - 📌 **下一轮派单**：第 5 步行为芯片 4 种积木（弹射/灼烧/分裂/传导）+ `chip_behavior_test`；
    随后是 `tagCalc` 双源收口（删旧 `weaponInv` 路径）、Boss 激光实体 `LaserBeam`、内容铺量。
- **待确认**：主城商人新位置 `(0.14, 0.62)`；竖屏视野变窄是刻意行为（如需全宽需竖版布局）；
  第十九章 19.9 的 2 条待确认项（七项方案已全部确认，见 19.9 表）。
