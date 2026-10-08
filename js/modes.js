/* ============================================================
 * modes.js — 关卡机制 / 毒圈 / 赛季 / 深渊门 / 无尽流程（21.16 物理搬移拆分：原 game.js 第 4 部分）
 * 职责：撤离判定与压力（updateExtractJudge/extractWave*…）；死亡惩罚与折算（onPlayerDeath/
 *       calcDeathPenalty/calcSettleConvert）；局外成长纯函数（outLevel 系/英雄解锁）；
 *       毒圈收缩 + 补给点（updateHazard/updateSupply…）；结算结晶报告（buildCrystalReport/ *       publishCrystalReport）；触屏 NPC 点选与坐标换算（screenToWorld/npcTap/cityNpcTap）；
 *       赛季 SeasonState；对象池工具（swapRemoveWhere/_explodeSeen）；深渊之门与无尽流程
 *       （setupAbyssPortal/enterEndless/exitEndlessToCity…）。
 * ⚠️ 本文件由纯物理搬移生成：除本头部职责注释与 "use strict"; 外，代码逐字沿用原文件。
 * ============================================================ */
"use strict";
/** 撤离点判定（5.2，口径已更新）：
 *  **任一存活英雄在圈内即自动读条**（队长或任一 AI 队友都算，不再需要按 E）；
 *  「圈内英雄全部离开」→ 进度按判定通用规则衰退（移动本身不再单独打断）；
 *  受击仍立即归零（见 heroTakeDamage）；撤离点雕像始终留在原地，可反复重读。
 *  判定是单一实例（单一进度 + 单一持有者 extractHolder）→ 多个英雄同圈不可能同时触发同一个撤离判定。 */
function updateExtractJudge(dt) {
  const r = G.run;
  if (!r || !r.exitStatue) return;
  const st = r.exitStatue;
  extractWaveTick(r, st, dt);        // 方向4：波次围攻 + 护盾推进（真实秒；内部自守卫 paused/frozen）
  dt = extractWeightDt(r, st, dt);   // 方向4：负重 → 读条速率打折；护盾破碎未恢复 → 读条冻结（dt=0）
  const done = judgeChannel(r, st.x, st.y, CFG.extract.radius, dt, CFG.extract.channel,
    "extractProgress", "extractHolder");
  if (done) { r.extractChanneling = false; EventBus.emit("extractSuccess"); }
  else r.extractChanneling = !!r.extractHolder;   // 兼容字段：供 HUD / 提示显示「是否正在读条」
}
/** 离开主地图（进工匠世界 / 裂缝）时清空撤离读条状态：雕像保留在原地，回来站进圈内可继续读 */
function clearExtractChannel() {
  const r = G.run;
  if (!r) return;
  r.extractChanneling = false; r.extractProgress = 0; r.extractHolder = null;
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

/* ---------- 局内→局外资源转化（待细化 5 已定：撤离成功时只折算背包物品） ---------- */
/* 撤离结算折算（统一口径）：背包 / 武器栏内**每件物品**都有固定「价值」，
 * 一律 × CFG.settleConvert.valueRate 折算为结晶 —— 宝箱 / 装备 / 武器模块 / 消耗品同一套，不再分类别。
 * 局内经验与金币一律归零、不参与折算（死亡时同样不折算）。 */
function calcSettleConvert(run) {
  const sc = CFG.settleConvert;
  const rate = sc.valueRate;
  const b = { chest: 0, gear: 0, item: 0, card: 0, total: 0 };
  const take = (it) => {
    const v = Math.floor((it.value || 0) * rate);
    if (it.kind === "chest") b.chest += v;                                          // 未开封宝箱（不带出本体，价值折算）
    else if (it.kind === "gear" || it.kind === "module") b.gear += v;               // 装备 / 武器模块
    else b.item += v;                                                               // 消耗品：保险契约 / 诅咒道具 等
  };
  for (const it of run.backpack.items) take(it);
  for (const it of run.weaponInv.items) take(it);
  b.card = Math.floor((run.cardAssets || 0) * sc.cardValue * rate);                 // 属性卡牌资产（固定价值 4/张）
  b.total = b.chest + b.gear + b.item + b.card;
  return b;
}

/* ============================================================================
 * 关卡机制：毒圈收缩 + 补给点（B 线并行批 · 关卡 3→10 铺量）
 * ----------------------------------------------------------------------------
 * 本区块**独立追加在文件末尾**（并行开发铁律，见 G_docs/dev_guide.md §5.45）：
 * 对现有函数（World.setupMain / World.update / render）只插入**单行调用**，
 * 绝不重写现有函数体，从而与其它代理零行级冲突。
 *
 * 两个机制均由 CFG 驱动（不硬编码数值）：
 *   毒圈 CFG.hazard  —— 关卡 hazardEnabled:true + hazard 覆盖；圈外定时扣血 + 红色环渲染。
 *   补给 CFG.supply  —— 关卡 supplyEnabled:true + supply 覆盖；复用判定圈统一入口 judgeChannel。
 *
 * 无机制等价性：未开启关卡（LEVEL_001~004/007）两处初始化均为 no-op，
 * update/render 早退，行为与改动前完全一致（测试「无机制等价性回归」锁定）。
 * ============================================================================ */

/** 合并「关卡覆盖 → 全局默认」：返回 null 表示本关不启用该机制。
 *  enabled：关卡 hazardEnabled/supplyEnabled 显式开关；缺省回落全局 CFG.hazard.enabled。 */
function levelMechCfg(kind, lv) {
  const base = CFG[kind];
  const onKey = kind === "hazard" ? "hazardEnabled" : "supplyEnabled";
  const enabled = (lv && lv[onKey] != null) ? !!lv[onKey] : !!(base && base.enabled);
  if (!enabled || !base) return null;
  return Object.assign({}, base, (lv && lv[kind]) || {});
}

/** 初始化本关机制状态（单行调用点 = World.setupMain 末尾）。
 *  仅在主地图、且关卡启用对应机制时写入字段；否则字段保持缺省（无机制关卡零开销）。 */
function initLevelMechanics(w) {
  if (!w || !w.isMain || !G.levelCfg) return;
  const hz = levelMechCfg("hazard", G.levelCfg);
  if (hz) {
    const cx = w.w * (hz.cx != null ? hz.cx : 0.5);
    const cy = w.h * (hz.cy != null ? hz.cy : 0.5);
    const maxR = Math.hypot(cx, cy);          // 覆盖全图（到最远角的距离）
    w.hazard = {
      cfg: hz, cx, cy, maxR,
      curR: maxR,                             // 当前安全圈半径（起步 = 满图）
      elapsed: 0,                             // 进场计时（到达 startDelay 才激活）
      active: false,                          // 是否已开始收缩
      tick: 0,                                // 圈外扣血计时累加
    };
  }
  const sp = levelMechCfg("supply", G.levelCfg);
  if (sp) {
    const n = Math.max(0, Math.min(3, Math.round(sp.count != null ? sp.count : 2)));
    w.supplyPoints = [];
    for (let i = 0; i < n; i++) {
      const pos = w.findFreeSpot ? w.findFreeSpot(sp.radius || 90) : null;
      w.supplyPoints.push({
        x: pos ? pos.x : U.rand(200, w.w - 200),
        y: pos ? pos.y : U.rand(200, w.h - 200),
        cfg: sp, progress: 0, holder: null, used: false,
      });
    }
  }
}

/** 每帧推进毒圈 + 补给点（单行调用点 = World.update 中段）。 */
function updateLevelMechanics(w, dt) {
  if (!w || !w.isMain) return;
  updateHazard(w, dt);
  updateSupply(w, dt);
}

/* ---------------- 2a. 毒圈收缩 ---------------- */

/** 毒圈：进场计时 → startDelay 后激活并线性收缩到 minRadius → 圈外每 tickInterval 秒扣 dmgPerTick。 */
function updateHazard(w, dt) {
  const hz = w.hazard;
  if (!hz) return;
  const cfg = hz.cfg;
  hz.elapsed += dt;
  if (!hz.active) {
    if (hz.elapsed < (cfg.startDelay || 0)) return;   // 尚未出现
    hz.active = true;
    hz.shrinkT = 0;
    UI.toast("☣ 毒圈开始收缩！留在安全圈内", "bad");
  } else if (hz.curR > cfg.minRadius) {
    hz.shrinkT = (hz.shrinkT || 0) + dt;
    const dur = Math.max(0.001, cfg.shrinkDuration || 90);
    const k = Math.min(1, hz.shrinkT / dur);
    hz.curR = hz.maxR - (hz.maxR - cfg.minRadius) * k;   // 线性收缩
  }
  // 圈外扣血：任意存活英雄在圈外累计 tickInterval → 按最大生命的固定比例扣血（21.1 比例口径）
  hz.tick += dt;
  if (hz.tick >= (cfg.tickInterval || 1)) {
    hz.tick -= (cfg.tickInterval || 1);
    const outside = aliveHeroes().filter(h => U.dist(h.x, h.y, hz.cx, hz.cy) > hz.curR);
    for (const h of outside) hazardDamage(w, h, cfg);
  }
}

/** 毒圈伤害入口（21.1 新增·比例口径）：扣除**最大生命**的固定比例，与当前血量/防御/成长无关。
 *  与 heroTakeDamage 的区别：不走防御减免、不触发「受击打断撤离」以外的队友规则差异——
 *  但保留打断语义（站毒圈里读条被毒打断是设计预期），走同一套打断清理。
 *  hpMax 取值防抖：G.run.hpMax 由玩家 update 维护（game.js:1210），而毒圈与本更新可能早于首个玩家帧；
 *  故按 hpMax → hp → CFG 基准值 三级回退，任何一级可用即不会产生 NaN。 */
function hazardDamage(w, h, cfg) {
  const pct = (cfg && typeof cfg.dmgPercent === "number") ? cfg.dmgPercent : 0.01;
  const base = (h && isFinite(h.hpMax) && h.hpMax > 0) ? h.hpMax
    : (G.run && isFinite(G.run.hpMax) && G.run.hpMax > 0) ? G.run.hpMax
    : (G.run && isFinite(G.run.hp) && G.run.hp > 0) ? G.run.hp
    : 100;
  const dmg = Math.max(1, Math.round(base * pct));   // 至少 1 点，避免高血/低比例下取整为 0
  heroTakeDamage(w, h, dmg, true);                   // 第 4 参 true = 本次伤害跳过防御减免（比例伤害）
}

/** 某点是否在毒圈外（供渲染/测试查询；未激活时返回 false，即尚未出现不扣）。 */
function hazardOutside(w, x, y) {
  const hz = w && w.hazard;
  if (!hz || !hz.active) return false;
  return U.dist(x, y, hz.cx, hz.cy) > hz.curR;
}

/* ---------------- 2b. 补给点 ---------------- */

/** 补给点：复用判定圈统一入口 judgeChannel；读条完成 → 生效一次后消失。 */
function updateSupply(w, dt) {
  const pts = w.supplyPoints;
  if (!pts || !pts.length) return;
  for (const sp of pts) {
    if (sp.used) continue;
    const cfg = sp.cfg;
    if (judgeChannel(sp, sp.x, sp.y, cfg.radius || 90, dt, cfg.channelSeconds || 3)) {
      sp.used = true;
      applySupplyEffect(w, sp);
    }
  }
  // 生效后移除（与雕像「触发即消失」一致）
  w.supplyPoints = w.supplyPoints.filter(s => !s.used);
}

/** 结算补给效果（配置驱动：effect 单项，或 effects 多项组合）。 */
function applySupplyEffect(w, sp) {
  const cfg = sp.cfg;
  const list = Array.isArray(cfg.effects) && cfg.effects.length ? cfg.effects : [cfg.effect];
  for (const ef of list) {
    if (!ef) continue;
    switch (ef.type) {
      case "heal": {
        for (const h of aliveHeroes()) {
          const add = h.hpMax * (ef.pct || 0);
          if (h === G.player) { G.player.heal(ef.pct || 0); }
          else { h.hp = Math.min(h.hpMax, h.hp + add); spawnFloat(h.x, h.y - 30, `+${Math.round(add)}`, "#7de08a"); }
        }
        UI.toast(`补给点：全队恢复 ${Math.round((ef.pct || 0) * 100)}% 生命`, "gold");
        break;
      }
      case "buff": {
        const pool = (ef.buffPool && CFG[ef.buffPool + "Buffs"]) || CFG.warBuffs || [];
        if (!pool.length) break;
        const b = U.pick(pool);
        const r = G.run;
        const cur = r.buffs.find(x => (x.skillId || "") === b.skillId);
        if (cur) cur.remain = ef.duration || 20;
        else r.buffs.push({ skillId: b.skillId, id: b.id, lv: 1, remain: ef.duration || 20 });
        UI.toast(`补给点：获得「${b.id}」（${ef.duration || 20}秒）`, "gold");
        break;
      }
      case "crystal": {
        G.run.coin += (ef.amount || 0);
        spawnFloat(sp.x, sp.y - 24, `+${ef.amount || 0}`, "#ffd76a");
        UI.toast(`补给点：获得 ${ef.amount || 0} 结晶`, "gold");
        break;
      }
    }
  }
}

/* ========== 方向 3：局外成长落地（升级曲线 / 分段增益表 / 英雄解锁——纯函数区块） ==========
 * 铁律沿用 §5.45：新增逻辑集中本区块，现有函数只插单行调用。
 * 兼容性硬要求：CFG.outLevel 缺 growthRate → 升级花费回落旧线性；缺 growthTable → 属性回落旧线性。 */

// 当前升级花费（heroId → LV n→n+1 结晶数）：优先指数曲线 cost = round(costBase × growthRate^(n-1))，
// 前期平缓后期陡峭；缺 growthRate（或 ≤1）回落旧线性 costBase + (n-1)×costStep。满级返回 0（不可升）。
function outLevelCost(heroId) {
  const o = CFG.outLevel;
  const lv = (typeof Meta !== "undefined" && Meta && Meta.heroLevel) ? Meta.heroLevel(heroId) : 1;
  if (lv >= o.maxLevel) return 0;
  if (typeof o.growthRate === "number" && o.growthRate > 1)
    return Math.round(o.costBase * Math.pow(o.growthRate, lv - 1));
  return o.costBase + (lv - 1) * o.costStep;
}

// 升到 LV n 的每级成长段位倍率：按目标等级落在 growthTable 哪一段（lv ≤ upTo）取 mul；
// 表缺失/为空返回 null（调用方回落旧线性）。
function outLevelStageMul(lv) {
  const t = CFG.outLevel.growthTable;
  if (!Array.isArray(t) || !t.length) return null;
  for (const seg of t) if (lv <= seg.upTo) return seg.mul;
  return t[t.length - 1].mul;      // 超出最后一段（maxLevel 之外）按末段倍率
}

// 英雄每级成长值：按定位（CFG.heroRoles.byHero）取 growthByRole，无定位/无该定位回落 growth。
function outLevelGrowthOf(def) {
  const o = CFG.outLevel;
  const role = (CFG.heroRoles && CFG.heroRoles.byHero && CFG.heroRoles.byHero[def.id]) || "";
  return (o.growthByRole && o.growthByRole[role]) || o.growth;
}

// LV lv 的累计属性加成 → { hp, atk, def }（四舍五入取整）：有 growthTable 逐级累加「定位成长 × 段位倍率」，
// 无表回落旧线性（growth × (lv-1)）。LV1 恒返回基础值（加成 0）。
function outLevelStats(def, lv) {
  const g = outLevelGrowthOf(def), n = lv - 1;
  let hp, atk, defv;
  if (outLevelStageMul(lv) !== null) {
    hp = atk = defv = 0;
    for (let L = 2; L <= lv; L++) {
      const m = outLevelStageMul(L) || 1;
      hp += g.hp * m; atk += g.atk * m; defv += g.def * m;
    }
  } else { hp = g.hp * n; atk = g.atk * n; defv = g.def * n; }
  return { hp: Math.round(def.hp + hp), atk: Math.round(def.atk + atk), def: Math.round(def.def + defv) };
}

// 英雄是否已解锁（纯查询，无副作用）：① unlockOrder 前 starterCount 个 = 首发默认解锁；
// ② 存档 unlockExtra[id] = 已花结晶主动解锁；③ heroLv 条件（指定英雄局外等级达标）达成即解锁。
function isHeroUnlocked(id, data) {
  const order = CFG.unlockOrder || [];
  const idx = order.indexOf(id);
  if (idx >= 0 && idx < (CFG.starterCount || order.length)) return true;
  if (data && data.unlockExtra && data.unlockExtra[id]) return true;
  const rule = CFG.unlockRules && CFG.unlockRules[id];
  if (rule && rule.heroLv) {
    if (typeof Meta !== "undefined" && Meta && typeof Meta.heroLevel === "function"
      && Meta.heroLevel.call(Meta, rule.heroLv.heroId) >= rule.heroLv.lv) return true;
  }
  return false;
}

/* ================= 方向 4：撤离压力设计（追加区块，§5.45 铁律：文件末尾独立区块 + 现有函数只插单行调用） =================
 * ① 撤离读条波次：开始读条（extractChanneling false→true）时逐波刷怪围攻，强度随波数递增
 *    （第 N 波数量 = waveSizeBase + waveSizeGrowth×(N-1)，每 waveInterval 秒一波，全部进 CFG.extract）；
 *    读条结束/打断/离圈 → 会话销毁 = 停止刷怪。挂点：updateExtractJudge 内单行调用 extractWaveTick
 *    （置于负重缩放**之前**，拿原始 dt——波次/护盾按「真实秒」推进，不随负重缩放）。
 *    ⚠️ 护栏（§4.6/§5.34）：updateExtractJudge 仅在主地图且 !frozen 时被调用（见 main.js 主循环），
 *    且 paused 时整段跳过；extractWaveTick 内再自守卫一遍（防直接调用绕过闸门）。
 * ② 负重权衡：选「负重越高 → 读条时间越长（读条速率打折）」方案。理由：
 *    a) 不引入新伤害路径——若做「读条期间持续掉血」，掉血必经 heroTakeDamage → 立即打断读条，
 *    超重等于永远撤不离（死锁）；b) 时长放大与波次压力天然相乘（见①）；c) 纯函数可测、无随机性。
 *    挂点：updateExtractJudge 内 judgeChannel 之前单行调用 extractWeightDt 缩放 dt
 *    （等价于拉长读条时长；圈外进度衰退不走缩放，保持旧衰退速率）。
 * ③ 波次怪的攻击载体 = **雕像护盾**（关键设计约束：门禁 runtime_test 站桩 8s 必须撤离成功，
 *    波次怪若伤害英雄 → 受击打断读条 → 永远撤不走，门禁必红）。读条期间波次怪由
 *    extractWaveSiegeTick 接管（Monster.update 顶部单行插入，同 monsterBurnTick 先例）：
 *    围到 siegeRingRadius 啃护盾，**不伤害英雄**；读条一旦中断 → 交还普通 AI 追击英雄（威胁不变）。
 *    护盾破碎 → 读条冻结（进度不清零）+ 停刷波次；清光围攻怪 → 护盾再生至 shieldRecoverPct 解锁。
 *    贪心压力：不清理围攻怪就反复读条 → 护盾见底 → 被锁死在撤离点。
 * 无机制等价性：CFG.extract.enabled = false 时全部函数短路/透传，行为与旧版逐位一致。 */

// 负重 → 读条时长倍率（≥1）：未启用惩罚 / 圈外（非读条帧）返回 1。
function extractWeightMul(r, st) {
  const c = CFG.extract;
  if (!c || !c.enabled || !c.weightPenaltyEnabled) return 1;
  if (!heroInCircle(st.x, st.y, c.radius)) return 1;   // 只有正在读条的帧才打折
  const need = extractChannelSeconds(r);
  return need > 0 ? need / c.channel : 1;
}
// dt 缩放（updateExtractJudge 单行挂点）：护盾破碎未恢复 → 读条冻结（dt=0，进度不清零）；
// 圈内读条帧按负重打折读条速率；其余透传（enabled=false 恒透传，无机制等价性）。
function extractWeightDt(r, st, dt) {
  const c = CFG.extract;
  if (!c || !c.enabled) return dt;
  if (st.shieldBroken && (st.shield || 0) < c.shieldMax * c.shieldRecoverPct) return 0;
  const mul = extractWeightMul(r, st);
  return mul > 1 ? dt / mul : dt;
}
// 纯函数：当前负重下的实际撤离读条时长（秒）。runLike 仅作兼容入参（负重是全队口径，统一读 G.run）。
// 未启用总开关 / 负重惩罚 → 返回基准 CFG.extract.channel（无机制等价性）。
function extractChannelSeconds(runLike) {
  const c = CFG.extract, base = c.channel;
  if (!c || !c.enabled || !c.weightPenaltyEnabled) return base;
  const run = (runLike && runLike.backpack) ? runLike : G.run;
  if (!run) return base;
  const over = Math.max(0, totalRunWeight() - c.weightThreshold);
  return base * Math.min(c.weightTimeScaleMax, 1 + c.weightSlopePer100 * over / 100);
}
// 波次刷怪池：与 spawnWave 同源——优先刷怪圆模板池（主地图 circles[0]），回退关卡 spawnPool；
// 过滤 ED 精英与 BOSS（不进随机圆），按解锁进度过滤（Boss 已死 → progress=1 全解锁）。
function extractWavePool(w) {
  const tpl = (w.circles && w.circles[0]) || null;
  const raw = parseWeightPool((tpl && tpl.pool) || (G.levelCfg && G.levelCfg.spawnPool) || "NM0010:1");
  const progress = (G.run.kills || 0) / Math.max(1, G.levelCfg.progressGoal);
  const pool = {};
  for (const id in raw) {
    if (isEliteDef(id) || (CFG.monsters[id] && CFG.monsters[id].type === "boss")) continue;
    if (progress >= (CFG.monsterUnlock[id] ?? 0)) pool[id] = raw[id];
  }
  if (!Object.keys(pool).length) pool.NM0010 = 1;   // 兜底（同 spawnWave）
  return pool;
}
// 刷第 n 波：数量 = base + growth×(n-1)；围绕雕像 waveSpawnRadius 半径随机取点
// （遵守 spawnRules.minDistFromPlayer / 障碍避让 / 世界边界）；spawnMonster 自带 monsterCap 守卫（满则返回 null → 本波收手）。
function spawnExtractWave(w, st, n) {
  const c = CFG.extract;
  const size = Math.max(1, Math.round(c.waveSizeBase + c.waveSizeGrowth * (n - 1)));
  const pool = extractWavePool(w);
  const minDist = CFG.spawnRules.minDistFromPlayer;
  let spawned = 0, attempts = 0;
  const maxAttempts = Math.max(24, size * 8);
  while (spawned < size && attempts < maxAttempts) {
    attempts++;
    const a = U.rand(0, Math.PI * 2), rr = U.rand(c.waveSpawnRadius * 0.6, c.waveSpawnRadius);
    const x = st.x + Math.cos(a) * rr, y = st.y + Math.sin(a) * rr;
    if (x < 40 || x > w.w - 40 || y < 40 || y > w.h - 40) continue;
    if (blockedByObstacle(w, x, y)) continue;
    if (G.player && U.dist(x, y, G.player.x, G.player.y) < minDist) continue;
    const m = w.spawnMonster(U.weightedPick(pool), x, y);
    if (!m) break;   // monsterCap 已满：spawnMonster 返回 null，停止本波（不超上限）
    m._extWave = true;   // 标记波次怪：读条期间围攻雕像护盾（extractWaveSiegeTick），中断后转普通 AI
    if (Math.random() < c.waveEliteChance) { applyElite(m); applyMonsterScale(m, "精英属性"); }
    spawned++;
  }
  UI.toast("⚠ 撤离点遭到围攻：第 " + n + " 波来袭！（+" + spawned + "）", "bad");
  SFX.play("boom");
  return spawned;
}
// 雕像护盾再生/恢复（读条与否都推进）：无存活波次怪贴近雕像 → 延迟后缓慢再生；
// 护盾归零 → 破碎（停刷波次 + 读条冻结由 extractWeightDt 承担）；恢复到 shieldRecoverPct × max → 解锁。
function extractShieldTick(r, st, dt) {
  const c = CFG.extract;
  if (st.shield == null) return;   // 尚未开启过波次会话：护盾不存在，零足迹
  if (!st.shieldBroken && st.shield <= 0) {
    st.shieldBroken = true;
    r._extWave = null;             // 停刷波次（会话销毁）：先清怪，再谈撤离
    UI.toast("⚠ 撤离点雕像护盾被击碎！清除周围敌人后护盾将自行恢复", "bad");
    SFX.play("boom");
  }
  const sieged = extractSiegersNear(r, st, c.siegeRingRadius + 240);
  if (st.shield < c.shieldMax && !sieged) {
    st._shieldHold = (st._shieldHold == null ? c.shieldRegenDelay : st._shieldHold) - dt;
    if (st._shieldHold <= 0) st.shield = Math.min(c.shieldMax, st.shield + c.shieldRegenPerSec * dt);
  } else st._shieldHold = c.shieldRegenDelay;
  if (st.shieldBroken && st.shield >= c.shieldMax * c.shieldRecoverPct) {
    st.shieldBroken = false;
    UI.toast("撤离点雕像护盾已恢复，可继续读条", "gold");
  }
}
// 是否有存活波次怪贴近雕像（围攻抑制再生）
function extractSiegersNear(r, st, dist) {
  const w = G.activeWorld || G.mainWorld;
  if (!w || !w.monsters) return false;
  for (const m of w.monsters) {
    if (m.dead || !m._extWave) continue;
    if (U.dist(m.x, m.y, st.x, st.y) < dist) return true;
  }
  return false;
}
// 波次状态机（updateExtractJudge 单行挂点，置于负重缩放**之前**以拿原始 dt）：
// 读条开始建会话并按间隔刷波；读条结束/打断销毁会话；护盾破碎停刷并冻结读条。
// 波次/护盾计时均按「真实秒」推进（不随负重缩放）——负重越重读条越久，承受波数越多。
function extractWaveTick(r, st, dt) {
  const c = CFG.extract;
  if (!c || !c.enabled || !c.waveEnabled) { r._extWave = null; return; }
  if (Game.paused) return;                                   // 升级 4 选 1 暂停：不推进波次（§5.43）
  const w = G.activeWorld || G.mainWorld;
  if (!w || !w.isMain || w.freezeTimer > 0) return;          // 冻结期间不推进波次（§4.6/§5.34 护栏）
  extractShieldTick(r, st, dt);                              // 护盾再生/破碎/恢复（读条与否都推进）
  if (!r.extractChanneling) { r._extWave = null; return; }   // 打断/结束/离圈 → 停止刷怪
  if (st.shieldBroken) return;                               // 护盾破碎：先清怪恢复，不再刷波
  let s = r._extWave;
  if (!s) {
    if (st.shield == null) st.shield = c.shieldMax;          // 首次波次会话：护盾就位
    s = r._extWave = { wave: 0, timer: c.waveFirstDelay || 0 };
  }
  s.timer -= dt;
  if (s.timer > 0) return;
  s.wave++;
  s.timer = c.waveInterval;
  spawnExtractWave(w, st, s.wave);
}
// 波次怪围攻 AI（Monster.update 顶部单行挂点，同 monsterBurnTick 先例）：
// 读条期间接管波次怪——围到雕像环啃护盾（不伤害英雄）；返回 true = 本帧已接管；
// 读条中断/结束/机制关闭 → 返回 false → 交还普通 AI（追击英雄，真实威胁）。
function extractWaveSiegeTick(m, w, dt) {
  const r = G.run;
  if (!m._extWave) return false;
  const c = CFG.extract;
  if (!c || !c.enabled || !c.waveEnabled) return false;
  if (!r || !r.extractChanneling || !r.exitStatue) return false;
  const st = r.exitStatue;
  if (st.shield == null) return false;
  const d = U.dist(m.x, m.y, st.x, st.y);
  if (d > c.siegeRingRadius + m.r) {                          // 向雕像环推进
    const ang = Math.atan2(st.y - m.y, st.x - m.x);
    m.x += Math.cos(ang) * m.effSpd * dt;
    m.y += Math.sin(ang) * m.effSpd * dt;
  } else if (st.shield > 0) {                                 // 到环：啃护盾（读条期间绝不伤害英雄）
    st.shield = Math.max(0, st.shield - m.atk * c.siegeDpsMul * dt);
  }
  return true;
}

/* ================= 方向 3：局外成长闭环收口（结晶产出可见化 + 配平自检——纯函数区块） =================
 * 铁律 §5.45：新增逻辑集中本区块，现有函数（Meta.awardRun）只插单行调用。
 * --------------------------------------------------------------------------------------------
 * 背景：结晶只剩两个来源（① 击杀 BOSS=CFG.outLevel.crystalBoss；② 撤离折算=CFG.settleConvert.valueRate），
 *       但玩家打完一局看不到「拿了多少、怎么来的」。本区块把结算明细算成一份**纯数据报告**。
 *
 * ⚠️ 渲染归属：结算界面 DOM 在 js/ui.js（另一代理维护，本代理禁改）。因此这里**只产出数据**并挂到
 *    G.lastSettleReport，**需要 UI 侧配合渲染该字段**（主会话收口）——把 lines 逐行、total 作为总计渲染即可。
 *    挂点：Meta.awardRun 结束时单行调用 publishCrystalReport（awardRun 是唯一结晶发放入口，天然收口）。
 */

// 本局结算报告（纯函数，无副作用，入参可为部分字段——测试/沙箱无 G 环境时不抛错）：
//   result = { kills, bossDefeated, extracted, convertTotal, boss }
//     boss         = 该局 BOSS 结晶**到手**数（死亡已按 deathRatio 打折；缺省按配置现算）
//     convertTotal = 撤离折算结晶（来源②；未撤离恒 0）
// 返回 { total, boss, convertTotal, extracted, died, lines: [中文文案…] }
function buildCrystalReport(result) {
  var r = result || {};
  var o = CFG.outLevel, sc = CFG.settleConvert;
  var extracted = !!r.extracted;
  var bossDef = !!r.bossDefeated;
  var boss = (typeof r.boss === "number") ? r.boss
    : (bossDef ? (extracted ? o.crystalBoss : Math.floor(o.crystalBoss * o.deathRatio)) : 0);
  var conv = extracted ? (r.convertTotal || 0) : 0;   // 死亡不折算（来源②不发生）
  var lines = [];
  if (extracted) {
    if (boss > 0) lines.push("击杀首领 +" + boss);
    if (conv > 0) lines.push("物资折算 +" + conv);
    if (!lines.length) lines.push("本局无结晶产出（未击杀首领 · 无可折算物资）");
  } else {
    lines.push("阵亡 · 仅保留 " + Math.round(o.deathRatio * 100) + "%");
    if (bossDef) lines.push("击杀首领 +" + o.crystalBoss + " → 保留 +" + boss);
    else lines.push("本局无结晶产出（未击杀首领）");
  }
  var total = boss + conv;
  lines.push("本局合计 +" + total + " 结晶");
  return { total: total, boss: boss, convertTotal: conv, extracted: extracted, died: !extracted, lines: lines };
}

// 生成并广播结算报告：写 Meta.lastReport（可持久层读取）+ G.lastSettleReport（供 UI 渲染）。
// 折算值取 G.run.settleConv（main.js 在调用 awardRun **之前**已写入），无则按 0。
function publishCrystalReport(kills, bossDefeated, extracted, boss) {
  var conv = 0;
  if (typeof G !== "undefined" && G && G.run && G.run.settleConv && extracted) {
    conv = G.run.settleConv.total || 0;
  }
  var rep = buildCrystalReport({ kills: kills, bossDefeated: bossDefeated, extracted: extracted, convertTotal: conv, boss: boss });
  if (typeof Meta !== "undefined" && Meta) Meta.lastReport = rep;
  if (typeof G !== "undefined" && G) G.lastSettleReport = rep;
  return rep;
}

/* ========== 21.1 触屏交互区（NPC 点选）——纯函数 + 单一入口 ==========
 * 铁律 §5.45：新增逻辑集中本区块，现有函数只插单行调用。
 * 背景：工匠世界 NPC 由「站圈自动开面板」改为「进圈 1 秒解锁 → 点击 NPC 本体」，
 * 需要把屏幕点击坐标换算回世界坐标（相机 zoom + camX/camY 平移，与 render 完全同口径）。 */

/* 屏幕坐标(clientX/Y) → 世界坐标：与 renderWorld 的相机变换严格对称。
 * 渲染侧：ctx.scale(zoom) → ctx.translate(-camX,-camY)，故反变换为 world = (screen/zoomScale/canvasScale) + cam。 */
function screenToWorld(clientX, clientY) {
  var cv = G.canvas;
  if (!cv) return null;
  var rect = cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  // 画布内比例坐标 → 画布像素坐标（G.W × G.H 逻辑坐标系）
  var px = (clientX - rect.left) * (G.W / rect.width);
  var py = (clientY - rect.top) * (G.H / rect.height);
  var zoom = (CFG.camera && CFG.camera.zoom) || 1;
  var w = G.world;
  if (!w) {
    /* 21.10：主城相机分支（此前缺失）。主城无 G.world（战斗世界变量），旧代码落到
     * 「无世界纯缩放」退化分支、忽略相机平移——而 renderCity 对小于视口的地图做居中
     * （camX 为负偏移），导致主城点击换算整体错位、NPC 点选必 miss（手机端 NPC 无法
     * 交互的深层根因之一）。此处与 renderCity 严格同口径：小地图居中 / 大地图跟 avatar。 */
    var cw = G.activeWorld;
    if (cw && cw.kind === "city") {
      var cviewW = G.W / zoom, cviewH = G.H / zoom;
      var a = G.cityAvatar;
      var ccamX = cw.w <= cviewW ? (cw.w - cviewW) / 2
        : U.clamp(((a && a.x) || cw.w / 2) - cviewW / 2, 0, cw.w - cviewW);
      var ccamY = cw.h <= cviewH ? (cw.h - cviewH) / 2
        : U.clamp(((a && a.y) || cw.h / 2) - cviewH / 2, 0, cw.h - cviewH);
      return { x: px / zoom + ccamX, y: py / zoom + ccamY };
    }
    return { x: px / zoom, y: py / zoom };            // 其余无世界场景维持旧退化行为
  }
  var viewW = G.W / zoom, viewH = G.H / zoom;
  var camX = w.w <= viewW ? (w.w - viewW) / 2 : U.clamp(G.player.x - viewW / 2, 0, w.w - viewW);
  var camY = w.h <= viewH ? (w.h - viewH) / 2 : U.clamp(G.player.y - viewH / 2, 0, w.h - viewH);
  return { x: px / zoom + camX, y: py / zoom + camY };
}

/* 点击屏幕 → 命中可交互 NPC 则开面板。
 * 门槛三重：① 工匠世界 ② npcReady（已在圈内站满 1 秒）③ 点击点落在 NPC 半径 tapRadius 内。
 * 返回 true 表示本次点击已被消费（调用方可据此吞掉后续逻辑）。 */
function npcTap(clientX, clientY) {
  var w = G.world;
  var cfg = CFG.mobile && CFG.mobile.npcTap;
  if (!w || w.isMain || w.kind !== "artisan" || !w.npc) return false;
  if (!w.npcReady) return false;                      // 未解锁：不响应（避免隔屏误点）
  var pt = screenToWorld(clientX, clientY);
  if (!pt) return false;
  var r = (cfg && cfg.tapRadius) || 110;              // 点选判定半径（略大于视觉半径，照顾手指精度）
  if (U.dist(pt.x, pt.y, w.npc.x, w.npc.y) > r) return false;
  w.npcReady = false; w.npcDwell = 0;                 // 消费：关面板后需重新站圈解锁
  EventBus.emit("openArtisanUI");
  return true;
}

/* ============================================================
 * ====== 21.6 赛季玩法（占位）—— SeasonState 数据结构 ======
 * ------------------------------------------------------------
 * 定位：99 关主线通关后开放的赛季玩法，本期仅占位实现
 *   （数据结构 + 经验曲线 + 周任务 + 结算钩子，无独立玩法循环）。
 * 铁律遵守：数值常量在本区块顶部声明，【待迁入 CFG】（本轮禁止改 config.js）。
 * 全部接口可被无头测试（season_test.js）直接调用，不依赖 DOM 渲染。
 * ============================================================ */

/* ---- 赛季配置常量（待迁入 CFG） ---- */
var SEASON_CFG = {
  expBase: 1000,        // LV1→LV2 所需经验基数
  expStep: 200,         // 每级递增量（LV n→n+1 需 1000 + (n-1)*200，n 为当前等级）
  maxLv: 10,            // 赛季等级封顶（L10 不再累计经验）
  weeklyKillGoal: 200,  // 周任务①：击杀 N 个敌人
  weeklyExtractGoal: 3, // 周任务②：成功撤离 N 次
  weeklyLevelUpGoal: 10 // 周任务③：局内升级 N 次
};

/* ---- 赛季状态（内存态，占位期不落盘；赛季正式上线再接 Meta 存档） ---- */
var SeasonState = {
  seasonLv: 1,          // 赛季等级（从 LV1 起）
  seasonExp: 0,         // 当前等级内已积累经验
  _weeklyProgress: {    // 周任务进度（按任务 id 存内存）
    "weekly-kill": 0,
    "weekly-extract": 0,
    "weekly-levelup": 0
  },

  /* 加赛季经验：升级曲线 每级 1000+n*200（n 从 0 计），L10 封顶后不再累计。
   * 支持一次跨多级（while 循环逐级结算）；非正数输入直接拒绝。 */
  addExp: function (n) {
    if (typeof n !== "number" || !(n >= 0)) return false;   // 非法输入（含 NaN）拒绝
    if (this.seasonLv >= SEASON_CFG.maxLv) return false;    // 封顶：经验不再涨
    this.seasonExp += n;
    while (this.seasonLv < SEASON_CFG.maxLv) {
      var need = SEASON_CFG.expBase + (this.seasonLv - 1) * SEASON_CFG.expStep;
      if (this.seasonExp < need) break;
      this.seasonExp -= need;
      this.seasonLv++;
    }
    if (this.seasonLv >= SEASON_CFG.maxLv) this.seasonExp = 0;   // 升满清零，杜绝残留
    return true;
  },

  /* 周任务定义 + 当前进度（3 个占位任务；进度读写存内存）。
   * 返回内部数组引用：调用方可读 progress，也可经 addWeeklyProgress 累加。 */
  weeklies: function () {
    var self = this;
    return [
      { id: "weekly-kill",     name: "击杀 " + SEASON_CFG.weeklyKillGoal + " 个敌人", goal: SEASON_CFG.weeklyKillGoal,     progress: self._weeklyProgress["weekly-kill"] },
      { id: "weekly-extract",  name: "成功撤离 " + SEASON_CFG.weeklyExtractGoal + " 次", goal: SEASON_CFG.weeklyExtractGoal,  progress: self._weeklyProgress["weekly-extract"] },
      { id: "weekly-levelup",  name: "局内升级 " + SEASON_CFG.weeklyLevelUpGoal + " 次", goal: SEASON_CFG.weeklyLevelUpGoal,  progress: self._weeklyProgress["weekly-levelup"] }
    ];
  },

  /* 周任务进度累加（占位钩子：正式接入时由击杀/撤离/升级事件分别调用） */
  addWeeklyProgress: function (id, n) {
    if (!(id in this._weeklyProgress) || typeof n !== "number" || !(n > 0)) return false;
    this._weeklyProgress[id] += n;
    return true;
  },

  /* 周重置：三个任务进度归零（每周一刷新，占位期手动调用） */
  resetWeekly: function () {
    for (var k in this._weeklyProgress) this._weeklyProgress[k] = 0;
  }
};

/* 21.6 赛季玩法区块结束 */

/* ================= 21.10 主城 NPC 点选（手机端交互缺口修复，独立区块 =================
 * 问题：CFG.mobile.hideTouchButtons = true（21.1 隐藏触屏三按钮）后，主城 NPC 的
 *        唯一入口 actionE()（键盘 E）在手机上不可达 —— 21.1 的 npcTap 只实现在工匠世界
 *        （w.kind !== "artisan" 直接 return），主城从未接入点选，导致「手机端 NPC 无法交互」。
 * 方案：与工匠世界 npcTap 同款范式（站进判定圈 → 点击 NPC 本体），复用 screenToWorld
 *        逆相机变换；门槛三重：① G.state === "city" ② G.cityNpcNear 已命中（进圈即解锁，
 *        无需 dwell）③ 点击点落在 NPC 半径 tapRadius 内。
 * 返回 true = 本次点击已消费（调用方吞掉后续逻辑，与 npcTap 契约一致）。
 * 无机制等价性：桌面端行为不变（键盘 E 路径原样保留，两条路径互不干扰）。 */
function cityNpcTap(clientX, clientY) {
  if (G.state !== "city") return false;
  const near = G.cityNpcNear;
  if (!near) return false;                            // 圈外：不响应（避免隔屏误点）
  const pt = screenToWorld(clientX, clientY);
  if (!pt) return false;
  const cfg = CFG.mobile && CFG.mobile.npcTap;
  const r = (cfg && cfg.tapRadius) || 110;            // 点选判定半径（略大于视觉半径，照顾手指精度）
  if (U.dist(pt.x, pt.y, near.x, near.y) > r) return false;
  if (G.cityNpcOpen && G.cityNpcOpen.id === near.id) { UI.closeNpcPanels(); return true; }  // 再点 = 关闭
  G.cityNpcOpen = near;
  SFX.play("altar");
  EventBus.emit("cityNpcPanel", near);
  return true;
}

/* 21.10 主城 NPC 点选区块结束 */

/* ============================================================================
 * ====== 21.14 每帧分配消除：对象池 + scratch + swap-remove（独立区块 §5.45）======
 * ----------------------------------------------------------------------------
 * 为什么：全库此前无实体对象池，每帧 new 出 >2 万对象（粒子/飘字/索敌数组），
 *         GC 卡顿造成帧毛刺。本区块提供三项「零新分配」工具，并集中放新增逻辑；
 *         现有函数体内只做就地替换或单行调用（铁律：新增逻辑集中本区块）。
 *
 * 工具：
 *   ① swapRemoveWhere(arr, pred)     —— 通用 filter 就地替换（World.update 三处）
 *   ② _explodeSeen                   —— explode 复用 Set（去重，语义不变）
 *   ③ Pool.recycle(obj)              —— 稳定压缩后仅回收对象（见 js/pool.js，updateFX 用）
 *
 * ---- aliveHeroes() / enemyTargets() 调用点审计（安全第一）----
 * 二者现在返回模块级 scratch 共享引用，故逐一确认**每处均为即时遍历/即时消费**，
 * 无「保存引用跨调用使用」：
 *   • aliveHeroes()：
 *     - nearestHero(x,y) 1292                          —— 立即 for...of 求最近，不保留
 *     - heroInCircle(...) 1311                         —— 立即 for...of 返回首个命中，立即返回元素
 *     - Bullet.update 敌方弹命中 1614                   —— 立即 for...of，命中即 return
 *     - World.update pickups 拾取 3112                  —— 立即 for...of，命中即 break
 *     - World.execEffect heal 3164                      —— 立即 for...of，逐员结算
 *     - Laser.damageTick 4014                           —— 立即 for...of，逐员结算
 *     - updateHazard 4389 `aliveHeroes().filter(...)`   —— filter 立即产出**新数组**，
 *                                                          不持有 scratch 引用 → 安全
 *     - applySupplyEffect heal 4442                     —— 立即 for...of，逐员结算
 *     → 全部即时消费，无保留。✅
 *   • enemyTargets(w)：
 *     - nearestTarget(w,x,y) 1541                      —— 立即 for...of 求最近，不保留
 *     - BossMonster 范围爆炸 1824                       —— 立即 for...of 结算伤害
 *     → 全部即时消费，无保留。✅
 *   另：enemyTargets 内部会调 aliveHeroes()，两者用**不同** scratch（_targetScratch vs
 *   _heroScratch）→ 双缓冲，互不覆盖。故**无需**为任何调用点保留新数组。
 *   且 nearestTarget 返回的是**单个元素**（非数组），调用方只读 tgt.x/tgt.y → 安全。
 * ============================================================================ */

/** 原地删除所有满足 pred 的元素（swap-remove），**保持数组引用不变**、不产生新数组。
 *  与 arr = arr.filter(x => !pred(x)) 的**结果集合**等价；仅**顺序可能不同**——
 *  已验证调用点（World.update 的 monsters/playerBullets/enemyBullets）后续只做
 *  「遍历/判空/取长度」，与元素顺序无关，故逐位等价。 */
function swapRemoveWhere(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) {
      const last = arr.length - 1;
      if (i !== last) arr[i] = arr[last];
      arr.pop();
    }
  }
  return arr;
}

/** explode 专用去重集合：模块级复用，每帧 clear 而非 new Set()。
 *  语义与旧 `const seen = new Set()` 完全一致（仅命中对象入集合、命中才结算）。 */
const _explodeSeen = new Set();

/* 21.14 区域结束 */

/* ============================================================================
 * ====== 21.15 深渊之门（无尽模式入口与进出门流程）—— 独立区块（§5.45 铁律）======
 * ----------------------------------------------------------------------------
 * 职责（本代理 🅑）：主城右上「深渊之门」的坐标/判定/读条/点选/进出门/结算打通。
 *   ① CFG.city.abyssPortal 只管入口侧（坐标比例 / 半径 / channel / 文案 / 颜色）；
 *   ② 无尽世界本体（Endless.makeWorld/begin/update/...）由另一代理产出 —— 本区块**一律
 *      用 `typeof Endless !== "undefined"` 做存在性守卫**（项目惯例），未就绪时门显示
 *      「尚未开启」且进入动作安全降级（toast 提示，不进入）。
 *
 * 接入方式（现有函数体内**只插单行调用**，行级冲突最小化）：
 *   • World.setupCity()                 → 插 `setupAbyssPortal(this);`（初始化门对象）
 *   • updateCityWorld()（进圈判定/读条） → 插 `updateAbyssPortal(dt);`
 *   • renderCity()（门渲染）             → 插 `renderAbyssPortal(ctx, w);`
 *   • screenToWorld 主城分支             → 走既有 `G.abyssPortal` 坐标（与 NPC 同口径）
 *   • 触屏点选：新增 `abyssPortalTap(cx, cy)`，由 main.js 的 pointerdown 单行调用
 *   • 进出流程：`enterEndless()` / `exitEndlessToCity()`，由 main.js 事件单行调用
 *
 * 数值全部进 CFG，逻辑不写死；ES5/ES6 全局脚本，中文注释。
 * ========================================================================== */

/* 兜底常量（CFG 缺失时不影响启动；正常路径一律读 CFG.city.abyssPortal） */
var ABYSS_FALLBACK = { fx: 0.86, fy: 0.60, radius: 84, channel: 2.0,
  hintRadius: 104, tapRadius: 116, color: "#ff7a3c", glow: "#ffd76a",
  desc: "进圈读条 2 秒 → 进入无尽深渊", ready: true };

/** 读取深渊之门配置（惰性 + 缺省回落，避免 CFG 半加载时报错）。 */
function abyssCfg() {
  var c = (typeof CFG !== "undefined" && CFG.city && CFG.city.abyssPortal) || null;
  return c || ABYSS_FALLBACK;
}

/** 无尽世界是否可用：另一代理的 Endless 必须暴露 makeWorld + begin 两个入口才算就绪。
 *  未就绪时门照常渲染，但进入动作降级为 toast（不硬依赖、不抛错）。 */
function endlessReady() {
  return typeof Endless !== "undefined" && Endless
    && typeof Endless.makeWorld === "function" && typeof Endless.begin === "function";
}

/* 门对象初始化（由 World.setupCity 单行调用）：比例坐标 → 像素。 */
function setupAbyssPortal(w) {
  if (!w || w.kind !== "city") return;
  var c = abyssCfg();
  w.abyssPortal = {
    name: c.name || "深渊之门",
    x: (c.fx != null ? c.fx : ABYSS_FALLBACK.fx) * w.w,
    y: (c.fy != null ? c.fy : ABYSS_FALLBACK.fy) * w.h,
    radius: c.radius || ABYSS_FALLBACK.radius,
    channel: c.channel || ABYSS_FALLBACK.channel,
  };
  w.abyssProgress = 0;          // 读条进度（本区块私有字段，与 portalProgress 区分）
  w.abyssReady = false;         // 圈内标记（供渲染高亮 / 点选门槛）
}

/** 进圈判定 + 读条推进（由 updateCityWorld 单行调用，city 世界 + avatar 存在时）。
 *  - 进圈：积累进度并置 abyssReady=true（高亮提示）；
 *  - 出圈：置 abyssReady=false 并 1.2 倍速衰退（与出征门/撤离读条同一契约）；
 *  - 读满 channel：调用 enterAbyssFromPortal() 进门（守卫 endlessReady；内部先走
 *    「深渊选角」界面，宿主未提供选角入口时回落直接进入）。 */
function updateAbyssPortal(dt) {
  var w = G.activeWorld, a = G.cityAvatar;
  if (!w || w.kind !== "city" || !a || !w.abyssPortal) return;
  var p = w.abyssPortal;
  var inCircle = U.dist(a.x, a.y, p.x, p.y) < p.radius * CFG.altarJudgeMul;
  w.abyssReady = inCircle;
  if (inCircle && p.name) {
    w.abyssProgress += dt;
    if (w.abyssProgress >= p.channel) {
      w.abyssProgress = 0;
      enterAbyssFromPortal();
      return;
    }
  } else {
    w.abyssProgress = Math.max(0, w.abyssProgress - dt * 1.2);   // 离开缓慢衰退
  }
}

/** 深渊门触屏点选（与 cityNpcTap 同款结构，缺口最小化）。
 *  门槛三重：① G.state === "city" ② G.abyssReady（已进圈）③ 点击点落在门 tapRadius 内。
 *  命中：已就绪则进门（改走「深渊选角」界面，见 enterAbyssFromPortal）；未就绪 toast 提示。
 *  返回 true = 本次点击已消费。 */
function abyssPortalTap(clientX, clientY) {
  if (G.state !== "city") return false;
  var w = G.activeWorld, p = w && w.abyssPortal;
  if (!p || !w.abyssReady) return false;            // 圈外不响应（避免隔屏误点）
  var pt = screenToWorld(clientX, clientY);
  if (!pt) return false;
  var c = abyssCfg();
  var r = c.tapRadius || ABYSS_FALLBACK.tapRadius;
  if (U.dist(pt.x, pt.y, p.x, p.y) > r) return false;
  enterAbyssFromPortal();
  return true;
}

/* ---------- 深淵进门入口（21.18：平移主线玩法 —— 进门先选角色） ----------
 * 用户口径：深渊 = 主线玩法的 100 波大秘境版本，所以进门流程应与主线一致
 *   （主城传送门 → 选关 → 选角 → 战斗；深渊之门 → **选角** → 深渊战斗）。
 * 实现：优先委托宿主 Game.enterAbyssCharSelect()（走 screen-character 选角界面，
 *   选完由 btn-char-start 调 enterEndless(selectedChars)）；
 *   ⚠️ 宿主未提供时（旧版本 / 测试桩）**回落直接进入**，保证门始终可用。 */
function enterAbyssFromPortal() {
  /* 21.20：层级系统退役（用户口径「深渊大秘境不需要层级」）——进门**直通选角**
   * （选完由 btn-char-start 调 enterEndless(selectedChars)）；
   * 宿主未提供时（旧版本 / 测试桩）**回落直接进入**，保证门始终可用。
   * 战绩榜入口移至深渊选角界面的「深渊战绩」按钮（#btn-abyss-records）。 */
  if (typeof Game !== "undefined" && Game && typeof Game.enterAbyssCharSelect === "function") {
    if (Game.enterAbyssCharSelect()) return true;
  }
  return enterEndless();
}

/* ---------- 进出门流程 ---------- */

/** 进入无尽世界：首次弹规则说明（存档标记 endlessSeen）；守卫 Endless 就绪。
 *  - 就绪：切 G.state="playing"，创建世界 + begin，置 G.inEndless=true；
 *  - 未就绪：toast 提示并留在主城（安全降级，不抛错）。 */
function enterEndless(chars) {
  /* 21.18：允许两个入口状态 —— 主城直接进（旧路径）/ 深渊选角界面点「开始」进（新路径）。
   * ⚠️ 选角界面 G.state === "charSel"，若只放行 "city" 会导致「点开始无反应」。 */
  if (G.state !== "city" && G.state !== "charSel") return false;
  // 首次进入：先记存档标记（G.saved.endlessSeen，跨会话只弹一次）。
  // ⚠️ 面板弹窗**不能在这里做**——下方 Game.startRun 会调 UI.showHudOnly() 把 screen 层
  //    切走（真机复现：说明面板一闪而过/根本看不到）。挪到本函数末尾再弹。
  var firstTime = markEndlessSeen();
  if (!endlessReady()) {
    if (typeof UI !== "undefined" && UI.toast) UI.toast("深渊尚未开启（无尽模式未就绪）", "bad");
    return false;
  }
  /* ⚠️ 集成修复（21.15）：必须先建**完整 run 上下文**再换世界。
   * 原实现只 new 了 World，没建 G.run/G.player/G.team → 渲染与 update 循环读
   * `G.run.weaponInv` 每帧抛 TypeError（真机复现：黑屏 + 控制台刷屏）。
   * 复用 startRun 的上下文构建（队伍/局外等级加成/背包/芯片/模块/recomputeWeapon），
   * 再把 activeWorld 换成无尽世界 —— 与正式关卡开局的字段集合严格一致，杜绝漏项。 */
  /* 角色来源优先级（21.18 深渊选角）：显式入参（选角界面选定）> 上次队伍 G.team > 首个英雄。
   * ⚠️ 入参应是 CFG.heroes 的**原始英雄定义**（与主线 startRun 同口径）；
   *    局外等级加成由 startRun 内部 applyOutLevel 统一施加，此处不重复应用。
   * ⚠️ 兼容性：旧调用点（updateAbyssPortal / 测试桩）不带参数 → 恒等旧行为。 */
  var team = (Array.isArray(chars) && chars.length) ? chars
    : ((G.team && G.team.length) ? G.team : [CFG.heroes[0]]);
  /* startRun 会读 `G.levelCfg.mapW/mapH/name`（关卡表产物）——无尽模式没有「关卡」，
   * 故先兜一个**深渊虚拟关卡**（尺寸用城市地图尺寸，名字「无尽深渊」），
   * 只供 startRun 建世界与提示文案使用；随后 activeWorld 立刻被无尽世界覆盖。 */
  if (!UI.selectedLevel && typeof UI !== "undefined") UI.selectedLevel = CFG.levels[0];
  var prevLevelCfg = G.levelCfg;
  G.levelCfg = {
    name: (CFG.city && CFG.city.abyssPortal && CFG.city.abyssPortal.name) || "无尽深渊",
    mapW: (CFG.city && CFG.city.mapW) || 1920,
    mapH: (CFG.city && CFG.city.mapH) || 960,
  };
  if (typeof Game !== "undefined" && Game && typeof Game.startRun === "function") {
    try {
      Game.startRun(team);          // 建 run/player/mainWorld/队友/技能解析；末尾会置 state="playing"
    } catch (e) {
      // startRun 依赖外部状态（UI.selectedLevel 等）缺失时降级：保底建 run，别让入口崩掉
      G.heroDef = team[0];
      G.run = createRun(G.heroDef);
      G.player = new Player(G.levelCfg.mapW / 2, G.levelCfg.mapH / 2);
      G.state = "playing";
      if (typeof console !== "undefined" && console.warn) console.warn("enterEndless: startRun 降级", e && e.message);
    }
  } else {
    // 极端降级（无 Game 宿主时）：至少补齐 run，避免渲染崩
    G.heroDef = team[0];
    G.run = createRun(G.heroDef);
    G.player = new Player(G.levelCfg.mapW / 2, G.levelCfg.mapH / 2);
    G.state = "playing";
  }
  if (prevLevelCfg) G.levelCfg = prevLevelCfg;   // 还原（无尽世界不依赖关卡表）
  /* 21.18 修复（「进图必死」的机械根因）：世界尺寸必须取 CFG.endless 的**无尽竞技场**尺寸。
   * 原实现误用 CFG.city（1280×960），而 startRun 的出生点取 CFG.levels[0]（1920×1920）中心
   * =（960,960）→ 玩家落在**世界下边缘**（y 恰 = 世界高），_spawnSpot 的 maxY 变负数
   * → 刷怪环带退化（怪只从左右来、x 甚至算到世界外）→ 开局被贴脸围殴。
   * 同源修正：世界、出生点、刷怪环带三者统一到 CFG.endless.mapW/mapH。 */
  var W = (typeof CFG.endless !== "undefined" && CFG.endless.mapW) || 1920;
  var H = (typeof CFG.endless !== "undefined" && CFG.endless.mapH) || 1920;
  var world = Endless.makeWorld(W, H);
  G.endlessWorld = world;
  G.activeWorld = world;          // ★ 覆盖 startRun 建的 mainWorld：无尽世界接管
  G.mainWorld = world;            // 与 activeWorld 同步，避免队友/无人机的世界归属判断落空
  G.inEndless = true;
  /* 玩家 + 队友统一落位到**无尽世界中心**（与 startRun 的关卡出生点解耦），并重铺尾迹——
   * 否则队友仍停在 startRun 旧世界的坐标上，可能出现出界/错位。 */
  if (G.player) { G.player.x = world.w / 2; G.player.y = world.h / 2; }
  if (typeof seedTrail === "function") seedTrail(world, CFG.team.follow.seedDir[0], CFG.team.follow.seedDir[1]);
  if (typeof snapCompanions === "function") snapCompanions(world);
  Endless.begin(world);
  /* 21.20：按固定层 1 抽取词缀（层级退役后 countAnchors(1)=0 条 → 词缀系统暂 dormant，
   * CFG.endless.affixes 与整套 rollAffixes 保留，后续可作为独立难度钩子复用）。 */
  if (typeof Endless.rollAffixes === "function") {
    try { Endless.rollAffixes(1); } catch (e) { /* 词缀失败不阻断进图 */ }
  }
  /* 21.20 深渊逐角色伤害/承伤统计：每局清零（队长 + 全体队友）。
   * 字段 dmgDealt / dmgTaken 挂在英雄运行时实体上（见 combat.js abyssDamageHeroOf）。 */
  if (G.player) { G.player.dmgDealt = 0; G.player.dmgTaken = 0; }
  if (G.run && Array.isArray(G.run.companions)) {
    for (var ci = 0; ci < G.run.companions.length; ci++) {
      var cm = G.run.companions[ci];
      if (cm) { cm.dmgDealt = 0; cm.dmgTaken = 0; }
    }
  }
  /* 21.17 深渊玩家强化：G.inEndless 置位后 computeStats() 才返回强化倍率，
   * 故必须**在置位之后**补满血 —— 否则 hpMax 已涨到 500 但当前 hp 仍是主线的残血，
   * 玩家顶着一个「大血条的空壳」进图，强化形同虚设。 */
  if (typeof recomputeWeapon === "function") recomputeWeapon();
  if (G.player) { const st0 = computeStats(); G.run.hp = st0.hpMax; }
  // 首帧对齐：清空主城残留交互状态
  G.cityNpcOpen = null; G.cityNpcNear = null;
  var hud = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("hud") : null;
  if (hud && hud.classList) hud.classList.remove("city-mode");
  if (typeof UI !== "undefined" && UI.toast) UI.toast("◈ 踏入深渊之门——无尽试炼开始！", "gold");
  // 首次规则说明：放在所有 UI 切换**之后**弹（startRun 的 showHudOnly 会顶掉 screen 层），
  // 保证玩家真正看到说明面板（21.15 集成修复，endless_flow_test 七2 曾抓到此缺陷）。
  if (firstTime && typeof UI !== "undefined" && UI.showEndlessIntro) UI.showEndlessIntro();
  return true;
}

/** 无尽模式结算 → 返回主城（由 UI 结算面板「返回主城」/「再来一次」调用）。
 *  - 复用撤离结算口径：G.lastSettleReport + buildCrystalReport 由调用方在结算前写入；
 *  - 清无尽世界/旗标，回到主城（Hub）。 */
function exitEndlessToCity() {
  G.inEndless = false;
  G.endlessWorld = null;
  if (typeof Endless !== "undefined" && Endless && typeof Endless.reset === "function") {
    Endless.reset();
  }
  if (typeof Game !== "undefined" && Game && typeof Game.returnToCity === "function") {
    Game.returnToCity();
  } else if (typeof Game !== "undefined" && Game && typeof Game.enterCity === "function") {
    Game.enterCity();
  }
  return true;
}

/** 无尽模式「再来一次」：结算后不回国、直接重开一局。 */
function restartEndless() {
  if (typeof Game !== "undefined" && Game && typeof Game.enterCity === "function") {
    Game.enterCity();          // 先回主城清场
  }
  return enterEndless();       // 立即重进（数值置零由 Endless.reset/begin 保证）
}

/** 无尽模式死亡结算：读 Endless.settle() → 结晶入存档 → 弹结算面板。
 *  Endless 未就绪时用安全兜底（波次/击杀读 world 或 run，结晶 0），保证面板总能弹、不抛错。 */
function showEndlessSettle() {
  G.state = "settled";
  var s = { wave: 0, kills: 0, crystals: 0 };
  if (typeof Endless !== "undefined" && Endless && typeof Endless.settle === "function") {
    try { s = Endless.settle() || s; } catch (e) { s = { wave: 0, kills: 0, crystals: 0 }; }
  }
  s.wave = Number(s.wave) || 0;
  s.kills = Number(s.kills) || 0;
  s.crystals = Number(s.crystals) || 0;
  // 结晶入局外存档（与撤离/死亡同一货币：进化结晶）
  if (s.crystals > 0 && typeof Meta !== "undefined" && Meta && Meta.data) {
    Meta.data.crystals = (Meta.data.crystals || 0) + s.crystals;
    if (Meta.commit) Meta.commit();
  }
  if (typeof SFX !== "undefined" && SFX.play) SFX.play("death");
  // 复用撤离结算明细写入 G.lastSettleReport（第 3 参表示死亡、非撤离）
  if (typeof publishCrystalReport === "function") {
    try { publishCrystalReport(s.kills, false, false, 0); } catch (e) { /* 明细失败不影响结算 */ }
  }
  // 21.15 修复（接缝时序）：先把无尽口径的报告对齐**再**渲染面板。
  // 原时序：publish(boss=0) → UI 渲染（明细行读旧报告 → 「本局合计 +0」）→ hook 才对齐报告 →
  // 面板文本与真实入账不一致（endless_e2e 截图抓到「获得 +16 / 合计 +0」并存）。
  // endlessRewardOnSettle 在 main.js 末尾区块（🅓），运行时已定义，typeof 守卫兼容桩环境。
  if (typeof endlessRewardOnSettle === "function") {
    try { endlessRewardOnSettle(); } catch (e) { /* 对齐失败不阻断结算 */ }
  }
  /* 21.19 深渊记录 + 首通奖励（幂等；非深渊/未加载时安全降级）。
   *   onSettle 更新最高波次/层数/最快用时；grantFirstRewards 返回本次额外结晶，累进面板数值。 */
  if (typeof EndlessRecord !== "undefined" && EndlessRecord) {
    try {
      EndlessRecord.onSettle({
        wave: s.wave, kills: s.kills, crystals: s.crystals, elapsed: s.elapsed,
        extracted: (typeof G !== "undefined" && G && G.abyssSettleReason === "extract"),
        reason: (typeof G !== "undefined" && G) ? G.abyssSettleReason : null,
        timedOut: s.timedOut,
        bossKills: s.bossKills,
      });
      var _bonus = EndlessRecord.grantFirstRewards();
      if (_bonus > 0) s.crystals += _bonus;
    } catch (e) { /* 记录失败不阻断结算 */ }
  }
  if (typeof UI !== "undefined" && UI.showEndlessSettle) UI.showEndlessSettle(s);
  return s;
}

/* 首次进入标记：写存档 G.saved（先读后写，兼容老存档）。
 * 返回 true 表示「本次是首次」（应弹说明）；已读过的返回 false。 */
function markEndlessSeen() {
  try {
    var s = (typeof G !== "undefined") ? G.saved : null;
    if (!s || typeof s !== "object") { if (typeof G !== "undefined") G.saved = s = {}; }
    if (!s) return true;         // 无 G.saved（极端桩环境）：按首次处理，不抛错
    if (s.endlessSeen) return false;
    s.endlessSeen = true;
    if (typeof Meta !== "undefined" && Meta && Meta.data && Meta.commit) {
      Meta.data.endlessSeen = true;   // 同步落盘（若 Meta 存在）
      Meta.commit();
    }
    return true;
  } catch (e) { return true; }    // 写标记失败也不阻断流程（安全降级）
}

/* 查询：是否已看过说明（供测试/UI 判定）。 */
function hasSeenEndlessIntro() {
  try {
    if (G && G.saved && G.saved.endlessSeen) return true;
    if (typeof Meta !== "undefined" && Meta && Meta.data && Meta.data.endlessSeen) return true;
    return false;
  } catch (e) { return false; }
}

/* 21.15 深渊之门区块结束 */

/* ============================================================================
 * ====== 21.17 深渊撤离点 + 屏蔽空间裂隙雕像（🅑 线）—— 独立区块（§5.45 铁律） ======
 * ----------------------------------------------------------------------------
 * 职责：① 最终 BOSS 被击杀 → 掉落**撤离点**（复用主线 exitBeacon 的视觉/判定方式）；
 *       ② 玩家走进撤离点 → judgeChannel 读条（CFG.endless.extractChannel = 3.0s）→ 撤离成功；
 *       ③ 撤离成功 = **带全收益结算**（不走死亡 30% 折扣）；超时 = 失败结算（保留 30%）；
 *       ④ 深渊世界**屏蔽空间裂隙雕像（RIFT）**——只在深渊的祭坛抽取处过滤，**不改 CFG.altars 本身**。
 *
 * 接入方式（现有函数体内**只插单行调用**，行级冲突最小化；全部用 typeof 守卫）：
 *   • main.js 主循环 update 前 → `updateAbyssExtract(dt)`（每帧推进：掉落轮询 + 读条）
 *   • 受击打断 → heroTakeDamage 内 `abyssExtractInterrupt()`（读条归零，对齐主线 exitBeacon）
 *   • 渲染复用 → 世界字段 `world.exitBeacon`（render.js 的 artisan 分支自动绘制，零改动）
 *   • 结算入口 → `abyssExtractSettle(reason)`，由 main.js / 结算侧单行调用
 *
 * ⚠️ 生存空间约定：本区块**全部新增函数**，不改任何既有函数体。
 *   对既有行为的唯一改动 = RIFT 屏蔽（通过 monkey-patch 深渊世界实例的 altars 抽取，见下）。
 * ========================================================================== */

/** 世界是否为「深渊（无尽）」世界：以世界自带 kind 为准（与 Endless.isActive 同口径）。
 *  非深渊世界恒返回 false → 本区块全部逻辑零介入（主线/裂缝/工匠/主城行为逐位不变）。 */
function isAbyssWorld(w) {
  var world = w || (typeof G !== "undefined" && G ? G.activeWorld : null);
  return !!(world && world.kind === "endless");
}

/** 深渊撤离点配置（惰性读取 CFG.endless，缺字段回落，避免 CFG 半加载时报错）。
 *  数值单一事实源 = CFG.endless（铁律：逻辑不硬编码）。 */
function abyssExtractCfg() {
  var e = (typeof CFG !== "undefined" && CFG.endless) || {};
  return {
    channel: (typeof e.extractChannel === "number") ? e.extractChannel : 3.0,  // 读条时长（秒）
    dropRadius: 90,        // 掉落点与 BOSS 死亡位置的最大偏移（避免重叠在尸体上）
    judgeRadius: 100,      // 判定圈绘制半径（与主线 exitBeacon 同款）
  };
}

/** 最终 BOSS 掉撤离点（幂等：只掉一次；非最终 BOSS 不掉）。
 *  - 判定依据：Endless.isFinalBossDefeated() 为真（由 endless.js 的 recordKill 置位）；
 *  - 掉落位置：BOSS 死亡位置附近（世界内随机偏移，避墙）；
 *  - 视觉/判定复用：写 world.exitBeacon（render.js 的 artisan 分支自动绘制虚线判定圈 + 进度环）。
 *  返回 true = 本次确实掉了撤离点。 */
function spawnAbyssExtractBeacon(world) {
  var w = world || (typeof G !== "undefined" && G ? G.activeWorld : null);
  if (!isAbyssWorld(w)) return false;
  if (w.exitBeacon) return false;   // ⚠️ 只在最终 BOSS 死后出现一次（不重复）
  if (typeof Endless === "undefined" || !Endless || typeof Endless.isFinalBossDefeated !== "function") return false;
  if (!Endless.isFinalBossDefeated()) return false;   // 非最终 BOSS / 尚未击杀 → 不掉
  var c = abyssExtractCfg();
  // 掉落位置：BOSS 死亡位置附近随机偏移（避墙 60px）；无记录则回退世界中心。
  var src = w._lastFinalBossPos || null;
  var bx = src ? src.x : w.w / 2, by = src ? src.y : w.h / 2;
  var a = U.rand(0, Math.PI * 2), rr = U.rand(0, c.dropRadius);
  var x = U.clamp(bx + Math.cos(a) * rr, 60, w.w - 60);
  var y = U.clamp(by + Math.sin(a) * rr, 60, w.h - 60);
  w.exitBeacon = { x: x, y: y };                                   // 复用主线字段名（渲染自动生效）
  w.abyssExtractReady = false;                                     // 圈内标记（读条/视觉）
  w.abyssExtractDone = false;                                      // 是否已撤离（防重复结算）
  w.abyssExtractProgress = 0; w.abyssExtractHolder = null;          // 读条进度/持有者（复用 judgeChannel 契约）
  w.exitProgress = 0;                                              // 渲染进度环读取该字段（render.js 用 exitProgress）
  if (typeof UI !== "undefined" && UI.toast) {
    UI.toast("◈ 最终 BOSS 已被击败！撤离点已出现——走进圈内读条即带全收益撤离", "gold");
  }
  if (typeof SFX !== "undefined" && SFX.play) SFX.play("extract");
  return true;
}

/** 记录最终 BOSS 死亡位置（供掉撤离点定位）。由 recordKill 类的击杀回调单行调用；
 *  非最终 BOSS 不记录。返回 true = 已记录。 */
function noteFinalBossDeath(monster) {
  var w = (typeof G !== "undefined" && G ? G.activeWorld : null);
  if (!isAbyssWorld(w)) return false;
  if (!monster || !monster.endlessFinalBoss) return false;
  w._lastFinalBossPos = { x: monster.x, y: monster.y };
  return true;
}

/** 每帧推进深渊撤离（main.js 主循环单行调用）：① 掉落轮询 ② 读条判定 ③ 到点 → 撤离成功。
 *  - 超时（Endless.isTimedOut）→ 失败结算（保留 30%），与死亡同口径；
 *  - 撤离中受击 → 归零（由 heroTakeDamage 调 abyssExtractInterrupt）；
 *  - 非深渊世界 / 未 begin → 立即返回（零副作用）。 */
function updateAbyssExtract(dt) {
  var w = (typeof G !== "undefined" && G ? G.activeWorld : null);
  if (!isAbyssWorld(w)) return false;
  if (typeof Game !== "undefined" && Game && Game.paused) return false;   // 升级 4 选 1 暂停不推进
  if (!(dt > 0)) return false;

  // ① 超时优先：超时 → 失败结算（保留 30%），撤离点不再生效
  if (typeof Endless !== "undefined" && Endless && typeof Endless.isTimedOut === "function" && Endless.isTimedOut()) {
    if (!w.abyssExtractSettled) abyssExtractSettle("timeout");
    return true;
  }
  if (w.abyssExtractDone || w.abyssExtractSettled) return false;

  // ② 掉落轮询：最终 BOSS 已死但撤离点尚未出现 → 补掉（幂等，只掉一次）
  if (!w.exitBeacon) spawnAbyssExtractBeacon(w);
  if (!w.exitBeacon) return false;

  // ③ 读条判定（复用统一入口 judgeChannel；受击归零由 abyssExtractInterrupt 承担）
  var c = abyssExtractCfg();
  var done = judgeChannel(w, w.exitBeacon.x, w.exitBeacon.y, c.judgeRadius, dt, c.channel,
    "abyssExtractProgress", "abyssExtractHolder");
  w.exitProgress = w.abyssExtractProgress || 0;        // 同步给渲染进度环（render.js 读 exitProgress）
  w.abyssExtractReady = !!w.abyssExtractHolder;
  if (done) {
    w.abyssExtractDone = true;
    abyssExtractSettle("extract");
  }
  return true;
}

/** 撤离读条受击打断（heroTakeDamage 单行调用）：读条归零（撤离点保留，可重读）。
 *  对齐主线 exitBeacon 的「受击立即归零」语义。返回 true = 本次确实打断了读条。 */
function abyssExtractInterrupt() {
  var w = (typeof G !== "undefined" && G ? G.activeWorld : null);
  if (!isAbyssWorld(w)) return false;
  if (!w.exitBeacon) return false;
  var had = (w.abyssExtractProgress || 0) > 0;
  w.abyssExtractProgress = 0; w.abyssExtractHolder = null; w.exitProgress = 0; w.abyssExtractReady = false;
  if (had && typeof UI !== "undefined" && UI.toast) UI.toast("撤离读条被打断！（撤离点仍在原地，重新站回圈内即可继续）", "bad");
  return had;
}

/** 深渊结算统一入口（三种口径：撤离成功 / 死亡 / 超时）：
 *  - reason = "extract"：**带全收益结算**（不走死亡 30% 折扣）；
 *  - reason = "death"  ：死亡失败结算（保留 30%）；
 *  - reason = "timeout"：超时失败结算（保留 30%，与死亡同口径）。
 *  写 G.lastSettleReport（复用 publishCrystalReport）+ 置 G.state="settled"，供 UI 结算面板渲染。
 *  返回结算报告对象（供测试断言）。幂等：同一局只结算一次。 */
function abyssExtractSettle(reason) {
  var w = (typeof G !== "undefined" && G ? G.activeWorld : null);
  var extracted = (reason === "extract");
  var s = { wave: 0, kills: 0, crystals: 0, timedOut: (reason === "timeout"), bossKills: 0, elapsed: 0 };
  if (typeof Endless !== "undefined" && Endless && typeof Endless.settle === "function") {
    try { var r = Endless.settle(); if (r) s = r; } catch (e) { /* 结算取数失败不阻断 */ }
  }
  s.wave = Number(s.wave) || 0; s.kills = Number(s.kills) || 0; s.crystals = Number(s.crystals) || 0;
  s.reason = reason || (extracted ? "extract" : "death");
  s.extracted = extracted;
  // 标记已结算（防重复）；世界若存在则打标
  if (w) { w.abyssExtractSettled = true; w.abyssExtractDone = extracted; }
  if (typeof G !== "undefined" && G) {
    G.abyssSettleReason = s.reason;
    G.abyssExtractSuccess = extracted;
    G.state = "settled";
  }
  // 结晶入局外存档：撤离成功发全收益；死亡/超时保留 deathRatio（与主线 awardRun 同口径）
  var boss = s.crystals || 0;
  if (!extracted && typeof CFG !== "undefined" && CFG.outLevel && typeof CFG.outLevel.deathRatio === "number") {
    boss = Math.floor(boss * CFG.outLevel.deathRatio);   // 失败结算（保留 30%）
  }
  if (boss > 0 && typeof Meta !== "undefined" && Meta && Meta.data) {
    Meta.data.crystals = (Meta.data.crystals || 0) + boss;
    if (Meta.commit) Meta.commit();
  }
  // 复用既有结算报告（中文文案；撤离 = 全收益，死亡/超时 = 阵亡口径）
  if (typeof publishCrystalReport === "function") {
    try { publishCrystalReport(s.kills, true, extracted, boss); } catch (e) { /* 明细失败不影响结算 */ }
  }
  if (typeof SFX !== "undefined" && SFX.play) SFX.play(extracted ? "extract" : "death");
  return s;
}

/* ---------- 屏蔽空间裂隙雕像（RIFT）：只在深渊世界的祭坛抽取处过滤 ----------
 * 背景：主线/裂缝仍需空间裂隙（CFG.altars.RIFT），深渊是纯粹冲关 → 不刷 RIFT。
 * 手法（**不改 game.js / 不改 CFG.altars**）：
 *   game.js 的 setupMain 祭坛抽取写死 `const pool = Object.entries(CFG.altars).filter(...)`，
 *   而深渊世界走 setupArtisan 分支（isMain=false），**从不经过该行**。故 RIFT 屏蔽的
 *   真正落点 = 深渊自己的世界：makeWorld 归零 altars 后由本区块按过滤后的池投放。
 *   为可测且不误伤主线，抽出纯函数 abyssAltarPool() / rollAbyssAltars()：
 *     · 主线调用恒返回全池（含 RIFT）——不误伤；
 *     · 深渊调用会排除白名单里的 id（RIFT）。 */

/** 深渊祭坛屏蔽白名单：这些祭坛 id 不在深渊生成（默认屏蔽空间裂隙 RIFT）。
 *  可通过 CFG.endless.blockAltars 覆盖（数组）；缺省 = ["RIFT"]。 */
function abyssBlockedAltarIds() {
  var e = (typeof CFG !== "undefined" && CFG.endless) || {};
  if (Array.isArray(e.blockAltars)) return e.blockAltars.slice();
  return ["RIFT"];
}

/** 祭坛抽取池（纯函数）：入参 kind 为 "endless" 时排除屏蔽白名单，其余世界返回全池。
 *  返回 { id: weight } 的拷贝（不改 CFG.altars 本体）。 */
function abyssAltarPool(kind) {
  var pool = {};
  var blocked = (kind === "endless") ? abyssBlockedAltarIds() : [];
  var altars = (typeof CFG !== "undefined" && CFG.altars) || {};
  for (var k in altars) {
    var a = altars[k];
    if (!a || !(a.weight > 0)) continue;                 // 只取有权重的（与 game.js:921 同口径）
    if (blocked.indexOf(k) >= 0) continue;               // 深渊：排除屏蔽白名单（RIFT）
    pool[k] = a.weight;
  }
  return pool;
}

/** 为深渊世界投放祭坛（排除 RIFT）：从 abyssAltarPool("endless") 按权重抽 count 个。
 *  返回本次投放的 id 数组（供测试断言「100 次不含 RIFT」）。 */
function rollAbyssAltars(world, count) {
  var w = world;
  if (!isAbyssWorld(w)) return [];
  var n = (count === undefined) ? 5 : count;
  var pool = abyssAltarPool("endless");
  var ids = Object.keys(pool);
  if (!ids.length) return [];
  w.altars = w.altars || [];
  var made = [];
  for (var i = 0; i < n; i++) {
    var id = U.weightedPick(pool);
    if (!id) break;
    var pos = w.findFreeSpot ? w.findFreeSpot(100) : null;
    var x = pos ? pos.x : U.rand(200, w.w - 200), y = pos ? pos.y : U.rand(200, w.h - 200);
    w.altars.push({ cfg: CFG.altars[id], x: x, y: y, id: id });
    made.push(id);
  }
  return made;
}

/* 21.17 深渊撤离点 + 屏蔽 RIFT 区块结束 */
