-- Migration: 20260527130000_create_card_ratings.sql
-- Description: Create card_ratings table to store confidence assessments in training cards mode.

CREATE TABLE IF NOT EXISTS public.card_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  pillar TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.card_ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can insert their own card ratings" ON public.card_ratings;
DROP POLICY IF EXISTS "Users can view their own card ratings" ON public.card_ratings;

-- Create RLS policies
CREATE POLICY "Users can insert their own card ratings"
  ON public.card_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own card ratings"
  ON public.card_ratings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_card_ratings_user_canonical ON public.card_ratings(user_id, canonical);
CREATE INDEX IF NOT EXISTS idx_card_ratings_user_unit ON public.card_ratings(user_id, unit_id);
