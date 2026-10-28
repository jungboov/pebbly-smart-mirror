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
  setTimeout(() => location.reload(), next - now);
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
  nextPhrase(true);
  fitClock();
  document.fonts.ready.then(() => {
    measureDigits();
    [setH1, setH2, setM1, setM2].forEach(set => set.refresh());
    fitClock();
  });
  window.addEventListener('resize', fitClock);
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
  if (REMOTE) remoteStart();
  else if (sync) { syncPull(); setInterval(syncPull, 60e3); }   // 폰으로 설정을 한 번 연결했으면 1분마다 확인
  setInterval(loadWeather, CONFIG.weatherEvery);
  setInterval(loadAir, CONFIG.airEvery);
  setInterval(nextPhrase, CONFIG.phraseEvery);
  keepAwake();
  scheduleReload();
})();
