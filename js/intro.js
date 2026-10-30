// Pebbly Mirror — 시작 인트로 (#39 로고)
// 숫자 릴이 68에서 굴러 99 → 01 → 03에 멈추고(02 [ 03 ] 04), 잠깐 보여 준 뒤 사라짐. 미러는 그동안 뒤에서 뜸
// 화면을 누르면 바로 넘어감. 안 보이는 때: 폰 설정 화면(?remote), 새벽 자동 새로고침(main.js가 표시를 남김)
// 움직임 줄이기를 켠 기기는 03에 멈춘 모습만 잠깐. 스크립트가 멈춰도 CSS가 7초 뒤 알아서 치움 (base.css intro-bail)
(function intro() {
  const el = document.getElementById('intro');
  let quiet = false;
  try { quiet = sessionStorage.getItem('quietStart') === '1'; sessionStorage.removeItem('quietStart'); } catch (e) {}
  if (quiet || new URLSearchParams(location.search).has('remote')) { el.remove(); return; }

  const ROW = 25;   // 02·03·04 줄 간격 (SVG 단위)
  const nums = [];  // 66 … 99 01 … 05
  for (let n = 66; n <= 104; n++) nums.push(String((n - 1) % 99 + 1).padStart(2, '0'));
  const reels = el.querySelectorAll('.in-reel');
  const to = i => reels.forEach(g => { g.style.transform = `translateY(${-i * ROW}px)`; });
  reels.forEach(g => { g.innerHTML = nums.map((v, i) => `<text x="48" y="${64 + i * ROW}">${v}</text>`).join(''); });
  to(nums.indexOf('68'));

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  function done() {
    timers.forEach(clearTimeout);
    el.classList.add('out');
    setTimeout(() => el.remove(), 700);
  }
  // 누르면 넘어감. 밀기·두 번 탭(screen.js)으로 이어지지 않게 여기서 멈춤
  el.addEventListener('pointerdown', e => { e.stopPropagation(); done(); });
  el.addEventListener('pointerup', e => e.stopPropagation());

  function play() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('still', 'on');
      to(nums.indexOf('03'));
      at(1500, done);
      return;
    }
    at(380, () => el.classList.add('on'));          // 숫자·글자가 서서히 나타남
    at(420, () => to(nums.indexOf('03')));          // 릴이 1.7초 동안 점점 느려지며 03에 멈춤
    at(420 + 1700 + 650, done);
  }
  // 글꼴이 늦게 와서 다른 글꼴로 번쩍이지 않게 기다렸다가 시작 (최대 1.5초)
  const fonts = Promise.all([
    document.fonts.load("400 12px 'JetBrains Mono'", '0123456789'),
    document.fonts.load("800 12px 'JetBrains Mono'", '[]0123456789'),
    document.fonts.load("700 12px 'Pretendard Variable'", 'pebbly labs')
  ]).catch(() => {});
  Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(play);
})();
