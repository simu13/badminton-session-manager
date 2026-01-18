const express = require('express');
const router = express.Router();
const db = require('../db');

// Record a game result
router.post('/:sessionId/games', (req, res) => {
  const { sessionId } = req.params;
  const { court_number, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_score, team2_score } = req.body;

  // Validate inputs
  if (!court_number || !team1_player1_id || !team1_player2_id || !team2_player1_id || !team2_player2_id ||
      team1_score === undefined || team2_score === undefined) {
    return res.status(400).json({ error: 'All game details are required' });
  }

  const transaction = db.transaction(() => {
    // Insert the game
    const gameStmt = db.prepare(`
      INSERT INTO games (session_id, court_number, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_score, team2_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = gameStmt.run(sessionId, court_number, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, team1_score, team2_score);

    // Update player stats
    const updatePlayerStmt = db.prepare(`
      UPDATE players
      SET last_played_at = CURRENT_TIMESTAMP, games_played = games_played + 1
      WHERE id = ?
    `);

    [team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id].forEach(playerId => {
      updatePlayerStmt.run(playerId);
    });

    // Clear court assignment for this court
    db.prepare('DELETE FROM court_assignments WHERE session_id = ? AND court_number = ?').run(sessionId, court_number);

    return result.lastInsertRowid;
  });

  const gameId = transaction();

  res.status(201).json({
    id: gameId,
    message: 'Game recorded successfully'
  });
});

// Get all games for a session
router.get('/:sessionId/games', (req, res) => {
  const { sessionId } = req.params;

  const games = db.prepare(`
    SELECT
      g.*,
      p1.name as team1_player1_name,
      p2.name as team1_player2_name,
      p3.name as team2_player1_name,
      p4.name as team2_player2_name
    FROM games g
    JOIN players p1 ON g.team1_player1_id = p1.id
    JOIN players p2 ON g.team1_player2_id = p2.id
    JOIN players p3 ON g.team2_player1_id = p3.id
    JOIN players p4 ON g.team2_player2_id = p4.id
    WHERE g.session_id = ?
    ORDER BY g.played_at DESC
  `).all(sessionId);

  res.json(games);
});

// Get next suggested matches (rotation algorithm)
router.post('/:sessionId/next-matches', (req, res) => {
  const { sessionId } = req.params;

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Get all players sorted by wait time (longest wait first, never played first)
  const availablePlayers = db.prepare(`
    SELECT p.id, p.name, p.last_played_at, p.games_played
    FROM players p
    WHERE p.session_id = ?
      AND p.id NOT IN (
        SELECT player1_id FROM court_assignments WHERE session_id = ?
        UNION SELECT player2_id FROM court_assignments WHERE session_id = ?
        UNION SELECT player3_id FROM court_assignments WHERE session_id = ?
        UNION SELECT player4_id FROM court_assignments WHERE session_id = ?
      )
    ORDER BY
      CASE WHEN p.last_played_at IS NULL THEN 0 ELSE 1 END,
      p.last_played_at ASC,
      p.games_played ASC
  `).all(sessionId, sessionId, sessionId, sessionId, sessionId);

  // Get current court assignments
  const currentAssignments = db.prepare(`
    SELECT
      ca.*,
      p1.name as player1_name,
      p2.name as player2_name,
      p3.name as player3_name,
      p4.name as player4_name
    FROM court_assignments ca
    JOIN players p1 ON ca.player1_id = p1.id
    JOIN players p2 ON ca.player2_id = p2.id
    JOIN players p3 ON ca.player3_id = p3.id
    JOIN players p4 ON ca.player4_id = p4.id
    WHERE ca.session_id = ?
    ORDER BY ca.court_number
  `).all(sessionId);

  // Find empty courts
  const assignedCourts = new Set(currentAssignments.map(a => a.court_number));
  const emptyCourts = [];
  for (let i = 1; i <= session.num_courts; i++) {
    if (!assignedCourts.has(i)) {
      emptyCourts.push(i);
    }
  }

  // Generate matches for empty courts
  const suggestedMatches = [];
  let playerIndex = 0;

  for (const courtNumber of emptyCourts) {
    if (playerIndex + 4 <= availablePlayers.length) {
      const players = availablePlayers.slice(playerIndex, playerIndex + 4);

      // Pair them: 1st+4th vs 2nd+3rd (to balance teams slightly by wait time)
      const match = {
        court_number: courtNumber,
        team1: [players[0], players[3]],
        team2: [players[1], players[2]]
      };

      suggestedMatches.push(match);
      playerIndex += 4;
    }
  }

  res.json({
    current_assignments: currentAssignments,
    suggested_matches: suggestedMatches,
    waiting_players: availablePlayers.slice(playerIndex),
    empty_courts: emptyCourts.length - suggestedMatches.length
  });
});

// Assign players to a court
router.post('/:sessionId/assign-court', (req, res) => {
  const { sessionId } = req.params;
  const { court_number, player1_id, player2_id, player3_id, player4_id } = req.body;

  if (!court_number || !player1_id || !player2_id || !player3_id || !player4_id) {
    return res.status(400).json({ error: 'Court number and 4 player IDs are required' });
  }

  // Use INSERT OR REPLACE to update if exists
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO court_assignments (session_id, court_number, player1_id, player2_id, player3_id, player4_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(sessionId, court_number, player1_id, player2_id, player3_id, player4_id);

  res.json({ message: 'Court assigned successfully' });
});

// Get current court assignments
router.get('/:sessionId/courts', (req, res) => {
  const { sessionId } = req.params;

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const assignments = db.prepare(`
    SELECT
      ca.*,
      p1.name as player1_name,
      p2.name as player2_name,
      p3.name as player3_name,
      p4.name as player4_name
    FROM court_assignments ca
    JOIN players p1 ON ca.player1_id = p1.id
    JOIN players p2 ON ca.player2_id = p2.id
    JOIN players p3 ON ca.player3_id = p3.id
    JOIN players p4 ON ca.player4_id = p4.id
    WHERE ca.session_id = ?
    ORDER BY ca.court_number
  `).all(sessionId);

  // Build full court list
  const courts = [];
  for (let i = 1; i <= session.num_courts; i++) {
    const assignment = assignments.find(a => a.court_number === i);
    courts.push({
      court_number: i,
      assignment: assignment || null
    });
  }

  res.json(courts);
});

// Clear court assignment
router.delete('/:sessionId/courts/:courtNumber', (req, res) => {
  const { sessionId, courtNumber } = req.params;

  db.prepare('DELETE FROM court_assignments WHERE session_id = ? AND court_number = ?').run(sessionId, courtNumber);

  res.json({ message: 'Court cleared successfully' });
});

module.exports = router;
