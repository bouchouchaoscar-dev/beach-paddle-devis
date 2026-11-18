-- Suivi : montant de référence personnel d'Oscar
CREATE TABLE IF NOT EXISTS suivi_reference (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  montant    numeric NOT NULL,
  note       text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suivi_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all suivi_reference"
  ON suivi_reference FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Suivi : mouvements (virements / paiements carte)
CREATE TABLE IF NOT EXISTS suivi_mouvements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date NOT NULL,
  type       text NOT NULL CHECK (type IN ('virement', 'carte')),
  compte     text NOT NULL CHECK (compte IN ('Qonto', 'SumUp')),
  montant    numeric NOT NULL,
  note       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suivi_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all suivi_mouvements"
  ON suivi_mouvements FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
