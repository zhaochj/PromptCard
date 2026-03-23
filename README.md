# PromptCard

## 项目概述

PromptCard是一个基于Node.js和SQLite的本地应用，用于管理和搜索提示词。系统具有以下功能：

- 瀑布流卡片布局展示提示词
- 一键复制提示词功能
- 自主添加提示词并打标签
- 支持按标签或关键词搜索
- 本地SQLite数据库存储
- 删除提示词功能

## 系统要求

- Node.js 14.0 或更高版本
- npm 6.0 或更高版本
- 操作系统：Windows、macOS、Linux

## 安装步骤

### 1. 克隆项目

```bash
# 克隆项目到本地
git clone <项目仓库地址>
cd PromptCard
```

### 2. 安装依赖

```bash
# 安装项目依赖
npm install
```

### 3. 启动服务器

```bash
# 启动开发服务器
npm start

# 或使用nodemon进行开发（需要安装nodemon）
npm run dev
```

服务器默认运行在 `http://localhost:3000`

## 项目结构

```
PromptCard/
├── public/              # 前端静态文件
│   └── index.html       # 前端页面
├── server.js            # 后端服务器
├── package.json         # 项目配置
├── package-lock.json    # 依赖锁文件
├── prompts.db           # SQLite数据库文件
└── README.md            # 项目说明文档
```

## 数据库说明

系统使用SQLite数据库存储提示词数据，数据库文件为 `prompts.db`。

### 数据库结构

```sql
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  tags TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- `id`：提示词ID（自增）
- `content`：提示词内容
- `tags`：提示词标签（逗号分隔）
- `created_at`：创建时间

## API接口

### 1. 获取提示词列表

- **URL**：`/api/prompts`
- **方法**：GET
- **参数**：
  - `search`：搜索关键词（可选）
  - `tag`：标签筛选（可选）
- **返回**：提示词列表

### 2. 添加提示词

- **URL**：`/api/prompts`
- **方法**：POST
- **参数**：
  - `content`：提示词内容（必填）
  - `tags`：提示词标签（可选）
- **返回**：创建的提示词信息

### 3. 删除提示词

- **URL**：`/api/prompts/:id`
- **方法**：DELETE
- **参数**：
  - `id`：提示词ID（路径参数）
- **返回**：删除结果

### 4. 获取标签列表

- **URL**：`/api/tags`
- **方法**：GET
- **返回**：所有标签列表

## 前端功能

### 1. 添加提示词

1. 点击"添加提示词"按钮
2. 在弹出的表单中输入提示词内容
3. 输入标签（多个标签用逗号分隔）
4. 点击"保存"按钮

### 2. 搜索提示词

1. 在搜索框中输入关键词
2. 或从标签下拉菜单中选择标签
3. 系统会实时过滤显示匹配的提示词

### 3. 复制提示词

1. 点击提示词卡片上的"复制"按钮
2. 提示词会被复制到剪贴板
3. 按钮会显示"已复制!"的反馈

### 4. 删除提示词

1. 点击提示词卡片上的"删除"按钮
2. 确认删除操作
3. 提示词会被删除并从页面中移除

## 部署到生产环境

### 1. 使用PM2管理进程

```bash
# 安装PM2
npm install -g pm2

# 启动应用
npm start

# 或使用PM2启动
pm2 start server.js
```

### 2. 配置环境变量

可以创建 `.env` 文件来配置环境变量：

```
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_PATH=./prompts.db
```

- `PORT`：服务器端口
- `DB_PATH`：数据库文件路径，默认值为 `./prompts.db`

### 3. 数据库备份

定期备份 `prompts.db` 文件以防止数据丢失：

```bash
# 备份数据库
cp prompts.db prompts.db.bak
```

## 常见问题

### 1. 服务器无法启动

- 检查端口是否被占用
- 检查Node.js版本是否符合要求
- 检查依赖是否正确安装

### 2. 数据库文件丢失

- 恢复从备份文件 `prompts.db.bak`
- 重新创建数据库（会丢失所有数据）

### 3. 搜索功能不工作

- 检查浏览器控制台是否有错误
- 检查网络连接是否正常
- 检查服务器是否正在运行

## 维护建议

1. **定期备份**：定期备份 `prompts.db` 文件
2. **更新依赖**：定期运行 `npm update` 更新依赖包
3. **监控运行状态**：使用PM2等工具监控应用运行状态
4. **安全检查**：定期检查应用安全性，确保没有漏洞

## 技术支持

如果遇到问题，请检查以下资源：

- 查看服务器日志获取错误信息
- 检查浏览器控制台的错误信息
- 确保Node.js和npm版本符合要求
- 确保数据库文件有正确的读写权限

---

**注意**：本系统是一个本地应用，所有数据存储在本地SQLite数据库中，不会上传到任何服务器。请妥善保管数据库文件以防止数据丢失。