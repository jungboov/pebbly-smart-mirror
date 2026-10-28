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

// 도착 정보: 교통 위젯이 보일 때, 그리고 보이는 동안 30초마다 새로 받음 (서버도 30초 캐시)
// 그 사이에는 받아 온 뒤 지난 시간만큼 남은 분을 줄여서 보여줌. 제목에 받아 온 시각, 새로고침 버튼
let board = null, boardAt = 0, boardBusy = false, boardErr = false;
async function loadBoard() {
  if (!S.transit.length || boardBusy) return;
  boardBusy = true;
  $('tr-reload').disabled = true;
  const bus = [...new Set(S.transit.filter(t => t.t === 'bus').map(t => `${t.src}:${t.id}`))].join(',');
  const sub = [...new Set(S.transit.filter(t => t.t === 'sub').map(t => t.station))].join(',');
  try {
    board = await trCall({ op: 'board', bus, sub });
    boardAt = Date.now();
    boardErr = false;
  } catch (e) { boardErr = true; console.warn('교통 정보 확인 실패', e); }
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

function renderBoard() {
  if (!S.transit.length) { $('tr-board').innerHTML = ''; return; }
  const at = boardAt ? new Date(boardAt) : null;
  $('tr-at').textContent = (at ? ` · ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())} 기준` : '')
    + (boardErr ? ' · 연결 확인 중' : '');
  const past = (Date.now() - boardAt) / 6e4;
  // '3분' 옆에 작게 '2정거장' (몇 정거장 전인지 알 때만, 곧 도착이면 생략)
  const when = (min, text, st) => {
    if (min == null) return esc(text || '-');
    const m = Math.round(min - past);
    return m <= 0 ? '<em>곧 도착</em>' : `${m}분${st ? `<small class="tr-st">${st}정거장</small>` : ''}`;
  };
  const times = list => list.length ? list.join(' · ') : '정보 없음';
  $('tr-board').innerHTML = S.transit.map(it => {
    if (it.t === 'bus') {
      const arr = (board && board.bus[`${it.src}:${it.id}`]) || [];
      const rows = it.routes.slice(0, 4).map(r => {
        const a = arr.find(x => x.routeId === r.id);
        const t = a ? [when(a.min1, a.msg1, a.st1), ...(a.min2 != null || a.msg2 ? [when(a.min2, a.msg2, a.st2)] : [])] : [];
        return `<div class="tr-row"><b>${esc(r.name)}</b><span>${times(t)}</span></div>`;
      }).join('');
      return `<div class="tr-item"><div class="tr-head">${esc(it.name)}<small>${esc(it.no)}</small></div>${rows}</div>`;
    }
    const arr = ((board && board.sub[it.station]) || []).filter(a => a.sid === it.sid && a.updn === it.updn).slice(0, 2);
    return `<div class="tr-item"><div class="tr-head">${esc(it.station)}역<small>${esc(it.label)}</small></div>`
      + `<div class="tr-row"><b>${esc(it.label.split(' ')[0])}</b><span>${times(arr.map(a => when(a.min, a.text, a.st) + (a.express ? '<small class="tr-x">급행</small>' : '')))}</span></div></div>`;
  }).join('') + (board ? '' : '<div class="tr-none">도착 정보를 불러오는 중</div>');
}
