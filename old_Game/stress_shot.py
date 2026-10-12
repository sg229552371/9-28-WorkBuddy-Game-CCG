# 21.12 压测场景三档视觉对照截图（供拍板「群体抽象」观感）
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8123/index.html"
CASES = [
    ("full", "?stress=3000&bullets=2000&mode=full&ai=0"),
    ("dot",  "?stress=3000&bullets=2000&mode=dot&ai=0"),
    ("lod",  "?stress=3000&bullets=2000&mode=lod&ai=0"),
]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    for name, q in CASES:
        ctx = b.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=2,
            is_mobile=True, has_touch=True,
        )
        page = ctx.new_page()
        page.goto(BASE + q, wait_until="load")
        page.wait_for_timeout(2200)
        out = f"/workspace/stress_{name}_3000.png"
        page.screenshot(path=out)
        print("saved " + out)
        ctx.close()
    b.close()
print("DONE")
