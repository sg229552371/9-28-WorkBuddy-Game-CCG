from playwright.sync_api import sync_playwright
BASE = "http://127.0.0.1:8123/index.html"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto(BASE, wait_until="load"); pg.wait_for_timeout(1800)
    pg.evaluate("() => document.getElementById('btn-main-start').click()")
    pg.wait_for_timeout(900)
    pg.evaluate("() => enterEndless()")
    pg.wait_for_timeout(500)
    # 打 2 波：清场推进
    for _ in range(2):
        pg.evaluate("() => { const w=G.activeWorld; for (const m of w.monsters) { m.hp=0; m.dead=true; } }")
        pg.wait_for_timeout(3500)
    diag = pg.evaluate("""() => ({
      endlessState: (typeof Endless!=='undefined' && Endless.state) ? JSON.parse(JSON.stringify(Endless.state)) : null,
      waveReward2: (typeof Endless!=='undefined') ? Endless.waveReward(2) : null,
      waveReward4: (typeof Endless!=='undefined') ? Endless.waveReward(4) : null,
      deathRatio: CFG.outLevel && CFG.outLevel.deathRatio,
      crystalsBefore: Meta.data.crystals,
    })""")
    print("结算前:", diag)
    pg.evaluate("() => { G.player.hp=0; if (typeof playerDied==='function') playerDied(); }")
    pg.wait_for_timeout(1200)
    after = pg.evaluate("""() => ({
      panelHtml: (document.getElementById('endless-settle-stats')||{}).innerHTML,
      report: G.lastSettleReport,
      crystalsAfter: Meta.data.crystals,
      endlessStateAfter: (typeof Endless!=='undefined' && Endless.state) ? { crystals: Endless.state.crystals, running: Endless.state.running, wave: Endless.state.wave } : null,
      settleWrapped: !!(typeof Endless!=='undefined' && Endless.__rewardSettleWrapped),
      showWrapped: (typeof showEndlessSettle==='function') ? !!showEndlessSettle.__rewardSettleWrapped : null,
    })""")
    print("结算后:", after)
    ctx.close(); b.close()
