-- Migration: 20260526171515_training_history.sql
-- Description: Create training_folders and training_sessions tables for tracking user card training history and organization.

-- 1. Create training_folders table
CREATE TABLE public.training_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create training_sessions table
CREATE TABLE public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  words TEXT[] NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cards',
  folder_id UUID REFERENCES public.training_folders(id) ON DELETE SET NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.training_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policies for training_folders
CREATE POLICY "Users select own training folders" ON public.training_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own training folders" ON public.training_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own training folders" ON public.training_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own training folders" ON public.training_folders FOR DELETE USING (auth.uid() = user_id);

-- 5. Set RLS Policies for training_sessions
CREATE POLICY "Users select own training sessions" ON public.training_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own training sessions" ON public.training_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own training sessions" ON public.training_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own training sessions" ON public.training_sessions FOR DELETE USING (auth.uid() = user_id);

-- 6. Indexes for optimized queries
CREATE INDEX idx_training_folders_user ON public.training_folders(user_id);
CREATE INDEX idx_training_sessions_user_created ON public.training_sessions(user_id, created_at DESC);
CREATE INDEX idx_training_sessions_folder ON public.training_sessions(folder_id);
