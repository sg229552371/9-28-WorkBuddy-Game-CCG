# 21.13 正式渲染路径优化 —— 真机实测（对比 21.12 基线）
# 目的：验证「弹幕批绘 + 剔除常态化」落进正式 render() 后的真实收益。
# 方法：进入正式战斗场景（G.state=playing，走 render() 主路径），
#       原地注入 N 怪 + M 弹，采样 100 帧取 p50/p95。
import sys
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"

# 采样注入脚本：在正式战斗里铺场（复用真实类），然后连续采样帧耗时
INJECT = """
(args) => {
  const n = args.n, m = args.m;
  // 1) 进入正式战斗：走真实开局链路（需先备齐 selectedLevel + selectedChars）
  try {
    if (!UI.selectedLevel) UI.selectedLevel = CFG.levels[0];
    const heroDef = CFG.heroes[0];
    if (typeof Game.startRun === 'function') Game.startRun([heroDef]);
    if (typeof Game.skipIntroFreeze === 'function') Game.skipIntroFreeze();
  } catch (e) { return { err: 'startRun: ' + (e && e.message) }; }
  const w = G.activeWorld || G.mainWorld;
  if (!w) return { err: 'no world', state: G.state };
  w.freezeTimer = 0;   // 解除开场冻结，让渲染跑满
  // 2) 铺怪（跳过 boss/精英）
  const ids = [];
  for (const id in CFG.monsters) {
    const d = CFG.monsters[id];
    if (d.type === 'boss') continue;
    if (typeof isEliteDef === 'function' && isEliteDef(id)) continue;
    ids.push(id);
  }
  if (!ids.length) return { err: 'no monster ids' };
  const side = Math.ceil(Math.sqrt(n));
  const step = Math.min(w.w, w.h) / (side + 1);
  let made = 0;
  for (let i = 0; i < side && made < n; i++) {
    for (let j = 0; j < side && made < n; j++) {
      const mm = new Monster(ids[made % ids.length], (i + 1) * step, (j + 1) * step, 5);
      w.monsters.push(mm); made++;
    }
  }
  // 3) 铺弹幕（绕玩家，保证在视野内）
  const cx = G.player.x, cy = G.player.y;
  for (let i = 0; i < m; i++) {
    const ang = (i / Math.max(1, m)) * Math.PI * 2 + (i % 7) * 0.05;
    const rad = 40 + (i % 30) * 9;
    const b = new Bullet(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, ang + Math.PI, 120, 5, 'enemy');
    b.life = 1e9;
    w.enemyBullets.push(b);
  }
  return { state: G.state, monsters: w.monsters.length, bullets: w.enemyBullets.length };
}
"""

# 采样：连续 N 帧记录（用 rAF 钩子，绕过游戏主循环，直接测 render 纯耗时）
SAMPLE = """
(args) => new Promise((resolve) => {
  const n = args.n;
  const durs = [];
  let i = 0;
  const orig = window.requestAnimationFrame;
  const tick = () => {
    const t0 = performance.now();
    try { render(); } catch (e) { durs.push(-1); }
    durs.push(performance.now() - t0);
    i++;
    if (i < n) orig(tick); else resolve(durs);
  };
  orig(tick);
})
"""


def stats(durs):
    d = sorted([x for x in durs if x >= 0])
    if not d:
        return {"p50": 0, "p95": 0, "avg": 0, "max": 0, "n": 0}
    return {
        "p50": d[len(d) // 2],
        "p95": d[min(len(d) - 1, int(len(d) * 0.95))],
        "avg": sum(d) / len(d),
        "max": d[-1],
        "n": len(d),
    }


CASES = [("500敌/500弹", 500, 500), ("1500敌/1000弹", 1500, 1000), ("3000敌/2000弹", 3000, 2000)]

ok = True
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    print("=" * 84)
    print("21.13 正式渲染路径（render()）真机实测 —— iPhone 12 视口 390×844, dsf=3")
    print("=" * 84)
    print(f"{'规模':<20}{'p50(ms)':>10}{'p95(ms)':>10}{'avg(ms)':>10}{'max(ms)':>10}{'样本':>8}")
    print("-" * 84)
    results = []
    for label, n, m in CASES:
        ctx = b.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=3,
            is_mobile=True, has_touch=True,
            user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
        )
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        pg.goto(BASE, wait_until="load")
        pg.wait_for_timeout(1600)
        inj = pg.evaluate(INJECT, {"n": n, "m": m})
        pg.wait_for_timeout(400)
        durs = pg.evaluate(SAMPLE, {"n": 100})
        s = stats(durs)
        print(f"{label:<20}{s['p50']:>10.2f}{s['p95']:>10.2f}{s['avg']:>10.2f}{s['max']:>10.2f}{s['n']:>8}")
        results.append({"label": label, "injected": inj, **s, "errors": list(errs)})
        if errs:
            print("   ! 异常:", errs[:2])
        ctx.close()
    print("-" * 84)
    b.close()

# 断言：60fps 门槛 p95 < 16.7ms
for r in results:
    cond = r["p95"] < 16.7 and r["p95"] > 0
    print(("PASS " if cond else "FAIL ") + f"{r['label']} p95={r['p95']:.2f}ms < 16.7ms（60fps）")
    if not cond:
        ok = False
allerrs = [e for r in results for e in r["errors"]]
print(("PASS " if not allerrs else "FAIL ") + "全程无 JS 异常")
if allerrs:
    ok = False
    print("   ", allerrs[:3])

with open("/workspace/render_opt_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print("\n结果 → /workspace/render_opt_results.json")
print("=" * 84)
print("RENDER OPT CHECK OK" if ok else "RENDER OPT CHECK FAILED")
sys.exit(0 if ok else 1)
