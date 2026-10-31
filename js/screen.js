// Pebbly Mirror — 화면: 모드·설정 반영, 접었다 펴기, 공휴일, 위젯 넘기기, 터치
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

// ===== 접었다 펴기 (폴더블) =====
// 화면 넓이가 한 번에 1.4배 넘게 커지면(접힌 바깥 화면 → 펼친 안쪽 화면): 가운데 접히는 자리에 빛나는 세로선이 생겨
// 둘로 갈라져 양 끝으로 가고, 그 사이로 미러 화면이 번졌다 또렷해지며 펼쳐짐
// 반대로 작아지면(접어서 바깥 화면): 살짝 번진 채 조금 작게 있다가 또렷하게 자리 잡음
// 화면 돌리기는 넓이가 거의 같아서 안 함. 화면이 꺼져 있는 동안 바뀌었으면 다시 보일 때
let foldSize = innerWidth * innerHeight;
function foldCheck() {
  if (document.hidden) return;
  const size = innerWidth * innerHeight, k = size / foldSize;
  foldSize = size;
  if (calm.matches || (k < 1.4 && k > 1 / 1.4)) return;
  const st = $('stage'), cs = getComputedStyle(st);
  // 밤 '붉게'의 흑백·폰 번인 방지 이동은 그대로 두고 그 위에 번짐·크기만 더함
  const f = cs.filter === 'none' ? '' : cs.filter, t = cs.transform === 'none' ? '' : cs.transform;
  const ease = 'cubic-bezier(.3,.7,.1,1)';
  if (k >= 1.4) {
    const ms = 1000;
    st.animate([{ clipPath: 'inset(0 50%)', filter: `${f} blur(1.2rem)`, transform: `${t} scale(1.04)` },
      { clipPath: 'inset(0 0%)', filter: f || 'none', transform: t || 'none' }], { duration: ms, easing: ease });
    const seam = document.createElement('div');
    seam.className = 'seam';
    seam.innerHTML = '<i></i><i></i>';
    document.body.append(seam);
    [...seam.children].map((el, i) => el.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${i ? 50 : -50}vw)`, opacity: 0 }],
      { duration: ms, easing: ease }))[1].onfinish = () => seam.remove();
    setTimeout(() => seam.remove(), ms + 1000);   // 화면이 멈춰 끝 알림을 못 받아도
  } else {
    st.animate([{ filter: `${f} blur(1rem)`, transform: `${t} scale(.96)` }, { filter: f || 'none', transform: t || 'none' }], { duration: 700, easing: ease });
  }
  requestAnimationFrame(renderWeather);   // 그래프를 새 크기로 바로 (원래는 크기가 바뀌고 0.3초 뒤라 펼치는 중에 바뀜)
}
addEventListener('resize', foldCheck);
document.addEventListener('visibilitychange', foldCheck);

// ===== 아이폰 홈 화면 앱 =====
// 켤 때 아이폰(iOS 18에서 확인)이 '화면 끝까지 쓰기'(viewport-fit=cover)를 아직 안 쓴 채 화면 높이를 상태 표시줄(12 mini는 50pt)만큼
// 짧게 잡아 아래에 빈 띠가 생김. 화면을 돌리는 등 아이폰이 화면 크기를 다시 재면 바로잡히는데, 페이지가 화면보다 짧으면
// 고정 요소(무대)는 페이지 높이에 묶여 그대로 짧음 → 페이지 높이를 기기 화면 높이로 정해 둠 (base.css html.ios-app)
// 그리고 아직 짧으면 페이지를 1px 내렸다 올려 아이폰이 화면 크기를 다시 재게 함. 돌릴 땐 크기가 늦게 바뀌어서 조금 뒤에도 다시
// 화면 폭이 기기 화면 폭과 같을 때만 (아이패드 창 모드처럼 화면 일부만 쓰면 그대로)
if (navigator.standalone) {
  const root = document.documentElement, stage = $('stage');
  const events = [], log = t => events.push(`${t}@${(performance.now() / 1000).toFixed(1)}`);   // 임시 진단용
  const fitIos = () => {
    const land = innerWidth > innerHeight, long = Math.max(screen.width, screen.height), short = Math.min(screen.width, screen.height);
    const full = innerWidth === (land ? long : short), h = land ? short : long;
    root.classList.toggle('ios-app', full);
    root.style.setProperty('--app-h', h + 'px');
    if (full && innerHeight < h) { scrollTo(0, 1); requestAnimationFrame(() => scrollTo(0, 0)); log('nudge'); }
  };
  const refit = () => [0, 300, 1000, 2500].forEach(ms => setTimeout(fitIos, ms));
  refit();
  addEventListener('resize', refit);
  // 두 번 눌러 설정을 열 때 아이폰이 화면을 확대하지 않게 (페이지가 화면보다 길면 확대할 수 있는 페이지로 봄). 버튼·설정 안은 그대로
  let lastEnd = 0;
  document.addEventListener('touchend', e => {
    if (e.timeStamp - lastEnd < 400 && !e.target.closest('button, input, select, textarea, a, label, .set-card')) e.preventDefault();
    lastEnd = e.timeStamp;
  }, { passive: false });

  // 임시: 화면 크기 진단 (아이폰에서 원인을 찾으면 지움). 위 가운데에 켤 때·지금 크기 숫자, 아래 끝(기기 화면 기준 40px)에 색 막대 3개
  // 빨강 A: 문서 안(absolute) / 초록 B: 고정(fixed), 고정 영역 아래 끝 밖으로 / 파랑 C: 고정, 기기 화면 높이 기준
  // → 빈 띠 안에 어떤 색이 보이는지로 어느 방식이 띠까지 그려지는지 앎. 숫자 상자를 누르면 다 사라짐
  const add = css => { const e = document.createElement('div'); e.style.cssText = css; document.body.append(e); return e; };
  const probe = css => add('position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;' + css);
  const P = { vh: probe('height:100vh'), svh: probe('height:100svh'), lvh: probe('height:100lvh'), dvh: probe('height:100dvh'), fix: probe('bottom:0'),
    sT: probe('height:env(safe-area-inset-top, 0px)'), sR: probe('height:env(safe-area-inset-right, 0px)'),
    sB: probe('height:env(safe-area-inset-bottom, 0px)'), sL: probe('height:env(safe-area-inset-left, 0px)') };
  const bars = ['#e00', '#0b0', '#07f'].map((c, i) => add(`position:${i ? 'fixed' : 'absolute'};left:${6 + i * 31}%;width:26%;height:40px;background:${c};z-index:98;`
    + 'pointer-events:none;display:flex;align-items:center;justify-content:center;color:#fff;font:bold 14px sans-serif'));
  bars.forEach((b, i) => { b.textContent = 'ABC'[i]; });
  const diag = add('position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:99;padding:6px 9px;background:rgba(0,0,0,.85);color:#fff;'
    + 'font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre;border:1px solid #f80;border-radius:6px');
  const sz = (w, h) => Math.round(w) + 'x' + Math.round(h), oh = e => e.offsetHeight;
  const snap = () => ({
    inner: sz(innerWidth, innerHeight), outer: sz(outerWidth, outerHeight), screen: sz(screen.width, screen.height),
    visual: visualViewport ? sz(visualViewport.width, visualViewport.height) + '+' + Math.round(visualViewport.offsetTop) + ' x' + visualViewport.scale.toFixed(2) : '-',
    docEl: sz(root.clientWidth, root.clientHeight), 'vh s/l/d': [P.vh, P.svh, P.lvh, P.dvh].map(oh).join('/'), fixed: oh(P.fix),
    'safe TRBL': [P.sT, P.sR, P.sB, P.sL].map(oh).join('/'), 'html/body/stg': [root.offsetHeight, document.body.offsetHeight, stage.offsetHeight].join('/'),
    'ios-app': (root.classList.contains('ios-app') ? 'y ' : 'n ') + root.style.getPropertyValue('--app-h'),
  });
  const ios = (navigator.userAgent.match(/OS (\d+)_(\d+)(?:_(\d+))?/) || []).slice(1).filter(Boolean).join('.');
  let first = null, lastFix = 0;
  addEventListener('resize', () => log('rs' + innerWidth + 'x' + innerHeight));
  document.addEventListener('pointerdown', () => log('tap'));
  const show = () => {
    const now = snap(), land = innerWidth > innerHeight, H = land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    if (!first && performance.now() > 1000) first = now;
    if (now.fixed !== lastFix) { log('fix' + now.fixed); lastFix = now.fixed; }
    const ev = events.join(' ').match(/.{1,46}(\s|$)/g) || [];   // 사건 기록: 몇 초에 무엇 (줄바꿈)
    diag.textContent = `iOS ${ios}  (tap to close)\n${'item'.padEnd(14)}${'launch'.padEnd(17)}now\n`
      + Object.keys(now).map(k => k.padEnd(14) + String(first ? first[k] : '').padEnd(17) + now[k]).join('\n') + '\n' + ev.slice(-6).join('\n');
    bars[0].style.top = bars[2].style.top = H - 40 + 'px';
    bars[1].style.bottom = '-40px';
  };
  show();
  const timer = setInterval(show, 500);
  diag.addEventListener('pointerdown', e => {
    e.stopPropagation();
    clearInterval(timer);
    [diag, ...bars, ...Object.values(P)].forEach(el => el.remove());
  });
  diag.addEventListener('pointerup', e => e.stopPropagation());
}

// 설정 반영: 화면 종류(시계 강조/상세), 시계 형식, 위젯 넘김 주기
function applySettings() {
  document.body.classList.toggle('sb', S.focus);
  document.body.classList.toggle('half', S.half);
  document.body.classList.toggle('half-l', S.halfL);
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
// '대체공휴일(3ㆍ1절)' → '대체공휴일', '1월 1일' → '신정', '기독탄신일' → '성탄절' (목록을 못 받았을 때 이름과 같게)
const shortHoliday = n => ({ '1월 1일': '신정', '기독탄신일': '성탄절' })[n] || n.replace(/\(.*\)/, '').trim();

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
const WG_NAMES = { now: '지금 날씨', hourly: '시간별 예보', daily: '일별 예보', air: '공기·해·달', transit: '교통', photo: '사진 액자', cal: '달력' };
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
// dir: 1 다음 / -1 이전 (없으면 효과 없이 바꿈), axis: 'x' 가로·'y' 세로로 넘어감, from: 손으로 끌다 놓은 자리·속도에서 이어서
function showPanel(p, dir, axis, from) {
  pgStop();   // 넘어가던 중이면 끝 모습으로
  const list = panelList(), old = panelName;
  if (!list.length) {   // 위젯을 모두 끔: 시계만
    panel = 0; panelName = '';
    if (old === 'photo') phLeave();
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
  if (panelName === 'photo') { phShow(dir); if (old !== 'photo') phVisit = 1; }
  else if (old === 'photo') phLeave();   // 동영상 멈춤
  if (dir && S.focus && old !== panelName) page(panelEl(old), panelEl(panelName), dir, axis, from);
  schedulePanel();
}
function schedulePanel() {
  clearTimeout(panelTimer);
  if (S.rotate > 0) panelTimer = setTimeout(autoNext, S.rotate * 1000);
}
// 자동 넘김: 가로 화면은 위로(세로 점과 같은 방향), 세로 화면은 옆으로
// 사진 액자는 한 번 올 때 정한 장수(설정 > 사진)만큼 사진을 넘긴 뒤 다음 위젯으로, 다음 차례엔 이어서
// 동영상은 끝까지 본 뒤에 (phHold: 끝나면 autoNext(true))
function autoNext(held) {
  if (panelName === 'photo' && !held && phHold()) return;
  if (panelName === 'photo' && phMore()) { phShow(1); phVisit++; schedulePanel(); return; }
  showPanel(panel + 1, 1, innerWidth > innerHeight ? 'y' : 'x');
}

// 위젯 넘기기 (아이폰 위젯 묶음처럼): 지금 위젯이 민 쪽으로 나가며 조금 작아지고 흐려지며 번지고, 다음 위젯이 바로 뒤에 붙어 들어오며
// 처음엔 흐릿하게 번져 보이다가 다 들어오면 또렷하게 (흰 글자뿐인 화면이라 흐려지기만으론 잘 안 보여서 번짐도). 두 위젯 모두 위젯 칸(+ 2rem) 밖은 잘라서 시계·헤더 위로 넘어가지 않음
// 손으로 끄는 동안은 손가락을 따라오고(drag), 놓으면 그 속도 그대로 용수철처럼 마저 넘어가거나 제자리로. 자동 넘김도 같은 움직임
// (CSS의 숨김 상태 위에 잠깐 덮어씌우는 모양이라 끝나면 지워서 원래 상태로)
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let pg = null, pgRaf = 0;   // 넘어가는 중인 { out 나가는 위젯, inn 들어오는 위젯, dir, axis, span 한 칸 거리, m 잘라 내는 여유(2rem), x 나가는 위젯 이동(px) }
// 위젯 하나 놓기: t 이동(px), s 크기, o 불투명도, b 번짐(rem). 잘라 내는 테두리는 움직인(작아진) 만큼 거꾸로 옮겨 위젯 칸에 고정
function pgPut(el, t, s, o, b) {
  const { axis, m } = pg, w = el.offsetWidth, h = el.offsetHeight, [a, c] = axis === 'y' ? [h, w] : [w, h];
  const lo = a / 2 - (a / 2 + m + t) / s, hi = a / 2 - (a / 2 + m - t) / s, side = c / 2 - (c / 2 + m) / s;
  el.style.clipPath = axis === 'y' ? `inset(${lo}px ${side}px ${hi}px ${side}px)` : `inset(${side}px ${hi}px ${side}px ${lo}px)`;
  el.style.transform = `translate${axis === 'y' ? 'Y' : 'X'}(${t}px) scale(${s})`;
  el.style.opacity = o;
  el.style.filter = b > .05 ? `blur(${b * m / 2}px)` : '';
  el.style.visibility = 'visible';
}
function pgDraw() {
  const { out, inn, dir, span, x } = pg, p = Math.min(1, Math.abs(x) / span);
  pgPut(out, x, 1 - .08 * p, 1 - .8 * p, .6 * p);
  if (inn) pgPut(inn, x + dir * span, .92 + .08 * p, .15 + .85 * p, .6 * (1 - p));
}
const pgClear = el => { el.style.clipPath = el.style.transform = el.style.opacity = el.style.filter = el.style.visibility = ''; };
function pgStop() {
  cancelAnimationFrame(pgRaf);
  if (pg) { pgClear(pg.out); if (pg.inn) pgClear(pg.inn); pg = null; }
}
function pgStart(out, inn, dir, axis, x) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  pg = { out, inn, dir, axis, x, m: 2 * rem, span: (axis === 'y' ? out.offsetHeight : out.offsetWidth) + 6 * rem };
  pgDraw();
}
// 용수철(임계 감쇠: 튕기지 않고 멈춤)로 x를 to까지. v 시작 속도(px/ms), w 빠르기(클수록 빨리 멈춤)
function pgSpring(to, v, w, done) {
  cancelAnimationFrame(pgRaf);
  const t0 = performance.now(), A = pg.x - to;
  if (v * A < 0 && Math.abs(v) > w * Math.abs(A)) v = -w * A;   // 너무 세게 던져도 지나쳤다 돌아오지 않게
  const B = v + w * A;
  const step = now => {
    if (!pg) return;
    const t = Math.max(0, now - t0), e = Math.exp(-w * t);
    pg.x = to + (A + B * t) * e;
    if (Math.abs(pg.x - to) < 1 && Math.abs((B - w * (A + B * t)) * e) < .02) { pg.x = to; pgDraw(); done(); return; }
    pgDraw();
    pgRaf = requestAnimationFrame(step);
  };
  pgRaf = requestAnimationFrame(step);
}
// 이미 바뀐 위젯(showPanel)으로 넘어가는 모습: 처음부터(자동·버튼) 또는 손으로 끌다 놓은 자리에서(from)
function page(outEl, inEl, dir, axis = 'x', from) {
  if (calm.matches || !outEl || !inEl) return;
  pgStart(outEl, inEl, dir, axis, from ? from.x : 0);
  pgSpring(-dir * pg.span, from ? from.v : 0, from ? .012 : .009, pgStop);
}

// 손으로 끌기: 위젯 쪽을 누른 채 움직이면 지금 위젯이 손가락을 따라오고, 그 방향 다음(이전) 위젯이 뒤따라 흐릿하게 보임
// 놓을 때 화면의 8% 넘게 끌었거나 그쪽으로 튕기듯 놓으면 넘어가고, 아니면 제자리로. 위젯이 하나뿐이면 조금만 끌려 왔다 돌아감
let drag = null;   // { axis, pts: 최근 [시각, 끈 거리] }
function dragMove(d) {
  const list = panelList(), n = list.length, out = panelEl(panelName);
  if (!n || !out) return;
  const dir = d < 0 ? 1 : -1, inn = n > 1 ? panelEl(list[((panel + dir) % n + n) % n]) : null;
  if (pg && (pg.out !== out || pg.inn !== inn)) pgStop();   // 끄는 방향이 바뀌면 반대쪽 위젯으로
  if (!pg) pgStart(out, inn, dir, drag.axis, 0);
  pg.x = inn ? d : d * .25;
  cancelAnimationFrame(pgRaf);
  pgRaf = requestAnimationFrame(pgDraw);
}
function dragEnd(d, t) {
  const { pts } = drag;
  drag = null;
  pts.push([t, d]);
  const last = pts[pts.length - 1], first = pts.find(q => last[0] - q[0] <= 100) || last;   // 놓기 직전 0.1초 속도
  const v = last[0] > first[0] ? (last[1] - first[1]) / (last[0] - first[0]) : 0;
  if (!pg) { schedulePanel(); return; }
  pg.x = pg.inn ? d : d * .25;
  const far = Math.abs(d) >= Math.min(innerWidth, innerHeight) * .08;
  if (pg.inn && (Math.abs(v) > .3 ? v * d > 0 : far)) { showPanel(panel + pg.dir, pg.dir, pg.axis, { x: pg.x, v }); return; }
  dragBack(pg.inn ? v : v * .25);
}
// 제자리로: 놓은 속도로 돌아가고, 자동 넘김은 처음부터
function dragBack(v) {
  pgSpring(0, v, .012, () => { pgStop(); schedulePanel(); });
}

// 시계 쪽(스톱워치·타이머·알람) 미끄러지기: 나가는 쪽은 민 방향으로 빠지며 사라지고, 들어오는 쪽은 반대편에서 들어옴
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
// 밀기: 왼쪽·위로 밀면 다음, 오른쪽·아래로 밀면 이전 (위젯 쪽은 손가락을 따라 끌림, 위 dragMove)
//   시계 쪽에서 밀면 시계 → 스톱워치 → 타이머 → 알람 (시계 강조 화면), 나머지는 날씨 위젯 (사진 액자에서 좌우로 밀면 사진)
// 두 번 탭(더블클릭): 설정 열기. 버튼을 누를 때는 둘 다 안 함
let touchStart = null, lastTap = 0;
document.addEventListener('pointerdown', e => {
  if (e.target.closest('button') || !$('ring').hidden) { touchStart = null; return; }
  const r = $('clock').getBoundingClientRect();
  const inClock = S.focus && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  touchStart = { x: e.clientX, y: e.clientY, clock: inClock, id: e.pointerId };
});
// 위젯 쪽을 누른 채 12px 넘게 움직이면 끌기 시작 (그 전엔 탭으로 봄). 사진 액자 좌우는 사진 넘기기라 끌지 않음
document.addEventListener('pointermove', e => {
  const s = touchStart;
  if (!s || s.clock || e.pointerId !== s.id || !S.focus || !panelName || !$('settings').hidden) return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (!drag) {
    if (Math.hypot(dx, dy) < 12) return;
    const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (panelName === 'photo' && axis === 'x' && photos.length > 1) return;
    pgStop();   // 넘어가던 중이면 끝 모습에서 잡음
    clearTimeout(panelTimer);   // 끄는 동안 자동 넘김 멈춤
    phWaitOff();
    drag = { axis, pts: [] };
  }
  const d = drag.axis === 'x' ? dx : dy;
  drag.pts.push([e.timeStamp, d]);
  if (drag.pts.length > 8) drag.pts.shift();
  dragMove(d);
});
document.addEventListener('pointercancel', () => {
  touchStart = null;
  if (!drag) return;
  drag = null;
  if (pg) dragBack(0); else schedulePanel();
});
document.addEventListener('pointerup', e => {
  const s = touchStart;
  touchStart = null;
  if (drag) { dragEnd(drag.axis === 'x' ? e.clientX - s.x : e.clientY - s.y, e.timeStamp); lastTap = 0; return; }
  if (!s || !$('settings').hidden) return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (Math.hypot(dx, dy) >= Math.min(innerWidth, innerHeight) * .08) {
    const dir = (Math.abs(dx) > Math.abs(dy) ? dx : dy) < 0 ? 1 : -1;
    const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (s.clock) showCm(cm + dir, dir, axis);
    else if (panelName === 'photo' && axis === 'x' && photos.length > 1) phSwipe(dir);   // 사진 액자: 좌우는 사진, 위아래는 위젯
    else showPanel(panel + dir, dir, axis);
    lastTap = 0;
  } else if (e.timeStamp - lastTap < 400) {
    openSettings();
    lastTap = 0;
  } else {
    lastTap = e.timeStamp;
  }
});
