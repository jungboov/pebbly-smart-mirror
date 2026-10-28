// 폰으로 미러 설정하기 — Cloudflare Pages Functions (GET·POST /api/sync?id=...)
// 미러가 만든 무작위 연결 번호(id, 32자리 16진수)마다 설정 하나를 KV에 저장
//   미러: 설정에서 '폰으로 설정'을 누르면 지금 설정을 올리고 QR(주소 ?remote=id)을 띄움, 이후 10초마다 받아 반영하고 '받았음'을 남김
//   폰: QR 주소로 열면 이 id의 설정을 받아 설정 화면을 띄우고, '미러에 적용'을 누르면 올린 뒤 미러가 받았는지 확인
// KV 바인딩 이름: MIRROR_KV (Cloudflare Pages > 설정 > 바인딩)
// KV는 다른 곳에서 쓴 값이 보이기까지 최대 1분쯤 걸려서, 같은 데이터센터 캐시(Cache API, 30초)에도 같이 넣고 먼저 읽음
//   → 폰과 미러가 같은 지역(같은 데이터센터)이면 바로, 아니면 KV로 1분 안에
// 저장하는 것: 미러 설정(위젯·알람·교통 정류장 등). 위치는 저장하지 않음
// GET  → { at, orient, settings } 또는 {} (없음) / GET &ack=1 → { at: 미러가 마지막으로 받은 설정의 at } 또는 {}
// POST { orient, settings } → { ok, at } / POST &ack=at → { ok } (미러가 받았음) / DELETE → { ok } (연결 끊기)
// at은 서버 시각: 미러·폰 시계가 조금 달라도 어느 쪽이 나중에 바꿨는지 맞게 가림

const ID = /^[0-9a-f]{32}$/;
const MAX = 32 * 1024;
const TTL = 180 * 24 * 3600;   // 반년 동안 안 쓰면 지워짐
const FAST = 30;               // 데이터센터 캐시 보관(초)

export async function onRequest({ request, env }) {
  if (!env.MIRROR_KV) return json({ error: 'MIRROR_KV 없음' }, 503);
  const q = new URL(request.url).searchParams;
  const id = q.get('id') || '';
  if (!ID.test(id)) return json({ error: 'id 형식' }, 400);
  const key = (q.has('ack') ? 'sync-ack:' : 'sync:') + id;
  if (request.method === 'GET') {
    const v = await read(env, key);
    return v ? new Response(v, { headers: HEADERS }) : json({});
  }
  if (request.method === 'POST' && q.has('ack')) {
    const at = Number(q.get('ack'));
    if (!(at > 0)) return json({ error: 'ack 형식' }, 400);
    await write(env, key, JSON.stringify({ at }));
    return json({ ok: true });
  }
  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX) return json({ error: '너무 큼' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'JSON 아님' }, 400); }
    if (!body || !body.settings || typeof body.settings !== 'object') return json({ error: '형식' }, 400);
    const at = Date.now();
    await write(env, key, JSON.stringify({ at, orient: body.orient === 'P' ? 'P' : 'L', settings: body.settings }));
    return json({ ok: true, at });
  }
  if (request.method === 'DELETE') {
    await Promise.all(['sync:', 'sync-ack:'].map(p => Promise.all([env.MIRROR_KV.delete(p + id), caches.default.delete(fastKey(p + id))])));
    return json({ ok: true });
  }
  return json({ error: 'GET·POST·DELETE만' }, 405);
}

// 데이터센터 캐시 먼저(30초 안에 이곳에서 쓰거나 읽은 값), 없으면 KV에서 읽어 캐시에 넣음
const fastKey = key => new Request(`https://sync.cache/${key}`);
async function read(env, key) {
  const hit = await caches.default.match(fastKey(key));
  if (hit) return hit.text();
  const v = await env.MIRROR_KV.get(key);
  if (v) await caches.default.put(fastKey(key), new Response(v, { headers: { 'cache-control': `max-age=${FAST}` } }));
  return v;
}
async function write(env, key, v) {
  await Promise.all([
    env.MIRROR_KV.put(key, v, { expirationTtl: TTL }),
    caches.default.put(fastKey(key), new Response(v, { headers: { 'cache-control': `max-age=${FAST}` } }))
  ]);
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
