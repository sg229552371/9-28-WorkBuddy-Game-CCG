# 21.15 无尽模式端到端验收：主城深渊之门 → 进入 → 波次推进 → 死亡结算 → 回主城
import json, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True,
                        user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"))
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:250]))
    pg.goto(BASE, wait_until="load")
    pg.wait_for_timeout(1800)

    # 1) 主菜单 → 开始 → 主城
    pg.evaluate("() => document.getElementById('btn-main-start').click()")
    pg.wait_for_timeout(1200)
    print("① 进主城:", pg.evaluate("() => ({state:G.state, kind: G.activeWorld && G.activeWorld.kind})"))

    # 2) 检查深渊之门已就绪
    portal = pg.evaluate("""() => {
      const w = G.activeWorld;
      return { hasPortal: !!w.abyssPortal, portal: w.abyssPortal,
               endlessReady: (typeof Endless !== 'undefined') };
    }""")
    print("② 深渊之门:", json.dumps(portal, ensure_ascii=False)[:260])

    # 3) 直接把玩家挪进光圈（模拟走过去），触发读条
    #    注：主城可能无 G.player（用 avatar 表示），此时跳过挪位，直接走进入函数
    moved = pg.evaluate("""() => {
      const w = G.activeWorld, p = w.abyssPortal;
      if (G.player && typeof G.player.x === 'number') {
        G.player.x = p.x; G.player.y = p.y; return 'moved-player';
      }
      if (w.avatar && typeof w.avatar.x === 'number') {
        w.avatar.x = p.x; w.avatar.y = p.y; return 'moved-avatar';
      }
      return 'no-movable-actor';
    }""")
    pg.wait_for_timeout(400)
    near = pg.evaluate("() => ({ actor: 'checked', near: !!G.abyssPortalNear, state: G.state })")
    print("③ 进圈:", moved, json.dumps(near, ensure_ascii=False))

    # 4) 点击传送门本体进入（走 abyssPortalTap）
    pg.evaluate("""() => {
      const w = G.activeWorld, p = w.abyssPortal;
      // 世界坐标 → 屏幕坐标的反变换较繁，直接用测试入口调用进入逻辑
      if (typeof enterEndless === 'function') { enterEndless(); }
    }""")
    pg.wait_for_timeout(2500)
    entered = pg.evaluate("""() => ({
      state: G.state, inEndless: !!G.inEndless,
      worldKind: G.activeWorld && G.activeWorld.kind,
      wave: G.activeWorld && G.activeWorld.endlessWave,
      monsters: G.activeWorld ? G.activeWorld.monsters.length : -1,
      playerHp: G.player ? G.player.hp : null,
    })""")
    print("④ 进入深渊:", json.dumps(entered, ensure_ascii=False))

    if entered.get("inEndless"):
        pg.screenshot(path="/workspace/endless_battle_w1.png")
        # 5) 等波次推进：清场推进到下一波
        for i in range(3):
            pg.evaluate("""() => {
              const w = G.activeWorld;
              if (w && w.monsters) { for (const m of w.monsters) { m.hp = 0; m.dead = true; } }
            }""")
            pg.wait_for_timeout(3600)   # 超过波次间隔 3s
            st = pg.evaluate("() => ({ wave: G.activeWorld.endlessWave, monsters: G.activeWorld.monsters.length, kills: (typeof Endless!=='undefined')? Endless.kills : null })")
            print(f"   清场{i+1} → ", json.dumps(st, ensure_ascii=False))
        # 6) 抓帧率（无尽真实战斗）
        FR = pg.evaluate("""() => new Promise(res => {
          const n=90, durs=[]; let i=0; const orig=window.requestAnimationFrame;
          const tick=()=>{ const t0=performance.now(); try{render();}catch(e){} durs.push(performance.now()-t0); i++;
            if(i<n) orig(tick); else res(durs); }; orig(tick);
        })""")
        FR.sort()
        print(f"⑥ 渲染帧耗时: p50={FR[len(FR)//2]:.2f} p95={FR[int(len(FR)*0.95)]:.2f}ms  同屏={st.get('monsters')}")

        # 7) 杀死玩家 → 结算
        pg.evaluate("() => { if (G.player) { G.player.hp = 0; if (typeof playerDied==='function') playerDied(); } }")
        pg.wait_for_timeout(1500)
        settle = pg.evaluate("""() => ({
          state: G.state,
          settleVisible: (() => { const e=document.getElementById('screen-endless-settle'); return e ? !e.classList.contains('hidden') : null; })(),
          report: G.lastSettleReport || null,
        })""")
        print("⑦ 死亡结算:", json.dumps(settle, ensure_ascii=False)[:300])
        pg.screenshot(path="/workspace/endless_settle.png")

    print("=== 页面错误 ===")
    print(errs[:5] if errs else "无")
    ctx.close()
    b.close()
