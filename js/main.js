// Pebbly Mirror — 커서 숨김, 화면 켜 두기·자동 새로고침, 시작
// ===== 커서 =====
let idleTimer;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), CONFIG.cursorIdle);
});

// ===== 화면 유지 / 자동 새로고침 =====
async function keepAwake() {
  try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) {}
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
    const html = await (await fetch('/?ver=' + Date.now(), { cache: 'no-store' })).text();
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
  applyMode();
  applySettings();
  if (!MANUAL_LOC && savedLoc()) useLoc(savedLoc());
  // 마지막으로 받은 날씨·공기는 하루까지 보여 줌 (인터넷이 끊겨도 빈 화면 대신)
  const cw = load('weather', 24 * 3600e3);
  if (cw) { state.weather = cw.data; state.weatherAt = cw.at; }
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
  window.addEventListener('online', () => { renderAlert(); loadWeather(); loadAir(); loadBoard(); });
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
