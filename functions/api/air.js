// 에어코리아 실측 미세먼지 중계 — Cloudflare Pages Functions (/api/air?lat=37.37&lon=127.11)
// 공공데이터포털 키는 Cloudflare Pages 설정의 환경 변수 AIRKOREA_KEY(비밀)로 넣음. 코드·저장소엔 없음
//   필요한 활용신청: 한국환경공단_에어코리아_측정소정보, 한국환경공단_에어코리아_대기오염정보 (같은 인증키)
// 1) 좌표를 TM(중부원점)으로 바꿔 가까운 측정소 목록  2) 가까운 측정소부터 실시간 측정값 (점검 중이면 다음 측정소)
// 응답: { station, time, pm10, pm25 } / 실패하면 오류 상태 코드 → 화면은 Open-Meteo 예측값으로 대신함

const API = 'https://apis.data.go.kr/B552584';

export async function onRequestGet({ request, env }) {
  if (!env.AIRKOREA_KEY) return json({ error: 'AIRKOREA_KEY 없음' }, 503);
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
  if (!(lat > 33 && lat < 39 && lon > 124 && lon < 132)) return json({ error: '국내 좌표가 아님' }, 400);

  try {
    const [tmX, tmY] = toTM(lat, lon);
    // 측정소 위치는 거의 안 바뀌므로 하루, 측정값은 매시 갱신이라 10분 캐시
    const near = await call(env, 'MsrstnInfoInqireSvc/getNearbyMsrstnList',
      { tmX: tmX.toFixed(0), tmY: tmY.toFixed(0) }, 86400);
    for (const s of near.slice(0, 3)) {
      const [m] = await call(env, 'ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty',
        { stationName: s.stationName, dataTerm: 'DAILY', numOfRows: 1, ver: '1.0' }, 600);
      const pm10 = num(m && m.pm10Value), pm25 = num(m && m.pm25Value);
      if (pm10 != null || pm25 != null) {
        return json({ station: s.stationName, time: m.dataTime, pm10, pm25 }, 200, 300);
      }
    }
    return json({ error: '가까운 측정소에 측정값 없음' }, 502);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}

// 공공데이터포털 호출 + Cloudflare 캐시 (캐시 키엔 인증키를 넣지 않음)
async function call(env, path, params, ttl) {
  const qs = new URLSearchParams({ returnType: 'json', numOfRows: '10', pageNo: '1', ...params });
  const cacheKey = new Request(`https://airkorea.cache/${path}?${qs}`);
  const cache = caches.default;
  let res = await cache.match(cacheKey);
  if (!res) {
    // 'Encoding' 키(%가 들어간 키)를 넣었어도 동작하도록 한 번 풀어서 씀
    const key = env.AIRKOREA_KEY.includes('%') ? decodeURIComponent(env.AIRKOREA_KEY) : env.AIRKOREA_KEY;
    const r = await fetch(`${API}/${path}?${qs}&serviceKey=${encodeURIComponent(key)}`);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('에어코리아 응답 오류: ' + text.slice(0, 160)); }
    const head = data.response && data.response.header;
    if (!head || head.resultCode !== '00') throw new Error(`에어코리아 ${head && head.resultCode} ${head && head.resultMsg}`);
    res = new Response(JSON.stringify(data.response.body.items || []), {
      headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` }
    });
    await cache.put(cacheKey, res.clone());
  }
  return res.json();
}

// '23' → 23, '-'·빈값(점검·통신장애) → null
const num = v => (v == null || v === '' || v === '-' || isNaN(Number(v))) ? null : Number(v);

const json = (body, status = 200, ttl = 0) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': ttl ? `public, max-age=${ttl}` : 'no-store'
  }
});

// 위경도 → TM 중부원점 (GRS80, 원점 38°N 127°E, 가산 x 200000 · y 500000 — EPSG:5181)
// 횡메르카토르 정방향 식 (Snyder). 가까운 측정소 찾기용이라 수 m 정도 오차는 상관없음
function toTM(lat, lon) {
  const D = Math.PI / 180, a = 6378137, f = 1 / 298.257222101;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const meridian = p => a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
  const phi = lat * D;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = (lon - 127) * D * Math.cos(phi);
  const x = 200000 + N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = 500000 + meridian(phi) - meridian(38 * D) + N * Math.tan(phi) * (A * A / 2
    + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720);
  return [x, y];
}
