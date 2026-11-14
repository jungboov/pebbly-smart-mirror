// Open-Meteo 예보 중계 — Cloudflare Pages Functions (/api/forecast?lat=37.62&lon=126.83)
// 화면(js/weather.js)은 보통 api.open-meteo.com에서 바로 받는데, 기기 쪽 네트워크가 막거나 통신사 공용 IP라
// Open-Meteo 한도(IP마다)가 다른 사람들 몫으로 차서 바로 못 받으면 이리로 받음 (전엔 그동안 날씨가 안 바뀌고 '인터넷 연결 끊김'만 떴음)
// 아무 주소나 대신 받아 주는 중계가 되지 않게 매개변수는 화면과 같게 여기서 고정. 좌표는 소수 둘째 자리(약 1km), 같은 좌표는 Cloudflare 캐시에 10분
// 응답은 Open-Meteo 응답 그대로 / 실패하면 오류 상태 코드 → 화면은 기상청 값만으로 그림

const API = 'https://api.open-meteo.com/v1/forecast';
const FIELDS = {
  timezone: 'auto', past_days: 1, forecast_days: 6, wind_speed_unit: 'ms',
  current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,uv_index,wind_speed_10m,wind_direction_10m,precipitation_probability',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
  hourly: 'temperature_2m,weather_code,precipitation_probability,is_day'
};

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
  if (!(lat > 33 && lat < 39 && lon > 124 && lon < 132)) return json({ error: '국내 좌표가 아님' }, 400);
  const qs = new URLSearchParams({ latitude: lat.toFixed(2), longitude: lon.toFixed(2), ...FIELDS });
  const cacheKey = new Request(`https://om.cache/forecast?${qs}`);
  try {
    let res = await caches.default.match(cacheKey);
    if (!res) {
      const r = await fetch(`${API}?${qs}`, { signal: AbortSignal.timeout(10000) });
      const text = await r.text();
      if (!r.ok) throw new Error(`Open-Meteo ${r.status} ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
      JSON.parse(text);   // 깨진 응답은 캐시에 넣지 않음
      res = new Response(text, { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=600' } });
      await caches.default.put(cacheKey, res.clone());
    }
    return new Response(await res.text(), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
