import express from 'express';
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Turso database connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

// API: Execute SQL
app.post('/api/sql/exec', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'Missing sql' });
    await db.execute(sql);
    res.json({ ok: true });
  } catch (err) {
    console.error('SQL exec error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Query SQL
app.post('/api/sql/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'Missing sql' });
    const result = await db.execute(sql);
    const rows = result.rows.map(row => {
      const obj = {};
      for (const col of result.columns) {
        obj[col] = row[col];
      }
      return obj;
    });
    res.json(rows);
  } catch (err) {
    console.error('SQL query error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Community Fridge Tracker running on port ' + PORT);
});
