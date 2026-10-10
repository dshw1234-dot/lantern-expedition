'use strict';
// 등불 원정대 — 설정, HUD, 창(주점 · 영웅 · 수호상 · 생산소 · 도전 · 선착장 · 결과 …), 목표, 입력, 저장 · 불러오기, 시작

// ================= 설정 (이 기기에만 저장) =================
// guideSeen · tips: 이 기기에서 이미 본 안내. 새 게임을 시작해도 다시 뜨지 않는다
let settings = { dmgText: true, effects: true, powerSave: true, guideSeen: false, tips: {} };
function loadSettings() { try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (s) Object.assign(settings, s); } catch (_) { /* 저장소가 막혀 있어도 기본값으로 돈다 */ } }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* 무시 */ } }
loadSettings();

// ================= HUD =================
const GOLD_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="#ffcf4a"/><circle cx="10" cy="10" r="4.8" fill="none" stroke="#c9901c" stroke-width="1.6"/></svg>';
const MEAT_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 13.6 3.9 16.1" stroke="#f1e6d3" stroke-width="2.4" stroke-linecap="round"/><circle cx="3.4" cy="16.6" r="1.7" fill="#f1e6d3"/><ellipse cx="11.2" cy="8.8" rx="6.2" ry="5.4" transform="rotate(-45 11.2 8.8)" fill="#c8664a"/></svg>';
const RES_NAME = { wood: '나무', stone: '돌', gold: '금화', meat: '고기' };
const resEls = {};
for (const k of ['wood', 'stone', 'gold', 'meat']) { const el = $('r-' + k); resEls[k] = { el, b: el.querySelector('b') }; }
const bumpSet = new Set();
function bumpRes(k) { bumpSet.add(k); }
function toast(msg) {
  const box = $('toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
// 도움말: 처음 겪는 일마다 한 번씩, 화면 아래 안내 칸(#hint)에 띄운다
const TIPS = {
  down: `쓰러진 영웅은 ${REVIVE_T}초 뒤에 다시 일어나요. 마을에서는 곧바로 일어나요`,
  flee: '위험하면 끌어서 물러나세요. 몬스터는 멀리 쫓아오지 않고, 마을에서는 체력이 금방 차요',
  wipe: '모두 쓰러져도 잃는 것은 없어요. 건물과 영웅 레벨을 올린 뒤 다시 가 보세요',
  idle: '주변에 싸울 상대도 캘 것도 없어요. 주황색 화살표를 따라가 보세요',
  elite: '금빛 테두리는 정예 몬스터예요. 훨씬 강하지만 장비를 떨어뜨려요',
  chest: '보물상자 옆에 멈춰 서면 열려요',
  map: '오른쪽 위 지도를 누르면 표석으로 순간이동할 수 있어요',
};
const tipQueue = [];
let tipText = '', tipT = 0, idleN = 0;
function tip(id, urgent) {   // urgent = 곧바로 띄운다. 차례를 기다리던 도움말은 못 본 것으로 되돌려 다음 기회에 다시 뜨게 한다
  if (settings.tips[id] || !TIPS[id]) return;
  if (urgent) { for (const q of tipQueue) delete settings.tips[q]; tipQueue.length = 0; tipT = 0; }
  settings.tips[id] = 1; saveSettings();
  tipQueue.push(id);
}
function tipCheck() {   // 필드에서 1초마다: 조건을 살펴야 알 수 있는 도움말
  if (state !== 'play' || !(movedOnce && stoppedOnce)) return;
  const T = settings.tips, near = (list, r, ok) => list.some(o => ok(o) && d2(o.x, o.y, P.x, P.y) < r * r);
  if (!T.elite && near(monsters, 380, m => m.elite && !m.dead && isRevealed(m.x, m.y))) tip('elite');
  if (!T.chest && daily.chests < CHESTS_PER_DAY && near(chests, 240, c => !c.opened && isRevealed(c.x, c.y))) tip('chest');
  if (!T.flee && near(monsters, 450, m => m.state === 'chase') && heroes.reduce((s, h) => s + (h.down ? 0 : h.hp / h.maxHp), 0) / heroes.length < 0.35) tip('flee');
  if (!T.idle) {
    const nothing = !P.moving && !inVillage(P.x, P.y, 80) && heroes.every(h => h.down || !h.target) && !!(curObj && curObj.target) && !gates.some(g => gateLive(g) && d2(g.x, g.y, P.x, P.y) < 90 * 90);
    idleN = nothing ? idleN + 1 : 0;
    if (idleN >= 3) tip('idle');
  }
}
const boss = () => monsters.find(m => m.d.boss && !m.dead && !m.arena);
let partyN = '';
function rebuildParty() {
  const box = $('party'); box.textContent = '';
  for (const h of heroes) {
    const el = document.createElement('button'); el.type = 'button';
    el.className = 'chip' + (h.clone ? ' clone' : '');
    el.title = `${h.def.name} · ${RARITY[h.def.rarity].name} ${h.def.role}${h.clone ? ' (분신)' : ' · 눌러서 레벨업'}`;
    el.style.setProperty('--rc', RARITY[h.def.rarity].color);
    el.innerHTML = `<span class="face" style="--c:${h.def.color}"></span><span class="nm">${h.def.short}</span><span class="bar hp"><i></i></span><span class="bar sk"><i></i></span>`;
    h.el = el; h.hpEl = el.querySelector('.hp i'); h.skEl = el.querySelector('.sk i');
    h.faceEl = el.querySelector('.face'); h.nmEl = el.querySelector('.nm');
    el.addEventListener('click', () => openPanel('heroes', h.idx));
    box.appendChild(el);
  }
  partyN = heroes.map(h => h.idx + (h.clone ? 'c' : '')).join(',');
}
// 지역 지도를 캔버스에 그린다 (미니맵과 지도 창이 같이 쓴다). 월드의 (wx, wy)부터 ww x wh 범위를 캔버스의 pw x ph에 채운다
//   안개가 걷힌 구역 = 지형 그대로, 다음에 걷을 수 있는 구역 = 안개색 덩이, 그 너머 = 어둠
function drawMapTo(g, wx, wy, ww, wh, pw, ph, big) {
  const kx = pw / ww, ky = ph / wh, R = REG();
  g.fillStyle = '#0b0c13'; g.fillRect(0, 0, pw, ph);
  g.imageSmoothingEnabled = false;
  for (const s of sectors) {
    const x0 = s.c * CELL, y0 = s.r * CELL;
    if (x0 + CELL < wx || y0 + CELL < wy || x0 > wx + ww || y0 > wy + wh) continue;
    if (s.open) g.drawImage(mapCv, s.c * CT, s.r * CT, CT, CT, (x0 - wx) * kx, (y0 - wy) * ky, CELL * kx + 0.5, CELL * ky + 0.5);
    else if (sectors[s.parent].open) { g.fillStyle = `rgba(${R.fog},0.85)`; g.beginPath(); g.ellipse((s.x - wx) * kx, (s.y - wy) * ky, CELL * 0.4 * kx, CELL * 0.4 * ky, 0, 0, TAU); g.fill(); }
  }
  const u = big ? 1 : DPR, dot = (o, r, c) => { g.fillStyle = c; g.beginPath(); g.arc((o.x - wx) * kx, (o.y - wy) * ky, r * u, 0, TAU); g.fill(); };
  dot(VC, big ? 5 : 3.5, '#ffb44d');
  for (const gt of gates) if (gateLive(gt)) dot(gt, big ? 4 : 2.4, '#8ff3ff');
  for (const p of portals) dot(p, big ? 4 : 2.2, '#a98bff');
  if (!big) for (const w of waypoints) if (w.sec && sectors[w.sec].open) dot(w, 2.4, '#5ad1ff');
  if (RD().bs && !RD().bd) dot(BOSS_POS, big ? 6 : 3.5, '#d08bff');
  if (camp) dot(camp, big ? 4 : 2.5, '#ff9a3d');
  const tg = state !== 'title' && curObj && curObj.target;
  if (tg) { g.strokeStyle = '#ffe3b3'; g.lineWidth = 1.4 * u; g.beginPath(); g.arc((tg.x - wx) * kx, (tg.y - wy) * ky, (big ? 7 : 4) * u, 0, TAU); g.stroke(); }
  dot(P, big ? 5 : 3, '#ffffff');
  if (big) { g.strokeStyle = '#1a1a24'; g.lineWidth = 1.5; g.stroke(); }
}
const MINI_SPAN = 2600;   // 미니맵에 보이는 범위 (원정대 둘레)
function drawMini() {
  const s = mini.width;
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, s, s);
  if (mode) {
    mctx.fillStyle = '#1a1726'; mctx.fillRect(0, 0, s, s);
    mctx.fillStyle = '#b8ad98'; mctx.font = `${12 * DPR}px ${FONT}`; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
    mctx.fillText(mode.name, s / 2, s / 2);
    return;
  }
  drawMapTo(mctx, P.x - MINI_SPAN / 2, P.y - MINI_SPAN / 2, MINI_SPAN, MINI_SPAN, s, s, false);
}
function modeHud() {
  if (mode) {
    const left = mode.limit ? fmtTime(mode.limit - mode.t) : fmtTime(mode.t);
    switch (mode.id) {
      case 'pig': return [`황금 돼지 · 남은 시간 ${left} · 남은 체력 ${Math.max(0, Math.ceil(mode.pig.hp))}`, 1 - mode.pig.hp / mode.pig.maxHp];
      case 'dungeon': return [`던전 ${mode.floor}/${DUNGEON_FLOORS.length}층 · 남은 시간 ${left} · 콤보 ${mode.combo} (최대 ${mode.maxCombo})`, mode.t / mode.limit];
      case 'defense': return [`마을 방어 ${mode.wave}/${DEF_WAVES}웨이브 · 수호상 ${Math.max(0, Math.ceil(mode.statue.hp))} · 강화 Lv${mode.runLv}`, mode.runXp / (4 + 3 * mode.runLv)];
      case 'tower': return [`시련의 탑 ${mode.floorN}층 · 남은 시간 ${left} · 남은 적 ${monsters.filter(m => m.arena && !m.dead).length}`, mode.t / mode.limit];
    }
  }
  if (camp) return [`캠프 중 ${fmtTime(camp.t)} · 경험치 2배 · 오늘 남은 캠프 ${fmtTime(CAMP_PER_DAY - daily.campSec)}`, daily.campSec / CAMP_PER_DAY];
  return null;
}
let uiAcc = 0, miniAcc = 0, lastQuest = -1, curObj = null;   // curObj = 지금 목표 (objective()의 결과. 0.12초마다 새로 구한다)
function uiTick(dt) {
  uiAcc += dt; miniAcc += dt;
  if (state === 'play') { if (tipT > 0) tipT -= dt; else if (tipQueue.length) { tipText = TIPS[tipQueue.shift()]; tipT = 7; } }
  if (miniAcc > 0.25) { miniAcc = 0; drawMini(); }
  if (uiAcc < 0.12 || !res) return;
  uiAcc = 0;
  for (const k in resEls) {
    const v = String(Math.floor(res[k])); if (resEls[k].b.textContent !== v) resEls[k].b.textContent = v;
    if (bumpSet.has(k)) { const el = resEls[k].el; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  bumpSet.clear();
  $('sq-lv').textContent = `Lv ${squad.lvl}`;
  $('sq-xp').style.width = `${squad.lvl >= SQUAD_MAX_LV ? 100 : clamp(squad.xp / xpNeed(squad.lvl), 0, 1) * 100}%`;
  const q = curObj = objective();
  if ($('qt').textContent !== q.text) $('qt').textContent = q.text;
  if ($('qp').textContent !== q.prog) $('qp').textContent = q.prog;
  if (lastQuest !== q.key) { if (lastQuest !== -1 && state === 'play') { const el = $('quest'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } lastQuest = q.key; }
  const key = heroes.map(h => h.idx + (h.clone ? 'c' : '')).join(',');
  if (partyN !== key) rebuildParty();
  $('party').classList.toggle('nudge', state === 'play' && !mode && q.nudge === true);
  for (const h of heroes) {
    if (!h.el) continue;
    h.hpEl.style.width = `${(h.hp / h.maxHp) * 100}%`;
    h.skEl.style.width = `${clamp(1 - h.skillCd / (h.def.s1.cd * (1 - stat(h, 'cdr'))), 0, 1) * 100}%`;
    h.el.classList.toggle('down', h.down);
    h.el.classList.toggle('up', !h.clone && canLevel(h.idx));
    const lvText = String(roster[h.idx].lvl);
    if (h.faceEl.textContent !== lvText) h.faceEl.textContent = lvText;
    const nm = h.down ? `${Math.max(1, Math.ceil(reviveNeed() - h.downT))}초` : h.def.short;
    if (h.nmEl.textContent !== nm) h.nmEl.textContent = nm;
  }
  const b = boss();
  const showBoss = state !== 'title' && !mode && b && RD().bs && d2(b.x, b.y, P.x, P.y) < 1000 * 1000;
  $('bosshp').hidden = !showBoss;
  if (showBoss) { $('boss-name').textContent = REG().boss; $('bossbar').style.width = `${(b.hp / b.maxHp) * 100}%`; }
  const mh = modeHud();
  $('modehud').hidden = !mh || state === 'title';
  if (mh) { $('mh-text').textContent = mh[0]; $('mh-bar').style.width = `${clamp(mh[1], 0, 1) * 100}%`; }
  $('fogpct').textContent = mode ? mode.name : `정화 ${openCount()}/${sectors.length - 1}`;
  $('chestcnt').textContent = `상자 ${daily.chests}/${CHESTS_PER_DAY}`;
  const play = state === 'play' || state === 'menu';
  const home = $('btn-home');
  const inV = inVillage(P.x, P.y);
  home.hidden = !play || !!mode || (inV && !returnPos);
  home.textContent = inV ? '돌아가기' : '귀환';
  const campBtn = $('btn-camp'), why = campBlocked();
  campBtn.hidden = !play || !!mode || (!camp && (why === 'x' || squad.lvl < UNLOCK.camp));
  campBtn.textContent = camp ? '캠프 걷기' : '캠프 치기';
  // 안내 칸: 첫 조작(끌기 → 손 떼기)을 마칠 때까지는 조작 안내, 그 뒤에는 도움말
  const hint = $('hint'), firstSteps = state === 'play' && !mode && !(movedOnce && stoppedOnce);
  const hintText = firstSteps ? (movedOnce ? '이제 손을 떼 보세요. 멈추면 영웅들이 알아서 싸우고 채집해요' : '화면 아무 곳이나 누른 채로 끌어 보세요') : state === 'play' && tipT > 0 ? tipText : '';
  hint.hidden = !hintText;
  hint.classList.toggle('tip', !firstSteps && !!hintText);
  if (hintText && hint.textContent !== hintText) hint.textContent = hintText;
  if (sleeping) $('sleep-stat').textContent = `잠든 사이 물리친 몬스터 ${kills - sleepKills}마리 · 금화 +${Math.floor(res.gold - sleepGold)}`;
  // 화면 가장자리 표식이 HUD를 피하도록
  const g = cv.getBoundingClientRect();
  hudTop = Math.max($('left').getBoundingClientRect().bottom, $('mapbox').getBoundingClientRect().bottom) - g.top + 14;
  hudBottom = g.bottom - $('bottom').getBoundingClientRect().top + 14;
}

// ================= 영웅 · 주점 =================
const isLegend = i => HERO_DEFS[i].rarity === 'legend';
function canLevel(i) {
  const r = roster[i];
  if (!r.owned || r.lvl >= heroCap()) return false;
  const c = lvCost(r.lvl);
  return r.shards >= c.shards && res.meat >= c.meat;
}
function levelUpHero(i) {
  if (!canLevel(i)) return;
  const r = roster[i], c = lvCost(r.lvl);
  r.shards -= c.shards; res.meat -= c.meat; r.lvl++;
  bumpRes('meat');
  for (const h of heroes) if (h.idx === i) { refreshHp(h); burst(h.x, h.y - 16, '#ffe08a', 18, 160); }
  toast(r.lvl === SKILL2_LV ? `${HERO_DEFS[i].name} Lv${r.lvl} · 두 번째 스킬 「${HERO_DEFS[i].s2.name}」 해금!` : `${HERO_DEFS[i].name} Lv${r.lvl}`);
  saveLocal();
}
function grantShards(i, n) {
  const r = roster[i];
  r.shards += n;
  if (r.owned) return false;
  r.owned = true;
  const active = roster.filter(o => o.owned && o.active).length;
  r.active = active < squadLimit();
  if (r.active && !mode) rebuildSquad(true);
  toast(`${HERO_DEFS[i].name} 합류! (${HERO_DEFS[i].role})${r.active ? '' : ' · 출전 자리가 없어 대기 중'}`);
  return true;
}
function rollCard(force) {
  let key = force;
  if (!key) {
    let t = Math.random() * RARITY_TOTAL;
    for (const k of RARITY_KEYS) { t -= RARITY[k].weight; if (t < 0) { key = k; break; } }
    key = key || 'normal';
  }
  const pool = [];
  HERO_DEFS.forEach((d, i) => { if (d.rarity === key) pool.push(i); });
  return pick(pool);
}
function refreshLineup() {
  pub.pity++;
  const line = [rollCard(), rollCard(), rollCard()];
  if (pub.pity >= PUB.pity && !line.some(isLegend)) line[randi(0, 2)] = rollCard('legend');   // 천장
  if (line.some(isLegend)) pub.pity = 0;
  pub.line = line; pub.picked = -1; pub.next = playTime + PUB.auto;
}

// ================= 창 (공용) =================
let panel = null, panelArg = null, spinning = false, panelMsg = '';
const sheet = $('sheet'), card = $('sheet-card');
function openPanel(name, arg) {
  const onTitle = state === 'title' && name === 'guide';   // 타이틀에서는 게임 방법만 열 수 있다 (state는 title 그대로)
  if (state !== 'play' && !onTitle) return;
  panel = name; panelArg = arg; panelMsg = '';
  if (onTitle) $('title').hidden = true; else state = 'menu';
  joy.active = false; joy.id = null; joy.dx = joy.dy = 0; keys.clear();
  renderPanel();
  sheet.hidden = false;
  focusPanel();
}
function focusPanel() {   // 키보드로 바로 누를 수 있게: data-focus가 붙은 버튼, 없으면 첫 버튼
  const b = card.querySelector('[data-focus]') || card.querySelector('button:not([disabled])');
  if (b && matchMedia('(hover: hover)').matches) b.focus({ preventScroll: true });
}
function renderPanel() {
  const P_ = PANELS[panel];
  card.innerHTML = P_.render(panelArg);
  card.setAttribute('aria-labelledby', 'sheet-h');
  if (P_.after) P_.after(panelArg);
}
function closePanel(force) {
  if (!panel || spinning) return;
  if (PANELS[panel].noClose && !force) return;
  sheet.hidden = true; panel = null;
  if (state === 'menu') state = 'play'; else if (state === 'title') $('title').hidden = false;
  saveLocal();
}
card.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled || !panel) return;
  const [act, arg] = b.dataset.act.split(':');
  if (act === 'close') { closePanel(); return; }
  PANELS[panel].act(act, arg, b);
});
addEventListener('keydown', e => { if (e.key === 'Escape' && panel) closePanel(); });
const head = (title, right = '') => `<div class="panel-head"><h2 id="sheet-h">${title}</h2>${right}</div>`;
const purse = (svg, n, title) => `<span class="purse" title="${title}">${svg}<b>${Math.floor(n)}</b></span>`;
const costHtml = c => Object.keys(c).filter(k => c[k] > 0).map(k => `<span class="${res[k] >= c[k] ? 'ok' : 'lack'}">${RES_NAME[k]} ${c[k]}</span>`).join('');
const canPay = c => Object.keys(c).every(k => res[k] >= c[k]);
function pay(c) { for (const k in c) { res[k] -= c[k]; bumpRes(k); } }
const pct = v => `${Math.round(v * 10) / 10}%`;

// 게임 방법: 한 장에 그림 하나 + 한 가지 이야기. 그림은 SVG, 움직임은 등불원정대.html의 .g-* 애니메이션
const gScene = (label, inner, ground = '#3f6337') => `<svg class="gfig" viewBox="0 0 300 150" role="img" aria-label="${label}"><defs><radialGradient id="gvig" cx="50%" cy="50%" r="70%"><stop offset="50%" stop-color="#0a0c14" stop-opacity="0"/><stop offset="100%" stop-color="#0a0c14" stop-opacity=".8"/></radialGradient></defs><rect width="300" height="150" fill="${ground}"/>${inner}<rect width="300" height="150" fill="url(#gvig)"/></svg>`;
const gHero = (x, y, c, cls, gear) => `<g transform="translate(${x} ${y})"><ellipse cy="13" rx="12" ry="4" fill="rgba(0,0,0,.3)"/><g class="${cls}"><circle r="13" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><circle cx="2" cy="-2" r="1.9" fill="#1a1a24"/><circle cx="7.5" cy="-2" r="1.9" fill="#1a1a24"/>${gear}</g></g>`;
const gLuke = (x, y, cls = '') => gHero(x, y, '#5b8def', cls, '<rect x="8" y="-1" width="10" height="13" rx="3.5" fill="#c9d2e3"/><rect x="12" y="1.5" width="2" height="8" fill="#5b8def"/>');
const gTeo = (x, y, cls = '') => gHero(x, y, '#6cc070', cls, '<path d="M-11 -7 L1 -23 L11 -7 Z" fill="#3f8a4a"/>');
const gSlime = (x, y, cls = '') => `<g transform="translate(${x} ${y})"><ellipse cy="1" rx="14" ry="4" fill="rgba(0,0,0,.3)"/><g class="${cls}"><path d="M-14 0 Q-14 -20 0 -20 Q14 -20 14 0 Z" fill="#8ad07a" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><circle cx="-5" cy="-8" r="1.9" fill="#1a1a24"/><circle cx="2" cy="-8" r="1.9" fill="#1a1a24"/></g></g>`;
const gTree = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-2.5" y="-5" width="5" height="11" fill="#6b4a2e"/><circle cy="-15" r="13" fill="#2f6b3a"/><circle cx="-4" cy="-19" r="6" fill="#3b7d45"/></g>`;
const gTuft = (x, y) => `<path d="M${x - 4} ${y} l2 -6 l2 6 l2 -7 l2 7" stroke="#78ad58" stroke-width="1.5" fill="none"/>`;
const GUIDE = [
  { title: '끌면 움직여요',
    body: '화면 아무 곳이나 누른 채로 끌면 원정대가 그쪽으로 걸어가요. 한 손가락이면 충분해요.<span class="dim">PC에서는 마우스로 끌거나 WASD · 방향키를 써요.</span>',
    fig() {
      const deco = dx => gTree(40 + dx, 40) + gTree(175 + dx, 138) + gTree(258 + dx, 36) + gTuft(95 + dx, 122) + gTuft(205 + dx, 30) + gTuft(282 + dx, 104) + gTuft(20 + dx, 96) + gTuft(132 + dx, 26);
      return gScene('손가락으로 끌면 원정대가 걸어가는 그림',
        `<g class="g-scroll">${deco(0)}${deco(300)}</g>` + gTeo(88, 86, 'g-bob') + gLuke(122, 70, 'g-bob') +
        '<path d="M150 66 h36 m-10 -8 l10 8 l-10 8" stroke="#ffe3b3" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>' +
        '<circle cx="226" cy="106" r="27" fill="rgba(255,240,220,.1)" stroke="rgba(255,200,130,.55)" stroke-width="2"/>' +
        '<g class="g-knob"><circle cx="226" cy="106" r="12" fill="rgba(255,180,77,.85)"/><circle cx="226" cy="106" r="12" fill="none" stroke="#fff3c4" stroke-width="1.5" class="g-ripple"/></g>');
    } },
  { title: '멈추면 싸워요',
    body: '손을 떼면 영웅들이 알아서 싸우고, 나무와 돌을 캐고, 보물상자를 열어요. 움직이는 동안에는 싸우지 않아요.',
    fig: () => gScene('멈춰 선 영웅들이 슬라임과 싸우는 그림',
      gTree(34, 50) + gTuft(252, 130) + gTuft(60, 132) + gTuft(270, 40) + gTeo(80, 98) + gLuke(134, 80) + gSlime(180, 90, 'g-hit') + gSlime(216, 116) +
      '<path d="M157 60 q16 17 0 36" stroke="#fff6e0" stroke-width="3.5" fill="none" stroke-linecap="round" class="g-blink"/>' +
      '<g class="g-shot"><path d="M98 98 l17 2 m-6 -5 l6 5 l-7 3" stroke="#ffe9b0" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<text x="180" y="58" text-anchor="middle" font-size="14" fill="#fff4dc" class="g-float">12</text>' +
      '<text x="216" y="86" text-anchor="middle" font-size="14" fill="#fff4dc" class="g-float" style="animation-delay:.5s">16</text>') },
  { title: '발판에 멈추면 지어져요',
    body: '모은 자원을 들고 마을의 둥근 발판 위에 멈춰 서면 건물이 올라가요. 건물을 올리고 주점에서 영웅을 모으면 더 먼 곳까지 갈 수 있어요.',
    fig: () => gScene('발판 위에 멈춰 서면 자원이 들어가 건물이 지어지는 그림',
      '<g transform="translate(150 62)"><g class="g-build"><rect x="-27" y="-22" width="54" height="30" rx="3" fill="#8a7a66"/><path d="M-33 -22 L0 -45 L33 -22 Z" fill="#b5533c"/><rect x="-8" y="-9" width="16" height="17" rx="2" fill="#2a1904"/><circle cy="0" r="4" fill="#ffb44d"/></g></g>' +
      '<ellipse cx="150" cy="106" rx="52" ry="20" fill="rgba(255,227,179,.1)" stroke="#ffe3b3" stroke-width="2" stroke-dasharray="7 6"/>' +
      gTeo(130, 98) + gLuke(168, 102) +
      '<g class="g-token"><rect x="141" y="84" width="13" height="7" rx="3.5" fill="#b07a46"/></g>' +
      '<g class="g-token" style="animation-delay:.55s"><path d="M151 92 l2 -6 l5 -2 l5 2 l1 6 l-6 3 Z" fill="#b4bac8"/></g>' +
      '<text x="150" y="142" text-anchor="middle" font-size="12" fill="#ffe3b3">대장간 · 공격력 +20%</text>', '#6a5c48') },
  { title: '위험하면 물러나요',
    body: `쓰러진 영웅은 ${REVIVE_T}초 뒤에 다시 일어나요. 힘들면 끌어서 마을로 돌아오세요. 몬스터는 마을에 들어오지 못하고, 체력도 금방 차요. 모두 쓰러져도 잃는 것 없이 마을에서 다시 시작해요.`,
    fig: () => gScene('마을 안에서 회복하는 영웅들과 울타리 앞에서 멈춘 몬스터 그림',
      '<circle cx="36" cy="80" r="124" fill="#6a5c48"/><circle cx="36" cy="80" r="124" fill="none" stroke="#a07c50" stroke-width="3.5" stroke-dasharray="3 9" stroke-linecap="round"/>' +
      '<circle cx="50" cy="46" r="24" fill="rgba(255,180,77,.25)" class="g-pulse"/><rect x="48" y="52" width="4" height="36" fill="#5a4a3a"/><rect x="43.5" y="39" width="13" height="15" rx="3" fill="#ffcf6b"/>' +
      gLuke(100, 98) + gTeo(126, 66) +
      '<text x="100" y="76" text-anchor="middle" font-size="17" fill="#9ff0c0" class="g-float">+</text>' +
      '<text x="126" y="40" text-anchor="middle" font-size="17" fill="#9ff0c0" class="g-float" style="animation-delay:.6s">+</text>' +
      gSlime(196, 92) + gSlime(236, 120) +
      '<path d="M200 60 q20 -14 40 0 m-9 -7 l9 7 l-10 4" stroke="#d6cab3" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>', '#2f4a36') },
  { title: '안개를 걷으며 나아가요',
    body: `길은 보랏빛 안개로 막혀 있어요. 마법진 팻말에 적힌 일을 해내고 그 위에 멈춰 서면 안개가 걷혀요. 왼쪽 위 「목표」와 주황색 화살표가 다음 할 일을 알려 줘요. 길 끝의 ${REGIONS[0].boss}를 물리치면 바다 건너 새 지역이 열려요.`,
    fig: () => gScene('안개에 막힌 길과 그 앞의 정화 마법진 그림',
      '<path d="M122 108 Q158 118 190 108" stroke="#ffb44d" stroke-width="2.5" fill="none" stroke-dasharray="3 7" stroke-linecap="round" class="g-dash"/>' +
      '<g transform="translate(256 50)"><circle r="22" fill="#4b3a8f" stroke="rgba(0,0,0,.4)" stroke-width="1.5"/><path d="M-15 -17 l4 -13 l5 9 l6 -11 l6 11 l5 -9 l4 13 Z" fill="#ffcf4a"/><circle cx="-7" cy="-2" r="3" fill="#ff5ad1"/><circle cx="7" cy="-2" r="3" fill="#ff5ad1"/></g>' +
      '<g class="g-drift" fill="rgba(110,62,160,.84)"><circle cx="262" cy="38" r="36"/><circle cx="288" cy="92" r="38"/><circle cx="246" cy="122" r="30"/><circle cx="238" cy="76" r="26"/><circle cx="292" cy="142" r="26"/></g>' +
      '<ellipse cx="192" cy="110" rx="23" ry="9.5" fill="rgba(110,225,255,.25)" stroke="#8ff3ff" stroke-width="2"/><ellipse cx="192" cy="110" rx="14" ry="5.5" fill="none" stroke="#8ff3ff" stroke-width="1.5" stroke-dasharray="4 4" class="g-dash"/>' +
      '<rect x="151" y="70" width="82" height="21" rx="6" fill="rgba(16,18,28,.9)" stroke="rgba(255,196,120,.5)"/><text x="192" y="84.5" text-anchor="middle" font-size="10.5" fill="#ffe3b3">나무 10 바치기</text>' +
      gTeo(84, 116) + gLuke(112, 102) +
      '<rect x="10" y="10" width="138" height="48" rx="9" fill="rgba(16,18,28,.88)" stroke="rgba(255,196,120,.35)"/><text x="20" y="25" font-size="9" fill="#ffb44d">목표</text><text x="20" y="39" font-size="11" fill="#f4ead6">안개 걷기 · 나무 10 바치기</text><text x="20" y="51" font-size="9.5" fill="#b8ad98">나무 3/10</text>') },
];

const PANELS = {
  // ---------------- 주점 ----------------
  tavern: {
    render() {
      const used = pub.picked >= 0, left = Math.max(1, PUB.pity - pub.pity), t = Math.max(0, Math.ceil(pub.next - playTime));
      const cards = pub.line.map((i, k) => {
        const d = HERO_DEFS[i], R = RARITY[d.rarity], r = roster[i];
        return `<div class="hcard${pub.picked === k ? ' picked' : used ? ' faded' : ''}" data-r="${d.rarity}" style="--rc:${R.color}"><span class="face" style="--c:${d.color}"></span><b>${d.name}</b><span class="rar">${R.name}</span><span class="dim">조각 +${R.shards}</span>${r.owned ? `<span class="tag">Lv ${r.lvl}</span>` : '<span class="tag hot">새 영웅</span>'}</div>`;
      }).join('');
      const pity = pub.line.some(isLegend) ? '이번 카드에 레전더리가 있어요.' : `카드를 ${left}번 더 바꾸면 레전더리가 반드시 나와요.`;
      return head('주점', purse(GOLD_SVG, res.gold, '금화')) +
        '<p class="panel-sub">금화를 내면 카드 3장 중 한 장이 무작위로 뽑혀요. 뽑힌 영웅의 조각을 받고, 처음 나온 영웅은 원정대에 합류해요.</p>' +
        `<div class="cards">${cards}</div><p class="result" aria-live="polite">${panelMsg}</p>` +
        `<div class="btns"><button class="btn primary" type="button" data-act="rec:1"${spinning || used || res.gold < PUB.cost ? ' disabled' : ''}>모집 ×1 · 금화 ${PUB.cost}</button>` +
        `<button class="btn primary" type="button" data-act="rec:3"${spinning || used || res.gold < PUB.cost * 3 ? ' disabled' : ''}>모집 ×3 · 금화 ${PUB.cost * 3}</button></div>` +
        `<div class="btns"><button class="btn ghost" type="button" data-act="refresh"${spinning || res.gold < PUB.refresh ? ' disabled' : ''}>카드 바꾸기 · 금화 ${PUB.refresh}</button>` +
        `<button class="btn ghost" type="button" data-act="close"${spinning ? ' disabled' : ''}>닫기</button></div>` +
        `<p class="small">${used ? '이번 카드는 이미 뽑았어요. ' : ''}${pity} 카드는 ${Math.floor(t / 60)}분 ${t % 60}초 뒤 저절로 바뀌어요.</p>`;
    },
    act(a, arg) {
      if (a === 'refresh') {
        if (spinning || res.gold < PUB.refresh) return;
        res.gold -= PUB.refresh; bumpRes('gold');
        refreshLineup();
        panelMsg = pub.line.some(isLegend) ? '레전더리 카드가 나왔어요!' : '';
        renderPanel();
      } else if (a === 'rec') recruit(+arg);
    },
  },
  // ---------------- 영웅 ----------------
  heroes: {
    render(focus) {
      const act = roster.filter(r => r.owned && r.active).length, cap = heroCap();
      const rows = HERO_DEFS.map((d, i) => {
        const r = roster[i], R = RARITY[d.rarity], c = lvCost(r.lvl), max = r.lvl >= MAX_HERO_LV;
        let cost;
        if (!r.owned) cost = '<span class="dim">주점에서 뽑으면 합류해요</span>';
        else if (max) cost = '<span class="dim">최고 레벨이에요</span>';
        else if (r.lvl >= cap) cost = `<span class="dim">용병단 Lv${r.lvl + 1}이 되면 더 올릴 수 있어요</span>`;
        else cost = `<span class="sbar"><i style="width:${Math.min(100, r.shards / c.shards * 100)}%"></i></span><span class="${r.shards >= c.shards ? 'ok' : 'lack'}">조각 ${r.shards}/${c.shards}</span><span class="${res.meat >= c.meat ? 'ok' : 'lack'}">고기 ${c.meat}</span>`;
        const s2 = r.lvl >= SKILL2_LV ? `${d.s2.name}: ${d.s2.desc}` : `<span style="opacity:.6">${d.s2.name} (Lv${SKILL2_LV}): ${d.s2.desc}</span>`;
        const toggle = r.owned ? `<button class="btn xs ${r.active ? 'primary' : 'ghost'}" type="button" data-act="act:${i}"${mode || (!r.active && act >= squadLimit()) || (r.active && act <= 1) ? ' disabled' : ''}>${r.active ? '출전 중' : '대기'}</button>` : '';
        return `<div class="row${r.owned ? '' : ' off'}${focus === i ? ' focus' : ''}" data-row="${i}" style="--rc:${R.color}"><span class="face" style="--c:${d.color}"></span>` +
          `<div class="rmain"><div class="rline"><b>${d.name}</b><span class="rar">${R.name}</span><span class="dim">${d.role}</span></div>` +
          `<div class="dim">공격력 ${Math.round(atkOf(i))} · 체력 ${hpOf(i)}<br>${d.s1.name}: ${d.s1.desc}<br>${s2}</div><div class="cost">${cost}</div></div>` +
          `<div class="rside"><span class="big">Lv ${r.lvl}</span>${r.owned && !max ? `<button class="btn sm primary" type="button" data-act="lv:${i}"${canLevel(i) ? '' : ' disabled'}>레벨업</button>` : ''}${toggle}</div></div>`;
      }).join('');
      return head('영웅', purse(MEAT_SVG, res.meat, '고기')) +
        `<p class="panel-sub">레벨마다 공격력·체력 +10%, Lv${SKILL2_LV}에 두 번째 스킬. 영웅 레벨은 용병단 레벨(지금 ${cap})까지 올릴 수 있어요. 출전 ${act}/${squadLimit()}명 (훈련장 2레벨마다 +1).</p>` +
        `<div class="scroll">${rows}</div><div class="btns"><button class="btn ghost" type="button" data-act="close">닫기</button></div>`;
    },
    after(focus) { const el = card.querySelector(`[data-row="${focus}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); },
    act(a, arg) {
      const i = +arg;
      if (a === 'lv') levelUpHero(i);
      else if (a === 'act') {
        const r = roster[i], act = roster.filter(o => o.owned && o.active).length;
        if (r.active && act > 1) r.active = false;
        else if (!r.active && act < squadLimit()) r.active = true;
        rebuildSquad(true);
      }
      const sc = card.querySelector('.scroll'), top = sc ? sc.scrollTop : 0;
      panelArg = i; renderPanel();
      const sc2 = card.querySelector('.scroll'); if (sc2) sc2.scrollTop = top;
    },
  },
  // ---------------- 수호상 (장비) ----------------
  statue: {
    render() {
      const g = gearStat;
      const slots = SLOTS.map(s => {
        const it = gear.eq[s.id];
        if (!it) return `<div class="slot"><b>${s.name}</b><span>비어 있음</span></div>`;
        return `<button class="slot" type="button" data-act="uneq:${s.id}" style="--gc:${GRADES[it.grade].col}" title="눌러서 빼기"><b>${s.name}</b><span>${it.main.stat === 'atk' ? '공격' : '체력'} +${it.main.val}%</span><span>Lv${it.tier} ${GRADES[it.grade].name}</span></button>`;
      }).join('');
      const totals = `공격력 +${pct((g.atkMain || 0) + (g.atkPct || 0))} · 체력 +${pct((g.hpMain || 0) + (g.hpPct || 0))} · 치명타 ${pct(5 + (g.crit || 0))} · 치명 피해 ${pct(150 + (g.critDmg || 0))} · 공격 속도 +${pct(g.aspd || 0)} · 회피 ${pct(g.dodge || 0)} · 피해 감소 ${pct(g.dr || 0)} · 흡혈 ${pct(g.ls || 0)} · 쿨타임 -${pct(g.cdr || 0)}`;
      const order = Object.fromEntries(SLOTS.map((s, i) => [s.id, i]));
      const bag = gear.bag.slice().sort((a, b) => order[a.slot] - order[b.slot] || itemScore(b) - itemScore(a));
      const rows = bag.map(it => {
        const eq = gear.eq[it.slot], better = !eq || itemScore(it) > itemScore(eq);
        const opts = it.opts.map(o => `${OPTS[o.stat].name} +${o.val}%`).join(' · ');
        return `<div class="row" style="--gc:${GRADES[it.grade].col}"><span class="gem">${SLOT[it.slot].name[0]}</span>` +
          `<div class="rmain"><div class="rline"><b style="color:${GRADES[it.grade].col}">${itemName(it)}</b><span class="dim">Lv${it.tier}</span>${better ? '<span class="tag hot">더 좋아요</span>' : ''}${it.lock ? '<span class="tag">잠김</span>' : ''}</div>` +
          `<div class="dim">${it.main.stat === 'atk' ? '공격력' : '체력'} +${it.main.val}%${opts ? ' · ' + opts : ''}</div></div>` +
          `<div class="rside"><button class="btn xs primary" type="button" data-act="eq:${it.id}">장착</button><div class="btns" style="gap:4px"><button class="btn xs ghost" type="button" data-act="lock:${it.id}">${it.lock ? '풀기' : '잠금'}</button><button class="btn xs ghost" type="button" data-act="dis:${it.id}"${it.lock ? ' disabled' : ''}>분해</button></div></div></div>`;
      }).join('') || '<p class="dim">가방이 비어 있어요. 정예 몬스터, 보물상자, 던전, 보스에게서 장비를 얻어요.</p>';
      return head('수호상', `<span class="purse">가방 ${gear.bag.length}/${BAG_MAX}</span>`) +
        '<p class="panel-sub">장비 한 벌이 출전한 원정대 전체에 적용돼요. 반지는 마을 방어 보상으로만 나와요.</p>' +
        `<div class="slots">${slots}</div><div class="totals">${totals}</div>` +
        `<div class="btns"><button class="btn sm primary" type="button" data-act="auto">자동 장착</button><button class="btn sm ghost" type="button" data-act="dislow">일반·희귀 모두 분해</button></div>` +
        `<p class="result">${panelMsg}</p><div class="scroll">${rows}</div><div class="btns"><button class="btn ghost" type="button" data-act="close">닫기</button></div>`;
    },
    act(a, arg) {
      const id = +arg;
      if (a === 'eq') { equip(id, true); panelMsg = '장착했어요'; }
      else if (a === 'uneq') { unequip(arg); panelMsg = '가방으로 뺐어요'; }
      else if (a === 'dis') { const v = dismantle(id); panelMsg = `분해: 돌 +${v} · 나무 +${Math.floor(v / 2)}`; }
      else if (a === 'lock') { const it = gear.bag.find(i => i.id === id); if (it) it.lock = !it.lock; panelMsg = ''; }
      else if (a === 'auto') { const n = autoEquip(); panelMsg = n ? `${n}부위를 더 좋은 장비로 바꿨어요` : '지금이 가장 좋은 조합이에요'; }
      else if (a === 'dislow') { const [n, v] = dismantleLow(); panelMsg = n ? `${n}개 분해: 돌 +${v} · 나무 +${Math.floor(v / 2)}` : '분해할 일반·희귀 장비가 없어요'; }
      const sc = card.querySelector('.scroll'), top = sc ? sc.scrollTop : 0;
      renderPanel();
      const sc2 = card.querySelector('.scroll'); if (sc2) sc2.scrollTop = top;
      saveLocal();
    },
  },
  // ---------------- 생산소 ----------------
  prod: {
    render() {
      tickProd();
      const rows = PROD.map(p => {
        const s = prod[p.id], c = prodCost(p, s.lvl + 1), max = s.lvl >= PROD_MAX, cap = prodCap(p.id);
        return `<div class="row"><span class="face" style="--c:${p.id === 'wood' ? '#9a6a3c' : p.id === 'stone' ? '#9aa0ae' : '#ffcf4a'}"></span><div class="rmain"><div class="rline"><b>${p.name}</b><span class="dim">Lv${s.lvl} · 1분에 ${Math.round(prodRate(p.id) * 100) / 100}개</span></div>` +
          `<div class="cost"><span class="sbar"><i style="width:${Math.min(100, s.stored / cap * 100)}%"></i></span><span>${Math.floor(s.stored)}/${cap}</span></div>` +
          `<div class="cost">${max ? '<span class="dim">최고 레벨</span>' : '강화: ' + costHtml(c)}</div></div>` +
          `<div class="rside">${max ? '' : `<button class="btn sm primary" type="button" data-act="up:${p.id}"${canPay(c) ? '' : ' disabled'}>강화</button>`}</div></div>`;
      }).join('');
      const sc = storeCost(prod.store + 1), smax = prod.store >= STORE_MAX;
      const total = PROD.reduce((a, p) => a + Math.floor(prod[p.id].stored), 0);
      return head('생산소') +
        '<p class="panel-sub">게임을 꺼 둔 동안에도 실제 시간으로 쌓여요. 창고가 클수록 오래 쌓아 둘 수 있어요.</p>' +
        `<div class="scroll">${rows}<div class="row"><span class="face" style="--c:#7d6246"></span><div class="rmain"><div class="rline"><b>창고</b><span class="dim">Lv${prod.store} · ${2 + prod.store}시간치 보관</span></div><div class="cost">${smax ? '<span class="dim">최고 레벨</span>' : '강화: ' + costHtml(sc)}</div></div>` +
        `<div class="rside">${smax ? '' : `<button class="btn sm primary" type="button" data-act="store"${canPay(sc) ? '' : ' disabled'}>강화</button>`}</div></div></div>` +
        `<p class="result">${panelMsg}</p><div class="btns"><button class="btn primary" type="button" data-act="collect"${total ? '' : ' disabled'}>모두 수확 (${total})</button><button class="btn ghost" type="button" data-act="close">닫기</button></div>`;
    },
    act(a, arg) {
      if (a === 'collect') { const got = collectProd(); panelMsg = Object.keys(got).map(k => `${RES_NAME[k]} +${got[k]}`).join(' · '); }
      else if (a === 'up') { const p = PROD_BY[arg], c = prodCost(p, prod[arg].lvl + 1); if (canPay(c) && prod[arg].lvl < PROD_MAX) { tickProd(); pay(c); prod[arg].lvl++; panelMsg = `${p.name} Lv${prod[arg].lvl}`; } }
      else if (a === 'store') { const c = storeCost(prod.store + 1); if (canPay(c) && prod.store < STORE_MAX) { tickProd(); pay(c); prod.store++; panelMsg = `창고 Lv${prod.store}`; } }
      renderPanel(); saveLocal();
    },
  },
  // ---------------- 도전의 문 ----------------
  gate: {
    render() {
      const row = (id, title, desc, status, btn) => {
        const locked = squad.lvl < UNLOCK[id];
        return `<div class="row${locked ? ' off' : ''}"><span class="face" style="--c:${{ pig: '#ffcf4a', defense: '#7fe0a4', tower: '#a98bff' }[id]}"></span>` +
          `<div class="rmain"><div class="rline"><b>${title}</b>${locked ? `<span class="tag">용병단 Lv${UNLOCK[id]}부터</span>` : ''}</div><div class="dim">${desc}<br>${status}</div></div>` +
          `<div class="rside">${btn(locked)}</div></div>`;
      };
      const st = PIG_STAGES[Math.min(prog.pigStage, PIG_STAGES.length - 1)];
      const pigRow = row('pig', '황금 돼지', '어떤 공격이든 피해 1. 60초 안에 쓰러뜨리면 금화. 타격 횟수가 많은 영웅이 유리해요.', `${prog.pigStage + 1}단계 · 체력 ${st.hp} · 보상 금화 ${st.gold}`,
        l => `<button class="btn sm primary" type="button" data-act="go:pig"${l || daily.pig ? ' disabled' : ''}>${daily.pig ? '오늘 완료' : '도전'}</button>`);
      const defLeft = DAILY.defense - daily.defense;
      const defRow = row('defense', '마을 방어', `수호상을 ${DEF_WAVES}웨이브 동안 지켜요. 레벨이 오를 때마다 강화 3개 중 1개를 골라요. 보상: 반지`, `오늘 ${defLeft}/${DAILY.defense}번 남음`,
        l => `<button class="btn sm primary" type="button" data-act="go:defense"${l || defLeft <= 0 ? ' disabled' : ''}>도전</button>`);
      const towerRow = row('tower', '시련의 탑', `층마다 강해지는 적을 ${TOWER_TIME}초 안에 전멸시켜요. 처음 깬 층마다 금화와 조각, 5층마다 장비.`, `최고 기록 ${prog.towerBest}층`,
        l => `<button class="btn sm primary" type="button" data-act="go:tower"${l ? ' disabled' : ''}>${prog.towerBest + 1}층</button>`);
      return head('도전의 문', `<span class="purse">용병단 Lv${squad.lvl}</span>`) +
        `<div class="scroll">${pigRow}${defRow}${towerRow}</div>` +
        `<p class="panel-sub">던전은 필드 곳곳의 보랏빛 입구에서 들어가요 (용병단 Lv${UNLOCK.dungeon}부터 · 오늘 ${DAILY.dungeon - daily.dungeon}/${DAILY.dungeon}번 남음).</p>` +
        '<div class="btns"><button class="btn ghost" type="button" data-act="close">닫기</button></div>';
    },
    act(a, id) {
      if (a !== 'go' || squad.lvl < UNLOCK[id]) return;
      if (id === 'pig' && daily.pig) return;
      if (id === 'defense') { if (daily.defense >= DAILY.defense) return; daily.defense++; }
      const back = { x: P.x, y: P.y };
      closePanel(true);
      enterMode(id, { back });
    },
  },
  // ---------------- 던전 입구 ----------------
  dungeon: {
    render(p) {
      const left = DAILY.dungeon - daily.dungeon;
      return head(`${ZONE_NAMES[p.zone]} 던전`) +
        `<p class="panel-sub">${DUNGEON_FLOORS.length}층 · ${DUNGEON_TIME}초. 층마다 몬스터가 몰려오고 마지막 층에 우두머리가 있어요. 콤보가 길수록 보상이 커지고, 깨면 장비 2개를 받아요.</p>` +
        `<p class="result">오늘 남은 입장 ${left}/${DAILY.dungeon}</p>` +
        `<div class="btns"><button class="btn primary" type="button" data-act="enter"${left <= 0 ? ' disabled' : ''}>입장</button><button class="btn ghost" type="button" data-act="close">닫기</button></div>`;
    },
    act(a) {
      if (a !== 'enter' || daily.dungeon >= DAILY.dungeon) return;
      const p = panelArg;
      daily.dungeon++;
      closePanel(true);
      enterMode('dungeon', Object.assign(p, { back: { x: p.x, y: p.y + 80 } }));
    },
  },
  // ---------------- 선착장 ----------------
  sail: {
    render() {
      const rows = REGIONS.map((R, r) => `<div class="row"><span class="face" style="--c:${R.bossCol}"></span><div class="rmain"><div class="rline"><b>${R.name}</b>${r === regionIdx ? '<span class="tag hot">지금 여기</span>' : ''}${regionData[r].bd ? '<span class="tag">보스 처치</span>' : ''}</div>` +
        `<div class="dim">몬스터 ×${R.mul} · 드랍 ×${R.loot}${R.immune ? ` · 몬스터가 ${STATUS[R.immune].name}에 걸리지 않아요` : ''}<br>보스: ${R.boss}</div></div>` +
        `<div class="rside"><button class="btn sm primary" type="button" data-act="sail:${r}"${r === regionIdx ? ' disabled' : ''}>항해</button></div></div>`).join('');
      return head('선착장') + '<p class="panel-sub">배를 타고 다른 지역으로 가요. 마을은 어디서나 같고, 지역마다 안개와 보스 기록이 따로 남아요.</p>' +
        `<div class="scroll">${rows}</div><div class="btns"><button class="btn ghost" type="button" data-act="close">닫기</button></div>`;
    },
    act(a, arg) { if (a !== 'sail') return; closePanel(true); sailTo(+arg); saveLocal(); },
  },
  // ---------------- 도전 결과 ----------------
  result: {
    noClose: true,
    render() {
      const r = mode.rewards, list = [];
      if (r.gold) list.push(`금화 +${r.gold}`);
      if (r.meat) list.push(`고기 +${r.meat}`);
      for (const it of r.items) list.push(`${itemName(it)} Lv${it.tier}`);
      if (r.shards) list.push(`${HERO_DEFS[r.shards.i].name} 조각 +${r.shards.n}`);
      const next = mode.win && mode.id === 'tower';
      return head(mode.win ? '성공!' : '실패', `<span class="purse">${mode.name}</span>`) +
        `<p class="panel-sub">${mode.win ? r.note || '잘 해냈어요.' : mode.reason}</p>` +
        (mode.win && list.length ? `<div class="totals">보상: ${list.join(' · ')}</div>` : '') +
        (!mode.win && mode.id === 'pig' ? '<p class="dim">황금 돼지는 실패해도 다시 도전할 수 있어요.</p>' : '') +
        `<div class="btns">${next ? `<button class="btn primary" type="button" data-act="next">${mode.floorN + 1}층 도전</button>` : ''}<button class="btn ${next ? 'ghost' : 'primary'}" type="button" data-act="back">돌아가기</button></div>`;
    },
    act(a) { closePanel(true); leaveMode(a === 'next' ? 'tower' : null); },
  },
  // ---------------- 마을 방어: 강화 선택 ----------------
  choice: {
    noClose: true,
    render(opts) {
      const cards = opts.map(b => `<button class="hcard" type="button" data-act="pick:${b.id}" style="--rc:#ffb44d"><b>${b.name}</b><span class="dim">${b.desc}</span></button>`).join('');
      return head('강화 선택', `<span class="purse">Lv ${mode.runLv}</span>`) + '<p class="panel-sub">하나를 고르면 이번 방어전이 끝날 때까지 유지돼요.</p>' + `<div class="cards">${cards}</div>`;
    },
    act(a, id) { if (a !== 'pick') return; applyDefBuff(id); mode.choices--; closePanel(true); },
  },
  // ---------------- 오프라인 보상 ----------------
  report: {
    noClose: true,
    render(r) {
      const h = Math.floor(r.mins / 60), m = Math.floor(r.mins % 60);
      return head('원정 보고') +
        `<p class="panel-sub">자리를 비운 ${h ? h + '시간 ' : ''}${m}분 동안 원정대가 보물상자 ${r.n}개를 모았어요${r.capped ? ` (최대 ${OFFLINE_MAX_H}시간)` : ''}. 생산소에도 자원이 쌓였어요.</p>` +
        `<div class="totals">금화 +${r.gold} · 나무 +${r.wood} · 돌 +${r.stone} · 고기 +${r.meat}</div>` +
        '<div class="btns"><button class="btn primary" type="button" data-act="take">받기</button></div>';
    },
    act(a) {
      const r = panelArg;
      for (const k of ['gold', 'wood', 'stone', 'meat']) { res[k] += r[k]; life[k] += r[k]; bumpRes(k); }
      closePanel(true);
    },
  },
  // ---------------- 설정 ----------------
  settings: {
    render() {
      const sw = (k, title, desc) => `<div class="row"><span></span><div class="rmain"><b style="font:15px/1.3 var(--font-display)">${title}</b><span class="dim">${desc}</span></div><button class="switch" type="button" role="switch" aria-checked="${settings[k]}" aria-label="${title}" data-act="tog:${k}"></button></div>`;
      return head('설정') +
        `<div class="scroll">${sw('dmgText', '데미지 숫자', '맞을 때 뜨는 숫자를 보여 줘요')}${sw('effects', '효과', '파편 · 화면 흔들림을 보여 줘요. 끄면 가벼워져요')}${sw('powerSave', '절전 모드', '3분 동안 손대지 않으면 화면을 어둡게 하고 덜 그려요')}` +
        '<div class="row"><span></span><div class="rmain"><b style="font:15px/1.3 var(--font-display)">게임 방법</b><span class="dim">조작법과 목표를 다시 보고, 도움말도 처음부터 다시 받아요</span></div><button class="btn xs ghost" type="button" data-act="guide">보기</button></div></div>' +
        '<p class="small">설정은 이 기기에만 저장돼요.</p><div class="btns"><button class="btn ghost" type="button" data-act="close">닫기</button></div>';
    },
    act(a, k) {
      if (a === 'guide') { settings.tips = {}; saveSettings(); closePanel(true); openPanel('guide', 0); return; }
      if (a !== 'tog') return;
      settings[k] = !settings[k]; saveSettings(); renderPanel();
    },
  },
  // ---------------- 지도 (순간이동) ----------------
  map: {
    render() {
      const pins = waypoints.filter(w => sectors[w.sec].open).map(w => `<button class="pin${w.sec ? '' : ' home'}" type="button" data-act="tp:${w.i}" style="left:${(w.x / WORLD_W * 100).toFixed(2)}%;top:${(w.y / WORLD_H * 100).toFixed(2)}%" aria-label="${w.name}(으)로 순간이동" title="${w.name}"></button>`).join('');
      return head('지도', `<span class="purse">정화 ${openCount()}/${sectors.length - 1}</span>`) +
        `<p class="panel-sub">${panelMsg || `${REG().name} · 표석을 누르면 그곳으로 순간이동해요. 안개를 걷다 보면 표석이 더 나와요.`}</p>` +
        `<div class="mapbox"><canvas id="mapcv" width="${TW * 3}" height="${TH * 3}"></canvas>${pins}</div>` +
        '<div class="btns"><button class="btn ghost" type="button" data-act="close">닫기</button></div>';
    },
    after() { const c = $('mapcv'); drawMapTo(c.getContext('2d'), 0, 0, WORLD_W, WORLD_H, c.width, c.height, true); },
    act(a, i) {
      const w = waypoints[+i];
      if (a !== 'tp' || !w || !sectors[w.sec].open) return;
      if (monsters.some(m => m.state === 'chase' && d2(m.x, m.y, P.x, P.y) < 350 * 350)) { panelMsg = '싸우는 중에는 순간이동할 수 없어요.'; renderPanel(); return; }
      closePanel(true); endCamp(); returnPos = null;
      placeSquad(w.x, w.y + 46);
      burst(P.x, P.y - 10, '#8fdcff', 26, 220);
      toast(`${w.name}에 도착했어요`);
    },
  },
  // ---------------- 게임 방법 (panelArg = 쪽 번호) ----------------
  guide: {
    render(i) {
      const g = GUIDE[i], last = i === GUIDE.length - 1;
      return head('게임 방법', last ? '' : '<button class="btn xs ghost" type="button" data-act="close">건너뛰기</button>') +
        `<div class="scroll gpage">${g.fig()}<h3 class="g-title">${g.title}</h3><p class="g-body">${g.body}</p></div>` +
        `<div class="dots" role="img" aria-label="${GUIDE.length}쪽 가운데 ${i + 1}쪽">${GUIDE.map((_, k) => `<i${k === i ? ' class="on"' : ''}></i>`).join('')}</div>` +
        `<div class="btns"><button class="btn ghost" type="button" data-act="go:${i - 1}"${i ? '' : ' disabled'}>이전</button>` +
        (last ? `<button class="btn primary" type="button" data-act="close" data-focus>${state === 'title' ? '닫기' : '시작하기'}</button>` : `<button class="btn primary" type="button" data-act="go:${i + 1}" data-focus>다음</button>`) + '</div>';
    },
    act(a, k) { if (a !== 'go') return; panelArg = clamp(+k, 0, GUIDE.length - 1); renderPanel(); focusPanel(); },
  },
};
// 주점 모집: 슬롯머신처럼 카드 위를 돌다가 멈춘다
function recruit(mult) {
  const cost = PUB.cost * mult;
  if (spinning || pub.picked >= 0 || res.gold < cost) return;
  res.gold -= cost; bumpRes('gold');
  spinning = true; panelMsg = '';
  renderPanel();
  const slot = randi(0, 2), total = reduceMotion ? slot : 9 + slot;   // total % 3 === slot 에서 멈춘다
  const cards = card.querySelectorAll('.hcard');
  let step = 0;
  const tick = () => {
    cards.forEach((c, k) => c.classList.toggle('spin', k === step % 3));
    if (step >= total) { setTimeout(() => finishRecruit(slot, mult), 250); return; }
    step++;
    setTimeout(tick, 55 + step * step * 1.6);   // 점점 느려진다
  };
  tick();
}
function finishRecruit(slot, mult) {
  const i = pub.line[slot], d = HERO_DEFS[i], n = RARITY[d.rarity].shards * mult;
  const isNew = grantShards(i, n);
  pub.picked = slot; pub.pulls++;
  spinning = false;
  panelMsg = isNew ? `${d.name} 합류! 조각 +${n}` : `${d.name} 조각 +${n}`;
  if (panel === 'tavern') renderPanel();
  saveLocal();
}

// ================= 목표 =================
// 지금 할 일 한 가지를 고른다: 본줄기에서 아직 걷히지 않은 첫 안개 → 보스 → 배 → 다음 지역
function nearestNode(type) {
  let best = null, bd = Infinity;
  for (const n of nodes) { if (n.hp <= 0 || n.nd.res !== type) continue; const dd = d2(n.x, n.y, P.x, P.y); if (dd < bd) { bd = dd; best = n; } }
  return best;
}
function nearestDen(ok) {   // 몬스터가 살아 있는 가장 가까운 소굴. ok = 추가 조건
  let best = null, bd = Infinity;
  for (const d of dens) { if (d.boss || d.guard || !d.members.length || (ok && !ok(d))) continue; const dd = d2(d.x, d.y, P.x, P.y); if (dd < bd) { bd = dd; best = d; } }
  return best;
}
const bossPct = () => { const b = boss(); return b ? `남은 체력 ${Math.ceil(b.hp / b.maxHp * 100)}% · 보라색 원을 피하세요` : ''; };
function reqHelp(g) {   // 목표 칸의 둘째 줄: 조건을 어떻게 채우는지
  const q = g.req;
  switch (q.type) {
    case 'pay': return Object.keys(q.cost).map(k => `${RES_NAME[k]} ${Math.min(q.cost[k], Math.floor(res[k]) + g.paid[k])}/${q.cost[k]}`).join(' · ') + ' · 마법진 위에 멈추면 바쳐요';
    case 'hunt': return `${Math.min(g.n, q.n)}/${q.n} · 멈춰 서면 영웅들이 알아서 싸워요`;
    case 'elite': return '마법진 앞을 지키는 금빛 테두리 몬스터예요';
    case 'build': return `지금 Lv${lv[q.pad]} · 마을의 ${PAD[q.pad].name} 발판 위에 멈춰 서요`;
    case 'squad': return `지금 Lv${squad.lvl} · 몬스터를 잡으면 올라요`;
    case 'recruit': return `금화 ${Math.min(Math.floor(res.gold), PUB.cost)}/${PUB.cost} · 마을의 주점 발판에 멈추면 열려요`;
    case 'herolv': return squad.lvl < q.lv ? `용병단 Lv${q.lv}가 되면 올릴 수 있어요. 몬스터를 더 잡아요` : '화면 아래 영웅 칸을 눌러요 · 고기와 조각이 필요해요';
  }
  return '';
}
function reqTarget(g) {   // 조건을 채우러 가야 할 곳 (화살표가 가리킨다)
  const q = g.req;
  switch (q.type) {
    case 'pay': { const k = Object.keys(q.cost).find(c => Math.floor(res[c]) + g.paid[c] < q.cost[c]); return k ? (k === 'gold' ? nearestDen() : nearestNode(k)) || g : g; }
    case 'hunt': return nearestDen(d => q.mon in d.pack) || g;
    case 'elite': return g.guard.members[0] || g.guard;
    case 'build': return PAD[q.pad];
    case 'squad': return nearestDen() || g;
    case 'recruit': return res.gold >= PUB.cost ? PAD.tavern : nearestDen() || PAD.tavern;
    case 'herolv': return squad.lvl < q.lv ? nearestDen() : null;
  }
  return g;
}
function objective() {
  const trunk = sectors.filter(s => s.trunk && s.id), next = trunk.find(s => !s.open);
  if (next) {
    const g = next.gate, ok = reqDone(g);
    return { key: 'g' + g.sec, text: `안개 걷기 ${trunk.filter(s => s.open).length}/${trunk.length} · ${reqText(g)}`, prog: ok ? '조건을 채웠어요. 정화 마법진 위에 멈춰 서세요' : reqHelp(g),
      target: ok ? g : reqTarget(g), nudge: !ok && g.req.type === 'herolv' && squad.lvl >= g.req.lv };
  }
  if (!RD().bd) return { key: 'boss', text: `${REG().boss} 물리치기`, prog: bossPct() || '길 끝에서 기다리고 있어요', target: boss() || BOSS_POS };
  if (regionIdx === 0 && !lv.ship) return { key: 'ship', text: '선착장에서 배 만들기', prog: `나무 ${SHIP_COST.wood} · 돌 ${SHIP_COST.stone} · 금화 ${SHIP_COST.gold}. 생산소와 보물상자가 도와줘요`, target: PAD.dock };
  if (prog.seen < 2) return { key: 'sail', text: `배를 타고 ${REGIONS[1].name}로 항해`, prog: '선착장에 멈추면 항해 창이 열려요', target: PAD.dock };
  if (!regionData[1].bd) return { key: 'r2', text: `${REGIONS[1].name}의 ${REGIONS[1].boss} 물리치기`, prog: `${REGIONS[1].name}로 가야 해요`, target: PAD.dock };
  return { key: 'end', text: '남은 안개와 도전 콘텐츠', prog: `정화 ${openCount()}/${sectors.length - 1} · 도전의 문과 던전에 도전해 보세요`, target: null };
}

// ================= 입력 =================
const joy = { active: false, id: null, bx: 0, by: 0, dx: 0, dy: 0 };
const keys = new Set();
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
let lastInput = performance.now(), sleeping = false, sleepFrame = 0, sleepKills = 0, sleepGold = 0;
function markInput() { lastInput = performance.now(); if (sleeping) exitSleep(); }
function enterSleep() { sleeping = true; sleepKills = kills; sleepGold = res.gold; $('sleep').hidden = false; }
function exitSleep() { sleeping = false; $('sleep').hidden = true; }
$('sleep').addEventListener('pointerdown', e => { e.preventDefault(); markInput(); });
addEventListener('keydown', e => {
  markInput();
  const k = e.key.toLowerCase();
  if (MOVE_KEYS.includes(k)) { keys.add(k); if (state === 'play') e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); joy.active = false; joy.dx = joy.dy = 0; });
addEventListener('pointerdown', markInput, true);
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || joy.active) return;
  const r = cv.getBoundingClientRect();
  joy.active = true; joy.id = e.pointerId;
  joy.bx = e.clientX - r.left; joy.by = e.clientY - r.top; joy.dx = joy.dy = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return;
  lastInput = performance.now();
  const r = cv.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  let dx = px - joy.bx, dy = py - joy.by;
  const d = Math.hypot(dx, dy);
  if (d > JR) { joy.bx = px - dx / d * JR; joy.by = py - dy / d * JR; dx = dx / d * JR; dy = dy / d * JR; }   // 조이스틱 받침이 손가락을 따라온다
  joy.dx = dx / JR; joy.dy = dy / JR;
});
const endJoy = e => { if (e.pointerId === joy.id) { joy.active = false; joy.id = null; joy.dx = joy.dy = 0; } };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);
cv.addEventListener('lostpointercapture', endJoy);
function inputVec() {
  if (joy.active) return { x: joy.dx, y: joy.dy, m: Math.hypot(joy.dx, joy.dy) };
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x--;
  if (keys.has('d') || keys.has('arrowright')) x++;
  if (keys.has('w') || keys.has('arrowup')) y--;
  if (keys.has('s') || keys.has('arrowdown')) y++;
  const m = Math.hypot(x, y);
  return m ? { x: x / m, y: y / m, m: 1 } : { x: 0, y: 0, m: 0 };
}
$('btn-set').addEventListener('click', () => openPanel('settings'));
mini.addEventListener('click', () => { if (!mode) openPanel('map'); });   // 미니맵을 누르면 지역 전체 지도
$('btn-camp').addEventListener('click', () => {
  if (state !== 'play') return;
  if (camp) { endCamp(); return; }
  const why = campBlocked();
  if (why && why !== 'x') toast(why); else if (!why) startCamp();
});
$('btn-home').addEventListener('click', () => {   // 귀환 포털: 마을로 갔다가 원래 자리로 돌아올 수 있다
  if (state !== 'play' || mode) return;
  if (inVillage(P.x, P.y)) {
    if (!returnPos) return;
    const back = returnPos; returnPos = null;
    placeSquad(back.x, back.y); toast('원래 자리로 돌아왔어요');
    return;
  }
  if (monsters.some(m => m.state === 'chase' && d2(m.x, m.y, P.x, P.y) < 350 * 350)) { toast('싸우는 중에는 귀환할 수 없어요'); return; }
  endCamp();
  returnPos = { x: P.x, y: P.y };
  placeSquad(START.x, START.y);
  toast('마을로 귀환했어요. 「돌아가기」를 누르면 원래 자리로 가요');
});

// ================= 저장 · 불러오기 =================
function serialize() {
  saveRegionState();
  return {
    v: 4, savedAt: Date.now(), region: regionIdx,
    res: { ...res }, life: { ...life }, lv: { ...lv }, paid: JSON.parse(JSON.stringify(paid)),
    ro: roster.map(r => [r.owned ? 1 : 0, r.lvl, r.shards, r.active ? 1 : 0]),
    pub: { line: pub.line.slice(), picked: pub.picked, pity: pub.pity, left: Math.max(0, Math.round(pub.next - playTime)), pulls: pub.pulls },
    squad: { ...squad }, gear: JSON.parse(JSON.stringify(gear)), prod: JSON.parse(JSON.stringify(prod)), daily: JSON.parse(JSON.stringify(daily)), prog: { ...prog },
    regions: JSON.parse(JSON.stringify(regionData)),
    mz: maxZone, k: kills, t: Math.round(playTime),
  };
}
// 예전 판(v1 ~ v3)의 저장도 읽는다. v4에서 지도가 통째로 바뀌었기 때문에,
// 예전 저장은 성장(영웅 · 건물 · 장비 · 자원 · 보스 처치 기록)만 잇고 안개는 처음부터 다시 걷는다
function restore(s) {
  if (!s || ![1, 2, 3, 4].includes(s.v)) throw new Error('저장 형식이 달라요');
  newGame();
  Object.assign(res, s.res); Object.assign(life, s.life);
  for (const k in lv) if (s.lv && s.lv[k] != null) lv[k] = s.lv[k] | 0;
  for (const id in s.paid) if (paid[id]) Object.assign(paid[id], s.paid[id]);
  kills = s.k | 0; playTime = +s.t || 0; maxZone = s.mz | 0;
  let pubLeft = null;
  const readPub = sp => {
    if (!sp) return;
    if (Array.isArray(sp.line) && sp.line.length === 3 && sp.line.every(i => HERO_DEFS[i])) { pub.line = sp.line; pub.picked = clamp(sp.picked | 0, -1, 2); pub.pity = sp.pity | 0; }
    pub.pulls = sp.pulls | 0; if (sp.left != null) pubLeft = +sp.left;
  };
  if (s.v === 1) {
    const n = clamp(s.n | 0, 2, 6);
    roster.forEach((r, i) => { r.owned = r.active = i < n; });
    pub.pulls = n - 2;
  } else if (s.v === 2) {
    (s.ro || []).forEach((t, i) => { if (roster[i]) Object.assign(roster[i], { owned: !!t[0] || i < 2, active: !!t[0] || i < 2, lvl: clamp(t[1] | 0, 1, MAX_HERO_LV), shards: Math.max(0, t[2] | 0) }); });
    readPub(s.pub);
  }
  if (s.v <= 2) {
    // 예전 판에는 용병단 레벨이 없었다: 처치 수로 경험치를 어림하고, 영웅 레벨보다 낮지 않게 맞춘다
    let xp = kills * 3;
    while (squad.lvl < SQUAD_MAX_LV && xp >= xpNeed(squad.lvl)) { xp -= xpNeed(squad.lvl); squad.lvl++; }
    squad.lvl = Math.max(squad.lvl, ...roster.map(r => r.lvl));
    regionData[0].bd = !!s.bd; regionData[0].bs = !!s.bs;
  } else {
    (s.ro || []).forEach((t, i) => { if (roster[i]) Object.assign(roster[i], { owned: !!t[0] || i < 2, lvl: clamp(t[1] | 0, 1, MAX_HERO_LV), shards: Math.max(0, t[2] | 0), active: !!t[3] }); });
    readPub(s.pub);
    if (s.squad) squad = { lvl: clamp(s.squad.lvl | 0, 1, SQUAD_MAX_LV), xp: Math.max(0, +s.squad.xp || 0) };
    if (s.gear) { gear = { bag: s.gear.bag || [], eq: s.gear.eq || {}, uid: s.gear.uid | 0 }; }
    if (s.prod) prod = Object.assign(prod, s.prod);
    const v4 = s.v >= 4;   // 상자 번호와 구역 번호는 v4의 지도에서만 뜻이 있다
    if (s.daily) daily = Object.assign(daily, s.daily, { opened: REGIONS.map((_, r) => (v4 && s.daily.opened && s.daily.opened[r]) || []) });
    if (s.prog) Object.assign(prog, s.prog);
    if (Array.isArray(s.regions)) s.regions.forEach((r, i) => { if (regionData[i]) regionData[i] = { bd: !!r.bd, bs: !!r.bs, open: v4 && Array.isArray(r.open) ? r.open.map(n => n | 0) : [], g: (v4 && r.g) || {} }; });
    regionIdx = clamp(s.region | 0, 0, REGIONS.length - 1);
  }
  let act = 0;   // 출전 인원 한도를 넘지 않게
  roster.forEach(r => { if (r.owned && r.active) { if (act < squadLimit()) act++; else r.active = false; } });
  if (!act) roster[0].active = true;
  pub.next = playTime + (pubLeft != null ? pubLeft : PUB.auto);
  checkDaily();
  heroes = [];
  loadRegion(regionIdx);
  recalcGear();
  heroes.forEach(h => { h.hp = h.maxHp; });
}
function saveLocal() { if (state === 'title' || !res) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (_) { /* 저장이 막힌 환경에서도 게임은 계속된다 */ } }
function loadLocal() { try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch (_) { return null; } }
function offlineReport(savedAt) {
  if (!savedAt) return;
  const raw = (Date.now() - savedAt) / 60000, mins = Math.min(OFFLINE_MAX_H * 60, raw);
  const n = Math.floor(mins / OFFLINE_CHEST_MIN);
  if (n < 1) return;
  const L = REG().loot;
  openPanel('report', { mins, n, capped: raw > mins, gold: Math.round(4 * n * L), wood: Math.round(8 * n * L), stone: Math.round(8 * n * L), meat: Math.round(3 * n * L) });
}

// ================= 시작 =================
function showTitle() {
  state = 'title';
  const s = loadLocal();
  $('btn-continue').hidden = !s;
  $('btn-new').textContent = s ? '처음부터' : '출발';
  $('btn-new').className = s ? 'btn ghost' : 'btn primary';
  $('title').hidden = false;
}
function startPlay() {
  $('title').hidden = true; $('win').hidden = true; sheet.hidden = true;
  panel = null; spinning = false;
  state = 'play'; partyN = -1; saveT = 3; lastQuest = -1;
  joy.active = false;
  for (const p of PADS) padArmed[p.id] = d2(P.x, P.y, p.x, p.y) >= 50 * 50;
  markInput();
}
function showWin() {
  state = 'win';
  const t = Math.round(playTime);
  const frost = regionIdx === 1;
  $('win-title').textContent = frost ? '서리가 녹았습니다' : '안개가 걷혔습니다';
  $('win-lead').textContent = frost ? '서리 여왕이 쓰러지고 군도에 봄이 찾아왔어요. 도전 콘텐츠로 원정대를 더 키워 보세요.' : '폐허를 덮던 안개가 물러났어요. 선착장에서 배를 만들면 바다 건너 서리 군도로 갈 수 있어요.';
  $('s-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('s-kills').textContent = String(kills);
  $('s-party').textContent = `${heroes.length}명`;
  $('s-fog').textContent = `${openCount()}/${sectors.length - 1}`;
  $('win').hidden = false;
  saveLocal();
}
$('btn-new').addEventListener('click', () => {
  newGame(); startPlay(); saveLocal();
  if (!settings.guideSeen) { settings.guideSeen = true; saveSettings(); openPanel('guide', 0); }   // 이 기기에서 처음이면 게임 방법부터
});
$('btn-guide').addEventListener('click', () => openPanel('guide', 0));
$('btn-continue').addEventListener('click', () => {
  const s = loadLocal();
  try { restore(s); } catch (_) { newGame(); }
  startPlay();
  offlineReport(s && s.savedAt);
});
$('btn-keep').addEventListener('click', () => { $('win').hidden = true; state = 'play'; });
document.addEventListener('visibilitychange', () => { if (document.hidden) saveLocal(); });

let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  const dt = clamp((ts - last) / 1000, 0, 0.05);
  last = ts;
  if (state === 'play' || state === 'wipe') update(dt); else now += dt;
  if (settings.powerSave && state === 'play' && !sleeping && ts - lastInput > 180000) enterSleep();
  if (sleeping && ++sleepFrame % 4) { uiTick(dt); return; }   // 절전 중에는 네 번에 한 번만 그린다
  render();
  uiTick(dt);
}
function boot(data) {
  resize();
  newGame();
  if (document.fonts && document.fonts.load) {   // 캔버스 글자에 쓰는 한글 조각을 미리 받아 둔다
    const words = [...PADS.map(p => p.name + p.effect), ...HERO_DEFS.map(d => d.name + d.s1.name + d.s2.name), Object.values(MON).map(m => m.name).join(''), '정화 마법진 자원 바치기 멈춰 서면 안개가 걷혀요 마리 처치 길목을 지키는 주점에서 영웅 한 명을 로 지금 표석 들판 숲 폐허 마을 ✓', '모집 최고 레벨 부활 쓰러짐 정예 던전 상자 수호상 기절 과다 출혈 폭발 결빙 회피 원정대가 모두 쓰러졌습니다 마을 등불 아래로 돌아갑니다 배 만들기 멈추면 항해 수확할 자원 개 부위 장착 웨이브 층 우두머리 등장 기다려요 용병단 부터 오늘 번 남음 0123456789m+!%'].join('');
    document.fonts.load(`16px ${FONT}`, words).catch(() => {});
  }
  let resumed = false;
  if (data && data.save) { try { restore(data.save); startPlay(); resumed = true; } catch (_) { newGame(); } }
  if (!resumed) showTitle();
  requestAnimationFrame(frame);
}

// 개발용: 브라우저 콘솔에서 lanternDebug.give(100, 100, 100, 100) 처럼 쓴다
window.lanternDebug = {
  give(w = 50, s = 50, g = 50, m = 50) { res.wood += w; res.stone += s; res.gold += g; res.meat += m; },
  shards(n = 20) { roster.forEach((r, i) => grantShards(i, n)); },
  xp(n = 100) { gainXp(n); },
  item(tier = 3, grade = 2, slot) { addItem(makeItem(tier, grade, slot)); },
  knockOut(i = 0) { const h = heroes[i]; if (h) { h.invulnT = 0; damageHero(h, h.hp + 1); } },
  go(x, y) { placeSquad(clamp(x, 50, WORLD_W - 50), clamp(y, 50, WORLD_H - 50)); },
  open(n = 1) { for (; n > 0; n--) { const s = sectors.find(o => o.trunk && !o.open); if (s) openGate(s.gate); } },   // 본줄기의 안개를 n개 걷는다
  openAll() { for (const s of sectors) if (!s.open) openGate(s.gate); },
  sector(i) { const s = sectors[i]; if (s && s.open) this.go(s.x, s.y); },                                                // 구역 한가운데로
  toBoss() { this.go(BOSS_POS.x, BOSS_POS.y + 260); },
  mode(id) { if (state === 'play' && !mode) enterMode(id, id === 'dungeon' ? { zone: 2, x: P.x, y: P.y, back: { x: P.x, y: P.y } } : { back: { x: P.x, y: P.y } }); },
  region(r) { sailTo(r); },
  save: () => JSON.parse(JSON.stringify(serialize())),
  load(s) { restore(s); startPlay(); },
  info: () => ({ state, region: regionIdx, P: { x: Math.round(P.x), y: Math.round(P.y) }, res: { ...res }, lv: { ...lv }, squad: { ...squad },
    heroes: heroes.map(h => `${h.def.short}${h.clone ? '(분신)' : ''} Lv${roster[h.idx].lvl} ${Math.round(h.hp)}/${h.maxHp}${h.down ? ' 쓰러짐' : ''}`),
    shards: roster.map(r => r.shards), monsters: monsters.length, mode: mode && { id: mode.id, t: Math.round(mode.t), over: mode.over, win: mode.win },
    gear: { bag: gear.bag.length, eq: Object.keys(gear.eq) }, quest: objective().text, open: `${openCount()}/${sectors.length - 1}`, sector: (secAt(P.x, P.y) || {}).id, kills, daily: { ...daily, opened: undefined } }),
};
const hot = window.claude && window.claude.hot;
try { if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ save: state === 'title' ? null : serialize() })); } catch (_) { /* 새 버전이 올라와도 진행을 이어 가기 위한 장치. 없어도 게임은 돈다 */ }
if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot((hot && hot.data) || {});
