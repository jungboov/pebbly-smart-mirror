// Pebbly Mirror — 날씨: 아이콘, 데이터 받기, 위치·주소, 그리기, 달, 알림 띠, 문구
// ===== 아이콘 =====
const CLOUD_BASE = '<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>';
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  smallSun: '<circle cx="8" cy="8" r="3.2"/><path d="M8 2.2v1.3M2.2 8h1.3M3.9 3.9l.9.9M12.1 3.9l-.9.9M3.9 12.1l.9-.9"/>',
  smallMoon: '<path d="M11.5 8.4A4.5 4.5 0 1 1 6.6 3.5a3.5 3.5 0 0 0 4.9 4.9z"/>',
  frontCloud: '<path class="occ" d="M18.5 12.5h-.95A6.2 6.2 0 1 0 11.6 20.5h6.9a4 4 0 0 0 0-8z"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  fog: '<path d="M7 6h10M3 10h18M5 14h14M3 18h18"/>',
  drizzle: CLOUD_BASE + '<path d="M8 13v2M8 19v2M12 15v2M12 21v2M16 13v2M16 19v2"/>',
  rain: CLOUD_BASE + '<path d="M8 13v8M12 15v8M16 13v8"/>',
  snow: CLOUD_BASE + '<path class="dots" d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01"/>',
  thunder: '<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><path d="M13 11l-4 6h6l-4 6"/>'
};

function icon(kind, day = true) {
  let body;
  if (kind === 'clear') body = day ? ICONS.sun : ICONS.moon;
  else if (kind === 'partly') body = (day ? ICONS.smallSun : ICONS.smallMoon) + ICONS.frontCloud;
  else body = ICONS[kind] || ICONS.cloud;
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// WMO 날씨 코드 → [설명, 아이콘 종류]
const WMO = {
  0: ['맑음', 'clear'], 1: ['대체로 맑음', 'partly'], 2: ['구름 조금', 'partly'], 3: ['흐림', 'cloud'],
  45: ['안개', 'fog'], 48: ['안개', 'fog'],
  51: ['약한 이슬비', 'drizzle'], 53: ['이슬비', 'drizzle'], 55: ['강한 이슬비', 'drizzle'],
  56: ['어는 이슬비', 'drizzle'], 57: ['어는 이슬비', 'drizzle'],
  61: ['약한 비', 'rain'], 63: ['비', 'rain'], 65: ['강한 비', 'rain'], 66: ['어는 비', 'rain'], 67: ['어는 비', 'rain'], 68: ['비 또는 눈', 'snow'],
  71: ['약한 눈', 'snow'], 73: ['눈', 'snow'], 75: ['많은 눈', 'snow'], 77: ['싸락눈', 'snow'],
  80: ['소나기', 'rain'], 81: ['소나기', 'rain'], 82: ['강한 소나기', 'rain'],
  85: ['소낙눈', 'snow'], 86: ['강한 소낙눈', 'snow'],
  95: ['뇌우', 'thunder'], 96: ['우박 뇌우', 'thunder'], 99: ['우박 뇌우', 'thunder']
};
const wmo = code => WMO[code] || ['-', 'cloud'];

// ===== 데이터 =====
async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// 새로고침 직후에도 바로 보이도록 마지막 응답을 저장 (실패해도 동작엔 지장 없음)
const cacheKey = key => `mirror3_${key}_${CONFIG.lat}_${CONFIG.lon}`;   // 응답 형식이 바뀌면 접두어 버전을 올릴 것
function save(key, data) {
  try { localStorage.setItem(cacheKey(key), JSON.stringify({ at: Date.now(), data })); } catch (e) {}
}
function load(key, maxAge) {
  try {
    const v = JSON.parse(localStorage.getItem(cacheKey(key)));
    if (v && Date.now() - v.at < maxAge) return v;
  } catch (e) {}
  return null;
}

// 요청하는 사이 위치가 바뀌었으면(기기 위치 확인 직후) 늦게 온 이전 위치 응답은 버림
const sameLoc = ({ lat, lon }) => lat === CONFIG.lat && lon === CONFIG.lon;

// Open-Meteo로 전체 모양(6일·해 뜨고 지는 시각·자외선·어제)을 받고, 기상청 동네예보(같은 사이트 /api/weather 중계)가 되면
// 지금·시간별·하루 최저최고를 기상청 값으로 덮어씀 (네이버·날씨누리와 같은 숫자). 기상청이 안 되면 Open-Meteo 그대로
async function loadWeather() {
  const at = { lat: CONFIG.lat, lon: CONFIG.lon };
  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: at.lat, longitude: at.lon, timezone: 'auto', past_days: 1, forecast_days: 6, wind_speed_unit: 'ms',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,uv_index,wind_speed_10m,wind_direction_10m,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day'
  });
  try {
    const [data, kma] = await Promise.all([getJSON(url),
      getJSON('/api/weather?' + new URLSearchParams({ lat: at.lat, lon: at.lon })).catch(() => null)]);
    if (!sameLoc(at)) return;
    if (kma && kma.hours && kma.hours.length) useKma(data, kma);
    state.weather = data;
    state.weatherAt = Date.now();
    state.weatherErr = false;
    save('weather', state.weather);
  } catch (e) {
    state.weatherErr = true;
    console.warn('날씨 갱신 실패', e);
  }
  renderWeather();
  renderFoot();
}

// 기상청 값으로 덮어쓰기: 지금(관측) / 시간별 기온·강수확률·날씨 / 하루 최저·최고·강수확률·날씨 (기상청 예보가 있는 날만)
// '어제보다'는 기상청 최고기온끼리 비교하려고 날마다 이 기기에 적어 둔 값을 씀 (첫날은 없어서 안 보임)
function useKma(w, k) {
  const h = w.hourly, d = w.daily, c = w.current, at = new Map(h.time.map((t, i) => [t, i]));
  for (const x of k.hours) {
    const i = at.get(x.time);
    if (i == null) continue;
    h.temperature_2m[i] = x.t;
    if (x.pop != null) h.precipitation_probability[i] = x.pop;
    h.weather_code[i] = x.code;
  }
  const today = ymd(new Date()), first = k.hours[0].time;
  // 오늘 중 기상청 예보가 없는 이른 시각(00~02시)은 비움 → 최고·최저 시각을 다른 예보와 섞어 고르지 않음
  h.time.forEach((t, i) => { if (t.startsWith(today) && t < first) h.temperature_2m[i] = null; });
  if (k.now) {
    const i = at.get(`${today}T${pad(new Date().getHours())}:00`);
    Object.assign(c, { temperature_2m: k.now.t, apparent_temperature: k.now.feel, weather_code: k.now.code, desc: k.now.desc,
      relative_humidity_2m: k.now.reh ?? c.relative_humidity_2m, wind_speed_10m: k.now.wsd ?? c.wind_speed_10m,
      wind_direction_10m: k.now.vec ?? c.wind_direction_10m, precipitation_probability: i == null ? c.precipitation_probability : h.precipitation_probability[i] });
  }
  d.time.forEach((iso, i) => {
    const hrs = k.hours.filter(x => x.time.startsWith(iso)), kd = k.days.find(x => x.date === iso) || {};
    const ts = hrs.map(x => x.t), whole = hrs.length >= 15;   // 하루 대부분이 예보에 들어 있는 날만 시간별로 셈
    if (kd.max != null || whole) d.temperature_2m_max[i] = kd.max ?? Math.max(...ts);
    if (kd.min != null || whole) d.temperature_2m_min[i] = kd.min ?? Math.min(...ts);
    if (!whole) return;
    d.precipitation_probability_max[i] = Math.max(...hrs.map(x => x.pop || 0));
    // 하루 날씨: 낮(06~21시)에 비·눈이 있으면 가장 많은 강수 코드, 없으면 가장 많은 하늘 상태 (같으면 더 흐린 쪽)
    const daytime = hrs.filter(x => x.time.slice(11, 13) >= '06' && x.time.slice(11, 13) <= '21').map(x => x.code);
    const wet = daytime.filter(code => code >= 50), pool = wet.length ? wet : daytime;
    const count = pool.reduce((m, code) => m.set(code, (m.get(code) || 0) + 1), new Map());
    if (pool.length) d.weather_code[i] = [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  });
  // 어제 최고·최저: 어제 이 기기가 적어 둔 기상청 값 (없으면 '어제보다'를 안 보임)
  const days = (load('kmadays', 5 * 864e5) || {}).data || {}, ti = d.time.indexOf(today);
  const yIso = d.time[ti - 1];
  w.kma = true;
  w.kmaYday = !!(yIso && days[yIso]);
  if (w.kmaYday) [d.temperature_2m_max[ti - 1], d.temperature_2m_min[ti - 1]] = days[yIso];
  if (ti >= 0) days[today] = [d.temperature_2m_max[ti], d.temperature_2m_min[ti]];
  for (const iso in days) if (iso < d.time[0]) delete days[iso];
  save('kmadays', days);
}

// 미세먼지: 에어코리아 실측(같은 사이트의 /api/air 중계)을 먼저, 안 되면 Open-Meteo 예측값
// (키 설정 전·파일로 열었을 때·측정소 점검 중에도 화면엔 항상 값이 나옴)
// state.air = { pm10, pm25, station(실측일 때 측정소 이름) }
async function loadAir() {
  const at = { lat: CONFIG.lat, lon: CONFIG.lon };
  let air = null;
  try {
    const r = await getJSON('/api/air?' + new URLSearchParams({ lat: at.lat, lon: at.lon }));
    if (r.pm10 != null || r.pm25 != null) air = { pm10: r.pm10, pm25: r.pm25, station: r.station };
  } catch (e) {}
  try {
    if (!air) {
      const r = await getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?' + new URLSearchParams({
        latitude: at.lat, longitude: at.lon, timezone: 'auto', current: 'pm10,pm2_5'
      }));
      air = { pm10: r.current.pm10, pm25: r.current.pm2_5 };
    }
    if (!sameLoc(at)) return;
    state.air = air;
    state.airErr = false;
    save('air2', state.air);
  } catch (e) {
    state.airErr = true;
    console.warn('미세먼지 갱신 실패', e);
  }
  renderAir();
  renderFoot();
}

// ===== 위치 =====
// 기기 위치 → '구 + 동' 이름(OpenStreetMap)으로 바꿔 저장. 실패하면 마지막 위치, 그것도 없으면 서울
// 날씨 API엔 소수 둘째 자리(약 1km), 동 이름 조회엔 셋째 자리(약 100m)까지만 보냄
// (1km로 반올림하면 이웃 동이 나오는 경우가 있음)
const LOC_KEY = 'mirror_loc';
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const FALLBACK_NAME = '내 위치';

function savedLoc() {
  try { return JSON.parse(localStorage.getItem(LOC_KEY)); } catch (e) { return null; }
}
function useLoc(loc) {
  CONFIG.lat = loc.lat; CONFIG.lon = loc.lon; CONFIG.name = loc.name;
}

// 예: 강남구 역삼1동, 분당구 정자동, 양평군 양평읍, 제주시 이도2동
// 동 이름이 담기는 항목이 지역마다 달라서('분당'처럼 동이 아닌 값도 있음) 동·읍·면·가·리로 끝나는 첫 값을 씀
// (시골은 읍·면 없이 '양근리' 같은 리만 오기도 함)
async function placeName(lat, lon) {
  const r = await getJSON('https://nominatim.openstreetmap.org/reverse?' + new URLSearchParams({
    format: 'jsonv2', lat, lon, zoom: 16, 'accept-language': 'ko'
  }));
  const a = r.address || {};
  const district = a.borough || a.county || (a.city || '').replace(/(특별시|광역시|특별자치시)$/, '');
  const dong = [a.suburb, a.city_district, a.quarter, a.town, a.village].find(v => /(동|읍|면|가|리)$/.test(v || ''));
  return [district, dong].filter(Boolean).join(' ') || FALLBACK_NAME;
}

// 상세 주소(설정 > 화면 > 표시): 도로명 주소. 예: 부천시 원미구 길주로 210, 서울 강남구 테헤란로 152
// 건물 번호가 없으면 도로 이름까지, 도로도 없으면 null (그땐 구·동 이름을 씀)
async function roadAddress(lat, lon) {
  const r = await getJSON('https://nominatim.openstreetmap.org/reverse?' + new URLSearchParams({
    format: 'jsonv2', lat, lon, zoom: 18, 'accept-language': 'ko'
  }));
  const a = r.address || {};
  if (!a.road) return null;
  const city = (a.city || a.county || '').replace(/(특별시|광역시|특별자치시)$/, '');
  const gu = a.borough || (a.city_district && /구$/.test(a.city_district) ? a.city_district : '');
  return [city, gu, a.road, a.house_number].filter(Boolean).join(' ');
}

function locate() {
  if (MANUAL_LOC || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords;
    const fine = [round(latitude, 3), round(longitude, 3)], exact = [round(latitude, 4), round(longitude, 4)];
    const prev = savedLoc() || {};
    const needName = String(prev.fine) !== String(fine) || !prev.name || prev.name === FALLBACK_NAME;
    const needAddr = S.addr && (String(prev.exact) !== String(exact) || !prev.addr);
    if (!needName && !needAddr) return;
    const loc = { lat: round(latitude, 2), lon: round(longitude, 2), fine, name: needName ? FALLBACK_NAME : prev.name };
    if (needName) try { loc.name = await placeName(...fine); } catch (e) { console.warn('지역 이름 확인 실패', e); }
    if (S.addr) {
      loc.exact = exact; loc.addr = needAddr ? null : prev.addr;
      if (needAddr) try { loc.addr = await roadAddress(...exact); } catch (e) { console.warn('주소 확인 실패', e); }
    }
    try { localStorage.setItem(LOC_KEY, JSON.stringify(loc)); } catch (e) {}
    const moved = !sameLoc(loc);
    useLoc(loc);
    if (moved) { loadWeather(); loadAir(); }
    else renderFoot();
  }, err => console.warn('위치 확인 실패', err.message), { enableHighAccuracy: !!S.addr, timeout: 20000, maximumAge: S.addr ? 600e3 : 6 * 3600e3 });
}

// ===== 렌더링 =====
// 오늘 이후 4일치 예보 인덱스
function upcomingDays(w) {
  const today = ymd(new Date());
  return w.daily.time.map((t, i) => [t, i]).filter(([t]) => t >= today).slice(0, 4);
}

// 예보 곡선용: 어제부터 6일
function waveDays(w) {
  const t = w.daily.time, start = Math.max(0, t.indexOf(ymd(new Date())) - 1);
  return t.slice(start, start + 6).map((iso, k) => [iso, start + k]);
}

function dayLabel(iso) {
  const now = new Date();
  const rel = k => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k));
  if (iso === rel(0)) return '오늘';
  if (iso === rel(1)) return '내일';
  if (iso === rel(-1)) return '어제';
  const [y, m, d] = iso.split('-').map(Number);
  return WEEK[new Date(y, m - 1, d).getDay()];
}

// 기온 → 색 (추우면 파랑, 더우면 주황)
const TEMP_STOPS = [[-10, [111, 168, 255]], [0, [142, 197, 255]], [10, [185, 224, 201]], [18, [255, 224, 138]], [25, [255, 179, 92]], [32, [255, 122, 69]]];
function tempColor(t) {
  const s = TEMP_STOPS;
  if (t <= s[0][0]) return `rgb(${s[0][1]})`;
  for (let k = 1; k < s.length; k++) {
    if (t <= s[k][0]) {
      const f = (t - s[k - 1][0]) / (s[k][0] - s[k - 1][0]);
      return `rgb(${s[k - 1][1].map((v, j) => Math.round(v + (s[k][1][j] - v) * f))})`;
    }
  }
  return `rgb(${s[s.length - 1][1]})`;
}

// 기온 → 그래프 높이 (viewBox 100 기준, pad는 위아래 여백, plot은 그래프 칸)
// 화면에 보이는 숫자(반올림)로 그리고 가운데 기준. 1°당 높이는 최고·최저 차이가 작아도 최소 8°가 칸 높이 전체가 되게,
// 칸이 아주 높아도(위젯이 화면 높이를 채울 때) 1°당 2.5rem까지만 → 몇 도 차이가 화면 가득 출렁이지 않게
// (가장 낮은 값·높은 값을 맨 아래·맨 위에 맞추면 11.2°·11.4°처럼 같은 11°도 크게 오르내려 보임)
const MIN_SPAN = 8, DEG_REM = 2.5;
function tempYs(temps, pad, plot) {
  const t = temps.map(Math.round), lo = Math.min(...t), hi = Math.max(...t), mid = (hi + lo) / 2;
  let per = (100 - 2 * pad) / Math.max(hi - lo, MIN_SPAN);
  const h = plot.clientHeight, rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (h) per = Math.min(per, DEG_REM * rem / h * 100);
  return t.map(v => 50 + (mid - v) * per);
}

// 점들을 지나는 부드러운 곡선 (Catmull-Rom → 베지어)
function smoothPath(p) {
  const f = v => v.toFixed(1);
  let s = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let k = 0; k < p.length - 1; k++) {
    const p0 = p[k - 1] || p[k], p1 = p[k], p2 = p[k + 1], p3 = p[k + 2] || p2;
    s += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)}`
       + ` ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return s;
}

function renderWeather() {
  const w = state.weather;
  if (!w) return;
  const c = w.current, d = w.daily;
  const [name, kind] = wmo(c.weather_code), desc = c.desc || name;   // 기상청 값이면 기상청 말(구름많음 등)
  const today = upcomingDays(w)[0];
  $('w-ico').innerHTML = icon(kind, c.is_day === 1);
  $('w-big').innerHTML = icon(kind, c.is_day === 1).replace('<svg', '<svg preserveAspectRatio="xMinYMin meet"');   // 시계 강조: 왼쪽 위에 크게
  $('w-title').textContent = desc;
  $('w-feel').textContent = `체감 ${Math.round(c.apparent_temperature)}°`;
  $('w-temp').textContent = Math.round(c.temperature_2m) + '°';
  if (today) {
    const i = today[1];
    $('w-hi').textContent = Math.round(d.temperature_2m_max[i]) + '°';
    $('w-lo').textContent = Math.round(d.temperature_2m_min[i]) + '°';
    const [hiAt, loAt] = extremeHours(w, today[0]);
    $('w-hi-t').textContent = hiAt;
    $('w-lo-t').textContent = loAt;
    // 어제 최고기온과 비교 (past_days=1로 어제 값이 함께 옴. 기상청 값이면 어제도 기상청 값이 있을 때만)
    const diff = i > 0 && (!w.kma || w.kmaYday) ? Math.round(d.temperature_2m_max[i] - d.temperature_2m_max[i - 1]) : null;
    $('w-diff').textContent = diff == null ? '' : diff === 0 ? '어제와 비슷한 기온이에요'
      : `어제보다 ${Math.abs(diff)}° ${diff > 0 ? '높아요' : '낮아요'}`;
  }
  $('w-hum').textContent = c.relative_humidity_2m + '%';
  $('w-hum-t').textContent = humLevel(c.relative_humidity_2m);
  const [uvText, uvCls] = c.uv_index == null ? ['', ''] : uvLevel(c.uv_index);
  $('w-uv').textContent = c.uv_index == null ? '-' : Math.round(c.uv_index);
  $('w-uv-t').textContent = uvText;
  $('w-uv-t').className = 'c-sub ' + uvCls;
  // 바람(m/s, 10 미만은 소수 한 자리)·풍향(불어오는 쪽), 오늘 남은 시간 중 가장 높은 강수확률 — 시계 강조 화면 now 위젯에만 표시
  // (지금 시각 확률만 보이면 '7%'인데 오후에 비가 오는 날도 있어서)
  const ws = c.wind_speed_10m;
  $('w-wind').innerHTML = ws == null ? '-' : `${ws < 10 ? ws.toFixed(1) : Math.round(ws)}<small>m/s</small>`;
  $('w-wind-t').textContent = c.wind_direction_10m == null ? '' : WIND_DIR[Math.round(c.wind_direction_10m / 45) % 8];
  const nowKey = `${ymd(new Date())}T${pad(new Date().getHours())}:00`, hh = w.hourly;
  const rest = hh ? hh.time.map((t, i) => t >= nowKey && t.slice(0, 10) === nowKey.slice(0, 10) ? hh.precipitation_probability[i] : null).filter(v => v != null) : [];
  const pop = rest.length ? Math.max(...rest) : c.precipitation_probability;
  $('w-rain').textContent = pop == null ? '-' : pop + '%';
  $('w-rain-t').textContent = rest.length ? '오늘' : '';
  renderHourly(w);
  renderWave(w);
  renderSun();
  renderAlert();
  fitClock();   // 세로 시계 강조 화면은 위젯 높이에 따라 시계 크기가 정해짐
}

// 자외선 지수 단계 (기상청 기준) → [단계, 등급색]
const uvLevel = v => v < 3 ? ['낮음', 'good'] : v < 6 ? ['보통', 'normal'] : v < 8 ? ['높음', 'bad'] : v < 11 ? ['매우높음', 'worst'] : ['위험', 'worst'];
const WIND_DIR = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
const humLevel = v => v < 30 ? '건조' : v <= 60 ? '쾌적' : v <= 80 ? '습함' : '매우 습함';

// 오늘 최고·최저 기온이 나타나는 시각 (시간별 예보 기준)
function extremeHours(w, iso) {
  const h = w.hourly;
  if (!h) return ['', ''];
  const idx = h.time.map((t, i) => [t, i]).filter(([t, i]) => t.startsWith(iso) && h.temperature_2m[i] != null).map(([, i]) => i);
  if (!idx.length) return ['', ''];
  const pick = better => idx.reduce((a, b) => better(h.temperature_2m[b], h.temperature_2m[a]) ? b : a);
  const label = i => {
    const hr = Number(h.time[i].slice(11, 13));
    return `${hr < 12 ? '오전' : '오후'} ${hr % 12 || 12}시`;
  };
  return [label(pick((x, y) => x > y)), label(pick((x, y) => x < y))];
}

function renderWave(w) {
  const d = w.daily, today = ymd(new Date());
  const days = waveDays(w), n = days.length;
  if (!n) return;
  const temps = days.map(([, i]) => d.temperature_2m_max[i]);
  const PAD = 25;   // 동그란 점이 위아래로 잘리지 않도록 남기는 여백 (viewBox 100 기준)
  const pts = tempYs(temps, PAD, document.querySelector('.wave-plot')).map((y, k) => [(k + .5) / n * 600, y]);
  $('wave-path').setAttribute('d', smoothPath([[0, pts[0][1]], ...pts, [600, pts[n - 1][1]]]));
  $('wave').style.setProperty('--n', n);

  let top = '', nodes = '', pop = '';
  days.forEach(([iso, i], k) => {
    const cls = iso < today ? 'past' : iso === today ? 'today' : '';
    const max = Math.round(d.temperature_2m_max[i]);
    const color = cls ? '' : ` style="color:${tempColor(max)}"`;
    top += `<div class="wt ${cls}"><span class="wd">${dayLabel(iso)}</span>`
         + `<b${color}>${max}°<small>${Math.round(d.temperature_2m_min[i])}°</small></b></div>`;
    const x = (pts[k][0] / 6).toFixed(2), y = pts[k][1].toFixed(2);
    if (cls === 'today') nodes += `<i class="wave-line" style="left:${x}%;height:calc(${y}% + 1.2rem)"></i>`;
    nodes += `<span class="node ${cls}" style="left:${x}%;top:${y}%">${icon(wmo(d.weather_code[i])[1])}</span>`;   // 오늘도 아이콘 (밝은 테두리·점선으로 구분)
    const p = d.precipitation_probability_max[i];
    pop += `<span class="wp">${p >= 30 ? '☂ ' + p + '%' : ''}</span>`;
  });
  $('wave-top').innerHTML = top;
  $('wave-nodes').innerHTML = nodes;
  $('wave-pop').innerHTML = pop;
}

// 지금 시각부터 1시간 간격 예보. 첫 칸('지금')은 현재 관측값을 씀
function renderHourly(w) {
  const h = w.hourly;
  if (!h) return;
  const now = new Date();
  const i0 = h.time.indexOf(`${ymd(now)}T${pad(now.getHours())}:00`);
  if (i0 < 0) return;
  const count = document.body.classList.contains('sb') ? CONFIG.standbyHours : CONFIG.hourlyCount;
  const idx = range(Math.min(count, h.time.length - i0), k => i0 + k);
  const n = idx.length;
  const temps = idx.map((i, k) => k === 0 ? w.current.temperature_2m : h.temperature_2m[i]);
  const PAD = 15;
  const pts = tempYs(temps, PAD, document.querySelector('.h-plot')).map((y, k) => [(k + .5) / n * 600, y]);
  const line = smoothPath([[0, pts[0][1]], ...pts, [600, pts[n - 1][1]]]);
  $('h-line').setAttribute('d', line);
  $('h-area').setAttribute('d', line + ' L600,100 L0,100 Z');
  $('hourly').style.setProperty('--n', n);

  let top = '', dots = '', bars = '';
  idx.forEach((i, k) => {
    const first = k === 0;
    const code = first ? w.current.weather_code : h.weather_code[i];
    const day = (first ? w.current.is_day : h.is_day[i]) === 1;
    top += `<div class="ht${first ? ' now' : ''}"><span class="hl">${first ? '지금' : Number(h.time[i].slice(11, 13)) + '시'}</span>`
         + `${icon(wmo(code)[1], day)}<b>${Math.round(temps[k])}°</b></div>`;
    dots += `<i class="h-dot${first ? ' now' : ''}" style="left:${(pts[k][0] / 6).toFixed(2)}%;top:${pts[k][1].toFixed(2)}%"></i>`;
    const p = h.precipitation_probability[i] || 0;
    bars += `<div class="hb"><span class="bar${p < 30 ? ' dry' : ''}"><i style="height:${Math.max(p, 8)}%"></i></span>`
          + `<span>${p >= 30 ? p + '%' : ''}</span></div>`;
  });
  $('h-top').innerHTML = top;
  $('h-dots').innerHTML = dots;
  $('h-bars').innerHTML = bars;
}

// ===== 달 =====
// 기준 삭(2000-01-06 18:14 UTC)부터 지난 시간 ÷ 평균 삭망월(29.53일) → 위상 0(삭) ~ .5(보름) ~ 1 (오차 반나절 안팎)
const moonPhase = t => (((t - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1 + 1) % 1;
// 위상 구간 → 이름 (보름달은 밝기 약 98% 이상)
const MOON_NAMES = [[.03, '삭'], [.22, '초승달'], [.28, '상현달'], [.45, '차오르는 달'], [.55, '보름달'],
  [.72, '기우는 달'], [.78, '하현달'], [.97, '그믐달'], [1, '삭']];
// 밝은 부분 = 밝은 쪽 반원(차는 달은 오른쪽, 기우는 달은 왼쪽) + 명암 경계 반타원
// (초승·그믐은 경계가 밝은 쪽으로 오목, 차오르는·기우는 달은 반대쪽으로 볼록)
function moonPath(p, r = 10) {
  const c = Math.cos(2 * Math.PI * p), waxing = p < .5;
  return `M0 ${-r}A${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r}`
       + `A${(Math.abs(c) * r).toFixed(2)} ${r} 0 0 ${(c > 0) === waxing ? 0 : 1} 0 ${-r}Z`;
}
// 다음 주요 위상 (지금 위상과 반나절 안쪽이면 그다음 것)
const MOON_NEXT = [[.25, '상현달'], [.5, '보름달'], [.75, '하현달'], [1, '삭'], [1.25, '상현달']];
function renderMoon() {
  const p = moonPhase(Date.now()), name = MOON_NAMES.find(([lim]) => p < lim)[1];
  const pct = Math.round((1 - Math.cos(2 * Math.PI * p)) / 2 * 100) + '%';
  $('moon-lit').setAttribute('d', moonPath(p));
  $('moon-name').textContent = name;
  $('moon-pct').textContent = pct;
  // 큰 달 카드 (가로 시계 강조 화면의 공기 위젯)
  const [lim, next] = MOON_NEXT.find(([l]) => p < l - .02);
  const days = Math.round((lim - p) * 29.53);
  $('moon-lit-big').setAttribute('d', moonPath(p));
  $('moon-name-big').textContent = name;
  $('moon-next').textContent = `밝기 ${pct} · ${days < 1 ? '곧 ' + next : next + '까지 ' + days + '일'}`;
}

// 일출~일몰 반원 위에 현재 해 위치 표시 (달 모양도 함께)
function renderSun() {
  renderMoon();
  const w = state.weather;
  const today = w && w.daily.sunrise && upcomingDays(w)[0];
  if (!today) return;
  const rise = w.daily.sunrise[today[1]], set = w.daily.sunset[today[1]];
  $('sunrise').textContent = rise.slice(11, 16);
  $('sunset').textContent = set.slice(11, 16);
  const f = (Date.now() - new Date(rise)) / (new Date(set) - new Date(rise));
  const th = Math.PI * (1 - Math.min(Math.max(f, 0), 1));
  const x = (50 + 42 * Math.cos(th)).toFixed(2), y = (48 - 42 * Math.sin(th)).toFixed(2);
  const up = f >= 0 && f <= 1;
  $('sun-dot').setAttribute('cx', up ? x : -10);
  $('sun-dot').setAttribute('cy', up ? y : -10);
  $('sun-done').setAttribute('d', f > 0 ? `M8 48A42 42 0 0 1 ${x} ${y}` : '');
}

// 환경부 기준 4단계 (좋음/보통/나쁨/매우나쁨)
const GRADES = [['좋음', 'good'], ['보통', 'normal'], ['나쁨', 'bad'], ['매우나쁨', 'worst']];
const gradePm10 = v => v <= 30 ? 0 : v <= 80 ? 1 : v <= 150 ? 2 : 3;
const gradePm25 = v => v <= 15 ? 0 : v <= 35 ? 1 : v <= 75 ? 2 : 3;

function setAq(id, v, gradeOf) {
  const [text, cls] = v == null ? ['-', ''] : GRADES[gradeOf(v)];
  $(id).textContent = text;
  $(id).className = 'c-sub ' + cls;
  $(id + '-v').textContent = v == null ? '-' : Math.round(v);
}

function renderAir() {
  const a = state.air;
  renderAlert();
  if (!a) return;
  setAq('pm10', a.pm10, gradePm10);
  setAq('pm25', a.pm25, gradePm25);
  PANELS[3].dataset.src = a.station ? `${a.station} 측정소` : '예측값';   // 시계 강조 'air' 위젯 제목
}

// 위치 이름: 상세 주소를 켰고 알면 도로명 주소, 아니면 구·동
const placeLabel = () => (S.addr && !MANUAL_LOC && (savedLoc() || {}).addr) || CONFIG.name;
function renderFoot() {
  let s = placeLabel();
  if (state.weatherAt) {
    const d = new Date(state.weatherAt);
    s += ` · ${pad(d.getHours())}:${pad(d.getMinutes())} 갱신`;
  }
  if (state.weatherErr || state.airErr) s += ' · 연결 확인 중';
  $('foot').textContent = s;
  PANELS[0].dataset.loc = placeLabel();   // 시계 강조 화면은 상단 바가 없어서 'now' 위젯 제목에 위치 표시
}

// ===== 알림 띠 (시계 강조 화면) =====
// 지금 비·눈이 오면 그 얘기, 아니면 오늘 안에 강수확률 60% 이상인 첫 시각, 그리고 미세먼지 나쁨 이상
// 인터넷이 끊겼으면(꺼져 있거나 날씨를 30분 넘게 못 받음) 마지막으로 받은 시각도 — 이건 알림 띠를 꺼도 보임
const WIFI_OFF = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 20 0M5.2 12.3a10 10 0 0 1 13.6 0M8.6 15.7a5 5 0 0 1 6.8 0M12 19.5h.01M3 3l18 18"/></svg>';
function renderAlert() {
  const out = [], w = state.weather, a = state.air, now = new Date(), h = now.getHours();
  if (!navigator.onLine || (state.weatherErr && now - (state.weatherAt || 0) > 30 * 60e3)) {
    const t = state.weatherAt && new Date(state.weatherAt);
    out.push([WIFI_OFF, t ? `인터넷 연결 끊김 · ${pad(t.getHours())}:${pad(t.getMinutes())} 기준` : '인터넷 연결 끊김']);
  }
  if (S.alert && w) {
    const kind = wmo(w.current.weather_code)[1];
    if (['rain', 'drizzle', 'thunder'].includes(kind)) out.push([icon('rain'), '지금 비가 와요 · 우산 챙기세요']);
    else if (kind === 'snow') out.push([icon('snow'), '지금 눈이 와요 · 길 조심하세요']);
    else if (w.hourly) {
      const t = w.hourly.time, i0 = t.indexOf(`${ymd(now)}T${pad(h)}:00`);
      for (let i = i0 + 1; i0 >= 0 && i < t.length && t[i].startsWith(ymd(now)); i++) {
        if (w.hourly.precipitation_probability[i] < 60) continue;
        const snow = wmo(w.hourly.weather_code[i])[1] === 'snow';
        out.push([icon(snow ? 'snow' : 'rain'), `${hourName(Number(t[i].slice(11, 13)))}쯤 ${snow ? '눈' : '비'} 소식 · ${snow ? '따뜻하게 입으세요' : '우산 챙기세요'}`]);
        break;
      }
    }
  }
  if (S.alert && a && a.pm10 != null && a.pm25 != null) {
    const g = Math.max(gradePm10(a.pm10), gradePm25(a.pm25));
    if (g >= 2) out.push([`<i class="pm${g >= 3 ? ' worst' : ''}"></i>`, `미세먼지 ${g >= 3 ? '매우 나쁨' : '나쁨'} · 마스크 챙기세요`]);
  }
  $('alert').innerHTML = out.map(([ico, text]) => `<span>${ico}${text}</span>`).join('<b>·</b>');
  if ($('alert').hidden !== !out.length) {
    $('alert').hidden = !out.length;
    fitClock();   // 띠가 나타나거나 사라지면 시계 위 여백을 다시 맞춤
  }
}

// ===== 문구 =====
const PHRASES = {
  dawn: ['고요한 새벽이에요. 푹 자는 것도 실력이에요.', '아직 깜깜해요. 조금 더 쉬어도 괜찮아요.'],
  morning: ['좋은 아침이에요!', '물 한 잔으로 하루를 시작해 볼까요?', '오늘도 멋진 하루 보내세요.',
            '오늘 거울 속 모습, 꽤 괜찮은데요?', '천천히, 그래도 꾸준히.'],
  afternoon: ['점심은 맛있게 드셨나요?', '잠깐 일어나서 기지개 한 번 켜요.',
              '오후도 힘내요. 거의 다 왔어요.', '물 마실 시간이에요.'],
  evening: ['오늘 하루도 수고 많았어요.', '저녁 맛있게 드세요.',
            '오늘 잘한 일 하나만 떠올려 봐요.', '이제 좀 쉬어도 돼요.'],
  night: ['오늘도 잘 해냈어요. 푹 쉬어요.', '내일은 더 좋은 날이 될 거예요.', '휴대폰 내려놓고 일찍 자기, 도전!']
};
const timeSlot = h => h < 5 ? 'dawn' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night';

// 날씨·미세먼지·요일에 맞춘 문구
function contextual(now) {
  const out = [];
  const h = now.getHours(), wd = now.getDay();
  const w = state.weather;
  if (w) {
    const today = upcomingDays(w)[0];
    const nowKind = wmo(w.current.weather_code)[1];
    if (nowKind === 'rain' || nowKind === 'drizzle' || nowKind === 'thunder') out.push('지금 비가 오고 있어요. 우산 꼭 챙기세요.');
    else if (nowKind === 'snow') out.push('눈이 오고 있어요. 길 미끄러우니 조심하세요.');
    if (today && h < 20) {
      const i = today[1], d = w.daily;
      const kind = wmo(d.weather_code[i])[1];
      if (d.precipitation_probability_max[i] >= 60 && nowKind !== 'rain') {
        out.push(kind === 'snow' ? '오늘 눈 소식이 있어요. 따뜻하게 챙겨 입어요.' : '오늘 비 소식이 있어요. 우산 챙기세요.');
      }
      if (d.temperature_2m_min[i] <= 0) out.push('많이 추워요. 따뜻하게 입고 나가세요.');
      if (d.temperature_2m_max[i] >= 30) out.push('더운 날이에요. 물 자주 마셔요.');
      if (d.temperature_2m_max[i] - d.temperature_2m_min[i] >= 10) out.push('일교차가 커요. 겉옷 하나 챙기세요.');
    }
  }
  const a = state.air;
  if (a && a.pm10 != null && a.pm25 != null) {
    const g = Math.max(gradePm10(a.pm10), gradePm25(a.pm25));
    if (g >= 2) out.push('미세먼지가 나빠요. 마스크 챙기세요.');
    else if (g === 0 && h >= 8 && h < 18) out.push('공기가 맑아요. 환기하기 좋은 날이에요.');
  }
  if (wd === 1 && h < 12) out.push('한 주의 시작, 이번 주도 화이팅!');
  if (wd === 5 && h >= 17) out.push('불금이에요! 이번 주도 고생했어요.');
  if ((wd === 0 || wd === 6) && h >= 8 && h < 20) out.push('즐거운 주말 보내세요.');
  return out;
}

let phraseIdx = Math.floor(Math.random() * 100);
function nextPhrase(first) {
  const now = new Date();
  const list = [...contextual(now), ...PHRASES[timeSlot(now.getHours())]];
  const text = list[phraseIdx++ % list.length];
  const el = $('phrase');
  if (first) { el.textContent = text; return; }
  if (el.textContent === text) return;
  el.classList.add('fade');
  setTimeout(() => { el.textContent = text; el.classList.remove('fade'); }, 1200);
}
