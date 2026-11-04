// Pebbly Mirror — 위젯 판: 지금 날씨·시간별·일별·공기·교통·달력·사진 액자의 양각·음각
// ===== 위젯 판 =====
// 위젯 모양(설정 › 위젯 › 모양, S.plate)이 평면이 아니면 시계 강조 화면에서 이 위젯들도 디데이·집중 타이머처럼 판으로 그림 (plate.js plateSvg)
//   라이트 양각·다크 양각은 도드라지고, 라이트 음각·다크 음각은 판을 파냄 — 조각마다 k.up 하나로 테마를 따름
// 원래(평면) 글자는 자리만 잡고 숨기고, 판(.pw)을 칸 위에 덮음. 사진 액자는 판에 창을 내고 그 안에 사진
// 구성은 로고·디데이 판과 같음: 왼쪽 위 작은 인쇄 제목(now · 부천) · 오른쪽 위아래 꺾쇠 ┐┘ · 점선 · 숫자는 로고 글꼴(MuseoModerno)
// 다시 그림: 날씨·공기·해·교통·달력·사진 순번을 그린 끝에(pwDraw), 테마·화면 크기가 바뀔 때(plApply), 로고 글꼴을 받은 뒤
const PW_EL = { now: '.wmain', hourly: '.hourly', daily: '.wave', air: '.cards', transit: '.transit', cal: '.cal', photo: '.photo' };
const pwOn = () => !plFlat() && document.body.classList.contains('sb');
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
// 모든 판에 같은 것: 왼쪽 위 인쇄 제목(칸 폭에 맞춰 줄임) + 오른쪽 꺾쇠
const pwHead = (k, W, txt) => k.ink(plText(20, 28, pwFit(txt, 11, W - 70, 500), esc(txt), 500)) + k.up(plBrackets(W, k.H));
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
function pwNow(k, W, H) {
  const w = state.weather, c = w && w.current;
  let o = pwHead(k, W, `now · ${placeLabel()}`);
  if (!c) return o + k.ink(plText(20, H / 2, 12, '날씨를 불러오는 중', 600));
  const tall = plTall(W, H), flat = W > H * 1.55, x1 = W - 38, kind = wmo(c.weather_code)[1], day = c.is_day === 1;
  const temp = $('w-temp').textContent, feel = $('w-feel').textContent, desc = $('w-title').textContent, diff = $('w-diff').textContent;
  // 정보 칸들: x0~x1, y0~y1 안에 cols × rows
  const stats = (x0, xe, y0, y1, cols, rows) => {
    const cw = (xe - x0) / cols, rh = (y1 - y0) / rows, is = Math.min(14, rh * .24, cw * .32), vs = Math.min(18, rh * .32, cw * .34), bh = is + 5 + vs + 12;
    let t = '';
    ['s-wind', 's-hum', 's-rain', 's-hi', 's-lo', 's-uv'].forEach((cls, i) => {
      const el = document.querySelector('.w-stats .' + cls);
      if (!el) return;
      const cx = x0 + cw * (i % cols + .5), y = y0 + rh * Math.floor(i / cols) + (rh - bh) / 2;
      const v = el.querySelector('.c-val'), val = v.firstChild ? v.firstChild.textContent : '-', unit = (v.querySelector('small') || {}).textContent || '';
      const name = el.querySelector('.c-name').textContent, sub = /s-(hi|lo)/.test(cls) ? '' : el.querySelector('.c-sub').textContent;
      const vf = pwFit(val + unit, vs, cw - 6, 500);
      t += k.up(pwPath(el.querySelector('svg').innerHTML, cx - is / 2, y, is, 1.3), .5);
      t += k.up(plText(cx, y + is + 5 + vf * .78, vf, esc(val) + (unit ? `<tspan font-size="${pf(vf * .5)}" dx="1">${esc(unit)}</tspan>` : ''), 500, 'middle'), .8);
      t += k.ink(plText(cx, y + bh, pwFit(name + ' ' + sub, 8.5, cw - 4), esc([name, sub].filter(Boolean).join(' ')), 600, 'middle'));
    });
    return t;
  };
  // 그림·기온(위 칸 xa~xb, 높이 topH) / 날씨 이름·비교(바닥선 yDesc)
  const hero = (xb, topH, yDesc) => {
    const s = Math.min(topH, (xb - 20) * .4), ts = pwFit(temp, topH * .74, xb - 20 - s - 14, 500);
    let t = k.up(pwIco(k, kind, day, 18, 46, s, Math.max(1.4, s / 34)), .9);
    t += k.up(plText(xb, 46 + ts * .78, ts, esc(temp), 500, 'end'));
    t += k.tx(plText(xb, 46 + ts * .78 + 18, 11, esc(feel), 700, 'end'), .45);
    t += k.tx(plText(20, yDesc, pwFit(desc, 18, xb - 20, 700), esc(desc), 700), .6);
    if (diff) t += k.ink(plText(20, yDesc + 17, pwFit(diff, 10.5, xb - 20), esc(diff), 600));
    return t;
  };
  if (flat) {
    const xm = Math.round(W * .47), yDesc = H - 14 - (diff ? 17 : 4);
    o += hero(xm, yDesc - 22 - 46, yDesc) + k.up(plDash(xm + 14, 46, xm + 14, H - 16), .5) + stats(xm + 26, x1, 42, H - 12, 3, 2);
  } else {
    const stH = tall ? Math.min(H * .34, 116) : Math.min(H * .3, 84), ys = H - 14 - stH, yDesc = ys - 11 - (diff ? 17 : 4);
    o += hero(x1, yDesc - 22 - 46, yDesc) + k.up(plDash(20, ys, x1, ys), .5) + stats(20, x1, ys + 4, H - 14, tall ? 3 : 6, tall ? 2 : 1);
  }
  return o;
}

// ── 시간별: 시각 / 그림 / 기온 · 기온 곡선(점, 지금은 크게) · 강수확률 막대(파낸 홈에 솟은 막대, 30% 이상은 숫자)
function pwHourly(k, W, H) {
  let o = pwHead(k, W, 'hourly');
  const w = state.weather, h = w && w.hourly;
  if (!h) return o;
  const now = new Date(), i0 = h.time.indexOf(`${ymd(now)}T${pad(now.getHours())}:00`);
  if (i0 < 0) return o;
  const idx = range(Math.min(CONFIG.standbyHours, h.time.length - i0), j => i0 + j), n = idx.length;
  const temps = idx.map((i, j) => j === 0 ? w.current.temperature_2m : h.temperature_2m[i]);
  const x1 = W - 38, cw = (x1 - 20) / n, cx = j => 20 + cw * (j + .5);
  const is = Math.min(cw * .44, 22, H * .09), ts = Math.min(cw * .36, 17), yi = 58, yt = yi + is + 6 + ts * .78;
  const bh = Math.min(22, H * .08), yb0 = H - 26 - bh, p0 = yt + 12, p1 = yb0 - 12;
  const ys = pwTempY(temps, p0, p1), pts = idx.map((_, j) => [cx(j), ys[j]]);
  o += k.up(pwLine([[20, ys[0]], ...pts, [x1, ys[n - 1]]]), .5);
  idx.forEach((i, j) => {
    const first = j === 0, code = first ? w.current.weather_code : h.weather_code[i], day = (first ? w.current.is_day : h.is_day[i]) === 1;
    const lab = first ? '지금' : Number(h.time[i].slice(11, 13)) + '시';
    o += first ? k.tx(plText(cx(j), 48, 10, lab, 700, 'middle'), .6) : k.ink(plText(cx(j), 48, 10, lab, 600, 'middle'));
    o += k.up(pwIco(k, wmo(code)[1], day, cx(j) - is / 2, yi, is), first ? .8 : .5);
    o += k.up(plText(cx(j), yt, ts, Math.round(temps[j]) + '°', 500, 'middle'), first ? 1 : .75);
    o += k.up(pwDot(pts[j][0], pts[j][1], first ? 3.4 : 2.1), first ? 1 : .6);
    // 강수확률 막대: 파낸 홈에 확률만큼 채움(양각은 솟고 음각은 칠) — 0%는 빈 홈, 조금이라도 있으면 동그라미 하나만큼은 보이게
    const p = h.precipitation_probability[i] || 0, bx = cx(j) - 2.6, fh = Math.max(bh * p / 100, 5.2);
    o += k.sink(c => `<rect x="${pf(bx)}" y="${pf(yb0)}" width="5.2" height="${pf(bh)}" rx="2.6" fill="${c}"/>`);
    if (p > 0) o += k.fill(c => `<rect x="${pf(bx)}" y="${pf(yb0 + bh - fh)}" width="5.2" height="${pf(fh)}" rx="2.6" fill="${c}"/>`, p >= 30 ? .7 : .4);
    if (p >= 30) o += k.ink(plText(cx(j), H - 14, 8.5, p + '%', 600, 'middle'));
  });
  return o;
}

// ── 일별(어제부터 6일): 요일 / 최고·최저 · 최고기온 곡선 위 동그라미(그림 인쇄, 오늘은 크게 솟고 점선) · 강수확률 30% 이상
const PW_UMB = '<path d="M2.5 12a9.5 9.5 0 0 1 19 0zM12 12v6a2 2 0 0 1-4 0"/>';
function pwDaily(k, W, H) {
  let o = pwHead(k, W, 'daily');
  const w = state.weather, days = w ? waveDays(w) : [], n = days.length;
  if (!n) return o;
  const d = w.daily, today = ymd(new Date()), x1 = W - 38, cw = (x1 - 20) / n, cx = j => 20 + cw * (j + .5);
  const ts = Math.min(cw * .32, 15), yt = 52 + 8 + ts * .8, nr = Math.min(cw * .27, 12, H * .045);
  const yp = H - 16, p0 = yt + 16 + nr, p1 = yp - 18 - nr;
  const ys = pwTempY(days.map(([, i]) => d.temperature_2m_max[i]), p0, p1), pts = days.map((_, j) => [cx(j), ys[j]]);
  o += k.up(pwLine([[20, ys[0]], ...pts, [x1, ys[n - 1]]]), .5);
  days.forEach(([iso, i], j) => {
    const past = iso < today, now = iso === today, hgt = past ? .25 : now ? 1 : .7;
    const max = Math.round(d.temperature_2m_max[i]), min = Math.round(d.temperature_2m_min[i]);
    o += now ? k.tx(plText(cx(j), 48, 10, '오늘', 700, 'middle'), .6) : k.ink(plText(cx(j), 48, 10, dayLabel(iso), 600, 'middle'));
    const tf = pwFit(`${max}° ${min}°`, ts, cw - 2, 500);
    o += k.up(plText(cx(j), yt, tf, `${max}°<tspan font-size="${pf(tf * .55)}" dx="1">${min}°</tspan>`, 500, 'middle'), past ? .25 : .8);
    if (now) o += k.print(plDash(cx(j), yt + 6, cx(j), pts[j][1] - nr * 1.2 - 3));
    const r = now ? nr * 1.2 : nr;
    o += k.up(pwDot(pts[j][0], pts[j][1], r), hgt * .7);
    o += k.ink(pwIco(k, wmo(d.weather_code[i])[1], true, pts[j][0] - r * .62, pts[j][1] - r * .62, r * 1.24, 1.1));
    const p = d.precipitation_probability_max[i];
    if (p >= 30) o += k.ink(pwPath(PW_UMB, cx(j) - 13, yp - 8.5, 9, 1.2)) + k.ink(plText(cx(j) + 9, yp, 9, p + '%', 600, 'middle'));
  });
  return o;
}

// ── 공기·해·달: 미세먼지·초미세먼지(이름 / 큰 수치 / 등급 색 점) · 해(일출·일몰, 점선 반원에 지나온 길이 솟고 해 점) · 달(파낸 원에 밝은 쪽이 솟음)
function pwAir(k, W, H) {
  let o = pwHead(k, W, `air · ${PANELS[3].dataset.src || '예측값'}`);
  const a = state.air, x1 = W - 38, tall = plTall(W, H);
  const pmBlock = (x, y, bw, bh, name, v, gr) => {
    const g = v == null ? null : GRADES[gr(v)], val = v == null ? '-' : String(Math.round(v));
    const vs = pwFit(val, Math.min(bh * .46, 50), bw - 4, 500);
    let s = k.tx(plText(x, y + 11, pwFit(name, 10.5, bw), name, 700), .4);
    s += k.up(plText(x, y + 11 + (bh - 30) / 2 + vs * .38, vs, val, 500));
    if (g) s += k.print(() => `<circle cx="${pf(x + 3.6)}" cy="${pf(y + bh - 6.5)}" r="3.6" fill="${PW_GRADE[g[1]]}"/>`) + k.tx(plText(x + 11, y + bh - 2.5, 11, g[0], 700), .5);
    return s;
  };
  const moonBlock = (x, y, bw, big) => {   // y: 가운데 줄
    const p = moonPhase(Date.now()), name = MOON_NAMES.find(([lim]) => p < lim)[1], r = big ? 11 : 8;
    let s = k.sink(pwDot(x + r, y, r)) + k.fill(c => `<path transform="translate(${pf(x + r)} ${pf(y)})" d="${moonPath(p, r)}" fill="${c}"/>`, .7);
    s += k.tx(plText(x + r * 2 + 8, y + (big ? -1 : 4), big ? 13 : 11, name, 700), .5);
    s += k.ink(plText(big ? x + r * 2 + 8 : x + bw, y + (big ? 13 : 4), 9.5, big ? $('moon-next').textContent : $('moon-pct').textContent, 600, big ? 'start' : 'end'));
    return s;
  };
  const sunBlock = (x, y, bw, bh) => {   // 위 일출·일몰, 아래 반원
    const w = state.weather, t = w && w.daily.sunrise && upcomingDays(w)[0];
    if (!t) return '';
    const rise = w.daily.sunrise[t[1]], set = w.daily.sunset[t[1]], f = (Date.now() - new Date(rise)) / (new Date(set) - new Date(rise));
    const tsz = pwFit('00:00', 15, bw / 2 - 6, 600);
    let s = k.ink(plText(x, y + 9, 9, '일출', 600)) + k.ink(plText(x + bw, y + 9, 9, '일몰', 600, 'end'));
    s += k.up(plText(x, y + 13 + tsz * .8, tsz, rise.slice(11, 16), 600), .8) + k.up(plText(x + bw, y + 13 + tsz * .8, tsz, set.slice(11, 16), 600, 'end'), .8);
    const top = y + 22 + tsz, r = Math.max(10, Math.min(bw / 2 - 8, y + bh - 6 - top)), ax = x + bw / 2, ay = top + r;
    s += k.print(c => `<path d="M${pf(ax - r)} ${pf(ay)}A${pf(r)} ${pf(r)} 0 0 1 ${pf(ax + r)} ${pf(ay)}" fill="none" stroke="${c}" stroke-width="1.2" stroke-dasharray="3 3"/>`
      + `<path d="M${pf(ax - r - 6)} ${pf(ay)}H${pf(ax + r + 6)}" stroke="${c}" stroke-width="1"/>`);
    if (f > 0) {
      const th = Math.PI * (1 - Math.min(f, 1)), sx = ax + r * Math.cos(th), sy = ay - r * Math.sin(th);
      s += k.up(c => `<path d="M${pf(ax - r)} ${pf(ay)}A${pf(r)} ${pf(r)} 0 0 1 ${pf(sx)} ${pf(sy)}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`, .6);
      if (f <= 1) s += k.up(pwDot(sx, sy, 4), 1);
    }
    return s;
  };
  if (tall) {   // 세로로 긴 판: 미세먼지 둘 나란히 / 점선 / 해 / 점선 / 달
    const bw = (x1 - 20 - 18) / 2, bh = Math.min(96, H * .3), y2 = 44 + bh + 14, mh = 40, sh = H - 18 - mh - 12 - y2;
    o += pmBlock(20, 44, bw, bh, '미세먼지', a && a.pm10, gradePm10) + pmBlock(20 + bw + 18, 44, bw, bh, '초미세먼지', a && a.pm25, gradePm25);
    o += k.up(plDash(20 + bw + 9, 46, 20 + bw + 9, 44 + bh), .5) + k.up(plDash(20, y2 - 7, x1, y2 - 7), .5);
    o += sunBlock(20, y2, x1 - 20, sh) + k.up(plDash(20, H - 18 - mh, x1, H - 18 - mh), .5) + moonBlock(20, H - 18 - mh / 2 + 2, x1 - 20, true);
  } else {      // 가로로 긴 판: 미세먼지 | 초미세먼지 | 해·달
    const bw = (x1 - 20) * .27, sx = 20 + 2 * bw + 36, bh = H - 44 - 18, sw = x1 - sx;
    o += pmBlock(20, 44, bw, bh, '미세먼지', a && a.pm10, gradePm10) + pmBlock(20 + bw + 18, 44, bw, bh, '초미세먼지', a && a.pm25, gradePm25);
    o += k.up(plDash(20 + bw + 9, 46, 20 + bw + 9, H - 18), .5) + k.up(plDash(sx - 12, 46, sx - 12, H - 18), .5);
    o += sunBlock(sx, 44, sw, bh - 26) + moonBlock(sx, H - 24, sw, false);
  }
  return o;
}

// ── 교통: 정류장(이름·번호) / 노선 | 도착(3분 2정거장 · 14분) — 곧 도착은 높이 솟음. 정류장 사이 점선
function pwTransit(k, W, H) {
  const at = boardAt ? new Date(boardAt) : null;
  let o = pwHead(k, W, 'transit' + (at ? ` · ${pad(at.getHours())}:${pad(at.getMinutes())} 기준` : ''));
  if (!S.transit.length) return o;
  const x1 = W - 38, past = (Date.now() - boardAt) / 6e4;
  const when = (min, text, st) => {
    if (min == null) return { t: text || '-', soon: false };
    const m = Math.round(min - past);
    return m <= 0 ? { t: '곧 도착', soon: true } : { t: m + '분', st: st ? st + '정거장' : '', soon: false };
  };
  const items = S.transit.map(it => {
    if (it.t === 'bus') {
      const arr = (board && board.bus[`${it.src}:${it.id}`]) || [];
      return { head: it.name, no: it.no, rows: it.routes.slice(0, 4).map(r => {
        const x = arr.find(v => v.routeId === r.id);
        return { name: r.name, times: x ? [when(x.min1, x.msg1, x.st1), ...(x.min2 != null || x.msg2 ? [when(x.min2, x.msg2, x.st2)] : [])] : [] };
      }) };
    }
    const arr = ((board && board.sub[it.station]) || []).filter(v => v.sid === it.sid && v.updn === it.updn).slice(0, 2);
    return { head: it.station + '역', no: it.label, rows: [{ name: it.label.split(' ')[0], times: arr.map(v => ({ ...when(v.min, v.text, v.st), x: v.express })) }] };
  });
  // 한 단(xa~xb)에 정류장들: 이름 줄 / 노선 줄들, 정류장 사이 점선. 줄 높이는 그 단의 줄 수로
  const col = (list, xa, xb) => {
    const nRows = list.reduce((n, it) => n + it.rows.length, 0), hh = 20, gap = 12;
    const rh = Math.min(26, (H - 46 - 14 - list.length * (hh + gap) + gap) / Math.max(1, nRows)), rs = Math.min(17, rh * .7);
    let y = 46, t = '';
    list.forEach((it, n) => {
      if (y + hh + rh > H - 10) return;
      if (n) { t += k.up(plDash(xa, y, xb, y), .45); y += gap; }
      t += k.tx(plText(xa, y + 12, pwFit(it.head, 12, xb - xa - 40, 700), esc(it.head), 700), .5) + k.ink(plText(xa + 4 + Math.min(pwW(it.head, 12, 700), xb - xa - 40), y + 12, 9, esc(it.no), 600));
      y += hh;
      it.rows.forEach(r => {
        if (y + rh > H - 8) return;
        const by = y + rh / 2 + rs * .36, nw = pwW(r.name, rs, 700);
        t += k.up(plText(xa, by, rs, esc(r.name), 700), .9);
        const soon = r.times.some(v => v.soon), plain = r.times.map(v => v.t + (v.st ? ' ' + v.st : '')).join(' · ') || '정보 없음';
        const fs = pwFit(plain, rs * .9, xb - xa - nw - 14, 500);
        const txt = r.times.length ? r.times.map(v => esc(v.t) + (v.st ? `<tspan font-size="${pf(fs * .5)}" dx="2">${esc(v.st)}</tspan>` : '')
          + (v.x ? `<tspan font-size="${pf(fs * .5)}" dx="2">급행</tspan>` : '')).map((v, i) => i ? `<tspan dx="4">·</tspan><tspan dx="4">${v}</tspan>` : v).join('') : '정보 없음';
        t += r.times.length ? k.tx(plText(xb, by, fs, txt, soon ? 700 : 500, 'end'), soon ? .9 : .6) : k.ink(plText(xb, by, fs, txt, 600, 'end'));
        y += rh;
      });
    });
    return t;
  };
  // 아주 납작한 판(태블릿 세로)에 정류장이 둘 이상이면 왼쪽·오른쪽 두 단으로 (줄이 많은 쪽이 넘치지 않게 앞에서부터 반씩)
  if (W > H * 1.55 && items.length > 1) {
    const half = Math.ceil(items.length / 2), xm = (20 + x1) / 2;
    o += col(items.slice(0, half), 20, xm - 14) + k.up(plDash(xm, 46, xm, H - 16), .45) + col(items.slice(half), xm + 14, x1);
  } else o += col(items, 20, x1);
  if (!board) o += k.ink(plText(20, H - 16, 10, '도착 정보를 불러오는 중', 600));
  return o;
}

// ── 달력: 요일 / 날짜(지난 날은 낮게, 앞뒤 달은 인쇄, 오늘은 로고 [ 03 ]처럼 대괄호로 감쌈) — 일요일·공휴일 빨강, 토요일 파랑 기운 / 아래 다음 공휴일·D-
const PW_RED = '#d0141d', PW_BLUE = '#2b5cc8';
function pwCal(k, W, H) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), today = ymd(d);
  let o = pwHead(k, W, `calendar · ${y}년 ${m + 1}월`);
  const lead = new Date(y, m, 1).getDay(), weeks = Math.ceil((lead + new Date(y, m + 1, 0).getDate()) / 7);
  const x1 = W - 38, cw = (x1 - 20) / 7, yf = H - 15, g0 = 60, ch = (yf - 16 - g0) / weeks, ns = Math.min(ch * .5, cw * .46, 18);
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
  const x = 18, y = 40, w = W - 18 - 38, h = H - 40 - 16, m = LG_INK[S.plate], dark = !!m.dark;
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
