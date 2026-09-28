/* ============================================================
   布局线框稿脚本
   职责仅三件：① 等比缩放适配 ② 切屏 ③ 生成占位内容
   不包含任何游戏逻辑；阶段二美化时本文件仅需保留前两项
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ① 等比缩放：scale = min((vw−48)/1920, (vh−96)/1080) ---------- */
  var stage = document.getElementById('stage');
  var viewport = document.getElementById('viewport');

  function fit() {
    var vw = viewport.clientWidth;
    var vh = viewport.clientHeight;
    var s = Math.min((vw - 48) / 1920, (vh - 48) / 1080);
    stage.style.transform = 'scale(' + s + ')';
    document.documentElement.style.setProperty('--fit', s);
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- ② 切屏 ---------- */
  var screens = {};
  Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (el) {
    screens[el.dataset.screen] = el;
  });

  function go(id) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('on', k === id);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (b) {
      b.classList.toggle('active', b.dataset.go === id);
    });
    document.body.classList.toggle('is-hud', id === 'S5');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (b) {
    b.addEventListener('click', function () { go(b.dataset.go); });
  });

  /* 键盘 1~9 切屏 */
  document.addEventListener('keydown', function (e) {
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) go('S' + n);
  });

  /* ---------- ③ 标注开关 ---------- */
  var anno = document.getElementById('t-anno');
  var safe = document.getElementById('t-safe');
  function syncAnno() {
    document.body.classList.toggle('show-anno', anno.checked);
    document.body.classList.toggle('show-safe', safe.checked);
  }
  anno.addEventListener('change', syncAnno);
  safe.addEventListener('change', syncAnno);
  syncAnno();

  /* ---------- ④ 占位内容生成 ---------- */
  // 网格：24 格背包 / 12 格武器栏
  function fillGrid(el, n) {
    if (!el) return;
    var html = '';
    for (var i = 0; i < n; i++) html += '<div class="cell"></div>';
    el.innerHTML = html;
  }
  fillGrid(document.getElementById('grid-weapon-art'), 12);
  fillGrid(document.getElementById('grid-backpack-art'), 24);
  fillGrid(document.getElementById('grid-weapon-bp'), 12);
  fillGrid(document.getElementById('grid-backpack-bp'), 24);

  // 角色卡 6 张（首发 6 角）
  var charGrid = document.getElementById('char-grid');
  if (charGrid) {
    var names = ['角色 1', '角色 2', '角色 3', '角色 4', '角色 5', '角色 6'];
    charGrid.innerHTML = names.map(function (n, i) {
      return '<div class="char-card' + (i === 0 ? ' sel' : '') + '">'
        + '<span class="cc-av"></span>'
        + '<span class="cc-info"><b>' + n + '</b><small>专属武器 · 主动技能 · 定位描述</small></span>'
        + '<span class="dim">920 宽 × 双列</span></div>';
    }).join('');
  }

  // 局外成长卡（局外等级 + 武器等级 两行）
  var metaList = document.getElementById('meta-list');
  if (metaList) {
    var mn = ['角色 1', '角色 2', '角色 3', '角色 4'];
    metaList.innerHTML = mn.map(function (n) {
      return '<div class="meta-card">'
        + '<span class="cc-av"></span>'
        + '<span class="meta-info"><b>' + n + '</b><small>属性描述 · 专属武器名</small></span>'
        + '<span class="meta-up">'
        + '  <span class="up-col"><span>局外等级 <b>LV 12</b></span><button class="wf btn sm">升级 · ◎ 240</button></span>'
        + '  <span class="up-col"><span>武器等级 <b>LV 8</b></span><button class="wf btn sm">升级 · ◎ 168</button></span>'
        + '</span></div>';
    }).join('');
  }

  go('S1');
})();
