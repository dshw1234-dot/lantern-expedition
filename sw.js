// 등불 원정대 — 오프라인 실행용 서비스 워커.
// 앱으로_만들기.py가 __VERSION__ 과 __FILES__ 자리를 채워서 '올릴파일/sw.js'로 내보낸다.
// 폰은 접속할 때마다 이 파일이 바뀌었는지 확인한다. VERSION이 달라지면 FILES를 통째로 새로 받는다.
const VERSION = "d0e75714cb";
const CACHE = 'lantern-' + VERSION;
const FONT_CACHE = 'lantern-fonts';   // 글꼴은 판이 바뀌어도 그대로 둔다
const FILES = ["./", "index.html", "js/combat.js", "js/data.js", "js/modes.js", "js/render.js", "js/ui.js", "js/world.js", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "manifest.webmanifest"];

self.addEventListener('install', e => {
  // cache: 'reload' = 브라우저의 임시 저장본을 건너뛰고 서버에서 새로 받는다
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))   // 지난 판 지우기
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // 게임 파일: 저장해 둔 것을 먼저 쓰고, 없을 때만 인터넷에서 받는다 (오프라인에서도 열린다)
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // 글꼴: 처음 받을 때 저장해 두고 다음부터는 저장본을 쓴다
    e.respondWith(caches.open(FONT_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
  }
});
