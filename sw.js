// 서비스 워커: 켤 때 인터넷을 기다리지 않고 바로 뜨게, 인터넷이 끊겨도 뜨게 화면 파일(HTML·CSS·JS·아이콘)·글꼴을 기기에 저장해 둠
// - 화면(HTML): 인터넷에서 0.8초 안에 오면 그걸로(새 배포를 바로), 늦으면 저장본으로 먼저 띄우고 받아 온 새 화면은 저장해 다음에 씀
//   (예전엔 화면 5초 + CSS·JS 파일마다 5초씩 인터넷을 기다려서, 켤 때 와이파이가 막 붙는 중이면 시작 화면만 10초 가까이 보였음 — 폴드8 녹화 9.5초)
// - CSS·JS(주소 끝 ?v=판 번호): 저장본 먼저. 판 번호가 주소에 있어서 같은 주소의 내용은 안 바뀜 → 화면이 가리키는 판 그대로라 HTML과 CSS·JS가 서로 다른 배포로 섞이지 않음
//   화면이 새 판을 가리키면 그때 받아 저장하고, 같은 파일의 옛 판은 지움
// - 그 밖의 같은 사이트 파일(아이콘·manifest·개인정보처리방침 등): 저장본을 먼저 주고 뒤에서 새로 받아 둠
// - 글꼴(Google Fonts·jsDelivr): 저장본 먼저, 없으면 받아서 저장 (주소에 판이 박혀 있어 안 바뀜)
// 날씨·교통 같은 데이터(/api 등)는 건드리지 않음 (앱이 마지막 값을 기기에 따로 저장)
const CACHE = 'mirror-v13';   // 저장 방식이 바뀌면 올림 → 예전 저장본을 지움
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
const EXTRA = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable.png', '/apple-touch-icon.png'];
const NAV_WAIT = 800;   // 화면을 인터넷에서 기다리는 최대 시간(ms) — 저장본이 있을 때만

// 미리 저장: 화면을 받아 그 화면이 가리키는 CSS·JS(판 번호 그대로)와 아이콘을 담음. 파일마다 따로 담아 하나가 실패해도 설치는 계속
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const res = await fetch('/', { cache: 'no-cache' }).catch(() => null);
    const urls = [...EXTRA];
    if (res && res.ok) {
      const html = await res.clone().text();
      await c.put('/', res);
      for (const m of html.matchAll(/(?:href|src)="((?:css|js)\/[^"?]+\?v=[^"]+)"/g)) urls.push('/' + m[1]);
    }
    await Promise.all([...new Set(urls)].map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
  })().then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin && !url.pathname.startsWith('/api/')) {
    if (req.mode === 'navigate') e.respondWith(page(req, url, e));
    else if (/^\/(css|js)\//.test(url.pathname) && url.searchParams.has('v')) e.respondWith(pinned(req, url));
    else e.respondWith(later(req, url, e));
  } else if (FONT_HOSTS.includes(url.hostname)) e.respondWith(stored(req));
});

// 화면: 주소 뒤 ?mode=·?remote 같은 건 빼고 경로로 저장 (/ 와 /index.html 은 같은 화면)
async function page(req, url, e) {
  const cache = await caches.open(CACHE), key = url.pathname === '/index.html' ? '/' : url.pathname;
  const net = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; });
  e.waitUntil(net.catch(() => {}));
  const hit = await cache.match(key);
  if (!hit) return net.catch(() => Response.error());
  return Promise.race([net.then(res => res.ok ? res : hit, () => hit), new Promise(r => setTimeout(() => r(hit), NAV_WAIT))]);
}
// 판 번호가 붙은 CSS·JS: 저장본 먼저, 없으면 받아서 저장하고 같은 파일의 옛 판은 지움. 끊겼는데 이 판이 없으면 옛 판이라도
async function pinned(req, url) {
  const cache = await caches.open(CACHE), key = url.pathname + url.search;
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(key, res.clone());
      for (const r of await cache.keys()) { const u = new URL(r.url); if (u.pathname === url.pathname && u.search !== url.search) cache.delete(r); }
    }
    return res;
  } catch (err) {
    return (await cache.match(url.pathname, { ignoreSearch: true })) || Response.error();
  }
}
// 그 밖의 같은 사이트 파일: 저장본을 바로 주고 뒤에서 새로 받아 둠 (없으면 받아서)
async function later(req, url, e) {
  const cache = await caches.open(CACHE), key = url.pathname + url.search;
  const hit = await cache.match(key);
  const net = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; });
  e.waitUntil(net.catch(() => {}));
  return hit || net.catch(() => Response.error());
}
async function stored(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
