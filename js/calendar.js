// Pebbly Mirror — 달력 위젯
// ===== 달력: 이번 달 (시계 강조 화면 위젯) =====
// 일요일부터 한 주씩 4~6줄. 오늘은 흰 동그라미, 토요일 하늘색·일요일·공휴일 핑크(칸이 크면 공휴일 이름도),
// 지난 날은 흐리게, 앞뒤 달 날짜는 더 흐리게. 아래 줄은 다음 공휴일까지 며칠
// 날짜가 바뀌거나 공휴일 목록을 받으면 다시 그림 (clock.js renderDate)
function renderCal(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth(), today = ymd(d);
  const lead = new Date(y, m, 1).getDay(), weeks = Math.ceil((lead + new Date(y, m + 1, 0).getDate()) / 7);
  const dayCls = (c, hol) => hol || c.getDay() === 0 ? 'sun' : c.getDay() === 6 ? 'sat' : '';
  let h = WEEK.map((w, i) => `<b class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</b>`).join('');
  for (let i = 0; i < weeks * 7; i++) {
    const c = new Date(y, m, 1 - lead + i), iso = ymd(c), hol = holidayName(iso), mine = c.getMonth() === m;
    const cls = [dayCls(c, hol), !mine ? 'out' : iso < today ? 'past' : iso === today ? 'today' : ''].filter(Boolean).join(' ');
    h += `<span class="${cls}"><i>${c.getDate()}</i>${hol && mine ? `<small style="--n:${hol.length}">${hol}</small>` : ''}</span>`;
  }
  $('cal-m').textContent = ` · ${y}년 ${m + 1}월`;
  $('cal-grid').style.setProperty('--w', weeks);
  $('cal-grid').innerHTML = h;
  // 다음 공휴일 (오늘 빼고, 1년 안). 연휴는 첫날
  let foot = '';
  for (let i = 1; i <= 400; i++) {
    const c = new Date(y, m, d.getDate() + i), hol = holidayName(ymd(c));
    if (!hol) continue;
    foot = `<span>다음 공휴일</span><b class="sun">${hol}</b><span><i>${c.getMonth() + 1}</i>월 <i>${c.getDate()}</i>일 ${WEEK[c.getDay()]}요일</span><em>D-${i}</em>`;
    break;
  }
  $('cal-foot').innerHTML = foot;
}
