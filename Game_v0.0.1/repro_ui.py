# 21.5 复现脚本：摇杆上半屏 / 4选1刷新按钮可见性 / 文字重复 / 风格对比
import sys, re
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/index.html"
ok = True

def check(name, cond, extra=""):
    global ok
    print(("PASS " if cond else "FAIL ") + name + (("  " + extra) if extra else ""))
    if not cond: ok = False

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(600)

    # 进战斗态（真实关卡 + 真实英雄）
    page.evaluate("""() => {
      UI.selectedLevel = CFG.levels[0];
      Game.startRun([CFG.heroes[0]]);
      Game.skipIntroFreeze();
    }""")
    page.wait_for_timeout(400)
    check("进入战斗态", page.evaluate("() => G.state") == "playing")

    cdp = ctx.new_cdp_session(page)

    def touch(x, y, mx=None, my=None, steps=6):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        if mx is not None:
            for i in range(1, steps + 1):
                nx = x + (mx - x) * i / steps
                ny = y + (my - y) * i / steps
                cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": nx, "y": ny}]})
                page.wait_for_timeout(16)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(60)

    def joy_state():
        return page.evaluate("() => ({on: document.getElementById('joy-base').classList.contains('joy-on'), dx: G.joy.dx, dy: G.joy.dy, active: G.joy.active})")

    # --- 摇杆 5 点实测（正确时序：按住读 → 拖动读 → 松手读；21.3 踩过 touchEnd 后读的坑）---
    # 注：(300,160) 会命中出生点附近 NPC（npcTap defaultPrevented 优先，摇杆让位 = 正确设计），故右上取 (330,230)
    pts = [(100, 160, "上半屏左"), (195, 160, "上半屏中"), (330, 230, "上半屏右"),
           (100, 420, "中部左"), (300, 420, "中部右")]
    for x, y, label in pts:
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        page.wait_for_timeout(100)
        s = joy_state()
        check(f"摇杆[{label}]按住即起杆", s["on"] and s["active"],
              "on=%s active=%s" % (s["on"], s["active"]))
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + 45, "y": y + 35}]})
        page.wait_for_timeout(100)
        s = joy_state()
        check(f"摇杆[{label}]拖动有向量", s["active"] and (abs(s["dx"]) + abs(s["dy"]) > 0.05),
              "dx=%.2f dy=%.2f" % (s["dx"], s["dy"]))
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(80)
        s = joy_state()
        check(f"摇杆[{label}]松手归零", not s["active"] and s["dx"] == 0 and s["dy"] == 0,
              "active=%s dx=%.2f dy=%.2f" % (s["active"], s["dx"], s["dy"]))

    # 右下按钮让位：本配置 hideTouchButtons 隐藏了全部按钮（display:none）→ 用例跳过，
    # 黑名单逻辑由 mobile_ctrl_test 静态断言（INTERACTIVE 表）覆盖
    bb = page.evaluate("() => { const r = document.getElementById('btn-touch-skill').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }")
    if bb["w"] > 0:
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": bb["x"], "y": bb["y"]}]})
        page.wait_for_timeout(120)
        s = joy_state()
        check("摇杆[技能按钮中心]让位不起杆", not s["active"], "active=%s btn=(%.0f,%.0f)" % (s["active"], bb["x"], bb["y"]))
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(60)
    else:
        print("PASS 摇杆[技能按钮中心]让位——按钮本局被 CFG 隐藏（display:none），黑名单由静态断言覆盖（跳过）")

    # --- 4选1 弹窗：刷新按钮可见性 ---
    page.evaluate("""() => {
      G.run.levelUpQueue = [{ hp: 1 }];
      G.run.heroModules = G.run.heroModules || {};
      G.run.heroModules[G.heroDef.id] = G.run.heroModules[G.heroDef.id] || [null, null, null, null];
      G.run.levelUpRerollsLeft = (CFG.levelUp && CFG.levelUp.rerollFreePerRun) || 1;
      if (typeof buildLevelUpCandidates === 'function') {
        UI.levelUpCandidates = buildLevelUpCandidates(G.heroDef.id);
        UI.levelUpMeta = { heroId: G.heroDef.id };
      }
      const ov = document.getElementById('levelup-overlay');
      if (ov) ov.classList.remove('hidden');
      UI._renderLevelUp && UI._renderLevelUp();
      UI._renderLevelUpRerollBtn && UI._renderLevelUpRerollBtn();
    }""")
    page.wait_for_timeout(300)

    vb = page.evaluate("() => { const r = document.getElementById('btn-lu-reroll').getBoundingClientRect(); return {t: r.top, b: r.bottom, vh: innerHeight, w: innerWidth}; }")
    in_view = vb["t"] >= 0 and vb["b"] <= vb["vh"] and vb["b"] > 0
    check("刷新按钮在视口内（竖屏不打开放大镜也看得到）", in_view,
          "top=%.0f bottom=%.0f vh=%.0f" % (vb["t"], vb["b"], vb["vh"]))

    # 文字重复扫描（口径 = 单张卡内重复词；跨卡同名胶囊「新模块」是正常内容不算）
    card_dup = page.evaluate("""() => {
      const dups = [];
      for (const card of document.querySelectorAll('#levelup-cards .levelup-card')) {
        const words = (card.innerText.match(/[\\u4e00-\\u9fa5]{2,}/g) || []);
        const seen = {};
        for (const w of words) { seen[w] = (seen[w] || 0) + 1; }
        for (const w in seen) if (seen[w] > 1) dups.push(w + '×' + seen[w]);
      }
      return dups;
    }""")
    check("每张卡内无重复词语（猎手×2 类 bug 已修）", not card_dup, "卡内重复=%s" % card_dup[:4])

    # 风格采样：弹窗 vs 主界面底色
    style = page.evaluate("""() => {
      const ov = document.getElementById('levelup-overlay');
      const card = document.querySelector('.levelup-card.lu-v2');
      const head = document.querySelector('.lu-head');
      const g = (el) => el ? getComputedStyle(el).backgroundColor : 'none';
      return { overlay: g(ov), card: g(card), head: g(head) };
    }""")
    print("INFO 风格采样:", style)

    page.screenshot(path="/workspace/repro_21_5.png")
    print("pageerror:", errs[:3])
    b.close()

print("----------------------------------------")
print("REPRO 完成 " + ("（存在 FAIL = 已复现用户报障）" if not ok else "全绿"))
sys.exit(0 if ok else 1)
