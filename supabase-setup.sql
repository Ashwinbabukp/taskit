-- ================================================================
-- TASKIT SUPABASE DATABASE SETUP
-- Copy and run this script in your Supabase Dashboard -> SQL Editor
-- ================================================================

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  verification_code TEXT,
  code_expires_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  token TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

-- 3. Create Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  t TEXT NOT NULL,
  date TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Journals Table
CREATE TABLE IF NOT EXISTS public.journals (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, date)
);

-- 5. Row Level Security Policies (Allow Service Role Full Access)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access for users" ON public.users;
CREATE POLICY "Service role access for users" ON public.users FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role access for sessions" ON public.sessions;
CREATE POLICY "Service role access for sessions" ON public.sessions FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role access for tasks" ON public.tasks;
CREATE POLICY "Service role access for tasks" ON public.tasks FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role access for journals" ON public.journals;
CREATE POLICY "Service role access for journals" ON public.journals FOR ALL USING (true);

