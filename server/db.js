const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'badminton.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Sessions table
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    num_courts INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  );

  -- Players table
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    name TEXT,
    last_played_at DATETIME,
    games_played INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Games table
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    court_number INTEGER,
    team1_player1_id INTEGER,
    team1_player2_id INTEGER,
    team2_player1_id INTEGER,
    team2_player2_id INTEGER,
    team1_score INTEGER,
    team2_score INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (team1_player1_id) REFERENCES players(id),
    FOREIGN KEY (team1_player2_id) REFERENCES players(id),
    FOREIGN KEY (team2_player1_id) REFERENCES players(id),
    FOREIGN KEY (team2_player2_id) REFERENCES players(id)
  );

  -- Current court assignments (tracks who is currently playing on each court)
  CREATE TABLE IF NOT EXISTS court_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    court_number INTEGER,
    player1_id INTEGER,
    player2_id INTEGER,
    player3_id INTEGER,
    player4_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    UNIQUE(session_id, court_number)
  );
`);

module.exports = db;
