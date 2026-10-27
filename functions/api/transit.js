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
          try { out.sub[station] = (await subway(env, station, 30)).map(subwayArrival).filter(Boolean).sort((x, y) => x.ord - y.ord); }
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

// ── 서울 버스 (서울시 버스정보시스템, resultType=json) ──
// 정류장 id = '정류소번호(arsId)_정류소ID(stId)'. 5자리 정류소 번호는 지역끼리 겹치는 경우가 있어서
// (예: 부천시청 앞 11154 ↔ 노원 불암동 11154) 번호로 조회한 뒤 stId가 같은 것만 씀
async function seoul(env, path, params, ttl) {
  const qs = new URLSearchParams({ resultType: 'json', ...params });
  const data = await cached(`${SEOUL}/${path}?${qs}&serviceKey=${encodeURIComponent(dataKey(env))}`, `seoul/${path}?${qs}`, ttl);
  const h = data.msgHeader || {};
  if (String(h.headerCd) === '4') return [];   // 결과 없음
  if (String(h.headerCd) !== '0') throw new Error(`${h.headerCd} ${h.headerMsg}`);
  return list(data.msgBody && data.msgBody.itemList);
}
const seoulStop = s => {
  const st = s.stId || s.stationId;
  return {
    src: 'seoul', id: st ? `${s.arsId}_${st}` : String(s.arsId), name: s.stNm || s.stationNm, no: String(s.arsId), region: '서울',
    lat: Number(s.tmY || s.gpsY) || null, lon: Number(s.tmX || s.gpsX) || null, dist: s.dist ? Number(s.dist) : undefined
  };
};
const validArs = s => s.arsId && String(s.arsId) !== '0';
const seoulNear = async (env, lat, lon) =>
  (await seoul(env, 'stationinfo/getStationByPos', { tmX: lon, tmY: lat, radius: 500 }, 86400)).filter(validArs).map(seoulStop);
const seoulSearch = async (env, word) =>
  (await seoul(env, 'stationinfo/getStationByName', { stSrch: word }, 86400)).filter(validArs).map(seoulStop);
// 정류소 번호로 받은 노선·도착 중 이 정류장(stId) 것만
async function seoulAt(env, id) {
  const [ars, st] = String(id).split('_');
  const items = await seoul(env, 'stationinfo/getStationByUid', { arsId: ars }, 30);
  return st ? items.filter(i => i.stId == null || String(i.stId) === st) : items;
}
// 순환 노선은 한 정류장을 방향별로 두 번 지나서(예: 6613 대림역·양천공영차고지 방향) 노선 id에 방향을 붙임
const seoulRouteId = r => `${r.busRouteId}~${r.adirection || ''}`;
const seoulRoutes = async (env, id) =>
  (await seoulAt(env, id)).map(r => ({ id: seoulRouteId(r), name: String(r.rtNm), dest: r.adirection ? `${r.adirection} 방향` : '' }));
const seoulArrivals = async (env, id) =>
  (await seoulAt(env, id)).map(a => ({ routeId: seoulRouteId(a), ...arrMsg(a.arrmsg1, 1), ...arrMsg(a.arrmsg2, 2) }));
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
// 열차 하나 → { min(도착까지 분) 또는 text('전역', '3정거장 전'), ord(가까운 순 정렬값), express }
// arvlCd: 0 진입 · 1 도착 · 2 출발(이미 떠남 → 뺌) · 3 전역출발 · 4 전역진입 · 5 전역도착 · 99 운행 중
// 1호선·서해선은 남은 초(barvlDt)가 0으로 오는 경우가 많아 '[N]번째 전역' 문구로 정거장 수를 씀
function subwayArrival(a) {
  const code = String(a.arvlCd), sec = Number(a.barvlDt) || 0, m = String(a.arvlMsg2 || '');
  if (code === '2') return null;
  const t = m.match(/(\d+)분/), n = m.match(/\[(\d+)\]번째/);
  let min = null, text = null;
  if (code === '0' || code === '1') min = 0;
  else if (sec > 0) min = sec / 60;
  else if (t) min = Number(t[1]);
  else if (['3', '4', '5'].includes(code)) text = '전역';
  else if (n) text = `${n[1]}정거장 전`;   // '[5]번째 전역'에도 '전역'이 들어 있어서 정거장 수를 먼저 봄
  else if (/전역/.test(m)) text = '전역';
  else text = m.replace(/\(.*\)/, '').trim() || null;
  const ord = min != null ? min : text === '전역' ? 1.5 : n ? Number(n[1]) * 2 : 99;
  return {
    sid: String(a.subwayId), updn: a.updnLine, min, text, ord,
    express: /급행|특급/.test(`${a.btrainSttus || ''} ${a.trainLineNm || ''}`), dest: a.bstatnNm || ''
  };
}
// '인천행 - 송내방면 (급행)' → '송내방면'
const direction = s => {
  const m = String(s || '').split('-');
  return (m[1] || m[0] || '').replace(/\(.*?\)/g, '').trim();
};

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
