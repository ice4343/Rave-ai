ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS bold_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'nonbinary', 'other', 'prefer_not_to_say'));

COMMENT ON COLUMN public.profiles.gender IS 'Optional user-selected gender used to adapt conversational grammar and vocabulary.';
COMMENT ON COLUMN public.profiles.bold_mode IS 'When enabled, supported Rave models use the private built-in bold persona instead of the custom personality.';