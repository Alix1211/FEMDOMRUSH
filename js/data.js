/* FEMDOM RUSH — 데이터 (월드·스테이지·유닛·적)
   ※ 수치와 클래스 배정은 임시값입니다. 이 파일만 고치면 게임 전체에 반영됩니다. */
'use strict';
const GW = 1280, GH = 720;

/* ── 월드 7개 ── */
const WORLDS = [
  // 월드맵 배치: 케인 시안 기준 (1280×720)
  { id: 'w1_harbor',  n: 1, name: '부두',  slot: { cx: 1042, cy: 500, w: 248 }, bob: [7, 5.2, 0.0] },
  { id: 'w2_forest',  n: 2, name: '숲',    slot: { cx: 720,  cy: 575, w: 248 }, bob: [9, 6.1, 1.3] },
  { id: 'w3_desert',  n: 3, name: '사막',  slot: { cx: 400,  cy: 520, w: 252 }, bob: [6, 4.7, 2.4] },
  { id: 'w4_meadow',  n: 4, name: '초원',  slot: { cx: 360,  cy: 285, w: 300 }, bob: [10, 6.8, 0.7] },
  { id: 'w5_village', n: 5, name: '마을',  slot: { cx: 655,  cy: 382, w: 248 }, bob: [8, 5.6, 3.1] },
  { id: 'w6_castle',  n: 6, name: '왕성',  slot: { cx: 705,  cy: 178, w: 300 }, bob: [7, 7.3, 1.9] },
  { id: 'w7_demon',   n: 7, name: '마계',  slot: { cx: 1080, cy: 205, w: 300 }, bob: [9, 4.9, 4.2] },
];

/* 스테이지 화면 노드 좌표 (월드별 10개, 1280×720 기준) */
const NODES = {"w1":[[112,608],[240,536],[376,480],[512,419],[640,376],[800,344],[896,304],[976,264],[1040,224],[1048,152]],"w2":[[96,528],[240,472],[400,419],[496,344],[624,320],[752,344],[864,368],[976,344],[1056,280],[1104,176]],"w3":[[96,376],[224,456],[360,432],[480,376],[608,400],[720,480],[832,448],[896,352],[960,272],[1024,176]],"w4":[[80,528],[208,480],[336,440],[464,408],[576,392],[720,400],[832,408],[944,344],[1040,256],[1120,136]],"w5":[[96,368],[208,320],[336,344],[464,360],[576,368],[688,344],[800,368],[912,320],[992,240],[1056,144]],"w6":[[96,496],[208,432],[320,384],[448,344],[576,336],[688,344],[800,320],[912,272],[992,208],[1056,96]],"w7":[[112,344],[224,376],[368,344],[496,408],[608,384],[720,424],[832,456],[944,400],[1024,320],[1056,208]]};

/* ── 클래스 (카드 틀 색과 연결) ── */
const CLASSES = {
  sword:  { name: '근접',  frame: 'card_sword',  hp: 460, atk: 44, def: 10, range: 95,  block: 2, itv: 1.0, cost: 12, skill: 'whirl',  skillName: '회전 베기' },
  shield: { name: '방패',  frame: 'card_shield', hp: 820, atk: 24, def: 22, range: 85,  block: 3, itv: 1.2, cost: 10, skill: 'guard',  skillName: '철벽 방어' },
  archer: { name: '궁수',  frame: 'card_archer', hp: 260, atk: 36, def: 3,  range: 250, block: 0, itv: 0.9, cost: 11, skill: 'volley', skillName: '연속 사격' },
  mage:   { name: '마법',  frame: 'card_mage',   hp: 240, atk: 58, def: 2,  range: 215, block: 0, itv: 1.7, cost: 15, skill: 'blast',  skillName: '폭발 마법', splash: 70 },
  healer: { name: '치유',  frame: 'card_mage',   hp: 300, atk: 30, def: 4,  range: 200, block: 0, itv: 1.6, cost: 14, skill: 'bless',  skillName: '축복', heal: true },
};

/* ── 아군 23명 (이름 미정 → 번호로 표기. 클래스는 외형 기준 임시 배정) ── */
const ROSTER_CLASS = {
  u01: 'sword', u02: 'sword', u03: 'mage',  u04: 'shield', u05: 'sword', u06: 'healer', u07: 'mage', u08: 'mage',
  u09: 'sword', u10: 'mage',  u11: 'archer', u12: 'sword', u13: 'sword', u14: 'archer', u15: 'sword', u16: 'mage',
  u17: 'archer', u18: 'sword', u19: 'sword', u20: 'archer', u21: 'shield', u22: 'healer', u23: 'shield',
};
const ROSTER = Object.keys(ROSTER_CLASS).map((k, i) => ({ key: k, no: i + 1, cls: ROSTER_CLASS[k], label: 'No.' + String(i + 1).padStart(2, '0') }));
const DEFAULT_DECK = ['u23', 'u04', 'u11', 'u01', 'u07', 'u06'];

/* ── 적 (남성 34종 스프라이트를 5가지 유형으로 분류) ── */
const ENEMY_TYPES = {
  grunt:  { hp: 150,  atk: 14, def: 3,  spd: 50, range: 0,   itv: 1.1, gold: 8,  size: 92 },
  fast:   { hp: 90,   atk: 11, def: 1,  spd: 88, range: 0,   itv: 0.9, gold: 7,  size: 86 },
  heavy:  { hp: 520,  atk: 24, def: 10, spd: 34, range: 0,   itv: 1.3, gold: 18, size: 104 },
  ranged: { hp: 110,  atk: 18, def: 2,  spd: 44, range: 170, itv: 1.4, gold: 10, size: 90 },
  boss:   { hp: 3200, atk: 46, def: 14, spd: 28, range: 0,   itv: 1.4, gold: 160, size: 150, lifeCost: 3 },
};
const ENEMY_POOL = {
  w1: { grunt: ['e01', 'e04', 'e19'], fast: ['e20', 'e21'], heavy: ['e22'], ranged: ['e30'], boss: ['e18'] },
  w2: { grunt: ['e19', 'e23', 'e34'], fast: ['e20', 'e10', 'e21'], heavy: ['e22', 'e24'], ranged: ['e05'], boss: ['e24'] },
  w3: { grunt: ['e02', 'e09', 'e31'], fast: ['e03', 'e28', 'e34'], heavy: ['e18', 'e09'], ranged: ['e30', 'e31'], boss: ['e06'] },
  w4: { grunt: ['e11', 'e12', 'e15'], fast: ['e16', 'e10', 'e17'], heavy: ['e14', 'e18'], ranged: ['e13', 'e07'], boss: ['e14'] },
  w5: { grunt: ['e01', 'e11', 'e04'], fast: ['e02', 'e29', 'e25'], heavy: ['e22', 'e18'], ranged: ['e13', 'e30', 'e08'], boss: ['e18'] },
  w6: { grunt: ['e11', 'e12', 'e15'], fast: ['e29', 'e33', 'e03'], heavy: ['e14', 'e24'], ranged: ['e07', 'e08', 'e32'], boss: ['e29'] },
  w7: { grunt: ['e23', 'e33', 'e32'], fast: ['e29', 'e33', 'e34'], heavy: ['e24', 'e09'], ranged: ['e32', 'e08', 'e05'], boss: ['e26'] },
};

/* ── 스테이지 70개 자동 구성 (월드 7 × 10, 전투 맵은 월드당 5장을 2번씩) ── */
function worldScale(w) { return 1 + 0.2 * (w - 1); }
function makeStage(w, s) {
  const world = WORLDS[w - 1];
  const idx = (w - 1) * 10 + s;                    // 1..70
  const pool = ENEMY_POOL['w' + w];
  const boss = s === 10, mid = s === 5;
  const nWaves = 4 + Math.floor((s - 1) / 3) + (boss ? 1 : 0);
  const waves = [];
  let seed = idx * 7919;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  for (let i = 0; i < nWaves; i++) {
    const total = Math.round(6 + idx * 0.28 + i * 2.2);
    const groups = [];
    const mix = [['grunt', 1.0]];
    if (s >= 2 || i >= 2) mix.push(['fast', 0.45]);
    if (s >= 3 || i >= 3) mix.push(['ranged', 0.35]);
    if (s >= 4 || i >= 3) mix.push(['heavy', 0.28]);
    const wsum = mix.reduce((a, m) => a + m[1], 0);
    let left = total;
    mix.forEach(([t, wt], mi) => {
      const n = mi === mix.length - 1 ? left : Math.max(1, Math.round(total * wt / wsum));
      left -= n;
      if (n > 0) groups.push({ type: t, sprite: pick(pool[t]), n, itv: t === 'fast' ? 1.1 : t === 'heavy' ? 3.2 : 1.9 });
    });
    if ((boss || mid) && i === nWaves - 1) groups.push({ type: 'boss', sprite: pool.boss[0], n: 1, itv: 1, delay: 4, mini: mid });
    waves.push(groups);
  }
  return {
    id: w + '-' + s, world: w, no: s, idx,
    map: world.id + '_' + Math.ceil(s / 2),
    title: '스테이지 ' + w + '-' + s,
    lives: 10, waves,
    objective: boss ? '보스를 쓰러뜨리고 길을 지키세요' : '모든 웨이브를 막아내세요',
    boss, mid,
    startDp: 12,
    scale: worldScale(w) * (1 + 0.035 * (s - 1)),
  };
}
const STAGES = [];
for (let w = 1; w <= 7; w++) for (let s = 1; s <= 10; s++) STAGES.push(makeStage(w, s));
const stageOf = (w, s) => STAGES[(w - 1) * 10 + (s - 1)];

/* 아군 스탯 (월드가 올라가면 파티 레벨 보정이 같이 올라갑니다) */
function unitStats(cls, world) {
  const c = CLASSES[cls], k = worldScale(world);
  return { hp: Math.round(c.hp * k), atk: Math.round(c.atk * k), def: Math.round(c.def * k) };
}
