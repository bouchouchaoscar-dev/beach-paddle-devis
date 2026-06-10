-- ============================================================
-- Fix: autoriser plusieurs événements le même jour
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

-- 1. Supprimer la contrainte UNIQUE sur date_event (commande directe)
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_date_event_key;

-- 2. Supprimer toute autre contrainte UNIQUE portant sur date_event seul
--    (au cas où le nom serait différent)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'calendar_events'
    AND con.contype = 'u'
    AND (
      SELECT count(*) FROM pg_attribute att
      WHERE att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    ) = 1
    AND (
      SELECT att.attname FROM pg_attribute att
      WHERE att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      LIMIT 1
    ) = 'date_event';

  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE calendar_events DROP CONSTRAINT ' || quote_ident(cname);
    RAISE NOTICE 'Contrainte supprimée : %', cname;
  ELSE
    RAISE NOTICE 'Pas de contrainte unique sur date_event — OK';
  END IF;
END $$;

-- 3. RLS + politique anon (si pas déjà en place)
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
    RAISE NOTICE 'Politique RLS déjà en place';
  END IF;
END $$;
