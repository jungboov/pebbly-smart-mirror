// Pebbly Mirror — 디지털 양각 시계판 (설정 › 테마 › 시계 › 디지털 양각·양각 블랙, 시계 강조 화면)
// ===== 로고 판 구성: 위아래 막대 사이 창 안에 시·분 릴, 아래 줄 왼쪽 날짜 · 오른쪽 초 (스톱워치·타이머·알람의 아래 줄과 같은 짜임) =====
// 숫자는 로고와 같은 MuseoModerno — 가운데는 600으로 높이 솟고, 위(지난)·아래(다음) 숫자는 500으로 작고 낮게 창 안에서 반쯤 (02 [ 03 ] 04처럼)
// 값이 바뀌면 그 릴만 한 칸 굴러 올라감(0.6초). 조각·색·그림자는 위젯 판과 같은 부품(plate.js plateSvg, logo.js lgRaise)
// 시계 칸 크기·자리는 평면 디지털과 같이 fitClock이 정하고(HTML 시계는 숨김), 이 판은 그 칸을 채움 — 세로 화면은 아래 2.8rem을 위젯과 사이로 남김
// 스톱워치·타이머·알람 화면에서는 숨기고 HTML 숫자(양각 모양, clock.css)가 판 위에 나옴
// 가로로 긴 칸(세로 화면): [ 시 : 분 ] / 날짜 요일 ···· 37 sec
// 세로로 긴 칸(가로 화면): 시 위 · 분 아래 두 창으로 쌓는 게 숫자가 더 크면(8% 넘게) 쌓음 / 날짜(두 줄) ···· 37 sec
const DG_EASE = t => 1 - (1 - t) ** 3;
let dgLay = null, dgKey = '', dgShown = null;
const dgRaf = {};
const dgOn = () => document.body.classList.contains('digi-pl') && document.body.classList.contains('sb');
// 릴 값: 시(12·24시간제), 분·초 — i칸 뒤(앞)의 값
function dgVal(kind, d, i) {
  if (kind === 's') return pad(((d.getSeconds() + i) % 60 + 60) % 60);
  if (kind === 'm') return pad(((d.getMinutes() + i) % 60 + 60) % 60);
  const h = ((d.getHours() + i) % 24 + 24) % 24;
  return pad(S.hour12 ? h % 12 || 12 : h);
}
// 릴 하나(p: 0 지금 값이 가운데, -1 지난 값이 가운데 — 구를 때 -1 → 0)
function dgReel(r, kind, d, p) {
  const m = LG_INK[S.digi], step = r.s * .62;
  let o = '';
  for (let i = Math.floor(p) - 1; i <= Math.ceil(p) + 1; i++) {
    const dd = i - p, near = Math.max(0, 1 - Math.abs(dd)), sz = r.s * (.5 + .5 * near);
    o += lgMark(c => `<text x="${r.x.toFixed(1)}" y="${(r.cy + dd * step + sz * .36).toFixed(1)}" font-size="${sz.toFixed(1)}" fill="${c}" text-anchor="middle" style="font-family:var(--logo);font-weight:${near > .5 ? 600 : 500}">${dgVal(kind, d, i)}</text>`, m, .25 + .75 * near);
  }
  return o;
}
// 글자 폭(판 그림 단위 = 글자 크기 px와 같음) — 날짜 옆 요일 자리, 초 옆 sec 자리
function dgTextW(t, size, w) {
  const c = dgTextW.c || (dgTextW.c = document.createElement('canvas').getContext('2d'));
  c.font = `${w} ${size}px ${getComputedStyle(document.documentElement).getPropertyValue('--logo')}`;
  return c.measureText(t).width;
}
// 날짜 줄 나누기: 날짜(15) 다음 요일·공휴일·오전/오후(13). 가로로 긴 칸은 한 줄에 들면 한 줄, 아니면 날짜 / 나머지(폭 maxW를 넘으면 ' · '에서 또 나눔)
function dgDateLines(d, wide, maxW) {
  const ds = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`, dsW = dgTextW(ds, 15, 600) + 12;
  const parts = [WEEK[d.getDay()] + '요일', holidayName(ymd(d)), S.hour12 ? (d.getHours() < 12 ? '오전' : '오후') : ''].filter(Boolean);
  const sub = parts.join(' · ');
  if (wide && dsW + dgTextW(sub, 13, 700) <= maxW) return [[ds, sub, dsW]];
  const out = [[ds]];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (out.length > 1 && dgTextW(last[0] + ' · ' + p, 13, 700) <= maxW) last[0] += ' · ' + p; else out.push([p]);
  }
  return out;
}
// 날짜가 바뀌거나 오전·오후가 바뀌면 판을 새로 (날짜 줄 글자)
const dgStamp = d => ymd(d) + (S.hour12 && d.getHours() >= 12 ? 'p' : 'a');
// 자리 잡기: 판 그림 단위(W×H)에서 시·분 창, 아래 줄(날짜 · 초) 자리
// 위아래 여백 28, 양옆 26 — 시·분 묶음과 아래 줄을 한 덩어리로 판 가운데에
function dgLayout(W, H) {
  const dw = 2 * (digitW ? Math.max(...Object.values(digitW)) : .62) + .04;   // 두 자리 폭(em, 가장 넓은 숫자 기준 — 분이 바뀌어도 안 흔들림)
  const wide = W > H * 1.05, date = S.date, secs = S.secs, avail = W - 52, lblW = dgTextW('sec', 9, 500);
  // 날짜 줄은 초(가장 클 때 30) 왼쪽까지 — 아래 줄 높이는 날짜 줄 수(첫 줄 15 + 다음 줄마다 20)와 초 중 큰 쪽
  const lines = date ? dgDateLines(new Date(), wide, (secs ? W - 26 - lblW - 4 - 30 * dw - 3 - 14 : W - 26) - 26) : [];
  const footH = Math.max(lines.length ? 16 + (lines.length - 1) * 20 + (lines.length > 1 ? 2 : 0) : 0, secs ? 24 : 0), gap = footH ? 16 : 0;
  // 숫자 크기: 한 줄(시 : 분)은 폭 2자리×2 + 콜론, 두 줄은 2자리 폭 — 높이는 창 1.24em(두 줄은 2.62em, 창 사이 .14em)
  const fit = n => Math.min(avail / (n === 1 ? 2 * dw + .42 : dw + .1), (H - 56 - footH - gap) / (n === 1 ? 1.24 : 2.62));
  const st = !wide && fit(2) > fit(1) * 1.08, s = fit(st ? 2 : 1), bh = s * (st ? 2.62 : 1.24), gH = bh + gap + footH, y0 = (H - gH) / 2, r = s * 1.24;
  const L = { wide, st, W, H };
  if (st) {   // 시 위 · 분 아래, 창마다 위아래 막대(판 폭 가득) — 시의 아래 숫자와 분의 위 숫자가 붙어 보이지 않게 창 사이를 띄움
    const g = s * .14;
    Object.assign(L, { bars: [[20, W - 40, y0, y0 + r], [20, W - 40, y0 + r + g, y0 + 2 * r + g]], h: { x: W / 2, cy: y0 + r / 2, s }, m: { x: W / 2, cy: y0 + r * 1.5 + g, s },
      win: [[y0 + 2.8, r - 5.6], [y0 + r + g + 2.8, r - 5.6]] });
  } else {
    const cw = s * dw, tw = 2 * cw + s * .42, x0 = 26 + (avail - tw) / 2, cy = y0 + r / 2;
    Object.assign(L, { bars: [[x0 - 6, tw + 12, cy - s * .62, cy + s * .62]], h: { x: x0 + cw / 2, cy, s }, m: { x: x0 + tw - cw / 2, cy, s }, colon: { x: x0 + cw + s * .21, cy, s },
      win: [[cy - s * .62 + 2.8, s * 1.24 - 5.6]] });
  }
  const yb = y0 + gH - 2;   // 아래 줄 글자 바닥선
  // 날짜 줄: 맨 아래 줄이 바닥선 yb, 위로 20씩(첫 줄과 둘째 줄 사이는 22)
  L.date = lines.map((l, i) => ({ y: yb - (lines.length - 1 - i) * 20 - (i === 0 && lines.length > 1 ? 2 : 0), l }));
  if (secs) {   // 초: 지금 숫자만 보이게 잘라서(넘어갈 때 굴러 올라가는 것만 보임), 오른쪽 끝에 sec
    const s2 = Math.min(30, s * .3), x = W - 26 - lblW - 4 - s2 * dw / 2, cy = yb - s2 * .36;
    L.s = { x, cy, s: s2, clip: [x - s2 * dw / 2 - 3, cy - s2 * .42, s2 * dw + 6, s2 * .84] };
    L.lbl = yb;
  }
  return L;
}
// 판 전체 다시 그림 (크기·테마·날짜·시간제가 바뀔 때). roll이면 바뀐 릴만 굴림
function dgRender() {
  const box = $('dg');
  if (!dgOn()) { box.innerHTML = ''; dgKey = ''; dgShown = null; return; }
  const ck = $('clock'), rem = parseFloat(getComputedStyle(document.documentElement).fontSize), u = rem / 4;
  const gapB = innerHeight > innerWidth ? 2.8 * rem : 0, W = Math.round(ck.offsetWidth / u), H = Math.round((ck.offsetHeight - gapB) / u);
  if (!W || !H) return;
  const d = new Date(), L = dgLayout(W, H);
  box.innerHTML = plateSvg(W, H, S.digi, 'dgp-', k => {   // id 앞글자는 릴 묶음(dg-h·dg-m·dg-s)과 겹치지 않게
    let o = '';
    L.date.forEach(({ y, l }, i) => {   // 첫 줄 날짜(옆에 요일이 들면 같이), 다음 줄부터 요일·공휴일·오전/오후
      if (i) { o += k.up(plText(26, y, 13, l[0], 700), .5); return; }
      o += k.up(plText(26, y, 15, l[0], 600), .6);
      if (l[1]) o += k.up(plText(26 + l[2], y, 13, l[1], 700), .5);
    });
    const clips = L.win.map(w => k.clip(0, w[0], W, w[1]));
    for (const b of L.bars) o += k.up(plBars(...b), .6);
    o += `<g id="dg-h" clip-path="${clips[0]}"></g><g id="dg-m" clip-path="${clips[clips.length - 1]}"></g>`;
    if (L.colon) o += k.up(c => `<text x="${L.colon.x.toFixed(1)}" y="${(L.colon.cy + L.colon.s * .3).toFixed(1)}" font-size="${(L.colon.s * .8).toFixed(1)}" fill="${c}" text-anchor="middle" style="font-family:var(--logo);font-weight:600">:</text>`, .8);
    if (L.s) {
      o += `<g id="dg-s" clip-path="${k.clip(...L.s.clip)}"></g>`;
      o += k.ink(plText(W - 26, L.lbl, 9, 'sec', 500, 'end'));
    }
    return o;
  }, false, true);   // 바탕 없이 — 판 바탕은 CSS(.dg, 스톱워치·타이머·알람 판과 같은 색·그림자)
  dgLay = L; dgKey = [S.digi, W, H, S.date, S.secs, S.hour12, dgStamp(d)].join();
  dgShown = null;
  dgTick(d, false);
}
// 매초(tickClock): 바뀐 릴만 한 칸 굴림 (처음·움직임 줄이기는 바로)
function dgTick(d, roll = true) {
  if (!dgLay || !dgOn()) return;
  if (dgKey.split(',').pop() !== dgStamp(d)) { dgRender(); return; }   // 날짜(오전·오후)가 바뀌면 판을 새로
  const now = { h: dgVal('h', d, 0), m: dgVal('m', d, 0), s: dgVal('s', d, 0) };
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const kind of ['h', 'm', 's']) {
    const r = dgLay[kind], g = $('dg-' + kind);
    if (!r || !g) continue;
    if (dgShown && dgShown[kind] === now[kind]) continue;
    cancelAnimationFrame(dgRaf[kind]);
    if (!roll || !dgShown || calm) { g.innerHTML = dgReel(r, kind, d, 0); continue; }
    const t0 = performance.now();
    const step = t => {
      if (!dgOn()) return;   // 구르는 중에 평면·아날로그로 바꾸면 멈춤 (디지털 테마가 아니면 lgMark에 줄 색이 없음)
      const k = Math.min(1, (t - t0) / 600);
      g.innerHTML = dgReel(r, kind, d, -1 + DG_EASE(k));
      if (k < 1) dgRaf[kind] = requestAnimationFrame(step);
    };
    dgRaf[kind] = requestAnimationFrame(step);
  }
  dgShown = now;
}
