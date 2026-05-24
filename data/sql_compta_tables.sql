-- ============================================================
-- Beach Paddle Admin — Tables comptabilité
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- Table CA journalier
CREATE TABLE IF NOT EXISTS ca_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  montant     NUMERIC NOT NULL,
  source      TEXT DEFAULT 'manuel',
  notes       TEXT,
  saison      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  TEXT
);

ALTER TABLE ca_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_anon_all_ca_entries"
  ON ca_entries FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- Table charges / dépenses
CREATE TABLE IF NOT EXISTS charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE NOT NULL,
  montant          NUMERIC NOT NULL,
  categorie        TEXT NOT NULL,
  fournisseur      TEXT,
  description      TEXT,
  fichier_url      TEXT,
  mode_paiement    TEXT,
  statut_paiement  TEXT DEFAULT 'paye',
  saison           TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       TEXT
);

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_anon_all_charges"
  ON charges FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- Table employés
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT NOT NULL,
  tarif_horaire NUMERIC DEFAULT 10,
  actif         BOOLEAN DEFAULT TRUE,
  saison_debut  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_anon_all_employees"
  ON employees FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- Table sessions de travail
CREATE TABLE IF NOT EXISTS work_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID REFERENCES employees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  heure_debut  TEXT,
  heure_fin    TEXT,
  heures       NUMERIC NOT NULL,
  montant      NUMERIC NOT NULL,
  notes        TEXT,
  saison       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  created_by   TEXT
);

ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_anon_all_work_sessions"
  ON work_sessions FOR ALL TO anon
  USING (true) WITH CHECK (true);
