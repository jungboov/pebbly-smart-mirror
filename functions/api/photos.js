// 사진 액자 — Cloudflare Pages Functions (/api/photos?album=...)
// 미러 설정의 무작위 앨범 번호(album, 32자리 16진수)마다 사진을 KV(MIRROR_KV)에 저장 — 번호를 아는 기기만 보고 올리고 지움
//   사진 1장 = 'photo:앨범:번호'(긴 변 1920px JPEG, 메타데이터에 가로·세로) + 'thumb:앨범:번호'(설정 화면용 작은 그림)
//   번호는 올린 시각(36진수 8자리) + 무작위라서 목록이 올린 순서로 정렬됨
//   사진은 폰·미러가 올리기 전에 줄이고 JPEG로 다시 저장해서(위치 같은 사진 정보도 빠짐) 장당 0.5MB 안팎
// GET  ?album=                → { photos: [{ id, w, h }] } (올린 순. KV 목록은 반영에 최대 1분쯤 걸림)
// GET  ?album=&id=[&thumb=1]  → 사진(JPEG). 번호마다 내용이 안 바뀌어서 기기가 오래 보관
// POST ?album= (form: full, thumb, w, h) → { ok, id } / DELETE ?album=&id= → { ok }
const ALBUM = /^[0-9a-f]{32}$/;
const PID = /^[0-9a-z]{8,24}$/;
const MAX_PHOTOS = 200;
const MAX_FULL = 3 * 1024 * 1024;
const MAX_THUMB = 256 * 1024;

export async function onRequest({ request, env }) {
  if (!env.MIRROR_KV) return json({ error: 'MIRROR_KV 없음' }, 503);
  const q = new URL(request.url).searchParams;
  const album = q.get('album') || '', id = q.get('id');
  if (!ALBUM.test(album)) return json({ error: 'album 형식' }, 400);
  if (id != null && !PID.test(id)) return json({ error: 'id 형식' }, 400);
  const key = (kind, pid) => `${kind}:${album}:${pid}`;

  if (request.method === 'GET') {
    if (id == null) return json({ photos: await list(env, album) });
    const v = await env.MIRROR_KV.get(key(q.get('thumb') ? 'thumb' : 'photo', id), { type: 'arrayBuffer', cacheTtl: 86400 });
    if (!v) return json({ error: '없는 사진' }, 404);
    return new Response(v, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' } });
  }
  if (request.method === 'POST') {
    if ((await list(env, album)).length >= MAX_PHOTOS) return json({ error: `사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요` }, 409);
    let form;
    try { form = await request.formData(); } catch (e) { return json({ error: '형식' }, 400); }
    const full = form.get('full'), thumb = form.get('thumb');
    if (!full || typeof full.arrayBuffer !== 'function' || !thumb || typeof thumb.arrayBuffer !== 'function') return json({ error: '사진이 없어요' }, 400);
    if (full.size > MAX_FULL || thumb.size > MAX_THUMB) return json({ error: '사진이 너무 커요' }, 413);
    const w = Math.round(Number(form.get('w'))) || 0, h = Math.round(Number(form.get('h'))) || 0;
    const pid = Date.now().toString(36) + [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join('');
    // 작은 그림 먼저: 목록에는 큰 사진 키만 나오므로, 목록에 보이는 사진은 작은 그림도 있음
    await env.MIRROR_KV.put(key('thumb', pid), await thumb.arrayBuffer());
    await env.MIRROR_KV.put(key('photo', pid), await full.arrayBuffer(), { metadata: { w, h } });
    return json({ ok: true, id: pid });
  }
  if (request.method === 'DELETE') {
    if (id == null) return json({ error: 'id 없음' }, 400);
    await Promise.all([env.MIRROR_KV.delete(key('photo', id)), env.MIRROR_KV.delete(key('thumb', id))]);
    return json({ ok: true });
  }
  return json({ error: 'GET·POST·DELETE만' }, 405);
}

async function list(env, album) {
  const r = await env.MIRROR_KV.list({ prefix: `photo:${album}:`, limit: 1000 });
  return r.keys.map(k => ({ id: k.name.slice(k.name.lastIndexOf(':') + 1), w: (k.metadata && k.metadata.w) || 0, h: (k.metadata && k.metadata.h) || 0 }));
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
