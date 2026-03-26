const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 连接SQLite数据库
const dbPath = process.env.DB_PATH || './prompts.db';
const db = new sqlite3.Database(dbPath);

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

// 获取提示词列表（支持分页）
app.get('/api/prompts', (req, res) => {
  const { search, tag, page = 1, limit = 20 } = req.query;
  // 限制limit最大值为100
  const safeLimit = Math.min(parseInt(limit) || 20, 100);
  const offset = (parseInt(page) - 1) * safeLimit;
  
  let countQuery = 'SELECT COUNT(*) as total FROM prompts';
  let dataQuery = 'SELECT * FROM prompts';
  let countParams = [];
  let dataParams = [];
  
  if (search || tag) {
    const whereClause = [];
    if (search) {
      whereClause.push('content LIKE ?');
      countParams.push(`%${search}%`);
      dataParams.push(`%${search}%`);
    }
    if (tag) {
      whereClause.push('tags LIKE ?');
      countParams.push(`%${tag}%`);
      dataParams.push(`%${tag}%`);
    }
    const whereString = ' WHERE ' + whereClause.join(' AND ');
    countQuery += whereString;
    dataQuery += whereString;
  }
  
  dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  dataParams.push(safeLimit, offset);
  
  // 先获取总数
  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 再获取数据
    db.all(dataQuery, dataParams, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        data: rows,
        pagination: {
          total: countResult.total,
          page: parseInt(page),
          limit: safeLimit,
          totalPages: Math.ceil(countResult.total / safeLimit)
        }
      });
    });
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

// 更新提示词
app.put('/api/prompts/:id', (req, res) => {
  const { id } = req.params;
  const { content, tags } = req.body;
  
  if (!content) {
    res.status(400).json({ error: '提示词内容不能为空' });
    return;
  }
  
  db.run(
    'UPDATE prompts SET content = ?, tags = ? WHERE id = ?',
    [content, tags, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, content, tags });
    }
  );
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
app.listen(port, '127.0.0.1', () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});

// 处理进程退出，关闭数据库连接
process.on('SIGINT', () => {
  db.close(() => {
    console.log('数据库连接已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  db.close(() => {
    console.log('数据库连接已关闭');
    process.exit(0);
  });
});