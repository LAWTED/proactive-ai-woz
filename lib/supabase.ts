import { createClient } from '@supabase/supabase-js';

// 这里需要替换为您实际的Supabase URL和匿名密钥
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);