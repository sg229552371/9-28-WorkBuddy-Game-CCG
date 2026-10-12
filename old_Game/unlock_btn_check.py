# 21.8 选人面板 crystal 型解锁按钮 —— 竖屏触屏实测（iPhone 12 视口）
# 场景：复现用户反馈「解锁条件达成，英雄没解锁吧，结晶316」——
#       结晶 316 ≥ H008 门槛 300 → 详情区应出现可点「◆ 300 解锁」按钮，
#       点击后扣款 316→16、unlockExtra 落档、卡片/详情区刷新为已解锁态。
# 判绿口径：每项实测为真；PASS 文案不含英文 error
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
    page.wait_for_timeout(800)

    # 进入选人界面（默认存档结晶 0：H008 crystal 型未解锁）
    page.evaluate('() => { Meta.data.unlockedLevels = 3; UI.selectedLevel = CFG.levels[0]; Game.enterCharSelect(); }')
    page.wait_for_timeout(400)

    # ① 结晶 0：点 crystal 型未解锁卡 → 详情区按钮存在但 disabled + 显示缺口
    r0 = page.evaluate("""() => {
      const hid = 'H008';
      const card = [...document.querySelectorAll('#char-list .char-card')]
        .find(c => c._heroId === hid || (c.innerHTML.indexOf(hid) >= 0));
      if (!card) return { found: false };
      card.click();
      const btn = document.getElementById('btn-unlock-hero');
      return {
        found: true,
        btnExists: !!btn,
        disabled: btn ? btn.disabled : null,
        text: btn ? btn.textContent : '',
        ruleText: (document.getElementById('char-detail') || {}).innerHTML || '',
        crystals: Meta.data.crystals,
      };
    }""")
    check("crystal 型未解锁卡可点选并渲染详情", r0.get("found", False) and r0.get("btnExists", False))
    check("结晶 0 → 按钮 disabled 置灰", r0.get("disabled") is True, "文案=" + str(r0.get("text", "")).strip())
    check("按钮显示缺口（还差）", "还差 300" in str(r0.get("text", "")))
    check("详情区含解锁条件文案", "未解锁" in str(r0.get("ruleText", "")))
    page.screenshot(path="/workspace/unlock_btn_locked_21_8.png")

    # ② 结晶 316（用户实机场景）→ 重新渲染 → 按钮可点 → 点击解锁
    r1 = page.evaluate("""() => {
      Meta.data.crystals = 316;                 // 用户实机结晶数
      const h = CFG.heroes.find(x => x.id === 'H008');
      UI.buildCharList();
      UI.renderCharDetail(h);                   // 重新渲染详情区（模拟再次点选）
      const btn = document.getElementById('btn-unlock-hero');
      return {
        btnExists: !!btn,
        disabled: btn ? btn.disabled : null,
        text: btn ? btn.textContent : '',
        before: { crystals: Meta.data.crystals, unlocked: Meta.isHeroUnlocked('H008') },
      };
    }""")
    page.wait_for_timeout(200)
    check("结晶 316 ≥ 门槛 300 → 按钮可点", r1.get("btnExists") and r1.get("disabled") is False,
          "文案=" + str(r1.get("text", "")).strip())
    check("按钮文案含「◆ 300 解锁」", "◆ 300" in str(r1.get("text", "")) and "解锁" in str(r1.get("text", "")))
    page.screenshot(path="/workspace/unlock_btn_ready_21_8.png")

    # ③ 真实触点点击按钮 → 扣款 + 解锁 + 刷新
    btn = page.locator("#btn-unlock-hero")
    if btn.count() > 0 and btn.is_visible():
        btn.tap()
        page.wait_for_timeout(400)
    else:
        page.evaluate("() => { const b = document.getElementById('btn-unlock-hero'); if (b) b.click(); }")
        page.wait_for_timeout(400)
    r2 = page.evaluate("""() => ({
      crystals: Meta.data.crystals,
      unlocked: Meta.isHeroUnlocked('H008'),
      unlockExtra: !!Meta.data.unlockExtra['H008'],
      detailNoMask: (document.getElementById('char-detail') || {innerHTML: ''}).innerHTML.indexOf('???') < 0,
      toast: (document.getElementById('toast-area') || {textContent: ''}).textContent,
    })""")
    check("点击解锁 → 扣款 316→16", r2.get("crystals") == 16, "crystals=" + str(r2.get("crystals")))
    check("解锁成功 → isHeroUnlocked 翻转", r2.get("unlocked") is True)
    check("解锁成功 → unlockExtra 落档", r2.get("unlockExtra") is True)
    check("详情区刷新为已解锁态（??? 消失）", r2.get("detailNoMask") is True)
    check("toast 提示已解锁", "已解锁" in str(r2.get("toast", "")))
    page.screenshot(path="/workspace/unlock_btn_done_21_8.png")

    # ④ 解锁后卡片列表刷新（H008 卡不再 locked）
    r3 = page.evaluate("""() => {
      const card = [...document.querySelectorAll('#char-list .char-card')]
        .find(c => c.innerHTML.indexOf('H008') >= 0);
      return { stillLocked: card ? card.classList.contains('locked') : null };
    }""")
    check("列表卡片同步刷新（不再 locked）", r3.get("stillLocked") is False)

    check("无页面 JS 错误", len(errs) == 0, "; ".join(errs[:2]))

    b.close()

print("UNLOCK BTN CHECK " + ("OK" if ok else "FAILED"))
sys.exit(0 if ok else 1)
