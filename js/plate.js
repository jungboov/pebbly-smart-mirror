// Pebbly Mirror — 양각 판: 디데이·집중 타이머 위젯의 양각·양각 블랙 테마
// ===== 판 (logo.js의 조각 lgRaise·lgSink·색 LG_INK·그림자 lgShadow를 그대로 씀) =====
// 테마(설정 › 테마 › 디데이·집중 타이머): 평면(미러 기본 흰 글자) · 양각(흰 판) · 양각 블랙(흑연색 판) — S.plate
// 판 하나가 위젯 칸을 채움. 그림 단위는 rem의 1/4(태블릿에선 칸 픽셀의 절반)이라 로고 판과 배율이 비슷하고, 폰처럼 rem이 작은 화면에서도 글자 비율이 같음
// 인쇄(판에 찍힌 작은 글자·눈금)는 그림자 없이 맨 위에 — 작은 글자가 번지지 않게
const PLATE_THEMES = [['flat', '평면'], ['emboss', '양각'], ['embossk', '양각 블랙']];
const plFlat = () => !LG_INK[S.plate];
// 글자 조각: x, y(글자 바닥선), 크기, 내용, 굵기, 맞춤 → 색을 받아 <text>. 한글은 로고 글꼴에 없어서 Pretendard로
const plText = (x, y, size, txt, w = 600, anchor = 'start') => c =>
  `<text x="${+x.toFixed(2)}" y="${+y.toFixed(2)}" font-size="${+size.toFixed(2)}" fill="${c}" text-anchor="${anchor}" style="font-family:var(--logo);font-weight:${w}">${txt}</text>`;
// 꺾쇠 ┐┘ (로고처럼 오른쪽 끝 위아래) · 숫자 창 위아래 막대(로고 스파인)
const plBrackets = (W, H) => c => `<path d="M${W - 30} 14H${W - 14}V30M${W - 30} ${H - 14}H${W - 14}V${H - 30}" fill="none" stroke="${c}" stroke-width="2"/>`;
const plBars = (x, w, y1, y2) => c => `<rect x="${x}" y="${y1}" width="${w}" height="2.8" fill="${c}"/><rect x="${x}" y="${y2}" width="${w}" height="2.8" fill="${c}"/>`;
const plDash = (x1, y1, x2, y2) => c => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="1.25" stroke-dasharray="4 4"/>`;
// 판에 인쇄한 읽을 글자(제목·날짜·버튼 글자·안내) 색 — 장식(눈금·낮은 숫자)보다 진하게
const PL_INK = { emboss: '#8c837f', embossk: '#8e8e95' };
// 판 SVG. build(k)가 조각을 그려 문자열로 돌려줌
//   k.up(조각, 높이 0~1) 도드라짐 · k.print(조각) 장식 인쇄 · k.ink(조각) 읽을 글자 인쇄 · k.sink(조각) 파냄 · k.clip(x, y, w, h) 그 네모 밖을 잘라 내는 clip-path 주소
//   pre: 같은 화면에 판이 여럿일 때 겹치지 않는 id 앞글자
function plateSvg(W, H, ink, pre, build) {
  const m = LG_INK[ink], printed = [], clips = [];
  const k = { W, H,
    up: (s, h = 1) => lgRaise(s, m, h),
    print: s => { printed.push(s(m.print)); return ''; },
    ink: s => { printed.push(s(PL_INK[ink])); return ''; },
    sink: s => lgSink(s, LG_INK[ink === 'embossk' ? 'debossk' : 'deboss']),
    clip: (x, y, w, h) => { const id = pre + 'c' + clips.length; clips.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`); return `url(#${id})`; } };
  const body = build(k);
  return `<svg class="pl" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs>`
    + `<radialGradient id="${pre}b" cx=".4" cy=".35" r=".9"><stop offset="0" stop-color="${m.bg[0]}"/><stop offset="1" stop-color="${m.bg[1]}"/></radialGradient>${lgShadow(m, pre + 's')}${clips.join('')}</defs>`
    + `<rect width="${W}" height="${H}" rx="14" fill="url(#${pre}b)"/><g${m.sh ? ` filter="url(#${pre}s)"` : ''}>${body}</g>${printed.join('')}</svg>`;
}
// 위젯 칸 크기 → 판 그림 단위(rem/4). 칸이 안 보이면(상세 화면) 0
// 판을 위아래로 쌓을지(세로로 길거나 정사각형에 가까운 칸: 가로 화면·폰 가로) — 아니면 왼쪽·오른쪽으로 나눔(가로로 긴 칸: 세로 화면)
const plTall = (W, H) => H > W * .8;
const plSize = el => {
  const r = el.getBoundingClientRect(), u = parseFloat(getComputedStyle(document.documentElement).fontSize) / 4 || 2;
  return [Math.round(r.width / u), Math.round(r.height / u)];
};

// 설정 › 테마 카드: 작은 디데이 판(만난 지 412일)으로 보여 줌
function plCards() {
  const thumb = id => id === 'flat'
    ? `<svg viewBox="0 0 160 90" aria-hidden="true"><rect width="160" height="90" rx="10" fill="#000" stroke="#262626"/>`
      + `<text x="16" y="28" font-size="11" fill="#a3a3a3" style="font-weight:700">만난 지</text>`
      + `<text x="16" y="70" font-size="36" fill="#fff" style="font-family:var(--num);font-weight:900">412<tspan dx="4" font-size="11" fill="#a3a3a3" style="font-family:var(--brand);font-weight:700">일</tspan></text></svg>`
    : plateSvg(160, 90, id, `th-pl-${id}-`, k => k.ink(plText(14, 22, 7, 'd-day', 500)) + k.up(plText(14, 38, 10, '만난 지', 700), .6)
      + k.up(plText(80, 74, 34, '412<tspan font-size="10" dx="2" style="font-weight:700">일</tspan>', 600, 'middle')) + k.up(plBrackets(160, 90)));
  return PLATE_THEMES.map(([id, name]) => `<button class="th-card${id === S.plate ? ' on' : ''}" data-plate-theme="${id}">${thumb(id)}<span>${name}</span></button>`).join('');
}
// 테마·화면 크기가 바뀌면 두 위젯을 다시 그림 (applySettings·화면 회전)
function plApply() {
  if (!PLATE_THEMES.some(t => t[0] === S.plate)) S.plate = 'flat';
  cdRender(); foBuild(); cdSetRender(); digiApply();
}

// ===== 디지털 양각·양각 블랙 (설정 › 테마 › 시계, S.digi) =====
// 시계 칸 뒤에 판을 깔고, 굴러가는 숫자는 그대로 도드라진 글자(옆면 6겹·빛 테)로 — 모양은 clock.css, 색은 로고 판 색(LG_INK)에서 여기서 넣음
// 스톱워치·타이머·알람 숫자와 버튼도 같이. 아날로그 시계를 고르면 꺼짐
const plRgba = (hex, a) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;
function digiApply() {
  const m = LG_INK[S.digi], on = !S.analog && !!m, st = $('clock').style;
  if (document.body.classList.contains('digi-pl') !== on) {   // 글꼴이 바뀌어서 숫자 폭을 다시 잼 (MuseoModerno를 받은 뒤 한 번 더)
    document.body.classList.toggle('digi-pl', on);
    measureDigits();
    if (on) document.fonts.load('600 100px MuseoModerno', '0123456789:').then(() => { measureDigits(); [setH1, setH2, setM1, setM2].forEach(s => s.refresh()); fitClock(); }).catch(() => {});
  }
  if (!on) return;
  const key = dvMix(m.bg[0], m.top, .5), v = { '--pl0': m.bg[0], '--pl1': m.bg[1], '--top': m.top, '--hi': m.hi, '--ink': PL_INK[S.digi],
    '--key': key, '--key-on': dvMix(key, m.side[0], .12), '--colon': dvMix(m.top, m.side[0], .3), '--dim': dvMix(m.top, m.side[0], .5),
    '--sh1': plRgba(m.sh[0], m.sh[1]), '--sh2': plRgba(m.sh[0], m.sh[1] * .6) };
  for (let i = 1; i <= 6; i++) v['--s' + i] = dvMix(m.side[1], m.side[0], i / 6);   // 옆면: 위(밝음) → 바닥(어두움), lgRaise와 같은 색
  for (const [k, c] of Object.entries(v)) st.setProperty(k, c);
}
// 설정 › 테마 › 시계 카드의 작은 그림: 판에 도드라진 10 / 08
const digiThumb = (id, ink) => plateSvg(80, 80, ink, `th-${id}-`, k => k.up(c => `<g fill="${c}" font-weight="900" font-size="26" text-anchor="end" style="font-family:var(--num)"><text x="62" y="38">10</text><text x="62" y="68">08</text></g>`));
let plResize = 0;
window.addEventListener('resize', () => { clearTimeout(plResize); plResize = setTimeout(() => { cdRender(); foBuild(); }, 250); });
