# 06 性能与全局脚本架构

## 目的与工程规则
保持纯静态HTML、ES5/ES6全局脚本、Canvas 2D、中文注释、CFG数值归口，无框架/模块化/打包依赖。性能优化必须不改变战斗结果。本章不是批准重构；架构提案见[只读方案](../plan_architecture_and_ai_development_v1.md)。

## 输入输出和所有权
输入为真实世界、实体集合、视口、质量档与dt；输出分为模拟状态和绘制/音频表现。模拟由宿主主循环推进，画质只裁剪表现。`G`/`Meta`由game维护，`UI`基础定义唯一；加载顺序由index确定，skill模块必须在main之前。改变加载序、全局名或初始化时机必须由主集成人串行完成。

| 模块 | 职责 | 不可混入的职责 |
|---|---|---|
| core / pool | U、事件总线、空间哈希、对象池 | 产品数值、模式规则 |
| game / main | 状态、实体、建run；宿主循环与输入 | 随意重复初始化UI或技能状态 |
| combat / skill-runtime | 伤害/命中/效果生命周期 | 为降画质跳过伤害判定 |
| render / quality | 绘制、剔除、三档质量、PerfGuard | 以帧率直接改变经济奖励 |
| stress | 可复现压力场景 | 伪造不符合真实类契约的实体 |

## 状态与边界
对象池从空闲→借出→使用→回收；回收后必须清除上一实例引用和命中记录。空间哈希按当前实体位置查询，跨世界与重启时不能保留旧对象。渲染剔除应扩大到特效/弹体的可见范围，而非把屏幕外但有效的伤害实例删除。

暂停与冻结使模拟停钟，但UI/显示刷新可以有自己的路径；不能把渲染帧数当作技能冷却时间。30/60/120FPS与抖动dt应比较命中/伤害/奖励等结果。大dt、实体上限、事件预算耗尽、对象池复用、模式重启是重点边界。

`PerfGuard`和三档质量已有代码与测试；真实手机温升、长时间内存与触控延迟未在本轮验证。不能从桌面单测推导稳定帧率或最大承载数。

## 配置、定位与验收
来源：[core](../../js/core.js)、[pool](../../js/pool.js)、[render](../../js/render.js)、[quality](../../js/quality.js)、[stress](../../js/stress.js)、[main](../../js/main.js)。配置全部回查[CFG](../../js/config.js)。
```powershell
rg -n 'SpatialHash|makePool|PerfGuard|qualityLevel|cullMargin|requestAnimationFrame|loop\(' js
```
```bash
node spatial_test.js
node pool_test.js
node perf_guard_test.js
node low_quality_test.js
node render_opt_test.js
node skill_fps_test.js
```
浏览器侧先起`python -m http.server 8123`，再按脚本实际参数运行`render_opt_check.py`、`stress_check.py`、`quality_ui_check.py`，保存设备、视口、档位、场景、持续时间、帧耗和内存样本。本轮未执行这些脚本，不填写虚构帧率。

## 后续开发约束
新逻辑放文件末尾独立块，旧函数只插单行调用；涉及CFG/core/index/css及game/main/combat/items/modes/run_tests的改动全部由集成人串行处理。代理独占文件并先冻结接口，详见[交接包](handoff-parallel.md)。优化提案必须给出同场景前后结果、模拟一致性与回滚范围；不以更换引擎作为未诊断性能问题的默认解法。
