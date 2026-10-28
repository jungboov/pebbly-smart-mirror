// 폰으로 미러 설정하기 — Cloudflare Pages Functions (GET·POST /api/sync?id=...)
// 미러가 만든 무작위 연결 번호(id, 32자리 16진수)마다 설정 하나를 KV에 저장
//   미러: 설정에서 '폰으로 설정'을 누르면 지금 설정을 올리고 QR(주소 ?remote=id)을 띄움, 이후 주기적으로 받아 반영
//   폰: QR 주소로 열면 이 id의 설정을 받아 설정 화면을 띄우고, 바꿀 때마다 올림
// KV 바인딩 이름: MIRROR_KV (Cloudflare Pages > 설정 > 바인딩)
// 저장하는 것: 미러 설정(위젯·알람·교통 정류장 등). 위치는 저장하지 않음
// GET  → { at, orient, settings } 또는 {} (없음)
// POST { orient, settings } → { ok, at } / DELETE → { ok } (연결 끊기)
// at은 서버 시각: 미러·폰 시계가 조금 달라도 어느 쪽이 나중에 바꿨는지 맞게 가림

const ID = /^[0-9a-f]{32}$/;
const MAX = 32 * 1024;
const TTL = 180 * 24 * 3600;   // 반년 동안 안 쓰면 지워짐

export async function onRequest({ request, env }) {
  if (!env.MIRROR_KV) return json({ error: 'MIRROR_KV 없음' }, 503);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID.test(id)) return json({ error: 'id 형식' }, 400);
  const key = 'sync:' + id;
  if (request.method === 'GET') {
    const v = await env.MIRROR_KV.get(key);
    return v ? new Response(v, { headers: HEADERS }) : json({});
  }
  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX) return json({ error: '너무 큼' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ error: 'JSON 아님' }, 400); }
    if (!body || !body.settings || typeof body.settings !== 'object') return json({ error: '형식' }, 400);
    const at = Date.now();
    await env.MIRROR_KV.put(key, JSON.stringify({ at, orient: body.orient === 'P' ? 'P' : 'L', settings: body.settings }), { expirationTtl: TTL });
    return json({ ok: true, at });
  }
  if (request.method === 'DELETE') {
    await env.MIRROR_KV.delete(key);
    return json({ ok: true });
  }
  return json({ error: 'GET·POST·DELETE만' }, 405);
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
