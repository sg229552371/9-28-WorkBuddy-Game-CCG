# 21.14 T4 画质三档：设置页 UI 真机验证 + 自动降档实测
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
    pg.goto(BASE, wait_until="load")
    pg.wait_for_timeout(1500)

    # 进设置页（走真实入口：renderSettings + showScreen）
    pg.evaluate("() => { UI.renderSettings(); UI.showScreen('screen-settings'); }")
    pg.wait_for_timeout(500)
    probe = pg.evaluate("""() => {
      const seg = document.getElementById('set-quality');
      const btns = ['set-quality-low','set-quality-mid','set-quality-high']
        .map(id => { const e = document.getElementById(id); return e ? {id, txt: e.textContent.trim(), sel: e.classList.contains('selected')} : null; });
      const hint = document.getElementById('set-quality-hint');
      return { segExists: !!seg, btns: btns, hintText: hint ? hint.textContent.trim() : null,
               quality: (typeof G !== 'undefined') ? G.settings.quality : null,
               lowQuality: (typeof G !== 'undefined') ? G.settings.lowQuality : null };
    }""")
    print("设置页探测:", json.dumps(probe, ensure_ascii=False))

    pg.screenshot(path="/workspace/quality_settings_21_14.png")

    # 点「低」→ 检查三档读写
    pg.evaluate("() => { const e = document.getElementById('set-quality-low'); if (e) e.click(); }")
    pg.wait_for_timeout(400)
    after_low = pg.evaluate("""() => ({
      quality: G.settings.quality, lowQuality: G.settings.lowQuality,
      autoDisabled: !!G.autoDowngradeDisabled,
      selLow: document.getElementById('set-quality-low')?.classList.contains('selected'),
    })""")
    print("点低后:", json.dumps(after_low, ensure_ascii=False))
    pg.screenshot(path="/workspace/quality_settings_low_21_14.png")

    # 点「高」
    pg.evaluate("() => { document.getElementById('set-quality-high').click(); }")
    pg.wait_for_timeout(400)
    after_high = pg.evaluate("""() => ({
      quality: G.settings.quality, lowQuality: G.settings.lowQuality,
      selHigh: document.getElementById('set-quality-high')?.classList.contains('selected'),
    })""")
    print("点高后:", json.dumps(after_high, ensure_ascii=False))

    print("JS 异常:", errs[:3])
    ctx.close()
    b.close()
