const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const BACKUP_PATH = path.join(__dirname, 'data', 'db_backup.json');

// Ensure backup database exists on startup (with try-catch for serverless environments)
if (fs.existsSync(DB_PATH) && !fs.existsSync(BACKUP_PATH)) {
  try {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log('Created db_backup.json on startup.');
  } catch (err) {
    console.log('Could not create backup on startup (likely read-only filesystem on Vercel).');
  }
}

// Helper to read DB (local filesystem)
function readLocalDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local DB:', err);
    return null;
  }
}

// Helper to read DB (Supports Vercel KV & Local fallback)
async function readDB() {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (KV_URL && KV_TOKEN) {
    try {
      const response = await fetch(KV_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', 'pigu_db'])
      });
      if (!response.ok) {
        throw new Error(`KV read failed: ${response.statusText}`);
      }
      const resJson = await response.json();
      if (resJson.result) {
        return JSON.parse(resJson.result);
      } else {
        console.log('pigu_db key not found in KV. Bootstrapping with local db.json...');
        const localDb = readLocalDB();
        if (localDb) {
          await writeDB(localDb);
          return localDb;
        }
      }
    } catch (err) {
      console.error('Error reading KV:', err);
      return readLocalDB();
    }
  }

  return readLocalDB();
}

// Helper to write DB (Supports Vercel KV & Local fallback)
async function writeDB(data) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (KV_URL && KV_TOKEN) {
    try {
      const response = await fetch(KV_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', 'pigu_db', JSON.stringify(data)])
      });
      if (!response.ok) {
        throw new Error(`KV write failed: ${response.statusText}`);
      }
      return true;
    } catch (err) {
      console.error('Error writing KV:', err);
      return false;
    }
  }

  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing local DB:', err);
    return false;
  }
}

// 1. GET /api/data
app.get('/api/data', async (req, res) => {
  const db = await readDB();
  if (!db) {
    return res.status(500).json({ error: '데이터베이스를 읽을 수 없습니다.' });
  }
  res.json(db);
});

// 2. POST /api/match/result
app.post('/api/match/result', async (req, res) => {
  console.log('Received match result request:', req.body);
  const { password, matchId, winnerId, loserId, referee, manners } = req.body;
  
  if (password !== '0000') {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  
  const db = await readDB();
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
      is_draw: false,
      manners: manners || []
    };
  }
  
  // Update referee name if provided
  if (referee !== undefined) {
    match.referee = referee;
  }
  
  if (await writeDB(db)) {
    res.json({ success: true, data: match });
  } else {
    res.status(500).json({ error: '데이터를 저장하는 중 오류가 발생했습니다.' });
  }
});

// 3. POST /api/teams/mapping
app.post('/api/teams/mapping', async (req, res) => {
  const { password, teamId, newName } = req.body;
  
  if (password !== '0000') {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  
  const db = await readDB();
  if (!db) {
    return res.status(500).json({ error: '데이터베이스를 읽을 수 없습니다.' });
  }
  
  if (!db.teams[teamId]) {
    return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
  }
  
  db.teams[teamId].name = newName;
  
  if (await writeDB(db)) {
    res.json({ success: true, team: db.teams[teamId] });
  } else {
    res.status(500).json({ error: '데이터를 저장하는 중 오류가 발생했습니다.' });
  }
});

// 4. POST /api/reset
app.post('/api/reset', async (req, res) => {
  const { password } = req.body;
  
  if (password !== '0000') {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  
  if (!fs.existsSync(BACKUP_PATH)) {
    return res.status(500).json({ error: '백업 파일이 존재하지 않습니다.' });
  }
  
  try {
    const backupDataString = fs.readFileSync(BACKUP_PATH, 'utf8');
    const backupDb = JSON.parse(backupDataString);
    
    if (await writeDB(backupDb)) {
      res.json({ success: true, data: backupDb });
    } else {
      res.status(500).json({ error: '데이터베이스 초기화 중 오류가 발생했습니다.' });
    }
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: '데이터베이스 초기화 중 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
