'use strict';
// 등불 원정대 — 도전 콘텐츠 (황금 돼지 · 던전 · 마을 방어 · 시련의 탑)
// 모두 월드 바깥의 원형 경기장(ARENA)에서 열린다. 공통 흐름: enterMode → 규칙대로 소환 → 승리/실패 → 결과 창 → leaveMode

const ARENA_DEN = { x: ARENA.x, y: ARENA.y, arena: true };
function spawnArena(type, n, o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = o.angle != null ? o.angle + rand(-0.5, 0.5) : rand(0, TAU);
    const r = o.r != null ? o.r : ARENA.r - rand(30, 70);
    const m = makeMonster(type, ARENA.x + Math.cos(a) * r, ARENA.y + Math.sin(a) * r, ARENA_DEN, !!o.elite, mode.mul * (o.mul || 1));
    if (o.big) { m.r *= o.big; m.maxHp = Math.round(m.maxHp * (o.hpMul || 1)); m.hp = m.maxHp; }
    m.arena = true; m.state = 'chase'; m.target = nearestHero(m.x, m.y, 99999);
    monsters.push(m); out.push(m);
  }
  return out;
}
const arenaAlive = () => monsters.some(m => m.arena && !m.dead);
function banner(text) { if (mode) { mode.banner = text; mode.bannerT = 2.4; } }

function enterMode(id, opt = {}) {
  endCamp();
  const R = REG();
  mode = { id, t: 0, back: opt.back || { x: P.x, y: P.y }, buffs: {}, mul: R.mul, loot: R.loot, tier: R.tier + 1, xpMul: Math.pow(R.mul, 0.6),
    rewards: { gold: 0, meat: 0, items: [], shards: null, note: '' }, banner: '', bannerT: 0, over: false, win: false };
  for (const m of monsters) if (!m.arena && m.state === 'chase') { m.state = 'return'; m.target = null; m.forced = null; }
  orbs = []; delayed = []; projs = [];
  buffs.atkT = buffs.aspdT = buffs.ampT = 0;
  heroes.forEach(h => { h.down = false; h.downT = 0; h.hp = h.maxHp; h.invulnT = 0; h.skillCd = h.def.s1.cd * 0.3; });
  placeSquad(ARENA.x, ARENA.y + 140);
  ({ pig: setupPig, dungeon: setupDungeon, defense: setupDefense, tower: setupTower })[id](opt);
  state = 'play';
  partyN = -1;
}

// ---------------- 황금 돼지: 어떤 공격이든 피해 1. 제한 시간 안에 쓰러뜨리면 그 단계의 금화 · 고기, 그리고 다음 단계 (PIG) ----------------
function setupPig() {
  const stage = prog.pigStage + 1, hp = PIG.hp(stage);   // prog.pigStage = 지금까지 깬 단계 수
  Object.assign(mode, { name: '황금 돼지', oneDamage: true, limit: PIG.time, stage, loot: 0, xpMul: 0 });
  const pig = spawnArena('pig', 1, { r: 0 })[0];
  pig.maxHp = pig.hp = hp; pig.atk = 0;
  mode.pig = pig;
  placeSquad(ARENA.x, ARENA.y + 220);
  banner(`${stage}단계 · ${PIG.time}초 안에 ${hp}번 때리세요`);
}
function pigAI(m, dt, spd) {   // 가장 가까운 영웅에게서 달아난다
  const h = nearestHero(m.x, m.y, 99999);
  m.wT -= dt;
  if (h && d2(h.x, h.y, m.x, m.y) < 260 * 260) {
    const a = Math.atan2(m.y - h.y, m.x - h.x) + Math.sin(now * 2 + m.ph) * 0.7;
    m.wx = m.x + Math.cos(a) * 120; m.wy = m.y + Math.sin(a) * 120;
  } else if (m.wT <= 0) {
    m.wT = rand(1, 2.5);
    const a = rand(0, TAU), r = rand(0, ARENA.r - 120);
    m.wx = ARENA.x + Math.cos(a) * r; m.wy = ARENA.y + Math.sin(a) * r;
  }
  const dx = m.wx - ARENA.x, dy = m.wy - ARENA.y, dd = Math.hypot(dx, dy), lim = ARENA.r - 60;
  if (dd > lim) { m.wx = ARENA.x + dx / dd * lim; m.wy = ARENA.y + dy / dd * lim; }
  m.walk = moveToward(m, m.wx, m.wy, spd * (m.hp < m.maxHp * 0.3 ? 1.2 : 1), dt, 4);
}

// ---------------- 던전: 3층. 층마다 몬스터가 몰려 나오고 마지막 층에 우두머리. 콤보가 보상을 늘린다 ----------------
function setupDungeon(portal) {
  const z = portal.zone;
  Object.assign(mode, { name: '던전', limit: DUNGEON_TIME, zone: z, floor: 0, quota: 0, spawned: 0, spawnT: 0, boss: false,
    combo: 0, comboT: 0, maxCombo: 0, tier: REG().tier + z + 1, portal });
  nextFloor();
}
function nextFloor() {
  mode.floor++; mode.quota = DUNGEON_FLOORS[mode.floor - 1]; mode.spawned = 0; mode.spawnT = 0.6; mode.boss = false;
  const last = mode.floor === DUNGEON_FLOORS.length;
  banner(`${mode.floor}층${last ? ' · 우두머리가 기다려요' : ''}`);
  if (mode.floor > 1) heroes.forEach(h => { if (!h.down) healHero(h, h.maxHp * 0.3, true); });
}
function updDungeon(dt) {
  mode.comboT -= dt;
  if (mode.comboT <= 0) mode.combo = 0;
  if (mode.spawned < mode.quota) {
    mode.spawnT -= dt;
    if (mode.spawnT <= 0) {   // 한 방향에서 한 무리씩 몰려온다
      mode.spawnT = 3.5;
      const n = Math.min(10, mode.quota - mode.spawned), ang = rand(0, TAU), types = DUNGEON_TYPES[mode.zone];
      for (let i = 0; i < n; i++) spawnArena(pick(types), 1, { angle: ang });
      mode.spawned += n;
    }
  } else if (mode.floor === DUNGEON_FLOORS.length && !mode.boss) {
    mode.boss = true;
    spawnArena(({ 1: 'bigslime', 2: 'golem', 3: 'skeleton' })[mode.zone], 1, { elite: true, big: 1.6, hpMul: 2.5, r: ARENA.r - 90 });
    banner('우두머리 등장!');
  } else if (!arenaAlive()) {
    if (mode.floor < DUNGEON_FLOORS.length) nextFloor(); else modeWin();
  }
}

// ---------------- 마을 방어: 수호상을 15웨이브 지킨다. 레벨이 오를 때마다 강화 3개 중 1개 ----------------
function setupDefense() {
  Object.assign(mode, { name: '마을 방어', wave: 0, waveT: 2.5, spawnLeft: 0, spawnT: 0, runXp: 0, runLv: 1, choices: 0,
    statue: { isStatue: true, x: ARENA.x, y: ARENA.y, hp: 900, maxHp: 900, down: false, flash: 0, def: { r: 34 } }, tier: REG().tier + 3 });
  placeSquad(ARENA.x, ARENA.y + 90);
  banner(`수호상을 ${DEF_WAVES}웨이브 동안 지켜 내세요`);
}
const defTypes = w => (w <= 4 ? ['slime', 'slime', 'wolf'] : w <= 9 ? ['wolf', 'golem', 'skeleton'] : ['skeleton', 'wraith', 'golem']);
function updDefense(dt) {
  const st = mode.statue;
  if (st.flash > 0) st.flash -= dt;
  if (st.hp <= 0) { modeFail('수호상이 무너졌어요'); return; }
  if (mode.spawnLeft > 0) {
    mode.spawnT -= dt;
    if (mode.spawnT <= 0) { mode.spawnT = 0.5; spawnArena(pick(defTypes(mode.wave)), 1, { mul: 1 + 0.12 * mode.wave }); mode.spawnLeft--; }
    return;
  }
  mode.waveT -= dt;
  if (arenaAlive() && mode.waveT > 0) return;
  if (mode.wave >= DEF_WAVES) { if (!arenaAlive()) modeWin(); return; }
  mode.wave++; mode.spawnLeft = 6 + 2 * mode.wave; mode.waveT = 25;
  if (mode.wave % 5 === 0) {
    const t = mode.wave === 15 ? 'golem' : mode.wave === 10 ? 'skeleton' : 'bigslime';
    spawnArena(t, mode.wave === 10 ? 2 : 1, { elite: true, big: 1.4, hpMul: 1.5, mul: 1 + 0.12 * mode.wave });
    banner(`${mode.wave}웨이브 · 우두머리!`);
  } else banner(`${mode.wave}웨이브`);
}
function damageStatue(dmg) {
  const st = mode && mode.statue;
  if (!st) return;
  st.hp -= dmg; st.flash = 0.12;
  if (settings.dmgText) addText(st.x + rand(-10, 10), st.y - 90, Math.round(dmg), '#ff8a80', true);
}
function defChoices() {   // 강화 3개를 무작위로. 분신은 둘까지
  const clones = heroes.filter(h => h.clone).length;
  const pool = DEF_BUFFS.filter(b => b.id !== 'clone' || clones < 2);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(randi(0, pool.length - 1), 1)[0]);
  return out;
}
function applyDefBuff(id) {
  const b = mode.buffs, add = (k, v) => { b[k] = (b[k] || 0) + v; };
  switch (id) {
    case 'atk': add('atk', 0.15); break;
    case 'aspd': add('aspd', 0.12); break;
    case 'hp': add('hp', 0.2); refreshAllHp(); heroes.forEach(h => { if (!h.down) h.hp = h.maxHp; }); break;
    case 'crit': add('crit', 0.08); break;
    case 'cdr': add('cdr', 0.12); break;
    case 'ls': add('ls', 0.05); break;
    case 'repair': mode.statue.hp = Math.min(mode.statue.maxHp, mode.statue.hp + mode.statue.maxHp * 0.4); break;
    case 'clone': {
      const src = pick(heroes.filter(h => !h.clone));
      if (src) { heroes.push(makeHero(src.idx, src.x, src.y, true)); sortHeroes(); partyN = -1; toast(`${src.def.name}의 분신이 합류했어요`); }
      break;
    }
  }
  refreshAllHp();
}

// ---------------- 시련의 탑: 층마다 강해지는 적. 60초 안에 전멸시키면 다음 층 ----------------
function setupTower() {
  const f = prog.towerBest + 1;
  Object.assign(mode, { name: '시련의 탑', floorN: f, limit: TOWER_TIME, mul: 1.3 * Math.pow(1.12, f - 1), tier: 1 + Math.floor(f / 5), xpMul: 1 + f * 0.1, loot: 1 });
  const types = f < 5 ? ['slime', 'wolf', 'bigslime'] : f < 10 ? ['wolf', 'golem', 'skeleton'] : ['skeleton', 'wraith', 'golem'];
  for (let i = 0; i < 8 + f; i++) spawnArena(pick(types), 1);
  if (f % 5 === 0) spawnArena('golem', 1, { elite: true, big: 1.5, hpMul: 2 });
  banner(`시련의 탑 ${f}층`);
}

// ---------------- 공통 ----------------
function updateMode(dt) {
  if (!mode || mode.over) return;
  mode.t += dt;
  if (mode.bannerT > 0) mode.bannerT -= dt;
  if (mode.limit && mode.t >= mode.limit) { modeFail('시간이 다 됐어요'); return; }
  if (mode.id === 'dungeon') updDungeon(dt);
  else if (mode.id === 'defense') { updDefense(dt); if (mode.choices > 0 && state === 'play' && !mode.over) openPanel('choice', defChoices()); }
  else if (mode.id === 'tower' && !arenaAlive()) modeWin();
}
function modeKill(m) {
  if (!mode || mode.over) return;
  if (m.d.pig) { modeWin(); return; }
  if (mode.id === 'dungeon') { mode.combo = mode.comboT > 0 ? mode.combo + 1 : 1; mode.comboT = 2.5; mode.maxCombo = Math.max(mode.maxCombo, mode.combo); }
  if (mode.id === 'defense') {
    mode.runXp += m.elite ? 5 : 1;
    const need = 4 + 3 * mode.runLv;
    if (mode.runXp >= need) { mode.runXp -= need; mode.runLv++; mode.choices++; }
  }
}
function modeWin() {
  if (!mode || mode.over) return;
  mode.over = true; mode.win = true;
  const r = mode.rewards, L = mode.loot || 1;
  switch (mode.id) {
    case 'pig': {
      const w = pigReward(mode.stage);
      r.gold = w.gold; r.meat = w.meat;
      prog.pigStage = Math.max(prog.pigStage, mode.stage);
      r.note = `${mode.stage}단계를 ${mode.t.toFixed(1)}초 만에 잡았어요${mode.stage % PIG.bonusEvery === 0 ? ` · ${PIG.bonusEvery}단계마다 보상 ${PIG.bonusMul}배!` : ''}`;
      break;
    }
    case 'dungeon': {
      const cm = 1 + Math.min(1, mode.maxCombo / 100);
      r.gold = Math.round(40 * mode.zone * L * cm); r.meat = Math.round(25 * mode.zone * L * cm);
      r.items = [makeItem(mode.tier, 1), makeItem(mode.tier)];
      r.note = `최대 콤보 ${mode.maxCombo} · 보상 ×${cm.toFixed(2)}`;
      break;
    }
    case 'defense': {
      const f = Math.max(0, mode.statue.hp / mode.statue.maxHp), g = f >= 0.7 ? 3 : f >= 0.4 ? 2 : 1;
      r.gold = Math.round(200 * L);
      r.items = [makeItem(mode.tier, g, 'ring')];
      r.note = `수호상 체력 ${Math.round(f * 100)}% 남김 · 반지 등급이 달라져요`;
      break;
    }
    case 'tower': {
      const f = mode.floorN;
      prog.towerBest = Math.max(prog.towerBest, f);
      r.gold = TOWER.gold(f); r.meat = TOWER.meat(f);
      // 조각: 아직 키울 수 있는 영웅(만렙이 아닌 보유 영웅) 가운데 한 명에게 카드 몇 장 값을 준다. 모두 만렙이면 아무나 (공용 조각이 된다)
      const owned = roster.map((x, i) => i).filter(i => roster[i].owned), grow = owned.filter(i => !isMax(i)), hi = pick(grow.length ? grow : owned);
      r.shards = { i: hi, n: TOWER.cards(f) * RARITY[HERO_DEFS[hi].rarity].shards };
      if (f % TOWER.itemEvery === 0) r.items = [makeItem(mode.tier, TOWER.itemGrade)];
      r.note = `${f}층을 ${mode.t.toFixed(1)}초 만에 깼어요`;
      break;
    }
  }
  grantRewards(r);
  openPanel('result');
}
function modeFail(reason) {
  if (!mode || mode.over) return;
  mode.over = true; mode.win = false; mode.reason = reason;
  openPanel('result');
}
function grantRewards(r) {
  if (r.gold) { res.gold += r.gold; life.gold += r.gold; bumpRes('gold'); }
  if (r.meat) { res.meat += r.meat; life.meat += r.meat; bumpRes('meat'); }
  for (const it of r.items) addItem(it);
  if (r.shards) grantShards(r.shards.i, r.shards.n);
}
function leaveMode(next) {
  if (!mode) return;
  const back = mode.back;
  for (const p of pickups) if (p.x > WORLD_W) { p.got = true; collectPickup(p); }   // 경기장에 남은 전리품은 챙겨 간다
  pickups = pickups.filter(p => !p.got);
  monsters = monsters.filter(m => !m.arena);
  heroes = heroes.filter(h => !h.clone);
  projs = []; orbs = []; delayed = [];
  mode = null;
  refreshAllHp();
  heroes.forEach(h => { if (h.down) { h.down = false; h.downT = 0; h.hp = h.maxHp * 0.5; } });
  placeSquad(back.x, back.y);
  for (const p of portals) if (d2(p.x, p.y, P.x, P.y) < 60 * 60) p.armed = false;   // 돌아오자마자 창이 다시 뜨지 않게
  for (const p of PADS) if (d2(p.x, p.y, P.x, P.y) < 60 * 60) padArmed[p.id] = false;
  partyN = -1;
  saveLocal();
  if (next === 'tower' || next === 'pig') enterMode(next, { back });   // 결과 창에서 곧바로 다음 층 · 다음 단계로
}
