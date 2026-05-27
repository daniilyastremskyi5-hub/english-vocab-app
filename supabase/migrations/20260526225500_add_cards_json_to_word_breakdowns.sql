-- Migration: 20260526225500_add_cards_json_to_word_breakdowns.sql
-- Description: Add cards_json column to word_breakdowns table to cache generated card JSON.

ALTER TABLE public.word_breakdowns ADD COLUMN IF NOT EXISTS cards_json JSONB;
