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
    if (S.analog) { const cs = fitDial(w, h - pb, portrait, solo, rem, wmax); return clockVars(cs, cs, rem, wmax); }   // 아날로그: 시계판
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
    // (폭이 좁은 폰은 한 줄이면 많이 작아져서 세 줄 그대로). 스톱워치·타이머·알람도 같이 (cm-line)
    const lineSize = oneLineSize(w, wmax);
    const oneLine = portrait && S.half && !solo && lineSize >= .8 * size;
    document.body.classList.toggle('cm-line', oneLine);
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
    if (oneLine) cmSize = cmLine(h, size, rem);
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
  clockVars(size, cmSize, rem, wmax);
}
// 시계 칸(섹션)에 걸어서 스톱워치·타이머·알람 화면도 같은 크기를 씀
// 크기가 바뀔 땐(화면 돌리기·접었다 펴기) 숫자 칸 폭이 천천히 늘고 줄지 않게 — 옛 크기 폭에서 출발하면 시 두 자리가 잠깐 두 줄로 꺾임
function clockVars(size, cmSize, rem, wmax) {
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

// 세로 반반 한 줄 배치: 시:분 크기 (폭에 맞춤). .33em = 가운데 콜론 + 양옆 여백
const oneLineSize = (w, wmax) => w * .99 / (4 * wmax + .33);
// 한 줄 배치의 스톱워치·타이머·알람: 시계와 같은 크기 한 줄, 위아래 배율은 화면마다 (아래 줄 높이가 달라서). 크기를 돌려줌
// 숫자(.82em × 배율) + (+·− 버튼 줄) + 이름·버튼 줄, 스톱워치는 1/100초(.41em × 배율)도 아래 줄에
function cmLine(h, size, rem) {
  for (const el of document.querySelectorAll('.cm')) {
    const pm = el.querySelector('.cm-pm'), foot = el.querySelector('.cm-foot'), d3 = el.querySelector('.cm-d3');
    const above = (pm ? pm.offsetHeight : 0) + 4 * rem;   // 줄 사이 2rem × 2 (버튼 줄이 없어도 빈 줄 사이가 있음)
    let k = (h - above - foot.offsetHeight) / (.82 * size);
    if (d3) k = Math.min(k, (h - above) / (1.23 * size));
    el.style.setProperty('--sy', Math.max(1, Math.min(2.4, k)).toFixed(3));
  }
  return size;
}

// 아날로그 시계판: 칸 폭·높이 중 막히는 쪽에 맞춤 (높이 = 폭 × R, 레코드판은 정사각 R 1·엣지·모던은 세로로 긴 1.22 — clock.css --dial-r)
// 날짜를 끄면 모던(라인·스윕·데이트)은 R을 칸 모양에 맞춰 위아래·좌우를 다 채움 (너무 납작하거나 길쭉해지지 않게 DIAL_R 안에서)
// 엣지는 숫자가 판 모양을 따라 늘어나서 정사각에 가까우면 모서리 숫자끼리 겹쳐 1.22 그대로
// 날짜는 옆(눕힘)과 위(가로 줄) 중 시계판이 더 커지는 쪽 — 세로 시계만은 아래 줄, 가로 시계만은 옆
// 스톱워치·타이머·알람은 시계판 자리(시계판 + 날짜) 안에 들어가는 크기로 (돌려줌)
// 세로 반반은 시계 칸이 위 절반을 채워서(CSS) 스톱워치 등을 디지털 시계와 똑같이 — 디지털이 한 줄이었을 화면이면 한 줄(cm-line)
const DIAL_R = [.75, 1.8];
function fitDial(w, h, portrait, solo, rem, wmax) {
  const ds = document.querySelector('.ds'), gap = 2 * rem, dial = $('dial'), dm = dial.dataset.face === 'modern';
  dial.style.removeProperty('--dial-r');
  const R = dm && !S.date ? Math.round(Math.min(DIAL_R[1], Math.max(DIAL_R[0], h / w)) * 1000) / 1000
    : parseFloat(getComputedStyle(dial).getPropertyValue('--dial-r')) || 1;
  if (dm) { if (!S.date) dial.style.setProperty('--dial-r', R); shapeDial(R); }
  document.body.classList.remove('oneline');
  $('clock-in').style.rowGap = '';
  const t = getComputedStyle(ds).writingMode === 'horizontal-tb' ? ds.offsetHeight : ds.offsetWidth;   // 날짜 줄 두께 (놓인 방향과 상관없이 같음)
  const row = t + 3 * rem, side = t + gap + 3 * rem;   // 시계판과 날짜 사이 3rem (옆이면 칸 사이 2rem도)
  const top = Math.min(w, (h - row) / R), beside = Math.min(w - side, h / R);   // 시계판 폭
  const dateRow = S.date && (solo ? portrait : top > beside);
  document.body.classList.toggle('ds-top', dateRow && !solo);
  const D = Math.floor(!S.date ? Math.min(w, h / R) : dateRow ? top : beside);
  $('clock').style.setProperty('--dial', D + 'px');
  // 날짜가 시계판보다 길면 줄임 (눕힌 날짜는 시계판 높이, 가로 줄은 시계판 폭에 맞춤)
  const items = [...ds.children].filter(c => c.offsetHeight);
  const len = items.reduce((s, c) => s + (dateRow ? c.offsetWidth : c.offsetHeight), 0) + parseFloat(getComputedStyle(ds).rowGap || 0) * (items.length - 1);
  const z = len ? Math.min(1, (dateRow ? D : D * R) / len) : 1;
  ds.style.zoom = z < .99 ? z : '';
  const cw = D + (S.date && !dateRow ? side : 0);
  $('clock').style.width = portrait ? '' : cw + 'px';
  const half = portrait && S.half && !solo, lbl = 2.6 * rem + gap, span = 2 * wmax + .02;
  const size3 = half ? Math.min((w - lbl - (S.date ? side : 0)) / span, h / (S.secs ? 2.25 : 1.68)) : 0;   // 디지털 세 줄 크기 (날짜는 옆)
  const line = half && oneLineSize(w, wmax) >= .8 * size3;
  document.body.classList.toggle('cm-line', line);
  if (line) return cmLine(h, oneLineSize(w, wmax), rem);
  if (half) return Math.min((w - lbl - (S.date ? side : 9.4 * rem + gap)) / span, h / 2.25);
  return Math.min(((portrait ? w : cw) - 12 * rem - 2 * gap) / (2 * wmax + .02), (D * R + (dateRow ? row : 0)) / 2.25);   // 라벨 2.6rem·+− 버튼 9.4rem 자리
}

// ===== 아날로그 시계 (레코드판, 설정 › 시계 모양) =====
// 눈금 60개(정시는 굵게)·모서리 나사(홈 방향은 제각각)·레코드 홈을 그림 (200×200 단위, 가운데 100,100)
// 홈은 밝은 선·어두운 선을 번갈아 1.5 간격, 곡 사이 띠 둘(반지름 41·56), 맨 바깥은 판 가장자리 빛
(function drawDial() {
  const pt = (a, r) => [(100 + r * Math.sin(a)).toFixed(2), (100 - r * Math.cos(a)).toFixed(2)];
  let t = '';
  for (let i = 0; i < 60; i++) {
    const a = i * Math.PI / 30, hr = i % 5 === 0, [x1, y1] = pt(a, hr ? 77.6 : 79.6), [x2, y2] = pt(a, 87.2);
    t += `<line${hr ? ' class="tk-h"' : ''} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  $('dl-ticks').innerHTML = t;
  $('dl-screws').innerHTML = [[21, 21, 35], [179, 21, -20], [21, 179, 70], [179, 179, 10]].map(([x, y, r]) =>
    `<circle class="dl-screw" cx="${x}" cy="${y}" r="6.6"/><path class="dl-slot" d="M${x - 4.4} ${y}h8.8" transform="rotate(${r} ${x} ${y})"/>`).join('');
  let g = '';
  for (let r = 25.5, k = 0; r < 72; r += 1.5, k++) g += `<circle class="${k % 2 ? 'g-d' : 'g-l'}" r="${r}"/>`;
  $('dl-grooves').innerHTML = g + '<circle class="g-gap" r="41"/><circle class="g-gap" r="56"/><circle class="g-in" r="72.6"/>';
})();
// 시침·분침은 초마다(분침은 초만큼 조금씩), 초침과 라벨은 1분에 한 바퀴 부드럽게 계속 돎 — 초 표시를 끄면 초침은 숨고 라벨은 멈춤 (▲가 12시)
// 초침·라벨은 따로 겹친 그림이라 돌려도 화면을 다시 그리지 않음. 1분마다 실제 초에 다시 맞춤
let dlSpin = null;
function renderDial(d) {
  const on = S.analog && S.focus;
  if (on && S.secs) {
    if (!dlSpin) dlSpin = ['dl-label', 'dl-sec', 'de-sec', 'dm-sec', 'dm-sweep-in', 'df-sec'].map(id => $(id).animate([{ transform: 'rotate(0turn)' }, { transform: 'rotate(1turn)' }], { duration: 6e4, iterations: Infinity }));
    if (!dlSpin.synced || !d.getSeconds()) { dlSpin.forEach(a => { a.currentTime = d.getTime() % 6e4; }); dlSpin.synced = true; }
  } else if (dlSpin) { dlSpin.forEach(a => a.cancel()); dlSpin = null; }
  if (!on) return;
  const m = d.getMinutes() + d.getSeconds() / 60, h = d.getHours() % 12 + m / 60;
  const hd = (h * 30).toFixed(2), md = (m * 6).toFixed(2);
  $('dl-h').setAttribute('transform', `rotate(${hd} 100 100)`);
  $('dl-m').setAttribute('transform', `rotate(${md} 100 100)`);
  for (const k of ['de', 'dm', 'df']) {   // 엣지·모던·플라워 (가운데 0,0)
    $(k + '-h').setAttribute('transform', `rotate(${hd})`);
    $(k + '-m').setAttribute('transform', `rotate(${md})`);
  }
  if (DM[S.dialTheme] && S.dialTheme !== dmTheme) { dmTheme = S.dialTheme; drawModern(dmTheme); deMin = -1; }   // 모던은 테마를 바꿀 때 그림
  const min = d.getHours() * 60 + d.getMinutes();
  if (min !== deMin) { deMin = min; $('de-nums').innerHTML = edgeNums(h); $('dm-cal').innerHTML = modernCal(dmTheme, d, DH); }   // 엣지 숫자 굵기·날짜는 분마다
}
// 모던 판 모양 (세로/가로 R, fitDial): 화면 그림은 200 × 200R 단위(가운데 0,0 — 반높이 DH)로 다시 그림
// 바늘·초침은 그대로 두고 보는 칸만 넓혀서, 판이 정사각보다 납작해지면(R < 1) 짧은 쪽(높이)에 맞춰 같이 줄어듦
let DH = 122;
function shapeDial(R) {
  const hy = Math.round(R * 1000) / 10;
  if (hy === DH) return;
  DH = hy;
  const k = Math.max(1, 100 / hy), dial = $('dial');
  for (const s of dial.querySelectorAll('.dm-hands, .dm-sec')) s.setAttribute('viewBox', `${-100 * k} ${-hy * k} ${200 * k} ${2 * hy * k}`);
  for (const s of dial.querySelectorAll('.dm-bg, .dm-face, .dm-cal')) s.setAttribute('viewBox', `-100 ${-hy} 200 ${2 * hy}`);
  // 스윕 빛: 케이스 테 안쪽 화면(5 안쪽, 모서리 39)에 맞추고, 빛 정사각은 화면 대각선보다 크게
  const sw = dial.querySelector('.dm-sweep'), H = 2 * hy - 10, big = Math.hypot(190, H) / 1.9 + 2;
  sw.style.top = 500 / (2 * hy) + '%'; sw.style.height = H / (2 * hy) * 100 + '%'; sw.style.borderRadius = `20.5% / ${3900 / H}%`;
  sw.firstElementChild.style.cssText = `width:${big}%;margin:${-big / 2}% 0 0 ${-big / 2}%`;
  deMin = -1; dmTheme = '';   // 눈금·날짜를 새 모양으로 바로 다시 그림
  renderDial(new Date());
}

// ===== 엣지 시계판 (설정 › 테마 › 엣지) =====
// 화면은 200×244 둥근 네모(모서리 44). 숫자는 5 안쪽 둥근 네모 선(모서리 40)을 따라 — 정시 방향 선이 그 선에 닿는 곳에 숫자,
// 숫자 칸 길이는 양옆 반 시 방향이 닿는 점 사이. 위·아래 변은 납작하고 넓게, 옆 변은 좁고 길게, 모서리는 기울여서 (가장 가까운 변 기준)
// 지금 시(hp, 소수)에 가까울수록 굵고 안쪽으로 두껍게 (두께 15~30, 굵기 650~1000, 1.3시간 폭 가우스) — 옆 변은 가로로 눌려서 먼 숫자도 너무 가늘지 않게
let deMin = -1;
const DE_CAP = .705;   // Nunito 숫자 높이 / 글자 크기
const deHit = a => rrHit(a, 95, 117, 40);
// 12시부터 시계방향 a(라디안) 선이 둥근 네모(가운데 0,0, 반폭 hx·반높이 hy·모서리 r)에 닿는 점과 바깥 법선 각 n (12시부터 시계방향)
function rrHit(a, hx, hy, r) {
  const sx = Math.sin(a), sy = -Math.cos(a), ox = hx - r, oy = hy - r;
  let t = Math.min(hx / (Math.abs(sx) || 1e-9), hy / (Math.abs(sy) || 1e-9)), x = t * sx, y = t * sy;
  if (Math.abs(x) > ox && Math.abs(y) > oy) {   // 모서리: 모서리 원과 만나는 점
    const cx = Math.sign(x) * ox, cy = Math.sign(y) * oy, b = sx * cx + sy * cy;
    t = b + Math.sqrt(b * b - (cx * cx + cy * cy - r * r)); x = t * sx; y = t * sy;
    return { x, y, n: Math.atan2(x - cx, cy - y) };
  }
  return { x, y, n: Math.abs(x) > hx - 1e-6 ? Math.sign(x) * Math.PI / 2 : y < 0 ? 0 : Math.PI };
}
function edgeNums(hp) {
  const pts = Array.from({ length: 24 }, (_, k) => deHit(k * Math.PI / 12));   // 짝수 = 정시, 홀수 = 반 시
  let out = '';
  for (let i = 1; i <= 12; i++) {
    const P = pts[2 * i % 24], a = pts[2 * i - 1], b = pts[(2 * i + 1) % 24];
    let dd = Math.abs(i - hp) % 12; dd = Math.min(dd, 12 - dd);
    const w = Math.exp(-((dd / 1.3) ** 2)), T = 15 + 15 * w;
    const n = P.n * 180 / Math.PI, n0 = Math.round(n / 90) * 90, tilt = n - n0, side = n0 % 180 !== 0;
    // 모서리는 기울인 상자 끝이 둥근 선 밖으로 나가지 않고 너무 납작해 보이지 않게 두께에 맞춘 길이로 (한 자리 1.25배, 두 자리 2배)
    const chord = Math.hypot(b.x - a.x, b.y - a.y) - 6, along = Math.abs(tilt) > .5 ? Math.min(chord, T * (String(i).length * .75 + .5)) : chord;
    const bw = side ? T : along, bh = side ? along : T, half = side ? bw / 2 : bh / 2;
    const a0 = n0 * Math.PI / 180, tr = tilt * Math.PI / 180;
    const vx = -Math.sin(a0) * half, vy = Math.cos(a0) * half;   // 접점에서 안쪽으로 두께 절반 → 상자 가운데, 모서리는 기울인 만큼 돌림
    const cx = 100 + P.x + vx * Math.cos(tr) - vy * Math.sin(tr), cy = 122 + P.y + vx * Math.sin(tr) + vy * Math.cos(tr);
    out += `<text transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${tilt.toFixed(1)})" y="${(bh / 2).toFixed(2)}" text-anchor="middle" font-size="${(bh / DE_CAP).toFixed(2)}"`
      + ` textLength="${bw.toFixed(2)}" lengthAdjust="spacingAndGlyphs" style="font-weight:${Math.round(650 + 350 * w)}">${i}</text>`;
  }
  return out;
}

// ===== 모던 시계판 (설정 › 테마 › 라인·스윕·데이트) =====
// 화면은 200×244 둥근 네모(모서리 44, 가운데 0,0 — 날짜를 끄면 높이는 칸에 맞춰, shapeDial). 가장자리에 분 눈금 60개(정시 자리는 밝게) — 분 방향 선이 닿는 곳에서 테에 수직으로,
// 그 안쪽에 시 눈금 12개(가운데를 향함), 위에 로고 [ 03 ], 날짜 동그라미(요일·날짜)
// 라인: 회색 케이스 테·검은 화면·굵은 흰 시 눈금·속이 빈 흰 바늘·빨간 초침, 날짜는 3시 쪽
// 데이트: 라인과 같은데 케이스 테 없이 화면 끝까지, 날짜는 12시 아래(요일 빨강), 로고 없음
// 스윕: 회색 케이스 테·짙은 회색 화면에 초침 뒤로 빛(CSS .dm-sweep), 분 숫자 05~60(그 자리엔 눈금 대신), 가늘고 긴 회색 시 눈금, 흰 바늘·흰 초침
// inset: 분 눈금 바깥 끝이 화면 끝에서 들어온 거리 / idx: 시 눈금 [바깥 끝 들어온 거리, 길이, 굵기, 색] / hands: [시침, 분침] 길이(분침 끝이 시 눈금 안쪽 끝까지) / cal: 날짜 [x, y, 반지름]
const DM = {
  line: { inset: 12, idx: [23, 12, 4, '#fff'], hands: [46, 76], logo: '#fff', cal: [34, 0, 19], hollow: true },
  sweep: { inset: 12, idx: [30, 30, 1.6, '#c7c7cc'], hands: [48, 84], logo: '#8e8e93', nums: true },
  date: { inset: 4, idx: [16, 14, 5, '#fff'], hands: [48, 82], cal: [0, -51, 25], red: true, hollow: true, bleed: true },
};
const DIAL_FACE = { edge: 'edge', line: 'modern', sweep: 'modern', date: 'modern', flower: 'flower' };
let dmTheme = '';
const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
// 판 높이(반높이 hy, 날짜를 끄면 칸에 맞춰 바뀜)에 따라 12시 시 눈금 안쪽 끝까지 거리가 원래(244)의 몇 배인지 — 로고·12시 아래 날짜 자리를 같이 옮김
// 판이 납작해지면(hy < 100) 시 눈금도 짧은 쪽에 맞춰 줄임
const dmIdxLen = (c, hy) => c.idx[1] * Math.min(1, hy / 100);
const dmFit = (c, hy) => (hy - c.idx[0] - dmIdxLen(c, hy)) / (122 - c.idx[0] - c.idx[1]);
// 테마 그림 조각 (설정 › 테마 작은 그림도 씀): 바탕(케이스 테·화면), 눈금·숫자·로고, 바늘(길이 L), 가운데 덮개, 초침
function modernParts(t, H = 122) {
  const c = DM[t], R = 44, hx = 100 - c.inset, hy = H - c.inset, P1 = k => rrHit(k * Math.PI / 30, hx, hy, R - c.inset);
  const bg = (c.nums ? '<defs><radialGradient id="dm-grad" cy=".45" r=".7"><stop offset="0" stop-color="#3a3a3c"/><stop offset="1" stop-color="#151516"/></radialGradient></defs>' : '')
    + (c.bleed ? `<rect x="-100" y="${-H}" width="200" height="${2 * H}" rx="44" fill="#000"/>`
      : `<rect x="-97.5" y="${2.5 - H}" width="195" height="${2 * H - 5}" rx="41.5" fill="none" stroke="#48484a" stroke-width="5"/><rect x="-95" y="${5 - H}" width="190" height="${2 * H - 10}" rx="39" fill="${c.nums ? 'url(#dm-grad)' : '#000'}"/>`);
  let face = '';
  for (let k = 0; k < 60; k++) {
    const P = P1(k), ux = Math.sin(P.n), uy = -Math.cos(P.n), hr = k % 5 === 0;
    if (c.nums && hr) face += `<text x="${(P.x - ux * 3).toFixed(2)}" y="${(P.y - uy * 3).toFixed(2)}" font-size="7.5" fill="#8e8e93" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:600">${pad(k || 60)}</text>`;
    else face += `<line x1="${P.x.toFixed(2)}" y1="${P.y.toFixed(2)}" x2="${(P.x - ux * 5).toFixed(2)}" y2="${(P.y - uy * 5).toFixed(2)}" stroke="${hr ? '#e5e5ea' : '#636366'}" stroke-width="${hr ? 1.5 : 1}"/>`;
  }
  const [io, , iw, ic] = c.idx, il = dmIdxLen(c, H);
  for (let h = 0; h < 12; h++) {
    const a = h * Math.PI / 6, P = rrHit(a, 100 - io, H - io, Math.max(R - io, 4)), sx = Math.sin(a), sy = -Math.cos(a);
    face += `<line x1="${P.x.toFixed(2)}" y1="${P.y.toFixed(2)}" x2="${(P.x - sx * il).toFixed(2)}" y2="${(P.y - sy * il).toFixed(2)}" stroke="${ic}" stroke-width="${iw}" stroke-linecap="round"/>`;
  }
  if (c.logo) face += `<text y="${(-46 * dmFit(c, H)).toFixed(2)}" font-size="10" fill="${c.logo}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--mono);font-weight:800;white-space:pre">[ 03 ]</text>`;
  const hand = L => c.hollow
    ? `<path d="M0 0V-12" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><rect x="-3.4" y="${-L}" width="6.8" height="${L - 12}" rx="3.4" fill="#000" stroke="#fff" stroke-width="1.6"/>`
    : `<path d="M0 0V-12" stroke="#d1d1d6" stroke-width="2" stroke-linecap="round"/><rect x="-3.2" y="${-L}" width="6.4" height="${L - 12}" rx="3.2" fill="#fff" stroke="#8e8e93" stroke-width=".6"/>`;
  const hub = c.hollow ? '<circle r="3.8" fill="#fff"/>' : '';
  const sec = c.hollow ? '<path d="M0 14V-96" stroke="#ff3b30" stroke-width="1.1" stroke-linecap="round"/><circle r="2.8" fill="#ff3b30"/><circle r="1" fill="#000"/>'
    : '<path d="M0 14V-104" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle r="3" fill="#1c1c1e" stroke="#fff" stroke-width="1.2"/>';
  return { bg, face, hand, hub, sec, hands: c.hands };
}
function drawModern(t) {
  const p = modernParts(t, DH);
  $('dm-bg').innerHTML = p.bg; $('dm-face').innerHTML = p.face;
  $('dm-h').innerHTML = p.hand(p.hands[0]); $('dm-m').innerHTML = p.hand(p.hands[1]); $('dm-hub').innerHTML = p.hub; $('dm-sec').innerHTML = p.sec;
}
// 날짜 동그라미: 위 줄 요일(영문 3자, 데이트는 빨강), 아래 줄 날짜. 12시 아래 날짜는 판 높이(반높이 hy)에 맞춰 자리·크기를 옮김
function modernCal(t, d, hy = 122) {
  const c = DM[t];
  if (!c || !c.cal) return '';
  let [x, y, r] = c.cal;
  if (y) { const f = dmFit(c, hy); y *= f; r *= Math.min(1, 1.25 * f); }
  return `<g text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand)"><circle cx="${x}" cy="${y}" r="${r}" fill="#2c2c2e"/>`
    + `<text x="${x}" y="${(y - r * .34).toFixed(2)}" font-size="${(r * .4).toFixed(2)}" fill="${c.red ? '#ff3b30' : '#8e8e93'}" style="font-weight:600">${WEEK_EN[d.getDay()]}</text>`
    + `<text x="${x}" y="${(y + r * .3).toFixed(2)}" font-size="${(r * .82).toFixed(2)}" fill="#fff" style="font-weight:500">${d.getDate()}</text></g>`;
}

// ===== 플라워 시계판 (설정 › 테마 › 플라워) =====
// 보석 꽃 그림(img/flower.webp — 정사각, 가운데 웃는 얼굴이 판 가운데, 꽃잎 12장이 시 자리) 위에 바늘만 그림
// 검은 금속 시침·분침에 흰 테두리(흰 얼굴·색 꽃잎 어디서나 보이게), 빨간 초침(검은 테두리·뒤쪽 무게추). 200×200 단위·가운데 0,0
// 시침은 얼굴(반지름 45) 밖 꽃잎 뿌리까지, 분침은 꽃잎 안쪽까지
function flowerHands() {
  const hand = (L, w) => `<path class="df-hd" d="M${-w * .47} ${L * .19}L${-w} -4L${-w * .7} ${-L + 6}L0 ${-L}L${w * .7} ${-L + 6}L${w} -4L${w * .47} ${L * .19}Z"/>`;
  return {
    hour: hand(52, 3.4), minute: hand(82, 2.7),
    hub: '<circle class="df-hd" r="5"/><circle r="1.6" fill="#fff"/>',
    sec: '<path d="M0 16V-88" stroke="#000" stroke-width="2.6" stroke-linecap="round"/><circle cy="11" r="3.2" fill="#000"/>'
      + '<path d="M0 16V-88" stroke="#ff2d55" stroke-width="1.1" stroke-linecap="round"/><circle cy="11" r="2.4" fill="#ff2d55"/>'
      + '<circle r="2.6" fill="#ff2d55" stroke="#000" stroke-width=".8"/><circle r=".8" fill="#000"/>',
  };
}
(() => { const p = flowerHands(); $('df-h').innerHTML = p.hour; $('df-m').innerHTML = p.minute; $('df-hub').innerHTML = p.hub; $('df-sec').innerHTML = p.sec; })();

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
  renderDial(d);
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
