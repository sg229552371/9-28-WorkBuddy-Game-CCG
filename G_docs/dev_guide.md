# 项目开发指南（含手机端远程开发）

> **本文件是仓库内的「随身上下文」。** 任何设备上的新会话（尤其是手机端云端会话）
> 拿到本仓库后，**先读这一份**，即可恢复项目铁律、已踩过的坑、机制基线与测试基线。
> 本机技能目录 `~/.workbuddy/skills/` 与 `.workbuddy/`（记忆）**都不在仓库里**，
> 换设备不会同步 —— 所以关键知识一律沉淀到本文件与 `G_docs/` 内。

**线上试玩（正式·主入口，手机优先）：** https://bagrogue-shooter.app.workbuddy.host/
**备用入口（push 后 1~2 分钟自动生效）：** https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/

> ### 路径与链接统一约定（2026-10-09 起）
> | 项 | 值 |
> |---|---|
> | GitHub 仓库（唯一真源） | `https://github.com/sg229552371/9-28-WorkBuddy-Game-CCG`（私有 · `main`）|
> | 云端沙箱工作区 | `/workspace/9-28-WorkBuddy-Game-CCG` |
> | PC 本地工作区 | `D:/AI-game-All/HTML_TEST_002` |
> | **正式试玩链接（主入口）** | `https://bagrogue-shooter.app.workbuddy.host/` —— WorkBuddy 托管站，国内手机体验优先 |
> | 备用试玩链接（自动最新） | `https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/` —— Pages，push 即生效 |
> | 本地预览 | `python3 -m http.server 8123` → `http://127.0.0.1:8123/index.html` |
> | 旧线归档分支 | `archive/pc-line-18`（方案 A 替换前的 18 提交，随时可回）|
>
> ⚠️ **托管站是独立部署，不会自动跟随 GitHub**。它被定为主入口 → **每轮 `push` 之后都必须重新发布**，
> 否则手机上玩到的是旧版（此坑已踩过一次：停旧版导致"看不见深渊之门"）。发布后**必须指纹复验**。
> ⚠️ **历史遗留的三方链接已作废**：`ae6c0d4fb9b5c352d.app.workbuddy.host`（旧沙箱域名，已失效）。
> 今后一律以上表为准，**不要再写其它试玩链接**。

> ⚠️ **代码以 GitHub `main` 为唯一真源**：云端/PC 各自 `push` 到远端收敛，不要假设任一侧本地必然最新。
> 协作方式：改完 → `bash push.sh "说明"` → 另一端 `git pull`。
> 原因与处理见 §0.1。

---

## 0. 手机端远程开发（电脑关机场景）

### 0.1 拿到代码（⚠️ 优先用工作区，不要直接 clone）

> **【2026-10-05 重要修正】GitHub 版本可能严重落后！**
> 本项目长期在沙箱工作区迭代，而沙箱**连不上 GitHub（网络受限）**，导致提交只留在工作区。
> 实测：GitHub 上停在约 20.8，而工作区已到 21.1（差 5 轮、约 2000 行改动）。
> **新会话务必按下面的顺序取代码。**

**首选：直接用沙箱工作区（它就是最新的）**

```bash
cd /workspace/9-28-WorkBuddy-Game-CCG    # 持久化目录，跨会话保留，无需 clone
git log --oneline -3                     # 确认 HEAD 是最新（应为下方基线表里的版本）
bash run_tests.sh                        # 确认全绿再开工
```

工作区是**跨会话持久**的：上一个会话的提交、`git` 状态、`node_modules` 全都还在。
新会话开场只需要一句话：

> 「读 `/workspace/9-28-WorkBuddy-Game-CCG/G_docs/dev_guide.md` 恢复上下文，代码用工作区，继续开发」

**备选：从 GitHub clone（仅当工作区不存在时）**

```bash
git clone https://github.com/sg229552371/9-28-WorkBuddy-Game-CCG.git
cd 9-28-WorkBuddy-Game-CCG
```
仓库是 **PUBLIC**，clone 无需凭据。但**必须用最新 patch 补齐**（否则拿到的是旧版）：

```bash
git am /workspace/0022-all-in-one-v16.patch    # 全量补齐到 21.1
```

**推送（需要凭据，只能在本机做）**：沙箱无法推送，见 0.4 与根目录 `推送指南.md`。

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

### 0.5 手机端试玩（**主入口 = WorkBuddy 托管站**）

```
https://bagrogue-shooter.app.workbuddy.host/     ← 主入口（国内手机体验优先）
https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/     ← 备用（push 后自动生效）
```

- **主入口 = WorkBuddy 托管站**：国内域名、手机上访问更稳，是用户日常体验入口。
  ⚠️ 它是**独立部署，不会自动跟随 GitHub** —— **每次 `push` 之后必须重新发布**，并做指纹复验。
- **备用 = GitHub Pages**：`main` 分支根目录 `/`，`https_enforced`，推到 `main` 后自动重新部署，
  首次生效约 1~2 分钟。开发自验（PC 端）用它最省事。
- 两端都是纯静态（`index.html` + `js/` + `css/` + `assets/`，无构建步骤），
  **代码里无绝对路径引用（无 `src="/…"`）**，所以部署在仓库名子路径下也正常 ——
  **新增资源必须继续用相对路径**，否则线上会 404。
- **这是验证「移动端表现」的实用手段**（本机 `agent-browser` 起不来，见第 7 节）。
- 用 `gh api repos/sg229552371/9-28-WorkBuddy-Game-CCG/pages` 可查 Pages 状态。

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

**首选一行命令：`bash run_tests.sh`**（仓库根，跨平台，自动探测 node）。全绿时退出码 0 并打印「全绿」，末尾给 `PASS 合计` 汇总 —— **当前基线 PASS 合计 = 1468**。

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
- 回归：`freeze_test` / `ui_flow_test` / 全量断言（当时 530，现基线 973）。

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

### 5.45 ✅ 第 5 步行为芯片 + 17.7 激光/配表已落地（三线并行批，基线 973）

**三条线并行产出**（B1 行为积木 / B2 激光实体 / B3 配表铺量），合并验收 **25/25 全绿、PASS 973**：

- **行为芯片四积木（19.12，B1）**：`applyBulletHitBehavior` / `applyBurnToMonster` / `monsterBurnTick` /
  `applyChainFromHit` / `spawnSplitBullets` / `renderBurnAura`，**全部集中在 game.js 文件末尾独立区块**，
  现有函数只插**单行调用**——这是行级冲突最小化的关键手法，后续并行务必沿用。
  - 🔴 关键护栏：`split` 小弹标 `isSplitChild=true` **不再分裂**（防无限递归）；
    `chain` 链锁标记挂**弹丸**上（`bullet.chainHit`）+ 传导走 `damageMonster` 不产生新弹（天然无递归）；
    `burn` **直接扣 hp 不走 `damageMonster`**（不吃防御/不触发链锁分裂递归），致死时补调 `onMonsterKilled`。
  - ⚠️ `damageMonster` 签名由 `(w,m,dmg)` 扩为 `(w,m,dmg,killer)`——**纯可选参**，旧调用不受影响。
- **LaserBeam 激光（17.7 第 3 步，B2）**：三段生命周期 `warn(0.9s)→active(1.6s)→fade(0.35s)`；
  线段-圆命中（`pointSegDist`/`segCircleHit`）；`laserCap 6` 超限 **FIFO 回收最旧**；
  **只在 active 期吞噬 `playerBullets`**（不吞自家 `enemyBullets`）；伤害按**段**节流（0.25s）而非逐帧。
  - 🔴 **激光独立于弹道预算**：不占 `bulletBudget/bulletCap`，只受 `laserCap` 约束。
  - 数值全部进 `CFG.boss.laser*`（`laserCfg(key, dft)` 惰性读取，缺省回退）。
- **配表铺量（17.7 第 4 步，B3）**：Boss **3→10 只**（BS0004~BS0010，两阶段换池，BS0010 三阶段）；
  普通怪 **5→17 只**（NM0015~0026）；新增激光技能 AT231~AT233（BS0006 三束旋转 / BS0009 深渊旋转）。
  - ⚠️ **敌人技能条目落在 `CFG.skills`（不是 `CFG.skills2`）**——`monsterAttackSkill`/`skillEntry` 实际读前者，
    `skills2` 是玩家侧。配表时别放错表。
- 🔴 **新增铁律：并行代理统一「文件末尾独立区块 + 单行调用」模式**。
  本次三线同改 `js/game.js` 零冲突，全靠这个约定；配表类工作则可整文件独占。
- 🔴 **收尾必查项**：代理若被禁止改 `run_tests.sh`，**新测试不会自动进门禁**，
  主会话收口时必须手动追加到 `TESTS` 列表（本次 `chip_behavior_test`/`laser_test`/`content_test` 三处）。
- **`tagCalc` 双源过渡仍在**：`heroModules` 与旧 `weaponInv` 路径并读，**旧路径未删**（留待下轮收口）。

### 5.46 ✅ 技能手感重调 + 全队技能栏 + 升级弹窗归属（用户实测反馈批，基线 1007）

**用户三条实测反馈**（原话）：「等级提升后，选择技能不知道强化谁的技能」「缺少队伍所有人技能栏 ui」
「技能伤害过高，CD 过长，体验很差」——全部落地。

- **技能手感（纯 CFG 数值，`js/config.js` AT101~AT114）**：用户拍板「**高频低伤**」+「保持割草节奏」
  （小怪血量不动）+ CD 落 **0.8~2.3s** 区间。

  | 类别 | 原 CD → 新 CD | 原倍率 → 新倍率 |
  | ---- | ------------- | --------------- |
  | 短 CD 主动（AT101/103/105/107/109/111） | 0.42~1.25 → **0.4~0.9** | 0.62~1.6 → **0.55~1.15** |
  | 长 CD 主动（AT102/104/106/108/110/112） | 2.4~3.5 → **1.5~2.3** | 1.8~3.2 → **1.2~1.9** |
  | 召唤/陷阱（AT113/AT114） | 12.0 / 9.0 → **5.5 / 5.0** | 不变 |

  - **敌人技能 CD 不动**（用户明确要求）；小怪血量不动。
  - 🔴 **根因**：技能**全自动释放**但原设计是「低伤高频 + 高伤低频」混合 → 不操作时大部分时间等大招 CD。
    这是**自动战斗与传统 CD 制不匹配**的典型症状，靠压缩 CD 区间 + 抹平倍率差解决。

- **升级弹窗归属（界面线 C1 + 战斗侧契约）**：`UI.onLevelUpChoice(cands, onPick, meta)` 新增**可选**第三参：
  ```js
  meta = { heroId, heroName, roleColor, slotUsed, slotPer }
  ```
  - 弹窗显示「**给 <英雄名> 选择强化**」+ 槽位进度（N/4）+ 定位色；`locked` 候选灰度禁用。
  - 🔴 **向后兼容是硬要求**：`meta` 缺失时弹窗退回旧行为（测试已验证）。
    战斗侧仍走**默认路径**（UI 缺失时自动选第一个可选候选，永不悬挂）。
  - 新增辅助 `heroDefNameOf(heroId)`（文件末尾独立区块）：队长查 `G.heroDef` → 队友查 `G.team` →
    回落 `CFG.heroes`，**查不到返回 heroId 本身**（保证弹窗永远有文本）。

- **全队技能栏（界面线 C1）**：`#party-skillbar`，**底部居中**，每人一条：
  `[技能图标 + 冷却环] [模块槽1][模块槽2][模块槽3][模块槽4]`
  - 数据源 `G.run.heroModules[heroId]`（4 格数组）；空槽 = 虚线框，已选 = 模块名 + 品质色。
  - 🔴 **性能手法**：结构只建一次（队伍签名比对），每帧只更新冷却角度与变化槽位——**绝不每帧重建 DOM**。
  - 模块品质色按**等级占 maxLv(9) 的 25/50/75%** 分 4 档（模块无独立 `itemQ`，此为推导口径）。

- 🔴 **数值改动引发测试红的处理范式**（本次 17 条红）：测试把伤害基准写死成 `1.0` / `2.5`。
  **正解 = 改成从 CFG 动态读**（`CFG.skills.AT101.dmgMul`），而非把数字改一遍——
  这样**以后再调数值就不需要动测试**。涉及 `skill_table_test` 11 处 + `smoke_test` 1 处 + 2 处补充。
  ⚠️ 反之，**断言本身不要放松**（只是把硬编码换成同源的 CFG 读取）。

### 5.47 ✅ 模块池全队混抽 + 竖屏优先 UI（20.0 批，基线 1053）

**用户需求（原话）**：
> 「升级后获得的武器模块是从**所有的队员中所需要的模块池中**获得 4 个，然后再 4 选 1，
> 所以说 4 选 1 的时候要**提示该模块对应的队友是谁**」
> 「游戏 UI 布局是多端的，所以要**以竖屏为主**，同时要**兼容横屏**，目前以**竖屏开发优先**」

#### A. 模块池 = 全队混抽（🔴 语义重大变更）

| 项 | 旧 | 新 |
| -- | -- | -- |
| 候选来源 | 只抽**升级者自己**的池 | **全队各英雄专属池汇总**后混抽 4 个 |
| 语义 | 升级 = 强化升级者 | 升级 = **一次「给全队某位置补强」的机会**（玩家主动决策养谁） |
| 入槽目标 | 升级者 `heroId` | 🔴 **`cand.heroId`（候选所属英雄）** |
| 满格队友 | 其候选置灰 | **整体排除**（不出他的候选，避免选了装不上） |
| 专属池 | 保持 | 保持（H001 模块只能进 H001 槽） |

- 🔴 **最容易出错的地方 = 入槽归属**。`applyLevelUpPick` 必须用 `cand.heroId`，用升级者会装错人。
  `levelup_test` 已加专项断言：选「队友 B 的模块」→ 必须进 **B 的槽**。
- **候选新增展示字段**：`ownerName`（`heroDefNameOf(id)`）+ `ownerRoleColor`（`UI.heroRole(id).color`）。
- **兜底条件变了**：从「该英雄全满级」变成「**全队**都无可选」（所有人满级或 4 格全满）→ 属性小包。
- 单人局退化为「自己抽自己」，与旧行为一致（有断言保护）。

#### B. 竖屏优先 UI（20.1）

- **画布（`fitCanvas`，js/main.js）**：竖屏（`aspect < portraitBreakpoint`）时 **`minAspect` 置 0** →
  按真实比例**填满竖屏**（旧 `minAspect 0.75` 会把手机竖屏钳成 4:3，左右留黑边成「中间一条」）。
  🔴 **`viewH × zoom` 垂直锚点语义不能动**——那是「角色大小跨端一致」的根基，只放开**宽度**方向。
  横屏沿用旧口径（零行为变更）。CFG 字段：`camera.portraitFill` / `camera.portraitBreakpoint`。
- **方向类名（`UI.applyOrientation()`）**：在 `body`/`#app` 挂 `.portrait`/`.landscape`，
  CSS 主分支据此切换（**不再只靠 `max-width` 断点**，旧断点没有竖屏维度）。
  幂等，resize / orientationchange 反复调；`fitCanvas` 末尾联动调用。
- **竖屏布局要点**：顶部状态铺满窄屏 → 底部让给操作控件（技能栏 + 摇杆**错层不遮挡**）→
  `#hud-tl` 下移避开头像栏（顺带解掉 §5.35 的左上角叠叠坑）；背包三段**上下堆叠**；
  升级弹窗 **2×2 网格**（触控 ≥64px）；工坊/图鉴单列滚动；安全区 `env(safe-area-inset-*)`。
- ⚠️ **遗留**：5 人满队竖屏时技能栏纵向堆叠 ≈370px，第 5 行可能贴近中央提示区
  （典型 1~3 人队无此问题）；后续可考虑满队缩放 `scale(.85)`。

#### C. 🔴 本次流程教训（重要）

- **派单必须验证真的派出去了**：本次 B 线任务**派发失败但主会话没察觉**，
  隔了 1 小时才发现 `index.html`/`css`/`ui.js` 一行未改。
  **对策：派单后立刻确认「代理已在跑」，或隔一段时间检查目标文件 mtime 是否有变化。**
- **代理报「完成」要看落盘证据**：`git status` + 目标文件 mtime，不能只信汇报文本。
- **`bugfix_test.js` 的「画布-竖屏」断言被 B 线改写**（旧断言锁的是「竖屏钳 4:3」，
  与本次需求**正好相反**）——需求反转时，旧断言必须同步反转，这不算「放松断言」。

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

测试 **28/28 全绿**，**PASS 合计 = 1468**：

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
**`chip_test`**（第 4 步芯片：makeChip / chipInv 6×5 / 宝箱商店接入 / tagCalc 统一词条链 / chipForge 三服务 / 负重，**61 条**）/
**`laser_test`**（17.7 第 3 步 Boss 激光：线段-圆命中 / laserCap 6 / 三段生命周期 / 弹幕吞噬 / 无激光等价性，**59 条**）/
**`chip_behavior_test`**（19.12 行为芯片：bounce / burn / split / chain 四积木 + 无芯片等价性回归，**48 条**）/
**`content_test`**（17.7 第 4 步配表：10 Boss + 17 普通怪结构合法性 / 技能引用存在 / 护栏内，**74 条**）。
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

- **第十七章 ✅ 全部落地**：17.7 第 1~5 步完成（发射器 + 护栏 + 阶段机 + 电报 + `LaserBeam` +
  弹幕吞噬 + BS0004~0010 配表 + 怪物铺量）；剩余仅 17.9 待定 5 条（设计层，非开发）。
- **内容铺量进展**：怪物 **11 → 17 只**（NM0015~0026 新增 12，实际 NM 总 17）；Boss **3 → 10 只**；
  ⬜ 关卡 3 → 10+（未做）；⬜ 属性卡池（本批未动）。
- **🔴 v2 重构（第十九章）落地顺序**：
  1. ✅ **删普攻 + 改经验来源**（参与伤害即给）+ AI 改放技能 + crystalKill 退役 —— **已落地**（见 §5.41，当时基线 565）
  2. ✅ **英雄三定位 + 技能冷却制**（能量池退役 + 维修无人机 + 冷却环）—— **已落地**（见 §5.42，基线 638）
  3. ✅ **升级 4 选 1 + 模块池**（heroModules / 池过滤 / 槽满置灰 / 属性小包兜底）—— **已落地**（§5.43，`levelup_test` 50 条）
  4. ✅ **芯片系统战斗侧**（makeChip / chipInv / 宝箱商店接入 / tagCalc 统一词条链 / chipForge 三服务）
     —— **已落地**（`chip_test` 61 条）
  5. ✅ **UI 改造**：芯片背包 6×5 + 上下并列布局 + 芯片工坊 + 芯片图鉴 —— **已落地**（`ui_v2_test` 49 条）
  6. ✅ **行为芯片 4 种积木**（bounce 折射 / burn 燃蚀 / split 裂变 / chain 链锁）—— **已落地**（§5.45，`chip_behavior_test` 48 条）
  - ⚠️ 每步都要跑全量测试；**改完必须仍是 `25/25 全绿 / bad=0`(PASS 1468)**。
  - 📌 **下一轮候选**：① `tagCalc` 双源收口（删旧 `weaponInv` 路径，§5.45 已留过渡）；② 关卡 3 → 10+
    铺量；③ 属性卡池；④ 美术接入（BGM/素材）；⑤ Godot 4.7.2 迁移评估。
- **待确认**：主城商人新位置 `(0.14, 0.62)`；竖屏视野变窄是刻意行为（如需全宽需竖版布局）；
  第十九章 19.9 的 2 条待确认项（七项方案已全部确认，见 19.9 表）。

---

## 10. 第二十~二十一章速查（20.5 → 21.1，会话压缩前的最后 10 轮）

> 新会话必读本节。章节号 = git 提交序号，细节看对应 commit message（`git log`）。

### 10.1 基线（2026-10-05）

- **门禁：46 项测试 2081 断言全绿 bad=0**；git 21 提交，最新 `450c3c0`（21.1）
- 全部历史 patch 在 /workspace（增量 `00NN-increment-*` + 全量 `00NN-all-in-one-vNN`）
- 线上发布：~~正式入口 = GitHub Pages~~（**2026-10-09 已变更** → 见 §0 顶部约定表：
  **主入口 = WorkBuddy 托管站** `https://bagrogue-shooter.app.workbuddy.host/`，每轮 push 后必须重新发布；
  GitHub Pages 降为备用/自动最新入口）

### 10.2 每轮一句话

> 早期轮次（20.5~21.12）已归档 → `G_docs/archive/dev_guide_archive_1_20.5-21.12.md`

| 轮次 | 内容 |
|---|---|
| 21.1 | 毒圈改 **dmgPercent 1% 比例口径**（`dmgPerTick` 是遗留字段**不参与结算**）+ 移动端只留摇杆（三按钮 `CFG.mobile.hideTouchButtons` 隐藏，技能本就全自动释放）+ 摇杆浮动 + autofight 挪右下 + NPC 点选 |
| 21.13 | **P2 渲染优化落地正式路径**：①敌方弹幕批绘（按外观等价类分两桶——小怪弹/Boss弹各单 Path 一次 fill，moveTo 逐发防连线；2000 弹从 6000 次/帧 → 9 次/帧，与数量解耦）②剔除常态化（cullMargin 260 不再被 isLowQuality 门控——视野外怪物对画面零贡献；低画质专属优化升级为全画质基线）+ **真机对比实测（render_opt_check.py，正式 render() 主路径）：500敌/500弹 p95 1.9→1.3ms(-32%) / 1500敌/1000弹 4.3→2.7ms(-37%) / 3000敌/2000弹 7.7→4.1ms(-47%)——规模越大收益越高** + render_opt_test 14 契约（源码级：批绘分桶/moveTo/LQ_SKIP_GLOW 保留；行为级：fill 与弹幕数解耦/剔除有意义）+ 门禁 2301→2315 全绿 |
| 21.14 | **P3~P6 方案定稿 + 三代理并行开发**（方案 `G_docs/plan_perf_p3_p6.md`：群体抽象沿用 lod/近档阈值 60/自动降档做仅降不升/玩法载体不做）。🅐 **T1 空间分区自适应**（core.js：`SpatialHash.autoCell` 三档 <500→96/<1500→128/≥1500→192 + `retune` 变档才重建 + query 去重标记改 `tick*4096+(++_qSeq)` 修 V8 陷阱）🅑 **T2+T3 对象池与零分配**（`js/pool.js` 新建通用池 `Pool.makePool`：obtain/release/recycle/forEachAlive/compact/clear + highWater 埋点；game.js：FX 粒子/飘字池化（`FX.parts=pool.buf` 渲染侧零改动）+ `swapRemoveWhere` 替换 World.update 三处 filter + `aliveHeroes/enemyTargets` 模块级 scratch 双缓冲 + explode 复用 `_explodeSeen`——每帧新建对象 6000→235 **降 96%**）🅓 **T4 画质三档 + 自动降档**（main.js：`qualityLevel/setQualityLevel` 0低1中2高 + `opts.manual` 置 `G.autoDowngradeDisabled` + `_autoDowngradeTick` 仅降不升（WINDOW 60/ALERT_MS 150/DOWNGRADE_MS 100/RUN 90/COOLDOWN 20000）+ `_qualityFromDevice` 纯函数内核 + `applySettings` quality↔lowQuality 双向同步 + `set-lowq` 老开关桥接三档；index.html `#set-quality` 分段控件；css `.quality-seg` 三处同步；ui.js `renderSettings` 单行桥接 `renderQualitySeg`）。**测试 4 新增：spatial 27 + pool 47 + quality_tier 60 + render_opt 14 → 门禁 2315→2450 全绿**。真机验收：3000敌/2000弹 p95 6.3ms（与 21.13 基线 6.1 持平——见坑 18 预热采样）；压测 lod 5.1ms/137fps/drawCall 182（-95.6%）；画质设置页三档读写+手动覆盖+选中态实测全 PASS（quality_ui_check.py） |
| 21.15 | **无尽模式（海量敌人玩法落地）+ 配套四线，四代理并行**（方案 `G_docs/plan_endless_21_15.md`，用户拍板：主城开门/50→300 封顶/死亡结算/小怪无血条）。🅐 核心层（`js/endless.js` 新建 + `CFG.endless` 15 字段）：波次制 `capFor=min(300,40+wave*12)`、强度曲线 `hpMul=1+(wave-1)*0.18`、奖励 `round(8*wave^1.15)`、视野外刷怪（spawnRingMargin 100）、复用真实 World/Monster/Player 类（kind="endless" 走空世界分支）；endless_test 70 契约。🅑 入口与流程（game.js 末尾区块 + ui.js + index.html 两屏）：主城「深渊之门」（CFG.city.abyssPortal，fx 0.86/fy 0.60，金红 #ff7a3c，channel 2s）、enterEndless/exitEndlessToCity、结算面板（到达波次/击杀/结晶+再来一次/返回主城）、首次规则说明（endlessSeen 存档标记只弹一次）；endless_flow_test 48。🅒 HUD+血条+文案（`js/hud_endless.js` 新建）：左上角三项信息区（深渊·第N波/击杀/同屏 M/cap，仅 inEndless 渲染，safe-area 适配）、**小怪去血条**（血条仅 Boss 110/精英 CFG.elites.barWidth 44，用户口径：小怪 2~4 击死血条是噪声）、帮助页 WASD 文案拆 .kbd-desktop/.kbd-touch 双段 CSS 三处同步；hud_endless_test 35。🅓 奖励打通（main.js 末尾区块）：波次结晶实时累加 run 内、死亡一次性入账（继承死亡保留 30%）、每 5 波掉宝箱（makeChestItem 落地拾取）、包装 Endless.settle 收敛 crystals=到手数（rawCrystals 留审计）+ 对齐结算报告；endless_reward_test 56。**集成三连修**（e2e 抓到的真缺陷）：①enterEndless 必须先建完整 run 上下文（坑 21）②规则说明须在 startRun 的 showHudOnly 之后弹（坑 22）③报告对齐须在面板渲染之前（坑 23）。**验收：门禁 2661 全绿（+211）；e2e 全链主城→深渊→波1~4（42→58→73→88 递增）→死亡结算 +16 结晶入账恒等；300 敌封顶 update+render p95=1.0ms；小怪无血条/HUD 三项/结算面板截图确认；无 JS 异常**。版本 bump 20261015 保持（同日二次发布） |
| 21.16 | **工程重构：单文件瘦身 + 门禁提速 + 文件地图**（方案 `G_docs/plan_refactor_21_16.md`；用户拍板重度重构 + 建地图，截图策略保持）。**① 单文件瘦身（纯物理搬移零逻辑改）**：game.js 5509→game(1521)+items(1130)+combat(1134)+modes(993)+render(771)；ui.js 2602→ui(1008)+ui-screens(1164，**Object.assign 挂载**——`const UI` 只能定义一次)+ui-panels(464)；main.js 1806→main(1224)+quality(306)+rewards(311)。最大单文件 5509→2032（config.js 纯数据表按方案不拆）。搬移完整性用「正文逐字比对 EXACT MATCH」证明；index.html 脚本序按原定义顺序重排（全局脚本 TDZ 约束）。**② 门禁提速 5.7×**：run_tests.sh 改「单作业池 + `wait -n` 限流（并发 min(nproc,8)）+ 各自写临时文件按固定序汇总」，60 测试分 4 套件（core22/ui16/feature15/perf7）；全量 **50.4s→8.8s**，新增 `--quick`（3.4s）/`--suite=`/`--list`；**口径零改动**（汇总行逐字节一致）。**③ 文件地图机制**：新建 `AGENTS.md`（新会话第一份读：速览/铁律/17 文件地图/常用定位表/门禁/坑索引/交付流程/归档位置）+ 局部读规范（禁整读 >800 行）；dev_guide 轮次表归档（20.5~21.12→`G_docs/archive/`）；/workspace 旧 patch·截图归档。**坑 25/26 入册**。验收：门禁 2661 全绿（连跑 3 次逐字节一致）；e2e 无尽全链正常；渲染 3000 档 p95 **6.3→5.3ms**（无回归反升）|
| 21.17（🅑 线）| **深渊撤离点 + 屏蔽空间裂隙雕像**（方案 `G_docs/plan_endless_rift_21_17.md`；本代理只做 🅑 行）。**① 最终 BOSS 掉撤离点**：`Endless.isFinalBossDefeated()` 为真 → `spawnAbyssExtractBeacon` 在 BOSS 死亡位置附近写 `world.exitBeacon`（**幂等，只掉一次**）；`updateAbyssExtract(dt)` 每帧轮询补掉 + `judgeChannel` 读条（`CFG.endless.extractChannel`=3.0s，与主线 exitBeacon 同款参数形态）。**② 三态结算同一入口** `abyssExtractSettle(reason)`：`extract`=全收益（不走 30% 折扣）、`death`/`timeout`=保留 `CFG.outLevel.deathRatio`(0.3)。**③ 受击归零**：`heroTakeDamage` 单行插 `abyssExtractInterrupt()`（对齐主线 exitBeacon 打断语义，撤离点保留可重读）。**④ 屏蔽 RIFT 手法**：game.js 的祭坛抽取（`CFG.altars` weight>0）只在 `setupMain`（主线）跑，深渊走 `setupArtisan` 分支**从不经过该行** → 在 modes.js 抽出纯函数 `abyssAltarPool(kind)`：`kind==="endless"` 时排除 `abyssBlockedAltarIds()`（默认 `["RIFT"]`），主线调用恒返回全池；`rollAbyssAltars` 按过滤池投放。**不改 `game.js` / 不改 `CFG.altars` 本体**。**⑤ 渲染**：新增独立 `renderAbyssExtract(ctx,w)`（render.js 末尾 §5.45 区块 + render() 内单行调用），只渲染 `kind==="endless"` 世界，零改动既有 isMain/artisan 分支。**⑥ 空值守卫**：`typeof Endless/abyssExtractSettle` 全守卫，Endless 缺失安全降级。新增 `rift_extract_test.js`（58 断言）；门禁 **2710→2769 全绿 bad=0**；版本 bump 20261018（index.html 20 处 + `Assets.buildVersion` 三处同步）。**坑 28 入册**。|
| 21.17（🅐🅒 + 数值/成长/强化）| **深渊大秘境改版全轮收口**（方案 `G_docs/plan_endless_rift_21_17.md`）。**🅐 时间驱动核心**（`js/endless.js`）：刷怪改「到点就刷，不等清场」；总时限 `timeLeft` 每帧递减归零 → `timedOut` 停刷；推进量 `progress = kills + elapsed*timeWeight` → `bossThreshold(n)` 触发 BOSS（存活不重复、视野外生成）；新增 `timeLeft/isTimedOut/progress/bossIndex/isFinalBossSpawned/isFinalBossDefeated` 六个查询。**🅒 HUD + 结算**（`js/hud_endless.js`/`js/ui-panels.js`）：`MM:SS` 倒计时（最后 60s 红闪）、推进进度条、`BOSS n/3`（最终 BOSS 高亮）、撤离点闪烁提示；三结局结算面板（撤离成功绿 / 时限耗尽红 / 深渊阵亡红）；补 `riftHudDispatchSettle()` 调度缺口（🅑 的 `G.abyssSettleReason` 原先无人消费）。**数值曲线重定**（用户逐条拍板）：每波只数分段线性插值 `waveCapAnchors=[[1,10],[50,100],[80,200],[90,256],[100,300]]`；波次间隔「先快后慢」`4.0s→11.0s`；`timeLimit: 780`（13 分钟）；`firstWaveDelay: 5.0`；怪物攻击改常量 `atkMul: 1.25`（旧 `dmgMulPerWave` 逐步放大退役）；同屏上限 `capMax: 3000`（**实测 3000 只纯怪 p95 仅 2.9ms，余量 5.7 倍**，压测新增「3000敌/0弹」档）。**怪物构成曲线**：`eliteRatioAnchors=[[1,0.10],[40,0.35],[79,0.60]]`（小怪先多后少）+ `bossMixRatioAnchors=[[80,0.05],[89,0.10]]`（80 波后无小怪=精英为主+少量 BOSS）+ 90 波后**全 BOSS**；`bossBudgetPerWave: 20` 解决 BOSS 池仅 10 种不够分的问题（每波唯一实例上限 20，超出按类型轮转复制，只数曲线不变）。实测构成：波79=79/118/0、波80=0/190/10、波90=0/0/256、波100=0/0/300（小怪/精英/BOSS）。**局内升级打通**（本轮修复）：根因 = `onMonsterKilled` 的掉落分支只覆盖 `w.isMain` 与 `w.kind==="rift"`，**深渊 `kind==="endless"` 两个分支都不进 → 击杀零经验**；解法 = 新增 `dropEndlessExp(w,m)`（`js/combat.js` 末尾区块 + `onMonsterKilled` 单行调用），复用主线同一条拾取链路（掉 `exp` 拾取物 → `World.update` 走近自动拾取 → `gainExp` → 4 选 1），枚数分档 Boss5/精英3/小怪1，倍率 `CFG.endless.expMul`。**深渊玩家强化**：新增 `applyEndlessPlayerBuff(st)`（`js/items.js` 末尾区块 + `computeStats` 末尾单行调用），`CFG.endless.playerBuff={hpMul:5,defMul:2,atkMul:1.5}`，**仅 `G.inEndless` 时生效**、主线/裂缝/工匠世界零影响；`enterEndless` 内置位后补满血。实测：进图 `hp 500/def 4/atk 21`，存活 **5s→25s**（撑到第 3 波）。新增 `endless_growth_test.js`（37 断言）。**⚠️ 遗留（本轮未解决）**：玩家清怪速度 < 刷怪速度 → 场上怪单调递增（8→10→18），第 3 波仍被压死；待用户决策「同屏软上限 / 清场才刷 / 再强化玩家」。门禁 **2769→2928 全绿 bad=0**；版本 bump 20261021。**坑 29/30 入册**。|


### 10.3 新会话必须知道的坑（血泪浓缩）

1. **CSS 三处规则覆盖**：主规则 / `@media (max-width:720px|900px)` 竖屏块 / `body.portrait` 钩子——**改布局必须三处同步**，否则改动静默无效（20.9 踩过：6 列被旧 3 列覆盖）。
2. **面板单屏锁**：统一 `max-height:calc(100dvh - 16px)`（overlay 宿主）/ `-44px`（screen 宿主）+ `padding-bottom:max(10px,env(safe-area-inset-bottom))`；禁 `overflow:auto` 整面板滚动。
3. **Playwright 调试**：全局 `const` **不挂 window**，用裸标识符访问；chromium 需 `--no-sandbox --disable-gpu`；本地预览 `python3 -m http.server 8123`。
4. **门禁 bad 口径**：PASS 文案**不能含英文 "error"**（用中文「错误」）；pass 计数按行首 `^PASS `。
5. **文件所有权并行切分**（多代理开发）：每代理独占文件集；新增逻辑一律**文件末尾独立区块**，现有函数只插单行调用（§5.45）。
6. **相机**：视野旋钮是 `viewH`（竖屏 `portraitViewH`），`zoom` 与之乘积配平、单改无效。
7. **技能全自动释放**：冷却好即放，`autoFight` 开关只管走位托管；Space/技能钮均冗余。
8. **毒圈**：`hazardDamage()` 读 `dmgPercent`（1% 最大生命，跳防御），hpMax 三级回退防 NaN；ttk 压力带 60~120s。
9. **NPC 点选**：进圈 1 秒解锁 → 点击本体。三函数在 game.js 末尾区块：`screenToWorld`（逆相机变换）/`npcTap`（四重门槛）/`renderNpcTapHint`（提示环）。主城 NPC 仍是旧的进圈即弹（未改）。
10. **结晶闭环**：来源=BOSS 60 + 撤离折算（`settleConvert.valueRate 0.5`）；死亡保留 30%；`outLevelCost` 指数曲线 `50×1.3^(n-1)`，满级累计 1602。产出明细走 `G.lastSettleReport`（`buildCrystalReport`/`publishCrystalReport`）。
11. **移动端**：下方三按钮隐藏不删 DOM（回退开关 `CFG.mobile.buttons`）；摇杆浮动（左半屏按下即中心）；`#btn-autofight` 已移入 `#hud-br`。
12. **战斗开场提示仍是键盘话术**（「WASD 移动·B 背包」）——待改成触屏话术（下一轮顺手项）。
13. **`heroes[i]` 索引是全库隐性契约**（21.6 血泪）：物理重排 `CFG.heroes` 会让技能解析全链错位（散弹手弹道 3→1 真机回归）——**展示顺序必须放渲染层消费 `CFG.heroDisplayOrder`，数据源顺序不可动**。
14. **测试桩 `getElementById` 对不存在 id 也返回空壳 FakeEl**（unlock_ui/ui_v2 桩）：「节点已移除」类断言**不能**用 `!get(id)`（恒 false），要用源码级断言（`__htmlSrc.indexOf(...) < 0`）；空壳 `_html=""` → innerHTML 文案断言对按钮类子元素无效，改断 `onclick` 绑定 + 行为。
15. **解锁双入口语义**（21.8）：heroLv 型 = `isHeroUnlocked` 查询式**被动自动解锁**（无需 UI）；crystal 型 = 必须主动调 `Meta.unlockHero`（导师面板 `_appendLockedGroup` + 选人详情区 `btn-unlock-hero` 双入口），排查「条件达成没解锁」先分清类型。
16. **压测复用真实类的三件套**（21.12）：① `Bullet` 签名是 `(x,y,ang,spd,dmg,side,...)`——side 是第 6 参不是第 5 参，错位会把 dmg 当 side 静默错乱；② `World` 构造传 `isMain=false, kind="stress"` 才走空世界分支（`isMain=true` 会触发 setupMain 依赖 `G.levelCfg.circles` 直接崩）；③ 轻量 player 桩必须实现 `takeDamage/heal`（ai=1 走真实 World.update 时敌方子弹命中会调，缺法则每帧抛错打崩主循环）。压测弹幕要「可见环铺场 + 每帧补位」——`life=1e9` 挡不住撞墙消亡（出界即 dead）。
17. **渲染优化的两个视觉等价红线**（21.13）：①弹幕批绘必须逐发 `moveTo`——漏写会让相邻圆被 Path 直线连接，渲染出大面积三角色块（arc 只描点不隔离路径）；②剔除 margin 必须 ≥260（Boss 爆炸预警圈半径 200+，margin 太小会把预警圈裁掉半圈——「玩家看不见危险」比性能问题严重）。
18. **性能测试必须先丢弃 JIT 预热轮**（21.14 血泪，差点误判「性能回归」）：V8 对 render() 的优化要数千帧才稳定，3000 敌规模预热更长——实测前 5 轮 p50 5.6~5.7ms/p95 峰值 13ms，第 6 轮起稳定 p50 4.7/p95 6.0ms。**采样脚本必须 WARMUP 3 轮丢弃再取 5 轮中位**，否则把 JIT 冷启动当回归，白查 2 小时（同配置 diff 对照 p50 一致即证明代码无差，差异全在尖刺）。
19. **V8 给对象高频写新属性 = hidden class 变更 + 写屏障**（21.14）：SpatialHash.query 去重标记若写成 `++this.tick`（每次 query 自增），每个候选对象每帧被写 `_qhTick` 上万次，3000 敌 p95 4.1→9.4ms。正确姿势：「帧号×4096+查询序号」拼单调整数标记，同帧内同一对象至多写一次。
20. **scratch 数组跨调用共享必须双缓冲**（21.14）：`enemyTargets` 内部调 `aliveHeroes`，两者若共用一个模块级 scratch 会互相覆盖——用 `_heroScratch`/`_targetScratch` 两个；且每个返回 scratch 的函数必须在文件末尾区块逐一审计调用点「即时遍历不保存引用」。
21. **创建「独立模式世界」必须复用 startRun 的完整 run 上下文**（21.15 血泪）：只 `new World()` 不建 `G.run/G.player/G.team` → 渲染与 update 循环读 `G.run.weaponInv` **每帧抛 TypeError**（黑屏刷错）。正确姿势（enterEndless 范式）：兜虚拟 `G.levelCfg`（startRun 读 mapW/mapH/name）→ `Game.startRun(team)` 建全量上下文 → **再覆盖** `activeWorld`/`mainWorld` 为新模式世界。降级路径也要保底 `createRun`。
22. **「进入后弹说明面板」必须放在所有 UI 切换之后**（21.15）：startRun 内部会调 `UI.showHudOnly()` 把 screen 层切走——先弹的说明面板会被顶掉（一闪而过/根本看不到，endless_flow_test 七2 抓到）。弹窗永远放流程末尾。
23. **结算面板渲染时序：报告对齐必须在渲染之前**（21.15）：先 publish 再渲染再对齐 → 面板明细行恒显示旧值（截图抓到「获得 +16 / 本局合计 +0」并存）。修法：对齐调用插在 publish 与 UI 渲染之间（全局函数运行时已定义，typeof 守卫兼容桩环境）。
24. **e2e 直接置 `m.dead=true` 的处决式清场不触发 recordKill/波次奖励**（21.15）：击杀挂钩在 `onMonsterKilled`，直改字段绕过整条结算链——测试推进波次要意识到「kills/crystals 不涨是正常的」，别误判为 bug。
25. **拆分巨型对象字面量必须用 `Object.assign` 拼接，不能用「剪切搬移」**（21.16）：`const UI = {...}` 是**一个**对象字面量，把方法剪到另一个文件会变成两个 `const UI` → **SyntaxError，整个脚本不执行**（不是报错，是静默全挂）。正确姿势：原文件保留 `const UI = {前半}`，新文件写 `Object.assign(UI, {后半})` 并**后加载**；方法体一字不动（仍属纯搬移）。验证手段：拆前拆后「正文拼接逐字节 diff」。
26. **全局脚本拆分的加载顺序 = 原文件内的定义顺序**（21.16）：`function` 有声明提升、跨文件调用安全；但 **`const`/`class` 有 TDZ**——A 文件顶层立即执行时用 B 文件的 `const` 而 A 先加载 → 崩。更隐蔽的是**循环依赖**（21.16 实测：`quality.js` 的函数被 `main.js` 的 `loadSettings()` 调用，而 `Game.qualityLevel=...` 又赋值 main.js 的 `const Game`）→ 解法是把「对 `const` 的赋值」留在定义它的文件里，拆出文件只承载独立函数。拆分后**必须连跑 3 次门禁**（时序耦合往往第 2~3 次才暴露）。
27. **门禁并行的输出必须「结果文件 + 固定序汇总」**（21.16）：并行跑测试若直接打印，完成顺序随机 → 输出不可读、diff 不了。做法：每个测试写独立临时文件（code/pass/bad/out），结束后按**固定套件序 + 组内原序**打印，与完成先后无关 → 输出确定（连跑两次 `diff` 逐字节一致才算过关）。并发度取 `min(nproc, 8)`，过载反而更慢。
28. **跨文件「屏蔽某机制」优先在**世界分支**解，而非改条件行**（21.17）：要「深渊不刷空间裂隙」时，最直觉是改 `game.js` 的祭坛抽取 `filter`——但**该行只在 `setupMain` 跑**，深渊世界走 `setupArtisan` 分支、**根本不经过**。解法 = 抽出按世界 kind 决策的纯函数（`abyssAltarPool(kind)`），主线调用恒返回全池、深渊调用排除白名单。这样零改 `game.js`、零改 `CFG.altars` 本体，且**主线不受误伤**。教训：动手前先确认「被改的那行到底哪些世界会执行」。另：新增独立渲染函数时，**别往既有 `if (isMain) / if (kind==="artisan")` 分支里塞 else**——单开 `renderXxx(ctx,w)` 并在主渲染里插一行调用，非目标世界恒早退，跨世界耦合最小。
29. **经验/掉落的「世界分支」极易漏 world.kind（21.17）**：`onMonsterKilled` 的掉落写成 `if (w.isMain) {...} else if (w.kind === "rift") {...}` —— **深渊 `kind === "endless"` 两个分支都不进**，导致深渊击杀零经验、局内升级系统完全触发不了。这个缺陷**门禁测不出来**（既有测试只覆盖 main/rift），只有真机 e2e 逐帧看 `G.run.exp` 才暴露。教训：新增世界类型时，**必须逐处检查所有 `isMain` / `kind ===` 的 if-else 链**，确认新 kind 的归属；更稳的写法是「白名单之外一律兜底」，而非「列举已知世界」。
30. **「未运行即返回满值」的 getter 会让 e2e 误报为「时间倒流」（21.17）**：`Endless.timeLeft()` 实现是 `s.running ? Math.max(0, s.timeLeft) : CFG.endless.timeLimit` —— 玩家死亡 → `settle()` 置 `running = false` → **读数立刻从 772 跳回 780**。我在 e2e 里看到「时间回涨」时一度判定成「状态被重置」的真缺陷，追查一轮才发现是**显示语义**。教训：判定异常前先确认「被读的函数是不是纯 getter」；探针读派生值时，同时打印它的原始字段（`state.running`）才能区分「真重置」与「兜底显示」。
31. **测试汇总行不能含英文 FAIL/Error（21.17 复现坑 4）**：`endless_growth_test.js` 汇总行写了 `"PASS 合计 = 37  FAIL = 0"` → 单独跑 37 全过、`exit=0`，但门禁报 `bad=1`：门禁口径 `grep -ci "Assertion failed\|FAIL\|Error"` 把汇总行里的 `FAIL` 计成了失败。教训：**PASS 文案连「FAIL = 0」这种表述都不允许**，汇总一律用中文（「失败 = 0」）。坑 4 已记过一次仍会复发 —— 写测试模板时先把汇总文案定死。

### 10.4 下一步候选

- L5-L10 实战手感调参（需真人试玩反馈）
- 战斗开场提示触屏化（小活）
- 赛季玩法雏形（99 关通关后循环）
- 美术/音频接入、Godot 4.7.2 迁移评估
- 性能主线路线图（`G_docs/plan_bullet_hell_scale.md`）：P1 压测✅ / P2 渲染✅ / P3 空间分区✅ / P4 对象池✅ / P5 画质分档✅（21.14 三代理并行交付，门禁 2450）→ 剩余：P7 真实设备验证（低端安卓机 + Safari 实测）、自动降档阈值真机校准
