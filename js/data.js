'use strict';
// 등불 원정대 — 데이터 표. 수치를 바꿔 밸런스를 맞출 때는 이 파일만 고치면 된다.

// ================= 기본 상수 =================
const TAU = Math.PI * 2;
// 지역 하나 = 구역(칸) GRID_W x GRID_H 격자. 그 가운데 일부 칸만 길로 이어진 구역이 되고, 나머지는 산이다
const CELL = 880;                            // 구역 한 칸의 크기
const GRID_W = 9, GRID_H = 12;
const WORLD_W = CELL * GRID_W, WORLD_H = CELL * GRID_H;   // 7920 x 10560
const TILE = 40;                             // 지형 격자 한 칸 (땅 / 산)
const VCELL = { c: 4, r: 11 };               // 마을이 놓이는 칸 (맨 아래 가운데)
const VC = { x: (VCELL.c + 0.5) * CELL, y: (VCELL.r + 0.5) * CELL };   // 마을 중심
const VILLAGE_R = 400;                       // 마을 반경. 몬스터는 들어오지 못한다
const TRUNK_LEN = 36;                        // 본줄기 구역 수 (마을에서 보스까지). 앞 · 가운데 · 뒤 1/3씩이 들판 · 숲 · 폐허
const BRANCH_CELLS = 16;                     // 곁가지 구역 수 (들르지 않아도 되는 막다른 길)
const WAY_EVERY = 6;                         // 본줄기 구역 몇 개마다 순간이동 표석을 둘지
const DEPTH_MUL = 1.05;                      // 구역이 하나 깊어질 때마다 몬스터 체력 · 공격력 배율
const BOSS_MUL = 5;                          // 지역 보스 배율
const ENGAGE = 300;                          // 멈췄을 때 싸움을 거는 거리 (원정대 중심 기준)
const GATHER = 250;                          // 멈췄을 때 채집하러 가는 거리
const BOSS_POS = { x: 0, y: 0 };             // 보스 자리. 지역을 만들 때 마지막 구역 한가운데로 정해진다
const START = { x: VC.x, y: VC.y + 10 };
const ARENA = { x: WORLD_W + 1500, y: 1800, r: 520 };   // 도전 콘텐츠 전용 경기장 (월드 바깥에 둔다)
const SAVE_KEY = 'lantern-expedition-v1';
const SETTINGS_KEY = 'lantern-expedition-settings';
const JR = 56;                               // 조이스틱 반경 (px)
const REVIVE_T = 10;                         // 필드에서 쓰러진 영웅이 일어나기까지 (초)
const MAX_HERO_LV = 20;
const SKILL2_LV = 5;                         // 두 번째 스킬이 열리는 영웅 레벨
const SQUAD_MAX_LV = 30;
const xpNeed = l => Math.round(12 * Math.pow(l, 1.55));   // 용병단 레벨 l → l+1
const CHESTS_PER_DAY = 25;
const BAG_MAX = 40;
const CAMP_PER_DAY = 3600;                   // 하루 캠프 시간 (초)
const OFFLINE_MAX_H = 72;                    // 오프라인 보상 최대 시간
const OFFLINE_CHEST_MIN = 20;                // 오프라인 동안 이 분마다 상자 1개

// ================= 영웅 =================
// onHit: 기본 공격에 붙는 상태이상 { st, n: 중첩, p: 확률 }
// s1: 쿨타임 스킬, s2: 영웅 레벨 SKILL2_LV에 열리는 스킬 (trig: every=기본 공격 n번마다, crit=치명타 시, status=상태이상 대상 적중 시, cd=쿨타임, passive=상시)
const HERO_DEFS = [
  { id: 'luke', name: '방패 루크', short: '루크', role: '탱커', rarity: 'rare', color: '#5b8def', hp: 260, atk: 10, rate: 1.0, range: 0, r: 16,
    s1: { name: '도발', cd: 9, desc: '주변 적을 끌어당기고 4초 동안 받는 피해 절반' },
    s2: { name: '방패 강타', trig: 'every', n: 4, desc: '기본 공격 4번마다 주변 적에게 150% 피해 + 밀쳐내기' } },
  { id: 'teo', name: '장궁 테오', short: '테오', role: '원거리', rarity: 'normal', color: '#6cc070', hp: 110, atk: 16, rate: 1.1, range: 230, r: 14, proj: 'arrow',
    s1: { name: '연사', cd: 7, desc: '가까운 적에게 화살 5발 (각 120%)' },
    s2: { name: '급소 사격', trig: 'crit', icd: 3, desc: '치명타가 터지면 체력이 가장 많은 적에게 300% 관통 화살' } },
  { id: 'bella', name: '성수 벨라', short: '벨라', role: '치유', rarity: 'epic', color: '#f1e3a0', hp: 120, atk: 6, rate: 1.0, range: 190, r: 14, proj: 'spark', heal: 18,
    s1: { name: '축복', cd: 12, desc: '체력 60% 아래 동료가 있으면 원정대 전체 35% 회복' },
    s2: { name: '부활의 기도', trig: 'cd', cd: 20, desc: '쓰러진 동료를 곧바로 일으켜 세움 (체력 50%)' } },
  { id: 'mina', name: '쌍검 미나', short: '미나', role: '근접', rarity: 'rare', color: '#ea6b8e', hp: 150, atk: 14, rate: 1.6, range: 0, r: 14, onHit: { st: 'bleed', n: 1, p: 0.5 },
    s1: { name: '회오리', cd: 6, desc: '주변 적 전부에게 220% 피해 + 출혈' },
    s2: { name: '처형', trig: 'status', st: 'bleed', need: 2, icd: 4, desc: '출혈 2중첩 이상인 적을 때리면 350% 추가 피해' } },
  { id: 'lora', name: '불꽃 로라', short: '로라', role: '광역', rarity: 'legend', color: '#ff8b3d', hp: 100, atk: 12, rate: 0.8, range: 210, r: 14, proj: 'fire', splash: 55, onHit: { st: 'burn', n: 1, p: 1 },
    s1: { name: '화염 폭발', cd: 10, desc: '적이 가장 많이 뭉친 곳에 운석 (450% + 화상 2중첩)' },
    s2: { name: '불꽃 비', trig: 'every', n: 5, desc: '기본 공격 5번마다 불덩이 3개 (120% + 화상)' } },
  { id: 'siu', name: '얼음창 시우', short: '시우', role: '빙결', rarity: 'epic', color: '#7fd6ea', hp: 150, atk: 11, rate: 1.2, range: 0, r: 15, reach: 30, onHit: { st: 'frost', n: 1, p: 1 },
    s1: { name: '서리 폭풍', cd: 11, desc: '주변 적에게 180% 피해 + 동상 2중첩' },
    s2: { name: '빙창 관통', trig: 'status', st: 'freeze', icd: 3, desc: '얼어붙은 적을 때리면 일직선으로 250% 관통' } },
  { id: 'ruby', name: '독침 루비', short: '루비', role: '중독', rarity: 'rare', color: '#b56be0', hp: 105, atk: 12, rate: 1.3, range: 220, r: 14, proj: 'dart', onHit: { st: 'poison', n: 1, p: 1 },
    s1: { name: '독 안개', cd: 9, desc: '4초 동안 독구름. 안에 있는 적이 계속 중독' },
    s2: { name: '맹독 폭발', trig: 'status', st: 'poison', need: 6, icd: 5, desc: '중독 6중첩 이상인 적을 터뜨려 중첩당 40% 피해' } },
  { id: 'bori', name: '도끼 보리', short: '보리', role: '돌격', rarity: 'epic', color: '#c98a4b', hp: 210, atk: 13, rate: 0.9, range: 0, r: 17, onHit: { st: 'bleed', n: 1, p: 1 },
    s1: { name: '회전 도끼', cd: 8, desc: '주변 적을 끌어당기며 200% 피해 + 출혈 2중첩' },
    s2: { name: '피의 갈증', trig: 'passive', desc: '입힌 피해의 15%만큼 체력 회복 (흡혈)' } },
  { id: 'chichi', name: '방울 치치', short: '치치', role: '응원', rarity: 'epic', color: '#f3a8f0', hp: 130, atk: 8, rate: 1.2, range: 200, r: 14, proj: 'note',
    s1: { name: '응원가', cd: 14, desc: '8초 동안 원정대 공격 속도 +30%' },
    s2: { name: '박자 맞추기', trig: 'every', n: 3, desc: '기본 공격 3번마다 5초 동안 원정대 피해 +20%' } },
  { id: 'kai', name: '번개 카이', short: '카이', role: '연쇄', rarity: 'legend', color: '#ffe066', hp: 110, atk: 14, rate: 0.9, range: 230, r: 14, proj: 'bolt', chain: 2,
    s1: { name: '뇌우', cd: 10, desc: '주변 적에게 번개 6번 (각 200%)' },
    s2: { name: '과부하', trig: 'crit', icd: 4, desc: '치명타가 터지면 적 5명을 잇는 번개 (각 120%)' } },
];
// 등급: weight = 주점 카드에 나올 비중, shards = 카드 한 장(×1)이 주는 조각
const RARITY = {
  normal: { name: '노말',     color: '#d6d3cc', weight: 40, shards: 8 },
  rare:   { name: '레어',     color: '#6aaeff', weight: 32, shards: 6 },
  epic:   { name: '에픽',     color: '#bb86ff', weight: 20, shards: 4 },
  legend: { name: '레전더리', color: '#ffc24d', weight: 8,  shards: 3 },
};
const RARITY_KEYS = Object.keys(RARITY);
const RARITY_TOTAL = RARITY_KEYS.reduce((a, k) => a + RARITY[k].weight, 0);
// 주점: cost = 모집 1회 금화, refresh = 카드 바꾸기 금화, auto = 자동 교체 간격(게임 시간 초), pity = 이만큼 바꾸면 레전더리 보장
const PUB = { cost: 20, refresh: 10, auto: 90, pity: 8 };
const lvCost = l => ({ shards: l < 5 ? 3 : l < 10 ? 5 : l < 15 ? 8 : 12, meat: 5 * l });

// ================= 몬스터 =================
const MON = {
  slime:    { name: '슬라임',    hp: 30,   atk: 4,  rate: 1.0, spd: 70,  r: 13, aggro: 190, gold: [1, 2],     meat: [1, 2],   xp: 2,   col: '#7ccf6b' },
  bigslime: { name: '큰 슬라임', hp: 90,   atk: 8,  rate: 1.2, spd: 55,  r: 20, aggro: 190, gold: [3, 5],     meat: [3, 4],   xp: 5,   col: '#4fae5d' },
  wolf:     { name: '안개 늑대', hp: 70,   atk: 8,  rate: 0.9, spd: 125, r: 15, aggro: 230, gold: [2, 4],     meat: [2, 3],   xp: 4,   col: '#9aa2b3' },
  golem:    { name: '이끼 골렘', hp: 240,  atk: 15, rate: 1.5, spd: 45,  r: 24, aggro: 180, gold: [5, 8],     meat: [4, 6],   xp: 9,   col: '#76806c' },
  skeleton: { name: '해골 병사', hp: 160,  atk: 13, rate: 1.1, spd: 80,  r: 15, aggro: 220, gold: [4, 6],     meat: [2, 4],   xp: 7,   col: '#e9e3d0' },
  wraith:   { name: '안개 망령', hp: 110,  atk: 12, rate: 1.7, spd: 70,  r: 15, aggro: 260, gold: [4, 7],     meat: [2, 4],   xp: 7,   col: '#a797ff', ranged: 190 },
  boss:     { name: '안개 군주', hp: 4200, atk: 30, rate: 1.3, spd: 62,  r: 40, aggro: 300, gold: [200, 200], meat: [50, 50], xp: 200, col: '#7b5cff', boss: true },
  pig:      { name: '황금 돼지', hp: 120,  atk: 0,  rate: 9,   spd: 125, r: 24, aggro: 9999, gold: [0, 0],    meat: [0, 0],   xp: 0,   col: '#ffcf4a', pig: true },
};
// 구역별 몬스터 무리 { 종류: [최소, 최대] }. 무리마다 ELITE_P 확률로 한 마리가 정예가 된다
const PACKS = {
  1: [{ slime: [4, 6] }, { slime: [3, 4], bigslime: [1, 1] }],
  2: [{ wolf: [3, 4] }, { golem: [1, 1], wolf: [2, 2] }, { golem: [2, 2] }],
  3: [{ skeleton: [3, 5] }, { wraith: [2, 2], skeleton: [2, 3] }, { wraith: [3, 3] }],
};
const ELITE_P = [0, 0.12, 0.2, 0.25];
// 자원 오브젝트: "반격하지 않는 적". per만큼 피해를 줄 때마다 자원 1개가 떨어진다
const NODE_DEFS = {
  tree:     { r: 20, hp: 50, res: 'wood',  per: 10 },
  bigtree:  { r: 28, hp: 90, res: 'wood',  per: 10 },
  deadtree: { r: 18, hp: 40, res: 'wood',  per: 10 },
  rock:     { r: 19, hp: 60, res: 'stone', per: 12 },
  crystal:  { r: 20, hp: 80, res: 'stone', per: 8 },
};

// ================= 상태이상 =================
// dot = 초당 (시전자 공격력 × dot × 중첩) 피해. max 중첩에 닿으면 특수 효과 뒤 초기화
//   중독 → 기절 1.5초 / 출혈 → 현재 체력 10% / 화상 → 주변 폭발 / 동상 → 결빙 1.6초
const STATUS = {
  poison: { name: '중독', max: 10, dur: 8, dot: 0.08, col: '#8fe36b' },
  bleed:  { name: '출혈', max: 3,  dur: 6, dot: 0.12, col: '#ff5a5a' },
  burn:   { name: '화상', max: 3,  dur: 4, dot: 0.3,  col: '#ff9a3d' },
  frost:  { name: '동상', max: 3,  dur: 4, slow: 0.12, col: '#9fe6ff' },
};

// ================= 지역 =================
// mul = 몬스터 체력·공격력 배율, loot = 드랍 배율, tier = 장비 등급 기준, immune = 이 지역 몬스터가 걸리지 않는 상태이상
const REGIONS = [
  { name: '안개 들판', seed: 20260929, mul: 1, loot: 1, tier: 0, boss: '안개 군주', bossCol: '#4b3a8f', crown: '#ffcf4a', eye: '#ff5ad1', immune: null,
    base: '#46455a', forest: '45,82,54', meadow: '76,120,60', plaza: '112,92,66', rock: ['#2a2733', '#4a4556', '#6a6478'], fog: '86,44,128',
    shades: [null, ['#5a8a45', '#3f6b35', '#6c9a50'], ['#244632', '#35603f', '#1d3b2a'], ['#3b3a4c', '#555468', '#4b4550']],
    tuft: ['#78ad58', '#3f7448'], tree: [['#2f6b3a', '#3b7d45', '#4f9555'], ['#1f4a31', '#2a5c3a', '#377048']], snow: false, tint: null },
  { name: '서리 군도', seed: 4411, mul: 2.6, loot: 1.6, tier: 3, boss: '서리 여왕', bossCol: '#2f5f8f', crown: '#dff6ff', eye: '#7ff0ff', immune: 'frost',
    base: '#566278', forest: '64,104,112', meadow: '132,160,172', plaza: '118,118,128', rock: ['#2c3644', '#4c5c70', '#e4f0f8'], fog: '70,96,150',
    shades: [null, ['#a9c3cc', '#8eaab6', '#c6dbe2'], ['#3f6a70', '#557f86', '#335a60'], ['#4d586c', '#667287', '#5a6478']],
    tuft: ['#d8ecf2', '#9cc7cc'], tree: [['#2e5e62', '#3c7175', '#e8f4f8'], ['#244c52', '#305f66', '#e8f4f8']], snow: true,
    tint: { slime: '#bfe9ff', bigslime: '#8fd0f0', wolf: '#e6eef8', golem: '#8aa2b8', skeleton: '#dff3ff', wraith: '#9fd7ff' } },
];
const SHIP_COST = { wood: 400, stone: 200, gold: 150 };

// ================= 정화 마법진 (안개를 걷는 조건) =================
// 본줄기 구역 번호(마을에서 몇 번째인가) → 조건. 처음 몇 개는 게임을 배우는 순서로 정해 두고, 그 뒤로는 GATE_CYCLE을 되풀이한다
//   pay = 자원 바치기, hunt = 사냥, elite = 길목의 정예, build = 건물 레벨, squad = 용병단 레벨, recruit = 영웅 모집, herolv = 영웅 레벨
const GATE_SCRIPT = {
  2: { type: 'pay', cost: { wood: 10 } },
  3: { type: 'hunt', n: 8 },
  4: { type: 'build', pad: 'forge', lv: 1 },
  5: { type: 'recruit' },
  6: { type: 'herolv', lv: 2 },
  7: { type: 'elite' },
  8: { type: 'build', pad: 'lantern', lv: 1 },
};
const GATE_CYCLE = ['pay', 'hunt', 'squad', 'build', 'elite', 'herolv'];
const GATE_BUILDS = [['forge', 2], ['barracks', 1], ['forge', 3], ['lantern', 2], ['barracks', 2], ['forge', 4], ['barracks', 3], ['lantern', 3]];   // build 조건이 나올 때마다 차례로
const GATE_HEROLV = [4, 6, 8, 10, 12];                                    // herolv 조건이 나올 때마다 차례로
const gatePay = (t, k) => (k % 3 === 2 ? { gold: 10 * t } : { wood: 5 * Math.round(2.4 * t), stone: 5 * Math.round(1.2 * t) });   // t = 구역 번호, k = 몇 번째 pay인가
const gateHunt = t => Math.min(30, 8 + t);
const gateSquad = t => Math.min(SQUAD_MAX_LV - 2, 2 + Math.floor(t * 0.45));
const GUARD = { 1: 'bigslime', 2: 'golem', 3: 'skeleton' };              // 길목을 지키는 정예 (구역 종류별)
const gateReward = depth => ({ gold: 10 + 4 * depth, xp: 6 + 2 * depth });   // 안개를 걷으면 받는 보상

// ================= 마을 발판 =================
// kind: pay = 위에 멈추면 자원을 넣어 강화, panel = 멈추면 창이 열림, dock = 선착장 (보스 처치 뒤 배 건조 → 항해 창)
const PADS = [
  { id: 'tavern',   name: '주점',      dx: -170, dy: -230, kind: 'panel', effect: '멈추면 영웅 모집' },
  { id: 'statue',   name: '수호상',    dx: 0,    dy: -230, kind: 'panel', effect: '멈추면 장비 관리' },
  { id: 'gate',     name: '도전의 문', dx: 170,  dy: -230, kind: 'panel', effect: '멈추면 도전 콘텐츠' },
  { id: 'forge',    name: '대장간',    dx: -170, dy: 10,   kind: 'pay', max: 10, effect: '공격력 +20%' },
  { id: 'barracks', name: '훈련장',    dx: 170,  dy: 10,   kind: 'pay', max: 12, effect: '체력 +20% · 출전 인원' },
  { id: 'prod',     name: '생산소',    dx: -170, dy: 250,  kind: 'panel', effect: '멈추면 수확 · 강화' },
  { id: 'lantern',  name: '큰 등불',   dx: 0,    dy: 250,  kind: 'pay', max: 5, effect: '밝힘 범위 · 이동 속도 +' },
  { id: 'dock',     name: '선착장',    dx: 170,  dy: 250,  kind: 'dock', effect: '' },
];
PADS.forEach(p => { p.x = VC.x + p.dx; p.y = VC.y + p.dy; });
const PAD = Object.fromEntries(PADS.map(p => [p.id, p]));
const BUILDINGS = PADS.map(p => ({ isBuilding: true, pad: p, x: p.x, y: p.y - 56 }));
function padCostFor(id, n) {
  const g = (base, k) => Math.round(base * Math.pow(k, n));
  switch (id) {
    case 'lantern':  return { wood: g(25, 1.9), stone: g(25, 1.9), gold: g(20, 1.9) };
    case 'forge':    return { wood: g(10, 1.6), stone: g(6, 1.6) };
    case 'barracks': return { wood: g(8, 1.6), stone: g(10, 1.6) };
  }
  return null;
}

// ================= 생산소 =================
// rate = 레벨 1당 1분 생산량 (실제 시간). 저장 한도 = 1분 생산량 × 60 × (2 + 창고 레벨) → 창고 Lv1이면 3시간치
const PROD = [
  { id: 'wood',  name: '벌목장',     rate: 1,    base: { wood: 0,  stone: 20, gold: 10 } },
  { id: 'stone', name: '광산',       rate: 1,    base: { wood: 20, stone: 0,  gold: 10 } },
  { id: 'gold',  name: '금화 생산소', rate: 0.25, base: { wood: 30, stone: 30, gold: 0 } },
];
const PROD_MAX = 10, STORE_MAX = 10;
const prodCost = (p, l) => { const c = {}; for (const k in p.base) if (p.base[k]) c[k] = Math.round(p.base[k] * Math.pow(1.7, l - 1)); return c; };
const storeCost = l => ({ wood: Math.round(30 * Math.pow(1.8, l - 1)), stone: Math.round(30 * Math.pow(1.8, l - 1)) });

// ================= 장비 (수호상) =================
// 장비 한 벌이 출전한 원정대 전체에 적용된다. 수치는 모두 % 단위
const SLOTS = [
  { id: 'sword',  name: '검',   main: 'atk' },
  { id: 'shield', name: '방패', main: 'atk' },
  { id: 'wing',   name: '날개', main: 'atk' },
  { id: 'helm',   name: '투구', main: 'hp' },
  { id: 'armor',  name: '갑옷', main: 'hp' },
  { id: 'boots',  name: '신발', main: 'hp' },
  { id: 'ring',   name: '반지', main: 'any' },   // 마을 방어 보상으로만 나온다
];
const SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]));
const GRADES = [
  { name: '일반', col: '#b9b6ae', opts: 0 },
  { name: '희귀', col: '#6aaeff', opts: 1 },
  { name: '영웅', col: '#ff7fd0', opts: 2 },
  { name: '전설', col: '#ffb44d', opts: 3 },
];
const GRADE_W = [55, 28, 13, 4];
// base + per × (티어-1) 이 최댓값, 실제로는 그 60~100%. w = 자동 장착 점수 가중치
const OPTS = {
  crit:    { name: '치명타 확률', base: 1.5, per: 0.5, w: 2 },
  critDmg: { name: '치명타 피해', base: 6,   per: 2,   w: 0.7 },
  aspd:    { name: '공격 속도',   base: 2,   per: 0.8, w: 1.5 },
  ls:      { name: '흡혈',        base: 1,   per: 0.4, w: 1.5 },
  atkPct:  { name: '공격력',      base: 2,   per: 1,   w: 1 },
  cdr:     { name: '쿨타임 감소', base: 1.5, per: 0.5, w: 1.2 },
  dodge:   { name: '회피',        base: 1.5, per: 0.5, w: 1.5 },
  dr:      { name: '피해 감소',   base: 1.5, per: 0.5, w: 1.5 },
  hpPct:   { name: '체력',        base: 3,   per: 1.5, w: 0.7 },
};
const OPT_POOL = { atk: ['crit', 'critDmg', 'aspd', 'ls', 'atkPct', 'cdr'], hp: ['dodge', 'dr', 'hpPct', 'cdr', 'aspd'] };
const mainVal = (stat, tier, grade) => Math.round((stat === 'atk' ? 3 + 2.5 * (tier - 1) : 5 + 4 * (tier - 1)) * (1 + 0.15 * grade) * 10) / 10;

// ================= 스킬북 (필드 드랍, 주우면 곧바로 발동) =================
const BOOKS = {
  bookHeal:  { name: '회복의 서', col: '#7fe0a4', desc: '원정대 전체 40% 회복' },
  bookBolt:  { name: '번개의 서', col: '#ffe066', desc: '주변 적 8명에게 번개' },
  bookPower: { name: '강화의 서', col: '#ff7a5c', desc: '12초 동안 공격력 +30%' },
};
const BOOK_P = { normal: 0.03, elite: 0.3 };

// ================= 해금 (용병단 레벨) =================
const UNLOCK = { camp: 3, dungeon: 4, pig: 5, defense: 8, tower: 10 };
const UNLOCK_NAME = { camp: '캠프', dungeon: '던전', pig: '황금 돼지', defense: '마을 방어', tower: '시련의 탑' };

// ================= 도전 콘텐츠 =================
const PIG_STAGES = [
  { hp: 120, gold: 150 }, { hp: 200, gold: 250 }, { hp: 300, gold: 380 }, { hp: 420, gold: 520 }, { hp: 560, gold: 700 },
];
const DAILY = { dungeon: 4, defense: 3 };     // 하루 입장 횟수. 황금 돼지는 하루 한 번 보상 (실패하면 다시 도전 가능)
const DUNGEON_TYPES = { 1: ['slime', 'slime', 'bigslime'], 2: ['wolf', 'wolf', 'golem'], 3: ['skeleton', 'skeleton', 'wraith'] };
const DUNGEON_FLOORS = [30, 45, 30];          // 층마다 나오는 몬스터 수. 마지막 층에는 우두머리가 더해진다
const DUNGEON_TIME = 180;
const DEF_WAVES = 15;
const DEF_BUFFS = [
  { id: 'atk',    name: '공격력 +15%',           desc: '이번 방어전 동안' },
  { id: 'aspd',   name: '공격 속도 +12%',        desc: '이번 방어전 동안' },
  { id: 'hp',     name: '최대 체력 +20%',        desc: '원정대 전원 회복' },
  { id: 'crit',   name: '치명타 확률 +8%',       desc: '이번 방어전 동안' },
  { id: 'cdr',    name: '스킬 쿨타임 -12%',      desc: '이번 방어전 동안' },
  { id: 'ls',     name: '흡혈 +5%',              desc: '입힌 피해만큼 회복' },
  { id: 'repair', name: '수호상 수리',           desc: '수호상 체력 40% 회복' },
  { id: 'clone',  name: '영웅 분신',             desc: '출전 영웅 하나의 분신이 함께 싸워요' },
];
const TOWER_TIME = 60;
