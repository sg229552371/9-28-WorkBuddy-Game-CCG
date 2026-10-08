# 多 WebView UA 实测：微信/QQ/支付宝内置浏览器 是否会被拦（对比 Safari）
from playwright.sync_api import sync_playwright

URL = "https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/"

UAS = {
    "iOS Safari": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                   "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    "微信 iOS": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                "(KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40(0x18002832) NetType/WIFI Language/zh_CN"),
    "QQ 内置": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
               "(KHTML, like Gecko) Mobile/15E148 QQ/8.9.70.611 V1_IPH_SQ_8.9.70_1_APP_A"),
    "安卓 Chrome": ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/119.0.0.0 Mobile Safari/537.36"),
}

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    for name, ua in UAS.items():
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3,
                            is_mobile=True, has_touch=True, user_agent=ua)
        pg = ctx.new_page()
        errs, failed = [], []
        pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        pg.on("requestfailed", lambda r: failed.append(r.url[:80]+" :: "+str(r.failure)))
        try:
            resp = pg.goto(URL, wait_until="load", timeout=25000)
            pg.wait_for_timeout(2500)
            st = pg.evaluate("() => ({ state: (typeof G!=='undefined')?G.state:'NO G', boot: window.__bootErrors||[] })")
            print(f"[{name}] HTTP={resp.status} state={st['state']} bootErr={st['boot']} "
                  f"pageErr={len(errs)} reqFail={failed[:2]}")
        except Exception as ex:
            print(f"[{name}] 打开异常: {str(ex)[:120]}")
        ctx.close()
    b.close()
