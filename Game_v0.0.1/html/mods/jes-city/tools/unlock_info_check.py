# 21.9 未解锁英雄信息公开化 —— 竖屏触屏实测（iPhone 12 视口）
# 验收：未解锁角色详情区显示真名 + 简介 + LV1 属性 + 技能描述 + 解锁条件（+crystal 型解锁按钮）
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

    page.evaluate('() => { Meta.data.unlockedLevels = 3; UI.selectedLevel = CFG.levels[0]; Game.enterCharSelect(); }')
    page.wait_for_timeout(400)

    # 点 heroLv 型未解锁卡（H007）→ 详情区完整信息
    r1 = page.evaluate("""() => {
      const hid = 'H007';
      const hero = CFG.heroes.find(x => x.id === hid);
      UI.renderCharDetail(hero);
      const html = (document.getElementById('char-detail') || {innerHTML: ''}).innerHTML;
      const card = [...document.querySelectorAll('#char-list .char-card')].find(c => c.innerHTML.indexOf(hid) >= 0);
      return {
        realName: html.indexOf(hero.name) >= 0,
        noMask: html.indexOf('???') < 0,
        stats: html.indexOf('cd-stats') >= 0 && html.indexOf('LV1 基础值') >= 0,
        hpVal: html.indexOf('HP ' + hero.hp) >= 0,
        skill: html.indexOf('cd-skill') >= 0 && html.indexOf('技能 LV1') >= 0,
        unlockLine: html.indexOf('cd-unlock') >= 0 && html.indexOf('未解锁') >= 0,
        ruleTxt: html.indexOf(UI._unlockRuleText(hid)) >= 0,
        cardRealName: card ? card.innerHTML.indexOf(hero.name) >= 0 : null,
        desc: html.indexOf(hero.desc) >= 0,
        name: hero.name,
      };
    }""")
    check("详情区显示真名（无 ??? 打码）", r1.get("realName") and r1.get("noMask"), "hero=" + str(r1.get("name")))
    check("详情区显示 LV1 基础属性（数值与 CFG 一致）", r1.get("stats") and r1.get("hpVal"))
    check("详情区显示技能信息（技能 LV1 描述）", r1.get("skill"))
    check("详情区显示角色简介", r1.get("desc") is True)
    check("解锁条件行保留（cd-unlock + 条件文案）", r1.get("unlockLine") and r1.get("ruleTxt"))
    check("选人卡片同步显示真名", r1.get("cardRealName") is True)
    page.screenshot(path="/workspace/unlock_info_21_9.png")

    # crystal 型（H008）：完整信息 + 解锁按钮共存
    r2 = page.evaluate("""() => {
      const hero = CFG.heroes.find(x => x.id === 'H008');
      UI.renderCharDetail(hero);
      const html = (document.getElementById('char-detail') || {innerHTML: ''}).innerHTML;
      return {
        realName: html.indexOf(hero.name) >= 0,
        stats: html.indexOf('cd-stats') >= 0,
        skill: html.indexOf('cd-skill') >= 0,
        btn: !!document.getElementById('btn-unlock-hero'),
        name: hero.name,
      };
    }""")
    check("crystal 型：完整信息 + 解锁按钮共存", r2.get("realName") and r2.get("stats") and r2.get("skill") and r2.get("btn"),
          "hero=" + str(r2.get("name")))

    check("无页面 JS 错误", len(errs) == 0, "; ".join(errs[:2]))
    b.close()

print("UNLOCK INFO CHECK " + ("OK" if ok else "FAILED"))
sys.exit(0 if ok else 1)
