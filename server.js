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

// 数据库操作辅助函数 - 将回调转换为Promise
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

// 错误处理中间件 - 统一处理异步错误
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    res.status(500).json({ error: err.message });
  });
};

// 参数验证函数
const validateId = (id) => {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed) || parsed <= 0) throw new Error('无效的 ID');
  return parsed;
};

const validatePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { page: p, limit: l };
};

// API 路由

// 获取提示词列表（支持分页、搜索、标签过滤）
app.get('/api/prompts', asyncHandler(async (req, res) => {
  const { search, tag, page = 1, limit = 20 } = req.query;
  const { page: p, limit: l } = validatePagination(page, limit);
  const offset = (p - 1) * l;

  const whereClause = [];
  const params = [];

  if (search) {
    whereClause.push('content LIKE ?');
    params.push(`%${search}%`);
  }
  if (tag) {
    whereClause.push('tags LIKE ?');
    params.push(`%${tag}%`);
  }

  const where = whereClause.length ? ' WHERE ' + whereClause.join(' AND ') : '';
  const countResult = await dbGet(`SELECT COUNT(*) as total FROM prompts${where}`, params);
  const rows = await dbAll(
    `SELECT * FROM prompts${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  res.json({
    data: rows,
    pagination: {
      total: countResult.total,
      page: p,
      limit: l,
      totalPages: Math.ceil(countResult.total / l)
    }
  });
}));

// 添加提示词
app.post('/api/prompts', asyncHandler(async (req, res) => {
  const { content, tags } = req.body;
  if (!content?.trim()) throw new Error('提示词内容不能为空');

  const result = await dbRun('INSERT INTO prompts (content, tags) VALUES (?, ?)', [content, tags]);
  res.json({ id: result.id, content, tags });
}));

// 获取所有标签
app.get('/api/tags', asyncHandler(async (req, res) => {
  const rows = await dbAll('SELECT tags FROM prompts');
  const tagsSet = new Set();

  rows.forEach(row => {
    if (row.tags) {
      row.tags.split(',').forEach(tag => {
        const trimmed = tag.trim();
        if (trimmed) tagsSet.add(trimmed);
      });
    }
  });

  res.json(Array.from(tagsSet).sort());
}));

// 更新提示词
app.put('/api/prompts/:id', asyncHandler(async (req, res) => {
  const id = validateId(req.params.id);
  const { content, tags } = req.body;
  if (!content?.trim()) throw new Error('提示词内容不能为空');

  await dbRun('UPDATE prompts SET content = ?, tags = ? WHERE id = ?', [content, tags, id]);
  res.json({ id, content, tags });
}));

// 删除提示词
app.delete('/api/prompts/:id', asyncHandler(async (req, res) => {
  const id = validateId(req.params.id);
  await dbRun('DELETE FROM prompts WHERE id = ?', [id]);
  res.json({ success: true });
}));

// 启动服务器
app.listen(port, '127.0.0.1', () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});

// 优雅关闭数据库连接
const closeDb = () => {
  db.close((err) => {
    if (err) console.error('数据库关闭错误:', err);
    else console.log('数据库连接已关闭');
    process.exit(err ? 1 : 0);
  });
};

process.on('SIGINT', closeDb);
process.on('SIGTERM', closeDb);