/* ============================================================
 * ui.js — 界面流程 / HUD / 背包拖拽 / 工匠开箱 / 结算 / 死亡
 * ============================================================ */
"use strict";

const UI = {
  selectedChar: null,
  selectedChars: [],   // 多角色组队（1~3 人，CFG.team.maxSize）
  selectedChestQ: null,
  drag: null,          // {item, fromInv, fromPending}
  hoverItem: null,

  /* ---------- 界面切换 ---------- */
  showScreen(name) {
    for (const id of ["screen-level", "screen-character", "screen-settle", "screen-death"])
      document.getElementById(id).classList.toggle("hidden", id !== name);
    document.getElementById("hud").classList.add("hidden");
  },
  showHudOnly() {
    for (const id of ["screen-level", "screen-character", "screen-settle", "screen-death"])
      document.getElementById(id).classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
  },

  /* ---------- 提示 ---------- */
  toast(msg, cls = "") {
    const area = document.getElementById("toast-area");
    const el = document.createElement("div");
    el.className = "toast " + cls;
    el.textContent = msg;
    area.appendChild(el);
    setTimeout(() => el.remove(), 2700);
    while (area.children.length > 4) area.firstChild.remove();
  },

  /* ---------- 关卡选择（解锁链：通关第 n 关解锁第 n+1 关） ---------- */
  buildLevelList() {
    const box = document.getElementById("level-list");
    box.innerHTML = "";
    CFG.levels.forEach((lv, idx) => {
      const unlocked = idx < Meta.data.unlockedLevels;
      const card = document.createElement("div");
      card.className = "level-card" + (unlocked ? "" : " locked");
      card.innerHTML = `<div><b>${lv.name}</b></div>
        <small>${unlocked ? `目标击杀 ${lv.progressGoal} · 时限 ${lv.timeLimit}s · BOSS ${CFG.monsters[lv.boss].name} · 点击开始` : "🔒 通关前一关解锁"}</small>`;
      if (unlocked) card.onclick = () => { this.selectedLevel = lv; Game.enterCharSelect(); };
      box.appendChild(card);
    });
  },

  /* ---------- 角色选择（含局外等级/升级） ---------- */
  buildCharList() {
    this.selectedChars = this.selectedChars || [];
    const box = document.getElementById("char-list");
    box.innerHTML = "";
    const first = CFG.heroes;   // 原型阶段：全部角色可选（H007/H008 为召唤/陷阱技能验证角，正式版再作解锁门槛）
    for (const h of first) {
      const card = document.createElement("div");
      card.className = "char-card" + (this.selectedChars.some(s => s.id === h.id) ? " selected" : "");
      const img = Assets.images[h.sprite];
      const lv = Meta.heroLevel(h.id);
      const g = CFG.outLevel.growth, n = lv - 1;
      const cost = Meta.levelUpCost(h.id);
      const canUp = lv < CFG.outLevel.maxLevel && Meta.data.crystals >= cost;
      const skLv = Meta.weaponLv(h.id);   // 技能等级 = 武器等级
      const wpn = CFG.weapons[h.weapon], skId = wpn.skills.skill;
      const sk = CFG.skills[skId];
      const skLine = this._skillSummary(sk, skLv);
      card.innerHTML = `
        ${img ? `<canvas class="char-face" width="64" height="64"></canvas>` : ""}
        <div class="info"><b>${h.name}（${h.id}）</b>
        <p class="outlv">局外 LV${lv}${lv < CFG.outLevel.maxLevel
          ? ` · 升级需 <b class="crystal">◆${cost}</b>`
          : " · 已满级"} <small>（当前：HP ${h.hp + g.hp * n} · 攻 ${h.atk + g.atk * n} · 防 ${h.def + g.def * n}）</small></p>
        <p class="outlv">技能 LV${skLv} <small>（${skLine}）</small></p>
        <p class="outlv">武器 LV${skLv}${skLv < CFG.weaponLevel.maxLv
          ? ` · 工匠世界花金币升级（下一级 ¥${CFG.weaponLevels[skLv].cost}）`
          : " · 已满级"} <small>（武器等级 = 技能等级，撤离后永久保留）</small></p>
        <p>${h.desc}</p>
        <p>HP ${h.hp} · 攻击 ${h.atk} · 防御 ${h.def} · 移速 ${h.spd} · 武器：${wpn.name}</p></div>
        <div class="card-btns">
        ${lv < CFG.outLevel.maxLevel ? `<button class="btn small lvup" ${canUp ? "" : "disabled"}>升级 ◆${cost}</button>` : ""}
        </div>`;
      if (img) {
        const cv = card.querySelector(".char-face");
        cv.getContext("2d").drawImage(img, 0, 0, 64, 64);
      }
      card.onclick = () => {
        // 多角色组队：点击选中/取消，上限 CFG.team.maxSize
        const idx = this.selectedChars.findIndex(s => s.id === h.id);
        if (idx >= 0) this.selectedChars.splice(idx, 1);
        else {
          if (this.selectedChars.length >= CFG.team.maxSize) { this.toast(`组队上限 ${CFG.team.maxSize} 人`, "bad"); return; }
          this.selectedChars.push(h);
        }
        card.classList.toggle("selected", idx < 0);
        document.getElementById("btn-char-start").disabled = this.selectedChars.length === 0;
        document.getElementById("btn-char-start").textContent =
          `开始游戏（${this.selectedChars.length}/${CFG.team.maxSize}）`;
      };
      const up = card.querySelector(".lvup");
      if (up) up.onclick = (e) => {
        e.stopPropagation();
        if (Meta.levelUp(h.id)) {
          this.toast(`${h.name} 局外等级提升至 LV${Meta.heroLevel(h.id)}！`, "gold");
          this.buildCharList();
        } else this.toast("结晶不足", "bad");
      };
      box.appendChild(card);
    }
    const metaLine = document.getElementById("meta-line");
    if (metaLine) metaLine.innerHTML = `◆ 进化结晶 <b>${Meta.data.crystals}</b><small>　撤离/击杀获得 · 死亡仅保留 ${CFG.outLevel.deathRatio * 100}% · 用于角色局外升级</small>`;
  },
  /* 技能摘要：弹道技能 / 召唤物 / 陷阱 三类各自的当前等级效果文案 */
  _skillSummary(sk, skLv) {
    const tags = (sk.tags || []).join("/") || "无";
    if (sk.type === "summon" || sk.type === "trap") {
      const row = {};
      for (const k in (sk.lv || {})) { const arr = sk.lv[k]; row[k] = arr[Math.min(skLv, arr.length) - 1]; }
      const eff = sk.type === "summon"
        ? `${row.count} 架无人机 · 机体 HP${row.hp} · 攻击 ${row.atk} · 射速 ${row.fireCd}s`
        : `${row.count} 颗地雷 · 伤害 ${row.dmgMul}×攻击 · 半径 ${row.radius} · 入圈 ${sk.armDelay}s 引爆`;
      return `${sk.name}：${eff} · 冷却 ${sk.cd}s · 耗能 ${sk.energy} · 受词条影响：${tags}`;
    }
    const wl = CFG.weaponLevels[Math.min(skLv, CFG.weaponLevel.maxLv) - 1];
    const dmg = Math.round(sk.dmgMul * wl.skillMul * 100);
    return `${sk.name}：伤害 ${dmg}% 攻击 · 冷却 ${sk.cd}s · 耗能 ${sk.energy} · 爆炸半径 ${sk.radius} · 受词条影响：${tags}`;
  },

  /* ---------- HUD 每帧刷新 ---------- */
  updateHUD() {
    const r = G.run;
    if (!r || G.state !== "playing") return;
    document.getElementById("bar-hp").style.width = (r.hp / r.hpMax * 100) + "%";
    document.getElementById("txt-hp").textContent = `${Math.ceil(r.hp)}/${r.hpMax}`;
    document.getElementById("bar-en").style.width = (r.energy / r.energyMax * 100) + "%";
    document.getElementById("txt-en").textContent = `${Math.floor(r.energy)}/${r.energyMax}`;
    document.getElementById("lv-num").textContent = r.lv;
    document.getElementById("bar-exp").style.width = (r.exp / r.expNext * 100) + "%";
    document.getElementById("coin-num").textContent = r.coin;
    document.getElementById("exp-num").textContent = r.exp;
    // 进度条
    const lv = G.levelCfg;
    const pf = document.getElementById("progress-fill");
    const pt = document.getElementById("progress-txt");
    if (r.bossDefeated) { pf.style.width = "100%"; pt.textContent = "已获【撤离点代币】· 按 E 任意位置读条 8 秒撤离"; }
    else if (r.bossSpawned) { pf.style.width = "100%"; pt.textContent = "BOSS 战斗中"; }
    else {
      const pct = Math.min(1, r.kills / lv.progressGoal);
      pf.style.width = pct * 100 + "%";
      pt.textContent = `击杀进度 ${r.kills}/${lv.progressGoal}（${Math.floor(r.runTime)}s / ${lv.timeLimit}s）`;
    }
    document.getElementById("boss-name").classList.toggle("hidden", !(r.bossSpawned && !r.bossDefeated));
    // 负重
    const wf = weightFactor();
    const wl = document.getElementById("weight-line");
    wl.classList.toggle("over", wf.over);
    document.getElementById("weight-num").textContent = Math.round(wf.w);
    document.getElementById("weight-pen").textContent = wf.over ? `⚠ 超重！移速保留 ${(wf.f * 100).toFixed(0)}%` : "";
    // Buff 图标
    const ba = document.getElementById("buff-area");
    ba.innerHTML = "";
    for (const b of r.buffs) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.innerHTML = `${b.id}<small>${Math.ceil(b.remain)}s</small>`;
      ba.appendChild(el);
    }
    if (r.monsterDebuff) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#9a5cf5";
      el.innerHTML = `邪神<small>${r.monsterDebuff.remain < 0 ? "∞" : Math.ceil(r.monsterDebuff.remain) + "s"}</small>`;
      ba.appendChild(el);
    }
    // 撤离点代币 / 保险契约 / 裂缝击杀 HUD 提示
    if (r.extractToken) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#7de08a";
      el.title = "撤离点代币：按 E 任意位置读条 8 秒撤离（上限 1，死亡失去）";
      el.innerHTML = `▲撤离<small>${r.extractChanneling ? Math.ceil(CFG.extract.channel - (r.extractProgress || 0)) + "s" : "E"}</small>`;
      ba.appendChild(el);
    }
    const insN = insuranceCount(r);
    if (insN > 0) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#5aa2ff";
      el.title = "保险契约：死亡时每份保护 1 件高价值物品；撤离时剩余折算结晶";
      el.innerHTML = `保险<small>×${insN}</small>`;
      ba.appendChild(el);
    }
    if (G.inRift) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#5ad0ff";
      el.title = "空间裂缝：击杀 12 只出现奖励宝箱；返回信标读条 5 秒（受击归零）";
      el.innerHTML = `裂缝<small>${r.riftKills || 0}/${CFG.rift.rewardKills}</small>`;
      ba.appendChild(el);
    }
    // 属性卡牌资产提示（工匠世界可用）
    if (r.cardAssets > 0) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#ffd76a";
      el.title = "属性卡牌资产：工匠世界内使用";
      el.innerHTML = `卡<small>×${r.cardAssets}</small>`;
      ba.appendChild(el);
    }
    // 读条圈已改为进度环直接绑定在雕像/信标上（圈内积累、离开衰退）
    document.getElementById("channel-wrap").classList.add("hidden");
    // 中央提示（撤离点存在提示）
    const hint = document.getElementById("hint-center");
    if (r.bossDefeated && !r.artisanUsed && G.mainWorld.altars.some(a => a.id === "ALTAR_005")) {
      hint.textContent = "工匠雕像仍在地图上，可进入工匠世界开箱后再撤离";
    } else hint.textContent = "";
  },

  /* ---------- 背包 / 武器栏面板 ---------- */
  managementLocked() {
    // 9.1.1：局内战斗进行中无法管理背包（工匠世界例外）
    return G.state === "playing" && !G.inArtisan && G.mainWorld && G.mainWorld.monsters.length > 0;
  },
  toggleBackpack(force) {
    if (G.inArtisan) return;   // 工匠模式：网格已在合并面板中，B 键不重复弹窗
    const p = document.getElementById("panel-backpack");
    const show = force !== undefined ? force : p.classList.contains("hidden");
    if (show && (G.state === "playing" || G.state === "settled")) {
      p.classList.remove("hidden");
      this.renderBackpack();
    } else p.classList.add("hidden");
  },
  renderBackpack() {
    const r = G.run;
    document.getElementById("bp-lock-hint").classList.toggle("hidden", !this.managementLocked());
    this._renderGrid("grid-backpack", r.backpack);
    this._renderGrid("grid-weapon", r.weaponInv);
    // 武器标签（跟随当前英雄武器；召唤物/陷阱类标签仅对声明该标签的技能生效）
    const tags = document.getElementById("weapon-tags");
    const wpnTags = (G.heroDef && CFG.weapons[G.heroDef.weapon]) ? CFG.weapons[G.heroDef.weapon].tags : CFG.weapons.W001.tags;
    tags.innerHTML = "武器标签：" + wpnTags.map(t => {
      const tcfg = CFG.affixTags[t];
      const v = tagCalc(t);
      const disp = tcfg.round === "floor" ? v : (v * 100).toFixed(0) + "%";
      return `<b>${t} ${disp}</b>`;
    }).join(" · ");
    // 选中物品信息
    this.renderItemInfo();
  },
  _renderGrid(gridId, inv) {
    const g = document.getElementById(gridId);
    g.style.gridTemplateColumns = `repeat(${inv.cols}, 46px)`;
    g.style.gridTemplateRows = `repeat(${inv.rows}, 46px)`;
    g.innerHTML = "";
    for (let i = 0; i < inv.cols * inv.rows; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      c.dataset.x = i % inv.cols; c.dataset.y = Math.floor(i / inv.cols);
      g.appendChild(c);
    }
    for (const it of inv.items) {
      const el = document.createElement("div");
      el.className = `itm q${it.kind === "chest" ? this._chestQIdx(it.chestQ) : it.itemQ}`;
      el.style.left = it.x * 50 + 6 + "px"; el.style.top = it.y * 50 + 6 + "px";   // +6 = grid padding（.itm 相对 padding box 定位）
      el.style.width = it.shape[0] * 50 - 4 + "px"; el.style.height = it.shape[1] * 50 - 4 + "px";
      el.innerHTML = `<span class="nm">${it.name}</span>` +
        (it.kind === "chest" || it.kind === "insurance" ? `<span class="ct">×${it.count}</span>`
          : (it.kind === "module" && (it.lv || 1) > 1 ? `<span class="ct">LV${it.lv}</span>` : ""));
      el.dataset.uid = it.uid;
      g.appendChild(el);
    }
  },
  _chestQIdx(q) { return { normal: 0, advanced: 1, epic: 2 }[q]; },
  renderItemInfo() {
    const box = document.getElementById("item-info");
    const it = this.hoverItem;
    if (!it) { box.innerHTML = "选中或悬停物品查看详情"; return; }
    let lines = [`<b>${it.name}</b>`, `品质：${it.kind === "chest" ? CFG.chestQualities[it.chestQ].name : CFG.itemQualities[it.itemQ].name}`,
      `形状：${it.shape[0]}×${it.shape[1]} · 重量：${it.kind === "chest" ? CFG.chestQualities[it.chestQ].weight + "×" + it.count : it.weight}`];
    if (it.kind === "chest") lines.push("未开封货物：仅可在工匠世界开启");
    if (it.kind === "insurance") lines.push(`保险契约：死亡时每份保护 1 件价值最高的物品`,
      `撤离时剩余契约折算 ◆${it.count * CFG.insurance.crystalRefund} 结晶`, "契约本身不参与死亡损失");
    if (it.kind === "curse") {
      lines.push("☠ 诅咒道具：主地图战斗中使用（点击下方按钮）",
        "效果：向局内敌人动态附加属性修改器（待细化36）",
        ...CFG.curseItems.list.map(c => `· ${c.name}：${c.desc}（掉落 ×${c.rewardMul}）`),
        `持续 ${CFG.curseItems.duration} 秒 · 风险回报：敌人更强但掉落翻倍`);
    }
    if (it.kind === "gear") {
      lines.push("属性：" + Object.entries(it.stats).map(([k, v]) => `${statName(k)} +${v}`).join("，"));
      lines.push("放入武器栏才生效");
    }
    if (it.kind === "module") {
      const ml = CFG.moduleLevel, stage = moduleStage(it);
      lines.push(`等级：LV${it.lv || 1}/${ml.maxLv}（阶段 ${stage}/3）`);
      lines.push(`主词缀：${affixText(it)}（匹配武器标签才生效）`);
      for (let i = 0; i < ml.stageAffixes.length; i++) {
        const sa = ml.stageAffixes[i];
        const txt = sa.mode === "flat" ? `${sa.tag} +${sa.value}` : `${sa.tag} ${sa.value > 0 ? "+" : ""}${Math.round(sa.value * 100)}%`;
        lines.push(`${i < stage ? "✔" : "🔒"} ${sa.name}：${txt}${i < stage ? "" : `（LV${(i + 1) * ml.perStage - ml.perStage + 1} 起）`}`);
      }
      lines.push("放入武器栏才生效 · 相同模组拖拽合并升级");
      // 模组深度（16.7）：连接/套装一览（缓存自 recomputeWeapon）
      const syn = G.run && G.run.moduleSyn;
      if (syn) {
        if (syn.links > 0) lines.push(`🔗 连接效果：${syn.links} 对相邻同品质模组（技能伤害 +${Math.round(syn.links * (CFG.moduleLevel.linkBonus || 0) * 100)}%）`);
        else lines.push("🔗 连接效果：无（相邻摆放同品质模组可触发）");
        lines.push(syn.sets.length ? `套装：${syn.sets.join("、")}` : "套装：未触发（集齐同系列模组，见套装表）");
      }
    }
    box.innerHTML = lines.join("<br>");
    // 诅咒道具：使用按钮（仅主地图战斗中）
    if (it.kind === "curse") {
      const btn = document.createElement("button");
      btn.className = "btn small";
      btn.textContent = "☠ 使用诅咒道具";
      btn.onclick = () => { useCurseItem(it); this.renderBackpack(); this.renderItemInfo(); };
      box.appendChild(btn);
    }
  },

  /* ---------- 工匠合并界面（开箱 + 卡牌 + 背包/武器栏 同面板） ---------- */
  toggleArtisan(force) {
    const p = document.getElementById("panel-artisan");
    const unit = document.getElementById("bp-grid-unit");       // 背包/武器栏单元（含网格/信息/丢弃区）
    const home = document.getElementById("bp-panel-main");      // 背包面板（单元的家）
    const artGrids = document.getElementById("art-grids");      // 工匠面板停靠位
    const show = force !== undefined ? force : p.classList.contains("hidden");
    if (show && G.inArtisan) {
      artGrids.appendChild(unit);            // 整体移入工匠面板（DOM 移动保留渲染/拖拽逻辑）
      p.classList.remove("hidden");
      this.renderArtisan();                  // 内部会调用 renderBackpack 刷新网格
    } else {
      p.classList.add("hidden");
      home.appendChild(unit);                // 移回背包面板
    }
  },
  renderArtisan() {
    const r = G.run;
    // 背包中宝箱按品质分组（覆盖全部品质，新增品质自动出现在列表）
    const counts = {};
    for (const it of r.backpack.items) if (it.kind === "chest") counts[it.chestQ] = (counts[it.chestQ] || 0) + it.count;
    const list = document.getElementById("chest-list");
    list.innerHTML = "";
    for (const q of Object.keys(CFG.chestQualities)) {
      const c = CFG.chestQualities[q];
      const row = document.createElement("div");
      row.className = "chest-row" + (this.selectedChestQ === q ? " selected" : "");
      row.innerHTML = `<div class="sw" style="background:${c.color}"></div>
        <b>${c.name}</b><small>持有 ${counts[q] || 0} · 占格1×1 重${c.weight} · 价值 ${c.value}</small>`;
      row.onclick = () => { this.selectedChestQ = q; this.renderArtisan(); };
      list.appendChild(row);
    }
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = "开启 1 个";
    btn.disabled = !this.selectedChestQ || !(counts[this.selectedChestQ] > 0);
    btn.onclick = () => this.openChest();
    list.appendChild(btn);
    // 武器升级（金币 → 武器等级，技能等级同步；局外永久资产）
    const wlv = Meta.weaponLv(G.heroDef.id);
    const wup = document.createElement("div");
    wup.className = "chest-row";
    wup.style.marginTop = "8px";
    if (wlv >= CFG.weaponLevel.maxLv) {
      wup.innerHTML = `<div class="sw" style="background:#ffd76a"></div><b>⚔ 武器 LV${wlv}（满级）</b><small>技能效果已最大化</small>`;
    } else {
      const cost = Meta.weaponUpCost(G.heroDef.id);
      wup.innerHTML = `<div class="sw" style="background:#ffd76a"></div>
        <b>⚔ 武器 LV${wlv} → LV${wlv + 1}</b><small>普攻 ×${CFG.weaponLevels[wlv].basicMul.toFixed(2)} · 技能 ×${CFG.weaponLevels[wlv].skillMul.toFixed(2)} · 花费 ¥${cost}</small>`;
      wup.onclick = () => this.upgradeWeapon();
      wup.style.cursor = r.coin >= cost ? "pointer" : "not-allowed";
      wup.style.opacity = r.coin >= cost ? "1" : "0.55";
    }
    list.appendChild(wup);
    // 金币服务（待细化 28：强化物品/购买；作用于"悬停选中"的物品）
    const svc = document.createElement("div");
    svc.style.marginTop = "10px";
    const hoverIt = this.hoverItem;
    const qName = (q) => CFG.itemQualities[q].name;
    let rows = [
      { key: "ins", html: `<div class="sw" style="background:#6cb2ff"></div><b>⛨ 购买保险契约 ×1</b><small>¥${CFG.artisanServices.buyInsurance.cost} · 死亡保护 1 件最高价值物品</small>` },
      { key: "chest:advanced", html: `<div class="sw" style="background:${CFG.chestQualities.advanced.color}"></div><b>▣ 购买高级宝箱</b><small>¥${CFG.artisanServices.buyChest.advanced}</small>` },
      { key: "chest:epic", html: `<div class="sw" style="background:${CFG.chestQualities.epic.color}"></div><b>▣ 购买史诗宝箱</b><small>¥${CFG.artisanServices.buyChest.epic}</small>` },
      { key: "chest:divine", html: `<div class="sw" style="background:${CFG.chestQualities.divine.color}"></div><b>▣ 购买神圣宝箱</b><small>¥${CFG.artisanServices.buyChest.divine}</small>` },
    ];
    // 强化品质 / 洗词缀：需要先悬停选中一件装备或模组
    const it = hoverIt && (hoverIt.kind === "gear" || hoverIt.kind === "module") ? hoverIt : null;
    if (it && it.kind === "gear" || it && it.kind === "module") {
      const qupOk = it.itemQ < 3;
      const qupCost = qupOk ? CFG.artisanServices.qualityUp.costs[it.itemQ] : 0;
      rows.push({ key: "qup", html: `<div class="sw" style="background:${CFG.itemQualities[Math.min(it.itemQ + (qupOk ? 1 : 0), 3)].color}"></div>
        <b>✦ 强化品质：${it.name} ${qName(it.itemQ)} → ${qupOk ? qName(it.itemQ + 1) : "已满档"}</b>
        <small>${qupOk ? `¥${qupCost}` : "无法再强化"}</small>`, disabled: !qupOk });
      if (it.kind === "module") {
        rows.push({ key: "reroll", html: `<div class="sw" style="background:#c79bff"></div>
          <b>🜲 洗词缀：${it.name}（当前 ${affixText(it)}）</b><small>¥${CFG.artisanServices.rerollModule.cost} · 重掷主词缀档位</small>` });
      }
    } else {
      rows.push({ key: null, html: `<div class="sw" style="background:#5a6572"></div><b>✦ 强化品质 / 🜲 洗词缀</b><small>先把鼠标悬停到背包中的装备/模组上选中</small>` });
    }
    for (const row of rows) {
      const el = document.createElement("div");
      el.className = "chest-row";
      el.innerHTML = row.html;
      if (row.key) {
        el.style.cursor = "pointer";
        el.onclick = () => this.artisanService(row.key);
      }
      svc.appendChild(el);
    }
    list.appendChild(svc);
    // 待分配区
    const pa = document.getElementById("pending-area");
    pa.innerHTML = "";
    for (const it of r.pendingItems) {
      const el = document.createElement("div");
      el.className = `pending-item q${it.itemQ}`;
      el.style.width = it.shape[0] * 32 + 30 + "px"; el.style.height = it.shape[1] * 32 + 30 + "px";
      el.innerHTML = `${it.name}<span class="giveup" title="放弃">✕</span>`;
      el.querySelector(".giveup").onclick = (e) => {
        e.stopPropagation();
        r.pendingItems.splice(r.pendingItems.indexOf(it), 1);
        this.toast("已放弃，物品作废", "bad");
        this.renderArtisan();
      };
      el.onpointerdown = (e) => this.startDrag(e, { item: it, fromPending: true });
      pa.appendChild(el);
    }
    this.renderBackpack();   // 同步网格显示
    this.renderCards();
  },
  /* ---------- 属性卡牌（8.3：仅工匠世界可用） ---------- */
  _cardEffectText(c) {
    const def = CFG.cardPool.attrs[c.attr];
    if (def.mul) return `冷却 ×${c.value}`;
    if (c.attr === "lifesteal") return `吸血 +${Math.round(c.value * 100)}%`;
    return `${def.name} +${c.value}`;
  },
  renderCards() {
    const r = G.run;
    document.getElementById("card-assets").textContent = `×${r.cardAssets}`;
    const btn = document.getElementById("btn-card-refresh");
    btn.textContent = r.cardRefresh > 0
      ? `刷新候选（剩 ${r.cardRefresh}）`
      : `刷新候选（◆${CFG.cardPool.refreshCrystalCost}/次）`;
    btn.disabled = false;
    const box = document.getElementById("card-candidates");
    box.innerHTML = "";
    if (!r.cardCandidates) r.cardCandidates = drawCardCandidates();
    r.cardCandidates.forEach((c, i) => {
      const q = CFG.itemQualities[c.q];
      const tile = document.createElement("div");
      tile.className = "card-tile" + (r.cardAssets <= 0 ? " disabled" : "");
      tile.style.borderColor = q.color;
      tile.innerHTML = `<b style="color:${q.color}">${CFG.cardPool.attrs[c.attr].name}</b>
        <span class="cq">${q.name}卡</span><span class="cv">${this._cardEffectText(c)}</span>`;
      tile.onclick = () => {
        if (r.cardAssets <= 0) { this.toast("没有可用的属性卡牌（升级获得）", "bad"); return; }
        if (useCard(i)) { this.toast(`属性卡牌生效：${this._cardEffectText(r.appliedCards[r.appliedCards.length - 1])}`, "gold"); }
        this.renderCards();
      };
      box.appendChild(tile);
    });
    // 已使用卡牌一览
    const ap = document.getElementById("card-applied");
    ap.innerHTML = r.appliedCards.length
      ? r.appliedCards.map(c => `<span class="chip"><em>${CFG.cardPool.attrs[c.attr].name}</em> ${this._cardEffectText(c)}</span>`).join("")
      : `<span class="chip" style="opacity:.5">本局尚未使用卡牌</span>`;
  },
  openChest() {
    const r = G.run;
    if (!this.selectedChestQ) return;
    // 兜底校验：该品质宝箱已用尽则不开启
    if (!r.backpack.items.some(it => it.kind === "chest" && it.chestQ === this.selectedChestQ)) return;
    if (r.stats) r.stats.chestsOpened++;
    // 从背包扣除 1 个
    for (const it of r.backpack.items) {
      if (it.kind === "chest" && it.chestQ === this.selectedChestQ) {
        it.count--; it.value = CFG.chestQualities[it.chestQ].value * it.count;
        if (it.count <= 0) r.backpack.remove(it);
        break;
      }
    }
    // 开箱：保险契约概率掉出（方案 A）→ 诅咒道具概率掉出（待细化36）→ 内容池抽取
    let item;
    if (Math.random() < CFG.insurance.chance) {
      item = makeInsurance();
      // 直接叠加入包（满则进待分配区）
      const exist = r.backpack.items.find(it => it.kind === "insurance" && it.count < CFG.insurance.maxStack);
      if (exist) { exist.count++; exist.value = CFG.insurance.value * exist.count; }
      else if (!r.backpack.tryStackChest(item)) {
        const s = r.backpack.findSpot(item);
        if (s) r.backpack.place(item, s.x, s.y);
        else r.pendingItems.push(item);
      }
      SFX.play("chest");
      this.toast(`开出【${CFG.insurance.name}】×1（死亡时保护 1 件高价值物品）`, "gold");
      this.renderArtisan();
      return;
    }
    if (Math.random() < CFG.curseItems.chance) {
      item = makeCurse();
      const s = r.backpack.findSpot(item);
      if (s) r.backpack.place(item, s.x, s.y);
      else r.pendingItems.push(item);
      SFX.play("chest");
      this.toast(`开出【${item.name}】☠ 主地图战斗中使用：强化敌人换取掉落翻倍`, "gold");
      this.renderArtisan();
      return;
    }
    const pool = CFG.chestContents[this.selectedChestQ];
    const defId = U.pick(pool.defs);
    const itemQ = Number(U.weightedPick({ 0: pool.itemQW[0], 1: pool.itemQW[1], 2: pool.itemQW[2], 3: pool.itemQW[3] }));
    const isModule = defId.startsWith("M");
    item = isModule ? makeModule(defId, itemQ) : makeGear(defId, itemQ);
    r.pendingItems.push(item);
    SFX.play("chest");
    this.toast(`开出【${item.name}】${CFG.itemQualities[itemQ].name}`, "gold");
    this.renderArtisan();
  },

  /* ---------- 武器升级（工匠世界花金币；武器等级=技能等级，局外永久资产） ---------- */
  upgradeWeapon() {
    const r = G.run;
    const id = G.heroDef.id;
    const lv = Meta.weaponLv(id);
    if (lv >= CFG.weaponLevel.maxLv) return;
    const cost = Meta.weaponUpCost(id);
    if (r.coin < cost) { this.toast(`金币不足（需 ${cost}）`, "bad"); return; }
    r.coin -= cost;
    Meta.weaponUp(id);
    G.heroDef.weaponLv = Meta.weaponLv(id);   // 出战副本同步（技能等级 = 武器等级）
    G.heroDef.outSkillLv = G.heroDef.weaponLv;
    recomputeWeapon();
    SFX.play("levelup");
    this.toast(`⚔ ${G.heroDef.name} 武器提升至 LV${Meta.weaponLv(id)}（技能同步强化）！`, "gold");
    this.renderArtisan();
  },

  /* ---------- 工匠金币服务（待细化 28：强化物品/购买，价格全在 CFG.artisanServices） ---------- */
  artisanService(key) {
    const r = G.run, S = CFG.artisanServices;
    const pay = (cost) => {
      if (r.coin < cost) { this.toast(`金币不足（需 ¥${cost}）`, "bad"); return false; }
      r.coin -= cost;
      return true;
    };
    if (key === "ins") {
      if (!pay(S.buyInsurance.cost)) return;
      const item = makeInsurance();
      const exist = r.backpack.items.find(x => x.kind === "insurance" && x.count < CFG.insurance.maxStack);
      if (exist) { exist.count++; exist.value = CFG.insurance.value * exist.count; }
      else if (!r.backpack.tryStackChest(item)) {
        const s = r.backpack.findSpot(item);
        if (s) r.backpack.place(item, s.x, s.y);
        else r.pendingItems.push(item);
      }
      SFX.play("chest");
      this.toast(`购买【${CFG.insurance.name}】×1`, "gold");
    } else if (key.startsWith("chest:")) {
      const q = key.split(":")[1];
      if (!pay(S.buyChest[q])) return;
      const item = makeChestItem(q);
      if (!r.backpack.tryStackChest(item)) {
        const s = r.backpack.findSpot(item);
        if (s) r.backpack.place(item, s.x, s.y);
        else r.pendingItems.push(item);
      }
      SFX.play("chest");
      this.toast(`购买 ${item.name} ×1`, "gold");
    } else if (key === "qup") {
      const it = this.hoverItem;
      if (!it || (it.kind !== "gear" && it.kind !== "module")) { this.toast("请先悬停选中一件装备/模组", "bad"); return; }
      if (it.itemQ >= 3) { this.toast("已达金色品质", "bad"); return; }
      const cost = S.qualityUp.costs[it.itemQ];
      if (!pay(cost)) return;
      it.itemQ++;
      const q = CFG.itemQualities[it.itemQ];
      if (it.kind === "gear") {
        it.value = Math.round(30 * q.valueMul);
        const def = CFG.gearDefs.find(g => g.id === it.defId);
        const mul = 1 + (q.valueMul - 1) * 0.6;   // 与 makeGear 同步：装备数值随品质成长
        for (const k in def.stats) it.stats[k] = Math.round(def.stats[k] * mul);
      } else {
        it.value = Math.round(45 * q.valueMul);
        it.affix.value = CFG.moduleDefs.find(m => m.id === it.defId).affix.vals[it.itemQ];
      }
      recomputeWeapon();
      SFX.play("levelup");
      this.toast(`✦ ${it.name} 强化至 ${CFG.itemQualities[it.itemQ].name}品质`, "gold");
    } else if (key === "reroll") {
      const it = this.hoverItem;
      if (!it || it.kind !== "module") { this.toast("请先悬停选中一件模组", "bad"); return; }
      if (!pay(S.rerollModule.cost)) return;
      const old = affixText(it);
      it.itemQ = U.randInt(0, 3);   // 重掷主词缀档位（保留等级/类型/形状）
      it.affix.value = CFG.moduleDefs.find(m => m.id === it.defId).affix.vals[it.itemQ];
      recomputeWeapon();
      SFX.play("altar");
      this.toast(`🜲 ${it.name} 洗词缀：${old} → ${affixText(it)}`, "gold");
    }
    this.renderArtisan();
  },

  /* ---------- 拖拽（背包 <-> 武器栏 / 丢弃 / 待分配区） ---------- */
  startDrag(e, info) {
    if (this.managementLocked() && !info.fromPending) { this.toast("战斗进行中无法管理物品", "bad"); return; }
    if (this.managementLocked() && info.fromPending) { this.toast("战斗进行中无法操作", "bad"); return; }
    e.preventDefault();
    this.drag = info;
    const ghost = document.getElementById("drag-ghost");
    const it = info.item;
    ghost.classList.remove("hidden");
    ghost.style.width = it.shape[0] * 46 + "px"; ghost.style.height = it.shape[1] * 46 + "px";
    ghost.className = `q${it.kind === "chest" ? this._chestQIdx(it.chestQ) : it.itemQ}`;
    ghost.style.position = "fixed";
    ghost.style.left = e.clientX - it.shape[0] * 23 + "px";
    ghost.style.top = e.clientY - it.shape[1] * 23 + "px";
    ghost.textContent = it.name;
  },
  onPointerMove(e) {
    if (!this.drag) return;
    const ghost = document.getElementById("drag-ghost");
    const it = this.drag.item;
    ghost.style.left = e.clientX - it.shape[0] * 23 + "px";
    ghost.style.top = e.clientY - it.shape[1] * 23 + "px";
    // 高亮目标格
    document.querySelectorAll(".cell.hl-ok,.cell.hl-bad").forEach(c => c.classList.remove("hl-ok", "hl-bad"));
    document.getElementById("drop-zone").classList.remove("over");
    const t = this._dropTarget(e);
    if (t && t.type === "grid") {
      const ok = t.inv.canPlace(it, t.x, t.y, it);
      for (let j = t.y; j < t.y + it.shape[1]; j++) for (let i = t.x; i < t.x + it.shape[0]; i++) {
        const cell = t.inv === G.run.backpack
          ? document.querySelector(`#grid-backpack .cell[data-x="${i}"][data-y="${j}"]`)
          : document.querySelector(`#grid-weapon .cell[data-x="${i}"][data-y="${j}"]`);
        if (cell) cell.classList.add(ok ? "hl-ok" : "hl-bad");
      }
    } else if (t && t.type === "drop") {
      document.getElementById("drop-zone").classList.add("over");
    }
  },
  onPointerUp(e) {
    if (!this.drag) return;
    const it = this.drag.item;
    const r = G.run;
    document.querySelectorAll(".cell.hl-ok,.cell.hl-bad").forEach(c => c.classList.remove("hl-ok", "hl-bad"));
    document.getElementById("drop-zone").classList.remove("over");
    document.getElementById("drag-ghost").classList.add("hidden");
    const t = this._dropTarget(e);
    if (t && t.type === "grid") {
      if (this.drag.fromPending) {
        // 待分配区 → 网格
        r.pendingItems.splice(r.pendingItems.indexOf(it), 1);
        const occ = t.inv.occupied(t.x, t.y, it.shape[0], it.shape[1]);
        if (occ && it.kind === "module" && occ.kind === "module" && occ.defId === it.defId) {
          // 相同模组叠加 → 升级（背包/武器栏均可合并）
          const ml = CFG.moduleLevel;
          if ((occ.lv || 1) >= ml.maxLv) { r.pendingItems.push(it); this.toast("模组已达最高等级", "bad"); }
          else { occ.lv = Math.min(ml.maxLv, Math.max(occ.lv || 1, it.lv || 1) + 1); this.toast(`${occ.name} 合并升级 → LV${occ.lv}`, "gold"); }
        }
        else if (t.inv.canPlace(it, t.x, t.y)) t.inv.place(it, t.x, t.y);
        else {
          const s = t.inv.findSpot(it);
          if (s) t.inv.place(it, s.x, s.y);
          else { r.pendingItems.push(it); this.toast("空间不足", "bad"); }
        }
      } else {
        const srcInv = it.inv === "backpack" ? r.backpack : r.weaponInv;
        const sameSpot = t.inv === srcInv && t.x === it.x && t.y === it.y;
        if (!sameSpot) {
          // ignore=it：目标区域允许与拖拽物品自身 footprint 重叠（同格内挪动）
          const occupant = t.inv.occupied(t.x, t.y, it.shape[0], it.shape[1], it);
          const ox = it.x, oy = it.y;   // 先记录原位（place 会覆写 x/y）
          if (occupant && it.kind === "module" && occupant.kind === "module" && occupant.defId === it.defId) {
            // 模组合并升级：相同模组叠加 → 等级 +1（上限 maxLv），被合并方消失
            const ml = CFG.moduleLevel;
            if ((occupant.lv || 1) >= ml.maxLv) this.toast("模组已达最高等级", "bad");
            else {
              occupant.lv = Math.min(ml.maxLv, Math.max(occupant.lv || 1, it.lv || 1) + 1);
              srcInv.remove(it);
              this.toast(`${occupant.name} 合并升级 → LV${occupant.lv}`, "gold");
            }
          } else if (occupant) {
            // 交换（9.1.1 替换规则）：被换下的物品回到拖拽物品腾出的原位
            srcInv.remove(it);
            t.inv.remove(occupant);
            if (t.inv.canPlace(it, t.x, t.y)) {
              t.inv.place(it, t.x, t.y);
              const s = srcInv.canPlace(occupant, ox, oy) ? { x: ox, y: oy } : srcInv.findSpot(occupant);
              if (s) srcInv.place(occupant, s.x, s.y);
              else {
                const s2 = t.inv.findSpot(occupant);
                if (s2) t.inv.place(occupant, s2.x, s2.y);
                else { r.pendingItems.push(occupant); this.toast("原位置物品移入待分配区（工匠世界）", ""); }
              }
            } else {
              t.inv.place(occupant, occupant.x, occupant.y);   // 还原
              const s = srcInv.findSpot(it);
              if (s) srcInv.place(it, s.x, s.y);
              else { r.pendingItems.push(it); this.toast("空间不足", "bad"); }
            }
          } else {
            srcInv.remove(it);
            if (t.inv.canPlace(it, t.x, t.y)) {
              t.inv.place(it, t.x, t.y);
            } else {
              const s = t.inv.findSpot(it);
              if (s) t.inv.place(it, s.x, s.y);
              else {
                const s2 = srcInv.findSpot(it);
                if (s2) srcInv.place(it, s2.x, s2.y);
                else r.pendingItems.push(it);
                this.toast("空间不足", "bad");
              }
            }
          }
        }
      }
    } else if (t && t.type === "drop" && !this.drag.fromPending) {
      // 丢弃：移出背包（9.1.1；原型直接销毁，不生成地上掉落物）
      const srcInv = it.inv === "backpack" ? r.backpack : r.weaponInv;
      srcInv.remove(it);
      this.toast(`已丢弃 ${it.name}`, "bad");
    }
    this.drag = null;
    recomputeWeapon();
    this.renderBackpack();
    if (G.inArtisan) this.renderArtisan();   // 仅工匠世界刷新开箱台/卡牌区
  },
  _dropTarget(e) {
    const pts = [document.elementFromPoint(e.clientX, e.clientY)];
    const el = pts[0];
    if (!el) return null;
    const gridEl = el.closest("#grid-backpack,#grid-weapon");
    if (gridEl) {
      const inv = gridEl.id === "grid-backpack" ? G.run.backpack : G.run.weaponInv;
      const rect = gridEl.getBoundingClientRect();
      const pad = 8, cell = 50;   // 边框2 + 内边距6；格宽46 + 间隙4 = 50
      const x = U.clamp(Math.floor((e.clientX - rect.left - pad) / cell), 0, inv.cols - 1);
      const y = U.clamp(Math.floor((e.clientY - rect.top - pad) / cell), 0, inv.rows - 1);
      return { type: "grid", inv, x, y };
    }
    if (el.closest("#drop-zone")) return { type: "drop" };
    return null;
  },

  /* ---------- 结算 ---------- */
  showSettlement(crystals = 0) {
    const r = G.run;
    const cv = r.settleConv || { coin: 0, chest: 0, item: 0, card: 0, total: 0 };
    document.getElementById("settle-stats").innerHTML =
      `<span>击杀 <b>${r.kills}</b></span><span>达到等级 <b>LV ${r.lv}</b></span><span>货币 <b>${r.coin}</b></span><span>◆ 结晶 <b>+${crystals}</b></span>` +
      `<span style="flex-basis:100%;opacity:.85">资源折算（待细化5）：金币→◆${cv.coin} · 宝箱→◆${cv.chest} · 装备/模组→◆${cv.item} · 卡牌→◆${cv.card}（合计 ◆${cv.total}）</span>`;
    document.getElementById("settle-chests").innerHTML =
      `<div class="chip">${this._statsLine(r)}</div><div class="chip">局内资产已按比例折算为结晶带出（双层等级体系闭环）；保险契约按 ◆${CFG.insurance.crystalRefund}/份 折算</div>`;
    const items = [...r.weaponInv.items, ...r.backpack.items];
    document.getElementById("settle-items").innerHTML = items.length
      ? items.map(it => `<span class="chip">${it.name}${it.kind === "chest" ? " ×" + it.count : ""}（${it.kind === "chest" ? "宝箱" : CFG.itemQualities[it.itemQ].name}）</span>`).join("")
      : `<span class="chip">（无装备/模块保留）</span>`;
    document.getElementById("screen-settle").classList.remove("hidden");
  },
  _statsLine(r) {
    const s = r.stats || {};
    const mm = Math.floor((r.runTime || 0) / 60), ss = Math.round((r.runTime || 0) % 60);
    const kpm = r.runTime > 0 ? (r.kills / (r.runTime / 60)).toFixed(1) : "0";
    return `用时 ${mm}:${ss < 10 ? "0" + ss : ss} · 击杀/分 ${kpm} · 输出 ${Math.round(s.dmgDealt || 0)} · 承伤 ${Math.round(s.dmgTaken || 0)} · Boss 耗时 ${(s.bossFightTime || 0).toFixed(0)}s · 开箱 ${s.chestsOpened || 0} · 雕像 ${s.altarsUsed || 0}`;
  },
  showDeath(penalty, crystals = 0) {
    const r = G.run;
    document.getElementById("death-stats").innerHTML =
      `<span>击杀 <b>${r.kills}</b></span><span>等级 <b>LV ${r.lv}</b></span><span>损失价值 <b>${Math.round(penalty.lostValue)}</b> / ${Math.round(penalty.totalValue + penalty.lostValue)}</span><span>◆ 结晶 <b>+${crystals}</b>（死亡保留30%）</span><span>保险契约 <b>${penalty.contractsUsed || 0}</b> 份已生效（保护 ${(penalty.kept || []).filter(i => i.byInsurance).length} 件）</span><span style="flex-basis:100%">${this._statsLine(r)}</span>`;
    document.getElementById("death-lost").innerHTML = penalty.lost.length
      ? penalty.lost.map(it => `<span class="chip">${it.name}${it.kind === "chest" ? " ×" + it.count : ""}</span>`).join("")
      : `<span class="chip">（无损失）</span>`;
    document.getElementById("death-kept").innerHTML = penalty.kept.length
      ? penalty.kept.map(it => `<span class="chip">${it.name}${it.byInsurance ? " ⛨保险" : ""}</span>`).join("")
      : `<span class="chip">（无保留）</span>`;
    document.getElementById("screen-death").classList.remove("hidden");
  },
};

function statName(k) {
  return { hp: "生命", atk: "攻击", def: "防御", spd: "移速", regen: "能量恢复", energyMax: "能量上限" }[k] || k;
}
