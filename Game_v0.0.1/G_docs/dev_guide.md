# 项目开发指南（含手机端远程开发）

> **本文件是仓库内的「随身上下文」。** 任何设备上的新会话（尤其是手机端云端会话）
> 拿到本仓库后，**先读这一份**，即可恢复项目铁律、已踩过的坑、机制基线与测试基线。
> 本机技能目录 `~/.workbuddy/skills/` 与 `.workbuddy/`（记忆）**都不在仓库里**，
> 换设备不会同步 —— 所以关键知识一律沉淀到本文件与 `G_docs/` 内。

**线上试玩（正式·主入口，手机优先）：** https://bagrogue-shooter-85672.app.workbuddy.host/
**备用入口（push 后 1~2 分钟自动生效）：** https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/

> ### 路径与链接统一约定（2026-10-09 起）
> | 项 | 值 |
> |---|---|
> | GitHub 仓库（唯一真源） | `https://github.com/sg229552371/9-28-WorkBuddy-Game-CCG`（**公开** · `main`）|
> | 云端沙箱工作区 | `/workspace/9-28-WorkBuddy-Game-CCG` |
> | PC 本地工作区 | `D:/AI-game-All/HTML_TEST_002` |
> | **正式试玩链接（主入口）** | `https://bagrogue-shooter-85672.app.workbuddy.host/` —— WorkBuddy 托管站，国内手机体验优先 |
> | 备用试玩链接（自动最新） | `https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/` —— Pages，push 即生效 |
> | 本地预览 | `python3 -m http.server 8123` → `http://127.0.0.1:8123/index.html` |
> | 旧线归档分支 | `archive/pc-line-18`（方案 A 替换前的 18 提交，随时可回）|
>
> ⚠️ **托管站是独立部署，不会自动跟随 GitHub**。它被定为主入口 → **每轮 `push` 之后都必须重新发布**，
> 否则手机上玩到的是旧版（此坑已踩过一次：停旧版导致"看不见深渊之门"）。发布后**必须指纹复验**。
> ⚠️ **两个旧托管域名已冻结，不要再写、不要与新入口混用**：
> `bagrogue-shooter.app.workbuddy.host`（停在 `20261025`，app 归属另一个工作区，本机无法再更新）
> 与 `ae6c0d4fb9b5c352d.app.workbuddy.host`（停在 `20261021`）。
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
https://bagrogue-shooter-85672.app.workbuddy.host/     ← 主入口（国内手机体验优先）
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

#### 线上域名盘点（2026-10-09 实测）

| 域名 | `app-version` | 结论 |
| --- | --- | --- |
| `bagrogue-shooter-85672.app.workbuddy.host` | 20261026 | **主入口**（手机优先，WorkBuddy 托管站）|
| `sg229552371.github.io/9-28-WorkBuddy-Game-CCG/` | 20261026 | **备用**，push 后自动最新 |
| `bagrogue-shooter.app.workbuddy.host` | 20261025 | 旧托管站，**已冻结**（app 归属另一工作区，本机无法更新）|
| `ae6c0d4fb9b5c352d.app.workbuddy.host` | 20261021 | 更早的旧沙箱，**已冻结** |

⚠️ **不要在两个域名之间来回切换。** 两者版本号不同 → `index.html` 头部的「缓存自愈」
（`localStorage.app_version` 对不上就 `location.reload` 强刷）每次切换都会触发一次强刷，
并让 24 个 `js/css` + 36 张素材（约 2MB）全部 cache miss。手机弱网下很容易撞上
首屏 12 秒看门狗，表现就是下面这个面板。**统一认准主入口或 Pages 其中一个。**

#### 「启动超时：boot() 在 12 秒内未进入首页」怎么读

- 看门狗：`js/main.js:36` 的 `BootGuard.arm()`（`TIMEOUT_MS = 12000`，定义在 `main.js:982`）；
  首屏 `UI.showScreen("screen-main")` 之后由 `BootGuard.done()`（`main.js:71`）解除。
- `boot()` 里**唯一的异步阻塞点** = `await Assets.load(ASSET_MANIFEST)`（`main.js:45`）。
- 🔴 **已知缺口（尚未修）**：`Assets._loadOne`（`js/core.js:119`）只挂 `img.onload` / `img.onerror`，
  **没有任何超时兜底**。若某个素材请求「既不返回也不报错」（移动网络被挂起），
  该 Promise 永不 settle → `Promise.all`（`core.js:81`）永不 resolve → `boot()` **永久卡住**，
  12 秒后看门狗弹面板。
- 因此这个面板**不等于崩溃**：它会同时显示素材进度（`Assets.progress`）、脚本加载状态、
  错误列表。先看「素材」那一行 —— **停在 `N/36` 就是素材加载被卡住了**。
- 现场处理：**先刷新一次**（多半是弱网丢包）。若反复出现，正解是给 `_loadOne` 加超时兜底
  （超时即按既有「缺图 → 色块渲染」路径降级，保证 `boot()` 必定走完）。

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

**首选一行命令：`bash run_tests.sh`**（仓库根，跨平台，自动探测 node）。全绿时退出码 0 并打印「全绿」，末尾给 `PASS 合计` 汇总 —— **当前基线 PASS 合计 = 3365（门禁 76 套）**。

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

设计文档新增**第十九章「战斗重构：遗迹秘宝体系」**，与第八章 / 第十六章冲突时**以第十九章为准**。
第十八章是「施工标记表」，列出旧章节的失效条款，接手前先扫一眼。

**🟡 当前状态 = 配置/文档 + 第 1/2 步已落地**：`CFG` 已就位（`js/config.js` 顶部「★ 第十九章 规则重做」段），
第 1 步（普攻移除/经验曲线）与第 2 步（冷却制）战斗逻辑已接入（§5.41 / §5.42）；
**第 3/4 步（模块槽/遗迹秘宝战斗侧）逻辑尚未接入**，UI 侧壳子已就位（§5.42 契约）。

新增配置块（全部为**预留**，逻辑侧未读取）：

| 配置 | 内容 |
| ---- | ---- |
| `CFG.basicAttack` | 普攻移除开关（`removed: true`） |
| `CFG.heroRoles` | 英雄三定位 output/defense/aux（**26.x 起 recovery 已改名 aux＝辅助**，口径＝治疗/增益/减益/召唤；三者**都有伤害**，防御/辅助是**低伤害**）+ `byHero` 映射 |
| `CFG.skillResource` | 技能资源 = 冷却制（`mode: "cooldown"`） |
| `CFG.levelUp` | 经验来源 `participation` + 前期快后期慢曲线 + 4 选 1 |
| `CFG.moduleSlot` | 每英雄 4 模块槽，不限个数，同名叠加上限 9 级 |
| `CFG.modulePool` | 每英雄独立模块池（4 选 1 的候选来源） |
| `CFG.chips` / `chipSources` / `chipCodex` / `chipForge` | 遗迹秘宝系统 / 来源 / 图鉴 / 遗迹工坊 |
| `CFG.invLayout` | 同屏上下并列：搜刮背包（上）+ 遗迹秘宝背包（下） |

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

### 5.38 遗迹秘宝背包口径（第十九章，待实现）

- **原武器栏（4×3）→ 遗迹秘宝背包（6×5）**，配置读 `CFG.chips.grid`（`CFG.weaponGrid` 是旧值，别再用）。
- 与搜刮背包**同屏上下并列**（`CFG.invLayout`），不是标签页切换。
- 遗迹秘宝 = **局内资产，出局消失**（`carryOut: false`），**不参与撤离折算**。
- 效果形式：**白蓝 = 纯数值放大；紫金 = 附加行为**（弹射/灼烧/分裂/传导）。
  行为型遗迹秘宝需代码侧新增"行为积木"，实现成本最高，**建议先做数值型遗迹秘宝打通链路**。

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
  2. `heroRole` 定位徽章（output/defense/aux）
  3. `onLevelUpChoice(candidates, onPick)` 升级 4 选 1 弹窗（ui.js:50，手机端触点 ≥64px）
  4. 背包三段布局：搜刮区 / 遗迹秘宝 6×5 / 模块槽 4 格
  5. 工匠页新增「遗迹工坊」页签（`chipForgeService` / `_renderForgeList`）
  6. 遗迹秘宝图鉴页 + 首页入口（`showChipCodex` / `renderChipCodex`）
- **UI 接入契约（战斗侧待接线）**：`UI.onLevelUpChoice` / `G.run.chipInv` / `G.run.heroModules` /
  `Game.chipForge` 已就位，**等第 3/4 步战斗逻辑按 19.10/19.11 规格接入**。
- **C 线施工图**：设计文档新增 **19.10（模块槽规格）/ 19.11（遗迹秘宝规格）/ 19.12（行为积木契约）**，
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

### 5.45 ✅ 第 5 步行为型遗迹秘宝 + 17.7 激光/配表已落地（三线并行批，基线 973）

**三条线并行产出**（B1 行为积木 / B2 激光实体 / B3 配表铺量），合并验收 **25/25 全绿、PASS 973**：

- **行为型遗迹秘宝四积木（19.12，B1）**：`applyBulletHitBehavior` / `applyBurnToMonster` / `monsterBurnTick` /
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
| 满格队友 | 其候选置灰 | **仍保留**（§22.1 修正）——只要池内还有未满级模块（可叠层）；仅「池内全满级」才排除 |
| 专属池 | 保持 | 保持（H001 模块只能进 H001 槽） |

- 🔴 **最容易出错的地方 = 入槽归属**。`applyLevelUpPick` 必须用 `cand.heroId`，用升级者会装错人。
  `levelup_test` 已加专项断言：选「队友 B 的模块」→ 必须进 **B 的槽**。
- **候选新增展示字段**：`ownerName`（`heroDefNameOf(id)`）+ `ownerRoleColor`（`UI.heroRole(id).color`）。
- **兜底条件**（§22.1 修正）：**全队都无可选取模块**（每人池内模块全部满 9 级，且 4 格已满无法新装）→ 属性小包。
  🔴 「4 格全满」**不等于**「无可选」——已持有但未满级（lv<9）的模块仍可**叠层升级**。
  旧口径「全队满格即兜底」会让「模块等级没满」也跳属性小包（用户 2026-10-11 实测 bug），已修。
  判定真源 = `heroPickableModuleIds(heroId)`（已持有 lv<9 恒可选；未持有需有空槽），与 `makeCard` 的 `locked` 同源。
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

### 5.48 ✅ 26.x 玩法规则批（用户 6 条规则落地，基线 3115）

1. **掉落永不消失**：`CFG.pickup`（coin/crystal `life:-1` = 永不消失、exp 30 不变）；
   `spawnPickup` 读 `pickupLife(type)`，过滤逻辑兼容 -1。🔴 **性能兜底必须留着**：`maxPickups 200`，
   超上限自动磁吸**最旧的**（直接结算入账，价值不掉）——3000 敌性能主线下掉落无限积累会炸。
2. **体型分层**：`CFG.monsterSizeTier = { normal:0.7, elite:0.9, boss:1.35 }`，BOSS 可被
   `CFG.monsters[].sizeMul` 逐只覆盖（BS0001~0003 = 1.2/1.35/1.5）。口径 = **现在的渲染大小 × 分层倍率**，
   命中圈与精灵同步缩放（渲染在 `render.js` 乘 `m.sizeMul`，别只改 radius 一处）。
3. **敌人构成 7:3**：远程:近战 ≈ 7:3（charger 归近战线）。主线走 SC01~SC04 池权重，无尽走
   `CFG.endless.composition.rangedPct` + `_pickNormalId` 均匀抽样。**改比例会动难度曲线**，
   动池后必跑 `level_tuning_test` / `levels_11_20_test`。
4. **三定位 = output / defense / aux（辅助）**：🔴 26.x 起 **recovery 已改名 aux**（口径 = 治疗/增益/减益/召唤），
   别再写 recovery；`CFG.heroes[]` 每人有结构化 `role` + `range` 字段（12 人归类见 `battle_rules_test` 六4）。
   `CFG.statNames = {atk:攻击,hp:生命,def:防御,spd:速度}` 供 UI 显示「攻击 +3」。
5. **属性加成积木 `scaleBy` + 嘲讽**：技能表可带 `scaleBy:{stat,pct}` → 效果值 = 锚点固定值 + 施法者属性×pct
   （结算在 `SkillSystem.withScaleBy`）。嘲讽 = `type:"taunt"`（AT120「嘲讽战吼」，绑 H009 守护者 W009）：
   半径内敌人 `tauntedBy/tauntT` 强制攻击施法者；怪物选目标统一走 `monsterTarget()`（优先嘲讽者）——
   **新增「改变怪物选目标」的机制必须接这里**，别在 AI 各处分叉。
6. **雕像时间轴**：🔴 **主关卡不再「开局随机刷 5 座」**，全部 20 关由关卡表 `altarTimeline` 驱动：
   `{t:10.05, id:"ALTAR_003"}` 固定指定 / `{t:25, pool:[...], pick:1}` 池随机；调度器 `updateAltarTimeline`
   用 world 内部时钟（**开场冻结期不计时**），投放统一走 `placeAltar/spawnAltarFromSpec`。
   深渊/无尽改周期式（`CFG.endless.altarTimeline`）。新增祭坛机制只加 spec，别复活开局随机投放。

### 5.49 ✅ 启动超时根治 + 门禁口径统一（2026-10-09，基线 3254）

1. 🔴 **素材加载超时兜底（根治「[错误1]启动超时：boot() 在 12 秒内未进入首页」）**
   - 根因：`Assets._loadOne`（`js/core.js`）原先只挂 `img.onload` / `img.onerror`。
     **移动弱网下请求可能「既不返回也不报错」** → Promise 永不 settle → `Promise.all` 永不 resolve
     → `main.js` 的 `await Assets.load(...)` **永久挂起** → 12 秒后 BootGuard 弹诊断面板。
   - 修法：新增 `Assets.LOAD_TIMEOUT_MS = 8000`（**必须 < 12000 看门狗**），超时即 `finish(true)` 结算，
     该键不进 `Assets.images` → 渲染侧既有 `if(img)` 分支自动走**色块兜底**。
   - 三处细节：① `settled` 幂等闸门（onload / onerror / 超时 只结算一次，迟到 onload 仍采用图但**不重复计数**）；
     ② `finish` 里 `clearTimeout`，正常加载不留残留；③ `typeof setTimeout === "function"` 守卫，
     极简测试桩下退回改造前行为、不新增崩溃点。
   - 测试：`asset_timeout_test.js`（23 条，**假定时器队列驱动、零真实等待**）。
   - ⚠️ 场景判断：诊断面板显示 **「素材 N/36」卡在中途** = 素材挂起（本次修的路径）；
     显示「Game：× 未定义」= 脚本没加载上，是另一回事。

2. **门禁口径统一：74 文件 = 74 套（原「70 文件 / 66~69 套」的差集已消除）**
   - 21.20「层级退役」误摘 4 套：`endless_affix/arena/record/team_test` 连同真正下线的
     `endless_tier_test` 一起被移出 `run_tests.sh`。**但那 4 个模块至今仍被 `index.html` 加载并在运行**
     （`EndlessRecord` = 战绩榜在用，被调用 10 处；`EndlessArena`/`EndlessTeam` 各 2 处），
     摘掉纯属白丢 115 条覆盖 —— 已全部加回。
   - **教训：判断一个测试是不是「死测试」，要看它覆盖的模块是否仍被 `index.html` 加载 / 是否仍被调用，
     不能只看它有没有在门禁清单里。** 删测试前先做这三步：
     `grep <模块名> index.html` → `grep <暴露的全局名> js/ index.html`（排除自身）→ 看是否仍有调用点。

### 5.50 ✅ Boss 体验四件套（2026-10-09，基线 3281，门禁 75 套）

对应设计文档 **17.9 的五条拍板**，一次落地四件套（#2 激光维持不计入弹幕预算，无代码改动）：

1. **Boss 贴图区分**（`js/config.js` 怪物表 `sprite`）
   - 10 只 BS 各配 1 张：`BS0001→enemy19`、`BS0002→enemy13`、`BS0003→enemy20`、`BS0004→enemy15`、
     `BS0005→enemy12`、`BS0006→enemy21`、`BS0007→enemy03`、`BS0008→enemy07`、`BS0009→enemy14`、
     `BS0010→enemy22`（终焉本体保留最强视觉）。
   - 🔴 **与 NM/ED 零交集是硬护栏**：`js/main.js` 会把 Boss 贴图按 `130 * szMul` **覆写** `G.sprites[键]`，
     若普通怪共用同一张键，**普通怪会被一起拉成 Boss 体型**（视觉事故）。加新 Boss 贴图前先查这个。
   - `js/main.js` 改为**遍历怪物表里所有 `/^BS/` 键**自动 fit —— 新增 Boss 只改表，不用再逐条加代码。

2. **弹幕吞噬反馈**（`js/combat.js`）
   - `devourBullets(w)`：吞弹时 `spawnBurst` 吸收特效，**每帧 ≤ 3 个**（防刷屏护栏）；
     颜色取 `CFG.boss.color.laser`（青）—— 让玩家对得上「是这条光柱在吞」。
   - `renderLasers` 激活期：沿光柱朝发射点流动的箭头 + 源头脉冲环；**预警期不画**（反馈只属于激活期）。

3. **招式名横幅**（`js/game.js` + `js/render.js`）
   - `Monster` 新增 `skillName` / `skillNameT`；`bossFire()` 记录 `p.name || "未知招式"` 并启动计时；
     `update()` 递减；`render.js` 在**屏幕空间**（不受相机位移影响）画「招式名」，末 0.4s 淡出。
   - 停留时长 = `CFG.boss.skillNameTime`（1.5s）。

4. **转阶段宝箱**（`js/game.js` 的 `bossPhaseChest(m)` + `CFG.boss.phaseChest`）
   - `bossPhaseTick()` 阶段推进时调用；品质权重**直接复用当前关卡的宝箱档位**
     （`CFG.levelCurve.rows[n-1].chest → chestTiers[CT].weights`），**不另开一套数值**；
     无关卡表 / 无尽世界 → 回落 `CFG.boss.phaseChest.weights`。
   - 走 `grantItemToRun(r, item, { full: "discard" })`，满包作废 + toast；**整段 try/catch 静默回落，不阻断战斗**。
   - 与撤离结算的关系：宝箱按固定价值进「×0.5 折算率」→ **每转一次阶段多一份产出，是有意的经济增量**。
   - 🩹 踩坑：`bossPhaseTick()` **没有 `w` 参数**，最初写成 `bossPhaseChest(w, this)` 直接 `ReferenceError`；
     正确写法是 `bossPhaseChest(this)`（函数签名 `function bossPhaseChest(m)`）。

5. **`boss_ux_test.js`**（27 条）：①贴图区分/零交集/BS0010 独占 ｜ ③吞噬护栏·颜色·箭头·脉冲环·预警期不画
   ｜ ④记录→递减→横幅画出→归零消失 ｜ ⑤CT1 权重·入包·固定价值·满包不崩·回落兜底。

**连带修复**：`sprite_view_test.js` 里「BS0001 回落 `enemy22`」写死了贴图键，换肤后**假红**。
已改为**数据驱动**（`const BS_KEY = CFG.monsters.BS0001.sprite`，把该键覆盖成哨兵再断言）。
**教训：测试断言不要写死「当前取值」，要断言「取值 = 配表里的值」这个关系。**

### 5.51 ✅ 12 角重做 · 属性说明 · 近战引擎 · 技能吃属性（2026-10-09，基线 3336，门禁 76 套）

对应「一、UI 相关 / 四、角色定位与技能体系」两条拍板（一4 布局参考 = 出战关卡局内战斗界面；
四1 = 12 角全部重做、4/4/4 定位、每角 1 个不重复特色技能；四2 = 补 3 个专属 + 技能吃属性）。

1. **属性说明补全**（`js/config.js` + `js/ui.js` + `css/style.css`）
   - `CFG.statNames` 由 4 键扩到 **12 键**；新增 **`CFG.statDesc`**（`{name, unit, desc}` × 12），
     每键一条**人话说明**（如 `def` = 「减免每次受击的固定伤害，最低仍会掉 1 点」）。
   - `UI._statKeysOf(h)`：决定英雄详情**展示哪些属性**——基础 4 + 能量恒列，
     `summonMax` / `trapMax` **只在该英雄高于默认值时才列**（召唤师 H007 / 陷阱师 H008），避免 12 行噪声。
   - `UI._statHelpHtml(keys)`：渲染「属性名 + 量纲 + 一句说明」，未登记键回落「暂无说明」（不空白）。
   - `.cd-stathelp` 深色主题样式（沿用界面深色底，别按浅色写）。

2. **12 角定位重做**（`CFG.heroes`，`role` 分组 `4/4/4` **不变**——被 `hero_roster_test.js` 一2c/2d/2e 锁定）
   - 输出 `H001/H002/H003/H006` ｜ 防御 `H004/H005/H008/H009` ｜ 辅助 `H007/H010/H011/H012`。
   - **每个定位都同时有远程与近战**：输出 1 近 / 3 远、防御 2 近 / 2 远、辅助 2 近 / 2 远（共 **5 近 / 7 远**）。
   - 属性按定位拉开：输出 `hp[80,145] def[1,4] atk[15,32]`、防御 `hp[115,165] def[5,9] atk[7,12]`、
     辅助 `hp[100,128] def[3,6] atk[10,15]`；**防御定位均值 HP 最高、攻击最低**（按均值比较，不按极值）。
   - ⚠️ `H002 散弹手` **必须保持 `range:"ranged"` + 普攻 `AT103`（三向散射）**：
     这是 `runtime_test.js` 锁定的核心身份，改成近战会被打红。

3. **近战引擎**（`js/combat.js` 的 `castMelee`，技能 `AT121 近战挥砍`）
   - `type:"melee"` = **身周扇形即时判定**，**不产生飞行物**：命中 = 距离 ≤ `reach + 目标半径`
     且与朝向夹角 ≤ `meleeArc/2`；伤害走 `damageMonster`（`killer = caster` → 吸血归属正确）。
   - 贴身重合（`d ≤ 1`）时**跳过角度剔除**，避免零向量抖动误判。
   - 近战定位 = **必须贴身 / 单次伤害更高（`dmgMul 1.35 > 远程 1.0`）/ 出手更快**，被弹幕惩罚更重。
   - 所有近战英雄普攻**统一挂 `AT121`**（共享引擎积木）；**差异化靠各自的 `kind:"skill"` 特色技能**。

4. **属性成长积木 `scaleBy`**（`SkillSystem.withScaleBy(sk, stats)`）
   - 最终值 = **锚点固定值 + 属性 × `pct` × 等级系数**（`CFG.skillScaleBy.levelGrowth = 0.06`），
     产物落在 **`sk.scaleByAdd`**；未声明 `scaleBy` → **原样返回**（零足迹）。
   - 现有 4 个用户：`AT120` 嘲讽半径走 `def` ｜ `AT122` 治疗量走 `atk` ｜
     `AT123` 光环幅度走 `def` ｜ `AT124` 护罩值走 `energyMax`。

5. **3 个专属辅助技能**（`AT122 生命脉冲` / `AT123 鼓舞光环` / `AT124 灵能护罩`）
   - 共用 `castSupport(w, caster, sk, opts, kind)` 骨架：**圆形 `explode` 伤害 + 全队效果**。
   - `AT122` 回血 ｜ `AT123` 写 `圣咏鼓舞`(atk ×) + `圣咏迅捷`(spd ×) 两条 `G.run.buffs` ｜
     `AT124` 写 `灵能护罩`(def 平坦加成，走 `runBonus().add.def`)。
   - **临时增益 `pushRunBuff(id, stat, mul, duration)`**：不带 `skillId`，同 `id` **只保留一份** ——
     重复施放 = **刷新时长，不叠加、不叠乘**（避免无限叠乘）。
   - 🩹 **踩坑（血量通道不一致）**：**队长**的血在 `G.run.hp` / `G.run.hpMax`（`Player` 实例本身
     **不带 `hp` 字段**，见 `heroTakeDamage → G.player.takeDamage`），**队友**才在 `h.hp` / `h.hpMax`。
     初版治疗循环统一按 `h.hp` 读 → 队长的 `h.hp` 恒为 `undefined` → **治疗永远跳过队长**，只有队友回血。
     修法：循环里按 `h === G.player` 分流两条通道。**以后凡「对全队生效」的效果，先分清读哪个字段。**

6. **`hero_kit_test.js`**（**51 条**）：①属性说明（名称/文案/回落/`_statKeysOf` 条件列）｜
   ②近战扇形（正面中/背面不中/90° 不中/超距不中/群体中/已死跳过/`cast` 分发）｜
   ③12 角特色技能零重复 + 近战全挂 `AT121`、远程一律不挂 ｜
   ④`scaleBy`（属性越高加成越大 / 锚点公式 / 零足迹 / 属性缺失不加成）｜
   ⑤辅助三件套（伤害 + 队长与队友**同时**回血 + 增益写入 `runBonus` + 重复施放不叠加 + 防御进 `computeStats`）。
   - 🔧 桩要点：`fakeW()` 必须提供真实 **`SpatialHash` 的 `monsterHash`**，否则 `explode → w.monsterHash.query` 崩。

**连带修复**：
- `smoke_test.js` 两处写死值 —— 「`CFG 原表不被污染`」断的是 `CFG.heroes[0].hp === 100`（改属性后假红），
  已改为**快照对比**（先存 `_h001hp`，`applyOutLevel` 后比对）；`heroWeaponChecks` 里
  `H005→AT109 / H006→AT111` 改为 `AT121`（这两角已转近战）。
- `hero_roster_test.js`、`skill_table_test.js` 已同步新基线（`cat=active` 43→47、`cat=buff` 4→7，
  并新增「`pool:"skill"` 不进战争雕像池、`warBuffs` 仍为 4」断言）。

**教训（复发型）：改「配表数值 / 分类计数 / 武器映射」时，先把全仓 `grep` 一遍写死的旧值。**
断言要写**关系**（A = 配表里的 A）而不是**当前取值**（A = 100）。

### 5.52 ✅ 三大基础属性 · 属性说明图标 · 统一战斗 UI · 测试期全解锁（2026-10-09，基线 3349，门禁 76 套）

用户五条拍板：① 角色选择右上角加 ico 图标 → 弹「属性说明」tips；② 新增**力量/敏捷/智力**三基础属性并对技能有增益；
③ 测试阶段**开启所有角色**；④⑤ image#2 的战斗 UI = **唯一战斗布局**，深渊也用它，只允许功能级增减、大体不变。

1. **三大基础属性**（`js/config.js` + `js/items.js` + `js/combat.js`）
   - `CFG.heroes[].str/agi/int`（12 角按定位+远近战差异化，组合互不相同）+ **`CFG.baseStats` 转换表**：
     `str → hp+6/点、atk+0.5/点`（攻击通道 → 所有技能伤害受益）｜
     `agi → spd+1.2/点、cdMul ×(1−0.4%/点)`（下限 ×0.5）｜
     `int → energyMax+2/点、技能效果强度 +1%/点`。
   - **结算点 = `computeStats()` / `companionStats()`**：折算与装备/增益同源、队长队友同表；
     `str/agi/int` 原值挂上属性产物 → **`withScaleBy` 直接支持 `stat:"str"|"agi"|"int"`**（statSrc 就是它）。
   - **技能效果强度**：`castSupport` 的治疗/光环/护罩量统一 ×(1 + `supportPowPct(opts)`)，
     读 `opts.statSrc.int`——**测试桩没传 statSrc 时安全回落 0**。
   - 🔴 **只折算不写回 `CFG.heroes`**——定位属性带 / 基础值的测试基线（hero_roster_test 五段、smoke_test）不受影响。
   - ⚠️ **连锁**：`cdMul` / `atk` / `energyMax` 的**精确值断言**全部要改成「×敏捷折算 / +力量折算」的**动态期望**
     （`smoke_test` 冷却卡、`skill_table_test` 攻速卡/队友冷却/Buff 乘算、`econ_test` 能量卡都撞过）。

2. **属性说明图标 + tips**（`index.html` + `js/ui.js` + `js/main.js` + `css/style.css`）
   - `#btn-stat-help`（圆形 `?` ico，`.char-head` 右上角）→ `UI.toggleStatHelp()` 弹 `#stat-help-tip`，
     内容 = `Object.keys(CFG.statDesc)` 全量说明（**与角色详情同一数据源 `_statHelpHtml`**，不会两套文案）；再点关闭。

3. **统一战斗 UI（深渊复用主线布局）**（`index.html` + `css/style.css` + `js/ui.js`）
   - **删除** `#abyss-hud` 及其全部 CSS（三处：主规则 / 竖屏媒体块 / `body.portrait` 钩子）+ `ui.js` 的 DOM 写入点。
   - `abyss-mode` **只隐藏** `#btn-autofight` / `#autofight-styles`，**不再隐藏** `#hud-top` / `#hud-tr`。
   - `updateHUD` 新增深渊分支：进度条同一条，文案「深渊推进 击杀+时间加权 / 下一 BOSS 阈值」
     （复用 `Endless.progress()` / `Endless.bossThreshold(bossIndex)`，**不另算一份数据**）；
     `#hud-tr` 等级·货币·经验照常写入（数据同源 `G.run`）。
   - `updateAbyssHud` 收敛为只挂/摘 `.abyss-mode` 类；`clearAbyssHud` 只摘类（幂等）。
   - 🔧 桩要点：测试里调 `UI.updateHUD()` 需要 `G.levelCfg`、`G.mainWorld.altars`、`G.inRift`、
     `G.run.backpack.items`（`insuranceCount` 会 `.filter`）与 `backpack.totalWeight()`——缺一个就崩。

4. **测试期全解锁**（`js/config.js` + `js/modes.js`）
   - `CFG.testUnlockAllHeroes = true`（**当前开启**）→ `isHeroUnlocked()` 首行短路，12 角全可选；
     **正式上线前改回 false**，正式解锁链自动恢复。
   - ⚠️ `unlock_ui_test` / `meta_growth_test` / `hero_roster_test` / `ui_layout_test` 专测正式解锁链路，
     各自在**套件内** `vm.runInContext("CFG.testUnlockAllHeroes = false;", ctx)` 临时关掉（不改 config 默认值）。

5. **测试**：`hero_kit_test.js` 新增第六段（折算增量法：单属性归零对比 `computeStats` 差值 / 技能效果强度 /
   全解锁开关 / tips 弹窗）→ **62 条**；`endless_hud_test.js` 一/二/三/六段**整段重写**为统一布局口径（元素已删、CSS 已清、
   abyss-mode 只藏自动战斗、updateHUD 深渊推进分支）。

**教训（复发型）**：① 给既有数值通道「加一条折算来源」时，全仓 grep 该字段的**精确值断言**（`===` / `near`），
全部改成动态期望；② 测试断言「某字符串不存在」时注意**注释里也会出现该词**，断言要锚定真实选择器 / DOM 读写点。

### 5.53 ✅ 属性说明收敛到 ? 弹窗 · 队伍满员仍可看详情（2026-10-09，基线 3356，门禁 76 套）

用户两条反馈：① 角色详情面板里还有一份「属性说明」，与右上角 `?` 弹窗重复；② 选人界面「点卡片 = 选出战」，
**队伍满员后点任何角色都没反应**（详情也刷不出来）。

- **属性说明收敛（唯一展示位）**：删掉 `renderCharDetail` 两处 `_statHelpHtml(_statKeysOf(h))` 内嵌区块；
  `UI._statKeysOf` 失去唯一调用方 → **删除**（死代码）。弹窗标记改为**专用样式类**
  `sht-head / sht-row / sht-name / sht-unit / sht-desc`（属性名金色 12px、量纲弱化 10px、说明独立成行、
  虚线分隔、末行无分隔线），CSS 同步重写 `.stat-help-tip`（360px 宽 / 52vh 高）并清掉 `.cd-stathelp*`。
- **满员仍可看详情（体验修复）**：`card.onclick` 满员分支原为 `toast(...); return;` ——
  **`return` 把后面的 `renderCharDetail` 一起跳过了**，这才是「点不动」的根因。
  修法：满员分支先渲染详情再返回，并把提示文案改成可执行的指引
  （「队伍已满（3/3）· 再点一名队员可移出」）。**选中/取消语义与详情回落队首的旧行为一字未动**
  （用户口径：仅修满员可看详情）。
- **队伍上限保持单点可扩**：`CFG.team.maxSize` 是全链路唯一开关（按钮文案 / 满员拦截 / 跟随队形 /
  技能栏 / AI 队友 / 尾迹长度全部数据驱动）；补注释说明扩容前需评估**性能基线**与**怪物强度曲线**。
  `smoke_test` 里写死的 `CFG.team.maxSize === 3` 改为**关系断言**（`>=1` 的整数 + 队友数 = 人数-1），
  扩容不再假红。
- 测试：`ui_layout_test` 新增第七节 7 条（满员点非队员 → 详情更新 / 不入队 / toast 含 3/3 与「移出」；
  满员点队员 → 正常移出；上限单点校验）→ 51 条。基线 **3349 → 3356**。

**教训**：**「早退分支」是体验 bug 的高发区**——限流/拦截类 `return` 很容易把「纯展示」副作用一起吞掉。
写限流分支时先问一句「这个 return 会不会顺手跳掉本该发生的事（渲染 / 同步 / 提示）」。


### 5.54 ✅ 统一战斗 UI 契约护栏（2026-10-09，基线 3364，门禁 76 套，**无代码改动**）

用户复核深渊与关卡地图的战斗 UI 口径（三点确认：资产 = 货币+负重+背包（现状已齐）；
深渊**继续隐藏**自动战斗按钮；深渊左上专属信息区**保留**）。复核结论 = **现状实现已符合口径，本轮无 js/css 改动**，
只把口径固化成**护栏测试**，防止后续改动破坏统一性：

- `endless_hud_test.js` **第九节「统一战斗 UI 契约」**（3 条静态 + 4 条行为，共 8 条）：
  ① 必留元素静态存在（`#hud-tr`/`lv-num`/`bar-exp`/`coin-num`/`exp-num`/`#party-skillbar`/`#hud-bl`/`weight-num`/`btn-backpack`）；
  ② **隐藏白名单**：`#hud.abyss-mode ... display:none` 规则数 ≤ 2 且只含 `#btn-autofight` / `#autofight-styles`
  （以后谁再给深渊加隐藏项，这条会报红 → 强制走设计确认）；
  ③ 必留元素未被任何 abyss-mode 规则点名隐藏；
  ④ `updateAbyssHud` 只挂/摘 `.abyss-mode`，不自写经验条/货币/负重（防平行 HUD）；
  ⑤ 行为级：深渊态下 `updateHUD()` 照常写入 LV/经验条宽度/货币/负重，且队伍技能栏渲染出 = 队伍人数的栏位。
- 🩹 **踩坑（第三次同类）**：断言「CSS 里某选择器不被隐藏」时，**注释里也会出现该选择器名**
  （`#hud.abyss-mode 隐藏自动战斗按钮 … 原独立 #abyss-hud 经验条已删除（与 #hud-tr 重复）`）
  → 必须先 `css.replace(/\/\*[\s\S]*?\*\//g, "")` **剥注释**再断言。**规则 4 已第三次复发，写 CSS 正则前先剥注释。**

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

**全量 = 93 套 / `PASS 合计 = 4083` / `bad = 0`**（2026-10-12，APP_VERSION `20261045`）。仓库现有 **93 个 `_test.js`**，
门禁**全部编排（93 套）**，**口径统一、无差集**（CORE 24 + UI 18 + FEATURE 27 + PERF 7 + SKILL 17）。
> 🔑 **技能系统入口 = `G_docs/skill_system_master_v1.md`**（总纲索引：文档权威层级 / 核心规则 / 代码落点 / 进度 / 缺口）。
> 做技能系统相关开发**先读它**，不确定的规则/字段一律回查真源，别凭记忆联想。
> 22.x 新增「能量水晶技能系统」12 套（`skill_config/compiler/damage/events/scheduler/runtime/reward/presenter/save/sweep/integration/fps_test`，
> 共 403 断言），报告见 `G_docs/skill_system_w6_report.md`。系统**当前装好但未启用**（默认关），对现有玩法零影响。
> ⚠️ 曾有一处误导（2026-10-09 已纠正）：`endless_affix/arena/record/team_test` 被说成「21.20 退役的死测试，别加回」。
> 事实是它们覆盖的 4 个模块**至今仍被 `index.html` 加载并在运行**（`EndlessRecord` = 战绩榜在用，调用 10 处），
> 21.20 只是连真正下线的 `endless_tier_test` 一起误摘。**已全部加回门禁，别再删。**
逐套明细以 `bash run_tests.sh --list` 与仓库根测试文件为准。历史各批次的逐套断言明细见下方旧记录（数字已过期，仅存档）。

（以下为历史明细存档，数字以上一行为准）

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
**`ui_v2_test`**（界面 6 件套：冷却环 / 定位徽章 / 升级 4 选 1 弹窗 / 三段布局 / 遗迹工坊 / 图鉴，**49 条**）/
**`levelup_test`**（第 3 步模块槽：heroModules / 池过滤 / 4 选 1 入槽 / 槽满置灰 / 属性小包兜底 / 全队生效，**50 条**）/
**`chip_test`**（第 4 步遗迹秘宝：makeChip / chipInv 6×5 / 宝箱商店接入 / tagCalc 统一词条链 / chipForge 三服务 / 负重，**61 条**）/
**`laser_test`**（17.7 第 3 步 Boss 激光：线段-圆命中 / laserCap 6 / 三段生命周期 / 弹幕吞噬 / 无激光等价性，**59 条**）/
**`chip_behavior_test`**（19.12 行为型遗迹秘宝：bounce / burn / split / chain 四积木 + 无遗迹秘宝等价性回归，**48 条**）/
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

- **22.x 能量水晶技能系统 ✅ 代码全部落地（W0~W6）**：9 文件（`js/skill-config|compiler|damage|events|scheduler|runtime|reward|presenter|save.js`）
  + 12 套测试 + 集成接线（`index.html` 9 行脚本 / `main.js` 1 行主循环 / `game.js` 2 处分流闸门 + 稳定 id / `core.js` 可注入随机源）。
  **当前装好但未启用**：`CFG.skillSystem.enabled=false` + `migratedHeroIds=[]` → 对现有玩法**零影响**（旧路径不受影响，集成测试 ⑥ 证明）。
  启用方式：把英雄 id 加入 `migratedHeroIds` 并把 `enabled` 置 `true`。
  **W6 抓到 8 个跨模块缺陷**（含 1 个功能性：冷却字段名 `cooldown` vs `cd` → 技能每帧施放、伤害随帧率线性爆炸，由帧率一致性测试捕获；详见报告 §十四）。
  ⬜ 遗留：`castTime` 未接线 / **稀有技能授予链路已通（§22.2 雕像授予）** / 装配·详情 UI 屏未接 DOM / 首轮数值待平衡。
- **第十七章 ✅ 全部落地**：17.7 第 1~5 步完成（发射器 + 护栏 + 阶段机 + 电报 + `LaserBeam` +
  弹幕吞噬 + BS0004~0010 配表 + 怪物铺量）；剩余仅 17.9 待定 5 条（设计层，非开发）。
- **内容铺量进展**：怪物 **11 → 17 只**（NM0015~0026 新增 12，实际 NM 总 17）；Boss **3 → 10 只**；
  ⬜ 关卡 3 → 10+（未做）；⬜ 属性卡池（本批未动）。
- **🔴 v2 重构（第十九章）落地顺序**：
  1. ✅ **删普攻 + 改经验来源**（参与伤害即给）+ AI 改放技能 + crystalKill 退役 —— **已落地**（见 §5.41，当时基线 565）
  2. ✅ **英雄三定位 + 技能冷却制**（能量池退役 + 维修无人机 + 冷却环）—— **已落地**（见 §5.42，基线 638）
  3. ✅ **升级 4 选 1 + 模块池**（heroModules / 池过滤 / 槽满置灰 / 属性小包兜底）—— **已落地**（§5.43，`levelup_test` 50 条）
  4. ✅ **遗迹秘宝系统战斗侧**（makeChip / chipInv / 宝箱商店接入 / tagCalc 统一词条链 / chipForge 三服务）
     —— **已落地**（`chip_test` 61 条）
  5. ✅ **UI 改造**：遗迹秘宝背包 6×5 + 上下并列布局 + 遗迹工坊 + 遗迹秘宝图鉴 —— **已落地**（`ui_v2_test` 49 条）
  6. ✅ **行为型遗迹秘宝 4 种积木**（bounce 折射 / burn 燃蚀 / split 裂变 / chain 链锁）—— **已落地**（§5.45，`chip_behavior_test` 48 条）
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
  **主入口 = WorkBuddy 托管站** `https://bagrogue-shooter-85672.app.workbuddy.host/`，每轮 push 后必须重新发布；
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
| 21.18（深渊打磨）| **深渊「平移主线玩法」+ 进图必死根因修复**（用户拍板：进门先选角 / 说明面板暂停游戏 / 重开秒杀先复现）。**① 深渊选角流程**：新增 `enterAbyssFromPortal()`（`js/modes.js` 独立区块）接管进门——主城深渊之门读条/点选不再直接进图，改走 **screen-character 选角界面**（与主线出征同一屏）；`Game.enterCharSelect()` 拆出公共开屏 `_openCharSelect()`，新增 `Game.enterAbyssCharSelect()`，用 `charSelectFor` 标记来源分流——「返回」深渊→主城 / 主线→选关，「开始」深渊→`enterEndless(选定角色)` / 主线→`startRun`；`enterEndless(chars)` 支持显式角色入参（无参调用恒等旧行为，兼容 `rewards.js` 的 `apply(arguments)` 包装），且放行 `charSel` 状态（否则「点开始无反应」）。`endless_flow_test` 十3/十4/十5 同步改口径（点门→进选角→点开始→inEndless）。**② 弹窗免伤**：`UI.showEndlessIntro/hideEndlessIntro` 接 `Game.paused` 闸门——说明面板显示期间世界/玩家/同伴更新全部跳过（复用升级 4 选 1 的既有暂停机制），关闭即恢复，解决「边读说明边被围殴」。**③ 进图必死机械根因修复（关键）**：`enterEndless` 原用 `CFG.city`（1280×960）建无尽世界，而 `startRun` 出生点取 `CFG.levels[0]`（1920×1920）中心 =（960,960）→ **玩家被生在世界下边缘**（y 恰 = 世界高），`_spawnSpot` 得 `maxY = min(900, -60) = -60`（负数）→ 刷怪环带退化（怪只从左右来、x 甚至算到世界外 1501>1280）→ 开局贴脸围殴。修法：世界/出生点/刷怪环带**三者同源**到 `CFG.endless.mapW/mapH`（1920×1920），玩家+队友统一落位世界中心并重铺尾迹。**④ 「重开秒杀」复核**（用户要求先复现）：新建 `endless_restart_test.js`（19 断言）以真实脚本链复现「进深渊→跑 10 秒→真实死亡→再来一次 ×3」，实测重开后**满血 500/500、场清零、波次归 1、位置居中、paused 解除** → **未复现「秒杀」，原路径本身安全**（疑为「没选角 + 出生在边界」被感知成秒杀，本次两处修复后应消失）。**⑤ 统计**：`endless_restart_test` 入 FEATURE 套件（全量 **63→64 项**）；门禁 **2928→2949 全绿 bad=0**；版本 bump 20261022。**⚠️ 仍遗留**：玩家清怪速率（≈1.9 只/s）< 刷怪速率（≈4.5 只/s）→ 后期仍会堆叠；用户口径「怪数不砍」，待后续从「强化玩家 / 削单怪威胁 / 拉长刷怪节奏」中再选。|
| 21.19（深渊功能搭建·多线程并行）| **深渊从「核心循环可跑」补齐为功能完整的大秘境**（用户拍板：不管平衡、先搭功能、走多线程并行；需求真源 = `G_docs/plan_endless_full.md`，波次任务卡 = `G_docs/waves/endless_21_19_waves.md`）。**方法论**：`parallel-ai-game-dev` 规范落地 —— 共享文件（`config.js`/`index.html`/`css`/`core.js`）由 **W0 主会话串行冻结**（新增 `CFG.endless.tier/affixes/rewardNodes/records/team` 五个区块 + `#screen-abyss`/`#screen-abyss-pause` 两屏 + 样式 + 版本 bump 20261023）；**W1~W7 七路并行**，每路**只新建独立文件**（零共享文件冲突），接入一律走「猴子补丁包装 + 幂等标记」；**W8 主会话串行集成**（`modes.js`/`main.js` 六处单行接线）。**七路产出**：① **W1 层级**`js/endless-tier.js`：可选层 1~20（`anchors` 分段线性难度系数，层1=1.0/层10=2.4/层20=4.0），`setTier/tierMul/rewardMul/maxUnlockedTier/tierList`，包装 `hpMul/dmgMul`（只放大怪物）；② **W2 词缀**`js/endless-affix.js`：8 条词缀池（迅捷/坚韧/狂怒/成群/贪婪/脆弱/催命/荒芜），条数随层（层1=0/层3=1/层8=2/层15=3），包装 `hpMul/dmgMul/waveCap/waveReward`；③ **W3 世界内容**`js/endless-arena.js`：**修复真缺口**——`rollAbyssAltars` 此前从未被调用（深渊里零祭坛），现包装 `makeWorld` 投放祭坛（天然屏蔽 RIFT）+ 按权重投放金币堆/结晶堆/补给点；④ **W4 入口界面**`js/ui-abyss.js`：`#screen-abyss` 选层屏（层级卡/难度系数/词缀预览/最高记录/挑战此层）；⑤ **W5 暂停菜单**`js/ui-abyss-pause.js`：`#screen-abyss-pause`（继续/放弃，复用 `Game.paused` 闸门，Esc 触发）；⑥ **W6 记录首通**`js/endless-record.js`：`Meta.data.abyss`（最高波次/最高层/最快撤离/首通标记）惰性补全 + 首通额外结晶（严格幂等）；⑦ **W7 组队**`js/endless-team.js`：队友倒下 → 救援读条 / 自动复活（`reviveTime` 8s、`reviveHpRatio` 0.5）+ 人数缩放 `scaleMul/rewardMul`。**流程变更**：深渊之门 → **选层** → 选角 → 战斗（`enterAbyssFromPortal` 优先亮选层屏，无 DOM 回落选角）。**统计**：新增 7 测试入 FEATURE 套件（全量 **64→71 项**）；门禁 **2949→3176 全绿 bad=0**；`cache_version_test` 的 `VER_ASSETS` 清单同步登记 7 个新模块（`?v=` 总数 18→25）。| 22.x（能量水晶技能系统 W0~W6）| **按合同 §4 拆分 9 文件 + 多线程并行 + 串行集成收口**（真源 = `G_docs/design_crystal_skill_system_v0.5.md`；工程合同 = `G_docs/skill_system_development_contract_v1.0.md`；波次任务卡 = `G_docs/skill_system_interface_v1.md`）。**方法论**：W0 主会话串行冻结接口（9 文件所有权 / 命名规范 `SK_*`·`TP_*`·`CR_*`·`Q_*`… / 12 顶层 API / 6 数据结构 / 21 原因码 + `CFG.skillSystem` 骨架 + `index.html` 脚本位 + `run_tests.sh` SKILL 套件 + 版本 bump 20261036）；**W1~W5 五路并行**（每路只新建独立文件，零共享冲突）；**W6 串行集成**。**九文件**：`skill-config`（校验器/21 原因码）/`skill-compiler`（6 阶段编译·4 执行器·5 合并算子全序）/`skill-damage`（POE 伤害模型·五类命中额度·区域积分）/`skill-events`（FIFO·深度/预算护栏）/`skill-scheduler`（独立冷却·索敌·快照）/`skill-runtime`（九段单步·扫掠碰撞·派生·回收）/`skill-reward`（事务·升级/满槽/兜底）/`skill-presenter`（面板矩阵·原因码中文化）/`skill-save`（序列化·迁移报告·幂等）。**首批内容**：2 技能（火球/震荡波）· 4 模板 · 9 水晶（8 机制 + 1 通用增幅）· 4 档品质 · 全策略表。**集成接线**：`index.html` 9 行脚本序（config→…→main）/ `main.js` 1 行主循环 / `game.js` 2 处分流闸门 + 稳定 id + Bullet 扫掠 / `core.js` 可注入随机源。**W6 抓到并修复 8 个跨模块缺陷**（根因多为「W0 冻结未到字段名/词表级」）：① phase/executor 词表不一致致 `CR_MULTISHOT` 编译失败 ② `modifyParameter` 不承载字符串 → 追踪改数值枚举 ③ `HP_DERIVED_AREA` 缺策略 ④ `allowedOps` 白名单失配 ⑤ `nodes` 对象映射当数组致零命中 ⑥ levels 未包 `parameters` + `baseRef` 未解析致伤害恒 0 ⑦ **冷却字段名不匹配（`cooldown` vs `cd`）→ 技能每帧施放、伤害随帧率线性爆炸**（由帧率一致性测试捕获）⑧ 测试 fixture 用旧词草稿 → 改直连真源。**统计**：新增 12 测试入 SKILL 套件（`skill_config/compiler/damage/events/scheduler/runtime/reward/presenter/save/sweep/integration/fps_test`，403 断言）；门禁 **3365→3778 全绿 bad=0（88 套）**；`cache_version_test` 的 `VER_ASSETS` 同步 9 个新模块。**⚠️ 当前装好但未启用**（`CFG.skillSystem.enabled=false` + `migratedHeroIds=[]`）→ 现有玩法零影响；遗留：`castTime` 未接线 / 稀有技能位未放内容 / 装配·详情 UI 屏未接 DOM / 首轮数值待平衡。报告：`G_docs/skill_system_w6_report.md`。|
| 22.1（升级 4 选 1 兜底口径修正 · bugfix）| **用户实测 bug：「升级后 4 选 1，水晶等级没满，就出属性包了」**。根因 = `buildLevelUpCandidates` 的可用性判定把「4 格全满」当「无可选」整体排除（`avail = ids.filter(hid => heroHasEmptySlot(hid) && …)`），而**已持有但未满级（lv<9）的模块本来就能叠层升级、根本不需要空槽** → 全队满格时 `avail` 为空 → 直接跳属性小包。**旧口径**源自 §5.48「满格队友整体排除 / 全队满级**或 4 格全满**→兜底」，本次由用户拍板推翻。**修复**：新增 `heroPickableModuleIds(heroId)`（已持有 lv<maxLv 恒可选；未持有需有空槽；与 `makeCard` 的 `locked` 同源），`avail`/`candsOf`/`poolOverride`/`teamModuleOfferPool` 四处一律改用它；`locked` 字段保留为防御（候选源已保证合法）。**测试缺口（血泪）**：旧断言 8/9 用 `cands.filter(…).every(…)`，当候选实际是属性包时 filter 为空 → `every` 对空数组返回 **true（空真）**，于是这个 bug 一直"绿着"通过门禁；本次改为真断言 + 新增断言 22b（全队满格未满级 → 30 次抽取 0 次属性包；全员满 9 级 → 才兜底）。**口径同步**：`levelup_test` 断言 8/9、19c、22 改写；`config.js` 的 `statPack` 注释 + 本 §5.48 表格与兜底条件同步。门禁 **3824→3830 全绿 bad=0**。|
| 22.2（技能系统试玩块改正式流程 · 武器绑定初始技能）| **用户拍板两条**：①「武器绑定初始主动技能、无普攻」补进 v0.5 §1 让规则自成一体；②试玩块从"一次给 2 个技能"改为正式流程「1 个初始技能 + 雕像触发稀有技能」。**落地**：`CFG.skillSystem` 新增 `initialSkillBindings`（H001 武器 W001「速射炮」→ `SK_FIREBALL`）与 `rareSkillPool`；`RP_STATUE` 补 `statueProb`/`rareSkillPool`/`maxSkillsPerHero`/`duplicateStatueHandling`。**修第 8 个跨模块缺口**：`SupportCompiler.preview` 此前只处理水晶装/升级、**无 `installSkill` 分支** → `SkillReward.rollStatueGrant` 的技能候选恒判非法、稀有技能永不授予（永远走属性兜底）；补该分支（技能上限 `SLOTS_FULL` + 全量编译校验）。**试玩块**：懒注入改为**只挂 1 个初始技能 + 4 水晶**（每颗都必须对初始技能有实际收益，故首轮弃用只对范围技能生效的「扩域」改用「追踪」——否则整组编译失败 `EXISTING_CRYSTAL_INACTIVE`）；包装 `World.prototype.triggerAltar`（**原型包装、雕像本体一字不动**），踩奖励类雕像经 `rollStatueGrant` 授予稀有技能并**重编译**，失败回滚；工匠雕像（teleport）与空间裂缝（rift）不参与。**v0.5 §1 补充**：技能来源 = 武器绑定初始主动技能 / 无普攻（`CFG.basicAttack.removed`）/ 稀有技能由雕像至多给 1 个。**统计**：`skill_playtest_test` 46→57 断言；门禁 **3830→3842 全绿 bad=0**；版本 20261038→20261039。|
| 22.3（技能系统两条核心规则复核 + 自检 · 报告 `G_docs/skill_system_review_22_3.md`）| **用户要求**：重检技能系统全部代码，验证「武器绑定 1 个初始主动技能」「4 颗水晶同时影响初始+稀有技能」，并**自检功能（TTD）**。**结论：两条规则均成立**（绑定表单值真源 / 单技能注入 / 旧技能分流停用；逐技能建图共享同一水晶组 / 同一水晶可对两技能同时 applied、只占 1 槽 / 用途保护整组拒绝 / 雕像授予后重编译关系不变）。**新抓到 2 处跨模块缺陷（第 9、10 个缺口）**：`SkillScheduler` 读 `tp.range` / `cp.allowNoTarget`，而配置真源（且被 `SkillConfig` 校验器强制）是 `targetPolicies[].maxRange` / `castPolicies[].requiresTarget` → **索敌范围静默失效（退化为全图锁敌）**＋**环绕类「无目标可施放」永久失效**。之所以门禁全绿：既有 `skill_scheduler_test`/`skill_runtime_test` 用**自造桩**写的字段名与调度器一致 → 桩内自洽（对着合成契约断言，而非真实配置）。**修复**：新增 `SkillScheduler.rangeOf()` / `allowNoTargetOf()`（**配置真源优先 + 旧短名兼容**，旧桩不回归），`tick()`/`intervalFor()` 改用；接口文档 §四 增补策略表字段名冻结。**新增自检** `skill_rule_binding_test`（53 断言，8 段：规则 1 真源+行为 / 规则 2 真源+结构+保护+流程 / 修复项回归 / 接线静态校验），**全部直读真实 `CFG.skillSystem`**。**未改动缺口已登记**：`routePolicyId` 未传递（`eventPolicies` 整表失效，改之会变派生数量）、环绕参数映射（`orbitRadius`/`contactRadius`/`orbitCount`）、H001 初始技能数值未对齐旧 `AT102`（v0.5 §10 迁移基准）、`SkillConfig.validate` 未覆盖新字段、`castTime` 未接线、`killer` 未传（战绩归属）、装配·详情 UI 未接 DOM。**统计**：门禁 **3842→3895 全绿 bad=0（91 套）**；版本 20261039→20261040。|
| 22.4（技能系统三缺口修复 · 能量爆发基准 / 派生路由 / 环绕参数 · 报告 `G_docs/skill_system_fix_22_4.md`）| **用户拍板**：按 22.3 登记的优先级修 **#13 → #11 → #12**，完成后 push + 托管站重发。**#13 能量爆发基准**：`SK_FIREBALL` 以旧 `AT102` 当前有效值为迁移基准（v0.5 §10）——冷却 0.90→**1.80s**、伤害 1.40→**150%**、`baseGraph` 新增内置命中爆炸节点 `n_burst`（`TP_INSTANT_AREA` 半径 **130**，onHit 边）；净效果与旧版一致（半径 130 内每目标 150% 一次：载体直击 150% + 爆炸对**其他**敌人 150%，靠 `HP_EXPLOSION` 新增 `excludeBornTarget:true` + `_sdOncePerCast` 改为「split 默认 + 策略声明」数据驱动排除出生目标）。**连环抓出 3 个新根因（第 11~13 个缺口）**：① `_cloneNode` 把等级行参数合并进**每一个**节点 → 爆炸被主弹参数污染（radius=8/life=1.6）→ 改为**只并入主节点**（per-node 覆盖走 `lvSpec.nodeParameters`）；② `_nodeById` 模板兜底会命中**主节点** → 消失事件生成「幻影主弹」无限续链（且 role=derived 时伤害双重相乘 ×2.25）→ 兜底**收紧为只匹配派生节点**；③ 派生请求此前只带 templateId → 按模板错配主节点（爆破/分裂实际生成主弹副本）→ 全链路改为 **操作→节点→事件→精确 nodeId**（编译 addNode 盖章 `operationId`/`routePolicyId`；运行时效果实例携带、事件上报 `_makeEvent` 按图边解析 `derive` 描述符；`SkillEvents` 透传并**每描述符恰推 1 个请求**（EP_DERIVED_ONCE 语义落地，不再按 maxCount 复制同型请求 N× 放大）；`_phaseDerive` 精确解析 + 分裂沿父弹方向展开；白名单按模板 ID 匹配）。**#12 环绕参数**：`convertNode` **重置形态参数**（保留 coefficient/moreDamageMul 伤害恒等，其余回落 `defaults.orbit`）+ 等级参数接线（`op.field ← lvParams[op.parameter]`，orbitCount→count）+ `defaults.orbit` 补 `contactRadius:16`/`duration:6.0`（占位）+ **施放策略随形态切换**（op 声明 `castPolicyId:CAST_ORBIT` → 编译产物携带 → 调度器优先读取；只换模板不换策略时环绕在空旷处永不施放）+ `intervalFor` 持续时间单源回落 `defaults.orbit.duration`。校验器 op 白名单补 `castPolicyId`。**TTD**：`skill_rule_binding_test` 53→**73 断言**（新增 ⑨ 段 20 断言：基准真源+净效果 / 路由身份+幻影回归 / 环绕参数+间隔），测试自身又抓出并修正 2 处写法问题（恒真断言、空场前提错误——requiresTarget 技能无目标根本不施放）。**统计**：门禁 **3895→3945 全绿 bad=0（91 套）**；版本 20261040→**20261041**。|
| 22.5（技能系统文档总纲 · 全量文档+代码盘点）| **用户要求**：全面分析项目全部文档/方案/代码（**一定要全部**），简要概括但**核心与规则必须明确**，记录在案写入开发文档；并回答「后续开发什么 / 缺哪些文档 / 进度如何」。**用户核心痛点**：「你总会忘记之前的规则和代码，不要乱猜或联想；不确定的事一定要去查文档或代码。」**产出 = `G_docs/skill_system_master_v1.md`**（技能系统唯一入口索引）：① **文档全量清单 + 权威判定**（v0.5=玩法真源 / 合同 v1.0=工程真源 / 接口 v1.0=跨文件契约 / W6·22.3·22.4 报告=证据 / `skill_defs_draft_v1.js`=已归档非真源）；② **权威优先级裁决链**（用户铁律 > 合同 > v0.5 > 旧设计与注释；代码为最终事实）；③ **核心规则速查 11 节**（玩家规则/运行/适用冲突不可拆/编译 6 阶段/伤害与五类命中额度/事件派生/8+1 水晶/获取升级/配置边界/存档/验收 11 条）；④ **v0.3 已被推翻的 5 条口径**（防记混）；⑤ **代码实现现状**（9 模块 + 试玩块行数职责 / 总开关 `enabled:false`+`migratedHeroIds:[]` 装好未启用 / 共享文件接线点 / 16 套测试）；⑥ **进度对照合同 A~H**（A~D 完成；E 结构完成数值占位 / F 逻辑完成 UI 未接屏 / G 仅 H001 / H 门禁帧率✅真机平衡❌）；⑦ **已知不一致 8 项**（含主设计文档未收录新系统 / 旧模块未迁移 / `castTime` 未接线 / UI 屏未接 / 数值全占位 / 数字过期文档）；⑧ **后续开发 7 项按依赖排序**。**同步修正过期文档**：`dev_guide.md §8`（88/3778→**90/3945**）、`README.md`、`tests/README.md`、`AGENTS.md` 的测试数与试玩链接域名。**无代码改动**（纯文档轮）。|
| 22.6（W0 统一名称 + W1 技能等级接线 · 启用批次前两路）| **用户指令**：「统一名称后，再进行功能开发。」→ 按 `skill_enable_batch_plan_v1.md` 串行推进。**W0 统一名称**（`20261041→20261042`，提交 `17b8fcc`）：依总纲 §0.5 命名规范把**显示层**落地 —— 芯片/晶片 → **遗迹秘宝**（含 遗迹秘宝图鉴 / 遗迹工坊 / 遗迹秘宝背包 / 数值型·行为型遗迹秘宝；物品名 增幅晶片→增幅秘宝 等 9 个）、模块水晶 → **能量水晶**（注释层）；`CFG.skillSystem.localization` 新增 **`ui.crystal.noun` / `ui.relic.noun`** 作 UI 名词唯一来源；同步 4 个测试断言语义（`chip_test` / `chip_behavior_test` / `ui_v2_test` / `artisan_layout_test`）。**红线**：代码标识符一律不动（`CFG.chips` / `chipInv` / `CR_*` / `C_*`）。**判据巧用**：纯文案替换 → **门禁 PASS 条数必须不变**（3915→3915）= 无行为外溢的硬证据。**W1 技能等级 = 武器等级 接线**（`20261042→20261043`，提交 `6fd2c5e`）：修真缺口「新路径技能实例等级**硬编码为 1**」（`skill-playtest` / `skill-reward` / `skill-compiler` 三处）→ 启用后技能永不随武器成长。**真源** = 合同 §101「沿用项目实际路径」= **`Meta.weaponLv(heroId)`**（1~100，代码既有注释 `items.js:450` / `ui.js:546`「武器等级 = 技能等级」）。**实施**：① `SupportCompiler.skillLevelOf(state)`（**纯函数**，不读 CFG/Meta；按技能 ID 规范排序取第一个有效等级，无则 1 = 接线前行为）；② `SkillPlaytest.skillLevelFor(heroId, skillId)`（**本文件是全项目唯一允许读局外存档 `Meta` 的地方**，且**必须钳制到 `def.levels.length`**）；③ `_applySkillInstall` 改用 ①；④ 三处**必须同值**（试装 = 候选模拟 = 落地），否则「预览用 L1、落地用 L3」候选合法性与结果不一致。新增 `skill_level_binding_test.js`（30 条：纯函数矩阵 / Meta 取值与钳制 / 三处一致性 / 端到端通电 / 无 Meta 回归护栏）入 SKILL 套件。**门禁**：**90→91 套 / PASS 3915→3945 / bad=0**；`verify_clone.sh` 同步 `20261043` 快照。**遗留**：`levels` 仅 3 级（E 阶段内容工作）→ 实际等级 = `min(武器等级, 3)`，等级表补齐后无需改代码即自动放开。|
| 22.7（W2 四个界面接能量水晶 + W4 新测试 · 启用批次第三路）| **用户指令**：延续「统一名称后再做功能」→ 拍板 W2 四项：① 升级 4 选 1 **复用现有升级弹窗**；② 战斗技能栏两技能显示 **`A X X X X A`**（A=技能 / X=水晶）；③ 踩雕像授予稀有技能**弹出选择弹窗**；④ 托管站现在发布。**屏2 战斗技能栏**：新增 `UI._crystalModeOf(member)`（按 `(heroId, groupVersion)` 缓存编译结果 → 装配/升级自动失效）+ `UI._crystalSkillOrder()`（初始技能恒在左，真源 = `initialSkillBindings`）+ `UI._buildPsIconEl()`（抽出图标构造器，旧路径输出**逐字不变**）；`_buildPartyRow` 新路径排布 `[英雄名][技能A][4水晶X][技能A]`（用户拍板 `A X X X X A`；英雄名独占最左使簇整体相邻），**仅 1 个技能时不补空壳**；`_updatePartySlots` 拆出 `_updateCrystalSlots`（名 + 品质色边 + `Lv n/levels.length`，外层**仍保留 `.ps-slot`** → 兼容 42 处结构依赖，只额外挂 `crystal-slot`）；`_updatePartyCd` 拆出 `_updateCrystalCd`（**两技能各自独立冷却环**：剩余读技能实例 `cdLeft`，总长优先 `SkillScheduler.intervalFor` 同源口径）；`clearBattleHud` 追加清 `_crystalCache`。**屏3 水晶详情浮窗**：新增 `UI.showCrystalSlotTip` —— 文案**全部来自 `SkillPresenter.detail().text`**（首行标题跳过，其余按行铺 `.mt-row`），落痕 `dataset.crystal`；Presenter 缺失/抛错 → 单行占位降级（合同 §13：UI 不自行判定能否用）。**屏1 升级 4 选 1**：`js/items.js` 新增水晶候选族（`heroOnCrystalPath` / `heroSkillState` / `heroCrystalPickableIds` / `crystalNameOf` / `crystalQualityOf` / `crystalDescOf` / `crystalMatrixOf` / `crystalCard` / `crystalCandidates` / `applyCrystalPick`）—— **三重闸门**（`enabled` + `ownsHero` + 已编译 `skillState`）任一不满足即返回 null → 逐字回落旧模块候选；出池权重复用既有 `rewardPools.POOL_LEVELUP`；`buildLevelUpCandidates` 顶部早退（升级者本人迁移 → 候选整体换水晶），`applyLevelUpPick` 增 `kind === "crystal"` 分发；`UI._renderLevelUp` 增类型标签「能量水晶」+ **卡面辅助矩阵**（`.lu-matrix` 逐技能 生效/冲突/不适用，状态真源 = 编译 `explanations`）+ 胶囊「品质 · Lv n/max」+ `UI._candRank()`（推荐角标：水晶按品质 `rank`，升级卡优先于新装卡）。**屏4 稀有技能选择弹窗**：`index.html` 新增**通用选择弹窗** `#choice-overlay`（`.choice-panel` / `#choice-title` / `#choice-sub` / `#choice-cards`），版式复用 `.levelup-cards` / `.lu-v2` 卡面但**不共享状态机**；`UI.showChoice({title,sub,options,onPick,onCancel})` / `closeChoice()` / `_renderChoice()` / `_bindChoiceOverlay()`（遮罩=取消、置灰卡不可点、幂等）；`SkillPlaytest.grantRareSkillOnAltar` 改为**先弹窗让玩家挑**（`rareSkillOptions()` 读 `rareSkillPool`），暂停闸门由本文件自行开合（`_holdPause`/`_releasePause` 记忆并精确还原 `Game.paused`），多英雄排队依次弹，**无 UI 环境 → 自动装首项**（同步降级，`skill_playtest_test` ⑪ 段零改动）。**新增 `crystal_ui_test.js`（82 条）**入 SKILL 套件。**门禁**：**91→92 套 / PASS 3945→4027 / bad=0**；版本 `20261043→20261044`；`verify_clone.sh` 同步新快照。**血泪 +3 条**（§10.3：旧分支逐字不改并反推旧测试隐式契约 / 异步化必留同步降级通道 / `CFG` 同名可能是数组也可能是映射）。**唯一偏差**：技能栏落地为 `[英雄名]A X X X X A`，非字面 `A X X X X A`（名字若插在 A 与 X 之间会把簇切开）—— 待用户确认。|
| 22.8（**技能系统扩容 + 正式启用** · 启用批次收口 · **并行三路**）| **用户指令**：「系统做完了，但闸门没开…**优先最高先完成技能系统全部内容。在做其他系统**」+ 拍板三项：① 旧系统「无对应」的 5 类效果（冷却/弹速/弹射/灼烧/链锁）→ **新增水晶覆盖**；② 弹射与环绕 → **拆分**；③ `levels` → **扩到 100 级**（对齐武器等级 1~100）。**并行切分**（契约 = 新增 `G_docs/skill_crystal_expansion_spec_v1.md`）：**主会话 A**（`js/config.js` + `index.html` + `js/core.js`）/ **B 路**（`js/skill-config.js` + `js/skill-compiler.js`）/ **C 路**（`js/skill-runtime.js` + `js/skill-events.js`），按文件所有权互不重叠。**落地内容**：① `js/config.js` 新增 **`skillLevels()` 曲线生成器**（幂曲线 + 阶梯整数，**L1 恒等于 base**），2 技能 + 14 水晶**全部 100 级**（**结构契约不变** → 编译器 `_levelRow` / 调度器 `cooldownFor` / 运行时**零改动**）；② 新增 **5 颗水晶**：`CR_COOLDOWN`（循环，走新 executor `modifyStat` 写施放层 `cdMul`）/ `CR_SPEED`（疾行）/ `CR_BOUNCE`（弹射）/ `CR_CHAIN`（链锁）/ `CR_BURN`（灼烧）→ **9 → 14 颗**；③ 三条新运行时能力：**`EP_DERIVED_EACH_HIT`（`everyHit` 每次命中都派生）** + **`targeting:"nearestOther"`**（派生朝另一个敌人，找不到则不生成）+ **`attach:"target"`**（持续区域跟随目标）；④ 新增命中策略 `HP_BOUNCE_CHILD` / `HP_CHAIN`（后者带 `excludeBornTarget`：链锁不回头打刚打过的目标）；⑤ `migrationMaps.module` **落库 10 条**（`M010`/`M011` 按合同 §1 首轮不迁移；`chip` 表恒空）；⑥ **正式启用**：`enabled: false → true`、`migratedHeroIds: [] → ["H001"]`。**集成三处接线（关键）**：⒜ 编译器 `addNode` 支持 `op.field ← lvParams[op.parameter]`（`chainLeft` / `dps` 随等级成长）；⒝ 新增 **`SkillRuntime._castStatsOf`** 把 `build.castStats` **乘法合成**进英雄 stats —— **否则冷却水晶只写产物、不影响冷却**（B 路实测发现的缺口）；⒞ `js/skill-events.js` 的 `_seDerive` 对 `everyHit` 策略**定向豁免** depth 闸门 —— **`derivedEvents` 保持 `false`**（不违反合同 §2：豁免的是「这一发弹自己的下一次命中」，不是「另一个水晶作用在派生上」）。**门禁 92 → 93 套 / PASS 4027 → 4083 / bad = 0**（新增 **`crystal_expansion_test.js` 54 条**，覆盖 14 水晶逐一试编译 / 100 级曲线 / 三条新能力 / 迁移映射 / 启用状态）；版本 `20261044 → 20261045`。**血泪 +4 条**（§10.3 35~38：同名配置键双定义静默覆盖 / 测试别写死规模数字 / 启用时旧「零影响」断言要反转 / 加新派生语义先摸清所有闸门）。|
| 22.9（**热修：正式启用未接线导致英雄完全不开火** · 用户试玩发现 · 2026-10-12 当天）| **用户反馈**：「游戏无法玩，技能都没有。你确定没问题了？你有自检吗？」—— 22.8 发布后**真实试玩直接不可玩**。**根因**：22.8 只把 `CFG.skillSystem.enabled` 翻成 `true` + 填了 `migratedHeroIds`，**没接整合层**。`SkillRuntime.ownsHero()` 随即返回 true → `js/game.js:297` `skillV2Owns()` 成立 → **旧施放逻辑整体跳过**；而新路径必需的 `hero.skillState` 由**整合层** `js/skill-playtest.js` 懒注入（包装 `ownsHero`），**该包装只在 `?skill=1` 时才装** → 英雄**一发不出**、HUD 技能栏也没有水晶。**为什么没被发现**：93 套门禁 + `verify_clone.sh` 21 文件哈希**全绿** —— 它们全是**模块级**断言（编译产物 / 配置结构 / 界面 DOM / 脚本可装载），**没有一套真的把游戏跑起来看英雄开不开火**。**修法三层**：① `SkillPlaytest.install()` 除 URL 参数外**再认「配表已启用」**（`enabled===true && migratedHeroIds.length>0`）→ 同样 `_patch()` + `_patchAltar()`，并加 `source: "url"|"config"` 标记（正式启用不弹试玩提示）；② `UI._crystalModeOf()` 改为**先问 `ownsHero`（懒注入入口）再查 `skillState`** —— 原顺序会让第一帧渲染把新路径英雄误判成旧路径；③ **新增 `skill_enable_runtime_test.js`（24 条）**：按 `index.html` 顺序加载**全部 33 个脚本**（含真实 `ui.js`）→ 真实 `startRun` → **跑 600 帧主循环** → 断言效果实例被生成 + `kills ≥ 1`；另含**反向护栏**（关掉开关 → 回落旧路径且旧路径仍能开火，两头都不能空）。**验证测试本身有效**：临时关掉修复 → 6 条红 + 退出码 1（确认能抓到才保留）。**同步修 2 套过时断言**：`skill_playtest_test` ②（「不带参数 = 空转」→「不带参数 = 跟随配表启用」，4→7 条）、`crystal_ui_test` ②（「默认未通电」→「**显式关闭态**下旧渲染逐字不变」的安全网）+ ③（编译失败断言改为**真让编译器抛**，原用例构造的是「坏状态」而非「编译失败」，且会自愈）。**门禁 93 → 94 套 / PASS 4083 → 4111 / bad = 0**；版本 `20261045 → 20261046`。**血泪 +1 条（§10.3-40，最贵的一条）**：门禁全绿 ≠ 游戏能玩；跨模块「启用/分流/接线」改动**必须有真实主循环测试兜底**。|


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
32. **给既有界面加新渲染分支：旧分支必须**逐字不动**，约束从**旧测试的隐式断言**反推（22.7 W2 技能栏）**：`endless_hud_test` 七2/七3 断言 `row.children[0]` 是 `.ps-icon`、`row.children[1]` 是 `.ps-info`（**顺序**被隐式锁死），`ui_v2_test` 另有 42 处依赖 `.ps-slot` ×4。→ 解法：新路径（`A X X X X A`）另起排布 `[英雄名][A][XXXX][A]`，旧路径**原样保留 append 顺序**；水晶槽**外层仍用 `.ps-slot`**、只额外挂 `crystal-slot`。**「新 class 前缀 + 保留旧 class」比「替换旧 class」安全一个数量级。** 动手前先 `grep -rn "ps-slot\|ps-row" *_test.js` 摸清隐式契约。
33. **把「自动生效」改成「弹窗选择」时必须留**同步降级通道**（22.7 W2 稀有技能）**：无条件异步会让 `skill_playtest_test` ⑪ 段（同步断言「踩完雕像就有 2 个技能」）必红。解法：**探测能力**（`typeof UI.showChoice === "function"`）→ 不可用就走原同步自动授予；无头沙箱只加载 `skill-*` 系列、**没有 `js/ui.js`** → 自动落回旧行为 → 旧测试零改动。**整合层对运行环境做能力探测，而不是要求环境适配代码。**
34. **`CFG` 里同一个名字可能是数组、也可能是映射（22.7 W2 品质色静默变灰）**：`crystalQualityOf` 写成 `qualityDefs[qid]`，而真源是**数组** `qualityDefs: [ {id, rank, color}, ... ]` → 取到 `undefined` → 品质色静默变 `null`（不报错，只是「颜色不对」；门禁与单测**全绿**）。→ 读配置前先确认容器形态，**数组按 `id` 查 / 映射按键取，两种都兼容**；写断言时锁「取到的颜色 === 配表里的颜色」这种**关系**，不要写死具体色值。
35. **同一个配置对象里同名键写两处 → 后者静默覆盖前者，门禁全绿但功能失效（22.8 `migrationMaps`）**：我在 `CFG.skillSystem` 的 `rareSkillPool` 之后新增了完整迁移映射表，而**文件更靠后的位置本来就有一个 `migrationMaps: {}` 占位** → 空对象把真表覆盖掉了；编译、门禁、54 条新测试**全绿**，只有「迁移映射 10 条」那一条断言变红才暴露出来。→ **新增配置项前先 `grep -n "<键名>" <配置文件>` 看全**；改完用 `node -e` **直接读运行时真值**（`Object.keys(CFG.skillSystem.migrationMaps)`）验证，**不要只确认「grep 到了」** —— 关键字出现 ≠ 它生效。
36. **测试里写死「当前规模」的数字（等级数 / 水晶数 / 具体取值）会在扩容时集体变红（22.8 扩表）**：`levels.length = 5`（想造空洞，结果把 100 级截断成 5 个有效项）、`crystalDefs 数 === 9`、`槽位文案 === "Lv1/3"`、`钳制到 3` 全部失效。→ 改成**关系断言**：`levels.length = 自身长度 + 1`（造空洞）、`=== Object.keys(crystalDefs).length`、`"Lv1/" + 配表长度`、`=== 配表里的 orbitCount`。**锁「关系」不锁「快照」**；规模数字只应出现在「基线汇总」处，不应散落在断言里。
37. **把「默认熄火」改成「正式启用」时，守护「零影响」的旧断言要**同步反转**——它们是安全网，不是障碍（22.8 启用）**：`enabled === false` / `migratedHeroIds.length === 0` 这类断言在启用批次里**必然变红**（`skill_playtest_test` / `crystal_ui_test` / `skill_rule_binding_test` 各红 2~3 条）。→ 正确做法是**改断言语义**（「已启用且启用范围明确」= `enabled===true && migratedHeroIds===["H001"]`），而**不是**放宽（`>=0`）或删除；同时**保留**「未注入 `skillState` 时 `.crystal-*` 一个都不出现」这类**功能性**断言 —— 那才是真正的安全网。
38. **给「只派生一次」的系统加「每次派生」语义时，闸门可能不在运行时层（22.8 弹射 / 链锁）**：C 路已把 `_phaseDamage` 改成 `everyHit` 时每次合法命中都推派生请求，但链**仍只走 1 跳** —— 因为**事件层** `js/skill-events.js` 的 `_seDerive` 里还有一道「`depth > 0` 且 `features.derivedEvents === false` → 直接 return」。→ 加新语义前**先摸清所有闸门**（运行时 / 事件 / 预算 / 深度 / 白名单），只改一层会得到「代码看起来对、行为完全不动」的假象。**解法优先「定向豁免」而非「打开全局开关」**：打开 `derivedEvents` 会连带放开**其它**水晶在派生节点上的触发（合同 §2 明确禁止），而按路由策略豁免只放行弹射/链锁自己的链。
39. **自检脚本的「版本源」可能不止一处 —— 改快照要同时改全（22.8 `verify_clone.sh`）**：更新 `verify_clone.sh` 快照时只替换了 `EXPECT_FILES` 的 21 个 blob 哈希，**忘了改文件顶部的 `EXPECT_VERSION` 常量** → 21 个文件全部 ✅、工作区干净，结论却仍打印「❌ 不一致」，排查半天。**更隐蔽的是观察方式**：当时用 `tail -30` 看输出，恰好把最上面那行 `❌ APP_VERSION = 20261045（期望 20261044）` 截掉了，只看尾部会完全误判。→ ① 改校验/快照脚本时 **`grep -n "VERSION\|EXPECT_"` 把版本源列全**；② 看校验输出**先看完整头部**，不要 `tail`/`head` 截断后再下结论；③ 结论行与判定行必须是同一个变量（本脚本结论用 `$BAD` 汇总，任一项红都会红 —— 这次正是 `$BAD` 被 `EXPECT_VERSION` 那行置 1）。
40. **🔴 门禁全绿 ≠ 游戏能玩：只翻配置开关、不接整合层 = 英雄完全不开火（22.8 事故，最贵的一条）**：把 `CFG.skillSystem.enabled` 从 `false` 改成 `true`、`migratedHeroIds` 填上 `["H001"]` —— 看起来「启用了」，实际上 `SkillRuntime.ownsHero()` 立刻返回 true → `js/game.js:297` 的 `skillV2Owns(this)` 成立 → **旧施放逻辑整体跳过**；而新路径必需的 `hero.skillState` 是由**整合层** `js/skill-playtest.js` 懒注入的（包装 `ownsHero`），它**只在 `?skill=1` 时才 `_patch()`** → 英雄**一发子弹都不出**，游戏彻底没法玩。
    **为什么 93 套测试 + 21 文件哈希自检全都放过去了**：既有测试全是**模块级**的 —— 编译产物、配置结构、界面 DOM、脚本可装载。**没有一套真的把游戏跑起来、看英雄有没有开火**。「配置正确」「模块单元正确」「界面渲染正确」不等于「整合后能玩」。
    修法（三层，缺一不可）：
    ① **接线**：`SkillPlaytest.install()` 除 URL 参数外，**再认「配表已启用」**（`enabled===true && migratedHeroIds.length>0`）→ 同样 `_patch()`（包装 `ownsHero` + 懒注入）+ `_patchAltar()`。**配置开关只是意图，接线才让它生效。**
    ② **顺序**：`UI._crystalModeOf` 必须**先问 `ownsHero`（懒注入入口）再查 `skillState`** —— 反过来写，第一帧渲染时 `skillState` 还没挂，新路径英雄会被误判成旧路径。
    ③ **测试**：新增 `skill_enable_runtime_test.js` —— 按 `index.html` 顺序加载**全部**脚本（含真实 `ui.js`）→ 真实 `startRun` → **跑 600 帧主循环** → 断言 `kills >= 1` 且效果实例被生成。**验证方式：临时把修复关掉，它必须变红**（实测 6 条红 + 退出码 1，确认有效后才保留）。
    🔑 **判据升级**：改「启用 / 分流 / 主循环接线」这类**跨模块**改动后，**必须有一套真实主循环测试兜底**；跑完 `run_tests.sh` 之后**还要有一次「真打开、真操作」的验证**（本机 `agent-browser` 起不来 → 用无头真实主循环替代，见本测试）。**「跑通了测试」与「玩得起来」是两件事，不要用前者向前者之外的任何人保证后者。**

### 10.4 下一步候选

- L5-L10 实战手感调参（需真人试玩反馈）
- 战斗开场提示触屏化（小活）
- 赛季玩法雏形（99 关通关后循环）
- 美术/音频接入、Godot 4.7.2 迁移评估
- 性能主线路线图（`G_docs/plan_bullet_hell_scale.md`）：P1 压测✅ / P2 渲染✅ / P3 空间分区✅ / P4 对象池✅ / P5 画质分档✅（21.14 三代理并行交付，门禁 2450）→ 剩余：P7 真实设备验证（低端安卓机 + Safari 实测）、自动降档阈值真机校准
