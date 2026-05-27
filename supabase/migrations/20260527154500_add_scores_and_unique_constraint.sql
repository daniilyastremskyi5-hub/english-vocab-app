-- Migration: 20260527154500_add_scores_and_unique_constraint.sql
-- Description: Add unique constraint and UPDATE RLS policy to card_ratings, and add scores column to training_sessions.

-- 1. Deduplicate card_ratings before adding unique constraint (just in case there are duplicates)
DELETE FROM public.card_ratings a
USING public.card_ratings b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.canonical = b.canonical
  AND a.unit_id = b.unit_id;

-- 2. Add unique constraint to card_ratings
ALTER TABLE public.card_ratings 
  ADD CONSTRAINT unique_user_canonical_unit UNIQUE (user_id, canonical, unit_id);

-- 3. Add UPDATE policy for card_ratings
CREATE POLICY "Users can update their own card ratings"
  ON public.card_ratings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Add scores column to training_sessions
ALTER TABLE public.training_sessions 
  ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb;
