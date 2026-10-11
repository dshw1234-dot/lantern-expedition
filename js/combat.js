'use strict';
// 등불 원정대 — 능력치, 전투(영웅 · 몬스터 · 상태이상 · 스킬), 드랍 · 장비, 필드 요소(상자 · 던전 입구 · 캠프), 마을 발판, 매 프레임 업데이트

// ================= 능력치 =================
let gearStat = { atkMain: 0, hpMain: 0 };   // 수호상 장비 합계 (% 단위)
function recalcGear() {
  const s = { atkMain: 0, hpMain: 0 };
  for (const k in OPTS) s[k] = 0;
  for (const id in gear.eq) {
    const it = gear.eq[id];
    if (!it) continue;
    if (it.main.stat === 'atk') s.atkMain += it.main.val; else s.hpMain += it.main.val;
    for (const o of it.opts) s[o.stat] += o.val;
  }
  gearStat = s;
  refreshAllHp();
}
const modeBuff = k => (mode && mode.buffs && mode.buffs[k]) || 0;
const lvMul = i => 1 + 0.1 * (roster[i].lvl - 1);                        // 영웅 레벨 1당 +10%
const tierPow = i => RARITY[HERO_DEFS[i].rarity].power;                 // 등급이 높을수록 기본 체력 · 공격력이 높다
const supplyMul = () => 1 + SUPPLY.supply.per * (lv.supply || 0);       // 전투 보급: 모든 영웅의 공격력 · 체력 (다른 보너스와 따로 곱해진다)
const chopDmg = () => CHOP * (1 + SUPPLY.gspd.per * (lv.gspd || 0));    // 채집 속도 보급: 자원을 캐는 한 번의 피해
const yieldBonus = () => SUPPLY.gyld.per * (lv.gyld || 0);              // 채집량 보급: 자원이 하나 떨어질 때 덤이 나올 확률 (1이면 언제나 두 개)
const atkOf = i => HERO_DEFS[i].atk * tierPow(i) * lvMul(i) * supplyMul() * (1 + 0.2 * lv.forge + ((gearStat.atkMain || 0) + (gearStat.atkPct || 0)) / 100 + modeBuff('atk'));
const hpOf = i => Math.round(HERO_DEFS[i].hp * tierPow(i) * lvMul(i) * supplyMul() * (1 + 0.2 * lv.barracks + ((gearStat.hpMain || 0) + (gearStat.hpPct || 0)) / 100 + modeBuff('hp')));
// n번째 스킬을 쓸 수 있는가: 등급이 정한 개수 안이고(노말 1 ~ 레전더리 4), 영웅 레벨이 SKILL_LV[n-1] 이상
const skillOn = (h, n) => n <= RARITY[h.def.rarity].skills && roster[h.idx].lvl >= SKILL_LV[n - 1];
const skill2On = h => skillOn(h, 2);
const trait = (h, k) => (h && h.def.s3 && skillOn(h, 3) && h.def.s3.trait[k]) || 0;   // 세 번째 스킬(특성)이 그 영웅에게 주는 능력치
function stat(h, k) {
  const g = s => (gearStat[s] || 0) / 100;
  switch (k) {
    case 'crit':    return Math.min(0.75, 0.05 + g('crit') + modeBuff('crit') + trait(h, 'crit'));
    case 'critDmg': return 1.5 + g('critDmg');
    case 'aspd':    return Math.min(2.5, 1 + g('aspd') + modeBuff('aspd') + (buffs.aspdT > 0 ? buffs.aspd : 0) + trait(h, 'aspd'));
    case 'dodge':   return Math.min(0.5, g('dodge'));
    case 'dr':      return Math.min(0.6, g('dr') + trait(h, 'dr'));
    case 'ls':      return Math.min(0.35, g('ls') + modeBuff('ls') + (h && h.def.s2.trig === 'passive' && h.def.s2.ls && skill2On(h) ? h.def.s2.ls : 0) + trait(h, 'ls'));
    case 'cdr':     return Math.min(0.6, g('cdr') + modeBuff('cdr') + trait(h, 'cdr'));
  }
  return 0;
}
const heroAtk = h => atkOf(h.idx) * (1 + (buffs.atkT > 0 ? buffs.atk : 0)) * (1 + trait(h, 'atk')) * (h.awakeT > 0 ? 2 : 1);   // 각성(네 번째 스킬) 중에는 2배
const heroMaxHp = h => hpOf(h.idx);
function refreshHp(h) { const k = h.maxHp ? h.hp / h.maxHp : 1; h.maxHp = heroMaxHp(h); if (!h.down) h.hp = Math.max(1, h.maxHp * k); }
function refreshAllHp() { for (const h of heroes) refreshHp(h); }
const squadLimit = () => 4 + Math.floor(lv.barracks / 2);
const heroCap = () => Math.min(MAX_HERO_LV, squad.lvl);
const squadSpeed = () => 230 * (1 + 0.06 * lv.lantern);
const revealR = () => 320 + 60 * lv.lantern;
const reviveNeed = () => (!mode && inVillage(P.x, P.y) ? 0.6 : REVIVE_T);
// 전투력: 영웅 한 명 = (공격력 × POWER_ATK + 체력) × (1 + POWER_SKILL × 열린 2 ~ 4번 스킬 수). 공격력 · 체력은 영웅 창에 보이는 그 숫자들. 원정대 = 출전한 영웅의 합
const skillsOpen = i => { let n = 0; for (let k = 2; k <= RARITY[HERO_DEFS[i].rarity].skills; k++) if (roster[i].lvl >= SKILL_LV[k - 1]) n++; return n; };   // 등급이 허락하고 레벨이 닿은 2 ~ 4번 스킬의 수
const heroPower = i => Math.round((atkOf(i) * POWER_ATK + hpOf(i)) * (1 + POWER_SKILL * skillsOpen(i)));
const squadPower = () => roster.reduce((s, r, i) => s + (r.owned && r.active ? heroPower(i) : 0), 0);
function teamAtk() { const a = heroes.filter(h => !h.down); return a.length ? a.reduce((s, h) => s + heroAtk(h), 0) / a.length : 10; }

// ================= 이동 · 탐색 =================
// 산과 안개는 지나갈 수 없다. 막히면 가로나 세로 한쪽으로만 미끄러지고, 그것도 안 되면 o.blocked를 세운다.
// 경기장은 월드 밖이라 검사하지 않는다. 밀려서 이미 산속에 끼었다면 빠져나오게 둔다
function moveToward(o, tx, ty, spd, dt, stop) {
  o.blocked = false;
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d <= stop || d < 0.01) return false;
  const s = Math.min(d - stop, spd * dt), nx = o.x + dx / d * s, ny = o.y + dy / d * s;
  if (Math.abs(dx) > 1) o.face = dx < 0 ? -1 : 1;
  if (o.x > WORLD_W || canWalk(nx, ny) || !canWalk(o.x, o.y)) { o.x = nx; o.y = ny; return true; }
  if (canWalk(nx, o.y)) { o.x = nx; return true; }
  if (canWalk(o.x, ny)) { o.y = ny; return true; }
  o.blocked = true;
  return false;
}
function nudge(o, dx, dy) {   // 서로 밀어낼 때: 산속으로는 밀리지 않는다
  const nx = o.x + dx, ny = o.y + dy;
  if (o.x > WORLD_W || canWalk(nx, ny) || !canWalk(o.x, o.y)) { o.x = nx; o.y = ny; }
}
const canStand = (x, y) => canWalk(x - 16, y) && canWalk(x + 16, y) && canWalk(x, y - 12) && canWalk(x, y + 14);   // 원정대 중심이 설 수 있는 자리
function los(ax, ay, bx, by) {   // 두 점 사이에 산이 없는가 (산 너머의 적을 노리지 않게)
  if (ax > WORLD_W) return true;
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 30);
  for (let i = 1; i < n; i++) if (!tileAt(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
  return true;
}
function nearestHero(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const h of heroes) { if (h.down) continue; const dd = d2(h.x, h.y, x, y); if (dd < bd) { bd = dd; best = h; } }
  return best;
}
function monstersNear(x, y, r) {
  const out = [], r2 = r * r;
  for (const m of monsters) if (!m.dead && m.state !== 'return' && d2(m.x, m.y, x, y) < r2) out.push(m);
  return out;
}
function densest(list, r) {   // 주변에 적이 가장 많이 몰린 적
  let best = list[0], bn = -1;
  for (const c of list) { let n = 0; for (const o of list) if (d2(o.x, o.y, c.x, c.y) < r * r) n++; if (n > bn) { bn = n; best = c; } }
  return best;
}
const GRID = 64; const grid = new Map();
function buildGrid() {
  grid.clear();
  for (const m of monsters) {
    if (m.dead) continue;
    const k = ((m.x / GRID) | 0) * 4096 + ((m.y / GRID) | 0);
    let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(m);
  }
}
function forNear(x, y, fn) {
  const cx = (x / GRID) | 0, cy = (y / GRID) | 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = grid.get((cx + i) * 4096 + (cy + j));
    if (a) for (const m of a) fn(m);
  }
}

// ================= 영웅 =================
const targetR = t => (t.isMon ? t.r : t.isNode ? t.r * 0.8 : t.isStatue ? 34 : t.def.r);
function validTarget(t) {
  if (!t) return false;
  if (t.isMon) return !t.dead && t.state !== 'return' && d2(t.x, t.y, P.x, P.y) < (ENGAGE + 90) ** 2;
  if (t.isNode) return !mode && t.hp > 0 && d2(t.x, t.y, P.x, P.y) < (GATHER + 60) ** 2;
  if (t.isHero) return !t.down && t.hp < t.maxHp * 0.97;
  return false;
}
function chooseTarget(h) {
  if (h.def.heal) {   // 치유사는 다친 동료가 먼저
    let best = null, br = 0.9;
    for (const a of heroes) if (!a.down && a.hp / a.maxHp < br) { br = a.hp / a.maxHp; best = a; }
    if (best) return best;
  }
  let best = null, bd = Infinity;
  for (const m of monsters) {
    if (m.dead || m.state === 'return' || d2(m.x, m.y, P.x, P.y) > ENGAGE * ENGAGE) continue;
    const dd = d2(m.x, m.y, h.x, h.y); if (dd < bd && los(P.x, P.y, m.x, m.y)) { bd = dd; best = m; }
  }
  if (best || mode) return best;
  for (const n of nodes) {   // 적이 없을 때만 채집. 전투 코드를 그대로 쓴다
    if (n.hp <= 0 || d2(n.x, n.y, P.x, P.y) > GATHER * GATHER) continue;
    const dd = d2(n.x, n.y, h.x, h.y); if (dd < bd && los(P.x, P.y, n.x, n.y)) { bd = dd; best = n; }
  }
  return best;
}
function revive(h, frac = 0.5) {
  h.down = false; h.downT = 0; h.hp = h.maxHp * frac;
  h.invulnT = 2;   // 부활 직후 2초 무적: 일어나자마자 다시 쓰러지는 일을 막는다
  h.cd = 0.3; h.think = 0;
  burst(h.x, h.y - 10, '#9ff0c0', 14, 120); addText(h.x, h.y - 40, '부활', '#9ff0c0');
}
function updHero(h, dt, i, auto) {
  if (h.flash > 0) h.flash -= dt;
  if (h.swing > 0) h.swing -= dt;
  if (h.guardT > 0) h.guardT -= dt;
  if (h.invulnT > 0) h.invulnT -= dt;
  if (h.icd > 0) h.icd -= dt;
  if (h.s2cd > 0) h.s2cd -= dt;
  const s = slotPos(i);
  if (h.down) {   // 쓰러지면 대열을 따라다니다가, 필드에서는 REVIVE_T초 · 마을에서는 곧바로 일어난다
    h.walk = moveToward(h, s.x, s.y, squadSpeed() * 1.4, dt, 2);
    if (d2(h.x, h.y, P.x, P.y) > 300 * 300) { h.x = P.x; h.y = P.y; }
    h.downT += dt;
    if (h.downT >= reviveNeed()) revive(h);
    return;
  }
  h.cd -= dt; if (h.skillCd > 0) h.skillCd -= dt;
  if (!auto) {   // 움직이는 중: 대열 자리만 따라간다
    h.target = null;
    h.walk = moveToward(h, s.x, s.y, squadSpeed() * 1.4, dt, 2);
    if (d2(h.x, h.y, P.x, P.y) > 300 * 300) { h.x = P.x + rand(-12, 12); h.y = P.y + rand(-12, 12); }   // 모퉁이에 걸려 뒤처지면 대열로 데려온다
    return;
  }
  h.think -= dt;
  if (h.think <= 0) {
    h.think = 0.25 + Math.random() * 0.1;
    if (h.def.heal || !(h.target && h.target.isMon && validTarget(h.target))) h.target = chooseTarget(h);
  } else if (!validTarget(h.target)) h.target = chooseTarget(h);
  const cdr = 1 - stat(h, 'cdr');
  if (h.skillCd <= 0 && cast1(h)) h.skillCd = h.def.s1.cd * cdr;
  if (h.def.s2.trig === 'cd' && skill2On(h) && h.s2cd <= 0 && cast2(h, null)) h.s2cd = h.def.s2.cd * cdr;
  if (h.awakeT > 0) h.awakeT -= dt;
  const d0 = h.def;
  if (h.def.s4 && skillOn(h, 4)) {   // 네 번째 스킬(각성): 싸우는 중에(치유사는 동료를 돌보는 중에도) 쿨타임이 차면 켜진다
    h.s4cd -= dt;
    if (h.s4cd <= 0 && h.target && (h.target.isMon || (d0.heal && h.target.isHero))) {
      h.s4cd = h.def.s4.cd * cdr; h.awakeT = h.def.s4.dur;
      skillText(h, h.def.s4.name); fxs.push({ kind: 'ring', x: h.x, y: h.y, r: 70, t: 0, T: 0.5, c: h.def.color });
    }
  }
  const t = h.target;
  if (!t) { h.walk = moveToward(h, s.x, s.y, 170, dt, 3); return; }
  const reach = h.def.range > 0 ? h.def.range : h.def.r + targetR(t) + 6 + (h.def.reach || 0);
  const dd = Math.hypot(t.x - h.x, t.y - h.y);
  h.walk = dd > reach ? moveToward(h, t.x, t.y, 190, dt, reach - 2) : false;
  h.face = t.x < h.x ? -1 : 1;
  if (dd <= reach + 4 && h.cd <= 0) { h.cd = 1 / (h.def.rate * stat(h, 'aspd')); heroAttack(h, t); }
}
function fxSlash(h, t, r) { fxs.push({ kind: 'slash', x: h.x, y: h.y - 14, a: Math.atan2(t.y - h.y, t.x - h.x), r: r || h.def.r + 14 + (h.def.reach || 0), t: 0, T: 0.18, c: '#fff6e0' }); }
function heroAttack(h, t) {
  h.swing = 0.2;
  const d = h.def;
  if (t.isHero) { projs.push({ kind: 'spark', x: h.x, y: h.y - 20, t, tx: t.x, ty: t.y, owner: h, spd: 420, heal: d.heal * (1 + 0.1 * lv.forge) * lvMul(h.idx) * supplyMul() * (h.awakeT > 0 ? 2 : 1) }); return; }
  if (t.isNode) {
    if (d.range > 0 && d.proj !== 'bolt') projs.push({ kind: d.proj, x: h.x, y: h.y - 18, t, tx: t.x, ty: t.y, owner: h, spd: 520, node: true });
    else {
      if (d.proj === 'bolt') fxs.push({ kind: 'bolt', x: h.x, y: h.y - 20, x2: t.x, y2: t.y - 14, t: 0, T: 0.2, c: '#fff3a0', seed: Math.random() });
      else fxSlash(h, t);
      damageNode(t, chopDmg());
    }
    return;
  }
  if (d.proj === 'bolt') { chainBolt(h, t, 1 + d.chain, 1, 0.7, 150); onBasicHit(h, t); return; }
  if (d.range > 0) { projs.push({ kind: d.proj, x: h.x, y: h.y - 18, t, tx: t.x, ty: t.y, owner: h, spd: d.proj === 'fire' ? 360 : 520, ratio: 1, splash: d.splash || 0, basic: true }); return; }
  fxSlash(h, t);
  hitMonster(h, t, 1);
  onBasicHit(h, t);
}
// 기본 공격이 맞았을 때: 상태이상 부여, 두 번째 스킬 발동 조건 확인
function onBasicHit(h, t) {
  h.basicCount++;
  const d = h.def;
  if (d.onHit && t.isMon && !t.dead && Math.random() < d.onHit.p) applyStatus(t, d.onHit.st, d.onHit.n, h);
  if (!skill2On(h)) return;
  const s2 = d.s2;
  if (s2.trig === 'every' && h.basicCount % s2.n === 0) cast2(h, t);
  else if (s2.trig === 'status' && h.icd <= 0 && t.isMon && !t.dead) {
    const ok = s2.st === 'freeze' ? t.frozenT > 0 : !!(t.st[s2.st] && t.st[s2.st].n >= s2.need);
    if (ok) { h.icd = s2.icd; cast2(h, t); }
  }
}
function onCrit(h, m) { if (h.def.s2.trig === 'crit' && skill2On(h) && h.icd <= 0) { h.icd = h.def.s2.icd; cast2(h, m); } }
function chainBolt(h, first, count, ratio0, ratio, range) {
  const hit = [first];
  let cur = first;
  while (hit.length < count) {
    let best = null, bd = range * range;
    for (const m of monsters) { if (m.dead || hit.includes(m)) continue; const dd = d2(m.x, m.y, cur.x, cur.y); if (dd < bd) { bd = dd; best = m; } }
    if (!best) break;
    hit.push(best); cur = best;
  }
  let px = h.x, py = h.y - 20;
  hit.forEach((m, k) => {
    fxs.push({ kind: 'bolt', x: px, y: py, x2: m.x, y2: m.y - 12, t: 0, T: 0.22, c: '#fff3a0', seed: Math.random() });
    px = m.x; py = m.y - 12;
    hitMonster(h, m, k === 0 ? ratio0 : ratio);
  });
}
function lineHit(h, x, y, ang, len, w, ratio, col) {   // 일직선 관통
  const cx = Math.cos(ang), cy = Math.sin(ang);
  for (const m of monsters) {
    if (m.dead) continue;
    const dx = m.x - x, dy = m.y - y, along = dx * cx + dy * cy;
    if (along < 0 || along > len) continue;
    if (Math.abs(dx * cy - dy * cx) < w + m.r) hitMonster(h, m, ratio, { canCrit: false, color: col });
  }
  fxs.push({ kind: 'beam', x, y: y - 14, x2: x + cx * len, y2: y - 14 + cy * len, t: 0, T: 0.3, c: col });
}
function skillText(h, name) { addText(h.x, h.y - h.def.r * 2 - 26, name + '!', '#ffe08a', false, 1.1, 15); }
// 첫 번째 스킬 (쿨타임). 조건이 안 맞으면 false를 돌려 쿨타임을 쓰지 않는다
// 여러 영웅이 같은 틀을 쓴다: d.k1(없으면 자기 id)이 틀의 이름이고, 수치는 d.s1에 적힌 것을 먼저 쓴다 (없으면 그 틀의 기본값)
function cast1(h) {
  const d = h.def, S = d.s1, has = k => Object.prototype.hasOwnProperty.call(S, k);
  switch (d.k1 || d.id) {
    case 'luke': {
      if (!monstersNear(h.x, h.y, 170).length) return false;
      for (const m of monstersNear(h.x, h.y, 240)) { m.forced = h; m.forcedT = 4; if (m.state === 'idle') m.state = 'chase'; }
      h.guardT = 4;
      fxs.push({ kind: 'ring', x: h.x, y: h.y, r: 240, t: 0, T: 0.45, c: '#7fb0ff' });
      break;
    }
    case 'teo': {
      const ts = monstersNear(h.x, h.y, d.range + 20).sort((a, b) => d2(a.x, a.y, h.x, h.y) - d2(b.x, b.y, h.x, h.y)).slice(0, 5);
      if (!ts.length) return false;
      for (let i = 0, n = S.n || 5; i < n; i++) { const t = ts[i % ts.length]; projs.push({ kind: 'arrow', gold: true, x: h.x + rand(-6, 6), y: h.y - 18 + rand(-6, 6), t, tx: t.x, ty: t.y, owner: h, spd: 520 + i * 40, ratio: S.ratio || 1.2 }); }
      break;
    }
    case 'bella': {
      if (!heroes.some(a => !a.down && a.hp / a.maxHp < 0.6)) return false;
      for (const a of heroes) if (!a.down) { healHero(a, a.maxHp * (S.pct || 0.35)); fxs.push({ kind: 'ring', x: a.x, y: a.y, r: 34, t: 0, T: 0.5, c: '#9ff0c0' }); }
      break;
    }
    case 'mina': {
      const rr = S.r || 100, near = monstersNear(h.x, h.y, rr);
      if (near.length < 2 && !(near.length && near[0].d.boss)) return false;
      for (const m of near) hitMonster(h, m, S.ratio || 2.2, { st: has('st') ? S.st : 'bleed', color: '#ffd0dc' });
      fxs.push({ kind: 'whirl', x: h.x, y: h.y - 12, r: rr, t: 0, T: 0.35, c: d.id === 'mina' ? '#ff9ab5' : d.color });
      break;
    }
    case 'lora': {
      const cand = monstersNear(h.x, h.y, d.range + 40);
      if (!cand.length) return false;
      const c = densest(cand, 110);
      delayed.push({ kind: 'meteor', x: c.x, y: c.y, r: 120, t: 0.55, T: 0.55, ratio: S.ratio || 4.5, st: S.st || 'burn', stacks: S.stacks || 2, owner: h });
      break;
    }
    case 'siu': {
      const near = monstersNear(h.x, h.y, 150);
      if (!near.length) return false;
      for (const m of near) hitMonster(h, m, 1.8, { st: 'frost', stacks: 2, color: '#c8f4ff' });
      fxs.push({ kind: 'frost', x: h.x, y: h.y, r: 150, t: 0, T: 0.5, c: '#bdefff' });
      break;
    }
    case 'ruby': {
      const cand = monstersNear(h.x, h.y, d.range + 40);
      if (!cand.length) return false;
      const c = densest(cand, 100);
      delayed.push({ kind: 'cloud', x: c.x, y: c.y, r: 100, t: 4, T: 4, tick: 0, owner: h });
      for (const m of monstersNear(c.x, c.y, 100)) hitMonster(h, m, 0.6, { st: 'poison', color: '#b8f090' });
      break;
    }
    case 'bori': {
      const near = monstersNear(h.x, h.y, 150);
      if (!near.length) return false;
      for (const m of near) if (!m.d.boss) { m.x += (h.x - m.x) * 0.6; m.y += (h.y - m.y) * 0.6; }
      for (const m of monstersNear(h.x, h.y, 110)) hitMonster(h, m, S.ratio || 2, { st: has('st') ? S.st : 'bleed', stacks: 2, color: '#ffc7a0' });
      fxs.push({ kind: 'whirl', x: h.x, y: h.y - 12, r: 110, t: 0, T: 0.4, c: d.id === 'bori' ? '#e0a060' : d.color });
      break;
    }
    case 'chichi': {
      if (!monstersNear(P.x, P.y, ENGAGE).length) return false;
      if (buffs.aspdT > 0 && buffs.aspd > (S.aspd || 0.3)) return false;   // 더 센 응원이 걸려 있으면 덮어쓰지 않고 기다린다
      buffs.aspd = S.aspd || 0.3; buffs.aspdT = S.dur || 8;
      for (const a of heroes) if (!a.down) fxs.push({ kind: 'ring', x: a.x, y: a.y, r: 30, t: 0, T: 0.5, c: d.color });
      break;
    }
    case 'kai': {
      const cand = monstersNear(h.x, h.y, d.range + 20);
      if (!cand.length) return false;
      for (let k = 0, n = S.n || 6; k < n; k++) { const m = pick(cand); delayed.push({ kind: 'strike', x: m.x, y: m.y, target: m, t: 0.12 * k + 0.05, T: 0.4, ratio: S.ratio || 2, owner: h }); }
      break;
    }
    default: return false;
  }
  skillText(h, d.s1.name);
  return true;
}
// 두 번째 스킬. t = 조건을 만든 적 (없을 수도 있다)
function cast2(h, t) {
  const d = h.def, S = d.s2;
  switch (d.k2 || d.id) {
    case 'luke': {
      const near = monstersNear(h.x, h.y, 90);
      if (!near.length) return false;
      for (const m of near) {
        hitMonster(h, m, 1.5);
        if (!m.d.boss && !m.dead) { const a = Math.atan2(m.y - h.y, m.x - h.x); m.x += Math.cos(a) * 40; m.y += Math.sin(a) * 40; }
      }
      fxs.push({ kind: 'ring', x: h.x, y: h.y, r: 90, t: 0, T: 0.3, c: '#c9d2e3' });
      break;
    }
    case 'teo': {
      let best = null;
      for (const m of monstersNear(h.x, h.y, 320)) if (!best || m.hp > best.hp) best = m;
      if (!best) return false;
      lineHit(h, h.x, h.y, Math.atan2(best.y - h.y, best.x - h.x), 420, 26, 3, '#ffe08a');
      break;
    }
    case 'bella': {
      const a = heroes.find(o => o.down);
      if (!a) return false;
      revive(a);
      fxs.push({ kind: 'ring', x: a.x, y: a.y, r: 50, t: 0, T: 0.6, c: '#fff3a8' });
      break;
    }
    case 'mina': if (!t || t.dead) return false; hitMonster(h, t, S.ratio || 3.5, { canCrit: false, color: '#ff8aa8' }); break;
    case 'lora': {
      const cand = monstersNear(h.x, h.y, d.range + 20);
      if (!cand.length) return false;
      for (let k = 0; k < 3; k++) { const m = pick(cand); projs.push({ kind: 'fire', x: h.x, y: h.y - 24, t: m, tx: m.x, ty: m.y, owner: h, spd: 400 + k * 30, ratio: 1.2, splash: 50, st: 'burn', stacks: 1 }); }
      break;
    }
    case 'siu': if (!t || t.dead) return false; lineHit(h, h.x, h.y, Math.atan2(t.y - h.y, t.x - h.x), 260, 30, S.ratio || 2.5, d.id === 'aria' ? '#fff3c0' : '#bdefff'); break;
    case 'ruby': {
      if (!t || t.dead || !t.st.poison) return false;
      const n = t.st.poison.n;
      delete t.st.poison;
      hitMonster(h, t, 1 + 0.4 * n, { canCrit: false, color: STATUS.poison.col });
      stunMon(t, 1);
      fxs.push({ kind: 'ring', x: t.x, y: t.y, r: 60, t: 0, T: 0.35, c: STATUS.poison.col });
      break;
    }
    case 'chichi': if (buffs.ampT > 0 && buffs.amp > (S.amp || 0.2)) return false; buffs.amp = S.amp || 0.2; buffs.ampT = 5; break;
    case 'kai': if (!t || t.dead) return false; chainBolt(h, t, 5, 1.2, 1.2, 170); break;
    default: return false;
  }
  skillText(h, d.s2.name);
  return true;
}
function healHero(a, amt, quiet) {
  if (a.down) return;
  const before = a.hp; a.hp = Math.min(a.maxHp, a.hp + amt);
  if (!quiet && settings.dmgText && a.hp - before >= 1) addText(a.x, a.y - a.def.r * 2 - 10, '+' + Math.round(a.hp - before), '#9ff0c0', true);
}
function damageHero(h, dmg) {
  if (h.down || h.invulnT > 0) return;
  if (Math.random() < stat(h, 'dodge')) { if (settings.dmgText) addText(h.x, h.y - h.def.r * 2 - 10, '회피', '#cfe8ff', true); return; }
  dmg *= 1 - stat(h, 'dr');
  if (h.guardT > 0) dmg *= 0.5;
  h.hp -= dmg; h.flash = 0.12;
  if (settings.dmgText) addText(h.x + rand(-6, 6), h.y - h.def.r * 2 - 10, Math.round(dmg), '#ff8a80', true);
  if (h.hp <= 0) {
    h.hp = 0; h.down = true; h.downT = 0; h.target = null; burst(h.x, h.y - 10, '#8a8fa3', 16, 150); addText(h.x, h.y - 44, '쓰러짐', '#ff8a80');
    if (!mode && !inVillage(P.x, P.y)) tip('down');
  }
}

// ================= 피해 · 상태이상 =================
// src = 공격한 영웅(스킬북처럼 없을 수도 있음), ratio = 공격력 배율. o: { st, stacks, color, canCrit, fixed }
function hitMonster(src, m, ratio, o = {}) {
  if (!m || m.dead) return 0;
  let dmg, crit = false;
  if (o.fixed != null) dmg = o.fixed;
  else {
    dmg = heroAtk(src) * ratio;
    if (o.canCrit !== false && Math.random() < stat(src, 'crit')) { crit = true; dmg *= stat(src, 'critDmg'); }
  }
  dmg *= 1 + (buffs.ampT > 0 ? buffs.amp : 0);
  if (mode && mode.oneDamage) dmg = 1;   // 황금 돼지: 어떤 공격이든 1
  dealDamage(m, dmg, src, crit ? '#ffe066' : o.color, crit, false);
  if (src) {
    if (o.st && !m.dead) applyStatus(m, o.st, o.stacks || 1, src);
    const ls = stat(src, 'ls');
    if (ls > 0 && !src.down) healHero(src, dmg * ls, true);
    if (crit && !m.dead) onCrit(src, m);
  }
  return dmg;
}
function dealDamage(m, dmg, src, color, crit, dot) {
  if (m.dead) return;
  m.hp -= dmg; m.flash = 0.1;
  if (settings.dmgText) addText(m.x + rand(-8, 8), m.y - m.r * 2 - 8, crit ? `${Math.round(dmg)}!` : String(Math.round(dmg)), color || '#fff4dc', dot, 0.8, crit ? 17 : dot ? 12 : 14);
  if (m.state === 'idle') { m.state = 'chase'; m.target = src && src.isHero && !src.down ? src : nearestHero(m.x, m.y, 9999); }
  if (m.hp <= 0) killMonster(m);
}
function applyStatus(m, type, n, src) {
  if (m.dead) return;
  if (!m.arena && REG().immune === type) return;   // 지역 면역
  const S = STATUS[type];
  const s = m.st[type] || (m.st[type] = { n: 0, t: 0, atk: 0, acc: 0, src });
  s.n = Math.min(S.max, s.n + n); s.t = S.dur; s.atk = src ? heroAtk(src) : teamAtk(); s.src = src;
  if (s.n >= S.max) maxStack(m, type, s);
}
function stunMon(m, t) { if (m.d.pig) return; m.stunT = Math.max(m.stunT, m.d.boss ? t * 0.5 : t); }
function maxStack(m, type, s) {   // 최대 중첩 효과 뒤 초기화
  delete m.st[type];
  const one = mode && mode.oneDamage, S = STATUS[type];
  const label = t => { if (settings.dmgText) addText(m.x, m.y - m.r * 2 - 24, t, S.col, false, 0.9, 13); };
  switch (type) {
    case 'poison': stunMon(m, 1.5); label('기절'); break;
    case 'bleed': label('과다 출혈'); dealDamage(m, one ? 1 : m.d.boss ? Math.min(m.hp * 0.08, s.atk * 5) : Math.max(1, m.hp * 0.1), s.src, S.col, false, true); break;
    case 'burn': {
      label('폭발');
      fxs.push({ kind: 'ring', x: m.x, y: m.y, r: 70, t: 0, T: 0.3, c: S.col });
      for (const o of monsters) if (!o.dead && d2(o.x, o.y, m.x, m.y) < (70 + o.r) ** 2) dealDamage(o, one ? 1 : s.atk, s.src, S.col, false, true);
      break;
    }
    case 'frost': stunMon(m, 1.6); m.frozenT = m.d.boss ? 0.8 : 1.6; label('결빙'); break;
  }
}
function tickStatus(m, dt) {   // 몬스터가 죽으면 false
  for (const k in m.st) {
    const s = m.st[k], S = STATUS[k];
    s.t -= dt;
    if (S.dot) {
      s.acc += dt;
      while (s.acc >= 1) {
        s.acc -= 1;
        dealDamage(m, mode && mode.oneDamage ? 1 : s.atk * S.dot * s.n, s.src, S.col, false, true);
        if (m.dead) return false;
      }
      if (settings.effects && Math.random() < dt * 3) parts.push({ x: m.x + rand(-8, 8), y: m.y - rand(6, 26), vx: 0, vy: -40, life: 0.4, max: 0.4, c: S.col, sz: 3 });
    }
    if (s.t <= 0) delete m.st[k];
  }
  return true;
}
const slowOf = m => 1 - (m.st.frost ? m.st.frost.n * STATUS.frost.slow : 0);

// ================= 몬스터 =================
function enemyShot(m, t) {
  const a = Math.atan2(t.y - m.y, t.x - m.x), sp = 250, dd = Math.hypot(t.x - m.x, t.y - m.y);
  orbs.push({ x: m.x, y: m.y - 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: dd / sp + 0.35, dmg: m.atk });
}
function bossAI(m, dt) {
  m.skillT -= dt; m.sumT -= dt;
  if (m.slam) {
    m.slam.t -= dt;
    if (m.slam.t <= 0) {   // 내려찍기: 보라색 원 안에 있으면 큰 피해. 움직여서 피할 수 있다
      const s = m.slam; m.slam = null;
      // 피해는 공격력의 2.5배와 "그 영웅 최대 체력의 BOSS_SLAM_HP" 가운데 큰 쪽. 아무리 키워도 연달아 두 번 맞으면 버티기 어렵다 → 피해야 한다
      for (const h of heroes) if (!h.down && d2(h.x, h.y, s.x, s.y) < (s.r + h.def.r) ** 2) damageHero(h, Math.max(m.atk * 2.5, h.maxHp * BOSS_SLAM_HP));
      shake(10); burst(s.x, s.y, '#b59cff', 40, 320);
      fxs.push({ kind: 'ring', x: s.x, y: s.y, r: s.r, t: 0, T: 0.35, c: '#c9b3ff' });
    }
  } else if (m.skillT <= 0) {
    m.skillT = m.hp < m.maxHp * 0.3 ? 4.5 : 6.5;
    m.slam = { x: m.x, y: m.y, r: 165, t: 1.2, T: 1.2 };
  }
  if (m.sumT <= 0) {
    m.sumT = 15;
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU), s = makeMonster('skeleton', m.x + Math.cos(a) * 70, m.y + Math.sin(a) * 70, m.den, false, m.arena ? mode.mul : m.mul / BOSS_MUL);   // 부하는 그 구역의 보통 몬스터만큼 (보스 배율을 뺀다)
      s.summoned = true; s.arena = m.arena; s.state = 'chase'; s.target = nearestHero(s.x, s.y, 9999);
      monsters.push(s); burst(s.x, s.y, '#9b8cff', 10, 120);
    }
  }
}
function updMonster(m, dt) {
  const d = m.d;
  if (m.flash > 0) m.flash -= dt;
  if (m.atkAnim > 0) m.atkAnim -= dt;
  if (m.frozenT > 0) m.frozenT -= dt;
  if (!tickStatus(m, dt)) return;
  if (m.stunT > 0) { m.stunT -= dt; m.walk = false; return; }
  if (m.forcedT > 0) { m.forcedT -= dt; if (m.forcedT <= 0) m.forced = null; }
  const spd = d.spd * slowOf(m);
  m.walk = false;
  if (d.pig) { pigAI(m, dt, spd); return; }
  if (m.state === 'idle') {
    m.wT -= dt;
    const home = m.arena ? { x: ARENA.x, y: ARENA.y } : m.den;
    if (m.wT <= 0) { m.wT = rand(1.5, 4); const a = rand(0, TAU), rr = rand(0, home.boss ? 60 : 110); m.wx = home.x + Math.cos(a) * rr; m.wy = home.y + Math.sin(a) * rr; }
    m.walk = moveToward(m, m.wx, m.wy, spd * 0.35, dt, 4);
    m.look -= dt;
    if (m.look <= 0) {
      m.look = 0.25;
      const h = nearestHero(m.x, m.y, m.arena ? 99999 : d.aggro);
      if (h && (m.arena || (!inVillage(h.x, h.y, 20) && los(m.x, m.y, h.x, h.y)))) { m.state = 'chase'; m.target = h; }
      else if (m.arena && mode && mode.statue) { m.state = 'chase'; m.target = null; }
    }
  } else if (m.state === 'chase') {
    const forced = m.forced && !m.forced.down ? m.forced : null;
    let t = forced || m.target;
    m.look -= dt;
    if (!t || t.down || m.look <= 0) { m.look = 0.4; if (!forced) { t = nearestHero(m.x, m.y, m.arena ? 99999 : d.aggro * 1.8); m.target = t; } }
    if (m.arena && mode && mode.statue && (!t || d2(t.x, t.y, m.x, m.y) > 140 * 140)) t = mode.statue;   // 마을 방어: 수호상을 노린다
    const leash = d.boss ? 750 : 520;
    m.stuckT = m.blocked ? m.stuckT + dt : 0;   // 산에 막혀 못 가는 시간
    const leashed = !m.arena && ((!(m.lured && camp) && d2(m.x, m.y, m.den.x, m.den.y) > leash * leash) || m.stuckT > 1.5);
    if (!m.arena && (!t || leashed || inVillage(t.x, t.y, 10))) {
      m.state = 'return'; m.target = null; m.forced = null; m.slam = null; m.lured = false;
    } else if (!t) {
      m.state = 'idle';
    } else {
      if (d.boss) bossAI(m, dt);
      if (!m.slam) {
        const range = d.ranged || m.r + targetR(t) + 4;
        const dd = Math.hypot(t.x - m.x, t.y - m.y);
        if (dd > range) m.walk = moveToward(m, t.x, t.y, spd, dt, range - 2);
        else { m.face = t.x < m.x ? -1 : 1; m.blocked = false; }
        m.cd -= dt;
        if (dd <= range + 3 && m.cd <= 0) {
          m.cd = d.rate * (d.boss && m.hp < m.maxHp * 0.3 ? 0.7 : 1); m.atkAnim = 0.22;
          if (t.isStatue) damageStatue(m.atk);
          else if (d.ranged) enemyShot(m, t);
          else damageHero(t, m.atk);
        }
      }
    }
  } else {   // return: 소굴로 돌아가며 회복
    m.walk = moveToward(m, m.den.x, m.den.y, spd * 1.15, dt, 20);
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3 * dt);
    m.stuckT = m.blocked ? m.stuckT + dt : 0;
    if (m.stuckT > 1) { m.x = m.den.x; m.y = m.den.y; m.stuckT = 0; }   // 돌아가는 길이 막히면 소굴로 바로 보낸다
    if (d2(m.x, m.y, m.den.x, m.den.y) < 45 * 45) { m.state = 'idle'; m.hp = m.maxHp; m.st = {}; }
  }
  if (m.arena) return;
  const vr = VILLAGE_R + m.r, dv2 = d2(m.x, m.y, VC.x, VC.y);
  if (dv2 < vr * vr) { const dv = Math.sqrt(dv2) || 1; m.x = VC.x + (m.x - VC.x) / dv * vr; m.y = VC.y + (m.y - VC.y) / dv * vr; }
}
function killMonster(m) {
  m.dead = true; kills++;
  burst(m.x, m.y - 10, m.col, m.d.boss ? 80 : m.elite ? 28 : 14, m.d.boss ? 360 : 170);
  if (m.arena && mode) modeKill(m);
  if (m.d.pig) return;
  // 필드 몬스터는 깊은 구역일수록 강한 만큼 더 많이 준다 (드랍은 배율의 제곱근, 경험치는 0.6제곱)
  const field = !(m.arena && mode), den = m.den, depth = (den && den.depth) || 1;
  const loot = field ? Math.sqrt(m.mul) : mode.loot, el = m.elite ? 3 : 1;   // 고기: 몬스터 배율의 제곱근 (지역이 바뀌어도 그대로 이어진다)
  const drop = (type, n) => { for (let left = n; left > 0; left -= 10) spawnPickup(type, m.x, m.y - 10, Math.min(10, left)); };
  drop('gold', Math.round(randi(m.d.gold[0], m.d.gold[1]) * (field ? REG().loot : loot) * el));   // 금화는 깊이에 따라 늘지 않는다 (고기만 는다)
  drop('meat', Math.round(randi(m.d.meat[0], m.d.meat[1]) * loot * el));
  gainXp(m.d.xp * (m.elite ? 4 : 1) * (camp ? 2 : 1) * (field ? Math.pow(m.mul, 0.6) : mode.xpMul));
  if (Math.random() < (m.elite || m.d.boss ? BOOK_P.elite : BOOK_P.normal)) spawnPickup(pick(Object.keys(BOOKS)), m.x, m.y - 10);
  const tier = field ? REG().tier + 1 + Math.floor(depth / 6) : mode.tier;
  if (m.elite) dropItem(makeItem(tier), m.x, m.y);
  if (m.d.boss) { dropItem(makeItem(tier + 1, 2), m.x, m.y); dropItem(makeItem(tier + 1, 2), m.x, m.y); }
  if (field && !m.summoned) {
    // 정화 마법진의 사냥 조건: 그 마법진까지 갈 수 있게 된 뒤에 잡은 것만 센다
    for (const g of gates) if (g.req.type === 'hunt' && g.req.mon === m.type && g.n < g.req.n && sectors[g.from].open && !sectors[g.sec].open) g.n++;
    const mi = missions[mIdx];
    if (mi && mi.type === 'hunt' && mi.mon === m.type) mN++;   // 임무의 사냥
    if (den && den.guard && m.elite) { den.guard.n = 1; toast('길목을 지키던 정예를 물리쳤어요. 마법진 위에 멈춰 서세요'); }
  }
  if (den && !m.summoned && !m.arena) {
    const k = den.members.indexOf(m); if (k >= 0) den.members.splice(k, 1);
    if (!den.members.length) den.respawnAt = den.guard && den.guard.n ? 0 : now + 30;   // 길목의 정예는 다시 나오지 않는다
  }
  if (m.d.boss && !m.arena) {
    RD().bd = true; winT = 2; shake(14);
    toast(`${REG().boss}를 물리쳤다!`);
    for (const o of monsters) if (o.summoned) o.state = 'return';
  }
}
function separate() {
  for (const m of monsters) {
    if (m.dead) continue;
    forNear(m.x, m.y, o => {
      if (o.id <= m.id || o.dead) return;
      const rr = m.r + o.r, dx = o.x - m.x, dy = o.y - m.y, dd = dx * dx + dy * dy;
      if (dd >= rr * rr) return;
      if (dd < 0.0001) { o.x += rand(-1, 1); o.y += rand(-1, 1); return; }
      const dl = Math.sqrt(dd), push = (rr - dl) / 2, nx = dx / dl, ny = dy / dl;
      const wm = m.d.boss ? 0.1 : 1, wo = o.d.boss ? 0.1 : 1;
      nudge(m, -nx * push * wm, -ny * push * wm); nudge(o, nx * push * wo, ny * push * wo);
    });
  }
  for (let i = 0; i < heroes.length; i++) for (let j = i + 1; j < heroes.length; j++) {
    const a = heroes[i], b = heroes[j];
    if (a.down || b.down) continue;
    const rr = a.def.r + b.def.r - 2, dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
    if (dd >= rr * rr) continue;
    if (dd < 0.0001) { b.x += rand(-1, 1); continue; }
    const dl = Math.sqrt(dd), push = (rr - dl) / 2;
    nudge(a, -dx / dl * push, -dy / dl * push); nudge(b, dx / dl * push, dy / dl * push);
  }
  for (const h of heroes) {
    if (h.down) continue;
    forNear(h.x, h.y, m => {
      if (m.dead) return;
      const rr = h.def.r + m.r, dx = m.x - h.x, dy = m.y - h.y, dd = dx * dx + dy * dy;
      if (dd >= rr * rr || dd < 0.0001) return;
      const dl = Math.sqrt(dd), push = rr - dl, nx = dx / dl, ny = dy / dl, hw = m.d.boss ? 0.8 : 0.3;
      nudge(h, -nx * push * hw, -ny * push * hw); nudge(m, nx * push * (1 - hw), ny * push * (1 - hw));
    });
  }
}

// ================= 용병단 레벨 =================
function gainXp(n) {
  life.xp += n;   // 최고 레벨에 닿은 뒤에도 센다 (경험치 식을 맞출 때 본다)
  if (squad.lvl >= SQUAD_MAX_LV) return;
  squad.xp += n;
  while (squad.lvl < SQUAD_MAX_LV && squad.xp >= xpNeed(squad.lvl)) {
    squad.xp -= xpNeed(squad.lvl); squad.lvl++;
    const opened = Object.keys(UNLOCK).filter(k => UNLOCK[k] === squad.lvl).map(k => UNLOCK_NAME[k]);
    toast(`용병단 Lv${squad.lvl}!${opened.length ? ' 새로 열림: ' + opened.join(', ') : ''}`);
    burst(P.x, P.y - 20, '#ffe08a', 30, 220);
  }
  if (squad.lvl >= SQUAD_MAX_LV) squad.xp = 0;
}

// ================= 장비 =================
function rollGrade(min = 0) {
  let t = Math.random() * GRADE_W.reduce((a, b) => a + b, 0), g = 0;
  for (; g < 3; g++) { t -= GRADE_W[g]; if (t < 0) break; }
  return Math.max(min, g);
}
function makeItem(tier, minGrade = 0, slotId) {
  const slot = slotId ? SLOT[slotId] : SLOTS[randi(0, 5)];
  const grade = rollGrade(minGrade);
  tier = clamp(Math.round(tier), 1, 12);
  const main = slot.main === 'any' ? (Math.random() < 0.5 ? 'atk' : 'hp') : slot.main;
  const pool = OPT_POOL[main].slice(), opts = [];
  for (let k = 0; k < GRADES[grade].opts && pool.length; k++) {
    const o = pool.splice(randi(0, pool.length - 1), 1)[0], O = OPTS[o];
    opts.push({ stat: o, val: Math.round((O.base + O.per * (tier - 1)) * rand(0.6, 1) * 10) / 10 });
  }
  return { id: ++gear.uid, slot: slot.id, grade, tier, main: { stat: main, val: mainVal(main, tier, grade) }, opts, lock: false };
}
const itemName = it => `${GRADES[it.grade].name} ${SLOT[it.slot].name}`;
const itemScore = it => it.main.val * (it.main.stat === 'atk' ? 1 : 0.7) + it.opts.reduce((s, o) => s + o.val * OPTS[o.stat].w, 0);
const dismantleValue = it => Math.round(5 * it.tier * (it.grade + 1));
function dropItem(it, x, y) { pickups.push({ type: 'gear', item: it, x, y: y - 10, vx: rand(-60, 60), vy: rand(-30, 40), z: 0, vz: 200, t: 0, value: 1 }); }
function addItem(it) {
  if (gear.bag.length >= BAG_MAX) {
    const s = dismantleValue(it); res.stone += s; life.stone += s; bumpRes('stone');
    toast(`가방이 가득 차 ${itemName(it)}을 분해했어요 (돌 +${s})`);
    return;
  }
  gear.bag.push(it);
  if (!gear.eq[it.slot]) { equip(it.id, true); toast(`${itemName(it)} Lv${it.tier} 획득 · 빈 자리에 바로 장착`); }
  else toast(`장비 획득: ${itemName(it)} Lv${it.tier}`);
}
function equip(id, quiet) {
  const k = gear.bag.findIndex(i => i.id === id);
  if (k < 0) return;
  const it = gear.bag.splice(k, 1)[0], old = gear.eq[it.slot];
  if (old) gear.bag.push(old);
  gear.eq[it.slot] = it;
  recalcGear();
  if (!quiet) toast(`${itemName(it)} 장착`);
}
function unequip(slot) {
  const it = gear.eq[slot];
  if (!it || gear.bag.length >= BAG_MAX) return;
  delete gear.eq[slot]; gear.bag.push(it); recalcGear();
}
function dismantle(id) {
  const k = gear.bag.findIndex(i => i.id === id);
  if (k < 0 || gear.bag[k].lock) return 0;
  const it = gear.bag.splice(k, 1)[0], v = dismantleValue(it);
  res.stone += v; res.wood += Math.floor(v / 2); life.stone += v; life.wood += Math.floor(v / 2); bumpRes('stone'); bumpRes('wood');
  return v;
}
function autoEquip() {
  let n = 0;
  for (const s of SLOTS) {
    let best = gear.eq[s.id] || null;
    for (const it of gear.bag) if (it.slot === s.id && (!best || itemScore(it) > itemScore(best))) best = it;
    if (best && best !== gear.eq[s.id]) { equip(best.id, true); n++; }
  }
  return n;
}
function dismantleLow() {   // 일반 · 희귀 중 잠그지 않은 것
  let n = 0, v = 0;
  for (const it of gear.bag.slice()) if (it.grade <= 1 && !it.lock) { v += dismantle(it.id); n++; }
  return [n, v];
}

// ================= 줍기 · 스킬북 =================
function spawnPickup(type, x, y, value = 1) { pickups.push({ type, x, y, vx: rand(-80, 80), vy: rand(-40, 60), z: 0, vz: rand(140, 220), t: 0, value }); }
function collectPickup(p) {
  if (p.type === 'gear') { addItem(p.item); return; }
  if (BOOKS[p.type]) { useBook(p.type); return; }
  res[p.type] += p.value; life[p.type] += p.value; bumpRes(p.type);
  const mi = missions[mIdx];
  if (mi && mi.type === 'gather' && mi.res === p.type) mN += p.value;   // 임무의 채집
}
function useBook(type) {
  const B = BOOKS[type];
  toast(`${B.name}: ${B.desc}`);
  if (type === 'bookHeal') {
    for (const h of heroes) if (!h.down) { healHero(h, h.maxHp * 0.4); fxs.push({ kind: 'ring', x: h.x, y: h.y, r: 34, t: 0, T: 0.5, c: B.col }); }
  } else if (type === 'bookBolt') {
    const dmg = teamAtk() * 3;   // 원정대가 강해질수록 같이 세진다
    const ts = monstersNear(P.x, P.y, 450).sort((a, b) => d2(a.x, a.y, P.x, P.y) - d2(b.x, b.y, P.x, P.y)).slice(0, 8);
    ts.forEach((m, k) => delayed.push({ kind: 'strike', x: m.x, y: m.y, target: m, t: 0.08 * k + 0.05, T: 0.4, fixed: dmg }));
  } else {
    buffs.atk = 0.3; buffs.atkT = 12;
    for (const h of heroes) if (!h.down) fxs.push({ kind: 'ring', x: h.x, y: h.y, r: 30, t: 0, T: 0.5, c: B.col });
  }
}
function updPickups(dt) {
  for (const p of pickups) {
    p.t += dt;
    if (p.t < 0.5) {
      p.vz -= 700 * dt; p.z = Math.max(0, p.z + p.vz * dt);
      p.x += p.vx * dt; p.y += p.vy * dt * 0.6;
      if (p.z === 0) { p.vx *= 0.9; p.vy *= 0.9; }
      continue;
    }
    const dd = Math.hypot(P.x - p.x, P.y - p.y);
    if (dd < 380 || p.pull) {
      p.pull = true;
      const sp = Math.min(900, 220 + (p.t - 0.5) * 900);
      if (dd < 18 || sp * dt >= dd) { p.got = true; collectPickup(p); continue; }
      p.x += (P.x - p.x) / dd * sp * dt; p.y += (P.y - p.y) / dd * sp * dt; p.z = Math.max(0, p.z - 200 * dt);
    }
    if (p.t > 120) { p.got = true; if (p.type === 'gear') addItem(p.item); }   // 장비는 사라지지 않고 가방으로
  }
  pickups = pickups.filter(p => !p.got);
}

// ================= 자원 오브젝트 · 투사체 · 효과 =================
function damageNode(n, dmg) {
  if (n.hp <= 0) return;
  n.hp -= dmg; n.shake = 0.15; n.hitT = 1.5; n.acc += dmg;
  // 캐는 양은 자원 오브젝트마다 정해져 있다 (공격력 · 인원과 상관없다. 인원이 많으면 더 빨리 캘 뿐이고, 다시 자라는 시간이 수입의 한도가 된다)
  const yb = yieldBonus(), give = () => spawnPickup(n.nd.res, n.x, n.y - 10, 1 + Math.floor(yb) + (Math.random() < yb % 1 ? 1 : 0));   // 채집량 보급만큼 덤
  while (n.acc >= n.nd.per && n.left > 0) { n.acc -= n.nd.per; n.left--; give(); }
  burst(n.x, n.y - 16, n.nd.res === 'wood' ? '#b98552' : '#b8bdc9', 3, 90);
  if (n.hp <= 0) {
    while (n.left > 0) { n.left--; give(); }
    n.hp = 0; n.respawnAt = now + NODE_RESPAWN;
    burst(n.x, n.y - 16, n.nd.res === 'wood' ? '#6b8f4a' : '#9aa0ae', 14, 180);
  }
}
const aliveTarget = t => t && (t.isMon ? !t.dead : t.isNode ? t.hp > 0 : !t.down);
function updProjs(dt) {
  for (const p of projs) {
    if (aliveTarget(p.t)) { p.tx = p.t.x; p.ty = p.t.y - (p.t.isHero ? 16 : 12); }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.spd * dt;
    p.a = Math.atan2(dy, dx);
    if (d <= step + 4) { p.done = true; impact(p); continue; }
    p.x += dx / d * step; p.y += dy / d * step;
    if (p.kind === 'fire' && settings.effects && Math.random() < 0.6) parts.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, max: 0.3, c: '#ffb45a', sz: 3 });
  }
  projs = projs.filter(p => !p.done);
}
function impact(p) {
  const t = p.t;
  if (p.heal) { if (t && t.isHero) healHero(t, p.heal); return; }
  if (p.node) { if (t && t.hp > 0) damageNode(t, chopDmg()); return; }
  if (p.splash) {
    burst(p.tx, p.ty, '#ff9a4a', 8, 120);
    fxs.push({ kind: 'ring', x: p.tx, y: p.ty + 10, r: p.splash, t: 0, T: 0.25, c: '#ff9a4a' });
    for (const m of monsters) if (!m.dead && d2(m.x, m.y, p.tx, p.ty) < (p.splash + m.r) ** 2) hitMonster(p.owner, m, p.ratio * (m === t ? 1 : 0.6), { st: m === t ? p.st : null, stacks: p.stacks });
  } else if (t && t.isMon && !t.dead) hitMonster(p.owner, t, p.ratio, { st: p.st, stacks: p.stacks });
  if (p.basic && t && t.isMon) onBasicHit(p.owner, t);
}
function updOrbs(dt) {
  for (const o of orbs) {
    o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt;
    for (const h of heroes) {
      if (h.down) continue;
      if (d2(h.x, h.y - 14, o.x, o.y) < (h.def.r + 7) ** 2) { damageHero(h, o.dmg); o.life = 0; burst(o.x, o.y, '#b7a6ff', 6, 90); break; }
    }
  }
  orbs = orbs.filter(o => o.life > 0);
}
function updDelayed(dt) {
  for (const e of delayed) {
    if (e.kind === 'cloud') {   // 독구름: 0.5초마다 안의 적에게 중독 1중첩
      e.t -= dt; e.tick -= dt;
      if (e.tick <= 0) { e.tick = 0.5; for (const m of monstersNear(e.x, e.y, e.r)) applyStatus(m, 'poison', 1, e.owner); }
      if (e.t <= 0) e.done = true;
      continue;
    }
    e.t -= dt;
    if (e.t > 0) continue;
    e.done = true;
    if (e.kind === 'meteor') {
      const cold = e.st === 'frost';   // 얼음 기둥(모모)은 같은 틀에 색만 차갑게
      for (const m of monsters) if (!m.dead && d2(m.x, m.y, e.x, e.y) < (e.r + m.r) ** 2) hitMonster(e.owner, m, e.ratio, { st: e.st, stacks: e.stacks, color: cold ? '#c8f4ff' : '#ffc27a' });
      burst(e.x, e.y, cold ? '#9fe6ff' : '#ff8a3d', 34, 300); burst(e.x, e.y, cold ? '#e8fbff' : '#ffd36b', 16, 200);
      fxs.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, t: 0, T: 0.35, c: cold ? '#bdefff' : '#ffb45a' });
      shake(5);
    } else if (e.kind === 'strike') {   // 하늘에서 떨어지는 번개
      let m = e.target && !e.target.dead ? e.target : monstersNear(e.x, e.y, 80)[0];
      if (!m) continue;
      fxs.push({ kind: 'bolt', x: m.x + rand(-20, 20), y: m.y - 260, x2: m.x, y2: m.y - 10, t: 0, T: 0.25, c: '#fff3a0', seed: Math.random() });
      if (e.fixed != null) hitMonster(null, m, 0, { fixed: e.fixed, color: '#ffe066' });
      else hitMonster(e.owner, m, e.ratio, { color: '#ffe066' });
    }
  }
  delayed = delayed.filter(e => !e.done);
}
function burst(x, y, c, n, sp) {
  if (!settings.effects) return;
  for (let i = 0; i < n; i++) {
    if (parts.length > 500) parts.shift();
    const a = rand(0, TAU), s = rand(0.3, 1) * sp;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.3, life: rand(0.35, 0.8), max: 0.8, c, sz: rand(2, 4.5) });
  }
}
function addText(x, y, s, c, small, T = 0.8, size) {
  if (texts.length > 70) texts.shift();
  texts.push({ x, y, s: String(s), c, t: 0, T, size: size || (small ? 12 : 14) });
}
function shake(v) { if (!reduceMotion && settings.effects) cam.shake = Math.max(cam.shake, v); }
function updMisc(dt) {
  const fr = Math.pow(0.05, dt);
  for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= fr; p.vy = p.vy * fr + 260 * dt; }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) t.t += dt;
  texts = texts.filter(t => t.t < t.T);
  for (const f of fxs) f.t += dt;
  fxs = fxs.filter(f => f.t < f.T);
  for (const k of tokens) k.t += dt * 2.6;
  tokens = tokens.filter(k => k.t < 1);
  for (const n of nodes) { if (n.shake > 0) n.shake -= dt; if (n.hitT > 0) n.hitT -= dt; }
  if (buffs.atkT > 0) buffs.atkT -= dt;
  if (buffs.aspdT > 0) buffs.aspdT -= dt;
  if (buffs.ampT > 0) buffs.ampT -= dt;
}

// ================= 필드: 보물상자 · 던전 입구 · 캠프 =================
function markChests() { for (const c of chests) c.opened = daily.opened[regionIdx].includes(c.i); }
function checkDaily() {
  const t = todayStr();
  if (daily.date === t) return;
  daily = { date: t, chests: 0, opened: REGIONS.map(() => []), pig: 0, dungeon: 0, defense: 0, campSec: 0 };
  markChests();
  if (state === 'play' || state === 'menu') toast('새로운 하루예요. 보물상자와 도전 횟수가 다시 채워졌어요');
}
let chestWarnT = -9;
function updChests() {
  if (P.moving) return;
  for (const c of chests) {
    if (c.opened || d2(c.x, c.y, P.x, P.y) > 70 * 70) continue;
    if (daily.chests >= CHESTS_PER_DAY) { if (now - chestWarnT > 6) { chestWarnT = now; toast(`오늘은 상자를 더 열 수 없어요 (하루 ${CHESTS_PER_DAY}개)`); } return; }
    openChest(c);
    return;
  }
}
function openChest(c) {
  c.opened = true; daily.opened[regionIdx].push(c.i); daily.chests++;
  const z = Math.max(1, c.zone), L = REG().loot;
  const drop = (type, n) => { for (let left = Math.round(n); left > 0; left -= 10) spawnPickup(type, c.x, c.y - 10, Math.min(10, left)); };
  drop('gold', randi(6, 12) * z * L); drop('wood', randi(5, 10) * L); drop('stone', randi(4, 8) * L); drop('meat', randi(4, 8) * z * L);
  if (Math.random() < 0.15) dropItem(makeItem(REG().tier + z), c.x, c.y);
  burst(c.x, c.y - 14, '#ffcf4a', 24, 200);
  toast(`보물상자 (${daily.chests}/${CHESTS_PER_DAY})`);
}
function updPortals() {
  for (const p of portals) {
    const on = d2(p.x, p.y, P.x, P.y) < 55 * 55;
    if (!on) { p.armed = true; continue; }
    if (P.moving || !p.armed) continue;
    p.armed = false;
    if (squad.lvl < UNLOCK.dungeon) { toast(`던전은 용병단 Lv${UNLOCK.dungeon}부터 들어갈 수 있어요`); continue; }
    openPanel('dungeon', p);
  }
}
function campBlocked() {
  if (mode || camp) return 'x';
  if (squad.lvl < UNLOCK.camp) return `캠프는 용병단 Lv${UNLOCK.camp}부터`;
  if (inVillage(P.x, P.y, 60)) return 'x';
  if (daily.campSec >= CAMP_PER_DAY) return '오늘 캠프 시간을 다 썼어요';
  if (monsters.some(m => m.d.boss && d2(m.x, m.y, P.x, P.y) < 900 * 900)) return '보스 근처에서는 캠프를 칠 수 없어요';
  return '';
}
function startCamp() {
  if (campBlocked()) return;
  camp = { x: P.x, y: P.y, t: 0, k0: kills, lure: 0 };
  toast('캠프를 쳤어요. 주변 몬스터가 몰려와요 (경험치 2배)');
}
function endCamp(msg) {
  if (!camp) return;
  toast(msg || `캠프를 걷었어요 · ${fmtTime(camp.t)} 동안 ${kills - camp.k0}마리`);
  for (const m of monsters) m.lured = false;
  camp = null;
}
function updCamp(dt) {
  if (!camp) return;
  if (P.moving || mode) { endCamp(); return; }
  camp.t += dt; daily.campSec += dt;
  if (daily.campSec >= CAMP_PER_DAY) { endCamp('오늘 캠프 시간(60분)을 다 썼어요'); return; }
  camp.lure -= dt;
  if (camp.lure <= 0) {   // 2.5초마다 주변 몬스터를 캠프로 끌어온다
    camp.lure = 2.5;
    for (const m of monsters) {
      if (m.state !== 'idle' || m.d.boss || d2(m.x, m.y, camp.x, camp.y) > 650 * 650) continue;
      const h = nearestHero(m.x, m.y, 99999);
      if (h) { m.state = 'chase'; m.target = h; m.lured = true; }
    }
  }
}

// ================= 생산소 =================
const PROD_BY = Object.fromEntries(PROD.map(p => [p.id, p]));
const prodRate = id => PROD_BY[id].rate * prod[id].lvl;            // 1분 생산량
const prodCap = id => Math.round(prodRate(id) * 60 * (2 + prod.store));
function tickProd() {   // 실제 시간으로 쌓인다 (게임을 꺼 둔 동안에도)
  const t = Date.now(), mins = Math.max(0, (t - prod.last) / 60000);
  prod.last = t;
  for (const p of PROD) { const s = prod[p.id]; s.stored = Math.min(prodCap(p.id), s.stored + prodRate(p.id) * mins); }
}
function collectProd() {
  const got = {};
  for (const p of PROD) {
    const s = prod[p.id], n = Math.floor(s.stored);
    if (n <= 0) continue;
    s.stored -= n; res[p.id] += n; life[p.id] += n; got[p.id] = n; bumpRes(p.id);
  }
  return got;
}

// ================= 마을 발판 =================
let payT = 0, lackT = -9;
const padArmed = {};
function padCost(p) {
  if (p.kind === 'pay') { const n = lv[p.id]; return n >= p.max ? null : padCostFor(p.id, n); }
  if (p.kind === 'dock' && regionData[0].bd && !lv.ship) return SHIP_COST;
  return null;
}
function padFrac(p, cost) {
  let tot = 0, got = 0;
  for (const k in cost) { tot += cost[k]; got += Math.min(cost[k], paid[p.id][k]); }
  return tot ? got / tot : 0;
}
function updatePads(dt) {
  let on = null;
  for (const p of PADS) { if (d2(P.x, P.y, p.x, p.y) < 50 * 50) on = p; else padArmed[p.id] = true; }
  if (!on || P.moving) return;
  // 창이 열리는 발판: 벗어났다가 다시 멈춰야 또 열린다
  if (on.kind === 'panel' || (on.kind === 'dock' && lv.ship)) {
    if (padArmed[on.id] !== false) { padArmed[on.id] = false; openPanel(on.kind === 'dock' ? 'sail' : on.id); }
    return;
  }
  if (on.kind === 'dock' && !regionData[0].bd) {
    if (padArmed[on.id] !== false) { padArmed[on.id] = false; toast(`${REGIONS[0].boss}를 물리치면 배를 만들 수 있어요`); }
    return;
  }
  const cost = padCost(on);
  if (!cost) return;
  payT -= dt; if (payT > 0) return; payT = 0.06;
  const pd = paid[on.id];
  const need = k => (cost[k] || 0) - pd[k];
  const keys = ['wood', 'stone', 'gold'].filter(k => need(k) > 0);
  if (!keys.length) { levelUpPad(on); return; }
  const k = keys.find(q => res[q] > 0);
  if (!k) { if (now - lackT > 3.5) { lackT = now; toast('자원이 모자라요. 필드에서 더 모아 오세요'); } return; }
  const step = Math.min(need(k), res[k], Math.max(1, Math.ceil(cost[k] / 20)));
  res[k] -= step; pd[k] += step; bumpRes(k);
  tokens.push({ type: k, sx: P.x, sy: P.y - 30, tx: on.x, ty: on.y - 40, t: 0 });
  if (['wood', 'stone', 'gold'].every(q => need(q) <= 0)) levelUpPad(on);
}
function levelUpPad(p) {
  paid[p.id] = { wood: 0, stone: 0, gold: 0 };
  payT = 1.2;   // 연달아 사 버리지 않게 잠깐 쉰다
  if (p.kind === 'dock') {
    lv.ship = 1; padArmed.dock = false;
    toast('배가 완성됐어요! 선착장에 다시 멈추면 항해할 수 있어요');
  } else {
    lv[p.id]++;
    const before = heroes.length;
    if (p.id === 'barracks') { refreshAllHp(); fillSquad(); }
    const msg = { lantern: '등불이 더 멀리 비춰요', forge: `공격력 +${lv.forge * 20}%`, barracks: `최대 체력 +${lv.barracks * 20}% · 출전 ${squadLimit()}명` }[p.id];
    toast(`${p.name} Lv${lv[p.id]} · ${msg}`);
    if (p.id === 'barracks' && heroes.length > before) toast('대기하던 영웅이 출전했어요');
  }
  burst(p.x, p.y - 30, '#ffcf6b', 36, 260);
  fxs.push({ kind: 'ring', x: p.x, y: p.y, r: 90, t: 0, T: 0.5, c: '#ffcf6b' });
  saveLocal();
}
// ================= 정화 마법진 =================
// 길목을 막은 안개는 마법진의 조건을 채우고 그 위에 멈춰 서야 걷힌다. 조건의 종류와 수치는 data.js의 GATE_* 표
function reqText(g) {
  const q = g.req;
  switch (q.type) {
    case 'pay': return Object.keys(q.cost).map(k => `${RES_NAME[k]} ${q.cost[k]}`).join(' · ') + ' 바치기';
    case 'hunt': return `${MON[q.mon].name} ${q.n}마리 처치`;
    case 'elite': return '길목을 지키는 정예 처치';
    case 'build': return `${PAD[q.pad].name} Lv${q.lv} 달성`;
    case 'squad': return `용병단 Lv${q.lv} 달성`;
    case 'recruit': return `영웅 ${q.n}명 모으기`;
    case 'herolv': return `영웅 ${q.cnt > 1 ? q.cnt + '명' : '한 명'} Lv${q.lv} 달성`;
    case 'gather': return `${RES_NAME[q.res]} ${q.n}개 모으기`;
    case 'fog': return '정화 마법진에서 안개 걷기';
  }
  return '';
}
const ownedN = () => roster.filter(r => r.owned).length;
const heroesAt = l => roster.filter(r => r.owned && r.lvl >= l).length;   // 레벨 l 이상인 보유 영웅 수
function reqDone(g) {
  const q = g.req;
  switch (q.type) {
    case 'pay': return Object.keys(q.cost).every(k => g.paid[k] >= q.cost[k]);
    case 'hunt': return g.n >= q.n;
    case 'elite': return g.n >= 1;
    case 'build': return lv[q.pad] >= q.lv;
    case 'squad': return squad.lvl >= q.lv;
    case 'recruit': return ownedN() >= q.n;
    case 'herolv': return heroesAt(q.lv) >= (q.cnt || 1);
    case 'gather': return g.n >= q.n;
    case 'fog': return sectors[q.sec].open;
  }
  return false;
}
// 임무(이정표): 지금 임무를 마법진과 같은 꼴({ req, n })로 감싸서 reqText · reqDone 등을 같이 쓴다
const curMission = () => (mIdx < missions.length ? { req: missions[mIdx], n: mN, paid: null, guard: null } : null);
function tickMission() {   // 끝난 임무를 넘긴다. 이미 채워 둔 성장 목표는 줄줄이 넘어간다
  let gold = 0, n = 0;
  for (let m = curMission(); m && reqDone(m); m = curMission()) { if (m.req.type !== 'fog') { gold += m.req.rw.gold; n++; } mIdx++; mN = 0; }
  if (!n) return;
  res.gold += gold; life.gold += gold; bumpRes('gold');
  toast(n > 1 ? `임무 ${n}개 완료 · 금화 +${gold}` : `임무 완료 · 금화 +${gold}`);
}
const gateBlocked = g => g.mi != null && mIdx < g.mi;   // 본줄기의 마법진은 임무가 거기까지 와야 쓸 수 있다
function reqProg(g) {   // 팻말에 적는 짧은 진행 상황
  const q = g.req;
  switch (q.type) {
    case 'hunt': return `${Math.min(g.n, q.n)}/${q.n}`;
    case 'build': return `지금 Lv${lv[q.pad]}`;
    case 'squad': return `지금 Lv${squad.lvl}`;
    case 'gather': return `${Math.min(g.n, q.n)}/${q.n}`;
    case 'recruit': return `지금 ${ownedN()}명`;
    case 'herolv': return q.cnt > 1 ? `지금 ${heroesAt(q.lv)}/${q.cnt}명` : `지금 최고 Lv${Math.max(...roster.filter(r => r.owned).map(r => r.lvl))}`;
  }
  return '';
}
const gateLive = g => sectors[g.from].open && !sectors[g.sec].open;   // 지금 갈 수 있고 아직 안 걷힌 마법진
function openGate(g) {
  const s = sectors[g.sec], rw = gateReward(s.depth);
  // 플레이 기록 한 줄: [지역, 구역, 깊이, 조건, 플레이 시간(초), 이 마법진에 걸린 시간(초), 용병단 Lv, 영웅 최고 Lv, 영웅 Lv 합, 보유 영웅, 대장간, 훈련장, 큰 등불, 처치 수,
  //                       그때까지 번 나무, 돌, 금화, 고기, 경험치 (총량), 주점 모집 횟수, 전투 보급 단계, 원정대 전투력]   ← 번 총량과 모집 횟수는 0.4.2부터, 보급은 0.4.3부터, 전투력은 0.4.4부터. 수입을 재서 값과 CURVE를 맞추는 데 쓴다
  const lvs = roster.filter(r => r.owned).map(r => r.lvl);
  plog.push([regionIdx, s.id, s.depth, g.req.type, Math.round(playTime), Math.round(playTime - (g.t0 < 0 ? playTime : g.t0)), squad.lvl, Math.max(...lvs), lvs.reduce((a, b) => a + b, 0), lvs.length, lv.forge, lv.barracks, lv.lantern, kills,
    ...['wood', 'stone', 'gold', 'meat', 'xp'].map(k => Math.round(life[k] || 0)), pub.pulls, lv.supply, squadPower()]);
  openSector(s, true);
  res.gold += rw.gold; life.gold += rw.gold; bumpRes('gold'); gainXp(rw.xp);
  toast(`안개가 걷혔어요! 금화 +${rw.gold}${s.way ? ' · 순간이동 표석 발견' : ''}`);
  if (s.way) tip('map');
  burst(g.x, g.y - 20, '#8ff3ff', 40, 300); shake(6);
  fxs.push({ kind: 'ring', x: g.x, y: g.y, r: 140, t: 0, T: 0.6, c: '#8ff3ff' });
  saveLocal();
}
function updGates(dt) {
  let on = null;
  for (const g of gates) { if (!gateLive(g)) continue; if (d2(P.x, P.y, g.x, g.y) < 58 * 58) on = g; else g.armed = true; }
  if (!on || P.moving) return;
  const q = on.req;
  if (gateBlocked(on)) { if (on.armed) { on.armed = false; toast('임무를 먼저 끝내야 이 안개를 걷을 수 있어요'); } return; }
  if (q.type !== 'pay') {
    if (reqDone(on)) openGate(on);
    else if (on.armed) { on.armed = false; toast(`아직 안개를 걷을 수 없어요 · ${reqText(on)}`); }
    return;
  }
  payT -= dt; if (payT > 0) return; payT = 0.06;   // 자원을 바치는 조건: 발판처럼 조금씩 들어간다
  const need = k => (q.cost[k] || 0) - on.paid[k];
  const keys = Object.keys(q.cost).filter(k => need(k) > 0);
  if (!keys.length) { openGate(on); return; }
  const k = keys.find(c => res[c] >= 1);
  if (!k) { if (now - lackT > 3.5) { lackT = now; toast('바칠 자원이 모자라요'); } return; }
  const stepN = Math.min(need(k), Math.floor(res[k]), Math.max(1, Math.ceil(q.cost[k] / 20)));
  res[k] -= stepN; on.paid[k] += stepN; bumpRes(k);
  tokens.push({ type: k, sx: P.x, sy: P.y - 30, tx: on.x, ty: on.y - 10, t: 0 });
  if (Object.keys(q.cost).every(c => need(c) <= 0)) { payT = 0.6; openGate(on); }
}
function fillSquad() {   // 출전 자리가 남으면 대기 중인 영웅을 채운다
  let active = roster.filter(r => r.owned && r.active).length;
  roster.forEach(r => { if (r.owned && !r.active && active < squadLimit()) { r.active = true; active++; } });
  rebuildSquad(true);
}

// ================= 매 프레임 업데이트 =================
function update(dt) {
  now += dt;
  if (state === 'play') playTime += dt;
  if (state === 'wipe') { wipeT -= dt; if (wipeT <= 0) finishWipe(); }
  const mv = state === 'play' ? inputVec() : { x: 0, y: 0, m: 0 };
  const was = P.moving;
  P.moving = mv.m > 0.15;
  if (P.moving) {
    const sp = squadSpeed() * clamp((mv.m - 0.15) / 0.5, 0.45, 1);
    P.fx = mv.x / mv.m; P.fy = mv.y / mv.m;
    const nx = P.x + P.fx * sp * dt, ny = P.y + P.fy * sp * dt;
    if (mode) {   // 경기장 밖으로 못 나간다
      P.x = nx; P.y = ny;
      const dx = P.x - ARENA.x, dy = P.y - ARENA.y, dd = Math.hypot(dx, dy), lim = ARENA.r - 40;
      if (dd > lim) { P.x = ARENA.x + dx / dd * lim; P.y = ARENA.y + dy / dd * lim; }
    } else if (canStand(nx, ny) || (!canStand(P.x, P.y) && canWalk(nx, ny))) { P.x = nx; P.y = ny; }   // 산과 안개에 막히면 벽을 따라 미끄러진다
    else if (canStand(nx, P.y)) P.x = nx;
    else if (canStand(P.x, ny)) P.y = ny;
    movedOnce = true;
    if (returnPos && !inVillage(P.x, P.y)) returnPos = null;
  } else if (was && movedOnce) stoppedOnce = true;
  if (!mode) {
    const z = zoneAt(P.x, P.y);
    if (z > maxZone) { maxZone = z; toast(`${ZONE_NAMES[z]}에 들어섰다`); }
    if (!RD().bs && d2(P.x, P.y, BOSS_POS.x, BOSS_POS.y) < (revealR() + 160) ** 2 && isRevealed(P.x, P.y) && secAt(P.x, P.y).boss) { RD().bs = true; toast(`폐허 깊은 곳에서 ${REG().boss}가 깨어났다`); }
    for (const s of sectors) if (s.fade > 0) s.fade = Math.max(0, s.fade - dt / 1.4);   // 걷히는 안개
  }
  buildGrid();
  const auto = state === 'play' && !P.moving;
  for (let i = 0; i < heroes.length; i++) updHero(heroes[i], dt, i, auto);
  for (const m of monsters) { if (!m.dead && (m.state !== 'idle' || m.arena || d2(m.x, m.y, P.x, P.y) < 1300 * 1300)) updMonster(m, dt); }
  separate();
  monsters = monsters.filter(m => !m.dead);
  updProjs(dt); updOrbs(dt); updDelayed(dt); updPickups(dt); updMisc(dt);
  tickT -= dt;
  if (tickT <= 0) {   // 1초마다: 날짜 · 생산 · 자원 재생성 · 소굴 재생성
    tickT = 1;
    checkDaily(); tickProd();
    if (!mode) {
      tipCheck();
      for (const n of nodes) if (n.hp <= 0 && now >= n.respawnAt && d2(n.x, n.y, P.x, P.y) > 380 * 380) { n.hp = n.maxHp; n.left = Math.floor(n.maxHp / n.nd.per); n.acc = 0; }
      for (const d of dens) {
        if (d.boss || d.members.length || !d.respawnAt) continue;
        const nearCamp = camp && d2(d.x, d.y, camp.x, camp.y) < 900 * 900;
        if (nearCamp ? now >= d.respawnAt - 24 : now >= d.respawnAt && d2(d.x, d.y, P.x, P.y) > 750 * 750) spawnPack(d);
      }
    }
  }
  // 회복: 마을 안에서는 빠르게, 전투가 없을 때는 천천히
  const inV = !mode && inVillage(P.x, P.y);
  let calm = true;
  for (const m of monsters) if (m.state === 'chase' && d2(m.x, m.y, P.x, P.y) < 450 * 450) { calm = false; break; }
  for (const h of heroes) { if (h.down) continue; const k = inV ? 0.25 : calm ? 0.03 : 0; if (k) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * k * dt); }
  if (state === 'play') {
    if (mode) updateMode(dt);
    else {
      if (playTime >= pub.next) { refreshLineup(); if (pub.line.some(isLegend)) toast('주점 카드에 레전더리가 나왔어요'); }
      updatePads(dt); updGates(dt); updChests(); updPortals(); updCamp(dt);
      tickMission();
    }
    if (state === 'play' && heroes.length && heroes.every(h => h.down)) {
      if (mode) modeFail('원정대가 모두 쓰러졌어요');
      else { state = 'wipe'; wipeT = 2; endCamp(); joy.active = false; }
    }
  }
  if (winT > 0) { winT -= dt; if (winT <= 0) showWin(); }
  saveT -= dt;
  if (saveT <= 0 && state === 'play' && !mode) { saveT = 8; saveLocal(); }
  const k = 1 - Math.exp(-dt * 7);
  cam.x += (P.x - cam.x) * k; cam.y += (P.y - cam.y) * k;
  cam.shake = Math.max(0, cam.shake - 40 * dt);
}
function finishWipe() {
  state = 'play';
  heroes = heroes.filter(h => !h.clone);
  placeSquad(START.x, START.y);
  heroes.forEach(h => { h.down = false; h.hp = h.maxHp; });
  for (const m of monsters) if (m.state === 'chase') { m.state = 'return'; m.forced = null; m.target = null; m.slam = null; }
  orbs = []; delayed = [];
  toast('마을 등불 아래에서 다시 일어섰다');
  tip('wipe', true);
}
