// Pebbly Mirror — 사진 액자: 설정 '사진' 탭에서 올리고 지우기, 위젯에서 한 장씩
// ===== 사진 액자 =====
// 서버 /api/photos (functions/api/photos.js, Cloudflare KV). 앨범 번호 S.album은 설정에 들어 있어 '폰으로 설정'으로 폰과 같이 씀
// 올리기 전에 기기에서 줄여 JPEG로 다시 저장: 큰 사진(긴 변 1920px) + 설정 화면용 작은 그림(320px). 사진 속 위치 같은 정보도 빠짐
// 폰에서 올리거나 지우면 S.photoAt을 바꿔 미러로 보내고, 미러는 설정을 받을 때 그걸 보고 목록을 새로 받음 (그 밖엔 10분마다)
const PH_API = '/api/photos', PH_KEY = 'mirror_photos', PH_MAX = 200;
let photos = [], phIdx = -1, phLayer = 0, phBusy = false, phSeen = '', phListKey = null;
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

// 설정 '사진' 탭: 작은 그림 격자, 그림마다 지우기
function phRenderList() {
  const key = S.album + ':' + photos.map(p => p.id).join();
  if (key !== phListKey) {
    phListKey = key;
    $('ph-list').innerHTML = photos.map(p => `<li><img src="${phUrl(p.id, true)}" alt="" loading="lazy"><button data-del="${p.id}" aria-label="이 사진 지우기">×</button></li>`).join('');
  }
  if (!phBusy) phMsg(photos.length ? `${photos.length}장 (최대 ${PH_MAX}장) · 사진 액자에서 좌우로 밀면 사진을, 위아래로 밀면 다른 위젯을 봐요`
    : '올린 사진이 사진 액자 위젯에서 한 장씩 돌아가요. 여러 장을 한 번에 골라도 돼요.');
}

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
  for (let i = 0; i < files.length; i++) {
    if (photos.length + added.length >= PH_MAX) { fails.push(`최대 ${PH_MAX}장`); break; }
    phMsg(`올리는 중 ${i + 1} / ${files.length}`);
    try { added.push(await phUpload(files[i])); } catch (err) { fails.push(err.message); }
  }
  phBusy = false;
  if (added.length) phChanged([...photos, ...added]);
  phMsg((added.length ? `${added.length}장 올렸어요.` : '')
    + (fails.length ? ` ${fails.length}장은 못 올렸어요 (${fails[0]}).` : '')
    + (added.length && REMOTE ? " 아래 '미러에 적용'을 누르면 1분 안에 미러에 나와요." : ''));
});

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
  let r;
  try { r = await (await fetch(`${PH_API}?album=${S.album}`, { method: 'POST', body: fd })).json(); }
  catch (e) { throw new Error('서버에 연결하지 못했어요'); }
  if (r.error) throw new Error(r.error);
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

$('ph-list').addEventListener('click', async e => {
  const b = e.target.closest('button[data-del]');
  if (!b || phBusy || !confirm('이 사진을 지울까요?')) return;
  phBusy = true;
  phMsg('지우는 중…');
  try {
    const r = await (await fetch(`${PH_API}?album=${S.album}&id=${b.dataset.del}`, { method: 'DELETE' })).json();
    if (r.error) throw new Error(r.error);
    phBusy = false;
    phChanged(photos.filter(p => p.id !== b.dataset.del));
  } catch (err) { phBusy = false; phMsg('지우지 못했어요: ' + err.message); }
});

// 위젯에 보일 때(showPanel): 자동 넘김·밀기마다 다음 사진(이전으로 밀면 이전 사진), 설정만 바뀌어 다시 그릴 때(dir 없음)는 그대로
// 두 장을 겹쳐 두고 새 사진을 다 받으면 서서히 바꿈. 사진만 켜 두면 위젯 자리가 그대로 액자가 됨
function phShow(dir) {
  const n = photos.length;
  if (!n) return;
  phIdx = phIdx < 0 ? (dir < 0 ? n - 1 : 0) : ((phIdx + (dir || 0)) % n + n) % n;
  const p = photos[phIdx], imgs = [$('ph-a'), $('ph-b')], cur = imgs[phLayer], next = imgs[1 - phLayer];
  $('ph-count').textContent = n > 1 ? ` · ${phIdx + 1} / ${n}` : '';
  if (cur.dataset.id === p.id) return;
  next.dataset.id = p.id;
  next.onload = () => {
    if (next.dataset.id !== p.id) return;
    next.classList.add('on');
    cur.classList.remove('on');
    phLayer = 1 - phLayer;
  };
  next.onerror = () => {   // 다른 기기에서 지운 사진 등: 목록에서 빼고 다음 사진
    if (next.dataset.id !== p.id) return;
    next.dataset.id = '';
    phSet(photos.filter(x => x.id !== p.id));
  };
  next.src = phUrl(p.id);
  if (n > 1) new Image().src = phUrl(photos[(phIdx + 1) % n].id);   // 다음 사진 미리 받기
}
