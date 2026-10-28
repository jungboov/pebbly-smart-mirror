// 기상청 동네예보 중계 — Cloudflare Pages Functions (/api/weather?lat=37.50&lon=126.76)
// 공공데이터포털 키는 미세먼지·버스와 같은 DATA_GO_KR_KEY(Cloudflare 비밀 환경 변수). 코드·저장소엔 없음
//   필요한 활용신청: 기상청_단기예보 ((구)_동네예보) 조회서비스
// 좌표를 기상청 5km 격자(nx, ny)로 바꿔 세 가지를 합침
//   초단기실황(지금 관측) + 초단기예보(6시간, 매시 30분 발표) + 단기예보(약 3일, 하루 8번 발표)
//   하루 최저(06시)·최고(15시)는 그 시각이 들어 있는 가장 최근 발표 값 — 날씨누리와 같은 기준
// 응답: { grid, base, now: { time, t, feel, reh, wsd, vec, code, desc }, hours: [{ time, t, pop, code }], days: [{ date, min, max }] }
//   code는 화면이 쓰는 WMO 날씨 코드, desc는 기상청 말(구름많음 등). 실패하면 오류 상태 코드 → 화면은 Open-Meteo 값을 씀

const API = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

export async function onRequestGet({ request, env }) {
  if (!(env.DATA_GO_KR_KEY || env.AIRKOREA_KEY)) return json({ error: 'DATA_GO_KR_KEY 없음' }, 503);
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
  if (!(lat > 33 && lat < 39 && lon > 124 && lon < 132)) return json({ error: '국내 좌표가 아님' }, 400);

  try {
    const [nx, ny] = toGrid(lat, lon), at = { nx, ny };
    const kst = new Date(Date.now() + 9 * 3600e3);   // 아래 계산은 모두 한국 시각 (getUTC*로 읽음)
    // 단기예보: 02·05·08·11·14·17·20·23시 발표, 10분쯤 뒤부터 나옴. 아직 없으면(NO_DATA) 한 번 앞 발표
    const vil = await withFallback(back => vilBase(kst, back), b => call(env, 'getVilageFcst', b, at, 3 * 3600));
    // 오늘 최저(06시)는 02시 발표(05시 발표엔 오늘 최저가 빠져 있음), 최고(15시)는 14시 발표가 그 값이 들어 있는 마지막 발표
    // → 지났으면 그것도 받음 (그 전이면 최신 발표에 들어 있음. 02시 10분 전엔 전날 23시 발표에 둘 다). 오늘 지난 시간 기온도 여기서
    const today = ymd(new Date(kst.getTime() - 10 * 60e3)), older = [];
    for (const time of ['0200', '0500', '1400']) {
      if (today + time >= vil.base.date + vil.base.time) continue;
      const src = await call(env, 'getVilageFcst', { date: today, time }, at, 24 * 3600).catch(() => null);
      if (src) older.push(src);
    }
    // 초단기: 실황은 매시 정각 자료가 40분쯤, 예보는 매시 30분 발표가 45분쯤 나옴. 없어도 단기예보로 그림
    const [obs, ultra] = await Promise.all([
      withFallback(back => hourBase(kst, 40, 0, back), b => call(env, 'getUltraSrtNcst', b, at, 3600)).catch(() => null),
      withFallback(back => hourBase(kst, 45, 30, back), b => call(env, 'getUltraSrtFcst', b, at, 3600)).catch(() => null)
    ]);

    // 시간별: 앞 발표 → 최신 단기예보 → 초단기예보 순으로 덮어씀 (가까운 발표일수록 정확)
    const hours = new Map();
    for (const src of [...older, vil, ultra]) {
      if (!src) continue;
      for (const it of src.items) {
        const key = `${iso(it.fcstDate)}T${it.fcstTime.slice(0, 2)}:00`;
        const h = hours.get(key) || {};
        h[it.category] = it.fcstValue;
        hours.set(key, h);
      }
    }
    // 하루 최저·최고: 그날 TMN·TMX를 앞 발표부터 덮어씀 → 들어 있는 가장 최근 발표 값 (없는 날은 화면이 시간별 기온에서)
    const days = new Map();
    for (const src of [...older, vil]) {
      for (const it of src.items) {
        if (it.category !== 'TMN' && it.category !== 'TMX') continue;
        const d = days.get(iso(it.fcstDate)) || {};
        d[it.category === 'TMN' ? 'min' : 'max'] = num(it.fcstValue);
        days.set(iso(it.fcstDate), d);
      }
    }

    const list = [...hours].sort(([a], [b]) => a < b ? -1 : 1).map(([time, h]) => {
      const t = num(h.T1H ?? h.TMP), [code] = weatherOf(h.SKY, h.PTY, amount(h.RN1 ?? h.PCP));   // 초단기 값이 있으면 그것
      return { time, t, pop: num(h.POP), code };
    }).filter(h => h.t != null);
    // 초단기예보엔 강수확률이 없음 → 같은 시각 단기예보 값 (위에서 합쳐 둠). 그래도 없으면 null

    // 지금: 실황 관측(기온·습도·바람·강수형태) + 하늘 상태는 초단기예보 첫 시각 (실황엔 하늘 상태가 없음)
    let now = null;
    if (obs) {
      const o = Object.fromEntries(obs.items.map(it => [it.category, it.obsrValue]));
      const nextHour = ultra && ultra.items.filter(it => it.category === 'SKY').sort((a, b) => (a.fcstDate + a.fcstTime < b.fcstDate + b.fcstTime ? -1 : 1))[0];
      const t = num(o.T1H), wsd = num(o.WSD), reh = num(o.REH);
      const [code, desc] = weatherOf(nextHour ? nextHour.fcstValue : null, o.PTY, amount(o.RN1));
      if (t != null) now = {
        time: `${iso(obs.base.date)}T${obs.base.time.slice(0, 2)}:00`, t, reh, wsd, vec: num(o.VEC),
        feel: Math.round(feels(t, wsd, reh, kst.getUTCMonth() + 1) * 10) / 10, code, desc
      };
    }

    return json({
      grid: [nx, ny], base: `${vil.base.date} ${vil.base.time}`, now, hours: list,
      days: [...days].sort(([a], [b]) => a < b ? -1 : 1).map(([date, d]) => ({ date, ...d }))
    }, 200, 300);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 503);
  }
}

// ── 발표 시각 ──
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const pad = n => String(n).padStart(2, '0');
// 단기예보: ready분 지난 가장 최근 발표 (back번째 앞 것)
function vilBase(kst, back = 0) {
  const t = new Date(kst.getTime() - 10 * 60e3);
  const hrs = [2, 5, 8, 11, 14, 17, 20, 23];
  let k = hrs.filter(h => h <= t.getUTCHours()).length - 1 - back;
  let day = new Date(t);
  while (k < 0) { k += 8; day = new Date(day.getTime() - 864e5); }
  return { date: ymd(day), time: pad(hrs[k]) + '00' };
}
// 초단기: 매시 minute분 발표가 ready분에 나옴 (back시간 앞 것)
function hourBase(kst, ready, minute, back = 0) {
  const t = new Date(kst.getTime() - ready * 60e3 - back * 3600e3);
  return { date: ymd(t), time: pad(t.getUTCHours()) + pad(minute) };
}
async function withFallback(base, get) {
  try { return await get(base(0)); } catch (e) {
    if (!e.noData) throw e;
    return get(base(1));
  }
}

// ── 공공데이터포털 호출 + Cloudflare 캐시 (발표 시각이 키에 들어가서 같은 발표는 한 번만 받음. 캐시 키엔 인증키 없음) ──
async function call(env, op, base, { nx, ny }, ttl) {
  const qs = new URLSearchParams({ dataType: 'JSON', base_date: base.date, base_time: base.time, nx, ny });
  const cacheKey = new Request(`https://kma.cache/${op}?${qs}`);
  let res = await caches.default.match(cacheKey);
  if (!res) {
    const raw = env.DATA_GO_KR_KEY || env.AIRKOREA_KEY;
    const key = raw.includes('%') ? decodeURIComponent(raw) : raw;   // 'Encoding' 키를 넣었어도 동작
    // 단기예보는 1000줄이 넘을 수 있어(약 3일 × 12항목) 쪽을 넘겨 가며 다 받음
    const items = [];
    for (let page = 1; page <= 3; page++) {
      const r = await fetch(`${API}/${op}?${qs}&pageNo=${page}&numOfRows=1000&serviceKey=${encodeURIComponent(key)}`);
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('기상청 응답 오류: ' + text.replace(/\s+/g, ' ').slice(0, 200)); }
      const head = data.response && data.response.header, body = data.response && data.response.body;
      if (head && head.resultCode === '03') throw Object.assign(new Error('기상청 ' + op + ' 아직 발표 전'), { noData: true });
      if (!head || head.resultCode !== '00') throw new Error(`기상청 ${head && head.resultCode} ${head && head.resultMsg}`);
      const got = (body.items && body.items.item) || [];
      items.push(...got);
      if (!got.length || items.length >= Number(body.totalCount)) break;
    }
    if (!items.length) throw Object.assign(new Error('기상청 ' + op + ' 자료 없음'), { noData: true });
    res = new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` } });
    await caches.default.put(cacheKey, res.clone());
  }
  return { base, items: await res.json() };
}

// ── 값 ──
const iso = d => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
const num = v => (v == null || v === '' || isNaN(Number(v)) || Number(v) <= -900 || Number(v) >= 900) ? null : Number(v);
// 강수량: '강수없음' 0, '1mm 미만'(1.0mm 미만) 0.5, '30.0~50.0mm' 30, '50.0mm 이상' 50, 숫자는 그대로
function amount(v) {
  if (v == null || /없음/.test(v)) return 0;
  if (/미만/.test(v)) return .5;
  const m = String(v).match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}
// 하늘(SKY 1 맑음·3 구름많음·4 흐림) + 강수형태(PTY) → [WMO 날씨 코드, 기상청 말]
// PTY: 1 비, 2 비/눈, 3 눈, 4 소나기, 5 빗방울, 6 빗방울눈날림, 7 눈날림 (5~7은 초단기만)
function weatherOf(sky, pty, mm) {
  switch (String(pty)) {
    case '1': return mm >= 15 ? [65, '강한 비'] : mm >= 3 ? [63, '비'] : [61, '약한 비'];
    case '2': return [68, '비 또는 눈'];
    case '3': return mm >= 5 ? [75, '많은 눈'] : [73, '눈'];
    case '4': return [80, '소나기'];
    case '5': return [51, '빗방울'];
    case '6': return [68, '빗방울·눈날림'];
    case '7': return [71, '눈날림'];
  }
  return { 1: [0, '맑음'], 3: [2, '구름많음'], 4: [3, '흐림'] }[String(sky)] || [3, '흐림'];
}
// 체감온도 (기상청 식): 10~4월은 바람 체감(기온 10℃ 이하, 바람 1.3m/s 이상일 때), 5~9월은 습도 체감
function feels(t, wsd, reh, month) {
  if (month >= 5 && month <= 9) {
    if (reh == null) return t;
    const tw = t * Math.atan(.151977 * Math.sqrt(reh + 8.313659)) + Math.atan(t + reh) - Math.atan(reh - 1.67633)
      + .00391838 * reh ** 1.5 * Math.atan(.023101 * reh) - 4.686035;
    return -.2442 + .55399 * tw + .45535 * t - .0022 * tw * tw + .00278 * tw * t + 3;
  }
  const v = (wsd || 0) * 3.6;
  if (t > 10 || v < 4.8) return t;
  const p = v ** .16;
  return 13.12 + .6215 * t - 11.37 * p + .3965 * p * t;
}

const json = (body, status = 200, ttl = 0) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': ttl ? `public, max-age=${ttl}` : 'no-store'
  }
});

// 위경도 → 기상청 동네예보 격자 (람베르트 정각원추, 격자 5km, 기준 38°N 126°E = (43, 136)) — 기상청 공개 변환식
function toGrid(lat, lon) {
  const D = Math.PI / 180, re = 6371.00877 / 5, s1 = 30 * D, s2 = 60 * D, olon = 126 * D, olat = 38 * D;
  const sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(Math.tan(Math.PI / 4 + s2 / 2) / Math.tan(Math.PI / 4 + s1 / 2));
  const sf = Math.tan(Math.PI / 4 + s1 / 2) ** sn * Math.cos(s1) / sn;
  const ro = re * sf / Math.tan(Math.PI / 4 + olat / 2) ** sn;
  const ra = re * sf / Math.tan(Math.PI / 4 + lat * D / 2) ** sn;
  let th = lon * D - olon;
  if (th > Math.PI) th -= 2 * Math.PI;
  if (th < -Math.PI) th += 2 * Math.PI;
  th *= sn;
  return [Math.floor(ra * Math.sin(th) + 43 + .5), Math.floor(ro - ra * Math.cos(th) + 136 + .5)];
}
