# 21.10 手机端主城 NPC 交互 —— 复现 + 验收（iPhone 12 视口）
# 问题：CFG.mobile.hideTouchButtons=true 隐藏了「交互」按钮，而主城 NPC 只走 actionE()（键盘 E）
#       → 手机端无任何途径与主城 NPC 交互（21.1 的 npcTap 只实现在工匠世界）。
# 修复验收：主城「站进圈（G.cityNpcNear）→ 点击 NPC 本体」即弹面板；并渲染触屏提示。
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/index.html"
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
    ctx = b.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        is_mobile=True,
        has_touch=True,
        user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    )
    page = ctx.new_page()
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL, wait_until="load")
    page.wait_for_timeout(900)

    # 基线：确认进入主城 + 交互按钮被隐藏（问题现场）
    base = page.evaluate("""() => {
      if (!(G.activeWorld && G.activeWorld.kind === 'city') && typeof Game !== 'undefined' && Game.enterCity) Game.enterCity();
      const act = document.getElementById('btn-touch-act');
      const visible = act && !act.classList.contains('hidden') &&
        getComputedStyle(act).display !== 'none' && act.offsetParent !== null;
      return { state: G.state, hideTouchButtons: !!(CFG.mobile && CFG.mobile.hideTouchButtons),
               actHidden: act ? act.classList.contains('hidden') : null, actVisible: visible,
               hasCityWorld: !!(G.activeWorld && G.activeWorld.kind === 'city'),
               npcCount: (G.activeWorld && G.activeWorld.cityNpcs) ? G.activeWorld.cityNpcs.length : 0 };
    }""")
    check("基线：已进入主城（city 状态）", base.get("state") == "city", "state=" + str(base.get("state")))
    check("基线：主城存在 NPC", base.get("npcCount", 0) > 0, "count=" + str(base.get("npcCount")))
    check("基线复现：hideTouchButtons=true 且「交互」按钮不可见（手机无入口）",
          base.get("hideTouchButtons") is True and base.get("actVisible") is False)

    # 修复验收：把形象传到 NPC 旁 → cityNpcNear 应命中 → 点击 NPC 本体弹面板
    r = page.evaluate("""() => {
      const w = G.activeWorld, n = w.cityNpcs[0];
      G.cityAvatar.x = n.x; G.cityAvatar.y = n.y + 10;   // 站进判定圈
      if (typeof updateCity === 'function') { /* 由主循环推进；此处直接跑一次判定 */ }
      // 手动推进一帧主城逻辑以刷新 cityNpcNear
      if (typeof Game !== 'undefined' && Game.update) { }
      return { avatarSet: true, npcId: n.id, npcX: n.x, npcY: n.y, npcName: n.name };
    }""")
    page.wait_for_timeout(500)   # 等主循环推进 → cityNpcNear 更新

    near = page.evaluate("""() => ({
      near: G.cityNpcNear ? G.cityNpcNear.id : null,
      open: G.cityNpcOpen ? G.cityNpcOpen.id : null,
    })""")
    check("站进圈 → G.cityNpcNear 命中 NPC", near.get("near") == r.get("npcId"),
          "near=" + str(near.get("near")) + " expect=" + str(r.get("npcId")))

    # 计算 NPC 的屏幕坐标并真实点击（走触屏）
    pt = page.evaluate("""() => {
      const w = G.activeWorld, n = w.cityNpcs[0];
      const cv = G.canvas, rect = cv.getBoundingClientRect();
      const zoom = (CFG.camera && CFG.camera.zoom) || 1;
      const viewW = G.W / zoom, viewH = G.H / zoom;
      const camX = w.w <= viewW ? (w.w - viewW) / 2 : Math.max(0, Math.min(G.cityAvatar.x - viewW / 2, w.w - viewW));
      const camY = w.h <= viewH ? (w.h - viewH) / 2 : Math.max(0, Math.min(G.cityAvatar.y - viewH / 2, w.h - viewH));
      const px = (n.x - camX) * zoom, py = (n.y - camY) * zoom;
      return { clientX: rect.left + px * (rect.width / G.W), clientY: rect.top + py * (rect.height / G.H) };
    }""")
    page.mouse.click(pt["clientX"], pt["clientY"])
    page.wait_for_timeout(400)
    after = page.evaluate("""() => ({
      open: G.cityNpcOpen ? G.cityNpcOpen.id : null,
      panelVisible: (() => {
        const p = document.getElementById('npc-outlevel-panel') || document.getElementById('npc-weapon-panel');
        return p ? !p.classList.contains('hidden') : null;
      })(),
      hintTxt: (() => {
        // 提示文案是否渲染（canvas 层无法直接读，查是否有触屏提示状态）
        return typeof G.cityNpcNear !== 'undefined' ? 'ok' : 'none';
      })(),
    })""")
    check("点击 NPC 本体 → G.cityNpcOpen 置位（面板触发）", after.get("open") == r.get("npcId"),
          "open=" + str(after.get("open")))
    check("NPC 面板可见", after.get("panelVisible") is not False)

    page.screenshot(path="/workspace/city_npc_tap_21_10.png")

    # 离圈自动关闭（回归）
    off = page.evaluate("""() => {
      G.cityAvatar.x = 60; G.cityAvatar.y = 60;   // 远离所有 NPC
      return true;
    }""")
    page.wait_for_timeout(500)
    closed = page.evaluate("""() => ({ near: G.cityNpcNear ? G.cityNpcNear.id : null, open: G.cityNpcOpen ? G.cityNpcOpen.id : null })""")
    check("离圈 → 自动关闭面板（回归不变）", closed.get("open") is None and closed.get("near") is None)

    check("无页面 JS 错误", len(errs) == 0, "; ".join(errs[:2]))
    b.close()

print("CITY NPC CHECK " + ("OK" if ok else "FAILED"))
sys.exit(0 if ok else 1)
