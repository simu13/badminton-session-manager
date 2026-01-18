const express = require('express');
const router = express.Router();
const db = require('../db');

// Add players to session
router.post('/:sessionId/players', (req, res) => {
  const { sessionId } = req.params;
  const { players } = req.body;

  if (!players || !Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'Players array is required' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const stmt = db.prepare('INSERT INTO players (session_id, name) VALUES (?, ?)');
  const insertedPlayers = [];

  const insertMany = db.transaction((players) => {
    for (const name of players) {
      const result = stmt.run(sessionId, name);
      insertedPlayers.push({
        id: result.lastInsertRowid,
        name,
        session_id: parseInt(sessionId)
      });
    }
  });

  insertMany(players);

  res.status(201).json({
    message: 'Players added successfully',
    players: insertedPlayers
  });
});

// Get all players for a session
router.get('/:sessionId/players', (req, res) => {
  const { sessionId } = req.params;

  const players = db.prepare(`
    SELECT id, name, last_played_at, games_played
    FROM players
    WHERE session_id = ?
    ORDER BY name
  `).all(sessionId);

  res.json(players);
});

// Get waiting players (not currently on any court)
router.get('/:sessionId/waiting', (req, res) => {
  const { sessionId } = req.params;

  const waitingPlayers = db.prepare(`
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

  res.json(waitingPlayers);
});

module.exports = router;
