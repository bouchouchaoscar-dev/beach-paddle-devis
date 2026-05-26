export type ClientType = "entreprise" | "scolaire" | "loisirs";
export type ActivityType = "paddle" | "kayak" | "hybride" | "none";
export type Duration = "30min" | "1h" | "1h30" | "2h";
export type DocumentType = "devis" | "facture";

export type SnackingFormula =
  | "dejeuner"
  | "gouter"
  | "dejeuner-gouter"
  | "apero"
  | "guidee"
  | "personnalise";

export interface GuidedArticle {
  name: string;
  price: number;
  quantity?: number; // default 1
  operatorBefore?: "ET" | "OU";
}

export interface SnackingItem {
  id: string;
  formula: SnackingFormula;
  label: string;
  description: string;
  pricePerPerson: number | null; // null = manual
  manualPrice?: number;
  manualLabel?: string;
  guidedArticles?: GuidedArticle[];
}

export interface CoachOption {
  enabled: boolean;
  description: string;
  price: number; // forfait fixe pour le groupe, pas par personne
}

export interface DiscountConfig {
  // Entreprise
  discountRate: number; // %
  discountEnabled: boolean;

  // Scolaire / loisirs
  accompagnatorsEnabled: boolean;
  accompagnatorsCount: number;
  extraDiscountEnabled: boolean;
  extraDiscountRate: number; // %
}

export interface DevisFormData {
  // Bloc 1 — Client
  date: string;
  dateADefinir?: boolean;
  heureDebut: string;
  clientType: ClientType;
  clientName: string;
  clientAddress: string;
  prestationDescription: string;
  participantsCount: number;

  // Bloc 2 — Activité
  activity: ActivityType;
  duration: Duration;
  coach: CoachOption;

  // Bloc 3 — Snacking
  snackingItems: SnackingItem[];

  // Bloc 4 — Remises
  discount: DiscountConfig;

  // Document
  documentType: DocumentType;
  acompteVerse?: number;
}

export interface DevisRecord {
  id: string;
  numero: string;
  date: string;
  createdAt: number;
  clientType: ClientType;
  clientName: string;
  prestationDescription: string;
  participantsCount: number;
  totalBrut: number;
  totalNet: number;
  documentType: DocumentType;
  formData: DevisFormData;
}

export interface CalculationResult {
  activitySubtotal: number;
  activityPricePerPerson: number;
  coachSubtotal: number;
  snackingSubtotal: number;
  totalBrut: number;

  // Entreprise
  discountAmount: number;

  // Scolaire
  accompagnatorsCost: number;
  extraDiscountAmount: number;
  totalDiscount: number;
  totalDiscountRate: number; // % arrondi au 0.5 le plus proche
  totalDiscountRateIsExact: boolean; // true si pas d'arrondi → afficher "=" sinon "≈"

  totalNet: number;
  resteADue?: number; // facture seulement
}
