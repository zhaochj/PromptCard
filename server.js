/**
 * PromptCard 后端服务器
 * 
 * 功能模块：
 * - 提供提示词（Prompt）的 CRUD 接口
 * - 支持分页查询、搜索和标签过滤
 * - 使用 SQLite 数据库存储数据
 * - 支持环境变量配置（端口、数据库路径）
 * 
 * @author PromptCard Team
 * @version 1.0.0
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// ==================== 服务器配置 ====================

const app = express();
const port = process.env.PORT || 3000;

// ==================== 数据库配置 ====================

/**
 * 连接 SQLite 数据库
 * 数据库路径优先从环境变量 DB_PATH 读取，否则使用默认值 './prompts.db'
 */
const dbPath = process.env.DB_PATH || './prompts.db';
const db = new sqlite3.Database(dbPath);

// 初始化数据库表结构
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

// ==================== 中间件配置 ====================

// 解析 JSON 请求体
app.use(express.json());
// 解析 URL 编码请求体
app.use(express.urlencoded({ extended: true }));
// 托管静态文件（public 目录）
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 数据库操作辅助函数 ====================

/**
 * 执行数据库写操作（INSERT、UPDATE、DELETE）
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<{id: number, changes: number}>} 包含最后插入 ID 和影响行数
 */
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});

/**
 * 执行数据库查询操作（单条记录）
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<Object>} 查询结果对象
 */
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

/**
 * 执行数据库查询操作（多条记录）
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<Array>} 查询结果数组
 */
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

// ==================== 错误处理中间件 ====================

/**
 * 异步错误处理包装器
 * 统一捕获异步函数中的错误并返回 500 状态码
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} Express 中间件函数
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    res.status(500).json({ error: err.message });
  });
};

// ==================== 参数验证函数 ====================

/**
 * 验证 ID 参数
 * @param {string|number} id - 待验证的 ID
 * @returns {number} 验证通过后的数字 ID
 * @throws {Error} ID 无效时抛出错误
 */
const validateId = (id) => {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed) || parsed <= 0) throw new Error('无效的 ID');
  return parsed;
};

/**
 * 验证分页参数
 * @param {string|number} page - 页码
 * @param {string|number} limit - 每页数量
 * @returns {{page: number, limit: number}} 验证后的分页参数
 */
const validatePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { page: p, limit: l };
};

// ==================== API 路由 ====================

/**
 * GET /api/prompts - 获取提示词列表
 * 支持分页、搜索和标签过滤
 * 查询参数：
 * - search: 搜索关键词（模糊匹配 content 字段）
 * - tag: 标签过滤（模糊匹配 tags 字段）
 * - page: 页码（默认 1）
 * - limit: 每页数量（默认 20，最大 100）
 */
app.get('/api/prompts', asyncHandler(async (req, res) => {
  const { search, tag, page = 1, limit = 20 } = req.query;
  const { page: p, limit: l } = validatePagination(page, limit);
  const offset = (p - 1) * l;

  const whereClause = [];
  const params = [];

  // 构建搜索条件
  if (search) {
    whereClause.push('content LIKE ?');
    params.push(`%${search}%`);
  }
  // 构建标签过滤条件
  if (tag) {
    whereClause.push('tags LIKE ?');
    params.push(`%${tag}%`);
  }

  const where = whereClause.length ? ' WHERE ' + whereClause.join(' AND ') : '';
  
  // 获取总数
  const countResult = await dbGet(`SELECT COUNT(*) as total FROM prompts${where}`, params);
  
  // 获取数据（按创建时间倒序）
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

/**
 * POST /api/prompts - 添加提示词
 * 请求体：
 * - content: 提示词内容（必填，不能为空）
 * - tags: 标签（可选，逗号分隔）
 */
app.post('/api/prompts', asyncHandler(async (req, res) => {
  const { content, tags } = req.body;
  if (!content?.trim()) throw new Error('提示词内容不能为空');

  const result = await dbRun('INSERT INTO prompts (content, tags) VALUES (?, ?)', [content, tags]);
  res.json({ id: result.id, content, tags });
}));

/**
 * GET /api/tags - 获取所有标签
 * 从所有提示词中提取标签，去重后返回排序数组
 */
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

/**
 * PUT /api/prompts/:id - 更新提示词
 * 路径参数：
 * - id: 提示词 ID
 * 请求体：
 * - content: 提示词内容（必填）
 * - tags: 标签（可选）
 */
app.put('/api/prompts/:id', asyncHandler(async (req, res) => {
  const id = validateId(req.params.id);
  const { content, tags } = req.body;
  if (!content?.trim()) throw new Error('提示词内容不能为空');

  await dbRun('UPDATE prompts SET content = ?, tags = ? WHERE id = ?', [content, tags, id]);
  res.json({ id, content, tags });
}));

/**
 * DELETE /api/prompts/:id - 删除提示词
 * 路径参数：
 * - id: 提示词 ID
 */
app.delete('/api/prompts/:id', asyncHandler(async (req, res) => {
  const id = validateId(req.params.id);
  await dbRun('DELETE FROM prompts WHERE id = ?', [id]);
  res.json({ success: true });
}));

// ==================== 服务器启动 ====================

// 启动服务器，仅监听本地地址（安全考虑）
app.listen(port, '127.0.0.1', () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});

// ==================== 优雅关闭处理 ====================

/**
 * 关闭数据库连接并退出进程
 * 用于处理系统信号，确保资源正确释放
 */
const closeDb = () => {
  db.close((err) => {
    if (err) console.error('数据库关闭错误:', err);
    else console.log('数据库连接已关闭');
    process.exit(err ? 1 : 0);
  });
};

// 监听中断信号（Ctrl+C）
process.on('SIGINT', closeDb);
// 监听终止信号（系统服务停止）
process.on('SIGTERM', closeDb);
