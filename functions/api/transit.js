// 버스·지하철 정류장 검색·도착 정보 중계 — Cloudflare Pages Functions (/api/transit?op=...)
// 키는 Cloudflare Pages 설정의 비밀 환경 변수로만 넣음 (코드·저장소엔 없음)
//   DATA_GO_KR_KEY   공공데이터포털 — 경기도 정류소 조회·경기도 버스도착정보 조회,
//                    서울특별시 정류소정보조회·서울특별시 버스도착정보조회 (에어코리아와 같은 키)
//   SEOUL_SUBWAY_KEY 서울 열린데이터광장 실시간 지하철 인증키
// op=near&lat&lon       내 주변 버스 정류장 (경기 + 서울)
// op=search&q           버스 정류장 이름 검색 (경기 + 서울)
// op=routes&src&id      정류장을 지나는 노선
// op=subway-search&q    지하철역의 노선·방면 (지금 운행 중인 열차 기준)
// op=board&bus=gg:ID,seoul:ARS&sub=역명,역명   등록한 정류장·역의 도착 정보
// 한쪽(경기/서울)만 실패해도 나머지는 돌려주고 errors에 이유를 담음

const GG = 'https://apis.data.go.kr/6410000';
const SEOUL = 'http://ws.bus.go.kr/api/rest';
const SUBWAY = 'http://swopenapi.seoul.go.kr/api/subway';
const LINES = {
  1001: '1호선', 1002: '2호선', 1003: '3호선', 1004: '4호선', 1005: '5호선', 1006: '6호선', 1007: '7호선',
  1008: '8호선', 1009: '9호선', 1061: '중앙선', 1063: '경의중앙선', 1065: '공항철도', 1067: '경춘선',
  1075: '수인분당선', 1077: '신분당선', 1081: '경강선', 1092: '우이신설선', 1093: '서해선', 1094: '신림선', 1032: 'GTX-A'
};

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const op = q.get('op');
  try {
    if (op === 'near' || op === 'search') {
      const lat = Number(q.get('lat')), lon = Number(q.get('lon')), word = (q.get('q') || '').trim();
      if (op === 'near' && !(lat > 33 && lat < 39 && lon > 124 && lon < 132)) return json({ error: '국내 좌표가 아님' }, 400);
      if (op === 'search' && !word) return json({ error: '검색어 없음' }, 400);
      const parts = await Promise.allSettled([
        op === 'near' ? ggNear(env, lat, lon) : ggSearch(env, word),
        op === 'near' ? seoulNear(env, lat, lon) : seoulSearch(env, word)
      ]);
      let stops = parts.flatMap(p => p.status === 'fulfilled' ? p.value : []);
      if (op === 'near') {
        stops.forEach(s => { s.dist = s.lat ? Math.round(meters(lat, lon, s.lat, s.lon)) : s.dist; });
        stops = stops.sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9)).slice(0, 20);
      } else stops = stops.slice(0, 30);
      return json({ stops, errors: errorsOf(parts, ['경기 버스', '서울 버스']) });
    }
    if (op === 'routes') {
      const src = q.get('src'), id = q.get('id');
      const routes = src === 'gg' ? await ggRoutes(env, id) : await seoulRoutes(env, id);
      return json({ routes });
    }
    if (op === 'subway-search') {
      const station = (q.get('q') || '').trim().replace(/역$/, '');
      if (!station) return json({ error: '검색어 없음' }, 400);
      const list = await subway(env, station, 30);
      const dirs = new Map();
      for (const a of list) {
        const key = `${a.subwayId}:${a.updnLine}`;
        if (!dirs.has(key)) dirs.set(key, {
          station: a.statnNm || station, sid: a.subwayId, updn: a.updnLine,
          line: LINES[a.subwayId] || a.subwayId, dir: direction(a.trainLineNm)
        });
      }
      return json({ dirs: [...dirs.values()] });
    }
    if (op === 'board') {
      const bus = (q.get('bus') || '').split(',').filter(Boolean).slice(0, 8);
      const sub = (q.get('sub') || '').split(',').filter(Boolean).slice(0, 4);
      const out = { bus: {}, sub: {}, errors: [] };
      await Promise.all([
        ...bus.map(async key => {
          const [src, id] = key.split(':');
          try { out.bus[key] = src === 'gg' ? await ggArrivals(env, id) : await seoulArrivals(env, id); }
          catch (e) { out.errors.push(`${src === 'gg' ? '경기' : '서울'} 버스: ${msg(e)}`); }
        }),
        ...sub.map(async station => {
          try { out.sub[station] = (await subway(env, station, 30)).map(subwayArrival); }
          catch (e) { out.errors.push(`지하철: ${msg(e)}`); }
        })
      ]);
      return json(out);
    }
    return json({ error: 'op 없음' }, 400);
  } catch (e) {
    return json({ error: msg(e) }, 503);
  }
}

// ── 경기 버스 (경기도 버스정보시스템, 공공데이터포털 v2 JSON) ──
async function gg(env, path, params, ttl) {
  const qs = new URLSearchParams({ format: 'json', ...params });
  const data = await cached(`${GG}/${path}?${qs}&serviceKey=${encodeURIComponent(dataKey(env))}`, `gg/${path}?${qs}`, ttl);
  const r = data.response || data;
  const code = String(r.msgHeader && r.msgHeader.resultCode);
  if (code === '4') return {};   // 결과 없음
  if (code !== '0') throw new Error(`${code} ${r.msgHeader && r.msgHeader.resultMessage}`);
  return r.msgBody || {};
}
const ggStop = s => ({
  src: 'gg', id: String(s.stationId), name: s.stationName, no: s.mobileNo ? String(s.mobileNo).trim() : '',
  region: s.regionName || '', lat: Number(s.y) || null, lon: Number(s.x) || null
});
const ggNear = async (env, lat, lon) =>
  list((await gg(env, 'busstationservice/v2/getBusStationAroundListv2', { x: lon, y: lat }, 86400)).busStationAroundList).map(ggStop);
const ggSearch = async (env, word) =>
  list((await gg(env, 'busstationservice/v2/getBusStationListv2', { keyword: word }, 86400)).busStationList).map(ggStop);
const ggRoutes = async (env, id) =>
  list((await gg(env, 'busstationservice/v2/getBusStationViaRouteListv2', { stationId: id }, 86400)).busRouteList)
    .map(r => ({ id: String(r.routeId), name: String(r.routeName), dest: r.routeDestName || '' }));
// 도착 예정 시간(분). 값이 없으면 null
const ggArrivals = async (env, id) =>
  list((await gg(env, 'busarrivalservice/v2/getBusArrivalListv2', { stationId: id }, 30)).busArrivalList)
    .map(a => ({ routeId: String(a.routeId), min1: minutes(a.predictTime1), min2: minutes(a.predictTime2) }));

// ── 서울 버스 (서울시 버스정보시스템, resultType=json) — 정류장 id는 정류소 번호(arsId) ──
async function seoul(env, path, params, ttl) {
  const qs = new URLSearchParams({ resultType: 'json', ...params });
  const data = await cached(`${SEOUL}/${path}?${qs}&serviceKey=${encodeURIComponent(dataKey(env))}`, `seoul/${path}?${qs}`, ttl);
  const h = data.msgHeader || {};
  if (String(h.headerCd) === '4') return [];   // 결과 없음
  if (String(h.headerCd) !== '0') throw new Error(`${h.headerCd} ${h.headerMsg}`);
  return list(data.msgBody && data.msgBody.itemList);
}
const seoulStop = s => ({
  src: 'seoul', id: String(s.arsId), name: s.stNm || s.stationNm, no: String(s.arsId), region: '서울',
  lat: Number(s.tmY || s.gpsY) || null, lon: Number(s.tmX || s.gpsX) || null, dist: s.dist ? Number(s.dist) : undefined
});
const validArs = s => s.arsId && String(s.arsId) !== '0';
const seoulNear = async (env, lat, lon) =>
  (await seoul(env, 'stationinfo/getStationByPos', { tmX: lon, tmY: lat, radius: 500 }, 86400)).filter(validArs).map(seoulStop);
const seoulSearch = async (env, word) =>
  (await seoul(env, 'stationinfo/getStationByName', { stSrch: word }, 86400)).filter(validArs).map(seoulStop);
const seoulRoutes = async (env, ars) =>
  (await seoul(env, 'stationinfo/getStationByUid', { arsId: ars }, 30))
    .map(r => ({ id: String(r.busRouteId), name: String(r.rtNm), dest: r.adirection ? `${r.adirection} 방향` : '' }));
const seoulArrivals = async (env, ars) =>
  (await seoul(env, 'stationinfo/getStationByUid', { arsId: ars }, 30))
    .map(a => ({ routeId: String(a.busRouteId), ...arrMsg(a.arrmsg1, 1), ...arrMsg(a.arrmsg2, 2) }));
// '3분12초후[2번째 전]' → 3.2분, '곧 도착' → 0, '운행종료'·'출발대기' 등은 글자 그대로
function arrMsg(m, n) {
  m = String(m || '').trim();
  const t = m.match(/(\d+)분(?:(\d+)초)?/);
  if (t) return { [`min${n}`]: Number(t[1]) + (Number(t[2]) || 0) / 60 };
  if (m.includes('곧 도착')) return { [`min${n}`]: 0 };
  return { [`min${n}`]: null, [`msg${n}`]: m.replace(/\[.*\]/, '').trim() || null };
}

// ── 지하철 (서울 열린데이터광장 실시간 도착정보) ──
async function subway(env, station, ttl) {
  if (!env.SEOUL_SUBWAY_KEY) throw new Error('SEOUL_SUBWAY_KEY 없음');
  const url = `${SUBWAY}/${encodeURIComponent(env.SEOUL_SUBWAY_KEY)}/json/realtimeStationArrival/0/40/${encodeURIComponent(station)}`;
  const data = await cached(url, `subway/${station}`, ttl);
  const em = data.errorMessage || data;
  if (em.code === 'INFO-200') return [];   // 해당 데이터 없음
  if (em.code && em.code !== 'INFO-000') throw new Error(`${em.code} ${em.message}`);
  return list(data.realtimeArrivalList);
}
// 도착까지 초(barvlDt)가 있으면 분으로, 없으면 안내 문구('전역 도착', '3번째 전역' 등)
function subwayArrival(a) {
  const sec = Number(a.barvlDt) || 0, m = String(a.arvlMsg2 || '');
  let min = sec > 0 ? sec / 60 : null, text = null;
  if (min == null) {
    const t = m.match(/(\d+)분/), n = m.match(/\[(\d+)\]번째/);
    if (t) min = Number(t[1]);
    else if (/진입|도착/.test(m) && !/전역/.test(m)) min = 0;
    else if (n) text = `${n[1]}정거장 전`;
    else if (/전역/.test(m)) text = '전역';
    else text = m.replace(/\(.*\)/, '').trim() || null;
  }
  return { sid: String(a.subwayId), updn: a.updnLine, min, text, dest: a.bstatnNm || '' };
}
// '인천행 - 송내방면' → '송내방면'
const direction = s => { const m = String(s || '').split('-'); return (m[1] || m[0] || '').trim(); };

// ── 공통 ──
function dataKey(env) {
  const raw = env.DATA_GO_KR_KEY || env.AIRKOREA_KEY;
  if (!raw) throw new Error('DATA_GO_KR_KEY 없음');
  return raw.includes('%') ? decodeURIComponent(raw) : raw;   // 'Encoding' 키를 넣었어도 동작
}

// 응답을 Cloudflare 캐시에 ttl초 보관 (캐시 키엔 인증키를 넣지 않음). 여러 기기가 같이 써도 호출이 적게 나감
async function cached(url, key, ttl) {
  const cacheKey = new Request(`https://transit.cache/${key}`);
  let res = await caches.default.match(cacheKey);
  if (!res) {
    const r = await fetch(url);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('응답 오류: ' + text.replace(/\s+/g, ' ').slice(0, 160)); }
    res = new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` } });
    await caches.default.put(cacheKey, res.clone());
  }
  return res.json();
}

const list = x => Array.isArray(x) ? x : x ? [x] : [];
const minutes = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
const msg = e => String((e && e.message) || e);
const errorsOf = (parts, names) => parts.map((p, i) => p.status === 'rejected' ? `${names[i]}: ${msg(p.reason)}` : null).filter(Boolean);
function meters(a1, o1, a2, o2) {
  const R = 6371e3, D = Math.PI / 180;
  const x = Math.sin((a2 - a1) * D / 2) ** 2 + Math.cos(a1 * D) * Math.cos(a2 * D) * Math.sin((o2 - o1) * D / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
