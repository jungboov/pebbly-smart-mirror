// Pebbly Mirror — 교통: 정류장·역 등록, 도착 정보
// ===== 교통: 버스 정류장·지하철역 검색 등록 (설정 화면) + 도착 정보 위젯 =====
// 서버 중계 /api/transit (functions/api/transit.js). 등록 정보는 S.transit에 기기마다 저장
//   버스: { t:'bus', src:'gg'|'seoul', id, name, no, routes:[{ id, name }] }
//   지하철: { t:'sub', station, sid(노선 번호), updn(상행·하행 등), label('1호선 송내방면') }
//   둘 다 alias(짧은 이름 — 설정의 정류장 목록에서 정함, 위젯에 원래 이름 대신)가 있을 수 있음
const TR_API = '/api/transit';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SRC_NAME = { gg: '경기', seoul: '서울' };
let trMode = null, trItems = [], trStop = null;

// 위젯에 보일 이름: 별칭이 있으면 별칭, 없으면 정류장 이름·'○○역'
const trName = it => String(it.alias || '').trim() || (it.t === 'bus' ? it.name : it.station + '역');
function trRenderList() {
  $('tr-list').innerHTML = S.transit.map((it, i) => `<li><div>${it.t === 'bus'
    ? `${esc(it.name)} <small>${SRC_NAME[it.src]} · ${esc(it.no)} · ${it.routes.map(r => esc(r.name)).join(', ')}</small>`
    : `${esc(it.station)}역 <small>${esc(it.label)}</small>`}`
    + `<input class="tr-alias" data-alias="${i}" value="${esc(it.alias || '')}" maxlength="12" placeholder="짧은 이름 (위젯에 이 이름으로)" enterkeyhint="done" autocomplete="off" aria-label="짧은 이름"></div>`
    + `<button data-del="${i}">삭제</button></li>`).join('');
}
// 짧은 이름(별칭): 입력을 마치면(엔터·다른 곳을 누름) 저장 — 비우면 원래 이름
$('tr-list').addEventListener('change', e => {
  const inp = e.target.closest('.tr-alias'), it = inp && S.transit[Number(inp.dataset.alias)];
  if (!it) return;
  const v = inp.value.trim();
  if (v) it.alias = v; else delete it.alias;
  saveSettings();
  applySettings();
});
$('tr-list').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.tr-alias')) e.target.blur(); });

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
const trNone = g => g || (!boardBusy && boardAt) ? '정보 없음' : '받는 중';   // 처음 받기 전(boardAt 0)도 받는 중
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

// 쪽 넘기기: 노선 줄이 다 안 들어가면 정류장째로 쪽을 나눠 교통 위젯이 보이는 동안 넘김 (판은 plate-wg.js pwTransit, 평면은 renderBoard가 나눔)
// 한 번 보이는 동안(넘김 주기) 모든 쪽이 지나가게 주기를 쪽 수로 나눔(쪽마다 3초 이상), 넘김을 꺼 뒀으면 6초마다. 위젯이 새로 나오면 첫 쪽부터(trEnter, screen.js)
let trPage = 0, trPages = 1, trPageAt = 0;
const trPageSec = () => S.rotate > 0 ? Math.max(3, S.rotate / trPages) : 6;
function trEnter() { trPage = 0; trPageAt = Date.now(); }
setInterval(() => {
  if (trPages < 2 || !S.focus || panelName !== 'transit' || document.hidden) return;
  if (Date.now() - trPageAt < trPageSec() * 1e3) return;
  trPage = (trPage + 1) % trPages; trPageAt = Date.now();
  renderBoard();
}, 500);

// 칸(타일) 하나 = 노선 하나(버스는 정류장의 노선마다, 지하철은 방면 하나): { name(별칭 또는 이름), lab(노선), a(이번 도착), b(다음 도착), none(도착이 없을 때 글자) }
// 도착: { n: 남은 분 } · { soon: true }(곧 도착) · { t: '운행종료'·'5정거장 전' 등 }, 급행이면 x. 남은 분은 받은 뒤 지난 시간만큼 줄임 (판 테마 plate-wg.js pwTransit도 이걸로)
function trTiles() {
  const when = (past, min, text, x) => {
    if (min == null) return text ? { t: text, x } : null;
    const m = Math.round(min - past);
    return m <= 0 ? { soon: true, x } : { n: m, x };
  };
  return S.transit.flatMap(it => {
    const g = trArr(it), arr = g ? g.list : [], p = g ? g.past : 0, none = trNone(g), name = trName(it);
    if (it.t === 'bus') return it.routes.slice(0, 4).map(r => {
      const v = arr.find(x => x.routeId === r.id);
      return { name, lab: r.name + '번', none, a: v ? when(p, v.min1, v.msg1) : null, b: v ? when(p, v.min2, v.msg2) : null };
    });
    const [v, w] = arr;
    return [{ name, lab: it.label, none, a: v ? when(p, v.min, v.text, v.express) : null, b: w ? when(p, w.min, w.text, w.express) : null }];
  });
}
// 칸 배치: 칸 n개를 폭 W·높이 H에 — 칸이 최소(mw × mh)보다 크고 가장 크게(가로:세로 1.8:1 기준) 되는 단 수.
// 다 넣으면 최소보다 작아지면 쪽을 나눔: 쪽마다 칸 수는 고르게(7개면 4·3), 높이는 H2(아래 쪽 점 자리를 뺀 높이) — { cols, rws, cw, ch, per(쪽마다 칸 수), pages }
function trGrid(n, W, H, H2, gap, mw, mh) {
  const fit = (m, h) => {
    let L = null;
    for (let cols = 1; cols <= Math.min(5, m); cols++) {
      const rws = Math.ceil(m / cols), cw = (W - (cols - 1) * gap) / cols, ch = (h - (rws - 1) * gap) / rws, s = Math.min(cw / 1.8, ch), ok = cw >= mw && ch >= mh;
      if (!L || (ok && !L.ok) || (ok === L.ok && s > L.s)) L = { cols, rws, cw, ch, s, ok };
    }
    return L;
  };
  const all = fit(n, H);
  if (all.ok || n < 2) return { ...all, per: n, pages: 1 };
  let per = 1;
  for (let m = n - 1; m > 1; m--) if (fit(m, H2).ok) { per = m; break; }
  const pages = Math.ceil(n / per);
  per = Math.ceil(n / pages);
  return { ...fit(per, H2), per, pages };
}

// 평면: 노선마다 한 칸 — 위 이름(별칭) / 가운데 이번 도착(크게) / 아래 노선 · 다음 도착, 칸 사이 줄 (판 테마와 같은 배치)
// 먼저 저절로 맞는 크기로 그려 위젯 칸 높이를 정하고(시계 크게 화면에선 칸 높이가 내용을 따라감 — 판 테마도 이 높이에 그림), 평면이면 그 높이에 맞춰
// 단 수·칸 크기·글자를 정해 다시 그림. 칸이 최소(25rem × 15rem)보다 작아질 만큼 많으면 쪽을 나눔(제목 줄에 1 / 2, 아래 쪽 점)
function renderBoard() {
  const box = $('tr-board');
  if (!S.transit.length) { box.innerHTML = ''; trPages = 1; return; }
  const at = trAt(), tiles = trTiles();
  const arrive = v => v.n != null ? `${v.n}<small>분</small>${v.x ? '<small class="tr-x">급행</small>' : ''}` : v.soon ? '<em>곧 도착</em>' : `<i>${esc(v.t)}</i>`;
  const tile = (t, cls = '') => `<div class="tr-tile${cls}"><b>${esc(t.name)}</b><span class="tr-big">${t.a ? arrive(t.a) : `<i>${esc(t.none)}</i>`}</span>`
    + `<div class="tr-ft"><small>${esc(t.lab)}</small>${t.b ? `<small>다음 ${t.b.n != null ? t.b.n + '분' : t.b.soon ? '곧 도착' : esc(t.b.t)}</small>` : ''}</div></div>`;
  box.innerHTML = `<div class="tr-grid">${tiles.map(t => tile(t)).join('')}</div>`;
  let L = null, pg = 0;
  if (!document.body.classList.contains('pw-on')) {
    const tr = $('transit'), tb = tr.getBoundingClientRect(), rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 4;
    const avail = tb.bottom - (parseFloat(getComputedStyle(tr).paddingBottom) || 0) - box.getBoundingClientRect().top, w = box.clientWidth;
    if (tb.height && avail > 0 && w > 0) {
      L = trGrid(tiles.length, w, avail, avail - 4 * rem, 0, 25 * rem, 15 * rem);
      pg = trPage % L.pages;
      const page = tiles.slice(pg * L.per, pg * L.per + L.per), px = v => v.toFixed(1) + 'px';
      const nf = Math.min(3.8 * rem, L.ch * .17, L.cw * .11), f1 = Math.min(L.ch * .42, L.cw * .28, 11 * rem), f3 = Math.min(2.6 * rem, Math.max(2.2 * rem, L.ch * .13));
      box.innerHTML = `<div class="tr-grid tr-fix" style="grid-template-columns:repeat(${L.cols},minmax(0,1fr));grid-auto-rows:${px(L.ch)};--nf:${px(nf)};--f1:${px(f1)};--f3:${px(f3)}">`
        + page.map((t, i) => tile(t, (i % L.cols ? ' cl' : ' c0') + (i % L.cols === L.cols - 1 ? ' ce' : '') + (i >= L.cols ? ' rt' : ''))).join('') + '</div>'
        + (L.pages > 1 ? `<div class="tr-dots">${Array.from({ length: L.pages }, (_, i) => `<i${i === pg ? ' class="on"' : ''}></i>`).join('')}</div>` : '');
    }
    trPages = L ? L.pages : 1;
  }
  $('tr-at').textContent = (at ? ` · ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())} 기준` : '')
    + (L && L.pages > 1 ? ` · ${pg + 1} / ${L.pages}` : '') + (boardErr ? ' · 연결 확인 중' : '');
  window.pwDraw?.('transit');   // 양각·음각 위젯 판 (plate-wg.js) — 판 테마면 여기서 쪽 수(trPages)를 정함
}
