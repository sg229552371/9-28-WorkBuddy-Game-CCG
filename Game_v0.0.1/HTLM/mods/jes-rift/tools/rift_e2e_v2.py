# 21.17 深渊大秘境 e2e 验收（数值曲线改版后复测）
# 核心验证：不再 2.75 秒暴毙；曲线符合 10→300、4s→11s、构成 小怪→精英→BOSS
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

    print("=" * 66)
    print("① 启动版本", q(pg, "({state:G.state, ver:(typeof APP_VERSION!=='undefined'?APP_VERSION:'?')})"))
    print("   CFG 关键值", q(pg, """({
      timeLimit: CFG.endless.timeLimit, firstWaveDelay: CFG.endless.firstWaveDelay,
      capMax: CFG.endless.capMax, atkMul: CFG.endless.atkMul,
      intvStart: CFG.endless.spawnIntervalStart, intvEnd: CFG.endless.spawnIntervalEnd
    })"""))

    pg.evaluate("() => document.getElementById('btn-main-start').click()")
    pg.wait_for_timeout(1300)
    pg.evaluate("() => enterEndless()")
    pg.wait_for_timeout(300)
    print("② 进深渊", q(pg, "({state:G.state, kind:G.activeWorld&&G.activeWorld.kind, inEndless:G.inEndless})"))

    # ③ 首波缓冲 5s 内应该没有怪
    m_early = q(pg, "G.activeWorld.monsters.length")
    print("③ 首波缓冲期怪物数 =", m_early, "（应为 0）")

    # ④ 生存测试：真实等待 20 秒，看玩家是否还活着（旧版 2.75s 就死）
    print("④ 生存测试（真实等待 20s，旧版 2.75s 阵亡）...")
    for i in range(10):
        pg.wait_for_timeout(2000)
        s = q(pg, """({
          t: +Endless.timeLeft().toFixed(1), state: G.state,
          wave: G.activeWorld.endlessWave, m: G.activeWorld.monsters.length,
          hp: G.player ? Math.round(G.player.hp) : null,
          hpMax: G.player ? G.player.hpMax : null,
          elite: G.activeWorld.monsters.filter(x=>x.isElite).length
        })""")
        print("    +%2ds  %s" % ((i+1)*2, json.dumps(s, ensure_ascii=False)))
        if s['state'] != 'playing':
            print("   ⚠ 状态提前结束:", s['state'])
            break
    pg.screenshot(path=SHOT + "rift_hud_v2.png")

    # ⑤ 快进到 79 / 80 / 90 / 100 波，验证构成曲线
    print("⑤ 构成曲线验证（快进到指定波次，看小怪/精英/BOSS 配比）")
    for target in [79, 80, 90, 100]:
        r = q(pg, """(function(){
          const w = G.activeWorld;
          w.monsters.length = 0;                       // 清场，避免干扰
          Endless.state.wave = %d;
          if (w) w.endlessWave = %d;
          const q = Endless._fillQueue(%d);
          let normal=0, elite=0, boss=0;
          for (const id of q) {
            const def = (CFG.monsters||{})[id];
            if (def && def.type === 'boss') boss++;
            else if (typeof isEliteDef === 'function' && isEliteDef(id)) elite++;
            else normal++;
          }
          return {wave: %d, total: q.length, normal: normal, elite: elite, boss: boss};
        })()""" % (target, target, target, target))
        print("   波%-4d 总%-4d 小怪%-4d 精英%-4d BOSS%-4d" % (r['wave'], r['total'], r['normal'], r['elite'], r['boss']))

    print("-" * 66)
    print("pageerror:", errs if errs else "无")
    ctx.close(); b.close()
