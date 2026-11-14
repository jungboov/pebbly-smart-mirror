// Pebbly Mirror — 위젯 판: 지금 날씨·시간별·일별·공기·교통·달력·사진 액자의 양각·음각
// ===== 위젯 판 =====
// 위젯 모양(설정 › 위젯 › 모양, S.plate)이 평면이 아니면 시계 강조 화면에서 이 위젯들도 디데이·집중 타이머처럼 판으로 그림 (plate.js plateSvg)
//   라이트 양각·다크 양각은 도드라지고, 라이트 음각·다크 음각은 판을 파냄 — 조각마다 k.up 하나로 테마를 따름
// 원래(평면) 글자는 자리만 잡고 숨기고, 판(.pw)을 칸 위에 덮음. 사진 액자는 판에 창을 내고 그 안에 사진
// 구성은 디데이 판과 같음: 왼쪽 위 작은 인쇄 제목(now · 부천) · 점선 · 숫자는 로고 글꼴(MuseoModerno). 여백은 왼쪽·오른쪽 모두 20(예전 오른쪽 꺾쇠 ┐┘는 뺌)
// 다시 그림: 날씨·공기·해·교통·달력·사진 순번을 그린 끝에(pwDraw), 테마·화면 크기가 바뀔 때(plApply), 로고 글꼴을 받은 뒤
const PW_EL = { now: '.wmain', hourly: '.hourly', daily: '.wave', air: '.cards', transit: '.transit', cal: '.cal', photo: '.photo' };
const pwOn = () => !plFlat();   // 시계 강조 화면·상세 화면 모두 (상세는 지금 날씨·일별·시간별·공기가 한 화면에 각자 판)
const pf = v => +(+v).toFixed(1);
// 글자 폭(판 단위, 크기 size) — 로고 글꼴, 없는 글자(한글)는 Pretendard / 칸 폭에 맞게 줄인 크기
const pwCtx = document.createElement('canvas').getContext('2d');
function pwW(txt, size, w = 600) {
  pwCtx.font = `${w} 100px MuseoModerno, "Pretendard Variable", Pretendard, sans-serif`;
  return pwCtx.measureText(String(txt)).width * size / 100;
}
const pwFit = (txt, size, maxW, w = 600) => Math.min(size, size * maxW / Math.max(1, pwW(txt, size, w)));
// 선 그림(24칸, weather.js ICONS·정보 칸 아이콘)을 왼쪽 위 x, y에 크기 s로. 선 굵기는 판 단위 sw로 일정
const pwPath = (body, x, y, s, sw = 1.4) => c => `<g transform="translate(${pf(x)} ${pf(y)}) scale(${(s / 24).toFixed(4)})" fill="none" stroke="${c}" `
  + `stroke-width="${(sw * 24 / s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
// 날씨 그림: 구름 뒤 작은 해·달은 구름 모양만큼 가림(판이 비치게 — 평면은 검은 바탕을 칠해 가림), 눈 점은 굵게
function pwIco(k, kind, day, x, y, s, sw = 1.4) {
  const occ = k.pre + 'occ';
  if (!k.occ) {
    k.occ = 1;
    k.def(`<mask id="${occ}" maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32"><rect x="-4" y="-4" width="32" height="32" fill="#fff"/>`
      + `<path d="M18.5 12.5h-.95A6.2 6.2 0 1 0 11.6 20.5h6.9a4 4 0 0 0 0-8z" fill="#000" stroke="#000" stroke-width="3"/></mask>`);
  }
  const body = kind === 'clear' ? (day ? ICONS.sun : ICONS.moon)
    : kind === 'partly' ? `<g mask="url(#${occ})">${day ? ICONS.smallSun : ICONS.smallMoon}</g>${ICONS.frontCloud.replace(' class="occ"', '')}`
    : (ICONS[kind] || ICONS.cloud).replace(' class="dots"', ` stroke-width="${(sw * 24 / s * 1.9).toFixed(2)}"`);
  return pwPath(body, x, y, s, sw);
}
// 모든 판에 같은 것: 왼쪽 위 인쇄 제목(칸 폭에 맞춰 줄임 — room은 오른쪽 끝에 둔 버튼 자리)
const pwHead = (k, W, txt, room = 0) => k.ink(plText(20, 28, pwFit(txt, 11, W - 40 - room, 500), esc(txt), 500));
// 기온 → 판 높이: 칸 가운데 기준, 1°당 높이는 최고·최저 차이가 작아도 8°가 칸 80%가 되게(최대 1°당 10 — 몇 도 차이가 판 가득 출렁이지 않게)
function pwTempY(temps, y0, y1) {
  const t = temps.map(Math.round), lo = Math.min(...t), hi = Math.max(...t), mid = (hi + lo) / 2;
  const per = Math.min((y1 - y0) * .8 / Math.max(hi - lo, 8), 10);
  return t.map(v => (y0 + y1) / 2 + (mid - v) * per);
}
const pwLine = (pts, sw = 1.4) => c => `<path d="${smoothPath(pts)}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
const pwDot = (x, y, r) => c => `<circle cx="${pf(x)}" cy="${pf(y)}" r="${pf(r)}" fill="${c}"/>`;
// 공기 등급 색(인쇄한 작은 점): 좋음 파랑 · 보통 초록 · 나쁨 주황 · 매우나쁨 빨강
const PW_GRADE = { good: '#3d86e0', normal: '#2fa866', bad: '#ec8a2a', worst: '#df4545' };

// ── 지금 날씨: 큰 그림 | 큰 기온·체감 / 날씨 이름·어제와 비교 / 점선 / 정보 6칸
//   가로로 긴 판은 정보 한 줄, 세로로 긴 판은 3칸 2줄, 아주 납작한 판(태블릿 세로)은 왼쪽 날씨 | 오른쪽 정보 3칸 2줄
//   낮은 판(상세 화면)은 높이를 재서 덜어 냄 — 정보 칸은 그림을 빼고, 날씨 이름 아래 비교는 이름 옆으로(안 들면 뺌), 그래도 낮으면 체감을 뺌. 글자끼리 안 겹치게
function pwNow(k, W, H) {
  const w = state.weather, c = w && w.current;
  let o = pwHead(k, W, `now · ${placeLabel()}`);
  if (!c) return o + k.ink(plText(20, H / 2, 12, '날씨를 불러오는 중', 600));
  const tall = plTall(W, H), flat = W > H * 1.55, x1 = W - 20, kind = wmo(c.weather_code)[1], day = c.is_day === 1;
  const temp = $('w-temp').textContent, feel = $('w-feel').textContent, desc = $('w-title').textContent, diff = $('w-diff').textContent;
  // 정보 칸들: x0~xe, y0~y1 안에 cols × rows. 칸 하나 = 그림 / 값 / 이름(바닥선 bh) — 칸 높이 rh 안에(위아래 칸이 안 겹치게)
  const stats = (x0, xe, y0, y1, cols, rows) => {
    const cw = (xe - x0) / cols, rh = (y1 - y0) / rows;
    if (rh < 27) return statsLine(x0, y0, cw, rh, cols);
    let is = Math.min(14, rh * .24, cw * .32), vs = Math.min(18, rh * .32, cw * .34);
    if (is + 5 + vs + 14 > rh - 3) {   // 낮은 칸: 그림·값을 같이 줄이고(그림 9까지), 그래도 안 들면 그림을 빼고 값만
      const room = rh - 3 - 14 - 5;
      if (room >= 9 + 10) { const f = room / (is + vs); is *= f; vs *= f; if (is < 9) { vs -= 9 - is; is = 9; } }
      else { is = 0; vs = Math.max(8, Math.min(18, cw * .34, rh - 3 - 14)); }
    }
    const bh = (is ? is + 5 : 0) + vs + 12;
    let t = '';
    ['s-wind', 's-hum', 's-rain', 's-hi', 's-lo', 's-uv'].forEach((cls, i) => {
      const el = document.querySelector('.w-stats .' + cls);
      if (!el) return;
      const cx = x0 + cw * (i % cols + .5), y = y0 + rh * Math.floor(i / cols) + (rh - bh) / 2;
      const v = el.querySelector('.c-val'), val = v.firstChild ? v.firstChild.textContent : '-', unit = (v.querySelector('small') || {}).textContent || '';
      const name = el.querySelector('.c-name').textContent, sub = /s-(hi|lo)/.test(cls) ? '' : el.querySelector('.c-sub').textContent;
      const vf = pwFit(val + unit, vs, cw - 6, 500);
      // 이름: 칸이 좁아 너무 작아지면 뒤 설명(북동·쾌적·오늘·낮음)을 빼고 이름만
      let lab = [name, sub].filter(Boolean).join(' '), lf = pwFit(lab, 8.5, cw - 4);
      if (lf < 7 && sub) { lab = name; lf = pwFit(name, 8.5, cw - 4); }
      if (is) t += k.up(pwPath(el.querySelector('svg').innerHTML, cx - is / 2, y, is, 1.3), .5);
      t += k.up(plText(cx, y + (is ? is + 5 : 0) + vf * .78, vf, esc(val) + (unit ? `<tspan font-size="${pf(vf * .5)}" dx="1">${esc(unit)}</tspan>` : ''), 500, 'middle'), .8);
      t += k.ink(plText(cx, y + bh, lf, esc(lab), 600, 'middle'));
    });
    return t;
  };
  // 아주 낮은 칸: 이름과 값을 한 줄에(바람 3.0m/s) — 칸 폭에 안 들면 둘 다 줄이고, 이름이 너무 작아지면 뒤 설명을 뺌
  const statsLine = (x0, y0, cw, rh, cols) => {
    let t = '';
    ['s-wind', 's-hum', 's-rain', 's-hi', 's-lo', 's-uv'].forEach((cls, i) => {
      const el = document.querySelector('.w-stats .' + cls);
      if (!el) return;
      const v = el.querySelector('.c-val'), val = v.firstChild ? v.firstChild.textContent : '-', unit = (v.querySelector('small') || {}).textContent || '';
      const name = el.querySelector('.c-name').textContent, sub = /s-(hi|lo)/.test(cls) ? '' : el.querySelector('.c-sub').textContent;
      const vw = f => pwW(val, f, 500) + (unit ? pwW(unit, f * .5, 500) + 1 : 0);
      let lab = [name, sub].filter(Boolean).join(' '), vs = Math.min(15, rh - 6), ls = 8.5;
      let f = Math.min(1, (cw - 8) / (pwW(lab, ls) + 4 + vw(vs)));
      if (ls * f < 7 && sub) { lab = name; f = Math.min(1, (cw - 8) / (pwW(lab, ls) + 4 + vw(vs))); }
      ls *= f; vs *= f;
      const lw = pwW(lab, ls), x = x0 + cw * (i % cols + .5) - (lw + 4 + vw(vs)) / 2, y = y0 + rh * (Math.floor(i / cols) + .5) + vs * .36;
      t += k.ink(plText(x, y, ls, esc(lab), 600));
      t += k.up(plText(x + lw + 4, y, vs, esc(val) + (unit ? `<tspan font-size="${pf(vs * .5)}" dx="1">${esc(unit)}</tspan>` : ''), 500), .8);
    });
    return t;
  };
  // 그림·기온(위 줄, 20~xb, 위 끝 yT) / 날씨 이름·어제와 비교(마지막 줄 바닥선 yB) — 위 줄 높이는 남는 만큼
  const hero = (xb, yT, yB) => {
    const hw = xb - 20, dw = diff ? pwW(diff, 10.5, 600) : 0;
    let ds = 18, under = !!diff, beside = false;
    const topOf = () => yB - (under ? 17 : diff ? 0 : 4) - (ds * .75 + 8.5) - yT;   // 이름 바닥선은 위 줄 끝에서 22 아래(18 기준)
    let topH = topOf();
    if (topH < 32 && under) { under = false; beside = pwW(desc, ds, 700) + 10 + dw <= hw; topH = topOf(); }   // 비교를 이름 옆으로, 안 들면 뺌
    if (topH < 28) { ds = Math.max(12, ds - (28 - topH) / .75); topH = topOf(); }
    const s = Math.max(10, Math.min(topH, hw * .4)), feelW = pwW(feel, 11, 700);
    const feelOn = topH >= 32 && feelW <= hw - s - 8;
    const ts = pwFit(temp, feelOn ? Math.min(topH * .74, (topH - 18) / .78) : topH * .9, hw - s - 14, 500);
    let t = k.up(pwIco(k, kind, day, 18, yT, s, Math.max(1.4, s / 34)), .9);
    // 기온은 오른쪽 끝(체감이 아래에) — 체감을 뺀 낮은 판은 그림 바로 옆에(멀리 떨어져 보이지 않게)
    t += feelOn ? k.up(plText(xb, yT + ts * .78, ts, esc(temp), 500, 'end')) : k.up(plText(18 + s + 10, yT + (s + ts * .72) / 2, ts, esc(temp), 500));
    if (feelOn) t += k.tx(plText(xb, yT + ts * .78 + 18, 11, esc(feel), 700, 'end'), .45);
    const yD = yB - (under ? 17 : diff ? 0 : 4), df = pwFit(desc, ds, beside ? hw - 10 - dw : hw, 700);
    t += k.tx(plText(20, yD, df, esc(desc), 700), .6);
    if (under) t += k.ink(plText(20, yB, pwFit(diff, 10.5, hw), esc(diff), 600));
    else if (beside) t += k.ink(plText(20 + pwW(desc, df, 700) + 10, yD, 10.5, esc(diff), 600));
    return t;
  };
  if (flat) {   // 왼쪽 날씨 | 오른쪽 정보 — 두 줄이 낮으면(한 줄 26 아래) 6칸 한 줄
    const xm = Math.round(W * .47), two = (H - 12 - 42) / 2 >= 20;
    o += hero(xm, 46, H - 14) + k.up(plDash(xm + 14, 46, xm + 14, H - 16), .5) + stats(xm + 26, x1, 42, H - 12, two ? 3 : 6, two ? 2 : 1);
  } else {      // 위 날씨 / 아래 정보 — 세로로 긴 판이나 6칸이 좁으면 3칸 2줄
    const six = !tall && (x1 - 20) / 6 >= 30;
    let stH = six ? Math.min(H * .3, 84) : Math.min(H * .34, 116);
    if ((stH - 4) / (six ? 1 : 2) < 27) stH = (six ? 1 : 2) * 21 + 4;   // 정보 칸이 낮아 한 줄 배치면 그만큼만 — 남는 높이는 날씨 쪽에
    const ys = H - 14 - stH;
    o += hero(x1, 46, ys - 11) + k.up(plDash(20, ys, x1, ys), .5) + stats(20, x1, ys + 4, H - 14, six ? 6 : 3, six ? 1 : 2);
  }
  return o;
}

// ── 시간별: 시각 / 그림 / 기온 · 기온 곡선(점, 지금은 크게) · 강수확률 막대(파낸 홈에 솟은 막대, 30% 이상은 숫자)
//   낮은 판: 기온을 곡선의 점 바로 위에 얹음(기온 줄을 따로 두지 않음) — 곡선 높낮이는 남는 만큼, 모자라면 그림·기온을 줄이고 그래도 안 되면 그림을 뺌
function pwHourly(k, W, H) {
  let o = pwHead(k, W, 'hourly');
  const w = state.weather, h = w && w.hourly;
  if (!h) return o;
  const now = new Date(), i0 = h.time.indexOf(`${ymd(now)}T${pad(now.getHours())}:00`);
  if (i0 < 0) return o;
  const idx = range(Math.min(CONFIG.standbyHours, h.time.length - i0), j => i0 + j), n = idx.length;
  const temps = idx.map((i, j) => j === 0 ? w.current.temperature_2m : h.temperature_2m[i]);
  const x1 = W - 20, cw = (x1 - 20) / n, cx = j => 20 + cw * (j + .5);
  let is = Math.min(cw * .44, 22, H * .09), ts = Math.min(cw * .36, 17);
  const yi = 58, yt = yi + is + 6 + ts * .78;
  let bh = plTall(W, H) ? Math.min(40, H * .1) : Math.min(22, H * .08), yb0 = H - 26 - bh;   // 세로로 긴 판은 막대를 길게 — 채운 만큼이 잘 보이게
  let p0 = yt + 12, p1 = yb0 - 12, ride = false;
  if (p1 - p0 < 8) {
    ride = true;
    const fit = () => { p0 = (is ? yi + is + 5 : 54) + ts * .78 + 6.4; p1 = yb0 - 8 - 3.4; };
    fit();
    while (p1 < p0 && (is > 9 || ts > 9)) { is = is && Math.max(9, is - .5); ts = Math.max(9, ts - .5); fit(); }
    if (p1 < p0) { is = 0; fit(); }
    // 곡선 높낮이는 칸 폭의 반 아래로(점 위 기온이 이웃 점으로 가는 선과 안 겹치게), 남는 높이 가운데에
    const band = Math.max(0, Math.min(p1 - p0, cw * .45)), grow = Math.max(0, Math.min((p1 - p0 - band) * .5, 22 - bh));   // 남는 높이 반은 막대를 길게
    bh += grow; yb0 -= grow; p1 -= grow;
    const mid = (p0 + Math.max(p0, p1)) / 2;
    p0 = mid - band / 2; p1 = mid + band / 2;
  }
  const ys = pwTempY(temps, p0, p1), pts = idx.map((_, j) => [cx(j), ys[j]]);
  o += k.up(pwLine([[20, ys[0]], ...pts, [x1, ys[n - 1]]]), .5);
  idx.forEach((i, j) => {
    const first = j === 0, code = first ? w.current.weather_code : h.weather_code[i], day = (first ? w.current.is_day : h.is_day[i]) === 1;
    const lab = first ? '지금' : Number(h.time[i].slice(11, 13)) + '시', r = first ? 3.4 : 2.1;
    o += first ? k.tx(plText(cx(j), 48, 10, lab, 700, 'middle'), .6) : k.ink(plText(cx(j), 48, 10, lab, 600, 'middle'));
    if (is) o += k.up(pwIco(k, wmo(code)[1], day, cx(j) - is / 2, yi, is), first ? .8 : .5);
    o += k.up(plText(cx(j), ride ? pts[j][1] - r - 3 : yt, ts, Math.round(temps[j]) + '°', 500, 'middle'), first ? 1 : .75);
    o += k.up(pwDot(pts[j][0], pts[j][1], r), first ? 1 : .6);
    // 강수확률 막대: 파낸 홈에 확률만큼 채움(양각은 솟고 음각은 칠) — 0%는 빈 홈, 조금이라도 있으면 동그라미 하나만큼은 보이게
    const p = h.precipitation_probability[i] || 0, bx = cx(j) - 2.6, fh = Math.max(bh * p / 100, 5.2);
    o += k.sink(c => `<rect x="${pf(bx)}" y="${pf(yb0)}" width="5.2" height="${pf(bh)}" rx="2.6" fill="${c}"/>`);
    if (p > 0) o += k.fill(c => `<rect x="${pf(bx)}" y="${pf(yb0 + bh - fh)}" width="5.2" height="${pf(fh)}" rx="2.6" fill="${c}"/>`, p >= 30 ? .7 : .4);
    if (p >= 30) o += k.ink(plText(cx(j), H - 14, 8.5, p + '%', 600, 'middle'));
  });
  return o;
}

// ── 일별(어제부터 6일): 요일 / 최고·최저 · 최고기온 곡선 위 동그라미(그림 인쇄, 오늘은 크게 솟고 위아래 점선) · 강수확률 30% 이상(오늘은 늘)
//   낮은 판: 곡선과 기온·강수 줄 사이를 좁히고, 그래도 모자라면 동그라미를 한 줄로(평평하게) — 글자와 동그라미가 안 겹치게
const PW_UMB = '<path d="M2.5 12a9.5 9.5 0 0 1 19 0zM12 12v6a2 2 0 0 1-4 0"/>';
function pwDaily(k, W, H) {
  let o = pwHead(k, W, 'daily');
  const w = state.weather, days = w ? waveDays(w) : [], n = days.length;
  if (!n) return o;
  const d = w.daily, today = ymd(new Date()), x1 = W - 20, cw = (x1 - 20) / n, cx = j => 20 + cw * (j + .5);
  const ts = Math.min(cw * .32, 15), yt = 52 + 8 + ts * .8, nr = Math.min(cw * .27, 12, Math.max(H * .045, 7));
  const yp = H - 16;
  let p0 = yt + 16 + nr, p1 = yp - 18 - nr;
  if (p1 - p0 < 8) { p0 = yt + 7 + nr * 1.2; p1 = yp - 11 - nr * 1.2; }   // 사이를 좁힘(오늘 동그라미는 1.2배)
  if (p1 < p0) p0 = p1 = (p0 + p1) / 2;   // 한 줄로
  const ys = pwTempY(days.map(([, i]) => d.temperature_2m_max[i]), p0, p1), pts = days.map((_, j) => [cx(j), ys[j]]);
  o += k.up(pwLine([[20, ys[0]], ...pts, [x1, ys[n - 1]]]), .5);
  days.forEach(([iso, i], j) => {
    const past = iso < today, now = iso === today, hgt = past ? .25 : now ? 1 : .7;
    const max = Math.round(d.temperature_2m_max[i]), min = Math.round(d.temperature_2m_min[i]);
    o += now ? k.tx(plText(cx(j), 48, 10, '오늘', 700, 'middle'), .6) : k.ink(plText(cx(j), 48, 10, dayLabel(iso), 600, 'middle'));
    const tf = pwFit(`${max}° ${min}°`, ts, cw - 2, 500), r = now ? nr * 1.2 : nr;
    o += k.up(plText(cx(j), yt, tf, `${max}°<tspan font-size="${pf(tf * .55)}" dx="1">${min}°</tspan>`, 500, 'middle'), past ? .25 : .8);
    if (now && pts[j][1] - r - 3 - (yt + 6) > 4) o += k.print(plDash(cx(j), yt + 6, cx(j), pts[j][1] - r - 3));
    o += k.up(pwDot(pts[j][0], pts[j][1], r), hgt * .7);
    o += k.ink(pwIco(k, wmo(d.weather_code[i])[1], true, pts[j][0] - r * .62, pts[j][1] - r * .62, r * 1.24, 1.1));
    // 강수확률: 오늘은 위처럼 동그라미에서 점선을 내려 잇고, 30% 아래여도 보여 줌(글자는 위 '오늘'처럼 낮게 솟음)
    const p = Math.round(d.precipitation_probability_max[i] || 0);
    if (now && yp - 14 - (pts[j][1] + r + 3) > 4) o += k.print(plDash(cx(j), pts[j][1] + r + 3, cx(j), yp - 14));
    if (p >= 30 || now) {   // 우산 + 숫자를 한 덩어리로 칸 가운데에(우산과 숫자 사이 3). 칸이 좁으면 숫자를 줄이고, 그래도 작으면 우산을 뺌
      const pt = p + '%', fw = now ? 700 : 600;
      let umb = true, fs = pwFit(pt, 9, cw - 4 - 12, fw);
      if (fs < 7) { umb = false; fs = pwFit(pt, 9, cw - 4, fw); }
      const w2 = pwW(pt, fs, fw), ux = cx(j) - ((umb ? 12 : 0) + w2) / 2, tx = ux + (umb ? 12 : 0) + w2 / 2;
      if (umb) o += k.ink(pwPath(PW_UMB, ux, yp - 8.5, 9, 1.2));
      o += now ? k.tx(plText(tx, yp, fs, pt, 700, 'middle'), .6) : k.ink(plText(tx, yp, fs, pt, 600, 'middle'));
    }
  });
  return o;
}

// ── 공기·해·달: 미세먼지·초미세먼지(이름 / 큰 수치 / 등급 색 점) · 해(일출·일몰, 점선 반원에 지나온 길이 솟고 해 점) · 달(파낸 원에 밝은 쪽이 솟음)
//   낮은 판: 수치를 이름과 등급 사이에 들게 줄이고, 더 낮으면 수치 옆에 등급 · 해의 반원은 자리가 없으면 빼고 · 달 밝기(%)는 이름과 겹치면 뺌
function pwAir(k, W, H) {
  let o = pwHead(k, W, `air · ${PANELS[3].dataset.src || '예측값'}`);
  const a = state.air, x1 = W - 20, tall = plTall(W, H);
  // 미세먼지·초미세먼지는 짝으로: 둘이 같은 배치(이름 / 수치 / 등급, 또는 낮은 판에선 수치 · 등급 한 줄)와 같은 수치 크기를 씀
  const pmM = (bw, bh, v, gr) => {
    const g = v == null ? null : GRADES[gr(v)], val = v == null ? '-' : String(Math.round(v));
    // 수치는 이름 바닥선(y+11)과 등급 점 위(y+bh-10) 사이에 3씩 띄워서 — 숫자 높이는 크기의 .72
    let vs = pwFit(val, Math.min(bh * .46, 50), bw - 4, 500); const vy = 11 + (bh - 30) / 2 + vs * .38;
    if (vy - vs * .72 < 14 || vy > bh - 13) vs = Math.min(vs, (bh - 27) / .72);
    const gw = g ? 11 + pwW(g[0], 11, 700) : 0, vi = g ? pwFit(val, Math.min(30, (bh - 14 - 2.5) / .72), bw - gw - 10, 500) : 0;
    return { g, val, vs, vi };
  };
  const pmDraw = (x, y, bw, bh, name, m, inl, sz) => {
    const { g, val } = m;
    let s = k.tx(plText(x, y + 11, pwFit(name, 10.5, bw), name, 700), .4);
    if (inl && g) {   // 낮은 판: 이름 / 수치 · 등급을 한 줄에(바닥선 맞춤)
      const vw = pwW(val, sz, 500);
      s += k.up(plText(x, y + bh - 2.5, sz, val, 500));
      return s + k.print(() => `<circle cx="${pf(x + vw + 9.6)}" cy="${pf(y + bh - 6.5)}" r="3.6" fill="${PW_GRADE[g[1]]}"/>`) + k.tx(plText(x + vw + 17, y + bh - 2.5, 11, g[0], 700), .5);
    }
    let vy = y + 11 + (bh - 30) / 2 + sz * .38;
    if (vy - sz * .72 < y + 14 || vy > y + bh - 13) vy = y + 14 + (bh - 27 + sz * .72) / 2;
    s += k.up(plText(x, vy, sz, val, 500));
    if (g) s += k.print(() => `<circle cx="${pf(x + 3.6)}" cy="${pf(y + bh - 6.5)}" r="3.6" fill="${PW_GRADE[g[1]]}"/>`) + k.tx(plText(x + 11, y + bh - 2.5, 11, g[0], 700), .5);
    return s;
  };
  const pmPair = (x, y, bw, gap, bh) => {
    const A = pmM(bw, bh, a && a.pm10, gradePm10), B = pmM(bw, bh, a && a.pm25, gradePm25);
    const vs = Math.min(A.vs, B.vs), vi = A.g && B.g ? Math.min(A.vi, B.vi) : 0, inl = vi >= vs * 1.3, sz = inl ? vi : vs;
    return pmDraw(x, y, bw, bh, '미세먼지', A, inl, sz) + pmDraw(x + bw + gap, y, bw, bh, '초미세먼지', B, inl, sz);
  };
  const moonBlock = (x, y, bw, big) => {   // y: 가운데 줄
    const p = moonPhase(Date.now()), name = MOON_NAMES.find(([lim]) => p < lim)[1], r = big ? 11 : 8;
    let s = k.sink(pwDot(x + r, y, r)) + k.fill(c => `<path transform="translate(${pf(x + r)} ${pf(y)})" d="${moonPath(p, r)}" fill="${c}"/>`, .7);
    const nx = x + r * 2 + 8, ns = pwFit(name, big ? 13 : 11, x + bw - nx, 700), sub = big ? $('moon-next').textContent : $('moon-pct').textContent;
    s += k.tx(plText(nx, y + (big ? -1 : 4), ns, name, 700), .5);
    if (big) s += k.ink(plText(nx, y + 13, pwFit(sub, 9.5, x + bw - nx), sub, 600));
    else if (nx + pwW(name, ns, 700) + 8 + pwW(sub, 9.5) <= x + bw) s += k.ink(plText(x + bw, y + 4, 9.5, sub, 600, 'end'));
    return s;
  };
  const sunBlock = (x, y, bw, bh) => {   // 위 일출·일몰, 아래 반원(반지름 8이 안 되면 뺌)
    const w = state.weather, t = w && w.daily.sunrise && upcomingDays(w)[0];
    if (!t) return '';
    const rise = w.daily.sunrise[t[1]], set = w.daily.sunset[t[1]], f = (Date.now() - new Date(rise)) / (new Date(set) - new Date(rise));
    const tsz = pwFit('00:00', 15, bw / 2 - 6, 600);
    let s = k.ink(plText(x, y + 9, 9, '일출', 600)) + k.ink(plText(x + bw, y + 9, 9, '일몰', 600, 'end'));
    s += k.up(plText(x, y + 13 + tsz * .8, tsz, rise.slice(11, 16), 600), .8) + k.up(plText(x + bw, y + 13 + tsz * .8, tsz, set.slice(11, 16), 600, 'end'), .8);
    const top = y + 22 + tsz, r = Math.min(bw / 2 - 8, y + bh - 6 - top), ax = x + bw / 2, ay = top + r;
    if (r < 8) return s;
    s += k.print(c => `<path d="M${pf(ax - r)} ${pf(ay)}A${pf(r)} ${pf(r)} 0 0 1 ${pf(ax + r)} ${pf(ay)}" fill="none" stroke="${c}" stroke-width="1.2" stroke-dasharray="3 3"/>`
      + `<path d="M${pf(ax - r - 6)} ${pf(ay)}H${pf(ax + r + 6)}" stroke="${c}" stroke-width="1"/>`);
    if (f > 0) {
      const th = Math.PI * (1 - Math.min(f, 1)), sx = ax + r * Math.cos(th), sy = ay - r * Math.sin(th);
      s += k.up(c => `<path d="M${pf(ax - r)} ${pf(ay)}A${pf(r)} ${pf(r)} 0 0 1 ${pf(sx)} ${pf(sy)}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`, .6);
      if (f <= 1) s += k.up(pwDot(sx, sy, 4), 1);
    }
    return s;
  };
  const narrow = !tall && (x1 - 20) * .46 - 36 < 45;   // 가로 배치의 해·달 칸이 너무 좁으면(노트북 상세 화면) 세로 배치로
  if (tall || narrow) {   // 세로로 긴 판: 미세먼지 둘 나란히 / 점선 / 해 / 점선 / 달 — 해 자리가 없으면 맨 아래 줄에 달 | 일출·일몰 시각
    const bw = (x1 - 20 - 18) / 2, mh = 40, bh = Math.min(96, H * .3, H - 18 - mh - 55), y2 = 44 + bh + 14, sh = H - 18 - mh - 12 - y2;
    o += pmPair(20, 44, bw, 18, bh);
    o += k.up(plDash(20 + bw + 9, 46, 20 + bw + 9, 44 + bh), .5) + k.up(plDash(20, y2 - 7, x1, y2 - 7), .5);
    if (sh >= 30) o += sunBlock(20, y2, x1 - 20, sh) + k.up(plDash(20, H - 18 - mh, x1, H - 18 - mh), .5) + moonBlock(20, H - 18 - mh / 2 + 2, x1 - 20, true);
    else { const hw = (x1 - 20) / 2; o += moonBlock(20, H - 18 - mh / 2 + 2, hw - 12, false) + sunBlock(20 + hw + 6, H - 18 - mh + 6, hw - 6, 0); }
  } else {      // 가로로 긴 판: 미세먼지 | 초미세먼지 | 해·달
    const bw = (x1 - 20) * .27, sx = 20 + 2 * bw + 36, bh = H - 44 - 18, sw = x1 - sx;
    o += pmPair(20, 44, bw, 18, bh);
    o += k.up(plDash(20 + bw + 9, 46, 20 + bw + 9, H - 18), .5) + k.up(plDash(sx - 12, 46, sx - 12, H - 18), .5);
    // 해 시각 아래에 달 줄(가운데 H-24, 위 끝 H-32)이 안 들 만큼 낮으면 달은 뺌
    const tsz = pwFit('00:00', 15, sw / 2 - 6, 600), roomy = 44 + 13 + tsz * .8 + 6 <= H - 35;
    o += sunBlock(sx, 44, sw, bh - 26) + (roomy ? moonBlock(sx, H - 24, sw, false) : '');
  }
  return o;
}

// ── 교통: 노선마다 한 칸(타일) — 위 정류장(역) 이름(별칭이 있으면 별칭) / 가운데 이번 도착(아주 크게, 다크 판은 밝게) / 아래 노선 · 다음 도착. 칸 사이 점선
//   (전엔 노선마다 한 줄 — 정류장 이름 · 노선 | 도착이 같은 크기·같은 회색이라 도착이 한눈에 안 들어왔음. 정거장 수는 뺌)
//   칸 수·배치는 transit.js trGrid(칸이 가장 크게 되는 단 수) — 칸이 최소(100×58)보다 작아질 만큼 많으면 쪽을 나눠 넘김(trPage — 제목 줄에 1 / 2, 아래 가운데 쪽 점)
//   제목 줄 오른쪽 끝 새로고침 [ refresh ] — 집중 타이머 판 버튼처럼 낮게 솟은 로고 글꼴(받아 오는 동안 [ ··· ])
//   누르는 건 위에 겹친 평면 버튼 #tr-reload(판에선 투명 — 자리는 여기서 --x·--y·--w·--h로, count.css)
// 칸 폭(maxW)에 맞춘 글자: 크기를 lo까지 줄이고, 그래도 넘치면 뒤를 잘라 … — [글자, 크기]
function pwClip(txt, size, maxW, w = 600, lo = size * .8) {
  const f = pwFit(txt, size, maxW, w);
  if (f >= lo) return [String(txt), f];
  let t = String(txt);
  while (t.length > 1 && pwW(t + '…', lo, w) > maxW) t = t.slice(0, -1);
  return [t + '…', lo];
}
const TR_GAP = 14, TR_MIN = [100, 58];   // 칸 사이(점선 자리) · 칸 최소 폭·높이(판 단위)
function pwTransit(k, W, H) {
  const at = trAt(), rw = S.transit.length ? pwW('[ refresh ]', 11, 600) : 0;
  if (!S.transit.length) { trPages = 1; return pwHead(k, W, 'transit'); }
  const tiles = trTiles(), x0 = 20, x1 = W - 20, top = 42;
  const L = trGrid(tiles.length, x1 - x0, H - 8 - top, H - 20 - top, TR_GAP, ...TR_MIN);
  trPages = L.pages;
  const pg = trPage % L.pages, page = tiles.slice(pg * L.per, pg * L.per + L.per), { cols, cw, ch } = L;
  let o = pwHead(k, W, 'transit' + (at ? ` · ${pad(at.getHours())}:${pad(at.getMinutes())} 기준` : '') + (L.pages > 1 ? ` · ${pg + 1} / ${L.pages}` : ''), rw && rw + 12);
  // 누르는 칸: 판 위 끝 ~ 첫 줄 위(42), 글자 왼쪽 8 ~ 판 오른쪽 끝
  const bt = plText(W - 20, 28, 11, boardBusy ? '[ ··· ]' : '[ refresh ]', 600, 'end'), hit = [W - 28 - rw, 0, rw + 28, top];
  o += k.up(bt, .6) + k.ink(bt);
  Object.entries({ x: hit[0] / W, y: hit[1] / H, w: hit[2] / W, h: hit[3] / H }).forEach(([n, v]) => $('tr-reload').style.setProperty('--' + n, (v * 100).toFixed(2) + '%'));
  // 도착: 숫자 크게 + '분' 작게(급행이면 옆에 작게) / 곧 도착·글자(운행종료·5정거장 전 등)는 작게
  const U = .48, aW = (v, f) => v.n != null ? pwW(v.n, f, 700) + 1.5 + pwW('분', f * U, 600) + (v.x ? 3 + pwW('급행', f * .34, 600) : 0) : pwW(v.soon ? '곧 도착' : v.t, f * (v.soon ? .6 : .5), 700);
  const aTxt = (v, f) => v.n != null ? `${v.n}<tspan font-size="${pf(f * U)}" dx="1.5" style="font-weight:600">분</tspan>` + (v.x ? `<tspan font-size="${pf(f * .34)}" dx="3" style="font-weight:600">급행</tspan>` : '')
    : `<tspan font-size="${pf(f * (v.soon ? .6 : .5))}">${esc(v.soon ? '곧 도착' : v.t)}</tspan>`;
  const bright = LG_INK[S.plate] && LG_INK[S.plate].dark ? '#e4e4ea' : null;   // 다크 판: 큰 도착 숫자를 이름·노선보다 밝게
  const nf = Math.min(15, ch * .2, cw * .12), f1 = Math.min(ch * .5, cw * .3, 40), f3 = Math.min(10.5, Math.max(9, ch * .15));
  page.forEach((t, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = x0 + c * (cw + TR_GAP), y = top + r * (ch + TR_GAP);
    // 칸 사이 점선: 왼쪽(첫 단 말고) · 위(첫 줄 말고) — 옆·아래 칸이 있으면 틈까지 이어 그림
    if (c) o += k.up(plDash(x - TR_GAP / 2, r ? y - TR_GAP / 2 : y + 2, x - TR_GAP / 2, page[i + cols] ? y + ch + TR_GAP / 2 : y + ch - 2), .35);
    if (r) o += k.up(plDash(c ? x - TR_GAP / 2 : x, y - TR_GAP / 2, c < cols - 1 && page[i + 1] ? x + cw + TR_GAP / 2 : x + cw, y - TR_GAP / 2), .35);
    const [nt, f] = pwClip(t.name, nf, cw, 700);
    o += k.tx(plText(x, y + nf + 2, f, esc(nt), 700), .7);
    const bb = y + ch - 3, mid = (y + nf + 6 + bb - f3 - 4) / 2;
    if (t.a) { const ff = Math.min(f1, f1 * cw / Math.max(1, aW(t.a, f1))); o += k.tx(plText(x, mid + ff * .36, ff, aTxt(t.a, ff), 700), .9, bright); }
    else o += k.ink(plText(x, mid + nf * .36, nf, esc(t.none), 600));
    const nx = t.b ? '다음 ' + (t.b.n != null ? t.b.n + '분' : t.b.soon ? '곧 도착' : t.b.t) : '', nw = nx ? pwW(nx, f3, 600) : 0;
    if (nx) o += k.ink(plText(x + cw, bb, f3, esc(nx), 600, 'end'));
    const [lt, lf] = pwClip(t.lab, f3, cw - nw - (nx ? 8 : 0), 600, Math.min(f3, 8.5));
    o += k.ink(plText(x, bb, lf, esc(lt), 600));
  });
  if (L.pages > 1) {   // 쪽 점 (아래 가운데)
    const dx = 10, xs = W / 2 - (L.pages - 1) * dx / 2;
    for (let i = 0; i < L.pages; i++) { const d = pwDot(xs + i * dx, H - 8, 2.2); o += i === pg ? k.up(d, .8) : k.ink(d); }
  }
  return o;
}

// ── 달력: 요일 / 날짜(지난 날은 낮게, 앞뒤 달은 인쇄, 오늘은 로고 [ 03 ]처럼 대괄호로 감쌈) — 일요일·공휴일 빨강, 토요일 파랑 기운 / 아래 다음 공휴일·D-
const PW_RED = '#d0141d', PW_BLUE = '#2b5cc8';
function pwCal(k, W, H) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), today = ymd(d);
  let o = pwHead(k, W, `calendar · ${y}년 ${m + 1}월`);
  const lead = new Date(y, m, 1).getDay(), weeks = Math.ceil((lead + new Date(y, m + 1, 0).getDate()) / 7);
  const x1 = W - 20, cw = (x1 - 20) / 7, yf = H - 15, g0 = 60, ch = (yf - 16 - g0) / weeks, ns = Math.min(ch * .5, cw * .46, 18);
  const tint = (c, hol) => hol || c.getDay() === 0 ? PW_RED : c.getDay() === 6 ? PW_BLUE : null;
  WEEK.forEach((wd, i) => { o += k.ink(plText(20 + cw * (i + .5), 52, 9, wd, 700, 'middle'), i === 0 ? PW_RED : i === 6 ? PW_BLUE : null); });
  for (let i = 0; i < weeks * 7; i++) {
    const c = new Date(y, m, 1 - lead + i), iso = ymd(c), hol = holidayName(iso), mine = c.getMonth() === m;
    const cx = 20 + cw * (i % 7 + .5), cy = g0 + ch * (Math.floor(i / 7) + .5), t = tint(c, mine && hol), now = iso === today;
    const num = plText(cx, cy + ns * .36, ns, c.getDate(), 600, 'middle');
    if (now) {   // [ 4 ] — 괄호는 숫자 양옆에 숫자 폭만큼 벌려서(두 자리도 칸 안에)
      const bx = pwW(c.getDate(), ns, 600) / 2 + ns * .55, bs = ns;
      o += k.up(c2 => `<g fill="${c2}" font-size="${pf(bs)}" text-anchor="middle" style="font-family:var(--logo);font-weight:600">`
        + `<text x="${pf(cx - bx)}" y="${pf(cy + bs * .34)}">[</text><text x="${pf(cx + bx)}" y="${pf(cy + bs * .34)}">]</text></g>`, .8, t);
    }
    o += k.up(num, !mine ? .12 : now ? 1 : iso < today ? .4 : .8, t);
  }
  for (let i = 1; i <= 400; i++) {   // 다음 공휴일 (오늘 빼고, 1년 안). 연휴는 첫날
    const c = new Date(y, m, d.getDate() + i), hol = holidayName(ymd(c));
    if (!hol) continue;
    const dd = `D-${i}`, ds = `${c.getMonth() + 1}월 ${c.getDate()}일 ${WEEK[c.getDay()]}요일`;
    let x = 20;
    o += k.ink(plText(x, yf, 9.5, '다음 공휴일', 600)); x += pwW('다음 공휴일', 9.5) + 7;
    o += k.tx(plText(x, yf, 10.5, esc(hol), 700), .5, PW_RED); x += pwW(hol, 10.5, 700) + 7;
    if (x + pwW(ds, 9.5) < x1 - pwW(dd, 12) - 8) o += k.ink(plText(x, yf, 9.5, ds, 600));
    o += k.up(plText(x1, yf, 12, dd, 600, 'end'), .8);
    break;
  }
  return o;
}

// ── 사진 액자: 판에 낸 창(파낸 테) 안에 사진 — 사진 칸(.ph-box)을 창 자리로 옮김
function pwPhoto(k, W, H) {
  let o = pwHead(k, W, 'photo' + $('ph-count').textContent);
  const x = 18, y = 40, w = W - 18 - 18, h = H - 40 - 16, m = LG_INK[S.plate], dark = !!m.dark;
  o += k.sink(c => `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="6" fill="none" stroke="${c}" stroke-width="3"/>`);
  k.print(() => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${dvMix(m.bg[1], '#000000', dark ? .5 : .72)}"/>`);
  Object.assign($('photo').querySelector('.ph-box').style, { position: 'absolute', flex: 'none', zIndex: 1,
    left: x / W * 100 + '%', top: y / H * 100 + '%', width: w / W * 100 + '%', height: h / H * 100 + '%', borderRadius: '.4rem', overflow: 'hidden' });
  return o;
}

const PW_DRAW = { now: pwNow, hourly: pwHourly, daily: pwDaily, air: pwAir, transit: pwTransit, cal: pwCal, photo: pwPhoto };
// 그리기: 이름을 안 주면 모두. 칸이 안 보이면(꺼 둔 위젯·상세 화면) 건너뜀
function pwDraw(...names) {
  const on = pwOn();
  document.body.classList.toggle('pw-on', on);
  for (const n of names.length ? names : Object.keys(PW_EL)) {
    const el = document.querySelector(PW_EL[n]);
    if (!el) continue;
    let lay = el.querySelector(':scope > .pw');
    if (!on) {
      if (lay) lay.remove();
      if (n === 'photo') el.querySelector('.ph-box').removeAttribute('style');
      continue;
    }
    const [W, H] = plSize(el);
    if (!W || !H) continue;
    if (!lay) { lay = document.createElement('div'); lay.className = 'pw'; el.prepend(lay); }
    lay.innerHTML = plateSvg(W, H, S.plate, `pw${n}-`, k => PW_DRAW[n](k, W, H));
  }
}
// 로고 글꼴(숫자 폭)을 받으면 다시
document.fonts.load('500 20px MuseoModerno', '0123456789°%').then(() => pwDraw()).catch(() => {});
