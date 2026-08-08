CREATE TABLE public.memories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  source_thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own memories all" ON public.memories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX memories_user_created_idx ON public.memories (user_id, created_at DESC);