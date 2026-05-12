
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own folders" ON public.folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  breakdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own words" ON public.words FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own words" ON public.words FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own words" ON public.words FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own words" ON public.words FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_folders_user ON public.folders(user_id);
CREATE INDEX idx_words_user ON public.words(user_id);
CREATE INDEX idx_words_folder ON public.words(folder_id);
