# dev_guide 归档 1 —— 轮次 20.5 ~ 21.12

> 主文件 `G_docs/dev_guide.md` 只保留最近 5 轮 + 全部血泪坑（21.16 重构时归档）。
> 需要回溯早期轮的实现细节时读本文件，或看对应 commit message。

| 轮次 | 内容 |
|---|---|
| 20.5 | 加载卡顿修复：fit() 代理图分帧 + PerfGuard 帧护栏 + 诊断面板 |
| 20.6 | BootGuard 首屏看门狗 + 错误面板 + 版本自愈；**删 favicon 探针**（「无法开始游戏」根因） |
| 20.7 | 低画质实装（DPR 封顶/粒子×0.4/网格减半）+ 图鉴 12 角立绘（修 `_parent===null` 恒假 bug） |
| 20.8 | UI 单屏化 + 相机视野 +25%（**viewH 才是旋钮，zoom 单改无效**）+ 4 只冲锋怪 NM0027~30 |
| 20.9 | 选人界面苹果风：12 宫格 3 列→6 列（卡片 47×62） |
| 20.10/21.0 | 工匠世界三段式重排（4 页签并 3、删废弃卡牌页签）+ 结晶闭环（`growthRate 1.3`/BOSS 60、升满 1602≈21 局）+ 结算明细行 + 全局苹果风（选关 3 列/全面板 100dvh 单屏锁+安全区） |
| 21.2 | 手机端毛刺清理（0023 patch） |
| 21.3 | 虚拟摇杆修复（0025 patch：浮动召唤时序坑——touchEnd 之后读 `G.joy.active` 恒 false） |
| 21.4 | 升级 4 选 1 参考图改版：丝带横幅 + 竖版大卡（彩色标题栏/推荐角标/大图标/数值高亮/进度胶囊）+ 刷新按钮（`levelUpReroll` 就地换血）+ 19 条契约断言 + lu_check.py 触屏实测 19 项（0026） |
| 21.5 | 实机反馈四连：摇杆全屏可召唤（`floatStick.zoneRatio 0.5→1.0`）/ 刷新按钮 sticky 贴底 / 归属行仅多英雄局渲染 + 候选去重（`allowDuplicateOffer=false`）/ 标题白字统一 + 背包格子 40px 方案 B + repro_ui.py 17 项 |
| 21.6 | 选人面板：未解锁可点选（详情区持续展示条件 ??? 打码防剧透）+ 展示序 4 轮循环（`CFG.heroDisplayOrder` **渲染层消费，物理序不动**）+ 赛季占位（SeasonState）+ 美术音频接入层（AssetHooks+manifest+回退）+ 铺关卡 11~20（LEVEL_011~020+BOSS 二周目+levelCurve 20 行） |
| 21.7 | = 21.6 的关卡铺量提交拆分（f74eaf3） |
| 21.8 | 四连修复：①crystal 型解锁入口落地（选人详情区「◆N 解锁」按钮——**此前 `_unlockCost` 全库零调用，结晶够也无处解锁**；heroLv 型保持查询式自动解锁）②竖屏 4 选 1 压缩一屏（卡 148px/ico 44px，实测 footBottom=666<844）③移除「给 XXX 选择强化」标题（与轮转绑定矛盾）④候选分配 **§5.48 按队友轮转绑定池**（卡 i 绑定 `teamHeroIds()[i%n]` 单人池，池空随机非空队友兜底，替代 §5.47 全队混抽）+ slotLine 去名 + unlock_btn_check.py 13 项 / lu_final_check.py 6 项 |
| 21.9 | 未解锁英雄信息公开化（取消 ??? 打码：真名+简介+LV1 属性+LV1 技能+解锁条件+crystal 解锁按钮，锁定感由🔒+置灰表达；图鉴/皮肤 ??? 是收集语义不动）+ 详情区 max-height 170→240（0029） |
| 21.10 | 手机端主城 NPC 交互修复（双重根因：入口缺失——hideTouchButtons 隐藏按钮后主城只走键盘 E，补 `cityNpcTap`+金环提示；坐标错位——`screenToWorld` 主城无 G.world 落纯缩放分支忽略相机居中平移，补主城相机分支与 renderCity 严格同口径）+ mobile_test 4 断言 + city_npc_check.py 8 项（0030） |
| 21.11 | 图鉴统一化：芯片图鉴并入图鉴页（首页独立按钮移除，screen-codex 新增 #codex-chips 分区，统计行扩三项）+ 英雄卡 line-clamp 2 行对齐 + 三区统一 grid 语言（英雄 2 列/怪物·芯片 3 列）+ ui_v2_test 适配（0031） |
| 21.12 | **P1 压测场景落地**（`js/stress.js` 新建）：`?stress=N&bullets=N&mode=full\|dot\|lod&ai=0\|1` 直达压测，无参数零开销（boot/主循环均单行分支 + stress_test 52 契约）。复用真实 World/Monster/Bullet 类铺场（isMain=false+kind="stress" 走空世界；轻量无敌 player 桩补 takeDamage/heal；弹幕可见环铺场+每帧补位维持目标数量）。**真机实测（iPhone12 视口 3000敌+2000弹）：full 帧耗时 8.9ms/drawCall 4090；dot 4.5ms/2；lod 5.0ms/182——LOD drawCall -95.6% 稳超 100fps，目标可达性证实**。cache_version_test 改清单驱动（stress.js 加入 VER_ASSETS）。三档截图 stress_full/dot/lod_3000.png 供拍板群体抽象 |候选分配 **§5.48 按队友轮转绑定池**（卡 i 绑定 `teamHeroIds()[i%n]` 单人池，池空随机非空队友兜底，替代 §5.47 全队混抽）+ slotLine 去名 + unlock_btn_check.py 13 项 / lu_final_check.py 6 项 |
