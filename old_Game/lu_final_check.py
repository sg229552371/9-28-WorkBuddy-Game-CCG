# 21.8 终版视觉验收：4 选 1 布局压缩 + 标题移除 + 轮转归属（iPhone 12 视口）
# 场景 A：单英雄 statPack（同 lu_check 注入）→ 无标题 + 一屏放下
# 场景 B：多英雄 3 人队 → 卡面 lu-owner 轮转 + slotLine 去名（无重复英雄名）
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

    # ---- 场景 A：单英雄 4 选 1（statPack 兜底场景，同 lu_check 注入方式） ----
    page.evaluate("""() => {
      const HID = CFG.heroes[0].id;
      const pool = (CFG.modulePool && (CFG.modulePool.perHero[HID] || CFG.modulePool.default)) || CFG.moduleDefs.map(d => d.id);
      G.run = G.run || {};
      G.run.heroDef = { id: HID, name: CFG.heroes[0].name };
      G.run.companions = [];
      G.run.heroModules = {};
      G.run.heroModules[HID] = [null, null, null, null];
      G.run.levelUpQueue = [];
      G.run.levelUpRerollsLeft = (CFG.levelUp && CFG.levelUp.rerollFreePerRun) || 1;
      const ov = document.getElementById('levelup-overlay');
      if (ov) ov.classList.remove('hidden');
      const real = (typeof buildLevelUpCandidates === 'function') ? buildLevelUpCandidates(HID) : [];
      UI.levelUpCandidates = real;
      UI.levelUpMeta = { heroId: HID };
      UI._renderLevelUp && UI._renderLevelUp();
      UI._renderLevelUpRerollBtn && UI._renderLevelUpRerollBtn();
    }""")
    page.wait_for_timeout(400)
    ma = page.evaluate("""() => {
      const panel = document.querySelector('.levelup-panel');
      const foot = document.querySelector('.levelup-panel .lu-foot');
      const banner = document.querySelector('.lu-banner');
      const overlayHtml = (document.getElementById('levelup-overlay') || {innerHTML: ''}).innerHTML;
      const r = panel.getBoundingClientRect();
      const rf = foot ? foot.getBoundingClientRect() : null;
      return {
        noTitle: overlayHtml.indexOf('选择强化') < 0 && !document.getElementById('levelup-hero'),
        panelTop: r.top, footBottom: rf ? rf.bottom : null,
        vh: window.innerHeight,
        cardH: (document.querySelector('.levelup-card.lu-v2') || {}).offsetHeight || 0,
      };
    }""")
    check("A 标题已移除（无「选择强化」文案、无宿主节点）", ma.get("noTitle") is True)
    check("A 一屏放下（foot 底 ≤ 844 视口内）", ma.get("footBottom") is not None and ma["footBottom"] <= ma["vh"],
          "footBottom=" + str(ma.get("footBottom")) + " vh=" + str(ma.get("vh")))
    check("A 卡高压缩（≤170px）", 0 < ma.get("cardH", 0) <= 170, "cardH=" + str(ma.get("cardH")))
    page.screenshot(path="/workspace/lu_final_solo_21_8.png")

    # 关闭弹窗
    page.evaluate("() => { const ov = document.getElementById('levelup-overlay'); if (ov) ov.classList.add('hidden'); }")

    # ---- 场景 B：多英雄 3 人队轮转归属 ----
    mb = page.evaluate("""() => {
      const ids = [CFG.heroes[0].id, CFG.heroes[1].id, CFG.heroes[2].id];
      G.run = G.run || {};
      G.heroDef = { id: ids[0], name: CFG.heroes[0].name };   // teamHeroIds 读 G.heroDef / G.team
      G.team = [{ id: ids[1], name: CFG.heroes[1].name }, { id: ids[2], name: CFG.heroes[2].name }];
      G.run.heroDef = G.heroDef;
      G.run.companions = [{ heroDef: CFG.heroes[1] }, { heroDef: CFG.heroes[2] }];
      G.run.heroModules = {};
      ids.forEach(h => { G.run.heroModules[h] = [null, null, null, null]; });
      G.run.levelUpQueue = [];
      G.run.levelUpRerollsLeft = (CFG.levelUp && CFG.levelUp.rerollFreePerRun) || 1;
      const ov = document.getElementById('levelup-overlay');
      if (ov) ov.classList.remove('hidden');
      const real = (typeof buildLevelUpCandidates === 'function') ? buildLevelUpCandidates(ids[0]) : [];
      UI.levelUpCandidates = real;
      UI.levelUpMeta = { heroId: ids[0] };
      UI._renderLevelUp && UI._renderLevelUp();
      // 检查轮转归属：卡 i 的 heroId 应为 ids[i % 3]（各池非空前提）
      const owners = real.map(c => c.heroId);
      const expect = [ids[0], ids[1], ids[2], ids[0]];
      const rotOK = real.length === 4 && owners.every((h, i) => h === expect[i]);
      // 检查 slotLine 去名：卡面槽位行不再出现「填入 <英雄名>」重复
      const cards = [...document.querySelectorAll('#levelup-cards .levelup-card')];
      const dupName = cards.some(c => {
        const slot = c.querySelector('.lu-slot');
        const owner = c.querySelector('.lu-owner');
        if (!slot || !owner) return false;
        const on = owner.textContent.replace('▶', '').trim();
        return slot.textContent.indexOf(on) >= 0 && slot.textContent.indexOf('强化已有槽') < 0;
      });
      return { rotOK, owners, dupName, names: CFG.heroes.slice(0, 3).map(h => h.name) };
    }""")
    page.wait_for_timeout(300)
    check("B 轮转归属：卡 0/1/2/3 依次绑定队友 0/1/2/0", mb.get("rotOK") is True,
          "owners=" + str(mb.get("owners")))
    check("B slotLine 去名：槽位行不含英雄名（与 owner 行不重复）", mb.get("dupName") is False)
    page.screenshot(path="/workspace/lu_final_multi_21_8.png")

    check("无页面 JS 错误", len(errs) == 0, "; ".join(errs[:2]))
    b.close()

print("LU FINAL CHECK " + ("OK" if ok else "FAILED"))
sys.exit(0 if ok else 1)
