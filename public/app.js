// --- App State ---
let state = {
  tournament: {},
  groups: [],
  teams: {},
  matches: [],
  playoffs: [],
  adminPassword: null, // Stores password once verified
  selectedWeek: '1주',
  selectedStandingsGroup: 'group_a', // 'group_a' or 'group_b'
  teamFilter: ''
};

// --- DOM Elements ---
const el = {
  appTitle: document.getElementById('app-title'),
  schoolLogo: document.getElementById('school-logo-img'),
  
  // Standings
  tabSubBtns: document.querySelectorAll('.tab-sub-btn'),
  tableGroupA: document.getElementById('table-group-a'),
  tableGroupB: document.getElementById('table-group-b'),
  standingsABody: document.getElementById('standings-a-body'),
  standingsBBody: document.getElementById('standings-b-body'),
  
  // Playoff Bracket
  playoffT1C: document.getElementById('playoff-t1-c'),
  playoffT2C: document.getElementById('playoff-t2-c'),
  playoffT1F: document.getElementById('playoff-t1-f'),
  playoffT2F: document.getElementById('playoff-t2-f'),
  refConsolation: document.getElementById('ref-consolation'),
  refFinal: document.getElementById('ref-final'),
  playoffConsolationBox: document.getElementById('playoff-consolation-box'),
  playoffFinalBox: document.getElementById('playoff-final-box'),

  // Matches Schedule
  filterTeam: document.getElementById('filter-team'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  matchesContainer: document.getElementById('matches-container'),
  
  // Admin Login
  adminBtn: document.getElementById('admin-btn'),
  adminStatus: document.getElementById('admin-status'),
  logoutBtn: document.getElementById('logout-btn'),
  loginModal: document.getElementById('login-modal'),
  adminPasswordInput: document.getElementById('admin-password'),
  loginError: document.getElementById('login-error'),
  loginCancelBtn: document.getElementById('login-cancel-btn'),
  loginSubmitBtn: document.getElementById('login-submit-btn'),
  
  // Admin Panel Modal
  adminModal: document.getElementById('admin-modal'),
  adminTabBtns: document.querySelectorAll('.admin-tab-btn'),
  tabTeamsSettings: document.getElementById('tab-teams-settings'),
  tabSystemSettings: document.getElementById('tab-system-settings'),
  saveMappingBtn: document.getElementById('save-mapping-btn'),
  resetDbBtn: document.getElementById('reset-db-btn'),
  
  // Result Modal
  resultModal: document.getElementById('result-modal'),
  resultMatchInfo: document.getElementById('result-match-info'),
  resultRefereeInput: document.getElementById('result-referee-input'),
  vsT1Name: document.getElementById('vs-t1-name'),
  vsT2Name: document.getElementById('vs-t2-name'),
  vsT1WinBtn: document.getElementById('vs-t1-win-btn'),
  vsT2WinBtn: document.getElementById('vs-t2-win-btn'),
  resultResetBtn: document.getElementById('result-reset-btn'),
  resultCancelBtn: document.getElementById('result-cancel-btn'),
  
  // Close buttons helper
  modalCloseBtns: document.querySelectorAll('.modal-close-btn')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  bindEvents();
  
  // Check if admin is already logged in (via sessionStorage)
  const savedPassword = sessionStorage.getItem('adminPassword');
  if (savedPassword === '0000') {
    loginAdmin(savedPassword);
  }
});

// --- Fetch API Data ---
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('데이터 로드 실패');
    const db = await res.json();
    
    state.tournament = db.tournament;
    state.groups = db.groups;
    state.teams = db.teams;
    state.matches = db.matches;
    state.playoffs = db.playoffs;
    
    updateHeader();
    renderAll();
    populateMappingInputs();
  } catch (err) {
    console.error(err);
    alert('서버 데이터를 불러오는데 실패했습니다.');
  }
}

// --- Render Helper ---
function renderAll() {
  renderStandings();
  renderPlayoffs();
  renderFilters();
  renderMatches();
}

// --- Update Header ---
function updateHeader() {
  if (state.tournament.title) {
    el.appTitle.textContent = state.tournament.title;
  }
}

// --- Render Standings (실시간 순위 계산 및 렌더링) ---
function renderStandings() {
  const standingsA = calculateStandings('group_a');
  const standingsB = calculateStandings('group_b');
  
  renderStandingsTable(standingsA, el.standingsABody);
  renderStandingsTable(standingsB, el.standingsBBody);
}

function calculateStandings(groupId) {
  // Get all teams in this group
  const groupTeams = Object.values(state.teams).filter(t => t.group_id === groupId);
  
  // Initialize standings data for each team
  const standings = {};
  groupTeams.forEach(team => {
    standings[team.id] = {
      id: team.id,
      name: team.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0
    };
  });
  
  // Calculate stats from matches
  state.matches.forEach(match => {
    if (match.group_id !== groupId) return;
    if (!match.result) return; // Ignore matches without results
    
    const t1 = standings[match.team1_id];
    const t2 = standings[match.team2_id];
    
    if (t1 && t2) {
      t1.played++;
      t2.played++;
      
      if (match.result.winner_id === match.team1_id) {
        t1.won++;
        t1.points += state.tournament.rules.win_point;
        t2.lost++;
        t2.points += state.tournament.rules.lose_point;
      } else if (match.result.winner_id === match.team2_id) {
        t2.won++;
        t2.points += state.tournament.rules.win_point;
        t1.lost++;
        t1.points += state.tournament.rules.lose_point;
      }
    }
  });
  
  // Sort standings: Points (desc) -> Won (desc) -> Name (asc)
  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    return a.name.localeCompare(b.name, 'ko');
  });
}

function renderStandingsTable(standings, tbody) {
  tbody.innerHTML = '';
  
  standings.forEach((team, index) => {
    const rank = index + 1;
    const tr = document.createElement('tr');
    
    // Highlight top 2
    if (rank === 1) tr.className = 'rank-row-1';
    else if (rank === 2) tr.className = 'rank-row-2';
    
    // Crown icons
    let rankBadgeStr = `<span class="rank-badge">${rank}</span>`;
    let teamNameStr = team.name;
    if (rank === 1) {
      teamNameStr = `<span class="rank-team-name"><i class="fa-solid fa-crown crown-gold"></i> ${team.name}</span>`;
    } else if (rank === 2) {
      teamNameStr = `<span class="rank-team-name"><i class="fa-solid fa-crown crown-silver"></i> ${team.name}</span>`;
    }
    
    tr.innerHTML = `
      <td>${rankBadgeStr}</td>
      <td>${teamNameStr}</td>
      <td>${team.played}</td>
      <td>${team.won}</td>
      <td>${team.lost}</td>
      <td>${team.points}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

// --- Render Playoff Bracket ---
function renderPlayoffs() {
  const standingsA = calculateStandings('group_a');
  const standingsB = calculateStandings('group_b');
  
  // Find top 1 & 2 for each group
  const a1 = standingsA[0];
  const a2 = standingsA[1];
  const b1 = standingsB[0];
  const b2 = standingsB[1];
  
  // Let's retrieve playoff match objects from state
  // E.g., playoff_1: 3-4위전 (A조 2위 vs B조 2위), playoff_2: 결승전 (A조 1위 vs B조 1위)
  const consolationMatch = state.playoffs.find(p => p.id === 'playoff_1');
  const finalMatch = state.playoffs.find(p => p.id === 'playoff_2');
  
  // Map Consolation (3·4위전)
  renderPlayoffTeam(el.playoffT1C, a2, '무적 2위', consolationMatch, a2?.id);
  renderPlayoffTeam(el.playoffT2C, b2, '최강 2위', consolationMatch, b2?.id);
  
  // Map Final (결승전)
  renderPlayoffTeam(el.playoffT1F, a1, '무적 1위', finalMatch, a1?.id);
  renderPlayoffTeam(el.playoffT2F, b1, '최강 1위', finalMatch, b1?.id);
  
  // Display referee info
  if (consolationMatch) el.refConsolation.textContent = `심판: ${consolationMatch.referee}`;
  if (finalMatch) el.refFinal.textContent = `심판: ${finalMatch.referee}`;
  
  // Attach admin edit handler to playoffs box if logged in
  if (state.adminPassword === '0000') {
    el.playoffConsolationBox.style.cursor = 'pointer';
    el.playoffConsolationBox.onclick = () => openResultModal('playoff_1', a2, b2);
    
    el.playoffFinalBox.style.cursor = 'pointer';
    el.playoffFinalBox.onclick = () => openResultModal('playoff_2', a1, b1);
  } else {
    el.playoffConsolationBox.style.cursor = 'default';
    el.playoffConsolationBox.onclick = null;
    
    el.playoffFinalBox.style.cursor = 'default';
    el.playoffFinalBox.onclick = null;
  }
}

function renderPlayoffTeam(element, teamObj, defaultLabel, matchObj, expectedTeamId) {
  const sourceTag = element.querySelector('.team-source-tag');
  const nameSpan = element.querySelector('.team-name');
  const scoreSpan = element.querySelector('.playoff-score');
  
  element.className = 'playoff-team';
  sourceTag.textContent = defaultLabel;
  
  if (teamObj) {
    nameSpan.textContent = teamObj.name;
    
    // Check results
    if (matchObj && matchObj.result) {
      if (matchObj.result.winner_id === expectedTeamId) {
        element.classList.add('winner');
        scoreSpan.innerHTML = '<i class="fa-solid fa-circle-check"></i> 승';
      } else if (matchObj.result.loser_id === expectedTeamId) {
        element.classList.add('loser');
        scoreSpan.innerHTML = '패';
      } else {
        scoreSpan.textContent = '-';
      }
    } else {
      scoreSpan.textContent = '대기';
    }
  } else {
    nameSpan.textContent = '진출팀 대기 중';
    scoreSpan.textContent = '-';
  }
}

// --- Render Filters ---
function renderFilters() {
  const currentFilter = el.filterTeam.value;
  el.filterTeam.innerHTML = '<option value="">전체 반 필터</option>';
  
  // Sort teams by mapping name
  const sortedTeams = Object.values(state.teams).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  
  sortedTeams.forEach(team => {
    const opt = document.createElement('option');
    opt.value = team.id;
    opt.textContent = team.name;
    el.filterTeam.appendChild(opt);
  });
  
  el.filterTeam.value = currentFilter;
}

// --- Render Matches List ---
function renderMatches() {
  el.matchesContainer.innerHTML = '';
  
  // Filter matches by selected week
  let filtered = state.matches.filter(m => m.week === state.selectedWeek);
  
  // Filter by team if selected
  if (state.teamFilter) {
    filtered = filtered.filter(m => m.team1_id === state.teamFilter || m.team2_id === state.teamFilter);
  }
  
  if (filtered.length === 0) {
    el.matchesContainer.innerHTML = '<div class="no-matches"><i class="fa-solid fa-circle-info"></i> 조건에 맞는 경기 일정이 없습니다.</div>';
    return;
  }
  
  // Render cards
  filtered.forEach(match => {
    const t1 = state.teams[match.team1_id] || { name: match.team1_id };
    const t2 = state.teams[match.team2_id] || { name: match.team2_id };
    
    const card = document.createElement('div');
    card.className = 'match-card';
    
    // Status Badge & Action Buttons
    let actionStr = '';
    if (state.adminPassword === '0000') {
      actionStr = `
        <button class="btn btn-secondary-sm edit-result-btn" data-match-id="${match.id}">
          <i class="fa-solid fa-pen-to-square"></i> 결과 입력
        </button>
      `;
    } else {
      if (match.result) {
        actionStr = `<span class="match-status-badge completed"><i class="fa-solid fa-check"></i> 종료</span>`;
      } else {
        actionStr = `<span class="match-status-badge">대기</span>`;
      }
    }
    
    // Winner highlight classes
    let t1Class = 'match-team';
    let t2Class = 'match-team';
    if (match.result) {
      if (match.result.winner_id === match.team1_id) {
        t1Class += ' winner';
        t2Class += ' loser';
      } else if (match.result.winner_id === match.team2_id) {
        t2Class += ' winner';
        t1Class += ' loser';
      }
    }
    
    card.innerHTML = `
      <div class="match-info-meta">
        <div class="match-day-period">
          <span class="day-badge">${match.day}요일</span>
          <span class="match-period">${match.period}</span>
        </div>
        <div class="match-meta-secondary">
          <span><i class="fa-solid fa-user-tie"></i> 심판: ${match.referee}</span>
          <span><i class="fa-solid fa-tags"></i> ${match.group_id === 'group_a' ? '무적리그' : '최강리그'} 예선</span>
        </div>
      </div>
      
      <div class="match-display">
        <div class="${t1Class}">${t1.name}</div>
        <div class="match-vs">VS</div>
        <div class="${t2Class}">${t2.name}</div>
      </div>
      
      <div class="match-card-actions">
        ${actionStr}
      </div>
    `;
    
    el.matchesContainer.appendChild(card);
  });
  
  // Attach event listeners to newly rendered result input buttons
  if (state.adminPassword === '0000') {
    el.matchesContainer.querySelectorAll('.edit-result-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const matchId = e.currentTarget.getAttribute('data-match-id');
        const match = state.matches.find(m => m.id === matchId);
        if (match) {
          const team1 = state.teams[match.team1_id];
          const team2 = state.teams[match.team2_id];
          openResultModal(matchId, team1, team2, match.result);
        }
      });
    });
  }
}

// --- Populate Admin Mapping Input Boxes ---
function populateMappingInputs() {
  Object.values(state.teams).forEach(team => {
    const input = document.getElementById(`map-${team.id}`);
    if (input) {
      input.value = team.name;
    }
  });
}

// --- Bind Events ---
function bindEvents() {
  // A조 vs B조 순위표 탭 전환
  el.tabSubBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      el.tabSubBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const group = e.target.getAttribute('data-group');
      if (group === 'a') {
        el.tableGroupA.classList.remove('hidden');
        el.tableGroupB.classList.add('hidden');
        state.selectedStandingsGroup = 'group_a';
      } else {
        el.tableGroupA.classList.add('hidden');
        el.tableGroupB.classList.remove('hidden');
        state.selectedStandingsGroup = 'group_b';
      }
    });
  });
  
  // 주차별 경기 일정 탭 전환
  el.tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      el.tabBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      state.selectedWeek = e.currentTarget.getAttribute('data-week');
      renderMatches();
    });
  });
  
  // 특정 반 경기 일정 필터링
  el.filterTeam.addEventListener('change', (e) => {
    state.teamFilter = e.target.value;
    renderMatches();
  });
  
  // 관리자 로그인 버튼 클릭
  el.adminBtn.addEventListener('click', () => {
    el.loginModal.classList.remove('hidden');
    el.adminPasswordInput.value = '';
    el.loginError.classList.add('hidden');
    el.adminPasswordInput.focus();
  });
  
  // 모달 닫기
  el.modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });
  
  el.loginCancelBtn.addEventListener('click', () => {
    el.loginModal.classList.add('hidden');
  });
  
  // 로그인 서브밋
  el.loginSubmitBtn.addEventListener('click', submitLogin);
  el.adminPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
  
  // 로그아웃
  el.logoutBtn.addEventListener('click', logoutAdmin);
  
  // 관리자 대화상자 탭 전환
  el.adminTabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      el.adminTabBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const tab = e.target.getAttribute('data-tab');
      if (tab === 'teams-settings') {
        el.tabTeamsSettings.classList.remove('hidden');
        el.tabSystemSettings.classList.add('hidden');
      } else {
        el.tabTeamsSettings.classList.add('hidden');
        el.tabSystemSettings.classList.remove('hidden');
      }
    });
  });
  
  // 반 이름 매핑 저장
  el.saveMappingBtn.addEventListener('click', saveAllMappings);
  
  // 데이터 초기화
  el.resetDbBtn.addEventListener('click', resetDatabase);
}

// --- Admin Login Processing ---
function submitLogin() {
  const pwd = el.adminPasswordInput.value;
  if (pwd === '0000') {
    loginAdmin(pwd);
    el.loginModal.classList.add('hidden');
    
    // Open admin setting panel right after login
    el.adminModal.classList.remove('hidden');
  } else {
    el.loginError.classList.remove('hidden');
  }
}

function loginAdmin(password) {
  state.adminPassword = password;
  sessionStorage.setItem('adminPassword', password);
  
  el.adminBtn.classList.add('hidden');
  el.adminStatus.classList.remove('hidden');
  
  renderAll(); // Rerender to show editing buttons
}

function logoutAdmin() {
  state.adminPassword = null;
  sessionStorage.removeItem('adminPassword');
  
  el.adminBtn.classList.remove('hidden');
  el.adminStatus.classList.add('hidden');
  
  renderAll();
}

function closeAllModals() {
  el.loginModal.classList.add('hidden');
  el.adminModal.classList.add('hidden');
  el.resultModal.classList.add('hidden');
}

// --- Open Result Input Modal ---
let activeResultMatchId = null;
function openResultModal(matchId, team1Obj, team2Obj, currentResult = null) {
  activeResultMatchId = matchId;
  
  // Retrieve names (handling empty team placeholders)
  const t1Name = team1Obj ? team1Obj.name : '진출팀 대기';
  const t2Name = team2Obj ? team2Obj.name : '진출팀 대기';
  
  // Detect match type (playoff or league match)
  let match = state.matches.find(m => m.id === matchId);
  let isPlayoff = false;
  if (!match) {
    match = state.playoffs.find(p => p.id === matchId);
    isPlayoff = true;
  }
  
  if (!match) return;
  
  el.resultMatchInfo.textContent = `${match.week}차 ${match.day}요일 ${match.period} (${isPlayoff ? match.name : (match.group_id === 'group_a' ? '무적리그' : '최강리그') + ' 예선'})`;
  
  // Set referee input value
  el.resultRefereeInput.value = match.referee || '';
  
  el.vsT1Name.textContent = t1Name;
  el.vsT2Name.textContent = t2Name;
  
  // Set Win buttons state
  el.vsT1WinBtn.onclick = () => submitResult(matchId, team1Obj?.id, team2Obj?.id, el.resultRefereeInput.value.trim());
  el.vsT2WinBtn.onclick = () => submitResult(matchId, team2Obj?.id, team1Obj?.id, el.resultRefereeInput.value.trim());
  
  if (!team1Obj || !team2Obj) {
    el.vsT1WinBtn.disabled = true;
    el.vsT2WinBtn.disabled = true;
    el.resultResetBtn.disabled = true;
  } else {
    el.vsT1WinBtn.disabled = false;
    el.vsT2WinBtn.disabled = false;
    el.resultResetBtn.disabled = false;
  }
  
  // Set result reset button
  el.resultResetBtn.onclick = () => submitResult(matchId, null, null, el.resultRefereeInput.value.trim());
  
  el.resultModal.classList.remove('hidden');
}

// --- Submit Result to Backend ---
async function submitResult(matchId, winnerId, loserId, referee = "") {
  try {
    const res = await fetch('/api/match/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: state.adminPassword,
        matchId,
        winnerId,
        loserId,
        referee
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '저장 실패');
    }
    
    // Rerender database
    el.resultModal.classList.add('hidden');
    await fetchData();
  } catch (err) {
    console.error(err);
    alert(err.message || '경기 결과를 저장하는데 실패했습니다.');
  }
}

// --- Save Team Mapping to Backend ---
async function saveAllMappings() {
  const inputs = document.querySelectorAll('.team-map-input');
  let successCount = 0;
  let totalCount = inputs.length;
  
  try {
    for (const input of inputs) {
      const id = input.id.replace('map-', '');
      const newName = input.value.trim();
      
      if (!newName) continue;
      
      const res = await fetch('/api/teams/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: state.adminPassword,
          teamId: id,
          newName
        })
      });
      
      if (res.ok) successCount++;
    }
    
    alert(`성공적으로 ${successCount}개 반 이름을 업데이트했습니다.`);
    el.adminModal.classList.add('hidden');
    await fetchData();
  } catch (err) {
    console.error(err);
    alert('학급 이름 매핑을 저장하는 중 오류가 발생했습니다.');
  }
}

// --- Reset Database ---
async function resetDatabase() {
  if (!confirm('정말로 모든 경기 결과를 초기화하시겠습니까?\n이 작업은 복구할 수 없으며 대기 상태로 변경됩니다.')) {
    return;
  }
  
  try {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: state.adminPassword })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '초기화 실패');
    }
    
    alert('대시보드가 성공적으로 초기화되었습니다.');
    el.adminModal.classList.add('hidden');
    await fetchData();
  } catch (err) {
    console.error(err);
    alert(err.message || '데이터 초기화에 실패했습니다.');
  }
}
