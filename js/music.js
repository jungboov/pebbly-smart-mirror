// Pebbly Mirror — 음악: Google 로그인, 재생목록, 유튜브 플레이어
// ===== 유튜브 음악: Google 로그인(기기 코드) + 내 재생목록 + 플레이어 =====
// 갱신 토큰은 이 기기 localStorage에만(읽기 전용 권한), 접근 토큰은 메모리에(1시간마다 /api/google로 갱신)
// 재생목록은 유튜브 API로 직접
// 유튜브 규정상 플레이어가 화면에 보일 때만 재생: 재생 중엔 자동 넘김을 멈추고, 다른 위젯으로 넘기면 일시정지
const G_KEY = 'mirror_google';
const G_HINT = 'Google 계정으로 로그인하면 내 유튜브 재생목록(비공개 포함)과 좋아요 표시한 곡을 들을 수 있어요.';
const gSaved = () => { try { return JSON.parse(localStorage.getItem(G_KEY)); } catch (e) { return null; } };
let gAccess = null, gExp = 0, gPollTimer = null, muLists = [];

async function gPost(op, body) {
  try {
    const r = await fetch('/api/google?op=' + op, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    return await r.json();
  } catch (e) { return { error: 'Google 연결 서버에 연결하지 못했어요' }; }
}
async function gToken() {
  if (gAccess && Date.now() < gExp - 60e3) return gAccess;
  const g = gSaved();
  if (!g) throw new Error('Google 로그인이 필요해요');
  const r = await gPost('refresh', { refresh_token: g.refresh });
  if (r.error === 'expired') { gSignOut(true); throw new Error('로그인이 만료됐어요. 설정에서 다시 로그인해 주세요'); }
  if (r.error) throw new Error(r.error);
  gAccess = r.access_token;
  gExp = Date.now() + r.expires_in * 1e3;
  return gAccess;
}
async function yt(path, params) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?` + new URLSearchParams(params),
    { headers: { Authorization: `Bearer ${await gToken()}` } });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'YouTube 오류');
  return d;
}
// 페이지를 넘겨 가며 최대 max개
async function ytAll(path, params, max = 200) {
  const items = [];
  let page;
  do {
    const d = await yt(path, { ...params, maxResults: 50, ...(page ? { pageToken: page } : {}) });
    items.push(...(d.items || []));
    page = d.nextPageToken;
  } while (page && items.length < max);
  return items.slice(0, max);
}

// 설정 화면
const gMsg = t => { $('g-msg').textContent = t; };
function renderMusicSettings() {
  const on = !!gSaved();
  $('g-login').hidden = on;
  $('g-logout').hidden = !on;
  if (!on) { $('mu-lists').innerHTML = ''; if (!gPollTimer) gMsg(G_HINT); }
}
async function gLogin() {
  gMsg('로그인 코드를 받는 중…');
  const d = await gPost('device');
  if (d.error) { gMsg('로그인 준비 실패: ' + d.error); return; }
  $('g-url').textContent = d.verification_url.replace(/^https?:\/\//, '');
  $('g-url').href = d.verification_url;
  $('g-user').textContent = d.user_code;
  $('g-code').hidden = false;
  gMsg('코드를 입력하면 자동으로 로그인돼요.');
  const until = Date.now() + d.expires_in * 1e3;
  let wait = (d.interval || 5) * 1e3;
  clearTimeout(gPollTimer);
  const poll = async () => {
    if (Date.now() > until) { gPollTimer = null; $('g-code').hidden = true; gMsg('코드 시간이 지났어요. 다시 로그인을 눌러 주세요.'); return; }
    const r = await gPost('poll', { device_code: d.device_code });
    if (r.pending) { if (r.slow) wait += 5e3; gPollTimer = setTimeout(poll, wait); return; }
    gPollTimer = null;
    $('g-code').hidden = true;
    if (r.error) { gMsg(r.error === 'access_denied' ? '로그인을 취소했어요.' : '로그인 실패: ' + r.error); return; }
    try { localStorage.setItem(G_KEY, JSON.stringify({ refresh: r.refresh_token })); } catch (e) {}
    gAccess = r.access_token;
    gExp = Date.now() + r.expires_in * 1e3;
    applySettings();
    muLoadLists();
  };
  gPollTimer = setTimeout(poll, wait);
}
function gSignOut(expired) {
  const g = gSaved();
  try { localStorage.removeItem(G_KEY); } catch (e) {}
  if (g && !expired) gPost('revoke', { token: g.refresh });
  gAccess = null; muLists = []; muFor = null;
  if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
  applySettings();
  gMsg(expired ? '로그인이 만료돼서 로그아웃됐어요. 다시 로그인해 주세요.' : '로그아웃했어요.');
}
async function muLoadLists() {
  gMsg('재생목록 불러오는 중…');
  try {
    const pls = await ytAll('playlists', { part: 'snippet,contentDetails', mine: 'true' });
    muLists = [{ id: 'LL', title: '좋아요 표시한 곡' }, ...pls.map(p => ({ id: p.id, title: p.snippet.title, count: p.contentDetails.itemCount }))];
    muRenderLists();
    gMsg('들을 재생목록을 고르세요. 유튜브 뮤직에서 만든 재생목록도 나와요.');
  } catch (e) { gMsg('재생목록을 못 불러왔어요: ' + e.message); }
}
function muRenderLists() {
  $('mu-lists').innerHTML = muLists.map((p, i) => {
    const on = S.music && S.music.id === p.id;
    return `<li data-pl="${i}"${on ? ' class="on"' : ''}><div>${esc(p.title)}<small>${p.count != null ? p.count + '곡' : '유튜브·유튜브 뮤직 좋아요'}</small></div>${on ? '<span>선택됨</span>' : ''}</li>`;
  }).join('');
}
$('mu-sec').addEventListener('click', e => {
  const b = e.target.closest('button, li[data-pl]');
  if (!b) return;
  if (b.id === 'g-login') gLogin();
  else if (b.id === 'g-logout') gSignOut(false);
  else if (b.dataset.pl != null) {
    const p = muLists[Number(b.dataset.pl)];
    S.music = { id: p.id, title: p.title };
    saveSettings();
    muRenderLists();
    muFor = null;
    if (panelName === 'music') muShow();
  }
});

// 플레이어
let ytApi = null, ytPlayer = null, muFor = null, muItems = [], muPlaying = false, muTick = null, muNow = null;
const muMsg = t => { $('mu-msg').textContent = t; };
function loadYT() {
  return ytApi ||= new Promise((res, rej) => {
    window.onYouTubeIframeAPIReady = () => res(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; rej(new Error('유튜브 플레이어를 못 불러왔어요')); };
    document.head.appendChild(s);
  });
}
// 음악 위젯이 보일 때: 고른 재생목록을 불러와 플레이어에 올림 (같은 재생목록이면 그대로)
async function muShow() {
  muToggles();
  if (!S.music) { muMsg('설정(화면 두 번 탭) → 음악 탭에서 재생목록을 고르세요.'); return; }
  if (muFor === S.music.id) return;
  muFor = S.music.id;
  $('mu-list').textContent = ' · ' + S.music.title;
  muMsg('재생목록 불러오는 중…');
  try {
    const items = await ytAll('playlistItems', { part: 'snippet', playlistId: S.music.id });
    muItems = items.map(i => ({ id: i.snippet.resourceId.videoId, title: i.snippet.title, ch: i.snippet.videoOwnerChannelTitle || '' }))
      .filter(i => i.ch);   // 삭제·비공개 영상은 채널 정보가 없음
    if (!muItems.length) { muMsg('재생목록이 비어 있어요.'); return; }
    const YT = await loadYT();
    if (!ytPlayer) {
      ytPlayer = await new Promise(res => {
        const p = new YT.Player('yt-player', {
          width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0 },
          events: { onReady: () => res(p), onStateChange: muState, onError: () => ytPlayer.nextVideo() }
        });
      });
    }
    muNow = null;
    ytPlayer.cuePlaylist(muItems.map(i => i.id));
    setTimeout(() => { ytPlayer.setShuffle(S.muShuffle); ytPlayer.setLoop(S.muRepeat); }, 500);
    // 올린 직후엔 재생목록 정보가 늦게 채워져서 곡 정보가 잡힐 때까지 잠깐 다시 확인
    const firstInfo = n => { muInfo(); if (!muNow && n) setTimeout(() => firstInfo(n - 1), 400); };
    firstInfo(15);
    muMsg('');
  } catch (e) { muFor = null; muMsg(e.message); }
}
// 다른 위젯으로 넘기면 일시정지 (유튜브 규정: 보이지 않는 플레이어로 재생 금지)
function muHidden() { if (muPlaying && ytPlayer) ytPlayer.pauseVideo(); }
function muState(e) {
  muPlaying = e.data === window.YT.PlayerState.PLAYING;
  $('mu-play-ico').setAttribute('d', muPlaying ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4v16l13-8z');
  $('mu-play').setAttribute('aria-label', muPlaying ? '일시정지' : '재생');
  clearInterval(muTick);
  if (muPlaying) muTick = setInterval(muProgress, 250);
  muProgress();
  schedulePanel();   // 재생 중엔 자동 넘김 멈춤, 멈추면 다시
}
const mmss = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
function muProgress() {
  if (!ytPlayer || !ytPlayer.getCurrentTime) return;
  const t = ytPlayer.getCurrentTime() || 0, d = ytPlayer.getDuration() || 0;
  $('mu-fill').style.width = d ? `${t / d * 100}%` : '0';
  $('mu-cur').textContent = mmss(t);
  $('mu-dur').textContent = mmss(d);
  muInfo();
}
// 지금 곡이 바뀌었으면 제목·가수를 새로
// (재생 전 대기 상태에선 플레이어가 영상 ID를 안 알려 줘서 재생목록 순서·현재 위치로 찾음)
function muInfo() {
  if (!ytPlayer || !ytPlayer.getPlaylist) return;
  const ids = ytPlayer.getPlaylist() || [], v = ytPlayer.getVideoData() || {};
  const vid = ids[ytPlayer.getPlaylistIndex()] || v.video_id;
  if (!vid || vid === muNow) return;
  const it = muItems.find(i => i.id === vid) || (v.title ? { title: v.title, ch: v.author || '' } : null);
  if (!it) return;   // 오류·로딩 중이라 곡 정보가 아직 없음 → 지금 표시 유지
  muNow = vid;
  const { artist, track } = songOf(it.title, it.ch);
  $('mu-title').textContent = track || it.title;
  $('mu-ch').textContent = artist || it.ch;
}
// 유튜브 제목·채널 → 가수·곡명. 유튜브 뮤직 곡('가수 - Topic' 채널)은 제목이 곧 곡명
// 뮤직비디오는 "가수 '곡명' MV", "가수 - 곡명 (Official Video)" 같은 형태에서 뽑음
function songOf(title, ch) {
  let artist = ch.replace(/\s*-\s*Topic$/i, '').trim(), track = title;
  if (!/-\s*Topic$/i.test(ch)) {
    const t = title.replace(/\[[^\]]*\]|【[^】]*】/g, ' ')
      .replace(/\([^)]*(official|m\/?v|lyric|audio|video|live|visuali[sz]er|performance|teaser)[^)]*\)/gi, ' ')
      .replace(/\b(official\s*(music\s*)?video|official\s*audio|m\/v|mv|lyrics?)\b/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    const quoted = t.match(/^(.*?)\s*['‘"“](.+?)['’"”]/), dashed = t.split(/\s+[-–—|]\s+/);
    if (quoted) { artist = quoted[1].trim() || artist; track = quoted[2].trim(); }
    else if (dashed.length >= 2) { artist = dashed[0].trim(); track = dashed.slice(1).join(' - ').trim(); }
    else track = t;
  }
  return { artist: artist.replace(/\(.*?\)/g, '').trim(), track: track.replace(/\s*\(.*?\)\s*$/, '').trim() };
}

function muToggles() {
  $('mu-shuffle').classList.toggle('on', S.muShuffle);
  $('mu-repeat').classList.toggle('on', S.muRepeat);
}
$('music').addEventListener('click', e => {
  const b = e.target.closest('[data-mu]');
  if (!b || !ytPlayer || !ytPlayer.playVideo) return;
  const a = b.dataset.mu;
  if (a === 'play') { if (muPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo(); }
  else if (a === 'prev') ytPlayer.previousVideo();
  else if (a === 'next') ytPlayer.nextVideo();
  else if (a === 'shuffle') { S.muShuffle = !S.muShuffle; ytPlayer.setShuffle(S.muShuffle); saveSettings(); }
  else if (a === 'repeat') { S.muRepeat = !S.muRepeat; ytPlayer.setLoop(S.muRepeat); saveSettings(); }
  muToggles();
});

// OLED 번인 방지: 1분마다 화면 전체를 몇 px씩 옮김 (폰 시계 강조 화면에서만 CSS가 적용)
const SHIFT = [[0, 0], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0], [-3, -3], [0, -3], [3, -3]];
function shiftPixels(m) {
  const [x, y] = SHIFT[m % SHIFT.length];
  $('stage').style.setProperty('--sx', x + 'px');
  $('stage').style.setProperty('--sy', y + 'px');
}
