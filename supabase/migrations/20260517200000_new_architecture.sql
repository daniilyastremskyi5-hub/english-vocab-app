-- Migration: 20260517200000_new_architecture.sql
-- Description: Drop old word_analyses table and create input_aliases and word_breakdowns for the new architecture.

-- 1. Drop old table if exists
DROP TABLE IF EXISTS public.word_analyses CASCADE;

-- 2. Create input_aliases table (cache for word classification mapping)
CREATE TABLE public.input_aliases (
  input TEXT PRIMARY KEY,
  canonical TEXT NOT NULL,
  type TEXT NOT NULL,
  pos TEXT NOT NULL,
  note TEXT,
  valid BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create word_breakdowns table (cache for light and full breakdowns)
CREATE TABLE public.word_breakdowns (
  canonical TEXT PRIMARY KEY,
  light JSONB,
  full JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.input_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_breakdowns ENABLE ROW LEVEL SECURITY;

-- Note: Since these tables are used purely as a global backend cache by the API
-- (which utilizes the service_role key), no public RLS policies are required.
-- If client-side direct SELECT is ever needed in the future, policies can be added.
