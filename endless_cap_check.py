# 21.15 无尽极限档：同屏 300 敌（cap 封顶）真实战斗帧率
from playwright.sync_api import sync_playwright
BASE = "http://127.0.0.1:8123/index.html"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(1800)
    pg.evaluate("() => document.getElementById('btn-main-start').click()")
    pg.wait_for_timeout(1000)
    pg.evaluate("() => enterEndless()")
    pg.wait_for_timeout(600)
    # 推到波 25（cap=300 封顶），直接铺满 300 只（用 Endless 怪物等级）
    r = pg.evaluate("""() => {
      const w = G.activeWorld;
      const wave = 25, lv = (typeof Endless!=='undefined') ? Endless.monsterLv(wave) : 5;
      const ids = Object.keys(CFG.monsters).filter(id => CFG.monsters[id].type !== 'boss' && !(typeof isEliteDef==='function' && isEliteDef(id)));
      const side = Math.ceil(Math.sqrt(300));
      const step = Math.min(w.w, w.h) / (side + 1);
      let made = 0;
      for (let i = 0; i < side && made < 300; i++)
        for (let j = 0; j < side && made < 300; j++) {
          const m = new Monster(ids[made % ids.length], (i+1)*step, (j+1)*step, lv);
          m.hp = m.hpMax = Math.round(m.hpMax * (1 + (wave-1)*0.18));
          w.monsters.push(m); made++;
        }
      w.endlessWave = wave;
      return { monsters: w.monsters.length, lv };
    }""")
    print("铺场:", r)
    pg.wait_for_timeout(800)
    # 采样：render + update 真实主循环帧耗时（走游戏自身 loop，不是钩子）
    FR = pg.evaluate("""() => new Promise(res => {
      const n=120, durs=[]; let i=0;
      const orig=window.requestAnimationFrame;
      const tick=()=>{ const t0=performance.now();
        try { G.activeWorld.update(1/60); render(); } catch(e){ if(!window.__uerr) window.__uerr=String(e); }
        durs.push(performance.now()-t0); i++;
        if(i<n) orig(tick); else res(durs); };
      orig(tick);
    })""")
    FR.sort()
    p50, p95 = FR[len(FR)//2], FR[int(len(FR)*0.95)]
    print(f"300敌 update+render: p50={p50:.2f} p95={p95:.2f}ms  {'PASS(<16.7)' if p95<16.7 else 'FAIL'}")
    st = pg.evaluate("() => ({ monsters: G.activeWorld.monsters.length, wave: G.activeWorld.endlessWave })")
    print("状态:", st, " 异常:", errs[:3] if errs else "无", " 采样异常:", pg.evaluate('() => window.__uerr || null'))
    ctx.close(); b.close()
