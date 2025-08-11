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
  full_text TEXT, -- 新字段：完整原文
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

-- 创建写作时间快照表
CREATE TABLE IF NOT EXISTS writing_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  session_id TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  text_length INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  sentence_count INTEGER NOT NULL DEFAULT 0,
  last_sentence TEXT,
  typing_speed REAL NOT NULL DEFAULT 0,
  full_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为writing_snapshots表设置RLS策略
ALTER TABLE writing_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许匿名读取writing_snapshots" ON writing_snapshots FOR SELECT USING (true);
CREATE POLICY "允许匿名插入writing_snapshots" ON writing_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "允许匿名更新writing_snapshots" ON writing_snapshots FOR UPDATE USING (true);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_writing_snapshots_user_session ON writing_snapshots(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_writing_snapshots_timestamp ON writing_snapshots(timestamp);

-- 启用实时订阅 (需要在Supabase控制台的Replication部分手动为这些表启用)