// Pebbly Mirror — 설정값: 주소 옵션(CONFIG), 사용자 설정(S) 불러오기·저장
// ===== 설정 =====
// 위치: 기본은 기기 위치(처음 한 번 위치 권한 허용). 주소에 좌표를 주면 그 위치로 고정
//   index.html?lat=35.1796&lon=129.0756&name=부산
// mode=detail: 처음 화면을 상세 화면으로 (설정 화면에서 바꾸면 그 설정이 우선)
// 시계 형식·시계 강조·날씨 넘김 주기는 화면을 두 번 탭하면 나오는 설정에서 바꿈
const params = new URLSearchParams(location.search);
// remote=연결 번호: 폰으로 QR을 찍어 열면 이 번호의 미러 설정을 바꾸는 화면 (폰 자기 설정은 그대로)
const REMOTE = /^[0-9a-f]{32}$/.test(params.get('remote') || '') ? params.get('remote') : null;
const MANUAL_LOC = params.has('lat') && params.has('lon');
const CONFIG = {
  lat: parseFloat(params.get('lat')) || 37.5034,   // 위치를 모를 때 기본: 부천시청
  lon: parseFloat(params.get('lon')) || 126.7660,
  name: params.get('name') || '부천',
  weatherEvery: 15 * 60 * 1000,   // 날씨 갱신 주기
  airEvery: 30 * 60 * 1000,       // 미세먼지 갱신 주기
  phraseEvery: 30 * 1000,         // 문구 교체 주기
  hourlyCount: 12,                // 시간별 예보 칸 수 (지금부터 1시간 간격)
  standbyHours: 6,                // 시계 강조 화면은 칸이 커서 6시간만
  cursorIdle: 3 * 1000,           // 마우스가 이만큼 멈춰 있으면 커서 숨김
  reloadHour: 4                   // 매일 이 시각에 페이지 새로고침
};

const $ = id => document.getElementById(id);
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const range = (n, f = String) => Array.from({ length: n }, (_, i) => f(i));

// ===== 사용자 설정 (설정 화면에서 바꿈, 기기마다 저장) =====
// hour12: 12시간제 / secs: 초 표시(끄면 시·분만 크게) / date: 시계 옆 날짜(끄면 그만큼 시계가 넓게)
// addr: 위치를 도로명 주소까지 (켰을 때만 약 10m 단위 좌표로 조회) / alert: 비·미세먼지 알림 띠 / focus: 시계 강조 화면(끄면 상세 화면) / rotate: 날씨 위젯 자동 넘김(초)
// wgL·wgP: 시계 강조 화면 위젯 { order: 순서, off: 끈 위젯 } 가로·세로 따로 / wgTime: 위젯별 보이는 시간 { 이름: [시작시, 끝시] } (설정 > 위젯)
// half: 세로 화면을 위 시계 / 아래 위젯 반반으로 (끄면 시계를 폭에 맞게 최대한 크게) / halfL: 가로 화면을 왼쪽 시계 / 오른쪽 위젯 반반으로 (끄면 위젯 자리만 남기고 시계를 최대한 크게)
// night: 야간 모드 'off'·'dim'(어둡게)·'red'(붉은 단색), 안 고르면 폰은 붉게·나머지는 어둡게 / nightStart~nightEnd: 야간 시간(시)
// transit: 등록한 버스 정류장·지하철역 (교통 위젯) / alarms: 알람 [{ h, m, on, days: 'all' 매일 · 'wk' 평일(공휴일 빼고) · 'we' 주말 }]
// album: 사진 액자 앨범 번호(처음 올릴 때 만듦) / photoAt: 사진을 마지막으로 올리거나 지운 시각 (폰에서 바꾸면 미러가 목록을 새로 받는 신호)
const SET_KEY = 'mirror_settings';
const S = Object.assign(
  { hour12: false, secs: true, date: true, addr: false, alert: true, focus: !['detail', 'mirror'].includes(params.get('mode')), half: false, halfL: true, rotate: 10, wgL: null, wgP: null, wgTime: {}, night: null, nightStart: 23, nightEnd: 6, transit: [],
    alarms: [{ on: false, h: 7, m: 0, days: 'all' }] },
  (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })()
);
// 예전 알람 하나짜리 설정은 목록으로
if (S.alarm) { S.alarms = [{ ...S.alarm, days: 'all' }]; delete S.alarm; }
// 예전에 가로·세로 구분 없이 저장한 위젯 설정은 둘 다에 옮김
for (const k of ['wgL', 'wgP']) if (!S[k]) S[k] = { order: S.wgOrder || null, off: S.wgOff || [] };
delete S.wgOrder; delete S.wgOff;
// 음악 위젯은 없앰: 예전 재생목록 설정을 지우고, Google 로그인 토큰은 Google에 취소를 요청한 뒤 기기에서 지움
delete S.music; delete S.muShuffle; delete S.muRepeat; if (S.wgTime) delete S.wgTime.music;
try {
  const g = JSON.parse(localStorage.getItem('mirror_google'));
  if (g && g.refresh) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ token: g.refresh }) }).catch(() => {});
  localStorage.removeItem('mirror_google');
} catch (e) {}
function saveSettings() {
  if (REMOTE) { syncPush(); return; }   // 폰에서 미러 설정 중: 폰 자기 설정은 그대로 두고 미러로만 보냄
  try { localStorage.setItem(SET_KEY, JSON.stringify(S)); } catch (e) {}
  if (sync) syncPush();
}
