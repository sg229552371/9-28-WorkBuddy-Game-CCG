from playwright.sync_api import sync_playwright
URL = "https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    ctx = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    failed = []
    pg.on("requestfailed", lambda r: failed.append(r.url.split('/')[-1]+" :: "+str(r.failure)))
    resp = pg.goto(URL, wait_until="networkidle", timeout=30000)
    pg.wait_for_timeout(2000)
    # 直接检查 CSS 是否生效（读关键元素的实际计算样式）
    chk = pg.evaluate("""() => {
      const btn = document.getElementById('btn-main-start');
      const cs = btn ? getComputedStyle(btn) : null;
      return {
        cssSheets: document.styleSheets.length,
        cssRules: document.styleSheets[0] ? tryRules(document.styleSheets[0]) : -1,
        btnBg: cs ? cs.backgroundColor : null,
        btnRadius: cs ? cs.borderRadius : null,
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
      function tryRules(s){ try { return s.cssRules.length } catch(e){ return 'CORS:'+e.name } }
    }""")
    print("CSS 生效检查:", chk)
    print("失败请求:", failed if failed else "无（干净！）")
    ctx.close(); b.close()
