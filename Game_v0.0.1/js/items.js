/* ============================================================
 * items.js — 物品 / 装备 / 背包 / 遗迹秘宝构造与计算（21.16 物理搬移拆分：原 game.js 第 2 部分）
 * 职责：Inventory / UID；装备/模块/遗迹秘宝/宝箱/保险/诅咒的构造与词条计算
 *       （makeGear/makeModule/makeChip/ZERO_GEAR 等）；属性汇总 tagCalc/recomputeWeapon/computeStats；
 *       升级 4 选 1 候选与入槽（buildLevelUpCandidates/gainExp 等）；
 *       入包与商店（grantItemToRun/ChipForge/shopBuyChip…）；升级刷新 levelUpReroll。
 * ⚠️ 本文件由纯物理搬移生成：除本头部职责注释与 "use strict"; 外，代码逐字沿用原文件。
 * ============================================================ */
"use strict";
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

/* ============ 武器 / 技能等级曲线（配置驱动公式，上限 100 级） ============
 * 技能等级 = 武器等级（8.2）。曲线参数全在 CFG.weaponLevel，改参数即调全曲线；
 * lv 为 1 基（1..maxLv）。cost = 从 lv 升到 lv+1 所需的进化结晶。 */
function weaponLevelEntry(lv) {
  const w = CFG.weaponLevel;
  const n = Math.max(1, Math.min(Math.round(lv || 1), w.maxLv));
  const raw = w.costBase * Math.pow(w.costGrowth, n - 1);
  return {
    lv: n,
    basicMul: 1 + w.basicMulPerLv * (n - 1),
    skillMul: 1 + w.skillMulPerLv * (n - 1),
    cost: n >= w.maxLv ? 0 : Math.round(raw / w.costRound) * w.costRound,
  };
}

/* ============ 技能等级结算（P1：统一 skillEntry，1~100 级） ============
 * 技能效果填写三种方式（详见 js/config.js 的 CFG.skills 头注释）：
 *   ① 公式驱动：平铺字段 = LV1 基础值，按每级成长率线性放大（普攻 +4%/级、技能 +6%/级）
 *   ② 锚点插值：anchors 只填 3~5 行关键等级，区间内线性插值后取整
 *   ③ 分段公式：由 growth 扩展（数值待策划填） */

/** 锚点表线性插值：table 形如 { 1:3, 25:4, 60:5, 100:6 }
 *  取整规则：锚点值全为整数 → 向下取整；含小数 → 保留两位小数。 */
function anchorLerp(table, lv) {
  const ks = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (!ks.length) return 0;
  const allInt = ks.every((k) => Number.isInteger(table[k]));
  const round = (v) => (allInt ? Math.floor(v) : Math.round(v * 100) / 100);
  if (lv <= ks[0]) return round(table[ks[0]]);
  const last = ks[ks.length - 1];
  if (lv >= last) return round(table[last]);
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (lv >= a && lv <= b) return round(table[a] + (table[b] - table[a]) * (lv - a) / (b - a));
  }
  return round(table[last]);
}

/** 技能在不同等级下的完整数值（唯一的技能等级结算入口）。
 *  @param skill   技能表 ID（CFG.skills 的键）**或**技能条目对象本身
 *  @param lv      技能等级 = 武器等级（1..CFG.weaponLevel.maxLv）
 *  @returns 展开基础字段后的副本，dmgMul 已按等级折算、anchors 字段已插值；找不到返回 null */
function skillEntry(skill, lv) {
  const sk = (typeof skill === "string") ? CFG.skills[skill] : skill;
  if (!sk) return null;
  const w = CFG.weaponLevel;
  const n = Math.max(1, Math.min(Math.round(lv || 1), w.maxLv));
  const out = { ...sk, lv: n };
  const anchored = new Set(Object.keys(sk.anchors || {}));
  const wl = weaponLevelEntry(n);          // 曲线唯一来源：weaponLevelEntry
  // ① 公式驱动：默认只作用于 dmgMul —— 普攻 +4%/级、技能 +6%/级；
  //    未声明 kind 的条目（敌人技能 / 增益 / 减益）不吃等级伤害成长（敌人由怪物等级另行缩放）
  const dmgLevelMul = (sk.growth && sk.growth.dmgMul != null)
    ? 1 + sk.growth.dmgMul * (n - 1)
    : (sk.kind === "basic" ? wl.basicMul : (sk.kind === "skill" ? wl.skillMul : 1));
  if (out.dmgMul != null && !anchored.has("dmgMul")) out.dmgMul *= dmgLevelMul;
  for (const k in (sk.growth || {})) {
    if (k === "dmgMul" || anchored.has(k) || out[k] == null) continue;
    out[k] *= 1 + sk.growth[k] * (n - 1);   // 乘算成长（如 growth:{ cd:-0.004 }）
  }
  // ② 锚点插值：整数离散值（覆盖同名字段，不再叠加公式成长）
  for (const k in (sk.anchors || {})) out[k] = anchorLerp(sk.anchors[k], n);
  return out;
}
/** Buff 效果文案（按等级生成，供 toast 与 UI 提示使用）。
 *  stat 决定单位与方向：`cdMul` 是「越小越快」的乘算因子，显示为攻速百分比。 */
function buffEffectLabel(skillId, lv) {
  const e = skillEntry(skillId, lv);
  if (!e) return "";
  const pc = (v) => Math.round(Math.abs(v) * 100);
  switch (e.stat) {
    case "atk": return `攻击力 +${pc(e.mul - 1)}%`;
    case "spd": return `移速 +${pc(e.mul - 1)}%`;
    case "cdMul": return `攻速 +${pc(1 - e.mul)}%`;
    case "lifesteal": return `吸血 ${pc(e.mul)}%`;
    default: return e.label || `${e.stat} ×${Number(e.mul).toFixed(2)}`;
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
    weight: d.weight, value: Math.round(45 * q.valueMul), affix, lv: 1 };   // lv：武器模块等级（叠加升级 1~9）
}
/* 武器模块等级系统：主词缀有效值 = 基础值 × (1 + (lv-1) × valueStep)；阶段 = ceil(lv / perStage) */
function moduleEffValue(it) {
  const ml = CFG.moduleLevel;
  return it.affix.value * (1 + ((it.lv || 1) - 1) * (ml ? ml.valueStep : 0));
}
function moduleStage(it) {
  const ml = CFG.moduleLevel;
  return Math.min(3, Math.ceil((it.lv || 1) / (ml ? ml.perStage : 3)));
}

/* ---------- 遗迹秘宝（第十九章 19.6 / 19.11）----------
 * 遗迹秘宝 = 局内资产（出局消失、不折算），装在遗迹秘宝背包 chipInv（6×5）。
 * 白/蓝 = 数值放大（进 tagCalc 统一词条链）；紫/金 = 附加行为（第 4 步只透传 behavior 字段）。
 * defId 前缀约定：C_V_* = 数值型遗迹秘宝，C_B_* = 行为型遗迹秘宝。 */
function chipDefOf(defId, pool) {
  const c = CFG.chips;
  if (!c || !defId) return null;
  if (pool === "value") return (c.valuePool || []).find(x => x.id === defId) || null;
  if (pool === "behavior") return (c.behaviorPool || []).find(x => x.id === defId) || null;
  return (c.valuePool || []).find(x => x.id === defId) || (c.behaviorPool || []).find(x => x.id === defId) || null;
}
/** 遗迹秘宝重量（19.11.8）：数值 = (q+1)×weightMul；行为 = (q+1)×2×weightMul。系数只读 CFG.chips.weightMul。 */
function chipWeight(chip) {
  const mul = (CFG.chips && CFG.chips.weightMul != null) ? CFG.chips.weightMul : 1;
  const base = (chip.q || 0) + 1;
  return Math.round(base * (chip.behavior ? 2 : 1) * mul * 100) / 100;
}
/** 遗迹秘宝等级成长有效值（19.11.4）：复用模块 valueStep 口径：value × (1 + (lv-1) × valueStep)。 */
function chipEffValue(chip) {
  const ml = CFG.moduleLevel;
  return (chip.value || 0) * (1 + ((chip.lv || 1) - 1) * (ml ? ml.valueStep : 0));
}
/** 生成遗迹秘宝（19.11.2）：**defId 前缀决定分支**（C_V_* 数值 / C_B_* 行为），
 *  前缀缺失时才回落到 CFG.chips.qualityMode[q]（品质决定）。
 *  数值型遗迹秘宝 → { kind:"chip", defId, q, lv:1, shape, value, affix:{tag,mode,value} }
 *  行为型遗迹秘宝 → { kind:"chip", defId, q, lv:1, shape, value, behavior } */
function makeChip(defId, q) {
  const c = CFG.chips;
  const qq = (q == null || q < 0 || q > 3) ? 0 : q;
  // 分支判定：前缀优先（C_B_ = 行为）；否则查 qualityMode
  let mode;
  if (defId && defId.indexOf("C_B_") === 0) mode = "behavior";
  else if (defId && defId.indexOf("C_V_") === 0) mode = "value";
  else mode = (c.qualityMode && c.qualityMode[qq]) || "value";
  if (mode === "behavior") {
    const d = chipDefOf(defId, "behavior") || chipDefOf(defId, "value");
    const v = d && d.vals ? d.vals[qq] : 0;
    return { uid: UID++, kind: "chip", defId, q: qq, lv: 1,
      name: d ? d.name : defId, shape: c.shapes.behavior.slice(),
      weight: 0, value: v, behavior: d ? d.behavior : "burn" };
  }
  const d = chipDefOf(defId, "value") || chipDefOf(defId, "behavior");
  const v = d && d.vals ? d.vals[qq] : 0;
  return { uid: UID++, kind: "chip", defId, q: qq, lv: 1,
    name: d ? d.name : defId, shape: c.shapes.value.slice(),
    weight: 0, value: v, affix: { tag: d ? d.tag : "", mode: d ? d.mode : "mult", value: v } };
}

function makeChestItem(chestQ, count = 1) {
  const c = CFG.chestQualities[chestQ];
  /* B5 落库（2026-10-12）：占格改读配表 `CFG.chestQualities[].shape`（原为硬编码 [1,1]，
   * 违反「数值一律进 CFG」契约）；缺省仍回落 [1,1] 保证老配置不崩。 */
  const shape = (c && Array.isArray(c.shape)) ? c.shape.slice() : [1, 1];
  return { uid: UID++, kind: "chest", chestQ, name: c.name, shape: shape,
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
  const v = it.kind === "module" ? moduleEffValue(it) : it.affix.value;   // 武器模块按等级缩放后的有效值
  if (it.affix.mode === "flat") return `${it.affix.tag} +${Math.round(v * 100) / 100}`;
  return `${it.affix.tag} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
}

/* ---------- 武器词条计算（16.5：先加算后乘算；19.10.5 / 19.11.4：三源统一词条链） ----------
 * forSkill=true 时额外计入武器模块阶段词缀（阶段词缀只强化主动技能，不影响普攻基础值）。
 * 汇总顺序（同一「先加算后乘算」管线，flat 累加、mul 连乘）：
 *   ① weaponInv 旧模块（兼容期，第 3 步保留）→ ② heroModules 汇总（第 3 步新增）
 *   → ③ chipInv 数值型遗迹秘宝（第 4 步新增；行为型遗迹秘宝跳过）→ ④ 卡牌通道（恒空占位）
 * 全部来源**共用一条链**（方案 6）：不建第二条链。 */
function tagCalc(tag, forSkill) {
  const t = CFG.affixTags[tag];
  let flat = 0, mul = 1;
  const ml = CFG.moduleLevel;
  // ① weaponInv 旧模块（兼容期）
  for (const it of G.run.weaponInv.items) {
    if (it.kind === "module" && it.affix && it.affix.tag === tag) {
      const eff = moduleEffValue(it);   // 主词缀随武器模块等级成长
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
  // ② heroModules 汇总（19.10.5）：遍历全部在场英雄槽，跨英雄叠加（19.10.7 全队共享一份词条值）
  if (G.run.heroModules) {
    for (const hid in G.run.heroModules) {
      const slots = G.run.heroModules[hid];
      if (!Array.isArray(slots)) continue;
      for (const slot of slots) {
        if (!slot) continue;                                  // 空槽
        const d = (CFG.moduleDefs || []).find(m => m.id === slot.defId);
        if (!d || !d.affix || d.affix.tag !== tag) continue;
        const eff = (d.affix.vals ? d.affix.vals[0] : 0) * (1 + ((slot.lv || 1) - 1) * (ml ? ml.valueStep : 0));
        if (d.affix.mode === "flat") flat += eff;
        else mul *= (1 + eff);
        // 阶段词缀：与旧模块同一口径（forSkill 时才计）
        if (forSkill && ml && ml.stageAffixes) {
          const stage = Math.min(3, Math.ceil((slot.lv || 1) / (ml.perStage || 3)));
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
  }
  // ③ chipInv 数值型遗迹秘宝（19.11.4）：仅 kind==="chip" 且无 behavior 字段（数值型遗迹秘宝）参与
  if (G.run.chipInv && G.run.chipInv.items) {
    for (const it of G.run.chipInv.items) {
      if (it.kind !== "chip" || it.behavior) continue;         // 行为型遗迹秘宝不进数值链（19.11.5）
      if (!it.affix || it.affix.tag !== tag) continue;
      const eff = chipEffValue(it);                            // 遗迹秘宝等级成长（复用 moduleEffValue 的 valueStep 口径）
      if (it.affix.mode === "flat") flat += eff;
      else mul *= (1 + eff);
    }
  }
  // 🔴 卡牌对武器词条的加成通道已随 C6「彻底退役」物理删除（D018）。
  let v = (t.base + flat) * mul;
  v = U.clamp(v, t.min, t.max);
  if (t.round === "floor") v = Math.floor(v);
  return v;
}
/* ---------- 武器模块深度（16.7）：连接效果 + 套装效果（仅统计武器栏内武器模块） ----------
 * 连接：边相邻（共享棱）且同品质的武器模块，每对提供 linkBonus 技能伤害（几何摆放的构建收益）；
 * 套装：同系列武器模块在武器栏内集齐 N 件触发词缀强化（CFG.moduleSets，策划改表即调）。 */
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
    if (!set || !set.members) continue;      // 跳过非套装条目（如 removed 标记位）
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
/** 行为型遗迹秘宝汇总（19.11.5）：同 type 多枚取 **max**（不叠乘）。返回 {type,value} 或 null。 */
function chipBehaviorSummary() {
  const inv = G.run && G.run.chipInv;
  if (!inv || !inv.items) return null;
  const best = {};
  for (const it of inv.items) {
    if (it.kind !== "chip" || !it.behavior) continue;
    const cur = best[it.behavior];
    if (cur == null || (it.value || 0) > cur) best[it.behavior] = it.value || 0;
  }
  const keys = Object.keys(best);
  if (!keys.length) return null;
  // 同时存在多种行为时取 value 最大者作为主行为（第 5 步消费点按 type 分发；此处只透传单一主行为）
  let type = keys[0];
  for (const k of keys) if (best[k] > best[type]) type = k;
  return { type, value: best[type] };
}
/** 技能 → 本局实际数值：skillEntry（统一的 1~100 级曲线）+ 词条标签 + 武器模块连接/套装加成。
 *  普攻与主动技能共用同一条路径；召唤/陷阱额外产出 row（召唤物/陷阱属性行）。
 *  19.11.5：结果对象上**透传** behavior（行为型遗迹秘宝数据通路；第 5 步才消费）。 */
function resolveSkill(sk, lv, syn) {
  const e = skillEntry(sk, lv);          // ① 等级曲线（公式 + 锚点插值）
  const has = (t) => (sk.tags || []).includes(t);
  const isBasic = sk.kind === "basic";
  const behaves = chipBehaviorSummary();   // 行为型遗迹秘宝（紫/金）：透传字段，不参与数值链
  // 词条标签生效规则（16.5）：主动技能只有声明了该标签才吃；普攻吃除「伤害」外的全部标签
  //（「伤害」倍率与武器模块阶段词缀只强化主动技能，不影响普攻基础值，见 tagCalc）。
  const E = (t) => (isBasic ? t !== "伤害" : has(t));
  if (sk.type === "summon" || sk.type === "trap") {
    // 召唤物 / 陷阱：离散属性全部来自 anchors，伤害走「伤害 / 召唤物 / 陷阱」标签倍率
    const row = { count: e.count, hp: e.hp, atk: e.atk, fireCd: e.fireCd, orbit: e.orbit,
      dmgMul: e.dmgMul, radius: e.radius };
    return { ...e, row, behavior: behaves || undefined,
      dmgMul: (row.dmgMul || 1) * (has("伤害") ? tagCalc("伤害", true) : 1)
        * (has("召唤物") ? tagCalc("召唤物", true) : 1) * (has("陷阱") ? tagCalc("陷阱", true) : 1)
        * syn.dmgMul,
      cd: e.cd * (has("冷却") ? tagCalc("冷却", true) : 1) * syn.cdMul,
      radius: (row.radius || e.radius || 100) * (has("范围") ? tagCalc("范围", true) : 1),
      count: row.count || 1, armDelay: sk.armDelay || 0.5,
      summonMul: (has("召唤物") ? tagCalc("召唤物", true) : 1) * (has("伤害") ? tagCalc("伤害", true) : 1),
      trapMul: (has("陷阱") ? tagCalc("陷阱", true) : 1) * (has("伤害") ? tagCalc("伤害", true) : 1),
    };
  }
  // 弹道技能（普攻 / 主动）
  return { ...e, behavior: behaves || undefined,
    dmgMul: (e.dmgMul != null ? e.dmgMul : 1) * (E("伤害") ? tagCalc("伤害") : 1) * syn.dmgMul,
    cd: e.cd * (E("冷却") ? tagCalc("冷却") : 1) * syn.cdMul,
    radius: e.radius != null ? e.radius * (E("范围") ? tagCalc("范围") : 1) : e.radius,
    bullets: (e.bullets != null ? e.bullets : 1)
      + (E("弹道数量") ? tagCalc("弹道数量") + syn.bullets - CFG.affixTags["弹道数量"].base : 0),
    bulletSpd: (e.bulletSpd != null ? e.bulletSpd : 480) * (E("弹速") ? tagCalc("弹速") : 1),
    pierce: (e.pierce || 0) + (E("穿透") ? tagCalc("穿透") - CFG.affixTags["穿透"].base : 0),
    bounce: (e.bounce || 0) + (E("弹射次数") ? tagCalc("弹射次数") - CFG.affixTags["弹射次数"].base : 0),
  };
}
/** 重算全队技能（武器栏 = 小队共用的技能栏）。
 *  队长：解析结果写入 G.run.weapon.basic / .skill（保留原名，调用点与 UI 均依赖）。
 *  队友：各自解析一份 skillSet 缓存到 c.skills —— 武器栏内的武器模块（模块）
 *  对小队**所有成员**生效，按各成员自己武器的技能标签（skill.tags）过滤，
 *  等级走各自的武器等级（各自局外升级线），连接/套装加成全队共享。 */
function recomputeWeapon() {
  const syn = moduleSynergy();          // 连接（相邻同品质）+ 套装 → 全队共享的技能向加成
  G.run.moduleSyn = syn;                // 缓存给 UI 展示（连接/套装一览）
  const resolveSet = (heroDef) => {
    const ids = CFG.weapons[heroDef.weapon].skills;
    const lv = heroDef.weaponLv || 1;   // 武器等级 = 技能等级（8.2）
    return { basic: resolveSkill(CFG.skills[ids.basic], lv, syn),
             skill: resolveSkill(CFG.skills[ids.skill], lv, syn) };
  };
  const main = resolveSet(G.heroDef);
  G.run.weapon.basic = main.basic;
  G.run.weapon.skill = main.skill;
  for (const c of (G.run.companions || [])) c.skills = resolveSet(c.heroDef);
}

/* ---------- 武器栏装备（属性件）提供的属性加成 ----------
 * 16.5：武器栏 = 小队技能栏，栏内物品**对小队全体成员生效**——
 * 武器模块改技能（见 recomputeWeapon），装备改属性（队长 computeStats + 队友 companionStats）。 */
const ZERO_GEAR = { hp: 0, atk: 0, def: 0, spd: 0, summonMax: 0, trapMax: 0 };
function weaponGearBonus() {
  const b = { ...ZERO_GEAR };
  const inv = G.run && G.run.weaponInv;
  if (!inv) return b;
  for (const it of inv.items) {
    if (it.kind !== "gear" || !it.stats) continue;
    for (const k in b) if (it.stats[k]) b[k] += it.stats[k];
  }
  return b;
}
/* ---------- 局内等级成长倍率（D017 · **数据驱动**）----------
 * M(lv) = 「该等级属性 ÷ LV1 初始属性」，口径全部读 `CFG.levelUp.growth`（改平衡只改表，不动代码）：
 *   mode "add"    : 1 + rate × (lv−1)
 *   mode "mul"    : mul ^ (lv−1)
 *   mode "hybrid" : lv ≤ segLv 走 add；之后 × segMul^(lv−segLv)
 * M(1) 恒 = 1.00 —— 锁死现有迁移基准（开局属性不受本改造影响）。 */
function levelGrowthMul(lv) {
  const g = (typeof CFG !== "undefined" && CFG && CFG.levelUp && CFG.levelUp.growth) || null;
  if (!g) return 1;
  const L = Math.max(1, Math.floor(lv || 1));
  const rate = (g.rate != null) ? g.rate : 0.06;
  if (g.mode === "mul") {
    const k = (g.mul != null) ? g.mul : 1.01976;
    return Math.pow(k, L - 1);
  }
  if (g.mode === "hybrid") {
    const segLv = (g.hybrid && g.hybrid.segLv) || 30;
    const segMul = (g.hybrid && g.hybrid.segMul) || 1.01337;
    if (L <= segLv) return 1 + rate * (L - 1);
    return (1 + rate * (segLv - 1)) * Math.pow(segMul, L - segLv);
  }
  return 1 + rate * (L - 1);              // "add"（默认）
}
/** 按属性名决定是否参与等级成长（`CFG.levelUp.growth.stats`），参与则 × M(lv)。 */
function growthScale(base, stat, lv) {
  const g = (typeof CFG !== "undefined" && CFG && CFG.levelUp && CFG.levelUp.growth) || null;
  if (!g) return base;
  const stats = g.stats || ["hp", "atk", "def"];
  if (stats.indexOf(stat) < 0) return base;
  return base * levelGrowthMul(lv);
}
/* ---------- 局内增益修正（属性卡牌 + 战争雕像 Buff）----------
 * 16.5 / 8.3 / 4.4：属性卡与雕像 Buff 都是「本局内生效」的增益，**对小队全体成员生效**
 *（队长 + 全部 AI 队友），与武器栏装备同源共享。
 * 分两个通道返回，避免加算/乘算顺序歧义：
 *   add —— 加算项（属性卡 flat 值 + Buff 的吸血）
 *   mul —— 乘算项（Buff 的属性倍率 + 属性卡的冷却缩减）
 * 统一结算式：最终 = (基础值 × M(lv) + 武器栏装备 + add) × mul
 * 说明：能量系统已退役（E-β）——不再有任何能量池 / 能量回复字段参与管线。
 * ⚠️ 等级成长（M(lv)）**不在此函数**——它只对「英雄初始值」生效，故落在 computeStats / companionStats。 */
function runBonus() {
  const r = G.run;
  const add = { hp: 0, atk: 0, def: 0, spd: 0, lifesteal: 0, summonMax: 0, trapMax: 0 };
  const mul = { atk: 1, spd: 1, cd: 1 };
  for (const b of (r.buffs || [])) {          // 战争雕像 Buff（4.4）：**按等级取效果**——同一条 Buff 叠的是等级
    const e = b.skillId ? skillEntry(b.skillId, b.lv || 1) : null;
    const stat = e ? e.stat : b.stat, mv = e ? e.mul : b.mul;
    if (stat === "atk") mul.atk *= mv;
    else if (stat === "spd") mul.spd *= mv;
    else if (stat === "cdMul") mul.cd *= mv;
    else if (stat === "lifesteal") add.lifesteal += mv;
    else if (stat === "def") add.def += mv;   // 26.x：技能施加的防御护罩（AT124 灵能护罩）走平坦通道
  }
  // 🔴 属性卡牌读取通道已随 C6「彻底退役」物理删除（D018）——appliedCards 字段不再存在。
  /* B2 落库（2026-10-13，需确认 #8）：冷却类 Buff 的乘算因子设**防御性下限**（数值进 CFG）。
   * 目的：即便后续锚点/词条叠加，冷却也不会趋 0（锚点已保证，这里只加一道兜底钳制）。 */
  const cdFloorB = (CFG.buffLevel && CFG.buffLevel.cdMulFloor != null) ? CFG.buffLevel.cdMulFloor : 0;
  if (cdFloorB > 0 && mul.cd < cdFloorB) mul.cd = cdFloorB;
  /* 19.4：升级即时属性 —— 🔴 D017 起**已改为「初始值 × 倍率 M(lv)」**（见 CFG.levelUp.growth），
   * 由 computeStats / companionStats 直接施加在英雄初始值上，**不再进本函数的 add 通道**
   *（否则会与倍率重复计一次）。 */
  // 19.10.4：属性小包兜底累计（模块全满级后升级改给）——并入 add 通道，全队生效，不进 tagCalc
  const sp = r.statPackGain;
  if (sp) {
    add.hp += sp.hp || 0;
    add.atk += sp.atk || 0;
    add.def += sp.def || 0;
    add.spd += sp.spd || 0;
  }
  return { add, mul };
}
/** 队友属性：与队长同源——局内等级成长 + 武器栏装备 + 局内增益（属性卡 / 雕像 Buff）。
 *  16.5：武器栏与局内增益**对小队全体成员生效**。
 *  队友是**独立个体**：有自己的生命 / 攻击 / 防御 / 移速（能量系统已退役，E-β）。 */
function companionStats(c) {
  const r = G.run, g = weaponGearBonus(), bo = runBonus();
  /* 三大基础属性折算（26.x）：与队长 computeStats 同源同表（CFG.baseStats），全队一致生效。 */
  const bs = CFG.baseStats || {};
  const hd = c.heroDef || {};
  const sv = (hd.str || 0), av = (hd.agi || 0), iv = (hd.int || 0);
  return {
    hpMax: growthScale(c.heroDef.hp, "hp", r.lv) + g.hp + bo.add.hp + sv * ((bs.str && bs.str.hp) || 0),
    atk: Math.round((growthScale(c.heroDef.atk, "atk", r.lv) + g.atk + sv * ((bs.str && bs.str.atk) || 0)) * bo.mul.atk + bo.add.atk),
    def: growthScale(c.heroDef.def || 0, "def", r.lv) + g.def + bo.add.def,
    spd: (c.heroDef.spd + av * ((bs.agi && bs.agi.spd) || 0) + g.spd + bo.add.spd) * bo.mul.spd,
    // 召唤物 / 陷阱上限（英雄属性，限制该类型技能的上限）：同样走属性管线（基础 + 装备 + 局内增益）
    summonMax: heroUnitLimit(c.heroDef, "summon") + g.summonMax + bo.add.summonMax,
    trapMax: heroUnitLimit(c.heroDef, "trap") + g.trapMax + bo.add.trapMax,
    cdMul: bo.mul.cd * Math.max((bs.agi && bs.agi.cdFloor) || 0, 1 - av * ((bs.agi && bs.agi.cdPct) || 0)),   // 冷却缩减（属性卡「攻速」+ 增益「迅击」+ 敏捷折算）
    lifesteal: bo.add.lifesteal,      // 吸血（属性卡「吸血」+ 增益「汲血」）
    str: sv, agi: av, int: iv,        // 原值透出：scaleBy / 技能效果强度读这里
  };
}

/* ---------- 玩家属性（武器栏装备 + 局内增益 + 等级） ----------
 * 与队友 companionStats() 同源：走同一个 runBonus()（属性卡 / 雕像 Buff 全队生效）。 */
function computeStats() {
  const r = G.run, h = r.heroDef;
  const g = weaponGearBonus(), bo = runBonus();
  /* 三大基础属性折算（26.x，CFG.baseStats）：力量→生命/攻击、敏捷→移速/冷却缩减、智力→技能强度
   *（能量系统已退役 E-β，智力不再折算能量）。
   * 折算与装备、增益同源（英雄基础值 × M(lv) + 折算 + 装备 + 局内增益），str/agi/int 原值也挂到 st 上
   * ——技能执行器 withScaleBy 的 statSrc 就是本对象，技能表可直接声明 scaleBy:{stat:"str"|"agi"|"int"}。 */
  const bs = CFG.baseStats || {};
  const sv = (h.str || 0), av = (h.agi || 0), iv = (h.int || 0);
  const st = {
    hpMax: growthScale(h.hp, "hp", r.lv) + g.hp + bo.add.hp + sv * ((bs.str && bs.str.hp) || 0),
    atk: (growthScale(h.atk, "atk", r.lv) + g.atk + sv * ((bs.str && bs.str.atk) || 0)) * bo.mul.atk + bo.add.atk,
    def: growthScale(h.def || 0, "def", r.lv) + g.def + bo.add.def,
    spd: h.spd + av * ((bs.agi && bs.agi.spd) || 0) + g.spd + bo.add.spd,
    summonMax: heroUnitLimit(h, "summon") + g.summonMax + bo.add.summonMax,
    trapMax: heroUnitLimit(h, "trap") + g.trapMax + bo.add.trapMax,
    lifesteal: bo.add.lifesteal,
    spdMul: bo.mul.spd,
    cdMul: bo.mul.cd * Math.max((bs.agi && bs.agi.cdFloor) || 0, 1 - av * ((bs.agi && bs.agi.cdPct) || 0)),
    str: sv, agi: av, int: iv,            // 原值透出：scaleBy / 技能效果强度（castSupport）读这里
  };
  st.atk = Math.round(st.atk);
  applyEndlessPlayerBuff(st);          // 21.17 深渊内玩家强化（非深渊原样返回）
  return st;
}

/* ---------- 召唤物 / 陷阱上限（英雄属性，限制「该类型技能」的上限） ----------
 * 数值口径（12.3 已定）：召唤物上限 / 陷阱数量上限是**英雄属性**，走完整属性管线
 *（英雄基础值 + 武器栏装备 + 局内增益），与其它英雄初始属性同源。
 * 实际上限 = min(技能锚点数量, 英雄该属性) —— 技能等级决定「想召几架」，英雄属性决定「最多几架」。 */
function heroUnitLimit(heroDef, kind) {
  const h = heroDef || (G.run && G.run.heroDef) || G.heroDef || {};
  const v = kind === "trap" ? h.trapMax : h.summonMax;
  return v === undefined ? (CFG.unitLimit[kind === "trap" ? "trapMax" : "summonMax"] || 0) : v;
}
/** 取某成员在该类型技能上的实际上限（队长走 computeStats、队友走 companionStats，同源）。 */
function unitLimitOf(caster, kind) {
  const st = (caster && caster.isCompanion) ? companionStats(caster) : computeStats();
  const v = kind === "trap" ? st.trapMax : st.summonMax;
  return Math.max(0, Math.floor(v || 0));
}
/** 实际上限 = min(技能锚点数量, 英雄该类型上限) */
function unitCap(caster, kind, skillCount) {
  return Math.max(0, Math.min(Math.floor(skillCount || 0), unitLimitOf(caster, kind)));
}

/* ---------- 负重惩罚（9.2 线性递减；19.11.8：遗迹秘宝计入负重） ---------- */
/** 本局总负重 = 背包 + 武器栏 + 遗迹秘宝背包（遗迹秘宝重量按 19.11.8 公式单独算）。 */
function totalRunWeight() {
  const r = G.run;
  if (!r) return 0;
  let w = r.backpack.totalWeight() + (r.weaponInv ? r.weaponInv.totalWeight() : 0);
  if (r.chipInv && r.chipInv.items) for (const it of r.chipInv.items) if (it.kind === "chip") w += chipWeight(it);
  return w;
}
function weightFactor() {
  const w = totalRunWeight();
  const c = CFG.weight;
  /* 21.19 深渊负重豁免：深渊局内宝箱装备照常入包（负重数值照常显示），
   * 但不再施加移速惩罚（f 恒 1）——根因修复：用户真机反馈「深渊移速越来越慢」，
   * 即每 chestEvery 波掉宝箱 → 拾取入背包 → 超重 → weightFactor 线性降速。
   * 开关 = CFG.endless.weightFree（默认 true，策划可关）。 */
  if (typeof G !== "undefined" && G && G.inEndless &&
      typeof CFG.endless === "object" && CFG.endless && CFG.endless.weightFree !== false) {
    return { w, f: 1, over: false };
  }
  if (w <= c.threshold) return { w, f: 1, over: false };
  const f = Math.max(c.minFactor, 1 - c.slope * (w - c.threshold) / c.divisor);
  return { w, f, over: true };
}

/* ---------- 局内升级（19.4）：经验曲线 fastEarly 公式驱动 + 全队即时属性 ----------
 * 经验来源 = 参与伤害即给（19.4）：经验宝石为**中立掉落物**，任何成员拾取均入**队池**（无个人归属），
 * 因此"参与即给"由拾取制天然满足——没有"击杀者独得"的零和问题。 */
function expNextFor(lv) {
  const c = CFG.levelUp.curve;
  let v = c.base * Math.pow(c.growth, lv - 1);
  if (lv <= c.softCapLv) v *= c.softCapMul;   // 前期额外宽松：开局雪球手感
  return Math.max(1, Math.round(v));
}
/* ---------- 模块槽系统（19.10，第 3 步）----------
 * 获取 = 升级 4 选 1（每英雄独立池），入槽 = 每英雄 4 槽、同名叠加至 9 级，
 * 生效 = 所有英雄 heroModules 汇总为一份词条值喂 tagCalc（全队生效，见 19.10.7）。 */

/** 该英雄模块池 ID 列表（19.10.2 第 2 步）：perHero 未列出回落 default。 */
function heroModulePool(heroId) {
  const mp = CFG.modulePool || {};
  return (mp.perHero && mp.perHero[heroId]) || mp.default || [];
}
/** 池过滤（19.10.2 第 3 步）：剔除该英雄已满级（lv ≥ maxLv）的模块 ID。 */
function offerModuleIds(heroId) {
  const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
  const slots = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
  return heroModulePool(heroId).filter(defId => {
    const owned = slots.find(s => s && s.defId === defId);
    return !(owned && owned.lv >= maxLv);
  });
}
/** 该英雄是否还有空槽（用于槽满策略判定，19.10.3）。 */
function heroHasEmptySlot(heroId) {
  const slots = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
  return slots.some(s => s === null);
}
/** 该英雄**当前可选取**的模块 ID（2026-10-11 口径修正）：
 *  - 已持有且 lv < maxLv → 可叠层升级（**不需要空槽**）
 *  - 未持有且有空槽     → 可新装（槽满则不可选，即 makeCard 的置灰语义）
 *  与 makeCard 的 locked 判定同源，保证「候选即合法」。
 *  ⚠️ 旧口径（19.10.3 ~ §5.48）把「4 格全满」当「无可选」整体排除，
 *     导致「模块等级未满却弹出属性小包」（用户 2026-10-11 报的 bug）。
 *     「4 格全满」≠「无可选」：已持有未满级仍能叠层。 */
function heroPickableModuleIds(heroId) {
  const hasEmpty = heroHasEmptySlot(heroId);
  const slots = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
  return offerModuleIds(heroId).filter(defId => {
    const owned = slots.find(s => s && s.defId === defId);
    return owned ? true : hasEmpty;
  });
}
/** 全队成员英雄 ID 列表（队长 G.heroDef + 队友 G.team，去重保序）。
 *  与 buildHeroModuleSlots / buildModulePoolState 同一口径，见 19.10.1。 */
function teamHeroIds() {
  const ids = [];
  const hd = G.heroDef || (G.team && G.team[0]);
  if (hd && hd.id) ids.push(hd.id);
  for (const h of (G.team || [])) if (h && h.id && ids.indexOf(h.id) < 0) ids.push(h.id);
  return ids;
}
/** 全队池汇总（§5.48 起主路径改「按队友轮转绑定池」，此函数保留给单人池复用）：
 *  遍历在场英雄（队长 + 队友），对每人跑 heroPickableModuleIds(hid)；
 *  **只看「是否有可选取模块」**——满格但仍有未满级模块的英雄**保留**
 *  （2026-10-11 修正：旧口径「满格即整体跳过」会让未满级球员被误判为无可选）；
 *  汇总为 [{hid, defId}] 候选源（每条带归属英雄，选中后装到该 hid 身上）。
 *  注：主路径不再直接用它混抽，轮转逻辑见 buildLevelUpCandidates；此处保留函数供
 *  单人池（singleHeroId）与既有引用/测试使用。
 *  @param singleHeroId 可选：仅汇总该英雄（poolOverride/单人退化场景，不跨队友） */
function teamModuleOfferPool(singleHeroId) {
  const ids = singleHeroId ? [singleHeroId] : teamHeroIds();
  const src = [];
  for (const hid of ids) {
    for (const defId of heroPickableModuleIds(hid)) src.push({ hid, defId });
  }
  return src;
}
/** 构造 4 选 1 候选（19.10.6 契约；§5.48 改为**按队友轮转绑定池**）：
 *  第 i 张候选绑定第 i 个在场英雄的可用模块池（ids[i % ids.length] 轮转），
 *  卡数多于队友数时循环回绕；绑定英雄不可用（满格/池抽干）则随机换到其他可用队友池。
 *  - 模块候选 = { kind:"module", heroId, defId, name, desc, lv, locked, ownerName, ownerRoleColor }
 *    heroId = 候选**所属队友**（选中后装到他身上，见 applyLevelUpPick）
 *    ownerName / ownerRoleColor = 归属展示（界面线 B 契约）
 *    locked = 该英雄槽满且未持有 → UI 置灰（禁止选取，不静默销毁，见 19.10.3）
 *             ⚠️ 候选源已用 heroPickableModuleIds 滤除该类，此字段保留为防御 / 外部调用兜底
 *  - 兜底 = 全队都**无可选取模块**（池内全部满级 且 槽满无法新装）→ 改出属性小包 4 选 1
 *    ⚠️「4 格全满」**不等于**「无可选」：已持有未满级的模块仍可叠层升级（2026-10-11 修正）
 *  @param heroId 升级者英雄 ID（仅用于 poolOverride 回退与兜底归属，不再决定抽取范围）
 *  @param poolOverride 可选，显式指定可用 ID 池（测试/降级用）→ 仅从升级者本人抽取 */
function buildLevelUpCandidates(heroId, poolOverride) {
  const n = (CFG.levelUp && CFG.levelUp.choiceCount) || 4;
  /* W2 · 能量水晶新路径：升级者本人迁移 → 4 选 1 候选**整体换成能量水晶**（复用同一弹窗）。
   * 三重闸门（enabled + ownsHero + skillState）任一不满足 → crystalCandidates 返回 null
   * → 逐字走下方旧模块逻辑，正式默认零影响。显式池（poolOverride）不参与，避免测试语义漂移。 */
  if (!poolOverride) {
    const cc = crystalCandidates(heroId, n);
    if (cc && cc.length) return cc;
  }
  const dup = !(CFG.levelUp && CFG.levelUp.allowDuplicateOffer === false);   // 默认允许重复入选
  const weights = (CFG.modulePool && CFG.modulePool.weights) || null;
  const weighted = !!(CFG.levelUp && CFG.levelUp.weighted && weights);
  const defs = CFG.moduleDefs || [];
  const ui = (typeof UI !== "undefined") ? UI : null;
  // 归属展示快照（ownerName / ownerRoleColor）：界面线 B 契约，缺失容错
  const ownerOf = (hid) => {
    const roleDef = (ui && ui.heroRole && hid) ? ui.heroRole(hid) : null;
    return { ownerName: heroDefNameOf(hid), ownerRoleColor: roleDef ? roleDef.color : null };
  };
  // 单卡构造（19.10.3 槽位状态 + 置灰语义；候选源已保证合法，locked 仅作防御）
  const makeCard = (hid, defId) => {
    const d = defs.find(m => m.id === defId);
    const slots = (G.run && G.run.heroModules && G.run.heroModules[hid]) || [];
    const owned = slots.find(s => s && s.defId === defId);
    const lv = owned ? Math.min(9, owned.lv + 1) : 1;   // 入槽后等级（UI 展示）
    // 置灰边界（19.10.3）：仅「未持有 + 无空槽」置灰；已持有 lv<9 永不置灰
    const locked = !owned && !heroHasEmptySlot(hid);
    const o = ownerOf(hid);
    return { kind: "module", heroId: hid, defId, name: d ? d.name : defId,
      desc: d ? affixPreview(d) : "", lv, locked,
      ownerName: o.ownerName, ownerRoleColor: o.ownerRoleColor };
  };
  // 出候选：从给定候选源 [{hid, defId}] 抽 n 个（poolOverride 分支复用，语义不变）
  const buildFrom = (src) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!src.length) break;
      let pick;
      if (weighted) {
        const w = {}; for (const s of src) w[s.defId] = weights[s.defId] != null ? weights[s.defId] : 1;
        const chosenId = String(U.weightedPick(w));
        pick = src.find(s => s.defId === chosenId) || src[U.randInt(0, src.length - 1)];
      } else pick = src[U.randInt(0, src.length - 1)];
      const hid = pick.hid, defId = pick.defId;
      out.push(makeCard(hid, defId));
      if (!dup) { const k = src.findIndex(s => s.defId === defId && s.hid === hid); if (k >= 0) src.splice(k, 1); }
    }
    return out;
  };
  // poolOverride：显式池 → 仅从升级者本人抽取（兼容既有测试/降级用法）
  if (poolOverride) {
    if (!poolOverride.length) return statPackCandidates();
    const pick = heroPickableModuleIds(heroId);      // 显式池 ∩ 可选取（满格未满级仍可升级）
    const src = poolOverride.filter(defId => pick.indexOf(defId) >= 0).map(defId => ({ hid: heroId, defId }));
    if (!src.length) return statPackCandidates();
    const out = buildFrom(src);
    if (out.length && out.every(c => c.locked)) return statPackCandidates();
    return out;
  }
  // 按队友轮转绑定池（§5.48）：第 i 张卡绑第 i 个在场英雄的池，循环回绕，绑定不可用则随机换
  const ids = teamHeroIds();
  const avail = ids.filter(hid => heroPickableModuleIds(hid).length > 0);   // 2026-10-11：满格但可叠层 → 仍可用
  if (!avail.length) return statPackCandidates();
  const taken = new Set();   // "hid|defId"，dup=false 时防重
  const out = [];
  for (let i = 0; i < n; i++) {
    // a. 轮转绑定：第 i 张卡 → 第 i 个在场英雄（ids 空则无绑定）
    let hid = ids.length ? ids[i % ids.length] : null;
    // b. 绑定英雄不可用（无空槽 / 池空）→ 从可用集合随机换一个
    if (!hid || avail.indexOf(hid) < 0) hid = avail[U.randInt(0, avail.length - 1)];
    // c. 取该英雄可抽项（dup=false 时剔除已抽过的 hid|defId）
    const candsOf = (h) => heroPickableModuleIds(h).filter(defId => dup || !taken.has(h + "|" + defId));
    let cands = candsOf(hid);
    // d. 候选被去重抽干 → 从 avail 随机换一个「还有未抽过项」的英雄；仍无 → 结束出卡
    if (!cands.length) {
      const remain = avail.filter(h => candsOf(h).length > 0);
      if (!remain.length) break;
      hid = remain[U.randInt(0, remain.length - 1)];
      cands = candsOf(hid);
    }
    // e. 从 cands 抽 1 个 defId（weighted 启用时仅在本候选集上加权，否则随机）
    let defId;
    if (weighted) {
      const w = {}; for (const id of cands) w[id] = weights[id] != null ? weights[id] : 1;
      defId = String(U.weightedPick(w));
      if (cands.indexOf(defId) < 0) defId = cands[U.randInt(0, cands.length - 1)];
    } else defId = cands[U.randInt(0, cands.length - 1)];
    // f. 记去重 + 构造候选卡（复用单卡构造，逐位同旧版）
    taken.add(hid + "|" + defId);
    out.push(makeCard(hid, defId));
  }
  if (!out.length) return statPackCandidates();
  // 极端保险：若候选全部被置灰，降级为属性小包
  if (out.every(c => c.locked)) return statPackCandidates();
  return out;
}
/** 模块主词缀预览文案（供弹窗 desc）。 */
function affixPreview(d) {
  const v = d.affix.vals ? d.affix.vals[0] : 0;
  if (d.affix.mode === "flat") return `${d.affix.tag} +${v}`;
  return `${d.affix.tag} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
}
/** 属性小包候选 4 选 1（19.10.4 兜底）。 */
function statPackCandidates() {
  return (CFG.levelUp.statPack || []).map(p => ({ kind: "statPack", packId: p.id, name: p.name, stat: p.stat, value: p.value }));
}

/* ============================================================================
 * 能量水晶候选（W2 · 能量水晶系统「启用」批次）
 * ----------------------------------------------------------------------------
 * ⚠️ 术语消歧：本段的 "crystal" = **能量水晶**（`CFG.skillSystem.crystalDefs` / CR_*，作用
 *    单个角色武器中的技能），**不是**局外货币「进化结晶」（`CFG.settleConvert`）。
 *
 * 生效条件（三重闸门，任一不满足 → 返回 null，调用方**逐字回落旧模块候选**）：
 *   ① `SkillRuntime.ownsHero(hero)` —— 该英雄确实走新路径（含 `CFG.skillSystem.enabled`）；
 *   ② 英雄身上挂有 `skillState`（由自举/试玩块懒注入并已编译）；
 *   ③ `CFG.skillSystem.crystalDefs` 存在。
 * 即：**未通电时本段代码路径不可达**，正式默认零影响。
 * ========================================================================== */

/** 取英雄运行时实体（队长 / 队友）；缺失返回 null。 */
function skillHeroEntityOf(hid) {
  if (typeof G === "undefined" || !G) return null;
  if (G.player && G.player.id === hid) return G.player;
  const lists = [G.companions, G.run && G.run.companions];
  for (const arr of lists) {
    if (!Array.isArray(arr)) continue;
    for (const c of arr) if (c && c.id === hid) return c;
  }
  return null;
}
/** 该英雄是否走能量水晶新路径（唯一判定入口 = SkillRuntime.ownsHero，不自行拼条件）。 */
function heroOnCrystalPath(hid) {
  if (typeof SkillRuntime === "undefined" || !SkillRuntime || typeof SkillRuntime.ownsHero !== "function") return false;
  const e = skillHeroEntityOf(hid) || { id: hid };
  try { return !!SkillRuntime.ownsHero(e); } catch (err) { return false; }
}
/** 英雄已通电的技能状态（未编译/未挂 → null）。 */
function heroSkillState(hid) {
  const e = skillHeroEntityOf(hid);
  return (e && e.skillState && e.skillState.builds) ? e.skillState : null;
}
/** 能量水晶显示名（文案表 → 回退 id）。 */
function crystalNameOf(cid, def) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  const p = def && def.presentation;
  const key = (p && p.nameKey) || (def && def.nameKey) || null;
  const loc = (t && t.localization) || {};
  return (key && loc[key]) || cid;
}
/** 品质（{id,name,color,rank}）；无品质配置 → null（界面回落中性色）。
 *  ⚠️ `qualityDefs` 在 config 里是**数组**（档数 = 长度，可扩到 100+），不是 id→def 的映射 ——
 *  两种形态都兼容（数组按 id 查找；映射直接取键），避免「品质色永远取不到」这类静默降级。 */
function crystalQualityOf(def) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  const qid = def && def.qualityId;
  if (!qid) return null;
  const src = t && t.qualityDefs;
  let q = null;
  if (Array.isArray(src)) {
    for (const one of src) if (one && one.id === qid) { q = one; break; }
  } else if (src && typeof src === "object") {
    q = src[qid] || null;
  }
  if (!q) return { id: qid, name: qid, color: null, rank: 0 };
  const loc = (t && t.localization) || {};
  return { id: qid, name: (q.nameKey && loc[q.nameKey]) || qid, color: q.color || null,
    rank: (typeof q.rank === "number") ? q.rank : 0 };
}
/** 卡面描述：取水晶的 localized 说明（`presentation.detailKey` 优先，兼容 descKey/summaryKey；
 *  全缺失则空串，界面不显示该行）。 */
function crystalDescOf(def) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  const p = def && def.presentation;
  const key = p && (p.detailKey || p.descKey || p.summaryKey);
  const loc = (t && t.localization) || {};
  return (key && loc[key]) || "";
}
/** 卡面「辅助矩阵」：该水晶对**每个技能**的作用状态（生效 / 冲突 / 不适用）。
 *  真源 = `SupportCompiler.preview` 编译后的 explanations（不自行推断规则，合同 §13）。 */
function crystalMatrixOf(st, cid, mode) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  const out = [];
  const skillIds = Object.keys((st && st.skills) || {}).sort();
  if (!t) return out;
  let exps = null;
  try {
    if (typeof SupportCompiler !== "undefined" && SupportCompiler && typeof SupportCompiler.preview === "function") {
      const pv = SupportCompiler.preview(st, { kind: mode, crystalId: cid, definitions: t });
      exps = (pv && pv.result && pv.result.explanations) || null;
    }
  } catch (e) { exps = null; }
  for (const sid of skillIds) {
    const def = (t.skillDefs && t.skillDefs[sid]) || null;
    const nameKey = (def && def.presentation && def.presentation.nameKey) || (def && def.nameKey) || null;
    const loc = t.localization || {};
    const sname = (nameKey && loc[nameKey]) || sid;
    let status = "inactive";
    if (exps) {
      for (const e of exps) {
        if (e && e.crystalId === cid && e.skillId === sid) { status = e.status || "inactive"; break; }
      }
    }
    out.push({ skillId: sid, skillName: sname, status: status });
  }
  return out;
}
/** 该英雄当前**可取**的水晶 id 列表：
 *  已装且未满级 → 可升级；未装且槽未满 → 可新装；未装且槽满 / 已满级 → 不可取。 */
function heroCrystalPickableIds(st) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  if (!t || !t.crystalDefs || !st) return [];
  const slotCount = st.slotCount || t.slotCount || 4;
  const owned = {};
  for (const c of (st.crystals || [])) if (c && c.crystalId) owned[c.crystalId] = c;
  const used = Object.keys(owned).length;
  const out = [];
  for (const cid of Object.keys(t.crystalDefs).sort()) {
    const def = t.crystalDefs[cid] || {};
    const maxLv = Array.isArray(def.levels) ? def.levels.length : 1;
    const cur = owned[cid];
    if (cur) { if ((cur.level || 1) < maxLv) out.push(cid); }
    else if (used < slotCount) out.push(cid);
  }
  return out;
}
/** 单张能量水晶候选卡（形态与模块卡对齐，UI 侧同一条渲染链）。 */
function crystalCard(heroId, crystalId, st, owner, mode) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  const def = (t && t.crystalDefs && t.crystalDefs[crystalId]) || {};
  const maxLv = Array.isArray(def.levels) ? def.levels.length : 1;
  let cur = null;
  for (const c of (st.crystals || [])) if (c && c.crystalId === crystalId) { cur = c; break; }
  const lv = cur ? Math.min(maxLv, (cur.level || 1) + 1) : 1;
  const slotCount = st.slotCount || t.slotCount || 4;
  const locked = !cur && (st.crystals || []).length >= slotCount;
  return {
    kind: "crystal", heroId: heroId, crystalId: crystalId,
    name: crystalNameOf(crystalId, def), desc: crystalDescOf(def),
    lv: lv, maxLv: maxLv, locked: locked, isUpgrade: !!cur, quality: crystalQualityOf(def),
    matrix: crystalMatrixOf(st, crystalId, mode || (cur ? "upgrade" : "install")),
    ownerName: owner.ownerName, ownerRoleColor: owner.ownerRoleColor,
  };
}
/** 能量水晶 4 选 1（W2）：返回 null = 「该英雄不走新路径 / 无可取水晶」→ 调用方回落旧模块候选。 */
function crystalCandidates(heroId, n) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  if (!t || !t.crystalDefs) return null;
  if (!heroOnCrystalPath(heroId)) return null;
  const st = heroSkillState(heroId);
  if (!st) return null;
  const pool = heroCrystalPickableIds(st);
  if (!pool.length) return null;
  /* 出池权重复用既有奖励池表 `rewardPools.POOL_LEVELUP`（数据驱动，权重不写死在逻辑里）；
   * 池表缺失/为空 → 等权随机（降级不阻断）。池内未列出的水晶不出（与模块池同口径）。 */
  const poolDef = (t.rewardPools && t.rewardPools.POOL_LEVELUP) || null;
  const entries = (poolDef && Array.isArray(poolDef.entries)) ? poolDef.entries : null;
  const weightOf = {};
  if (entries) for (const e of entries) if (e && e.crystalId) weightOf[e.crystalId] = (e.weight != null ? e.weight : 1);
  const listed = entries ? pool.filter(cid => weightOf[cid] != null) : pool;
  const src = listed.length ? listed : pool;
  const count = n || (CFG.levelUp && CFG.levelUp.choiceCount) || 4;
  const allowDup = !(CFG.levelUp && CFG.levelUp.allowDuplicateOffer === false);
  const ui = (typeof UI !== "undefined") ? UI : null;
  const roleDef = (ui && ui.heroRole && heroId) ? ui.heroRole(heroId) : null;
  const owner = { ownerName: heroDefNameOf(heroId), ownerRoleColor: roleDef ? roleDef.color : null };
  const out = [];
  const taken = {};
  for (let i = 0; i < count; i++) {
    const cands = allowDup ? src : src.filter(cid => !taken[cid]);
    if (!cands.length) break;
    let cid = cands[U.randInt(0, cands.length - 1)];
    if (entries && typeof U.weightedPick === "function") {
      const w = {}; for (const id of cands) w[id] = (weightOf[id] != null ? weightOf[id] : 1);
      const got = String(U.weightedPick(w));
      if (cands.indexOf(got) >= 0) cid = got;
    }
    taken[cid] = 1;
    out.push(crystalCard(heroId, cid, st, owner));
  }
  return out.length ? out : null;
}
/** 能量水晶入装结算（W2）：升级已有 → level+1；未持有 → 占空槽 level=1。
 *  写回沿用 `_installRareSkill` 的口径 —— 先备份 → 重编译 → 失败整体回滚。 */
function applyCrystalPick(heroId, crystalId) {
  const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  const st = heroSkillState(heroId);
  if (!t || !st) return false;
  const def = (t.crystalDefs && t.crystalDefs[crystalId]) || null;
  if (!def) return false;
  const crystals = (st.crystals || []).map(c => ({ crystalId: c.crystalId, level: c.level || 1, slot: c.slot }));
  let idx = -1;
  for (let i = 0; i < crystals.length; i++) if (crystals[i].crystalId === crystalId) { idx = i; break; }
  const maxLv = Array.isArray(def.levels) ? def.levels.length : 1;
  const slotCount = st.slotCount || t.slotCount || 4;
  if (idx >= 0) {
    if ((crystals[idx].level || 1) >= maxLv) return false;
    crystals[idx].level = (crystals[idx].level || 1) + 1;
  } else {
    if (crystals.length >= slotCount) return false;
    crystals.push({ crystalId: crystalId, level: 1, slot: crystals.length });
  }
  /* 槽位按 ID 规范重排（与编译器同一排序口径，槽位排列不影响结果） */
  crystals.sort((a, b) => String(a.crystalId) < String(b.crystalId) ? -1 : (String(a.crystalId) > String(b.crystalId) ? 1 : 0));
  for (let i = 0; i < crystals.length; i++) crystals[i].slot = i;

  const prev = { crystals: st.crystals, groupVersion: st.groupVersion, builds: st.builds };
  st.crystals = crystals;
  st.groupVersion = (st.groupVersion || 1) + 1;
  let res = null;
  try {
    if (typeof SupportCompiler === "undefined" || !SupportCompiler || typeof SupportCompiler.compile !== "function") res = null;
    else res = SupportCompiler.compile({ heroId: st.heroId || heroId, state: st, definitions: t });
  } catch (e) { res = null; }
  if (!res || !res.ok || !res.builds) {
    st.crystals = prev.crystals; st.groupVersion = prev.groupVersion; st.builds = prev.builds;
    return false;
  }
  st.builds = res.builds;
  return true;
}
/** 入槽结算（19.10.3）：
 *  - 已持有且 lv<9 → 该槽 lv += stackLevelUp（不新增槽）
 *  - 未持有且有空槽 → 第一个空槽放入 lv=1
 *  - 未持有且 4 槽全满 → 不落槽（应已被置灰；此处兜底直接忽略） */
function applyHeroModulePick(heroId, defId) {
  const r = G.run;
  if (!r || !r.heroModules) return false;
  const slots = r.heroModules[heroId] || (r.heroModules[heroId] = new Array((CFG.moduleSlot && CFG.moduleSlot.perHero) || 4).fill(null));
  const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
  const step = (CFG.moduleSlot && CFG.moduleSlot.stackLevelUp) || 1;
  const owned = slots.find(s => s && s.defId === defId);
  if (owned) {
    if (owned.lv >= maxLv) return false;
    owned.lv = Math.min(maxLv, owned.lv + step);
    return true;
  }
  const idx = slots.indexOf(null);
  if (idx < 0) return false;                 // 槽满且未持有 → 拒绝（置灰路径）
  slots[idx] = { defId, lv: 1 };
  return true;
}
/** 属性小包结算（19.10.4）：累加到 G.run.statPackGain（供 runBonus().add 读取，全队生效）。 */
function applyStatPack(pack) {
  const r = G.run;
  if (!r || !pack) return false;
  if (!r.statPackGain) r.statPackGain = { hp: 0, atk: 0, def: 0, spd: 0 };
  if (r.statPackGain[pack.stat] == null) return false;
  r.statPackGain[pack.stat] += pack.value || 0;
  return true;
}
/** 结算一个 4 选 1（按候选 kind 分发）；返回是否成功。
 *  ⚠️ 全队混抽（§5.47）后**入槽必须用候选所属英雄 cand.heroId**，而非升级者 heroId——
 *  否则「给队友补强」会装错人（本次改动的关键正确性约束）。 */
function applyLevelUpPick(heroId, cand) {
  if (!cand) return false;
  if (cand.kind === "statPack") return applyStatPack(cand);
  if (cand.kind === "crystal") return applyCrystalPick(cand.heroId || heroId, cand.crystalId);   // W2 能量水晶
  if (cand.kind === "module") {
    const owner = cand.heroId || heroId;   // 候选自带归属；缺失时回退升级者（兼容旧形态）
    return applyHeroModulePick(owner, cand.defId);
  }
  return false;
}
/** 弹出一次 4 选 1（19.10.6 契约）：调 UI.onLevelUpChoice(candidates, onPick)。
 *  ⚠️ 无 DOM / UI 未就绪（没有 onLevelUpChoice 函数）时走**默认路径**：自动选第一个可选候选，
 *  绝不能让主循环卡死（铁律）。 */
function presentLevelUpChoice(heroId) {
  const cands = buildLevelUpCandidates(heroId);
  const done = (idx) => {
    const cand = cands[idx];
    applyLevelUpPick(heroId, cand);
    recomputeWeapon();       // 入槽后立即重算全队技能（模块词条生效）
    finishLevelUpChoice(heroId);
  };
  const ui = (typeof UI !== "undefined") ? UI : null;
  if (ui && typeof ui.onLevelUpChoice === "function") {
    setPaused(true);         // 弹窗暂停闸门：主循环跳过世界/玩家/同伴更新（渲染照常）
    /* 归属元信息（界面线 C1 契约，第 3 个参数可选）：让弹窗能显示「给谁选强化」+ 槽位进度。
     * roleColor 用 UI.heroRole（19.2 定位色）；slotUsed 取 heroModules 中已占槽数（19.10）。 */
    const hd = (G.run && G.run.heroDef) || (G.team && G.team[0]) || null;
    const slots = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
    let slotUsed = 0;
    for (let i = 0; i < slots.length; i++) if (slots[i]) slotUsed++;
    const roleDef = (ui.heroRole && heroId) ? ui.heroRole(heroId) : null;
    const meta = {
      heroId,
      heroName: heroDefNameOf(heroId),
      roleColor: roleDef ? roleDef.color : null,
      slotUsed,
      slotPer: slots.length || ((CFG.moduleSlot && CFG.moduleSlot.perHero) || 4),
    };
    ui.onLevelUpChoice(cands, (idx) => done((idx >= 0 && idx < cands.length) ? idx : 0), meta);
    return;
  }
  // 默认路径：自动选第一个「非置灰」候选（没有则取第 0 个），保证升级结算永不悬挂
  let pick = cands.findIndex(c => !c.locked);
  if (pick < 0) pick = 0;
  done(pick);
}
function gainExp(v) {
  const r = G.run, c = CFG.levelUp.curve;
  if (r.lv >= c.maxLv) return;                 // 局内等级封顶（与 99 关主线对齐）
  r.exp += v;
  const ups = [];
  while (r.exp >= r.expNext && r.lv < c.maxLv) {
    r.exp -= r.expNext; r.lv++;
    r.expNext = expNextFor(r.lv);
    spawnFloat(G.player.x, G.player.y - 44, `LV ${r.lv}！`, "#c79bff");
    SFX.play("levelup");
    UI.toast(`升级！LV ${r.lv}（全队属性提升）`, "gold");
    ups.push(r.lv);
  }
  if (r.lv >= c.maxLv) r.exp = 0;              // 封顶后经验不再累积
  // 19.10.2 第 7 步：多级连升排队逐个弹（第 1 个结算完才弹第 2 个）
  if (ups.length) beginLevelUpChoices(G.heroDef.id, ups.length);
}
/** 入队 N 次 4 选 1 并驱动队列；队列空才恢复（解除暂停）。 */
let _levelUpActive = false;      // 模块内闸门（避免单测只加载 game.js 时访问未定义的 Game）
function setPaused(v) {
  if (typeof Game !== "undefined") Game.paused = v;
}
function isPaused() {
  return typeof Game !== "undefined" && Game.paused === true;
}
function beginLevelUpChoices(heroId, n) {
  const r = G.run;
  if (!r) return;
  if (!r.modulePoolState) r.modulePoolState = buildModulePoolState();
  const st = r.modulePoolState[heroId] || (r.modulePoolState[heroId] = { offered: [], queue: [] });
  for (let i = 0; i < n; i++) st.queue.push(1);
  if (!_levelUpActive) { _levelUpActive = true; presentLevelUpChoice(heroId); }
}
/** 一次 4 选 1 完成后的收尾（由 presentLevelUpChoice 的 onPick 回调触发）：
 *  出队 → 队列还有则弹下一个 → 全部完成才解除暂停。 */
function finishLevelUpChoice(heroId) {
  const r = G.run;
  const st = r && r.modulePoolState && r.modulePoolState[heroId];
  if (st && st.queue.length) st.queue.shift();
  if (st && st.queue.length) { presentLevelUpChoice(heroId); return; }
  _levelUpActive = false;
  setPaused(false);
  const ui = (typeof UI !== "undefined") ? UI : null;
  if (ui && typeof ui.onLevelUpChoiceClose === "function") ui.onLevelUpChoiceClose();
}


/* ---------- 属性卡牌：✅ 已随 C6「彻底退役」物理删除（D018） ----------
 * 原 `rollCardQuality` / `drawCardCandidates` / `useCard` / `refreshCards` 四个函数**整体移除**。
 * 职能去向见 js/config.js 的卡牌墓碑注释（升级加属性 → CFG.levelUp.growth；
 * 4 档品质构筑 → CFG.chips 遗迹秘宝；个人技能构筑 → 能量水晶）。
 * 🔒 新代码不得再引入卡牌系统。 */

/* ---------- 工匠世界金币服务（规则 2：局内金币三用途之二三 —— 购买武器模块 / 购买道具） ----------
 * 交易接口契约（界面层按此调用）：返回 {ok:boolean, msg:string}；
 * 内部完成金币判定与扣除、物品生成与入包、失败原因文案；不调 UI.toast（统一由界面层提示）。
 * 背包放不下 → 物品放入 r.pendingItems（工匠待分配区，与开箱/商店同机制）。
 * 仅工匠世界内可用（G.inArtisan），否则拒绝。 */
const QUAL_KEY_INDEX = { normal: 0, advanced: 1, epic: 2, divine: 3 };   // 品质名 → itemQualities 下标
/* 物品入包（唯一入口）：保险先叠加未满堆叠 → 宝箱按品质叠加 → 找空位放置。
 * 两种「放不下」语义由 opts.full 决定（默认 pending）：
 *   - "pending"（默认）：放入 r.pendingItems（工匠待分配区，与开箱/商店同机制）——用于工匠世界与宝箱开箱；
 *   - "discard"：直接丢弃不保留（主地图精英掉落 / 战争雕像宝箱：一张地图无待分配区，满即作废）。
 * 返回 true = 已入背包；false = 未入背包（pending 时已进待分配区 / discard 时已丢弃）。
 * 六处入包调用统一走此函数，勿再内联手抄（详见 G_docs/dev_guide.md 第 5 节）。 */
function grantItemToRun(r, item, opts) {
  const mode = (opts && opts.full) || "pending";
  if (item.kind === "insurance") {
    const exist = r.backpack.items.find(x => x.kind === "insurance" && x.count < CFG.insurance.maxStack);
    if (exist) { exist.count++; exist.value = CFG.insurance.value * exist.count; return true; }
  }
  if (r.backpack.tryStackChest(item)) return true;
  const s = r.backpack.findSpot(item);
  if (s) { r.backpack.place(item, s.x, s.y); return true; }
  if (mode === "pending") r.pendingItems.push(item);
  return false;
}
/* ---------- 遗迹秘宝入包（19.11.3）：遗迹秘宝进 chipInv（6×5）；同名同品质可叠（lv+1，上限 9）。 ----------
 * 返回 true = 已入 chipInv；false = chipInv 满 → 进 r.pendingItems（工匠待分配区）。 */
function grantChipToRun(r, chip) {
  if (!r.chipInv) return false;
  // 同名同品质叠加（19.11.6 merge 之外的自然叠层：获得即叠）
  const maxLv = (r.chipInv && CFG.chips.maxStack) || 9;
  for (const it of r.chipInv.items) {
    if (it.kind === "chip" && it.defId === chip.defId && it.q === chip.q && (it.lv || 1) < maxLv) {
      it.lv = Math.min(maxLv, (it.lv || 1) + 1);
      return true;
    }
  }
  const s = r.chipInv.findSpot(chip);
  if (s) { r.chipInv.place(chip, s.x, s.y); seenChip(chip); return true; }
  r.pendingItems.push(chip);
  seenChip(chip);
  return false;
}
/** 开箱是否落遗迹秘宝（19.11.3）：按 CFG.chipSources.chest.weight（26）判定（与装备/消耗品并列，不互斥）。
 *  rng 可注入（测试用）；返回遗迹秘宝实例或 null。 */
function rollChestChip(rng) {
  const src = CFG.chipSources && CFG.chipSources.chest;
  if (!src || src.enabled === false) return null;
  const R = rng || Math.random;
  // 权重口径：以 chipSources.chest.weight 为「每箱遗迹秘宝权重」，其余内容视作基准 100 → 概率 = w/(100+w)
  const total = 100 + (src.weight || 0);
  if (R() * total >= (src.weight || 0)) return null;
  const q = Number(U.weightedPick({ 0: src.itemQW[0], 1: src.itemQW[1], 2: src.itemQW[2], 3: src.itemQW[3] }, R));
  const mode = (CFG.chips.qualityMode && CFG.chips.qualityMode[q]) || "value";
  const pool = mode === "behavior" ? CFG.chips.behaviorPool : CFG.chips.valuePool;
  const def = pool[U.randInt(0, pool.length - 1)];
  return makeChip(def.id, q);
}
/** 遗迹秘宝图鉴（19.11.7）：只记录「见过的遗迹秘宝」（局外 Meta.data.chipSeen），不加属性、不折算。 */
function seenChip(chip) {
  if (!chip) return;
  try {
    if (!Meta.data.chipSeen) Meta.data.chipSeen = {};
    Meta.data.chipSeen[chip.defId] = true;
    Meta.commit();
  } catch (e) { /* 无 localStorage 环境忽略 */ }
}
function chipSeen(defId) {
  return !!(Meta.data && Meta.data.chipSeen && Meta.data.chipSeen[defId]);
}
/** 商店购买随机遗迹秘宝（19.11.3）：契约沿用 §5.25 —— 返回 {ok,msg}，内部判款/扣款/生成/入包，不调 UI.toast。 */
function shopBuyChip(defId) {
  if (!G.inArtisan || !G.run) return { ok: false, msg: "仅可在遗迹工坊内购买" };
  const r = G.run, src = CFG.chipSources && CFG.chipSources.shop;
  if (!src || src.enabled === false) return { ok: false, msg: "遗迹秘宝商店未开放" };
  const cost = src.cost || 0;
  if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
  r.coin -= cost;
  let chip;
  if (defId) chip = makeChip(defId, rollChipQualityByWeights(src.qualityWeights));
  else {
    const q = rollChipQualityByWeights(src.qualityWeights);
    const mode = (CFG.chips.qualityMode && CFG.chips.qualityMode[q]) || "value";
    const pool = mode === "behavior" ? CFG.chips.behaviorPool : CFG.chips.valuePool;
    chip = makeChip(pool[U.randInt(0, pool.length - 1)].id, q);
  }
  const placed = grantChipToRun(r, chip);
  return { ok: true, msg: placed ? `已购买：${chip.name}` : `已购买：${chip.name}（遗迹秘宝背包已满，已放入待分配区）` };
}
/** 按品质权重抽 q（weights 为 [w0,w1,w2,w3]）。 */
function rollChipQualityByWeights(weights) {
  const w = weights || [55, 28, 14, 3];
  return Number(U.weightedPick({ 0: w[0], 1: w[1], 2: w[2], 3: w[3] }));
}
/* ---------- 遗迹工坊三服务（19.11.6）：merge / reroll / craft，统一 {ok,msg}，UI 弹 toast ----------
 * 前置校验 → 消耗金币 → 成功分支 / 失败分支（不改变遗迹秘宝）。仅工匠世界可用。 */
const ChipForge = {
  /** 在 chipInv 内按 uid 找遗迹秘宝。 */
  _find(r, uid) { return (r.chipInv ? r.chipInv.items : []).find(it => it.kind === "chip" && it.uid === uid) || null; },
  /** 合成（merge）：选中 ≥2 枚同名同品质 → 目标 lv+1（上限 9），消耗被合遗迹秘宝。 */
  merge(r, opts) {
    const cost = CFG.chipForge.services.merge.cost;
    const uid = opts && opts.uid;
    const target = uid != null ? this._find(r, uid) : null;
    if (!target) return { ok: false, msg: "未选中目标遗迹秘宝" };
    if ((target.lv || 1) >= CFG.chips.maxStack) return { ok: false, msg: "该遗迹秘宝已达满级 9" };
    const others = r.chipInv.items.filter(it => it.kind === "chip" && it !== target && it.defId === target.defId && it.q === target.q);
    if (others.length < 1) return { ok: false, msg: "需至少 2 枚同名同品质遗迹秘宝" };
    if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
    r.coin -= cost;
    // 消耗 1 枚被合遗迹秘宝 → 目标 lv+1（同名同品质）
    const consume = others[0];
    r.chipInv.remove(consume);
    target.lv = Math.min(CFG.chips.maxStack, (target.lv || 1) + 1);
    return { ok: true, msg: `合成成功：${target.name} → LV${target.lv}` };
  },
  /** 重铸（reroll）：重掷词条档位（value = vals[新q] 中的档位），保留 defId / tag / 类型。 */
  reroll(r, opts) {
    const cost = CFG.chipForge.services.reroll.cost;
    const uid = opts && opts.uid;
    const chip = uid != null ? this._find(r, uid) : null;
    if (!chip) return { ok: false, msg: "未选中遗迹秘宝" };
    if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
    r.coin -= cost;
    // 重掷档位：在 vals 里挑一个（保留 defId / tag / behavior，只改 value 档位数值）
    const d = chipDefOf(chip.defId);
    if (d && d.vals) {
      const newQ = Number(U.randInt(0, d.vals.length - 1));
      chip.q = newQ;
      chip.value = d.vals[newQ];
    }
    return { ok: true, msg: `重铸完成：${chip.name}（词条数值重掷）` };
  },
  /** 定向合成（craft）：生成 1 枚指定 defId 遗迹秘宝，品质按 shop.qualityWeights。 */
  craft(r, opts) {
    const cost = CFG.chipForge.services.craft.cost;
    const defId = opts && opts.defId;
    if (!defId) return { ok: false, msg: "未指定要合成的遗迹秘宝" };
    if (!chipDefOf(defId)) return { ok: false, msg: `未知遗迹秘宝：${defId}` };
    if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
    r.coin -= cost;
    const q = rollChipQualityByWeights(CFG.chipSources.shop.qualityWeights);
    const chip = makeChip(defId, q);
    const placed = grantChipToRun(r, chip);
    return { ok: true, msg: placed ? `已合成：${chip.name}` : `已合成：${chip.name}（遗迹秘宝背包已满，已放入待分配区）` };
  },
};
function shopBuyModule() {
  if (!G.inArtisan || !G.run) return { ok: false, msg: "仅可在工匠世界内购买" };
  const r = G.run, cfg = CFG.artisanServices.buyModule;
  if (r.coin < cfg.cost) return { ok: false, msg: `金币不足（需 ${cfg.cost}）` };
  r.coin -= cfg.cost;
  // 复用 makeModule（品质/词缀/等级生成与掉落完全一致）：品质按配置权重，定义随机取自模块表
  const itemQ = QUAL_KEY_INDEX[U.weightedPick(cfg.qualityWeights)] || 0;
  const item = makeModule(U.pick(CFG.moduleDefs).id, itemQ);
  const placed = grantItemToRun(r, item);
  return { ok: true, msg: placed ? `已购买：${item.name}` : `已购买：${item.name}（背包已满，已放入待分配区）` };
}
function shopBuyItem() {
  if (!G.inArtisan || !G.run) return { ok: false, msg: "仅可在工匠世界内购买" };
  const r = G.run, cfg = CFG.artisanServices.buyItem;
  if (r.coin < cfg.cost) return { ok: false, msg: `金币不足（需 ${cfg.cost}）` };
  r.coin -= cfg.cost;
  // 道具池 = 现有两类消耗品：保险契约 / 诅咒道具（复用各自构造器与既有入包路径，不新增物品类型）
  const kind = U.weightedPick({ ins: CFG.insurance.chance, curse: CFG.curseItems.chance });
  const item = kind === "ins" ? makeInsurance() : makeCurse();
  const placed = grantItemToRun(r, item);
  return { ok: true, msg: placed ? `已购买：${item.name}` : `已购买：${item.name}（背包已满，已放入待分配区）` };
}

/* ---------- 21.4 升级刷新（参考图「刷新 1/1」）----------
 * 每局免费刷新 rerollFreePerRun 次：重抽当前 4 选 1 的候选（锁定卡保持锁定）。
 * 关键实现：**就地换血**——不清空 UI.levelUpCandidates 的引用，只清空内容再回填，
 * 这样 presentLevelUpChoice 的 done 闭包（持有同一数组引用）读到的就是新候选，
 * 无需改动任何现有闭包/契约（铁律 §5.45：现有函数只插单行调用）。 */
function levelUpReroll() {
  const ui = (typeof UI !== "undefined") ? UI : null;
  const r = G.run;
  if (!ui || !r || !Array.isArray(ui.levelUpCandidates) || !ui.levelUpCandidates.length) return false;
  // 次数惰性初始化（旧存档 run 没有该字段 → 按 CFG 补齐）
  const per = (CFG.levelUp && CFG.levelUp.rerollFreePerRun) || 0;
  if (typeof r.levelUpRerollsLeft !== "number") r.levelUpRerollsLeft = per;
  if (r.levelUpRerollsLeft <= 0) return false;          // 次数用尽（按钮应已禁用，双保险）
  const heroId = (ui.levelUpMeta && ui.levelUpMeta.heroId)
    || (r.heroDef && r.heroDef.id) || null;
  if (!heroId || typeof buildLevelUpCandidates !== "function") return false;
  r.levelUpRerollsLeft--;
  const fresh = buildLevelUpCandidates(heroId);
  if (!Array.isArray(fresh) || !fresh.length) { r.levelUpRerollsLeft++; return false; }
  ui.levelUpCandidates.length = 0;                      // ★ 就地换血（引用不变）
  for (const c of fresh) ui.levelUpCandidates.push(c);
  if (typeof ui._renderLevelUp === "function") ui._renderLevelUp();
  if (typeof ui.toast === "function") ui.toast(`已刷新候选（剩余 ${r.levelUpRerollsLeft} 次）`, "gold");
  return true;
}



/* ============================================================
 * 21.17 深渊内玩家强化（末尾独立区块）
 * ============================================================
 * 【问题】深渊第 1 波就有 10 只怪（含 1 只精英）、80 波后 200 只全是精英/BOSS，
 *   而玩家 H001 只有 100 血 / 防 2，怪物单次接触造成 5.5~21 点伤害。
 *   真机实测：进图 5~10 秒内被围殴致死，第 1 波都过不去——
 *   升级系统（combat.js 的 dropEndlessExp）虽已打通，但 LV1 进图时没有任何加成，
 *   「靠升级成长」远水不解近渴。
 *
 * 【方案】深渊内玩家属性倍率（**仅深渊生效，与主线完全解耦**）：
 *   在 computeStats() 这一**单一属性出口**末尾乘上深渊倍率 → 主线/裂缝/工匠世界
 *   一律不受影响（非深渊时倍率为 1，且不产生任何额外计算）。
 *   选 computeStats 而非改 hp 初值的原因：它是全项目唯一的玩家属性出口，
 *   Player.update 每帧 `G.run.hpMax = st.hpMax` 自动同步上限，
 *   队友走 companionStats() 同源管线 → 组队时队友一并生效，不需要逐处打补丁。
 *
 * 【数值】全部进 CFG.endless.playerBuff（见 js/config.js），逻辑不硬编码：
 *   hpMul / defMul / atkMul —— 策划调参改 CFG 即可，后续「策划会优化生怪参数」时不用碰代码。
 *
 * 【为什么不改怪物】怪物数值同时服务于主线 99 关（CFG.monsters 全局共享），
 *   在深渊侧削怪会污染主线手感；强化玩家则天然隔离。
 * ============================================================ */

/** 深渊玩家属性倍率应用（由 computeStats 末尾单行调用）。
 *  非深渊（主线 / 裂缝 / 工匠世界）立即返回原对象（零副作用、零额外属性读）。 */
function applyEndlessPlayerBuff(st) {
  if (!st) return st;
  if (typeof G === "undefined" || !G || !G.inEndless) return st;   // 非深渊：原样返回
  const c = (typeof CFG !== "undefined" && CFG.endless && CFG.endless.playerBuff) || null;
  if (!c) return st;
  if (typeof c.hpMul === "number")  st.hpMax = Math.round(st.hpMax * c.hpMul);
  if (typeof c.atkMul === "number") st.atk   = Math.round(st.atk * c.atkMul);
  if (typeof c.defMul === "number") st.def   = Math.round(st.def * c.defMul);
  if (typeof c.spdMul === "number") st.spd   = st.spd * c.spdMul;
  return st;
}
