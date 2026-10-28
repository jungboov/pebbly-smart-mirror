// Pebbly Mirror — 화면: 모드·설정 반영, 공휴일, 위젯 넘기기, 터치
// ===== 화면 모드 =====
// 폰 크기 화면은 시계 강조 화면에 밤 붉은 화면·번인 방지가 더해짐
const phoneMQ = matchMedia('(max-width: 540px), (max-height: 540px)');
function applyMode() {
  document.body.classList.toggle('phone', phoneMQ.matches);
  fitClock();
}
// OLED 번인 방지: 1분마다 화면 전체를 몇 px씩 옮김 (폰 시계 강조 화면에서만 CSS가 적용, tickClock이 부름)
const SHIFT = [[0, 0], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0], [-3, -3], [0, -3], [3, -3]];
function shiftPixels(m) {
  const [x, y] = SHIFT[m % SHIFT.length];
  $('stage').style.setProperty('--sx', x + 'px');
  $('stage').style.setProperty('--sy', y + 'px');
}

// 설정 반영: 화면 종류(시계 강조/상세), 시계 형식, 위젯 넘김 주기
function applySettings() {
  document.body.classList.toggle('sb', S.focus);
  document.body.classList.toggle('half', S.half);
  document.body.classList.toggle('no-sec', !S.secs);
  document.body.classList.toggle('no-date', !S.date);
  renderAlert();
  document.body.classList.toggle('has-tr', S.transit.length > 0);
  trRenderList();
  phApply();
  wgRender();
  const shown = panelList();
  PANELS.forEach((el, i) => el.classList.toggle('wg-off', S.focus && !shown.includes(PANEL_NAMES[i])));
  document.body.classList.toggle('no-panel', S.focus && !shown.length);
  renderBoard();
  setupH1();
  renderClock(new Date());
  renderWeather();   // 시간별 칸 수가 달라짐 (시계 강조 6 / 상세 12)
  fitClock();
  showPanel(panel);   // 바뀐 주기로 다시 시작
  showCm(S.focus ? cm : 0);   // 스톱워치·타이머·알람은 시계 강조 화면에서만
  document.querySelectorAll('[data-chip]').forEach(b => b.classList.toggle('on', !!S[b.dataset.chip]));
  // 상세 주소: 켜면 주소를 아직 모를 때 위치 확인, 끄면 저장해 둔 주소·정밀 좌표를 지움 (폰에서 미러 설정 중엔 폰 위치는 안 건드림)
  const sl = REMOTE ? null : savedLoc();
  if (!REMOTE && S.addr && !(sl && sl.addr)) locate();
  else if (sl && !S.addr && sl.addr) { delete sl.addr; delete sl.exact; try { localStorage.setItem(LOC_KEY, JSON.stringify(sl)); } catch (e) {} }
  renderFoot();
  document.querySelectorAll('.seg[data-key]').forEach(seg => {
    const k = seg.dataset.key, v = k === 'night' ? nightStyle() : String(+S[k]);
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  });
  $('set-rotate').textContent = S.rotate ? S.rotate + '초' : '끔';
  $('set-ns').textContent = hourName(S.nightStart);
  $('set-ne').textContent = hourName(S.nightEnd);
  document.querySelectorAll('.nt-row').forEach(r => { r.style.display = nightStyle() === 'off' ? 'none' : ''; });
}

// ===== 공휴일 =====
// 대체공휴일·선거일까지 들어 있는 공공데이터포털 기반 연도별 목록(holidays-kr). 못 받으면 양력 고정 공휴일만
const HOLIDAY_URL = y => `https://cdn.jsdelivr.net/gh/hyunbinseo/holidays-kr@main/public/${y}.json`;
const FIXED_HOLIDAYS = { '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일',
  '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절' };
const holidays = {}, holidayYears = new Set();
// '대체공휴일(3ㆍ1절)' → '대체공휴일', '1월 1일' → '신정'
const shortHoliday = n => n === '1월 1일' ? '신정' : n.replace(/\(.*\)/, '').trim();

function holidayName(iso) {
  const y = iso.slice(0, 4);
  if (!holidayYears.has(y)) { holidayYears.add(y); loadHolidays(y); }
  return holidays[iso] || FIXED_HOLIDAYS[iso.slice(5)] || '';
}

async function loadHolidays(y) {
  const key = 'mirror_holi_' + y;
  let data = null;
  try {
    const c = JSON.parse(localStorage.getItem(key));
    if (c && Date.now() - c.at < 30 * 864e5) data = c.data;
  } catch (e) {}
  if (!data) {
    try { data = await getJSON(HOLIDAY_URL(y)); }
    catch (e) { console.warn('공휴일 목록 확인 실패', e); return; }
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch (e) {}
  }
  for (const [iso, names] of Object.entries(data)) holidays[iso] = shortHoliday(names[0]);
  delete $('date').dataset.iso;   // 날짜 다시 그림
  renderDate(new Date());
}

// ===== 날씨 위젯 넘기기 =====
// 시계 강조: 켠 위젯을 설정 순서대로 (교통은 정류장을 등록해야, 사진 액자는 사진을 올려야 나옴) / 상세 세로: 시간별 ↔ 일별
// S.rotate초마다 자동(0이면 자동 넘김 끔), 화면을 밀면 바로 넘김. 사진 액자는 넘어올 때마다 다음 사진
let panel = 0, panelName = 'now', panelTimer;
const WG_NAMES = { now: '지금 날씨', hourly: '시간별 예보', daily: '일별 예보', air: '공기·해·달', transit: '교통', photo: '사진 액자' };
// o: 'L' 가로·'P' 세로 (없으면 지금 화면 방향)
const portraitMQ = matchMedia('(orientation: portrait)');
const wgNow = () => REMOTE && remoteOrient ? remoteOrient : portraitMQ.matches ? 'P' : 'L';
const wgCfg = (o = wgNow()) => S[o === 'P' ? 'wgP' : 'wgL'];
const wgOrder = o => [...new Set([...(wgCfg(o).order || []).filter(n => PANEL_NAMES.includes(n)), ...PANEL_NAMES])];   // 새 위젯은 뒤에
const wgReady = n => n === 'transit' ? S.transit.length > 0 : n === 'photo' ? photos.length > 0 : true;
function panelList(o) {
  if (!S.focus) return PANEL_NAMES.slice(0, 4);
  const h = new Date().getHours();
  return wgOrder(o).filter(n => wgReady(n) && !wgCfg(o).off.includes(n) && (!S.wgTime[n] || inHours(S.wgTime[n], h)));   // 다 끄면 빈 목록 = 시계만
}
// dir: 1 다음 / -1 이전 (없으면 효과 없이 바꿈), axis: 'x' 가로·'y' 세로로 미끄러짐
function showPanel(p, dir, axis) {
  const list = panelList(), old = panelName;
  if (!list.length) {   // 위젯을 모두 끔: 시계만
    panel = 0; panelName = '';
    document.body.dataset.panel = '';
    $('sb-dots').innerHTML = '';
    clearTimeout(panelTimer);
    return;
  }
  panel = (p + list.length) % list.length;
  panelName = list[panel];
  document.body.dataset.panel = panelName;
  document.body.classList.toggle('alt', panel % 2 === 1);
  $('sb-dots').innerHTML = list.map((_, i) => `<i${i === panel ? ' class="on"' : ''}></i>`).join('');
  if (panelName === 'transit') { renderBoard(); if (Date.now() - boardAt > 30e3) loadBoard(); }
  if (panelName === 'photo') phShow(dir);
  if (dir && S.focus && old !== panelName) slide(panelEl(old), panelEl(panelName), dir, axis);
  schedulePanel();
}
// 자동 넘김: 가로 화면은 위로(세로 점과 같은 방향), 세로 화면은 옆으로
function schedulePanel() {
  clearTimeout(panelTimer);
  if (S.rotate > 0) {
    panelTimer = setTimeout(() => showPanel(panel + 1, 1, innerWidth > innerHeight ? 'y' : 'x'), S.rotate * 1000);
  }
}

// 미끄러지기: 나가는 쪽은 민 방향으로 빠지며 사라지고, 들어오는 쪽은 반대편에서 들어옴
// (CSS의 숨김 상태 위에 잠깐 덮어씌우는 애니메이션이라 끝나면 원래 상태로 돌아감)
const calm = matchMedia('(prefers-reduced-motion: reduce)');
function slide(outEl, inEl, dir, axis = 'x') {
  if (calm.matches || !outEl || !inEl) return;
  const t = v => `translate${axis === 'y' ? 'Y' : 'X'}(${v}rem)`;
  const ease = 'cubic-bezier(.2,.75,.2,1)';
  outEl.animate([{ opacity: 1, visibility: 'visible', transform: t(0) }, { opacity: 0, visibility: 'visible', transform: t(-dir * 10) }],
    { duration: 380, easing: ease });
  inEl.animate([{ opacity: 0, transform: t(dir * 12) }, { opacity: 1, transform: t(0) }],
    { duration: 520, easing: ease });
}

// ===== 터치 =====
// 밀기: 왼쪽·위로 밀면 다음, 오른쪽·아래로 밀면 이전
//   시계 쪽에서 밀면 시계 → 스톱워치 → 타이머 → 알람 (시계 강조 화면), 나머지는 날씨 위젯
// 두 번 탭(더블클릭): 설정 열기. 버튼을 누를 때는 둘 다 안 함
let touchStart = null, lastTap = 0;
document.addEventListener('pointerdown', e => {
  if (e.target.closest('button') || !$('ring').hidden) { touchStart = null; return; }
  const r = $('clock').getBoundingClientRect();
  const inClock = S.focus && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  touchStart = { x: e.clientX, y: e.clientY, clock: inClock };
});
document.addEventListener('pointerup', e => {
  const s = touchStart;
  touchStart = null;
  if (!s || !$('settings').hidden) return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (Math.hypot(dx, dy) >= Math.min(innerWidth, innerHeight) * .08) {
    const dir = (Math.abs(dx) > Math.abs(dy) ? dx : dy) < 0 ? 1 : -1;
    const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (s.clock) showCm(cm + dir, dir, axis);
    else showPanel(panel + dir, dir, axis);
    lastTap = 0;
  } else if (e.timeStamp - lastTap < 400) {
    openSettings();
    lastTap = 0;
  } else {
    lastTap = e.timeStamp;
  }
});
