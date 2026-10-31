// Pebbly Mirror — 사진 액자: 설정 '사진' 탭에서 올리고 지우기, 위젯에서 한 장씩
// ===== 사진 액자 =====
// 서버 /api/photos (functions/api/photos.js, Cloudflare KV). 앨범 번호 S.album은 설정에 들어 있어 '폰으로 설정'으로 폰과 같이 씀
// 올리기 전에 기기에서 줄여 JPEG로 다시 저장: 큰 사진(긴 변 1920px) + 설정 화면용 작은 그림(320px). 사진 속 위치 같은 정보도 빠짐
// 동영상도 같은 목록에 섞여 돌아감 (목록의 v: 1, d: 길이). 올리기 전에 줄여 MP4로 다시 저장 (아래 phUploadVideo)
// 폰에서 올리거나 지우면 S.photoAt을 바꿔 미러로 보내고, 미러는 설정을 받을 때 그걸 보고 목록을 새로 받음 (그 밖엔 10분마다)
const PH_API = '/api/photos', PH_KEY = 'mirror_photos', PH_MAX = 200;
const VID_MAX = 30, VID_LONG = 1280, VID_RATE = 2e6;   // 동영상: 앞 30초까지, 긴 변 1280px, 초당 2Mbit (phUploadVideo)
let photos = [], phIdx = -1, phBusy = false, phSeen = '', phListKey = null;
let phVisit = 0;   // 이번 차례에 사진 액자에서 보여 준 장수 (autoNext)
// 인터넷이 끊겨도 마지막 목록으로 (사진 자체는 브라우저가 보관)
try { const c = JSON.parse(localStorage.getItem(PH_KEY)); if (c && c.album === S.album) photos = c.photos; } catch (e) {}
const phUrl = (id, thumb) => `${PH_API}?album=${S.album}&id=${id}${thumb ? '&thumb=1' : ''}`;
const phMsg = t => { $('ph-msg').textContent = t || ''; };

async function loadPhotos() {
  if (!S.album) { phSet([]); return; }
  try {
    const r = await (await fetch(`${PH_API}?album=${S.album}`, { cache: 'no-store' })).json();
    if (r.error) throw new Error(r.error);
    phSet(r.photos);
  } catch (e) { console.warn('사진 목록 확인 실패', e); }
}
setInterval(() => { if (S.album && !REMOTE && !document.hidden) loadPhotos(); }, 10 * 60e3);

// 목록 바꾸기: 기기에 저장하고, 위젯이 생기거나 없어지면 화면 다시 맞춤
function phSet(list) {
  const had = photos.length > 0;
  photos = list;
  if (!REMOTE) try { localStorage.setItem(PH_KEY, JSON.stringify({ album: S.album, photos })); } catch (e) {}
  phRenderList();
  if (had !== photos.length > 0) applySettings();
  else if (panelName === 'photo') phShow();
}

// 설정 반영 때(applySettings): 위젯 표시, 설정 목록, 앨범이 바뀌었거나 폰에서 사진을 바꿨으면 목록 새로 받기
// (KV 목록은 반영이 30초~1분쯤 늦기도 해서 40초·100초 뒤 한 번씩 더)
function phApply() {
  document.body.classList.toggle('has-photo', photos.length > 0);
  phRenderList();
  const k = `${S.album || ''}:${S.photoAt || 0}`;
  if (k === phSeen) return;
  const later = phSeen !== '';
  phSeen = k;
  loadPhotos();
  if (later) { setTimeout(loadPhotos, 40e3); setTimeout(loadPhotos, 100e3); }
}

// 설정 '사진' 탭: 작은 그림 격자 (누르면 크게 보기), 그림마다 지우기
function phRenderList() {
  const key = S.album + ':' + photos.map(p => p.id).join();
  if (key !== phListKey) {
    phListKey = key;
    $('ph-list').innerHTML = photos.map((p, i) => `<li data-i="${i}"><img src="${phUrl(p.id, true)}" alt="" loading="lazy">${p.v ? `<span class="ph-vtag">▶ ${phLen(p.d)}</span>` : ''}<button data-del="${p.id}" aria-label="이 ${p.v ? '동영상' : '사진'} 지우기">×</button></li>`).join('');
  }
  if (!phBusy) phMsg(photos.length ? `${phCount(photos)} (모두 최대 ${PH_MAX}개) · 사진 액자에서 좌우로 밀면 사진을, 위아래로 밀면 다른 위젯을 봐요`
    : `올린 사진·동영상이 사진 액자 위젯에서 하나씩 돌아가요. 여러 개를 한 번에 골라도 돼요. 동영상은 ${VID_MAX}초까지 소리 없이 나와요.`);
}
// 사진 3장·동영상 1개 / 동영상 길이 0:12
const phCount = list => { const nv = list.filter(p => p.v).length, np = list.length - nv; return [np && `사진 ${np}장`, nv && `동영상 ${nv}개`].filter(Boolean).join('·'); };
const phLen = d => { const s = Math.round(d || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// 사진 앨범 같이 쓰기: 이 기기가 기억한 다른 미러(설정 › 미러 설정하기) 중 사진이 있는 미러의 앨범을 같이 쓰거나 이 미러만 따로
//   같이 쓰면 어느 미러에서 올리거나 지워도 둘 다 바뀜. '이 미러만'으로 돌아오면 원래 이 미러 앨범(S.albumOwn)으로
let phOthers = [];   // [{ id, name, album }] 사진 탭을 열 때 받음
const withWa = s => { const c = s.charCodeAt(s.length - 1) - 0xac00; return s + (c >= 0 && c < 11172 && c % 28 ? '과' : '와'); };   // 받침 있으면 '과'
async function phLoadOthers() {
  const me = REMOTE || (sync && sync.id);
  const list = savedRemotes().filter(r => r.id !== me);
  phOthers = (await Promise.all(list.map(async r => {
    try {
      const s = (await (await fetch('/api/sync?id=' + r.id, { cache: 'no-store' })).json()).settings;
      return s && s.album ? { id: r.id, name: remoteLabel(r), album: s.album } : null;
    } catch (e) { return null; }
  }))).filter(Boolean);
  phRenderShare();
}
function phRenderShare() {
  const shared = phOthers.find(o => o.album === S.album);
  $('ph-share-row').hidden = !phOthers.length;
  $('ph-share').innerHTML = `<button data-share=""${shared ? '' : ' class="on"'}>이 미러만</button>`
    + phOthers.map(o => `<button data-share="${o.id}"${shared && shared.id === o.id ? ' class="on"' : ''}>${esc(withWa(o.name))} 같이</button>`).join('');
}
$('ph-share').addEventListener('click', e => {
  const b = e.target.closest('button[data-share]');
  if (!b || phBusy) return;
  const o = phOthers.find(x => x.id === b.dataset.share), shared = phOthers.some(x => x.album === S.album);
  if (o) {
    if (o.album === S.album || !confirm(`${withWa(o.name)} 같은 사진을 쓸까요? 어느 쪽에서 올리거나 지워도 둘 다 바뀌어요. 이 미러에 올린 사진은 '이 미러만'으로 돌아오면 다시 보여요.`)) return;
    if (!shared) S.albumOwn = S.album || null;   // 원래 이 미러 앨범 기억
    S.album = o.album;
  } else {
    if (!shared) return;
    S.album = S.albumOwn || null;
  }
  S.photoAt = Date.now();   // 미러가 목록을 새로 받게
  saveSettings();
  applySettings();          // 이 화면 목록도 새 앨범으로 (phApply)
  phRenderShare();
});

// 자동 넘김 때 이번 차례에 사진을 더 보여 줄지: 사진만 켰으면 계속, 아니면 설정한 장수(phPer, 0 = 모두)까지
function phMore() {
  const n = photos.length, per = +S.phPer || n;
  return n > 1 && (panelList().length === 1 || phVisit < Math.min(per, n));
}
// 사진 액자에서 좌우로 밀기: 이전·다음 사진, 자동 넘김 시간은 처음부터
function phSwipe(dir) {
  phShow(dir);
  schedulePanel();
}

// 올리거나 지운 뒤: 목록을 바로 바꾸고, 바뀐 시각을 설정에 넣어 알림 (폰이면 '폰으로 설정'으로 미러에)
function phChanged(list) {
  S.photoAt = Date.now();
  phSeen = `${S.album}:${S.photoAt}`;   // 방금 바꾼 목록을 아직 반영 안 된 KV 목록으로 덮지 않게
  saveSettings();
  phSet(list);
}

// 올리기: 고른 사진을 하나씩 줄여서 보냄. 앨범 번호는 처음 올릴 때 만듦
$('ph-file').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length || phBusy) return;
  if (!S.album) S.album = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  phBusy = true;
  const added = [], fails = [];
  let cut = false;   // 앞 30초만 올린 동영상이 있음
  for (let i = 0; i < files.length; i++) {
    if (photos.length + added.length >= PH_MAX) { fails.push(`최대 ${PH_MAX}개`); break; }
    const tag = `${i + 1} / ${files.length}`;
    phMsg(`올리는 중 ${tag}`);
    try {
      const p = await (phIsVideo(files[i]) ? phUploadVideo(files[i], tag) : phUpload(files[i]));
      if (p.cut) { cut = true; delete p.cut; }
      added.push(p);
    } catch (err) { fails.push(err.message); }
  }
  phBusy = false;
  if (added.length) phChanged([...photos, ...added]);
  phMsg((added.length ? `${phCount(added)} 올렸어요.` : '')
    + (cut ? ` ${VID_MAX}초 넘는 동영상은 앞 ${VID_MAX}초만 올렸어요.` : '')
    + (fails.length ? ` ${fails.length}개는 못 올렸어요 (${fails[0]}).` : '')
    + (added.length && REMOTE ? " 아래 '미러에 적용'을 누르면 1분 안에 미러에 나와요." : ''));
});
// 서버에 보내고 답 받기: 연결이 안 되거나 서버가 거절하면 그 이유로 실패
async function phSend(q, opts) {
  let r;
  try { r = await (await fetch(`${PH_API}?album=${S.album}${q}`, opts)).json(); }
  catch (e) { throw new Error('서버에 연결하지 못했어요'); }
  if (r.error) throw new Error(r.error);
  return r;
}

async function phUpload(file) {
  const img = await new Promise((ok, no) => {
    const el = new Image(), url = URL.createObjectURL(file);
    el.onload = () => { URL.revokeObjectURL(url); ok(el); };
    el.onerror = () => { URL.revokeObjectURL(url); no(new Error('읽을 수 없는 사진')); };
    el.src = url;
  });
  const full = await phJpeg(img, 1920, .82), thumb = await phJpeg(img, 320, .7);
  const fd = new FormData();
  fd.append('full', full.blob, 'photo.jpg');
  fd.append('thumb', thumb.blob, 'thumb.jpg');
  fd.append('w', full.w);
  fd.append('h', full.h);
  const r = await phSend('', { method: 'POST', body: fd });
  return { id: r.id, w: full.w, h: full.h };
}
// 긴 변을 max로 줄여(더 작으면 그대로) JPEG로. 사진 방향(세로로 찍은 사진)은 브라우저가 맞춰 줌
function phJpeg(img, max, q) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((ok, no) => c.toBlob(b => b ? ok({ blob: b, w, h }) : no(new Error('사진을 줄이지 못했어요')), 'image/jpeg', q));
}

// 동영상 올리기: 기기에서 줄여 MP4(H.264, 긴 변 1280px, 초당 30장까지, 소리 없이, 앞 30초까지)로 다시 저장 → 어느 기기에서나 나오고 개당 8MB 안팎
//   (아이폰 동영상(HEVC)은 그대로면 안 나오는 기기도 있음). 미러는 소리 없이 트니까 소리는 뺌
//   줄이는 도구 Mediabunny(브라우저 WebCodecs로 빠르게 다시 저장)는 동영상을 처음 고를 때 받음 (서비스 워커가 보관)
//   서버엔 두 번에: 작은 그림(첫 장면)으로 번호를 받고 → 그 번호에 동영상. 동영상이 실패하면 작은 그림도 지움
const VID_LIB = 'https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/dist/bundles/mediabunny.min.mjs';
let vidLib = null;
const phIsVideo = f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name);
async function phUploadVideo(file, tag) {
  if (typeof VideoEncoder === 'undefined') throw new Error('이 브라우저에선 동영상을 줄일 수 없어요');
  const M = await (vidLib || (vidLib = import(VID_LIB))).catch(() => { vidLib = null; throw new Error('동영상 도구를 받지 못했어요'); });
  const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack().catch(() => null);
    if (!track) throw new Error('읽을 수 없는 동영상');
    if (!(await track.canDecode())) throw new Error('이 기기에서 열 수 없는 동영상 형식');
    const dw = await track.getDisplayWidth(), dh = await track.getDisplayHeight();
    const k = Math.min(1, VID_LONG / Math.max(dw, dh)), w = Math.round(dw * k / 2) * 2, h = Math.round(dh * k / 2) * 2;
    const t0 = await track.getFirstTimestamp(), all = (await input.computeDuration()) - t0, len = Math.min(VID_MAX, all);
    // 작은 그림: 첫 장면 (맨 처음은 검을 때가 있어 조금 뒤)
    const tk = Math.min(1, 320 / Math.max(w, h));
    const wc = await new M.CanvasSink(track, { width: Math.round(w * tk), height: Math.round(h * tk), fit: 'fill' }).getCanvas(t0 + Math.min(.5, len / 3));
    const thumb = wc && await (wc.canvas.convertToBlob ? wc.canvas.convertToBlob({ type: 'image/jpeg', quality: .7 })
      : new Promise(ok => wc.canvas.toBlob(ok, 'image/jpeg', .7)));
    if (!thumb) throw new Error('읽을 수 없는 동영상');
    const fps = (await track.computePacketStats(60)).averagePacketRate;
    const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
    // tags: {} — 찍은 위치·기기 같은 동영상 속 정보는 옮기지 않음 (안 정하면 그대로 옮겨짐)
    const conv = await M.Conversion.init({ input, output, tags: {}, audio: { discard: true }, trim: { start: t0, end: t0 + len },
      video: { width: w, height: h, fit: 'fill', codec: 'avc', quality: new M.Quality({ bitrate: VID_RATE }), forceTranscode: true, ...(fps > 31 ? { frameRate: 30 } : {}) } });
    if (!conv.isValid) throw new Error('이 기기에선 동영상을 줄일 수 없어요');
    conv.onProgress = p => phMsg(`동영상 줄이는 중 ${tag} · ${Math.round(p * 100)}%`);
    await conv.execute();
    const mp4 = new Blob([output.target.buffer], { type: 'video/mp4' });
    phMsg(`올리는 중 ${tag}`);
    const { id } = await phSend('&video=1', { method: 'POST', body: thumb });
    try { await phSend(`&id=${id}&w=${w}&h=${h}&d=${len.toFixed(1)}`, { method: 'PUT', body: mp4 }); }
    catch (e) { fetch(`${PH_API}?album=${S.album}&id=${id}`, { method: 'DELETE' }).catch(() => {}); throw e; }
    return { id, w, h, v: 1, d: Math.round(len * 10) / 10, s: mp4.size, ...(all > VID_MAX + .5 ? { cut: 1 } : {}) };
  } finally { input.dispose(); }
}

// 사진 탭 작은 그림: × 는 지우기, 그림을 누르면 크게 보기
$('ph-list').addEventListener('click', e => {
  const del = e.target.closest('button[data-del]'), li = e.target.closest('li[data-i]');
  if (del) phDelete(del.dataset.del);
  else if (li) phView(Number(li.dataset.i));
});
// 지우기 (물어본 뒤). 지웠으면 true
async function phDelete(id) {
  const p = photos.find(x => x.id === id);
  if (phBusy || !confirm(`이 ${p && p.v ? '동영상' : '사진'}을 지울까요?`)) return false;
  phBusy = true;
  phMsg('지우는 중…');
  try {
    const r = await (await fetch(`${PH_API}?album=${S.album}&id=${id}`, { method: 'DELETE' })).json();
    if (r.error) throw new Error(r.error);
    phBusy = false;
    phChanged(photos.filter(p => p.id !== id));
    return true;
  } catch (err) { phBusy = false; phMsg('지우지 못했어요: ' + err.message); return false; }
}

// 크게 보기: 설정 위에 겹쳐 액자에 쓰는 큰 사진(긴 변 1920px)을 화면에 맞춰 보여 줌. 동영상은 소리 없이 반복
//   좌우로 밀거나 ‹ › 로 넘기기, 삭제(지우면 다음 것, 다 지우면 닫힘), 닫기·바깥 누르기로 닫기
let pvIdx = -1, pvX = null;
function phView(i) {
  if (!photos.length) { phViewClose(); return; }
  pvIdx = (i % photos.length + photos.length) % photos.length;
  const p = photos[pvIdx], img = $('ph-view-img'), vid = $('ph-view-vid');
  img.hidden = !!p.v;
  vid.hidden = !p.v;
  if (!p.v) { phVidOff(vid); img.src = phUrl(p.id); }
  else { img.removeAttribute('src'); phVidLoad(vid, p.id).then(r => r === 'ok' && phPlay(vid, true)); }
  $('ph-view-n').textContent = `${pvIdx + 1} / ${photos.length}`;
  $('ph-view').hidden = false;
}
function phViewClose() {
  $('ph-view').hidden = true;
  $('ph-view-img').removeAttribute('src');
  phVidOff($('ph-view-vid'));
  pvIdx = -1;
}
$('ph-view').addEventListener('click', async e => {
  const b = e.target.closest('button[data-pv]');
  if (!b) { if (e.target === $('ph-view')) phViewClose(); return; }
  const a = b.dataset.pv;
  if (a === 'close') phViewClose();
  else if (a === 'prev' || a === 'next') phView(pvIdx + (a === 'next' ? 1 : -1));
  else if (a === 'del' && await phDelete(photos[pvIdx].id)) phView(pvIdx);   // 같은 자리에 다음 것이 옴
});
for (const el of [$('ph-view-img'), $('ph-view-vid')]) {
  el.addEventListener('pointerdown', e => { pvX = e.clientX; });
  el.addEventListener('pointerup', e => {
    if (pvX == null) return;
    const dx = e.clientX - pvX;
    pvX = null;
    if (Math.abs(dx) > 40) phView(pvIdx + (dx < 0 ? 1 : -1));
  });
}

// 동영상 넣기: 통째로 받아(브라우저가 오래 보관) 기기 안 주소로 틂 — 처음부터 다시 틀어도 다시 받지 않게
//   'ok' 넣음 / 'gone' 지워진 동영상 / 'fail' 받지 못함 / 'stale' 받는 사이 다른 것을 넣기로 함
async function phVidLoad(el, id) {
  el.dataset.id = id;
  let blob;
  try {
    const r = await fetch(phUrl(id));
    if (r.status === 404) return 'gone';
    if (!r.ok) return 'fail';
    blob = await r.blob();
  } catch (e) { return 'fail'; }
  if (el.dataset.id !== id) return 'stale';
  if (el.src) URL.revokeObjectURL(el.src);
  el.src = URL.createObjectURL(blob);
  return 'ok';
}
// 멈추고 비우기 (재생기를 놓아 줌)
function phVidOff(el) {
  el.pause();
  el.onloadeddata = el.onerror = null;
  el.dataset.id = '';
  if (el.src) { URL.revokeObjectURL(el.src); el.removeAttribute('src'); el.load(); }
}
function phPlay(el, restart) {
  if (restart) el.currentTime = 0;
  const r = el.play();
  if (r) r.catch(() => {});
}

// ===== 액자 위젯 =====
// 위젯에 보일 때(showPanel): 자동 넘김·밀기마다 다음 것(이전으로 밀면 이전 것), 설정만 바뀌어 다시 그릴 때(dir 없음)는 그대로
// 두 층을 겹쳐 두고 새 것을 다 받으면 서서히 바꿈 (사진은 img 두 장, 동영상은 video 두 개 중 지금 안 보이는 쪽에). 사진만 켜 두면 위젯 자리가 그대로 액자가 됨
// 동영상은 소리 없이 처음부터, 끝나면 다시 처음부터. 자동 넘김 때가 되면 보던 동영상을 끝까지 본 뒤 넘김 (autoNext → phHold)
let phCur = null, phWait = false, phWaitT = 0;   // phCur 지금 보이는 층, phWait 동영상이 끝나면 넘기기
function phShow(dir) {
  const n = photos.length;
  if (!n) return;
  phIdx = phIdx < 0 ? (dir < 0 ? n - 1 : 0) : ((phIdx + (dir || 0)) % n + n) % n;
  phWaitOff();
  const p = photos[phIdx];
  $('ph-count').textContent = n > 1 ? ` · ${phIdx + 1} / ${n}` : '';
  if (phCur && phCur.dataset.id === p.id) { if (p.v) phPlay(phCur, !!dir); return; }
  const pool = p.v ? [$('ph-va'), $('ph-vb')] : [$('ph-a'), $('ph-b')], next = pool[pool[0] === phCur ? 1 : 0];
  const show = () => {
    if (next.dataset.id !== p.id) return;
    const old = phCur, oid = old && old.dataset.id;
    next.classList.add('on');
    if (old) old.classList.remove('on');
    phCur = next;
    // 나간 동영상은 서서히 사라진 뒤 멈추고 비움 (그사이 다른 동영상을 넣기 시작했으면 그대로)
    if (old && old.tagName === 'VIDEO') setTimeout(() => { if (phCur !== old && old.dataset.id === oid) phVidOff(old); }, 1300);
  };
  const gone = () => {   // 다른 기기에서 지운 사진 등: 목록에서 빼고 다음 것
    if (next.dataset.id !== p.id) return;
    next.dataset.id = '';
    phSet(photos.filter(x => x.id !== p.id));
  };
  if (p.v) {
    phVidLoad(next, p.id).then(r => {
      if (r === 'gone') gone();
      else if (r === 'ok') {
        next.onloadeddata = show;
        next.onerror = () => { if (next.dataset.id === p.id && phWait) phNext(); };   // 이 기기에서 못 트는 동영상: 기다리던 넘김은 그대로
        phPlay(next, true);
      } else if (r === 'fail' && phWait) phNext();
    });
  } else {
    next.dataset.id = p.id;
    next.onload = show;
    next.onerror = gone;
    next.src = phUrl(p.id);
  }
  const nx = photos[(phIdx + 1) % n];   // 다음 것 미리 받기
  if (n > 1 && nx.v) fetch(phUrl(nx.id)).then(r => r.blob()).catch(() => {});
  else if (n > 1) new Image().src = phUrl(nx.id);
}
// 위젯 동영상이 끝나면: 자동 넘김을 기다리던 중이면 넘기고, 아니면 처음부터 다시
for (const v of [$('ph-va'), $('ph-vb')]) v.addEventListener('ended', () => {
  if (v !== phCur) return;
  if (phWait) phNext(); else phPlay(v, true);
});
// 자동 넘김 때(autoNext): 지금 것이 동영상이면 끝날 때까지 기다림 (받는 중이면 다 받아 끝까지). 1분이 지나도 안 끝나면 그냥 넘김
function phHold() {
  const p = photos[phIdx];
  if (!p || !p.v) return false;
  phWait = true;
  clearTimeout(phWaitT);
  phWaitT = setTimeout(phNext, 60e3);
  return true;
}
function phNext() {
  if (!phWait) return;
  phWaitOff();
  autoNext(true);
}
function phWaitOff() { phWait = false; clearTimeout(phWaitT); }
// 다른 위젯으로 넘어가면(넘어가는 모습이 끝난 뒤) 동영상 멈춤. 돌아오면 phShow가 다시 틂
function phLeave() {
  phWaitOff();
  setTimeout(() => { if (panelName !== 'photo' && phCur && phCur.tagName === 'VIDEO') phCur.pause(); }, 1200);
}
// 화면을 다시 켜면(앱으로 돌아오면) 멈춰 있던 동영상 이어서
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && panelName === 'photo' && phCur && phCur.tagName === 'VIDEO') phPlay(phCur);
});
