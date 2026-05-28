export interface CaEntry {
  id: string;
  date: string;
  montant: number;
  source: "manuel" | "import_excel";
  notes?: string;
  saison: string;
  created_at: string;
  created_by: string;
}

export interface Charge {
  id: string;
  date: string;
  montant: number;
  categorie: ChargeCategory;
  fournisseur?: string;
  description?: string;
  fichier_url?: string;
  mode_paiement?: string;
  statut_paiement: string;
  saison: string;
  created_at: string;
  created_by: string;
}

export type ChargeCategory =
  | "restauration_metro"
  | "restauration_autre"
  | "equipement"
  | "salaire"
  | "autre";

export interface Employee {
  id: string;
  nom: string;
  tarif_horaire: number;
  actif: boolean;
  saison_debut?: string;
  created_at: string;
}

export interface WorkSession {
  id: string;
  employee_id: string;
  date: string;
  heure_debut?: string;
  heure_fin?: string;
  heures: number;
  montant: number;
  notes?: string;
  saison: string;
  created_at: string;
  created_by: string;
}

export const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
export const MOIS_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export const CHARGE_LABELS: Record<ChargeCategory, string> = {
  restauration_metro: "Restauration Métro",
  restauration_autre: "Restauration autre",
  equipement: "Équipement",
  salaire: "Salaires",
  autre: "Autre",
};

export const CHARGE_COLORS: Record<ChargeCategory, string> = {
  restauration_metro: "#0071E3",
  restauration_autre: "#16A34A",
  equipement: "#F59E0B",
  salaire: "#8B5CF6",
  autre: "#6E6E73",
};

export const CURRENT_SAISON = "2026";
export const SAISONS = ["2016","2017","2018","2019","2020","2021","2022","2023","2024","2025","2026"];
