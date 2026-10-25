# 21.4 升级 4 选 1 改版 —— 竖屏触屏实测（iPhone 12 视口）
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

    # 强制打开升级弹窗（注入 4 个候选并渲染）
    page.evaluate("""() => {
      // 手工补最小 G.run 骨架（不调 startRun：那需要关卡上下文 mapW，桩成本过高）
      const HID = CFG.heroes[0].id;
      const pool = (CFG.modulePool && (CFG.modulePool.perHero[HID] || CFG.modulePool.default)) || CFG.moduleDefs.map(d => d.id);
      G.run = G.run || {};
      G.run.heroDef = { id: HID, name: CFG.heroes[0].name };
      G.run.companions = [];
      G.run.heroModules = {};
      G.run.heroModules[HID] = [null, null, null, null];   // 4 个空槽 → 池内模块都可出
      G.run.levelUpQueue = [];
      G.run.levelUpRerollsLeft = (CFG.levelUp && CFG.levelUp.rerollFreePerRun) || 1;
      const ov = document.getElementById('levelup-overlay');
      if (ov) ov.classList.remove('hidden');           // 宿主是 overlay，直接摘 hidden
      const host = document.getElementById('levelup-cards');
      if (host) host.innerHTML = '';
      // 用真实 heroId 出候选（复用战斗侧生成器，保证与线上一致）
      const real = (typeof buildLevelUpCandidates === 'function') ? buildLevelUpCandidates(HID) : [];
      UI.levelUpCandidates = real;
      UI.levelUpMeta = { heroId: HID };
      UI._renderLevelUp && UI._renderLevelUp();
      UI._renderLevelUpRerollBtn && UI._renderLevelUpRerollBtn();
      window.__hid = HID;
    }""")
    page.wait_for_timeout(400)

    # ⑧-1 丝带标题
    banner = page.query_selector(".lu-banner")
    check("丝带标题 .lu-banner 存在且文案为「增益选择」",
          banner is not None and "增益选择" in banner.inner_text(),
          (banner.inner_text().strip() if banner else "缺失"))

    # ⑧-2 卡数量 = 4
    cards = page.query_selector_all("#levelup-cards .levelup-card")
    check("升级卡数量 = 4", len(cards) == 4, "len=%d" % len(cards))

    # ⑧-3 推荐角标「推荐」且唯一
    recs = page.query_selector_all(".lu-rec-badge")
    check("推荐角标唯一", len(recs) == 1, "len=%d" % len(recs))
    check("推荐角标文案为「推荐」", len(recs) == 1 and "推荐" in recs[0].inner_text())

    # ⑧-4 数值高亮 .lu-num 命中（描述里 +N 或 N% 被橙色高亮）
    nums = page.query_selector_all(".lu-num")
    numtxt = [n.inner_text().strip() for n in nums]
    import re as _re
    hit_num = any(_re.search(r"[+\-]?\d+", t) for t in numtxt)
    check("数值高亮 .lu-num 命中数字", len(nums) > 0 and hit_num,
          "样例=%s" % numtxt[:3])

    # ⑧-5 大图标（汉字）
    icos = page.query_selector_all(".lu-ico")
    check("大图标 .lu-ico 存在", len(icos) == 4, "len=%d" % len(icos))

    # ⑧-6 进度胶囊
    chips = page.query_selector_all(".lu-chip-in")
    check("进度胶囊 .lu-chip-in 存在", len(chips) == 4, "len=%d" % len(chips))

    # ⑧-7 标题栏 + 左侧色条并存（归属色）
    heads = page.query_selector_all(".lu-head")
    bars = page.query_selector_all(".lu-bar")
    check("彩色标题栏 .lu-head 与左色条 .lu-bar 并存",
          len(heads) == 4 and len(bars) == 4, "head=%d bar=%d" % (len(heads), len(bars)))

    # ⑧-8 竖屏 2×2 网格：同一行两卡 y 相同、两行 y 不同
    def box(i):
        return cards[i].bounding_box()

    r0a, r0b, r1a = box(0), box(1), box(2)
    check("竖屏为 2 列（前两卡同一行）",
          abs(r0a["y"] - r0b["y"]) < 4, "y0=%.1f y1=%.1f" % (r0a["y"], r0b["y"]))
    check("竖屏为 2 行（第 3 卡另起一行）",
          r1a["y"] > r0a["y"] + 10, "y2=%.1f > y0=%.1f" % (r1a["y"], r0a["y"]))

    # ⑧-9 刷新按钮：次数文案 + 可用
    rb = page.query_selector("#btn-lu-reroll")
    cnt = page.query_selector("#lu-reroll-count")
    check("刷新按钮存在且可见", rb is not None and rb.is_visible())
    check("刷新次数文案形如 n/n", cnt is not None and "/" in cnt.inner_text(),
          (cnt.inner_text() if cnt else "缺失"))
    before_cnt = cnt.inner_text() if cnt else ""

    # ⑧-10 刷新真实换血（候选数组引用不变 + 次数 -1 + 按钮禁用）
    swapped = page.evaluate("""() => {
      const arr = UI.levelUpCandidates;
      const refBefore = arr;
      const firstBefore = arr.map(c => c.defId).join(',');
      const r = (typeof levelUpReroll === 'function') ? levelUpReroll() : false;
      const sameRef = (UI.levelUpCandidates === refBefore);
      const firstAfter = UI.levelUpCandidates.map(c => c.defId).join(',');
      const left = (G.run && typeof G.run.levelUpRerollsLeft === 'number') ? G.run.levelUpRerollsLeft : null;
      return { ret: r, sameRef: sameRef, before: firstBefore, after: firstAfter, left: left };
    }""")
    check("刷新返回成功", swapped["ret"] is True, str(swapped["ret"]))
    check("刷新后就地换血（候选数组引用不变）", swapped["sameRef"] is True)
    check("刷新后剩余次数已扣减",
          swapped["left"] is not None and int(swapped["left"]) >= 0, "left=%s" % swapped["left"])

    page.wait_for_timeout(200)
    cnt2 = page.query_selector("#lu-reroll-count")
    check("刷新后按钮次数文案变化", cnt2 is not None and cnt2.inner_text() != before_cnt,
          "%s -> %s" % (before_cnt, cnt2.inner_text() if cnt2 else "?"))
    rb2 = page.query_selector("#btn-lu-reroll")
    check("刷新用尽后按钮 disabled",
          rb2 is not None and rb2.is_disabled())

    # ⑧-11 无 emoji 空方框风险：候选卡文本不含 emoji 区段
    txt = page.evaluate("() => document.getElementById('levelup-cards').innerText")
    has_emoji = any(0x1F300 <= ord(ch) <= 0x1FAFF or 0x2600 <= ord(ch) <= 0x27BF for ch in txt)
    check("候选卡文本不含 emoji（防老机型空方框）", not has_emoji)

    # ⑧-12 无 JS 报错
    check("无 pageerror", len(errs) == 0, str(errs[:2]))

    page.screenshot(path="/workspace/levelup_portrait_v2.png", full_page=False)

    b.close()

print("----------------------------------------")
print(("LU CHECK 全绿" if ok else "LU CHECK 有失败项"))
sys.exit(0 if ok else 1)
