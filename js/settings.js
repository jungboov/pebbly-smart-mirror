// Pebbly Mirror — 설정 화면: 열기·버튼, 위젯 탭
// ===== 설정 화면 =====
let settingsAt = 0;
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
  if (b && b.dataset.tab) { b.closest('.set-card').dataset.tab = b.dataset.tab; return; }
  if (b && b.classList.contains('set-sync')) { b.closest('.set-card').dataset.tab = 'sync'; syncOpen(); return; }
  if (b && b.id === 'sync-off') { syncOff(); return; }
  if (b && b.id === 'remote-apply') { remoteApply(); return; }
  if (b && b.id === 'remote-open') { b.closest('.set-card').dataset.tab = 'remotes'; renderRemotes(); return; }
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
  else {
    if (e.target === $('settings') || (b && b.classList.contains('set-close'))) $('settings').hidden = true;
    return;
  }
  saveSettings();
  applySettings();
});

// 위젯 탭: 가로·세로 중 고치는 쪽(설정을 열면 지금 화면 방향) / 순서대로 이름 / 보이는 시간·위로·아래로 / 켜짐·꺼짐. 모두 끄면 시계만
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
    const note = [ready ? '' : n === 'transit' ? '교통 탭에서 정류장을 등록하면 나와요' : '사진 탭에서 사진을 올리면 나와요',
      t ? `${hourName(t[0])}~${hourName(t[1])}에만` : ''].filter(Boolean).map(x => `<small>${x}</small>`).join('');
    const edit = !open ? '' : '<div class="wg-time">' + (t
      ? [0, 1].map(k => `<button data-th="${k}" data-step="-1" aria-label="${k ? '끝' : '시작'} 1시간 앞당기기">−</button><b>${hourName(t[k])}</b>`
        + `<button data-th="${k}" data-step="1" aria-label="${k ? '끝' : '시작'} 1시간 늦추기">+</button>`).join('<i>~</i>') + '<button class="wg-always">항상</button>'
      : '<em>항상 보여요</em><button class="wg-set">시간 정하기</button>') + '</div>';
    return `<li data-wg="${n}" class="${ready ? '' : 'wait'}"><span>${WG_NAMES[n]}${note}</span>`
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
