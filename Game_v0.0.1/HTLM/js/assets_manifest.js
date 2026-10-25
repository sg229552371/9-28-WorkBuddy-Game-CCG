/* ============================================================
 * assets_manifest.js —— 美术/音频资源清单（真实资源接入层声明文件）
 * ============================================================
 * 【用途】
 *   本文件是「真实资源接入层」的唯一清单。AssetHooks.init()（见 js/core.js
 *   末尾区块）启动时按本清单一次性预加载全部条目：加载成功的资源登记进
 *   AssetHooks.cache，渲染/音频侧经 AssetHooks.sprite()/audio() 查表优先取用
 *   真实资源；加载失败的键静默留空，自动回退到既有程序化占位绘制 /
 *   WebAudio 合成音效。—— 有文件就替换、没文件就回退，业务代码零改动。
 *
 * 【目录约定】
 *   assets/sprites/   全部图片素材（角色立绘、图标、特效帧等）
 *   assets/audio/     全部音效（短音频，单发播放）与音乐（BGM，循环播放）
 *
 * 【命名规则】
 *   键名 = 类型前缀 + 下划线 + 语义名，全小写 snake_case：
 *     英雄立绘  hero_H001（与 CFG.heroes[].id 严格对应，id 原样大写）
 *     音效      sfx_shoot / sfx_hit / ...
 *     音乐      bgm_battle
 *   文件名与键名保持一致（含扩展名）。键名一旦发布不可更改——渲染侧按键
 *   查表，改键等于断线；新增资源只允许追加新键。
 *
 * 【格式要求与尺寸建议】
 *   图片：PNG（透明背景）或 WebP；角色立绘建议 512×512 以上、等比、
 *         主体居中、四周保留 8px 透明边；UI 图标建议 64×64 / 128×128。
 *   音频：OGG（首选，体积小）或 MP3（兜底）；音效建议 ≤ 200KB、
 *         单声道 44.1kHz、首尾静音裁净；BGM 建议 ≤ 3MB、双声道、
 *         首尾做无缝循环点。
 *
 * 【接入步骤】（美术/音频同事看这里）
 *   1. 按下方清单的路径与文件名放置文件（assets/ 对应目录）；
 *   2. 新增资源时在本清单对应分组里追加一行「键名: 路径」；
 *   3. 刷新页面即可生效——无需改任何 JS 代码（AssetHooks 启动自动预加载，
 *      文件缺失时静默回退占位，控制台无报错、游戏行为不变）。
 *
 * 【挂载说明】本文件暂未被 index.html 挂载（不加 script 标签）：无头测试
 *   直接 vm 加载本文件；正式接入时在 index.html 中 core.js 之前加一行
 *   <script src="js/assets_manifest.js"></script> 即自动生效，核心代码零改动。
 * ============================================================ */
"use strict";

const AssetManifest = {
  /* ---------- 图片素材（sprites：png / webp） ---------- */
  sprites: {
    /* 6 个首发英雄立绘（id 取自 CFG.heroes 前 6 项，顺序一致，只读引用不改配置） */
    hero_H001: "assets/sprites/hero_H001.png",   // 猎手（远程速射 / 均衡型）
    hero_H002: "assets/sprites/hero_H002.png",   // 散弹手（三向散射 / 近战压制）
    hero_H003: "assets/sprites/hero_H003.png",   // 穿甲者（高穿透 / 阵地输出）
    hero_H004: "assets/sprites/hero_H004.png",   // 弹射手（弹射跳弹 / 走位牵制）
    hero_H005: "assets/sprites/hero_H005.png",   // 快枪手（极限射速 / 高机动）
    hero_H006: "assets/sprites/hero_H006.png",   // 重炮手（低速重弹 / 火力覆盖）
  },
  /* ---------- 音效（audio：ogg / mp3，短音频单发播放） ---------- */
  audio: {
    sfx_shoot:   "assets/audio/sfx_shoot.ogg",   // 开火
    sfx_hit:     "assets/audio/sfx_hit.ogg",     // 命中
    sfx_explode: "assets/audio/sfx_explode.ogg", // 爆炸
    sfx_pickup:  "assets/audio/sfx_pickup.ogg",  // 拾取
    sfx_levelup: "assets/audio/sfx_levelup.ogg", // 升级
    sfx_reroll:  "assets/audio/sfx_reroll.ogg",  // 重抽
    sfx_extract: "assets/audio/sfx_extract.ogg", // 撤离结算
    sfx_death:   "assets/audio/sfx_death.ogg",   // 角色阵亡
  },
  /* ---------- 音乐（music：ogg / mp3，循环播放） ---------- */
  music: {
    bgm_battle: "assets/audio/bgm_battle.ogg",   // 战斗 BGM（无缝循环）
  },
};
