// 서비스 워커: 인터넷이 끊겨도 미러가 뜨게 화면 파일(HTML·CSS·JS·아이콘)·글꼴을 기기에 저장해 둠
// - 같은 사이트 파일: 인터넷 먼저(새 배포를 바로 받게, HTML과 CSS·JS가 서로 다른 배포로 섞이지 않게), 5초 안에 안 되면 저장본
// - 글꼴(Google Fonts·jsDelivr): 저장본 먼저, 없으면 받아서 저장 (주소에 판이 박혀 있어 안 바뀜)
// 날씨·교통·유튜브 같은 데이터(/api 등)는 건드리지 않음 (앱이 마지막 값을 기기에 따로 저장)
const CACHE = 'mirror-v2';
const CSS = ['theme', 'base', 'clock', 'weather', 'detail', 'standby', 'music', 'transit', 'standby-widgets', 'settings'];
const JS = ['core', 'sync', 'clock', 'weather', 'screen', 'clock-modes', 'settings', 'transit', 'music', 'main'];
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png',
  ...CSS.map(n => `/css/${n}.css`), ...JS.map(n => `/js/${n}.js`)];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin && !url.pathname.startsWith('/api/')) e.respondWith(fresh(req, url, e));
  else if (FONT_HOSTS.includes(url.hostname)) e.respondWith(stored(req));
});

// 같은 사이트: 주소 뒤 ?mode= 같은 건 빼고 경로로 저장 (/ 와 /index.html 은 같은 화면)
async function fresh(req, url, e) {
  const cache = await caches.open(CACHE);
  const key = url.pathname === '/index.html' ? '/' : url.pathname;
  const net = fetch(req).then(res => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  const late = new Promise(r => setTimeout(r, 5000)).then(() => cache.match(key));
  try {
    return await Promise.race([net, late.then(hit => hit || net)]);
  } catch (err) {
    return (await cache.match(key)) || Response.error();
  }
}
async function stored(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
