# 最小诊断：bindTouch 是否执行 / 监听是否挂上 / 手动派发反应
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/index.html"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: print("CONSOLE:", m.text[:200]))
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(600)

    diag = page.evaluate("""() => {
      const out = {};
      out.touchControlsHidden = document.getElementById('touch-controls').classList.contains('hidden');
      out.touchMode = document.body.classList.contains('touch-mode');
      out.maxTouchPoints = navigator.maxTouchPoints;
      out.ontouchstart = 'ontouchstart' in window;
      out.Gjoy = typeof G !== 'undefined' && G.joy ? JSON.stringify(G.joy) : 'no-G-joy';
      out.state = (typeof G !== 'undefined') ? G.state : 'no-G';
      out.isTouchDevFn = (typeof isTouchDevice === 'function') ? isTouchDevice() : 'no-fn';
      // 手动派发 pointerdown 到 canvas（模拟命中）
      const canvas = document.getElementById('game-canvas');
      let caught = { down: 0, move: 0, up: 0 };
      document.addEventListener('pointerdown', () => caught.down++, { capture: true, once: true });
      const ev = new PointerEvent('pointerdown', { clientX: 100, clientY: 160, pointerId: 7, bubbles: true, pointerType: 'touch', isPrimary: true });
      canvas.dispatchEvent(ev);
      out.afterDown = JSON.stringify(G.joy || {});
      out.joyOnAfterDown = document.getElementById('joy-base').classList.contains('joy-on');
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, clientY: 190, pointerId: 7, bubbles: true, pointerType: 'touch', isPrimary: true }));
      out.afterMove = JSON.stringify(G.joy || {});
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 130, clientY: 190, pointerId: 7, bubbles: true, pointerType: 'touch', isPrimary: true }));
      out.afterUp = JSON.stringify(G.joy || {});
      return out;
    }""")
    for k, v in diag.items():
        print(f"{k}: {v}")
    print("pageerror:", errs[:3])
    b.close()
