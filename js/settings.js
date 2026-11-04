// Pebbly Mirror — 설정 화면: 열기·버튼, 탭(화면·시계·위젯)과 위젯 페이지, 위젯 탭
// ===== 설정 화면 =====
let settingsAt = 0;
// 탭: 화면 · 테마 · 위젯. 페이지 → 켜 둘 탭. 위젯 페이지(교통·사진 액자·로고·디데이·집중 타이머)는 위젯 탭 목록에서 들어가서 위젯 탭이 켜져 있음, 폰으로 설정·미러 설정하기는 탭 없음
const SET_TOP = { screen: 'screen', theme: 'theme', widgets: 'widgets', transit: 'widgets', photo: 'widgets', logo: 'widgets', count: 'widgets', focus: 'widgets' };
const WG_PAGE = ['transit', 'photo', 'logo', 'count', 'focus'];   // 위젯 탭에서 눌러 들어가는 위젯
function setTab(t) {
  const card = $('settings').querySelector('.set-card');
  card.dataset.tab = t;
  card.querySelectorAll('.set-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === SET_TOP[t]));
  card.querySelectorAll('.set-page').forEach(p => p.classList.toggle('on', p.dataset.page === t));
  card.querySelector('.set-body').scrollTop = 0;   // 제목·탭·닫기 줄은 고정, 가운데만 스크롤
  if (t === 'photo') phLoadOthers();   // 사진 앨범 같이 쓰기: 다른 미러 앨범 확인
}
// 스타일(화면 탭): 시계(디지털)·로고·위젯 모양을 한 번에 — 평면 · 라이트/다크 양각·음각 · 퓨어 화이트/다크 양각·음각(판 없이 화면 바탕에). 평면은 로고는 그대로(로고 위젯은 판 모양뿐)
const STYLES = { flat: { digi: '', plate: 'flat' }, ...Object.fromEntries(['emboss', 'deboss', 'embossk', 'debossk', 'embossw', 'debossw', 'embossd', 'debossd'].map(t => [t, { digi: t, plate: t, logoTheme: t }])) };
const styleNow = () => S.analog ? '' : Object.keys(STYLES).find(id => Object.entries(STYLES[id]).every(([k, v]) => (S[k] || '') === v)) || '';
function openSettings() {
  $('settings').hidden = false;
  settingsAt = performance.now();
  wgEdit = wgNow();
  wgRender();
  // QR로 다른 미러를 연 적이 있으면 '미러 설정하기' (이름 목록, 이 기기 자신의 연결 번호는 빼고)
  $('remote-open').hidden = !!REMOTE || !savedRemotes().some(r => !(sync && sync.id === r.id));
  renderRemotes();
}
$('settings').addEventListener('click', e => {
  if (performance.now() - settingsAt < 500) return;   // 열 때의 두 번째 탭이 바로 닫지 않게
  const b = e.target.closest('button');
  if (b && !b.isConnected) return;   // 위젯·사진 탭 안쪽 처리에서 목록을 다시 그려 떨어져 나간 버튼 (이미 처리됨)
  if (b && b.dataset.tab) { setTab(b.dataset.tab); return; }
  if (b && b.dataset.back != null) { setTab('widgets'); return; }   // 위젯 페이지 › 위젯 목록으로
  if (b && b.classList.contains('set-sync')) { setTab('sync'); syncOpen(); return; }
  if (b && b.id === 'sync-off') { syncOff(); return; }
  if (b && b.id === 'remote-apply') { remoteApply(); return; }
  if (b && b.id === 'remote-open') { setTab('remotes'); renderRemotes(); return; }
  // 미러 이름 목록: 이름을 누르면 그 미러 설정 / 이름 정하기·바꾸기 / 이 폰 목록에서 지우기
  if (b && b.dataset.go) { remoteGo(b.dataset.go); return; }
  if (b && b.dataset.nameSave != null) { remoteRename(REMOTE, $('rm-name').value); return; }
  if (b && b.dataset.rename) {
    const r = savedRemotes().find(x => x.id === b.dataset.rename), name = prompt('미러 이름', r ? r.name : '');
    if (name != null) remoteRename(b.dataset.rename, name);
    return;
  }
  if (b && b.dataset.forget) {
    if (confirm('이 폰의 목록에서 지울까요? (미러 쪽 연결은 그대로예요)')) { saveRemotes(savedRemotes().filter(r => r.id !== b.dataset.forget)); openSettings(); }
    return;
  }
  if (REMOTE && (e.target === $('settings') || (b && b.classList.contains('set-close')))) {
    // 다 바꿨으면 이 폰의 원래 화면으로 (바깥을 눌러서는 안 닫힘). 미러에 적용 안 한 게 있으면 한 번 물어봄
    if (b && (!remoteDirty || confirm('미러에 적용하지 않은 설정이 있어요. 그냥 나갈까요?'))) location.href = '/';
    return;
  }
  if (b && b.parentNode.dataset.key) S[b.parentNode.dataset.key] = { 1: true, 0: false }[b.dataset.v] ?? b.dataset.v;
  else if (b && b.dataset.chip) S[b.dataset.chip] = !S[b.dataset.chip];
  else if (b && b.dataset.nt) S[b.dataset.nt] = (S[b.dataset.nt] + Number(b.dataset.d) + 24) % 24;   // 0~23시 돌아감
  else if (b && b.dataset.d) S.rotate = Math.min(120, Math.max(0, S.rotate + Number(b.dataset.d)));   // 0 = 끔
  else if (b && b.dataset.clockTheme) {   // 디지털(평면·양각·음각)이면 S.digi, 아날로그면 S.dialTheme
    const t = CLOCK_THEMES.find(x => x.id === b.dataset.clockTheme) || CLOCK_THEMES[0];
    S.analog = !(t.id === 'digital' || t.digi);
    if (S.analog) S.dialTheme = t.id; else S.digi = t.digi || '';
  }
  else if (b && b.dataset.style) Object.assign(S, STYLES[b.dataset.style], { analog: false });   // 스타일: 시계는 디지털로
  else if (b && b.dataset.logoTheme) S.logoTheme = b.dataset.logoTheme;   // 로고 위젯 테마
  else if (b && b.dataset.plateTheme) S.plate = b.dataset.plateTheme;   // 위젯 모양 (plate.js — 로고 말고 모든 위젯)
  else if (b && b.dataset.ls) S.logoSpin = LG_SPIN[Math.min(LG_SPIN.length - 1, Math.max(0, LG_SPIN.indexOf(S.logoSpin) + Number(b.dataset.ls)))];   // 숫자 다시 돌기 간격
  else {
    if (e.target === $('settings') || (b && b.classList.contains('set-close'))) $('settings').hidden = true;
    return;
  }
  saveSettings();
  applySettings();
});

// 시계 탭: 테마 카드. 누르면 시계 모양(S.analog)과 아날로그 테마(S.dialTheme)를 같이 정함
// 같은 시계의 색 차이는 fam(묶음)으로 카드 하나에: 카드 아래 점(dot 색, v 이름)을 누르면 그 색으로. 카드는 고른 색(아니면 첫 색) 그림·이름
// 레코드판 테마 늘리기: 여기 한 줄(이름, 작은 그림의 케이스 색 3개·테두리·라벨 색) + clock.css '.dial[data-theme=…]'(실제 시계판 색)
// 엣지·모던·플라워·블랙 타일·타일 캘린더·LCD처럼 모양이 다른 시계판은 index.html #dial에 따로 그리고 작은 그림도 따로 (edge·modern·flower·rainbow·qp·lcd·quartz·rotary·relief — LCD 다크·양각 다크는 같은 그림에 색만)
const CLOCK_THEMES = [
  { id: 'digital', name: '디지털', fam: 'digital', v: '평면', dot: '#000' },
  { id: 'digitale', name: '디지털 라이트 양각', digi: 'emboss', fam: 'digital', v: '라이트 양각', dot: 'linear-gradient(135deg, #fff, #ebe5e3 45%, #a39b97)' },
  { id: 'digitald', name: '디지털 라이트 음각', digi: 'deboss', fam: 'digital', v: '라이트 음각', dot: 'linear-gradient(135deg, #a39b97, #ebe5e3 55%, #fff)' },
  { id: 'digitalek', name: '디지털 다크 양각', digi: 'embossk', fam: 'digital', v: '다크 양각', dot: 'linear-gradient(135deg, #77777e, #2a2a2d 50%, #000)' },
  { id: 'digitaldk', name: '디지털 다크 음각', digi: 'debossk', fam: 'digital', v: '다크 음각', dot: 'linear-gradient(135deg, #000, #2a2a2d 50%, #6a6a70)' },
  // 퓨어: 판 없이 화면 바탕(흰색·검정)에 바로 — 퓨어 화이트는 시계 강조 화면 바탕이 흰색
  { id: 'dpw', name: '디지털 퓨어 화이트 양각', digi: 'embossw', fam: 'digitalp', v: '퓨어 화이트 양각', dot: 'radial-gradient(circle at 35% 30%, #fff 45%, #c9c9ce)' },
  { id: 'dpwd', name: '디지털 퓨어 화이트 음각', digi: 'debossw', fam: 'digitalp', v: '퓨어 화이트 음각', dot: 'radial-gradient(circle at 65% 70%, #fff 40%, #a9a9b0)' },
  { id: 'dpd', name: '디지털 퓨어 다크 양각', digi: 'embossd', fam: 'digitalp', v: '퓨어 다크 양각', dot: 'radial-gradient(circle at 35% 30%, #5a5a60, #000 60%)' },
  { id: 'dpdd', name: '디지털 퓨어 다크 음각', digi: 'debossd', fam: 'digitalp', v: '퓨어 다크 음각', dot: 'radial-gradient(circle at 65% 70%, #55555c, #000 60%)' },
  { id: 'black', name: '레코드 블랙', dial: ['#2e2e2e', '#161616', '#0b0b0b', 'rgba(255,255,255,.35)', 'var(--vinyl-label)'], fam: 'rec', v: '블랙', dot: '#161616' },
  { id: 'silver', name: '레코드 실버', dial: ['#f2f2f2', '#c3c3c3', '#8b8b8b', '#fff', '#d42d2d'], fam: 'rec', v: '실버', dot: 'linear-gradient(135deg, #f2f2f2, #8b8b8b)' },
  { id: 'edge', name: '엣지', edge: true, fam: 'edge', v: '화이트', dot: '#fff' },
  { id: 'edgem', name: '엣지 민트', edge: true, fam: 'edge', v: '민트', dot: '#5cf2cf' },
  { id: 'edger', name: '엣지 레인보우', edge: true, fam: 'edge', v: '레인보우', dot: 'conic-gradient(#ff3b30, #ffcc00, #34c759, #0a84ff, #bf5af2, #ff3b30)' },
  { id: 'line', name: '라인', modern: true },
  { id: 'sweep', name: '스윕', modern: true },
  { id: 'date', name: '데이트', modern: true },
  { id: 'flower', name: '플라워', flower: true },
  { id: 'rainbow', name: '블랙 타일', rainbow: true },
  { id: 'qp', name: '타일 캘린더', qp: true },
  { id: 'lcd', name: 'LCD', lcd: true, fam: 'lcd', v: '라이트', dot: '#dcdee1' },
  { id: 'lcdk', name: 'LCD 다크', lcd: true, fam: 'lcd', v: '다크', dot: '#2a2b2e' },
  { id: 'quartz', name: '쿼츠', quartz: true },
  { id: 'rotary', name: '로터리', rotary: true },
  { id: 'relief', name: '양각', relief: true, fam: 'relief', v: '라이트', dot: '#e3ddda' },
  { id: 'reliefk', name: '양각 다크', relief: true, fam: 'relief', v: '다크', dot: '#2b2b2e' },
];
const thFam = t => t.fam || t.id;
// 작은 그림 (40×40): 디지털은 시·분 두 줄(양각은 판에 도드라진 숫자 — plate.js digiThumb), 레코드판은 케이스·나사·눈금·레코드·라벨·바늘(10시 10분 30초),
// 엣지(흰·민트·레인보우)는 실제 시계판(200×244)을 그대로 줄여서 — 가장자리 숫자·테두리(clock.js edgeNums)·바늘(10시 10분), 모던도 실제 그림 조각(clock.js modernParts)으로, 플라워는 꽃 그림에 바늘(clock.js flowerHands), 블랙 타일·타일 캘린더·LCD·쿼츠·로터리·양각도 실제 그림(clock.js rainbowParts·qpParts·lcdParts·quartzParts·rotaryParts·reliefParts)
function thThumb(t) {
  if (t.digi) return digiThumb(t.id, t.digi);
  if (t.qp) {
    const p = qpParts('th-dq-', new Date()), rot = (deg, s) => `<g transform="rotate(${deg})">${s}</g>`;
    return `<svg viewBox="-76 -76 152 152" aria-hidden="true"><defs>${p.defs}</defs>${p.face}<g filter="url(#th-dq-sh)">${rot(305, p.hour)}${rot(61, p.minute)}${p.hub}</g></svg>`;
  }
  if (t.rotary) {   // 10시 9분 30초로 링을 돌려 둠, 글자 폭은 카드가 그려진 뒤 맞춤(thRender)
    const p = rotaryParts('th-dk-');
    let face = p.face;
    for (const [n, deg] of [['h', -300], ['m', -54], ['s', -180]]) face = face.replace(`<g id="th-dk-${n}">`, `<g id="th-dk-${n}" transform="rotate(${deg})">`);
    return `<svg viewBox="-100 -100 200 200" aria-hidden="true"><defs>${p.defs}</defs>${face}</svg>`;
  }
  if (t.relief) {   // 10시 10분 30초, 위 작은 다이얼은 22시 10분
    const p = reliefParts(`th-${t.id}-`, new Date(), t.id), y = DV.sub * DV.k, at = (deg, s, oy = 0) => `<g transform="translate(0 ${oy}) rotate(${deg})">${s}</g>`;
    return `<svg viewBox="-128 -125 256 250" aria-hidden="true"><defs>${p.defs}</defs>${p.face}${at(180, p.sec, y)}${at(332.5, p.sub24, -y)}`
      + `<g filter="url(#th-${t.id}-hs)">${at(305, p.hour)}${at(61, p.minute)}${p.hub}</g></svg>`;
  }
  if (t.quartz) {
    const p = quartzParts('th-dw-'), rot = (deg, s) => `<g transform="rotate(${deg})">${s}</g>`;
    return `<svg viewBox="-100 -100 200 200" aria-hidden="true"><defs>${p.defs}</defs>${p.face}<g filter="url(#th-dw-sh)">${rot(305, p.hour)}${rot(61, p.minute)}${p.hub}</g>${rot(200, p.sec)}</svg>`;
  }
  if (t.lcd) {
    const p = lcdParts(`th-${t.id}-`, t.id);
    return `<svg viewBox="-24 -7 248 234" aria-hidden="true"><defs>${p.defs}</defs>${p.face}${lcdTime('1009', t.id)}${lcdDay(new Date().getDate(), t.id)}</svg>`;
  }
  if (t.rainbow) {
    const p = rainbowParts('th-dr-'), at = (deg, s, x = 0, y = 0) => `<g transform="translate(${x} ${y}) rotate(${deg})">${s}</g>`, [sl, sr, ss] = DR.sub;
    return `<svg viewBox="-76 -76 152 152" aria-hidden="true"><defs>${p.defs}</defs>${p.face}${at(180, p.sub, ...ss)}`
      + `<g filter="url(#th-dr-sh)">${at(305, p.sub, ...sl)}${at(60, p.sub, ...sr)}${at(305, p.hour)}${at(61, p.minute)}${p.hub}</g>${at(200, p.sec)}</svg>`;
  }
  if (t.flower) {
    const p = flowerHands('th-df-'), rot = (deg, s) => `<g transform="rotate(${deg})">${s}</g>`, src = document.querySelector('.df-img').getAttribute('src');
    return `<svg viewBox="-100 -100 200 200" aria-hidden="true"><defs>${p.defs}</defs><image href="${src}" x="-100" y="-100" width="200" height="200"/>`
      + `<g filter="url(#th-df-sh)">${rot(305, p.hour)}${rot(61, p.minute)}${p.hub}</g>${rot(200, p.sec)}</svg>`;
  }
  if (t.modern) {
    const p = modernParts(t.id), rot = (deg, s) => `<g transform="rotate(${deg})">${s}</g>`;
    return `<svg viewBox="-128 -126 256 252" aria-hidden="true">${p.bg}${p.face}${modernCal(t.id, new Date())}${rot(305, p.hand(p.hands[0]))}${rot(61, p.hand(p.hands[1]))}${p.hub}${rot(200, p.sec)}</svg>`;
  }
  if (t.edge) { const hand = EDGE_INK[t.id] || '#fff';
    return '<svg viewBox="-28 -4 256 252" aria-hidden="true"><rect width="200" height="244" rx="44" fill="#000" stroke="var(--card-bd)" stroke-width="3"/>'
    + `${edgeNums(10 + 10 / 60, t.id, `th-${t.id}-`)}<g fill="none" stroke="${hand}" stroke-linecap="round">`
    + [[305, 49.2], [60, 81.9]].map(([r, L]) => `<g transform="translate(100 122) rotate(${r})"><path d="M0 0V-15.7" stroke-width="3.2"/><path d="M0-15.7V-${L}" stroke-width="11"/></g>`).join('')
    + `</g><path d="M100 134V30" stroke="#ff3b30" stroke-width="3"/><circle cx="100" cy="122" r="6" fill="${hand}"/></svg>`; }
  if (!t.dial) return '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x=".6" y=".6" width="38.8" height="38.8" rx="6" fill="#000" stroke="var(--card-bd)" stroke-width=".8"/>'
    + '<g fill="#fff" font-weight="900" font-size="13" text-anchor="end" style="font-family:var(--num)"><text x="31" y="19">10</text><text x="31" y="34">08</text></g></svg>';
  const [a, b, c, edge, label] = t.dial, g = 'th-g-' + t.id;
  const hand = (deg, r, w, color) => `<path d="M20 20V${20 - r}" transform="rotate(${deg} 20 20)" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  let ticks = '', grooves = '';
  for (let i = 0; i < 12; i++) ticks += `<path d="M20 2.8v2.2" transform="rotate(${i * 30} 20 20)"/>`;
  for (let r = 6.4; r < 14.4; r += 1.2) grooves += `<circle cx="20" cy="20" r="${r.toFixed(1)}"/>`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>`
    + `<rect x=".6" y=".6" width="38.8" height="38.8" rx="6" fill="url(#${g})" stroke="${edge}" stroke-width=".5"/>`
    + [[4.6, 4.6], [35.4, 4.6], [4.6, 35.4], [35.4, 35.4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="url(#${g})" stroke="${edge}" stroke-width=".3"/>`).join('')
    + `<circle cx="20" cy="20" r="17.6" fill="#040404" stroke="${edge}" stroke-width=".5"/><g stroke="#fff" stroke-width=".8">${ticks}</g>`
    + `<circle cx="20" cy="20" r="14.6" fill="#080808"/><g fill="none" stroke="rgba(255,255,255,.08)" stroke-width=".3">${grooves}</g>`
    + `<circle cx="20" cy="20" r="5" style="fill:${label}"/>${hand(300, 8.5, 1.6, '#fff')}${hand(60, 13, .8, '#fff')}${hand(180, 14, .5, label)}`
    + `<circle cx="20" cy="20" r="1" fill="#ddd"/></svg>`;
}
function thRender() {
  const cur = S.analog ? S.dialTheme : (CLOCK_THEMES.find(t => t.digi && t.digi === S.digi) || CLOCK_THEMES[0]).id;
  $('th-list').innerHTML = [...new Set(CLOCK_THEMES.map(thFam))].map(f => {
    const vs = CLOCK_THEMES.filter(t => thFam(t) === f), t = vs.find(x => x.id === cur) || vs[0];
    return `<div class="th-fam${t.id === cur ? ' on' : ''}"><button class="th-pick" data-clock-theme="${t.id}">${thThumb(t)}<span>${t.name}</span></button>`
      + `<div class="th-dots">${vs.length < 2 ? '' : vs.map(x => `<button data-clock-theme="${x.id}" class="${x.id === t.id ? 'on' : ''}" style="--c:${x.dot}" aria-label="${x.name}" title="${x.v}"></button>`).join('')}</div></div>`;
  }).join('');
  rotaryText('th-dk-', new Date(2026, 10, 2, 10, 9), $('th-list'));
  $('lg-list').innerHTML = lgCards();
  document.querySelectorAll('.pl-list').forEach(el => { el.innerHTML = plCards(el.dataset.pl); });   // 위젯 모양 (테마 탭 › 하나씩 고르기)
  // 테마 탭 스타일 카드: 작은 시계 판(10 / 08)으로 — 평면은 디지털 시계 그대로. 지금 모양이 스타일 하나와 맞으면 그 카드가 켜짐, 따로 골라 섞였으면 '하나씩 고르기' 옆에 알림
  $('st-list').innerHTML = PLATE_THEMES.map(([id, name]) => `<button class="th-card" data-style="${id}">${id === 'flat' ? thThumb(CLOCK_THEMES[0]) : digiThumb('st-' + id, id)}<span>${name}</span></button>`).join('');
  const st = styleNow();
  document.querySelectorAll('[data-style]').forEach(b => b.classList.toggle('on', b.dataset.style === st));
  $('th-mix').textContent = st ? '' : '지금 따로 고른 모양';
}

// 위젯 탭: 가로·세로 중 고치는 쪽(설정을 열면 지금 화면 방향) / 순서대로 이름(› 있는 건 누르면 그 위젯 페이지) / 보이는 시간·위로·아래로 / 켜짐·꺼짐. 모두 끄면 시계만
// 보이는 시간을 정한 위젯은 그 시간에만 나오고, 시작 시각이 되면 바로 그 위젯으로 넘어감 (시간은 가로·세로 공통)
const CHEV = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
let wgEdit = 'L', wgTimeOpen = null;
const CLOCKI = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
function wgHour(h) {
  if (!S.focus || !Object.keys(S.wgTime).length) return;
  applySettings();
  const list = panelList(), started = list.find(n => S.wgTime[n] && S.wgTime[n][0] === h);
  if (started && panelName !== started) showPanel(list.indexOf(started), 1, innerWidth > innerHeight ? 'y' : 'x');
}
function wgRender() {
  const order = wgOrder(wgEdit), off = wgCfg(wgEdit).off;
  document.querySelectorAll('.wg-or button').forEach(b => b.classList.toggle('on', b.dataset.or === wgEdit));
  $('wg-hint').textContent = `${wgEdit === 'P' ? '세로' : '가로'} 화면에서 켠 위젯이 이 순서대로 넘어가요. 모두 끄면 시계만 크게 보여요. 지금 화면은 ${wgNow() === 'P' ? '세로' : '가로'}예요. (시계 강조 화면에만 적용)`;
  $('wg-list').innerHTML = order.map((n, i) => {
    const on = !off.includes(n), ready = wgReady(n), t = S.wgTime[n], open = wgTimeOpen === n;
    const note = [ready ? '' : n === 'transit' ? '눌러서 정류장을 등록하면 나와요' : n === 'count' ? '눌러서 날짜를 등록하면 나와요' : '눌러서 사진을 올리면 나와요',
      n === 'focus' && !on ? '꺼 둬도 타이머가 도는 동안은 나와요' : '',
      t ? `${hourName(t[0])}~${hourName(t[1])}에만` : ''].filter(Boolean).map(x => `<small>${x}</small>`).join('');
    const edit = !open ? '' : '<div class="wg-time">' + (t
      ? [0, 1].map(k => `<button data-th="${k}" data-step="-1" aria-label="${k ? '끝' : '시작'} 1시간 앞당기기">−</button><b>${hourName(t[k])}</b>`
        + `<button data-th="${k}" data-step="1" aria-label="${k ? '끝' : '시작'} 1시간 늦추기">+</button>`).join('<i>~</i>') + '<button class="wg-always">항상</button>'
      : '<em>항상 보여요</em><button class="wg-set">시간 정하기</button>') + '</div>';
    const name = WG_PAGE.includes(n) ? `<button class="wg-name" data-open="${n}">${WG_NAMES[n]}<i>›</i>${note}</button>` : `<span>${WG_NAMES[n]}${note}</span>`;
    return `<li data-wg="${n}" class="${ready ? '' : 'wait'}">${name}`
      + `<button data-tm class="${t ? 'timed' : ''}${open ? ' open' : ''}" aria-label="보이는 시간">${CLOCKI}</button>`
      + `<button data-mv="-1" aria-label="위로"${i ? '' : ' disabled'}>${CHEV('M6 15l6-6 6 6')}</button>`
      + `<button data-mv="1" aria-label="아래로"${i < order.length - 1 ? '' : ' disabled'}>${CHEV('M6 9l6 6 6-6')}</button>`
      + `<button class="wg-tog${on ? ' on' : ''}">${on ? '켜짐' : '꺼짐'}</button>${edit}</li>`;
  }).join('');
}
document.querySelector('[data-page="widgets"]').addEventListener('click', e => {
  const b = e.target.closest('button'), li = b && b.closest('li');
  if (!b || b.disabled) return;
  if (b.dataset.or) { wgEdit = b.dataset.or; wgRender(); return; }
  if (b.dataset.open) { setTab(b.dataset.open); return; }   // 그 위젯 페이지로
  if (!li) return;
  const n = li.dataset.wg, cfg = wgCfg(wgEdit);
  if (b.dataset.tm != null) { wgTimeOpen = wgTimeOpen === n ? null : n; wgRender(); return; }
  if (b.dataset.mv) {
    const order = wgOrder(wgEdit), i = order.indexOf(n), j = i + Number(b.dataset.mv);
    [order[i], order[j]] = [order[j], order[i]];
    cfg.order = order;
  } else if (b.classList.contains('wg-tog')) cfg.off = cfg.off.includes(n) ? cfg.off.filter(x => x !== n) : [...cfg.off, n];
  else if (b.classList.contains('wg-set')) S.wgTime[n] = [7, 9];
  else if (b.classList.contains('wg-always')) delete S.wgTime[n];
  else if (b.dataset.th) {   // 1시간씩, 0~23시 돌아감. 시작과 끝이 같아지면 한 칸 더
    const t = S.wgTime[n], k = +b.dataset.th, d = Number(b.dataset.step);
    t[k] = (t[k] + d + 24) % 24;
    if (t[0] === t[1]) t[k] = (t[k] + d + 24) % 24;
  } else return;
  saveSettings();
  applySettings();
});

// 개인정보처리방침: 앱 안에 겹쳐 열기 (설치한 앱·키오스크에서 새 창으로 열면 앱을 떠나거나 닫을 곳이 없음)
// 그 페이지의 닫기(✕)가 알려 오면 닫음
document.querySelector('.set-policy').addEventListener('click', e => {
  e.preventDefault();
  const f = $('policy').querySelector('iframe');
  if (!f.getAttribute('src')) f.src = 'privacy.html';
  $('policy').hidden = false;
});
window.addEventListener('message', e => {
  if (e.origin === location.origin && e.data === 'privacy-close') $('policy').hidden = true;
});
