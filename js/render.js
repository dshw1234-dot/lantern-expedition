'use strict';
// 등불 원정대 — 그리기. 월드(바닥 · 건물 · 오브젝트 · 영웅 · 몬스터) → 안개 → 어둠과 등불빛 → 화면 글자 · 표식

// ================= 좌표 · 기본 도형 =================
let shx = 0, shy = 0;
let hudTop = 150, hudBottom = 110;   // 화면 가장자리 표식이 HUD에 가리지 않게 ui.js가 매번 갱신한다
const w2s = (x, y) => ({ x: (x - cam.x) * SCALE + VW / 2 + shx, y: (y - cam.y) * SCALE + VH / 2 + shy });
function setWorld() { ctx.setTransform(DPR * SCALE, 0, 0, DPR * SCALE, DPR * (VW / 2 - cam.x * SCALE + shx), DPR * (VH / 2 - cam.y * SCALE + shy)); }
function setScreen() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
function viewRect() { const hw = VW / 2 / SCALE, hh = VH / 2 / SCALE; return { x0: cam.x - hw - 90, x1: cam.x + hw + 90, y0: cam.y - hh - 90, y1: cam.y + hh + 140 }; }
const inView = (o, v) => o.x > v.x0 && o.x < v.x1 && o.y > v.y0 && o.y < v.y1;
const nearVillage = v => VC.x > v.x0 - 520 && VC.x < v.x1 + 520 && VC.y > v.y0 - 520 && VC.y < v.y1 + 520;
function circ(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function ell(x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU); ctx.fill(); }
function shadowAt(x, y, r) { ell(x, y, r, r * 0.38, 'rgba(0,0,0,0.32)'); }
function poly(pts, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
function line(x1, y1, x2, y2, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
const FONT = '"Jua", "Gowun Dodum", "Malgun Gothic", sans-serif';
function outlineText(s, x, y, size, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${FONT}`;
  ctx.lineWidth = Math.max(3, size * 0.3); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(12,10,18,0.85)';
  ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
}
if (!CanvasRenderingContext2D.prototype.roundRect) {   // 오래된 브라우저용
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}
function resIcon(type, x, y, s) {
  if (type === 'wood') {
    ctx.fillStyle = '#9a6a3c'; ctx.beginPath(); ctx.roundRect(x - s, y - s * 0.45, s * 1.6, s * 0.9, s * 0.45); ctx.fill();
    ell(x + s * 0.6, y, s * 0.35, s * 0.45, '#dcaa6c');
  } else if (type === 'stone') {
    poly([x - s * 0.9, y + s * 0.5, x - s * 0.6, y - s * 0.4, x, y - s * 0.75, x + s * 0.7, y - s * 0.45, x + s * 0.9, y + s * 0.4, x + s * 0.2, y + s * 0.75], '#9aa0ae');
    poly([x - s * 0.6, y - s * 0.4, x, y - s * 0.75, x + s * 0.7, y - s * 0.45, x + s * 0.1, y - s * 0.1], '#c9cdd8');
  } else if (type === 'meat') {
    ctx.lineCap = 'round'; line(x - s * 0.1, y + s * 0.1, x - s * 0.75, y + s * 0.75, '#f1e6d3', Math.max(1.5, s * 0.35));
    circ(x - s * 0.85, y + s * 0.85, s * 0.22, '#f1e6d3');
    circ(x + s * 0.2, y - s * 0.2, s * 0.65, '#c8664a');
    circ(x + s * 0.05, y - s * 0.4, s * 0.2, '#f2a58a');
  } else {
    circ(x, y, s * 0.8, '#ffcf4a');
    ctx.strokeStyle = '#c9901c'; ctx.lineWidth = Math.max(1, s * 0.16); ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.stroke();
  }
}

// ================= 바닥 =================
function tuft(x, y, c) {
  ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.beginPath();
  ctx.moveTo(x - 4, y); ctx.lineTo(x - 7, y - 8); ctx.moveTo(x, y); ctx.lineTo(x, y - 11); ctx.moveTo(x + 4, y); ctx.lineTo(x + 7, y - 8);
  ctx.stroke();
}
function drawDetails(v) {
  const C = 90, MX = WORLD_W / C - 1, MY = WORLD_H / C - 1, R = REG();
  const cx0 = clamp(Math.floor(v.x0 / C), 0, MX), cx1 = clamp(Math.floor(v.x1 / C), 0, MX);
  const cy0 = clamp(Math.floor(v.y0 / C), 0, MY), cy1 = clamp(Math.floor(v.y1 / C), 0, MY);
  ctx.lineCap = 'round';
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const h = hash2(cx, cy), h2 = hash2(cy + 991, cx + 17);
    const x = cx * C + h * C, y = cy * C + h2 * C;
    if (!canWalk(x, y) || !tileAt(x, y - 34) || !tileAt(x - 30, y) || !tileAt(x + 30, y)) continue;   // 산과 안개 위에는 그리지 않는다
    const z = zoneAt(x, y);
    if (z === 0) { if (h > 0.6) ell(x, y, 4, 2.5, 'rgba(160,135,100,.5)'); continue; }
    if (z === 1) {
      tuft(x, y, R.tuft[0]); if (h > 0.55) tuft(x - 26, y + 18, R.tuft[0]);
      if (h2 > 0.78) { circ(x + 14, y + 6, 3, R.snow ? '#ffffff' : h > 0.5 ? '#f5d76e' : '#f09bbd'); circ(x + 14, y + 6, 1.2, R.snow ? '#bfe9ff' : '#fff7d1'); }
    } else if (z === 2) {
      tuft(x, y, R.tuft[1]); if (h > 0.6) tuft(x + 24, y - 14, R.tuft[1]);
      if (h2 > 0.82) { ctx.fillStyle = '#e8dcc4'; ctx.fillRect(x + 8, y, 4, 6); ctx.fillStyle = R.snow ? '#7fb8d8' : '#c9544b'; ctx.beginPath(); ctx.arc(x + 10, y, 7, Math.PI, 0); ctx.fill(); circ(x + 8, y - 3, 1.3, '#fff'); }
    } else {
      if (h > 0.45) { ell(x, y, 5, 3, '#6e6c80'); ell(x + 9, y + 3, 3.5, 2.2, '#5f5d70'); }
      if (h2 > 0.9) { line(x - 7, y - 3, x + 7, y + 3, '#d9d2bd', 2.5); line(x - 7, y + 3, x + 7, y - 3, '#d9d2bd', 2.5); }
      else if (h2 > 0.72) { ctx.strokeStyle = 'rgba(30,28,40,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 3, y - 4); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + 10, y - 2); ctx.stroke(); }
    }
  }
}
function drawFence() {
  for (let a = 0; a < TAU; a += 0.08) {   // 길이 나가는 쪽만 울타리를 비운다
    if (villageExits.some(r => Math.abs(Math.atan2(Math.sin(a - r), Math.cos(a - r))) < 0.24)) continue;
    const x = VC.x + Math.cos(a) * (VILLAGE_R + 5), y = VC.y + Math.sin(a) * (VILLAGE_R + 5);
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 3, y - 16, 6, 16);
    ctx.fillStyle = '#7a5a40'; ctx.fillRect(x - 3, y - 18, 6, 4);
  }
}
function drawPads() {
  for (const p of PADS) {
    const cost = padCost(p);
    const live = p.kind === 'panel' || (p.kind === 'dock' && (lv.ship || regionData[0].bd)) || !!cost;
    const on = state === 'play' && !P.moving && d2(P.x, P.y, p.x, p.y) < 50 * 50;
    ctx.fillStyle = on ? 'rgba(255,190,100,0.22)' : 'rgba(255,190,100,0.1)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 46, 0, TAU); ctx.fill();
    ctx.setLineDash([7, 7]); ctx.lineDashOffset = -now * 14;
    ctx.strokeStyle = live ? 'rgba(255,205,130,0.75)' : 'rgba(255,205,130,0.3)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.setLineDash([]);
    if (cost) {
      const f = padFrac(p, cost);
      if (f > 0) { ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, 46, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke(); }
    }
  }
}

// ================= 건물 =================
function drawSite() {
  ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,220,170,0.55)'; ctx.lineWidth = 2;
  ctx.strokeRect(-40, -40, 80, 44);
  ctx.beginPath(); ctx.moveTo(-46, -40); ctx.lineTo(0, -70); ctx.lineTo(46, -40); ctx.stroke(); ctx.setLineDash([]);
  for (const x of [-40, 40]) { ctx.fillStyle = '#8a6440'; ctx.fillRect(x - 3, -24, 6, 28); }
  ctx.fillStyle = '#a07a50'; ctx.fillRect(-18, -2, 36, 6); ctx.fillRect(-12, -8, 30, 6);
}
function drawLanternTower(L) {
  poly([-26, 10, 26, 10, 18, -8, -18, -8], '#6f6a78'); poly([-18, -8, 18, -8, 14, -14, -14, -14], '#8a8594');
  ctx.fillStyle = '#4a3526'; ctx.fillRect(-5, -90, 10, 78); ctx.fillRect(-16, -90, 32, 5);
  const s = 1 + L * 0.1, fl = 0.9 + Math.sin(now * 9) * 0.05 + Math.sin(now * 23) * 0.03;
  ctx.save(); ctx.translate(0, -100); ctx.scale(s, s);
  ctx.fillStyle = '#2b2118'; ctx.fillRect(-11, -14, 22, 26);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 12);
  g.addColorStop(0, '#fff6d0'); g.addColorStop(0.5, '#ffc86a'); g.addColorStop(1, '#e07820');
  ctx.globalAlpha = fl; ctx.fillStyle = g; ctx.fillRect(-8, -11, 16, 20); ctx.globalAlpha = 1;
  poly([-13, -14, 13, -14, 0, -24], '#3a2c20');
  ctx.restore();
}
function drawForge(L) {
  ctx.fillStyle = '#7d5a3f'; ctx.fillRect(-40, -40, 80, 44);
  ctx.fillStyle = '#5b4a44'; ctx.fillRect(18, -82, 13, 30);
  poly([-48, -40, 0, -74, 48, -40], '#9c4436');
  ctx.fillStyle = '#3a2a1f'; ctx.fillRect(-10, -18, 20, 22);
  circ(24, -84, 4 + Math.sin(now * 8), '#ff9a3d');
  for (let i = 0; i < 3; i++) { const t = (now * 0.5 + i / 3) % 1; circ(24 + Math.sin(t * 6 + i) * 6, -90 - t * 50, 5 + t * 8, `rgba(150,140,140,${0.35 * (1 - t)})`); }
  poly([-34, 8, -14, 8, -18, 2, -30, 2], '#4b4d57'); ctx.fillStyle = '#4b4d57'; ctx.fillRect(-28, -6, 12, 9);
  if (L >= 3) { ctx.fillStyle = '#ffcf6b'; ctx.fillRect(-40, -44, 80, 4); }
}
function drawBarracks(L) {
  poly([-42, 4, 0, -58, 42, 4], '#b89a64'); poly([-14, 4, 0, -30, 14, 4], '#3a2a1f');
  line(0, -58, -22, 4, '#8f7446', 3); line(0, -58, 22, 4, '#8f7446', 3);
  line(36, 4, 36, -72, '#5a4030', 3);
  const w = Math.sin(now * 5) * 3;
  poly([36, -72, 58, -66 + w, 36, -58], '#d0493f');
  if (L >= 3) poly([36, -58, 52, -53 + w, 36, -48], '#ffcf6b');
}
function drawTavern() {
  ctx.fillStyle = '#8a6a4c'; ctx.fillRect(-44, -44, 88, 48);
  poly([-52, -44, -30, -76, 30, -76, 52, -44], '#3f5d86');
  ctx.fillStyle = '#3a2a1f'; ctx.fillRect(-9, -20, 18, 24);
  ctx.fillStyle = '#ffcf7a'; ctx.fillRect(-34, -32, 14, 12); ctx.fillRect(20, -32, 14, 12);
  line(44, -40, 58, -40, '#5a4030', 2);
  ctx.fillStyle = '#c89b5b'; ctx.fillRect(48, -38, 16, 14); circ(56, -31, 4, '#ffd35a');
}
function drawStatueBuilding() {   // 수호상: 받침대 위 기사상. 장비를 끼운 부위만큼 빛난다
  const n = Object.keys(gear.eq).length;
  poly([-30, 8, 30, 8, 22, -12, -22, -12], '#6f6a78');
  ctx.fillStyle = '#8a8594'; ctx.fillRect(-18, -20, 36, 8);
  if (n) { ctx.globalAlpha = 0.25 + 0.05 * n; circ(0, -60, 34 + n * 2, '#ffcf6b'); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#9aa0ae'; ctx.fillRect(-9, -64, 18, 44);
  circ(0, -72, 10, '#aab0bd');
  poly([-22, -58, -9, -60, -9, -36, -20, -40], '#8b909d');
  line(14, -30, 18, -92, '#c9cdd8', 3.5);
  poly([12, -92, 18, -104, 24, -92], '#dfe3ea');
}
function drawGate() {   // 도전의 문: 돌 아치 안에 보랏빛 소용돌이
  ctx.fillStyle = '#5d5968'; ctx.fillRect(-40, -84, 14, 90); ctx.fillRect(26, -84, 14, 90);
  poly([-44, -80, 0, -104, 44, -80, 44, -72, 0, -94, -44, -72], '#6f6a78');
  const t = now * 1.5;
  for (let k = 3; k >= 0; k--) { ctx.globalAlpha = 0.25 + k * 0.12; ell(0, -38, 20 + k * 1.5 + Math.sin(t + k) * 2, 38 - k * 6, k % 2 ? '#8a6bff' : '#c3a8ff'); }
  ctx.globalAlpha = 1;
}
function drawProdBuilding() {   // 생산소: 오두막 + 통나무 더미 + 광석 수레
  ctx.fillStyle = '#7d6246'; ctx.fillRect(-26, -46, 52, 46);
  poly([-32, -46, 0, -70, 32, -46], '#6b8a4a');
  ctx.fillStyle = '#3a2a1f'; ctx.fillRect(-8, -22, 16, 22);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#9a6a3c'; ctx.fillRect(-58, -6 - i * 7, 26, 6); ell(-32, -3 - i * 7, 3, 3, '#dcaa6c'); }
  ctx.fillStyle = '#5b4a44'; ctx.fillRect(34, -12, 24, 12); circ(38, 2, 4, '#3a3030'); circ(54, 2, 4, '#3a3030');
  circ(42, -14, 5, '#9aa0ae'); circ(50, -15, 4, '#b8bdc9');
  const full = PROD.some(p => prod[p.id].stored >= 1);
  if (full) { const b = Math.sin(now * 4) * 3; circ(0, -86 + b, 9, '#ffcf6b'); outlineText('!', 0, -86 + b, 13, '#2a1904'); }
}
function drawDock() {
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-50, -10, 100, 14);
  for (const x of [-44, -14, 16, 44]) { ctx.fillStyle = '#4a3222'; ctx.fillRect(x - 3, -10, 6, 26); }
  ell(0, 26, 70, 12, 'rgba(90,140,190,0.35)');
  if (lv.ship) {
    poly([-40, -18, 40, -18, 30, 0, -30, 0], '#8a5a34');
    line(0, -18, 0, -84, '#4a3222', 3);
    const w = Math.sin(now * 3) * 3;
    poly([2, -80, 34 + w, -44, 2, -26], '#f2ead6');
    poly([-2, -74, -26 + w, -46, -2, -32], '#e2d8c0');
  } else if (regionData[0].bd) {
    ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,220,170,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-40, -18); ctx.lineTo(40, -18); ctx.lineTo(30, 0); ctx.lineTo(-30, 0); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawBuilding(b) {
  const p = b.pad;
  ctx.save(); ctx.translate(b.x, b.y);
  switch (p.id) {
    case 'lantern': drawLanternTower(lv.lantern); break;
    case 'tavern': drawTavern(); break;
    case 'statue': drawStatueBuilding(); break;
    case 'gate': drawGate(); break;
    case 'prod': drawProdBuilding(); break;
    case 'dock': drawDock(); break;
    case 'forge': lv.forge > 0 ? drawForge(lv.forge) : drawSite(); break;
    case 'barracks': lv.barracks > 0 ? drawBarracks(lv.barracks) : drawSite(); break;
  }
  ctx.restore();
}

// ================= 필드 오브젝트 =================
function drawNode(n) {
  const sh = n.shake > 0 ? Math.sin(now * 70) * 3 : 0, R = REG();
  ctx.save(); ctx.translate(n.x + sh, n.y);
  const s = n.r / 20;
  if (n.hp <= 0) {
    if (n.nd.res === 'wood') { ell(0, 0, 9 * s, 4 * s, '#5a3f28'); ell(0, -1, 7 * s, 3 * s, '#8a6440'); }
    else { circ(-5, 0, 3, '#7c8090'); circ(4, 2, 2.5, '#6c7080'); }
    ctx.restore(); return;
  }
  shadowAt(0, 2, n.r);
  if (n.kind === 'tree' || n.kind === 'bigtree') {
    ctx.scale(s, s);
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-4, -16, 8, 17);
    const c = R.tree[n.kind === 'bigtree' ? 1 : 0];
    circ(0, -30, 17, c[0]); circ(-10, -24, 12, c[1]); circ(10, -24, 12, c[1]); circ(-3, -38, 11, c[2]); circ(5, -33, 7, c[2]);
    if (R.snow) { ell(-2, -44, 9, 4, '#f4fbff'); ell(-10, -30, 6, 3, '#f4fbff'); }
  } else if (n.kind === 'deadtree') {
    ctx.lineCap = 'round';
    line(0, 0, 0, -34, '#6d5f55', 6);
    ctx.strokeStyle = '#6d5f55'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(-12, -32); ctx.moveTo(0, -28); ctx.lineTo(11, -40); ctx.moveTo(-12, -32); ctx.lineTo(-14, -42); ctx.stroke();
  } else {
    const r = n.r, pts = [];
    for (const [px, py] of n.poly) pts.push(px * r, py * r - r * 0.45);
    poly(pts, '#7f8392');
    ctx.save(); ctx.beginPath(); ctx.rect(-r * 1.2, -r * 1.5, r * 2.4, r * 1.05); ctx.clip(); poly(pts, R.snow ? '#e8f2f8' : '#a4a8b5'); ctx.restore();
    if (n.kind === 'crystal') {
      poly([-8, -r * 0.5, -5, -r * 1.75, -1, -r * 0.5], '#6cc8f5'); poly([-1, -r * 0.5, 4, -r * 1.45, 8, -r * 0.45], '#8fdcff');
      poly([5, -r * 0.4, 12, -r * 1.1, 13, -r * 0.3], '#5ab4e6'); poly([-5, -r * 1.7, -3, -r * 1.2, -6, -r * 0.8], 'rgba(230,250,255,.7)');
    }
  }
  ctx.restore();
}
function drawChest(c) {
  ctx.save(); ctx.translate(c.x, c.y);
  shadowAt(0, 2, 16);
  if (c.opened) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-14, -14, 28, 14);
    poly([-14, -14, 14, -14, 12, -26, -12, -26], '#8a6440');
  } else {
    const b = Math.sin(now * 3 + c.i) * 1.5;
    ctx.translate(0, b);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(-15, -18, 30, 18);
    ctx.fillStyle = '#a06a3c'; ctx.beginPath(); ctx.roundRect(-15, -26, 30, 10, 5); ctx.fill();
    ctx.fillStyle = '#ffcf4a'; ctx.fillRect(-15, -17, 30, 3); ctx.fillRect(-3, -20, 6, 8);
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now * 4 + c.i); circ(0, -14, 20, 'rgba(255,210,110,0.5)');
  }
  ctx.restore();
}
function drawPortal(p) {   // 던전 입구
  ctx.save(); ctx.translate(p.x, p.y);
  ell(0, 0, 40, 16, '#2a2238');
  const t = now * 2;
  for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(${k % 2 ? '170,140,255' : '120,90,230'},0.8)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 34 - k * 9, 13 - k * 3.5, 0, t + k, t + k + 4.2); ctx.stroke(); }
  poly([-40, 0, -34, -30, -26, -2], '#5d5968'); poly([40, 0, 34, -30, 26, -2], '#5d5968');
  ctx.restore();
}
function drawCamp() {
  ctx.save(); ctx.translate(camp.x + 50, camp.y + 30);
  shadowAt(0, 4, 26);
  poly([-26, 4, 0, -36, 26, 4], '#b88a5a'); poly([-8, 4, 0, -16, 8, 4], '#3a2a1f');
  ctx.translate(-50, 20);
  circ(0, 0, 7, '#5a4030');
  const f = 1 + Math.sin(now * 12) * 0.15;
  poly([-6, 0, 0, -14 * f, 6, 0], '#ff9a3d'); poly([-3, 0, 0, -8 * f, 3, 0], '#ffe08a');
  ctx.restore();
}
function drawMagic(g) {   // 정화 마법진 (drawGate는 '도전의 문' 건물 그림이다)
  const ok = reqDone(g), on = state === 'play' && !P.moving && d2(P.x, P.y, g.x, g.y) < 58 * 58;
  ctx.save(); ctx.translate(g.x, g.y);
  ell(0, 0, 54, 23, ok ? 'rgba(110,235,255,0.3)' : on ? 'rgba(110,220,255,0.2)' : 'rgba(110,200,255,0.12)');
  ctx.strokeStyle = ok ? '#9ff5ff' : 'rgba(140,220,255,0.75)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 54, 23, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([9, 7]); ctx.lineDashOffset = -now * 16; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 38, 16, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(0, -8); ctx.lineTo(16, 0); ctx.lineTo(0, 8); ctx.closePath(); ctx.stroke();
  if (g.req.type === 'pay') {   // 바친 만큼 테두리가 찬다
    let tot = 0, got = 0;
    for (const k in g.req.cost) { tot += g.req.cost[k]; got += Math.min(g.req.cost[k], g.paid[k]); }
    if (got) { ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, 54, 23, 0, -Math.PI / 2, -Math.PI / 2 + TAU * got / tot); ctx.stroke(); }
  }
  if (ok) for (let k = 0; k < 5; k++) { const ph = (now * 0.6 + k / 5) % 1; circ(Math.sin(k * 2.4 + now) * 32, -ph * 50, 2.4, `rgba(170,245,255,${1 - ph})`); }
  ctx.restore();
}
function drawWay(w) {   // 순간이동 표석
  ctx.save(); ctx.translate(w.x, w.y);
  shadowAt(0, 2, 18);
  poly([-15, 0, -10, -12, 10, -12, 15, 0], '#6a6f82'); ctx.fillStyle = '#8b90a4'; ctx.fillRect(-10, -15, 20, 4);
  const b = Math.sin(now * 2.2 + w.i) * 3;
  poly([0, -58 + b, 11, -40 + b, 0, -22 + b, -11, -40 + b], '#5ad1ff'); poly([0, -58 + b, 11, -40 + b, 0, -40 + b], '#b6ecff');
  ctx.globalAlpha = 0.3 + 0.15 * Math.sin(now * 3 + w.i); circ(0, -40 + b, 22, 'rgba(110,210,255,0.5)');
  ctx.restore();
}

// ================= 바닥 그림 · 안개 =================
function cellRange(v) { return [clamp(Math.floor(v.x0 / CELL), 0, GRID_W - 1), clamp(Math.floor(v.x1 / CELL), 0, GRID_W - 1), clamp(Math.floor(v.y0 / CELL), 0, GRID_H - 1), clamp(Math.floor(v.y1 / CELL), 0, GRID_H - 1)]; }
function drawGround(v) {
  const [c0, c1, r0, r1] = cellRange(v);
  chunkCap = Math.max(chunkCap, (c1 - c0 + 1) * (r1 - r0 + 1) + 4);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) ctx.drawImage(groundChunk(r * GRID_W + c), c * CELL, r * CELL, CELL + 0.6, CELL + 0.6);
}
// 안개: 아직 걷히지 않은 구역의 땅 모양을 따라 덮는다. 길목은 구역 경계에서 살짝 넘치게 덮어, 마법진 바로 앞에서 길이 끊긴 것처럼 보이게 한다
function drawFog(v) {
  const [c0, c1, r0, r1] = cellRange(v), col = REG().fog;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const s = sectors[cellSec[r * GRID_W + c]];
    if (!s || (s.open && s.fade <= 0)) continue;
    const blob = k => {
      ctx.beginPath();
      for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, rr = Math.min(blobR(s, a) * k + 26, CELL * 0.56) * (1 + 0.025 * Math.sin(now * 0.8 + i * 1.7 + s.id)); if (i) ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr); else ctx.moveTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    };
    const road = (p, q, t0, t1, w) => { ctx.beginPath(); for (let t = t0; t <= t1 + 0.001; t += 0.04) { const o = neck(p, q, t); if (t === t0) ctx.moveTo(o.x, o.y); else ctx.lineTo(o.x, o.y); } ctx.lineWidth = w; ctx.stroke(); };
    const a = s.open ? s.fade : 1;
    ctx.fillStyle = ctx.strokeStyle = `rgba(${col},${0.5 * a})`;
    // 길목을 덮는 선은 끝이 둥글어서 반지름만큼 더 나온다. 구역 경계에서 60px(옅은 층) · 30px(짙은 층)까지만 넘치게 시작점을 잡는다 (마법진은 125px 앞)
    blob(1.1); road(sectors[s.parent], s, 0.5 + 90 / CELL, 1, 300);
    for (const kid of s.kids) road(s, sectors[kid], 0, 0.5, 300);
    ctx.fillStyle = ctx.strokeStyle = `rgba(${col},${a})`;
    blob(1); road(sectors[s.parent], s, 0.5 + 95 / CELL, 1, 250);
    for (const kid of s.kids) road(s, sectors[kid], 0, 0.5, 250);
    // 안에서 느릿하게 떠도는 옅은 덩이
    ctx.fillStyle = `rgba(255,255,255,${0.07 * a})`;
    for (let k = 0; k < 4; k++) { const an = now * 0.12 + k * 1.57 + s.id, rr = 90 + k * 45; ctx.beginPath(); ctx.ellipse(s.x + Math.cos(an) * rr, s.y + Math.sin(an * 1.3) * rr * 0.7, 120, 60, 0, 0, TAU); ctx.fill(); }
  }
}

// ================= 영웅 =================
function drawHero(h) {
  const d = h.def, r = d.r;
  const bob = h.walk ? Math.abs(Math.sin(now * 12 + h.idx)) * 3 : Math.sin(now * 2.5 + h.idx) * 0.8;
  ctx.save(); ctx.translate(h.x, h.y);
  if (h.down) ctx.globalAlpha = 0.38; else if (h.clone) ctx.globalAlpha = 0.7;
  shadowAt(0, 2, r * 0.9);
  if (h.guardT > 0) { ctx.strokeStyle = 'rgba(127,176,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, r + 8, (r + 8) * 0.45, 0, 0, TAU); ctx.stroke(); }
  if (h.invulnT > 0) { ctx.strokeStyle = `rgba(159,240,192,${0.4 + 0.4 * Math.sin(now * 20)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, r + 11, (r + 11) * 0.45, 0, 0, TAU); ctx.stroke(); }
  if (h.awakeT > 0) { ctx.fillStyle = `rgba(255,220,120,${0.22 + 0.12 * Math.sin(now * 14)})`; ctx.beginPath(); ctx.ellipse(0, -r, r + 12, r + 16, 0, 0, TAU); ctx.fill(); }   // 각성 중
  ctx.translate(0, -r - bob);
  ctx.scale(h.face, 1);
  const sw = h.swing > 0 ? Math.sin((0.2 - h.swing) / 0.2 * Math.PI) : 0;
  // 등 뒤 장비
  if (d.id === 'mina') { line(-r * 0.9, -r * 0.9, r * 0.5, r * 0.6, '#dfe6ef', 3); line(r * 0.3, -r * 1.0, -r * 0.8, r * 0.5, '#dfe6ef', 3); }
  if (d.id === 'siu') { ctx.save(); ctx.rotate(-sw * 0.6); line(-r * 0.4, r * 0.9, r * 1.5, -r * 1.2, '#a0b3c4', 3); poly([r * 1.5, -r * 1.2, r * 1.2, -r * 0.8, r * 1.9, -r * 1.7], '#dff6ff'); ctx.restore(); }
  if (d.id === 'bori') { ctx.save(); ctx.rotate(-0.4 - sw * 1.2); line(r * 0.2, r * 0.8, r * 0.9, -r * 1.3, '#6b4a2e', 3.5); poly([r * 0.7, -r * 1.5, r * 1.6, -r * 1.3, r * 1.4, -r * 0.6, r * 0.8, -r * 0.8], '#c9cdd8'); ctx.restore(); }
  // 몸
  circ(0, 0, r, h.flash > 0 ? '#ffffff' : d.color);
  ctx.lineWidth = 2; ctx.strokeStyle = h.clone ? '#9fd8ff' : d.dark; ctx.stroke();
  ell(-r * 0.32, -r * 0.4, r * 0.34, r * 0.2, 'rgba(255,255,255,0.28)');
  // 눈
  if (h.down) {
    ctx.strokeStyle = '#1a1a24'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (const ex of [r * 0.05, r * 0.5]) { ctx.moveTo(ex - 2.5, -2.5); ctx.lineTo(ex + 2.5, 2.5); ctx.moveTo(ex + 2.5, -2.5); ctx.lineTo(ex - 2.5, 2.5); }
    ctx.stroke();
  } else { circ(r * 0.05, -r * 0.05, r * 0.13, '#1a1a24'); circ(r * 0.5, -r * 0.05, r * 0.13, '#1a1a24'); }
  // 앞쪽 장비
  switch (d.id) {
    case 'luke':
      ctx.fillStyle = '#9aa6bd'; ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.95, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.save(); ctx.translate(r * 0.85 + sw * 4, r * 0.2);
      ctx.fillStyle = '#c9d2e3'; ctx.beginPath(); ctx.roundRect(-6, -9, 12, 17, 4); ctx.fill();
      ctx.fillStyle = '#5b8def'; ctx.fillRect(-1.5, -7, 3, 13); ctx.fillRect(-5, -2, 10, 3); ctx.restore();
      break;
    case 'teo': {
      poly([-r * 0.9, -r * 0.45, r * 0.1, -r * 1.55, r * 0.9, -r * 0.45], '#3f8a4a');
      const bx = r * 0.7 - sw * 3;
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx, r * 0.1, r * 0.95, -1.2, 1.2); ctx.stroke();
      line(bx + Math.cos(-1.2) * r * 0.95, r * 0.1 + Math.sin(-1.2) * r * 0.95, bx + Math.cos(1.2) * r * 0.95, r * 0.1 + Math.sin(1.2) * r * 0.95, 'rgba(240,230,200,.8)', 1);
      break;
    }
    case 'bella':
      ctx.strokeStyle = '#ffe38a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -r - 5, r * 0.6, r * 0.2, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#d9b64a'; ctx.fillRect(-1.5, r * 0.15, 3, 9); ctx.fillRect(-4, r * 0.35, 8, 3);
      break;
    case 'mina': poly([-r * 0.7, -r * 0.8, r * 0.1, -r * 1.1, r * 0.2, -r * 0.7], '#b8325a'); break;
    case 'lora':
      poly([-r * 1.0, -r * 0.55, r * 0.1, -r * 2.1, r * 1.0, -r * 0.55], '#3a2a4a');
      ctx.fillStyle = '#ff8b3d'; ctx.fillRect(-r * 0.75, -r * 0.8, r * 1.5, 3);
      line(r * 1.0, r * 0.9, r * 1.1, -r * 0.8, '#6b4a2e', 2.5);
      circ(r * 1.1, -r * 0.95, 3.5 + Math.sin(now * 12) * 0.8 + sw * 2, '#ffb45a');
      break;
    case 'siu': ctx.fillStyle = '#e8fbff'; ctx.fillRect(-r * 0.8, r * 0.25, r * 1.6, 3.5); break;
    case 'ruby':
      ctx.fillStyle = '#4f9a58'; ctx.fillRect(-r * 0.95, -r * 0.62, r * 1.9, 4);
      line(r * 0.3, r * 0.3, r * 1.4 + sw * 3, r * 0.1, '#7a5a3a', 2.5);
      circ(-r * 0.6, r * 0.55, 3.5, '#8fe36b');
      break;
    case 'bori': ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 1.0, Math.PI * 1.1, Math.PI * 1.9); ctx.fill(); break;
    case 'chichi': {
      const b = Math.sin(now * 6) * 1.5;
      circ(0, -r - 4 + b, 5, '#ffcf4a'); circ(0, -r - 1 + b, 1.6, '#8a6a1a');
      ctx.fillStyle = '#ff7fd0'; ctx.fillRect(r * 0.9, -r * 0.6, 2, 9); circ(r * 0.8, r * 0.3, 2.6, '#ff7fd0');
      break;
    }
    case 'kai':
      poly([-r * 0.9, -r * 0.6, -r * 0.5, -r * 1.5, -r * 0.1, -r * 0.8, r * 0.3, -r * 1.6, r * 0.6, -r * 0.8, r * 1.0, -r * 1.3, r * 0.9, -r * 0.5], '#fff6c0');
      ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 1.1, -r * 0.2); ctx.lineTo(r * 1.4, r * 0.1); ctx.lineTo(r * 1.15, r * 0.25); ctx.lineTo(r * 1.5, r * 0.6); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ================= 몬스터 =================
function drawMonster(m) {
  const d = m.d, r = m.r, hit = m.flash > 0, R = REG();
  const wob = Math.sin(now * (m.walk ? 10 : 3) + m.ph);
  ctx.save(); ctx.translate(m.x, m.y);
  shadowAt(0, 2, r);
  if (m.elite) {   // 정예: 금빛 테두리
    ctx.strokeStyle = `rgba(255,207,74,${0.55 + 0.25 * Math.sin(now * 5)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, r + 8, (r + 8) * 0.45, 0, 0, TAU); ctx.stroke();
  }
  ctx.scale(m.face, 1);
  const body = hit ? '#fff' : m.col;
  const eye = c => { circ(r * 0.1, -r * 0.1, r * 0.14, c); circ(r * 0.5, -r * 0.1, r * 0.14, c); };
  switch (m.type) {
    case 'slime': case 'bigslime': {
      const sy = 1 + wob * 0.08 - (m.atkAnim > 0 ? 0.15 : 0), sx = 1 - wob * 0.06;
      ctx.translate(0, -r * 0.8 * sy); ctx.scale(sx, sy);
      ell(0, 0, r * 1.1, r * 0.85, body);
      ell(-r * 0.35, -r * 0.35, r * 0.3, r * 0.18, 'rgba(255,255,255,.45)');
      eye('#15301a'); break;
    }
    case 'wolf': {
      ctx.translate(0, -r * 0.9 + (m.walk ? Math.abs(wob) * -2 : 0));
      poly([-r * 1.5, -r * 0.2, -r * 2.0, -r * 0.7, -r * 1.3, -r * 0.5], hit ? '#fff' : shade(m.col, -0.15));
      ell(-r * 0.2, 0, r * 1.3, r * 0.7, body);
      circ(r * 0.9, -r * 0.35, r * 0.62, hit ? '#fff' : shade(m.col, 0.15));
      poly([r * 0.55, -r * 0.8, r * 0.7, -r * 1.35, r * 0.95, -r * 0.85], shade(m.col, -0.15)); poly([r * 1.0, -r * 0.8, r * 1.2, -r * 1.3, r * 1.35, -r * 0.7], shade(m.col, -0.15));
      circ(r * 1.05, -r * 0.4, r * 0.12, '#ff6b5b'); circ(r * 1.4, -r * 0.2, r * 0.13, '#2a2a33');
      break;
    }
    case 'golem': {
      ctx.translate(0, -r * 0.95 + wob * 1.2);
      circ(-r * 0.95, r * 0.2, r * 0.38, hit ? '#fff' : shade(m.col, -0.12)); circ(r * 0.95, r * 0.2 - (m.atkAnim > 0 ? 6 : 0), r * 0.38, hit ? '#fff' : shade(m.col, -0.12));
      circ(0, 0, r, body);
      ell(-r * 0.3, -r * 0.6, r * 0.5, r * 0.25, R.snow ? '#e8f4f8' : '#5f8a4a'); ell(r * 0.4, -r * 0.3, r * 0.3, r * 0.18, R.snow ? '#d0e6ee' : '#6b9a50');
      eye(R.snow ? '#9ff0ff' : '#d6ff9a'); break;
    }
    case 'skeleton': {
      ctx.translate(0, -r * 0.4 + (m.walk ? Math.abs(wob) * -2 : 0));
      ctx.strokeStyle = hit ? '#fff' : shade(m.col, -0.08); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.4); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.5, -r * 0.3); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0); ctx.stroke();
      circ(0, -r * 1.2, r * 0.75, body);
      circ(r * 0.1, -r * 1.25, r * 0.18, '#1a1a24'); circ(r * 0.48, -r * 1.25, r * 0.18, '#1a1a24');
      ctx.save(); ctx.translate(r * 0.7, -r * 0.3); ctx.rotate(m.atkAnim > 0 ? 0.9 : -0.3); line(0, 0, 0, -r * 1.2, '#9aa0a8', 3); ctx.restore();
      break;
    }
    case 'wraith': case 'boss': {
      const fy = Math.sin(now * 2.5 + m.ph) * 4;
      ctx.translate(0, -r * 1.1 + fy);
      const col = d.boss ? (hit ? shade(R.bossCol, 0.25) : R.bossCol) : hit ? '#fff' : m.col;
      ctx.globalAlpha = d.boss ? 1 : 0.85;
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r, -r * 1.2, 0, -r * 1.2); ctx.quadraticCurveTo(r, -r * 1.2, r, 0);
      for (let i = 0; i <= 4; i++) { const x = r - i * r / 2; ctx.lineTo(x, r * 0.7 + Math.sin(now * 6 + i + m.ph) * r * 0.15 + (i % 2 ? -r * 0.25 : 0)); }
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      if (d.boss) {
        poly([-r * 0.6, -r * 1.05, -r * 0.45, -r * 1.55, -r * 0.2, -r * 1.15, 0, -r * 1.65, r * 0.2, -r * 1.15, r * 0.45, -r * 1.55, r * 0.6, -r * 1.05], R.crown);
        circ(r * 0.05, -r * 0.45, r * 0.13, R.eye); circ(r * 0.45, -r * 0.45, r * 0.13, R.eye);
        ctx.strokeStyle = 'rgba(190,160,255,.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = now * 20;
        ctx.beginPath(); ctx.ellipse(0, r * 1.1 - fy, r * 1.4, r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      } else { circ(r * 0.05, -r * 0.45, r * 0.15, '#ffffff'); circ(r * 0.45, -r * 0.45, r * 0.15, '#ffffff'); }
      break;
    }
    case 'pig': {   // 황금 돼지
      const bounce = m.walk ? Math.abs(Math.sin(now * 14)) * 4 : 0;
      ctx.translate(0, -r * 0.8 - bounce);
      ell(0, 0, r * 1.2, r * 0.85, hit ? '#fff' : '#ffcf4a');
      ell(-r * 0.4, -r * 0.35, r * 0.4, r * 0.2, 'rgba(255,255,255,.5)');
      ell(r * 1.05, r * 0.05, r * 0.35, r * 0.28, '#ffb13a'); circ(r * 1.0, r * 0.05, r * 0.07, '#8a5a1a'); circ(r * 1.15, r * 0.05, r * 0.07, '#8a5a1a');
      poly([r * 0.3, -r * 0.7, r * 0.45, -r * 1.1, r * 0.65, -r * 0.7], '#ffb13a');
      circ(r * 0.6, -r * 0.25, r * 0.1, '#3a2a10');
      for (const lx of [-0.6, -0.2, 0.3, 0.7]) ctx.fillRect(lx * r - 3, r * 0.7, 6, 8 + (m.walk ? Math.sin(now * 14 + lx * 5) * 3 : 0));
      break;
    }
  }
  ctx.restore();
  // 얼음 · 기절 · 상태이상 표시
  if (m.frozenT > 0) { ctx.globalAlpha = 0.45; ell(m.x, m.y - r, r * 1.2, r * 1.1, '#bfefff'); ctx.globalAlpha = 1; }
  else if (m.stunT > 0) for (let k = 0; k < 3; k++) { const a = now * 5 + k * 2.1; circ(m.x + Math.cos(a) * r * 0.8, m.y - r * 2.1 + Math.sin(a) * 4, 2.5, '#ffe066'); }
  let px = m.x - r * 0.8;
  for (const k in m.st) { circ(px, m.y + 6, 3.2, STATUS[k].col); px += 8; }
}

// ================= 줍기 · 투사체 · 효과 =================
function drawPickup(p) {
  shadowAt(p.x, p.y + 2, 6);
  const y = p.y - 8 - p.z;
  if (p.type === 'gear') {
    const c = GRADES[p.item.grade].col;
    ctx.globalAlpha = 0.35; circ(p.x, y, 12, c); ctx.globalAlpha = 1;
    ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(p.x - 7, y - 7, 14, 14, 4); ctx.fill();
    ctx.fillStyle = 'rgba(20,16,10,.7)'; ctx.fillRect(p.x - 1.5, y - 5, 3, 10); ctx.fillRect(p.x - 5, y - 1.5, 10, 3);
  } else if (BOOKS[p.type]) {
    const c = BOOKS[p.type].col;
    ctx.globalAlpha = 0.35; circ(p.x, y, 12, c); ctx.globalAlpha = 1;
    ctx.fillStyle = shade(c, -0.35); ctx.fillRect(p.x - 8, y - 6, 16, 12);
    ctx.fillStyle = c; ctx.fillRect(p.x - 7, y - 7, 14, 11);
    ctx.fillStyle = '#fff8e6'; ctx.fillRect(p.x - 1, y - 7, 2, 11);
  } else resIcon(p.type, p.x, y, p.type === 'gold' ? 7 + Math.min(4, p.value * 0.4) : 8);
}
function drawProj(p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a || 0);
  if (p.kind === 'arrow') { line(-11, 0, 6, 0, p.gold ? '#ffe08a' : '#eadcb8', 2.2); poly([9, 0, 3, -3.5, 3, 3.5], p.gold ? '#ffe08a' : '#cfd6df'); }
  else if (p.kind === 'dart') { line(-7, 0, 5, 0, '#8fe36b', 2); circ(-7, 0, 2, '#4f9a58'); }
  else if (p.kind === 'note') { ctx.rotate(-(p.a || 0)); circ(-2, 3, 3.5, '#ff7fd0'); line(1.5, 3, 1.5, -7, '#ff7fd0', 2); }
  else if (p.kind === 'fire') { circ(0, 0, 7, '#ff8b3d'); circ(1, 0, 4, '#ffe08a'); }
  else { circ(0, 0, p.heal ? 5 : 4, p.heal ? '#b9ffcf' : '#fff3a8'); circ(0, 0, 2, '#fff'); }
  ctx.restore();
}
function zigzag(x1, y1, x2, y2, seed) {
  const n = 6, rnd = mulberry32((seed * 1e6) | 0);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i < n; i++) {
    const t = i / n, nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1, off = (rnd() - 0.5) * 22;
    ctx.lineTo(x1 + (x2 - x1) * t + nx / l * off, y1 + (y2 - y1) * t + ny / l * off);
  }
  ctx.lineTo(x2, y2);
}
function drawFx(f) {
  const k = f.t / f.T, a = 1 - k;
  ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.fillStyle = f.c;
  if (f.kind === 'ring') { ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, f.y, Math.max(1, f.r * (0.3 + 0.7 * k)), Math.max(1, f.r * (0.3 + 0.7 * k) * 0.55), 0, 0, TAU); ctx.stroke(); }
  else if (f.kind === 'slash') { ctx.lineWidth = 4 * a + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, f.a - 0.9 + k * 0.6, f.a + 0.9 + k * 0.6); ctx.stroke(); }
  else if (f.kind === 'whirl') { ctx.lineWidth = 5; for (let i = 0; i < 3; i++) { const s = k * TAU * 1.5 + i * TAU / 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.5, 0, s, s + 1.2); ctx.stroke(); } }
  else if (f.kind === 'frost') { ctx.globalAlpha = a * 0.25; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.stroke(); }
  else if (f.kind === 'bolt') { ctx.lineWidth = 3; ctx.lineJoin = 'round'; zigzag(f.x, f.y, f.x2, f.y2, f.seed); ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
  else if (f.kind === 'beam') { ctx.lineCap = 'round'; line(f.x, f.y, f.x2, f.y2, f.c, 10 * a + 2); line(f.x, f.y, f.x2, f.y2, '#ffffff', 2); }
  ctx.globalAlpha = 1;
}
function drawDelayedGround(e) {
  if (e.kind === 'meteor') { ctx.strokeStyle = 'rgba(255,160,80,.8)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r, e.r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  else if (e.kind === 'cloud') {
    const a = Math.min(1, e.t) * 0.35;
    for (let k = 0; k < 5; k++) { const ang = now * 0.8 + k * 1.26; ctx.globalAlpha = a; circ(e.x + Math.cos(ang) * e.r * 0.45, e.y + Math.sin(ang) * e.r * 0.25 - 10, e.r * 0.45, '#7fd65a'); }
    ctx.globalAlpha = 1;
  }
}
function drawDelayedAir(e) {
  if (e.kind === 'meteor') { const k = e.t / e.T; circ(e.x + k * 60, e.y - k * 240, 13, '#ff8b3d'); circ(e.x + k * 60, e.y - k * 240, 7, '#ffe08a'); }
}

// ================= 경기장 (도전 콘텐츠) =================
function drawArena() {
  const floor = { pig: '#8a6a2a', dungeon: '#2d2a38', defense: '#3f5a36', tower: '#3a2f52' }[mode.id] || '#333';
  ctx.fillStyle = shade(floor, -0.35); ctx.beginPath(); ctx.arc(ARENA.x, ARENA.y, ARENA.r + 40, 0, TAU); ctx.fill();
  ctx.fillStyle = floor; ctx.beginPath(); ctx.arc(ARENA.x, ARENA.y, ARENA.r, 0, TAU); ctx.fill();
  ctx.strokeStyle = shade(floor, 0.25); ctx.lineWidth = 3;
  for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(ARENA.x, ARENA.y, ARENA.r * k / 3.4, 0, TAU); ctx.stroke(); }
  for (let a = 0; a < TAU; a += TAU / 24) {   // 둘레의 기둥
    const x = ARENA.x + Math.cos(a) * (ARENA.r + 14), y = ARENA.y + Math.sin(a) * (ARENA.r + 14);
    ctx.fillStyle = shade(floor, -0.5); ctx.fillRect(x - 6, y - 26, 12, 28);
    ctx.fillStyle = shade(floor, 0.1); ctx.fillRect(x - 7, y - 30, 14, 6);
  }
}
function drawDefStatue(st) {
  ctx.save(); ctx.translate(st.x, st.y);
  shadowAt(0, 4, 34);
  if (st.flash > 0) ctx.globalAlpha = 0.6;
  drawStatueBuilding();
  ctx.restore();
}

// ================= 어둠과 빛 =================
function hole(wx, wy, wr) {
  const s = w2s(wx, wy), x = s.x / 2, y = s.y / 2, r = wr * SCALE / 2;
  if (r < 1 || x + r < 0 || y + r < 0 || x - r > dark.width || y - r > dark.height) return;
  const g = dctx.createRadialGradient(x, y, r * 0.25, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = g; dctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function glow(wx, wy, wr, c) {
  const s = w2s(wx, wy), r = wr * SCALE;
  if (r < 1) return;
  const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
  g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
}
function drawDarkness() {
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = mode ? 'rgba(6,8,20,0.3)' : 'rgba(6,8,20,0.6)'; dctx.fillRect(0, 0, dark.width, dark.height);
  dctx.globalCompositeOperation = 'destination-out';
  const fl = 1 + Math.sin(now * 7.3) * 0.015 + Math.sin(now * 13.1) * 0.01;
  hole(P.x, P.y - 10, revealR() * 0.95 * fl);
  if (!mode) hole(VC.x, VC.y, (500 + 50 * lv.lantern) * fl);
  if (camp) hole(camp.x, camp.y, 300 * fl);
  for (const e of delayed) if (e.kind === 'meteor') hole(e.x, e.y, 140);
  for (const p of projs) if (p.kind === 'fire') hole(p.x, p.y, 70);
  dctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(dark, 0, 0, cv.width, cv.height);
  setScreen();
  ctx.globalCompositeOperation = 'lighter';
  glow(P.x, P.y - 10, revealR() * 0.7, 'rgba(255,160,70,0.10)');
  if (!mode) { const L = PAD.lantern; glow(L.x, L.y - 152, 180 + 40 * lv.lantern, 'rgba(255,170,80,0.16)'); }
  if (camp) glow(camp.x, camp.y + 20, 160, 'rgba(255,150,60,0.18)');
  ctx.globalCompositeOperation = 'source-over';
}

// ================= 화면 글자 · 표식 =================
function bar(x, y, w, f, c) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = c; ctx.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4);
}
function drawCostRow(items, cx, y) {   // [[자원, 수량], ...] 을 아이콘 + 숫자로 가운데 정렬
  ctx.font = `12.5px ${FONT}`;
  const wds = items.map(([, n]) => 18 + ctx.measureText(String(n)).width);
  let x = cx - (wds.reduce((a, b) => a + b, 0) + (items.length - 1) * 8) / 2;
  items.forEach(([k, n], i) => {
    resIcon(k, x + 6, y, 6);
    ctx.textAlign = 'left'; outlineText(String(n), x + 15, y + 1, 12.5, res[k] >= n ? '#fff1d6' : '#ff9c8f'); ctx.textAlign = 'center';
    x += wds[i] + 8;
  });
}
function padLabel(p) {   // [제목, 설명, 비용]
  const cost = padCost(p);
  if (p.kind === 'pay') return [`${p.name} Lv${lv[p.id]}`, cost ? p.effect : '최고 레벨', cost];
  if (p.kind === 'dock') {
    if (lv.ship) return ['선착장', '멈추면 항해', null];
    if (regionData[0].bd) return ['선착장', '배 만들기', cost];
    return ['선착장', `${REGIONS[0].boss}를 물리치면 열려요`, null];
  }
  if (p.id === 'tavern') return [p.name, p.effect, { gold: PUB.cost }];
  if (p.id === 'prod') { const n = PROD.reduce((s, q) => s + Math.floor(prod[q.id].stored), 0); return [p.name, n ? `수확할 자원 ${n}개` : p.effect, null]; }
  if (p.id === 'gate') return [p.name, p.effect, null];
  if (p.id === 'statue') return [p.name, `${Object.keys(gear.eq).length}/7 부위 장착 · ${p.effect}`, null];
  return [p.name, p.effect, null];
}
function drawWorldUI(v) {
  setScreen();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of nodes) if (n.hp > 0 && n.hitT > 0 && inView(n, v)) { const s = w2s(n.x, n.y - n.r * 2.8); bar(s.x, s.y, 22, n.hp / n.maxHp, '#e8c07a'); }
  for (const m of monsters) {
    if (m.d.boss || !inView(m, v) || (!m.arena && !isRevealed(m.x, m.y))) continue;
    if (m.hp < m.maxHp || m.d.pig) { const s = w2s(m.x, m.y - m.r * 2.2 - 6); bar(s.x, s.y, Math.max(18, m.r * 2 * SCALE), m.hp / m.maxHp, m.d.pig ? '#ffcf4a' : '#ff7a6b'); }
    if (m.elite) { const s = w2s(m.x, m.y - m.r * 2.2 - 18); outlineText('정예', s.x, s.y, 11, '#ffcf4a'); }
  }
  for (const h of heroes) {
    const s = w2s(h.x, h.y - h.def.r * 2 - 10);
    if (!h.down) { bar(s.x, s.y, 22, h.hp / h.maxHp, '#7fe0a4'); continue; }
    const f = clamp(h.downT / reviveNeed(), 0, 1);   // 부활까지 남은 시간
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#9ff0c0'; ctx.beginPath(); ctx.arc(s.x, s.y, 8, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
  }
  if (mode && mode.statue) { const st = mode.statue, s = w2s(st.x, st.y - 120); bar(s.x, s.y, 70, st.hp / st.maxHp, '#7fe0a4'); outlineText('수호상', s.x, s.y - 12, 12, '#ffe3b3'); }
  if (!mode && nearVillage(v)) {
    for (const p of PADS) {
      const s = w2s(p.x, p.y + 60), [title, sub, cost] = padLabel(p);
      outlineText(title, s.x, s.y, 15, '#ffe3b3');
      outlineText(sub, s.x, s.y + 17, 11.5, '#d6cab3');
      if (cost) drawCostRow(['wood', 'stone', 'gold'].map(k => [k, (cost[k] || 0) - (p.kind === 'panel' ? 0 : paid[p.id][k])]).filter(([, n]) => n > 0), s.x, s.y + 36);
    }
  }
  if (!mode) {
    for (const g of gates) {   // 정화 마법진: 이름과 조건 팻말
      if (!gateLive(g) || !inView(g, v)) continue;
      const s = w2s(g.x, g.y + 36), t = w2s(g.x, g.y - 74), wait = gateBlocked(g), ok = !wait && reqDone(g), pay = !wait && g.req.type === 'pay' && !ok;
      outlineText('정화 마법진', s.x, s.y, 13, '#bff3ff');
      const l1 = wait ? '임무를 먼저 끝내세요' : (ok ? '✓ ' : '') + (pay ? '자원 바치기' : reqText(g)), l2 = wait ? '' : ok ? '멈춰 서면 안개가 걷혀요' : pay ? ' ' : reqProg(g);
      ctx.font = `13px ${FONT}`; const w1 = ctx.measureText(l1).width;
      ctx.font = `11.5px ${FONT}`; const w = Math.max(w1, ctx.measureText(l2).width, pay ? 96 : 0) + 22, h = l2 ? 42 : 26;
      ctx.fillStyle = 'rgba(16,18,28,0.86)'; ctx.beginPath(); ctx.roundRect(t.x - w / 2, t.y - h / 2, w, h, 9); ctx.fill();
      ctx.strokeStyle = ok ? 'rgba(159,245,255,0.9)' : 'rgba(255,196,120,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      outlineText(l1, t.x, l2 ? t.y - 9 : t.y, 13, ok ? '#9ff5ff' : '#ffe3b3');
      if (pay) drawCostRow(Object.keys(g.req.cost).map(k => [k, g.req.cost[k] - g.paid[k]]).filter(([, n]) => n > 0), t.x, t.y + 10);
      else if (l2) outlineText(l2, t.x, t.y + 10, 11.5, ok ? '#d9fbff' : '#d6cab3');
    }
    for (const w of waypoints) if (sectors[w.sec].open && w.sec && inView(w, v)) { const s = w2s(w.x, w.y + 18); outlineText(w.name, s.x, s.y, 12, '#bfe9ff'); }
  }
  if (!mode) for (const p of portals) {
    if (!inView(p, v) || !isRevealed(p.x, p.y)) continue;
    const s = w2s(p.x, p.y + 30);
    outlineText('던전', s.x, s.y, 14, '#d6c8ff');
    outlineText(squad.lvl < UNLOCK.dungeon ? `용병단 Lv${UNLOCK.dungeon}부터` : `오늘 ${Math.max(0, DAILY.dungeon - daily.dungeon)}번 남음`, s.x, s.y + 15, 11, '#b8ad98');
  }
  for (const k of tokens) {
    const e = k.t * k.t * (3 - 2 * k.t);
    const s = w2s(k.sx + (k.tx - k.sx) * e, k.sy + (k.ty - k.sy) * e - Math.sin(k.t * Math.PI) * 50);
    resIcon(k.type, s.x, s.y, 6);
  }
  for (const t of texts) {
    const k = t.t / t.T, s = w2s(t.x, t.y);
    outlineText(t.s, s.x, s.y - k * 26, t.size, t.c, k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
  }
}
function edgeMarker(tg, color, label, small) {   // 대상이 화면 밖이면 가장자리 화살표, 안이면 위에 떠 있는 표식
  const s = w2s(tg.x, tg.y);
  const top = hudTop, bottom = VH - hudBottom, left = 28, right = VW - 28;
  if (s.x > left && s.x < right && s.y > top && s.y < bottom) {
    if (small) return;
    const b = Math.sin(now * 5) * 5, y = s.y - 70 * SCALE - 30 + b;
    poly([s.x - 9, y - 10, s.x + 9, y - 10, s.x, y + 2], color);
    ctx.strokeStyle = 'rgba(12,10,18,.8)'; ctx.lineWidth = 2; ctx.stroke();
    return;
  }
  const cx = VW / 2, cy = (top + bottom) / 2, dx = s.x - cx, dy = s.y - cy;
  const kx = dx ? ((dx > 0 ? right : left) - cx) / dx : Infinity, ky = dy ? ((dy > 0 ? bottom : top) - cy) / dy : Infinity;
  const k = Math.min(kx, ky), ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx), rad = small ? 14 : 20;
  circ(ax, ay, rad, 'rgba(16,18,28,.85)');
  ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); poly([rad * 0.65, 0, rad * 0.15, -rad * 0.35, rad * 0.15, rad * 0.35], color); ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (label) outlineText(label, ax - Math.cos(ang) * (rad + 18), ay - Math.sin(ang) * (rad + 14), small ? 11 : 12, '#ffe3b3');
}
function drawMarkers() {
  if (state !== 'play' || mode) return;
  const tg = curObj && curObj.target;
  if (tg) edgeMarker(tg, '#ffb44d', `${Math.round(Math.hypot(tg.x - P.x, tg.y - P.y) / 10)}m`);
  if (daily.chests < CHESTS_PER_DAY) {   // 가장 가까운 닫힌 상자
    let best = null, bd = 1600 * 1600;
    for (const c of chests) { if (c.opened) continue; const dd = d2(c.x, c.y, P.x, P.y); if (dd < bd) { bd = dd; best = c; } }
    if (best && best !== tg) edgeMarker(best, '#ffd35a', '상자', true);
  }
}
function drawJoystick() {
  if (state !== 'play') return;
  if (!joy.active) {   // 첫 목표 동안 아직 움직여 본 적이 없으면, 끄는 시늉을 되풀이해 보여 준다
    if (movedOnce || mode || kills > 0) return;
    const k = reduceMotion ? 0.6 : (now * 0.55) % 1, e = clamp((k - 0.15) / 0.3, 0, 1), s = e * e * (3 - 2 * e);
    const bx = VW / 2, by = VH * 0.6, kx = bx + s * JR * 0.75, ky = by - s * JR * 0.3;
    ctx.globalAlpha = clamp(Math.min(k * 8, (1 - k) * 5), 0, 1);
    ctx.fillStyle = 'rgba(255,240,220,0.1)'; ctx.beginPath(); ctx.arc(bx, by, JR, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,130,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    circ(kx, ky, 22, 'rgba(255,180,77,0.6)');
    ctx.strokeStyle = 'rgba(255,243,196,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(kx, ky, 27 + 3 * Math.sin(now * 6), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = 'rgba(255,240,220,0.07)'; ctx.beginPath(); ctx.arc(joy.bx, joy.by, JR, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,130,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  circ(joy.bx + joy.dx * JR, joy.by + joy.dy * JR, 22, 'rgba(255,180,77,0.55)');
}

// ================= 한 프레임 =================
function render() {
  shx = cam.shake ? rand(-1, 1) * cam.shake * 0.5 : 0; shy = cam.shake ? rand(-1, 1) * cam.shake * 0.5 : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = mode ? '#0a0c14' : shade(REG().rock[0], -0.4); ctx.fillRect(0, 0, cv.width, cv.height);
  const v = viewRect();
  setWorld();
  ctx.imageSmoothingEnabled = true;
  const world = !mode;
  if (world) { drawGround(v); drawDetails(v); }
  if (mode) drawArena();
  const nv = !mode && nearVillage(v);
  if (nv) { drawFence(); drawPads(); }
  if (!mode) {
    for (const g of gates) if (gateLive(g) && inView(g, v)) drawMagic(g);
    for (const p of portals) if (inView(p, v)) drawPortal(p);
    if (camp) drawCamp();
  }
  for (const m of monsters) if (m.slam) {   // 보스 내려찍기 예고
    const s = m.slam, k = 1 - s.t / s.T;
    ctx.fillStyle = `rgba(150,90,255,${0.1 + 0.2 * k})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(210,180,255,.8)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(200,120,255,.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * k, s.r * k * 0.55, 0, 0, TAU); ctx.fill();
  }
  for (const e of delayed) drawDelayedGround(e);
  for (const p of pickups) if (inView(p, v)) drawPickup(p);
  const list = [];
  if (!mode) {
    for (const n of nodes) if (inView(n, v)) list.push(n);
    for (const c of chests) if (inView(c, v)) list.push(c);
    for (const w of waypoints) if (sectors[w.sec].open && inView(w, v)) list.push(w);
  }
  for (const m of monsters) if (inView(m, v)) list.push(m);
  for (const h of heroes) list.push(h);
  if (nv) for (const b of BUILDINGS) list.push(b);
  if (mode && mode.statue) list.push(mode.statue);
  list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e.isHero) drawHero(e);
    else if (e.isMon) drawMonster(e);
    else if (e.isNode) drawNode(e);
    else if (e.isStatue) drawDefStatue(e);
    else if (e.isBuilding) drawBuilding(e);
    else if (e.isWay) drawWay(e);
    else drawChest(e);
  }
  for (const p of projs) drawProj(p);
  for (const o of orbs) { circ(o.x, o.y, 7, 'rgba(170,150,255,.9)'); circ(o.x, o.y, 3, '#fff'); }
  for (const e of delayed) drawDelayedAir(e);
  for (const f of fxs) drawFx(f);
  if (settings.effects) for (const p of parts) { ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
  ctx.globalAlpha = 1;
  if (world) drawFog(v);
  drawDarkness();
  drawWorldUI(v);
  setScreen();
  drawMarkers();
  drawJoystick();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (mode && mode.bannerT > 0) outlineText(mode.banner, VW / 2, VH * 0.3, 22, '#ffe3b3', Math.min(1, mode.bannerT));
  if (state === 'wipe') {
    ctx.fillStyle = `rgba(5,6,12,${clamp((2 - wipeT) * 0.8, 0, 0.7)})`; ctx.fillRect(0, 0, VW, VH);
    outlineText('원정대가 모두 쓰러졌습니다', VW / 2, VH / 2 - 14, 22, '#ffe3b3');
    outlineText('마을 등불 아래로 돌아갑니다', VW / 2, VH / 2 + 16, 14, '#d6cab3');
  }
}
