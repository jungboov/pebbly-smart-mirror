// Pebbly Mirror — 디지털 양각 시계판 (설정 › 테마 › 시계 › 디지털 양각·양각 블랙, 시계 강조 화면)
// ===== 로고 판 구성 그대로: 날짜 / 위아래 막대 사이 창 안에 시·분 릴 | 점선 | 초 릴 / 꺾쇠 ┐┘ =====
// 숫자는 로고와 같은 MuseoModerno — 가운데는 600으로 높이 솟고, 위(지난)·아래(다음) 숫자는 500으로 작고 낮게 창 안에서 반쯤 (02 [ 03 ] 04처럼)
// 값이 바뀌면 그 릴만 한 칸 굴러 올라감(0.6초). 조각·색·그림자는 위젯 판과 같은 부품(plate.js plateSvg, logo.js lgRaise)
// 시계 칸 크기·자리는 평면 디지털과 같이 fitClock이 정하고(HTML 시계는 숨김), 이 판은 그 칸을 채움 — 세로 화면은 아래 2.8rem을 위젯과 사이로 남김
// 스톱워치·타이머·알람 화면에서는 숨기고 HTML 숫자(양각 모양, clock.css)가 판 위에 나옴
// 가로로 긴 칸(세로 화면): 날짜 / [ 시 : 분 ] | 초 · 세로로 긴 칸(가로 화면): 날짜 / [ 시 : 분 ] / 점선 / 초
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
// 자리 잡기: 판 그림 단위(W×H)에서 날짜·창·릴·점선 자리
function dgLayout(W, H) {
  const dw = 2 * (digitW ? Math.max(...Object.values(digitW)) : .62) + .04;   // 두 자리 폭(em, 가장 넓은 숫자 기준 — 분이 바뀌어도 안 흔들림)
  const date = S.date ? 1 : 0, secs = S.secs;
  if (W > H * 1.05) {
    const top = date ? 66 : 30, bot = H - 30, xr = secs ? W * .78 : W - 30, avail = xr - 26 - 20;
    const s = Math.min((bot - top) * .56, avail / (2 * dw + .42)), cw = s * dw, tw = 2 * cw + s * .42, x0 = 26 + (avail - tw) / 2, cy = (top + bot) / 2;
    const L = { wide: true, W, H, bars: [x0 - 6, tw + 12, cy - s * .62, cy + s * .62],
      h: { x: x0 + cw / 2, cy, s }, m: { x: x0 + tw - cw / 2, cy, s }, colon: { x: x0 + cw + s * .21, cy, s }, win: [cy - s * .62 + 2.8, s * 1.24 - 5.6] };
    if (secs) { const s2 = Math.min(s * .44, (W - xr - 34) / (dw + .3)); L.dash = [xr, 28, xr, H - 28]; L.s = { x: (xr + W - 14) / 2, cy, s: s2 }; }
    return L;
  }
  // 세로로 긴 칸: 같은 [ 시 : 분 ] 한 줄을 가운데에, 초는 그 아래 점선 다음
  const top = date ? 76 : 30, avail = W - 52, s0 = avail / (2 * dw + .42);
  const s2 = secs ? Math.min(s0 * .44, 32) : 0, secB = secs ? s2 * 1.9 + 52 : 0, bot = H - 26 - secB;
  const s = Math.min(s0, (bot - top) * .56), cw = s * dw, tw = 2 * cw + s * .42, x0 = 26 + (avail - tw) / 2, cy = (top + bot) / 2;
  const L = { wide: false, W, H, bars: [x0 - 6, tw + 12, cy - s * .62, cy + s * .62],
    h: { x: x0 + cw / 2, cy, s }, m: { x: x0 + tw - cw / 2, cy, s }, colon: { x: x0 + cw + s * .21, cy, s }, win: [cy - s * .62 + 2.8, s * 1.24 - 5.6] };
  if (secs) { const y = cy + s * .62 + 18; L.dash = [26, y, W - 26, y]; L.s = { x: W / 2, cy: y + 14 + s2 * .95, s: s2 }; }
  return L;
}
// 판 전체 다시 그림 (크기·테마·날짜·시간제가 바뀔 때). roll이면 바뀐 릴만 굴림
function dgRender() {
  const box = $('dg');
  if (!dgOn()) { box.innerHTML = ''; dgKey = ''; dgShown = null; return; }
  const ck = $('clock'), rem = parseFloat(getComputedStyle(document.documentElement).fontSize), u = rem / 4;
  const gapB = innerHeight > innerWidth ? 2.8 * rem : 0, W = Math.round(ck.offsetWidth / u), H = Math.round((ck.offsetHeight - gapB) / u);
  if (!W || !H) return;
  const d = new Date(), L = dgLayout(W, H), m = LG_INK[S.digi];
  const wd = WEEK[d.getDay()] + '요일', hol = holidayName(ymd(d)), ap = S.hour12 ? (d.getHours() < 12 ? '오전' : '오후') : '';
  box.innerHTML = plateSvg(W, H, S.digi, 'dgp-', k => {   // id 앞글자는 릴 묶음(dg-h·dg-m·dg-s)과 겹치지 않게
    let o = k.up(plBrackets(W, H));
    if (S.date) {
      const ds = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`, sub = [wd, hol, ap].filter(Boolean).join(' · ');
      o += k.up(plText(26, 42, 15, ds, 600), .6);
      o += L.wide ? k.up(plText(26 + ds.length * 8.4 + 8, 42, 13, sub, 700), .5) : k.up(plText(26, 62, 13, sub, 700), .5);
    }
    const [bx, bw, by1, by2] = L.bars, clip = k.clip(0, L.win[0], W, L.win[1]);
    o += k.up(plBars(bx, bw, by1, by2), .6);
    o += `<g id="dg-h" clip-path="${clip}"></g><g id="dg-m" clip-path="${clip}"></g>`;
    if (L.colon) o += k.up(c => `<text x="${L.colon.x.toFixed(1)}" y="${(L.colon.cy + L.colon.s * .3).toFixed(1)}" font-size="${(L.colon.s * .8).toFixed(1)}" fill="${c}" text-anchor="middle" style="font-family:var(--logo);font-weight:600">:</text>`, .8);
    if (L.s) {
      const r = L.s;
      o += k.up(plDash(...L.dash), .5);
      o += k.up(plBars(r.x - r.s * .78, r.s * 1.56, r.cy - r.s * .95, r.cy + r.s * .95, 2.2), .6);
      o += `<g id="dg-s" clip-path="${k.clip(r.x - r.s * 2, r.cy - r.s * .95 + 2.2, r.s * 4, r.s * 1.9 - 4.4)}"></g>`;
      o += k.ink(plText(r.x, r.cy + r.s * 1.55, 9, 'sec', 500, 'middle'));
    }
    return o;
  });
  dgLay = L; dgKey = [S.digi, W, H, S.date, S.secs, S.hour12, ymd(d)].join();
  dgShown = null;
  dgTick(d, false);
}
// 매초(tickClock): 바뀐 릴만 한 칸 굴림 (처음·움직임 줄이기는 바로)
function dgTick(d, roll = true) {
  if (!dgLay || !dgOn()) return;
  if (dgKey.split(',').pop() !== ymd(d)) { dgRender(); return; }   // 날짜가 바뀌면 판을 새로
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
      const k = Math.min(1, (t - t0) / 600);
      g.innerHTML = dgReel(r, kind, d, -1 + DG_EASE(k));
      if (k < 1) dgRaf[kind] = requestAnimationFrame(step);
    };
    dgRaf[kind] = requestAnimationFrame(step);
  }
  dgShown = now;
}
