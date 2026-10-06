# 21.6 选人界面实测：展示顺序 / 未解锁点击详情 / 入队回归
from playwright.sync_api import sync_playwright

ok = True
def check(n, c, extra=''):
    global ok
    print(('PASS ' if c else 'FAIL ') + n + (('  ' + extra) if extra else ''))
    if not c: ok = False

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--disable-gpu'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3,
                        is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('http://127.0.0.1:8123/index.html', wait_until='load')
    page.wait_for_timeout(500)
    page.evaluate('() => { Meta.data.unlockedLevels = 3; UI.selectedLevel = CFG.levels[0]; Game.enterCharSelect(); }')
    page.wait_for_timeout(400)
    r = page.evaluate("""() => {
      const cards = [...document.querySelectorAll('#char-list .char-card')];
      const info = cards.map(c => ({
        name: c.querySelector('.char-name') ? c.querySelector('.char-name').textContent : '?',
        locked: c.classList.contains('locked'),
      }));
      return { count: cards.length, info, state: G.state };
    }""")
    check('进入选人界面', r['state'] == 'charSel')
    check('角色卡 12 张', r['count'] == 12, 'count=%d' % r['count'])
    roles = page.evaluate('() => CFG.heroRoles.byHero')
    # 卡序即展示序：直接对齐 heroDisplayOrder（锁卡名是 ???，不能用名字反查）
    disp_ids = page.evaluate('() => CFG.heroDisplayOrder')
    disp_roles = [roles[i] for i in disp_ids]
    expect = ['output', 'defense', 'recovery'] * 4
    check('展示顺序 = 输出/防御/治疗 ×4 轮', disp_roles == expect, ' | '.join(disp_roles))
    check('第一张卡是输出·猎手（默认队长打头）', r['info'][0]['name'] == '猎手')
    check('第二张卡是防御·弹射手', r['info'][1]['name'] == '弹射手')
    # 第三卡 displayOrder[2]=H007 召唤师（治疗）——但首发仅 6 角 → H007 未解锁 → 名字打码 ???
    check('第三卡为治疗位（H007 召唤师）且未解锁打码 ???',
          disp_ids[2] == 'H007' and r['info'][2]['locked'] and r['info'][2]['name'] == '???')
    # 未解锁卡点击 → 详情区
    locked_idx = next(i for i, c in enumerate(r['info']) if c['locked'])
    page.evaluate('(i) => document.querySelectorAll("#char-list .char-card")[i].click()', locked_idx)
    page.wait_for_timeout(200)
    d = page.evaluate("() => { const b = document.getElementById('char-detail'); return b ? b.innerHTML : ''; }")
    check('点未解锁卡 → 详情区含 cd-unlock 条件行', 'cd-unlock' in d)
    check('详情区名字打码 ???', '???' in d)
    check('详情区不露属性（无 cd-stats）', 'cd-stats' not in d)
    check('详情区显示解锁条件文案（LV 或 结晶）', ('局外 LV' in d) or ('结晶' in d))
    page.screenshot(path='/workspace/char_locked_detail_21_6.png')   # 锁卡详情区（解锁条件持续展示）
    # 已解锁卡点击：第一卡默认已选中 → 点击=取消，再点=重新入队（验证 toggle 循环）
    page.evaluate('() => document.querySelectorAll("#char-list .char-card")[0].click()')
    page.wait_for_timeout(120)
    sel0 = page.evaluate('() => UI.selectedChars.length')
    page.evaluate('() => document.querySelectorAll("#char-list .char-card")[0].click()')
    page.wait_for_timeout(120)
    sel1 = page.evaluate('() => UI.selectedChars.length')
    check('已解锁卡点击 toggle 循环（默认1 → 点取消0 → 再点回1）', sel0 == 0 and sel1 == 1,
          'sel0=%d sel1=%d' % (sel0, sel1))
    check('零 pageerror', len(errs) == 0, str(errs[:2]))
    page.screenshot(path='/workspace/char_sel_21_6.png')
    b.close()

print('---')
print('全绿' if ok else '有失败')
