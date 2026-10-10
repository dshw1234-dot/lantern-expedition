'use strict';
// 등불 원정대 — 공통 도구, 캔버스, 게임 상태, 월드 생성, 안개, 지역 이동

// ================= 공통 도구 =================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + (b - a) * Math.random();
const randi = (a, b) => Math.floor(a + (b - a + 1) * Math.random());
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
HERO_DEFS.forEach(d => { d.dark = shade(d.color, -0.4); });
const ZONE_NAMES = ['마을', '들판', '숲', '폐허'];
const zoneAt = (x, y) => { const d = Math.hypot(x - VC.x, y - VC.y); return d < ZONE_R[0] ? 0 : d < ZONE_R[1] ? 1 : d < ZONE_R[2] ? 2 : 3; };
const inVillage = (x, y, pad = 0) => d2(x, y, VC.x, VC.y) < (VILLAGE_R + pad) ** 2;
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ================= 캔버스 =================
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
const GS = 0.3;                                  // 바닥 그림 해상도 배율
const ground = document.createElement('canvas'), gctx = ground.getContext('2d');
const FOGS = 16, FOG_N = WORLD / FOGS;           // 안개 그림 (225 x 225)
const fog = document.createElement('canvas'); fog.width = fog.height = FOG_N;
const fctx = fog.getContext('2d');
const FG = 45, FGC = WORLD / FG;                 // 안개 격자 (저장·지도용, 칸당 80)
const fogGrid = new Uint8Array(FG * FG); let fogCount = 0;
const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
let VW = 1, VH = 1, DPR = 1, SCALE = 1;
function resize() {
  const r = cv.getBoundingClientRect();
  VW = Math.max(1, r.width); VH = Math.max(1, r.height);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  SCALE = clamp(Math.min(VW, VH) / 560, 0.6, 1.25);
  dark.width = Math.ceil(VW / 2); dark.height = Math.ceil(VH / 2);
  const ms = Math.round(92 * DPR); mini.width = mini.height = ms;
}
addEventListener('resize', resize);

// ================= 게임 상태 =================
let state = 'title';           // title | play | wipe | menu | win
let now = 0, playTime = 0, wipeT = 0, winT = 0, saveT = 0, tickT = 0;
let nodes = [], dens = [], chests = [], portals = [], monsters = [], heroes = [];
let pickups = [], projs = [], orbs = [], parts = [], texts = [], fxs = [], tokens = [], delayed = [];
let res, life, lv, paid, questIdx, kills, maxZone, movedOnce, stoppedOnce;
let roster;                    // 영웅별 { owned, lvl, shards, active } (HERO_DEFS와 같은 순서)
let pub;                       // 주점 { line: 카드 3장(영웅 번호), picked, pity, next, pulls }
let squad;                     // 용병단 { lvl, xp }
let gear;                      // 장비 { bag: [], eq: { 부위: 장비 }, uid }
let prod;                      // 생산소 { wood: {lvl, stored}, stone, gold, store, last(실제 시각 ms) }
let daily;                     // 하루 단위 기록 { date, chests, opened: [[지역별 연 상자 번호]], pig, dungeon, defense, campSec }
let prog;                      // 진행 { pigStage, towerBest, seen: 가 본 지역 수 }
let regionIdx = 0, regionData; // 지역별 { fog, bd: 보스 처치, bs: 보스 발견 }
let camp = null, mode = null, returnPos = null;
let monId = 0;
const P = { x: START.x, y: START.y, moving: false, fx: 0, fy: -1 };   // 원정대 중심과 바라보는 방향
const cam = { x: START.x, y: START.y, shake: 0 };
const lastReveal = { x: -9999, y: -9999 };
const buffs = { atk: 0, atkT: 0, aspd: 0, aspdT: 0, amp: 0, ampT: 0 };   // 원정대 전체 일시 버프
const RD = () => regionData[regionIdx];
const REG = () => REGIONS[regionIdx];

// ================= 월드 생성 =================
function makeNode(kind, x, y, rnd) {
  const nd = NODE_DEFS[kind];
  const poly = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; poly.push([Math.cos(a) * (0.75 + rnd() * 0.35), Math.sin(a) * (0.55 + rnd() * 0.3)]); }
  return { isNode: true, kind, nd, x, y, r: nd.r, hp: nd.hp, maxHp: nd.hp, acc: 0, left: Math.floor(nd.hp / nd.per), respawnAt: 0, shake: 0, hitT: 0, poly };
}
function genWorld(r) {
  const rnd = mulberry32(REGIONS[r].seed);
  const RR = (a, b) => a + (b - a) * rnd();
  nodes = []; dens = []; chests = []; portals = [];
  const ringPoint = (dmin, dmax) => {
    for (let i = 0; i < 500; i++) {
      const x = RR(90, WORLD - 90), y = RR(90, WORLD - 90);
      const d = Math.hypot(x - VC.x, y - VC.y);
      if (d >= dmin && d <= dmax) return { x, y };
    }
    return null;
  };
  const cluster = (dmin, dmax, cnt, kinds, spread) => {
    const c = ringPoint(dmin, dmax);
    if (!c || dist(c, BOSS_POS) < 380) return;
    for (let i = 0; i < cnt; i++) {
      const a = RR(0, TAU), rr = RR(0, spread);
      const x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a) * rr;
      if (x < 60 || y < 60 || x > WORLD - 60 || y > WORLD - 60 || inVillage(x, y, 50)) continue;
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const nd = NODE_DEFS[kind];
      if (nodes.some(n => d2(n.x, n.y, x, y) < (n.r + nd.r + 12) ** 2)) continue;
      nodes.push(makeNode(kind, x, y, rnd));
    }
  };
  // 마을 가까이: 첫 목표용 자원
  cluster(460, 570, 7, ['tree'], 80); cluster(460, 570, 7, ['tree'], 80);
  cluster(470, 570, 5, ['rock'], 60); cluster(470, 580, 4, ['rock'], 50);
  for (let i = 0; i < 16; i++) cluster(500, 970, RR(4, 8) | 0, ['tree'], 110);
  for (let i = 0; i < 10; i++) cluster(500, 970, RR(2, 5) | 0, ['rock'], 70);
  for (let i = 0; i < 20; i++) cluster(1030, 1530, RR(5, 10) | 0, ['bigtree', 'tree', 'bigtree'], 140);
  for (let i = 0; i < 7; i++) cluster(1030, 1530, RR(2, 5) | 0, ['rock', 'rock', 'crystal'], 70);
  for (let i = 0; i < 12; i++) cluster(1580, 2600, RR(2, 5) | 0, ['deadtree'], 90);
  for (let i = 0; i < 16; i++) cluster(1580, 2600, RR(3, 6) | 0, ['rock', 'crystal', 'crystal'], 90);
  // 몬스터 소굴
  const placeDens = (zone, n, dmin, dmax) => {
    let k = 0, guard = 0;
    while (k < n && guard++ < 800) {
      const p = ringPoint(dmin, dmax);
      if (!p || dens.some(o => dist(o, p) < 260) || dist(p, BOSS_POS) < 520) continue;
      const list = PACKS[zone];
      dens.push({ x: p.x, y: p.y, zone, pack: list[Math.floor(rnd() * list.length)], members: [], respawnAt: 0 });
      k++;
    }
  };
  placeDens(1, 12, 580, 960); placeDens(2, 13, 1060, 1520); placeDens(3, 15, 1620, 2600);
  dens.push({ x: BOSS_POS.x, y: BOSS_POS.y, zone: 3, pack: { boss: [1, 1] }, members: [], respawnAt: 0, boss: true });
  // 보물상자 40곳 (하루 25개까지 열 수 있다)
  let guard = 0;
  while (chests.length < 40 && guard++ < 2000) {
    const p = ringPoint(470, 2600);
    if (!p || chests.some(c => dist(c, p) < 180) || nodes.some(n => d2(n.x, n.y, p.x, p.y) < 40 * 40)) continue;
    chests.push({ x: p.x, y: p.y, i: chests.length, zone: zoneAt(p.x, p.y) });
  }
  // 던전 입구: 들판 · 숲 · 폐허에 하나씩
  [[720, 900], [1200, 1450], [1750, 2300]].forEach(([a, b], k) => {
    for (let i = 0; i < 200; i++) {
      const p = ringPoint(a, b);
      if (!p || dist(p, BOSS_POS) < 600 || dens.some(o => dist(o, p) < 180)) continue;
      portals.push({ x: p.x, y: p.y, zone: k + 1, armed: true });
      break;
    }
  });
}
function buildGround(r) {
  const R = REGIONS[r], N = Math.round(WORLD * GS);
  ground.width = ground.height = N;
  const g = gctx, rnd = mulberry32(77 + r);
  g.setTransform(GS, 0, 0, GS, 0, 0);
  g.fillStyle = R.base; g.fillRect(0, 0, WORLD, WORLD);
  const disc = (r0, r1, rgb) => {
    const grd = g.createRadialGradient(VC.x, VC.y, r0, VC.x, VC.y, r1);
    grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd; g.beginPath(); g.arc(VC.x, VC.y, r1, 0, TAU); g.fill();
  };
  disc(ZONE_R[2] - 50, ZONE_R[2] + 70, R.forest);
  disc(ZONE_R[1] - 40, ZONE_R[1] + 60, R.meadow);
  disc(ZONE_R[0] - 50, ZONE_R[0] + 20, R.plaza);
  for (let i = 0; i < 3500; i++) {
    const x = rnd() * WORLD, y = rnd() * WORLD, z = zoneAt(x, y);
    if (z === 0) continue;
    g.globalAlpha = 0.1 + rnd() * 0.12; g.fillStyle = R.shades[z][(rnd() * 3) | 0];
    g.beginPath(); g.ellipse(x, y, 20 + rnd() * 80, 14 + rnd() * 50, rnd() * TAU, 0, TAU); g.fill();
  }
  g.globalAlpha = 0.28; g.strokeStyle = '#2d2c3a'; g.lineWidth = 3;
  for (let i = 0; i < 300; i++) {
    const x = rnd() * WORLD, y = rnd() * WORLD;
    if (zoneAt(x, y) !== 3) continue;
    const s = 30 + rnd() * 40; g.fillStyle = shade(R.base, 0.12); g.fillRect(x, y, s, s * 0.7); g.strokeRect(x, y, s, s * 0.7);
  }
  g.globalAlpha = 1; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < 4; k++) {   // 마을에서 사방으로 뻗은 길. 북동쪽 길은 보스에게 닿는다
    const base = -Math.PI / 4 + k * Math.PI / 2;
    g.beginPath();
    for (let rr = 340; rr <= (k === 0 ? 1950 : 1550); rr += 40) {
      const a = base + Math.sin(rr * 0.004 + k) * 0.12;
      const x = VC.x + Math.cos(a) * rr, y = VC.y + Math.sin(a) * rr;
      if (rr === 340) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = R.snow ? 'rgba(170,180,195,0.5)' : 'rgba(96,78,56,0.55)'; g.lineWidth = 44; g.stroke();
    g.strokeStyle = R.snow ? 'rgba(220,230,240,0.35)' : 'rgba(130,108,78,0.35)'; g.lineWidth = 24; g.stroke();
  }
  g.strokeStyle = 'rgba(160,130,95,0.35)'; g.lineWidth = 10;
  g.beginPath(); g.arc(VC.x, VC.y, VILLAGE_R - 15, 0, TAU); g.stroke();
}

// ================= 안개 =================
function resetFog() {
  fctx.globalCompositeOperation = 'source-over';
  fctx.fillStyle = '#0a0c14'; fctx.fillRect(0, 0, FOG_N, FOG_N);
  fogGrid.fill(0); fogCount = 0;
}
function reveal(x, y, r) {
  const fx = x / FOGS, fy = y / FOGS, fr = r / FOGS;
  fctx.globalCompositeOperation = 'destination-out';
  const g = fctx.createRadialGradient(fx, fy, fr * 0.5, fx, fy, fr);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  fctx.fillStyle = g; fctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
  fctx.globalCompositeOperation = 'source-over';
  const rr = r * 0.8;
  const c0 = Math.max(0, Math.floor((x - rr) / FGC)), c1 = Math.min(FG - 1, Math.floor((x + rr) / FGC));
  const r0 = Math.max(0, Math.floor((y - rr) / FGC)), r1 = Math.min(FG - 1, Math.floor((y + rr) / FGC));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const i = cy * FG + cx;
    if (!fogGrid[i] && d2((cx + 0.5) * FGC, (cy + 0.5) * FGC, x, y) < rr * rr) { fogGrid[i] = 1; fogCount++; }
  }
}
const fogPct = () => Math.floor(fogCount / (FG * FG) * 100);
const isRevealed = (x, y) => x >= 0 && y >= 0 && x < WORLD && y < WORLD && fogGrid[clamp((y / FGC) | 0, 0, FG - 1) * FG + clamp((x / FGC) | 0, 0, FG - 1)] === 1;
const fogString = () => Array.from(fogGrid).join('');
function loadFog(str) {
  str = String(str || '');
  for (let i = 0; i < Math.min(str.length, fogGrid.length); i++) if (str[i] === '1') reveal((i % FG + 0.5) * FGC, (((i / FG) | 0) + 0.5) * FGC, 95);
}

// ================= 생성 =================
function makeHero(idx, x, y, clone = false) {
  const def = HERO_DEFS[idx];
  const h = { isHero: true, def, idx, x, y, clone, hp: 1, maxHp: 0, cd: rand(0, 0.4), skillCd: def.s1.cd * 0.5, s2cd: 0, icd: 0, basicCount: 0,
    think: 0, target: null, down: false, downT: 0, invulnT: 0, flash: 0, swing: 0, guardT: 0, face: 1, walk: false };
  refreshHp(h); h.hp = h.maxHp;
  return h;
}
// 몬스터 수치는 태어날 때 정해진다: 지역(또는 도전 콘텐츠) 배율 × 정예 배율
function makeMonster(type, x, y, den, elite = false, mulOverride) {
  const b = MON[type], R = REG();
  const mul = mulOverride != null ? mulOverride : R.mul;
  const hp = Math.round(b.hp * mul * (elite ? 3 : 1));
  const col = type === 'boss' ? R.bossCol : (R.tint && R.tint[type]) || b.col;
  return { isMon: true, id: ++monId, type, d: b, x, y, hp, maxHp: hp, atk: b.atk * mul * (elite ? 1.5 : 1), r: b.r * (elite ? 1.3 : 1), col, elite,
    den, state: 'idle', target: null, forced: null, forcedT: 0, cd: rand(0.2, b.rate), wT: rand(0, 2), wx: x, wy: y, flash: 0,
    st: {}, stunT: 0, frozenT: 0, dead: false, ph: rand(0, TAU), look: rand(0, 0.25), atkAnim: 0, face: 1, walk: false,
    skillT: 5, sumT: 12, slam: null, summoned: false, arena: false };
}
function spawnPack(den) {
  den.members = [];
  const eliteIdx = !den.boss && Math.random() < ELITE_P[den.zone] ? 0 : -1;
  let k = 0;
  for (const type in den.pack) {
    const [a, b] = den.pack[type], n = randi(a, b);
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), rr = den.boss ? 0 : rand(10, 70);
      const m = makeMonster(type, den.x + Math.cos(ang) * rr, den.y + Math.sin(ang) * rr, den, k++ === eliteIdx);
      monsters.push(m); den.members.push(m);
    }
  }
}
// 출전 영웅: 근접을 앞(가운데)에, 원거리를 뒤(바깥)에 두려고 정렬한다
function sortHeroes() { heroes.sort((a, b) => (a.def.range > 0) - (b.def.range > 0) || a.idx - b.idx || a.clone - b.clone); }
function rebuildSquad(keepPos = true) {
  const old = new Map(heroes.filter(h => !h.clone).map(h => [h.idx, h]));
  const clones = heroes.filter(h => h.clone);
  heroes = [];
  roster.forEach((r, i) => {
    if (!r.owned || !r.active) return;
    const h = keepPos && old.get(i) || makeHero(i, P.x + rand(-20, 20), P.y + rand(-20, 20));
    heroes.push(h);
  });
  heroes.push(...clones);
  sortHeroes();
}
// 해바라기 배치(황금각) + 바라보는 방향 기준으로 원거리는 뒤로, 근접은 앞으로
function slotPos(i) {
  const h = heroes[i];
  let ox = 0, oy = 0;
  if (i > 0) { const r = 30 * Math.sqrt(i), a = i * 2.39996; ox = Math.cos(a) * r; oy = Math.sin(a) * r * 0.85; }
  const k = h && h.def.range > 0 ? -22 : 10;
  return { x: P.x + ox + P.fx * k, y: P.y + oy + P.fy * k };
}
function placeSquad(x, y) {
  P.x = x; P.y = y; cam.x = x; cam.y = y;
  heroes.forEach((h, i) => { const s = slotPos(i); h.x = s.x + rand(-4, 4); h.y = s.y + rand(-4, 4); h.target = null; });
}

// ================= 새 게임 · 지역 이동 =================
function newGame() {
  lv = { lantern: 0, forge: 0, barracks: 0, ship: 0 };
  roster = HERO_DEFS.map((d, i) => ({ owned: i < 2, lvl: 1, shards: 0, active: i < 2 }));
  squad = { lvl: 1, xp: 0 };
  gear = { bag: [], eq: {}, uid: 0 };
  prod = { wood: { lvl: 1, stored: 0 }, stone: { lvl: 1, stored: 0 }, gold: { lvl: 1, stored: 0 }, store: 1, last: Date.now() };
  daily = { date: todayStr(), chests: 0, opened: REGIONS.map(() => []), pig: 0, dungeon: 0, defense: 0, campSec: 0 };
  prog = { pigStage: 0, towerBest: 0, seen: 1 };
  regionData = REGIONS.map(() => ({ fog: '', bd: false, bs: false }));
  res = { wood: 0, stone: 0, gold: 0, meat: 0 }; life = { wood: 0, stone: 0, gold: 0, meat: 0 };
  paid = {}; for (const p of PADS) paid[p.id] = { wood: 0, stone: 0, gold: 0 };
  questIdx = 0; kills = 0; maxZone = 0; playTime = 0; now = 0;
  movedOnce = false; stoppedOnce = false; winT = 0; wipeT = 0;
  camp = null; mode = null; returnPos = null;
  buffs.atkT = buffs.aspdT = buffs.ampT = 0;
  pub = { line: [], picked: -1, pity: 0, next: 0, pulls: 0 };
  refreshLineup();
  heroes = [];
  recalcGear();
  regionIdx = 0;
  loadRegion(0);
}
// 지역 월드를 새로 만들고 원정대를 마을 한가운데로 옮긴다. 떠나는 지역의 안개는 저장해 둔다
function loadRegion(r, saveOld = false) {
  if (saveOld) RD().fog = fogString();
  regionIdx = r;
  genWorld(r); buildGround(r); markChests();
  monsters = []; pickups = []; projs = []; orbs = []; delayed = []; tokens = []; parts = []; texts = []; fxs = [];
  for (const d of dens) if (!(d.boss && RD().bd)) spawnPack(d);
  resetFog(); reveal(VC.x, VC.y, 560); loadFog(RD().fog);
  lastReveal.x = -9999;
  rebuildSquad(true);
  placeSquad(START.x, START.y);
}
function sailTo(r) {
  if (r === regionIdx) return;
  loadRegion(r, true);
  prog.seen = Math.max(prog.seen, r + 1);
  toast(`${REGIONS[r].name}에 도착했어요`);
  if (REGIONS[r].immune) toast(`이곳 몬스터는 ${STATUS[REGIONS[r].immune].name}에 걸리지 않아요`);
}
