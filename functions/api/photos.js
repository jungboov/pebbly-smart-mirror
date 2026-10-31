// 사진 액자 — Cloudflare Pages Functions (/api/photos?album=...)
// 미러 설정의 무작위 앨범 번호(album, 32자리 16진수)마다 사진·동영상을 KV(MIRROR_KV)에 저장 — 번호를 아는 기기만 보고 올리고 지움
//   1개 = 'photo:앨범:번호'(사진은 긴 변 1920px JPEG, 동영상은 긴 변 1280px MP4. 메타데이터에 가로·세로, 동영상은 v·길이·크기)
//        + 'thumb:앨범:번호'(설정 화면용 작은 그림, 동영상은 첫 장면)
//   번호는 올린 시각(36진수 8자리) + 무작위라서 목록이 올린 순서로 정렬됨
//   사진은 폰·미러가 올리기 전에 줄이고 JPEG로 다시 저장해서(위치 같은 사진 정보도 빠짐) 장당 0.5MB 안팎
//   동영상도 올리기 전에 줄여서(30초까지, 소리 없이) 개당 8MB 안팎. 무료 KV는 값 하나 25MB·전체 1GB라 앨범마다 동영상 합계 MAX_VIDEO_SUM까지
// GET  ?album=                → { photos: [{ id, w, h[, v: 1, d 길이(초), s 크기]] } (올린 순. KV 목록은 반영에 최대 1분쯤 걸림)
// GET  ?album=&id=[&thumb=1]  → 사진(JPEG)·동영상(MP4). 번호마다 내용이 안 바뀌어서 기기가 오래 보관
// POST ?album= (form: full, thumb, w, h) → { ok, id }  사진
// POST ?album=&video=1 (몸통: 작은 그림 JPEG) → { ok, id }, 이어서 PUT ?album=&id=&w=&h=&d= (몸통: MP4) → { ok }  동영상
//   동영상은 커서 form으로 풀지 않고 받는 그대로 KV에 흘려 넣음 (무료 플랜은 요청마다 계산 시간이 10ms). 작은 그림만 있는 번호는 목록에 안 나옴
// DELETE ?album=&id= → { ok }
const ALBUM = /^[0-9a-f]{32}$/;
const PID = /^[0-9a-z]{8,24}$/;
const MAX_PHOTOS = 200;
const MAX_FULL = 3 * 1024 * 1024;
const MAX_THUMB = 256 * 1024;
const MAX_VIDEO = 20 * 1024 * 1024;
const MAX_VIDEO_SUM = 700 * 1024 * 1024;

export async function onRequest({ request, env }) {
  if (!env.MIRROR_KV) return json({ error: 'MIRROR_KV 없음' }, 503);
  const q = new URL(request.url).searchParams;
  const album = q.get('album') || '', id = q.get('id');
  if (!ALBUM.test(album)) return json({ error: 'album 형식' }, 400);
  if (id != null && !PID.test(id)) return json({ error: 'id 형식' }, 400);
  const key = (kind, pid) => `${kind}:${album}:${pid}`;

  if (request.method === 'GET') {
    if (id == null) return json({ photos: await list(env, album) });
    const thumb = !!q.get('thumb');
    const { value, metadata } = await env.MIRROR_KV.getWithMetadata(key(thumb ? 'thumb' : 'photo', id), { type: 'stream', cacheTtl: 86400 });
    if (!value) return json({ error: '없는 사진' }, 404);
    const type = !thumb && metadata && metadata.v ? 'video/mp4' : 'image/jpeg';
    return new Response(value, { headers: { 'content-type': type, 'cache-control': 'private, max-age=31536000, immutable' } });
  }
  if (request.method === 'POST') {
    const items = await list(env, album);
    if (items.length >= MAX_PHOTOS) return json({ error: `사진·동영상은 모두 ${MAX_PHOTOS}개까지 올릴 수 있어요` }, 409);
    const pid = Date.now().toString(36) + [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join('');
    // 동영상 1단계: 작은 그림만 먼저 받아 번호를 정함
    if (q.get('video')) {
      if (items.reduce((n, p) => n + (p.s || 0), 0) >= MAX_VIDEO_SUM) return json({ error: '동영상 자리가 꽉 찼어요. 안 보는 동영상을 지워 주세요' }, 409);
      const thumb = await request.arrayBuffer();
      if (!thumb.byteLength || thumb.byteLength > MAX_THUMB) return json({ error: '작은 그림 크기' }, 413);
      await env.MIRROR_KV.put(key('thumb', pid), thumb);
      return json({ ok: true, id: pid });
    }
    let form;
    try { form = await request.formData(); } catch (e) { return json({ error: '형식' }, 400); }
    const full = form.get('full'), thumb = form.get('thumb');
    if (!full || typeof full.arrayBuffer !== 'function' || !thumb || typeof thumb.arrayBuffer !== 'function') return json({ error: '사진이 없어요' }, 400);
    if (full.size > MAX_FULL || thumb.size > MAX_THUMB) return json({ error: '사진이 너무 커요' }, 413);
    const w = Math.round(Number(form.get('w'))) || 0, h = Math.round(Number(form.get('h'))) || 0;
    // 작은 그림 먼저: 목록에는 큰 사진 키만 나오므로, 목록에 보이는 사진은 작은 그림도 있음
    await env.MIRROR_KV.put(key('thumb', pid), await thumb.arrayBuffer());
    await env.MIRROR_KV.put(key('photo', pid), await full.arrayBuffer(), { metadata: { w, h } });
    return json({ ok: true, id: pid });
  }
  // 동영상 2단계: 작은 그림을 올린 번호에 동영상을 받는 그대로 저장 → 이때부터 목록에 나옴
  if (request.method === 'PUT') {
    if (id == null) return json({ error: 'id 없음' }, 400);
    const size = Number(request.headers.get('content-length')) || 0;
    if (!size || !request.body) return json({ error: '동영상이 없어요' }, 400);
    if (size > MAX_VIDEO) return json({ error: '동영상이 너무 커요' }, 413);
    if (!(await env.MIRROR_KV.get(key('thumb', id), { type: 'arrayBuffer' }))) return json({ error: '작은 그림 먼저' }, 404);
    const w = Math.round(Number(q.get('w'))) || 0, h = Math.round(Number(q.get('h'))) || 0, d = Math.round(Number(q.get('d')) * 10) / 10 || 0;
    try { await env.MIRROR_KV.put(key('photo', id), request.body, { metadata: { w, h, v: 1, d, s: size } }); }
    catch (e) { return json({ error: '동영상을 저장하지 못했어요' }, 507); }
    return json({ ok: true });
  }
  if (request.method === 'DELETE') {
    if (id == null) return json({ error: 'id 없음' }, 400);
    await Promise.all([env.MIRROR_KV.delete(key('photo', id)), env.MIRROR_KV.delete(key('thumb', id))]);
    return json({ ok: true });
  }
  return json({ error: 'GET·POST·PUT·DELETE만' }, 405);
}

async function list(env, album) {
  const r = await env.MIRROR_KV.list({ prefix: `photo:${album}:`, limit: 1000 });
  return r.keys.map(k => {
    const m = k.metadata || {};
    return { id: k.name.slice(k.name.lastIndexOf(':') + 1), w: m.w || 0, h: m.h || 0, ...(m.v ? { v: 1, d: m.d || 0, s: m.s || 0 } : {}) };
  });
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
