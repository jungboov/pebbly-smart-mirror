// Pebbly Mirror — 디데이 위젯
// ===== 디데이: '만난 지 412일'·'출시까지 D-12' (시계 강조 화면 위젯) =====
// 항목은 설정 › 위젯 › 디데이에서 등록 — S.counts: [{ name, date: 'YYYY-MM-DD', mode: 'since' 지난 날 세기 · 'until' 남은 날 세기, first: 첫날을 1일로, yearly: 매년 }]
// 첫 항목을 크게, 아래(세로 화면은 오른쪽)에 다음 기념일(100일 단위·n주년 중 가까운 것)과 나머지 항목을 3줄까지.
// 다 안 들어가면 위젯이 나올 때마다 크게 보이는 항목이 차례로 바뀜
// 큰 숫자는 릴: 어제·내일 값이 위아래로 반쯤 비치고, 위젯이 나타날 때와 자정에 한 칸 굴러 오늘 값에 멈춤 (움직임 줄이기를 켠 기기는 안 구름)
// 테마: 평면 · 양각 · 양각 블랙 (plate.js, S.plate)
const cdParse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const cdDays = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const cdAdd = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const cdFmt = d => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
const cdFmtS = d => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${WEEK[d.getDay()]}`;
// 남은 날을 셀 날짜: 매년이면 오늘 이후(오늘 포함) 가장 가까운 그 날
function cdTarget(it, d) {
  const t = cdParse(it.date);
  if (!it.yearly) return t;
  const y = new Date(d.getFullYear(), t.getMonth(), t.getDate());
  return cdDays(d, y) < 0 ? new Date(d.getFullYear() + 1, t.getMonth(), t.getDate()) : y;
}
// 그날(d)의 값: 지난 날 '412'+'일' / 남은 날 'D-12'·'D-DAY'·'D+3' (지난 날 세기인데 아직 그날 전이면 남은 날처럼)
function cdVal(it, d) {
  if (it.mode === 'since') {
    const n = cdDays(cdParse(it.date), d) + (it.first ? 1 : 0);
    if (n >= (it.first ? 1 : 0)) return { num: String(n), unit: '일' };
  }
  const n = cdDays(d, it.mode === 'since' ? cdParse(it.date) : cdTarget(it, d));
  return { num: n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n, unit: '' };
}
// 지난 날 세기의 다음 기념: 100일 단위와 n주년 중 가까운 것
function cdNext(it, d) {
  const s = cdParse(it.date), f = it.first ? 1 : 0, n = cdDays(s, d) + f;
  if (n < f) return null;
  const k = Math.ceil((n + 1) / 100) * 100, dk = cdAdd(s, k - f);
  let y = d.getFullYear() - s.getFullYear(), an = new Date(s.getFullYear() + y, s.getMonth(), s.getDate());
  if (cdDays(d, an) <= 0) an = new Date(s.getFullYear() + ++y, s.getMonth(), s.getDate());
  return cdDays(d, dk) <= cdDays(d, an) ? { what: k + '일', at: dk } : { what: y + '주년', at: an };
}
const cdSub = (it, d) => it.mode === 'since' ? cdFmtS(cdParse(it.date)) + '부터' : cdFmtS(cdTarget(it, d)) + (it.yearly ? ' · 매년' : '');
// 크게 보일 항목과 아래 줄들(다음 기념 + 나머지, 3줄까지)
let cdStart = 0;
function cdShown(d) {
  const all = S.counts, n = all.length;
  if (!n) return null;
  if (cdStart >= n) cdStart = 0;
  const main = all[cdStart], nx = main.mode === 'since' ? cdNext(main, d) : null, rows = [];
  if (nx) rows.push({ name: nx.what + '까지', sub: cdFmtS(nx.at), num: 'D-' + cdDays(d, nx.at), ms: true });
  for (let i = 1; i < n && rows.length < 3; i++) {
    const it = all[(cdStart + i) % n], v = cdVal(it, d);
    rows.push({ name: esc(it.name), sub: cdSub(it, d), num: v.num, unit: v.unit });
  }
  return { main, rows, more: n > rows.length - (nx ? 1 : 0) + 1 };
}
// 위젯이 나타날 때: 항목이 다 안 들어가면 두 번째부터는 다음 항목을 크게, 숫자 릴은 어제 값에서 한 칸 굴러 옴
let cdVisited = false;
function cdEnter() {
  const s = cdShown(new Date());
  if (s && s.more && cdVisited) cdStart = (cdStart + 1) % S.counts.length;
  cdVisited = true;
  cdRender(true);
}

// ── 평면 ──
// 릴 띠: [어제, 오늘, 내일, 모레] — --p 1이 오늘 가운데. 구를 땐 0(어제)에서 1로
function cdFlat(el, d, s, roll) {
  const v = cdVal(s.main, d), at = i => cdVal(s.main, cdAdd(d, i)).num;
  el.innerHTML = `<div class="lbl f-lbl">d-day<span class="cd-dim"> · ${S.counts.length}개</span></div>`
    + `<div class="cd-wrap"><div class="cd-main"><div class="cd-name">${esc(s.main.name)}</div>`
    + `<div class="cd-big"><span class="cd-reel"><span class="cd-strip" style="--p:${roll ? 0 : 1}">${[-1, 0, 1, 2].map(i => `<span>${at(i)}</span>`).join('')}</span></span>${v.unit ? `<em>${v.unit}</em>` : ''}</div>`
    + `<div class="cd-sub">${s.main.mode === 'since' ? cdFmt(cdParse(s.main.date)) + '부터' : cdFmt(cdTarget(s.main, d)) + (s.main.yearly ? ' · 매년' : '')}</div></div>`
    + `<div class="cd-side"><ul class="cd-list">${s.rows.map(r => `<li class="${r.ms ? 'ms' : ''}"><span>${r.name}<small>${r.sub}</small></span><b>${r.num}${r.unit ? `<small>${r.unit}</small>` : ''}</b></li>`).join('')}</ul></div></div>`;
  if (roll) { const st = el.querySelector('.cd-strip'); st.getBoundingClientRect(); st.style.setProperty('--p', 1); }
}

// ── 양각 ──
// 숫자 릴(p: 0 오늘이 가운데, -1 어제가 가운데): 가운데에서 멀수록 작고 낮게, 창(위아래 막대 사이) 밖은 잘림 — 로고 릴과 같은 모양
function cdReelSvg(k, x, cy, size, it, d, p) {
  const step = size * .61, f = i => { const v = cdVal(it, cdAdd(d, i)); return v.num + (v.unit ? `<tspan font-size="${(size * .3).toFixed(1)}" dx="${(size * .06).toFixed(1)}" style="font-weight:700">${v.unit}</tspan>` : ''); };
  let s = '';
  for (let i = Math.floor(p) - 1; i <= Math.ceil(p) + 1; i++) {
    const dd = i - p, near = Math.max(0, 1 - Math.abs(dd)), sz = size * (.62 + .38 * near);
    s += k.up(plText(x, cy + dd * step + sz * .36, sz, f(i), near > .5 ? 600 : 500, 'middle'), .25 + .75 * near);
  }
  return s;
}
let cdLay = null;   // 양각 판의 릴 자리 { x, cy, size } — 구르는 동안 릴만 다시 그림
function cdEmboss(el, d, s, roll) {
  const [W, H] = plSize(el), m0 = s.main, tall = plTall(W, H);
  if (!W) return;
  let reelAt;
  el.innerHTML = plateSvg(W, H, S.plate, 'cd-', k => {
    let o = k.ink(plText(20, 28, 11, `d-day · ${S.counts.length}`, 500)) + k.up(plBrackets(W, H));
    const row = (r, x, y, xr, fs, fn) => k.up(plText(x, y, fs, r.name, 700), r.ms ? .35 : .5)
      + k.up(plText(xr, y + fs * .1, fn, r.num + (r.unit ? `<tspan font-size="${fn / 2}" dx="2" style="font-weight:700">${r.unit}</tspan>` : ''), 600, 'end'), r.ms ? .45 : .85);
    let x, cy, size, x0, x1;
    if (tall) {   // 가로 화면 칸(세로로 긴 판): 이름 / 숫자 창 / 날짜 / 점선 / 줄들
      size = Math.min(76, W / 3.3, H / 4.4); x = W / 2 - 4; cy = 66 + size * 1.1; x0 = 20; x1 = W - 54;
      o += k.up(plText(20, 64, 19, esc(m0.name), 700), .7);
      o += k.ink(plText(20, cy + size * .61 + 20, 10.5, m0.mode === 'since' ? cdFmt(cdParse(m0.date)) + '부터' : cdFmt(cdTarget(m0, d)), 600));
      const y0 = cy + size * .61 + 34, rh = Math.min(44, (H - 36 - y0) / 3);   // 칸이 길어도 줄 사이는 너무 벌어지지 않게
      if (s.rows.length) o += k.up(plDash(20, y0, W - 20, y0), .5);
      s.rows.forEach((r, i) => { o += row(r, 20, y0 + rh * (i + .5) + 6, W - 40, 14, 22); });
    } else {      // 세로 화면 칸(가로로 긴 판): 왼쪽 이름·숫자 창 | 점선 | 오른쪽 줄들
      const xr = s.rows.length ? W * .54 : W - 30;
      size = Math.min(64, (xr - 30) / 3, H / 2.7); x = xr / 2 + 4; cy = H * .6; x0 = 20; x1 = xr - 36;
      o += k.up(plText(20, 52, 16, esc(m0.name), 700), .7);
      if (s.rows.length) o += k.up(plDash(xr, 16, xr, H - 16), .5);
      const rh = (H - 40) / 3;
      s.rows.forEach((r, i) => { o += row(r, xr + 16, 20 + rh * (i + .5) + 5, W - 40, 12, 18); });
    }
    o += k.up(plBars(x0, x1, cy - size * .62, cy + size * .62 - 2.8), .6);
    reelAt = { x, cy, size, clip: k.clip(0, cy - size * .61, W, size * 1.22) };
    return o + `<g id="cd-reel" clip-path="${reelAt.clip}">${cdReelSvg(k, x, cy, size, m0, d, roll ? -1 : 0)}</g>`;
  });
  cdLay = { ...reelAt, k: { up: (sh, h) => lgRaise(sh, LG_INK[S.plate], h) } };
  if (roll) cdRoll(m0, d);
}
// 양각 릴 구르기: 0.9초 동안 점점 느려지며 어제 → 오늘 (로고 릴처럼 릴 묶음만 다시 그림)
let cdRaf = 0;
function cdRoll(it, d) {
  cancelAnimationFrame(cdRaf);
  const t0 = performance.now(), ease = t => 1 - (1 - t) ** 3;
  const step = now => {
    const g = $('cd-reel'), t = Math.min(1, (now - t0) / 900);
    if (!g || !cdLay) return;
    g.innerHTML = cdReelSvg(cdLay.k, cdLay.x, cdLay.cy, cdLay.size, it, d, -1 + ease(t));
    if (t < 1) cdRaf = requestAnimationFrame(step);
  };
  cdRaf = requestAnimationFrame(step);
}

// 그리기: 테마·화면 크기·항목이 바뀔 때, 위젯이 나타날 때(roll), 자정에(roll)
let cdDay = '';
function cdRender(roll) {
  const el = $('count'), d = new Date(), s = cdShown(d);
  cdDay = ymd(d);
  cancelAnimationFrame(cdRaf);
  if (!s || !S.focus) { el.innerHTML = ''; return; }
  if (roll && matchMedia('(prefers-reduced-motion: reduce)').matches) roll = false;
  el.classList.toggle('pl-on', !plFlat());
  if (plFlat()) cdFlat(el, d, s, roll); else cdEmboss(el, d, s, roll);
}
// 매초(tickClock): 날짜가 바뀌면 한 칸 굴러 새 값으로 (보이는 중일 때만 구름)
function cdTick(d) {
  if (ymd(d) !== cdDay) cdRender(panelName === 'count');
}

// ===== 설정 › 위젯 › 디데이: 목록(위로·아래로·고치기·지우기) / 추가·고치기 칸 =====
let cdEdit = -1;   // 고치는 항목 번호 (-1 새 항목)
function cdSetRender() {
  const d = new Date();
  $('cd-list').innerHTML = S.counts.map((it, i) => { const v = cdVal(it, d); return `<li data-i="${i}"><span>${esc(it.name)} <b>${v.num}${v.unit}</b><small>${cdSub(it, d)}</small></span>`
    + `<span class="cd-btns"><button data-cd="up" aria-label="위로"${i ? '' : ' disabled'}>↑</button><button data-cd="edit">고치기</button><button data-cd="del">지우기</button></span></li>`; }).join('');
  $('cd-empty').hidden = S.counts.length > 0;
}
function cdOpen(i) {
  cdEdit = i;
  const it = S.counts[i] || { name: '', date: ymd(new Date()), mode: 'since', first: true, yearly: false };
  $('cd-name').value = it.name; $('cd-date').value = it.date;
  $('cd-form').dataset.mode = it.mode; $('cd-form').dataset.first = it.first ? 1 : 0; $('cd-form').dataset.yearly = it.yearly ? 1 : 0;
  cdFormRender();
  $('cd-form').hidden = false;
}
function cdFormRender() {
  const f = $('cd-form').dataset;
  f.mode === 'since' || (f.mode = 'until');
  $('cd-form').querySelectorAll('[data-cdm]').forEach(b => b.classList.toggle('on', b.dataset.cdm === f.mode));
  $('cd-form').querySelectorAll('[data-cdo]').forEach(b => { b.classList.toggle('on', f[b.dataset.cdo] === '1'); b.hidden = (b.dataset.cdo === 'first') !== (f.mode === 'since'); });
}
document.querySelector('[data-page="widgets"]').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const f = $('cd-form').dataset;
  if (b.id === 'cd-add') { cdOpen(-1); $('cd-name').focus(); return; }
  if (b.dataset.cdm) { f.mode = b.dataset.cdm; cdFormRender(); return; }
  if (b.dataset.cdo) { f[b.dataset.cdo] = f[b.dataset.cdo] === '1' ? '0' : '1'; cdFormRender(); return; }
  if (b.id === 'cd-cancel') { $('cd-form').hidden = true; return; }
  if (b.id === 'cd-save') {
    const name = $('cd-name').value.trim().slice(0, 16), date = $('cd-date').value;
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('cd-msg').textContent = '이름과 날짜를 넣어 주세요.'; return; }
    const it = { name, date, mode: f.mode, first: f.mode === 'since' && f.first === '1', yearly: f.mode === 'until' && f.yearly === '1' };
    if (cdEdit >= 0) S.counts[cdEdit] = it; else S.counts.push(it);
    $('cd-form').hidden = true; $('cd-msg').textContent = '';
  } else if (b.dataset.cd) {
    const i = +b.closest('li').dataset.i;
    if (b.dataset.cd === 'edit') { cdOpen(i); return; }
    if (b.dataset.cd === 'up' && i > 0) [S.counts[i - 1], S.counts[i]] = [S.counts[i], S.counts[i - 1]];
    else if (b.dataset.cd === 'del') { if (!confirm(`'${S.counts[i].name}'을(를) 지울까요?`)) return; S.counts.splice(i, 1); }
    cdStart = 0;
  } else return;
  saveSettings();
  applySettings();
});
