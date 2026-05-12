CREATE TABLE public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  word TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'word',
  breakdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, word)
);

ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own history" ON public.history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own history" ON public.history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own history" ON public.history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own history" ON public.history FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX history_user_updated_idx ON public.history(user_id, updated_at DESC);