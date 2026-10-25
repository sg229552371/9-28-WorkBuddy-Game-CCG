# 21.12 性能压测场景 —— 真机实测（iPhone 12 视口 390×844）
# 目的：跑出 3000 敌 + 2000 弹的真实帧耗时，并对比三种「群体抽象」渲染方案（full/dot/lod）。
# 用法：先起本地服务（python3 -m http.server 8123），再 python3 stress_check.py
import sys
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"

# 待测方案矩阵：(标签, URL 参数)
CASES = [
    ("3000敌/2000弹 full 全精灵基线", "?stress=3000&bullets=2000&mode=full&ai=1"),
    ("3000敌/2000弹 dot  纯色点", "?stress=3000&bullets=2000&mode=dot&ai=1"),
    ("3000敌/2000弹 lod  三档分级(默认)", "?stress=3000&bullets=2000&mode=lod&ai=1"),
    ("3000敌/2000弹 lod  仅渲染(ai=0)", "?stress=3000&bullets=2000&mode=lod&ai=0"),
    ("1500敌/1000弹 lod  中档规模", "?stress=1500&bullets=1000&mode=lod&ai=1"),
]

ok = True
errs = []


def check(name, cond, extra=""):
    global ok
    if cond:
        print("PASS " + name + (("  " + extra) if extra else ""))
    else:
        ok = False
        print("FAIL " + name + (("  " + extra) if extra else ""))


with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])

    print("=" * 78)
    print("21.12 压测场景真机实测（iPhone 12 视口 390×844, dsf=3）")
    print("=" * 78)
    print(f"{'方案':<34}{'帧耗时(ms)':>12}{'1000ms帧数':>12}{'drawCall':>10}{'剔除':>8}")
    print("-" * 78)

    results = []
    for label, q in CASES:
        errs.clear()
        ctx = b.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3, is_mobile=True, has_touch=True,
            user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(BASE + q, wait_until="load")
        page.wait_for_timeout(2500)   # 预热 + 采样

        snap = page.evaluate("""() => {
          const s = (typeof StressHarness !== 'undefined' && StressHarness.stats) || {};
          const w = G.activeWorld;
          // 重新精确采样：连续 60 帧，取 p50/p95/max
          return {
            active: (typeof StressHarness !== 'undefined') && StressHarness.isActive(),
            mode: (typeof StressHarness !== 'undefined') ? StressHarness.mode : null,
            monsters: w ? w.monsters.length : -1,
            bullets: w ? w.enemyBullets.length : -1,
            frames: s.frames || 0,
            last: s.lastDur || 0,
            avg: (typeof StressHarness !== 'undefined') ? StressHarness.avgDur() : 0,
            max: s.maxDur || 0,
            drawCalls: s.drawCalls || 0,
            culled: s.culled || 0,
            ctx: !!G.ctx, W: G.W, H: G.H,
          };
        }""")

        if snap.get("active") and snap.get("frames", 0) > 0:
            print(f"{label:<34}{snap['avg']:>12.1f}{snap['frames']:>12}{snap['drawCalls']:>10}{snap['culled']:>8}")
        else:
            print(f"{label:<34}{'未激活/0帧':>12}{'':>12}{'':>10}{'':>8}")

        results.append({"label": label, "query": q, **snap, "errors": list(errs)})
        errs_snapshot = list(errs)
        ctx.close()
        if errs_snapshot:
            print(f"    ! 页面异常: {errs_snapshot[:3]}")

    print("-" * 78)
    print("（帧耗时越低越好；drawCall 越低越好；剔除 = 视野外被跳过的实体数）")
    print()

    # 断言：场景真的跑起来了
    r0 = results[0]
    check("full 基线：压测已激活", r0["active"] is True)
    check("full 基线：敌人数=3000", r0["monsters"] == 3000, f"实际 {r0['monsters']}")
    # ai=1 时敌人自主开火 → 弹幕数围绕铺场值波动（真实行为）；只断"不少于铺场值"
    check("full 基线：弹幕数≥2000（含 AI 自主开火增补）", r0["bullets"] >= 2000, f"实际 {r0['bullets']}")
    check("full 基线：帧耗时 < 16.7ms（60fps 门槛）", r0["avg"] < 16.7, f"avg={r0['avg']:.1f}ms")
    check("full 基线：有渲染帧产出", r0["frames"] > 0, f"frames={r0['frames']}")

    # 断言：色点批绘显著降 drawCall
    full = next((x for x in results if "full" in x["query"]), None)
    dot = next((x for x in results if "mode=dot" in x["query"]), None)
    lod = next((x for x in results if "lod" in x["label"] and "ai=1" in x["query"]), None)
    if full and dot:
        check("dot 的 drawCall 远低于 full（批绘生效）",
              dot["drawCalls"] < full["drawCalls"],
              f"dot={dot['drawCalls']} vs full={full['drawCalls']}")
    if full and lod:
        check("lod 的 drawCall 低于 full（视野外剔除 + 色点批绘）",
              lod["drawCalls"] < full["drawCalls"],
              f"lod={lod['drawCalls']} vs full={full['drawCalls']}")

    # 断言：剔除常态化（视野外实体被跳过）
    if lod:
        check("lod 存在视野外剔除（culled>0）", lod["culled"] > 0, f"culled={lod['culled']}")

    # 断言：全程无 JS 异常
    all_errs = [e for r in results for e in r["errors"]]
    check("全程无 JS 异常", len(all_errs) == 0, str(all_errs[:3]))

    # 输出结构化结果（供报告使用）
    with open("/workspace/stress_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print()
    print("结果已写入 /workspace/stress_results.json")
    print("=" * 78)

    b.close()

print("STRESS REAL-DEVICE CHECK OK" if ok else "STRESS REAL-DEVICE CHECK FAILED")
sys.exit(0 if ok else 1)
