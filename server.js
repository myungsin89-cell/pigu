const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const BACKUP_PATH = path.join(__dirname, 'data', 'db_backup.json');

// Ensure backup database exists on startup
if (fs.existsSync(DB_PATH) && !fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('Created db_backup.json on startup.');
}

// Helper to read DB
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return null;
  }
}

// Helper to write DB
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

// 1. GET /api/data
app.get('/api/data', (req, res) => {
  const db = readDB();
  if (!db) {
    return res.status(500).json({ error: '데이터베이스를 읽을 수 없습니다.' });
  }
  res.json(db);
});

// 2. POST /api/match/result
app.post('/api/match/result', (req, res) => {
  const { password, matchId, winnerId, loserId, referee } = req.body;
  
  if (password !== '0000') {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  
  const db = readDB();
  if (!db) {
    return res.status(500).json({ error: '데이터베이스를 읽을 수 없습니다.' });
  }
  
  // Find in regular matches
  let match = db.matches.find(m => m.id === matchId);
  let isPlayoff = false;
  
  if (!match) {
    // Check in playoffs
    match = db.playoffs.find(m => m.id === matchId);
    isPlayoff = true;
  }
  
  if (!match) {
    return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
  }
  
  // Update result
  if (winnerId === null && loserId === null) {
    // Reset result
    match.result = null;
  } else {
    match.result = {
      winner_id: winnerId,
      loser_id: loserId,
      is_draw: false
    };
  }
  
  // Update referee name if provided
  if (referee !== undefined) {
    match.referee = referee;
  }
  
  if (writeDB(db)) {
    res.json({ success: true, data: match });
  } else {
    res.status(500).json({ error: '데이터를 저장하는 중 오류가 발생했습니다.' });
  }
});

// 3. POST /api/teams/mapping
app.post('/api/teams/mapping', (req, res) => {
  const { password, teamId, newName } = req.body;
  
  if (password !== '0000') {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  
  const db = readDB();
  if (!db) {
    return res.status(500).json({ error: '데이터베이스를 읽을 수 없습니다.' });
  }
  
  if (!db.teams[teamId]) {
    return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
  }
  
  db.teams[teamId].name = newName;
  
  if (writeDB(db)) {
    res.json({ success: true, team: db.teams[teamId] });
  } else {
    res.status(500).json({ error: '데이터를 저장하는 중 오류가 발생했습니다.' });
  }
});

// 4. POST /api/reset
app.post('/api/reset', (req, res) => {
  const { password } = req.body;
  
  if (password !== '0000') {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  
  if (!fs.existsSync(BACKUP_PATH)) {
    return res.status(500).json({ error: '백업 파일이 존재하지 않습니다.' });
  }
  
  try {
    fs.copyFileSync(BACKUP_PATH, DB_PATH);
    const db = readDB();
    res.json({ success: true, data: db });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: '데이터베이스 초기화 중 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
