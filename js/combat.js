/* ============================================================
 * combat.js — 战斗结算 / 伤害 / 技能解析 / 特效 / FX（21.16 物理搬移拆分：原 game.js 第 3 部分）
 * 职责：SkillSystem / PatternSystem / autoFightMove；怪物攻防与结算（damageMonster/explode/
 *       onMonsterKilled/spawnBoss…）；精英缩放/刷怪池；匠人场；Boss 激光 LaserBeam（17.7）；
 *       行为芯片积木（bounce/burn/split/chain，19.12）；粒子/飘字特效 FX。
 * ⚠️ 本文件由纯物理搬移生成：除本头部职责注释与 "use strict"; 外，代码逐字沿用原文件。
 * ============================================================ */
"use strict";
/* ============ 技能执行器（P2：玩家 / 队友 / 召唤物共用同一套释放逻辑） ============
 * 释放形态由技能表的 type 决定：bullet 弹道 / summon 召唤物 / trap 陷阱。
 * 所有数值都来自 resolveSkill 的产物（队长 = G.run.weapon.*，队友 = c.skills.*），执行器本身不存数值。 */
const SkillSystem = {
  /** 属性加成积木 scaleBy（26.x，通用技能字段）：把「施法者某属性」按 pct 折算后叠加到技能效果值。
   *  公式（写死在此，便于审计）：最终值 = 技能锚点固定值 + 属性 × pct × 等级系数，
   *    等级系数 = 1 + (skillLv - 1) × CFG.skillScaleBy.levelGrowth。
   *  固定值部分仍走既有 anchors 锚点插值（resolveSkill 产物），本函数只加「属性部分」。
   *  未声明 scaleBy / 属性缺失 / 加成 <=0 → 返回原技能对象（零足迹，行为等价）。 */
  withScaleBy(sk, stats) {
    const sb = sk && sk.scaleBy;
    if (!sb || sb.stat == null) return sk;
    const raw = stats ? stats[sb.stat] : undefined;
    const base = (typeof raw === "number") ? raw : 0;
    const grow = (CFG.skillScaleBy && CFG.skillScaleBy.levelGrowth) || 0;
    const lvCoef = 1 + ((sk.lv || 1) - 1) * grow;
    const add = base * (sb.pct || 0) * lvCoef;
    if (!(add > 0)) return sk;
    return { ...sk, radius: (sk.radius || 0) + add, scaleByAdd: add };
  },
  /** 弹道技能：按 bullets 数散射，命中带 AoE 半径（技能弹）。
   *  opts: { side, isSkill, atk, spread } */
  castBullet(w, caster, sk, ang, opts = {}) {
    const side = opts.side || "player";
    const isSkill = opts.isSkill != null ? opts.isSkill : (sk.kind !== "basic");
    const atk = opts.atk != null ? opts.atk : caster.atk;
    const n = sk.bullets || 1;
    const spread = opts.spread != null ? opts.spread : (isSkill ? 0.18 : 0.14);
    const pool = side === "player" ? w.playerBullets : w.enemyBullets;
    for (let i = 0; i < n; i++) {
      const a = ang + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
      pool.push(new Bullet(caster.x, caster.y, a, sk.bulletSpd || 480,
        Math.max(1, Math.round(atk * (sk.dmgMul != null ? sk.dmgMul : 1))), side,
        sk.pierce || 0, sk.bounce || 0, isSkill ? sk.radius : 0, isSkill, caster, sk.behavior || null));
    }
    return n;
  },
  /** 召唤物：**按召唤者独立编队**——只补足「自己名下」的数量（阵亡的重新召出）。
   *  再次施放补满自己的编队，不会顶掉其他成员的召唤物（产物池按成员隔离）。
   *  数量上限 = min(技能锚点数量, **英雄「召唤物上限」属性**)：技能等级决定想召几架，
   *  英雄属性（召唤师 6 / 其他 2，见 CFG.heroes + CFG.unitLimit）决定最多几架。
   *  归属固定为召唤者：无人机**随召唤者**移动，召唤者倒下也**不回收**（继续留在场上作战）。 */
  castSummon(w, caster, sk, atk) {
    const row = sk.row || {};
    const want = unitCap(caster, "summon", row.count || 3);
    const orbit = row.orbit || 70;
    // 名下计数只统计**本世界**的召唤物：别的水 map 的编队不占这里的上限，也不会被这里的施放顶掉
    const mine = () => (G.run.drones || []).filter(d => d.hp > 0 && d.owner === caster && (!d.world || d.world === G.activeWorld));
    while (mine().length > want) G.run.drones.splice(G.run.drones.indexOf(mine()[0]), 1);   // 超上限只回收自己最旧的
    // 维修型判定（19.2）：技能条目标 repair:true 或技能 ID 在 CFG.skills2.repairDrone.skillIds 里
    const repairIds = (CFG.skills2 && CFG.skills2.repairDrone && CFG.skills2.repairDrone.skillIds) || [];
    const isRepair = sk.repair === true || repairIds.indexOf(sk.id) >= 0;
    for (let i = mine().length; i < want; i++) {
      const a = (i / Math.max(1, want)) * Math.PI * 2;
      const dr = new Drone(
        caster.x + Math.cos(a) * orbit, caster.y + Math.sin(a) * orbit,
        a, row.hp || 40, Math.max(1, Math.round((row.atk || 6) * (sk.summonMul || 1))),
        row.fireCd || 0.8, orbit, caster, isRepair);
      dr.world = G.activeWorld;   // 世界归属：召唤物只存在于施放时的那张地图，不跨世界跟随（传送后留在原地）
      G.run.drones.push(dr);
    }
    return { n: mine().length, cap: want };
  },
  /** 陷阱：在脚下布设，超出**自己名下**的数量上限时回收自己最旧的那颗。
   *  数量上限 = min(技能锚点数量, **英雄「陷阱数量上限」属性**)。
   *  布置后**留在原地**，与布设者脱钩：布设者走开/倒下都不影响，敌人入圈即延迟引爆。 */
  castTrap(w, caster, sk, atk) {
    const row = sk.row || {};
    const cap = unitCap(caster, "trap", row.count || 1);
    // 名下计数只统计**本世界**的陷阱：主地图的陷阱不占这里的上限，也不会被这里的施放回收
    const mine = () => (G.run.traps || []).filter(t => t.owner === caster && (!t.world || t.world === G.activeWorld));
    if (cap <= 0) return { n: mine().length, cap: 0 };            // 上限为 0：该技能不产出（防死循环）
    while (mine().length >= cap) G.run.traps.splice(G.run.traps.indexOf(mine()[0]), 1);   // 只回收自己的
    G.run.traps.push({
      x: caster.x, y: caster.y, r: 10,
      radius: sk.radius || row.radius || 110,     // 触发范围 = 伤害范围（同源）
      armDelay: sk.armDelay != null ? sk.armDelay : 0.5,
      armed: false, fuse: 0, owner: caster,       // 归属：产物池按成员独立
      world: G.activeWorld,                       // 世界归属：陷阱**留在布设时的那张地图**（传送去子地图它不跟过去）
      dmg: Math.max(1, Math.round(atk * (sk.dmgMul || 1) * (sk.trapMul || 1))),
    });
    return { n: mine().length, cap };
  },
  /** 近战挥击（AT121，type:"melee"）：**身周扇形即时判定**，不产生飞行物。
   *  命中条件 = 距离 ≤ reach + 目标半径，且与施法者面朝方向的夹角 ≤ meleeArc/2。
   *  - `ang` 由调用方给出（面朝目标；无目标时用面朝方向），与子弹同源，便于复用同一套瞄准逻辑。
   *  - 伤害走 damageMonster（吃怪物防御 / 精英盾 / 逐角色统计），killer = caster → 吸血归属正确。
   *  - 表现：spawnBurst 挥砍火花 + SFX.play("hit")，无弹体。
   *  近战与远程的差别（用户口径）：近战**必须贴身**、单次伤害更高、出手更快，被弹幕惩罚更重。 */
  castMelee(w, caster, sk, ang, opts = {}) {
    const reach = sk.reach || 70;
    const halfArc = (sk.meleeArc || 1.6) / 2;
    const atk = opts.atk != null ? opts.atk : caster.atk;
    const dmg = Math.max(1, Math.round(atk * (sk.dmgMul != null ? sk.dmgMul : 1)));
    let hit = 0;
    const ax = Math.cos(ang), ay = Math.sin(ang);
    for (const m of w.monsters) {
      if (m.dead) continue;
      const dx = m.x - caster.x, dy = m.y - caster.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0;
      if (d > reach + (m.r || 0)) continue;
      if (d > 1) {                                   // 贴身重合时不做角度剔除（避免零向量抖动）
        const cosA = (dx * ax + dy * ay) / d;
        if (cosA < Math.cos(halfArc)) continue;      // 超出扇形张角
      }
      damageMonster(w, m, dmg, caster);
      hit++;
    }
    // 挥砍表现：沿面朝方向撒一串火花（视觉提示"这一下打出去了"，无弹体）
    spawnBurst(caster.x + ax * reach * 0.6, caster.y + ay * reach * 0.6, "#ffe9a8", hit ? 6 : 3);
    if (hit) SFX.play("hit");
    return { kind: "melee", n: hit, reach, arc: sk.meleeArc || 1.6 };
  },

  /** 辅助三件套共用的「范围伤害 + 全队效果」骨架（AT122 治疗 / AT123 光环 / AT124 护罩）。
   *  - 伤害：以施法者为中心的圆形范围（半径 = sk.radius，含 scaleBy 加成），与 taunt 同源走 explode。
   *  - 效果：由调用分支决定（回血 / 增益 / 护罩），数值 = 技能固定值 + `sk.scaleByAdd`（属性加成积木产物）。
   *  - 全队遍历统一用 aliveHeroes()（队长 + 存活队友），与「局内增益全队生效」口径一致。 */
  castSupport(w, caster, sk, opts = {}, kind = "support") {
    const atk = opts.atk != null ? opts.atk : caster.atk;
    const R = sk.radius || 0;
    if (R > 0) explode(w, caster.x, caster.y, R, Math.max(1, Math.round(atk * (sk.dmgMul != null ? sk.dmgMul : 1))), "player", caster);
    const add = sk.scaleByAdd || 0;              // 属性加成积木产出的"效果量"（未声明 scaleBy 时为 0）
    const heroes = aliveHeroes();
    const out = { kind, n: 0, radius: R, amount: 0 };
    if (kind === "heal") {
      const amt = Math.max(1, Math.round((sk.healBase || 0) + add * (sk.healPerAdd != null ? sk.healPerAdd : 1)));
      const r = (typeof G !== "undefined" && G.run) ? G.run : null;
      for (const h of heroes) {
        if (!h) continue;
        /* ⚠️ 血量存放位置不一致（踩坑）：**队长**的血在 G.run.hp / G.run.hpMax（Player 实例本身不带 hp 字段，
         *    见 heroTakeDamage → G.player.takeDamage），**队友**才在 h.hp / h.hpMax。
         *    曾经统一按 h.hp 读 → 队长的 h.hp 恒为 undefined → 治疗**永远跳过队长**，只有队友回血。 */
        if (h === G.player) {
          if (!r || typeof r.hp !== "number") continue;
          const mx = (r.hpMax != null) ? r.hpMax : r.hp;
          if (r.hp < mx) { r.hp = Math.min(mx, r.hp + amt); out.n++; }
          continue;
        }
        if (typeof h.hp !== "number") continue;
        const mx = (h.hpMax != null) ? h.hpMax : h.hp;
        if (h.hp < mx) { h.hp = Math.min(mx, h.hp + amt); out.n++; }
      }
      out.amount = amt;
      spawnBurst(caster.x, caster.y, "#7dffa8", 16, R * 0.8);
      SFX.play("skill");
      return out;
    }
    if (kind === "aura") {
      const pct = (sk.auraPct || 0) + add * 0.01;         // 属性加成：每点加成 +1% 幅度
      const dur = sk.auraDuration || 10;
      SkillSystem.pushRunBuff("圣咏鼓舞", "atk", 1 + pct, dur);
      SkillSystem.pushRunBuff("圣咏迅捷", "spd", 1 + pct, dur);
      out.n = heroes.length; out.amount = pct;
      spawnBurst(caster.x, caster.y, "#ffd76a", 18, R * 0.8);
      SFX.play("skill");
      return out;
    }
    // barrier：全队防御护罩（def 走 runBonus().add.def，与装备/卡牌同一通道）
    const defAdd = Math.max(1, Math.round((sk.barrierDef || 0) + add));
    SkillSystem.pushRunBuff("灵能护罩", "def", defAdd, sk.barrierDuration || 12);
    out.n = heroes.length; out.amount = defAdd;
    spawnBurst(caster.x, caster.y, "#6cb2ff", 18, R * 0.8);
    SFX.play("skill");
    return out;
  },
  /** 写入 / 刷新一条**技能施加的临时增益**到 G.run.buffs（title = 稳定 id，用于去重刷新）。
   *  与战争雕像 Buff 的差别：**不带 skillId**，runBonus() 直接读 b.stat / b.mul（动态数值），
   *  且同 id 只保留一份（重复施放 = 刷新时长，不叠加，避免无限叠乘）。
   *  stat 仅支持 runBonus 认得的通道：atk / spd / cdMul / lifesteal / def。 */
  pushRunBuff(id, stat, mul, duration) {
    const r = (typeof G !== "undefined" && G.run) ? G.run : null;
    if (!r) return null;
    if (!Array.isArray(r.buffs)) r.buffs = [];
    const rec = { id, stat, mul, remain: duration, label: buffLabelOf(stat, mul) };
    const i = r.buffs.findIndex(b => b && b.id === id);
    if (i >= 0) r.buffs[i] = rec; else r.buffs.push(rec);
    return rec;
  },
  /** 嘲讽战吼（AT120）：半径内敌人强制攻击施法者 duration 秒，并造成一次小额 AOE 伤害。   *  半径 = sk.radius（锚点固定值 + scaleBy 的防御加成，见 withScaleBy）。
   *  归属：嘲讽者 = caster（怪物 tauntedBy/tauntT，AI 选目标优先嘲讽者，见 game.js）。 */
  castTaunt(w, caster, sk, opts = {}) {
    const R = sk.radius || 0;
    const dur = (sk.duration != null) ? sk.duration : ((CFG.taunt && CFG.taunt.duration) || 4);
    const atk = opts.atk != null ? opts.atk : caster.atk;
    let n = 0;
    for (const m of w.monsters) {
      if (m.dead) continue;
      if (U.dist(caster.x, caster.y, m.x, m.y) <= R + (m.r || 0)) { m.tauntedBy = caster; m.tauntT = dur; n++; }
    }
    if (R > 0) explode(w, caster.x, caster.y, R, Math.max(1, Math.round(atk * (sk.dmgMul != null ? sk.dmgMul : 1))), "player", caster);
    return { kind: "taunt", n, radius: R, duration: dur };
  },
  /** 释放总入口：按 type 分发；返回本次释放的表现类型 + 数量信息（n / cap），供调用方播放音效/提示。 */
  cast(w, caster, sk, target, opts = {}) {
    sk = this.withScaleBy(sk, opts.statSrc);   // 属性加成积木 scaleBy（未声明则原样返回）
    const ang = target ? Math.atan2(target.y - caster.y, target.x - caster.x) : (opts.ang || 0);
    if (sk.type === "summon") return { kind: "summon", ...this.castSummon(w, caster, sk, opts.atk) };
    if (sk.type === "trap") return { kind: "trap", ...this.castTrap(w, caster, sk, opts.atk) };
    if (sk.type === "taunt") return { ...this.castTaunt(w, caster, sk, opts) };
    if (sk.type === "melee") return { ...this.castMelee(w, caster, sk, ang, opts) };            // 近战挥击
    if (sk.type === "healNova") return { ...this.castSupport(w, caster, sk, opts, "heal") };    // 医疗兵
    if (sk.type === "aura") return { ...this.castSupport(w, caster, sk, opts, "aura") };        // 圣歌者
    if (sk.type === "barrier") return { ...this.castSupport(w, caster, sk, opts, "barrier") };  // 灵能者
    return { kind: "bullet", n: this.castBullet(w, caster, sk, ang, opts) };
  },
};

/** 临时增益的中文标签（技能施加的 Buff 用；runBonus 只认 stat 通道，这里只做文案）。
 *  形如 攻击 +8% / 移速 +8% / 防御 +4。数值缺失时回落空串（不抛错）。 */
function buffLabelOf(stat, mul) {
  const name = (typeof CFG !== "undefined" && CFG.statNames && CFG.statNames[stat]) || stat || "";
  const mv = (typeof mul === "number") ? mul : 0;
  if (stat === "def") return name + " +" + Math.round(mv);
  return name + " +" + Math.round((mv - 1) * 100) + "%";
}

/* ============ 弹幕发射器（第十七章 17.4 / 17.6：Boss 弹幕范式） ============
 * 分工：SkillSystem 管**伤害与词条**（谁打的、吃哪些标签、吸血归属），
 *       PatternSystem 只管**敌方弹幕的几何形状**（画什么花色）——招式参数来自技能表 AT21x 条目。
 * 六种发射器：radial 放射 ｜ spiral 螺旋 ｜ fan 扇形 ｜ wave 波幕 ｜ ring 同心环 ｜ grid 网格/花形。
 * 通用规律（17.2 调研）：同一种发射器只调「**弹数 / 角度 / 速度**」三旋钮，就能覆盖很大的难度区间。
 * 所有发射都先过 bossBudget 护栏（CFG.boss：单只 Boss 每秒发射量 + 同屏存量）。 */
const PatternSystem = {
  /** 形状展开：把「招式」摊成 [{ ang, spdMul, dx, dy }] 纯几何描述，不碰实体（可单测）。
   *  ang = 发射角；spdMul = 速度倍率（ring 分层扩散用）；dx/dy = 出生点相对 Boss 的偏移。 */
  shape(p, aimAng, spinAng) {
    const out = [];
    const kind = p.pattern || "radial";
    const n = Math.max(1, Math.round(p.count || 8));
    const off = p.offset || 0;
    const push = (ang, spdMul, dx, dy) => out.push({ ang, spdMul: spdMul || 1, dx: dx || 0, dy: dy || 0 });
    switch (kind) {
      case "radial":                     // 放射：360° 均匀铺开（教学招 / 底噪）
        for (let i = 0; i < n; i++) push(off + i * Math.PI * 2 / n);
        break;
      case "spiral": {                   // 螺旋：arms 条臂，每次发射整体旋转 spin（调用方累积角度）
        const arms = Math.max(1, Math.round(p.arms || 2));
        for (let i = 0; i < arms; i++) push(spinAng + i * Math.PI * 2 / arms);
        break;
      }
      case "fan": {                      // 扇形：以瞄准角为中心 ±arc/2 均分（逼走位）
        const arc = p.arc != null ? p.arc : Math.PI / 3;
        if (n === 1) push(aimAng);
        else for (let i = 0; i < n; i++) push(aimAng - arc / 2 + arc * i / (n - 1));
        break;
      }
      case "wave": {                     // 波/幕：一排**平行**推进的弹（法向等距错开），速度微差 → 整体略呈弧
        const lat = p.lateral != null ? p.lateral : 24;
        const nx = -Math.sin(aimAng), ny = Math.cos(aimAng);       // 法向单位向量
        for (let i = 0; i < n; i++) {
          const t = (i - (n - 1) / 2) * lat;
          push(aimAng, 1 + (i - (n - 1) / 2) * 0.015, nx * t, ny * t);
        }
        break;
      }
      case "ring": {                     // 同心环：layers 层同角分布，层间角错半格 + 速度递增 → 飞行中自然分层
        const layers = Math.max(1, Math.round(p.layers || 2));
        const lm = p.layerMul != null ? p.layerMul : 0.15;
        for (let k = 0; k < layers; k++)
          for (let i = 0; i < n; i++)
            push(off + i * Math.PI * 2 / n + k * Math.PI / n, 1 + k * lm);
        break;
      }
      case "grid": {                     // 网格/花形：极坐标规则网格，层间角错半格 → 花瓣感（视觉高潮技）
        const layers = Math.max(1, Math.round(p.layers || 2));
        const gap = p.gap != null ? p.gap : 90;
        for (let k = 0; k < layers; k++) {
          const r = (k + 1) * gap;
          for (let i = 0; i < n; i++) {
            const a = off + i * Math.PI * 2 / n + k * Math.PI / n;
            push(a, 1, Math.cos(a) * r, Math.sin(a) * r);
          }
        }
        break;
      }
    }
    return out;
  },
  /** 发射：形状 → 实体；返回**实际发射数**（经护栏裁剪，可能少于形状弹数）。
   *  裁剪时按**等间隔抽取**而非砍尾巴——保证降密度后形状依然对称（护栏的"低密度而非偏瘫"）。 */
  emit(w, m, p, aimAng, spinAng) {
    let desc = this.shape(p, aimAng, spinAng);
    // 护栏①：同屏存量（只统计本 Boss 名下、尚未消亡的弹幕）
    let live = 0;
    for (const b of w.enemyBullets) if (b.owner === m && !b.dead) live++;
    // 护栏②：每秒发射量（以 Boss 自身时钟做滑动窗口，不依赖全局时间）
    const bw = CFG.boss.bulletWindow, now = m.bossClock || 0;
    if (m.budgetT == null || now - m.budgetT >= bw) { m.budgetT = now; m.budgetUsed = 0; }
    const quota = Math.max(0, Math.min(CFG.boss.bulletBudget * bw - (m.budgetUsed || 0), CFG.boss.bulletCap - live));
    const n = Math.max(0, Math.min(desc.length, Math.floor(quota)));
    if (n < desc.length && n > 0) {
      const step = desc.length / n, pick = [];
      for (let i = 0; i < n; i++) pick.push(desc[Math.floor(i * step)]);
      desc = pick;
    }
    const spd = p.bulletSpd || 180;
    const dmg = Math.max(1, Math.round(m.atk * (p.dmgMul != null ? p.dmgMul : 1)));
    const life = p.life != null ? p.life : CFG.boss.bulletLife;
    for (let i = 0; i < n; i++) {
      const d = desc[i];
      const b = new Bullet(m.x + d.dx, m.y + d.dy, d.ang, spd * d.spdMul, dmg, "enemy", 0, 0, 0, false, m);
      b.boss = true;              // 渲染区分（Boss 弹幕更亮）+ 存量统计归属
      b.life = life;              // 慢弹幕需要足够滞空时间（Bullet 默认 2.2s 会在半途消失）
      w.enemyBullets.push(b);
    }
    m.budgetUsed = (m.budgetUsed || 0) + n;
    return n;
  },
};

/* ============ 实体 ============ */
/* ---------- 自动战斗 AI（托管队长的移动；转向力叠加模型） ----------
 * 优先级：躲避威胁(×threatWeight) > 保持攻击距离/风筝 > 索敌
 * 威胁源：① 敌方子弹（预判弹道最近逼近点，垂直/径向闪避）
 *         ② 精英冲锋 telegraph 状态（沿冲锋线垂直侧闪 + 稍远离）
 *         ③ Boss 爆炸预警 warnT（径向逃离预警圈）
 * 反应延迟 reactDelay：威胁首次被看见后须存在该时长才触发躲避（疯狂档反应慢，保留张力）。
 * 撤离读条期间停止走位（站桩输出，不打断读条）；玩家手动操作时 AI 让权。 */
function autoFightMove(p, w, dt) {
  const r = G.run, af = CFG.autoFight;
  const style = af.styles[r.autoStyle] || af.styles[af.defaultStyle];
  if (r.aiHoldT > 0) { r.aiHoldT -= dt; return { dx: 0, dy: 0 }; }   // 手动让权倒计时
  if (r.extractChanneling) return { dx: 0, dy: 0 };                  // 撤离读条：圈内暂停走位
  r.aiClock += dt;
  const now = r.aiClock;
  const seen = r.aiThreatSeen || (r.aiThreatSeen = new Map());

  let tx = 0, ty = 0, threat = 0;   // 威胁躲避向量
  // ① 敌方子弹
  if (style.dodgeBullets) {
    for (const b of w.enemyBullets) {
      if (b.dead) continue;
      const rx = b.x - p.x, ry = b.y - p.y;
      if (Math.hypot(rx, ry) > af.bulletScan) continue;
      if (!seen.has(b)) seen.set(b, now);
      if (now - seen.get(b) < style.reactDelay) continue;
      const vv = b.vx * b.vx + b.vy * b.vy || 1;
      const tCa = -(rx * b.vx + ry * b.vy) / vv;           // 最近逼近时刻
      if (tCa < 0 || tCa > 1.2) continue;                  // 只关心 1.2s 内会逼近的弹
      const cx = rx + b.vx * tCa, cy = ry + b.vy * tCa;    // 最近逼近点（相对玩家）
      const miss = Math.hypot(cx, cy);
      if (miss > p.r + 34) continue;                       // 打不中则忽略
      const wgt = (1 - miss / (p.r + 34)) * (1.2 - tCa);
      if (miss > 1) { tx -= cx / miss * wgt; ty -= cy / miss * wgt; }
      else if (Math.hypot(rx, ry) > 0.5) { const l = Math.hypot(rx, ry); tx -= rx / l * wgt; ty -= ry / l * wgt; }
      threat += wgt;
    }
  }
  // ②③ 预警型威胁（冲锋 / Boss 爆炸圈）
  if (style.dodgeTelegraph) {
    for (const m of w.monsters) {
      if (m.dead) continue;
      const isBossWarn = m.d.type === "boss" && m.warnT > 0;
      const isCharging = m.d.type === "charger" && m.state === "telegraph";
      if (!isBossWarn && !isCharging) continue;
      const dx0 = p.x - m.x, dy0 = p.y - m.y;
      const dist = Math.hypot(dx0, dy0) || 1;
      const R = (isBossWarn ? (m.ak.boomRadius || 0) : (m.ak.chargeRange || 300)) * style.dodgeMargin;
      if (dist > R) continue;
      if (!seen.has(m)) seen.set(m, now);
      if (now - seen.get(m) < style.reactDelay) continue;
      // 方向兜底：威胁体正好压在身上（向量退化）时按固定角度逃离
      let ux = dx0 / dist, uy = dy0 / dist;
      if (Math.abs(dx0) < 1 && Math.abs(dy0) < 1) {
        const a0 = p.aiEscA || (p.aiEscA = U.rand(0, Math.PI * 2));
        ux = Math.cos(a0); uy = Math.sin(a0);
      }
      if (isBossWarn) {
        const wgt = (1 - dist / R) * 3;                    // 径向逃离预警圈
        tx += ux * wgt; ty += uy * wgt; threat += wgt;
      } else {
        const side = p.aiStrafeSide || (p.aiStrafeSide = Math.random() < 0.5 ? 1 : -1);
        const wgt = 2.5 * (1 - dist / R);                  // 垂直冲锋线侧闪 + 稍远离
        tx += -uy * side * wgt + ux * wgt * 0.4;
        ty += ux * side * wgt + uy * wgt * 0.4;
        threat += wgt;
      }
    }
  }
  // 清理已失效威胁的时间戳（子弹/怪物死亡）
  for (const k of seen.keys()) if (k.dead) seen.delete(k);

  // ---- 资源目标（雕像激活 / 掉落拾取）：风格驱动；仅在无近战威胁时行动（战斗优先） ----
  let goal = null;   // {x, y}
  const target = nearestMonster(w, p.x, p.y);
  const tDist = target ? U.dist(p.x, p.y, target.x, target.y) : Infinity;
  // 雕像分类：按 id 识别（裂缝/任务奖励宝箱无 id，按效果类型兜底）；工匠雕像 AI 永不主动踩
  const altarKind = (a) => {
    const eff = (a.cfg && a.cfg.effects) || [];
    if (a.id === "ALTAR_005" || (a.cfg && a.cfg.name && a.cfg.name.indexOf("工匠") >= 0)) return "artisan";
    if (a.id === "ALTAR_002" || eff.some(e => e.type === "randomBuff")) return "war";
    if (a.id === "ALTAR_001" || eff.some(e => e.type === "heal")) return "goddess";
    if ((a.id || "").indexOf("ALTAR_004") === 0 || eff.some(e => e.type === "adjustMonsters")) return "evil";
    return "chest";
  };
  // ① 雕像/祭坛激活：锁定目标 → 走进交互圈 → 圈内站桩读条（读条由 World.update 的 judgeChannel 推进）
  //    风格决定踩哪类：war/chest/evil 按开关；女神需生命 ≤ goddessHp 门槛；残血达门槛时女神优先于其他雕像。
  //    门槛在选目标时判定一次，锁定后读条不反悔（威胁让位时进度保留可回来续读）。
  if (style.altar && typeof style.altar === "object") {
    const ac = style.altar;
    if (r.aiAltar && w.altars.indexOf(r.aiAltar) < 0) { r.aiAltar = null; r.aiAltarT = 0; }   // 已触发被移除
    if (!r.aiAltar) {
      const hpFrac = r.hp / r.hpMax;
      let bd = af.altarRange, bp = 0;   // bp 优先级：女神(达门槛)=2 > 战争/宝箱/邪神=1
      for (const a of w.altars) {
        const kind = altarKind(a);
        let prio = 0;
        if (kind === "goddess") { if (ac.goddessHp != null && hpFrac <= ac.goddessHp) prio = 2; }
        else if (ac[kind]) prio = 1;    // war / chest / evil；artisan 永不在 ac 中开启
        if (prio <= 0) continue;
        const d = U.dist(p.x, p.y, a.x, a.y);
        if (d >= af.altarRange) continue;
        if (prio < bp) continue;                    // 低优先级不抢高优先级
        if (prio === bp && d >= bd) continue;       // 同级取最近
        bd = d; bp = prio; r.aiAltar = a; r.aiAltarT = 0;
      }
    }
    if (r.aiAltar) {
      r.aiAltarT += dt;
      if (r.aiAltarT > af.altarTimeout) { r.aiAltar = null; r.aiAltarT = 0; }   // 超时放弃，防卡死
      else if (heroInCircle(r.aiAltar.x, r.aiAltar.y, r.aiAltar.cfg.radius)) {
        if (threat < 0.8) return { dx: 0, dy: 0 };   // 圈内站桩读条（有预警威胁时仍走躲避，进度保留可回来续读）
        goal = null;                                  // 危险中：先躲避
      } else goal = { x: r.aiAltar.x, y: r.aiAltar.y };
    }
  }
  // ② 掉落拾取（金币/经验宝石/地上宝箱）：gate 决定触发时机——
  //    path=战斗中顺路（贴身小半径，不抢战斗）/ gap=战斗目标较远或清场（战斗间隙）/ clear=战后清扫（目标在清扫圈外）
  if (!goal && threat < 1.2) {
    const loot = style.loot || {};
    const R = loot.range || 0;
    let gate = false;
    if (R > 0) {
      if (loot.gate === "path") gate = true;
      else if (loot.gate === "clear") gate = !target || tDist > R;
      else gate = !target || tDist > af.engageBase * style.engageMul + 50;   // gap（默认）
    }
    if (gate) {
      let bd = R;
      for (const pk of w.pickups) {
        const d = U.dist(p.x, p.y, pk.x, pk.y);
        if (d < bd) { bd = d; goal = { x: pk.x, y: pk.y }; }
      }
      if (loot.chests && (r.aiChestCool || 0) <= 0) {
        for (const c of w.groundChests) {
          const d = U.dist(p.x, p.y, c.x, c.y);
          if (d < bd) { bd = d; goal = { x: c.x, y: c.y }; }
        }
      }
    }
  }
  if (r.aiChestCool > 0) r.aiChestCool -= dt;

  // 走位/索敌向量：有资源目标直奔目标；否则按期望距离风筝/逼近
  let sx = 0, sy = 0;
  if (goal) {
    const dx0 = goal.x - p.x, dy0 = goal.y - p.y;
    const dist = Math.hypot(dx0, dy0) || 1;
    sx = dx0 / dist; sy = dy0 / dist;
  } else if (target) {
    const dx0 = target.x - p.x, dy0 = target.y - p.y;
    const dist = Math.hypot(dx0, dy0) || 1;
    const ux = dx0 / dist, uy = dy0 / dist;
    const hpFrac = r.hp / r.hpMax;
    if (style.lowHpFlee > 0 && hpFrac < style.lowHpFlee) {
      sx = -ux; sy = -uy;                                  // 低血量：转身拉开距离风筝
    } else {
      const want = af.engageBase * style.engageMul * (style.lowHpFlee > 0 && hpFrac < style.lowHpFlee + 0.15 ? 1.4 : 1);
      if (dist > want + 50) { sx = ux; sy = uy; }          // 太远：逼近
      else if (dist < want - 50) { sx = -ux; sy = -uy; }   // 太近：后撤
      else {                                               // 合适距离：环绕风筝
        p.aiStrafeT = (p.aiStrafeT || 0) - dt;
        if (p.aiStrafeT <= 0) { p.aiStrafeT = af.strafeT; p.aiStrafeSide = Math.random() < 0.5 ? 1 : -1; }
        const side = p.aiStrafeSide || 1;
        sx = -uy * side * 0.5; sy = ux * side * 0.5;
      }
    }
  }

  // 合成：威胁躲避(×threatWeight) + 边界保命(×wallWeight) + 走位/索敌/资源(×1)
  const M = af.wallMargin;
  let bx = 0, by = 0;
  if (p.x < M) bx += 1 - p.x / M;                          // 软推力：越贴墙推力越大
  if (p.x > w.w - M) bx -= 1 - (w.w - p.x) / M;
  if (p.y < M) by += 1 - p.y / M;
  if (p.y > w.h - M) by -= 1 - (w.h - p.y) / M;
  let mx = tx * af.threatWeight + sx + bx * af.wallWeight;
  let my = ty * af.threatWeight + sy + by * af.wallWeight;
  // 硬投影：靠墙时压平朝墙外的分量（沿墙切线滑动，绝不主动出界）
  const hard = M * 0.45;
  if (mx < 0 && p.x < hard) mx = 0;
  if (mx > 0 && p.x > w.w - hard) mx = 0;
  if (my < 0 && p.y < hard) my = 0;
  if (my > 0 && p.y > w.h - hard) my = 0;
  let l = Math.hypot(mx, my);
  if (l < 0.05) {
    if (!bx && !by) return { dx: 0, dy: 0 };               // 无任何意图
    const cx0 = w.w / 2 - p.x, cy0 = w.h / 2 - p.y;        // 角落兜底：被完全压平 → 向地图中心逃逸
    const cl = Math.hypot(cx0, cy0) || 1;
    mx = cx0 / cl; my = cy0 / cl; l = 1;
  }
  mx /= l; my /= l;
  const a = Math.min(1, af.smoothing * dt);
  r.aiMvX += (mx - r.aiMvX) * a;
  r.aiMvY += (my - r.aiMvY) * a;
  const ll = Math.hypot(r.aiMvX, r.aiMvY);
  if (ll < 0.08) return { dx: 0, dy: 0 };
  return { dx: r.aiMvX / ll, dy: r.aiMvY / ll };
}

/* ============ 怪物攻击技能（P2：攻击参数全部来自技能表 4e 视图） ============
 * 怪物表只保留 type（AI 行为）与属性；攻击参数由 d.skillList[0] 对应的技能条目提供。
 * 技能表用通用字段名（cd / radius / warnTime / dmgMul），此处归一化成 AI 调用的别名；
 * 显式写了别名时以别名为准（如 boss 的 touchCd 与 cd 不同义）。 */
const MON_ATK_DEFAULT = {
  touchCd: 0.8, fireCd: 2.0, keepDist: 260, bulletSpd: 300,
  chargeRange: 300, telegraph: 0.6, dashSpd: 520, dashTime: 0.4, chargeCd: 3.0,
  boomWarn: 1.5, boomRadius: 200, touchMul: 0.6,
  minionId: "NM0010", minionWave: 2, minionCd: 8.0,
};
function monsterAttackSkill(d, lv) {
  const skId = d.skillList && d.skillList[0];
  const se = (skId ? skillEntry(skId, lv) : null) || {};
  const D = MON_ATK_DEFAULT;
  const pick = (alias, generic) => (se[alias] != null ? se[alias]
    : (generic && se[generic] != null ? se[generic] : D[alias]));
  return {
    id: skId || null, name: se.name || d.name,
    atkMul: se.dmgMul != null ? se.dmgMul : 1,      // 攻击伤害倍率（× 怪物 atk）
    touchCd: pick("touchCd", "cd"),
    fireCd: pick("fireCd", "cd"),
    chargeCd: pick("chargeCd", "cd"),
    boomCd: pick("boomCd", "cd"),
    boomWarn: pick("boomWarn", "warnTime"),
    boomRadius: pick("boomRadius", "radius"),
    keepDist: pick("keepDist", null), bulletSpd: pick("bulletSpd", null),
    chargeRange: pick("chargeRange", null), telegraph: pick("telegraph", null),
    dashSpd: pick("dashSpd", null), dashTime: pick("dashTime", null),
    touchMul: pick("touchMul", null),
    minionId: pick("minionId", null), minionWave: pick("minionWave", null),
    minionCd: pick("minionCd", null),
  };
}

const _tmpArr = [];

function nearestMonster(w, x, y, exclude) {
  let best = null, bd = Infinity, bestLos = null, bdLos = Infinity;
  for (const m of w.monsters) {
    if (m.dead || m === exclude) continue;
    const d = U.dist(x, y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
    if (d < bdLos && losClear(w, x, y, m.x, m.y)) { bdLos = d; bestLos = m; }
  }
  // 优先返回**视线可达**的最近怪：障碍物挡弹道，锁住障碍后的怪只会让子弹打在障碍上
  return bestLos || best;
}

/** 21.20 深渊逐角色伤害归属：从伤害来源实体（子弹 / 陷阱 / 英雄本体）沿 owner 链
 *  解析出归属英雄（队长 G.player 或队友 companion）。深度上限 3（英雄→召唤物→召唤物子弹）。
 *  仅深渊（G.inEndless）生效；解析失败返回 null（该次伤害不计入任何角色）。
 *  返回英雄运行时实体（有 dmgDealt/dmgTaken 字段）。 */
function abyssDamageHeroOf(ent) {
  if (typeof G === "undefined" || !G || !G.inEndless || !G.run) return null;
  let o = ent, depth = 0;
  const comps = Array.isArray(G.run.companions) ? G.run.companions : [];
  while (o && depth < 3) {
    if (o === G.player) return G.player;
    if (comps.indexOf(o) >= 0) return o;
    o = o.owner; depth++;
  }
  return null;
}

function damageMonster(w, m, dmg, killer) {
  // Boss 阶段转换无敌（17.3）：转换窗口内不吃伤害（子弹照常被消耗，但 Boss 不掉血）
  if (m.phaseInvulnT > 0) { spawnBurst(m.x + U.rand(-m.r, m.r), m.y + U.rand(-m.r, m.r), "#ffffff", 2); return; }
  const cuDef = (G.run && G.run.curse) ? G.run.curse.defMul : 1;   // 诅咒附加的"防御 ×N"被动
  const real = Math.max(1, Math.round(dmg - m.d.def * cuDef - (m.eliteDef || 0)));
  const hero = abyssDamageHeroOf(killer);                          // 21.20 逐角色伤害归属（非深渊恒 null）
  // 精英「护盾」词缀：先扣盾，盾破前本体不受损
  if (m.shield > 0) {
    m.shield -= real; m.flashT = 0.1;
    if (G.run && G.run.stats && m.d.type !== "boss") G.run.stats.dmgDealt += real;
    if (hero) hero.dmgDealt = (hero.dmgDealt || 0) + real;         // 打盾也计入该角色输出
    spawnBurst(m.x, m.y, "#6cb2ff", 4); SFX.play("hit");
    if (m.shield <= 0) { m.shield = 0; spawnBurst(m.x, m.y, "#6cb2ff", 14); }
    return;
  }
  m.hp -= real; m.flashT = 0.1;
  if (G.run && G.run.stats && m.d.type !== "boss") G.run.stats.dmgDealt += real;
  if (hero) hero.dmgDealt = (hero.dmgDealt || 0) + real;           // 21.20 逐角色伤害统计
  spawnBurst(m.x, m.y, "#ffd76a", 4);
  SFX.play("hit");
  if (m.hp <= 0 && !m.dead) {
    m.dead = true;
    onMonsterKilled(w, m, killer);   // killer = 击杀弹（供 split 裂变读 behavior / owner；普通调用为 undefined）
  }
}

/* 精英怪编号判定（ED 前缀）：ED 由关卡层定点投放，不进随机圆 */
function isEliteDef(id) {
  return typeof id === "string" && id.slice(0, 2) === "ED";
}

/* ---------- 精英怪标注：独立精英（ED）与词缀转化共用 ----------
 * 字段约定：m.isElite = 精英标记；m.eliteAffixes = 携带的 1~2 条词缀名数组。
 * （旧字段 m.elite 曾同时表示"标记 + 词缀数组"，语义冲突，已拆分。） */
function applyElite(m) {
  const ecfg = CFG.elites;
  const names = Object.keys(ecfg.affixes);
  const n = U.randInt(ecfg.affixCount[0], ecfg.affixCount[1]);
  const picked = [];
  const pool = names.slice();
  for (let i = 0; i < n && pool.length; i++) picked.push(pool.splice(U.randInt(0, pool.length - 1), 1)[0]);
  m.isElite = true;
  m.eliteAffixes = picked;
  for (const name of picked) {
    const a = ecfg.affixes[name];
    if (a.hpMul) { m.hpMax *= a.hpMul; m.hp = m.hpMax; }
    if (a.defAdd) m.eliteDef = (m.eliteDef || 0) + a.defAdd;
    if (a.atkMul) m.atk *= a.atkMul;
    if (a.spdMul) { m.d = { ...m.d, spd: m.d.spd * a.spdMul }; }
    if (a.shieldHp) m.shield = a.shieldHp;
  }
  m.r *= ecfg.sizeMul;   // 体型放大（碰撞与贴图同步）
}

/* ---------- 邪神雕像倍率（多效果并列，见 CFG.monsterScale） ----------
 * 读 r.scale[key] 的 mul；只影响"后续生成"的怪物，不回溯已生成的怪。 */
function monsterScaleMul(key) {
  const r = G.run;
  const s = r && r.scale && r.scale[key];
  return (s && typeof s.mul === "number") ? s.mul : 1;
}
// 把某个"目标"的倍率套用到怪物（按 CFG.monsterScale.targets 的 applyHp/applyAtk 开关）
function applyMonsterScale(m, targetName) {
  const tcfg = CFG.monsterScale.targets[targetName];
  if (!tcfg || !tcfg.key) return;
  const mul = monsterScaleMul(tcfg.key);
  if (mul === 1) return;
  if (tcfg.applyHp) { m.hpMax *= mul; m.hp = m.hpMax; }
  if (tcfg.applyAtk) { m.atk *= mul; }
}
// 全场怪物上限（"小怪数量"开 applyCap 时 ×mul，默认关闭；有性能风险）
function monsterCap() {
  const base = (G.levelCfg && G.levelCfg.monsterCap) || 200;
  const tcfg = CFG.monsterScale.targets["小怪数量"];
  if (tcfg && tcfg.applyCap) return Math.max(1, Math.round(base * monsterScaleMul(tcfg.key)));
  return base;
}
/* 解析"编号:权重/编号:权重"怪物池字符串（ED/BS 不进随机圆，此处只透传，过滤在 spawnWave） */
function parseWeightPool(str) {
  const out = {};
  (str || "").split("/").forEach(s => {
    const [id, wt] = s.split(":");
    if (id && wt != null) out[id] = Number(wt);
  });
  return out;
}

function explode(w, x, y, radius, dmg, side, owner) {
  /* 21.20：owner = 伤害归属实体（英雄 / 带 owner 链的产物），仅深渊逐角色统计消费 */
  spawnBurst(x, y, "#6cb2ff", 26, radius);
  if (side !== "player") {   // Boss 爆炸等敌方爆炸 → 强震动
    G.shakeT = CFG.audio.shake.dur; G.shakeAmp = CFG.audio.shake.bossBoom;
  }
  SFX.play("skill");
  if (side === "player") {
    const cands = w.monsterHash.query(x, y, radius + 40, _tmpArr);
    // 21.14 GC 优化：复用模块级 Set（每帧清空而非 new Set()）。语义与旧实现逐位一致：
    // 只在「真正命中并结算」时 add，故同一怪在多个候选桶里出现也只结算一次。
    const seen = _explodeSeen;
    seen.clear();
    for (const m of cands) {
      if (m.dead || seen.has(m)) continue;
      if (U.dist(x, y, m.x, m.y) <= radius + m.r) { damageMonster(w, m, dmg, owner); seen.add(m); }
    }
  }
}

/* ---------- 掉落 / 击杀 ---------- */
function onMonsterKilled(w, m, killer) {
  const r = G.run, lv = G.levelCfg;
  const rm = r.curse ? r.curse.rewardMul : 1;   // 诅咒风险回报：掉落倍率（待细化36）
  r.kills++;
  Meta.recordMonster(m.defId);   // 图鉴收录：击杀过的怪物永久激活
  SFX.play("kill");
  if (w.isMain) {
    // 金币与经验宝石掉落（地上拾取物，走过自动拾取；Boss 分裂成多枚）
    const n = m.d.type === "boss" ? 5 : 1;
    for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "coin", Math.max(1, Math.round(m.d.coin / n * rm)));
    for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "exp", Math.max(1, Math.round(m.d.exp / n * rm)));
    // 精英击杀计数（工匠雕像池"精英猎杀"触发条件用）
    if (m.isElite) r.eliteKills = (r.eliteKills || 0) + 1;
    // 工匠雕像改由「雕像池」投放（CFG.artisan，见 updateArtisanPool）：此处不再定点生成
    // Boss 触发：进度满 或 时限到（先到者）
    if (!r.bossSpawned && (r.kills >= lv.progressGoal || r.runTime >= lv.timeLimit)) {
      spawnBoss(w);
    }
  } else if (w.kind === "rift") {
    // 裂缝子地图：金币/经验照常掉落；击杀达标 → 刷出奖励宝箱雕像
    spawnPickup(w, m.x, m.y, "coin", Math.max(1, Math.round(m.d.coin * rm)));
    spawnPickup(w, m.x, m.y, "exp", Math.max(1, Math.round(m.d.exp * rm)));
    r.riftKills = (r.riftKills || 0) + 1;
    if (!r.riftRewarded && r.riftKills >= CFG.rift.rewardKills) {
      r.riftRewarded = true;
      const pos = w.findFreeSpot(120);
      if (pos) {
        w.altars.push({ cfg: { name: "裂缝宝箱", color: "#ffd76a", icon: "▣", radius: 91, channel: 1.2,
          effects: [{ type: "giveChest", weights: CFG.rift.chestWeights }] }, x: pos.x, y: pos.y, id: "RIFT_CHEST" });
        UI.toast("▣ 裂缝奖励宝箱出现了！", "gold");
      }
    }
  }
  // 精英怪（独立 ED 或词缀转化）：必掉宝箱（按权重自动入包）+ 额外经验
  if (m.isElite) {
    const item = makeChestItem(U.weightedPick(CFG.elites.dropChest));
    if (grantItemToRun(r, item, { full: "discard" })) {
      UI.toast(`★ 精英「${(m.eliteAffixes || []).join("·")}」掉落 ${item.name}`, "gold");
    } else UI.toast("背包已满，精英宝箱作废", "bad");
    for (let i = 0; i < CFG.elites.extraExp; i++) spawnPickup(w, m.x, m.y, "exp", Math.max(2, Math.round(m.d.exp)));
  }
  dropEndlessExp(w, m);              // 21.17 深渊局内升级：掉落经验宝石（非深渊世界立即返回）
  spawnSplitBullets(w, m, killer);   // 行为芯片（19.12）：裂变——击杀弹带 split 时生成小弹
  spawnBurst(m.x, m.y, "#9aa7b8", 10);
  // 21.15 无尽模式：击杀计数上报（Endless 未就绪时静默跳过，安全降级）
  if (G.inEndless && typeof Endless !== "undefined" && Endless && typeof Endless.recordKill === "function") {
    Endless.recordKill();
  }
}

function spawnPickup(w, x, y, type, value) {
  const a = U.rand(0, Math.PI * 2), s = U.rand(40, 110);
  w.pickups.push({ type, value, x: x + U.rand(-10, 10), y: y + U.rand(-10, 10),
    vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: pickupLife(type) });   // life 读 CFG.pickup（-1 = 永不消失）
}

/* ---------- 工匠雕像池（4.6）：配额池 + 限制器 + 多触发条件 ----------
 * 模型：**触发条件（多条并存）把配额投进池** → **限制器**决定配额何时、以何频率落成
 * 地图上的一座真实雕像。雕像被使用后立即从地图移除（"生效后消失"），池继续产出，
 * 因此**工匠子世界可无限次进入**——"无限次"由池的持续产出保证，而非次数豁免。 */
function createArtisanPool() {
  return {
    quota: 0,                    // 池中待投放配额
    spawned: 0,                  // 本关已投放座数（受 limiter.maxPerLevel 限制）
    cooldown: 0,                 // 使用雕像后的冷却剩余（秒）
    pending: false, readyAt: 0,  // 配额就绪 → 随机延迟后落地
    state: { firstDone: false, progressMarks: 0, bossDone: false, eliteMarks: 0, pityTimer: 0 },
  };
}

/* 场上工匠雕像数量（限制器：同屏最多 maxOnField 座） */
function artisanFieldCount(w) {
  let n = 0;
  for (const a of w.altars) if (a.id === "ALTAR_005") n++;
  return n;
}

function updateArtisanPool(w, dt) {
  const r = G.run, lv = G.levelCfg, cfg = CFG.artisan;
  if (!r || !r.artisanPool || !w.isMain || !cfg) return;
  const lim = cfg.limiter, a = r.artisanPool, st = a.state;
  if (a.cooldown > 0) a.cooldown = Math.max(0, a.cooldown - dt);
  // --- 触发条件：多条并存，任一满足即投配额（互不排斥） ---
  for (const t of cfg.triggers) {
    switch (t.type) {
      case "levelKills":      // 首次里程碑：击杀数达到关卡 artisanAtKills
        if (!st.firstDone && r.kills >= (lv.artisanAtKills || 0)) { st.firstDone = true; a.quota += t.quota; }
        break;
      case "progressStep": {  // 击杀进度每 step 一次（最多 max 次）
        const marks = Math.floor((r.kills / Math.max(1, lv.progressGoal)) / t.step);
        const cap = t.max === undefined ? marks : Math.min(marks, t.max);
        while (st.progressMarks < cap) { st.progressMarks++; a.quota += t.quota; }
        break;
      }
      case "bossDefeated":
        if (!st.bossDone && r.bossDefeated) { st.bossDone = true; a.quota += t.quota; }
        break;
      case "eliteKills": {    // 每击杀 perQuota 只精英一次（最多 max 次）
        const marks = Math.floor((r.eliteKills || 0) / Math.max(1, t.perQuota || 1));
        const cap = t.max === undefined ? marks : Math.min(marks, t.max);
        while (st.eliteMarks < cap) { st.eliteMarks++; a.quota += t.quota; }
        break;
      }
      case "pity":            // 保底：距上次雕像出现超过 interval 秒
        st.pityTimer += dt;
        if (st.pityTimer >= t.interval) { st.pityTimer = 0; a.quota += t.quota; }
        break;
    }
  }
  // --- 限制器：每关上上限（配额再高也不再产出） ---
  if (a.spawned >= lim.maxPerLevel) { a.quota = 0; a.pending = false; return; }
  // --- 落地判定：有配额 + 场上未超上限 + 无冷却 ---
  if (!a.pending && a.quota > 0 && artisanFieldCount(w) < lim.maxOnField && a.cooldown <= 0) {
    a.pending = true;
    a.readyAt = U.rand(lim.spawnDelay[0], lim.spawnDelay[1]);   // 随机延迟落地，出现时机显得"随机"
  }
  if (a.pending) {
    a.readyAt -= dt;
    if (a.readyAt <= 0) {
      a.pending = false;
      const pos = w.findFreeSpot(lim.minDistFromPlayer);
      if (pos) {
        w.altars.push({ cfg: CFG.altars.ALTAR_005, x: pos.x, y: pos.y, id: "ALTAR_005" });
        a.quota = Math.max(0, a.quota - 1);
        a.spawned++;
        st.pityTimer = 0;                 // 保底计时以"上次雕像出现"为起点
        r.artisanSpawned = true;
        UI.toast("⚒ 工匠雕像出现了！", "gold");
      }
    }
  }
}

function spawnBoss(w) {
  const r = G.run;
  r.bossSpawned = true;
  if (r.stats) r.stats.timeToBoss = r.runTime;   // 记录 Boss 出现时刻（结算"Boss 耗时"依赖它）
  const pos = w.findFreeSpot(200);   // 至少离玩家 200，离墙 90
  const bossId = G.levelCfg.boss || "BS0001";
  const boss = new Monster(bossId, pos.x, pos.y, G.levelCfg.monsterLevel || 1);
  applyMonsterScale(boss, "BOSS属性");   // 邪神"BOSS属性"倍率：生成时套用一次（不回溯）
  w.monsters.push(boss);
  w.boss = boss;
  UI.toast(`⚠ BOSS「${CFG.monsters[bossId].name}」出现了！`, "bad");
  EventBus.emit("bossSpawned");
}

function onBossDefeated(w) {
  const r = G.run;
  r.bossDefeated = true;
  Meta.setFlag("bossKill");   // 称号成就：击败一次 BOSS
  if (r.stats) {
    // 注意不能用 `||`：timeToBoss 为 0 时是合法值，会被误判为缺失导致耗时恒为 0
    const t0 = r.stats.timeToBoss === undefined ? r.runTime : r.stats.timeToBoss;
    r.stats.bossFightTime = Math.max(0, r.runTime - t0);
  }
  // 撤离点雕像（5.2）：Boss 死亡位置生成撤离点雕像，小队成员站进雕像圈内即自动读条 8 秒撤离
  if (!r.exitStatue) {
    r.exitStatue = { x: w.boss.x, y: w.boss.y };
    UI.toast("BOSS 已被击败！撤离点雕像在原地出现，**站进雕像圈内**即自动读条 8 秒撤离", "gold");
  }
}

/* ============ 特效 ============
 * 21.14 GC 优化：粒子/飘字改**对象池 + 原地尾部交换删除**（去每帧 new + filter 新数组）。
 * FX.parts / FX.floats **仍是可 for...of 的紧凑数组**——池化后即池的 buf（存活恒在 [0,len)），
 * 渲染侧（renderWorld 3794-3806）与此前逐位等价；`FX.parts.length = 0` 亦如常清空。
 * 池未定义（某些测试桩只加载 game.js）时自动降级为旧 push/filter 逻辑，见文件末尾 §5.45 区块。 */
const FX = { parts: [], floats: [], partsPool: null, floatsPool: null };
/* 单行桥接：把池的紧凑存活数组接到 FX 字段上（池存在时才有调用者）。 */
function fxAttachPools() {
  if (typeof Pool === "undefined" || !Pool || typeof Pool.makePool !== "function") return;   // 降级：保持 [] + push/filter
  // 粒子：预分配 512（爆发峰值已够，超出自动扩容），复位钩子清字段防残留
  FX.partsPool = Pool.makePool(function () { return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0.55, color: "#fff", size: 3 }; }, null, 512);
  FX.parts = FX.partsPool.buf;                       // ★ 暴露紧凑存活数组（渲染侧零改动）
  // 飘字：预分配 64（同屏飘字远少于粒子）
  FX.floatsPool = Pool.makePool(function () { return { x: 0, y: 0, txt: "", color: "#fff", life: 0 }; }, null, 64);
  FX.floats = FX.floatsPool.buf;
}
fxAttachPools();   // 加载时立即接线（Pool 存在则池化，否则降级）

function spawnBurst(x, y, color, n = 10, radius = 20) {
  n = lqParticleCount(n);   // 低画质：削减爆发粒子数（渲染/更新两段同时下降；关时原样返回 n）
  const pool = FX.partsPool;
  for (let i = 0; i < n; i++) {
    const a = U.rand(0, Math.PI * 2), s = U.rand(40, radius * 4 + 80);
    // ⚠️ 取值顺序必须与旧实现逐位一致（a、s、life、size 的 U.rand 调用次序不可换）
    const vx = Math.cos(a) * s, vy = Math.sin(a) * s, life = U.rand(0.2, 0.55), size = U.rand(2, 5);
    if (pool) {
      const p = pool.obtain();                       // 复用空闲对象（池空自动新建）
      p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.maxLife = 0.55; p.color = color; p.size = size;
    } else {
      FX.parts.push({ x, y, vx, vy, life, maxLife: 0.55, color, size });   // 降级：旧逻辑
    }
  }
}
function spawnFloat(x, y, txt, color) {
  const pool = FX.floatsPool;
  if (pool) {
    const f = pool.obtain();
    f.x = x; f.y = y; f.txt = txt; f.color = color; f.life = 1.1;
  } else {
    FX.floats.push({ x, y, txt, color, life: 1.1 }); // 降级：旧逻辑
  }
}
function updateFX(dt) {
  // 21.14 GC 优化：**稳定就地压缩**（保留存活元素的相对顺序，与旧 `for + filter` 逐位等价）。
  // 为什么不用尾部交换删除？渲染侧按 index 做低画质隔颗抽样（lqShouldDrawParticle(i)），
  // 且绘制顺序可见——交换删除会打乱顺序、改变抽样与叠放，而稳定压缩零新分配且顺序不变。
  const parts = FX.parts, partsPool = FX.partsPool;
  let w = 0;                                   // 写指针：存活元素前移到此
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    if (p.life > 0) { if (w !== i) parts[w] = p; w++; }   // 存活：保留（顺序不变）
    else if (partsPool) partsPool.recycle(p);             // 寿终：归还池（不搬移，仅回收）
  }
  // 裁掉尾部（[w, len) 段全是已回收对象或重复引用）——原地截断，无新数组
  if (w < parts.length) parts.length = w;

  const floats = FX.floats, floatsPool = FX.floatsPool;
  let wf = 0;
  for (let j = 0; j < floats.length; j++) {
    const f = floats[j];
    f.y -= 34 * dt; f.life -= dt;                          // 速度 34*dt 与旧实现逐位一致
    if (f.life > 0) { if (wf !== j) floats[wf] = f; wf++; }
    else if (floatsPool) floatsPool.recycle(f);
  }
  if (wf < floats.length) floats.length = wf;

  if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt);
}

/* ============================================================================
 * 第十七章 17.7 第 3 步：Boss 激光实体 `LaserBeam` + 弹幕吞噬机制
 * ----------------------------------------------------------------------------
 * 本区块**独立追加在文件末尾**（并行开发要求：只在 spawnBoss / Boss update 里
 * 插入单行调用，避免与其它代理的行级冲突）。
 *
 * 激光不进门板弹幕的弹道预算（17.9-2）：子弹走 CFG.boss.bulletBudget / bulletCap，
 * 激光走**独立上限** laserCfg("laserCap", 6) = 6（17.6「独立上限 ≤ 6 束」）。
 *
 * 三段生命周期（17.6「预热（变粗）→ 持续（伤害）→ 收束」）：
 *   warn   ：青线预热（细线，**无伤害**，对应 17.3 颜色语言「青 = 激光」）
 *   active ：粗光柱，按帧结算伤害（线段-圆命中，走 heroTakeDamage 队友受伤入口）
 *   fade   ：收束消散（光柱变淡，**无伤害**）
 *
 * 弹幕吞噬（17.4 原型 6 弹幕吞噬 / 文档 2641 行「LaserBeam 走弹幕吞噬路径」）：
 *   **激活中的激光会吞噬穿过的玩家子弹**（skill 弹 / 普攻残弹均吞，普攻已退役）。
 *   被吞的子弹**不发伤害、直接消亡**（这是 Boss 的反制手段：玩家需「停火等光束过去」）。
 *   ⚠️ 只吞 playerBullets，不吞 enemyBullets（不吞自家弹幕）。 */

// ---- 激光数值（读 CFG.boss.*，缺省回退到硬编码值；数值统一在 js/config.js 调整） ----
function laserCfg(key, dft) {
  const b = (typeof CFG !== "undefined" && CFG.boss) ? CFG.boss : null;
  return (b && b[key] != null) ? b[key] : dft;
}
// 同屏激光束上限（17.6「独立上限 ≤ 6 束」）：直接读 CFG.boss.laserCap

/** 点到**线段**的最短距离（线段-圆命中判定核心，纯几何，可单测）。
 *  返回 (px,py) 到线段 (x0,y0)-(x1,y1) 的最短距离。 */
function pointSegDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) return Math.hypot(px - x0, py - y0);   // 退化为点
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);                          // 投影钳到线段内
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/** 线段-圆命中：线段 (x0,y0)-(x1,y1) 与圆心 (cx,cy) 半径 r 的圆是否相交。
 *  等价判据：点到线段最短距离 < 半径。抽成独立函数便于单测与复用。 */
function segCircleHit(x0, y0, x1, y1, cx, cy, r) {
  return pointSegDist(cx, cy, x0, y0, x1, y1) < r;
}

/** 激光段（线段-圆）命中判定的**纯函数**入口：给定激光参数与目标，返回是否命中。
 *  抽成独立函数：测试无需真正实例化 Boss/World 即可锁定几何正确性。 */
function laserHitsTarget(laser, target) {
  if (!laser || !target) return false;
  const len = laser.len || laserCfg("laserLen", 1600);
  const x1 = laser.x + Math.cos(laser.ang) * len;
  const y1 = laser.y + Math.sin(laser.ang) * len;
  return segCircleHit(laser.x, laser.y, x1, y1, target.x, target.y, target.r);
}

class LaserBeam {
  /** @param w 世界  @param owner 发射者（Boss）
   *  @param x,y 起点  @param ang 朝向（弧度）
   *  @param opts { len, halfW, warn, active, fade, dmg } —— 未给时取本区块局部常量 */
  constructor(w, owner, x, y, ang, opts) {
    opts = opts || {};
    this.w = w; this.owner = owner;
    this.x = x; this.y = y; this.ang = ang;
    this.len = opts.len != null ? opts.len : laserCfg("laserLen", 1600);
    this.halfW = opts.halfW != null ? opts.halfW : laserCfg("laserHalfW", 12);
    this.warnT = opts.warn != null ? opts.warn : laserCfg("laserWarn", 0.9);
    this.activeT = opts.active != null ? opts.active : laserCfg("laserActive", 1.6);
    this.fadeT = opts.fade != null ? opts.fade : laserCfg("laserFade", 0.35);
    this.dmg = opts.dmg != null ? opts.dmg : (owner && owner.atk ? owner.atk * laserCfg("laserDmgMul", 0.5) : 10);
    this.dmgInterval = opts.dmgInterval != null ? opts.dmgInterval : laserCfg("laserDmgInterval", 0.25);
    // 三段状态机：warn → active → fade → dead
    this.phase = "warn";
    this.t = 0;                 // 当前阶段已用时
    this.dmgTimer = 0;          // 本帧累计到下一次伤害结算的时间
    this.dead = false;
    this.world = w;             // 世界归属（与产物池一致，跨世界冻结）
    this.devoured = 0;          // 累计吞噬的玩家子弹数（供测试与统计）
  }
  /** 推进生命周期计时：warn → active → fade → dead。返回本帧是否处于「激活」（造成伤害）阶段。 */
  tick(dt) {
    if (this.dead) return false;
    this.t += dt;
    if (this.phase === "warn") {
      if (this.t >= this.warnT) { this.phase = "active"; this.t = 0; this.dmgTimer = 0; }
    } else if (this.phase === "active") {
      if (this.t >= this.activeT) { this.phase = "fade"; this.t = 0; }
    } else if (this.phase === "fade") {
      if (this.t >= this.fadeT) { this.dead = true; }
    }
    return this.phase === "active";
  }
  /** 光柱末端坐标（渲染 + 命中判定共用）。 */
  endPoint() {
    return { x: this.x + Math.cos(this.ang) * this.len, y: this.y + Math.sin(this.ang) * this.len };
  }
  /** 伤害结算：仅在 active 期、按 dmgInterval 节流，命中所有存活英雄走 heroTakeDamage。 */
  damageTick(w, dt) {
    if (this.phase !== "active") return 0;
    this.dmgTimer += dt;
    if (this.dmgTimer < this.dmgInterval) return 0;
    this.dmgTimer -= this.dmgInterval;
    let hits = 0;
    for (const h of aliveHeroes()) {
      // 线段-圆命中：半径取「英雄碰撞半径」与「光柱半宽」的较大者（光柱本身有宽度）
      if (laserHitsTarget(this, { x: h.x, y: h.y, r: Math.max(h.r, this.halfW) })) {
        heroTakeDamage(w, h, this.dmg);
        hits++;
      }
    }
    return hits;
  }
  /** 弹幕吞噬：激活中的激光吞噬穿过的玩家子弹（不发伤害、直接消亡）。
   *  守卫：仅 active 期吞噬；只吞 playerBullets；命中判据同样是线段-圆。 */
  devourBullets(w) {
    if (this.phase !== "active") return 0;
    let eaten = 0;
    const fxColor = (CFG.boss && CFG.boss.color && CFG.boss.color.laser) || "#4dd6e5";
    for (const b of w.playerBullets) {
      if (b.dead) continue;
      if (laserHitsTarget(this, { x: b.x, y: b.y, r: this.halfW + 6 })) {
        b.dead = true;               // 吞掉：本体消亡，**不结算伤害**
        eaten++;
        /* 吞噬反馈（17.9-③）：接触点出吸收特效。**每帧最多 3 个**——弹幕密集时全弹都出
         * 特效会炸粒子预算，且视觉上糊成一片；3 个足以让玩家看懂「子弹被吃了」。
         * 没有这个反馈，玩家只会觉得「输出凭空变低」，读不懂是激光在吞。 */
        if (eaten <= 3 && typeof spawnBurst === "function") spawnBurst(b.x, b.y, fxColor, 2);
      }
    }
    this.devoured += eaten;
    return eaten;
  }
  update(w, dt) {
    if (this.dead) return;
    this.tick(dt);                  // 生命周期推进
    this.devourBullets(w);          // 弹幕吞噬（仅 active 期）
    this.damageTick(w, dt);         // 伤害结算（仅 active 期，按段）
  }
}

/** 激光释放器（Boss 专属）：生成一束激光并登记到世界容器。
 *  **laserCap 护栏**（17.6「超出时旧激光被替换/回收」）：本世界激光数达上限时，
 *  移除**最早生成**的那束（FIFO），为新束腾位——保证同屏永远 ≤ laserCfg("laserCap", 6)。 */
function spawnLaser(w, owner, x, y, ang, opts) {
  if (!w) return null;
  if (!w.lasers) w.lasers = [];
  while (w.lasers.length >= laserCfg("laserCap", 6)) w.lasers.shift();   // 超出上限：回收最旧的激光
  const lb = new LaserBeam(w, owner, x, y, ang, opts);
  w.lasers.push(lb);
  return lb;
}

/** 世界激光更新入口：推进每束激光 + 清理消亡的。单行调用点见 World.update。 */
function updateLasers(w, dt) {
  if (!w || !w.lasers || !w.lasers.length) return;
  for (const lb of w.lasers) {
    if (lb.world && lb.world !== w) continue;   // 世界归属：跨世界的激光冻结（与产物池一致）
    lb.update(w, dt);
  }
  w.lasers = w.lasers.filter(lb => !lb.dead);
}

/** Boss 激光招式循环（第 3 步新增能力，**默认关闭**）。
 *  ⚠️ 挂载方式：仅当 `m.d.type==="boss"` 且 `m.d.laserSkills` 为非空数组时启用
 *  —— 现有 3 只 Boss 未配 `laserSkills`，故此函数对其为 no-op（行为等价性回归）。
 *  配表口径（待 config 收口）：`CFG.monsters[BSxxxx].laserSkills = ["AT2xx", ...]`
 *  招式复用技能表条目，读其 `laser` 系列字段（arms / spin / laserLen / dmgMul 等），
 *  未填时取本区块局部常量。 */
function bossLaserTick(w, m, dt) {
  const ids = m.d && m.d.laserSkills;
  if (!ids || !ids.length) return;
  if (!w.lasers) w.lasers = [];
  m.laserTimer = (m.laserTimer == null) ? 2.0 : m.laserTimer - dt;   // 开场稍候再放第一束
  if (m.laserTimer > 0) return;
  const id = ids[(m.laserIdx || 0) % ids.length];
  const p = skillEntry(id, m.lv || 1) || {};
  m.laserIdx = (m.laserIdx || 0) + 1;
  // 朝向：瞄准最近目标（同 bossFire）；arms 决定束数，均匀铺开
  const tgt = nearestTarget(w, m.x, m.y);
  m.aimAng = Math.atan2(tgt.y - m.y, tgt.x - m.x);
  const arms = Math.max(1, Math.round(p.arms || 1));
  const spin = p.spin || 0;
  m.laserSpin = (m.laserSpin || 0) + spin;
  const dmg = Math.max(1, Math.round(m.atk * (p.dmgMul != null ? p.dmgMul : laserCfg("laserDmgMul", 0.5))));
  for (let i = 0; i < arms; i++) {
    const ang = m.aimAng + m.laserSpin + i * Math.PI * 2 / arms;
    spawnLaser(w, m, m.x, m.y, ang, {
      len: p.laserLen != null ? p.laserLen : laserCfg("laserLen", 1600),
      dmg: dmg,
      warn: p.laserWarn != null ? p.laserWarn : laserCfg("laserWarn", 0.9),
      active: p.laserActive != null ? p.laserActive : laserCfg("laserActive", 1.6),
      fade: p.laserFade != null ? p.laserFade : laserCfg("laserFade", 0.35),
    });
  }
  m.laserTimer = p.cd != null ? p.cd : (m.d.laserCd || 4.0);
}

/** 激光渲染（预警细线 + 激活粗光柱 + 收束淡出）。单行调用点见 render()。
 *  颜色语言（17.3）：青 = 激光 → CFG.boss.color.laser（缺省回落 #4dd6e5）。 */
function renderLasers(ctx, w) {
  if (!w || !w.lasers) return;
  const cyan = (CFG.boss && CFG.boss.color && CFG.boss.color.laser) || "#4dd6e5";
  for (const lb of w.lasers) {
    if (lb.world && lb.world !== w) continue;
    const e = lb.endPoint();
    ctx.save();
    if (lb.phase === "warn") {
      // 预警：细青线 + 呼吸闪烁（充能感），随预热进度加粗
      const k = lb.warnT > 0 ? Math.min(1, lb.t / lb.warnT) : 1;
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(G.time * 16));
      ctx.strokeStyle = cyan; ctx.lineWidth = 1 + k * 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.setLineDash([]);
    } else if (lb.phase === "active") {
      // 激活：外层辉光 + 内层亮芯（粗光柱，一眼可读）
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = cyan; ctx.lineWidth = lb.halfW * 2.4;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cyan; ctx.lineWidth = lb.halfW * 2;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = lb.halfW * 0.7;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      /* 吞噬标识（17.9-③）：沿光柱**往发射点流动**的箭头 + 源头脉冲环。
       * 「往里吸」的方向感 = 玩家一眼读出「这条光柱在吃我的子弹」；
       * 静止的光柱做不到这一点（17.9 待定 3 的核心痛点）。 */
      const bdx = e.x - lb.x, bdy = e.y - lb.y;
      const blen = Math.hypot(bdx, bdy) || 1;
      const bux = bdx / blen, buy = bdy / blen;            // 发射点 → 端点 的单位向量
      const bpx = -buy, bpy = bux;                          // 垂直方向
      const bstep = 64, boff = (G.time * 150) % bstep;      // 流动速度 150px/s
      ctx.strokeStyle = cyan; ctx.lineWidth = 2;
      for (let d0 = blen - boff; d0 > 14; d0 -= bstep) {
        const cx0 = lb.x + bux * d0, cy0 = lb.y + buy * d0, w0 = 5;
        ctx.beginPath();
        ctx.moveTo(cx0 + bpx * w0, cy0 + bpy * w0);
        ctx.lineTo(cx0 - bux * w0, cy0 - buy * w0);         // 箭头尖指向发射点（被吸进去）
        ctx.lineTo(cx0 - bpx * w0, cy0 - bpy * w0);
        ctx.stroke();
      }
      const pr = Math.max(2, lb.halfW * 1.6 + 4 * Math.sin(G.time * 10));   // 源头「口」脉冲
      ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lb.x, lb.y, pr, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // 收束：由粗变细、整体淡出
      const k = lb.fadeT > 0 ? Math.max(0, 1 - lb.t / lb.fadeT) : 0;
      ctx.globalAlpha = k * 0.8;
      ctx.strokeStyle = cyan; ctx.lineWidth = lb.halfW * 2 * k;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ============================================================================
 * 第十九章 19.12：行为芯片积木（第 5 步）——bounce / burn / split / chain
 * ----------------------------------------------------------------------------
 * 本区块**独立追加在文件末尾**（并行开发要求）：现有函数里只插入**单行调用**，
 * 具体实现全部收在此处，最大限度避免与其他代理的行级冲突。
 *
 * 统一数据契约（19.12.1）：`behavior = { type, value }`
 *   bounce 折射  ：命中后弹射次数 N（复用 Bullet 的 bounce 字段链路）
 *   burn   燃蚀  ：命中后每秒灼烧 N 伤害，持续 3 秒
 *   split  裂变  ：击杀后分裂 N 枚小弹（owner 沿用击杀弹）
 *   chain  链锁  ：命中后向 N 个最近敌人传导伤害（链锁标记防重复链接）
 *
 * 🔴 关键规则：
 *   - 同 type 多枚芯片 → value 取 max（在 chipBehaviorSummary 已收口，此处只消费）
 *   - split 小弹不再触发 split（显式护栏：小弹 behavior 置空）
 *   - chain 不重复链接同一敌人（bullet.chainHit 集合标记）
 *   - 无 behavior 时所有分支短路 → 与接入前完全一致（回归护栏）
 * ⚠️ 注意：`LaserBeam`（17.7）走弹幕吞噬路径，不挂 behavior（不在本规格范围）。
 * ========================================================================== */

const CHIP_BURN_DURATION = 3;       // burn 持续秒数（19.12.1「持续 3 秒」）
const CHIP_SPLIT_DMG_MUL = 0.5;     // split 小弹伤害倍率（⚠️ 规格未定，拍板 0.5：小弹弱于本体）
const CHIP_SPLIT_SPD_MUL = 0.8;     // split 小弹速度倍率（⚠️ 规格未定，拍板 0.8）
const CHIP_SPLIT_LIFE = 1.2;        // split 小弹存活秒数（⚠️ 规格未定，拍板 1.2s，短命便于收束）
const CHIP_CHAIN_DMG_MUL = 1;       // chain 传导伤害倍率（= 命中弹伤害 × 此倍率）

/** 命中后行为分发（单行调用点 = Bullet 玩家弹命中逻辑）。
 *  - burn  ：给被命中怪挂灼烧
 *  - chain ：向最近 N 个敌人传导
 *  - bounce：由 Bullet 构造时注入的 bounce 字段链路处理（此处不重复处理）
 *  - split ：由击杀分支（onMonsterKilled）处理 */
function applyBulletHitBehavior(w, bullet, m) {
  const bh = bullet.behavior;
  if (!bh) return;                              // 无行为芯片：短路，等价于接入前
  if (bh.type === "burn") applyBurnToMonster(m, bh.value);
  else if (bh.type === "chain") applyChainFromHit(w, bullet, m, bh.value);
}

/** 给怪物挂 / 刷新灼烧。同源多段命中取**更高的 dps** 并刷新持续（不叠乘、不叠层）。 */
function applyBurnToMonster(m, dps) {
  if (!(dps > 0)) return;
  const cur = m.burn;
  if (cur) { cur.dps = Math.max(cur.dps, dps); cur.remain = CHIP_BURN_DURATION; }
  else m.burn = { dps: dps, remain: CHIP_BURN_DURATION };
}

/** 单帧灼烧结算（单行调用点 = Monster.update 顶部）。
 *  直接扣 hp（不走 damageMonster：灼烧不吃防御、不触发护盾/链锁/分裂，避免递归）。
 *  致死时补走 onMonsterKilled（无 killer → 不触发 split），保证掉落/计数照常。
 *  返回 true = 本次灼烧致死（调用方应跳过本帧其余 AI）。 */
function monsterBurnTick(m, w, dt) {
  if (!m.burn) return false;
  m.burn.remain -= dt;
  m.hp -= m.burn.dps * dt;
  m.flashT = Math.max(m.flashT || 0, 0.05);      // 火色反馈
  if (m.burn.remain <= 0) m.burn = null;
  if (m.hp <= 0 && !m.dead) {
    m.dead = true;
    onMonsterKilled(w, m);                       // 灼烧致死：无击杀弹 → 不分裂
    return true;
  }
  return m.dead;
}

/** 链锁传导（单行调用点 = applyBulletHitBehavior）。
 *  向「已链集合外」的最近 N 个敌人各结算一次伤害；链锁标记写在**弹丸**上，
 *  保证同一弹丸不会重复链接同一敌人（防无限链 / 防重复扣血）。 */
function applyChainFromHit(w, bullet, src, n) {
  if (!(n > 0)) return;
  if (!bullet.chainHit) bullet.chainHit = new Set();
  bullet.chainHit.add(src);                      // 源目标入链锁集合（不再被本弹重复链接）
  let linked = 0;
  for (let i = 0; i < n; i++) {
    let best = null, bd = Infinity;
    for (const m of w.monsters) {
      if (m.dead || bullet.chainHit.has(m)) continue;   // 已链过的跳过（链锁标记）
      const d = U.dist(src.x, src.y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) break;
    bullet.chainHit.add(best);
    damageMonster(w, best, Math.max(1, Math.round(bullet.dmg * CHIP_CHAIN_DMG_MUL)), bullet);   // 21.20 传 bullet → 伤害归属链锁英雄
    spawnChainFx(src.x, src.y, best.x, best.y);  // 瞬结（线段）表现
    linked++;
  }
  return linked;
}

/** 链锁瞬结的特效段（渲染用，短命淡出）。 */
const CHIP_CHAIN_FX = [];
function spawnChainFx(x0, y0, x1, y1) {
  CHIP_CHAIN_FX.push({ x0, y0, x1, y1, life: 0.18 });
}
function updateChainFx(dt) {
  for (let i = CHIP_CHAIN_FX.length - 1; i >= 0; i--) {
    CHIP_CHAIN_FX[i].life -= dt;
    if (CHIP_CHAIN_FX[i].life <= 0) CHIP_CHAIN_FX.splice(i, 1);
  }
}
function renderChainFx(ctx) {
  if (!CHIP_CHAIN_FX.length) return;
  for (const fx of CHIP_CHAIN_FX) {
    const a = Math.max(0, fx.life / 0.18);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#9ee0ff"; ctx.lineWidth = 2 + a * 2;
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
    ctx.restore();
  }
}

/** 裂变：击杀弹带 split 行为时，在死亡位置生成 value 枚小弹（单行调用点 = onMonsterKilled）。
 *  🔴 小弹 behavior 置空 → 不再触发 split（显式护栏，防无限分裂）。
 *  owner 沿用击杀弹；伤害/速度/存活按本区块常量继承「部分属性」。 */
function spawnSplitBullets(w, m, killer) {
  const bh = killer && killer.behavior;
  if (!bh || bh.type !== "split" || !(bh.value > 0)) return 0;
  const n = bh.value;
  const base = Math.max(1, Math.round(killer.dmg * CHIP_SPLIT_DMG_MUL));
  const spd = Math.hypot(killer.vx, killer.vy) * CHIP_SPLIT_SPD_MUL || 260;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + U.rand(-0.2, 0.2);
    const child = new Bullet(m.x, m.y, a, spd, base, "player",
      killer.pierce || 0, 0, 0, true, killer.owner || G.player, null);
    child.isSplitChild = true;                   // 标记（护栏：不再分裂）
    child.life = CHIP_SPLIT_LIFE;
    w.playerBullets.push(child);
  }
  return n;
}

/** 燃蚀渲染：火色描边 + 余烬（单行调用点 = 怪物渲染循环）。 */
function renderBurnAura(ctx, m) {
  if (!m.burn) return;
  const a = 0.45 + 0.35 * Math.abs(Math.sin(G.time * 14));
  ctx.save();
  ctx.strokeStyle = `rgba(255,140,40,${a})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 4, 0, Math.PI * 2);
  if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.strokeStyle = `rgba(255,140,40,${a})`; ctx.lineWidth = 3; ctx.stroke(); }   // 低画质：跳过火色描边（保留填充指示燃烧状态）
  ctx.fillStyle = `rgba(255,90,20,${a * 0.15})`; ctx.fill();
  ctx.restore();
}




/* ============================================================
 * 21.17 深渊局内升级：击杀掉落经验宝石（末尾独立区块）
 * ============================================================
 * 【问题】onMonsterKilled 的掉落分支只覆盖 `w.isMain`（主线）与 `w.kind === "rift"`
 *   （裂缝），深渊世界 `w.kind === "endless"` 两个分支都不进 → **深渊击杀零经验**，
 *   局内升级系统（gainExp → 4 选 1）在深渊里根本触发不了。
 *   而 21.17 的数值曲线把每波只数推到 300、81 波后全精英/BOSS（精英综合强度 ≈ 小怪 3 倍），
 *   玩家若不成长必然速死（真机实测：进图 7~9 秒阵亡）。
 *
 * 【方案】复用主线**同一套**经验链路，不新增经验语义：
 *   深渊击杀 → spawnPickup(..., "exp", ...) 掉经验宝石 → 玩家走近自动拾取
 *   → World.update 的拾取分支调 gainExp() → 升级 → beginLevelUpChoices 弹 4 选 1。
 *   拾取处理（js/game.js 的 pickups 循环）本就与 world.kind 无关，故**只需补掉落**，
 *   升级/弹窗/暂停/属性成长全部自动生效——零改动主线。
 *
 * 【数值】经验量对齐主线口径（m.d.exp），并受 CFG.endless.expMul 缩放：
 *   深渊怪密度远高于主线（每波最多 300 只），若照搬主线 exp 会导致升级过快；
 *   同理精英/BOSS 单只给更多经验（对齐主线 Boss 分裂 5 枚的观感）。
 *   所有系数进 CFG.endless，便于后续策划调参（用户明确说过「后续策划会优化生怪参数」）。
 *
 * 【为什么宝石数按 type 分档】主线用 Boss 5 枚 / 小怪 1 枚控制"掉落手感"，
 *   深渊沿用同一分档逻辑，避免 300 只怪一次性铺满 300 个拾取物（对象数爆炸）。
 * ============================================================ */

/** 深渊击杀掉落：经验宝石 + 金币（单行调用点 = onMonsterKilled 的无尽分支）。
 *  21.19 补金币：原实现深渊只掉经验（主线掉落分支只覆盖 isMain/rift），
 *  用户口径「深渊需要掉落金币」→ 与经验同分档同链路（spawnPickup "coin"），
 *  拾取入 G.run.coin（结算照常折算），倍率读 CFG.endless.coinMul。
 *  非深渊世界立即返回（零副作用）。返回实际掉落枚数（供测试断言）。 */
function dropEndlessExp(w, m) {
  if (!w || w.kind !== "endless") return 0;
  const r = (typeof G !== "undefined" && G) ? G.run : null;
  if (!r) return 0;
  const c = (typeof CFG !== "undefined" && CFG.endless) ? CFG.endless : null;
  const mul = (c && typeof c.expMul === "number") ? c.expMul : 1;
  const base = Math.max(1, Math.round(((m.d && m.d.exp) || 1) * mul));
  /* 枚数分档：Boss 5 枚、精英 3 枚、小怪 1 枚（对齐主线 Boss 5 枚的手感，
   * 同时限制同屏拾取物数量——300 只小怪 = 300 枚 vs 高波 300 只 Boss = 1500 枚上限，
   * 后者由「每波 BOSS 唯一实例上限」与拾取物 30 秒 life 自然衰减共同约束）。 */
  const isBoss = m.d && m.d.type === "boss";
  const n = isBoss ? 5 : (m.isElite ? 3 : 1);
  const per = Math.max(1, Math.round(base / n));
  for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "exp", per);
  r.endlessExpDrops = (r.endlessExpDrops || 0) + n;   // 统计字段（HUD/测试可读）
  /* 21.19 金币掉落：与经验同分档（Boss 5 / 精英 3 / 小怪 1），单枚 = round(m.d.coin × coinMul / n)；
   * 与主线 coin 掉落同链路（spawnPickup "coin" → 拾取入 G.run.coin），零新语义。 */
  const coinMul = (c && typeof c.coinMul === "number") ? c.coinMul : 1;
  const coinBase = Math.max(1, Math.round(((m.d && m.d.coin) || 1) * coinMul));
  const coinPer = Math.max(1, Math.round(coinBase / n));
  for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "coin", coinPer);
  r.endlessCoinDrops = (r.endlessCoinDrops || 0) + n; // 统计字段（HUD/测试可读）
  return n;
}
