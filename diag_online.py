# 线上链接诊断：模拟手机首次访问，抓控制台/页面错误 + 首屏状态 + 点击「开始游戏」是否响应
import json
from playwright.sync_api import sync_playwright

URL = "https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True,
                        user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"))
    pg = ctx.new_page()
    console, errs, failed = [], [], []
    pg.on("console", lambda m: console.append(f"[{m.type}] {m.text[:200]}"))
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.on("requestfailed", lambda r: failed.append(f"{r.url[:120]} :: {r.failure}"))

    pg.goto(URL, wait_until="load")
    pg.wait_for_timeout(3000)

    st = pg.evaluate("""() => {
      const vis = id => { const e = document.getElementById(id); if (!e) return null;
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return { id, w: Math.round(r.width), h: Math.round(r.height), display: cs.display, vis: cs.visibility, z: cs.zIndex }; };
      return {
        state: (typeof G !== 'undefined') ? G.state : 'NO G',
        screen: (typeof UI !== 'undefined' && UI.currentScreen) ? UI.currentScreen : null,
        version: (typeof G !== 'undefined' && G.version) ? G.version : null,
        bootErrors: (window.__bootErrors || []).slice(0, 5),
        bootDone: (typeof BootGuard !== 'undefined' && BootGuard.done) ? true : null,
        els: ['screen-main','btn-home-start','screen-boot','boot-error','hud'].map(vis),
        scripts: Array.from(document.scripts).map(s => s.src.split('/').pop()).filter(Boolean),
      };
    }""")
    print("=== 首屏状态 ===")
    print(json.dumps(st, ensure_ascii=False, indent=2))
    pg.screenshot(path="/workspace/diag_online_home.png")

    # 尝试点击「开始游戏」
    clicked = pg.evaluate("""() => {
      const btn = document.getElementById('btn-home-start') || document.querySelector('#screen-main .btn') ;
      if (!btn) return { ok: false, reason: 'no start button found' };
      const r = btn.getBoundingClientRect();
      return { ok: true, tag: btn.tagName, id: btn.id, cls: btn.className, txt: btn.textContent.trim().slice(0,20),
               rect: {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)} };
    }""")
    print("=== 开始按钮探测 ===")
    print(json.dumps(clicked, ensure_ascii=False))

    if clicked.get("ok") and clicked["rect"]["w"] > 0:
        r = clicked["rect"]
        pg.mouse.click(r["x"] + r["w"] / 2, r["y"] + r["h"] / 2)
        pg.wait_for_timeout(1200)
        after = pg.evaluate("() => ({ state: (typeof G!=='undefined')?G.state:'NO G', screen: (typeof UI!=='undefined'&&UI.currentScreen)?UI.currentScreen:null })")
        print("点击后:", json.dumps(after, ensure_ascii=False))
        pg.screenshot(path="/workspace/diag_online_after_click.png")

    print("=== 页面错误 ===")
    print(errs if errs else "无")
    print("=== 请求失败 ===")
    print(failed if failed else "无")
    print("=== 控制台（尾 12 条） ===")
    for c in console[-12:]:
        print("  " + c)
    ctx.close()
    b.close()
