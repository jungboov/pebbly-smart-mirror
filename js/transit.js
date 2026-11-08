// Pebbly Mirror — 교통: 정류장·역 등록, 도착 정보
// ===== 교통: 버스 정류장·지하철역 검색 등록 (설정 화면) + 도착 정보 위젯 =====
// 서버 중계 /api/transit (functions/api/transit.js). 등록 정보는 S.transit에 기기마다 저장
//   버스: { t:'bus', src:'gg'|'seoul', id, name, no, routes:[{ id, name }] }
//   지하철: { t:'sub', station, sid(노선 번호), updn(상행·하행 등), label('1호선 송내방면') }
const TR_API = '/api/transit';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SRC_NAME = { gg: '경기', seoul: '서울' };
let trMode = null, trItems = [], trStop = null;

function trRenderList() {
  $('tr-list').innerHTML = S.transit.map((it, i) => it.t === 'bus'
    ? `<li><div>${esc(it.name)} <small>${SRC_NAME[it.src]} · ${esc(it.no)} · ${it.routes.map(r => esc(r.name)).join(', ')}</small></div><button data-del="${i}">삭제</button></li>`
    : `<li><div>${esc(it.station)}역 <small>${esc(it.label)}</small></div><button data-del="${i}">삭제</button></li>`).join('');
}

function trMsg(text) { $('tr-msg').textContent = text || ''; }
async function trCall(params) {
  const r = await fetch(TR_API + '?' + new URLSearchParams(params), { cache: 'no-store' });
  const data = await r.json().catch(() => ({ error: '교통 서버에 연결하지 못했어요' }));
  if (data.error) throw new Error(data.error);
  return data;
}
// 한쪽(경기/서울)만 실패한 경우 이유를 함께 보여줌
const trNote = (n, errors) => [n ? '' : '결과가 없어요.', ...(errors || [])].filter(Boolean).join(' / ');

function trShowStops(stops, errors) {
  trItems = stops;
  $('tr-res').innerHTML = stops.map((s, i) => `<li data-i="${i}"><div>${esc(s.name)}`
    + `<small>${SRC_NAME[s.src]} · ${esc(s.no || '번호 없음')}${s.dist != null ? ` · ${s.dist}m` : s.region ? ` · ${esc(s.region)}` : ''}</small></div></li>`).join('');
  trMsg(trNote(stops.length, errors));
}

async function trSearch() {
  const q = $('tr-q').value.trim();
  if (!q) return;
  trMsg('찾는 중…'); $('tr-res').innerHTML = ''; trStop = null;
  try {
    if (trMode === 'bus') {
      const r = await trCall({ op: 'search', q });
      trShowStops(r.stops, r.errors);
    } else {
      const r = await trCall({ op: 'subway-search', q });
      trItems = r.dirs;
      $('tr-res').innerHTML = r.dirs.map((d, i) => `<li data-i="${i}"><div>${esc(d.station)}역 ${esc(d.line)}<small>${esc(d.updn)} · ${esc(d.dir)}</small></div></li>`).join('');
      trMsg(r.dirs.length ? '' : '지금 운행 중인 열차가 없어서 방면을 못 찾았어요. 열차가 다니는 시간에 다시 검색해 주세요.');
    }
  } catch (e) { trMsg('검색 실패: ' + e.message); }
}

// 내 주변 정류장: 지금 위치를 한 번 더 정확히(약 10m) 받아서 찾음. 안 되면 저장된 위치
async function trNear() {
  trMsg('내 위치 확인 중…'); $('tr-res').innerHTML = ''; trStop = null;
  const pos = await new Promise(res => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(p => res([p.coords.latitude, p.coords.longitude]), () => res(null), { enableHighAccuracy: true, timeout: 10000 })
    : res(null));
  const [lat, lon] = pos || (savedLoc() && savedLoc().fine) || [CONFIG.lat, CONFIG.lon];
  trMsg('주변 정류장 찾는 중…');
  try {
    const r = await trCall({ op: 'near', lat: round(lat, 4), lon: round(lon, 4) });
    trShowStops(r.stops, r.errors);
  } catch (e) { trMsg('찾기 실패: ' + e.message); }
}

// 결과를 고름: 지하철은 바로 등록, 버스는 그 정류장의 노선을 골라 등록
async function trChoose(i) {
  const it = trItems[i];
  if (trMode === 'sub') {
    trAdd({ t: 'sub', station: it.station, sid: it.sid, updn: it.updn, label: `${it.line} ${it.dir}` });
    return;
  }
  trStop = it;
  trMsg('노선 불러오는 중…'); $('tr-res').innerHTML = '';
  try {
    const { routes } = await trCall({ op: 'routes', src: it.src, id: it.id });
    trItems = routes;
    $('tr-res').innerHTML = routes.map((r, k) => `<li><label><input type="checkbox" value="${k}"><div>${esc(r.name)}<small>${esc(r.dest)}</small></div></label></li>`).join('')
      + (routes.length ? '<li style="border:0;padding:0"><button class="tr-save" id="tr-save" style="flex:1">선택한 노선 등록</button></li>' : '');
    trMsg(routes.length ? `${it.name} — 볼 노선을 고르세요` : '이 정류장을 지나는 노선 정보가 없어요.');
  } catch (e) { trMsg('노선 불러오기 실패: ' + e.message); }
}

function trSaveRoutes() {
  const picked = [...$('tr-res').querySelectorAll('input:checked')].map(c => trItems[c.value]);
  if (!picked.length) { trMsg('노선을 하나 이상 고르세요'); return; }
  const s = trStop;
  trAdd({ t: 'bus', src: s.src, id: s.id, name: s.name, no: s.no, routes: picked.map(r => ({ id: r.id, name: r.name })) });
}

function trAdd(item) {
  S.transit.push(item);
  $('tr-find').hidden = true;
  trMsg('');
  saveSettings();
  applySettings();
  loadBoard();
}

$('tr-sec').addEventListener('click', e => {
  const b = e.target.closest('button, li[data-i]');
  if (!b) return;
  if (b.dataset.add) {
    trMode = b.dataset.add; trStop = null;
    $('tr-find').hidden = false;
    $('tr-near').hidden = trMode !== 'bus';
    $('tr-q').value = '';
    $('tr-q').placeholder = trMode === 'bus' ? '정류장 이름 (예: 부천시청)' : '역 이름 (예: 부천)';
    $('tr-res').innerHTML = ''; trMsg('');
    $('tr-q').focus();
  } else if (b.dataset.del != null) {
    S.transit.splice(Number(b.dataset.del), 1);
    saveSettings();
    applySettings();
  } else if (b.id === 'tr-go') trSearch();
  else if (b.id === 'tr-near') trNear();
  else if (b.id === 'tr-save') trSaveRoutes();
  else if (b.dataset.i != null) trChoose(Number(b.dataset.i));
});
$('tr-q').addEventListener('keydown', e => { if (e.key === 'Enter') trSearch(); });

// 도착 정보: 정류장·역마다 따로 받아서 오는 대로 그림 — 경기 버스 서버는 한동안 안 부르다 부르면 첫 응답이 20초쯤 걸릴 때가 있어
// 한 요청으로 묶으면 다른 정류장·지하철까지 그만큼 기다렸음. 받은 것은 정류장·역마다 받은 시각과 함께 두고(trGot),
// 이번에 못 받은 곳은 지난번 것을 그 뒤 지난 시간만큼 줄여서 보여 줌(5분까지). 남은 분도 받은 뒤 지난 시간만큼 줄임
// 받는 때: 교통 위젯이 보일 때, 보이는 동안 30초마다, 넘김 순서상 교통 위젯이 나오기 25초 전(trAhead) — 서버도 30초 캐시
let trGot = {}, boardAt = 0, boardBusy = false, boardErr = false, trPre;
const TR_KEEP = 5 * 6e4;
const trKey = it => it.t === 'bus' ? `${it.src}:${it.id}` : 'sub:' + it.station;
// 등록 항목 하나의 도착 목록과 받은 뒤 지난 분 — 아직 없거나 너무 오래됐으면 null
// trNone: 도착 목록이 비었을 때 글자 — 아직 못 받은 정류장은 받는 동안 '받는 중'
const trNone = g => g || !boardBusy ? '정보 없음' : '받는 중';
function trArr(it) {
  const g = trGot[trKey(it)];
  if (!g || Date.now() - g.at > TR_KEEP) return null;
  return { list: it.t === 'bus' ? g.list : g.list.filter(a => a.sid === it.sid && a.updn === it.updn).slice(0, 2), past: (Date.now() - g.at) / 6e4 };
}
// 제목 줄 '… 기준' 시각: 보이는 것 중 가장 먼저 받은 것
function trAt() {
  const t = S.transit.map(it => trGot[trKey(it)]).filter(g => g && Date.now() - g.at <= TR_KEEP).map(g => g.at);
  return t.length ? new Date(Math.min(...t)) : null;
}
async function loadBoard() {
  if (!S.transit.length || boardBusy) return;
  boardBusy = true;
  $('tr-reload').disabled = true;
  window.pwDraw?.('transit');   // 판의 [ refresh ] → [ ··· ]
  let fail = 0;
  await Promise.all([...new Set(S.transit.map(trKey))].map(async k => {
    const sub = k.startsWith('sub:'), name = sub ? k.slice(4) : k;
    try {
      const r = await trCall({ op: 'board', [sub ? 'sub' : 'bus']: name }), list = (sub ? r.sub : r.bus)[name];
      if (!list) throw new Error((r.errors || []).join(' / ') || '응답 없음');
      trGot[k] = { at: Date.now(), list };
    } catch (e) { fail++; console.warn('교통 정보 확인 실패', name, e); }
    renderBoard();   // 먼저 온 정류장부터
  }));
  boardAt = Date.now() - (fail ? 20e3 : 0);   // 못 받은 곳이 있으면 10초 뒤에 다시
  boardErr = fail > 0;
  boardBusy = false;
  $('tr-reload').disabled = false;
  renderBoard();
}
$('tr-reload').addEventListener('click', loadBoard);
setInterval(() => {
  if (!S.focus || !S.transit.length || panelName !== 'transit' || document.hidden) return;
  if (Date.now() - boardAt > 30e3) loadBoard();
  else renderBoard();   // 남은 분 줄이기
}, 10e3);
// 넘김 순서상 교통 위젯이 나오기 25초 전에 미리 받아 둠 (schedulePanel이 위젯이 바뀔 때마다 부름) — 나올 때 이미 새 정보가 있게.
// 나올 때 정보가 40초보다 오래되지 않을 거면 안 받음. 사진 액자가 여러 장 넘기는 동안 등으로 늦게 나오면 나올 때 다시 받음
function trAhead() {
  clearTimeout(trPre);
  if (!S.focus || !S.transit.length || !(S.rotate > 0)) return;
  const list = panelList(), i = list.indexOf('transit'), steps = (i - panel + list.length) % list.length;
  if (i < 0 || !steps) return;
  const due = Date.now() + steps * S.rotate * 1000;
  trPre = setTimeout(() => { if (!document.hidden && due - boardAt > 40e3) loadBoard(); }, Math.max(0, due - 25e3 - Date.now()));
}

function renderBoard() {
  if (!S.transit.length) { $('tr-board').innerHTML = ''; return; }
  const at = trAt();
  $('tr-at').textContent = (at ? ` · ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())} 기준` : '')
    + (boardErr ? ' · 연결 확인 중' : '');
  // '3분' 옆에 작게 '2정거장' (몇 정거장 전인지 알 때만, 곧 도착이면 생략). past: 받은 뒤 지난 분
  const when = (past, min, text, st) => {
    if (min == null) return esc(text || '-');
    const m = Math.round(min - past);
    return m <= 0 ? '<em>곧 도착</em>' : `${m}분${st ? `<small class="tr-st">${st}정거장</small>` : ''}`;
  };
  const times = (list, g) => list.length ? list.join(' · ') : trNone(g);
  $('tr-board').innerHTML = S.transit.map(it => {
    const g = trArr(it), arr = g ? g.list : [], p = g ? g.past : 0;
    if (it.t === 'bus') {
      const rows = it.routes.slice(0, 4).map(r => {
        const a = arr.find(x => x.routeId === r.id);
        const t = a ? [when(p, a.min1, a.msg1, a.st1), ...(a.min2 != null || a.msg2 ? [when(p, a.min2, a.msg2, a.st2)] : [])] : [];
        return `<div class="tr-row"><b>${esc(r.name)}</b><span>${times(t, g)}</span></div>`;
      }).join('');
      return `<div class="tr-item"><div class="tr-head">${esc(it.name)}<small>${esc(it.no)}</small></div>${rows}</div>`;
    }
    return `<div class="tr-item"><div class="tr-head">${esc(it.station)}역<small>${esc(it.label)}</small></div>`
      + `<div class="tr-row"><b>${esc(it.label.split(' ')[0])}</b><span>${times(arr.map(a => when(p, a.min, a.text, a.st) + (a.express ? '<small class="tr-x">급행</small>' : '')), g)}</span></div></div>`;
  }).join('') + (S.transit.some(it => trArr(it)) ? '' : '<div class="tr-none">도착 정보를 불러오는 중</div>');
  window.pwDraw?.('transit');   // 양각·음각 위젯 판 (plate-wg.js)
}
