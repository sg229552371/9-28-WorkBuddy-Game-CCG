# 技能系统三缺口修复报告（22.4 · 版本 20261041）

> 🔤 **命名（2026-10-12 统一）**：本文的「技能系统 / 水晶」= **能量水晶系统**（代码 `CFG.skillSystem` / `CR_*`）。命名规范见 `skill_system_master_v1.md` §0.5。

> 依据 22.3 复核报告（`skill_system_review_22_3.md`）登记的优先级，经用户拍板执行 **#13 → #11 → #12**。
> 门禁：**90 套 / PASS 3915 / bad = 0 / 全绿**（3895 → +20）。

---

## 一、#13 H001 初始技能继承「能量爆发」基准

**真源对照**（旧 `AT102`：cd 1.8s / 伤害 150%攻击 / 爆炸半径 130）：

| 项 | 修复前 SK_FIREBALL | 修复后 |
|---|---|---|
| 冷却 | 0.90s | **1.80s**（L2/L3：1.75/1.70 占位递进） |
| 伤害 | 140% | **150%**（L2/L3：165%/180% 占位递进） |
| 爆炸 | 无 | **内置 `n_burst`（TP_INSTANT_AREA 半径 130，onHit 边）** |

**净效果与旧版一致**：半径 130 内每目标 150% 一次 —— 载体弹直击被击者 150%，爆炸对命中点周围**其他**敌人各 150%（被击者不重复结算）。

落地要点：
- `HP_EXPLOSION` 新增 `excludeBornTarget: true`；`SkillDamage._sdOncePerCast` 的出生目标排除由「硬编码 split 类型」改为「**split 默认 + 策略声明均生效**」（数据驱动）。
- 运行时派生效果本就传 `excludeTargetId`（出生目标），此前因爆炸类型不读该值而失效。

## 二、#11 routePolicyId 传递（实际抓出 3 个连环根因）

实施「操作 → 节点 → 事件」全链路传递时，实证发现**派生路由整体错位**，比 22.3 预估严重：

| # | 根因 | 症状 | 修法 |
|---|---|---|---|
| 11a | `_cloneNode` 把等级行参数合并进**每一个**节点 | 爆炸节点被主弹参数污染（radius=8 / life=1.6 → 爆炸变"小弹"） | 等级行参数**只并入主节点**；per-node 覆盖走 `lvSpec.nodeParameters[nodeId]` |
| 11b | `_nodeById` 模板兜底可命中**主节点** | 消失事件生成「幻影主弹」无限续链；role=derived 时伤害双重相乘（150%→225%） | 兜底**收紧为只匹配派生节点**（`derived===true \|\| role==="derived"`） |
| 11c | 派生请求只带 templateId，按模板错配主节点 | 爆破/分裂水晶实际生成的是「又一发主弹」，爆炸/小弹从未生成 | **编译 addNode 盖章 `operationId`/`routePolicyId`** → 效果实例携带 → `_makeEvent` 按编译图边解析 `derive` 描述符（hit→onHit / vanish→onExpire）→ `SkillEvents` 透传 → 请求带精确 `nodeId` |

配套语义修正：
- `SkillEvents._seDerive`：事件携带派生描述符时，**每个描述符恰好推送 1 个派生请求**（"EP_DERIVED_ONCE" 语义落地）；不再按 `maxCount` 复制同型请求（避免 N× 实体放大）。`maxCount` 退为描述符数量上限。
- 白名单匹配源改为**模板 ID 优先**（白名单值本就是 `TP_*`；此前优先 operationId，运行时开始携带 op 身份后必被拒）。
- 分裂小弹**沿父弹命中前方向展开**（v0.5 §7；此前固定向右）。
- 22.3 报告中「派生仍能正确生成（走 templateId 桥接）」的结论**有误**，以本报告为准。

## 三、#12 环绕参数接线

| 项 | 修复前 | 修复后 |
|---|---|---|
| 环绕半径 | 取投射物 radius=8（贴身转圈） | 模板默认 **70**（`defaults.orbit`） |
| 接触判定半径 | 缺失 → **0**（永不命中） | **16**（占位待平衡） |
| 一批数量 | 读主弹 count=1（单球） | 等级表 `orbitCount`（LV1=3 / LV2=4，经 `op.field←lvParams` 接线） |
| 一批持续时间 | 主弹 life=1.6s 秒退 | **6.0s**（占位；`defaults.orbit.duration` 单源，调度器 `intervalFor` 回落读取） |
| 无目标施放 | **永不施放**（技能 castPolicyId 仍为 CAST_COOLDOWN） | 操作声明 `castPolicyId: CAST_ORBIT` → 编译产物携带 → 调度器优先读取 |

机制沉淀：
- `convertNode` **重置形态参数**（保留 `coefficient`/`moreDamageMul` 伤害恒等参数，其余回落模板默认），防旧形态参数泄漏。
- `convertNode` 可声明 `castPolicyId` 覆盖（编译图携带，调度器优先）——"形态转换同时切换施放策略"成为通用机制。
- 校验器 op 字段白名单补 `castPolicyId`。

## 四、TTD（skill_rule_binding_test 53 → 73 断言）

新增 ⑨ 段（20 断言），全部直读真实 `CFG.skillSystem`：
- **基准真源+净效果**：cd 1.8 / 150% / n_burst 半径 130 + onHit 边；行为断言"被击者 150 一次 / 邻者 150 / 增程外 0"。
- **路由身份+幻影回归**：派生节点携带 operationId/routePolicyId；爆破水晶生成 TP_INSTANT_AREA；4s 恰 3 个独立主弹实例（幻影续链即超）。
- **环绕参数+间隔**：orbitCount→count=4（LV2）；形态参数不泄漏、伤害恒等保留；radius 70 / contactRadius 16 / duration 6；intervalFor = max(冷却, 6s)。

测试自身又踩并修掉 2 个坑（写进血泪账）：
1. **恒真断言**（`x === undefined ? ... || true : true`）——正是本项目 22.x 空真教训的重演；
2. **空场前提错误**——requiresTarget 技能无目标**根本不施放**，"无怪场景数主弹"恒为 0，断言前提必须先验证施放发生。

## 五、遗留（未动，待拍板）

| # | 项 | 说明 |
|---|---|---|
| 14 | 校验器未覆盖 `initialSkillBindings`/`maxSkillsPerHero`/`rareSkillPool`/`features` | 本轮 op 白名单已补 `castPolicyId`，其余仍缺 |
| 15 | `castTime` 施法前摇未接线 | 配置有值、运行时忽略 |
| 16 | `SkillDamage.resolve` 调 `damageMonster` 未传 `killer` | 迁移英雄伤害不计入逐角色战绩（1 行修法） |
| 17 | 装配/详情 UI 屏未接 DOM | — |
| — | 新占位数值待平衡 | 爆炸 L2/L3 递进、contactRadius 16、orbit duration 6.0、EP_DERIVED_ONCE 生效后的派生预算 |

## 六、验证

- `bash run_tests.sh`：**90 套 / PASS 3915 / bad=0 / 全绿**。
- 修改文件 10 个：`index.html`、`js/core.js`（版本 20261041）、`js/config.js`、`js/skill-compiler.js`、`js/skill-runtime.js`、`js/skill-events.js`、`js/skill-scheduler.js`、`js/skill-damage.js`、`js/skill-config.js`、`skill_rule_binding_test.js`；文档 2 个（`dev_guide.md`、本文件）+ `AGENTS.md` 行数。
- 全部文件 CR=0（LF 铁律）。
