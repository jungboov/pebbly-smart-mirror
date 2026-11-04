// Pebbly Mirror — 로고 위젯
// ===== 로고: 양각·음각 pebbly labs 판 (시계 강조 화면 위젯) =====
// 스파인(위아래 막대 · [ 03 ] 숫자 릴) | 점선 | pebbly labs | 꺾쇠 ┐┘ — 헤더 로고와 같은 짜임(인트로 로고 360×120 단위), 글꼴도 로고와 같은 MuseoModerno
// 테마(설정 › 테마 › 로고 위젯): 양각(흰 판에 도드라짐) · 양각 다크(흑연색) · 음각(흰 판을 파냄) · 음각 다크
// 도드라진 조각은 양각 시계판처럼 옆면(오른쪽 아래로, 바닥 쪽이 어둡게)·왼쪽 위 빛 테·그림자, 파낸 조각은 아래 오른쪽 가장자리 빛·위 왼쪽 안쪽 그림자
// 위젯이 나타날 때마다 숫자 릴이 한 바퀴(100칸) 점점 느려지며 돌아 다시 03에 멈춤(인트로와 같은 1.7초), 위젯이 화면에 있는 동안은 설정한 초마다 다시
// 가운데 숫자만 높이 솟고 위아래는 낮게(음각은 위아래가 인쇄)
// 판 [가운데, 가장자리], 윗면, 옆면 [바닥, 위], 왼쪽 위 빛 테, 낮은 숫자 인쇄 색, 그림자 [색, 진하기] / 음각: 바닥면, 아래 오른쪽 가장자리 빛, 위 왼쪽 안쪽 그림자
const LG_INK = {
  emboss: { bg: ['#ebe5e3', '#d3cbc8'], top: '#f7f3f1', side: ['#8a827e', '#d2cbc8'], hi: '#ffffff', print: '#b6ada9', sh: ['#2b211e', .34] },
  embossk: { bg: ['#2a2a2d', '#121214'], top: '#4b4b51', side: ['#000000', '#26262a'], hi: '#a3a3aa', print: '#3a3a3e', sh: ['#000000', .85] },
  deboss: { bg: ['#ebe5e3', '#d3cbc8'], face: '#d4ccc9', lo: '#ffffff', hi: '#7c7470', print: '#b6ada9' },
  debossk: { bg: ['#2a2a2d', '#121214'], face: '#161618', lo: '#606066', hi: '#000000', print: '#3a3a3e' },
};
const LG_THEMES = [['emboss', '양각'], ['embossk', '양각 다크'], ['deboss', '음각'], ['debossk', '음각 다크']];
const LG_FONT = "font-family:var(--logo)";
let lgNW = 0;   // pebbly labs 폭(27 글자 크기) — 글꼴을 받은 뒤 잼
const lgNameW = () => {
  if (!lgNW) { const c = document.createElement('canvas').getContext('2d'); c.font = '400 27px MuseoModerno'; lgNW = c.measureText('pebbly labs').width || 172; }
  return lgNW;
};
// 도드라짐(h 0~1 높이 — 0이면 판에 인쇄된 것처럼) / 파냄
function lgRaise(shape, m, h = 1) {
  const ex = .55 * h, ey = 1.15 * h, n = Math.max(1, Math.round(6 * h));
  let s = '';
  if (h > .05) {
    for (let j = n; j >= 1; j--) s += `<g transform="translate(${(ex * j / n).toFixed(2)} ${(ey * j / n).toFixed(2)})">${shape(dvMix(m.side[0], m.side[1], 1 - (j - 1) / n))}</g>`;
    s += `<g transform="translate(${(-.32 * h).toFixed(2)} ${(-.32 * h).toFixed(2)})">${shape(dvMix(m.print, m.hi, h))}</g>`;
  }
  return s + shape(dvMix(m.print, m.top, h));
}
const lgSink = (shape, m) => `<g transform="translate(.35 .45)">${shape(m.lo)}</g><g transform="translate(-.35 -.45)">${shape(m.hi)}</g>${shape(m.face)}`;
// 도드라진 조각 묶음의 그림자: 가까운 진한 그림자 + 오른쪽 아래로 퍼지는 옅은 그림자 (양각 테마만, 디데이·집중 타이머 판도 씀)
const lgShadow = (m, fid) => m.sh ? `<filter id="${fid}" x="-10%" y="-20%" width="120%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation=".7"/><feOffset dx=".5" dy="1.3" result="a"/>`
  + `<feFlood flood-color="${m.sh[0]}" flood-opacity="${m.sh[1]}"/><feComposite in2="a" operator="in" result="s1"/><feGaussianBlur in="SourceAlpha" stdDeviation="2.4"/><feOffset dx="1.6" dy="3.6" result="b"/>`
  + `<feFlood flood-color="${m.sh[0]}" flood-opacity="${m.sh[1] * .8}"/><feComposite in2="b" operator="in" result="s2"/><feMerge><feMergeNode in="s2"/><feMergeNode in="s1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : '';
// 숫자 릴: p는 가운데 숫자(3이면 03에 멈춘 모습), 위아래로 22 간격, 가운데에서 멀수록 작고 낮게
function lgReel(v, p) {
  const m = LG_INK[v], k0 = Math.floor(p);
  let s = '';
  for (let k = k0 - 2; k <= k0 + 3; k++) {
    const d = k - p, near = Math.max(0, 1 - Math.abs(d)), val = String(((k % 100) + 100) % 100).padStart(2, '0');
    const num = c => `<text x="48" y="${(60 + d * 22).toFixed(2)}" font-size="${(11 + 2 * near).toFixed(2)}" fill="${c}" text-anchor="middle" dominant-baseline="central" style="${LG_FONT};font-weight:${near > .5 ? 600 : 500}">${val}</text>`;
    s += m.side ? lgRaise(num, m, .25 + .75 * near) : near > .5 ? lgSink(num, m) : num(m.print);
  }
  return s;
}
// 판 전체 SVG (pre: 같은 화면에 여러 개를 그릴 때 겹치지 않는 id 앞글자)
function logoSvg(v, pre, p = 3) {
  const m = LG_INK[v], W = 110 + lgNameW() + 14, VW = W + 46, id = n => pre + n;
  const draw = s => m.side ? lgRaise(s, m) : lgSink(s, m);
  const frame = c => `<rect x="20" y="16.6" width="56" height="2.8" fill="${c}"/><rect x="20" y="100.6" width="56" height="2.8" fill="${c}"/>`
    + `<text x="48" y="60" font-size="13" fill="${c}" text-anchor="middle" dominant-baseline="central" xml:space="preserve" style="${LG_FONT};font-weight:600">[ <tspan fill-opacity="0">03</tspan> ]</text>`
    + `<path d="M92 18V102" stroke="${c}" stroke-width="1.25" stroke-dasharray="4 4"/>`
    + `<path d="M${W} 18H${W + 14}V32M${W} 102H${W + 14}V88" fill="none" stroke="${c}" stroke-width="2"/>`;
  const name = c => `<text x="110" y="60" font-size="27" fill="${c}" dominant-baseline="central" style="${LG_FONT};font-weight:400">pebbly labs</text>`;
  const sh = lgShadow(m, id('s'));
  return `<svg viewBox="0 0 ${VW.toFixed(1)} 120" style="--lg-r:${(VW / 120).toFixed(3)}" aria-hidden="true"><defs>`
    + `<radialGradient id="${id('b')}" cx=".4" cy=".35" r=".9"><stop offset="0" stop-color="${m.bg[0]}"/><stop offset="1" stop-color="${m.bg[1]}"/></radialGradient>${sh}`
    + `<clipPath id="${id('c')}"><rect x="20" y="22" width="56" height="76"/></clipPath></defs>`
    + `<rect width="${VW.toFixed(1)}" height="120" rx="14" fill="url(#${id('b')})"/><g${m.sh ? ` filter="url(#${id('s')})"` : ''}>${draw(frame)}${draw(name)}`
    + `<g id="${id('reel')}" clip-path="url(#${id('c')})">${lgReel(v, p)}</g></g></svg>`;
}
// 숫자 다시 돌기(설정 › 테마 › 로고 위젯): 한 바퀴 멈춘 뒤 몇 초마다 다시 — 0이면 나타날 때만
const LG_SPIN = [0, 3, 5, 10, 15, 20, 30, 60];
// 위젯: 테마가 바뀌면(처음 포함) 다시 그림, 다시 돌기 간격 글자 — applySettings가 부름
let lgTheme = '', lgEvery = -1;
function lgApply() {
  if (!LG_INK[S.logoTheme]) S.logoTheme = 'emboss';
  if (!LG_SPIN.includes(S.logoSpin)) S.logoSpin = 5;
  $('set-lgspin').textContent = S.logoSpin ? S.logoSpin + '초마다' : '끔';
  if (S.logoSpin !== lgEvery) { const was = lgEvery; lgEvery = S.logoSpin; if (was >= 0 && panelName === 'logo') lgSpin(); }   // 간격을 바꾸면 바로 새 간격으로
  if (S.logoTheme === lgTheme) return;
  lgTheme = S.logoTheme;
  $('lg-box').innerHTML = logoSvg(lgTheme, 'lg-');
}
// 숫자 스핀: 위젯이 넘어 들어온 뒤(0.3초) 1.7초 동안 점점 느려지며 한 바퀴 → 03, 그 뒤 S.logoSpin초마다 다시
// 로고 위젯이 화면에 있는 동안만 — 다른 위젯으로 넘어가면 돌던 것도 03에 멈추고 다음 차례를 거름. 움직임 줄이기를 켠 기기는 안 돎
let lgRaf = 0, lgWait = 0;
function lgSpin(wait = 300) {
  clearTimeout(lgWait); cancelAnimationFrame(lgRaf);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  lgWait = setTimeout(() => {
    if (panelName !== 'logo') return;
    const t0 = performance.now(), ease = t => 1 - (1 - t) ** 3;
    const step = now => {
      const t = Math.min(1, (now - t0) / 1700), reel = $('lg-reel');
      if (!reel) return;
      if (panelName !== 'logo') { reel.innerHTML = lgReel(lgTheme, 3); return; }   // 넘어가면 바로 03에 멈춤
      reel.innerHTML = lgReel(lgTheme, 3 - 100 + 100 * ease(t));
      if (t < 1) lgRaf = requestAnimationFrame(step);
      else if (S.logoSpin > 0) lgSpin(S.logoSpin * 1000);
    };
    lgRaf = requestAnimationFrame(step);
  }, wait);
}
// 설정 › 테마 › 로고 위젯 카드 (settings.js thRender)
const lgCards = () => LG_THEMES.map(([id, name]) =>
  `<button class="th-card${id === S.logoTheme ? ' on' : ''}" data-logo-theme="${id}">${logoSvg(id, `th-lg-${id}-`)}<span>${name}</span></button>`).join('');
// 글꼴을 받으면 이름 폭을 다시 재서 다시 그림
document.fonts.load("400 27px MuseoModerno", 'pebbly labs').then(() => { lgNW = 0; lgTheme = ''; if (typeof S !== 'undefined') { lgApply(); if ($('lg-list').children.length) $('lg-list').innerHTML = lgCards(); } }).catch(() => {});
