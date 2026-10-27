// Google 로그인 중계 — Cloudflare Pages Functions (POST /api/google?op=...)
// 유튜브 재생목록(비공개 포함)을 읽으려고 YouTube 읽기 권한(youtube.readonly)만 받음
// 로그인은 기기 코드 방식: 화면에 나온 코드를 폰에서 google.com/device 에 입력
//   (키보드 없는 미러, 구글 로그인 창을 막는 키오스크 앱 안에서도 됨)
// 키는 Cloudflare Pages 비밀 변수로만: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   (Google Cloud 'OAuth 클라이언트 ID' — 유형 'TV 및 입력 제한 기기')
// 이 함수는 토큰을 저장하지 않음. 갱신 토큰은 그 기기 브라우저에만 있음
// op=device               → { device_code, user_code, verification_url, expires_in, interval }
// op=poll    {device_code}  → { pending[, slow] } 또는 { access_token, expires_in, refresh_token }
// op=refresh {refresh_token} → { access_token, expires_in } / 만료·해제됐으면 { error: 'expired' }
// op=revoke  {token}       → { ok }

const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const TOKEN = 'https://oauth2.googleapis.com/token';

export async function onRequestPost({ request, env }) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 없음' });
  const op = new URL(request.url).searchParams.get('op');
  const body = await request.json().catch(() => ({}));
  const client = { client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET };
  try {
    if (op === 'device') {
      const d = await form('https://oauth2.googleapis.com/device/code', { client_id: env.GOOGLE_CLIENT_ID, scope: SCOPE });
      if (d.error) return json({ error: d.error_description || d.error });
      return json({ device_code: d.device_code, user_code: d.user_code, verification_url: d.verification_url,
        expires_in: d.expires_in, interval: d.interval });
    }
    if (op === 'poll') {
      const d = await form(TOKEN, { ...client, device_code: body.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
      if (d.error === 'authorization_pending') return json({ pending: true });
      if (d.error === 'slow_down') return json({ pending: true, slow: true });
      if (d.error) return json({ error: d.error });   // access_denied, expired_token 등
      return json({ access_token: d.access_token, expires_in: d.expires_in, refresh_token: d.refresh_token });
    }
    if (op === 'refresh') {
      const d = await form(TOKEN, { ...client, refresh_token: body.refresh_token, grant_type: 'refresh_token' });
      if (d.error === 'invalid_grant') return json({ error: 'expired' });
      if (d.error) return json({ error: d.error });
      return json({ access_token: d.access_token, expires_in: d.expires_in });
    }
    if (op === 'revoke') {
      await form('https://oauth2.googleapis.com/revoke', { token: body.token });
      return json({ ok: true });
    }
    return json({ error: 'op 없음' }, 400);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 503);
  }
}

async function form(url, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const text = await r.text();
  try { return JSON.parse(text); } catch (e) { return r.ok ? {} : { error: text.slice(0, 160) }; }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
