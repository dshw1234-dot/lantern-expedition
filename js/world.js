'use strict';
// 등불 원정대 — 공통 도구, 캔버스, 게임 상태, 지역 생성(구역 · 지형 · 정화 마법진), 바닥 그림, 개체 만들기, 지역 이동

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
const inVillage = (x, y, pad = 0) => d2(x, y, VC.x, VC.y) < (VILLAGE_R + pad) ** 2;
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ================= 캔버스 =================
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
const CHUNK_PX = 640;                            // 바닥 그림: 구역 한 칸을 640px 그림 한 장으로. 화면에 보일 때 그려서 chunkCap장까지 들고 있는다
let chunkCap = 12;                               // 화면이 넓어 한 번에 더 많이 보이면 render가 늘린다
const chunks = new Map();                        // 칸 번호 → 바닥 그림
const mapCv = document.createElement('canvas');  // 지역 전체 지형 (지형 격자 한 칸 = 1픽셀). 미니맵과 지도 창이 쓴다
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
let nodes = [], dens = [], chests = [], portals = [], monsters = [], heroes = [];   // nodes · dens · chests · portals에는 안개가 걷힌 구역의 것만 들어 있다
let pickups = [], projs = [], orbs = [], parts = [], texts = [], fxs = [], tokens = [], delayed = [];
let res, life, lv, paid, kills, maxZone, movedOnce, stoppedOnce;
let roster;                    // 영웅별 { owned, lvl, shards, active } (HERO_DEFS와 같은 순서)
let pub;                       // 주점 { line: 카드 3장(영웅 번호), picked, pity, next, pulls }
let squad;                     // 용병단 { lvl, xp }
let gear;                      // 장비 { bag: [], eq: { 부위: 장비 }, uid }
let prod;                      // 생산소 { wood: {lvl, stored}, stone, gold, store, last(실제 시각 ms) }
let daily;                     // 하루 단위 기록 { date, chests, opened: [[지역별 연 상자 번호]], pig, dungeon, defense, campSec }
let prog;                      // 진행 { pigStage, towerBest, seen: 가 본 지역 수 }
let regionIdx = 0, regionData; // 지역별 { bd: 보스 처치, bs: 보스 발견, open: 안개를 걷은 구역 번호들, g: { 구역 번호: 마법진 진행 [사냥 수, 바친 나무, 돌, 금화] } }
let camp = null, mode = null, returnPos = null;
let plog = [];                 // 플레이 기록: 안개를 걷을 때마다 한 줄 (밸런스를 잡는 근거. 설정 창에서 복사한다)
let monId = 0;
const P = { x: START.x, y: START.y, moving: false, fx: 0, fy: -1 };   // 원정대 중심과 바라보는 방향
const cam = { x: START.x, y: START.y, shake: 0 };
const buffs = { atk: 0, atkT: 0, aspd: 0, aspdT: 0, amp: 0, ampT: 0 };   // 원정대 전체 일시 버프
const RD = () => regionData[regionIdx];
const REG = () => REGIONS[regionIdx];

// ================= 지형 =================
// 지역마다 genWorld가 다시 채운다 (같은 지역 = 같은 seed = 언제나 같은 지도)
let sectors = [];              // 구역 { id, c, r, x, y(한가운데), parent, kids, trunk, depth, zone, mul, open, fade, gate, dens, nodes, chest, portal, way, boss }
let gates = [];                // 정화 마법진 { x, y, sec: 걷힐 구역, from: 서 있는 구역, req: 조건, n: 진행, paid, armed, guard }
let waypoints = [];            // 순간이동 표석 { x, y, sec, name }
let missions = [];             // 임무 사슬 [{ type, …, rw: 보상 }]. 마법진 조건과 같은 꼴이라 reqText · reqDone을 같이 쓴다
let mIdx = 0, mN = 0;          // 지금 임무의 번호, 그 임무에서 센 수 (사냥 · 채집). 지역마다 따로 저장된다
let villageExits = [];         // 마을 울타리가 뚫린 방향 (각도)
const CT = CELL / TILE, TW = WORLD_W / TILE, TH = WORLD_H / TILE;
const tiles = new Uint8Array(TW * TH);             // 1 = 걸을 수 있는 땅, 0 = 산
const cellSec = new Int16Array(GRID_W * GRID_H);   // 칸 → 구역 번호 (-1 = 구역이 아닌 산악 지대)
const inWorld = (x, y) => x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
const tileAt = (x, y) => (inWorld(x, y) ? tiles[((y / TILE) | 0) * TW + ((x / TILE) | 0)] : 0);
const secAt = (x, y) => (inWorld(x, y) ? sectors[cellSec[((y / CELL) | 0) * GRID_W + ((x / CELL) | 0)]] || null : null);
const canWalk = (x, y) => { if (!tileAt(x, y)) return false; const s = secAt(x, y); return !!s && s.open; };   // 땅이고, 안개가 걷힌 구역인가
const isRevealed = (x, y) => { const s = secAt(x, y); return !!s && s.open; };
const zoneAt = (x, y) => { if (inVillage(x, y)) return 0; const s = secAt(x, y); return s ? s.zone : 0; };
const openCount = () => sectors.reduce((n, s) => n + (s.open && s.id ? 1 : 0), 0);   // 마을을 뺀, 안개가 걷힌 구역 수
// 부모 구역 한가운데(t = 0)에서 자식 구역 한가운데(t = 1)로 가는 길 위의 점. 가운데가 살짝 휜다
function neck(p, s, t) {
  const k = Math.sin(t * Math.PI) * s.bend;
  return { x: p.x + (s.x - p.x) * t + (s.y - p.y) / CELL * k, y: p.y + (s.y - p.y) * t - (s.x - p.x) / CELL * k };
}

// 구역의 땅 모양: 한가운데에서 각도 a 쪽으로 땅 끝까지의 거리 (모서리가 둥근 네모에 굴곡을 준 것)
function blobR(s, a) {
  const k = 1 + 0.1 * Math.sin(a * 3 + s.ph[0]) + 0.07 * Math.sin(a * 5 + s.ph[1]) + 0.05 * Math.sin(a * 7 + s.ph[2]);
  const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), lim = CELL / 2 - 60;
  return Math.min(Math.pow(Math.pow(c / (s.rx * k), 2.6) + Math.pow(sn / (s.ry * k), 2.6), -1 / 2.6), lim / Math.max(c, sn, 0.001));
}
function makeNode(kind, x, y, rnd) {
  const nd = NODE_DEFS[kind];
  const poly = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; poly.push([Math.cos(a) * (0.75 + rnd() * 0.35), Math.sin(a) * (0.55 + rnd() * 0.3)]); }
  return { isNode: true, kind, nd, x, y, r: nd.r, hp: nd.hp, maxHp: nd.hp, acc: 0, left: Math.floor(nd.hp / nd.per), respawnAt: 0, shake: 0, hitT: 0, poly };
}

// ================= 지역 생성 =================
// 1) 마을에서 출발해 구불구불 이어지는 본줄기(TRUNK_LEN칸)를 고른다  2) 곁가지를 붙인다
// 3) 칸마다 울퉁불퉁한 땅을 파고, 이웃한 구역끼리 길목으로 잇는다     4) 소굴 · 자원 · 상자 · 던전 입구 · 표석 · 마법진을 놓는다
function genWorld(r) {
  const R = REGIONS[r], rnd = mulberry32(R.seed);
  const RR = (a, b) => a + (b - a) * rnd(), RI = (a, b) => Math.floor(RR(a, b + 1)), RP = arr => arr[Math.floor(rnd() * arr.length)];
  const DIRS = [[0, -1], [1, 0], [-1, 0], [0, 1]];
  nodes = []; dens = []; chests = []; portals = []; sectors = []; gates = []; waypoints = [];
  cellSec.fill(-1); tiles.fill(0); chunks.clear();
  const used = new Uint8Array(GRID_W * GRID_H), ci = (c, q) => q * GRID_W + c;
  const free = (c, q) => c >= 0 && q >= 0 && c < GRID_W && q < GRID_H && !used[ci(c, q)];

  // ---- 1) 본줄기: 스스로를 밟지 않는 걸음. 막히면 한 칸 물러나 다른 쪽으로 간다 ----
  const path = [[VCELL.c, VCELL.r]];
  used[ci(VCELL.c, VCELL.r)] = 1;
  let budget = 0;
  const step = last => {
    if (path.length > TRUNK_LEN) return true;
    if (--budget < 0) return false;
    const [c, q] = path[path.length - 1], opts = [];
    DIRS.forEach(([dx, dy], k) => {   // 옆으로 길게 가다가 가끔 위로 꺾이도록 가중치를 준다
      if (free(c + dx, q + dy)) opts.push({ k, c: c + dx, q: q + dy, w: (dy < 0 ? 1.5 : dy > 0 ? 0.3 : 2.2) * (k === last ? 1.6 : 1) * (0.2 + rnd()) });
    });
    opts.sort((a, b) => b.w - a.w);
    for (const o of opts) {
      used[ci(o.c, o.q)] = 1; path.push([o.c, o.q]);
      if (step(o.k)) return true;
      path.pop(); used[ci(o.c, o.q)] = 0;
    }
    return false;
  };
  do { budget = 20000; } while (!step(-1));

  const zoneOf = depth => (depth <= 0 ? 0 : depth <= ZONE_END[0] ? 1 : depth <= ZONE_END[1] ? 2 : 3);
  const addSector = (c, q, parent, trunk) => {
    const depth = parent ? parent.depth + 1 : 0;
    const s = { id: sectors.length, c, r: q, x: (c + 0.5) * CELL, y: (q + 0.5) * CELL, parent: parent ? parent.id : -1, kids: [], trunk, depth, zone: zoneOf(depth), mul: Math.pow(DEPTH_MUL, Math.max(0, depth - 1)),
      open: depth <= 1, fade: 0, gate: null, dens: [], nodes: [], chest: null, portal: null, way: null, boss: false,
      bend: RR(-60, 60), rx: RR(0.36, 0.43) * CELL, ry: RR(0.36, 0.43) * CELL, ph: [RR(0, TAU), RR(0, TAU), RR(0, TAU)] };
    used[ci(c, q)] = 1; cellSec[ci(c, q)] = s.id; sectors.push(s);
    if (parent) parent.kids.push(s.id);
    return s;
  };
  path.forEach(([c, q], i) => addSector(c, q, i ? sectors[i - 1] : null, true));
  const last = sectors[TRUNK_LEN];
  last.boss = true; last.rx = last.ry = 0.43 * CELL; last.bend *= 0.3;

  // ---- 2) 곁가지: 본줄기나 다른 곁가지에서 1~3칸 뻗는 막다른 길 ----
  for (let made = 0, tries = 0; made < BRANCH_CELLS && tries < 600; tries++) {
    let cur = sectors[RI(1, sectors.length - 1)];
    if (cur.boss || cur.kids.length >= 3) continue;
    for (let n = RI(1, 3); n > 0 && made < BRANCH_CELLS; n--) {
      const opts = DIRS.filter(([dx, dy]) => free(cur.c + dx, cur.r + dy));
      if (!opts.length) break;
      const [dx, dy] = RP(opts);
      cur = addSector(cur.c + dx, cur.r + dy, cur, false); made++;
    }
  }

  // ---- 3) 지형 ----
  const setTiles = (x, y, rad, v, keep) => {   // 원 안의 격자를 v로. keep이 있으면 그 조건을 채운 칸만
    const x0 = Math.max(0, Math.floor((x - rad) / TILE)), x1 = Math.min(TW - 1, Math.floor((x + rad) / TILE));
    const y0 = Math.max(0, Math.floor((y - rad) / TILE)), y1 = Math.min(TH - 1, Math.floor((y + rad) / TILE));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
      if (d2(px, py, x, y) < rad * rad && (!keep || keep(px, py))) tiles[ty * TW + tx] = v;
    }
  };
  for (const s of sectors) {   // 칸마다 울퉁불퉁한 땅. 칸 가장자리는 산으로 남겨 이웃 칸과 붙지 않게 한다
    const lim = CELL / 2 - (s.id ? 60 : 40);
    for (let ty = s.r * CT; ty < (s.r + 1) * CT; ty++) for (let tx = s.c * CT; tx < (s.c + 1) * CT; tx++) {
      const dx = (tx + 0.5) * TILE - s.x, dy = (ty + 0.5) * TILE - s.y;
      if (Math.abs(dx) >= lim || Math.abs(dy) >= lim) continue;
      if (!s.id) { if (dx * dx + dy * dy < 428 * 428) tiles[ty * TW + tx] = 1; continue; }   // 마을은 둥글게
      if (Math.hypot(dx, dy) < blobR(s, Math.atan2(dy, dx))) tiles[ty * TW + tx] = 1;
    }
  }
  for (const s of sectors) {   // 길목: 부모 구역과 잇는다
    if (s.parent < 0) continue;
    const p = sectors[s.parent];
    for (let t = 0; t <= 1.0001; t += 0.025) { const q = neck(p, s, t); setTiles(q.x, q.y, 105, 1); }
  }
  // 길에서 떨어진 자리에 바위 무더기를 놓아 구역 안을 덜 밋밋하게 한다
  const roads = s => [s.parent >= 0 ? sectors[s.parent] : null, ...s.kids.map(k => sectors[k])].filter(Boolean);
  const nearRoad = (s, x, y, lim) => roads(s).some(o => {   // 구역 한가운데 → 이웃 한가운데 선분까지의 거리
    const vx = o.x - s.x, vy = o.y - s.y, t = clamp(((x - s.x) * vx + (y - s.y) * vy) / (vx * vx + vy * vy), 0, 1);
    return d2(x, y, s.x + vx * t, s.y + vy * t) < lim * lim;
  });
  for (const s of sectors) {
    if (!s.id || s.boss) continue;
    for (let n = RI(0, 2); n > 0; n--) {
      const a = RR(0, TAU), rr = RR(150, 270), x = s.x + Math.cos(a) * rr, y = s.y + Math.sin(a) * rr, rad = RR(45, 72);
      if (!nearRoad(s, x, y, rad + 150)) setTiles(x, y, rad, 0);
    }
  }
  paintMap(R);

  // ---- 4) 구역에 놓을 것들 ----
  const clearAt = (x, y, c) => tileAt(x, y) && tileAt(x - c, y) && tileAt(x + c, y) && tileAt(x, y - c) && tileAt(x, y + c);
  const spot = (s, rMin, rMax, clear, avoid = []) => {   // 구역 안의 빈 자리. avoid = [[대상, 떨어질 거리], ...]
    for (let i = 0; i < 80; i++) {
      const a = RR(0, TAU), rr = RR(rMin, rMax), x = s.x + Math.cos(a) * rr, y = s.y + Math.sin(a) * rr;
      if (Math.abs(x - s.x) > CELL / 2 - 70 || Math.abs(y - s.y) > CELL / 2 - 70 || !clearAt(x, y, clear)) continue;
      if (avoid.some(([o, dd]) => o && d2(o.x, o.y, x, y) < dd * dd)) continue;
      return { x, y };
    }
    return null;
  };
  // 마법진: 길목에서 자식 구역 쪽 경계 바로 앞 (부모 구역 안)
  for (const s of sectors) {
    if (s.depth <= 1) continue;
    const p = sectors[s.parent], q = neck(p, s, 0.5 - 125 / CELL);
    s.gate = { x: q.x, y: q.y, sec: s.id, from: p.id, req: null, n: 0, paid: { wood: 0, stone: 0, gold: 0 }, t0: -1, armed: true, guard: null };   // t0 = 갈 수 있게 된 때의 플레이 시간
    gates.push(s.gate);
  }
  const NODE_SETS = {
    1: [[['tree'], 4, 6, 105], [['tree'], 4, 6, 105], [['rock'], 3, 4, 85]],
    2: [[['bigtree', 'tree', 'bigtree'], 4, 7, 125], [['bigtree', 'tree'], 3, 5, 115], [['rock', 'rock', 'crystal'], 3, 5, 90]],
    3: [[['deadtree'], 3, 5, 100], [['rock', 'crystal', 'crystal'], 3, 5, 95], [['rock', 'crystal'], 3, 4, 90]],
  };   // [종류 후보, 최소, 최대, 퍼지는 반경]
  let chestN = 0;
  for (const s of sectors) {
    if (!s.id) continue;
    const ent = neck(sectors[s.parent], s, 0.5), exits = s.kids.map(k => sectors[k].gate).filter(Boolean);
    const away = [[ent, 330], ...exits.map(g => [g, 230])];
    if (s.boss) {
      s.dens.push({ x: s.x, y: s.y, zone: 3, pack: { boss: [1, 1] }, members: [], respawnAt: 0, boss: true, mul: BOSS_MUL, depth: s.depth });
      BOSS_POS.x = s.x; BOSS_POS.y = s.y;
      continue;
    }
    for (let n = s.depth === 1 ? 2 : s.trunk ? RI(2, 3) : 2; n > 0; n--) {
      const q = spot(s, 60, 300, 70, [...away, ...s.dens.map(d => [d, 250])]);
      if (q) s.dens.push({ x: q.x, y: q.y, zone: s.zone, pack: s.depth === 1 ? { slime: [3, 4] } : RP(PACKS[s.zone]), members: [], respawnAt: 0, mul: s.mul, depth: s.depth });
    }
    const sets = s.depth === 1 ? [...NODE_SETS[1], [['rock'], 3, 4, 85]] : NODE_SETS[s.zone];   // 첫 구역은 돌을 한 무더기 더
    for (const [kinds, a, b, spread] of sets) {
      const c = spot(s, 80, 300, 50, s.dens.map(d => [d, 110]));
      if (!c) continue;
      for (let want = RI(a, b), tries = want * 8; want > 0 && tries > 0; tries--) {   // 서로 겹치지 않는 자리를 찾을 때까지 여러 번 던져 본다
        const an = RR(0, TAU), rr = spread * Math.sqrt(rnd()), x = c.x + Math.cos(an) * rr, y = c.y + Math.sin(an) * rr, kind = RP(kinds), nd = NODE_DEFS[kind];
        if (!clearAt(x, y, 30) || s.nodes.some(o => d2(o.x, o.y, x, y) < (o.r + nd.r + 12) ** 2) || exits.some(g => d2(g.x, g.y, x, y) < 90 * 90)) continue;
        s.nodes.push(makeNode(kind, x, y, rnd)); want--;
      }
    }
    const cq = spot(s, 100, 320, 40, [...s.dens.map(d => [d, 130]), ...exits.map(g => [g, 120])]);
    if (cq) s.chest = { x: cq.x, y: cq.y, i: chestN++, zone: s.zone };
    if (s.trunk && s.depth % WAY_EVERY === 0) {
      const wq = spot(s, 0, 140, 50, s.dens.map(d => [d, 170])) || { x: s.x, y: s.y };
      s.way = { isWay: true, x: wq.x, y: wq.y, sec: s.id, name: `${ZONE_NAMES[s.zone]} 표석` };
    }
  }
  sectors[0].way = { isWay: true, x: VC.x, y: VC.y - 100, sec: 0, name: '마을' };
  waypoints = sectors.filter(s => s.way).map(s => s.way);
  waypoints.forEach((w, i) => { w.i = i; if (i) w.name += ` ${i}`; });
  // 던전 입구: 구역 종류마다 하나. 되도록 막다른 곁가지에 둔다
  for (let z = 1; z <= 3; z++) {
    const all = sectors.filter(s => s.zone === z && !s.boss && s.depth > 1), ends = all.filter(s => !s.trunk && !s.kids.length);
    const s = RP(ends.length ? ends : all);
    if (!s) continue;
    const q = spot(s, 60, 300, 60, [...s.dens.map(d => [d, 150]), [s.chest, 90], [s.way, 110]]);
    if (q) s.portal = { x: q.x, y: q.y, zone: z, armed: true };
  }
  // 마법진의 조건과 임무 사슬 (여기서는 난수를 쓰지 않는다. 표를 고쳐도 지도 모양은 그대로다)
  // 사냥의 대상: 그 구역(없으면 그 앞 구역)에 가장 많이 사는 몬스터. [종류, 한 번에 나오는 수]
  const ownMon = p => {
    const normal = o => !o.boss && !o.guard;
    while (p.id > 1 && !p.dens.some(normal)) p = sectors[p.parent];
    const cnt = {};
    for (const d of p.dens.filter(normal)) for (const k in d.pack) cnt[k] = (cnt[k] || 0) + d.pack[k][0];
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    return best ? [best, cnt[best]] : ['slime', 4];
  };
  const hunt = (p, n) => { const [mon, per] = ownMon(p); return { type: 'hunt', mon, n: Math.min(n, per * HUNT_CYCLES) }; };   // 드문 몬스터라면 수를 줄인다
  let sideN = 0;
  for (const s of sectors) {
    const g = s.gate;
    if (!g) continue;
    if (s.trunk) { g.req = { type: 'pay', cost: fogCost(s.depth) }; continue; }   // 본줄기: 임무가 여기까지 와야 하고, 값을 바친다
    const kind = ['pay', 'hunt', 'elite'][sideN++ % 3], p = sectors[g.from];
    if (kind === 'pay') g.req = { type: 'pay', cost: sidePay(s.depth) };
    else if (kind === 'hunt') g.req = hunt(p, sideHunt(s.depth));
    else {   // 마법진 앞을 지키는 정예. 잡으면 다시 나오지 않는다
      const q = neck(p, s, 0.5 - 300 / CELL);
      g.req = { type: 'elite', n: 1 };
      g.guard = { x: q.x, y: q.y, zone: p.zone || 1, pack: { [GUARD[p.zone || 1]]: [1, 1] }, members: [], respawnAt: 0, mul: s.mul * GUARD_MUL, depth: s.depth, guard: g };
      p.dens.push(g.guard);
    }
  }
  // 임무 사슬: 안개 하나마다 [지금 할 일] → [새로 올라야 할 성장 목표] → [안개 걷기]
  missions = [];
  const have = { forge: 0, barracks: 0, lantern: 0, owned: 2, squad: 1 };
  for (let t = 2, gk = 0; t <= TRUNK_LEN; t++) {
    const s = sectors[t], add = m => { m.rw = misReward(t); missions.push(m); };
    if (t === 2) add({ type: 'gather', res: 'wood', n: fogCost(2).wood });
    else if (t % 2) add(hunt(sectors[t - 1], misHunt(t)));
    else add(Object.assign({ type: 'gather' }, misGather(t, gk++)));
    for (const k of ['forge', 'barracks', 'lantern']) { const v = CURVE[k](t); if (v > have[k]) { have[k] = v; add({ type: 'build', pad: k, lv: v }); } }
    let v = CURVE.owned(t); if (v > have.owned) { have.owned = v; add({ type: 'recruit', n: v }); }
    v = CURVE.squad(t); if (v > have.squad) { have.squad = v; add({ type: 'squad', lv: v }); }
    if (t % MIS_HERO_EVERY === 0) add(t % (MIS_HERO_EVERY * 2) ? { type: 'herolv', lv: CURVE.hero(t), cnt: 1 } : { type: 'herolv', lv: CURVE.hero2(t), cnt: 2 });
    s.gate.mi = missions.length;   // 이 마법진은 임무가 여기에 닿아야 쓸 수 있다
    add({ type: 'fog', sec: s.id });
  }
  villageExits = sectors[0].kids.map(k => Math.atan2(sectors[k].y - VC.y, sectors[k].x - VC.x));
}
// 지역 전체를 지형 격자 한 칸 = 1픽셀로 그려 둔다 (미니맵 · 지도 창용)
function zoneRGB(R) { const n = parseInt(R.base.slice(1), 16); return [R.plaza, R.meadow, R.forest, `${n >> 16},${(n >> 8) & 255},${n & 255}`].map(s => s.split(',').map(Number)); }
function paintMap(R) {
  mapCv.width = TW; mapCv.height = TH;
  const g = mapCv.getContext('2d'), img = g.createImageData(TW, TH), d = img.data, Z = zoneRGB(R);
  const rock = parseInt(R.rock[0].slice(1), 16), rk = [rock >> 16, (rock >> 8) & 255, rock & 255];
  for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
    const s = sectors[cellSec[((ty / CT) | 0) * GRID_W + ((tx / CT) | 0)]], i = (ty * TW + tx) * 4;
    const c = tiles[ty * TW + tx] && s ? Z[s.zone] : rk, k = tiles[ty * TW + tx] ? 1 : s ? 1 : 0.6;
    d[i] = c[0] * k; d[i + 1] = c[1] * k; d[i + 2] = c[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ================= 바닥 그림 (칸 단위로, 화면에 보일 때 그린다) =================
function groundChunk(ci) {
  let c = chunks.get(ci);
  if (c) { chunks.delete(ci); chunks.set(ci, c); return c; }   // 방금 쓴 것을 맨 뒤로 보낸다
  if (chunks.size >= chunkCap) { const k = chunks.keys().next().value; c = chunks.get(k); chunks.delete(k); }   // 가장 오래 안 쓴 그림을 다시 쓴다
  else { c = document.createElement('canvas'); c.width = c.height = CHUNK_PX; }
  paintChunk(c, ci);
  chunks.set(ci, c);
  return c;
}
function paintChunk(cvs, ci) {
  const g = cvs.getContext('2d'), R = REG(), cc = ci % GRID_W, cr = (ci / GRID_W) | 0, x0 = cc * CELL, y0 = cr * CELL, k = CHUNK_PX / CELL;
  const me = sectors[cellSec[ci]], Z = zoneRGB(R);
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  g.globalAlpha = 1;
  g.fillStyle = me ? `rgb(${Z[me.zone]})` : R.rock[0]; g.fillRect(x0, y0, CELL, CELL);
  if (me) {
    // 얼룩: 좌표로 정해지는 무늬라서 이웃 칸의 그림과 어긋나지 않는다
    const S = 110;
    for (let gy = Math.floor(y0 / S) - 1; gy <= Math.floor((y0 + CELL) / S) + 1; gy++) for (let gx = Math.floor(x0 / S) - 1; gx <= Math.floor((x0 + CELL) / S) + 1; gx++) {
      const h = hash2(gx * 3 + 1, gy * 5 + 2), h2 = hash2(gy * 7 + 3, gx * 11 + 4), x = (gx + h) * S, y = (gy + h2) * S, z = zoneAt(x, y);
      if (!z) continue;
      g.globalAlpha = 0.1 + h2 * 0.12; g.fillStyle = R.shades[z][(h * 3) | 0];
      g.beginPath(); g.ellipse(x, y, 20 + h * 80, 14 + h2 * 50, h * TAU, 0, TAU); g.fill();
      if (z === 3 && h > 0.72) { g.globalAlpha = 0.28; g.strokeStyle = '#2d2c3a'; g.lineWidth = 3; g.fillStyle = shade(R.base, 0.12); const w = 30 + h2 * 40; g.fillRect(x, y, w, w * 0.7); g.strokeRect(x, y, w, w * 0.7); }
    }
    g.globalAlpha = 1; g.lineCap = 'round'; g.lineJoin = 'round';
    // 길: 이 칸과 이웃 구역을 잇는 길목을 따라
    const road = (p, s) => {
      g.beginPath();
      for (let t = 0; t <= 1.0001; t += 0.05) { const q = neck(p, s, t); if (t === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y); }
      g.strokeStyle = R.snow ? 'rgba(170,180,195,0.5)' : 'rgba(96,78,56,0.55)'; g.lineWidth = 46; g.stroke();
      g.strokeStyle = R.snow ? 'rgba(220,230,240,0.35)' : 'rgba(130,108,78,0.35)'; g.lineWidth = 25; g.stroke();
    };
    if (me.parent >= 0) road(sectors[me.parent], me);
    for (const kid of me.kids) road(me, sectors[kid]);
    if (!me.id) { g.strokeStyle = 'rgba(160,130,95,0.35)'; g.lineWidth = 10; g.beginPath(); g.arc(VC.x, VC.y, VILLAGE_R - 15, 0, TAU); g.stroke(); }
  }
  // 산: 땅과 맞닿은 곳은 둥글게 불룩하게, 군데군데 봉우리를 세운다
  const tx0 = cc * CT - 1, ty0 = cr * CT - 1, tx1 = (cc + 1) * CT, ty1 = (cr + 1) * CT;
  const wall = (tx, ty) => tx < 0 || ty < 0 || tx >= TW || ty >= TH || !tiles[ty * TW + tx];
  g.fillStyle = R.rock[0];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!wall(tx, ty)) continue;
    g.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
    if (!wall(tx - 1, ty) || !wall(tx + 1, ty) || !wall(tx, ty - 1) || !wall(tx, ty + 1)) { g.beginPath(); g.arc((tx + 0.5) * TILE, (ty + 0.5) * TILE, 27, 0, TAU); g.fill(); }
  }
  for (let ty = ty0 - 1; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!wall(tx, ty)) continue;
    const h = hash2(tx * 13 + 5, ty * 17 + 9);
    if (h < 0.5) continue;
    const h2 = hash2(ty * 19 + 1, tx * 23 + 7), x = (tx + 0.2 + h2 * 0.6) * TILE, y = (ty + 0.9) * TILE, w = 20 + h * 16, ht = 30 + h2 * 30;
    g.fillStyle = R.rock[1]; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x, y - ht); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.fillStyle = R.rock[2]; g.beginPath(); g.moveTo(x, y - ht); g.lineTo(x + w * 0.22, y - ht * 0.55); g.lineTo(x - w * 0.1, y - ht * 0.42); g.lineTo(x - w * 0.42, y - ht * 0.58); g.closePath(); g.fill();
  }
}

// ================= 구역 열기 =================
// 구역 안의 소굴 · 자원 · 상자 · 던전 입구를 게임에 내놓는다. fx = 안개가 걷히는 연출
function openSector(s, fx) {
  s.open = true; s.fade = fx ? 1 : 0;
  nodes.push(...s.nodes);
  for (const d of s.dens) {
    dens.push(d);
    const gone = d.boss ? RD().bd : d.guard && (d.guard.n >= 1 || sectors[d.guard.sec].open);
    if (!gone) spawnPack(d);
  }
  if (s.chest) { s.chest.opened = daily.opened[regionIdx].includes(s.chest.i); chests.push(s.chest); }
  if (s.portal) portals.push(s.portal);
  for (const k of s.kids) { const g = sectors[k].gate; if (g && g.t0 < 0) g.t0 = playTime; }   // 이 구역에서 갈 수 있는 마법진들이 이제부터 진행을 센다
}
// 저장할 수 있게 지금 지역의 진행을 regionData에 옮겨 적는다
function saveRegionState() {
  if (!regionData || !sectors.length) return;
  const d = RD();
  d.open = sectors.filter(s => s.open && s.depth > 1).map(s => s.id);
  d.mi = mIdx; d.mn = mN;
  d.g = {};
  for (const g of gates) if (!sectors[g.sec].open && sectors[g.from].open) d.g[g.sec] = [g.n, g.paid.wood, g.paid.stone, g.paid.gold, Math.round(g.t0)];
}

// ================= 생성 =================
function makeHero(idx, x, y, clone = false) {
  const def = HERO_DEFS[idx];
  const h = { isHero: true, def, idx, x, y, clone, hp: 1, maxHp: 0, cd: rand(0, 0.4), skillCd: def.s1.cd * 0.5, s2cd: 0, icd: 0, basicCount: 0,
    think: 0, target: null, down: false, downT: 0, invulnT: 0, flash: 0, swing: 0, guardT: 0, face: 1, walk: false, s4cd: 6, awakeT: 0 };
  refreshHp(h); h.hp = h.maxHp;
  return h;
}
// 몬스터 수치는 태어날 때 정해진다: 지역 배율 × 구역 깊이 배율(또는 도전 콘텐츠 배율) × 정예 배율
function makeMonster(type, x, y, den, elite = false, mulOverride) {
  const b = MON[type], R = REG();
  const mul = mulOverride != null ? mulOverride : R.mul * MON_BASE * ((den && den.mul) || 1);
  const hp = Math.round(b.hp * mul * (elite ? 3 : 1));
  const col = type === 'boss' ? R.bossCol : (R.tint && R.tint[type]) || b.col;
  return { isMon: true, id: ++monId, type, d: b, x, y, hp, maxHp: hp, atk: b.atk * mul * (elite ? 1.5 : 1), r: b.r * (elite ? 1.3 : 1), col, elite, mul,
    den, state: 'idle', target: null, forced: null, forcedT: 0, cd: rand(0.2, b.rate), wT: rand(0, 2), wx: x, wy: y, flash: 0,
    st: {}, stunT: 0, frozenT: 0, dead: false, ph: rand(0, TAU), look: rand(0, 0.25), atkAnim: 0, face: 1, walk: false, stuckT: 0,
    skillT: 5, sumT: 12, slam: null, summoned: false, arena: false };
}
function spawnPack(den) {
  den.members = [];
  const eliteIdx = den.guard ? 0 : !den.boss && Math.random() < ELITE_P[den.zone] ? 0 : -1;
  let k = 0;
  for (const type in den.pack) {
    const [a, b] = den.pack[type], n = randi(a, b);
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU), rr = den.boss || den.guard ? 0 : rand(10, 60);
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
const newRegionData = () => REGIONS.map(() => ({ bd: false, bs: false, open: [], g: {} }));
function newGame() {
  lv = { lantern: 0, forge: 0, barracks: 0, ship: 0 };
  roster = HERO_DEFS.map((d, i) => ({ owned: i < 2, lvl: 1, shards: 0, active: i < 2 }));
  squad = { lvl: 1, xp: 0 };
  gear = { bag: [], eq: {}, uid: 0 };
  prod = { wood: { lvl: 1, stored: 0 }, stone: { lvl: 1, stored: 0 }, gold: { lvl: 1, stored: 0 }, store: 1, last: Date.now() };
  daily = { date: todayStr(), chests: 0, opened: REGIONS.map(() => []), pig: 0, dungeon: 0, defense: 0, campSec: 0 };
  prog = { pigStage: 0, towerBest: 0, seen: 1 };
  regionData = newRegionData();
  res = { wood: 0, stone: 0, gold: 0, meat: 0 }; life = { wood: 0, stone: 0, gold: 0, meat: 0 };
  paid = {}; for (const p of PADS) paid[p.id] = { wood: 0, stone: 0, gold: 0 };
  kills = 0; maxZone = 0; playTime = 0; now = 0; plog = [];
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
// 지역 지도를 새로 만들고, 저장된 진행(걷은 안개 · 마법진 진행)을 입힌 뒤 원정대를 마을 한가운데로 옮긴다
function loadRegion(r, saveOld = false) {
  if (saveOld) saveRegionState();
  regionIdx = r;
  genWorld(r);
  monsters = []; pickups = []; projs = []; orbs = []; delayed = []; tokens = []; parts = []; texts = []; fxs = [];
  const d = RD();
  for (const id of d.open || []) { const s = sectors[id]; if (s) s.open = true; }
  for (const s of sectors) if (s.open && s.parent >= 0 && !sectors[s.parent].open) s.open = false;   // 부모가 닫혀 있으면 열릴 수 없다 (지도가 바뀐 옛 저장 대비)
  for (const g of gates) { const q = (d.g || {})[g.sec]; if (q) { g.n = q[0] | 0; g.paid = { wood: q[1] | 0, stone: q[2] | 0, gold: q[3] | 0 }; if (q[4] != null) g.t0 = +q[4] || 0; } }
  for (const s of sectors) if (s.open) openSector(s, false);
  // 임무 번호. 임무가 생기기 전의 저장이라면, 이미 걷은 가장 깊은 안개 바로 다음 임무에서 시작한다
  const deep = sectors.filter(s => s.trunk && s.open && s.gate).pop();
  mIdx = d.mi != null ? clamp(d.mi | 0, 0, missions.length) : deep ? deep.gate.mi + 1 : 0;
  mN = d.mi != null ? d.mn | 0 : 0;
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
