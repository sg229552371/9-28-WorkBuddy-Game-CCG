# 深诊断：进战斗后，合成 PointerEvent vs CDP 真触摸 双路对比
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/index.html"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(500)

    page.evaluate("""() => {
      UI.selectedLevel = CFG.levels[0];
      Game.startRun([CFG.heroes[0]]);
      Game.skipIntroFreeze();
      // 插桩：包一层 document pointerdown 记录器（不动业务代码）
      window.__pdLog = [];
      document.addEventListener('pointerdown', (e) => {
        window.__pdLog.push({ x: e.clientX, y: e.clientY, t: e.target && e.target.id || (e.target && e.target.className || '?'),
                               dp: e.defaultPrevented, type: e.pointerType });
      }, true);   // capture：先于业务监听记录
    }""")
    page.wait_for_timeout(200)
    print("state:", page.evaluate("() => G.state"))

    # 路线 A：合成 PointerEvent（bubbles → document）
    page.evaluate("""() => {
      const c = document.getElementById('game-canvas');
      c.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 160, pointerId: 7, bubbles: true, pointerType: 'touch', isPrimary: true }));
    }""")
    page.wait_for_timeout(100)
    a1 = page.evaluate("() => ({ joy: JSON.stringify(G.joy), on: document.getElementById('joy-base').classList.contains('joy-on'), log: window.__pdLog })")
    print("A合成 down(100,160):", a1)
    page.evaluate("() => window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, clientY: 160, pointerId: 7, bubbles: true, pointerType: 'touch', isPrimary: true }))")
    page.wait_for_timeout(60)

    # 路线 B：CDP 真触摸
    cdp = ctx.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": 100, "y": 300}]})
    page.wait_for_timeout(150)
    b1 = page.evaluate("() => ({ joy: JSON.stringify(G.joy), on: document.getElementById('joy-base').classList.contains('joy-on'), log: window.__pdLog })")
    print("B_CDP down(100,300):", b1)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(80)
    b2 = page.evaluate("() => JSON.stringify(G.joy)")
    print("B_CDP end 后:", b2)

    # 摇杆监听是否真的注册：检查 begin 引用不可达 → 用行为反证已在 A/B 呈现
    print("pageerror:", errs[:3])
    b.close()
