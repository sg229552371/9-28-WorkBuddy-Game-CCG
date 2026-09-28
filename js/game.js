/* ============================================================
 * game.js — 实体 / 世界 / 战斗 / 背包 / 祭坛 / 撤离 / 死亡惩罚
 * 架构：逻辑与渲染分离，数据驱动，便于迁移 Godot
 * ============================================================ */
"use strict";

/* ============ 全局游戏状态 ============ */
const G = {
  canvas: null, ctx: null, W: 1920, H: 1080,
  state: "boot",          // boot | menu | charSel | playing | settled | dead
  levelCfg: null, heroDef: null,
  run: null,              // 本局数据
  mainWorld: null, subWorld: null, activeWorld: null,
  inArtisan: false,
  keys: {}, mouse: { x: 0, y: 0 },
  time: 0,
  sprites: {},            // 处理后的精灵图
};

/* ============ 背包 / 网格仓储 ============ */
let UID = 1;
class Inventory {
  constructor(cols, rows, id) {
    this.cols = cols; this.rows = rows; this.id = id;
    this.cells = Array.from({ length: cols * rows }, () => null);
    this.items = [];
  }
  inBounds(x, y, w, h) { return x >= 0 && y >= 0 && x + w <= this.cols && y + h <= this.rows; }
  occupied(x, y, w, h, ignore) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const c = this.cells[j * this.cols + i];
      if (c && c !== ignore) return c;
    }
    return null;
  }
  canPlace(item, x, y, ignore) {
    const [w, h] = item.shape;
    return this.inBounds(x, y, w, h) && !this.occupied(x, y, w, h, ignore);
  }
  place(item, x, y) {
    if (!this.canPlace(item, x, y)) return false;
    const [w, h] = item.shape;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.cells[j * this.cols + i] = item;
    item.inv = this.id; item.x = x; item.y = y;
    this.items.push(item);
    return true;
  }
  remove(item) {
    const [w, h] = item.shape;
    for (let j = item.y; j < item.y + h; j++) for (let i = item.x; i < item.x + w; i++) {
      if (this.cells[j * this.cols + i] === item) this.cells[j * this.cols + i] = null;
    }
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    item.inv = null;
  }
  // 尝试放入任意空位（整理用）
  findSpot(item) {
    for (let y = 0; y <= this.rows - item.shape[1]; y++)
      for (let x = 0; x <= this.cols - item.shape[0]; x++)
        if (this.canPlace(item, x, y)) return { x, y };
    return null;
  }
  // 同品质宝箱叠加（6.3）
  tryStackChest(item) {
    if (item.kind !== "chest") return false;
    const q = CFG.chestQualities[item.chestQ];
    for (const it of this.items) {
      if (it.kind === "chest" && it.chestQ === item.chestQ && it.count < q.stackMax) {
        it.count++; it.value = q.value * it.count; return true;   // 价值同步累加
      }
    }
    return false;
  }
  totalWeight() {
    let s = 0;
    for (const it of this.items) s += (it.kind === "chest" ? CFG.chestQualities[it.chestQ].weight * it.count : it.weight);
    return s;
  }
}

/* ============ 物品构造 ============ */
function makeGear(defId, itemQ) {
  const d = CFG.gearDefs.find(g => g.id === defId);
  const q = CFG.itemQualities[itemQ];
  const stats = {}; const mul = 1 + (q.valueMul - 1) * 0.6;
  for (const k in d.stats) stats[k] = Math.round(d.stats[k] * mul);
  return { uid: UID++, kind: "gear", defId, itemQ, name: d.name, shape: d.shape.slice(),
    weight: d.weight, value: Math.round(30 * q.valueMul), stats };
}
function makeModule(defId, itemQ) {
  const d = CFG.moduleDefs.find(m => m.id === defId);
  const q = CFG.itemQualities[itemQ];
  const affix = { tag: d.affix.tag, mode: d.affix.mode, value: d.affix.vals[itemQ] };
  return { uid: UID++, kind: "module", defId, itemQ, name: d.name, shape: d.shape.slice(),
    weight: d.weight, value: Math.round(45 * q.valueMul), affix, lv: 1 };   // lv：模组等级（叠加升级 1~9）
}
/* 模组等级系统：主词缀有效值 = 基础值 × (1 + (lv-1) × valueStep)；阶段 = ceil(lv / perStage) */
function moduleEffValue(it) {
  const ml = CFG.moduleLevel;
  return it.affix.value * (1 + ((it.lv || 1) - 1) * (ml ? ml.valueStep : 0));
}
function moduleStage(it) {
  const ml = CFG.moduleLevel;
  return Math.min(3, Math.ceil((it.lv || 1) / (ml ? ml.perStage : 3)));
}
function makeChestItem(chestQ, count = 1) {
  const c = CFG.chestQualities[chestQ];
  return { uid: UID++, kind: "chest", chestQ, name: c.name, shape: [1, 1],
    weight: c.weight, value: c.value * count, count };
}
/* ---------- 保险契约（方案 A：背包道具） ----------
 * 占 1 格、有重量、可叠加；死亡时每份保护 1 件价值最高的物品；
 * 撤离成功时剩余契约折算进化结晶；契约本身不参与死亡损失。 */
function makeInsurance(count = 1) {
  return { uid: UID++, kind: "insurance", itemQ: 1, name: CFG.insurance.name, shape: [1, 1],
    weight: CFG.insurance.weight, value: CFG.insurance.value * count, count };
}
function insuranceCount(run) {
  return run.backpack.items.filter(it => it.kind === "insurance").reduce((s, it) => s + it.count, 0);
}
function consumeInsurance(run, n) {
  let left = n;
  for (const it of run.backpack.items.slice()) {
    if (it.kind !== "insurance" || left <= 0) continue;
    const take = Math.min(left, it.count);
    it.count -= take; left -= take;
    it.value = CFG.insurance.value * it.count;
    if (it.count <= 0) run.backpack.remove(it);
  }
  return n - left;
}
/* ---------- 诅咒道具（待细化 36：给敌人附加技能的道具） ----------
 * 使用后向局内敌人动态附加属性修改器（防御/生命/攻击/移速），持续 duration 秒；
 * 风险回报：期间金币与经验掉落 ×rewardMul。仅限主地图战斗中使用（9.1.1 例外项）。 */
function makeCurse() {
  return { uid: UID++, kind: "curse", itemQ: 2, name: "诅咒道具", shape: [1, 1],
    weight: CFG.curseItems.weight, value: CFG.curseItems.value };
}
function useCurseItem(it) {
  const r = G.run;
  if (!r || G.state !== "playing") return false;
  if (G.inArtisan || G.inRift) { UI.toast("诅咒道具只能在主地图战斗中使用", "bad"); return false; }
  if (r.curse) { UI.toast("已有诅咒生效中", "bad"); return false; }
  const def = U.pick(CFG.curseItems.list);
  r.curse = { ...def, remain: CFG.curseItems.duration };
  const inv = it.inv === "backpack" ? r.backpack : r.weaponInv;
  inv.remove(it);
  UI.toast(`☠ ${def.name}生效：${def.desc}（${CFG.curseItems.duration}s · 掉落 ×${def.rewardMul}）`, "bad");
  SFX.play("altar");
  return true;
}
/* 诅咒的生效点：怪物生成（hp/atk/spd 乘算）、受伤判定（def 乘算）、掉落（rewardMul） */
function affixText(it) {
  if (!it.affix) return "";
  const v = it.kind === "module" ? moduleEffValue(it) : it.affix.value;   // 模组按等级缩放后的有效值
  if (it.affix.mode === "flat") return `${it.affix.tag} +${Math.round(v * 100) / 100}`;
  return `${it.affix.tag} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
}

/* ============ 运行局数据 ============ */
function createRun(heroDef) {
  return {
    heroDef,
    hp: heroDef.hp, hpMax: heroDef.hp,
    energy: heroDef.energyMax, energyMax: heroDef.energyMax,
    lv: 1, exp: 0, expNext: 14, coin: 0, kills: 0,
    backpack: new Inventory(CFG.backpack.cols, CFG.backpack.rows, "backpack"),
    weaponInv: new Inventory(CFG.weaponGrid.cols, CFG.weaponGrid.rows, "weapon"),
    buffs: [],                      // 战争雕像增益 {id, stat, mul, remain, label}
    pendingItems: [],               // 工匠开箱待分配区（未拖入背包前存放，放弃即作废）
    monsterDebuff: null,            // 邪神雕像 {hpMul, atkMul, remain}
    curse: null,                    // 诅咒道具（待细化36）{defMul,hpMul,atkMul,spdMul,rewardMul,remain}
    monsterHpMul: 1, monsterAtkMul: 1,
    lifesteal: 0,
    cardAssets: 0,                  // 属性卡牌资产（升级 +1，仅工匠世界可使用，8.3）
    cardRefresh: CFG.cardPool.refreshPerRun,   // 本局剩余刷新次数
    cardCandidates: null,           // 当前候选卡牌（进入工匠世界时抽取）
    appliedCards: [],               // 已使用卡牌 {attr, q, value}，退出局内随 run 清除
    artisanSpawned: false, artisanUsed: false,
    bossSpawned: false, bossDefeated: false,
    runTime: 0,
    stats: {                        // 本局统计（数值收敛用）
      dmgDealt: 0, dmgTaken: 0,
      chestsOpened: 0, altarsUsed: 0,
      timeToBoss: 0, bossFightTime: 0,
    },
    // 多角色组队（CFG.team.maxSize=3）：队长由玩家操控，其余为 AI 队友
    companions: (G.team || []).slice(1).map((hd) => ({
      heroDef: hd, id: hd.id, name: hd.name,
      hp: hd.hp, hpMax: hd.hp, r: hd.radius,
      x: 0, y: 0, fireTimer: 0, alive: true, faceDir: 1,
    })),
    drones: [],       // 召唤物（无人机）：跟随队长、自动攻击、可被敌人击毁
    traps: [],        // 陷阱（大地雷）：不受敌人攻击，敌人入圈延迟引爆
    weapon: computeWeaponDefaults(),
  };
}
function computeWeaponDefaults() {
  const sk = CFG.weapons[(G.heroDef && G.heroDef.weapon) || "W001"].skills;
  return { basic: { ...CFG.skills[sk.basic] }, skill: { ...CFG.skills[sk.skill] } };   // 每帧由词条重算副本
}

/* ---------- 局外元进度（localStorage 持久化：结晶 / 各角色局外等级 / 关卡解锁） ---------- */
const SAVE_KEY = "bagrogue_save_v1";
const Meta = {
  data: { crystals: 0, heroes: {}, unlockedLevels: 1 },
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* 无 localStorage（测试环境）则用默认值 */ }
    // 迁移：旧的"结晶技能升级"并入武器等级（技能等级 = 武器等级，金币升级）
    for (const id in this.data.heroes) {
      const rec = this.data.heroes[id];
      if (rec.skillLevel && !rec.weaponLv) rec.weaponLv = rec.skillLevel;
    }
  },
  commit() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { } },
  heroLevel(id) { return (this.data.heroes[id] && this.data.heroes[id].level) || 1; },
  levelUpCost(id) { return CFG.outLevel.costBase + (this.heroLevel(id) - 1) * CFG.outLevel.costStep; },
  levelUp(id) {
    const lv = this.heroLevel(id);
    if (lv >= CFG.outLevel.maxLevel) return false;
    const cost = this.levelUpCost(id);
    if (this.data.crystals < cost) return false;
    this.data.crystals -= cost;
    const rec = this.data.heroes[id] || {};
    this.data.heroes[id] = { ...rec, level: lv + 1 };
    this.commit();
    return true;
  },
  // 技能局外等级（永久生效，每角色独立）
  skillLevel(id) { return (this.data.heroes[id] && this.data.heroes[id].skillLevel) || 1; },
  skillUpCost(id) { return CFG.skills2.costBase + (this.skillLevel(id) - 1) * CFG.skills2.costStep; },
  skillUp(id) {
    const lv = this.skillLevel(id);
    if (lv >= CFG.skills2.maxSkillLv) return false;
    const cost = this.skillUpCost(id);
    if (this.data.crystals < cost) return false;
    this.data.crystals -= cost;
    const rec = this.data.heroes[id] || {};
    this.data.heroes[id] = { ...rec, skillLevel: lv + 1 };
    this.commit();
    return true;
  },
  // 武器等级（永久资产，按英雄存档；工匠世界花金币升级；技能等级与其同步）
  weaponLv(id) { return (this.data.heroes[id] && this.data.heroes[id].weaponLv) || 1; },
  weaponUpCost(id) {
    const lv = Math.min(this.weaponLv(id), CFG.weaponLevel.maxLv - 1);
    return CFG.weaponLevels[lv].cost;
  },
  weaponUp(id) {
    const lv = this.weaponLv(id);
    if (lv >= CFG.weaponLevel.maxLv) return false;
    const rec = this.data.heroes[id] || {};
    this.data.heroes[id] = { ...rec, weaponLv: lv + 1 };
    this.commit();
    return true;
  },
  // 结算发结晶：撤离全额，死亡按 deathRatio 折算
  awardRun(kills, bossDefeated, extracted) {
    let v = kills * CFG.outLevel.crystalKill + (bossDefeated ? CFG.outLevel.crystalBoss : 0);
    if (!extracted) v = Math.floor(v * CFG.outLevel.deathRatio);
    this.data.crystals += v;
    this.commit();
    return v;
  },
};
Meta.load();

// 局外等级 → 英雄实际出战属性（副本，不污染 CFG）
function applyOutLevel(def) {
  const lv = Meta.heroLevel(def.id);
  const g = CFG.outLevel.growth, n = lv - 1;
  return { ...def, outLevel: lv, weaponLv: Meta.weaponLv(def.id), outSkillLv: Meta.weaponLv(def.id),
    hp: def.hp + g.hp * n, atk: def.atk + g.atk * n, def: def.def + g.def * n };
}

/* ---------- 武器词条计算（16.5：先加算后乘算） ----------
 * forSkill=true 时额外计入模组阶段词缀（阶段词缀只强化主动技能，不影响普攻基础值） */
function tagCalc(tag, forSkill) {
  const t = CFG.affixTags[tag];
  let flat = 0, mul = 1;
  const ml = CFG.moduleLevel;
  for (const it of G.run.weaponInv.items) {
    if (it.kind === "module" && it.affix && it.affix.tag === tag) {
      const eff = moduleEffValue(it);   // 主词缀随模组等级成长
      if (it.affix.mode === "flat") flat += eff;
      else mul *= (1 + eff);
      // 阶段词缀（LV4~6 解锁第1条、LV7~9 第2条、LV9 满 3 条按 perStage 推进）
      if (forSkill && ml && ml.stageAffixes) {
        const stage = moduleStage(it);
        for (let i = 0; i < stage; i++) {
          const sa = ml.stageAffixes[i];
          if (sa && sa.tag === tag) {
            if (sa.mode === "flat") flat += sa.value;
            else mul *= (1 + sa.value);
          }
        }
      }
    }
  }
  // 卡牌对武器词条的加成（弹道数量卡）
  if (tag === "弹道数量" && G.run.appliedCards)
    flat += G.run.appliedCards.filter(c => c.attr === "bullets").reduce((s, c) => s + c.value, 0);
  let v = (t.base + flat) * mul;
  v = U.clamp(v, t.min, t.max);
  if (t.round === "floor") v = Math.floor(v);
  return v;
}
/* ---------- 模组深度（16.7）：连接效果 + 套装效果（仅统计武器栏内模组） ----------
 * 连接：边相邻（共享棱）且同品质的模组，每对提供 linkBonus 技能伤害（几何摆放的构建收益）；
 * 套装：同系列模组在武器栏内集齐 N 件触发词缀强化（CFG.moduleSets，策划改表即调）。 */
function moduleSynergy() {
  const mods = G.run.weaponInv.items.filter(it => it.kind === "module");
  const out = { dmgMul: 1, cdMul: 1, bullets: 0, links: 0, sets: [] };
  const ml = CFG.moduleLevel;
  for (let i = 0; i < mods.length; i++) for (let j = i + 1; j < mods.length; j++) {
    const a = mods[i], b = mods[j];
    if (a.itemQ !== b.itemQ) continue;                      // 连接要求同品质
    const ax2 = a.x + a.shape[0], ay2 = a.y + a.shape[1];
    const bx2 = b.x + b.shape[0], by2 = b.y + b.shape[1];
    const overlapX = a.x < bx2 && b.x < ax2, overlapY = a.y < by2 && b.y < ay2;
    const touchX = (Math.abs(ax2 - b.x) < 0.5 || Math.abs(bx2 - a.x) < 0.5) && overlapY;
    const touchY = (Math.abs(ay2 - b.y) < 0.5 || Math.abs(by2 - a.y) < 0.5) && overlapX;
    if (touchX || touchY) out.links++;
  }
  out.dmgMul *= 1 + out.links * (ml ? (ml.linkBonus || 0) : 0);
  for (const sid in CFG.moduleSets) {
    const set = CFG.moduleSets[sid];
    const n = mods.filter(m => set.members.includes(m.defId)).length;
    for (const need in set.bonuses) {
      if (n < Number(need)) continue;
      const bo = set.bonuses[need];
      if (bo.tag === "伤害") out.dmgMul *= 1 + bo.value;
      else if (bo.tag === "冷却") out.cdMul *= 1 + bo.value;
      else if (bo.tag === "弹道数量") out.bullets += bo.value;
      out.sets.push(`${set.name}×${n}（${bo.tag} ${bo.value > 0 ? "+" : ""}${Math.round(bo.value * 100)}%）`);
    }
  }
  return out;
}
function recomputeWeapon() {
  const w = G.run.weapon;
  const sk = CFG.weapons[G.heroDef.weapon].skills;
  const b = CFG.skills[sk.basic], s = CFG.skills[sk.skill];
  // 模组深度（16.7）：连接（相邻同品质）+ 套装 → 技能向加成（普攻吃伤害/冷却/弹道部分）
  const syn = moduleSynergy();
  G.run.moduleSyn = syn;   // 缓存给 UI 展示（连接/套装一览；召唤/陷阱分支提前 return 也能拿到）
  // 词条按「武器基础值 + 词条增量」叠加：先加算后乘算（16.5）
  const wl = CFG.weaponLevels[Math.min((G.heroDef.weaponLv || 1), CFG.weaponLevel.maxLv) - 1];
  w.basic = { ...b, dmgMul: b.dmgMul * wl.basicMul * syn.dmgMul,
    bullets: b.bullets + tagCalc("弹道数量") + syn.bullets - CFG.affixTags["弹道数量"].base,
    cd: b.cd * tagCalc("冷却") * syn.cdMul, bulletSpd: b.bulletSpd * tagCalc("弹速"),
    pierce: b.pierce + tagCalc("穿透") - CFG.affixTags["穿透"].base,
    bounce: b.bounce + tagCalc("弹射次数") - CFG.affixTags["弹射次数"].base };
  // 武器等级 ↔ 技能等级同步（8.2）：技能效果按武器等级走手写表 skillMul；
  // 有 lv 表的技能（召唤/陷阱）按等级索引属性行；技能标签匹配词条（16.5）
  const skLv = G.heroDef.weaponLv || 1;   // 召唤/陷阱 lv 表内再用 Math.min 按数组长度截断
  const st_ = s.tags || [];
  const has = (t) => st_.includes(t);
  if (s.type === "summon" || s.type === "trap") {
    // 召唤物 / 陷阱技能：属性行由技能 lv 表决定（数据驱动，改表即调平衡）
    const row = {};
    for (const k in (s.lv || {})) {
      const arr = s.lv[k];
      row[k] = arr[Math.min(skLv, arr.length) - 1];
    }
    w.skill = { ...s, row,
      dmgMul: (row.dmgMul || 1) * (has("伤害") ? tagCalc("伤害", true) : 1)
        * (has("召唤物") ? tagCalc("召唤物", true) : 1) * (has("陷阱") ? tagCalc("陷阱", true) : 1)
        * syn.dmgMul,
      cd: s.cd * (has("冷却") ? tagCalc("冷却", true) : 1) * syn.cdMul,
      radius: (row.radius || s.radius || 100) * (has("范围") ? tagCalc("范围", true) : 1),
      count: row.count || 1, armDelay: s.armDelay || 0.5,
      summonMul: (has("召唤物") ? tagCalc("召唤物", true) : 1) * (has("伤害") ? tagCalc("伤害", true) : 1),
      trapMul: (has("陷阱") ? tagCalc("陷阱", true) : 1) * (has("伤害") ? tagCalc("伤害", true) : 1),
    };
    return;
  }
  w.skill = { ...s,
    dmgMul: s.dmgMul * wl.skillMul * (has("伤害") ? tagCalc("伤害") : 1) * syn.dmgMul,
    cd: s.cd * (has("冷却") ? tagCalc("冷却") : 1) * syn.cdMul,
    radius: s.radius * (has("范围") ? tagCalc("范围") : 1),
    bullets: (s.bullets || 1) + (has("弹道数量") ? tagCalc("弹道数量") + syn.bullets - CFG.affixTags["弹道数量"].base : 0),
    bulletSpd: (s.bulletSpd || 480) * (has("弹速") ? tagCalc("弹速") : 1),
    pierce: (s.pierce || 0) + (has("穿透") ? tagCalc("穿透") - CFG.affixTags["穿透"].base : 0),
  };
}

/* ---------- 玩家属性（武器栏装备 + Buff + 等级） ---------- */
function computeStats() {
  const r = G.run, h = r.heroDef;
  const st = {
    hpMax: h.hp + 8 * (r.lv - 1), atk: h.atk + 2 * (r.lv - 1), def: h.def,
    spd: h.spd, energyMax: h.energyMax, regen: h.energyRegen, lifesteal: 0,
    spdMul: 1, cdMul: 1,
  };
  for (const it of r.weaponInv.items) {
    if (it.kind === "gear" && it.stats) {
      if (it.stats.hp) st.hpMax += it.stats.hp;
      if (it.stats.atk) st.atk += it.stats.atk;
      if (it.stats.def) st.def += it.stats.def;
      if (it.stats.spd) st.spd += it.stats.spd;
      if (it.stats.energyMax) st.energyMax += it.stats.energyMax;
      if (it.stats.regen) st.regen += it.stats.regen;
    }
  }
  for (const b of r.buffs) {
    if (b.stat === "atk") st.atk *= b.mul;
    else if (b.stat === "spd") st.spdMul *= b.mul;
    else if (b.stat === "cdMul") st.cdMul *= b.mul;
    else if (b.stat === "lifesteal") st.lifesteal += b.mul;
  }
  // 属性卡牌加成（13.7 属性修改器体系：随本局，退出失效）
  for (const c of r.appliedCards) {
    if (c.attr === "cd") st.cdMul *= c.value;
    else if (c.attr === "lifesteal") st.lifesteal += c.value;
    else if (c.attr === "bullets") { /* 弹道数量在 recomputeWeapon 中生效 */ }
    else if (c.attr === "hp") st.hpMax += c.value;
    else if (c.attr === "atk") st.atk += c.value;
    else if (c.attr === "def") st.def += c.value;
    else if (c.attr === "spd") st.spd += c.value;
    else if (c.attr === "regen") st.regen += c.value;
    else if (c.attr === "energyMax") st.energyMax += c.value;
  }
  st.atk = Math.round(st.atk);
  return st;
}

/* ---------- 负重惩罚（9.2 线性递减） ---------- */
function weightFactor() {
  const w = G.run.backpack.totalWeight() + G.run.weaponInv.totalWeight();
  const c = CFG.weight;
  if (w <= c.threshold) return { w, f: 1, over: false };
  const f = Math.max(c.minFactor, 1 - c.slope * (w - c.threshold) / c.divisor);
  return { w, f, over: true };
}

/* ============ 实体 ============ */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = G.heroDef.radius;
    this.fireTimer = 0; this.skillTimer = 0;
    this.faceDir = 1;
    this.mvx = 0; this.mvy = 0;   // 当前移动方向（0=静止；撤离读条的移动打断依赖此值）
  }
  update(w, dt) {
    const st = computeStats();
    // 同步等级 / 装备带来的上限与吸血（hpMax 随等级成长）
    G.run.hpMax = st.hpMax; G.run.energyMax = st.energyMax; G.run.lifesteal = st.lifesteal;
    // 移动
    let dx = (G.keys["d"] || G.keys["arrowright"] ? 1 : 0) - (G.keys["a"] || G.keys["arrowleft"] ? 1 : 0);
    let dy = (G.keys["s"] || G.keys["arrowdown"] ? 1 : 0) - (G.keys["w"] || G.keys["arrowup"] ? 1 : 0);
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      if (dx !== 0) this.faceDir = dx > 0 ? 1 : -1;
      this.mvx = dx; this.mvy = dy;   // 记录移动方向，队友据此排到身后
      const wf = weightFactor();
      const spd = st.spd * st.spdMul * wf.f;
      this.x = U.clamp(this.x + dx * spd * dt, this.r, w.w - this.r);
      this.y = U.clamp(this.y + dy * spd * dt, this.r, w.h - this.r);
      resolveObstacles(this, w);
    } else { this.mvx = 0; this.mvy = 0; }   // 停止移动即清零（撤离读条的移动打断判定用）
    // 能量恢复
    G.run.energy = Math.min(G.run.energyMax, G.run.energy + st.regen * dt);
    // 自动攻击：锁定屏幕内最近敌人
    this.fireTimer -= dt; this.skillTimer -= dt;
    const target = nearestMonster(w, this.x, this.y);
    if (target) {
      if (this.fireTimer <= 0) { this.fireBasic(w, target, st); this.fireTimer = G.run.weapon.basic.cd * st.cdMul; }
      // 主动技能自动施法：能量够 + 冷却好 + 场上有目标即释放（Space 保留手动触发）
      if (this.skillTimer <= 0 && G.run.energy >= G.run.weapon.skill.energy &&
          (CFG.skills2.autoCast || G.keys[" "])) {
        this.fireSkill(w, target, st); this.skillTimer = G.run.weapon.skill.cd * st.cdMul;
      }
    }
  }
  fireBasic(w, target, st) {
    const b = G.run.weapon.basic;
    const n = b.bullets;
    const ang0 = Math.atan2(target.y - this.y, target.x - this.x);
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? (i - (n - 1) / 2) * 0.14 : 0;
      w.playerBullets.push(new Bullet(this.x, this.y, ang0 + spread, b.bulletSpd,
        Math.max(1, Math.round(st.atk * b.dmgMul)), "player", b.pierce, b.bounce));
    }
    SFX.play("shoot");
  }
  fireSkill(w, target, st) {
    const s = G.run.weapon.skill;
    G.run.energy -= s.energy;
    // 技能类型分发：默认弹道技能；summon 召唤物；trap 陷阱（技能原型积木）
    if (s.type === "summon") { this.castSummon(w, st); return; }
    if (s.type === "trap") { this.castTrap(w, st); return; }
    const ang0 = Math.atan2(target.y - this.y, target.x - this.x);
    const n = s.bullets || 1;
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? (i - (n - 1) / 2) * 0.18 : 0;
      w.playerBullets.push(new Bullet(this.x, this.y, ang0 + spread, s.bulletSpd || 480,
        Math.max(1, Math.round(st.atk * s.dmgMul)), "player", s.pierce || 0, 0, s.radius, true));
    }
    SFX.play("skill");
    UI.toast(`${s.name}！`, "gold");
  }
  /* ---------- 召唤物：补充无人机至技能表数量（阵亡的重新召出） ---------- */
  castSummon(w, st) {
    const s = G.run.weapon.skill, row = s.row || {};
    const want = row.count || 3;
    const alive = G.run.drones.filter(d => d.hp > 0).length;
    for (let i = alive; i < want; i++) {
      const a = (i / want) * Math.PI * 2;
      const orbit = row.orbit || 70;
      G.run.drones.push(new Drone(
        this.x + Math.cos(a) * orbit, this.y + Math.sin(a) * orbit,
        a, row.hp || 40, Math.max(1, Math.round((row.atk || 6) * (s.summonMul || 1))),
        row.fireCd || 0.8, orbit));
    }
    SFX.play("skill");
    UI.toast(`${s.name}！无人机编队 ${G.run.drones.filter(d => d.hp > 0).length}/${want}`, "gold");
  }
  /* ---------- 陷阱：在脚下布设地雷，超出数量上限时回收最旧的 ---------- */
  castTrap(w, st) {
    const s = G.run.weapon.skill, row = s.row || {};
    const cap = row.count || 1;
    while (G.run.traps.length >= cap) G.run.traps.shift();   // 最旧的回收
    G.run.traps.push({
      x: this.x, y: this.y, r: 10,
      radius: s.radius || row.radius || 110,          // 触发范围 = 伤害范围（同源）
      armDelay: s.armDelay != null ? s.armDelay : 0.5,
      armed: false, fuse: 0,
      dmg: Math.max(1, Math.round(st.atk * (s.dmgMul || 1) * (s.trapMul || 1))),
    });
    SFX.play("skill");
    UI.toast(`${s.name}！已布设（场上 ${G.run.traps.length}/${cap}）`, "gold");
  }
  takeDamage(w, dmg) {
    const st = computeStats();
    const real = Math.max(1, Math.round(dmg - st.def));
    G.run.hp -= real;
    spawnFloat(this.x, this.y - 30, `-${real}`, "#ff7b7f");
    SFX.play("hurt");
    G.shakeT = CFG.audio.shake.dur; G.shakeAmp = CFG.audio.shake.hurt;   // 屏幕震动
    if (G.run.hp <= 0) { G.run.hp = 0; onPlayerDeath(); }
  }
  heal(pct) {
    G.run.hp = Math.min(G.run.hpMax, G.run.hp + G.run.hpMax * pct);
    spawnFloat(this.x, this.y - 30, `+${Math.round(G.run.hpMax * pct)}`, "#7de08a");
  }
}

/* ---------- 多角色组队：英雄集合（队长 + AI 队友） ---------- */
function aliveHeroes() {
  const arr = [];
  if (G.player) arr.push(G.player);
  if (G.run && G.run.companions) for (const c of G.run.companions) if (c.alive) arr.push(c);
  return arr;
}
function nearestHero(x, y) {
  let best = null, bd = Infinity;
  for (const h of aliveHeroes()) {
    const d = U.dist(x, y, h.x, h.y);
    if (d < bd) { bd = d; best = h; }
  }
  return best || G.player;
}
function heroTakeDamage(w, h, dmg) {
  // 受击打断：撤离读条归零（代币保留）；裂缝返回信标读条归零
  const r = G.run;
  if (r && r.extractChanneling) { r.extractChanneling = false; r.extractProgress = 0; UI.toast("撤离读条被打断！（代币保留，可再次按 E）", "bad"); }
  if (w && w.kind === "rift" && w.returnProgress > 0) { w.returnProgress = 0; UI.toast("返回信标读条被打断！", "bad"); }
  if (h === G.player) { G.player.takeDamage(w, dmg); return; }
  const real = Math.max(1, Math.round(dmg - (h.heroDef.def || 0)));
  h.hp -= real;
  if (G.run.stats) G.run.stats.dmgTaken += real;
  spawnFloat(h.x, h.y - 30, `-${real}`, "#ff9a7f");
  if (h.hp <= 0) { h.hp = 0; h.alive = false; SFX.play("death"); UI.toast(`队友「${h.name}」倒下了！`, "bad"); }
}
/* ---------- 多角色组队：蛇形尾迹跟随（贪吃蛇模型） ----------
 * 队长是蛇头，历史移动路径记录为尾迹（按距离采样）；队友 i 目标点 =
 * 沿尾迹回溯 (i+1)*间距 的历史位置 + 垂直于该段路径的横向微偏移。
 * 优点：沿真实路径走，转弯不抖、不卡障碍；比虚拟编队点更稳。
 */
const TRAIL_STEP = CFG.team.follow.trailStep;    // 尾迹采样间距（px）：队长每移动 5px 记一个点
const TEAM_DEPTH = CFG.team.follow.depth;        // 队友纵向间距（px）
// 第 i 位队友的横向错开：-18,+18,-36,+36,-54,... 左右交替、幅度递增，支持任意人数
function teamLateral(i) {
  const b = CFG.team.follow.lateralBase;
  return (i % 2 === 0 ? -1 : 1) * (Math.floor(i / 2) + 1) * b;
}
function trailPush(w) {
  const p = G.player;
  const t = w.teamTrail || (w.teamTrail = { pts: [{ x: p.x, y: p.y }], lastX: p.x, lastY: p.y });
  const d = U.dist(p.x, p.y, t.lastX, t.lastY);
  if (d >= TRAIL_STEP) {
    t.pts.push({ x: p.x, y: p.y });
    t.lastX = p.x; t.lastY = p.y;
    if (t.pts.length > 400) t.pts.shift();   // 上限保护（400 点 ≈ 2000px 路径，足够 5+ 人）
  }
  return t;
}
// 开局/进图时预铺尾迹：从队长位置沿 -dir 方向铺一条直线，保证每位队友立即获得正确纵深
function seedTrail(w, ux, uy) {
  if (!w || !G.player) return;
  const p = G.player;
  const n = Math.ceil((TEAM_DEPTH * (CFG.team.maxSize + 2) + 80) / TRAIL_STEP);
  const pts = [];
  for (let k = n; k >= 1; k--) pts.push({ x: p.x - ux * TRAIL_STEP * k, y: p.y - uy * TRAIL_STEP * k });
  pts.push({ x: p.x, y: p.y });
  w.teamTrail = { pts, lastX: p.x, lastY: p.y };
}
// 沿尾迹从队头回溯 depth 距离的目标点（含横向错开）；尾迹不足时沿最旧段方向直线外推
function trailTarget(trail, depth, lateral) {
  const pts = trail.pts;
  let ax = pts[pts.length - 1].x, ay = pts[pts.length - 1].y;
  let need = depth, dirx = 0, diry = 1;      // dir 兜底：向下
  for (let i = pts.length - 2; i >= 0 && need > 0; i--) {
    const dx = pts[i].x - ax, dy = pts[i].y - ay;
    const seg = Math.hypot(dx, dy);
    if (seg <= 0) { ax = pts[i].x; ay = pts[i].y; continue; }
    dirx = dx / seg; diry = dy / seg;
    if (seg >= need) { ax += dirx * need; ay += diry * need; need = 0; break; }
    ax = pts[i].x; ay = pts[i].y; need -= seg;
  }
  if (need > 0) { ax += dirx * need; ay += diry * need; }   // 尾迹尽头：沿最旧段方向外推
  const l = Math.hypot(dirx, diry) || 1;
  return { x: ax + (-diry / l) * lateral, y: ay + (dirx / l) * lateral };
}
function snapCompanions(world) {
  if (!G.run || !G.run.companions) return;
  const w = world || G.activeWorld || G.mainWorld;
  if (!w) return;
  const trail = trailPush(w);
  G.run.companions.forEach((c, i) => {
    const t = trailTarget(trail, (i + 1) * TEAM_DEPTH, teamLateral(i));
    c.x = U.clamp(t.x, 20, w.w - 20); c.y = U.clamp(t.y, 20, w.h - 20);
  });
}
function updateCompanions(w, dt) {
  const r = G.run;
  if (!r || !r.companions) return;
  const trail = trailPush(w);
  r.companions.forEach((c, i) => {
    if (!c.alive) return;
    // 蛇形跟随：目标 = 队长尾迹上 (i+1)*DEPTH 深度处的历史点（沿真实路径）
    const t = trailTarget(trail, (i + 1) * TEAM_DEPTH, teamLateral(i));
    const tx = U.clamp(t.x, 20, w.w - 20), ty = U.clamp(t.y, 20, w.h - 20);
    const d = U.dist(c.x, c.y, tx, ty);
    if (d > 6) {
      const spd = c.heroDef.spd * 1.15;
      c.x += (tx - c.x) / d * spd * dt; c.y += (ty - c.y) / d * spd * dt;
      if (Math.abs(tx - c.x) > 4) c.faceDir = tx > c.x ? 1 : -1;
      resolveObstacles(c, w);
    }
    // 自动普攻（队友不装模块，不吃词条；攻击随局内等级成长保持相关性）
    c.fireTimer -= dt;
    const tgt = nearestMonster(w, c.x, c.y);
    if (tgt && c.fireTimer <= 0) {
      const b = CFG.skills[CFG.weapons[c.heroDef.weapon].skills.basic];
      const atk = c.heroDef.atk + 2 * (r.lv - 1);
      const ang0 = Math.atan2(tgt.y - c.y, tgt.x - c.x);
      const n = b.bullets || 1;
      for (let k = 0; k < n; k++) {
        const spread = n > 1 ? (k - (n - 1) / 2) * 0.14 : 0;
        w.playerBullets.push(new Bullet(c.x, c.y, ang0 + spread, b.bulletSpd,
          Math.max(1, Math.round(atk * b.dmgMul)), "player", b.pierce || 0, b.bounce || 0));
      }
      c.fireTimer = b.cd;
      c.faceDir = tgt.x > c.x ? 1 : -1;
    }
  });
}

/* ---------- 召唤物：无人机（会被敌人攻击；跟随队长 + 自动攻击） ---------- */
class Drone {
  constructor(x, y, orbitA, hp, atk, fireCd, orbit) {
    this.isDrone = true;
    this.x = x; this.y = y; this.r = 12;
    this.hpMax = hp; this.hp = hp;
    this.atk = atk; this.fireCd = fireCd;
    this.orbitA = orbitA; this.orbit = orbit;
    this.fireTimer = U.rand(0.2, 0.6);
  }
  update(w, dt) {
    // 环绕队长缓慢公转，脱离轨道时平滑归位
    const p = G.player;
    if (p) {
      this.orbitA += dt * 0.6;
      const tx = p.x + Math.cos(this.orbitA) * this.orbit;
      const ty = p.y + Math.sin(this.orbitA) * this.orbit;
      const d = U.dist(this.x, this.y, tx, ty);
      if (d > 4) {
        const spd = 340;
        this.x += (tx - this.x) / d * spd * dt;
        this.y += (ty - this.y) / d * spd * dt;
      }
    }
    // 自动攻击最近怪物
    this.fireTimer -= dt;
    const tgt = nearestMonster(w, this.x, this.y);
    if (tgt && this.fireTimer <= 0) {
      const ang = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      w.playerBullets.push(new Bullet(this.x, this.y, ang, 560, this.atk, "player"));
      this.fireTimer = this.fireCd;
    }
  }
}
function droneTakeDamage(w, d, dmg) {
  d.hp -= Math.max(1, Math.round(dmg));
  spawnFloat(d.x, d.y - 20, `-${Math.max(1, Math.round(dmg))}`, "#ff9a7f");
  if (d.hp <= 0) { d.hp = 0; SFX.play("death"); UI.toast("无人机被击毁！", "bad"); }
}

/* ---------- 敌方目标（英雄 + 存活无人机）：怪物索敌与伤害统一入口 ---------- */
function enemyTargets() {
  return [...aliveHeroes(), ...((G.run && G.run.drones) || []).filter(d => d.hp > 0)];
}
function nearestTarget(x, y) {
  let best = null, bd = Infinity;
  for (const t of enemyTargets()) {
    const d = U.dist(x, y, t.x, t.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best || G.player;
}
function targetTakeDamage(w, t, dmg) {
  if (t.isDrone) droneTakeDamage(w, t, dmg);
  else heroTakeDamage(w, t, dmg);
}

class Bullet {
  constructor(x, y, ang, spd, dmg, side, pierce = 0, bounce = 0, aoe = 0, isSkill = false) {
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
    this.dmg = dmg; this.side = side; this.pierce = pierce; this.bounce = bounce;
    this.aoe = aoe; this.isSkill = isSkill;
    this.dead = false; this.life = 2.2; this.hitSet = new Set();
  }
  update(w, dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    // 撞墙
    if (this.x < 0 || this.x > w.w || this.y < 0 || this.y > w.h || this.life <= 0) {
      if (this.aoe > 0) explode(w, this.x, this.y, this.aoe, this.dmg, this.side);
      this.dead = true; return;
    }
    if (blockedByObstacle(w, this.x, this.y)) {
      if (this.aoe > 0) explode(w, this.x, this.y, this.aoe, this.dmg, this.side);
      this.dead = true; return;
    }
    // 命中判定
    if (this.side === "player") {
      const cands = w.monsterHash.query(this.x, this.y, 30, _tmpArr);
      for (const m of cands) {
        if (m.dead || this.hitSet.has(m)) continue;
        if (U.dist(this.x, this.y, m.x, m.y) < m.r + 6) {
          this.hitSet.add(m);
          if (this.aoe > 0) { explode(w, this.x, this.y, this.aoe, this.dmg, this.side); this.dead = true; return; }
          damageMonster(w, m, this.dmg);
          if (G.run.lifesteal > 0) G.run.hp = Math.min(G.run.hpMax, G.run.hp + this.dmg * G.run.lifesteal);
          if (this.pierce > 0) { this.pierce--; }
          else if (this.bounce > 0) {
            this.bounce--;
            const next = nearestMonster(w, this.x, this.y, m);
            if (next) {
              const ang = Math.atan2(next.y - this.y, next.x - this.x);
              const spd = Math.hypot(this.vx, this.vy);
              this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
            } else { this.dead = true; }
          } else { this.dead = true; }
          return;
        }
      }
    } else {
      for (const h of aliveHeroes()) {
        if (U.dist(this.x, this.y, h.x, h.y) < h.r + 6) {
          heroTakeDamage(w, h, this.dmg);
          spawnBurst(this.x, this.y, "#c79bff", 6);
          this.dead = true;
          break;
        }
      }
      // 敌方子弹也会击中召唤物（无人机可被远程攻击）
      if (!this.dead && G.run && G.run.drones) {
        for (const d of G.run.drones) {
          if (d.hp > 0 && U.dist(this.x, this.y, d.x, d.y) < d.r + 6) {
            droneTakeDamage(w, d, this.dmg);
            spawnBurst(this.x, this.y, "#c79bff", 6);
            this.dead = true;
            break;
          }
        }
      }
    }
  }
}

class Monster {
  constructor(defId, x, y, lv) {
    const d = CFG.monsters[defId];
    this.defId = defId; this.d = d; this.x = x; this.y = y;
    this.r = d.radius * (CFG.monsterSizeMul || 1);   // 体积倍数：碰撞与贴图同步
    const lvMul = 1 + (lv - 1) * 0.12;
    const cu = G.run && G.run.curse;   // 诅咒道具（待细化36）：向新生成的敌人附加属性修改器
    this.hpMax = d.hp * lvMul * G.run.monsterHpMul * (cu ? cu.hpMul : 1); this.hp = this.hpMax;
    this.atk = d.atk * lvMul * G.run.monsterAtkMul * (cu ? cu.atkMul : 1);
    this.effSpd = d.spd * (cu ? cu.spdMul : 1);   // 实际移速（基础 × 诅咒附加的移速修改器）
    this.dead = false;
    this.touchTimer = 0; this.fireTimer = U.rand(0.5, d.fireCd || 2);
    this.state = "chase"; this.stateT = 0; this.dashVx = 0; this.dashVy = 0;
    this.boomTimer = d.boomCd || 0; this.warnT = 0; this.minionTimer = d.minionCd || 0;
    this.sprite = G.sprites[d.sprite];
    this.flashT = 0;
  }
  update(w, dt) {
    this.flashT -= dt;
    const p = G.player;
    const distP = U.dist(this.x, this.y, p.x, p.y);
    switch (this.d.type) {
      case "melee": {
        const h = nearestTarget(this.x, this.y);
        const ang = Math.atan2(h.y - this.y, h.x - this.x);
        this.x += Math.cos(ang) * this.effSpd * dt;
        this.y += Math.sin(ang) * this.effSpd * dt;
        this.touchTimer -= dt;
        if (U.dist(this.x, this.y, h.x, h.y) < this.r + h.r + 2 && this.touchTimer <= 0) {
          targetTakeDamage(w, h, this.atk); this.touchTimer = this.d.touchCd;
        }
        break;
      }
      case "ranged": {
        const h = nearestTarget(this.x, this.y);
        const ang = Math.atan2(h.y - this.y, h.x - this.x);
        const distH = U.dist(this.x, this.y, h.x, h.y);
        if (distH > this.d.keepDist + 40) {
          this.x += Math.cos(ang) * this.effSpd * dt; this.y += Math.sin(ang) * this.effSpd * dt;
        } else if (distH < this.d.keepDist - 60) {
          this.x -= Math.cos(ang) * this.effSpd * 0.7 * dt; this.y -= Math.sin(ang) * this.effSpd * 0.7 * dt;
        }
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && distH < 620) {
          this.fireTimer = this.d.fireCd;
          w.enemyBullets.push(new Bullet(this.x, this.y, ang, this.d.bulletSpd, this.atk, "enemy"));
        }
        break;
      }
      case "charger": {
        const h = nearestTarget(this.x, this.y);
        const distH = U.dist(this.x, this.y, h.x, h.y);
        this.stateT -= dt;
        if (this.state === "chase") {
          const ang = Math.atan2(h.y - this.y, h.x - this.x);
          this.x += Math.cos(ang) * this.effSpd * dt; this.y += Math.sin(ang) * this.effSpd * dt;
          if (distH < this.d.chargeRange && this.stateT <= 0) { this.state = "telegraph"; this.stateT = this.d.telegraph; }
        } else if (this.state === "telegraph") {
          if (this.stateT <= 0) {
            const ang = Math.atan2(h.y - this.y, h.x - this.x);
            this.dashVx = Math.cos(ang) * this.d.dashSpd; this.dashVy = Math.sin(ang) * this.d.dashSpd;
            this.state = "dash"; this.stateT = this.d.dashTime;
          }
        } else if (this.state === "dash") {
          this.x += this.dashVx * dt; this.y += this.dashVy * dt;
          if (distH < this.r + h.r + 2) { targetTakeDamage(w, h, this.atk); this.state = "chase"; this.stateT = this.d.chargeCd; }
          if (this.stateT <= 0) { this.state = "chase"; this.stateT = this.d.chargeCd; }
        }
        break;
      }
      case "boss": {
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        this.x += Math.cos(ang) * this.effSpd * dt;
        this.y += Math.sin(ang) * this.effSpd * dt;
        // 圆形范围爆炸（预警 → 爆炸，命中范围内所有英雄）
        this.boomTimer -= dt;
        if (this.warnT > 0) {
          this.warnT -= dt;
          if (this.warnT <= 0) {
            for (const h of enemyTargets()) {
              if (U.dist(this.x, this.y, h.x, h.y) <= this.d.boomRadius) targetTakeDamage(w, h, this.atk * this.d.boomDmgMul);
            }
            spawnBurst(this.x, this.y, "#e5484d", 40, this.d.boomRadius);
            this.boomTimer = this.d.boomCd;
          }
        } else if (this.boomTimer <= 0) {
          this.warnT = this.d.boomWarn;
        }
        // 刷小怪
        this.minionTimer -= dt;
        if (this.minionTimer <= 0) {
          this.minionTimer = this.d.minionCd;
          for (let i = 0; i < this.d.minionWave; i++) {
            if (w.monsters.length < G.levelCfg.monsterCap) {
              const a = U.rand(0, Math.PI * 2);
              w.spawnMonster("NM0010", this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90);
            }
          }
        }
        this.touchTimer -= dt;
        const hb = nearestTarget(this.x, this.y);
        if (U.dist(this.x, this.y, hb.x, hb.y) < this.r + hb.r && this.touchTimer <= 0) { targetTakeDamage(w, hb, this.atk * 0.6); this.touchTimer = 1; }
        break;
      }
    }
    // 障碍物推挤
    resolveObstacles(this, w);
    this.x = U.clamp(this.x, this.r, w.w - this.r);
    this.y = U.clamp(this.y, this.r, w.h - this.r);
  }
}

const _tmpArr = [];

function nearestMonster(w, x, y, exclude) {
  let best = null, bd = Infinity;
  for (const m of w.monsters) {
    if (m.dead || m === exclude) continue;
    const d = U.dist(x, y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

function damageMonster(w, m, dmg) {
  const cuDef = (G.run && G.run.curse) ? G.run.curse.defMul : 1;   // 诅咒附加的"防御 ×N"被动
  const real = Math.max(1, Math.round(dmg - m.d.def * cuDef - (m.eliteDef || 0)));
  // 精英「护盾」词缀：先扣盾，盾破前本体不受损
  if (m.shield > 0) {
    m.shield -= real; m.flashT = 0.1;
    if (G.run && G.run.stats && m.d.type !== "boss") G.run.stats.dmgDealt += real;
    spawnBurst(m.x, m.y, "#6cb2ff", 4); SFX.play("hit");
    if (m.shield <= 0) { m.shield = 0; spawnBurst(m.x, m.y, "#6cb2ff", 14); }
    return;
  }
  m.hp -= real; m.flashT = 0.1;
  if (G.run && G.run.stats && m.d.type !== "boss") G.run.stats.dmgDealt += real;
  spawnBurst(m.x, m.y, "#ffd76a", 4);
  SFX.play("hit");
  if (m.hp <= 0 && !m.dead) {
    m.dead = true;
    onMonsterKilled(w, m);
  }
}

/* ---------- 精英怪：基础怪 + 1~2 条随机词缀（词缀表 CFG.elites.affixes） ---------- */
function applyElite(m) {
  const ecfg = CFG.elites;
  const names = Object.keys(ecfg.affixes);
  const n = U.randInt(ecfg.affixCount[0], ecfg.affixCount[1]);
  const picked = [];
  const pool = names.slice();
  for (let i = 0; i < n && pool.length; i++) picked.push(pool.splice(U.randInt(0, pool.length - 1), 1)[0]);
  m.elite = picked;
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

function explode(w, x, y, radius, dmg, side) {
  spawnBurst(x, y, "#6cb2ff", 26, radius);
  if (side !== "player") {   // Boss 爆炸等敌方爆炸 → 强震动
    G.shakeT = CFG.audio.shake.dur; G.shakeAmp = CFG.audio.shake.bossBoom;
  }
  SFX.play("skill");
  if (side === "player") {
    const cands = w.monsterHash.query(x, y, radius + 40, _tmpArr);
    const seen = new Set();
    for (const m of cands) {
      if (m.dead || seen.has(m)) continue;
      if (U.dist(x, y, m.x, m.y) <= radius + m.r) { damageMonster(w, m, dmg); seen.add(m); }
    }
  }
}

/* ---------- 掉落 / 击杀 ---------- */
function onMonsterKilled(w, m) {
  const r = G.run, lv = G.levelCfg;
  const rm = r.curse ? r.curse.rewardMul : 1;   // 诅咒风险回报：掉落倍率（待细化36）
  r.kills++;
  SFX.play("kill");
  if (w.isMain) {
    // 金币与经验宝石掉落（地上拾取物，走过自动拾取；Boss 分裂成多枚）
    const n = m.d.type === "boss" ? 5 : 1;
    for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "coin", Math.max(1, Math.round(m.d.coin / n * rm)));
    for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "exp", Math.max(1, Math.round(m.d.exp / n * rm)));
    // 工匠雕像触发
    if (!r.artisanSpawned && !r.artisanUsed && r.kills >= lv.artisanAtKills) {
      r.artisanSpawned = true;
      const pos = w.findFreeSpot(120);
      if (pos) { w.altars.push({ cfg: CFG.altars.ALTAR_005, x: pos.x, y: pos.y, id: "ALTAR_005" }); UI.toast("⚒ 工匠雕像出现了！", "gold"); }
    }
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
  // 精英怪：必掉宝箱（按权重自动入包）+ 额外经验
  if (m.elite) {
    const item = makeChestItem(U.weightedPick(CFG.elites.dropChest));
    if (r.backpack.tryStackChest(item) || (() => { const s = r.backpack.findSpot(item); return s ? (r.backpack.place(item, s.x, s.y), true) : false; })()) {
      UI.toast(`★ 精英「${m.elite.join("·")}」掉落 ${item.name}`, "gold");
    } else UI.toast("背包已满，精英宝箱作废", "bad");
    for (let i = 0; i < CFG.elites.extraExp; i++) spawnPickup(w, m.x, m.y, "exp", Math.max(2, Math.round(m.d.exp)));
  }
  spawnBurst(m.x, m.y, "#9aa7b8", 10);
}

function spawnPickup(w, x, y, type, value) {
  const a = U.rand(0, Math.PI * 2), s = U.rand(40, 110);
  w.pickups.push({ type, value, x: x + U.rand(-10, 10), y: y + U.rand(-10, 10),
    vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 });
}

function spawnBoss(w) {
  const r = G.run;
  r.bossSpawned = true;
  const pos = w.findFreeSpot(200);   // 至少离玩家 200，离墙 90
  const bossId = G.levelCfg.boss || "BS0001";
  const boss = new Monster(bossId, pos.x, pos.y, G.levelCfg.monsterLevel || 1);
  w.monsters.push(boss);
  w.boss = boss;
  UI.toast(`⚠ BOSS「${CFG.monsters[bossId].name}」出现了！`, "bad");
  EventBus.emit("bossSpawned");
}

function onBossDefeated(w) {
  const r = G.run;
  r.bossDefeated = true;
  if (r.stats) r.stats.bossFightTime = r.runTime - (r.stats.timeToBoss || r.runTime);
  // 撤离点代币（5.2）：Boss 掉落，不占格无重量，上限 1；任意位置按 E 读条 8 秒撤离
  if (!r.extractToken) {
    r.extractToken = true;
    UI.toast("BOSS 已被击败！获得【撤离点代币】· 按 E 任意位置读条 8 秒撤离", "gold");
  }
}

function gainExp(v) {
  const r = G.run;
  r.exp += v;
  while (r.exp >= r.expNext) {
    r.exp -= r.expNext; r.lv++;
    r.expNext = Math.round(14 + (r.lv - 1) * 9);
    spawnFloat(G.player.x, G.player.y - 44, `LV ${r.lv}！`, "#c79bff");
    r.cardAssets++;
    SFX.play("levelup");
    UI.toast(`升级！LV ${r.lv}（属性提升 · 属性卡牌 +1，工匠世界可用）`, "gold");
  }
}

/* ---------- 属性卡牌（8.3 / 13.15：资产累积、工匠世界使用、池内同属性去重） ---------- */
function rollCardQuality() {
  const w = CFG.cardPool.qualityWeights;
  return Number(U.weightedPick({ 0: w[0], 1: w[1], 2: w[2], 3: w[3] }));
}
function drawCardCandidates() {
  const r = G.run;
  // 同属性去重：已使用的属性不再出现（dedupApplied 可关）；候选内也不重复
  const used = CFG.cardPool.dedupApplied ? new Set(r.appliedCards.map(c => c.attr)) : new Set();
  const attrs = Object.keys(CFG.cardPool.attrs).filter(a => !used.has(a));
  const n = Math.min(CFG.cardPool.candidateCount, attrs.length);
  const out = [], pool = attrs.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(U.randInt(0, pool.length - 1), 1)[0];
    const q = rollCardQuality();
    out.push({ attr: a, q, value: CFG.cardPool.attrs[a].flat[q] });
  }
  return out;
}
function useCard(idx) {
  const r = G.run;
  if (!G.inArtisan || r.cardAssets <= 0 || !r.cardCandidates || !r.cardCandidates[idx]) return false;
  const c = r.cardCandidates[idx];
  r.cardAssets--;
  r.appliedCards.push(c);
  r.cardCandidates = drawCardCandidates();   // 用掉一张后补抽新候选
  recomputeWeapon();
  SFX.play("altar");
  return true;
}
function refreshCards(paid) {
  const r = G.run;
  if (!G.inArtisan) return false;
  // 免费刷新（每局固定次数）优先；用完后可花结晶付费刷新（待细化 #37）
  if (r.cardRefresh > 0) {
    r.cardRefresh--;
    r.cardCandidates = drawCardCandidates();
    return true;
  }
  if (paid && Meta.data.crystals >= CFG.cardPool.refreshCrystalCost) {
    Meta.data.crystals -= CFG.cardPool.refreshCrystalCost;
    Meta.commit();
    r.cardCandidates = drawCardCandidates();
    return true;
  }
  return false;
}

/* ---------- 玩家死亡（16.6） ---------- */
function onPlayerDeath() {
  if (G.state !== "playing") return;
  const penalty = calcDeathPenalty(G.run);
  G.state = "dead";
  EventBus.emit("playerDied", penalty);
}

function calcDeathPenalty(run) {
  // 未开封宝箱全部损失；已开出装备/模块按总价值随机损失约 70%
  // 保险契约：每份保护 1 件价值最高的物品（含宝箱）；契约本身不参与损失
  const lost = [], kept = [];
  let lostValue = 0, totalValue = 0;
  const all = [];
  for (const it of run.backpack.items.slice()) if (it.kind === "chest") { lost.push(it); lostValue += it.value; }
    else if (it.kind !== "insurance") { all.push(it); totalValue += it.value; }
  for (const it of run.weaponInv.items) { all.push(it); totalValue += it.value; }
  const target = totalValue * CFG.deathPenalty.loseRatio;
  const pool = all.slice();
  while (lostValue < target && pool.length) {
    const i = U.randInt(0, pool.length - 1);
    const it = pool.splice(i, 1)[0];
    lostValue += it.value; lost.push(it);
  }
  // 保险结算：从未开封损失物中按价值从高到低逐件保护；按实际保护数消耗契约
  const had = insuranceCount(run);
  let used = 0;
  while (used < had && lost.length) {
    let bi = 0;
    for (let i = 1; i < lost.length; i++) if (lost[i].value > lost[bi].value) bi = i;
    const saved = lost.splice(bi, 1)[0];
    lostValue -= saved.value; saved.byInsurance = true; kept.push(saved);
    used++;
  }
  if (used > 0) consumeInsurance(run, used);
  for (const it of all) if (!lost.includes(it) && !kept.includes(it)) kept.push(it);
  return { lost, kept, lostValue, totalValue, contractsUsed: used, contractsLeft: had - used };
}

/* ---------- 局内→局外资源转化（待细化 5：撤离成功时折算，死亡不折算） ---------- */
function calcSettleConvert(run) {
  const sc = CFG.settleConvert;
  const b = { coin: 0, chest: 0, item: 0, card: 0, total: 0 };
  b.coin = Math.floor((run.coin || 0) / sc.coinPerCrystal);
  let chestVal = 0, itemVal = 0;
  for (const it of run.backpack.items) {
    if (it.kind === "chest") chestVal += it.value;
    else if (it.kind === "gear" || it.kind === "module") itemVal += it.value;
    // 保险契约单独折算（CFG.insurance.crystalRefund），不计入此处
  }
  for (const it of run.weaponInv.items) if (it.kind === "gear" || it.kind === "module") itemVal += it.value;
  b.chest = Math.floor(chestVal * sc.chestRatio);
  b.item = Math.floor(itemVal * sc.itemRatio);
  b.card = (run.cardAssets || 0) * sc.cardCrystal;
  b.total = b.coin + b.chest + b.item + b.card;
  return b;
}

/* ============ 世界 ============ */
class World {
  constructor(w, h, isMain, kind) {
    this.w = w; this.h = h; this.isMain = isMain; this.kind = kind || (isMain ? "main" : "artisan");
    this.obstacles = [];
    this.monsters = []; this.playerBullets = []; this.enemyBullets = [];
    this.groundChests = []; this.altars = []; this.pickups = [];
    this.monsterHash = new SpatialHash(96);
    this.circles = []; this.spawnTimer = 0;
    this.boss = null;
    this.npc = null; this.exitBeacon = null; this.returnBeacon = null;
    if (isMain) this.setupMain();
    else if (this.kind === "rift") this.setupRift();
    else this.setupArtisan();
  }
  setupMain() {
    const lv = G.levelCfg;
    // 固定内部障碍物（少量，Boss 爆炸不被阻挡；避开中心出生点）
    const obs = [
      { x: 360, y: 260, w: 220, h: 70 }, { x: 1340, y: 260, w: 220, h: 70 },
      { x: 360, y: 760, w: 220, h: 70 }, { x: 1340, y: 760, w: 220, h: 70 },
      { x: 560, y: 620, w: 120, h: 120 }, { x: 1240, y: 340, w: 120, h: 120 },
    ];
    this.obstacles = obs;
    // 随机圆摆放（不重叠检测）
    for (const c of lv.circles) {
      const tpl = CFG.spawnCircles[c.tpl];
      for (let i = 0; i < c.count; i++) {
        let pos, tries = 0;
        do {
          pos = { x: U.rand(220, this.w - 220), y: U.rand(160, this.h - 160) };
          tries++;
        } while (tries < 40 && this.circles.some(o => U.dist(pos.x, pos.y, o.x, o.y) < tpl.radius * 2 + 60));
        this.circles.push({ ...tpl, x: pos.x, y: pos.y, timer: U.rand(0.5, 2.5) });
      }
    }
    // 祭坛随机刷出（按权重，不与障碍/圆重叠）
    const pool = Object.entries(CFG.altars).filter(([k, a]) => a.weight > 0);
    const weights = {}; pool.forEach(([k, a]) => weights[k] = a.weight);
    const count = 5;
    for (let i = 0; i < count; i++) {
      const id = U.weightedPick(weights);
      const pos = this.findFreeSpot(100);
      if (pos) this.altars.push({ cfg: CFG.altars[id], x: pos.x, y: pos.y, id });
    }
    // 初始一波怪
    for (const c of this.circles) this.spawnWave(c);
  }
  setupArtisan() {
    // 工匠世界：无敌人安全区；NPC + 固定返回出口
    this.obstacles = [];
    this.npc = { x: this.w / 2, y: this.h / 2 - 60 };
    this.exitBeacon = { x: this.w / 2, y: this.h - 130 };
  }
  setupRift() {
    // 空间裂缝子地图（5.1）：全新战斗地图，无任务、纯探索战斗 + 击杀奖励；
    // 返回信标以场景物体形式在地上随机刷出（读条 5 秒，受击归零）
    this.obstacles = [
      { x: U.rand(300, 500), y: U.rand(200, 400), w: U.rand(150, 260), h: 70 },
      { x: U.rand(this.w - 560, this.w - 360), y: U.rand(200, 400), w: U.rand(150, 260), h: 70 },
      { x: U.rand(300, 500), y: U.rand(this.h - 420, this.h - 240), w: U.rand(120, 220), h: 70 },
      { x: U.rand(this.w - 520, this.w - 360), y: U.rand(this.h - 420, this.h - 240), w: 120, h: 120 },
    ];
    // 两个刷怪圆（复用主关卡首个圆模板）
    const tpl = CFG.spawnCircles[Object.keys(CFG.spawnCircles)[0]];
    this.circles = [
      { ...tpl, x: this.w * 0.3, y: this.h * 0.35, timer: 1.0 },
      { ...tpl, x: this.w * 0.7, y: this.h * 0.65, timer: 2.5 },
    ];
    for (const c of this.circles) this.spawnWave(c);
    // 返回信标：地上随机刷出（远离玩家出生点）
    this.returnBeacon = this.findFreeSpot(400, 90, 90) || { x: this.w / 2, y: this.h - 200 };
  }
  spawnMonster(defId, x, y) {
    if (this.monsters.length >= G.levelCfg.monsterCap) return null;
    x = U.clamp(x, 40, this.w - 40); y = U.clamp(y, 40, this.h - 40);
    const lv = (G.levelCfg.monsterLevel || 1);
    const m = new Monster(defId, x, y, lv);
    // 精英怪：按地图类型概率 + 击杀进度加成（裂缝子地图概率更高）
    if (m.d.type !== "boss") {
      const progress = Math.min(1, (G.run.kills || 0) / Math.max(1, G.levelCfg.progressGoal));
      const chance = this.kind === "rift" ? CFG.elites.riftChance
        : CFG.elites.chance + progress * CFG.elites.chanceProgress;
      if (Math.random() < chance) applyElite(m);
    }
    this.monsters.push(m);
    return m;
  }
  spawnWave(c) {
    // 圆内随机取点：避开墙体、与玩家保持最小距离
    let spawned = 0, attempts = 0;
    const p = G.player;
    while (spawned < c.waveSize && attempts < 24) {
      attempts++;
      const a = U.rand(0, Math.PI * 2), rr = U.rand(0, c.radius);
      const x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a) * rr;
      if (x < 40 || x > this.w - 40 || y < 40 || y > this.h - 40) continue;
      if (blockedByObstacle(this, x, y)) continue;
      if (U.dist(x, y, p.x, p.y) < CFG.spawnRules.minDistFromPlayer) continue;
      // BOSS 存活期间：刷怪点远离 BOSS，避免小怪贴脸刷出
      if (this.boss && !this.boss.dead && U.dist(x, y, this.boss.x, this.boss.y) < CFG.spawnRules.bossClearRadius) continue;
      // 按解锁进度过滤怪物池
      const progress = G.run.kills / G.levelCfg.progressGoal;
      const pool = {};
      c.pool.split("/").forEach(s => {
        const [id, wt] = s.split(":");
        const unlock = CFG.monsterUnlock[id] ?? 0;
        if (progress >= unlock) pool[id] = Number(wt);
      });
      if (!Object.keys(pool).length) pool.NM0010 = 1;
      const defId = U.weightedPick(pool);
      const m = this.spawnMonster(defId, x, y);
      if (m) spawned++;
    }
  }
  findFreeSpot(minDistFromPlayer = 0, minDistFromWalls = 90, clearance = 70) {
    for (let t = 0; t < 60; t++) {
      const x = U.rand(minDistFromWalls, this.w - minDistFromWalls);
      const y = U.rand(minDistFromWalls, this.h - minDistFromWalls);
      // 障碍净空：交互圈很大，中心必须离障碍边缘足够远，避免圈被障碍压住
      if (this.obstacles.some(o => x > o.x - clearance && x < o.x + o.w + clearance && y > o.y - clearance && y < o.y + o.h + clearance)) continue;
      if (this.altars.some(a => U.dist(x, y, a.x, a.y) < 160)) continue;
      if (minDistFromPlayer && U.dist(x, y, G.player.x, G.player.y) < minDistFromPlayer) continue;
      return { x, y };
    }
    return null;
  }
  update(dt) {
    const r = G.run;
    if (this.isMain) r.runTime += dt;
    // 刷怪：每个圆独立计时（圆模板的刷新间隔生效）
    if (this.isMain && !r.bossDefeated) {
      const bossActive = r.bossSpawned && this.boss && !this.boss.dead;
      if (!bossActive) {
        for (const c of this.circles) {
          c.timer -= dt;
          if (c.timer <= 0) { c.timer = c.interval; this.spawnWave(c); }
        }
      } else {
        // Boss 阶段：继续少量刷新更强的普通怪
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = 8;
          if (this.monsters.length < 14) this.spawnWave(U.pick(this.circles));
        }
      }
    } else if (this.kind === "rift") {
      for (const c of this.circles) {
        c.timer -= dt;
        if (c.timer <= 0) { c.timer = c.interval; this.spawnWave(c); }
      }
      // 裂缝任务变体（待细化 20 / §五）：歼灭/限时目标；完成 → 额外高价值任务宝箱；超时 → 失败
      const t = r.riftTask;
      if (t && !t.done && !t.failed) {
        if (t.time) {
          t.remain -= dt;
          if (t.remain <= 0) { t.failed = true; UI.toast(`✘ 任务失败：${t.name}（超时）`, "bad"); }
        }
        if (!t.failed && (r.riftKills || 0) >= t.goal) {
          t.done = true;
          const pos = this.findFreeSpot(120);
          if (pos) {
            this.altars.push({ cfg: { name: "任务奖励宝箱", color: "#ff8c5a", icon: "▣", radius: 91, channel: 1.2,
              effects: [{ type: "giveChest", weights: CFG.rift.taskBonusWeights }] }, x: pos.x, y: pos.y, id: "RIFT_TASK" });
            UI.toast(`✔ 任务完成：${t.name}！高价值任务宝箱出现了`, "gold");
          }
        }
      }
    }
    // Buff / 邪神计时：所有地图统一走表（裂缝战斗中 Buff 正常倒计时）
    if (r.monsterDebuff) {
      r.monsterDebuff.remain -= dt;
      if (r.monsterDebuff.remain <= 0) r.monsterDebuff = null;
      r.monsterHpMul = r.monsterDebuff ? r.monsterDebuff.hpMul : 1;
      r.monsterAtkMul = r.monsterDebuff ? r.monsterDebuff.atkMul : 1;
    }
    for (const b of r.buffs) b.remain -= dt;
    r.buffs = r.buffs.filter(b => b.remain > 0);
    // 诅咒道具倒计时（待细化36）：到期消退，已附加在敌人身上的修改器同时失效（新生成怪不再继承）
    if (r.curse) {
      r.curse.remain -= dt;
      if (r.curse.remain <= 0) { r.curse = null; UI.toast("☠ 诅咒已消退", "gold"); }
    }
    // 怪物
    this.monsterHash.clear();
    for (const m of this.monsters) if (!m.dead) this.monsterHash.insert(m, m.x, m.y, m.r);
    for (const m of this.monsters) if (!m.dead) m.update(this, dt);
    const before = this.monsters.length;
    this.monsters = this.monsters.filter(m => !m.dead);
    if (this.isMain && this.boss && this.boss.dead && !r.bossDefeated) onBossDefeated(this);
    // 召唤物（无人机）：跟随 + 自动攻击；阵亡移除
    for (const d of (r.drones || [])) if (d.hp > 0) d.update(this, dt);
    r.drones = (r.drones || []).filter(d => d.hp > 0);
    // 陷阱（大地雷）：不被敌人攻击；敌人进入范围 → 引信延迟 → 爆炸 → 消失
    for (let i = (r.traps || []).length - 1; i >= 0; i--) {
      const t = r.traps[i];
      if (!t.armed) {
        const cands = this.monsterHash.query(t.x, t.y, t.radius + 40, _tmpArr);
        if (cands.some(m => !m.dead && U.dist(t.x, t.y, m.x, m.y) < t.radius + m.r)) {
          t.armed = true; t.fuse = t.armDelay;
        }
      } else {
        t.fuse -= dt;
        if (t.fuse <= 0) {
          explode(this, t.x, t.y, t.radius, t.dmg, "player");
          r.traps.splice(i, 1);
        }
      }
    }
    // 弹道
    for (const b of this.playerBullets) b.update(this, dt);
    for (const b of this.enemyBullets) b.update(this, dt);
    this.playerBullets = this.playerBullets.filter(b => !b.dead);
    this.enemyBullets = this.enemyBullets.filter(b => !b.dead);
    // 地上宝箱拾取（自动）
    const p = G.player;
    for (const c of this.groundChests.slice()) {
      if (U.dist(p.x, p.y, c.x, c.y) < p.r + 26) {
        const item = makeChestItem(c.chestQ);
        if (r.backpack.tryStackChest(item)) { this.groundChests.splice(this.groundChests.indexOf(c), 1); UI.toast(`拾取 ${item.name}`, ""); }
        else {
          const spot = r.backpack.findSpot(item);
          if (spot) { r.backpack.place(item, spot.x, spot.y); this.groundChests.splice(this.groundChests.indexOf(c), 1); UI.toast(`拾取 ${item.name}`, ""); }
          else UI.toast("背包已满且无可叠加同品质宝箱，无法拾取", "bad");
        }
      }
    }
    // 掉落物（金币/经验宝石）：弹开散落 → 走近自动拾取
    for (const pk of this.pickups) {
      pk.x += pk.vx * dt; pk.y += pk.vy * dt; pk.vx *= 0.88; pk.vy *= 0.88;
      pk.x = U.clamp(pk.x, 24, this.w - 24); pk.y = U.clamp(pk.y, 24, this.h - 24);
      pk.life -= dt;
      // 拾取判定：任意存活英雄（队长或队友）靠近均可拾取
      let picked = false;
      for (const h of aliveHeroes()) {
        if (pk.life > 0 && U.dist(h.x, h.y, pk.x, pk.y) < h.r + 16) {
          if (pk.type === "coin") { r.coin += pk.value; spawnFloat(pk.x, pk.y - 18, `+${pk.value}`, "#ffd76a"); SFX.play("coin"); }
          else { gainExp(pk.value); spawnFloat(pk.x, pk.y - 18, `+${pk.value} 经验`, "#c79bff"); SFX.play("coin"); }
          pk.life = 0; picked = true; break;
        }
      }
      if (picked) continue;
    }
    this.pickups = this.pickups.filter(pk => pk.life > 0);
    // 祭坛交互：进度条与雕像绑定——圈内积累，离开缓慢衰退（衰退速度 = 积累速度 × 1.2）
    // 判定半径 = 虚线绘制半径 × altarJudgeMul（1.2，外扩 20% 容差）
    for (const a of this.altars.slice()) {
      // 判定：任意存活英雄（队长或队友）在圈内即积累；全部离开才衰退
      const inCircle = aliveHeroes().some(h => U.dist(h.x, h.y, a.x, a.y) < a.cfg.radius * CFG.altarJudgeMul);
      if (inCircle) {
        a.progress = (a.progress || 0) + dt;
        if (a.progress >= a.cfg.channel) { this.triggerAltar(a); }
      } else if (a.progress > 0) {
        a.progress = Math.max(0, a.progress - dt * 1.2);
      }
    }
    // 工匠世界交互（同规则：判定 = 虚线圈 × altarJudgeMul，离开衰退）
    if (!this.isMain && this.kind === "artisan") {
      const nearNpc = U.dist(p.x, p.y, this.npc.x, this.npc.y) < 90 * CFG.altarJudgeMul;
      if (nearNpc) {
        this.npcProgress = (this.npcProgress || 0) + dt;
        if (this.npcProgress >= 1.0 && !this._npcBlocked) {
          this._npcBlocked = true;
          EventBus.emit("openArtisanUI");
        }
      } else {
        this.npcProgress = Math.max(0, (this.npcProgress || 0) - dt * 1.2);
        this._npcBlocked = false;
      }
      const nearExit = U.dist(p.x, p.y, this.exitBeacon.x, this.exitBeacon.y) < 100 * CFG.altarJudgeMul;
      if (nearExit) {
        this.exitProgress = (this.exitProgress || 0) + dt;
        if (this.exitProgress >= 3.0) { this.exitProgress = 0; EventBus.emit("returnToMain"); }
      } else {
        this.exitProgress = Math.max(0, (this.exitProgress || 0) - dt * 1.2);
      }
    }
    // 空间裂缝返回信标（5.1）：读条 5 秒；仅受击归零（移动不打断，用户已改规则）；离开圈进度保留
    if (this.kind === "rift" && this.returnBeacon) {
      const nearBeacon = aliveHeroes().some(h => U.dist(h.x, h.y, this.returnBeacon.x, this.returnBeacon.y) < 100 * CFG.altarJudgeMul);
      if (nearBeacon) {
        this.returnProgress = (this.returnProgress || 0) + dt;
        if (this.returnProgress >= CFG.rift.channel) { this.returnProgress = 0; EventBus.emit("returnFromRift"); }
      }
    }
  }
  triggerAltar(a) {
    const idx = this.altars.indexOf(a);
    if (idx < 0) return;
    this.altars.splice(idx, 1);   // 触发成功即消失
    if (G.run && G.run.stats) G.run.stats.altarsUsed++;
    SFX.play("altar");
    for (const ef of a.cfg.effects) this.execEffect(ef, a);
  }
  execEffect(ef, a) {
    const r = G.run, p = G.player;
    switch (ef.type) {
      case "heal": p.heal(ef.pct); UI.toast(`${a.cfg.name}：恢复 ${ef.pct * 100}% 生命`, "gold"); break;
      case "randomBuff": {
        const b = U.pick(CFG.warBuffs);
        r.buffs.push({ ...b, remain: ef.duration });
        UI.toast(`战争雕像：获得「${b.id}」${b.label}（${ef.duration}秒）`, "gold");
        break;
      }
      case "giveChest": {
        const q = U.weightedPick(ef.weights);
        const item = makeChestItem(q);
        if (r.backpack.tryStackChest(item) || (() => { const s = r.backpack.findSpot(item); return s ? (r.backpack.place(item, s.x, s.y), true) : false; })()) {
          UI.toast(`获得 ${item.name}`, "gold");
        } else UI.toast("背包已满，宝箱作废", "bad");
        break;
      }
      case "adjustMonsters": {
        const v = U.randInt(ef.range[0], ef.range[1]);
        const mul = 1 + v / 100;
        r.monsterDebuff = { hpMul: mul, atkMul: mul, remain: ef.duration };
        r.monsterHpMul = mul; r.monsterAtkMul = mul;
        UI.toast(`邪神雕像：小怪属性 ${v >= 0 ? "+" : ""}${v}%（${ef.duration}秒）`, v >= 0 ? "bad" : "gold");
        break;
      }
      case "teleport": {
        if (ef.submap === "artisan") {
          if (!r.artisanUsed) { r.artisanUsed = true; EventBus.emit("enterArtisan"); }
        }
        break;
      }
      case "rift": EventBus.emit("enterRift"); break;
      case "giveExtractToken": {
        if (!r.extractToken) { r.extractToken = true; UI.toast("▲ 获得【撤离点代币】· 按 E 任意位置读条 8 秒撤离（上限 1 个）", "gold"); }
        else UI.toast("已持有撤离点代币（上限 1 个），信标消散", "bad");
        break;
      }
      case "extract": EventBus.emit("extractSuccess"); break;
    }
  }
}

/* ---------- 障碍物碰撞 ---------- */
function resolveObstacles(e, w) {
  for (const o of w.obstacles) {
    const cx = U.clamp(e.x, o.x, o.x + o.w), cy = U.clamp(e.y, o.y, o.y + o.h);
    const dx = e.x - cx, dy = e.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < e.r && d > 0.001) {
      const push = (e.r - d);
      e.x += dx / d * push; e.y += dy / d * push;
    } else if (d === 0) { e.y = o.y - e.r; }
  }
}
function blockedByObstacle(w, x, y) {
  for (const o of w.obstacles) {
    if (x > o.x - 6 && x < o.x + o.w + 6 && y > o.y - 6 && y < o.y + o.h + 6) return true;
  }
  return false;
}

/* ============ 特效 ============ */
const FX = { parts: [], floats: [] };
function spawnBurst(x, y, color, n = 10, radius = 20) {
  for (let i = 0; i < n; i++) {
    const a = U.rand(0, Math.PI * 2), s = U.rand(40, radius * 4 + 80);
    FX.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.2, 0.55), maxLife: 0.55, color, size: U.rand(2, 5) });
  }
}
function spawnFloat(x, y, txt, color) {
  FX.floats.push({ x, y, txt, color, life: 1.1 });
}
function updateFX(dt) {
  for (const p of FX.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  FX.parts = FX.parts.filter(p => p.life > 0);
  for (const f of FX.floats) { f.y -= 34 * dt; f.life -= dt; }
  FX.floats = FX.floats.filter(f => f.life > 0);
  if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt);
}

/* ============ 渲染 ============ */
function render() {
  const ctx = G.ctx, w = G.activeWorld;
  ctx.fillStyle = (G.levelCfg && G.levelCfg.theme) || "#141a24";
  ctx.fillRect(0, 0, G.W, G.H);
  if (!w) return;
  ctx.save();
  if (G.shakeT > 0) {   // 屏幕震动（受击/Boss 爆炸），随剩余时间线性衰减
    const a = (G.shakeAmp || 0) * (G.shakeT / CFG.audio.shake.dur);
    ctx.translate(U.rand(-a, a), U.rand(-a, a));
  }
  // 摄像机：zoom 变焦 + 跟随玩家 + 地图边缘钳制（地图小于视口则居中）
  const zoom = (CFG.camera && CFG.camera.zoom) || 1;
  const viewW = G.W / zoom, viewH = G.H / zoom;
  let camX, camY;
  if (w.w <= viewW) camX = (w.w - viewW) / 2;
  else camX = U.clamp(G.player.x - viewW / 2, 0, w.w - viewW);
  if (w.h <= viewH) camY = (w.h - viewH) / 2;
  else camY = U.clamp(G.player.y - viewH / 2, 0, w.h - viewH);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);
  // 地面网格
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let x = 0; x < w.w; x += 96) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, w.h); ctx.stroke(); }
  for (let y = 0; y < w.h; y += 96) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w.w, y); ctx.stroke(); }
  // 墙
  ctx.strokeStyle = "#3a4a66"; ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w.w - 8, w.h - 8);
  // 障碍物
  for (const o of w.obstacles) {
    ctx.fillStyle = "#2a3648"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#44587a"; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  // 祭坛
  for (const a of w.altars) {
    ctx.beginPath(); ctx.arc(a.x, a.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = a.cfg.color + "33"; ctx.fill();
    ctx.strokeStyle = a.cfg.color; ctx.lineWidth = 2.5; ctx.stroke();
    // 交互圈（虚线 = 真实判定圈，直接用 cfg.radius，与判定同源）
    ctx.setLineDash([6, 6]); ctx.strokeStyle = a.cfg.color + "55";
    ctx.beginPath(); ctx.arc(a.x, a.y, a.cfg.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = a.cfg.color; ctx.fillText(a.cfg.icon, a.x, a.y);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#e8ecf2";
    ctx.fillText(a.cfg.name, a.x, a.y + 40);
    // 进度环（与雕像绑定：圈内积累，离开缓慢衰退）
    if (a.progress > 0) {
      const frac = Math.min(1, a.progress / a.cfg.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(a.x, a.y, 34, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", a.x, a.y - 44);
    }
  }
  // 工匠世界 NPC / 返回信标（虚线圈 = 判定圈，与祭坛同一契约）
  if (!w.isMain && w.kind === "artisan") {
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#ffd76a55";
    ctx.beginPath(); ctx.arc(w.npc.x, w.npc.y, 90, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    drawActor(ctx, w.npc.x, w.npc.y, 40, "#ffd76a", "⚒");
    ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ffd76a";
    ctx.fillText("工匠（靠近开箱）", w.npc.x, w.npc.y - 56);
    if (w.npcProgress > 0) {
      const frac = Math.min(1, w.npcProgress / 1.0);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w.npc.x, w.npc.y, 48, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.fillText("◀", w.exitBeacon.x, w.exitBeacon.y);
    ctx.font = "13px sans-serif"; ctx.fillText("返回出口（读条3秒）", w.exitBeacon.x, w.exitBeacon.y - 46);
    if (w.exitProgress > 0) {
      const frac = Math.min(1, w.exitProgress / 3.0);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", w.exitBeacon.x, w.exitBeacon.y - 58);
    }
  }
  // 空间裂缝返回信标：地上随机刷出，读条 5 秒（受击归零），离开圈进度保留
  if (w.kind === "rift" && w.returnBeacon) {
    const b = w.returnBeacon;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(b.x, b.y, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(b.x, b.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.fillText("◀", b.x, b.y);
    ctx.font = "13px sans-serif"; ctx.fillText(`返回信标（读条${CFG.rift.channel}秒）`, b.x, b.y - 46);
    if (w.returnProgress > 0) {
      const frac = Math.min(1, w.returnProgress / CFG.rift.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", b.x, b.y - 58);
    }
  }
  // 地上宝箱
  for (const c of w.groundChests) {
    const col = CFG.chestQualities[c.chestQ].color;
    ctx.fillStyle = col; ctx.strokeStyle = "#fff8"; ctx.lineWidth = 1.5;
    ctx.fillRect(c.x - 13, c.y - 10, 26, 20);
    ctx.strokeRect(c.x - 13, c.y - 10, 26, 20);
  }
  // 掉落物：金币 / 经验宝石
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const pk of w.pickups) {
    if (pk.type === "coin") {
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd76a"; ctx.fill();
      ctx.strokeStyle = "#8a6a1a"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#8a6a1a"; ctx.font = "bold 9px sans-serif";
      ctx.fillText("¥", pk.x, pk.y + 0.5);
    } else {
      ctx.beginPath();
      ctx.moveTo(pk.x, pk.y - 8); ctx.lineTo(pk.x + 6, pk.y);
      ctx.lineTo(pk.x, pk.y + 8); ctx.lineTo(pk.x - 6, pk.y); ctx.closePath();
      ctx.fillStyle = "#c79bff"; ctx.fill();
      ctx.strokeStyle = "#5a3a8a"; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  // 怪物
  const szMul = CFG.monsterSizeMul || 1;
  for (const m of w.monsters) {
    const img = m.sprite;
    const size = (m.d.type === "boss" ? 130 : 48) * szMul * (m.elite ? CFG.elites.sizeMul : 1);
    // 精英光环 + 词缀名
    if (m.elite) {
      const col = CFG.elites.affixes[m.elite[0]].color;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = col + "22"; ctx.fill();
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = col; ctx.fillText("精英·" + m.elite.join("·"), m.x, m.y - size / 2 - 20);
      // 护盾条
      if (m.shield > 0) {
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(m.x - 20, m.y - size / 2 - 32, 40, 4);
        ctx.fillStyle = "#6cb2ff"; ctx.fillRect(m.x - 20, m.y - size / 2 - 32, 40, 4);
      }
    }
    if (img) {
      ctx.save();
      if (m.flashT > 0) ctx.filter = "brightness(2)";
      ctx.drawImage(img, m.x - size / 2, m.y - size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = m.d.type === "boss" ? "#e5484d" : "#c96"; 
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    // 血条
    const bw = m.d.type === "boss" ? 110 : 34;
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(m.x - bw / 2, m.y - size / 2 - 12, bw, 5);
    ctx.fillStyle = m.d.type === "boss" ? "#ff5b5b" : "#e5a04b";
    ctx.fillRect(m.x - bw / 2, m.y - size / 2 - 12, bw * Math.max(0, m.hp / m.hpMax), 5);
    // 冲锋预警
    if (m.d.type === "charger" && m.state === "telegraph") {
      const ang = Math.atan2(G.player.y - m.y, G.player.x - m.x);
      ctx.strokeStyle = "#ff5b5b"; ctx.setLineDash([8, 6]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(ang) * m.d.chargeRange, m.y + Math.sin(ang) * m.d.chargeRange); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Boss 爆炸预警圈
    if (m.d.type === "boss" && m.warnT > 0) {
      const t = m.warnT / m.d.boomWarn;
      ctx.strokeStyle = `rgba(229,72,77,${0.4 + 0.4 * Math.sin(G.time * 14)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.d.boomRadius * (1 - t * 0.15), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(229,72,77,0.08)"; ctx.fill();
    }
  }
  // 弹道
  for (const b of w.playerBullets) {
    ctx.fillStyle = b.isSkill ? "#6cb2ff" : "#ffd76a";
    ctx.beginPath();
    if (b.isSkill) { ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); }
    else { ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); }
    ctx.fill();
    if (b.isSkill) { ctx.strokeStyle = "#6cb2ff66"; ctx.beginPath(); ctx.arc(b.x, b.y, b.aoe * 0.4, 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const b of w.enemyBullets) {
    ctx.fillStyle = "#c79bff";
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // 玩家
  const p = G.player;
  const heroImg = G.sprites.hero;
  if (heroImg) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.faceDir, 1);
    ctx.drawImage(heroImg, -30, -34, 60, 60);
    ctx.restore();
  } else {
    ctx.fillStyle = "#7ec8ff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  // AI 队友（组队）
  if (G.run && G.run.companions) {
    for (const c of G.run.companions) {
      if (!c.alive) {
        ctx.globalAlpha = 0.5; ctx.fillStyle = "#5a6a80";
        ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#aab6c8"; ctx.font = "bold 12px sans-serif";
        ctx.fillText("✖", c.x, c.y + 4); ctx.globalAlpha = 1;
        continue;
      }
      const img = G.sprites.hero;
      if (img) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.faceDir, 1);
        ctx.globalAlpha = 0.95;
        ctx.drawImage(img, -30, -34, 60, 60);
        ctx.restore(); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#8fd0a0"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      }
      // 头顶血条
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(c.x - 20, c.y - 40, 40, 4);
      ctx.fillStyle = "#7de08a";
      ctx.fillRect(c.x - 20, c.y - 40, 40 * Math.max(0, c.hp / c.hpMax), 4);
    }
  }
  // 陷阱（大地雷）：触发圈虚线 = 触发范围（与伤害范围同源）；引信期闪烁
  if (G.run && G.run.traps) {
    for (const t of G.run.traps) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = t.armed ? "rgba(255,91,91," + (0.5 + 0.4 * Math.sin(G.time * 18)) + ")" : "#e5a04b66";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fillStyle = "#3a4250"; ctx.fill();
      ctx.strokeStyle = "#e5a04b"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = t.armed && Math.sin(G.time * 18) > 0 ? "#ff5b5b" : "#e5a04b";
      ctx.beginPath(); ctx.arc(t.x, t.y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 召唤物（无人机）：青色机体 + 头顶血条
  if (G.run && G.run.drones) {
    for (const d of G.run.drones) {
      if (d.hp <= 0) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(G.time * 6);   // 旋翼旋转感
      ctx.strokeStyle = "#54d8e8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#54d8e8"; ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(d.x - 12, d.y - 20, 24, 3.5);
      ctx.fillStyle = "#54d8e8";
      ctx.fillRect(d.x - 12, d.y - 20, 24 * Math.max(0, d.hp / d.hpMax), 3.5);
    }
  }
  // 撤离读条环（5.2：任意位置激活，环画在队长脚下）
  const rr = G.run;
  if (rr && rr.extractChanneling && rr.extractProgress > 0) {
    const frac = Math.min(1, rr.extractProgress / CFG.extract.channel);
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(G.player.x, G.player.y, G.player.r + 16, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`撤离 ${Math.floor(frac * 100)}%`, G.player.x, G.player.y - G.player.r - 26);
  }
  // 特效
  for (const pt of FX.parts) {
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  for (const f of FX.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.font = "bold 17px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();   // 收束屏幕震动 translate
  // 屏幕空间 HUD：裂缝任务 / 诅咒状态（不受摄像机影响）
  if (G.run) {
    const t = G.run.riftTask;
    if (G.inRift && t) {
      const st = t.done ? "✔ 已完成" : t.failed ? "✘ 已失败" : (t.time ? `剩余 ${Math.max(0, Math.ceil(t.remain))}s` : "");
      ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = t.done ? "#7de08a" : t.failed ? "#ff5b5b" : "#5ad0ff";
      ctx.fillText(`◈ 任务【${t.name}】：${t.desc} ${st}`, G.W / 2, 34);
    }
    const cu = G.run.curse;
    if (cu) {
      ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#ff8c5a";
      ctx.fillText(`☠ ${cu.name} ${Math.ceil(cu.remain)}s · 敌人强化中 · 掉落 ×${cu.rewardMul}`, G.W / 2, 56);
    }
  }
}
function drawActor(ctx, x, y, size, color, icon) {
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = color + "44"; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = `${size * 0.5}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = color; ctx.fillText(icon, x, y);
}
