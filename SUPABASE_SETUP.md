# Supabase 设置指南

## 前提条件

1. 在 [Supabase](https://supabase.com/) 上注册并创建一个新项目
2. 获取项目URL和匿名密钥（Anon Key）

## 配置步骤

### 1. 环境变量设置

编辑项目根目录下的 `.env.local` 文件，填入您的Supabase项目URL和匿名密钥：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. 数据库表创建

在Supabase仪表板中，前往SQL编辑器并执行项目根目录下的 `supabase_tables.sql` 文件中的SQL语句，或手动执行以下SQL：

```sql
-- 创建users表存储用户信息
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建documents表存储用户的写作内容
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建suggestions表存储巫师建议
CREATE TABLE IF NOT EXISTS suggestions (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  wizard_session_id TEXT,
  user_id INTEGER REFERENCES users(id),
  is_accepted BOOLEAN DEFAULT NULL,
  type TEXT DEFAULT 'append',
  position INTEGER,
  end_position INTEGER,
  selected_text TEXT,
  reaction TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为users表设置RLS策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许匿名读取users" ON users FOR SELECT USING (true);
CREATE POLICY "允许匿名插入users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名更新users" ON users FOR UPDATE USING (true);

-- 为documents表设置RLS策略
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许匿名读取documents" ON documents FOR SELECT USING (true);
CREATE POLICY "允许匿名插入documents" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名更新documents" ON documents FOR UPDATE USING (true);

-- 为suggestions表设置RLS策略
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许匿名读取suggestions" ON suggestions FOR SELECT USING (true);
CREATE POLICY "允许匿名插入suggestions" ON suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名更新suggestions" ON suggestions FOR UPDATE USING (true);
```

### 3. 启用实时功能

为了支持实时更新：

1. 在Supabase仪表板中，导航到 Database > Replication
2. 确保实时功能已启用
3. 添加 `users`、`documents` 和 `suggestions` 表到允许实时更新的表列表中

### 4. 功能说明

本应用使用Supabase实现以下功能：

1. **用户界面** (app/user/page.tsx)
   - 用户首次访问时需要输入名字才能开始写作
   - 用户信息存储在 `users` 表中
   - 用户的写作内容存储在 `documents` 表中
   - 所有AI建议统一在一个列表中显示和处理，包括：
     - **添加建议**：添加到文档末尾的内容
     - **修改建议**：替换文档中选定文本范围的内容
   - 用户可以对建议进行应用、点赞或拒绝的操作
   - 对于修改建议，用户可以看到被选择的原文和推荐的修改内容

2. **巫师界面** (app/wizard/page.tsx)
   - 巫师可以看到所有用户的名字列表
   - 选择特定用户后，可以实时查看该用户的写作内容
   - 巫师可以发送两种类型的建议：
     - **添加建议**：建议添加到文档末尾的内容
     - **修改建议**：通过选择文本范围，提供修改建议
   - 修改建议功能允许巫师直接选择用户文本中的一段内容，然后提供替换内容
   - 巫师可以查看已发送的建议历史记录及其状态（已应用、已点赞或已拒绝）

### 5. 数据关系

- **users 表**: 存储用户信息，包括名字和唯一会话ID
- **documents 表**: 存储用户的写作内容，通过 `user_id` 与 users 表关联
- **suggestions 表**: 存储巫师的建议，通过 `user_id` 与 users 表关联。包含以下重要字段：
  - `type`: 建议类型，可以是 'append'（添加）或 'comment'（修改）
  - `position`: 文本操作的起始位置（对于修改建议是选择开始位置）
  - `end_position`: 选择文本的结束位置（仅适用于修改建议）
  - `selected_text`: 被选择的原始文本（仅适用于修改建议）
  - `is_accepted`: 建议是否被接受
  - `reaction`: 用户对建议的反应，可以是 'like'（点赞）、'apply'（应用）或 'reject'（拒绝）

### 6. 使用示例

**修改建议示例**:
- 用户原文: "Hello, myfriend"
- 巫师操作: 选择 "myfriend" 并建议修改为 "my friend"
- 用户操作: 可以查看原文和建议，应用修改、点赞或拒绝

## 使用方法

完成配置后，启动应用：

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

1. 访问 http://localhost:3000/user 页面使用用户界面：
   - 首次访问时，输入您的名字
   - 开始写作，内容会实时保存
   - 收到建议时，可以选择应用、点赞或拒绝

2. 访问 http://localhost:3000/wizard 页面使用巫师界面：
   - 查看所有在线用户
   - 点击用户名查看其实时写作内容
   - 选择建议类型（添加或修改）
   - 如选择修改类型，拖动选择要修改的文本范围
   - 输入建议内容并发送给选定的用户
   - 查看发送建议的历史记录及其状态