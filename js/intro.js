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
  // 상자는 초타원 |x/a|^n + |y/b|^n = 1: 갤럭시 아이콘 모양(n=2.7)에서 거의 네모(n=16)로. x, y는 상자 가운데
  const sq = (cx, cy, a, b, n) => {
    let d = '';
    for (let i = 0; i < 64; i++) {
      const t = i / 32 * Math.PI, c = Math.cos(t), s = Math.sin(t);
      d += (i ? 'L' : 'M') + (cx + a * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(1) + ' ' + (cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(1);
    }
    return d + 'Z';
  };
  const A = { x: 0, y: 0, a: 59.5, b: 59.5, n: 2.7, sw: 7.5, tx: -2.75, ty: 12.53, fs: 35.5, ls: -5.5 };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const part = (a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  function frame() {
    const B = { x: (48 - 180) * k, y: 0, a: 28 * k, b: 42 * k, n: 16, sw: 2.8 * k,
                tx: (48 - 180) * k, ty: (64 - 60) * k, fs: 12.5 * k, ls: 0 };
    const e = ease(Math.min(1, p)), v = key => A[key] + (B[key] - A[key]) * e;
    box.setAttribute('d', sq(v('x'), v('y'), v('a'), v('b'), v('n')));
    box.setAttribute('stroke-width', v('sw'));
    box.style.opacity = 1 - part(.6, 1);                                         // 끝 무렵 옆선이 사라지고
    q('.in-bars').style.opacity = part(.55, 1);                                  // 위아래 막대만 남음
    el.querySelectorAll('.in-late').forEach(n => { n.style.opacity = part(.45, 1); });   // 점선·꺾쇠
    q('.in-word').style.opacity = part(.62, 1);                                  // 글자는 상자가 비켜난 뒤에
    t03.setAttribute('x', v('tx')); t03.setAttribute('y', v('ty'));
    t03.style.fontSize = v('fs') + 'px'; t03.style.letterSpacing = v('ls') + 'px';
  }
  const resize = () => { place(); frame(); };
  addEventListener('resize', resize);
  // 설치한 앱을 안드로이드에서 열면 시스템 시작 화면(안드로이드 12+)이 아이콘을 크게(약 288dp) 띄움 — 상자가 160 기준(index.html)보다 1.73배(폴드8 녹화로 잼)
  // → 첫 장면도 그 크기에서 시작해야 넘어갈 때 상자가 갑자기 줄지 않음. 안드로이드 11 이하·아이폰·브라우저 탭은 그대로
  const A0 = { ...A }, splash = s => { for (const key of ['a', 'b', 'sw', 'tx', 'ty', 'fs', 'ls']) A[key] = A0[key] * s; place(); frame(); };
  if (/Android/.test(navigator.userAgent) && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) {
    splash(1.73);
    if (navigator.userAgentData) navigator.userAgentData.getHighEntropyValues(['platformVersion'])
      .then(v => { if (p === 0 && parseInt(v.platformVersion) < 12) splash(1); }).catch(() => {});
  }

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
    el.classList.add('go');   // 밤 어둡게·붉게는 펼쳐지기 시작할 때부터 천천히 (첫 장면은 시작 화면처럼 밝은 흰색)
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
