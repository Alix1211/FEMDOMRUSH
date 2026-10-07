/* FEMDOM RUSH — 전투 로직 (화면과 분리: 브라우저/노드 어디서든 돌아갑니다) */
'use strict';
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]];   // 0 정면(아래) 1 뒤(위) 2 왼쪽 3 오른쪽
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const calcDmg = (atk, def, magic) => Math.max(atk * 0.10, atk - def * (magic ? 0.5 : 1));

class Battle {
  constructor(stage, deckKeys, mapInfo) {
    this.stage = stage;
    this.pts = mapInfo.path.map(p => ({ x: p[0], y: p[1] }));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + dist2(this.pts[i], this.pts[i - 1]));
    this.len = this.cum[this.cum.length - 1];
    this.spots = mapInfo.spots.map(p => ({ x: p[0], y: p[1], unit: null }));
    this.cards = deckKeys.map(k => {
      const r = ROSTER.find(x => x.key === k), c = CLASSES[r.cls];
      return { key: k, no: r.no, cls: r.cls, cost: c.cost, cd: 0, unit: null };
    });
    this.time = 0; this.dp = stage.startDp; this.dpMax = 99; this.dpRate = 1.25; this.gold = 0;
    this.lives = this.livesMax = stage.lives; this.lost = 0;
    this.units = []; this.enemies = []; this.fx = [];
    this.waveIdx = -1; this.waveTotal = stage.waves.length;
    this.waveState = 'prep'; this.timer = 10; this.waveClock = 0; this.spawnQ = [];
    this.kills = 0; this.result = null; this.uid = 1;
    this.shake = 0;
  }

  pathAt(s) {
    s = Math.max(0, Math.min(this.len, s));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
    const a = this.pts[lo], b = this.pts[hi], seg = this.cum[hi] - this.cum[lo] || 1, t = (s - this.cum[lo]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / seg, dy: (b.y - a.y) / seg };
  }

  /* ── 웨이브 ── */
  get nextWaveReady() { return (this.waveState === 'prep' || this.waveState === 'wait') && this.waveIdx + 1 < this.waveTotal; }
  callWave() { if (this.nextWaveReady) this.timer = 0; }
  startWave() {
    this.waveIdx++;
    const groups = this.stage.waves[this.waveIdx];
    this.spawnQ = []; let t = 0;
    for (const g of groups) {
      t += g.delay || 0;
      for (let i = 0; i < g.n; i++) { this.spawnQ.push({ t, g }); t += g.itv; }
      t += 1.5;
    }
    this.waveClock = 0; this.waveState = 'spawning';
  }
  spawn(g) {
    const d = ENEMY_TYPES[g.type], sc = this.stage.scale * (g.mini ? 0.6 : 1);
    const e = {
      id: this.uid++, type: g.type, sprite: g.sprite, s: 0,
      maxhp: Math.round(d.hp * sc), hp: Math.round(d.hp * sc), atk: d.atk * sc, def: d.def * sc,
      spd: d.spd, range: d.range, itv: d.itv, gold: d.gold, size: d.size, lifeCost: d.lifeCost || 1,
      cool: Math.random() * d.itv, blockedBy: null, flash: 0, x: 0, y: 0, dir: 3, atkAnim: 0, slow: 0,
    };
    const p = this.pathAt(0); e.x = p.x; e.y = p.y;
    this.enemies.push(e);
  }

  /* ── 배치 / 후퇴 / 강화 / 스킬 ── */
  canDeploy(ci) { const c = this.cards[ci]; return c && !c.unit && c.cd <= 0 && this.dp >= c.cost && !this.result; }
  deploy(ci, si, dir) {
    const c = this.cards[ci], sp = this.spots[si];
    if (!this.canDeploy(ci) || !sp || sp.unit) return null;
    const cl = CLASSES[c.cls], st = unitStats(c.cls, this.stage.world);
    const u = {
      id: this.uid++, card: c, cls: c.cls, key: c.key, no: c.no, spot: sp, x: sp.x, y: sp.y, dir,
      base: st, up: { hp: 0, atk: 0, def: 0 }, maxhp: st.hp, hp: st.hp, atk: st.atk, def: st.def,
      range: cl.range, block: cl.block, itv: cl.itv, cool: 0.4, sp: 0, spMax: 100, blocking: [],
      guard: 0, atkAnim: 0, flash: 0, born: this.time,
    };
    sp.unit = u; c.unit = u; this.units.push(u); this.dp -= c.cost;
    this.fx.push({ t: 0, dur: 0.5, type: 'spawn', x: u.x, y: u.y });
    return u;
  }
  removeUnit(u, died) {
    const i = this.units.indexOf(u); if (i < 0) return;
    this.units.splice(i, 1); u.spot.unit = null; u.card.unit = null;
    for (const e of u.blocking) if (e.blockedBy === u) e.blockedBy = null;
    u.blocking = [];
    if (died) { u.card.cd = 18; this.fx.push({ t: 0, dur: 0.6, type: 'poof', x: u.x, y: u.y }); }
    else { u.card.cd = 6; this.dp = Math.min(this.dpMax, this.dp + Math.floor(u.card.cost * 0.5)); }
  }
  retreat(u) { this.removeUnit(u, false); }
  upCost(u, stat) { return 30 + 25 * u.up[stat]; }
  upgrade(u, stat) {
    const cost = this.upCost(u, stat);
    if (u.up[stat] >= 5 || this.gold < cost) return false;
    this.gold -= cost; u.up[stat]++;
    const m = 1 + 0.18 * u.up[stat], m0 = stat === 'hp' ? 1 + 0.18 * (u.up.hp - 1) : 1;
    if (stat === 'hp') { const nm = Math.round(u.base.hp * m); u.hp += nm - u.maxhp; u.maxhp = nm; }
    if (stat === 'atk') u.atk = Math.round(u.base.atk * m);
    if (stat === 'def') u.def = Math.round(u.base.def * m);
    this.fx.push({ t: 0, dur: 0.5, type: 'up', x: u.x, y: u.y });
    return true;
  }

  inRange(u, e) {
    const d = dist2(u, e); if (d > u.range) return false;
    if (d < 1) return true;
    const f = DIRV[u.dir];
    return ((e.x - u.x) * f[0] + (e.y - u.y) * f[1]) / d >= -0.25;
  }
  hit(e, dmg, magic) {
    e.hp -= dmg; e.flash = 0.12;
    this.fx.push({ t: 0, dur: 0.7, type: 'dmg', x: e.x + (Math.random() - 0.5) * 24, y: e.y - e.size * 0.85, v: Math.round(dmg), m: !!magic });
    if (e.hp <= 0 && !e.dead) this.killEnemy(e);
  }
  killEnemy(e) {
    e.dead = true; this.kills++; this.gold += e.gold;
    if (e.blockedBy) { const b = e.blockedBy.blocking; const i = b.indexOf(e); if (i >= 0) b.splice(i, 1); }
    this.fx.push({ t: 0, dur: 0.5, type: 'poof', x: e.x, y: e.y - 20 });
    const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1);
  }
  heal(u, amt) { u.hp = Math.min(u.maxhp, u.hp + amt); this.fx.push({ t: 0, dur: 0.6, type: 'heal', x: u.x, y: u.y }); }

  useSkill(u) {
    if (u.sp < u.spMax || this.result) return false;
    const sk = CLASSES[u.cls].skill;
    const alive = this.enemies.filter(e => !e.dead);
    if (sk === 'whirl') {
      for (const e of alive) if (dist2(u, e) <= 120) this.hit(e, calcDmg(u.atk * 2.0, e.def));
      this.fx.push({ t: 0, dur: 0.5, type: 'ring', x: u.x, y: u.y, r: 120, c: '#ffd36a' });
    } else if (sk === 'guard') {
      u.guard = 6; this.heal(u, u.maxhp * 0.25);
      this.fx.push({ t: 0, dur: 0.7, type: 'ring', x: u.x, y: u.y, r: 70, c: '#7fd0ff' });
    } else if (sk === 'volley') {
      const ts = alive.filter(e => this.inRange(u, e)).sort((a, b) => b.s - a.s).slice(0, 5);
      for (const e of ts) { this.hit(e, calcDmg(u.atk * 1.5, e.def)); this.fx.push({ t: 0, dur: 0.25, type: 'line', x: u.x, y: u.y - 40, x2: e.x, y2: e.y - 30, c: '#ffe08a' }); }
    } else if (sk === 'blast') {
      const ts = alive.filter(e => this.inRange(u, e));
      let best = null, bn = -1;
      for (const e of ts) { const n = alive.filter(o => dist2(o, e) <= 95).length; if (n > bn) { bn = n; best = e; } }
      if (best) {
        for (const e of alive) if (dist2(e, best) <= 95) this.hit(e, calcDmg(u.atk * 2.4, e.def, true), true);
        this.fx.push({ t: 0, dur: 0.6, type: 'ring', x: best.x, y: best.y, r: 95, c: '#d58bff' });
      }
    } else if (sk === 'bless') {
      for (const a of this.units) this.heal(a, a.maxhp * 0.35 + u.atk * 2);
    }
    u.sp = 0; return true;
  }

  /* ── 한 프레임 진행 ── */
  update(dt) {
    if (this.result) { this.updateFx(dt); return; }
    this.time += dt;
    this.dp = Math.min(this.dpMax, this.dp + this.dpRate * dt);
    for (const c of this.cards) if (c.cd > 0) c.cd = Math.max(0, c.cd - dt);

    // 웨이브 진행
    if (this.waveState === 'prep' || this.waveState === 'wait') {
      this.timer -= dt;
      if (this.timer <= 0 && this.waveIdx + 1 < this.waveTotal) this.startWave();
    } else if (this.waveState === 'spawning') {
      this.waveClock += dt;
      while (this.spawnQ.length && this.spawnQ[0].t <= this.waveClock) this.spawn(this.spawnQ.shift().g);
      if (!this.spawnQ.length) {
        if (this.waveIdx + 1 < this.waveTotal) { this.waveState = 'wait'; this.timer = 16; }
        else this.waveState = 'last';
      }
    }
    if (this.waveState === 'last' && !this.enemies.length) { this.finish(true); return; }

    this.updateEnemies(dt);
    this.updateUnits(dt);
    this.updateFx(dt);
  }

  updateEnemies(dt) {
    for (const e of this.enemies.slice()) {
      if (e.dead) continue;
      e.cool -= dt; e.flash = Math.max(0, e.flash - dt); e.atkAnim = Math.max(0, e.atkAnim - dt);
      if (e.blockedBy && !this.units.includes(e.blockedBy)) e.blockedBy = null;
      if (!e.blockedBy) {
        for (const u of this.units) {
          if (u.block > 0 && u.blocking.length < u.block && dist2(u, e) < 52) { u.blocking.push(e); e.blockedBy = u; break; }
        }
      }
      if (e.blockedBy) {
        const u = e.blockedBy;
        e.dir = Math.abs(u.x - e.x) > Math.abs(u.y - e.y) ? (u.x < e.x ? 2 : 3) : (u.y < e.y ? 1 : 0);
        if (e.cool <= 0) { e.cool = e.itv; e.atkAnim = 0.25; this.hurtUnit(u, e.atk); }
      } else {
        e.s += e.spd * dt;
        const p = this.pathAt(e.s); e.x = p.x; e.y = p.y;
        e.dir = Math.abs(p.dx) > Math.abs(p.dy) ? (p.dx < 0 ? 2 : 3) : (p.dy < 0 ? 1 : 0);
        if (e.range > 0 && e.cool <= 0) {
          let t = null, bd = 1e9;
          for (const u of this.units) { const d = dist2(u, e); if (d <= e.range && d < bd) { bd = d; t = u; } }
          if (t) { e.cool = e.itv; e.atkAnim = 0.25; this.hurtUnit(t, e.atk); this.fx.push({ t: 0, dur: 0.2, type: 'line', x: e.x, y: e.y - 40, x2: t.x, y2: t.y - 30, c: '#ff8a7a' }); }
        }
        if (e.s >= this.len) { this.leak(e); }
      }
    }
  }
  hurtUnit(u, atk) {
    const dmg = calcDmg(atk, u.def) * (u.guard > 0 ? 0.4 : 1);
    u.hp -= dmg; u.flash = 0.12;
    this.fx.push({ t: 0, dur: 0.7, type: 'dmgu', x: u.x + (Math.random() - 0.5) * 20, y: u.y - 96, v: Math.round(dmg) });
    if (u.hp <= 0) this.removeUnit(u, true);
  }
  leak(e) {
    const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1);
    this.lives -= e.lifeCost; this.lost += e.lifeCost; this.shake = 0.35;
    if (this.lives <= 0) { this.lives = 0; this.finish(false); }
  }

  updateUnits(dt) {
    for (const u of this.units.slice()) {
      u.cool -= dt; u.flash = Math.max(0, u.flash - dt); u.atkAnim = Math.max(0, u.atkAnim - dt);
      if (u.guard > 0) u.guard -= dt;
      u.sp = Math.min(u.spMax, u.sp + dt * 4);
      if (u.cool > 0) continue;
      const cl = CLASSES[u.cls];
      if (cl.heal) {
        let t = null, br = 0.98;
        for (const a of this.units) { const r = a.hp / a.maxhp; if (r < br && dist2(u, a) <= u.range) { br = r; t = a; } }
        if (t) { this.heal(t, u.atk * 1.3); u.cool = u.itv; u.atkAnim = 0.3; u.sp = Math.min(u.spMax, u.sp + 5); }
        continue;
      }
      let tgt = null;
      const inr = this.enemies.filter(e => !e.dead && this.inRange(u, e));
      if (!inr.length) continue;
      if (u.block > 0) tgt = inr.find(e => e.blockedBy === u) || inr.sort((a, b) => b.s - a.s)[0];
      else tgt = inr.sort((a, b) => b.s - a.s)[0];
      const magic = !!cl.splash;
      this.hit(tgt, calcDmg(u.atk, tgt.def, magic), magic);
      if (cl.splash) {
        for (const e of this.enemies.slice()) if (e !== tgt && dist2(e, tgt) <= cl.splash) this.hit(e, calcDmg(u.atk * 0.7, e.def, true), true);
        this.fx.push({ t: 0, dur: 0.35, type: 'ring', x: tgt.x, y: tgt.y, r: cl.splash, c: '#d58bff' });
      } else if (u.range > 140) {
        this.fx.push({ t: 0, dur: 0.15, type: 'line', x: u.x, y: u.y - 45, x2: tgt.x, y2: tgt.y - 30, c: '#ffe9a8' });
      } else {
        this.fx.push({ t: 0, dur: 0.2, type: 'slash', x: tgt.x, y: tgt.y - 30 });
      }
      u.cool = u.itv; u.atkAnim = 0.25; u.sp = Math.min(u.spMax, u.sp + 6);
    }
  }
  updateFx(dt) {
    this.shake = Math.max(0, this.shake - dt);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.dur);
  }
  finish(win) {
    const stars = win ? (this.lost === 0 ? 3 : this.lost <= Math.ceil(this.livesMax * 0.3) ? 2 : 1) : 0;
    this.result = { win, stars, lives: this.lives, time: this.time, kills: this.kills };
  }
}
if (typeof module !== 'undefined') module.exports = { Battle };
