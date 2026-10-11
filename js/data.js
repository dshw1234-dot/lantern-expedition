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
const TRUNK_LEN = 36;                        // 본줄기 구역 수 (마을에서 보스까지)
const ZONE_END = [6, 18];                    // 들판은 6번째 구역까지(슬라임), 숲은 18번째까지(늑대 · 골렘), 그 뒤는 폐허(해골 · 망령)
const BRANCH_CELLS = 16;                     // 곁가지 구역 수 (들르지 않아도 되는 막다른 길)
const WAY_EVERY = 6;                         // 본줄기 구역 몇 개마다 순간이동 표석을 둘지
const MON_BASE = 1.4;                        // 모든 필드 몬스터의 체력 · 공격력에 곱하는 기본 배율
const DEPTH_MUL = 1.08;                      // 구역이 하나 깊어질 때마다 몬스터 체력 · 공격력 배율 (36번째 구역에서 약 15배). 지역마다 따로 정할 수 있다 (REGIONS의 depthMul)
const BOSS_MUL = 1.5;                        // 지역 보스 배율: 그 지역 마지막 구역 몬스터의 몇 배인가 (0.4.7까지는 고정값 10이어서 마지막 구역의 14.8보다도 낮았다)
const BOSS_SLAM_HP = 0.6;                    // 보스의 내려찍기(보라색 원)는 맞은 영웅 최대 체력의 이만큼을 적어도 깎는다. 능력치로 버틸 수 없고, 움직여서 피해야 한다
const CHOP = 10;                             // 채집 한 번에 자원 오브젝트에 주는 피해. 공격력과 상관없이 일정하다
const NODE_RESPAWN = 60;                     // 다 캔 자원이 다시 자라기까지 (초)
const ENGAGE = 300;                          // 멈췄을 때 싸움을 거는 거리 (원정대 중심 기준)
const GATHER = 250;                          // 멈췄을 때 채집하러 가는 거리
const BOSS_POS = { x: 0, y: 0 };             // 보스 자리. 지역을 만들 때 마지막 구역 한가운데로 정해진다
const START = { x: VC.x, y: VC.y + 10 };
const ARENA = { x: WORLD_W + 1500, y: 1800, r: 520 };   // 도전 콘텐츠 전용 경기장 (월드 바깥에 둔다)
const VERSION = '0.4.9';                     // 설정 창과 플레이 기록에 찍힌다
const SAVE_KEY = 'lantern-expedition-v1';
const SETTINGS_KEY = 'lantern-expedition-settings';
const JR = 56;                               // 조이스틱 반경 (px)
const CHAR_PHONE = 1.2;                      // 스마트폰에서 영웅 · 몬스터를 이만큼 크게 그린다 (화면이 작아 월드가 축소되어 보이기 때문. 판정 크기는 그대로)
const REVIVE_T = 10;                         // 필드에서 쓰러진 영웅이 일어나기까지 (초)
const MAX_HERO_LV = 20;                      // 영웅의 만렙. 그 전에는 용병단 레벨까지만 오른다 (heroCap). 만렙이 된 영웅의 조각은 공용 조각으로 바뀐다 (SHARD_X)
const SKILL2_LV = 5;                         // 두 번째 스킬이 열리는 영웅 레벨
const SQUAD_MAX_LV = 30;
// 용병단 레벨 l → l+1에 드는 경험치. Lv5 → 6: 243, Lv10 → 11: 1,197, Lv15 → 16: 3,043, Lv20 → 21: 5,897, Lv29 → 30: 13,860
//   2026-10-11 첫 기록(예전 값 12 × l^1.55): 20번째 안개(70분)에 Lv30에 닿아 그 뒤 2,200마리의 경험치가 버려졌다.
//   그 기록의 경험치 흐름을 이 식에 넣으면 10번째 안개 Lv12 · 20번째 Lv18 · 33번째 Lv30. 캠프 · 던전을 안 쓰면 그 절반쯤 번다 (10번째 Lv10 · 20번째 Lv15 · 36번째 Lv26)
//   영웅의 만렙(20)이 21번째 안개 언저리에 오도록 잡은 값이다 — 0.4.2의 8 × l^2.4는 27번째여서 성장이 더디게 느껴졌다
const xpNeed = l => Math.round(6 * Math.pow(l, 2.3));
const CHESTS_PER_DAY = 25;
const BAG_MAX = 40;
const CAMP_PER_DAY = 3600;                   // 하루 캠프 시간 (초)
const OFFLINE_MAX_H = 72;                    // 오프라인 보상 최대 시간
const OFFLINE_CHEST_MIN = 20;                // 오프라인 동안 이 분마다 상자 1개

// ================= 영웅 =================
// onHit: 기본 공격에 붙는 상태이상 { st, n: 중첩, p: 확률 }
// 스킬 수는 등급이 정한다 (RARITY의 skills): 노말 s1 / 레어 s1 · s2 / 에픽 s1 ~ s3 / 레전더리 s1 ~ s4. n번째 스킬은 영웅 레벨 SKILL_LV[n-1]에 열린다
//   s3 = 특성 (trait: 그 영웅에게만 붙는 능력치. atk · aspd · crit · cdr · ls · dr), s4 = 각성 (cd초마다 dur초 동안 피해 2배)
// s1: 쿨타임 스킬, s2: 영웅 레벨 SKILL2_LV에 열리는 스킬 (trig: every=기본 공격 n번마다, crit=치명타 시, status=상태이상 대상 적중 시, cd=쿨타임, passive=상시)
// 포지션: 영웅이 원정대에서 맡는 자리. front = 대열에서 진행 방향으로 얼마나 앞에 서는가 (음수면 뒤), order = 대열 가운데부터 채우는 순서
const POS = {
  tank:    { name: '탱커',   front: 26,  order: 0, desc: '맨 앞에서 적을 붙잡고 맞아 준다' },
  fighter: { name: '전사',   front: 10,  order: 1, desc: '앞에서 싸우는 근접 공격수' },
  archer:  { name: '사수',   front: -14, order: 2, desc: '뒤에서 한 명씩 노리는 원거리 공격수' },
  mage:    { name: '마법사', front: -22, order: 3, desc: '뒤에서 여럿을 한꺼번에 공격한다' },
  support: { name: '지원가', front: -28, order: 4, desc: '원정대 전체를 강하게 만든다' },
  healer:  { name: '치유사', front: -30, order: 5, desc: '다친 동료를 회복시킨다' },
};
// 스킬 코드는 "틀"을 같이 쓴다: k1 · k2 = 첫째 · 둘째 스킬에 쓸 틀의 이름 (그 틀을 처음 가진 영웅의 id. 안 적으면 자기 id).
//   틀마다 s1 · s2에 적은 수치를 읽는다 (ratio 배율, st 상태이상, n 횟수, pct 회복 비율, aspd · dur 버프, amp 피해 증가, ls 흡혈). 안 적으면 그 틀의 기본값
// role = 그 영웅의 특징을 한 낱말로. 겉모습(모자 · 무기)은 render.js의 drawHero에 영웅 id별로 그려져 있다 (없으면 색깔 있는 동그란 몸만 나온다)
const HERO_DEFS = [
  { id: 'luke', name: '방패 루크', short: '루크', pos: 'tank', role: '도발', rarity: 'rare', color: '#5b8def', hp: 260, atk: 10, rate: 1.0, range: 0, r: 16,
    s1: { name: '도발', cd: 9, desc: '주변 적을 끌어당기고 4초 동안 받는 피해 절반' },
    s2: { name: '방패 강타', trig: 'every', n: 4, desc: '기본 공격 4번마다 주변 적에게 150% 피해 + 밀쳐내기' } },
  { id: 'teo', name: '장궁 테오', short: '테오', pos: 'archer', role: '연사', rarity: 'normal', color: '#6cc070', hp: 110, atk: 16, rate: 1.1, range: 230, r: 14, proj: 'arrow',
    s1: { name: '연사', cd: 7, desc: '가까운 적에게 화살 5발 (각 120%)' },
    s2: { name: '급소 사격', trig: 'crit', icd: 3, desc: '치명타가 터지면 체력이 가장 많은 적에게 300% 관통 화살' } },
  { id: 'bella', name: '성수 벨라', short: '벨라', pos: 'healer', role: '부활', rarity: 'epic', color: '#f1e3a0', hp: 120, atk: 6, rate: 1.0, range: 190, r: 14, proj: 'spark', heal: 18,
    s1: { name: '축복', cd: 12, desc: '체력 60% 아래 동료가 있으면 원정대 전체 35% 회복' },
    s2: { name: '부활의 기도', trig: 'cd', cd: 20, desc: '쓰러진 동료를 곧바로 일으켜 세움 (체력 50%)' },
    s3: { name: '신성한 손길', trait: { aspd: 0.3 }, desc: '공격 속도 +30% (치유도 그만큼 잦아진다)' } },
  { id: 'mina', name: '쌍검 미나', short: '미나', pos: 'fighter', role: '출혈', rarity: 'rare', color: '#ea6b8e', hp: 150, atk: 14, rate: 1.6, range: 0, r: 14, onHit: { st: 'bleed', n: 1, p: 0.5 },
    s1: { name: '회오리', cd: 6, desc: '주변 적 전부에게 220% 피해 + 출혈' },
    s2: { name: '처형', trig: 'status', st: 'bleed', need: 2, icd: 4, desc: '출혈 2중첩 이상인 적을 때리면 350% 추가 피해' } },
  { id: 'lora', name: '불꽃 로라', short: '로라', pos: 'mage', role: '화상', rarity: 'legend', color: '#ff8b3d', hp: 100, atk: 12, rate: 0.8, range: 210, r: 14, proj: 'fire', splash: 55, onHit: { st: 'burn', n: 1, p: 1 },
    s1: { name: '화염 폭발', cd: 10, desc: '적이 가장 많이 뭉친 곳에 운석 (450% + 화상 2중첩)' },
    s2: { name: '불꽃 비', trig: 'every', n: 5, desc: '기본 공격 5번마다 불덩이 3개 (120% + 화상)' },
    s3: { name: '타오르는 마력', trait: { atk: 0.35 }, desc: '공격력 +35%' },
    s4: { name: '불사조의 날개', cd: 26, dur: 8, desc: '26초마다 8초 동안 각성: 입히는 피해 2배' } },
  { id: 'siu', name: '얼음창 시우', short: '시우', pos: 'fighter', role: '동상', rarity: 'epic', color: '#7fd6ea', hp: 150, atk: 11, rate: 1.2, range: 0, r: 15, reach: 30, onHit: { st: 'frost', n: 1, p: 1 },
    s1: { name: '서리 폭풍', cd: 11, desc: '주변 적에게 180% 피해 + 동상 2중첩' },
    s2: { name: '빙창 관통', trig: 'status', st: 'freeze', icd: 3, desc: '얼어붙은 적을 때리면 일직선으로 250% 관통' },
    s3: { name: '혹한의 일격', trait: { crit: 0.18 }, desc: '치명타 확률 +18%' } },
  { id: 'ruby', name: '독침 루비', short: '루비', pos: 'archer', role: '중독', rarity: 'rare', color: '#b56be0', hp: 105, atk: 12, rate: 1.3, range: 220, r: 14, proj: 'dart', onHit: { st: 'poison', n: 1, p: 1 },
    s1: { name: '독 안개', cd: 9, desc: '4초 동안 독구름. 안에 있는 적이 계속 중독' },
    s2: { name: '맹독 폭발', trig: 'status', st: 'poison', need: 6, icd: 5, desc: '중독 6중첩 이상인 적을 터뜨려 중첩당 40% 피해' } },
  { id: 'bori', name: '도끼 보리', short: '보리', pos: 'fighter', role: '흡혈', rarity: 'epic', color: '#c98a4b', hp: 210, atk: 13, rate: 0.9, range: 0, r: 17, onHit: { st: 'bleed', n: 1, p: 1 },
    s1: { name: '회전 도끼', cd: 8, desc: '주변 적을 끌어당기며 200% 피해 + 출혈 2중첩' },
    s2: { name: '피의 갈증', trig: 'passive', ls: 0.15, desc: '입힌 피해의 15%만큼 체력 회복 (흡혈)' },
    s3: { name: '광전사', trait: { atk: 0.3 }, desc: '공격력 +30%' } },
  { id: 'chichi', name: '방울 치치', short: '치치', pos: 'support', role: '공속', rarity: 'epic', color: '#f3a8f0', hp: 130, atk: 8, rate: 1.2, range: 200, r: 14, proj: 'note',
    s1: { name: '응원가', cd: 14, desc: '8초 동안 원정대 공격 속도 +30%' },
    s2: { name: '박자 맞추기', trig: 'every', n: 3, desc: '기본 공격 3번마다 5초 동안 원정대 피해 +20%' },
    s3: { name: '앵콜', trait: { cdr: 0.3 }, desc: '스킬 쿨타임 -30% (응원가를 더 자주 부른다)' } },
  { id: 'kai', name: '번개 카이', short: '카이', pos: 'mage', role: '연쇄', rarity: 'legend', color: '#ffe066', hp: 110, atk: 14, rate: 0.9, range: 230, r: 14, proj: 'bolt', chain: 2,
    s1: { name: '뇌우', cd: 10, desc: '주변 적에게 번개 6번 (각 200%)' },
    s2: { name: '과부하', trig: 'crit', icd: 4, desc: '치명타가 터지면 적 5명을 잇는 번개 (각 120%)' },
    s3: { name: '전류 가속', trait: { aspd: 0.35 }, desc: '공격 속도 +35%' },
    s4: { name: '폭풍의 화신', cd: 26, dur: 8, desc: '26초마다 8초 동안 각성: 입히는 피해 2배' } },
  // ---- 0.4.6에 합류한 10명. 새 영웅은 언제나 맨 뒤에 붙인다 (영웅 번호가 세이브에 저장되므로 순서를 바꾸면 안 된다)
  { id: 'hans', name: '목검 한스', short: '한스', pos: 'fighter', role: '휘두르기', rarity: 'normal', color: '#c8a26a', hp: 150, atk: 13, rate: 1.2, range: 0, r: 14, k1: 'mina', k2: 'mina',
    s1: { name: '크게 휘두르기', cd: 7, ratio: 1.8, st: null, desc: '주변 적 전부에게 180% 피해' },
    s2: { name: '마무리 일격', trig: 'every', n: 5, ratio: 2.5, desc: '기본 공격 5번마다 250% 추가 피해' } },
  { id: 'duri', name: '통나무 두리', short: '두리', pos: 'tank', role: '도발', rarity: 'normal', color: '#8fa06a', hp: 230, atk: 8, rate: 0.9, range: 0, r: 16, k1: 'luke', k2: 'luke',
    s1: { name: '버티기', cd: 10, desc: '주변 적을 끌어당기고 4초 동안 받는 피해 절반' },
    s2: { name: '밀쳐내기', trig: 'every', n: 5, desc: '기본 공격 5번마다 주변 적에게 150% 피해 + 밀쳐내기' } },
  { id: 'dongi', name: '북소리 동이', short: '동이', pos: 'support', role: '공속', rarity: 'normal', color: '#e39a6a', hp: 115, atk: 8, rate: 1.1, range: 190, r: 14, proj: 'note', k1: 'chichi', k2: 'chichi',
    s1: { name: '둥둥 북소리', cd: 14, aspd: 0.15, dur: 6, desc: '6초 동안 원정대 공격 속도 +15%' },
    s2: { name: '힘내라 장단', trig: 'every', n: 4, amp: 0.1, desc: '기본 공격 4번마다 5초 동안 원정대 피해 +10%' } },
  { id: 'garam', name: '철퇴 가람', short: '가람', pos: 'tank', role: '끌어당김', rarity: 'rare', color: '#7f8fb8', hp: 250, atk: 11, rate: 0.9, range: 0, r: 17, k1: 'bori', k2: 'luke',
    s1: { name: '끌어치기', cd: 9, ratio: 1.6, st: null, desc: '주변 적을 끌어당기며 160% 피해' },
    s2: { name: '철퇴 강타', trig: 'every', n: 4, desc: '기본 공격 4번마다 주변 적에게 150% 피해 + 밀쳐내기' } },
  { id: 'somi', name: '약초 소미', short: '소미', pos: 'healer', role: '회복', rarity: 'rare', color: '#a8d98a', hp: 110, atk: 6, rate: 1.0, range: 190, r: 14, proj: 'spark', heal: 12, k1: 'bella', k2: 'bella',
    s1: { name: '약초 달이기', cd: 14, pct: 0.22, desc: '체력 60% 아래 동료가 있으면 원정대 전체 22% 회복' },
    s2: { name: '응급 처치', trig: 'cd', cd: 30, desc: '쓰러진 동료를 일으켜 세움 (체력 50%)' } },
  { id: 'momo', name: '눈송이 모모', short: '모모', pos: 'mage', role: '동상', rarity: 'rare', color: '#bfe3f2', hp: 100, atk: 11, rate: 0.9, range: 200, r: 14, proj: 'spark', onHit: { st: 'frost', n: 1, p: 0.6 }, k1: 'lora', k2: 'siu',
    s1: { name: '얼음 기둥', cd: 11, ratio: 3, st: 'frost', stacks: 2, desc: '적이 가장 많이 뭉친 곳에 얼음 기둥 (300% + 동상 2중첩)' },
    s2: { name: '고드름', trig: 'status', st: 'freeze', icd: 4, desc: '얼어붙은 적을 때리면 일직선으로 250% 관통' } },
  { id: 'rena', name: '석궁 레나', short: '레나', pos: 'archer', role: '관통', rarity: 'epic', color: '#d98a8a', hp: 115, atk: 17, rate: 0.8, range: 250, r: 14, proj: 'arrow', k1: 'teo', k2: 'teo',
    s1: { name: '세 발 장전', cd: 8, n: 3, ratio: 2, desc: '가까운 적에게 굵은 화살 3발 (각 200%)' },
    s2: { name: '꿰뚫는 화살', trig: 'crit', icd: 3, desc: '치명타가 터지면 체력이 가장 많은 적에게 300% 관통 화살' },
    s3: { name: '매의 눈', trait: { crit: 0.2 }, desc: '치명타 확률 +20%' } },
  { id: 'baru', name: '강철 바루', short: '바루', pos: 'tank', role: '철벽', rarity: 'epic', color: '#8aa0b8', hp: 300, atk: 10, rate: 0.9, range: 0, r: 18, k1: 'luke',
    s1: { name: '강철 함성', cd: 9, desc: '주변 적을 끌어당기고 4초 동안 받는 피해 절반' },
    s2: { name: '불굴', trig: 'passive', ls: 0.12, desc: '입힌 피해의 12%만큼 체력 회복 (흡혈)' },
    s3: { name: '강철 갑주', trait: { dr: 0.2 }, desc: '받는 피해 -20%' } },
  { id: 'aria', name: '성검 아리아', short: '아리아', pos: 'fighter', role: '성검', rarity: 'legend', color: '#ffe9a8', hp: 190, atk: 15, rate: 1.1, range: 0, r: 16, k1: 'mina', k2: 'siu',
    s1: { name: '성검 난무', cd: 8, ratio: 3, r: 120, st: null, desc: '주변 적 전부에게 300% 피해' },
    s2: { name: '빛의 일섬', trig: 'every', n: 4, desc: '기본 공격 4번마다 일직선으로 250% 관통' },
    s3: { name: '맹세', trait: { ls: 0.12 }, desc: '흡혈 +12%' },
    s4: { name: '빛의 수호자', cd: 26, dur: 8, desc: '26초마다 8초 동안 각성: 입히는 피해 2배' } },
  { id: 'luna', name: '달빛 루나', short: '루나', pos: 'healer', role: '회복', rarity: 'legend', color: '#c9c2f5', hp: 125, atk: 7, rate: 1.0, range: 200, r: 14, proj: 'spark', heal: 24, k1: 'bella', k2: 'bella',
    s1: { name: '달의 은총', cd: 11, pct: 0.45, desc: '체력 60% 아래 동료가 있으면 원정대 전체 45% 회복' },
    s2: { name: '되살리는 빛', trig: 'cd', cd: 14, desc: '쓰러진 동료를 곧바로 일으켜 세움 (체력 50%)' },
    s3: { name: '고요한 밤', trait: { cdr: 0.25 }, desc: '스킬 쿨타임 -25%' },
    s4: { name: '만월', cd: 26, dur: 8, desc: '26초마다 8초 동안 각성: 치유량과 피해 2배' } },
];
// 등급: weight = 주점 카드에 나올 비중, shards = 카드 한 장(×1)이 주는 조각 (드문 등급일수록 적다)
//   드문 등급의 조각이 모자라는 것은 공용 조각으로 푼다: 만렙 영웅의 조각 → 그 등급 공용 조각 → 같은 등급의 다른 영웅(3:1)이나 윗등급 공용 조각(10:1). SHARD_X
const RARITY = {
  normal: { name: '노말',     color: '#d6d3cc', weight: 70,  shards: 8, power: 1,    skills: 1 },
  rare:   { name: '레어',     color: '#6aaeff', weight: 25,  shards: 6, power: 1.12, skills: 2 },
  epic:   { name: '에픽',     color: '#bb86ff', weight: 4.5, shards: 4, power: 1.28, skills: 3 },
  legend: { name: '레전더리', color: '#ffc24d', weight: 0.5, shards: 3, power: 1.5,  skills: 4 },
};   // power = 기본 체력 · 공격력 배율, skills = 쓸 수 있는 스킬 수 (등급이 하나 오를 때마다 하나씩 더)
const SKILL_LV = [1, 5, 10, 15];             // n번째 스킬이 열리는 영웅 레벨
const RARITY_KEYS = Object.keys(RARITY);
const RARITY_TOTAL = RARITY_KEYS.reduce((a, k) => a + RARITY[k].weight, 0);
// 주점: cost = 모집 1회 금화, refresh = 카드 바꾸기 금화, auto = 자동 교체 간격(게임 시간 초), pity = 이만큼 바꾸면 레전더리 보장
// 모집 값은 뽑을수록 오른다: base + step × 지금까지 모집한 횟수 (max까지). 0.4.6: 한 번에 2씩 → 1씩 (20에서 시작해 140번째에 160)
// 카드 바꾸기는 모집 값의 절반 (원작: 모집 100 · 새로고침 50). 금화 10으로 고정이던 때는 500이면 레전더리 카드가 보장됐다 (천장 50번 × 10)
const PUB = { base: 20, step: 1, max: 160, auto: 90, pity: 50, get cost() { return Math.min(this.max, this.base + this.step * pub.pulls); }, get refresh() { return Math.round(this.cost / 2); } };
// 영웅 레벨업 값
//   조각: 계단식. Lv1 ~ 10에서 올릴 때는 5, Lv11 ~ 19에서는 10 (누적: Lv10까지 45, 만렙 Lv20까지 140)
//   고기: 10에서 시작해 레벨마다 1.22배. Lv5 → 6: 22, Lv10 → 11: 60, Lv19 → 20: 359 (누적: Lv10까지 227, Lv20까지 1,942)
//         고기는 여기서 다 쓰게 하지 않는다. 남는 고기는 보급(SUPPLY)으로 간다
const lvCost = l => ({ shards: 5 + 5 * Math.floor((l - 1) / 10), meat: Math.round(10 * Math.pow(1.22, l - 1)) });
// 공용 조각의 교환 비율. 만렙 영웅의 조각은 그 등급의 공용 조각으로 1:1로 바뀌고(남아 있던 것도, 그 뒤에 받는 것도),
//   공용 조각 hero개 → 같은 등급의 고른 영웅 조각 1개,  공용 조각 up개 → 한 단계 윗등급의 공용 조각 1개
const SHARD_X = { hero: 3, up: 10 };
// 보급: 고기를 써서 올리는 성장 세 가지. 열쇠(supply · gspd · gyld)는 lv에 저장되는 단계의 이름이기도 하다
//   per = 한 단계의 효과, cost(n) = n단계 → n+1단계에 드는 고기
//   supply (전투): 모든 영웅의 공격력 · 체력이 단계마다 1%씩 (다른 보너스와 따로 곱해진다). 값은 10, 20, 30, … 으로 고기 10씩만 늘어 자주 올릴 수 있다
//     누적: 10단계 550, 30단계 4,650, 50단계 12,750.  0.4.3에서는 단계당 2.5%였는데 7번째 안개(19분)에 벌써 11단계 · +27.5%여서 "너무 가파르다"는 평 → 1%로 낮춤
//   gspd (채집 속도): 자원을 캐는 한 번의 피해(CHOP)가 단계마다 10%씩.  gyld (채집량): 자원 하나가 떨어질 때 덤으로 하나 더 나올 확률이 단계마다 10%씩
//     쉽게 오르면 안 되는 성장이라 전투 보급의 같은 단계보다 20 ~ 30배 비싸다. 누적: 채집 속도 10단계 11,000 · 채집량 10단계 16,500 (첫 지역에서 버는 고기가 약 27,000)
const SUPPLY = {
  supply: { name: '전투',     what: '모든 영웅의 공격력 · 체력', max: 200, per: 0.01, cost: n => 10 + 10 * n },   // 0.4.8: 최고 100 → 200 (둘째 지역에서도 키울 것이 남게. 100 → 200단계에 고기 약 150,000)
  gspd:   { name: '채집 속도', what: '나무 · 돌을 캐는 속도',     max: 10,  per: 0.1,  cost: n => 200 + 200 * n },
  gyld:   { name: '채집량',   what: '캘 때 나오는 나무 · 돌',     max: 10,  per: 0.1,  cost: n => 300 + 300 * n },
};
// 전투력 = (공격력 × POWER_ATK + 체력) × (1 + POWER_SKILL × 열린 2 ~ 4번 스킬 수)  (영웅 한 명). 원정대 전투력은 출전한 영웅의 합
//   앞부분은 원작과 같은 식이다 (원작 영웅 화면: 공격력 75 · 체력 673 → 전투력 973). 등급 배율은 공격력 · 체력에 이미 들어 있다.
//   뒷부분은 등급이 주는 스킬(노말 1개 ~ 레전더리 4개)을 숫자에 담는 보정: 스킬이 열리는 Lv5 · 10 · 15에 전투력이 한 번씩 뛴다
const POWER_ATK = 4, POWER_SKILL = 0.1;
// ================= 몬스터 =================
const MON = {
  slime:    { name: '슬라임',    hp: 30,   atk: 4,  rate: 1.0, spd: 70,  r: 13, aggro: 190, gold: [1, 2],     meat: [1, 2],   xp: 2,   col: '#7ccf6b' },
  bigslime: { name: '큰 슬라임', hp: 90,   atk: 8,  rate: 1.2, spd: 55,  r: 20, aggro: 190, gold: [3, 5],     meat: [3, 4],   xp: 5,   col: '#4fae5d' },
  wolf:     { name: '안개 늑대', hp: 70,   atk: 8,  rate: 0.9, spd: 125, r: 15, aggro: 230, gold: [2, 4],     meat: [2, 3],   xp: 4,   col: '#9aa2b3' },
  golem:    { name: '이끼 골렘', hp: 240,  atk: 15, rate: 1.5, spd: 45,  r: 24, aggro: 180, gold: [5, 8],     meat: [4, 6],   xp: 9,   col: '#76806c' },
  skeleton: { name: '해골 병사', hp: 160,  atk: 13, rate: 1.1, spd: 80,  r: 15, aggro: 220, gold: [4, 6],     meat: [2, 4],   xp: 7,   col: '#e9e3d0' },
  wraith:   { name: '안개 망령', hp: 110,  atk: 12, rate: 1.7, spd: 70,  r: 15, aggro: 260, gold: [4, 7],     meat: [2, 4],   xp: 7,   col: '#a797ff', ranged: 190 },
  // 보스: 체력 · 공격력에 (마지막 구역 배율 × BOSS_MUL)이 곱해진다 → 안개 들판에서 체력 약 248,000 · 공격력 약 435. 내려찍기는 BOSS_SLAM_HP 참고
  //   2026-10-11 기록(전투력 27,854)과 비슷한 원정대로 시험: 가만히 서서 싸우면 48초에 전멸, 보라색 원을 피하면 111초에 처치 (예전 값은 17초에 처치, 쓰러진 영웅 없음)
  boss:     { name: '안개 군주', hp: 8000, atk: 14, rate: 1.3, spd: 62,  r: 40, aggro: 300, gold: [200, 200], meat: [50, 50], xp: 200, col: '#7b5cff', boss: true },
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
  tree:     { r: 20, hp: 60,  res: 'wood',  per: 20 },   // 나무 3
  bigtree:  { r: 28, hp: 100, res: 'wood',  per: 20 },   // 나무 5
  deadtree: { r: 18, hp: 60,  res: 'wood',  per: 15 },   // 나무 4
  rock:     { r: 19, hp: 60,  res: 'stone', per: 20 },   // 돌 3
  crystal:  { r: 20, hp: 80,  res: 'stone', per: 20 },   // 돌 4
};   // 캐는 속도는 CHOP으로 일정하다. 한 번 다 캐면 NODE_RESPAWN초 뒤에 다시 자란다

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
// mul = 몬스터 체력·공격력 배율, loot = 금화 드랍 · 도전 보상 배율, tier = 장비 등급 기준, immune = 이 지역 몬스터가 걸리지 않는 상태이상
// depthMul = 구역이 하나 깊어질 때마다의 배율 (안 적으면 DEPTH_MUL)
//   다음 지역의 mul은 앞 지역의 끝에서 이어지게 잡는다. 안개 들판의 36번째 구역이 1.08^35 = 14.8배이므로 서리 군도는 16배에서 시작한다
//   (0.4.7까지는 2.6배여서, 안개 들판의 끝보다 다섯 배 넘게 약했다). 서리 군도는 구역마다 4%씩: 36번째 구역에서 16 × 1.04^35 = 63배
//   고기 · 경험치는 몬스터 배율을 그대로 따라가므로 지역이 바뀌어도 끊기지 않는다
// zoneMul = 구역 종류(1 들판 · 2 숲 · 3 폐허)별 추가 배율. 새 지역도 슬라임부터 다시 나오는데, 슬라임은 해골보다 체력이 1/5 · 공격력이 1/3이라
//   배율만 이어서는 앞 지역의 끝보다 훨씬 약하다. 그 차이를 메워서, 서리 군도의 첫 슬라임이 안개 들판 마지막 해골과 비슷하게 버티게 한다
//   시험(2026-10-11 기록과 비슷한 원정대, 전투력 약 26,600): 안개 들판 33 ~ 35번째 구역은 무리 하나에 3.1초 · 쓰러짐 없음,
//   서리 군도 7 ~ 9번째는 5.5초 · 가끔 쓰러짐, 19번째부터는 더 키우지 않으면 전멸. 다 키운 원정대(보급 200 · 9명 Lv20 · 전투력 87,000)는 33 ~ 35번째를 3.6초에 잡는다
const REGIONS = [
  { name: '안개 들판', seed: 20260929, mul: 1, loot: 1, tier: 0, boss: '안개 군주', bossCol: '#4b3a8f', crown: '#ffcf4a', eye: '#ff5ad1', immune: null,
    base: '#46455a', forest: '45,82,54', meadow: '76,120,60', plaza: '112,92,66', rock: ['#2a2733', '#4a4556', '#6a6478'], fog: '86,44,128',
    shades: [null, ['#5a8a45', '#3f6b35', '#6c9a50'], ['#244632', '#35603f', '#1d3b2a'], ['#3b3a4c', '#555468', '#4b4550']],
    tuft: ['#78ad58', '#3f7448'], tree: [['#2f6b3a', '#3b7d45', '#4f9555'], ['#1f4a31', '#2a5c3a', '#377048']], snow: false, tint: null },
  { name: '서리 군도', seed: 4411, mul: 16, depthMul: 1.04, zoneMul: { 1: 2.6, 2: 1.6 }, loot: 1.6, tier: 6, boss: '서리 여왕', bossCol: '#2f5f8f', crown: '#dff6ff', eye: '#7ff0ff', immune: 'frost',
    base: '#566278', forest: '64,104,112', meadow: '132,160,172', plaza: '118,118,128', rock: ['#2c3644', '#4c5c70', '#e4f0f8'], fog: '70,96,150',
    shades: [null, ['#a9c3cc', '#8eaab6', '#c6dbe2'], ['#3f6a70', '#557f86', '#335a60'], ['#4d586c', '#667287', '#5a6478']],
    tuft: ['#d8ecf2', '#9cc7cc'], tree: [['#2e5e62', '#3c7175', '#e8f4f8'], ['#244c52', '#305f66', '#e8f4f8']], snow: true,
    tint: { slime: '#bfe9ff', bigslime: '#8fd0f0', wolf: '#e6eef8', golem: '#8aa2b8', skeleton: '#dff3ff', wraith: '#9fd7ff' } },
];
const SHIP_COST = { wood: 400, stone: 200, gold: 150 };

// ================= 정화 마법진 (안개를 걷는 조건) =================
// ---------- 임무 (이정표) ----------
// 화면 위 목표 칸에 한 번에 하나씩 뜨는 일. 언제든 채울 수 있는 일만 넣는다. 플레이어는 이것을 따라가고,
// 개발자는 이 순서로 "몇 번째 안개에 닿을 때 무엇을 어디까지 키워 두었는가"를 정한다.
// 임무의 순서: 안개 하나마다 [지금 할 일 하나(사냥 또는 채집)] → [새로 올라야 할 성장 목표들] → [안개 걷기]
//   지금 할 일 = 임무를 받은 뒤로 한 것만 센다.  성장 목표 = 도달해야 하는 수준(절대값). 이미 넘었으면 곧바로 완료된다
// CURVE = 본줄기 t번째 안개를 걷기 전에 갖추게 할 수준. 여기 숫자가 곧 이 게임의 성장 속도다.
//         플레이 기록(설정 → 플레이 기록 복사)에 안개마다 실제 레벨이 찍히므로, 그것과 견주어 고친다
const stepAt = (...at) => t => at.filter(a => t >= a).length;   // stepAt(2, 4, 8)(t) = t가 2 · 4 · 8번째 안개에 닿을 때마다 1씩 오르는 값 (t=5이면 2)
const CURVE = {
  // 2026-10-10 플레이 기록: 3번째 안개에서 용병단 4 · 영웅 3 (그때의 표보다 한 걸음씩 앞섬) → 용병단을 1 올림
  // 2026-10-11 플레이 기록: 예전 경험치 식으로는 이 표의 두 배 빠르기였다 (10번째 안개 Lv15, 20번째 Lv30). 표는 그대로 두고 경험치 식(xpNeed)을 이 표에 맞췄다
  // 0.4.3: 경험치 식을 조금 풀면서 표도 올렸다. 캠프 · 던전을 안 쓰는 플레이의 흐름(그 기록의 절반)과 거의 같고, 쓰는 플레이보다는 2 ~ 3 낮다
  squad: t => (t < 6 ? t + 1 : Math.min(SQUAD_MAX_LV - 2, Math.round(3 + 0.66 * t))),     // 용병단 레벨: 3 → 4, 6 → 7, 12 → 11, 20 → 16, 27 → 21, 36 → 27
  // 건물은 값이 2.2배씩 뛰므로 레벨이 초반에 빨리 오르고 뒤로 갈수록 느려진다. 그래서 직선 식이 아니라 "몇 번째 안개에서 한 레벨씩"을 적는다.
  //   2026-10-11 플레이 기록의 나무 · 돌 수입(평균 분당 62 · 69)을 지금 값에 넣으면, 번 것의 45%를 건물에 쓸 때와 70%를 쓸 때의 사이에 놓이는 표다
  //   37번째부터는 둘째 지역이다 (지역을 이어서 센다: 서리 군도의 t번째 안개 = 36 + t번째)
  forge: stepAt(2, 4, 8, 13, 20, 29, 42, 58),                                          // 대장간: 2번째 안개에서 1, 4 → 2, 8 → 3, 13 → 4, 20 → 5, 29 → 6 | 서리 군도: 42 → 7, 58 → 8
  barracks: stepAt(3, 6, 10, 16, 24, 33, 44, 56),                                      // 훈련장: 3 → 1, 6 → 2, 10 → 3, 16 → 4, 24 → 5, 33 → 6 (출전 인원은 2레벨마다 +1) | 서리 군도: 44 → 7, 56 → 8
  lantern: stepAt(7, 14, 26, 48, 64),                                                  // 큰 등불: 7 → 1, 14 → 2, 26 → 3 | 서리 군도: 48 → 4, 64 → 5
  hero: t => Math.min(MAX_HERO_LV - 2, Math.max(2, CURVE.squad(t) - 1)),               // 가장 높은 영웅의 레벨: 용병단 레벨보다 하나 낮게, 만렙보다 둘 낮은 18까지
  // 두 번째로 높은 영웅은 대개 레어다. 레어 한 명의 조각은 모집 한 번에 평균 0.5개 → 12번째 안개쯤 Lv3 ~ 4, 24번째쯤 Lv10, 36번째쯤 Lv15까지 닿는다. 그보다 낮게 잡는다
  hero2: t => Math.max(2, Math.round(0.25 * t)),                                       // 두 번째로 높은 영웅의 레벨: 6 → 2, 12 → 3, 18 → 5, 24 → 6, 30 → 8, 36 → 9
  // 0.4.6: 영웅이 20명(노말 4 · 레어 6 · 에픽 6 · 레전더리 4)이 되어 새 영웅을 만나기 쉬워졌다. 노말 · 레어 10명 가운데 9명까지만 요구한다 (운에 달린 일이라 낮게)
  owned: t => 2 + stepAt(4, 6, 9, 13, 18, 24, 31, 40, 52, 64)(t),                      // 보유 영웅: 4번째 안개에서 3명, 6 → 4, 9 → 5, 13 → 6, 18 → 7, 24 → 8, 31 → 9 | 서리 군도: 40 → 10, 52 → 11, 64 → 12
};
const MIS_HERO_EVERY = 3;                                                              // 영웅 레벨 임무는 안개 몇 개마다 (한 번은 한 명, 한 번은 두 명)
const misHunt = t => Math.min(150, 10 + 2 * t);                                        // 첫 지역 14 ~ 80마리, 서리 군도 86 ~ 150마리
// 둘째 지역부터의 영웅 임무: "영웅 cnt명 Lv lv". 첫 지역의 "한 명 · 두 명"은 이미 넘어섰으므로 여러 명을 고르게 키우게 한다 (서리 군도 3번째 안개: 3명 Lv13 → 18번째: 5명 Lv17 → 36번째: 7명 Lv20)
const misHeroLate = T => ({ lv: Math.min(MAX_HERO_LV, 12 + Math.round(0.25 * (T - TRUNK_LEN))), cnt: Math.min(8, 3 + Math.floor((T - TRUNK_LEN) / 9)) });
const misGather = (t, k) => (k % 2 ? { res: 'stone', n: 6 + 3 * t } : { res: 'wood', n: 10 + 4 * t });   // k = 몇 번째 채집 임무인가
const misReward = t => ({ gold: 5 + t });                                              // 임무를 끝낼 때마다
const fogCost = t => (t % 4 === 0 ? { wood: 6 + 2 * t, stone: 2 * t } : { wood: 6 + 2 * t });   // 본줄기 안개를 걷는 값 (정화 마법진에 바친다)
// ---------- 곁가지의 마법진 (들르지 않아도 되는 길): 자원 바치기 · 사냥 · 길목의 정예가 번갈아 나온다 ----------
const sidePay = t => ({ wood: 10 + 3 * t, stone: 5 + Math.round(1.5 * t) });
const sideHunt = t => Math.min(50, 6 + Math.round(1.2 * t));
const HUNT_CYCLES = 8;                                                    // 드문 몬스터가 대상이면, 소굴이 이만큼 다시 찰 동안 잡을 수 있는 수로 줄인다
const GUARD = { 1: 'bigslime', 2: 'golem', 3: 'skeleton' };              // 길목을 지키는 정예 (구역 종류별)
const GUARD_MUL = 2.2;                                                    // 길목의 정예는 그 구역 몬스터보다 이만큼 더 강하다
const gateReward = depth => ({ gold: 5 + 2 * depth, xp: 6 + 2 * depth });    // 안개를 걷으면 받는 보상

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
    // 첫 값은 수입(나무 분당 약 28, 돌 분당 약 16 — 2026-10-10 플레이 기록) 40초어치쯤, 레벨마다 대장간 · 훈련장은 2.2배, 큰 등불은 2.6배씩 비싸진다
    //   대장간 나무 · 훈련장 돌: 20 → 44 → 97 → 213 → 469 → 1,031 → 2,267 → 4,988 …   큰 등불: 40 → 104 → 270 → 703 → 1,828
    // 대장간은 나무를, 훈련장은 돌을 더 받는다. 초반에는 돌이 나무의 절반밖에 안 벌린다 (2026-10-11 0.4.2 기록: 13분에 나무 223 · 돌 103).
    //   후반에 장비 분해로 남는 돌은 금화 생산소가 받는다
    case 'lantern':  return { wood: g(40, 2.6), stone: g(40, 2.6), gold: g(30, 2.6) };
    case 'forge':    return { wood: g(20, 2.2), stone: g(12, 2.2) };
    case 'barracks': return { wood: g(14, 2.2), stone: g(20, 2.2) };
  }
  return null;
}

// ================= 생산소 =================
// rate = 레벨 1당 1분 생산량 (실제 시간). 저장 한도 = 1분 생산량 × 60 × (2 + 창고 레벨) → 창고 Lv1이면 3시간치
// 강화 재료는 원작처럼 한 바퀴 돈다: 고기 → 벌목장(나무) → 광산(돌) → 금화 생산소(금화). 남는 고기와 돌이 결국 금화(= 영웅 모집)로 바뀐다
//   base = Lv1 → 2의 값 ÷ 1.7. 레벨마다 1.7배 (벌목장 고기: 68 → 116 → 197 → 334 → … → Lv10에 4,743, 다 올리면 약 11,400)
const PROD = [
  { id: 'wood',  name: '벌목장',     rate: 1,    base: { meat: 40 } },
  { id: 'stone', name: '광산',       rate: 1,    base: { wood: 30 } },
  { id: 'gold',  name: '금화 생산소', rate: 0.25, base: { stone: 40 } },
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
// 황금 돼지: 어떤 공격이든 피해 1. time초 안에 쓰러뜨리면 그 단계의 보상을 받고 곧바로 다음 단계에 도전할 수 있다.
//   시련의 탑처럼 단계가 끝없이 이어지고, 처음 깬 단계마다 한 번 보상을 준다 (하루 횟수 제한 없음). 전투력이 아니라 "얼마나 자주 때리는가"를 잰다
//   hp(k) = k단계 돼지의 체력(= 때려야 하는 횟수): 100, 120, 140, …  보상은 금화 80, 110, 140, … 과 고기 60, 80, 100, …  bonusEvery단계마다 bonusMul배
//   누적: 10단계까지 금화 3,250 · 고기 2,260 / 20단계까지 금화 10,700 · 고기 7,320 / 30단계까지 금화 22,350 · 고기 15,180
//   시험: 기록 끝 무렵의 원정대(8명)를 쫓아가서 때리게 하면 27단계(620번, 1초에 10번쯤)까지 간다
//   0.4.6까지는 5단계뿐(금화 150 ~ 700)이고 하루 한 번이었다. 금화를 사냥으로만 3시간에 54,000 버는 판에서는 있으나 마나여서 바꿨다
const PIG = { time: 60, hp: k => 100 + 20 * (k - 1), gold: k => 50 + 30 * k, meat: k => 40 + 20 * k, bonusEvery: 5, bonusMul: 3 };
const pigReward = k => { const m = k % PIG.bonusEvery === 0 ? PIG.bonusMul : 1; return { gold: PIG.gold(k) * m, meat: PIG.meat(k) * m }; };
// 시련의 탑 보상 (처음 깬 층마다 한 번). f = 층
//   금화 40f · 고기 30f, 영웅 조각은 "카드 cards(f)장 값" (아직 만렙이 아닌 보유 영웅 가운데 한 명. 한 장 값 = 그 등급 카드의 조각 수), itemEvery층마다 itemGrade 이상의 장비
//   0.4.6까지는 금화 25f · 조각 2 + f/5개 · 5층마다 희귀 이상 장비였다 ("너무 소소하다"는 평). 누적: 10층까지 금화 2,200 · 고기 1,650 / 20층까지 금화 8,400 · 고기 6,300
const TOWER = { gold: f => 40 * f, meat: f => 30 * f, cards: f => 1 + Math.floor(f / 10), itemEvery: 5, itemGrade: 2 };   // 조각: 1 ~ 9층 카드 1장 값, 10 ~ 19층 2장, 20층부터 3장 …
const DAILY = { dungeon: 4, defense: 3 };     // 하루 입장 횟수 (황금 돼지와 시련의 탑은 횟수 제한이 없다)
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
