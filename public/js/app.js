// Main application state and logic
let currentSession = null;
let players = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadPreviousSessions();
  setupEventListeners();
  addInitialPlayerInputs();
});

function setupEventListeners() {
  // Setup form submission
  document.getElementById('setup-form').addEventListener('submit', handleCreateSession);

  // Score form submission
  document.getElementById('score-form').addEventListener('submit', handleScoreSubmit);
}

function addInitialPlayerInputs() {
  // Add initial player inputs (4 players minimum for one game)
  for (let i = 1; i < 4; i++) {
    addPlayerInput();
  }
}

// Player input management
function addPlayerInput() {
  const container = document.getElementById('player-inputs');
  const count = container.children.length + 1;

  const div = document.createElement('div');
  div.className = 'player-input';
  div.innerHTML = `
    <input type="text" class="player-name" placeholder="Player ${count}" required>
    <button type="button" class="btn-remove" onclick="removePlayer(this)">×</button>
  `;

  container.appendChild(div);
}

function removePlayer(button) {
  const container = document.getElementById('player-inputs');
  if (container.children.length > 1) {
    button.parentElement.remove();
    // Update placeholders
    Array.from(container.children).forEach((div, index) => {
      div.querySelector('input').placeholder = `Player ${index + 1}`;
    });
  }
}

// Session management
async function handleCreateSession(e) {
  e.preventDefault();

  const name = document.getElementById('session-name').value.trim();
  const numCourts = parseInt(document.getElementById('num-courts').value);
  const playerInputs = document.querySelectorAll('.player-name');
  const playerNames = Array.from(playerInputs)
    .map(input => input.value.trim())
    .filter(name => name);

  if (playerNames.length < 4) {
    alert('Please add at least 4 players');
    return;
  }

  try {
    // Create session
    const session = await API.createSession(name, numCourts);
    currentSession = { ...session, num_courts: numCourts, name };

    // Add players
    const playersResult = await API.addPlayers(session.id, playerNames);
    players = playersResult.players;

    // Switch to session screen
    showSessionScreen();

    // Auto-assign initial matches
    await autoAssignMatches();

  } catch (error) {
    alert('Error creating session: ' + error.message);
  }
}

async function loadPreviousSessions() {
  try {
    const sessions = await API.getAllSessions();
    const container = document.getElementById('sessions-list');

    if (sessions.length === 0) {
      container.innerHTML = '<p class="empty-state">No previous sessions</p>';
      return;
    }

    container.innerHTML = sessions.map(session => `
      <div class="session-item" onclick="loadSession(${session.id})">
        <div>
          <div class="name">${session.name}</div>
          <div class="date">${new Date(session.created_at).toLocaleDateString()}</div>
        </div>
        <span>${session.ended_at ? 'Ended' : 'Active'}</span>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

async function loadSession(sessionId) {
  try {
    currentSession = await API.getSession(sessionId);
    players = await API.getPlayers(sessionId);

    showSessionScreen();
    await refreshSessionData();

  } catch (error) {
    alert('Error loading session: ' + error.message);
  }
}

function showSessionScreen() {
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('summary-screen').classList.add('hidden');
  document.getElementById('session-screen').classList.remove('hidden');

  document.getElementById('session-title').textContent = currentSession.name;
}

function showSetupScreen() {
  document.getElementById('session-screen').classList.add('hidden');
  document.getElementById('summary-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
}

// Court display
async function refreshSessionData() {
  await Promise.all([
    renderCourts(),
    renderWaitingQueue(),
    renderGamesHistory(),
  ]);
}

async function renderCourts() {
  try {
    const courts = await API.getCourts(currentSession.id);
    const container = document.getElementById('courts-container');

    container.innerHTML = courts.map(court => {
      if (court.assignment) {
        const a = court.assignment;
        return `
          <div class="court-card">
            <div class="court-header">
              <h4>Court ${court.court_number}</h4>
              <span class="badge">In Progress</span>
            </div>
            <div class="court-teams">
              <div class="court-team">
                <h5>Team 1</h5>
                <p>${a.player1_name}</p>
                <p>${a.player2_name}</p>
              </div>
              <div class="court-vs">VS</div>
              <div class="court-team">
                <h5>Team 2</h5>
                <p>${a.player3_name}</p>
                <p>${a.player4_name}</p>
              </div>
            </div>
            <div class="court-actions">
              <button class="btn-end-game" onclick="openScoreModal(${court.court_number}, ${a.player1_id}, ${a.player2_id}, ${a.player3_id}, ${a.player4_id}, '${a.player1_name}', '${a.player2_name}', '${a.player3_name}', '${a.player4_name}')">
                End Game
              </button>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="court-card empty">
            <div class="court-header">
              <h4>Court ${court.court_number}</h4>
              <span class="badge">Empty</span>
            </div>
            <div class="empty-state">
              <p>No players assigned</p>
            </div>
          </div>
        `;
      }
    }).join('');

  } catch (error) {
    console.error('Error rendering courts:', error);
  }
}

async function renderWaitingQueue() {
  try {
    const waiting = await API.getWaitingPlayers(currentSession.id);
    const container = document.getElementById('waiting-queue');

    if (waiting.length === 0) {
      container.innerHTML = '<p class="empty-state">All players are on courts</p>';
      return;
    }

    container.innerHTML = waiting.map(player => `
      <div class="waiting-player">
        <span class="name">${player.name}</span>
        <span class="wait-info">
          ${Rotation.formatWaitTime(player.last_played_at)} | Games: ${player.games_played}
        </span>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error rendering waiting queue:', error);
  }
}

async function renderGamesHistory() {
  try {
    const games = await API.getGames(currentSession.id);
    const container = document.getElementById('games-list');

    if (games.length === 0) {
      container.innerHTML = '<p class="empty-state">No games played yet</p>';
      return;
    }

    // Show last 5 games
    const recentGames = games.slice(0, 5);

    container.innerHTML = recentGames.map(game => {
      const winner = game.team1_score > game.team2_score ? 'team1' : 'team2';
      return `
        <div class="game-item">
          <div class="teams">
            <span class="${winner === 'team1' ? 'winner' : ''}">
              ${game.team1_player1_name} & ${game.team1_player2_name}
            </span>
            <span> vs </span>
            <span class="${winner === 'team2' ? 'winner' : ''}">
              ${game.team2_player1_name} & ${game.team2_player2_name}
            </span>
          </div>
          <div class="score">${game.team1_score} - ${game.team2_score}</div>
          <div class="time">Court ${game.court_number}</div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error rendering games:', error);
  }
}

// Auto-assign matches
async function autoAssignMatches() {
  try {
    const result = await API.getNextMatches(currentSession.id);

    // Assign suggested matches to courts
    for (const match of result.suggested_matches) {
      await API.assignCourt(currentSession.id, {
        court_number: match.court_number,
        player1_id: match.team1[0].id,
        player2_id: match.team1[1].id,
        player3_id: match.team2[0].id,
        player4_id: match.team2[1].id,
      });
    }

    // Refresh display
    await refreshSessionData();

  } catch (error) {
    console.error('Error auto-assigning matches:', error);
  }
}

// Score modal
function openScoreModal(courtNumber, p1Id, p2Id, p3Id, p4Id, p1Name, p2Name, p3Name, p4Name) {
  document.getElementById('score-court-number').value = courtNumber;
  document.getElementById('score-player1-id').value = p1Id;
  document.getElementById('score-player2-id').value = p2Id;
  document.getElementById('score-player3-id').value = p3Id;
  document.getElementById('score-player4-id').value = p4Id;

  document.getElementById('score-team1-names').textContent = `${p1Name} & ${p2Name}`;
  document.getElementById('score-team2-names').textContent = `${p3Name} & ${p4Name}`;

  document.getElementById('team1-score').value = '';
  document.getElementById('team2-score').value = '';

  document.getElementById('score-modal').classList.remove('hidden');
}

function closeScoreModal() {
  document.getElementById('score-modal').classList.add('hidden');
}

async function handleScoreSubmit(e) {
  e.preventDefault();

  const gameData = {
    court_number: parseInt(document.getElementById('score-court-number').value),
    team1_player1_id: parseInt(document.getElementById('score-player1-id').value),
    team1_player2_id: parseInt(document.getElementById('score-player2-id').value),
    team2_player1_id: parseInt(document.getElementById('score-player3-id').value),
    team2_player2_id: parseInt(document.getElementById('score-player4-id').value),
    team1_score: parseInt(document.getElementById('team1-score').value),
    team2_score: parseInt(document.getElementById('team2-score').value),
  };

  try {
    await API.recordGame(currentSession.id, gameData);
    closeScoreModal();

    // Auto-assign next match for this court
    await autoAssignMatches();

  } catch (error) {
    alert('Error recording game: ' + error.message);
  }
}

// Summary
async function showSummary() {
  try {
    const summary = await API.getSessionSummary(currentSession.id);

    document.getElementById('session-screen').classList.add('hidden');
    document.getElementById('summary-screen').classList.remove('hidden');

    // Overview
    document.getElementById('summary-overview').innerHTML = `
      <p><strong>Session:</strong> ${summary.session.name}</p>
      <p><strong>Total Games:</strong> ${summary.total_games}</p>
      <p><strong>Players:</strong> ${summary.players.length}</p>
      ${summary.most_wins ? `<p><strong>Most Wins:</strong> ${summary.most_wins.name} (${summary.most_wins.wins} wins)</p>` : ''}
    `;

    // Player stats table
    const tbody = document.querySelector('#player-stats-table tbody');
    tbody.innerHTML = summary.players.map(player => `
      <tr>
        <td>${player.name}</td>
        <td>${player.games_played}</td>
        <td>${player.wins}</td>
        <td>${player.losses}</td>
        <td>${player.win_rate}%</td>
      </tr>
    `).join('');

    // Partnerships
    const partnershipsContainer = document.getElementById('partnerships-list');
    if (summary.top_partnerships.length > 0) {
      partnershipsContainer.innerHTML = summary.top_partnerships.map(p => `
        <div class="partnership-item">
          <span>${p.player1} & ${p.player2}</span>
          <span>${p.wins_together} wins / ${p.games_together} games</span>
        </div>
      `).join('');
    } else {
      partnershipsContainer.innerHTML = '<p class="empty-state">No partnership data yet</p>';
    }

  } catch (error) {
    alert('Error loading summary: ' + error.message);
  }
}

function backToSession() {
  document.getElementById('summary-screen').classList.add('hidden');
  document.getElementById('session-screen').classList.remove('hidden');
}

async function endSession() {
  if (!confirm('Are you sure you want to end this session?')) {
    return;
  }

  try {
    await API.endSession(currentSession.id);
    await showSummary();

  } catch (error) {
    alert('Error ending session: ' + error.message);
  }
}
