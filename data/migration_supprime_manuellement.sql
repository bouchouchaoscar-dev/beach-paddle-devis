-- Migration : champ supprime_manuellement dans calendar_events
-- À exécuter une seule fois dans l'éditeur SQL de Supabase

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS supprime_manuellement BOOLEAN DEFAULT FALSE;
