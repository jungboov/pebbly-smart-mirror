// Pebbly Mirror — 시작 인트로 (#39 로고)
// 첫 장면은 안드로이드 시작 화면과 같은 [ 03 ] 상자(index.html에 그대로 그려 둠, 스크립트 전에도 보임)
// → 상자가 0.8초 동안 왼쪽 스파인 자리로 가며 위아래 막대만 남고, [ 03 ]은 스파인 가운데 칸으로 들어감
// → 숫자 릴이 한 바퀴(04 … 99 01 02) 돌아 다시 03에 멈춤 → 잠깐 보여 준 뒤 사라짐. 미러는 그동안 뒤에서 뜸
// 화면을 누르면 바로 넘어감. 안 보이는 때: 폰 설정 화면(?remote), 새벽 자동 새로고침(main.js가 표시를 남김)
// 움직임 줄이기를 켠 기기는 다 펼쳐진 로고만 잠깐. 스크립트가 멈춰도 CSS가 8초 뒤 알아서 치움 (base.css intro-bail)
(function intro() {
  const el = document.getElementById('intro');
  let quiet = false;
  try { quiet = sessionStorage.getItem('quietStart') === '1'; sessionStorage.removeItem('quietStart'); } catch (e) {}
  if (quiet || new URLSearchParams(location.search).has('remote')) { el.remove(); return; }

  const q = sel => el.querySelector(sel);
  const lock = q('#in-lock'), box = q('#in-box'), t03 = q('#in-03');

  // 릴: 02 03 … 99 01 02 03 04 — 03(1번째)에서 한 바퀴(99칸) 돌아 다시 03(100번째)
  const ROW = 25, nums = [];
  for (let n = 2; n <= 103; n++) nums.push(String((n - 1) % 99 + 1).padStart(2, '0'));
  const reels = el.querySelectorAll('.in-reel');
  reels.forEach(g => { g.innerHTML = nums.map((v, i) => `<text x="48" y="${64 + i * ROW}">${v}</text>`).join(''); });
  const roll = (i, anim) => reels.forEach(g => {
    g.style.transition = anim ? '' : 'none';
    g.style.transform = `translateY(${-i * ROW}px)`;
  });
  roll(1);

  // 로고 크기: 화면 폭의 84%까지, 세로가 짧으면 그에 맞춰. 화면 가운데에 (로고 단위 1 = k px)
  let k = 1, p = 0;
  function place() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const W = Math.min(innerWidth * .84, innerHeight * 1.1, rem * 100);
    k = W / 360;
    lock.setAttribute('transform', `translate(${-W / 2} ${-W / 6}) scale(${k})`);
  }
  // 상자 → 스파인. 시작 값은 index.html의 첫 장면, 끝 값은 로고의 스파인 테두리·가운데 칸 (로고 가운데 = 180, 60)
  const A = { x: -50, y: -50, w: 100, h: 100, r: 22.5, sw: 5, tx: 0, ty: 9, fs: 25.5, ls: -1 };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const part = (a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  function frame() {
    const B = { x: (20 - 180) * k, y: (18 - 60) * k, w: 56 * k, h: 84 * k, r: 0, sw: 2.8 * k,
                tx: (48 - 180) * k, ty: (64 - 60) * k, fs: 12.5 * k, ls: 0 };
    const e = ease(Math.min(1, p)), v = key => A[key] + (B[key] - A[key]) * e;
    box.setAttribute('x', v('x')); box.setAttribute('y', v('y'));
    box.setAttribute('width', v('w')); box.setAttribute('height', v('h'));
    box.setAttribute('rx', v('r')); box.setAttribute('stroke-width', v('sw'));
    box.style.opacity = 1 - part(.6, 1);                                         // 끝 무렵 옆선이 사라지고
    q('.in-bars').style.opacity = part(.55, 1);                                  // 위아래 막대만 남음
    el.querySelectorAll('.in-late').forEach(n => { n.style.opacity = part(.45, 1); });   // 점선·꺾쇠
    q('.in-word').style.opacity = part(.62, 1);                                  // 글자는 상자가 비켜난 뒤에
    t03.setAttribute('x', v('tx')); t03.setAttribute('y', v('ty'));
    t03.style.fontSize = v('fs') + 'px'; t03.style.letterSpacing = v('ls') + 'px';
  }
  const resize = () => { place(); frame(); };
  addEventListener('resize', resize);

  const timers = [];
  let raf = 0;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  function done() {
    timers.forEach(clearTimeout);
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    el.classList.add('out');
    setTimeout(() => el.remove(), 700);
  }
  // 누르면 넘어감. 밀기·두 번 탭(screen.js)으로 이어지지 않게 여기서 멈춤
  el.addEventListener('pointerdown', e => { e.stopPropagation(); done(); });
  el.addEventListener('pointerup', e => e.stopPropagation());

  const landed = () => el.classList.add('landed');   // 굴러가는 [ 03 ]으로 바꿔 끼움 (같은 자리·크기라 티 안 남)
  function play() {
    place();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      p = 1; frame(); landed();
      at(1500, done);
      return;
    }
    const MORPH = 800;
    let t0 = 0;
    const step = now => {
      t0 = t0 || now;
      p = (now - t0) / MORPH;
      frame();
      if (p < 1) { raf = requestAnimationFrame(step); return; }
      landed();
      at(120, () => roll(1 + 99, true));               // 1.7초 동안 점점 느려지며 한 바퀴 → 03
      at(120 + 1700 + 600, done);
    };
    raf = requestAnimationFrame(step);
  }
  // 글꼴이 늦게 와서 다른 글꼴로 번쩍이지 않게 기다렸다가 (최대 1.5초), 첫 장면을 잠깐 더 보여 준 뒤 시작
  const fonts = Promise.all([
    document.fonts.load("400 12px 'JetBrains Mono'", '0123456789'),
    document.fonts.load("800 12px 'JetBrains Mono'", '[]0123456789'),
    document.fonts.load("700 12px 'Pretendard Variable'", 'pebbly labs')
  ]).catch(() => {});
  Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(() => at(200, play));
})();
