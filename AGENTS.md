# AI-Game（仓库根 · 极简引导）

本仓库是两个目录的双结构仓库，**开发请只进活跃目录**：

| 目录 | 说明 |
|---|---|
| **`Game_v0.0.1/`** | **活跃开发目录** —— 代码、测试、设计文档、门禁脚本都在这里 |
| `old_Game/` | 冻结归档（旧版本，仅供对照，**勿在此开发**） |

## 新会话请先做三件事

1. 读 `Game_v0.0.1/AGENTS.md` —— 项目规则与开发约定（**唯一权威入口**）。
2. 按 `Game_v0.0.1/G_docs/X-GAMe/00-reading-map.md` 的阅读地图加载相关文档。
3. 改代码前先跑基线：`cd Game_v0.0.1 && bash run_tests.sh`（须 **exit=0 且 bad=0**）。

## 常用命令（都在 `Game_v0.0.1/` 内执行）

```bash
cd Game_v0.0.1

bash run_tests.sh            # 全量测试门禁（提交前置条件：exit=0 且 bad=0）
bash verify_clone.sh         # 克隆一致性校验（与官方快照比对）
bash push.sh "改动说明"       # 一键：跑门禁 → 全绿才提交 → 推送 GitHub
```

## 在线入口

- 托管站主入口：https://bagrogue-shooter-85672.app.workbuddy.host/ （独立部署，需「重新发布」才更新）
  ⚠️ **重新发布必须从仓库根 `F:/AI-Game` 发布**（主入口 app 绑定的是仓库根；根 `index.html` 是跳转壳 → `Game_v0.0.1/index.html`）。从 `Game_v0.0.1/` 目录直接发布会**新建一个 app/新链接**，而不是更新主入口。
- GitHub Pages：https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/ （自动跟随 main，约 1~2 分钟）
