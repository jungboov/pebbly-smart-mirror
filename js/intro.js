// Pebbly Mirror — 시작 인트로: 공용 번호 인트로 [ 03 ] pebbly mirror
// 부품은 js/pebbly-intro.js(_brand/intro/pebbly-intro.js의 사본 — 여기서 고치지 말고 원본을 고친 뒤 _brand/intro/sync.py로 맞춤)
// 첫 장면은 안드로이드 시작 화면과 같은 [ 03 ] 상자(설치한 앱이면 시스템 시작 화면 크기에서 시작) → 화면 가운데에서 스파인으로 바뀌어
// 숫자 릴이 한 바퀴(00 포함) 돌아 03에 멈춤 → 스파인이 왼쪽으로 비켜나며 pebbly mirror → 사라짐. 미러는 그동안 뒤에서 뜸
// 화면을 누르면 바로 넘어감(누름은 밀기·두 번 탭으로 이어지지 않게 부품이 막음). 안 보이는 때: 폰 설정 화면(?remote), 새벽 자동 새로고침(main.js가 표시를 남김)
// 밤에는 펼쳐지기 시작할 때(go)부터 어둡게·붉게(base.css). 움직임 줄이기를 켠 기기는 다 펼친 모습만 잠깐, 스크립트가 멈춰도 CSS가 8초 뒤 치움
(function intro() {
  const el = document.getElementById('intro');
  let quiet = false;
  try { quiet = sessionStorage.getItem('quietStart') === '1'; sessionStorage.removeItem('quietStart'); } catch (e) {}
  if (quiet || new URLSearchParams(location.search).has('remote')) { el.remove(); return; }
  pebblyIntro(el, { no: 3, name: 'pebbly mirror', onStart: () => el.classList.add('go') }).play();
})();
