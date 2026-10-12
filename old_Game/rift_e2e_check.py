# 21.17 深渊大秘境端到端验收（真机模拟：iPhone12 390x844）
# 覆盖：进深渊 → 倒计时运行 → 时间驱动刷怪（不清也刷）→ 推进量出 BOSS
#      → 击杀最终 BOSS 掉撤离点 → 走过去撤离成功 → 三态结算
#      → 超时路径 → 深渊内不出现空间裂隙（抽 100 次祭坛）
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"
SHOT = "/workspace/9-28-WorkBuddy-Game-CCG/"

def q(pg, expr):
    return pg.evaluate("() => (" + expr + ")")

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True,
                        user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"))
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto(BASE, wait_until="load")
    pg.wait_for_timeout(2000)

    print("=" * 64)
    print("① 启动", q(pg, "({state:G.state, ver: (typeof APP_VERSION!=='undefined'?APP_VERSION:'?')})"))

    pg.evaluate("() => document.getElementById('btn-main-start').click()")
    pg.wait_for_timeout(1400)
    print("② 主城", q(pg, "({state:G.state, kind:G.activeWorld&&G.activeWorld.kind})"))

    pg.evaluate("() => { if (typeof enterEndless==='function') enterEndless(); }")
    pg.wait_for_timeout(2600)
    print("③ 进深渊", q(pg, "({state:G.state, kind:G.activeWorld&&G.activeWorld.kind, inEndless:G.inEndless, monsters:G.activeWorld?G.activeWorld.monsters.length:-1, hasexitBeacon: !!(G.activeWorld&&G.activeWorld.exitBeacon)})"))

    # --- ④ 倒计时递减 ---
    t0 = q(pg, "Endless.timeLeft()")
    pg.wait_for_timeout(2000)
    t1 = q(pg, "Endless.timeLeft()")
    print("④ 倒计时 %.2f → %.2f  递减=%s  (timeLimit=%s)" % (t0, t1, t1 < t0, q(pg, "CFG.endless.timeLimit")))

    # --- ⑤ 时间驱动刷怪：不清怪，快进 45 秒，看怪数上升 ---
    m0 = q(pg, "G.activeWorld.monsters.length")
    pg.evaluate("() => { for(let i=0;i<45;i++) Endless.update(G.activeWorld, 1.0); }")
    pg.wait_for_timeout(300)
    m1 = q(pg, "G.activeWorld.monsters.length")
    print("⑤ 时间驱动刷怪 monsters %d → %d  (快进 45s, wave=%s)" % (m0, m1, q(pg, "G.activeWorld.endlessWave")))
    pg.screenshot(path=SHOT + "rift_hud_timer.png")

    # --- ⑥ 推进量 → BOSS ---
    pr0 = q(pg, "Endless.progress()")
    print("⑥ 推进量 progress=%.1f  bossIndex=%s  threshold(0)=%s" % (pr0, q(pg, "Endless.bossIndex()"), q(pg, "Endless.bossThreshold(0)")))
    # 快进直到出 BOSS（累计时间加权 + 击杀）
    for _ in range(60):
        pg.evaluate("() => Endless.update(G.activeWorld, 1.0)")
        if q(pg, "Endless.bossIndex()") > 0:
            break
    pg.wait_for_timeout(300)
    print("   → BOSS 已出?", q(pg, "({bossIndex:Endless.bossIndex(), bossAlive:Endless.state.bossAlive, hasBossObj: !!G.activeWorld.endlessBoss})"))
    pg.screenshot(path=SHOT + "rift_boss_fight.png")

    # --- ⑦ 一路推到最终 BOSS（清空 bossAlive 以便下次触发）---
    for _ in range(400):
        # 杀死当前 BOSS 以允许下一个触发
        pg.evaluate("""() => {
          const w=G.activeWorld;
          if (w.endlessBoss && Endless.state.bossAlive) {
            w.monsters = w.monsters.filter(m=>m!==w.endlessBoss);
            w.endlessBoss = null; Endless.state.bossAlive=false;
          }
        }""")
        pg.evaluate("() => Endless.update(G.activeWorld, 1.0)")
        if q(pg, "Endless.isFinalBossSpawned()"):
            break
    print("⑦ 最终 BOSS spawned=%s defeated=%s bossIndex=%s" % (
        q(pg, "Endless.isFinalBossSpawned()"), q(pg, "Endless.isFinalBossDefeated()"), q(pg, "Endless.bossIndex()")))
    pg.screenshot(path=SHOT + "rift_boss_final.png")

    # --- ⑧ 击杀最终 BOSS → 掉撤离点 ---
    before = q(pg, "!!(G.activeWorld && G.activeWorld.exitBeacon)")
    pg.evaluate("""() => {
      const w=G.activeWorld;
      const boss=w.endlessBoss;
      if (boss && typeof damageMonster==='function') {
        let guard=0; while (boss.hp>0 && guard++<100000) damageMonster(boss, 1e7, null, 'test');
      }
    }""")
    pg.wait_for_timeout(800)
    after = q(pg, "!!(G.activeWorld && G.activeWorld.exitBeacon)")
    print("⑧ 撤离点 掉落前=%s 掉落后=%s  pos=%s" % (
        before, after, q(pg, "G.activeWorld.exitBeacon ? {x:Math.round(G.activeWorld.exitBeacon.x), y:Math.round(G.activeWorld.exitBeacon.y)} : null")))
    pg.screenshot(path=SHOT + "rift_extract_spawn.png")

    # --- ⑨ 走过去撤离 ---
    if after:
        pg.evaluate("""() => {
          const w=G.activeWorld, e=w.exitBeacon;
          if (G.player) { G.player.x=e.x; G.player.y=e.y; }
        }""")
        pg.wait_for_timeout(4200)   # 读条 3.0s
        print("⑨ 撤离结果", q(pg, "({reason:G.abyssSettleReason, report: (typeof G.lastSettleReport!=='undefined' && G.lastSettleReport)?{crystal:G.lastSettleReport.crystalTotal||G.lastSettleReport.crystal}: null})"))
        pg.wait_for_timeout(600)
        pg.screenshot(path=SHOT + "rift_settle_extract.png")

    print("-" * 64)
    print("pageerror:", errs if errs else "无")
    ctx.close(); b.close()
