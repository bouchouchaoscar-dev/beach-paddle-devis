export interface CaEntry {
  id: string;
  date: string;
  montant: number;
  source: "manuel" | "import_excel" | "acompte";
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
  bonus?: number;
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

// ── Immobilisations ──────────────────────────────────────────────────────────

export interface Immobilisation {
  id: string;
  nom: string;
  date_achat: string;
  montant_total: number;
  duree_amortissement: number;
  methode: string;
  description?: string;
  fournisseur?: string;
  annee_achat: string;
  actif: boolean;
  created_at: string;
  created_by: string;
}

export interface AmortissementLine {
  year: number;
  dotation: number;
  vnc: number;
}

export function computeAmortissement(immo: Immobilisation): AmortissementLine[] {
  const annuel = Math.round((immo.montant_total / immo.duree_amortissement) * 100) / 100;
  const purchaseYear = parseInt(immo.date_achat.slice(0, 4));

  const lines: AmortissementLine[] = [];
  let remaining = immo.montant_total;

  for (let i = 0; i < immo.duree_amortissement; i++) {
    const year = purchaseYear + i;
    // Last year gets the remaining balance to absorb any rounding difference
    const dotation = i < immo.duree_amortissement - 1
      ? Math.min(annuel, remaining)
      : Math.round(remaining * 100) / 100;
    remaining = Math.round((remaining - dotation) * 100) / 100;
    lines.push({ year, dotation, vnc: remaining });
  }

  return lines;
}

export function getDotationForYear(immo: Immobilisation, year: number): number {
  const line = computeAmortissement(immo).find((l) => l.year === year);
  return line?.dotation ?? 0;
}

// Saison ouverte : mars (3) à octobre (10)
const SEASON_START = 3;
const SEASON_END = 10;

function getOpenMonthsInYear(immo: Immobilisation, year: number): number {
  const purchaseYear = parseInt(immo.date_achat.slice(0, 4));
  const purchaseMonth = parseInt(immo.date_achat.slice(5, 7));
  if (year > purchaseYear) return SEASON_END - SEASON_START + 1; // 8 mois pleins
  // Année d'achat : on part du max(moisAchat, mars) jusqu'à octobre
  const firstMonth = Math.max(purchaseMonth, SEASON_START);
  return Math.max(0, SEASON_END - firstMonth + 1);
}

export function getMonthlyDotation(immo: Immobilisation, year: number, month: number): number {
  if (month < SEASON_START || month > SEASON_END) return 0;
  const purchaseYear = parseInt(immo.date_achat.slice(0, 4));
  const purchaseMonth = parseInt(immo.date_achat.slice(5, 7));
  if (year < purchaseYear) return 0;
  if (year === purchaseYear && month < Math.max(purchaseMonth, SEASON_START)) return 0;
  const annual = getDotationForYear(immo, year);
  if (annual === 0) return 0;
  const openMonths = getOpenMonthsInYear(immo, year);
  if (openMonths === 0) return 0;
  return Math.round((annual / openMonths) * 100) / 100;
}

export function getVncTotal(immobilisations: Immobilisation[], year?: number): number {
  const targetYear = year ?? new Date().getFullYear();
  return immobilisations
    .filter((i) => i.actif)
    .reduce((sum, immo) => {
      if (parseInt(immo.annee_achat) > targetYear) return sum; // pas encore acheté
      const lines = computeAmortissement(immo);
      const last = lines.filter((l) => l.year <= targetYear).at(-1);
      return sum + (last?.vnc ?? immo.montant_total);
    }, 0);
}
