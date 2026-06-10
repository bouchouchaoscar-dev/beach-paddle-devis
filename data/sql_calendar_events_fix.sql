-- ============================================================
-- Migration complète calendar_events
-- À exécuter UNE SEULE FOIS dans Supabase → SQL Editor
-- Safe : toutes les commandes sont idempotentes (IF NOT EXISTS)
-- ============================================================

-- 1. Créer la table si elle n'existe pas (cas rare)
CREATE TABLE IF NOT EXISTS calendar_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       TEXT NOT NULL,
  date_event  DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ajouter toutes les colonnes manquantes (sans risque si elles existent déjà)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS devis_id            TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS heure_debut         TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS type_client         TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS nom_client          TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS activite            TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS nb_personnes        INTEGER;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS montant             NUMERIC;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS acompte_recu        BOOLEAN DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS acompte_montant     NUMERIC;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS notes               TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS manuel              BOOLEAN DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS supprime_manuellement BOOLEAN DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS created_by          TEXT;

-- 3. Supprimer la contrainte UNIQUE sur date_event seul
--    (elle empêche deux devis le même jour d'avoir chacun leur événement)
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_date_event_key;

-- Supprimer aussi toute autre contrainte UNIQUE portant UNIQUEMENT sur date_event
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'calendar_events'
    AND con.contype = 'u'
    AND array_length(con.conkey, 1) = 1
    AND (
      SELECT att.attname FROM pg_attribute att
      WHERE att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    ) = 'date_event';

  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE calendar_events DROP CONSTRAINT ' || quote_ident(cname);
    RAISE NOTICE 'Contrainte supprimée : %', cname;
  ELSE
    RAISE NOTICE 'Aucune contrainte unique sur date_event seul — OK';
  END IF;
END $$;

-- 4. RLS + politique permissive pour la clé anon
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_events'
      AND policyname = 'allow_anon_all_calendar_events'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "allow_anon_all_calendar_events"
        ON calendar_events FOR ALL TO anon
        USING (true) WITH CHECK (true)
    $pol$;
    RAISE NOTICE 'Politique RLS créée';
  ELSE
    RAISE NOTICE 'Politique RLS déjà présente';
  END IF;
END $$;

-- Vérification finale
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'calendar_events'
ORDER BY ordinal_position;
