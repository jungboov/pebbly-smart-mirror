// Pebbly Mirror — 커서 숨김, 화면 켜 두기·자동 새로고침, 시작
// ===== 커서 =====
let idleTimer;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), CONFIG.cursorIdle);
});

// ===== 닫힘 기록 =====
// 밤사이 앱이 닫혀 아침에 바탕화면이던 일(2026-11-23 태블릿 — 앱 코드엔 스스로 닫는 데가 없음)의 원인을 가르려고 기기에 적어 둠:
// 1분마다(그리고 가려질 때·떠날 때) 살아 있던 때·배터리, 화면이 꺼지거나 가려진 때, 보이는 채로 화면 켜 두기가 풀린 때(기기가 거둬 감)·켜 두기를 못 잡은 까닭
// 다음에 켤 때 새로고침(새벽 4시·새 판 — 같은 화면이 이어짐)이 아니면 앱이 닫혔다 다시 열린 것 → 한 줄로 남겨(최근 5개) 설정 아래 판 번호 밑에 보여 줌
// 기록은 가장 나중에 켜진 화면만 씀(크롬 탭과 설치한 앱을 같이 열어 둬도 서로 덮지 않게). 폰 설정 화면(?remote)은 안 씀
const LIFE = 'mirror3_life', OFFS = 'mirror3_offs';
const life = { id: Date.now(), a: Date.now(), h: 0, w: 0, wf: '', b: -1, c: false, tab: matchMedia('(display-mode: browser)').matches };
let battery = null;
function lifeSave() {
  if (REMOTE) return;
  try {
    const cur = JSON.parse(localStorage.getItem(LIFE) || 'null');
    if (cur && cur.id > life.id) return;   // 뒤에 켜진 화면이 있으면 그쪽이 씀
    if (battery) { life.b = Math.round(battery.level * 100); life.c = battery.charging; }
    life.a = Date.now();
    localStorage.setItem(LIFE, JSON.stringify(life));
  } catch (e) {}
}
function lifeStart() {
  if (REMOTE) return;
  try {
    const prev = JSON.parse(localStorage.getItem(LIFE) || 'null'), nav = (performance.getEntriesByType('navigation')[0] || {}).type;
    if (prev && nav !== 'reload') {
      const offs = JSON.parse(localStorage.getItem(OFFS) || '[]');
      offs.unshift({ a: prev.a, h: prev.h, w: prev.w, wf: prev.wf, b: prev.b, c: prev.c, tab: prev.tab, on: life.id });
      localStorage.setItem(OFFS, JSON.stringify(offs.slice(0, 5)));
    }
  } catch (e) {}
  lifeSave();
  if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; lifeSave(); }).catch(() => {});
  setInterval(lifeSave, 60e3);
  document.addEventListener('visibilitychange', () => { life.h = document.visibilityState === 'hidden' ? Date.now() : 0; lifeSave(); });
  window.addEventListener('pagehide', lifeSave);
  renderLife();
}
// 설정 아래: 11/23 03:12쯤 닫힘 (화면 켜진 채로 · 배터리 80% 충전 중) → 07:40 다시 켬 — 최근 3개
function renderLife() {
  const el = $('set-life');
  let offs = [];
  try { offs = JSON.parse(localStorage.getItem(OFFS) || '[]'); } catch (e) {}
  el.hidden = REMOTE || (!offs.length && !life.wf);
  if (el.hidden) return;
  const hm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dt = ms => { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm(ms); };
  const day = ms => new Date(ms).toDateString();
  el.innerHTML = (life.wf ? `지금 화면 켜 두기를 못 잡음 (${life.wf})` : '') + (offs.length ? (life.wf ? '<br>' : '') + '닫힌 기록' : '') + offs.slice(0, 3).map(o =>
    '<br>' + dt(o.a) + (o.h ? ` 뒤 닫힘 (${hm(o.h)} 화면 꺼짐·가려짐` : '쯤 닫힘 (화면 켜진 채로') +
    (o.w ? ` · ${hm(o.w)} 켜 두기 풀림` : '') + (o.wf ? ` · 켜 두기 못 잡음 ${o.wf}` : '') +
    (o.b >= 0 ? ` · 배터리 ${o.b}%${o.c ? ' 충전 중' : ''}` : '') + (o.tab ? ' · 크롬 탭' : '') +
    `) → ${day(o.on) === day(o.a) ? hm(o.on) : dt(o.on)} 다시 켬`).join('');
}

// ===== 화면 유지 / 자동 새로고침 =====
// 보이는 채로 풀리면(기기가 거둬 감 — 배터리 절약 등) 기록하고 5초 뒤 다시 잡아 봄. 가려질 때 풀리는 건 원래 그래서 다시 보일 때 잡음
let wakeLock = null;
async function keepAwake() {
  if (!navigator.wakeLock || (wakeLock && !wakeLock.released) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    life.wf = '';
    wakeLock.addEventListener('release', () => {
      if (document.visibilityState !== 'visible') return;
      life.w = Date.now(); lifeSave(); setTimeout(keepAwake, 5e3);
    });
  } catch (e) { life.wf = e.name || 'error'; }
  lifeSave(); renderLife();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake();
});

function scheduleReload() {
  const now = new Date(), next = new Date(now);
  next.setHours(CONFIG.reloadHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  // 새벽 새로고침 뒤엔 인트로 없이 바로 (intro.js)
  setTimeout(() => {
    try { sessionStorage.setItem('quietStart', '1'); } catch (e) {}
    location.reload();
  }, next - now);
}

// ===== 새 배포 받기 =====
// 켤 때도 확인: 켤 때 인터넷이 0.8초 넘게 늦으면 서비스 워커가 저장해 둔 옛 화면을 먼저 띄워서, 앱을 껐다 켜도 옛 판이 남았음(10분 뒤에야 확인)
// 켜 둔 화면(미러·폴드처럼 계속 열어 두는 앱)은 새로고침 전까지 예전 코드라서, 10분마다 그리고 앱을 다시 볼 때(백그라운드에서 돌아올 때)
// 서버의 화면 파일에서 판 번호(main.js ?v=)를 보고 다르면 인트로 없이 새로고침. 설정을 여는 중·폰에서 미러 설정 중·스톱워치·타이머가 돌거나 알람이 울리는 중엔 미룸
// (?ver= 요청은 서비스 워커가 저장본을 주지 않고 그대로 인터넷으로 보냄 — sw.js)
const APP_V = (document.querySelector('script[src*="js/main.js"]').getAttribute('src').match(/v=([^&]+)/) || [])[1] || '';
let verAt = 0;
async function checkVersion() {
  if (REMOTE || Date.now() - verAt < 60e3 || !navigator.onLine) return;
  verAt = Date.now();
  try {
    // 대답 없이 매달리는 네트워크(2026-11-22 태블릿)에서 붙잡혀 있지 않게 15초에 끊음 — 다음 확인 때 다시
    const ctl = new AbortController(), stop = setTimeout(() => { ctl.abort(); verAt = 0; }, 15e3);
    const html = await (await fetch('/?ver=' + Date.now(), { cache: 'no-store', signal: ctl.signal })).text();
    clearTimeout(stop);
    const v = (html.match(/js\/main\.js\?v=([^"&]+)/) || [])[1];
    if (!v || v === APP_V) return;
    if (!$('settings').hidden || sw.run || tm.run || !$('ring').hidden) { verAt = 0; return; }   // 다음 확인 때 다시
    let tried = null;
    try { tried = sessionStorage.getItem('verTried'); } catch (e) {}
    if (tried === v) return;   // 이 판으로 한 번 새로고침했는데도 옛 판이면 되풀이하지 않음
    try { sessionStorage.setItem('verTried', v); sessionStorage.setItem('quietStart', '1'); } catch (e) {}
    // 받아 온 새 화면을 서비스 워커 저장본에도 넣어 둠 — 새로고침 때 인터넷이 늦어도(0.8초 넘게) 저장본이 새 판이라 새 판으로 뜸
    try {
      for (const k of await caches.keys()) if (k.startsWith('mirror-')) await (await caches.open(k)).put('/', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    } catch (e) {}
    location.reload();
  } catch (e) {}
}

// ===== 시작 =====
(function init() {
  lifeStart();   // 지난번 기록을 먼저 읽고 나서 이번 기록을 씀
  applyMode();
  applySettings();
  if (!MANUAL_LOC && savedLoc()) useLoc(savedLoc());
  // 마지막으로 받은 날씨·공기는 하루까지 보여 줌 (인터넷이 끊겨도 빈 화면 대신)
  const cw = load('weather', 24 * 3600e3);
  if (cw) { state.weather = cw.data; state.weatherAt = cw.at; state.weatherLoc = CONFIG.lat + ',' + CONFIG.lon; }   // 저장본은 위치마다 (weather.js cacheKey)
  const ca = load('air2', 24 * 3600e3);
  if (ca) state.air = ca.data;
  renderWeather();
  renderAir();
  renderMoon();
  renderFoot();
  tickClock();
  fitClock();
  // 숫자 글꼴이 오면 숫자 폭을 다시 재고 칸·크기를 다시 맞춤. 글꼴이 늦게 오면(첫 실행·느린 인터넷, 폴드8에서 봄) 대신 쓰던 글꼴 폭으로
  // 칸이 좁게 잡혀 숫자가 겹치거나 잘리고 줄이 넘어가서 — 다 받았을 때(ready)만이 아니라 Orbitron을 직접 받고, 글꼴이 하나라도 더 오면 또
  const refont = () => { measureDigits(); [setH1, setH2, setM1, setM2].forEach(set => set.refresh()); fitClock(); };
  document.fonts.ready.then(refont);
  document.fonts.load('900 100px Orbitron', '0123456789').then(refont).catch(() => {});
  document.fonts.addEventListener('loadingdone', refont);
  window.addEventListener('resize', fitClock);
  let reflow = 0;   // 크기가 바뀌면 그래프 칸 높이도 바뀌어서 다시 그림 (1°당 높이 상한)
  window.addEventListener('resize', () => { clearTimeout(reflow); reflow = setTimeout(renderWeather, 300); });
  portraitMQ.addEventListener('change', applySettings);   // 가로·세로 위젯 설정이 따로라 돌리면 다시 그림
  phoneMQ.addEventListener('change', applyMode);
  // 인터넷이 끊겼다 돌아오면 바로 새로 받음. 화면 파일·글꼴은 서비스 워커(sw.js)가 기기에 저장해 둬서 끊긴 채로 켜도 뜸
  window.addEventListener('offline', renderAlert);
  // 새 판도 그때 확인 — 와이파이를 끄고 켠 뒤 다시 켜면 그 자리에서 새 판으로 (전엔 끊긴 채 켜면 10분 뒤에야 확인했음)
  window.addEventListener('online', () => { renderAlert(); loadWeather(); loadAir(); loadBoard(); checkVersion(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(e => console.warn('서비스 워커 등록 실패', e));

  loadWeather();
  loadAir();
  loadBoard();
  locate();
  // 폰으로 설정을 연결했으면 10초마다 확인. 켠 뒤에 처음 연결해도 받도록 연결 전부터 돌림 (연결 전엔 syncPull이 바로 끝남)
  if (REMOTE) remoteStart();
  else { syncPull(); setInterval(syncPull, 10e3); }
  setInterval(loadWeather, CONFIG.weatherEvery);
  setInterval(loadAir, CONFIG.airEvery);
  keepAwake();
  scheduleReload();
  setTimeout(checkVersion, 1500);   // 켜자마자(옛 저장본으로 떴을 수 있음)
  setInterval(checkVersion, 10 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
  $('set-ver').textContent = APP_V ? 'v' + APP_V : '';   // 설정 아래: 지금 떠 있는 판 번호
})();
