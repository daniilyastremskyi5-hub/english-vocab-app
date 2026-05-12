
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Новый чат',
  kind text NOT NULL DEFAULT 'free',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own chats" ON public.chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chats" ON public.chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chats" ON public.chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own chats" ON public.chats FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_chats_user_updated ON public.chats(user_id, updated_at DESC);

CREATE TABLE public.assistant_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('word','folder')),
  target_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own notes" ON public.assistant_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notes" ON public.assistant_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notes" ON public.assistant_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notes" ON public.assistant_notes FOR DELETE USING (auth.uid() = user_id);
