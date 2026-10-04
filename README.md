# WorkBuddy 弹幕射击 Roguelike × 背包肉鸽 × 轻度搜打撤

16:9 横版 · 纯静态 HTML5 Canvas（ES5/ES6 全局脚本，无构建步骤、无依赖）· 竖屏优先适配。

## 快速开始

```bash
# 本地预览（任意静态服务器均可）
python3 -m http.server 8123
# 浏览器打开 http://127.0.0.1:8123/index.html
```

## 目录结构

```
├── index.html          # 唯一入口（含启动兜底脚本、缓存自愈）
├── js/                 # 源码（按加载顺序，全部为全局脚本）
│   ├── config.js       # CFG：所有数值配置（策划可调，逻辑不硬编码）
│   ├── core.js         # Assets 素材加载/抠图、SpatialHash、工具函数、ASSET_MANIFEST
│   ├── game.js         # 战斗主干：World/Monster/Bullet/Player/关卡机制
│   ├── ui.js           # 全部 DOM 界面层：屏幕切换、HUD、弹窗、设置、图鉴
│   └── main.js         # 启动流程 Game.boot、输入绑定、PerfGuard、BootGuard
├── css/style.css       # 全部样式（深色主题）
├── assets/             # 素材（36 张 PNG，与 core.js 的 ASSET_MANIFEST 一一对应）
│   ├── hero/           # hero_00 ~ hero_12（13 张）
│   └── enemies/        # enemy_00 ~ enemy_22（23 张）
├── G_docs/             # 设计文档（随仓库携带的「随身上下文」）
│   ├── dev_guide.md    # 开发指南：铁律、已踩的坑、测试基线 ← 新会话先读这份
│   └── game_design_proposal.md   # 游戏设计提案（规则与数值）
├── *_test.js           # 测试（37 个，见 tests/README.md 分类索引）
├── run_tests.sh        # 全量测试运行器（判绿 = 每项 exit=0 且 bad=0）
└── push.sh             # 测试全绿才提交并推送 GitHub
```

## 测试

```bash
bash run_tests.sh          # 全量：37 项，约 1700+ 条断言
node smoke_test.js         # 单个测试
```

测试文件按功能分类的索引见 [`tests/README.md`](tests/README.md)。

> 判绿标准：每个测试 `exit=0` **且** `bad=0`。`bad` = 输出中匹配
> `Assertion failed|FAIL|Error` 的行数 —— 因此**测试的 PASS 文案里不要出现英文 `error`**
> （会被误判为失败，用中文「错误」代替）。

## 关键约定（详见 G_docs/dev_guide.md）

- **数值一律进 `CFG`**（`js/config.js`），逻辑不硬编码。
- **文件末尾独立区块 + 现有函数只插单行调用**：并行开发时避免互相踩踏。
- **契约先行**：跨文件接口先约定（如 `UI.clearBattleHud()`、`Assets.progress`）。
- 新增测试文件后，必须手动加入 `run_tests.sh` 的 `TESTS` 列表。
- 浏览器打开时首屏会自动刷新一次（缓存自愈机制），属正常现象。

## 线上试玩

发布由「发布为应用」流程生成分享链接；历史链接见 `G_docs/dev_guide.md`。
