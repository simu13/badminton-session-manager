const express = require('express');
const cors = require('cors');
const path = require('path');

const sessionsRouter = require('./routes/sessions');
const playersRouter = require('./routes/players');
const gamesRouter = require('./routes/games');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/sessions', playersRouter);
app.use('/api/sessions', gamesRouter);

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Badminton Session Manager running at http://localhost:${PORT}`);
});
