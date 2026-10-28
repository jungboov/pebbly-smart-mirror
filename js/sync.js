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
// 보내고 2초마다 미러의 '받았음'을 확인, 1분 반 안에 안 오면 안내
async function remoteApply() {
  if (!remoteDirty) return;
  remoteDirty = false;
  remoteState('미러로 보내는 중…');
  let at;
  try { at = await syncSend(); } catch (e) { remoteDirty = true; remoteState('보내지 못했어요: ' + e.message); return; }
  syncMsg('보냈어요. 미러가 받는 중… (보통 10초 안)');
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
    applySettings();
    wgEdit = remoteOrient; wgRender();
    syncMsg('');
  } catch (e) { syncMsg('미러 설정을 받지 못했어요: ' + e.message); }
}

const state = { weather: null, air: null, weatherAt: 0, weatherErr: false, airErr: false };
