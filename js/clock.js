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
    if (!dlSpin) dlSpin = ['dl-label', 'dl-sec', 'de-sec', 'dm-sec', 'dm-sweep-in', 'df-sec', 'dr-sec', 'dr-ss', 'dw-sec'].map(id => $(id).animate([{ transform: 'rotate(0turn)' }, { transform: 'rotate(1turn)' }], { duration: 6e4, iterations: Infinity }));
    if (!dlSpin.synced || !d.getSeconds()) { dlSpin.forEach(a => { a.currentTime = d.getTime() % 6e4; }); dlSpin.synced = true; }
  } else if (dlSpin) { dlSpin.forEach(a => a.cancel()); dlSpin = null; }
  if (!on) return;
  const m = d.getMinutes() + d.getSeconds() / 60, h = d.getHours() % 12 + m / 60;
  const hd = (h * 30).toFixed(2), md = (m * 6).toFixed(2);
  $('dl-h').setAttribute('transform', `rotate(${hd} 100 100)`);
  $('dl-m').setAttribute('transform', `rotate(${md} 100 100)`);
  if (S.dialTheme === 'rainbow') {   // 블랙 타일: 처음 고를 때 그림, 작은 다이얼 9시 쪽 = 시(12시간), 3시 쪽 = 분 ÷ 30
    if (!drDrawn) drawRainbow();
    $('dr-sl').setAttribute('transform', `translate(${DR.sub[0][0]} ${DR.sub[0][1]}) rotate(${hd})`);
    $('dr-sr').setAttribute('transform', `translate(${DR.sub[1][0]} ${DR.sub[1][1]}) rotate(${(m % 30 * 12).toFixed(2)})`);
  }
  if (S.dialTheme === 'qp' && d.toDateString() !== dqDay) drawQp(d);
  if (S.dialTheme === 'quartz' && !dwDrawn) drawQuartz();   // 쿼츠: 처음 고를 때 그림
  if (S.dialTheme === 'rotary') {   // 로터리: 처음 고를 때 그리고, 링은 초마다(초를 끄면 초 링은 멈춤)·날짜와 시각 글자는 분마다
    if (!dkDrawn) drawRotary();
    dkTurn('dk-h', -30 * d.getHours()); dkTurn('dk-m', -6 * d.getMinutes()); if (S.secs) dkTurn('dk-s', -6 * d.getSeconds());
    const key = d.toDateString() + d.getHours() + ':' + d.getMinutes() + S.hour12 + document.fonts.status;
    if (key !== dkMin) { dkMin = key; rotaryText('dk-', d); }
  }   // 타일 캘린더: 날짜가 바뀌면 판(작은 다이얼·주 바늘·달)을 다시 그림
  if (DC_INK[S.dialTheme]) {   // LCD·LCD 다크: 처음 고를 때(테마를 바꿀 때) 판을 그리고, 시각은 분이 바뀔 때·오늘 날짜 괄호는 날짜가 바뀔 때
    if (S.dialTheme !== dcTheme) drawLcd(S.dialTheme);
    const hm = pad(S.hour12 ? d.getHours() % 12 || 12 : d.getHours()) + pad(d.getMinutes());
    if (hm !== dcMin) { dcMin = hm; $('dc-time').innerHTML = lcdTime(hm, dcTheme); }
    if (d.getDate() !== dcDay) { dcDay = d.getDate(); $('dc-day').innerHTML = lcdDay(dcDay, dcTheme); }
  }
  for (const k of ['de', 'dm', 'df', 'dr', 'dq', 'dw']) {   // 엣지·모던·플라워·블랙 타일·타일 캘린더·쿼츠 (가운데 0,0)
    $(k + '-h').setAttribute('transform', `rotate(${hd})`);
    $(k + '-m').setAttribute('transform', `rotate(${md})`);
  }
  if (DM[S.dialTheme] && S.dialTheme !== dmTheme) { dmTheme = S.dialTheme; drawModern(dmTheme); deMin = -1; }   // 모던은 테마를 바꿀 때 그림
  const min = d.getHours() * 60 + d.getMinutes();
  if (min + S.dialTheme !== deMin) { deMin = min + S.dialTheme; $('de-nums').innerHTML = edgeNums(h, S.dialTheme); $('dm-cal').innerHTML = modernCal(dmTheme, d, DH); if (drDrawn) $('dr-date').textContent = d.getDate(); }   // 엣지 숫자 굵기·날짜는 분마다
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

// ===== 엣지 시계판 (설정 › 테마 › 엣지·엣지 민트·엣지 레인보우) =====
// 화면은 200×244 둥근 네모(모서리 44). 5 안쪽 둥근 네모 길(모서리 40)을 바깥 끝으로 삼아, 그 길을 따라 1~12 숫자를 띠처럼 빙 둘러 그림 (따로 테두리 선은 없음)
// 숫자 자리: 정시 방향 ±15도쯤(EDGE_SPAN — 1은 오른쪽 위 모서리를 도는 한 줄, 2는 그 아래, 3은 조금 넓게). 12만 위 글자(납작하게),
// 1~5는 오른쪽·6~11은 왼쪽처럼 세로 글자를 길을 따라 눕혀 길게 늘리고(두 자리는 띠 안팎으로 나란히, 6은 고리가 4쪽), 모서리에서는 길의 곡선을 따라 휨
// 위 글자(12)의 띠를 가로지르는 획은 시계 가운데를 향하는 방향(부채꼴로 살짝 기욺), 옆 글자는 길에 수직. 글자는 둥근 7세그먼트꼴 한 줄 획 — 세로 글자는 위·아래 막대 끝이 갈고리로 꺾여 내려옴(2·3·5·6·9)
// 시침이 향하는 숫자(9시 10분이면 10)가 가장 굵고 띠도 두껍고(속은 가는 틈만), 거기서 시침이 지나온 쪽으로 차츰 가늘게(6시간쯤), 그 앞 숫자들은 가는 선
// 색: 엣지 흰색 / 민트(빛 번짐) / 레인보우(12시 빨강에서 시계 반대 방향으로 무지개)
let deMin = -1;
const EDGE_INK = { edge: '#fff', edgem: '#5cf2cf', edger: null };
const EDGE_HUE = [355, 285, 250, 220, 195, 165, 125, 85, 52, 38, 25, 10, -5];   // 레인보우: 12시부터 시계방향 한 시간마다의 색상(도)
const edgeHue = deg => { const t = (deg % 360 + 360) % 360 / 30, i = Math.floor(t); return EDGE_HUE[i] + (EDGE_HUE[i + 1] - EDGE_HUE[i]) * (t - i); };
const edgeCol = deg => `hsl(${Math.round((edgeHue(deg) + 360) % 360)} 95% 58%)`;
// 숫자마다 [시작, 끝] 방향(12시부터 시계방향 도)과 어느 변 숫자인지
const EDGE_SPAN = { 12: [-14.5, 14.5], 1: [17, 41], 2: [42.5, 71], 3: [74, 107.5], 4: [109, 136], 5: [138, 164.5], 6: [166, 194], 7: [196, 223], 8: [225, 253], 9: [255, 287], 10: [289, 319], 11: [321, 344] };
const edgeSide = i => i === 12 ? 'top' : i <= 5 ? 'right' : 'left';
// 바깥 길: 12시 꼭대기에서 시계방향으로 잰 길이 s → 점(x, y)과 안쪽 방향(nx, ny). 가운데 100,122
const EDGE_PATH = (() => {
  const hx = 95, hy = 117, r = 40, ex = hx - r, ey = hy - r, q = Math.PI * r / 2;
  const line = (x0, y0, dx, dy, len, nx, ny) => ({ len, at: t => [x0 + dx * t, y0 + dy * t, nx, ny] });
  const arc = (cx, cy, a0) => ({ len: q, at: t => { const a = a0 + t / r; return [cx + r * Math.cos(a), cy + r * Math.sin(a), -Math.cos(a), -Math.sin(a)]; } });
  const segs = [line(0, -hy, 1, 0, ex, 0, 1), arc(ex, -ey, -Math.PI / 2), line(hx, -ey, 0, 1, 2 * ey, -1, 0), arc(ex, ey, 0),
    line(ex, hy, -1, 0, 2 * ex, 0, -1), arc(-ex, ey, Math.PI / 2), line(-hx, ey, 0, -1, 2 * ey, 1, 0), arc(-ex, -ey, Math.PI), line(-ex, -hy, 1, 0, ex, 0, 1)];
  const P = segs.reduce((s, g) => s + g.len, 0);
  const at = s => {
    s = (s % P + P) % P;
    for (const g of segs) { if (s <= g.len) { const [x, y, nx, ny] = g.at(s); return [100 + x, 122 + y, nx, ny]; } s -= g.len; }
    return at(0);
  };
  const deg = s => { const [x, y] = at(s); return (Math.atan2(x - 100, 122 - y) * 180 / Math.PI + 360) % 360; };
  // 방향(도) → s: 12시에서 시계방향으로 각도가 늘기만 하니 반씩 좁혀 찾음
  const sOf = d => {
    d = (d % 360 + 360) % 360;
    let lo = 0, hi = P;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (deg(m) < d) lo = m; else hi = m; }
    return lo;
  };
  return { P, at, sOf, deg };
})();
// 한 줄 획 숫자: 바로 선 글자 칸 W×H(가운데 0,0, 획 가운데 기준) 안의 점 목록 [x, y, 모서리 둥글기], 닫힌 모양이면 true
// tall: 세로로 긴 옆 글자(위·아래 막대 끝을 갈고리로 꺾어 내림), 아니면 납작한 위·아래 글자. sw: 획 굵기(9의 갈고리를 가운데 막대 바로 밑까지)
function edgeGlyph(ch, W, H, tall, sw) {
  const L = -W / 2, Rr = W / 2, T = -H / 2, B = H / 2, R = Math.min(W / 2, H / 4), O = Math.min(W, H) / 2, E = Math.min(W, H / 2) / 2, y = k => T + H * k;
  if (!tall) switch (ch) {   // 위(12): 갈고리 없이
    case '1': return [[[[0, T], [0, B]]]];
    case '2': return [[[[L, T], [Rr, T, R], [Rr, 0, R], [L + W * .03, 0, R * .4], [L + W * .03, B], [Rr, B]]]];
  }
  const h = W / 2;   // 세로 글자의 둥근 끝(반원)
  switch (ch) {
    case '0': return [[[[L, T, O], [Rr, T, O], [Rr, B, O], [L, B, O]], true]];
    case '1': return [[[[0, T], [0, B]]]];
    case '2': return [[[[L, y(.36)], [L, T, h], [Rr, T, h], [Rr, y(.36), W * .7], [L, y(.6), W * .7], [L, B, W * .25], [Rr, B, W * .25], [Rr, y(.66)]]]];
    case '3': return [[[[L, y(.3)], [L, T, h], [Rr, T, h], [Rr, B, h], [L, B, h], [L, y(.67)]]], [[[Rr, 0], [L + W * .08, 0]]]];
    case '4': return [[[[L, T], [L, y(.6)], [Rr, y(.68)]]], [[[Rr, y(.03)], [Rr, B]]]];
    case '5': return [[[[Rr, y(.24)], [Rr, T], [L, T], [L, y(.54), W * .3], [Rr, y(.57), W * .15], [Rr, B, h], [L, B, h], [L, y(.72)]]]];
    case '6': return [[[[Rr, y(.36)], [Rr, T, h], [L, T, h], [L, B, h], [Rr, B, h], [Rr, y(.42), h], [L, y(.42)]]]];
    case '7': return [[[[L, T], [Rr, T], [L, B]]]];
    case '8': return [[[[L, T, E], [Rr, T, E], [Rr, 0, E], [L, 0, E]], true], [[[L, 0, E], [Rr, 0, E], [Rr, B, E], [L, B, E]], true]];
    case '9': { const g = y(.58); return [[[[L, T, h], [Rr, T, h], [Rr, g, h], [L, g, h]], true], [[[Rr, g], [Rr, B, h], [L, B, h], [L, Math.min(B - h, g + sw + 1.6)]]]]; }
  }
}
// 점 목록 → 모서리를 둥글린 선을 촘촘한 점(1.2 간격)으로. 열린 선의 끝점 옆 모서리는 그 변을 다 써도 됨
function edgePts(P, closed) {
  const n = P.length, out = [], step = 1.2;
  const seg = (a, b) => { const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let j = 1; j <= k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); };
  let last = null;
  const go = p => { if (last) seg(last, p); else out.push(p); last = p; };
  for (let k = 0; k < n; k++) {
    const [x, y, r = 0] = P[k];
    if (!r || (!closed && (k === 0 || k === n - 1))) { go([x, y]); continue; }
    const p = P[(k + n - 1) % n], q = P[(k + 1) % n], lp = Math.hypot(p[0] - x, p[1] - y), lq = Math.hypot(q[0] - x, q[1] - y);
    const rr = Math.min(r, !closed && k === 1 ? lp : lp / 2, !closed && k === n - 2 ? lq : lq / 2), c = .5523;
    const a = [x + (p[0] - x) * rr / lp, y + (p[1] - y) * rr / lp], b = [x + (q[0] - x) * rr / lq, y + (q[1] - y) * rr / lq];
    go(a);
    const c1 = [a[0] + (x - a[0]) * c, a[1] + (y - a[1]) * c], c2 = [b[0] + (x - b[0]) * c, b[1] + (y - b[1]) * c];
    for (let j = 1; j <= 8; j++) {
      const t = j / 8, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      out.push([w0 * a[0] + w1 * c1[0] + w2 * c2[0] + w3 * b[0], w0 * a[1] + w1 * c1[1] + w2 * c2[1] + w3 * b[1]]);
    }
    last = b;
  }
  if (closed) seg(last, out[0]);
  return out;
}
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
// 숫자 굵기(0~1): 시침이 향하는 자리(지금 시 + 1)를 지난 지 b시간 — 0이면 1, 지나온 쪽으로 차츰 가늘게, 그다음 숫자는 마지막 한 시간 동안 굵어짐
const edgeWeight = b => b >= 11 ? (b - 11) ** 2 : Math.exp(-((b / 4) ** 1.6));
function edgeNums(hp, theme = 'edge', pre = 'de-') {
  const f = v => v.toFixed(2), ink = EDGE_INK[theme] !== undefined ? EDGE_INK[theme] : '#fff', FW = 1.4, E = EDGE_PATH;
  // 길 위 (s, 안쪽 깊이 v) → 화면 점. 옆 글자는 길에 수직으로, 위 글자(fan)는 시계 가운데를 향해 들어감(바깥 끝에 수직인 깊이가 v가 되게)
  const put = (s, v, fan) => {
    const [x, y, nx, ny] = E.at(s);
    if (!fan) return [x + nx * v, y + ny * v];
    const dx = 100 - x, dy = 122 - y, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, k = v / Math.max(.5, ux * nx + uy * ny);
    return [x + ux * k, y + uy * k];
  };
  const line = pts => pts.map((p, k) => (k ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('');
  let out = '', defs = '';
  for (let i = 1; i <= 12; i++) {
    const side = edgeSide(i), ch = String(i), two = ch.length > 1, tall = side === 'left' || side === 'right';
    const w = edgeWeight(((hp + 1 - i) % 12 + 12) % 12), ww = Math.sqrt(w);
    // 띠 두께(안쪽으로)와 획 굵기: 가는 획 1.4 ~ 속이 1.4 틈만 남는 굵기
    const T = tall ? (two ? 7 + 19 * ww : 8.5 + 11.5 * ww) : 13 + 8 * ww;
    const swMax = tall ? (two ? (i === 11 ? (T - 2) / 2 : (T - 2.8) / 3) : (T - 1.4) / 2) : (T - 2.8) / 3;
    const sw = Math.max(FW, FW + (swMax - FW) * w ** .8);
    const [d0, d1] = EDGE_SPAN[i];
    let s0 = E.sOf(d0), s1 = E.sOf(d1);
    if (s1 < s0) s1 += E.P;
    const pad = sw / 2 + .6, A = s1 - s0 - 2 * pad, sm = (s0 + s1) / 2;
    // 바로 선 글자 칸 → 길 위로: 위는 오른쪽이 시계방향·위가 바깥, 오른쪽은 아래가 시계방향·오른쪽이 바깥, 왼쪽은 위가 시계방향·왼쪽이 바깥
    // 오른쪽 한 자리 1은 폭 0(바깥 끝을 도는 한 줄)
    const W = tall ? (i === 1 ? 0 : T - sw) : A, H = tall ? A : T - sw;
    const map = {
      top: (x, y) => put(sm + x, sw / 2 + y + H / 2, true),
      right: (x, y) => put(sm + y, sw / 2 + W / 2 - x), left: (x, y) => put(sm - y, sw / 2 + x + W / 2),
    }[side];
    // 글자 나누기: 위 12는 1을 좁게(띠 두께의 25%) 앞에, 옆 두 자리는 띠 안팎으로(바깥이 앞 글자 1)
    const parts = [];
    if (!two) parts.push([ch, 0, W, H]);
    else if (!tall) { const w1 = H * .25, gap = sw + 2.6, w2 = W - w1 - gap; parts.push(['1', -W / 2 + w1 / 2, w1, H], [ch[1], W / 2 - w2 / 2, w2, H]); }
    else { const gap = sw + 1.4, w2 = ch[1] === '1' ? 0 : W - gap; parts.push(['1', -W / 2, 0, H], [ch[1], W / 2 - w2 / 2, w2, H]); }
    let d = '';
    for (const [c, ox, gw, gh] of parts)
      for (const [P, closed] of edgeGlyph(c, gw, gh, tall, sw)) d += line(edgePts(P.map(([x, y, r]) => [x + ox, y, r]), closed).map(([x, y]) => map(x, y))) + (closed ? 'Z' : '');
    let stroke = ink;
    if (!ink) {   // 레인보우: 숫자 앞·가운데·뒤 색을 이어서
      const [ax, ay] = E.at(s0), [bx, by] = E.at(s1);
      defs += `<linearGradient id="${pre}g${i}" gradientUnits="userSpaceOnUse" x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}">`
        + [[0, d0], [.5, (d0 + d1) / 2], [1, d1]].map(([o, deg]) => `<stop offset="${o}" stop-color="${edgeCol(deg)}"/>`).join('') + '</linearGradient>';
      stroke = `url(#${pre}g${i})`;
    }
    out += `<path d="${d}" stroke="${stroke}" stroke-width="${f(sw)}"/>`;
  }
  if (theme === 'edgem') defs += `<filter id="${pre}glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  // 선 끝은 반듯하게 자르고 꺾인 곳은 각지게(사진처럼) — 둥근 모서리는 글자 모양에서 따로 둥글림
  return `<defs>${defs}</defs><g fill="none" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"${theme === 'edgem' ? ` filter="url(#${pre}glow)"` : ''}>${out}</g>`;
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
const DIAL_FACE = { edge: 'edge', edgem: 'edge', edger: 'edge', line: 'modern', sweep: 'modern', date: 'modern', flower: 'flower', rainbow: 'rainbow', qp: 'qp', lcd: 'lcd', lcdk: 'lcd', quartz: 'quartz', rotary: 'rotary' };
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
// 은색 바늘: 칼 모양을 가운데 선으로 반씩 — 왼쪽 밝은 면·오른쪽 어두운 면(가운데가 솟은 금속), 끝으로 갈수록 밝게, 얇은 검은 테두리
// 시침·분침은 그림자를 바늘 바깥(돌리지 않는 묶음)에 걸어서 늘 오른쪽 아래로. 200×200 단위·가운데 0,0
// 시침은 얼굴(반지름 약 43) 밖 꽃잎 뿌리까지, 분침은 꽃잎 안쪽까지, 초침(가는 은색 + 뒤쪽 무게추)은 얼굴 안까지만
// 그라데이션·그림자 id는 앞말 pre로 (설정 › 테마 작은 그림과 겹치지 않게)
function flowerHands(pre) {
  const id = n => `url(#${pre}${n})`, line = 'rgba(0,0,0,.6)';
  const defs = `<linearGradient id="${pre}lt" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d4d8dd"/><stop offset="1" stop-color="#fff"/></linearGradient>`
    + `<linearGradient id="${pre}dk" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#6c7279"/><stop offset="1" stop-color="#adb3ba"/></linearGradient>`
    + `<radialGradient id="${pre}cap" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#bcc1c7"/><stop offset="1" stop-color="#767c83"/></radialGradient>`
    + `<filter id="${pre}sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".7" dy="1.1" stdDeviation=".7" flood-color="#000" flood-opacity=".6"/></filter>`;
  const hand = (L, w) => {
    const t = L * .19, half = s => `M0 ${t}L${s * w * .47} ${t}L${s * w} -4L${s * w * .7} ${-L + 6}L0 ${-L}Z`;
    return `<path d="${half(-1)}" fill="${id('lt')}"/><path d="${half(1)}" fill="${id('dk')}"/>`
      + `<path d="M${-w * .47} ${t}L${-w} -4L${-w * .7} ${-L + 6}L0 ${-L}L${w * .7} ${-L + 6}L${w} -4L${w * .47} ${t}Z" fill="none" stroke="${line}" stroke-width=".6" stroke-linejoin="round"/>`;
  };
  return {
    defs, hour: hand(52, 3.6), minute: hand(82, 2.9),
    hub: `<circle r="5.2" fill="${id('cap')}" stroke="${line}" stroke-width=".6"/><circle r="1.5" fill="#4a4f55"/>`,
    sec: `<path d="M0 12V-41" stroke="${line}" stroke-width="2.1" stroke-linecap="round"/><circle cy="8" r="3.2" fill="${line}"/>`
      + `<path d="M0 12V-41" stroke="#e6e9ec" stroke-width="1.1" stroke-linecap="round"/><circle cy="8" r="2.6" fill="${id('cap')}"/>`
      + `<circle r="2.9" fill="${id('cap')}" stroke="${line}" stroke-width=".6"/><circle r=".9" fill="#4a4f55"/>`,
  };
}
(() => {
  const p = flowerHands('df-');
  $('df-defs').innerHTML = p.defs; $('df-h').innerHTML = p.hour; $('df-m').innerHTML = p.minute; $('df-hub').innerHTML = p.hub; $('df-sec').innerHTML = p.sec;
})();

// ===== 블랙 타일 시계판 (설정 › 테마 › 블랙 타일 — 테마 id rainbow) =====
// 베젤·보석 없이 검은 타일 다이얼만: 가운데가 솟은 네모 타일 격자(윗면·왼면 밝게, 오른면·아랫면 어둡게 — 빛은 왼쪽 위), 가장자리 로즈골드 분 눈금
// 로즈골드 야광 막대 시 눈금(12시 두 개, 3·6·9는 작은 다이얼 바깥에 짧게, 4시는 날짜 창), 로고 [ 03 ], 아래 PEBBLY ▮ LABS
// 작은 다이얼 3개(동심원 무늬): 9시 쪽 12시간(시), 3시 쪽 30분(분 ÷ 30), 6시 쪽 초 — 0시에 크로노그래프를 켜 둔 것처럼 같이 돎
// 로즈골드 야광 시침·분침(그림자), 가는 로즈골드 초침. 200×200 단위·가운데 0,0이고 다이얼(반지름 75)만 판 가득 보이게 잘라 씀(index.html viewBox)
const DR = { sub: [[-36, 0], [36, 0], [0, 36]], date: [52, 30] };
// 12시부터 시계방향 a(도)·거리 r 자리
const drPt = (a, r) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
// 블랙 타일 두 테마(블랙 타일·타일 캘린더)가 같이 쓰는 조각: 로즈골드 그라데이션·가장자리 그림자·빛·바늘 그림자·타일 무늬
function drDefs(pre) {
  return `<linearGradient id="${pre}rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7cfb0"/><stop offset=".5" stop-color="#d4946f"/><stop offset="1" stop-color="#eab494"/></linearGradient>`
    + `<linearGradient id="${pre}rgh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe2cb"/><stop offset=".5" stop-color="#e2a582"/><stop offset=".51" stop-color="#b47452"/><stop offset="1" stop-color="#d69a77"/></linearGradient>`
    + `<radialGradient id="${pre}vig"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`
    + `<radialGradient id="${pre}sheen" cx=".3" cy=".22" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + `<filter id="${pre}sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".6" dy="1" stdDeviation=".7" flood-color="#000" flood-opacity=".7"/></filter>`
    // 타일 한 칸(10.5): 홈 → 바깥 네 경사면(윗면 가장 밝게) → 가운데 평평한 윗면
    + `<pattern id="${pre}tile" width="10.5" height="10.5" patternUnits="userSpaceOnUse" x="-5.25" y="-5.25"><rect width="10.5" height="10.5" fill="#040405"/>`
    + '<path d="M.7 .7H9.8L7.2 3.3H3.3Z" fill="#55555c"/><path d="M.7 .7L3.3 3.3V7.2L.7 9.8Z" fill="#34343a"/>'
    + '<path d="M9.8 .7V9.8L7.2 7.2V3.3Z" fill="#141416"/><path d="M.7 9.8L3.3 7.2H7.2L9.8 9.8Z" fill="#0b0b0d"/><rect x="3.3" y="3.3" width="3.9" height="3.9" fill="#1f1f23"/></pattern>';
}
// 시 눈금: 로즈골드 막대(+ 야광), 그림자는 바깥 기준으로 오른쪽 아래. spec = [[시, 안쪽 r, 바깥 r, 야광, 두 개], ...]
function drMarks(pre, spec) {
  const f = v => v.toFixed(2), bar = (a, r1, r2, w, dx) => `<g transform="rotate(${a})"><rect x="${f(dx - w / 2)}" y="${-r2}" width="${w}" height="${r2 - r1}" rx=".8"/></g>`;
  let mk = '', sh = '';
  for (const [h, r1, r2, lume, two] of spec) {
    const w = two ? 3.6 : 4.2;
    for (const dx of two ? [-2.7, 2.7] : [0]) {
      sh += bar(h * 30, r1, r2, w, dx);
      mk += `<g transform="rotate(${h * 30})"><rect x="${f(dx - w / 2)}" y="${-r2}" width="${w}" height="${r2 - r1}" rx=".8" fill="url(#${pre}rgh)" stroke="#7d4b33" stroke-width=".35"/>`
        + (lume ? `<rect x="${f(dx - w / 2 + 1)}" y="${-r2 + 1.3}" width="${w - 2}" height="${r2 - r1 - 2.6}" rx=".5" fill="#f5f1e8"/>` : '') + '</g>';
    }
  }
  return `<g transform="translate(.5 .8)" fill="#000" opacity=".7">${sh}</g>${mk}`;
}
// 로즈골드 야광 시침·분침(가운데 선으로 밝은 면·어두운 면)·가운데 덮개
function drHands(pre) {
  const g = `url(#${pre}rgh)`, hand = (L, w) => `<path d="M${-w * .85} 9L${-w} ${-L + 6}L0 ${-L}L${w} ${-L + 6}L${w * .85} 9Z" fill="${g}" stroke="#6b3e2a" stroke-width=".4"/>`
    + `<path d="M${-w * .45} -9L${-w * .5} ${-L + 7}L0 ${-L + 3.4}L${w * .5} ${-L + 7}L${w * .45} -9Z" fill="#f6f3ec"/>`;
  return { hour: hand(46, 2.9), minute: hand(67, 2.3), hub: `<circle r="3.8" fill="${g}" stroke="#6b3e2a" stroke-width=".4"/><circle r="1.2" fill="#7d4b33"/>` };
}
function rainbowParts(pre) {
  const id = n => `url(#${pre}${n})`, f = v => v.toFixed(2), rg = id('rg'), defs = drDefs(pre);
  // 다이얼: 검은 바탕 → 타일 → 분 눈금 → 가장자리 어둡게·왼쪽 위 빛
  let face = `<circle r="74.6" fill="#070708"/><circle r="66.2" fill="${id('tile')}"/>`;
  let ticks = '';
  for (let k = 0; k < 60; k++) { const [x1, y1] = drPt(k * 6, 68), [x2, y2] = drPt(k * 6, 71.6); ticks += `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}"/>`; }
  face += `<g stroke="#e2a888" stroke-width="${.6}">${ticks}</g><circle r="74.6" fill="${id('vig')}"/>`;
  // 시 눈금: 12시 두 개, 3·6·9는 작은 다이얼 바깥에 짧게(야광 없이), 4시는 날짜 창
  face += drMarks(pre, [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11].map(h => h % 3 === 0 && h ? [h, 61.5, 66] : [h, 46, 64, true, !h]));
  // 작은 다이얼: 그림자 테 → 바탕 → 동심원 무늬 → 로즈골드 테 → 눈금·숫자
  const num = (x, y, t, fs) => `<text x="${f(x)}" y="${f(y)}" font-size="${fs}" fill="#e7ad8b" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:500">${t}</text>`;
  DR.sub.forEach(([cx, cy2], si) => {
    let g = `<circle r="23.9" fill="rgba(0,0,0,.65)"/><circle r="23" fill="#0c0c0e"/><g fill="none" stroke="#fff" stroke-opacity=".05" stroke-width=".45">`;
    for (let r = 1.6; r < 22.5; r += 1.1) g += `<circle r="${f(r)}"/>`;
    g += `</g><circle r="22.8" fill="none" stroke="${rg}" stroke-width=".9"/><g stroke="#e2a888" stroke-linecap="round">`;
    const tick = (a, r1, r2, w) => { const [x1, y1] = drPt(a, r1), [x2, y2] = drPt(a, r2); return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke-width="${w}"/>`; };
    let nums = '';
    if (si === 0) {   // 12시간: 12·3·6·9 숫자, 사이는 막대
      for (let k = 0; k < 12; k++) if (k % 3) g += tick(k * 30, 16.5, 21, .8);
      [[0, '12'], [90, '3'], [180, '6'], [270, '9']].forEach(([a, t]) => { const [x, y] = drPt(a, 15.5); nums += num(x, y, t, 6.4); });
    } else if (si === 1) {   // 30분: 1분마다 짧게·5분마다 길게, 10·20·30
      for (let k = 0; k < 30; k++) g += k % 5 ? tick(k * 12, 19.6, 21.6, .45) : tick(k * 12, 17, 21.6, .9);
      [[0, '30'], [120, '10'], [240, '20']].forEach(([a, t]) => { const [x, y] = drPt(a, 12.4); nums += num(x, y, t, 6); });
    } else {   // 초: 5초마다 막대, 3·6·9시 쪽 가는 선
      for (let k = 0; k < 12; k++) g += tick(k * 30, 18.5, 21.4, .6);
      for (const a of [90, 180, 270]) g += tick(a, 2, 21.4, .5);
    }
    face += `<g transform="translate(${cx} ${cy2})">${g}</g>${nums}</g>`;
  });
  // 날짜 창(4시~5시 사이), 로고 [ 03 ], 아래 PEBBLY ▮ LABS
  const [dx, dy] = DR.date;
  face += `<rect x="${dx - 5.6}" y="${dy - 6.8}" width="11.2" height="13.6" rx=".9" fill="#0a0a0b" stroke="${rg}" stroke-width=".9"/>`
    + `<text id="${pre}date" x="${dx}" y="${dy + .4}" font-size="8.6" fill="#f2f2f2" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:500">${new Date().getDate()}</text>`
    + `<text x=".5" y="-30.2" font-size="8" fill="#000" opacity=".7" text-anchor="middle" dominant-baseline="central" style="font-family:var(--mono);font-weight:800;white-space:pre">[ 03 ]</text>`
    + `<text y="-31" font-size="8" fill="${id('rgh')}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--mono);font-weight:800;white-space:pre">[ 03 ]</text>`
    + `<g font-size="3.3" fill="#ececec" dominant-baseline="central" style="font-family:var(--logo);font-weight:800;letter-spacing:.15px"><text x="-3.6" y="63.8" text-anchor="end">PEBBLY</text><text x="3.6" y="63.8">LABS</text></g>`
    + `<circle r="74.6" fill="${id('sheen')}"/>`;
  // 작은 다이얼 바늘: 가운데 둥근 판
  const sub = '<path d="M0 4V-19" stroke="#e7ad8b" stroke-width="1.3" stroke-linecap="round"/>'
    + `<circle r="2.7" fill="${rg}" stroke="#7d4b33" stroke-width=".35"/><circle r=".8" fill="#7d4b33"/>`;
  return {
    defs, face, sub, ...drHands(pre),
    sec: '<path d="M0 15V-69" stroke="#e7ad8b" stroke-width=".8" stroke-linecap="round"/><circle r="1.9" fill="#e7ad8b" stroke="#7d4b33" stroke-width=".3"/>',
  };
}
let drDrawn = false;
function drawRainbow() {
  const p = rainbowParts('dr-');
  $('dr-face').innerHTML = `<defs>${p.defs}</defs>${p.face}`;
  $('dr-h').innerHTML = p.hour; $('dr-m').innerHTML = p.minute; $('dr-hub').innerHTML = p.hub; $('dr-sec').innerHTML = p.sec;
  $('dr-sl').innerHTML = p.sub; $('dr-sr').innerHTML = p.sub; $('dr-ss').innerHTML = p.sub;
  drDrawn = true;
}

// ===== 타일 캘린더 시계판 (설정 › 테마 › 타일 캘린더 — 블랙 타일의 퍼페추얼 캘린더판) =====
// 검은 타일 다이얼 둘레에 주 번호 링(1~52주 — 짝수는 숫자, 홀수는 점, 가운데 가는 로즈골드 바늘이 이번 주), 로즈골드 시 눈금
// 로즈골드 작은 다이얼 4개(동심원 무늬, 검은 글씨·바늘): 12시 월(+ 가운데 윤년 L·1·2·3) / 3시 날짜(1~31, 31은 빨강) / 9시 요일 / 6시 달 모양(파란 하늘 창, [ 03 ])
// 작은 다이얼·주 바늘·달은 날짜가 바뀔 때 판을 다시 그림, 시침·분침만 초마다. 초침 없음. 200×200 단위에서 다이얼(반지름 75)만 보이게 잘라 씀
const DQ = { sub: [[0, -33], [33, 0], [-33, 0], [0, 33]], r: 21 };
const MON_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// ISO 주 번호(1~53) / 달 나이(일, 0 = 삭 — 2000-01-06 18:14 UTC 삭 기준, 삭망월 29.530589일)
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
const moonAge = d => ((d.getTime() / 864e5 - 10962.76) % 29.530589 + 29.530589) % 29.530589;
function qpParts(pre, d) {
  const id = n => `url(#${pre}${n})`, f = v => v.toFixed(2), ink = '#2a1810', R = DQ.r;
  const defs = drDefs(pre)
    + `<radialGradient id="${pre}sal" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#f8cdb6"/><stop offset=".6" stop-color="#eaaa8e"/><stop offset="1" stop-color="#d38d71"/></radialGradient>`
    + `<radialGradient id="${pre}sky" cy=".7" r=".8"><stop offset="0" stop-color="#2d48a8"/><stop offset="1" stop-color="#0c1647"/></radialGradient>`
    + `<radialGradient id="${pre}moon" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fff6d6"/><stop offset=".7" stop-color="#ecd08c"/><stop offset="1" stop-color="#c9a45a"/></radialGradient>`
    // 달 창: 위쪽 반달 모양에서 아래 양쪽 언덕(달이 들어가고 나오는 곳)을 뺀 자리
    + `<mask id="${pre}mw"><circle r="15.6" fill="#fff"/><rect x="-16" y="2.6" width="32" height="14" fill="#000"/><circle cx="-8.6" cy="3.2" r="8.6" fill="#000"/><circle cx="8.6" cy="3.2" r="8.6" fill="#000"/></mask>`;
  // 바탕: 검은 다이얼 → 타일 → 주 번호 링 경계
  let face = `<circle r="74.6" fill="#070708"/><circle r="60.6" fill="${id('tile')}"/><circle r="61" fill="none" stroke="#000" stroke-width=".9"/>`;
  // 주 번호: 1주가 12시, 짝수 주는 숫자(바로 선 글자), 홀수 주는 점
  let wk = '';
  for (let k = 1; k <= 52; k++) {
    const [x, y] = drPt((k - 1) * 360 / 52, 67.6);
    wk += k % 2 ? `<circle cx="${f(x)}" cy="${f(y)}" r=".55"/>` : `<text x="${f(x)}" y="${f(y)}">${k}</text>`;
  }
  face += `<g fill="#efefef" font-size="4.5" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:500">${wk}</g><circle r="74.6" fill="${id('vig')}"/>`;
  // 시 눈금: 작은 다이얼 사이는 길게(야광), 12·3·6·9는 다이얼 바깥에 짧게
  face += drMarks(pre, Array.from({ length: 12 }, (_, h) => h % 3 ? [h, 45, 59, true] : [h, 55.6, 59.4]));
  // 작은 다이얼: 그림자 테 → 로즈골드 바탕 → 동심원 무늬 → 테
  const base = `<circle r="${R + .8}" fill="rgba(0,0,0,.6)"/><circle r="${R}" fill="${id('sal')}"/><g fill="none" stroke="#7a4130" stroke-opacity=".09" stroke-width=".4">`
    + Array.from({ length: 17 }, (_, k) => `<circle r="${f(1.6 + k * 1.15)}"/>`).join('') + `</g><circle r="${R - .3}" fill="none" stroke="${id('rg')}" stroke-width=".8"/>`;
  // 둘레 글자: 아래쪽 절반은 뒤집어 바로 읽히게
  const ring = (a, r, t, fs, col = ink, w = 600) => {
    const flip = a > 95 && a < 265, [x, y] = drPt(a, r);
    return `<text x="${f(x)}" y="${f(y)}" font-size="${fs}" fill="${col}" text-anchor="middle" dominant-baseline="central" transform="rotate(${f(flip ? a + 180 : a)} ${f(x)} ${f(y)})" style="font-family:var(--brand);font-weight:${w}">${t}</text>`;
  };
  const tick = (a, r1, r2, w) => { const [x1, y1] = drPt(a, r1), [x2, y2] = drPt(a, r2); return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${ink}" stroke-width="${w}"/>`; };
  const hand = (a, L) => `<g transform="rotate(${f(a)})"><path d="M0 3V${-L}" stroke="#151515" stroke-width="1.1" stroke-linecap="round"/><path d="M-1 ${2 - L}L0 ${-L - 1.6}L1 ${2 - L}Z" fill="#151515"/></g>`;
  const cap = '<circle r="1.9" fill="#151515"/><circle r=".6" fill="#e9b39a"/>';
  const at = ([x, y], s) => `<g transform="translate(${x} ${y})">${s}</g>`;
  // 12시: 월 — 열두 달 눈금, 홀수 달 이름, 바늘은 이번 달. 가운데 윤년(L·1·2·3, 이번 해를 작은 바늘로)
  const mA = m => m * 30 - 15;
  let mo = base;
  for (let m = 0; m < 12; m++) mo += m % 2 ? tick(mA(m), 17.4, 19.6, .6) : ring(mA(m), 15.2, MON_EN[m], 4.1);
  const lp = d.getFullYear() % 4;
  [['L', 0], ['1', 90], ['2', 180], ['3', 270]].forEach(([t, a], k) => { const [x, y] = drPt(a, 5.4); mo += `<text x="${f(x)}" y="${f(y)}" font-size="3" fill="${ink}" opacity="${k === lp ? 1 : .55}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:700">${t}</text>`; });
  mo += hand(mA(d.getMonth()), 12.6) + `<g transform="rotate(${lp * 90})"><path d="M0 0V-3.4" stroke="#151515" stroke-width=".6"/></g>` + cap;
  // 3시: 날짜 — 1~31(홀수 숫자, 짝수 점, 31은 빨강), 바늘은 오늘
  const dA = n => (n - 1) * 360 / 31;
  let dt = base;
  for (let n = 1; n <= 31; n++) {
    if (n % 2) dt += ring(dA(n), 15.8, n, 3.15, n === 31 ? '#c8102e' : ink, 700);
    else { const [x, y] = drPt(dA(n), 15.8); dt += `<circle cx="${f(x)}" cy="${f(y)}" r=".5" fill="${ink}"/>`; }
  }
  dt += hand(dA(d.getDate()), 13.4) + cap;
  // 9시: 요일 — 일요일부터, 이름 바깥에 작은 눈금, 바늘은 오늘
  const wA = w => w * 360 / 7 - 25.7;
  let dw = base;
  for (let w = 0; w < 7; w++) dw += ring(wA(w), 14.4, WEEK_EN[w], 4.3) + tick(wA(w), 18.4, 20, .6);
  dw += hand(wA(d.getDay()), 12.4) + cap;
  // 6시: 달 모양 — 별 뜬 파란 하늘 원판에 달 둘(마주 봄)이 창 아래로 돌며 차고 이움 (보름에 달이 창 한가운데), 아래 [ 03 ]
  const th = moonAge(d) / 29.530589 * 180 - 90;
  let stars = '', seed = 5;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let k = 0; k < 26; k++) { const a = rnd() * 360, r = 3 + rnd() * 12, [x, y] = drPt(a, r); stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(.18 + rnd() * .3)}"/>`; }
  const mn = base + `<g mask="url(#${pre}mw)"><g transform="rotate(${f(th)})"><circle r="15.6" fill="${id('sky')}"/><g fill="#fff" opacity=".85">${stars}</g>`
    + `<circle cy="-9.4" r="5" fill="${id('moon')}"/><circle cy="9.4" r="5" fill="${id('moon')}"/></g></g>`
    + `<text y="10" font-size="4.6" fill="${ink}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--mono);font-weight:800;white-space:pre">[ 03 ]</text>`;
  face += at(DQ.sub[0], mo) + at(DQ.sub[1], dt) + at(DQ.sub[2], dw) + at(DQ.sub[3], mn);
  // 아래 PEBBLY ▮ LABS (6시 짧은 눈금 양옆)
  face += `<g font-size="3" fill="#ececec" dominant-baseline="central" style="font-family:var(--logo);font-weight:800;letter-spacing:.15px"><text x="-3.4" y="57.5" text-anchor="end">PEBBLY</text><text x="3.4" y="57.5">LABS</text></g>`;
  // 주 바늘: 가는 로즈골드 + 화살촉, 주 번호 링을 가리킴 (53주는 52주 자리), 맨 위 왼쪽 위 빛
  const wa = (Math.min(52, isoWeek(d)) - 1) * 360 / 52;
  face += `<g filter="url(#${pre}sh)" transform="rotate(${f(wa)})"><path d="M0 13V-60" stroke="${id('rg')}" stroke-width=".9" stroke-linecap="round"/><path d="M-1.9 -59L0 -64.6L1.9 -59Z" fill="${id('rgh')}"/><circle r="2.2" fill="${id('rgh')}"/></g>`
    + `<circle r="74.6" fill="${id('sheen')}"/>`;
  return { defs, face, ...drHands(pre) };
}
let dqDay = '';
function drawQp(d) {
  const p = qpParts('dq-', d);
  $('dq-face').innerHTML = `<defs>${p.defs}</defs>${p.face}`;
  if (!$('dq-h').firstChild) { $('dq-h').innerHTML = p.hour; $('dq-m').innerHTML = p.minute; $('dq-hub').innerHTML = p.hub; }
  dqDay = d.toDateString();
}

// ===== LCD 시계판 (설정 › 테마 › LCD) =====
// 은색 판(모서리를 깎은 네모, 광택 강철 테): 위에 헤더와 같은 로고([ 03 ] 스파인 | 점선 | pebbly labs ┐┘), 가운데 LCD 창에 7세그먼트 시:분(꺼진 칸도 아주 옅게, 글자 그림자),
// 아래에 00~31 두 자리 숫자 네 줄(한 줄 8개) — 오늘 날짜는 굵게 [ 01 ]처럼 괄호로
// 판은 200×220 단위(테 포함 214×234 → 세로/가로 1.0935, clock.css), 시각은 분마다·날짜 표시는 날짜가 바뀔 때 다시 그림
// LCD 다크(lcdk): 같은 그림에 색만 — 검은 크롬 테·짙은 회색 판·흰 로고, LCD 창은 검은 바탕에 밝은 칸(네거티브 액정)
const DC = { win: [22, 52, 156, 80], rows: [[0, 7, 20, 149], [8, 15, 20, 164.5], [16, 23, 20, 180], [24, 31, 20, 195.5]], fs: 9.6 };
// 7세그먼트 한 칸(폭 30·높이 64, 두께 7): a 위 / b 오른쪽 위 / c 오른쪽 아래 / d 아래 / e 왼쪽 아래 / f 왼쪽 위 / g 가운데 — 끝은 비스듬히
const DC_SEG = (() => {
  const W = 30, H = 64, t = 7, g = .9, L = t / 2, R = W - t / 2, T = t / 2, M = H / 2, B = H - t / 2, h = t / 2;
  const hz = (y, x0, x1) => `M${x0} ${y}L${x0 + h} ${y - h}H${x1 - h}L${x1} ${y}L${x1 - h} ${y + h}H${x0 + h}Z`;
  const vt = (x, y0, y1) => `M${x} ${y0}L${x + h} ${y0 + h}V${y1 - h}L${x} ${y1}L${x - h} ${y1 - h}V${y0 + h}Z`;
  return { a: hz(T, L + g, R - g), b: vt(R, T + g, M - g), c: vt(R, M + g, B - g), d: hz(B, L + g, R - g), e: vt(L, M + g, B - g), f: vt(L, T + g, M - g), g: hz(M, L + g, R - g) };
})();
const DC_DIG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
// 테마별 색: steel 강철 테(왼쪽 위 → 오른쪽 아래) / rim 테 바깥 선 / gap 테와 판 사이 / face 판(위 → 아래) / brush 결(색, 진하기) / ink 로고
// win LCD 창 [테두리, 위, 조금 아래, 아래] / ghost 꺼진 칸 [색, 진하기] / seg 켜진 칸 / shadow 칸 그림자 [색, 진하기] / num 00~31 / today 오늘 숫자·괄호 / cut 그 둘레(판 색, 옆 숫자와 떼어 놓음)
const DC_INK = {
  lcd: { steel: ['#fdfdfd', '#b9bdc2', '#8c9197', '#f1f2f4'], rim: '#6f747a', gap: '#7b8086', face: ['#f3f4f5', '#dcdee1'], brush: ['#fff', .22], ink: '#2f3033',
    win: ['#a6a9a5', '#cfd2cc', '#dcded8', '#d3d6d0'], ghost: ['#000', .035], seg: '#1b1c1e', shadow: ['#000', .13], num: '#3a3b3e', today: '#111', cut: '#e6e7e9' },
  lcdk: { steel: ['#7c8087', '#33363a', '#16171a', '#5c6067'], rim: '#000', gap: '#060607', face: ['#2a2b2e', '#18191b'], brush: ['#fff', .035], ink: '#e2e3e5',
    win: ['#3d4043', '#07080a', '#0e1012', '#0a0b0d'], ghost: ['#fff', .045], seg: '#e6e8e3', shadow: ['#000', 0], num: '#9fa1a6', today: '#fff', cut: '#202123' },
};
// 숫자 자리 x (네 칸 + 가운데 콜론), 창 가운데에
const DC_X = [27, 63, 107, 143], DC_Y = 60;
// 모서리를 둥글린 다각형 (점 목록, 모서리 크기 r)
function dcPoly(P, r) {
  const f = v => v.toFixed(2);
  return P.map((v, k) => {
    const p = P[(k + P.length - 1) % P.length], n = P[(k + 1) % P.length], tp = r / Math.hypot(p[0] - v[0], p[1] - v[1]), tn = r / Math.hypot(n[0] - v[0], n[1] - v[1]);
    return `${k ? 'L' : 'M'}${f(v[0] + (p[0] - v[0]) * tp)} ${f(v[1] + (p[1] - v[1]) * tp)}Q${f(v[0])} ${f(v[1])} ${f(v[0] + (n[0] - v[0]) * tn)} ${f(v[1] + (n[1] - v[1]) * tn)}`;
  }).join('') + 'Z';
}
const dcOct = (x, y, w, h, c) => [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
// 시:분 (네 자리 문자열) → 켜진 칸 + 그림자 (v 테마)
function lcdTime(hhmm, v = 'lcd') {
  const c = DC_INK[v];
  let on = '', sh = '';
  [...hhmm].forEach((ch, i) => {
    const d = DC_DIG[+ch].split('').map(s => DC_SEG[s]).join(''), tr = `translate(${DC_X[i]} ${DC_Y})`;
    on += `<path transform="${tr}" d="${d}"/>`; sh += `<path transform="${tr} translate(.8 1.1)" d="${d}"/>`;
  });
  return (c.shadow[1] ? `<g fill="${c.shadow[0]}" opacity="${c.shadow[1]}">${sh}<circle cx="100.8" cy="${DC_Y + 22.1}" r="3"/><circle cx="100.8" cy="${DC_Y + 43.1}" r="3"/></g>` : '')
    + `<g fill="${c.seg}">${on}<circle cx="100" cy="${DC_Y + 21}" r="3"/><circle cx="100" cy="${DC_Y + 42}" r="3"/></g>`;
}
// 오늘 날짜: 그 숫자를 굵게, 양옆에 괄호 (판 색 테두리로 옆 숫자와 떼어 놓음)
function lcdDay(day, v = 'lcd') {
  const c = DC_INK[v], row = DC.rows.find(r => day >= r[0] && day <= r[1]), x = 100 + (day - row[0] - (row[1] - row[0]) / 2) * row[2], y = row[3];
  const half = 10.8, bh = 6.4, bw = 1.9, br = s => { const bx = x + s * half; return `M${(bx + s * -bw).toFixed(2)} ${y - bh}H${bx.toFixed(2)}V${y + bh}H${(bx + s * -bw).toFixed(2)}`; };
  return `<text x="${x}" y="${y}" font-size="${DC.fs * 1.08}" fill="${c.today}" stroke="${c.cut}" stroke-width="2.4" paint-order="stroke" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:800">${pad(day)}</text>`
    + `<path d="${br(-1)}${br(1)}" fill="none" stroke="${c.cut}" stroke-width="3.2"/><path d="${br(-1)}${br(1)}" fill="none" stroke="${c.today}" stroke-width="1.2"/>`;
}
// 맨 위 로고: 헤더 로고(clock.css .brand)와 같은 짜임 — 스파인(위아래 막대, 02 / [ 03 ] / 04) | 점선 | pebbly labs | 꺾쇠 ┐┘
// 자리·크기는 헤더 로고를 글자 크기(em) 기준으로 잰 값. 글자 크기 10 단위, 판 가운데 위(y 33)에
function lcdLogo(ink) {
  const E = 10, W = 10.6242, H = 1.4228, x0 = 100 - W * E / 2, y0 = 33 - H * E / 2, X = v => (x0 + v * E).toFixed(2), Y = v => (y0 + v * E).toFixed(2);
  const mono = (t, y, fs, op) => `<text x="${X(1.0036)}" y="${Y(y)}" font-size="${(fs * E).toFixed(2)}"${op ? ` opacity="${op}"` : ''} text-anchor="middle" dominant-baseline="central" style="font-family:var(--mono);font-weight:${op ? 400 : 800};white-space:pre">${t}</text>`;
  return `<g fill="${ink}"><rect x="${X(0)}" y="${Y(0)}" width="${(2.0072 * E).toFixed(2)}" height=".7"/><rect x="${X(0)}" y="${(y0 + H * E - .7).toFixed(2)}" width="${(2.0072 * E).toFixed(2)}" height=".7"/>`
    + mono('02', .278, .3654, .45) + mono('[ 03 ]', .7114, .4615) + mono('04', 1.1449, .3654, .45)
    + `<text x="${X(3.2091)}" y="${Y(.7111)}" font-size="${E}" textLength="${(6.3003 * E).toFixed(2)}" lengthAdjust="spacing" dominant-baseline="central" style="font-family:var(--logo);font-weight:800;word-spacing:-.3em">pebbly labs</text></g>`
    + `<path d="M${X(2.6081)} ${Y(0)}V${Y(H)}" stroke="${ink}" stroke-width=".46" stroke-dasharray="1.4 1"/>`
    + `<path d="M${X(10.317)} ${Y(.0385)}H${X(10.5857)}V${Y(.3457)}M${X(10.5857)} ${Y(H - .3457)}V${Y(H - .0385)}H${X(10.317)}" fill="none" stroke="${ink}" stroke-width=".77"/>`;
}
function lcdParts(pre, v = 'lcd') {
  const id = n => `url(#${pre}${n})`, [wx, wy, ww, wh] = DC.win, c = DC_INK[v], st = c.steel, w = c.win;
  const defs = `<linearGradient id="${pre}g-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${st[0]}"/><stop offset=".35" stop-color="${st[1]}"/><stop offset=".6" stop-color="${st[2]}"/><stop offset="1" stop-color="${st[3]}"/></linearGradient>`
    + `<linearGradient id="${pre}g-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.face[0]}"/><stop offset="1" stop-color="${c.face[1]}"/></linearGradient>`
    + `<linearGradient id="${pre}g-lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w[1]}"/><stop offset=".12" stop-color="${w[2]}"/><stop offset="1" stop-color="${w[3]}"/></linearGradient>`
    + `<pattern id="${pre}g-brush" width="200" height="1.1" patternUnits="userSpaceOnUse"><rect width="200" height=".4" fill="${c.brush[0]}" opacity="${c.brush[1]}"/></pattern>`;
  let ghost = '';
  DC_X.forEach(x => { ghost += `<path transform="translate(${x} ${DC_Y})" d="${Object.values(DC_SEG).join('')}"/>`; });
  let nums = '';
  for (const [a, b, sp, y] of DC.rows) for (let n = a; n <= b; n++) nums += `<text x="${(100 + (n - a - (b - a) / 2) * sp).toFixed(2)}" y="${y}">${pad(n)}</text>`;
  const face = `<path d="${dcPoly(dcOct(-7, -7, 214, 234, 28), 10)}" fill="${id('g-steel')}"/><path d="${dcPoly(dcOct(-7, -7, 214, 234, 28), 10)}" fill="none" stroke="${c.rim}" stroke-width=".6"/>`
    + `<path d="${dcPoly(dcOct(-1.2, -1.2, 202.4, 222.4, 24.5), 8.5)}" fill="${c.gap}"/>`
    + `<path d="${dcPoly(dcOct(0, 0, 200, 220, 24), 8)}" fill="${id('g-face')}"/><path d="${dcPoly(dcOct(0, 0, 200, 220, 24), 8)}" fill="${id('g-brush')}"/>`
    + lcdLogo(c.ink)
    + `<rect x="${wx - .8}" y="${wy - .8}" width="${ww + 1.6}" height="${wh + 1.6}" rx="3.6" fill="${w[0]}"/><rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="3" fill="${id('g-lcd')}"/>`
    + `<g fill="${c.ghost[0]}" opacity="${c.ghost[1]}">${ghost}<circle cx="100" cy="${DC_Y + 21}" r="3"/><circle cx="100" cy="${DC_Y + 42}" r="3"/></g>`
    + `<g font-size="${DC.fs}" fill="${c.num}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:500">${nums}</g>`;
  return { defs, face };
}
let dcTheme = '', dcMin = '', dcDay = 0;
function drawLcd(v) {
  const p = lcdParts('dc-', v);
  $('dc-face').innerHTML = `<defs>${p.defs}</defs>${p.face}<g id="dc-time"></g><g id="dc-day"></g>`;
  dcTheme = v; dcMin = ''; dcDay = 0;
}

// ===== 쿼츠 시계판 (설정 › 테마 › 쿼츠) =====
// 검은 둥근 벽시계: 광택 플라스틱 테 / 무광 검은 판 가장자리에 분 눈금(정시는 길게)·흰 숫자 1~12 / 안쪽은 한 단 낮은 검은 원판
// 위에 pebbly labs·quartz, 아래(사과 로고 자리)에 [ 03 ], 6시 눈금 양옆에 Made in | Korea
// 크림색 막대 시침·분침(그림자), 노란 초침. 200×200 단위·가운데 0,0 (index.html viewBox)
function quartzParts(pre) {
  const id = n => `url(#${pre}${n})`, f = v => v.toFixed(2);
  const defs = `<linearGradient id="${pre}case" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4a4d"/><stop offset=".3" stop-color="#1b1b1d"/><stop offset=".7" stop-color="#0a0a0b"/><stop offset="1" stop-color="#2c2c2f"/></linearGradient>`
    + `<radialGradient id="${pre}in" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#151517"/><stop offset="1" stop-color="#09090a"/></radialGradient>`
    + `<radialGradient id="${pre}sheen" cx=".3" cy=".2" r=".65"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + `<filter id="${pre}sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".7" dy="1.2" stdDeviation=".9" flood-color="#000" flood-opacity=".75"/></filter>`;
  // 테 → 판 → 안쪽 원판(테두리에 살짝 빛) → 분 눈금(6시 양옆 두 칸씩은 글자 자리) → 숫자
  let face = `<circle r="100" fill="${id('case')}"/><circle r="99.4" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width=".6"/><circle r="96.4" fill="#0c0c0d"/>`
    + `<circle r="67.6" fill="#000" opacity=".6"/><circle r="67" fill="${id('in')}"/><circle r="67" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".6"/>`;
  let ticks = '';
  for (let k = 0; k < 60; k++) {
    if ([28, 29, 31, 32].includes(k)) continue;
    const hr = k % 5 === 0, [x1, y1] = drPt(k * 6, hr ? 87.4 : 89.6), [x2, y2] = drPt(k * 6, 93.4);
    ticks += `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke-width="${hr ? 1.5 : .7}"/>`;
  }
  face += `<g stroke="#e9e9e9">${ticks}</g><g font-size="14.6" fill="#f1f1f1" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:400">`;
  for (let h = 1; h <= 12; h++) { const [x, y] = drPt(h * 30, 78.2); face += `<text x="${f(x)}" y="${f(y + .4)}">${h}</text>`; }
  // 로고: 위에 pebbly labs·quartz, 아래에 [ 03 ](테두리 없이), 6시 양옆 Made in | Korea
  face += '</g>'
    + `<text y="-46" font-size="7" fill="#ededed" text-anchor="middle" dominant-baseline="central" style="font-family:var(--logo);font-weight:800;word-spacing:-.3em">pebbly labs</text>`
    + `<text y="-38.6" font-size="3.6" fill="#cfcfcf" text-anchor="middle" dominant-baseline="central" style="font-family:var(--brand);font-weight:400;letter-spacing:.1px">quartz</text>`
    + `<text y="38" font-size="5.6" fill="#f1f1f1" text-anchor="middle" dominant-baseline="central" style="font-family:var(--mono);font-weight:800;white-space:pre">[ 03 ]</text>`
    + `<g font-size="3.1" fill="#d6d6d6" dominant-baseline="central" style="font-family:var(--brand);font-weight:400"><text x="-2.6" y="91.2" text-anchor="end">Made in</text><text x="2.6" y="91.2">Korea</text></g>`
    + `<circle r="96.4" fill="${id('sheen')}"/>`;
  // 크림색 막대 바늘(끝으로 살짝 가늘게, 가운데 뒤로 조금 나옴), 가운데 덮개
  const hand = (L, w0, w1, tail) => `<path d="M${-w0 / 2} ${tail}L${-w1 / 2} ${-L}H${w1 / 2}L${w0 / 2} ${tail}Z" fill="#ece6d4"/>`;
  return {
    defs, face, hour: hand(64, 5.2, 4.4, 5), minute: hand(90, 4, 3.2, 6),
    hub: '<circle r="3.6" fill="#1c1c1d" stroke="#8a8a8c" stroke-width=".8"/><circle r="1.1" fill="#9a9a9c"/>',
    sec: '<path d="M0 16V-91" stroke="#f3c21b" stroke-width=".9" stroke-linecap="round"/><circle r="2.4" fill="#f3c21b"/><circle r=".8" fill="#6d5a12"/>',
  };
}
let dwDrawn = false;
function drawQuartz() {
  const p = quartzParts('dw-');
  $('dw-face').innerHTML = `<defs>${p.defs}</defs>${p.face}`;
  $('dw-h').innerHTML = p.hour; $('dw-m').innerHTML = p.minute; $('dw-hub').innerHTML = p.hub; $('dw-sec').innerHTML = p.sec;
  dwDrawn = true;
}

// ===== 로터리 시계판 (설정 › 테마 › 로터리) =====
// 바늘 대신 숫자 링이 돎: 바깥 흰 링(초 0~59) / 짙은 회색 링(분 0~59, 흰 숫자) / 가운데 흰 판(시 1~12) — 링마다 지금 값이 3시 쪽 빨간 표시선에 오도록
// 거꾸로 돌려서 맞춤(초마다 살짝 늦게 툭, 59 → 0은 한 칸 앞으로). 숫자는 바깥을 향해 눕혀 써서 표시선 자리에서 바로 읽힘
// 왼쪽 반은 검은 판(빨간 반원 테)이 덮고 날짜·시각·요일 알약. 가장자리에 점 눈금 60개. 200×200 단위·가운데 0,0, 원래 그림 480px를 줄인 값(k)
const DK = { k: 100 / 240, font: 'font-family:BenchNine,var(--brand);font-weight:400' };
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function rotaryParts(pre) {
  const k = DK.k, f = v => v.toFixed(2), id = n => `url(#${pre}${n})`, P = n => n * k;
  // 판 가장자리 안쪽 그림자(원래 inset 그림자): 반지름 비율 a부터 바깥으로 진해짐
  const rim = (n, a, o) => `<radialGradient id="${pre}${n}"><stop offset="${a}" stop-color="#000" stop-opacity="0"/><stop offset="${(a + 1) / 2}" stop-color="#000" stop-opacity="${o * .35}"/><stop offset="1" stop-color="#000" stop-opacity="${o}"/></radialGradient>`;
  const defs = rim('rw', .9, .75) + rim('rm', .84, .95) + rim('rh', .9, .45)
    + `<linearGradient id="${pre}dot"><stop offset="0" stop-color="#7d7e7d"/><stop offset="1" stop-color="#0e0e0e"/></linearGradient>`
    + `<linearGradient id="${pre}cast"><stop offset="0" stop-color="#000" stop-opacity=".85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`
    + `<clipPath id="${pre}cl"><circle r="${f(P(220))}"/></clipPath>`;
  // 링: 숫자 v는 3시에서 시계방향 v·step도, 반지름 r에 바깥을 향해 눕혀서. 눈금은 숫자 사이(da도 옆)에 짧게, 다섯 칸마다(두 번째부터) 길고 진하게
  const ring = (vals, step, r, fs, fill, tk, cls = '') => {
    let s = `<g${cls ? ` class="${cls}"` : ''} font-size="${f(P(fs))}" fill="${fill}" text-anchor="middle" dominant-baseline="central" style="${DK.font}">`;
    for (const v of vals) s += `<text transform="rotate(${v * step}) translate(${f(P(r))} 0)">${v}</text>`;
    s += `</g><g fill="${tk.c}">`;
    vals.forEach((v, i) => {
      const long = i % 5 === 1, [r1, r2] = long ? tk.l : tk.s;
      s += `<rect transform="rotate(${f(v * step + tk.da)})" x="${f(P(r1))}" y="${f(-P(.5))}" width="${f(P(r2 - r1))}" height="${f(P(1))}"${long || tk.o === 1 ? '' : ` opacity="${tk.o}"`}/>`;
    });
    return s + '</g>';
  };
  const n60 = Array.from({ length: 60 }, (_, i) => i), n12 = Array.from({ length: 12 }, (_, i) => i + 1);
  let dots = '';
  for (let s = 0; s < 60; s++) { const w = s % 5 ? 4 : 8; dots += `<rect transform="rotate(${s * 6}) translate(${f(P(230))} 0)" x="${f(-P(w / 2))}" y="${f(-P(2))}" width="${f(P(w))}" height="${f(P(4))}" rx="${f(P(2))}" fill="${id('dot')}"/>`; }
  const face = `<circle r="100" fill="#111"/>${dots}<circle r="${f(P(220))}" fill="#fff"/><circle r="${f(P(220))}" fill="${id('rw')}"/>`
    + `<g id="${pre}s">${ring(n60, 6, 195, 12, '#000', { c: '#000', da: -3, s: [216, 220], l: [212, 219], o: .3 }, 'dk-snum')}</g>`
    + `<circle r="${f(P(175))}" fill="#333"/><circle r="${f(P(175))}" fill="${id('rm')}"/>`
    + `<g id="${pre}m">${ring(n60, 6, 145, 16, '#fff', { c: '#fff', da: -3, s: [171, 175], l: [167, 174], o: .3 })}</g>`
    + `<circle r="${f(P(125))}" fill="#fff"/><circle r="${f(P(125))}" fill="${id('rh')}"/>`
    + `<g id="${pre}h">${ring(n12, 30, 100, 32, '#000', { c: '#000', da: 4.7, s: [121, 125], l: [117, 124], o: 1 })}</g>`
    // 표시선: 가운데에서 3시 쪽 흰 판 끝까지 빨간 선, 양끝에 서로 마주 보는 삼각형
    + `<path d="M0 ${f(P(3))}H${f(P(220))}" stroke="#000" stroke-width="${f(P(4))}" opacity=".15"/>`
    + `<path d="M0 0H${f(P(220))}" stroke="red" stroke-width="${f(P(1))}"/>`
    + `<path d="M${f(P(2))} ${f(-P(7))}L${f(P(9))} 0L${f(P(2))} ${f(P(7))}ZM${f(P(220))} ${f(-P(7))}L${f(P(213))} 0L${f(P(220))} ${f(P(7))}Z" fill="red"/>`
    // 왼쪽 검은 판(오른쪽으로 그림자) + 빨간 반원 테 + 날짜·시각·요일 알약
    + `<rect x="${f(P(2))}" y="-100" width="${f(P(20))}" height="200" fill="${id('cast')}" clip-path="${id('cl')}"/>`
    + `<path d="M${f(P(2))} ${f(-P(222))}A${f(P(222))} ${f(P(222))} 0 0 0 ${f(P(2))} ${f(P(222))}Z" fill="#090909"/>`
    + `<path d="M${f(P(3))} ${f(-P(192.5))}A${f(P(192.5))} ${f(P(192.5))} 0 0 0 ${f(P(3))} ${f(P(192.5))}" fill="none" stroke="#8e0a0a" stroke-width="${f(P(15))}"/>`
    + [['date', -110, 16], ['time', 0, 24], ['day', 110, 16]].map(([n, y, fs]) =>
      `<rect id="${pre}${n}-bg" x="${f(-P(18))}" y="${f(P(y - fs * .62 - 2))}" width="0" height="${f(P(fs * 1.24 + 4))}" rx="${f(P(fs * .62 + 2))}" fill="#111" stroke="#000" stroke-opacity=".7" stroke-width="${f(P(2.4))}"/>`
      + `<text id="${pre}${n}" x="${f(-P(38))}" y="${f(P(y + 1))}" font-size="${f(P(fs))}" fill="#fff" text-anchor="end" dominant-baseline="central" style="${DK.font}"></text>`).join('');
  return { defs, face };
}
// 날짜·시각·요일 글자와 알약(글자 폭 + 양옆 20)
function rotaryText(pre, d, root = document) {
  const q = n => root.querySelector(`#${pre}${n}`), h = d.getHours();
  const txt = { date: `${d.getDate()} . ${MONTH_EN[d.getMonth()]}`, day: DAY_EN[d.getDay()],
    time: S.hour12 ? `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}` : `${h}:${pad(d.getMinutes())}` };
  for (const n in txt) {
    const t = q(n), bg = q(n + '-bg');
    t.textContent = txt[n];
    const fs = parseFloat(t.getAttribute('font-size')), w = t.getComputedTextLength() || txt[n].length * fs * .42;
    bg.setAttribute('x', (-DK.k * 18 - w - DK.k * 40).toFixed(2)); bg.setAttribute('width', (w + DK.k * 40).toFixed(2));
  }
}
// 링 돌리기: 가까운 쪽으로(59 → 0은 한 칸 앞으로), 처음엔 바로
const dkAng = {};
function dkTurn(id, deg) {
  const el = $(id), a = dkAng[id];
  dkAng[id] = a == null ? deg : a + ((deg - a) % 360 + 540) % 360 - 180;
  el.style.transition = a == null ? 'none' : '';
  el.style.transform = `rotate(${dkAng[id]}deg)`;
}
let dkDrawn = false, dkMin = '';
function drawRotary() {
  const p = rotaryParts('dk-');
  $('dk-face').innerHTML = `<defs>${p.defs}</defs>${p.face}`;
  for (const k in dkAng) delete dkAng[k];
  dkDrawn = true; dkMin = '';
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
