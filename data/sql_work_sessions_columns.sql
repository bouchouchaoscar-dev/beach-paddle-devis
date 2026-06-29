-- Colonnes supplémentaires pour work_sessions
-- À exécuter dans l'éditeur SQL de Supabase si les colonnes n'existent pas encore.

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS bonus  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paye   boolean NOT NULL DEFAULT false;
