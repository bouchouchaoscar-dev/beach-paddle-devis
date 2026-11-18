export interface SuiviReference {
  id: string;
  montant: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type MouvementType = "virement" | "carte";
export type MouvementCompte = "Qonto" | "SumUp";

export interface SuiviMouvement {
  id: string;
  date: string;
  type: MouvementType;
  compte: MouvementCompte;
  montant: number;
  note: string | null;
  created_at: string;
}
