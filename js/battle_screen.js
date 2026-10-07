/* FEMDOM RUSH — 전투 화면 (HUD · 조작 · 연출)
   전투 규칙은 js/battle.js, 이 파일은 그리기와 입력만 담당합니다. */
'use strict';

const BS_FOOT = 12;                                  // 스프라이트 발끝이 좌표보다 아래로 내려오는 값
const BS_UP = [['hp', '체력'], ['atk', '공격'], ['def', '방어']];
const BS_DIRNAME = ['아래', '위', '왼쪽', '오른쪽'];

/* 부채꼴(사거리) 그리기: 바라보는 방향 기준 앞쪽 + 약간의 뒤쪽 */
function bsSector(x, y, r, dir, full, fill, stroke) {
  ctx.beginPath();
  if (full) ctx.arc(x, y, r, 0, Math.PI * 2);
  else {
    const a0 = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][dir], half = Math.acos(-0.25);
    ctx.moveTo(x, y); ctx.arc(x, y, r, a0 - half, a0 + half); ctx.closePath();
  }
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.setLineDash([9, 6]); ctx.stroke(); ctx.setLineDash([]);
}
function bsBar(x, y, w, h, ratio, col, bg) {
  ratio = Math.max(0, Math.min(1, ratio));
  rr(x, y, w, h, h / 2); ctx.fillStyle = bg || 'rgba(14,8,8,.78)'; ctx.fill();
  if (ratio > 0) { rr(x, y, Math.max(h, w * ratio), h, h / 2); ctx.fillStyle = col; ctx.fill(); }
  rr(x, y, w, h, h / 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,230,170,.55)'; ctx.stroke();
}
const bsFmtTime = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

const BattleScreen = {
  /* ───────── 시작 ───────── */
  enter(a) {
    this.a = a;
    const st = a.stage, mi = MAPS && MAPS[st.map];
    this.b = new Battle(st, a.deck, mi);
    this.roster = a.deck.map(k => ROSTER.find(r => r.key === k));
    this.bg = 'assets/battle/battle_' + st.map + '.webp'; img(this.bg);
    this.t = 0; this.speed = 1; this.paused = false;
    this.selCard = -1; this.selUnit = null; this.place = null;
    this.banners = []; this.lastWave = -1; this.waveQ0 = 1;
    this.endT = -1; this.saved = false; this.newStars = 0; this.prevStars = starsOf(st.world, st.no);
    this.intro = 2.1;
    this.banners.push({ t: 0, dur: 2.1, kind: 'intro', text: '스테이지 ' + st.id, sub: st.objective });
    // 입구에서 가장 가까운 길 지점 (방향 기본값 계산용)
    this.pts = this.b.pts;
  },

  /* ───────── 진행 ───────── */
  update(dt) {
    const b = this.b; this.t += dt;
    for (const bn of this.banners) bn.t += dt;
    this.banners = this.banners.filter(bn => bn.t < bn.dur);
    if (this.intro > 0) { this.intro -= dt; return; }
    if (b.result) {
      b.update(dt);
      if (this.endT < 0) this.onEnd();
      this.endT += dt; return;
    }
    if (this.paused) return;
    let rem = dt * this.speed;
    while (rem > 0 && !b.result) { const d = Math.min(rem, 1 / 30); b.update(d); rem -= d; }
    if (b.waveIdx !== this.lastWave) {
      this.lastWave = b.waveIdx;
      if (b.waveIdx >= 0) {
        this.waveQ0 = Math.max(1, b.spawnQ.length);
        const boss = b.stage.waves[b.waveIdx].some(g => g.type === 'boss' && !g.mini), mini = b.stage.waves[b.waveIdx].some(g => g.mini);
        this.banners.push(boss ? { t: 0, dur: 2.4, kind: 'boss', text: '보스 출현!', sub: 'WAVE ' + (b.waveIdx + 1) + ' / ' + b.waveTotal }
          : { t: 0, dur: 1.6, kind: 'wave', text: 'WAVE ' + (b.waveIdx + 1) + ' / ' + b.waveTotal, sub: mini ? '중간 보스가 나타났습니다' : '' });
      }
    }
    if (this.selUnit && !b.units.includes(this.selUnit)) this.selUnit = null;
    if (this.place && b.spots[this.place.si].unit) this.place = null;
    if (this.selCard >= 0 && b.cards[this.selCard].unit) { this.selCard = -1; this.place = null; }
  },
  onEnd() {
    const b = this.b, st = b.stage; this.endT = 0;
    if (b.result.win && !this.saved) {
      this.saved = true; const old = starsOf(st.world, st.no);
      this.newStars = b.result.stars;
      if (b.result.stars > old) { save.stars[st.id] = b.result.stars; persist(); }
    }
    this.selCard = -1; this.selUnit = null; this.place = null;
  },

  /* ───────── 조작 ───────── */
  clickCard(i) {
    const b = this.b, c = b.cards[i];
    if (c.unit) { this.selUnit = c.unit; this.selCard = -1; this.place = null; return; }
    if (this.selCard === i) { this.selCard = -1; this.place = null; return; }
    if (c.cd > 0) { toast('재배치 대기 중입니다 (' + Math.ceil(c.cd) + '초)'); return; }
    if (b.dp < c.cost) { toast('DP가 부족합니다'); return; }
    this.selCard = i; this.selUnit = null; this.place = null;
  },
  pickUnit(u) { this.selUnit = u; this.selCard = -1; this.place = null; },
  pickSpot(si) {
    if (this.selCard < 0) return;
    const sp = this.b.spots[si]; if (sp.unit) return;
    this.place = { si, dir: this.defaultDir(sp) };
  },
  defaultDir(sp) {
    let bd = 1e9, bp = null;
    for (const p of this.pts) { const d = Math.hypot(p.x - sp.x, p.y - sp.y); if (d < bd) { bd = d; bp = p; } }
    if (!bp) return 3;
    const dx = bp.x - sp.x, dy = bp.y - sp.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
  },
  doDeploy(dir) {
    const b = this.b, p = this.place; if (!p) return;
    const u = b.deploy(this.selCard, p.si, dir);
    if (!u) { toast('지금은 배치할 수 없습니다'); this.place = null; return; }
    this.selUnit = u; this.selCard = -1; this.place = null;
  },
  onBackgroundDown() {
    if (this.paused || this.b.result || this.intro > 0) return;
    if (this.place) this.place = null; else if (this.selCard >= 0) this.selCard = -1; else this.selUnit = null;
  },
  togglePause() { if (this.b.result || this.intro > 0) return; this.paused = !this.paused; },
  restart() { this.enter(this.a); },
  toWorld() { go(Stage, { world: this.a.stage.world }); },

  /* ═════════════ 그리기 ═════════════ */
  draw() {
    const b = this.b;
    ctx.save();
    if (b.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * b.shake, (Math.random() - 0.5) * 14 * b.shake);
    cover(img(this.bg));
    this.drawMarkers(); this.drawSpots(); this.drawRanges(); this.drawEntities(); this.drawFx();
    ctx.restore();
    if (b.shake > 0) { ctx.fillStyle = 'rgba(200,30,30,' + Math.min(0.28, b.shake * 0.7) + ')'; ctx.fillRect(0, 0, GW, GH); }
    this.drawHud();
    this.drawPlaceUI();
    this.drawBanners();
    if (this.paused) this.drawPause();
    if (b.result && this.endT > 0.9) this.drawResult();
  },

  /* 입구 / 방어선 표시 */
  drawMarkers() {
    const p0 = this.pts[0], pe = this.pts[this.pts.length - 1], t = this.t;
    ctx.save();
    const k = (t * 0.9) % 1;
    ctx.strokeStyle = 'rgba(255,90,70,' + (0.8 - k * 0.8) + ')'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(p0.x, p0.y + 6, 18 + k * 30, 8 + k * 14, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,90,.9)'; ctx.beginPath(); ctx.ellipse(p0.x, p0.y + 6, 12, 5, 0, 0, 7); ctx.fill();
    text('적 입구', p0.x, p0.y - 18, { size: 15, color: '#ffd0c4' });
    ctx.translate(pe.x, pe.y + 6);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 22, 8, 0, 0, 7); ctx.fill();
    ctx.shadowColor = 'rgba(255,220,120,.9)'; ctx.shadowBlur = 16; drawFlag(0, 0, 1.5); ctx.shadowBlur = 0;
    text('방어선', 0, -62, { size: 15, color: COL.gold });
    ctx.restore();
  },

  /* 배치 위치 */
  drawSpots() {
    const b = this.b, active = this.selCard >= 0;
    b.spots.forEach((sp, i) => {
      if (sp.unit) return;
      const hv = active && hovered(sp.x - 46, sp.y - 30, 92, 54), isPl = this.place && this.place.si === i;
      const pulse = active ? 0.78 + Math.sin(this.t * 5 + i) * 0.2 : 0.5;
      const w = 92 * (hv || isPl ? 1.1 : 1);
      part('deploy_spot', sp.x - w / 2, sp.y - w * 0.25, w, w * 0.5, Math.min(1, isPl ? 1 : pulse + (hv ? 0.2 : 0)));
      if (active) hit(sp.x - 46, sp.y - 30, 92, 54, () => this.pickSpot(i));
    });
  },

  /* 사거리 미리보기 */
  drawRanges() {
    const b = this.b;
    if (this.selUnit) {
      const u = this.selUnit, cl = CLASSES[u.cls];
      bsSector(u.x, u.y, u.range, u.dir, !!cl.heal, 'rgba(255,224,140,.14)', 'rgba(255,224,140,.85)');
    }
    if (this.place) {
      const c = b.cards[this.selCard], cl = CLASSES[c.cls], sp = b.spots[this.place.si];
      const dir = this.hoverDir != null ? this.hoverDir : this.place.dir;
      bsSector(sp.x, sp.y, cl.range, dir, !!cl.heal, 'rgba(120,200,255,.16)', 'rgba(150,215,255,.9)');
      ctx.globalAlpha = 0.62; drawSprite('units', c.key, dir, sp.x, sp.y + BS_FOOT, 106); ctx.globalAlpha = 1;
    }
  },

  drawEntities() {
    const b = this.b, list = [];
    for (const u of b.units) list.push({ y: u.y, u });
    for (const e of b.enemies) list.push({ y: e.y, e });
    list.sort((p, q) => p.y - q.y);
    for (const it of list) { if (it.u) this.drawUnit(it.u); else this.drawEnemy(it.e); }
  },
  drawUnit(u) {
    const b = this.b, h = 106, t = this.t, sel = this.selUnit === u, ready = u.sp >= u.spMax;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(u.x, u.y + 10, 34, 12, 0, 0, 7); ctx.fill();
    if (sel || ready || u.guard > 0) {
      const col = sel ? '255,226,120' : u.guard > 0 ? '120,200,255' : '255,200,80';
      const a = sel ? 0.95 : 0.5 + Math.sin(t * 6) * 0.3;
      ctx.strokeStyle = 'rgba(' + col + ',' + a + ')'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(u.x, u.y + 10, 42, 16, 0, 0, 7); ctx.stroke();
    }
    let ox = 0, oy = 0;
    if (u.atkAnim > 0) { const k = u.atkAnim / 0.25, f = DIRV[u.dir]; ox = f[0] * 11 * k; oy = f[1] * 7 * k; }
    const born = Math.min(1, (b.time - u.born) / 0.28), br = 1 + Math.sin(t * 2.4 + u.id) * 0.012;
    ctx.translate(u.x + ox, u.y + BS_FOOT + oy - (1 - born) * 36); ctx.scale(1 / br, br); ctx.globalAlpha = born;
    if (u.flash > 0) ctx.filter = 'brightness(1.9) saturate(.5)';
    drawSprite('units', u.key, u.dir, 0, 0, h);
    ctx.restore();
    const bx = u.x - 28, by = u.y + BS_FOOT - h - 10;
    bsBar(bx, by, 56, 7, u.hp / u.maxhp, u.hp / u.maxhp > 0.35 ? '#5fe27a' : '#f0583f');
    if (CLASSES[u.cls].skill) bsBar(bx, by + 9, 56, 5, u.sp / u.spMax, ready ? '#ffd45a' : '#59a8ff');
    if (u.blocking.length) { text(u.blocking.length + '/' + u.block, u.x, u.y + 30, { size: 14, color: '#ffe9b0', lw: 4 }); }
    hit(u.x - 34, u.y - 96, 68, 116, () => this.pickUnit(u));
  },
  drawEnemy(e) {
    const t = this.t, h = e.size, moving = !e.blockedBy, ph = t * (3.5 + e.spd / 18) + e.id;
    const bob = moving ? Math.abs(Math.sin(ph)) * 5 : 0, tilt = moving ? Math.sin(ph) * 0.04 : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 10, h * 0.34, h * 0.11, 0, 0, 7); ctx.fill();
    let ox = 0, oy = 0;
    if (e.atkAnim > 0) { const k = e.atkAnim / 0.25, f = DIRV[e.dir]; ox = f[0] * 10 * k; oy = f[1] * 6 * k; }
    ctx.translate(e.x + ox, e.y + BS_FOOT + oy - bob); ctx.rotate(tilt);
    if (e.flash > 0) ctx.filter = 'brightness(2) saturate(.4)';
    drawSprite('enemies', e.sprite, e.dir, 0, 0, h);
    ctx.restore();
    if (e.hp < e.maxhp || e.type === 'boss') {
      const w = e.type === 'boss' ? 84 : 46, by = e.y + BS_FOOT - h - 8 - bob;
      bsBar(e.x - w / 2, by, w, e.type === 'boss' ? 9 : 6, e.hp / e.maxhp, '#e64b4b');
      if (e.type === 'boss') drawSkull(e.x - w / 2 - 12, by + 4, 0.8);
    }
  },

  drawFx() {
    for (const f of this.b.fx) {
      const k = f.t / f.dur, a = 1 - k;
      ctx.save();
      if (f.type === 'spawn') {
        ctx.strokeStyle = 'rgba(255,226,130,' + a + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, f.y + 10, 20 + k * 46, 8 + k * 18, 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 5; i++) { const an = i * 1.26 + k * 2; ctx.fillStyle = 'rgba(255,240,170,' + a + ')'; ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * (16 + k * 34), f.y - k * 50 + Math.sin(an) * 8, 3, 0, 7); ctx.fill(); }
      } else if (f.type === 'poof') {
        for (let i = 0; i < 4; i++) { const an = i * 1.57 + 0.6; ctx.fillStyle = 'rgba(255,248,235,' + a * 0.8 + ')'; ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * k * 28, f.y + Math.sin(an) * k * 18 - k * 14, 7 + k * 9, 0, 7); ctx.fill(); }
      } else if (f.type === 'heal') {
        ctx.fillStyle = 'rgba(110,255,150,' + a + ')'; ctx.strokeStyle = 'rgba(20,90,40,' + a + ')'; ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) { const x = f.x + i * 17, y = f.y - 20 - k * 52 - Math.abs(i) * 8; ctx.beginPath(); ctx.rect(x - 2.5, y - 8, 5, 16); ctx.rect(x - 8, y - 2.5, 16, 5); ctx.fill(); }
      } else if (f.type === 'up') {
        ctx.fillStyle = 'rgba(255,226,110,' + a + ')';
        for (let i = -1; i <= 1; i++) { const x = f.x + i * 20, y = f.y - k * 56 - Math.abs(i) * 10; ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 8, y + 3); ctx.lineTo(x - 8, y + 3); ctx.closePath(); ctx.fill(); }
      } else if (f.type === 'ring') {
        const r = f.r * (0.25 + 0.75 * Math.min(1, k * 1.6));
        ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.lineWidth = 5; ctx.fillStyle = f.c;
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 8, r, r * 0.62, 0, 0, 7); ctx.globalAlpha = a * 0.22; ctx.fill(); ctx.globalAlpha = a; ctx.stroke();
      } else if (f.type === 'line') {
        ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + (f.x2 - f.x) * Math.min(1, k * 3), f.y + (f.y2 - f.y) * Math.min(1, k * 3)); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x2, f.y2, 5 * a + 1, 0, 7); ctx.fill();
      } else if (f.type === 'slash') {
        ctx.globalAlpha = a; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 6 * a + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(f.x, f.y, 26, -2.3 + k * 0.7, -0.6 + k * 0.7); ctx.stroke();
        ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, 32, -2.2 + k * 0.7, -0.7 + k * 0.7); ctx.stroke();
      } else if (f.type === 'dmg' || f.type === 'dmgu') {
        const y = f.y - k * 34, s = 18 + (1 - k) * 4;
        ctx.globalAlpha = Math.min(1, a * 1.6);
        text(String(f.v), f.x, y, { size: s, lw: 4, color: f.type === 'dmgu' ? '#ff8d7e' : f.m ? '#e6b5ff' : '#ffffff', stroke: 'rgba(30,10,10,.9)' });
      }
      ctx.restore();
    }
  },

  /* ═════════════ HUD ═════════════ */
  drawHud() {
    const b = this.b, st = b.stage, t = this.t;
    /* 좌상단: 로고 / 스테이지 이름 / 생명 */
    part('logo', 2, -4, 172);
    const sh = part('banner_bottom', 172, 8, 254) || 60;
    text('스테이지 ' + st.id, 172 + 127, 8 + sh * 0.5, { size: 22, color: '#5a2d1d', stroke: false, weight: 800 });
    const hh = part('heart_panel', 180, 8 + sh + 2, 156) || 64;
    text(String(b.lives), 180 + 156 * 0.6, 8 + sh + 2 + hh * 0.5 + 1, { size: 26, lw: 4 });
    text('/ ' + b.livesMax, 180 + 156 * 0.84, 8 + sh + 2 + hh * 0.5 + 4, { size: 14, color: '#d9c7a0', stroke: false });

    /* 상단 중앙: 웨이브 바 */
    const W = 400, k = W / 534, x0 = (GW - W) / 2, y0 = 2, wb = PART('wave_bar');
    if (wb) {
      part('wave_bar', x0, y0, W);
      const tx = x0 + 84 * k, ty = y0 + 51 * k, tw = 388 * k, th = 21 * k;
      rr(tx, ty, tw, th, th / 2); ctx.fillStyle = '#241915'; ctx.fill();
      const prog = Math.min(1, (Math.max(0, b.waveIdx) + (b.waveIdx >= 0 ? 1 - b.spawnQ.length / this.waveQ0 : 0)) / b.waveTotal);
      if (prog > 0) {
        const g = ctx.createLinearGradient(tx, 0, tx + tw, 0); g.addColorStop(0, '#e8362e'); g.addColorStop(0.7, '#f0a53a'); g.addColorStop(1, '#ffd45a');
        rr(tx + 1, ty + 1, Math.max(th - 2, (tw - 2) * prog), th - 2, (th - 2) / 2); ctx.fillStyle = g; ctx.fill();
      }
      for (const sx of [346, 442]) {                       // 해골 표시를 다시 얹음
        ctx.save(); ctx.beginPath(); ctx.arc(x0 + sx * k, y0 + 62 * k, 21 * k, 0, 7); ctx.clip();
        ctx.drawImage(wb, sx - 21, 62 - 21, 42, 42, x0 + (sx - 21) * k, y0 + (62 - 21) * k, 42 * k, 42 * k); ctx.restore();
      }
      text(b.waveIdx < 0 ? '준비 중' : 'WAVE ' + (b.waveIdx + 1) + ' / ' + b.waveTotal, x0 + 275 * k, y0 + 34 * k, { size: 17, lw: 4 });
    }
    // 조기 호출 / 남은 적
    const left = b.enemies.length + b.spawnQ.length;
    if (b.nextWaveReady) {
      const lab = (b.waveIdx < 0 ? '첫 웨이브' : '다음 웨이브') + ' ' + Math.ceil(b.timer) + '초  ·  조기 호출 ▶';
      button(GW / 2 - 150, 100, 300, 40, lab, () => { b.callWave(); }, { size: 17, kind: 'primary' });
    } else {
      rr(GW / 2 - 110, 102, 220, 34, 17); ctx.fillStyle = 'rgba(28,16,14,.82)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.gold2; ctx.stroke();
      text('남은 적 ' + left, GW / 2, 120, { size: 17, color: left ? COL.cream : '#9ff0b0' });
    }

    /* 우상단: 배속 / 일시정지 / 전체화면 */
    const bw = 62;
    ctx.save(); if (this.speed === 2) { ctx.shadowColor = 'rgba(255,220,110,.95)'; ctx.shadowBlur = 18; }
    part('btn_speed', GW - 6 - bw * 3 - 12, 6, bw, undefined, this.speed === 2 ? 1 : 0.82); ctx.restore();
    hit(GW - 6 - bw * 3 - 12, 6, bw, 66, () => { this.speed = this.speed === 1 ? 2 : 1; });
    part('btn_pause', GW - 6 - bw * 2 - 6, 6, bw); hit(GW - 6 - bw * 2 - 6, 6, bw, 66, () => this.togglePause());
    part('btn_fullscreen', GW - 6 - bw, 6, bw); hit(GW - 6 - bw, 6, bw, 66, toggleFullscreen);

    /* 좌하단: DP / 골드 */
    const gw = 214, gh = partH('gem_panel', gw), gx = 8, gy = GH - 8 - gh;
    part('gem_panel', gx, gy, gw);
    text('DP ' + Math.floor(b.dp), gx + gw * 0.5, gy + gh * 0.5 + 1, { size: 27, lw: 5 });
    text('/ ' + b.dpMax, gx + gw * 0.82, gy + gh * 0.5 + 4, { size: 13, color: '#d9c7a0', stroke: false });
    rr(gx + 6, gy - 34, 150, 28, 14); ctx.fillStyle = 'rgba(28,16,14,.86)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = COL.gold2; ctx.stroke();
    ctx.fillStyle = '#ffd45a'; ctx.beginPath(); ctx.arc(gx + 24, gy - 20, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#a8731c'; ctx.lineWidth = 2; ctx.stroke();
    text('G', gx + 24, gy - 19, { size: 11, color: '#7a4b10', stroke: false });
    text(String(b.gold), gx + 96, gy - 19, { size: 18, lw: 3 });

    /* 하단 카드 */
    this.drawCards();

    /* 배치 안내 */
    if (this.selCard >= 0 && !this.place) {
      const bw2 = 350, bh = partH('banner_bottom', bw2), by = GH - 150 - bh - 6 + Math.sin(t * 4) * 3;
      part('banner_bottom', 557 - bw2 / 2, by, bw2);
      text('배치 위치를 선택하세요', 557, by + bh * 0.5, { size: 22, color: '#5a2d1d', stroke: false, weight: 800 });
    }
    /* 선택한 유닛 정보 */
    if (this.selUnit) this.drawInfo(this.selUnit);
  },

  drawCards() {
    const b = this.b, cw = 100, gap = 10, x0 = 232, yb = GH - 8;
    let tip = null;
    for (let i = 0; i < 6; i++) {
      const x = x0 + i * (cw + gap);
      if (i >= this.roster.length) { part('card_locked', x, yb - partH('card_locked', cw), cw, undefined, 0.5); continue; }
      const c = b.cards[i], r = this.roster[i], fh = partH(CLASSES[c.cls].frame, cw), sel = this.selCard === i;
      const afford = b.dp >= c.cost, y = yb - fh;
      let dim = 0, cd = null;
      if (c.unit) dim = 0.5; else if (c.cd > 0) { dim = 0.6; cd = String(Math.ceil(c.cd)); } else if (!afford) dim = 0.4;
      drawCard(x, y, cw, r, { cost: c.cost, label: r.label, dim, cdText: cd, lift: sel, glow: sel });
      if (c.unit) text('배치 중', x + cw / 2, y + fh * 0.4, { size: 15, color: '#ffe9b0', lw: 4 });
      hit(x, y - (sel ? 10 : 0), cw, fh, () => this.clickCard(i));
      if (hovered(x, y, cw, fh)) tip = { x, y, r, c };
    }
    if (tip && !this.place) {
      const { r, c } = tip, cl = CLASSES[c.cls], s = unitStats(c.cls, b.stage.world), w = 236, h = 118;
      const tx = Math.min(GW - w - 8, tip.x - 4), ty = tip.y - h - 14;
      panel(tx, ty, w, h, { r: 12 });
      text(r.label + '  ·  ' + cl.name, tx + w / 2, ty + 24, { size: 19, color: COL.gold });
      text('체력 ' + s.hp + '   공격 ' + s.atk + '   방어 ' + s.def, tx + w / 2, ty + 54, { size: 15, weight: 600 });
      text('사거리 ' + cl.range + '   막기 ' + (cl.block || '-') + '   비용 ' + cl.cost, tx + w / 2, ty + 78, { size: 15, weight: 600 });
      text('스킬: ' + cl.skillName, tx + w / 2, ty + 101, { size: 14, color: '#cbb892', stroke: false });
    }
  },

  /* 선택한 아군 정보 패널 (info_panel 위에 값을 얹음) */
  drawInfo(u) {
    const b = this.b, cl = CLASSES[u.cls], W = 340, k = W / 473, px = GW - W - 8, py = 150;
    const P = (ox, oy) => [px + ox * k, py + oy * k];
    part('info_panel', px, py, W);
    // 초상화
    const [qx, qy] = P(48, 66); drawPortrait('units', u.key, qx, qy, 156 * k, 224 * k);
    // 이름 / 레벨
    const lv = 1 + u.up.hp + u.up.atk + u.up.def, r = ROSTER.find(q => q.key === u.key);
    let [nx, ny] = P(326, 70); text(r.label, nx, ny, { size: 21, color: COL.gold });
    [nx, ny] = P(326, 96); text('Lv ' + lv + '  ·  ' + cl.name, nx, ny, { size: 14, weight: 600, stroke: false, color: '#e8d8b4' });
    // 능력치 줄
    const rows = [Math.ceil(u.hp) + ' / ' + u.maxhp, String(u.atk) + (cl.heal ? '  (치유)' : ''), String(u.def), u.range + (u.block ? '   막기 ' + u.block : '')];
    rows.forEach((s, i) => { const [x, y] = P(290, 131 + i * 42.5); text(s, x, y, { size: 19, align: 'left', lw: 4 }); });
    // 체력·스킬 게이지 (그림의 채움을 어둡게 덮고 비율만큼만 보이게)
    const cover2 = (ox, oy, ow, oh, ratio) => { const [x, y] = P(ox, oy); const w = ow * k, h = oh * k, cut = w * (1 - Math.max(0, Math.min(1, ratio))); if (cut > 0.5) { rr(x + w - cut, y, cut, h, h / 2); ctx.fillStyle = '#1c1210'; ctx.fill(); } };
    cover2(54, 302, 138, 15, u.hp / u.maxhp);
    const hasSk = !!cl.skill, ready = u.sp >= u.spMax;
    cover2(54, 324, 138, 15, hasSk ? u.sp / u.spMax : 0);
    text(Math.floor(u.sp) + '%', ...P(123, 332), { size: 11, lw: 3, color: ready ? '#fff2b0' : '#cfe6ff' });
    // 강화 3칸
    const slotX = [206, 281, 357];
    BS_UP.forEach(([stat, lab], i) => {
      const [sx, sy] = P(slotX[i], 301), sw = 66 * k, sh = 60 * k, lvl = u.up[stat], cost = b.upCost(u, stat), max = lvl >= 5, can = !max && b.gold >= cost;
      if (!can) { rr(sx, sy, sw, sh, 8 * k); ctx.fillStyle = 'rgba(14,8,6,' + (max ? 0.35 : 0.5) + ')'; ctx.fill(); }
      for (let d = 0; d < 5; d++) { ctx.fillStyle = d < lvl ? '#ffd45a' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(sx + sw / 2 + (d - 2) * 7, sy + 7, 2.4, 0, 7); ctx.fill(); }
      text(lab + ' ' + (max ? 'MAX' : cost), sx + sw / 2, sy + sh + 11, { size: 12, lw: 3, color: max ? '#d9c7a0' : can ? '#a8f0b8' : '#ff9a8a' });
      hit(sx, sy, sw, sh, () => { if (max) toast('최대 강화입니다'); else if (!b.upgrade(u, stat)) toast('골드가 부족합니다'); });
    });
    // 스킬 / 후퇴 (그림 속 영어 글자를 한글 라벨로 덮음)
    const patch = (ox, oy, ow, oh, c1, c2) => { const [x, y] = P(ox, oy), w = ow * k, h = oh * k, g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); };
    patch(104, 398, 86, 40, '#f81f2c', '#dc0a1c');
    patch(309, 398, 101, 40, '#5a3626', '#4e2e22');
    const [kx, ky] = P(60, 385), kw = 170 * k, kh = 70 * k;
    text(hasSk ? cl.skillName : '-', kx + kw / 2 + 4 * k, ky + kh / 2, { size: hasSk && cl.skillName.length > 4 ? 15 : 18, lw: 4, color: '#fff4e0' });
    const [rx, ry] = P(241, 385); text('후퇴', rx + 123 * k, ry + 35 * k, { size: 20, lw: 4, color: '#f3e3c4' });
    if (!ready || !hasSk) { rr(kx, ky, kw, kh, 12 * k); ctx.fillStyle = 'rgba(14,8,6,.55)'; ctx.fill(); }
    else {
      ctx.save(); ctx.strokeStyle = 'rgba(255,230,120,' + (0.55 + Math.sin(this.t * 7) * 0.4) + ')'; ctx.lineWidth = 3; ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 14; rr(kx - 2, ky - 2, kw + 4, kh + 4, 14 * k); ctx.stroke(); ctx.restore();
    }
    hit(kx, ky, kw, kh, () => { if (!hasSk) return; if (!b.useSkill(u)) toast('스킬 게이지가 부족합니다'); });
    hit(rx, ry, 189 * k, 70 * k, () => { b.retreat(u); this.selUnit = null; });
  },

  /* ═════════════ 배치 방향 선택 ═════════════ */
  drawPlaceUI() {
    this.hoverDir = null;
    if (!this.place || this.paused) return;
    const sp = this.b.spots[this.place.si], R = 66;
    const cx = Math.max(R + 34, Math.min(GW - R - 34, sp.x)), cy = Math.max(R + 100, Math.min(GH - R - 160, sp.y));
    const off = [[0, R], [0, -R], [-R, 0], [R, 0]], ang = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
    text('바라볼 방향을 고르세요', cx, cy + R + 44, { size: 17, color: COL.gold });
    for (let d = 0; d < 4; d++) {
      const x = cx + off[d][0], y = cy + off[d][1], hv = Math.hypot(ptr.x - x, ptr.y - y) < 30 && !ptr.touchLike, isDef = this.place.dir === d;
      if (hv) this.hoverDir = d;
      ctx.save(); ctx.translate(x, y); if (hv) ctx.scale(1.12, 1.12);
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7); const g = ctx.createLinearGradient(0, -27, 0, 27); g.addColorStop(0, hv ? '#f0584a' : '#5a382c'); g.addColorStop(1, hv ? '#8e1f1f' : '#2a1913'); ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.lineWidth = 3.5; ctx.strokeStyle = isDef && !hv ? '#9fe2ff' : COL.gold; ctx.stroke();
      ctx.rotate(ang[d]); ctx.fillStyle = COL.cream; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      hit(x - 30, y - 30, 60, 60, () => this.doDeploy(d));
    }
    button(cx - 50, cy + R + 56, 100, 38, '취소', () => { this.place = null; }, { size: 17 });
  },

  /* ═════════════ 배너 ═════════════ */
  drawBanners() {
    for (const bn of this.banners) {
      const fin = Math.min(1, bn.t / 0.25), fout = Math.min(1, (bn.dur - bn.t) / 0.4), a = Math.min(fin, fout), e = 1 - Math.pow(1 - fin, 3);
      ctx.save(); ctx.globalAlpha = a;
      if (bn.kind === 'intro') {
        ctx.fillStyle = 'rgba(8,6,10,' + 0.38 * a + ')'; ctx.fillRect(0, 0, GW, GH);
        const w = 640, h = partH('banner_bottom', w), x = GW / 2 - w / 2, y = 250 - (1 - e) * 24;
        part('banner_bottom', x, y, w);
        text(bn.text, GW / 2, y + h * 0.42, { size: 42, color: '#5a2d1d', stroke: false, weight: 800, font: SERIF });
        text(bn.sub, GW / 2, y + h * 0.72, { size: 20, color: '#6b4a34', stroke: false, weight: 700 });
      } else {
        const w = bn.kind === 'boss' ? 460 : 360, h = partH('banner_bottom', w), x = GW / 2 - w / 2, y = 152 - (1 - e) * 16;
        if (bn.kind === 'boss') { ctx.shadowColor = 'rgba(255,60,40,.8)'; ctx.shadowBlur = 24; }
        part('banner_bottom', x, y, w); ctx.shadowBlur = 0;
        if (bn.kind === 'boss') part('badge_warn', x - 38, y + h * 0.5 - 40, 80);
        text(bn.text, GW / 2 + (bn.kind === 'boss' ? 24 : 0), y + h * (bn.sub ? 0.4 : 0.5), { size: bn.kind === 'boss' ? 34 : 30, color: bn.kind === 'boss' ? '#a01818' : '#5a2d1d', stroke: false, weight: 800 });
        if (bn.sub) text(bn.sub, GW / 2 + (bn.kind === 'boss' ? 24 : 0), y + h * 0.7, { size: 17, color: '#6b4a34', stroke: false, weight: 700 });
      }
      ctx.restore();
    }
  },

  /* ═════════════ 일시정지 / 결과 ═════════════ */
  drawPause() {
    ctx.fillStyle = 'rgba(8,6,10,.62)'; ctx.fillRect(0, 0, GW, GH);
    hit(0, 0, GW, GH, () => { });
    const w = 440, h = 360, x = GW / 2 - w / 2, y = 180;
    panel(x, y, w, h);
    text('일시정지', GW / 2, y + 56, { size: 40, color: COL.gold, font: SERIF });
    text('스테이지 ' + this.b.stage.id, GW / 2, y + 100, { size: 18, weight: 600 });
    button(x + 60, y + 130, w - 120, 58, '계속하기', () => { this.paused = false; }, { size: 24, kind: 'primary' });
    button(x + 60, y + 200, w - 120, 52, '다시 시작', () => this.restart(), { size: 21 });
    button(x + 60, y + 266, w - 120, 52, '스테이지 선택', () => this.toWorld(), { size: 21 });
  },
  drawResult() {
    const b = this.b, r = b.result, st = b.stage, k = Math.min(1, (this.endT - 0.9) / 0.35), e = 1 - Math.pow(1 - k, 3);
    ctx.fillStyle = 'rgba(8,6,10,' + 0.66 * k + ')'; ctx.fillRect(0, 0, GW, GH);
    hit(0, 0, GW, GH, () => { });
    const w = 620, h = 460, x = GW / 2 - w / 2, y = 130 + (1 - e) * 40;
    ctx.save(); ctx.globalAlpha = k;
    panel(x, y, w, h);
    if (r.win) {
      text('승리!', GW / 2, y + 64, { size: 58, color: COL.gold, font: SERIF });
      const t0 = this.endT - 1.3;
      for (let i = 0; i < 3; i++) {
        const tt = Math.max(0, Math.min(1, (t0 - i * 0.3) / 0.3)), sz = 96 * (0.4 + 0.6 * tt + Math.sin(tt * Math.PI) * 0.25);
        const cx = GW / 2 + (i - 1) * 108, cy = y + 160;
        ctx.save(); ctx.globalAlpha = k * (i < r.stars ? tt : Math.min(0.9, tt) * 0.9); drawStars(cx, cy, i < r.stars ? 1 : 0, sz, 1); ctx.restore();
      }
      if (this.newStars > this.prevStars) text('최고 기록 갱신!', GW / 2, y + 232, { size: 18, color: '#ffe9a0' });
    } else {
      part('badge_warn', GW / 2 - 46, y + 14, 92);
      text('패배…', GW / 2, y + 140, { size: 52, color: '#ff9a8a', font: SERIF });
      text('생명이 모두 사라졌습니다', GW / 2, y + 200, { size: 18, weight: 600 });
    }
    // 기록
    const rows = [['처치', r.kills + '명'], ['남은 생명', r.lives + ' / ' + b.livesMax], ['전투 시간', bsFmtTime(r.time)]];
    rows.forEach(([a, v], i) => { const yy = y + 262 + i * 34; text(a, x + 200, yy, { size: 19, color: '#cbb892', stroke: false, align: 'left' }); text(v, x + w - 200, yy, { size: 20, align: 'right' }); });
    // 버튼
    const next = r.win ? STAGES[st.idx] : null, by = y + h - 76;
    const items = r.win ? (next ? [['다시 도전', () => this.restart(), 'dark'], ['다음 스테이지 ▶', () => go(BattleScreen, { stage: next, deck: this.a.deck }), 'primary'], ['스테이지 선택', () => this.toWorld(), 'dark']]
      : [['다시 도전', () => this.restart(), 'dark'], ['스테이지 선택', () => this.toWorld(), 'primary']])
      : [['다시 도전', () => this.restart(), 'primary'], ['스테이지 선택', () => this.toWorld(), 'dark']];
    const bw = items.length === 3 ? 176 : 232, gap = 14, tw = bw * items.length + gap * (items.length - 1);
    items.forEach(([lab, fn, kind], i) => button(GW / 2 - tw / 2 + i * (bw + gap), by, bw, 56, lab, fn, { size: 20, kind }));
    ctx.restore();
  },
};

/* 키보드: 스페이스/ESC = 일시정지 */
window.addEventListener('keydown', e => {
  if (typeof SCREEN === 'undefined' || SCREEN !== BattleScreen) return;
  if (e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); BattleScreen.togglePause(); }
});
