const express = require('express');
const router = express.Router();
const db = require('../db');

// Create new session
router.post('/', (req, res) => {
  const { name, num_courts } = req.body;

  if (!name || !num_courts) {
    return res.status(400).json({ error: 'Name and number of courts are required' });
  }

  const stmt = db.prepare('INSERT INTO sessions (name, num_courts) VALUES (?, ?)');
  const result = stmt.run(name, num_courts);

  res.status(201).json({
    id: result.lastInsertRowid,
    name,
    num_courts,
    message: 'Session created successfully'
  });
});

// Get session details
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
});

// End session
router.put('/:id/end', (req, res) => {
  const { id } = req.params;

  const stmt = db.prepare('UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(id);

  res.json({ message: 'Session ended successfully' });
});

// Get all sessions
router.get('/', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
  res.json(sessions);
});

// Get session summary
router.get('/:id/summary', (req, res) => {
  const { id } = req.params;

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Get all players with their stats
  const players = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.games_played,
      COALESCE(wins.win_count, 0) as wins,
      COALESCE(losses.loss_count, 0) as losses
    FROM players p
    LEFT JOIN (
      SELECT player_id, COUNT(*) as win_count FROM (
        SELECT team1_player1_id as player_id FROM games WHERE session_id = ? AND team1_score > team2_score
        UNION ALL
        SELECT team1_player2_id FROM games WHERE session_id = ? AND team1_score > team2_score
        UNION ALL
        SELECT team2_player1_id FROM games WHERE session_id = ? AND team2_score > team1_score
        UNION ALL
        SELECT team2_player2_id FROM games WHERE session_id = ? AND team2_score > team1_score
      ) GROUP BY player_id
    ) wins ON p.id = wins.player_id
    LEFT JOIN (
      SELECT player_id, COUNT(*) as loss_count FROM (
        SELECT team1_player1_id as player_id FROM games WHERE session_id = ? AND team1_score < team2_score
        UNION ALL
        SELECT team1_player2_id FROM games WHERE session_id = ? AND team1_score < team2_score
        UNION ALL
        SELECT team2_player1_id FROM games WHERE session_id = ? AND team2_score < team1_score
        UNION ALL
        SELECT team2_player2_id FROM games WHERE session_id = ? AND team2_score < team1_score
      ) GROUP BY player_id
    ) losses ON p.id = losses.player_id
    WHERE p.session_id = ?
    ORDER BY wins DESC, p.games_played DESC
  `).all(id, id, id, id, id, id, id, id, id);

  // Calculate win rates
  const playersWithStats = players.map(p => ({
    ...p,
    win_rate: p.games_played > 0 ? ((p.wins / p.games_played) * 100).toFixed(1) : '0.0'
  }));

  // Get total games
  const totalGames = db.prepare('SELECT COUNT(*) as count FROM games WHERE session_id = ?').get(id).count;

  // Get partnership stats (most wins together)
  const partnerships = db.prepare(`
    SELECT
      p1.name as player1,
      p2.name as player2,
      COUNT(*) as games_together,
      SUM(CASE WHEN
        (g.team1_player1_id IN (p1.id, p2.id) AND g.team1_player2_id IN (p1.id, p2.id) AND g.team1_score > g.team2_score)
        OR
        (g.team2_player1_id IN (p1.id, p2.id) AND g.team2_player2_id IN (p1.id, p2.id) AND g.team2_score > g.team1_score)
      THEN 1 ELSE 0 END) as wins_together
    FROM games g
    JOIN players p1 ON p1.session_id = ?
    JOIN players p2 ON p2.session_id = ? AND p2.id > p1.id
    WHERE g.session_id = ?
      AND (
        (g.team1_player1_id = p1.id AND g.team1_player2_id = p2.id)
        OR (g.team1_player1_id = p2.id AND g.team1_player2_id = p1.id)
        OR (g.team2_player1_id = p1.id AND g.team2_player2_id = p2.id)
        OR (g.team2_player1_id = p2.id AND g.team2_player2_id = p1.id)
      )
    GROUP BY p1.id, p2.id
    ORDER BY wins_together DESC, games_together DESC
    LIMIT 5
  `).all(id, id, id);

  res.json({
    session,
    total_games: totalGames,
    players: playersWithStats,
    top_partnerships: partnerships,
    most_wins: playersWithStats.length > 0 ? playersWithStats[0] : null
  });
});

module.exports = router;
