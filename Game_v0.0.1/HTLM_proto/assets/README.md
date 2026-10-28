# assets/ 美术与音频资源接入说明

> 给美术 / 音频同事：把做好的资源按下面的规矩放进本目录即可生效，
> **不需要改任何 JS 代码**。文件没到位时游戏自动用程序化占位绘制与合成音效，
> 不会报错、不会卡加载。

## 一、目录结构

```
assets/
├── sprites/    全部图片素材（角色立绘、图标、特效帧等）
│   ├── hero_H001.png     首发英雄立绘
│   └── ...
├── audio/      全部音效与音乐
│   ├── sfx_shoot.ogg     开火音效
│   ├── bgm_battle.ogg    战斗 BGM
│   └── ...
├── hero/       （旧管道素材：程序化占位管线，勿动）
└── enemies/    （旧管道素材：程序化占位管线，勿动）
```

## 二、命名规则

- 文件名与 `js/assets_manifest.js` 清单中的键名**保持一致**（全小写 snake_case，英雄 id 原样大写）：
  - 英雄立绘：`hero_H001.png` … `hero_H006.png`（对应 `CFG.heroes` 前 6 个首发英雄）
  - 音效：`sfx_shoot / sfx_hit / sfx_explode / sfx_pickup / sfx_levelup / sfx_reroll / sfx_extract / sfx_death`
  - 音乐：`bgm_battle`
- 键名一旦发布**不可更改**（渲染侧按键查表，改键 = 断线）；新资源只允许追加新键。

## 三、格式与尺寸建议

| 类型 | 格式 | 建议 |
| --- | --- | --- |
| 图片 | PNG（透明背景）或 WebP | 角色立绘 ≥ 512×512、等比、主体居中、四周留 8px 透明边；图标 64×64 / 128×128 |
| 音效 | OGG（首选）或 MP3 | ≤ 200KB、单声道 44.1kHz、首尾静音裁净 |
| BGM | OGG 或 MP3 | ≤ 3MB、双声道、首尾做无缝循环点 |

## 四、接入步骤

1. 按上面命名把文件放进 `assets/sprites/` 或 `assets/audio/`；
2. 新资源需要在 `js/assets_manifest.js` 对应分组（`sprites` / `audio` / `music`）追加一行 `键名: "路径"`；
3. 刷新页面即生效——游戏启动时会按清单**一次性预加载**全部资源：
   - 加载成功：渲染 / 音频侧自动改用真实资源（查表优先，运行时零开销）；
   - 加载失败或文件缺失：静默回退到程序化占位绘制 / WebAudio 合成音效，控制台无报错。

## 五、工作原理（给程序同学）

- 清单文件：`js/assets_manifest.js`（`AssetManifest` 对象，暂未挂载 script 标签；
  正式接入时在 `index.html` 中 `core.js` 之前加一行 `<script src="js/assets_manifest.js"></script>` 即可）。
- 接入层：`js/core.js` 末尾 `AssetHooks` 区块——
  - `AssetHooks.init()` 启动时遍历清单预加载（异步、幂等、不阻塞启动）；
  - `AssetHooks.sprite(key)` / `AssetHooks.audio(key)`：O(1) 查表，命中返回对象、未命中返回 null（业务侧回退占位）；
  - `AssetHooks.ready()`：全部资源 settle 后 resolve 的 Promise；
  - `AssetHooks.stats()`：返回 `{ total, loaded, failed }` 供调试。
- 性能约束：查找为纯对象属性访问，绝不在运行时做文件存在性判断或发网络请求。
