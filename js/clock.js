// Pebbly Mirror — 시계: 숫자 롤러, 시·분·초·날짜 그리기, 크기 맞추기, 밤
// ===== 숫자 롤러 =====
// 띠 구성: [마지막값, ...values, 첫값, 둘째값] — 위아래로 이웃 숫자가 보이고,
// 마지막값→첫값(59→00 등)도 거꾸로 감기지 않고 한 칸 위로 굴러가도록 앞뒤에 여분을 둠
// fitWidth: 칸 폭을 현재 숫자 폭에 맞춤 (시/분 숫자용)
function roller(el, values, fitWidth) {
  const n = values.length;
  const strip = document.createElement('span');
  strip.className = 'strip';
  strip.innerHTML = [values[n - 1], ...values, values[0], values[1 % n]].map(v => `<span>${v}</span>`).join('');
  el.appendChild(strip);
  let idx = -1;
  const setWidth = () => {
    if (fitWidth && digitW && idx >= 0) el.style.width = digitW[values[idx]] + 'em';
  };
  const set = v => {
    const next = values.indexOf(v);
    if (next === idx) return;
    const wrap = idx === n - 1 && next === 0;
    const step = idx >= 0 && (next === idx + 1 || wrap);
    strip.style.transition = step ? '' : 'none';
    strip.style.setProperty('--p', wrap ? n + 1 : next + 1);
    if (wrap) {
      strip.addEventListener('transitionend', () => {
        strip.style.transition = 'none';
        strip.style.setProperty('--p', 1);
      }, { once: true });
    }
    idx = next;
    setWidth();
  };
  set.refresh = setWidth;
  return set;
}

// 숫자별 글자 폭(em). 너무 좁으면 굴러갈 때 이웃 숫자가 많이 잘려서 최소 .62em
let digitW = null;
function measureDigits() {
  const c = document.createElement('canvas').getContext('2d');
  c.font = '900 100px Orbitron';
  digitW = {};
  for (let i = 0; i < 10; i++) digitW[i] = Math.max(c.measureText(String(i)).width / 100, .62);
}

// 시 첫 자리: 24시간제 0~2, 12시간제 0~1 (1~9시는 앞에 0을 붙여 두 자리. 형식을 바꾸면 다시 만듦)
let setH1;
function setupH1() {
  $('h1').textContent = '';
  setH1 = roller($('h1'), range(S.hour12 ? 2 : 3), true);
}
setupH1();
const setH2 = roller($('h2'), range(10), true);
const setM1 = roller($('m1'), range(6), true);
const setM2 = roller($('m2'), range(10), true);
const setS = roller($('s'), range(60, pad));

// 날씨 위젯 4개 + 교통·사진 액자·달력 위젯 (시계 강조 화면에서 같은 자리에 겹쳐 돌아감)
const PANEL_NAMES = ['now', 'hourly', 'daily', 'air', 'transit', 'photo', 'cal'];
const PANELS = ['.wmain', '#hourly', '#wave', '.cards', '#transit', '#photo', '#cal'].map(s => document.querySelector(s));
const panelEl = name => PANELS[PANEL_NAMES.indexOf(name)];

// 시계 글자 크기 계산 (폰트 로드·화면 회전·날씨 표시 때마다 다시 맞춤)
// 가장 넓은 시각(예: 00:00) 기준이라 분마다 크기가 바뀌지 않음
function fitClock() {
  const inner = $('clock-in');
  const fs = parseFloat(getComputedStyle(inner).fontSize);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const wmax = digitW ? Math.max(...Object.values(digitW)) : .834;
  let size, cmSize = 0;
  $('stage').style.paddingTop = '';
  fitAlert();   // 화면 폭이 바뀌었으면 알림 띠가 흐를지 다시 정함
  if (document.body.classList.contains('sb')) {
    // 시계 강조: 시 / 분 / 초 3줄. 칸 폭(라벨 + 두 자리)과 남는 높이 중 작은 쪽에 맞춤
    // 높이(em) = 시 .82 + 분 .82 + 초 .41 + 줄 간격 .04×2 + 초 위 여백 .12, 초를 끄면 시 .82 + 분 .82 + 줄 간격 .04
    const stage = $('stage'), st = getComputedStyle(stage);
    // 날짜는 보통 시계 옆에 눕혀 있어서 높이는 안 씀
    // 위젯을 모두 끄면(solo) 시계만: 세로는 날짜를 시계 아래 가로 줄로(그만큼 넓게), 가로는 초를 분 옆에(시·분 2줄 높이)
    const portrait = innerHeight > innerWidth, solo = document.body.classList.contains('no-panel');
    const secBeside = !portrait && solo && S.secs;
    // 헤더(로고 · 알림 띠 · 위치)는 위 여백에 떠 있음 → 시계·위젯을 헤더 아래로 내림 (높이는 띠 유무·글자 크기 설정 따라 달라서 직접 잼)
    // 가로는 시 숫자 윗끝이 위 여백 쪽으로 조금 올라와서(.1em 뺌) 더 띄움
    const hd = document.querySelector('.head');
    if (hd.offsetHeight) stage.style.paddingTop = hd.offsetTop + hd.offsetHeight + (portrait ? 1.6 : 2.6) * rem + 'px';
    const ds = document.querySelector('.ds');
    ds.style.zoom = '';
    // 폭: 세로는 전체 폭, 가로는 위젯 자리(최소 50rem + 여백 4rem)를 남긴 폭, 가로 반반이면 왼쪽 절반(시계만이면 전체). 여기서 라벨과 날짜 칸을 뺌
    const sw = stage.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight), cg = parseFloat(st.columnGap);
    const w = portrait ? $('clock').clientWidth : solo ? sw : S.halfL ? (sw - cg) / 2 : sw - cg - 54 * rem;
    // 칸 사이(2rem)·눕힌 라벨(2.6rem)은 CSS 값 그대로 (세로 반반 한 줄 배치에선 라벨을 숨기고 칸 사이를 0으로 해서 재지 않음)
    const gap = 2 * rem, lbl = 2.6 * rem + gap;
    // 눕힌 날짜 두께 (한 줄 배치에선 날짜가 가로라 첫 줄 높이)
    const dsThick = getComputedStyle(ds).writingMode === 'horizontal-tb' ? $('ds-date').offsetHeight : ds.offsetWidth;
    const secEm = secBeside ? $('sgroup').offsetWidth / fs + gap / fs : 0;   // 분 옆 초 칸 + 간격 (지금 글자 크기 기준)
    const span = 2 * wmax + .02 + secEm;
    const rows = S.secs && !secBeside ? 2.25 : 1.68;
    // 가로: 시 숫자 위 여유(.1em)는 위로 빼서(CSS) 숫자 윗끝·초 아랫끝을 위젯 칸 위·아래 끝에 맞춤. 폭이 모자라면 가운데
    const top = portrait ? 0 : .1;
    // row: 날짜가 시계 위(가로)·아래(세로 시계만) 따로 줄이면 날짜와 시계 사이 줄 간격(.04em)이 들고, 시 숫자 위 여유는 안 뺌
    const fit = (sideW, hh, row) => Math.min((w - lbl - sideW) / span, hh / (rows + (row ? .04 : -top)));
    let h = stage.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom);
    const pb = parseFloat(getComputedStyle($('clock')).paddingBottom);
    if (portrait && !solo) h = S.half ? h / 2 : h - Math.max(...PANELS.map(el => el.offsetHeight)) - 4 * rem;   // 아래 위젯 자리 (반반: 위 절반)
    // 가로·세로 시계 크게: 날짜를 옆(세로)과 위(가로 줄) 중 시계가 더 커지는 쪽으로 — 시계 칸이 폭에 막히면(가로 반반, 폰 세로 등) 위로 올려
    // 가로는 위젯 칸 위·아래 끝까지, 세로는 시계 아래 빈 곳만큼 시계를 키움. 높이에 막히는 낮고 긴 화면은 옆
    // 날짜 줄 두께는 놓인 방향과 상관없이 같음 (눕힌 날짜는 폭, 가로 줄은 높이)
    let dateRow = S.date && portrait && solo;
    if (S.date && !solo && !(portrait && S.half)) {
      const t = getComputedStyle(ds).writingMode === 'horizontal-tb' ? ds.offsetHeight : ds.offsetWidth;
      dateRow = fit(0, h - pb - t - 3 * rem, true) > fit(t + gap + 3 * rem, h - pb);
    }
    const dsTop = dateRow && !solo;   // 시계만(세로)은 날짜가 아래 줄 (CSS no-panel)
    const moved = document.body.classList.contains('ds-top') !== dsTop;
    document.body.classList.toggle('ds-top', dsTop);
    if (dateRow) h -= ds.offsetHeight + 3 * rem;   // 날짜 줄(시계와 사이 3rem)
    h -= pb;
    const side = dateRow || !S.date ? 0 : (portrait ? dsThick : ds.offsetWidth) + gap + 3 * rem;
    size = fit(side, h, dateRow);
    // 세로 반반: 시:분 한 줄(폭에 맞춤)이 세 줄 크기의 80% 이상이면 한 줄로 — 위아래로 늘려(--sy) 위 절반을 채우고 아래 줄에 날짜·초
    // (폭이 좁은 폰은 한 줄이면 많이 작아져서 세 줄 그대로). .33em = 가운데 콜론 + 양옆 여백
    const lineSize = w * .99 / (4 * wmax + .33);
    const oneLine = portrait && S.half && !solo && lineSize >= .8 * size;
    if (document.body.classList.contains('oneline') !== oneLine) {
      document.body.classList.toggle('oneline', oneLine);
      return fitClock();   // 바뀐 배치로 날짜 높이 등을 다시 재서 맞춤 (그다음엔 안 바뀌어서 한 번뿐)
    }
    let sy = 1;
    if (oneLine) {
      size = lineSize;
      // 날짜가 초 옆 자리보다 길면 줄임 (첫 줄 날짜, 둘째 줄 요일·공휴일·오전/오후)
      const secW = S.secs ? size * wmax : 0;   // 초 두 자리 (.5em × 2)
      const line2 = [...ds.children].slice(1).filter(c => c.offsetWidth).reduce((s, c) => s + c.offsetWidth + 2 * rem, -2 * rem);
      const dz = Math.min(1, (w - secW - 3 * rem) / Math.max($('ds-date').offsetWidth, line2));
      if (dz < .99) ds.style.zoom = dz;
      const dsH = S.date ? ds.getBoundingClientRect().height + 3 * rem : 0;
      // 시:분(.82em × sy) + 아래 줄(날짜, 또는 같이 늘어나는 초 .41em + 위 여백 .15em) ≤ 위 절반
      sy = (h - dsH) / (.82 * size);
      if (S.secs) sy = Math.min(sy, h / (1.38 * size));
      sy = Math.max(1, Math.min(2.4, sy));
    }
    inner.style.setProperty('--sy', sy.toFixed(3));
    // 가로: 날짜가 옆인데 폭에 막혀 시계가 칸보다 낮으면, 남는 높이를 시·분·초 줄 사이에 나눠 위·아래 끝을 위젯 칸에 맞춤
    // (날짜가 위면 남는 높이는 CSS의 날짜 아래 1fr 줄이 받음. 글자는 size의 .99)
    const spare = !portrait && !solo && !dateRow ? h - .99 * size * (rows - top) : 0;
    inner.style.rowGap = spare > 2 ? `calc(.04em + ${spare / (S.secs ? 2 : 1)}px)` : '';
    // 스톱워치·타이머·알람은 아래 버튼 자리가 있어야 해서 초를 꺼도 3줄 기준 크기 (오른쪽 +·− 버튼 자리도 남김)
    const cmSide = side || 9.4 * rem + gap;
    cmSize = Math.min((w - lbl - cmSide) / (2 * wmax + .02), h / 2.25);
    if (oneLine) {
      // 한 줄 배치: 스톱워치·타이머·알람도 시계와 같은 크기 한 줄, 위아래 배율은 화면마다 (아래 줄 높이가 달라서)
      // 숫자(.82em × 배율) + (+·− 버튼 줄) + 이름·버튼 줄, 스톱워치는 1/100초(.41em × 배율)도 아래 줄에
      cmSize = size;
      for (const el of document.querySelectorAll('.cm')) {
        const pm = el.querySelector('.cm-pm'), foot = el.querySelector('.cm-foot'), d3 = el.querySelector('.cm-d3');
        const above = (pm ? pm.offsetHeight : 0) + 4 * rem;   // 줄 사이 2rem × 2 (버튼 줄이 없어도 빈 줄 사이가 있음)
        let k = (h - above - foot.offsetHeight) / (.82 * size);
        if (d3) k = Math.min(k, (h - above) / (1.23 * size));
        el.style.setProperty('--sy', Math.max(1, Math.min(2.4, k)).toFixed(3));
      }
    }
    // 날짜가 시계보다 길면 날짜를 줄임 (눕힌 날짜는 시계 높이, 가로 날짜 줄은 시계 폭에 맞춤. 한 줄 배치는 위에서)
    const items = [...ds.children].filter(c => c.offsetHeight);
    const dateLen = items.reduce((s, c) => s + (dateRow ? c.offsetWidth : c.offsetHeight), 0) + parseFloat(getComputedStyle(ds).rowGap || 0) * (items.length - 1);
    const z = dateLen ? Math.min(1, (dateRow ? lbl + span * size : size * (rows - top)) / dateLen) : 1;
    if (!oneLine) ds.style.zoom = z < .99 ? z : '';
    // 가로: 시계 칸 폭을 가장 넓은 시각 기준으로 고정 → 분이 바뀌어 숫자 폭이 달라도 날짜·위젯이 안 움직임
    $('clock').style.width = portrait ? '' : (lbl + span * size * .99 + side) + 'px';
    if (moved) return fitClock();   // 날짜 자리를 옮겼으면 옮긴 모양으로 한 번 더 맞춤 (그다음엔 안 옮겨서 한 번뿐)
  } else {
    $('clock').style.width = '';
    const widestEm = 4 * wmax + ($('colon').getBoundingClientRect().width + $('sgroup').getBoundingClientRect().width) / fs + .1;
    size = $('clock').clientWidth / widestEm;
  }
  // 시계 칸(섹션)에 걸어서 스톱워치·타이머·알람 화면도 같은 크기를 씀
  // 크기가 바뀔 땐(화면 돌리기·접었다 펴기) 숫자 칸 폭이 천천히 늘고 줄지 않게 — 옛 크기 폭에서 출발하면 시 두 자리가 잠깐 두 줄로 꺾임
  const cv = (size / rem * .99) + 'rem', ck = $('clock');
  if (ck.style.getPropertyValue('--clock') !== cv) {
    ck.classList.add('snap');
    requestAnimationFrame(() => requestAnimationFrame(() => ck.classList.remove('snap')));
  }
  $('clock').style.setProperty('--clock', cv);
  if (cmSize) $('clock').style.setProperty('--cm', (cmSize / rem * .99) + 'rem');
  else $('clock').style.removeProperty('--cm');
  $('clock').style.setProperty('--dw', wmax + 'em');
}

// ===== 시계 =====
// [시작시, 끝시) 안인지. 끝이 시작보다 작으면 자정을 넘김 (23~6시)
const inHours = ([s, e], h) => s > e ? (h >= s || h < e) : (h >= s && h < e);
const hourName = h => S.hour12 ? `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시` : h + '시';
const nightStyle = () => S.night || (phoneMQ.matches ? 'red' : 'dim');
function isNight(h) {
  return nightStyle() !== 'off' && inHours([S.nightStart, S.nightEnd], h);
}

function renderClock(d) {
  const h = d.getHours();
  const hh = pad(S.hour12 ? h % 12 || 12 : h), mm = pad(d.getMinutes());
  setH1(hh[0]); setH2(hh[1]); setM1(mm[0]); setM2(mm[1]);
  setS(pad(d.getSeconds()));
  const lbl = S.hour12 ? `hours · ${h < 12 ? 'am' : 'pm'}` : 'hours';
  if ($('lbl-h').textContent !== lbl) $('lbl-h').textContent = lbl;
  const ap = S.hour12 ? (h < 12 ? '오전' : '오후') : '';   // 세로 반반 한 줄 배치는 라벨 대신 날짜 둘째 줄에
  if ($('ds-ap').textContent !== ap) $('ds-ap').textContent = ap;
  renderDate(d);
}

// 날짜: 상세 화면은 10.27 / 2026 · 화요일, 시계 강조 화면은 눕혀서 2026년 10월 27일 … 화요일
// 토요일 하늘색, 일요일·공휴일 핑크 (공휴일이면 이름도). 날짜가 바뀌거나 공휴일 목록을 받으면 달력 위젯도
function renderDate(d) {
  const iso = ymd(d);
  if ($('date').dataset.iso === iso) return;
  $('date').dataset.iso = iso;
  const wd = WEEK[d.getDay()] + '요일', hol = holidayName(iso);
  $('date-num').textContent = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  $('date-year').textContent = d.getFullYear();
  $('date-wd').textContent = hol ? `${wd} · ${hol}` : wd;
  $('ds-date').innerHTML = `<b>${d.getFullYear()}</b>년<b>${d.getMonth() + 1}</b>월<b>${d.getDate()}</b>일`;
  $('ds-wd').textContent = wd;
  $('ds-hol').textContent = hol;
  document.body.dataset.day = hol || d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '';
  renderCal(d);   // 달력 위젯: 오늘 표시·공휴일
}

function tickClock() {
  const d = new Date();
  renderClock(d);
  if (d.getSeconds() === 0) {
    if (d.getMinutes() === 0) { renderWeather(); wgHour(d.getHours()); }   // 정각마다 시간별 예보 첫 칸을 '지금'으로 당김
    else renderSun();
    shiftPixels(d.getMinutes());
  }
  checkAlarm(d);
  cmIdleCheck();
  document.body.classList.toggle('night', isNight(d.getHours()));
  document.body.classList.toggle('night-dim', nightStyle() === 'dim');
  document.body.classList.toggle('night-red', nightStyle() === 'red');
  setTimeout(tickClock, 1000 - d.getMilliseconds() + 5);
}
