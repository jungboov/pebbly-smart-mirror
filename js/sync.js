// Pebbly Mirror — 폰으로 설정: 연결 번호, 올리기·받기, QR, 폰(원격) 화면
// ===== 폰으로 설정 =====
// 미러: 설정 > '폰으로 설정' → 연결 번호를 만들어(한 번 만들면 계속 씀) 지금 설정을 올리고 QR을 띄움.
//   그 뒤로 1분마다(QR을 띄운 동안은 3초마다) 받아서 폰에서 바꾼 게 있으면 반영하고, 미러에서 바꾼 것도 올림
// 폰: QR 주소(?remote=번호)로 열면 미러 설정을 받아 설정 화면만 띄우고, 바꿀 때마다 올림
// 서버 /api/sync (functions/api/sync.js, Cloudflare KV)
const SYNC_KEY = 'mirror_sync';   // 미러: { id: 연결 번호, at: 마지막으로 맞춘 서버 시각 }
let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (e) { return null; } })();
let syncTimer = 0, syncFast = 0, remoteOrient = null;
const syncMsg = t => { $('sync-msg').textContent = t; $('remote-msg').textContent = t; };
const syncSave = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch (e) {} };
async function syncSend() {
  const r = await (await fetch('/api/sync?id=' + (REMOTE || sync.id), { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orient: REMOTE ? remoteOrient : wgNow(), settings: S }) })).json();
  if (r.error) throw new Error(r.error);
  if (!REMOTE) { sync.at = r.at; syncSave(); }
}
function syncPush() {   // +/− 버튼을 누르고 있을 때처럼 연달아 바뀌면 다 끝난 뒤 한 번만
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncSend()
    .then(() => { if (REMOTE) syncMsg('미러로 보냈어요. 1분쯤 안에 반영돼요.'); })
    .catch(e => syncMsg('보내지 못했어요: ' + e.message)), 800);
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
  } catch (e) {}
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
