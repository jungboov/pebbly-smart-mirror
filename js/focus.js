// Pebbly Mirror — 집중 타이머 위젯
// ===== 집중 타이머: 집중 25분 · 휴식 5분을 되풀이, 4번째 집중 뒤엔 긴 휴식 (시계 강조 화면 위젯) =====
// 설정 S.fo: { min 집중(분), rest 휴식(분), long 긴 휴식(분, 0이면 없음), every 몇 번째마다 긴 휴식, auto 끝나면 다음을 바로 시작, pin 도는 동안 이 위젯에 머묾 }
// 진행 S.foRun: null 쉬는 중 · { ph: 'focus' 집중 · 'rest' 휴식 · 'long' 긴 휴식, n: 몇 번째 집중(1~every), end: 끝나는 시각(ms, 도는 중), left: 남은 초(멈춤, end 0) }
//   진행도 설정에 넣어서 폰(설정 › 위젯 › 집중 타이머)에서 시작·멈춤 — 미러는 10초마다 받아서 늦어도 10초 안에 반영되고,
//   끝나는 시각을 같이 보내서 남은 시간은 정확히 맞음. 단계가 끝나 다음으로 넘기는 건 미러만 (폰은 보기만)
// 오늘 집중한 분 S.foLog: { day, min } — 집중을 끝까지 했을 때, 건너뛰면 한 만큼
// 끝나면 알람과 같은 울림(소리·진동·깜빡임). 소리는 미러를 한 번이라도 누른 뒤에만 남(브라우저 규칙)
// 위젯 탭에서 꺼 둬도 타이머가 도는(멈춘) 동안은 위젯이 나옴. 폰에서 시작하면 미러가 이 위젯으로 넘어감
// 테마: 평면 · 라이트 양각 · 라이트 음각 · 다크 양각 · 다크 음각 (plate.js, S.plate — 설정 › 위젯 › 모양)
const FO_DEF = { min: 25, rest: 5, long: 15, every: 4, auto: true, pin: true };
const FO_PH = { focus: '집중', rest: '휴식', long: '긴 휴식' };
S.fo = { ...FO_DEF, ...S.fo };
const foDur = ph => (ph === 'focus' ? S.fo.min : ph === 'long' ? S.fo.long : S.fo.rest) * 60;
const foLeft = (r = S.foRun) => !r ? foDur('focus') : r.end ? Math.max(0, (r.end - Date.now()) / 1e3) : r.left;
const foOn = () => !!(S.foRun && S.foRun.end);
// 다음 단계: 집중 → 휴식(every번째면 긴 휴식) → 다음 집중
const foNext = r => r.ph === 'focus' ? { ph: S.fo.long && r.n % S.fo.every === 0 ? 'long' : 'rest', n: r.n } : { ph: 'focus', n: r.n % S.fo.every + 1 };
const foToday = () => S.foLog && S.foLog.day === ymd(new Date()) ? S.foLog.min : 0;
function foAddMin(m) {
  const day = ymd(new Date());
  if (!S.foLog || S.foLog.day !== day) S.foLog = { day, min: 0 };
  S.foLog.min += m;
}
// 버튼: 시작·정지·계속 / 건너뛰기 / 초기화 (미러 위젯, 설정 › 위젯 › 집중 타이머 — 폰이면 바로 미러로 보냄)
function foAct(a) {
  unlockSound();
  const r = S.foRun, now = Date.now();
  if (a === 'go') S.foRun = !r ? { ph: 'focus', n: 1, end: now + foDur('focus') * 1e3 } : r.end ? { ...r, end: 0, left: Math.ceil(foLeft(r)) } : { ...r, end: now + r.left * 1e3 };
  else if (a === 'skip' && r) {
    if (r.ph === 'focus') foAddMin(Math.floor((foDur('focus') - foLeft(r)) / 60));
    const nx = foNext(r);
    S.foRun = r.end ? { ...nx, end: now + foDur(nx.ph) * 1e3 } : { ...nx, end: 0, left: foDur(nx.ph) };
  } else if (a === 'reset') S.foRun = null;
  else return;
  saveSettings();
  if (REMOTE) remoteApply();
  applySettings();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-fo]'); if (b) foAct(b.dataset.fo); });
// 단계가 끝남: 다음 단계로(끝나면 바로 시작이면 이어서, 아니면 멈춘 채로) + 울림. 화면이 꺼져 있던 동안 여러 단계가 지났으면 이어서 셈
function foDone() {
  const first = S.foRun;
  let r = first;
  for (;;) {
    if (r.ph === 'focus') foAddMin(S.fo.min);
    const nx = foNext(r);
    if (!S.fo.auto) { r = { ...nx, end: 0, left: foDur(nx.ph) }; break; }
    r = { ...nx, end: r.end + foDur(nx.ph) * 1e3 };
    if (r.end > Date.now()) break;
  }
  S.foRun = r;
  ring(`${FO_PH[first.ph]} 끝 · ${FO_PH[r.ph]} ${foDur(r.ph) / 60}분${S.fo.auto ? '' : ' (누르면 시작)'}`);
  saveSettings();
  applySettings();
}
setInterval(() => {
  const r = S.foRun;
  if (!REMOTE && r && r.end && Date.now() >= r.end) foDone();
  foRender();
  if (!$('settings').hidden) foSetState();
}, 500);

// 지금 보일 것
function foState() {
  const r = S.foRun, ph = r ? r.ph : 'focus', n = r ? r.n : 1, dur = foDur(ph), left = Math.ceil(foLeft()), run = foOn();
  const end = new Date(Date.now() + left * 1e3), nx = foNext({ ph, n });
  return { ph, n, dur, left, run, frac: dur ? left / dur : 0,
    mmss: `${pad(Math.floor(left / 60))}:${pad(left % 60)}`,
    go: run ? '정지' : r ? '계속' : '시작',
    endTxt: run ? `${pad(end.getHours())}:${pad(end.getMinutes())}에 끝` : r ? '멈춤' : '누르면 시작',
    next: `${FO_PH[nx.ph]} ${foDur(nx.ph) / 60}분`,
    // 회차 점: 끝낸 집중 / 지금 집중(진행만큼 채움) / 남은 집중
    done: ph === 'focus' ? n - 1 : n };
}

// 양각 판 자리: 세로로 긴 판(가로 화면)은 위에 원판, 아래 회차·버튼·안내 / 가로로 긴 판(세로 화면)은 왼쪽 원판, 오른쪽에 나머지
// [ start ] [ skip ] [ reset ] 글자 버튼 자리: 글자 길이대로, 칸이 넉넉하면 양 끝까지 고르게 벌리고 좁으면 글자를 줄임
// 글자는 로고 글꼴 영어(start·pause·resume 중 가장 긴 6자 / skip / reset) — 한 글자 약 .6em, 괄호와 빈칸 1.1em
// col: 좁은 오른쪽 칸(가로로 긴 판)이면 한 줄에 하나씩 위아래로 쌓아 글자를 키움
function foKeys(x, y, avail, fs0, col) {
  const em = [6, 4, 5].map(n => 1.1 + .6 * n);
  if (col) { const fs = Math.min(fs0, avail / em[0]); return { fs, keys: em.map((e, i) => ({ x, y: y + i * fs * 2.4, w: e * fs, h: fs * 2.4 })) }; }
  const need = em.reduce((a, b) => a + b) + 1.6, fs = Math.min(fs0, avail / need);
  const gap = Math.max(.8 * fs, (avail - (need - 1.6) * fs) / 2);
  let xx = x;
  return { fs, keys: em.map(e => { const k = { x: xx, y, w: e * fs, h: fs * 2.4 }; xx += e * fs + gap; return k; }) };
}
function foLay(W, H) {
  if (plTall(W, H)) {
    const r = Math.min(W / 2 - 34, (H - 178) / 2), cy = 48 + r, y1 = cy + r + 26;
    return { tall: true, label: [20, 28], dial: [W / 2, cy, r], dots: [26, y1, 20, 5.5], ...foKeys(20, y1 + 17, W - 60, 12) };
  }
  const wr = Math.max(150, W * .42), r = Math.min((H - 36) / 2, (W - wr - 44) / 2), cx = 20 + r, x0 = cx + r + 24;   // 오른쪽 칸(버튼·안내) 자리를 먼저 남김
  // 버튼은 회차 점과 아래 안내 세 줄 사이에 위아래로 쌓을 수 있으면 쌓고(글자 9 이상), 낮은 판이면 한 줄로
  const fsCol = Math.min(12, (W - 40 - x0) / 4.7, (H - 66 - 74) / 7.2);
  return { tall: false, label: [x0, 30], dial: [cx, H / 2, r], dots: [x0 + 6, 54, 18, 5], x0, ...(fsCol >= 9 ? foKeys(x0, 74, W - 40 - x0, fsCol, true) : foKeys(x0, H / 2 - 10, W - 40 - x0, 11)) };
}
function foPlate(W, H, st) {
  const L = foLay(W, H), [cx, cy, r] = L.dial;
  return plateSvg(W, H, S.plate, 'fo-', k => {
    let o = k.ink(plText(L.label[0], L.label[1], 11, `focus · ${st.n}/${S.fo.every}`, 500)) + k.up(plBrackets(W, H));
    // 원판: 파낸 홈 위에 남은 만큼 솟은 호(12시부터 시계 방향), 분 눈금 인쇄, 가운데 단계·남은 시간·끝 시각
    const a = 2 * Math.PI * Math.min(st.frac, .9999), ex = cx + r * Math.sin(a), ey = cy - r * Math.cos(a), ticks = Math.min(60, st.dur / 60);
    o += k.sink(c => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${r * .11}"/>`);
    if (st.frac > 0) o += k.up(c => `<path d="M${cx} ${cy - r}A${r} ${r} 0 ${st.frac > .5 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}" fill="none" stroke="${c}" stroke-width="${r * .07}" stroke-linecap="round"/>`, .9);
    o += k.print(c => Array.from({ length: ticks }, (_, i) => { const t = i / ticks * 2 * Math.PI, s = Math.sin(t), q = Math.cos(t);
      return `<line x1="${(cx + r * .8 * s).toFixed(2)}" y1="${(cy - r * .8 * q).toFixed(2)}" x2="${(cx + r * .86 * s).toFixed(2)}" y2="${(cy - r * .86 * q).toFixed(2)}" stroke="${c}" stroke-width=".8"/>`; }).join(''));
    o += k.ink(plText(cx, cy - r * .3, r * .15, FO_PH[st.ph], 700, 'middle')) + k.up(plText(cx, cy + r * .17, r * .44, st.mmss, 600, 'middle'));
    o += k.ink(plText(cx, cy + r * .45, r * .11, st.endTxt, 600, 'middle'));
    // 회차 점: 끝낸 건 솟고, 지금 것은 솟은 점 가운데에 인쇄 점, 남은 건 파냄
    const [dx, dy, gap, dr] = L.dots;
    for (let i = 0; i < S.fo.every; i++) {
      const c = cc => `<circle cx="${dx + i * gap}" cy="${dy}" r="${dr}" fill="${cc}"/>`;
      o += i < st.done ? k.up(c, .7) : i === st.done && st.ph === 'focus' ? k.up(c, 1) + k.print(cc => `<circle cx="${dx + i * gap}" cy="${dy}" r="${dr * .45}" fill="${cc}"/>`) : k.sink(c);
    }
    // 버튼: 로고 [ 03 ]처럼 대괄호로 감싼 로고 글꼴 영어 [ start ] [ skip ] [ reset ] — 판에서 낮게 솟음 (도는지는 글자 start·pause·resume으로)
    // 누르는 건 위에 겹친 투명 버튼(foBuild, 자리는 L.keys 그대로)
    L.keys.forEach((b, i) => {
      const lab = [{ 시작: 'start', 정지: 'pause', 계속: 'resume' }[st.go], 'skip', 'reset'][i];
      const t = c => `<text x="${(L.tall ? b.x + b.w / 2 : b.x).toFixed(1)}" y="${(b.y + b.h / 2 + L.fs * .36).toFixed(1)}" font-size="${L.fs}" fill="${c}" text-anchor="${L.tall ? 'middle' : 'start'}" xml:space="preserve" style="font-family:var(--logo);font-weight:600">[ ${lab} ]</text>`;
      o += k.up(t, .6) + k.ink(t);   // 솟은 글자 윗면을 진한 인쇄 색으로 — 흰 판에서도 작은 글자가 읽힘
    });
    const plan = `집중 ${S.fo.min} · 휴식 ${S.fo.rest}`;
    if (L.tall) o += k.ink(plText(W - 40, dy + 4, 10, plan, 600, 'end')) + k.ink(plText(20, H - 18, 10.5, `다음 ${st.next}`, 600)) + k.ink(plText(W - 40, H - 18, 10.5, `오늘 집중 ${foToday()}분`, 600, 'end'));
    else o += k.ink(plText(L.x0, H - 56, 10, `다음 ${st.next}`, 600)) + k.ink(plText(L.x0, H - 40, 10, plan, 600)) + k.ink(plText(L.x0, H - 24, 10, `오늘 집중 ${foToday()}분`, 600));
    return o;
  });
}

// 위젯 틀: 테마·화면 크기가 바뀔 때만 새로 만들고(누르는 중인 버튼이 사라지지 않게), 매초는 바뀐 글자·호만
let foKey = '', foShown = '';
function foBuild() {
  const el = $('focus'), [W, H] = plSize(el);
  if (!S.focus || !W) { el.innerHTML = ''; foKey = ''; return; }
  const key = [S.plate, W, H].join();
  if (key !== foKey) {
    foKey = key;
    el.classList.toggle('pl-on', !plFlat());
    if (plFlat()) el.innerHTML = `<div class="lbl f-lbl">focus<span class="fo-n cd-dim"></span></div>`
      + `<div class="fo-wrap"><div class="fo-dial"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" class="fo-track"/><g class="fo-ticks"></g>`
      + `<circle cx="50" cy="50" r="46" class="fo-arc" transform="rotate(-90 50 50)"/></svg><div class="fo-in"><span class="fo-ph"></span><b class="fo-t"></b><span class="fo-end"></span></div></div>`
      + `<div class="fo-side"><div class="fo-cyc"><span class="fo-dots"></span><span class="fo-plan"></span></div>`
      + `<div class="fo-ctl"><button data-fo="go"></button><button data-fo="skip">건너뛰기</button><button data-fo="reset">초기화</button></div>`
      + `<div class="fo-foot"><span>다음</span><b class="fo-nx"></b><em>오늘 집중 <b class="fo-today"></b>분</em></div></div></div>`;
    else el.innerHTML = `<div class="pl-box"></div><div class="fo-hit">` + foLay(W, H).keys.map((b, i) =>
      `<button data-fo="${['go', 'skip', 'reset'][i]}" aria-label="${['시작·정지', '건너뛰기', '초기화'][i]}" style="left:${b.x / W * 100}%;top:${b.y / H * 100}%;width:${b.w / W * 100}%;height:${b.h / H * 100}%"></button>`).join('') + '</div>';
  }
  foRender(true);
}
let foTicks = 0;
function foRender(force) {
  const el = $('focus');
  if (!foKey || (!force && (panelName !== 'focus' || document.hidden))) return;
  const st = foState(), sig = [st.ph, st.n, st.left, st.run, !!S.foRun, foToday(), S.fo.min, S.fo.rest, S.fo.long].join();
  if (!force && sig === foShown) return;
  foShown = sig;
  if (!plFlat()) { const [W, H] = plSize(el); el.querySelector('.pl-box').innerHTML = foPlate(W, H, st); return; }
  const q = s => el.querySelector(s), C = 2 * Math.PI * 46;
  q('.fo-n').textContent = ` · ${st.n}/${S.fo.every}회`;
  q('.fo-ph').textContent = FO_PH[st.ph];
  q('.fo-t').innerHTML = [...st.mmss].map(c => `<i${c === ':' ? ' class="c"' : ''}>${c}</i>`).join('');
  q('.fo-end').textContent = st.endTxt;
  q('.fo-arc').setAttribute('stroke-dasharray', `${(C * st.frac).toFixed(2)} ${C.toFixed(2)}`);
  const n = Math.min(60, st.dur / 60);
  if (n !== foTicks) {   // 분 눈금: 이 단계 길이만큼
    foTicks = n;
    q('.fo-ticks').innerHTML = Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI;
      return `<line class="fo-tick" x1="${(50 + 41 * Math.sin(a)).toFixed(2)}" y1="${(50 - 41 * Math.cos(a)).toFixed(2)}" x2="${(50 + 39 * Math.sin(a)).toFixed(2)}" y2="${(50 - 39 * Math.cos(a)).toFixed(2)}"/>`; }).join('');
  }
  const p = st.ph === 'focus' ? Math.round((1 - st.frac) * 100) : 0;
  q('.fo-dots').innerHTML = Array.from({ length: S.fo.every }, (_, i) => `<i class="${i < st.done ? 'done' : i === st.done && st.ph === 'focus' ? 'now' : ''}"${i === st.done && st.ph === 'focus' ? ` style="--p:${p}%"` : ''}></i>`).join('');
  q('.fo-plan').textContent = `집중 ${S.fo.min}분 · 휴식 ${S.fo.rest}분`;
  const go = q('[data-fo="go"]');
  go.textContent = st.go; go.classList.toggle('on', st.run);
  q('.fo-nx').textContent = st.next;
  q('.fo-today').textContent = foToday();
}

// 설정이 바뀌면(applySettings): 빠진 값 채우기, 폰에서 시작했으면 이 위젯으로, 설정 화면 글자
let foWas = false;
function foApply() {
  S.fo = { ...FO_DEF, ...S.fo };
  const on = foOn();
  if (on && !foWas && !REMOTE && S.focus && panelName !== 'focus') setTimeout(() => { const i = panelList().indexOf('focus'); if (i >= 0) showPanel(i, 1, innerWidth > innerHeight ? 'y' : 'x'); });
  foWas = on;
  foSetRender();
}

// ===== 설정 › 위젯 › 집중 타이머: 지금 상태 + 시작·건너뛰기·초기화 / 집중·휴식·긴 휴식 길이 / 끝나면 / 도는 동안 =====
const FO_LIM = { min: [5, 90, 5], rest: [1, 30, 1], long: [0, 60, 5] };   // [가장 짧게, 가장 길게, 한 번에]
function foSetRender() {
  $('fs-min').textContent = S.fo.min + '분';
  $('fs-rest').textContent = S.fo.rest + '분';
  $('fs-long').textContent = S.fo.long ? S.fo.long + '분' : '없음';
  document.querySelectorAll('[data-fb]').forEach(b => b.classList.toggle('on', String(+S.fo[b.dataset.fb]) === b.dataset.fv));
  foSetState();
}
function foSetState() {
  const st = foState();
  $('fo-state').textContent = S.foRun ? `${FO_PH[st.ph]} ${st.n}/${S.fo.every} · ${st.mmss} ${st.run ? '남음' : '멈춤'}` : '쉬는 중';
  $('fo-set-go').textContent = st.go;
  $('fo-set-go').classList.toggle('on', st.run);
}
document.querySelector('[data-page="focus"]').addEventListener('click', e => {
  const b = e.target.closest('[data-fs], [data-fb]');
  if (!b) return;
  if (b.dataset.fs) { const k = b.dataset.fs, [lo, hi, d] = FO_LIM[k]; S.fo[k] = Math.min(hi, Math.max(lo, S.fo[k] + d * Number(b.dataset.fv))); }
  else S.fo[b.dataset.fb] = b.dataset.fv === '1';
  saveSettings();
  applySettings();
});
