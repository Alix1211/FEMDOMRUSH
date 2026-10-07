/* FEMDOM RUSH — 화면·입력·그리기 */
'use strict';
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const FONT = "'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif";
const SERIF = "'Georgia','Times New Roman',serif";
const COL = { gold: '#f1c26b', gold2: '#b8802f', cream: '#fff0cf', dark: '#2a1a16', dark2: '#4a2b22', red: '#c8302b', red2: '#7d1a1a', green: '#4fd36b', blue: '#59a8ff' };

/* ───────── 이미지 로더 ───────── */
const IMGS = {};
function img(path) {
  let e = IMGS[path];
  if (!e) { e = IMGS[path] = { im: new Image(), ok: false, err: false }; e.im.onload = () => { e.ok = true; }; e.im.onerror = () => { e.err = true; }; e.im.src = path; }
  return e.ok ? e.im : null;
}
const PART = n => img('assets/ui/parts/' + n + '.webp');
const PARTSZ = {};
let UMETA = null, MAPS = null;

/* ───────── 저장 ───────── */
const SAVE_KEY = 'femdomrush_save_v1';
let save = { stars: {}, deck: DEFAULT_DECK.slice(), unlockAll: false };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) save = Object.assign(save, s); } catch (e) { }
if (/[?&]unlock=1/.test(location.search)) save.unlockAll = true;
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
const starsOf = (w, s) => save.stars[w + '-' + s] || 0;
const stageOpen = (w, s) => save.unlockAll || (s === 1 ? (w === 1 || starsOf(w - 1, 10) > 0) : starsOf(w, s - 1) > 0);
const worldOpen = w => stageOpen(w, 1);
const worldStars = w => { let t = 0; for (let s = 1; s <= 10; s++) t += starsOf(w, s); return t; };

/* ───────── 화면 크기·좌표 ───────── */
let VS = { s: 1, ox: 0, oy: 0, dpr: 1 };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  const s = Math.min(cw / GW, ch / GH);
  VS = { s, ox: (cw - GW * s) / 2, oy: (ch - GH * s) / 2, dpr };
}
window.addEventListener('resize', resize); resize();

/* ───────── 그리기 도구 ───────── */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function text(str, x, y, o = {}) {
  ctx.font = `${o.weight || 700} ${o.size || 20}px ${o.font || FONT}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
  if (o.stroke !== false) { ctx.lineWidth = o.lw || Math.max(3, (o.size || 20) / 6); ctx.strokeStyle = o.stroke || 'rgba(30,12,8,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = o.color || COL.cream; ctx.fillText(str, x, y);
}
function part(name, x, y, w, h, a = 1) {
  const im = PART(name); if (!im) return;
  if (h == null) h = w * im.height / im.width;
  if (a !== 1) ctx.globalAlpha = a; ctx.drawImage(im, x, y, w, h); if (a !== 1) ctx.globalAlpha = 1; return h;
}
const partH = (name, w) => { const im = PART(name); return im ? w * im.height / im.width : 0; };
function cover(im, a = 1, zoom = 1, ox = 0, oy = 0) {
  if (!im) return;
  const s = Math.max(GW / im.width, GH / im.height) * zoom, w = im.width * s, h = im.height * s;
  ctx.globalAlpha = a; ctx.drawImage(im, (GW - w) / 2 + ox, (GH - h) / 2 + oy, w, h); ctx.globalAlpha = 1;
}
function panel(x, y, w, h, o = {}) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  rr(x, y, w, h, o.r || 18); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.top || '#3b251f'); g.addColorStop(1, o.bot || '#1e1210'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  rr(x, y, w, h, o.r || 18); ctx.lineWidth = 4; ctx.strokeStyle = COL.gold2; ctx.stroke();
  rr(x + 5, y + 5, w - 10, h - 10, (o.r || 18) - 4); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(241,194,107,.55)'; ctx.stroke();
}
let hits = [];
function hit(x, y, w, h, fn, id) { hits.push({ x, y, w, h, fn, id }); }
function hovered(x, y, w, h) { return ptr.x >= x && ptr.x <= x + w && ptr.y >= y && ptr.y <= y + h && !ptr.touchLike; }
function button(x, y, w, h, label, fn, o = {}) {
  const hv = hovered(x, y, w, h) && !o.disabled, kind = o.kind || 'dark';
  ctx.save();
  if (hv) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(1.04, 1.04); ctx.translate(-(x + w / 2), -(y + h / 2)); }
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  rr(x, y, w, h, h * 0.28);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (o.disabled) { g.addColorStop(0, '#5a5350'); g.addColorStop(1, '#2e2a29'); }
  else if (kind === 'primary') { g.addColorStop(0, '#e24a40'); g.addColorStop(1, '#8e1f1f'); }
  else { g.addColorStop(0, '#5a382c'); g.addColorStop(1, '#2a1913'); }
  ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3.5; ctx.strokeStyle = o.disabled ? '#756c66' : COL.gold; ctx.stroke();
  rr(x + 4, y + 4, w - 8, h - 8, h * 0.22); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,230,170,.45)'; ctx.stroke();
  text(label, x + w / 2, y + h / 2 + 1, { size: o.size || Math.round(h * 0.42), color: o.disabled ? '#a69b94' : COL.cream, lw: 4 });
  ctx.restore();
  if (!o.disabled && fn) hit(x, y, w, h, fn);
}
function drawStars(cx, cy, n, size, total = 3) {
  const im = PART('badge_star');
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * 1.05;
    if (im) { ctx.globalAlpha = i < n ? 1 : 0.28; if (i >= n) ctx.filter = 'grayscale(1)'; ctx.drawImage(im, x - size / 2, cy - size / 2, size, size * im.height / im.width); ctx.filter = 'none'; ctx.globalAlpha = 1; }
  }
}
function drawFlag(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#e8c36a'; ctx.fillRect(-1.5, -34, 3, 34);
  ctx.beginPath(); ctx.moveTo(1.5, -34); ctx.lineTo(24, -28); ctx.lineTo(1.5, -20); ctx.closePath(); ctx.fillStyle = COL.red; ctx.fill(); ctx.strokeStyle = COL.gold; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
function drawLock(x, y, s, col = '#cfc8c2') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, -3, 6.5, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = col; rr(-9, -3, 18, 14, 3); ctx.fill(); ctx.fillStyle = '#4a4440'; ctx.beginPath(); ctx.arc(0, 3.5, 2.2, 0, 7); ctx.fill();
  ctx.restore();
}
function drawSkull(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#fff0dc'; ctx.beginPath(); ctx.arc(0, -2, 11, Math.PI, 0); ctx.lineTo(8, 9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a1515'; ctx.beginPath(); ctx.arc(-4.2, -1.5, 3, 0, 7); ctx.arc(4.2, -1.5, 3, 0, 7); ctx.fill();
  ctx.fillRect(-1.2, 3, 2.4, 3.5);
  ctx.restore();
}
function arrowDiamond(x, y, dir, fn, o = {}) {
  const hv = hovered(x - 34, y - 34, 68, 68), s = 30 * (hv ? 1.1 : 1);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  rr(-s / 2, -s / 2, s, s, 5); const g = ctx.createLinearGradient(-s, -s, s, s); g.addColorStop(0, o.disabled ? '#777' : '#e24a40'); g.addColorStop(1, o.disabled ? '#444' : '#8e1f1f'); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COL.gold; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = COL.cream; ctx.beginPath();
  ctx.moveTo(dir * 7, 0); ctx.lineTo(-dir * 5, -9); ctx.lineTo(-dir * 5, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  if (!o.disabled) hit(x - 34, y - 34, 68, 68, fn);
}

/* ───────── 스프라이트 ───────── */
function drawSprite(kind, key, dir, cx, by, h, a = 1) {
  if (!UMETA) return false;
  const m = UMETA[kind][key], im = img('assets/units/' + key + '.webp');
  if (!m || !im) return false;
  let sx = 0; for (let i = 0; i < dir; i++) sx += m.w[i];
  const sw = m.w[dir], s = h / m.h, dw = sw * s;
  if (a !== 1) ctx.globalAlpha = a;
  ctx.drawImage(im, sx, 0, sw, m.h, cx - dw / 2, by - h, dw, h);
  if (a !== 1) ctx.globalAlpha = 1;
  return true;
}
/* 카드 초상화 (정면의 윗부분) */
function drawPortrait(kind, key, x, y, w, h) {
  if (!UMETA) return;
  const m = UMETA[kind][key], im = img('assets/units/' + key + '.webp'); if (!m || !im) return;
  const sw = m.w[0], sh = m.h * 0.66, s = Math.max(w / sw, h / sh) * 1.0;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(im, 0, 0, sw, sh, x + (w - sw * s) / 2, y, sw * s, sh * s); ctx.restore();
}
/* 카드 (유닛 카드 틀 + 초상화 + 비용) */
function drawCard(x, y, w, c, o = {}) {
  const frame = o.locked ? 'card_locked' : CLASSES[c.cls].frame, im = PART(frame); if (!im) return;
  const h = w * im.height / im.width;
  ctx.save();
  if (o.lift) ctx.translate(0, -10);
  if (o.glow) { ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 22; }
  ctx.drawImage(im, x, y, w, h); ctx.shadowColor = 'transparent';
  if (!o.locked) {
    drawPortrait('units', c.key, x + w * 0.13, y + h * 0.1, w * 0.74, h * 0.57);
    ctx.drawImage(im, 0, 0, im.width * 0.42, im.height * 0.3, x, y, w * 0.42, h * 0.3);   // 클래스 배지 다시 덮기
    if (c.cls === 'healer') { ctx.fillStyle = '#2f9f4a'; ctx.beginPath(); ctx.arc(x + w * 0.22, y + h * 0.13, w * 0.15, 0, 7); ctx.fill(); ctx.strokeStyle = COL.gold; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(x + w * 0.22 - w * 0.075, y + h * 0.13 - w * 0.022, w * 0.15, w * 0.044); ctx.fillRect(x + w * 0.22 - w * 0.022, y + h * 0.13 - w * 0.075, w * 0.044, w * 0.15); }
    if (o.cost != null) text(String(o.cost), x + w * 0.74, y + h * 0.83, { size: w * 0.19, lw: 4 });
    if (o.label) text(o.label, x + w * 0.5, y + h * 0.69, { size: w * 0.11, lw: 3, color: '#4a2d1c', stroke: 'rgba(255,240,210,.8)' });
    if (o.dim) { rr(x + 2, y + 2, w - 4, h - 4, 10); ctx.fillStyle = 'rgba(10,8,10,' + o.dim + ')'; ctx.fill(); }
    if (o.cdText) text(o.cdText, x + w / 2, y + h * 0.45, { size: w * 0.34, lw: 5 });
  }
  ctx.restore();
  return h;
}

/* ───────── 입력 ───────── */
const ptr = { x: -999, y: -999, down: false, touchLike: false };
function toLogical(e) { return { x: (e.clientX - VS.ox) / VS.s, y: (e.clientY - VS.oy) / VS.s }; }
canvas.addEventListener('pointermove', e => { const p = toLogical(e); ptr.x = p.x; ptr.y = p.y; ptr.touchLike = e.pointerType === 'touch'; });
canvas.addEventListener('pointerdown', e => {
  const p = toLogical(e); ptr.x = p.x; ptr.y = p.y; ptr.down = true; ptr.touchLike = e.pointerType === 'touch';
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
  if (fade.t < 1 && fade.block) return;
  for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) { h.fn(p.x, p.y); return; } }
  if (SCREEN.onBackgroundDown) SCREEN.onBackgroundDown(p.x, p.y);
});
canvas.addEventListener('pointerup', () => { ptr.down = false; if (ptr.touchLike) { ptr.x = -999; ptr.y = -999; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ───────── 화면 전환 ───────── */
let SCREEN = null;
const fade = { t: 1, to: null, block: false };
function go(screen, arg) { if (fade.to) return; fade.to = { screen, arg }; fade.t = 0; fade.block = true; }
function setScreen(s, arg) { SCREEN = s; if (s.enter) s.enter(arg); }
let toastMsg = '', toastT = 0;
function toast(m) { toastMsg = m; toastT = 1.6; }
function toggleFullscreen() {
  const root = document.documentElement, act = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (act) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }
    else { const f = root.requestFullscreen || root.webkitRequestFullscreen; if (f) f.call(root); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); }
  } catch (_) { }
}

/* ═══════════════ 로딩 화면 ═══════════════ */
const ESSENTIAL = () => ['assets/ui/title_key.webp', 'assets/worldmap/sky.webp', ...WORLDS.map(w => 'assets/worldmap/island_' + w.id + '.webp'),
  ...['logo', 'banner_top', 'banner_bottom', 'badge_star', 'btn_speed', 'btn_pause', 'btn_fullscreen', 'wave_bar', 'heart_panel', 'gem_panel', 'info_panel', 'deploy_spot', 'card_sword', 'card_shield', 'card_archer', 'card_mage', 'card_locked', 'skill_1', 'skill_2', 'skill_3', 'arrow_up', 'arrow_down', 'badge_warn', 'chest'].map(n => 'assets/ui/parts/' + n + '.webp')];
const Loading = {
  enter() { this.t = 0; this.started = false; },
  update(dt) {
    if (!this.started) {
      this.started = true;
      fetch('assets/units/units.json').then(r => r.json()).then(j => { UMETA = j; });
      fetch('assets/data/maps.json').then(r => r.json()).then(j => { MAPS = j; });
      this.list = ESSENTIAL(); this.list.forEach(img);
    }
    this.done = this.list.filter(p => IMGS[p] && IMGS[p].ok).length;
    if (this.done >= this.list.length && UMETA && MAPS) { setScreen(World, { mode: 'title' }); }
  },
  draw() {
    ctx.fillStyle = '#12131a'; ctx.fillRect(0, 0, GW, GH);
    text('FEMDOM RUSH', GW / 2, 300, { size: 54, font: SERIF, color: COL.gold });
    const p = this.list ? this.done / this.list.length : 0;
    rr(440, 370, 400, 14, 7); ctx.fillStyle = '#2a2024'; ctx.fill(); rr(440, 370, 400 * p, 14, 7); ctx.fillStyle = COL.gold; ctx.fill();
    text('불러오는 중…', GW / 2, 412, { size: 18, color: '#cbb892', stroke: false });
  },
};

/* ═══════════════ 타이틀 + 월드맵 ═══════════════ */
const World = {
  enter(a) { this.mode = a.mode; this.sel = -1; this.t = 0; this.fk = this.mode === 'title' ? 0 : 1; this.logoK = this.fk; },
  update(dt) {
    this.t += dt;
    const tg = this.mode === 'title' ? 0 : 1, step = dt / 1.3;   // 약 1.3초에 걸쳐 스르륵 교차
    this.fk += Math.max(-step, Math.min(step, tg - this.fk));
    this.logoK = this.fk * this.fk * (3 - 2 * this.fk);          // 부드러운 가감속
  },
  islandRect(w) {
    const sl = w.slot, bob = w.bob, im = img('assets/worldmap/island_' + w.id + '.webp'); if (!im) return null;
    const dy = Math.sin(this.t * 2 * Math.PI / bob[1] + bob[2]) * bob[0], dx = Math.cos(this.t * 2 * Math.PI / (bob[1] * 1.7) + bob[2]) * 2.5;
    const hv = this.mode === 'map' && (this.hoverId === w.n || this.sel === w.n - 1), k = hv ? 1.06 : 1;
    const ww = sl.w * k, hh = ww * im.height / im.width;
    return { im, x: sl.cx - ww / 2 + dx, y: sl.cy - hh / 2 + dy, w: ww, h: hh, dy };
  },
  draw() {
    const t = this.t, K = this.logoK, showMap = K > 0.02;
    // 타이틀 일러스트 (대치 장면) — 천천히 숨 쉬듯 움직임
    if (K < 0.98) {
      cover(img('assets/ui/title_key.webp'), 1, 1.05 + Math.sin(t * 0.35) * 0.012, Math.sin(t * 0.21) * 12, Math.cos(t * 0.17) * 6);
      const bg = ctx.createLinearGradient(0, GH - 190, 0, GH); bg.addColorStop(0, 'rgba(10,6,8,0)'); bg.addColorStop(1, 'rgba(10,6,8,.62)');
      ctx.fillStyle = bg; ctx.fillRect(0, GH - 190, GW, 190);
      const vg = ctx.createRadialGradient(GW / 2, GH / 2, GH * 0.45, GW / 2, GH / 2, GW * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, GW, GH);
    }
    if (showMap) { cover(img('assets/worldmap/sky.webp'), K, 1.05, Math.sin(t * 0.07) * 14, Math.cos(t * 0.05) * 5); ctx.globalAlpha = K; }
    // 구름 느낌의 옅은 빛
    if (showMap) { const gl = ctx.createLinearGradient(0, 0, 0, GH); gl.addColorStop(0, 'rgba(255,255,255,.06)'); gl.addColorStop(1, 'rgba(20,50,110,.12)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, GW, GH); }
    // 섬 사이 점선 길
    ctx.save(); ctx.fillStyle = 'rgba(255,244,200,.9)';
    for (let i = 0; showMap && i < 6; i++) {
      const a = WORLDS[i].slot, b = WORLDS[i + 1].slot;
      for (let k = 1; k < 9; k++) { const u = k / 9; const x = a.cx + (b.cx - a.cx) * u, y = a.cy + (b.cy - a.cy) * u - Math.sin(u * Math.PI) * 30; ctx.beginPath(); ctx.arc(x, y + 60, 2.6 + Math.sin(t * 3 + k + i) * 0.7, 0, 7); ctx.fill(); }
    }
    ctx.restore();
    // 섬
    this.hoverId = 0; const order = showMap ? WORLDS.slice().sort((a, b) => a.slot.cy - b.slot.cy) : [];
    for (const w of order) {
      const r = this.islandRect(w); if (!r) continue;
      const open = worldOpen(w.n);
      ctx.save();
      ctx.shadowColor = 'rgba(40,70,130,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 18;
      if (this.mode === 'map' && (this.hoverId === w.n || this.sel === w.n - 1) && open) { ctx.shadowColor = 'rgba(255,230,140,.95)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 0; }
      if (!open && this.mode === 'map') ctx.filter = 'grayscale(.75) brightness(.75)';
      ctx.drawImage(r.im, r.x, r.y, r.w, r.h); ctx.restore();
      // 번호표
      const px = w.slot.cx, py = w.slot.cy + r.h * 0.5 + r.dy * 0.6 - 18;
      const nm = w.name, tw = 32 + nm.length * 22, pw = tw + 46;
      ctx.save(); rr(px - pw / 2, py - 17, pw, 34, 17); ctx.fillStyle = 'rgba(38,22,17,.92)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.gold2; ctx.stroke();
      ctx.beginPath(); ctx.arc(px - pw / 2 + 17, py, 15, 0, 7); ctx.fillStyle = COL.red; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.gold; ctx.stroke(); ctx.restore();
      text(String(w.n), px - pw / 2 + 17, py + 1, { size: 18, lw: 3 }); text(nm, px + 10, py + 1, { size: 19, lw: 3 });
      if (this.mode === 'map') {
        const hx = r.x + r.w * 0.04, hy = r.y + r.h * 0.12, hw = r.w * 0.92, hh = r.h * 0.8;
        hit(hx, hy, hw, hh, () => {
          if (!open) { toast('이전 월드를 먼저 클리어하세요'); this.sel = w.n - 1; return; }
          if (ptr.touchLike && this.sel !== w.n - 1) { this.sel = w.n - 1; return; }
          go(Stage, { world: w.n });
        });
        if (hovered(hx, hy, hw, hh)) this.hoverId = w.n;
      }
    }
    ctx.globalAlpha = 1;
    // 호버/선택 라벨
    if (this.mode === 'map') {
      const id = this.hoverId || (this.sel >= 0 ? this.sel + 1 : 0);
      if (id) {
        const w = WORLDS[id - 1], r = this.islandRect(w), open = worldOpen(id);
        const lw = 330, lh = 108; let lx = w.slot.cx - lw / 2, ly = r.y - 20; lx = Math.max(14, Math.min(GW - lw - 14, lx)); if (ly < 14) ly = r.y + r.h * 0.45;
        panel(lx, ly, lw, lh, { r: 16 });
        text(id + '. ' + w.name, lx + lw / 2, ly + 30, { size: 30, color: COL.gold });
        text(open ? '스테이지 ' + id + '-1 ~ ' + id + '-10' : '잠김 · 이전 월드를 클리어하세요', lx + lw / 2, ly + 62, { size: 18, weight: 600 });
        if (open) text('★ ' + worldStars(id) + ' / 30', lx + lw / 2, ly + 88, { size: 16, color: '#ffd978', stroke: false });
      }
    }
    // 로고 / 버튼
    const k = this.logoK, lw = 500 - 210 * k, lx = GW / 2 - lw / 2 - (GW / 2 - lw / 2 - 18) * k, ly = 6 + 4 * k;
    part('logo', lx, ly, lw);
    if (this.mode === 'title') {
      const by = 616, a = 1 - k;
      ctx.globalAlpha = a;
      button(318, by + 8, 170, 62, '도감', () => this.openCollection(), { size: 24 });
      button(500, by - 6, 280, 86, '시작', () => { this.mode = 'map'; this.sel = -1; }, { kind: 'primary', size: 40 });
      button(792, by + 8, 170, 62, '설정', () => this.openSettings(), { size: 24 });
      button(974, by + 8, 170, 62, '전체화면', toggleFullscreen, { size: 22 });
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = k;
      const hw = 360, hx = GW / 2 - hw / 2 + 120;
      text('모험할 섬을 선택하세요', hx + hw / 2 - 120, 40, { size: 26, color: COL.gold });
      button(22, 640, 150, 54, '← 타이틀', () => { this.mode = 'title'; }, { size: 20 });
      button(GW - 172, 640, 150, 54, '전체화면', toggleFullscreen, { size: 20 });
      ctx.globalAlpha = 1;
    }
    drawModal();
  },
  onBackgroundDown() { if (this.mode === 'map') this.sel = -1; },
  openSettings() { modal = { type: 'settings' }; },
  openCollection() { modal = { type: 'collection', tab: 'units', sel: 0 }; },
};

/* ═══════════════ 월드별 스테이지 화면 ═══════════════ */
const Stage = {
  enter(a) { this.w = a.world; this.t = 0; this.prep = null; },
  update(dt) { this.t += dt; },
  draw() {
    const w = WORLDS[this.w - 1], nodes = NODES['w' + this.w], t = this.t;
    cover(img('assets/stage/stage_' + w.id + '.webp'));
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, GW, GH);
    // 길
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = nodes[i], b = nodes[i + 1], done = starsOf(this.w, i + 1) > 0;
      ctx.setLineDash(done ? [] : [10, 12]); ctx.lineWidth = done ? 6 : 5;
      ctx.strokeStyle = 'rgba(40,20,10,.55)'; ctx.beginPath(); ctx.moveTo(a[0], a[1] + 2); ctx.lineTo(b[0], b[1] + 2); ctx.stroke();
      ctx.strokeStyle = done ? '#ffd978' : 'rgba(255,248,226,.95)'; ctx.lineWidth = done ? 4 : 3.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();
    // 노드
    for (let i = 0; i < 10; i++) this.drawNode(this.w, i + 1, nodes[i], t);
    // 상단
    const bw = 400, bh = partH('banner_top', bw);
    part('banner_top', GW / 2 - bw / 2, -6, bw);
    text(this.w + '. ' + w.name, GW / 2, bh * 0.43, { size: 32, color: '#5b2a14', stroke: 'rgba(255,238,200,.9)', lw: 5, font: SERIF });
    text('월드 ' + this.w + ' / 7  ·  ★ ' + worldStars(this.w) + ' / 30', GW / 2, bh * 0.43 + 34, { size: 15, color: '#6b4a2a', stroke: false });
    arrowDiamond(GW / 2 - bw / 2 - 28, 70, -1, () => this.step(-1), { disabled: this.w <= 1 });
    arrowDiamond(GW / 2 + bw / 2 + 28, 70, 1, () => this.step(1), { disabled: this.w >= 7 });
    button(22, 22, 150, 54, '← 월드맵', () => go(World, { mode: 'map' }), { size: 20 });
    button(GW - 172, 22, 150, 54, '전체화면', toggleFullscreen, { size: 20 });
    if (this.prep) drawPrep(this.prep);
    drawModal();
  },
  step(d) { const n = this.w + d; if (n < 1 || n > 7) return; go(Stage, { world: n }); },
  drawNode(wn, s, p, t) {
    const open = stageOpen(wn, s), stars = starsOf(wn, s), boss = s === 10, cur = open && stars === 0;
    const r = boss ? 36 : 28, x = p[0], y = p[1];
    if (cur) { const pr = (Math.sin(t * 4) + 1) / 2; ctx.save(); ctx.beginPath(); ctx.arc(x, y, r + 8 + pr * 8, 0, 7); ctx.fillStyle = 'rgba(255,224,120,' + (0.28 - pr * 0.18) + ')'; ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    const g = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, r);
    if (!open) { g.addColorStop(0, '#8a8480'); g.addColorStop(1, '#3c3835'); }
    else if (boss) { g.addColorStop(0, '#d9352e'); g.addColorStop(1, '#5e0f12'); }
    else { g.addColorStop(0, '#6a4033'); g.addColorStop(1, '#2d1b16'); }
    ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4; ctx.strokeStyle = !open ? '#9a928c' : stars ? '#ffe27a' : COL.gold2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r - 5, 0, 7); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,225,160,.5)'; ctx.stroke(); ctx.restore();
    if (!open) drawLock(x, y - 1, 1.2);
    else if (boss) drawSkull(x, y - 1, 1.5);
    else text(String(s), x, y + 1, { size: 24, font: SERIF, lw: 4 });
    // 번호표
    const lab = wn + '-' + s, lw2 = 52;
    ctx.save(); rr(x - lw2 / 2, y + r + 3, lw2, 22, 8); ctx.fillStyle = open ? 'rgba(130,24,26,.95)' : 'rgba(70,66,64,.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = open ? COL.gold : '#8b837d'; ctx.stroke(); ctx.restore();
    text(lab, x, y + r + 14.5, { size: 14, lw: 3 });
    if (stars) drawStars(x, y - r - 14, stars, 20);
    if (cur) drawFlag(x, y - r + 2, 0.95);
    hit(x - r - 6, y - r - 6, (r + 6) * 2, (r + 34), () => {
      if (!open) { toast('이전 스테이지를 먼저 클리어하세요'); return; }
      this.prep = { world: wn, s, stage: stageOf(wn, s) }; PrepUI.reset(this.prep);
    });
  },
};

/* ═══════════════ 스테이지 정보 / 출격 준비 ═══════════════ */
const TYPE_LABEL = { grunt: '보병', fast: '돌격', heavy: '중장', ranged: '원거리', boss: '보스' };
const PrepUI = {
  reset(p) { p.deck = save.deck.filter(k => ROSTER.some(r => r.key === k)).slice(0, 6); if (!p.deck.length) p.deck = DEFAULT_DECK.slice(); },
};
function drawPrep(p) {
  ctx.fillStyle = 'rgba(8,6,10,.62)'; ctx.fillRect(0, 0, GW, GH);
  hit(0, 0, GW, GH, () => { });                                    // 바깥 클릭 방지
  const px = 130, py = 38, pw = 1020, ph = 644, st = p.stage, w = WORLDS[p.world - 1];
  panel(px, py, pw, ph, { r: 22 });
  hit(px, py, pw, ph, () => { });
  text('스테이지 ' + st.id, px + 36, py + 46, { size: 38, align: 'left', color: COL.gold, font: SERIF });
  text(w.name + '  ·  ' + (st.boss ? '보스전' : st.mid ? '중간 보스' : '일반 전투'), px + 36, py + 88, { size: 18, align: 'left', weight: 600, color: '#d8c49a', stroke: false });
  text('목표', px + 36, py + 128, { size: 16, align: 'left', color: COL.gold, stroke: false });
  text(st.objective, px + 82, py + 128, { size: 18, align: 'left', weight: 600, stroke: false });
  // 요약
  const info = [['웨이브', st.waves.length], ['생명', st.lives], ['보상', '★ 최대 3']];
  info.forEach((it, i) => { const x = px + 560 + i * 150; text(String(it[1]), x + 62, py + 52, { size: 30, font: SERIF, color: '#fff2c8' }); text(it[0], x + 62, py + 86, { size: 15, weight: 600, color: '#cbb892', stroke: false }); });
  const bs = starsOf(p.world, st.no); drawStars(px + pw - 100, py + 130, bs, 26);
  // 적 미리보기
  text('출현하는 적', px + 36, py + 168, { size: 16, align: 'left', color: COL.gold, stroke: false });
  const seen = []; st.waves.forEach(wv => wv.forEach(g => { if (!seen.find(s => s.sprite === g.sprite)) seen.push(g); }));
  seen.slice(0, 7).forEach((g, i) => {
    const x = px + 36 + i * 100, y = py + 180;
    rr(x, y, 90, 104, 12); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = g.type === 'boss' ? '#d9453b' : 'rgba(214,170,90,.6)'; ctx.stroke();
    drawPortrait('enemies', g.sprite, x + 5, y + 5, 80, 74);
    text(TYPE_LABEL[g.type], x + 45, y + 92, { size: 14, color: g.type === 'boss' ? '#ff9a8a' : COL.cream, lw: 3 });
  });
  // 덱
  text('출격 덱 (' + p.deck.length + ' / 6)  —  카드를 눌러 빼거나 넣을 수 있습니다', px + 36, py + 310, { size: 16, align: 'left', color: COL.gold, stroke: false });
  for (let i = 0; i < 6; i++) {
    const x = px + 36 + i * 96, y = py + 322, cw = 80, k = p.deck[i];
    if (k) { const r = ROSTER.find(q => q.key === k); const h = drawCard(x, y, cw, r, { cost: CLASSES[r.cls].cost, label: r.label }); hit(x, y, cw, h, () => { p.deck.splice(i, 1); }); }
    else drawCard(x, y, cw, {}, { locked: true });
  }
  // 대기 명단 (아군 23명)
  text('아군 명단 (' + ROSTER.length + '명)', px + 36, py + 452, { size: 16, align: 'left', color: COL.gold, stroke: false });
  const cw = 56;
  ROSTER.forEach((r, i) => {
    const row = i < 12 ? 0 : 1, col = i < 12 ? i : i - 12, x = px + 36 + col * 78, y = py + 474 + row * 84, inDeck = p.deck.includes(r.key);
    const h = drawCard(x, y, cw, r, { cost: CLASSES[r.cls].cost, dim: inDeck ? 0.55 : 0, lift: false });
    hit(x, y, cw, h, () => {
      if (inDeck) p.deck.splice(p.deck.indexOf(r.key), 1);
      else if (p.deck.length < 6) p.deck.push(r.key);
      else toast('덱은 6명까지입니다');
    });
  });
  button(px + 690, py + 428, 300, 48, '취소', () => { Stage.prep = null; }, { size: 20 });
  button(px + 690, py + 330, 300, 84, '출격 ▶', () => {
    if (!p.deck.length) { toast('출격할 유닛을 선택하세요'); return; }
    save.deck = p.deck.slice(); persist(); go(BattleScreen, { stage: st, deck: p.deck.slice() });
  }, { kind: 'primary', size: 34, disabled: !p.deck.length });
}

/* ═══════════════ 모달 (설정 / 도감) ═══════════════ */
let modal = null;
function drawModal() {
  if (!modal) return;
  ctx.fillStyle = 'rgba(6,5,10,.68)'; ctx.fillRect(0, 0, GW, GH); hit(0, 0, GW, GH, () => { });
  if (modal.type === 'settings') {
    const x = 400, y = 170, w = 480, h = 380; panel(x, y, w, h); hit(x, y, w, h, () => { });
    text('설정', x + w / 2, y + 48, { size: 34, color: COL.gold, font: SERIF });
    button(x + 40, y + 98, w - 80, 58, '전체 해금(테스트): ' + (save.unlockAll ? '켜짐' : '꺼짐'), () => { save.unlockAll = !save.unlockAll; persist(); }, { size: 20 });
    button(x + 40, y + 172, w - 80, 58, '진행 상황 초기화', () => { modal = { type: 'confirm', msg: '별과 진행 기록이 모두 지워집니다.', ok: () => { save.stars = {}; persist(); modal = null; toast('초기화했습니다'); } }; }, { size: 20 });
    button(x + w / 2 - 80, y + h - 84, 160, 54, '닫기', () => { modal = null; }, { size: 22, kind: 'primary' });
  } else if (modal.type === 'confirm') {
    const x = 410, y = 250, w = 460, h = 230; panel(x, y, w, h); hit(x, y, w, h, () => { });
    text('정말 진행할까요?', x + w / 2, y + 52, { size: 28, color: COL.gold }); text(modal.msg, x + w / 2, y + 100, { size: 18, weight: 600 });
    button(x + 40, y + 140, 170, 54, '취소', () => { modal = { type: 'settings' }; }, { size: 20 });
    button(x + w - 210, y + 140, 170, 54, '확인', modal.ok, { size: 20, kind: 'primary' });
  } else if (modal.type === 'collection') {
    const x = 70, y = 28, w = 1140, h = 664; panel(x, y, w, h); hit(x, y, w, h, () => { });
    text('도감', x + 60, y + 40, { size: 32, color: COL.gold, font: SERIF });
    button(x + 140, y + 14, 120, 44, '아군 23', () => { modal.tab = 'units'; modal.sel = 0; }, { size: 18, kind: modal.tab === 'units' ? 'primary' : 'dark' });
    button(x + 270, y + 14, 120, 44, '적 34', () => { modal.tab = 'enemies'; modal.sel = 0; }, { size: 18, kind: modal.tab === 'enemies' ? 'primary' : 'dark' });
    button(x + w - 130, y + 14, 100, 44, '닫기', () => { modal = null; }, { size: 18 });
    const keys = modal.tab === 'units' ? ROSTER.map(r => r.key) : Object.keys(UMETA.enemies).sort();
    const cols = 12, cw = 72, ch = 78;
    keys.forEach((k, i) => {
      const cx = x + 30 + (i % cols) * 90, cy = y + 76 + Math.floor(i / cols) * 88, on = modal.sel === i;
      rr(cx, cy, cw + 8, ch + 4, 10); ctx.fillStyle = on ? 'rgba(255,214,120,.28)' : 'rgba(0,0,0,.3)'; ctx.fill(); ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? COL.gold : 'rgba(214,170,90,.4)'; ctx.stroke();
      drawPortrait(modal.tab, k, cx + 4, cy + 4, cw, ch - 6); text(k.slice(1), cx + 14, cy + ch - 8, { size: 13, lw: 3 });
      hit(cx, cy, cw + 8, ch + 4, () => { modal.sel = i; });
    });
    const sk = keys[modal.sel], by = y + 76 + Math.ceil(keys.length / cols) * 88 + 6;
    if (sk) {
      const m = UMETA[modal.tab][sk]; let ox = x + 60;
      for (let d = 0; d < 4; d++) { const dw = m.w[d] * 250 / m.h; drawSprite(modal.tab, sk, d, ox + dw / 2, by + 250, 250); ox += dw + 20; }
      text(['정면', '뒷면', '왼쪽', '오른쪽'].join('   '), x + w / 2, by + 270, { size: 14, color: '#cbb892', stroke: false });
      if (modal.tab === 'units') { const r = ROSTER.find(q => q.key === sk), c = CLASSES[r.cls]; text(r.label + '  ·  ' + c.name + ' (임시)  ·  비용 ' + c.cost, x + w - 40, y + 100 + 0, { align: 'right', size: 18, color: COL.gold, stroke: false }); }
    }
  }
}

/* ═══════════════ 전투 화면 (준비 중) ═══════════════ */
const BattleScreen = {
  enter(a) { this.a = a; },
  update() { },
  draw() {
    cover(img('assets/battle/battle_' + this.a.stage.map + '.webp'));
    ctx.fillStyle = 'rgba(8,6,10,.55)'; ctx.fillRect(0, 0, GW, GH);
    text('전투 화면은 준비 중입니다', GW / 2, 320, { size: 40, color: COL.gold, font: SERIF });
    text('스테이지 ' + this.a.stage.id + ' · 덱 ' + this.a.deck.length + '명 선택됨', GW / 2, 376, { size: 20, weight: 600 });
    button(GW / 2 - 110, 430, 220, 60, '돌아가기', () => go(Stage, { world: this.a.stage.world }), { size: 24, kind: 'primary' });
  },
};

/* ═══════════════ 메인 루프 ═══════════════ */
setScreen(Loading);
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(VS.dpr * VS.s, 0, 0, VS.dpr * VS.s, VS.dpr * VS.ox, VS.dpr * VS.oy);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, GW, GH); ctx.clip();
  hits = [];
  if (SCREEN.update) SCREEN.update(dt);
  SCREEN.draw();
  if (toastT > 0) { toastT -= dt; const a = Math.min(1, toastT * 3); ctx.globalAlpha = a; panel(GW / 2 - 230, 560, 460, 54, { r: 14 }); text(toastMsg, GW / 2, 588, { size: 20 }); ctx.globalAlpha = 1; }
  if (fade.to) {
    fade.t += dt * 3.2;
    if (fade.t >= 0.5 && fade.to.screen) { const n = fade.to; fade.to = { screen: null }; setScreen(n.screen, n.arg); }
    if (fade.t >= 1) { fade.to = null; fade.t = 1; fade.block = false; }
    else { ctx.fillStyle = 'rgba(8,6,10,' + (1 - Math.abs(fade.t * 2 - 1)) + ')'; ctx.fillRect(0, 0, GW, GH); }
  }
  ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
