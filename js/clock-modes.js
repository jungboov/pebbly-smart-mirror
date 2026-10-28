// Pebbly Mirror — 스톱워치·타이머·알람, 울림
// ===== 시계 쪽 기능: 시계 → 스톱워치 → 타이머 → 알람 (시계 강조 화면에서 시계 쪽을 밀어서 넘김) =====
// 화면(앱)이 켜져 있어야 울림. 스톱워치·타이머는 새로고침하면 초기화, 알람 시각은 설정에 저장
const CM = ['clock', 'sw', 'tm', 'al'];
let cm = 0, cmAt = 0;
const CM_VIEWS = ['clock-in', 'cm-sw', 'cm-tm', 'cm-al'];
function showCm(i, dir, axis) {
  const old = cm;
  cm = (i + CM.length) % CM.length;
  document.body.dataset.cm = CM[cm];
  cmAt = Date.now();
  if (dir && old !== cm) slide($(CM_VIEWS[old]), $(CM_VIEWS[cm]), dir, axis);
  renderCm();
}
function renderCm() {
  if (CM[cm] === 'sw') { renderSw(); requestAnimationFrame(swLoop); }
  else if (CM[cm] === 'tm') renderTm();
  else if (CM[cm] === 'al') renderAl();
}
// 숫자마다 고정 폭 칸에 넣어서 빨리 바뀌어도 흔들리지 않게
const digits = (el, s) => { const h = [...s].map(c => `<i>${c}</i>`).join(''); if (el.innerHTML !== h) el.innerHTML = h; };

// 스톱워치: 분 / 초 / 1/100초
const sw = { from: 0, acc: 0, run: false };
const swTime = () => sw.acc + (sw.run ? performance.now() - sw.from : 0);
function renderSw() {
  const t = swTime();
  digits($('sw-m'), pad(Math.floor(t / 6e4)));
  digits($('sw-s'), pad(Math.floor(t / 1e3) % 60));
  digits($('sw-cs'), pad(Math.floor(t / 10) % 100));
  $('sw-go').textContent = sw.run ? '정지' : t ? '계속' : '시작';
  $('sw-go').classList.toggle('on', sw.run);
}
function swLoop() { if (sw.run && CM[cm] === 'sw') { renderSw(); requestAnimationFrame(swLoop); } }

// 타이머: 분·초를 +/−로 맞추고 시작. 끝나면 울림
const tm = { set: 300, left: 300, end: 0, run: false };   // 초
const tmLeft = () => tm.run ? Math.max(0, (tm.end - Date.now()) / 1e3) : tm.left;
function renderTm() {
  const t = Math.ceil(tmLeft());
  digits($('tm-m'), pad(Math.floor(t / 60)));
  digits($('tm-s'), pad(t % 60));
  $('tm-go').textContent = tm.run ? '정지' : tm.left < tm.set ? '계속' : '시작';
  $('tm-go').classList.toggle('on', tm.run);
}
setInterval(() => {
  if (!tm.run) return;
  if (tmLeft() <= 0) { tm.run = false; tm.left = tm.set; ring('타이머 끝'); }
  if (CM[cm] === 'tm') renderTm();
}, 250);

// 알람: 여러 개(최대 4개). 아래 칩으로 고르고 +로 추가, 고른 알람의 시·분을 +/−로 맞추고 켜기·반복·삭제 (24시간 기준, 설정에 저장)
// 반복: 매일 / 평일(월~금, 공휴일 빼고) / 주말(토·일)
const AL_DAYS = { all: '매일', wk: '평일', we: '주말' };
let alSel = 0;
const alNow = () => S.alarms[Math.min(alSel, S.alarms.length - 1)];
function renderAl() {
  const a = alNow();
  digits($('al-h'), pad(a.h));
  digits($('al-m'), pad(a.m));
  $('al-go').textContent = a.on ? '켜짐' : '꺼짐';
  $('al-go').classList.toggle('on', a.on);
  $('al-days').textContent = AL_DAYS[a.days];
  $('al-del').hidden = S.alarms.length < 2;
  $('al-list').innerHTML = S.alarms.map((x, i) => `<button data-al-sel="${i}" class="${x === a ? 'sel' : ''}${x.on ? '' : ' off'}">${pad(x.h)}:${pad(x.m)}</button>`).join('')
    + (S.alarms.length < 4 ? '<button data-al="add" aria-label="알람 추가">+</button>' : '');
}
function alarmToday(a, d) {
  const wd = d.getDay(), weekend = wd === 0 || wd === 6;
  return a.days === 'all' || (a.days === 'we' ? weekend : !weekend && !holidayName(ymd(d)));
}
function checkAlarm(d) {
  if (d.getSeconds() !== 0) return;
  const a = S.alarms.find(x => x.on && x.h === d.getHours() && x.m === d.getMinutes() && alarmToday(x, d));
  if (a) ring(`알람 ${pad(a.h)}:${pad(a.m)}`);
}

// 버튼: +/−는 누르고 있으면 빠르게 반복, 나머지는 한 번
function cmStep(b) {
  const d = b.dataset;
  if (d.tm && !isNaN(d.tm) && !tm.run) {
    tm.set = Math.min(99 * 60 + 59, Math.max(10, tm.set + Number(d.tm)));
    tm.left = tm.set;
    renderTm();
  } else if (d.al && !isNaN(d.al)) {
    const a = alNow(), t = ((a.h * 60 + a.m + Number(d.al)) % 1440 + 1440) % 1440;
    a.h = Math.floor(t / 60); a.m = t % 60;
    saveSettings(); renderAl();
  }
}
let holdTimer;
$('clock').addEventListener('pointerdown', e => {
  const b = e.target.closest('.cm-pm button');
  if (!b) return;
  unlockSound();
  cmAt = Date.now();
  cmStep(b);
  holdTimer = setTimeout(function again() { cmStep(b); holdTimer = setTimeout(again, 90); }, 450);
});
document.addEventListener('pointerup', () => clearTimeout(holdTimer));
document.addEventListener('pointercancel', () => clearTimeout(holdTimer));
$('clock').addEventListener('click', e => {
  const b = e.target.closest('.cm-ctl button, .al-list button');
  if (!b) return;
  unlockSound();
  cmAt = Date.now();
  const d = b.dataset;
  if (d.sw === 'go') {
    if (sw.run) { sw.acc = swTime(); sw.run = false; } else { sw.from = performance.now(); sw.run = true; }
  } else if (d.sw === 'reset') { sw.run = false; sw.acc = 0; }
  else if (d.tm === 'go') {
    if (tm.run) { tm.left = tmLeft(); tm.run = false; } else { tm.end = Date.now() + tm.left * 1e3; tm.run = true; }
  } else if (d.tm === 'reset') { tm.run = false; tm.left = tm.set; }
  else if (d.alSel) alSel = Number(d.alSel);
  else if (d.al === 'toggle') { alNow().on = !alNow().on; saveSettings(); }
  else if (d.al === 'days') { const a = alNow(), k = Object.keys(AL_DAYS); a.days = k[(k.indexOf(a.days) + 1) % k.length]; saveSettings(); }
  else if (d.al === 'add') { const a = alNow(); S.alarms.push({ on: true, h: a.h, m: a.m, days: 'all' }); alSel = S.alarms.length - 1; saveSettings(); }
  else if (d.al === 'del' && S.alarms.length > 1) { S.alarms.splice(alSel, 1); alSel = Math.max(0, alSel - 1); saveSettings(); }
  renderCm();
});

// 울림: 소리(삐삐삐)·진동을 1.5초마다, 3분 동안. 아무 데나 누르면 끔
// 브라우저는 사람이 화면을 한 번 누른 뒤에만 소리를 내게 해서, 버튼을 누를 때 소리를 미리 켜 둠
let actx = null, ringTimer = null;
function unlockSound() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {}
}
function beep() {
  if (!actx) return;
  const t = actx.currentTime;
  [0, .22, .44].forEach(k => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(.0001, t + k);
    g.gain.exponentialRampToValueAtTime(.35, t + k + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + k + .18);
    o.connect(g).connect(actx.destination);
    o.start(t + k); o.stop(t + k + .2);
  });
}
function ring(title) {
  $('ring-title').textContent = title;
  $('ring').hidden = false;
  const until = Date.now() + 180e3;
  clearInterval(ringTimer);
  const once = () => {
    if (Date.now() > until) return stopRing();
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  };
  once();
  ringTimer = setInterval(once, 1500);
}
function stopRing() { clearInterval(ringTimer); $('ring').hidden = true; }
$('ring').addEventListener('click', stopRing);

// 시계가 아닌 화면에서 3분 동안 아무것도 안 하면(돌아가는 게 없으면) 시계로 돌아감
function cmIdleCheck() {
  if (cm && !sw.run && !tm.run && Date.now() - cmAt > 180e3) showCm(0);
}
