// Pebbly Mirror — 폰으로 설정: 연결 번호, 올리기·받기, QR, 폰(원격) 화면
// ===== 폰으로 설정 =====
// 미러: 설정 > '폰으로 설정' → 연결 번호를 만들어(한 번 만들면 계속 씀) 지금 설정을 올리고 QR을 띄움.
//   그 뒤로 10초마다(QR을 띄운 동안은 3초마다) 받아서 폰에서 바꾼 게 있으면 반영하고 '받았음'을 남김. 미러에서 바꾼 것도 올림
// 폰: QR 주소(?remote=번호)로 열면 미러 설정을 받아 설정 화면만 띄움. 바꾼 설정은 '미러에 적용'을 누를 때 한꺼번에 보내고,
//   미러가 받았는지 확인해서 알려 줌 (안 받으면 미러 앱이 꺼졌거나 QR 주소가 바뀐 것)
// 서버 /api/sync (functions/api/sync.js, Cloudflare KV + 같은 데이터센터 캐시)
const SYNC_KEY = 'mirror_sync';   // 미러: { id: 연결 번호, at: 마지막으로 맞춘 서버 시각 }
let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (e) { return null; } })();
let syncTimer = 0, syncFast = 0, remoteOrient = null, remoteDirty = false, remoteWait = 0;
const syncMsg = t => { $('sync-msg').textContent = t; $('remote-msg').textContent = t; };
const syncSave = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch (e) {} };
async function syncSend() {
  const r = await (await fetch('/api/sync?id=' + (REMOTE || sync.id), { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orient: REMOTE ? remoteOrient : wgNow(), settings: S }) })).json();
  if (r.error) throw new Error(r.error);
  if (!REMOTE) { sync.at = r.at; syncSave(); }
  return r.at;
}
// 설정을 바꿀 때마다(saveSettings): 미러는 +/− 버튼을 누르고 있을 때처럼 연달아 바뀌면 다 끝난 뒤 한 번만 올림, 폰은 '미러에 적용'을 기다림
function syncPush() {
  if (REMOTE) { remoteDirty = true; remoteState("바뀐 설정이 있어요. 다 바꾼 뒤 아래 '미러에 적용'을 눌러 주세요."); return; }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncSend().catch(e => syncMsg('보내지 못했어요: ' + e.message)), 800);
}
async function syncPull() {
  if (!sync) return;
  try {
    const r = await (await fetch('/api/sync?id=' + sync.id, { cache: 'no-store' })).json();
    if (!r.settings || r.at <= (sync.at || 0)) return;
    Object.assign(S, r.settings);
    sync.at = r.at;
    syncSave();
    try { localStorage.setItem(SET_KEY, JSON.stringify(S)); } catch (e) {}
    applySettings();
    syncMsg('폰에서 바꾼 설정을 반영했어요.');
    fetch(`/api/sync?id=${sync.id}&ack=${r.at}`, { method: 'POST' }).catch(() => {});   // 폰에 '받았음'
  } catch (e) {}
}
// 폰: '미러에 적용' 버튼 (바꾼 게 있을 때만 눌림)
function remoteState(t) {
  $('remote-apply').disabled = !remoteDirty;
  if (t != null) syncMsg(t);
}
// 폰 두 대가 한 미러를 설정할 때: 보내기 직전에 미러의 지금 설정을 다시 받아, 이 폰에서 바꾼 항목만 그 위에 얹어 보냄
//   (그사이 다른 폰이 바꾼 항목은 살아남음. 같은 항목을 둘 다 바꿨으면 나중에 누른 쪽)
let remoteBase = null, remoteAt = 0;   // 이 폰이 받은(또는 마지막으로 보낸) 미러 설정과 그 시각
const clone = o => JSON.parse(JSON.stringify(o));
// 보내고 2초마다 미러의 '받았음'을 확인, 1분 반 안에 안 오면 안내
async function remoteApply() {
  if (!remoteDirty) return;
  remoteDirty = false;
  remoteState('미러로 보내는 중…');
  let at, merged = false;
  try {
    const latest = await (await fetch('/api/sync?id=' + REMOTE, { cache: 'no-store' })).json();
    if (latest.settings && remoteBase && latest.at > remoteAt) {
      const mine = {};
      for (const k of Object.keys(S)) if (JSON.stringify(S[k]) !== JSON.stringify(remoteBase[k])) mine[k] = S[k];
      Object.assign(S, latest.settings, mine);
      merged = true;
    }
    at = await syncSend();
  } catch (e) { remoteDirty = true; remoteState('보내지 못했어요: ' + e.message); return; }
  remoteBase = clone(S); remoteAt = at;
  if (merged) applySettings();   // 다른 폰에서 바꾼 것도 화면에
  syncMsg((merged ? '다른 폰에서 바꾼 설정과 합쳐서 ' : '') + '보냈어요. 미러가 받는 중… (보통 10초 안)');
  clearInterval(remoteWait);
  const until = Date.now() + 90e3;
  remoteWait = setInterval(async () => {
    try {
      const a = await (await fetch(`/api/sync?id=${REMOTE}&ack=1`, { cache: 'no-store' })).json();
      if (a.at >= at) { clearInterval(remoteWait); syncMsg('미러에 적용했어요 ✓'); return; }
    } catch (e) {}
    if (Date.now() > until) {
      clearInterval(remoteWait);
      syncMsg('미러가 아직 못 받았어요. 미러 앱이 켜져 있는지 확인해 주세요. 그래도 안 되면 미러 설정 > 폰으로 설정의 QR을 다시 찍어 주세요.');
    }
  }, 2000);
}
const loadQR = () => window.qrcode ? Promise.resolve() : new Promise((ok, no) => {
  const el = document.createElement('script');
  el.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
  el.onload = ok; el.onerror = () => no(new Error('QR을 그리지 못했어요'));
  document.head.append(el);
});
// 미러: 폰으로 설정 탭 — 지금 설정을 올리고 QR, 10분 동안 3초마다 받아 봄 (탭을 떠나거나 설정을 닫으면 멈춤)
async function syncOpen() {
  if (!sync) {
    sync = { id: [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''), at: 0 };
    syncSave();
  }
  const url = location.origin + '/?remote=' + sync.id;
  $('sync-url').textContent = url.replace(/^https?:\/\//, '');
  $('sync-off').hidden = false;
  syncMsg('미러 설정을 올리는 중…');
  try {
    await syncSend();
    await loadQR();
    const qr = qrcode(0, 'M');
    qr.addData(url); qr.make();
    $('sync-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
    syncMsg('폰 카메라로 QR을 찍어 주세요.');
  } catch (e) { syncMsg('준비하지 못했어요: ' + e.message); return; }
  clearInterval(syncFast);
  const until = Date.now() + 600e3, card = document.querySelector('.set-card');
  syncFast = setInterval(() => {
    if ($('settings').hidden || card.dataset.tab !== 'sync' || Date.now() > until) clearInterval(syncFast);
    else syncPull();
  }, 3000);
}
function syncOff() {
  if (!sync) return;
  const id = sync.id;
  sync = null;
  try { localStorage.removeItem(SYNC_KEY); } catch (e) {}
  clearInterval(syncFast);
  $('sync-qr').innerHTML = ''; $('sync-url').textContent = ''; $('sync-off').hidden = true;
  syncMsg('연결을 끊었어요. 폰에 저장한 주소로는 더 이상 바꿀 수 없어요.');
  fetch('/api/sync?id=' + id, { method: 'DELETE' }).catch(() => {});
}
// 폰: 미러 설정을 받아서 설정 화면만 띄움
async function remoteStart() {
  document.body.classList.add('remote');
  openSettings();
  syncMsg('미러 설정을 받는 중…');
  try {
    const r = await (await fetch('/api/sync?id=' + REMOTE, { cache: 'no-store' })).json();
    if (r.error) throw new Error(r.error);
    if (!r.settings) { syncMsg("미러를 찾지 못했어요. 미러 설정에서 '폰으로 설정'을 다시 눌러 주세요."); return; }
    Object.assign(S, r.settings);
    remoteOrient = r.orient;
    remoteBase = clone(S); remoteAt = r.at;
    applySettings();
    wgEdit = remoteOrient; wgRender();
    syncMsg('');
  } catch (e) { syncMsg('미러 설정을 받지 못했어요: ' + e.message); }
  renderRemotes();
}

// 폰: QR로 연 미러 목록 (이름은 처음 열 때 정하고, 이름을 누르면 그 미러 설정으로)
//   설정 중(?remote=)에는 위쪽에 이름 정하기·다른 미러로 바꾸기, 폰 자기 화면에서는 설정 › 미러 설정하기 목록(이름·삭제)
const remoteLabel = r => r.name || '이름 없는 미러';
function renderRemotes() {
  const list = savedRemotes().filter(r => !(sync && sync.id === r.id) || r.id === REMOTE);   // 이 기기 자신은 빼고
  $('remote-list').innerHTML = list.map(r => `<li><button class="rm-go" data-go="${r.id}">${esc(remoteLabel(r))}</button>`
    + `<span><button data-rename="${r.id}">이름</button><button data-forget="${r.id}">삭제</button></span></li>`).join('');
  if (!REMOTE) return;
  const cur = list.find(r => r.id === REMOTE);
  $('remote-bar').innerHTML = (cur && cur.name ? ''
    : `<div class="rm-name"><input id="rm-name" maxlength="20" enterkeyhint="done" placeholder="이 미러 이름 (예: 거실 태블릿)"><button data-name-save>이름 저장</button></div>`)
    + (list.length > 1 ? '<div class="rm-chips">' + list.map(r => `<button data-go="${r.id}"${r.id === REMOTE ? ' class="on"' : ''}>${esc(remoteLabel(r))}</button>`).join('') + '</div>' : '');
}
function remoteRename(id, name) {
  name = String(name || '').trim().slice(0, 20) || (remoteOrient === 'P' ? '세로 미러' : '가로 미러');
  saveRemotes(savedRemotes().map(r => r.id === id ? { ...r, name } : r));
  renderRemotes();
}
// 다른 미러로: 이 미러에 적용 안 한 게 있으면 한 번 물어봄
function remoteGo(id) {
  if (id === REMOTE) return;
  if (!remoteDirty || confirm('미러에 적용하지 않은 설정이 있어요. 그냥 다른 미러로 갈까요?')) location.href = '/?remote=' + id;
}
$('remote-bar').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rm-name') remoteRename(REMOTE, e.target.value); });

const state = { weather: null, air: null, weatherAt: 0, weatherErr: false, airErr: false };
