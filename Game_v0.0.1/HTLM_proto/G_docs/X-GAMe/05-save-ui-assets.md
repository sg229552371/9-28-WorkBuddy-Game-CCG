# 05 存档、UI、输入与资源

## 目的与玩家规则
玩家应能区分局内临时收益与局外持久成长，清楚看到装备/奖励拒绝原因，并用竖屏触控完成真实流程。本章记录已有实现与待验证接线，不引入新后端或账户系统。

## 存档的输入输出与状态
`Meta`管理局外数据和commit；局内run管理战斗资产。技能序列化由`SkillSave`独立提供：输入英雄技能状态或旧存档与定义，输出序列化数据、迁移状态、报告和保留原始数据。`saveTo`写内存子对象不负责commit，`loadFrom`深拷贝；必须分别证明“写入对象”“持久化”“刷新读取”“恢复可运行技能”四步。

开发入口：[game.js](../../js/game.js)、[skill-save.js](../../js/skill-save.js)、[迁移映射](../skill_migration_map_v0.1.md)。当前未发现宿主真实调用技能存档的接线证据，不得把单测绿写成刷新恢复成功。保存时机、局内技能是否跨局保留、失败补偿权限均须先依批准规则冻结。

异常边界：空存档、旧版本、未知ID、等级超限、重复水晶、形态冲突、迁移重复执行、持久化失败。保留原始数据与迁移报告，禁止因无法识别而静默丢弃。检查失败分支是否向用户说明且不覆盖可恢复数据。

## UI与输入链
`const UI`只在[ui.js](../../js/ui.js)定义，屏幕与面板用`Object.assign(UI,...)`扩展，后加载。输入在[main.js](../../js/main.js)，DOM在[index.html](../../index.html)，CSS在[style.css](../../css/style.css)。主城、选人、背包、工匠、结算、画质、深渊面板及水晶面板要沿真实按钮/事件追踪，不直接调用内部函数代替全部UI验收。

输入是键鼠/触控、面板选择、奖励提交；输出是移动意图、面板开关、run/Meta变化和反馈。游戏暂停、开场冻结、升级选择、背包/工匠面板可能共同影响时钟，测试必须显式记录这些状态。横竖屏转换不能造成摇杆卡住、按钮遮挡或误点击穿透。

CSS修改必须同步主规则、所有相关portrait媒体块、`body.portrait`；本轮不改CSS。水晶UI必须呈现实际收益、满槽/冲突等原因，不以可点击外观暗示已成功提交。

## 摄像机与资源事实
`CFG.camera.portraitViewH`已在main的竖屏视野选择中消费，配置“待接入”注释过时；`zoomMin/zoomMax`本轮仅发现配置/注释，运行时缩放接线待验证。

[资源说明](../../assets/README.md)描述自动接入，[清单](../../js/assets_manifest.js)定义AssetManifest，但index没有加载该清单。`AssetHooks.init()`在无AssetManifest时不进行正常清单加载；本轮只发现sprite/audio查表接口注释，未发现实际渲染/音频消费接线。不能宣称把图片放进目录就会生效，也不能把其他既有Assets/SFX路径误判成全都失效。

资源状态应分别记录：文件存在→清单声明→页面加载→解析成功→缓存命中→实际绘制/播放→失败回退。异步超时、404、尺寸异常、音频用户手势限制、file协议与HTTP差异都需验证。当前真实资源链属于待核验项。

## 定位与可执行验收
```powershell
rg -n 'SkillSave\.|saveTo|loadFrom|commit\(|SAVE_KEY|localStorage' js/game.js js/skill-save.js js/main.js
rg -n 'AssetManifest|AssetHooks|portraitViewH|zoomMin|zoomMax' index.html js
```
```bash
node skill_save_test.js
node ui_flow_test.js
node mobile_ctrl_test.js
node camera_view_test.js
node assets_hook_test.js
node asset_timeout_test.js
```
浏览器验收：以HTTP启动→390×844进入→触控移动并打开背包/奖励/设置→横竖屏切换→释放触控→刷新检查Meta；技能恢复另记录序列化前后与恢复后的施放结果。资源用网络请求、缓存状态和实际绘制/播放三者共同证明。本轮未执行这些浏览器步骤。

## 状态与后续任务
UI/输入与Meta基础已有实现和现有单测；技能持久化和资源清单的实际接线仍未证实。先做只读调用链核验和复现报告，再提交具体修复提案。不得在未来任务卡中预写不存在的存档/资源接口，更不得更换存档键后把旧数据视为无效。
