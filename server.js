const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// 连接SQLite数据库
const db = new sqlite3.Database('./prompts.db');

// 初始化数据库
db.serialize(() => {
  // 创建提示词表
  db.run(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API接口

// 获取所有提示词
app.get('/api/prompts', (req, res) => {
  const { search, tag } = req.query;
  let query = 'SELECT * FROM prompts';
  let params = [];
  
  if (search || tag) {
    query += ' WHERE';
    if (search) {
      query += ' content LIKE ?';
      params.push(`%${search}%`);
    }
    if (search && tag) {
      query += ' AND';
    }
    if (tag) {
      query += ' tags LIKE ?';
      params.push(`%${tag}%`);
    }
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 添加提示词
app.post('/api/prompts', (req, res) => {
  const { content, tags } = req.body;
  
  if (!content) {
    res.status(400).json({ error: '提示词内容不能为空' });
    return;
  }
  
  db.run(
    'INSERT INTO prompts (content, tags) VALUES (?, ?)',
    [content, tags],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, content, tags });
    }
  );
});

// 获取所有标签
app.get('/api/tags', (req, res) => {
  db.all('SELECT tags FROM prompts', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const tagsSet = new Set();
    rows.forEach(row => {
      if (row.tags) {
        row.tags.split(',').forEach(tag => {
          if (tag.trim()) {
            tagsSet.add(tag.trim());
          }
        });
      }
    });
    
    res.json(Array.from(tagsSet));
  });
});

// 删除提示词
app.delete('/api/prompts/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM prompts WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});