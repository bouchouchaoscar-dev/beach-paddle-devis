import type { ActivityType, Duration } from "./types";

export const PADDLE_PRICES: Record<Duration, number> = {
  "30min": 10.0,
  "1h": 17.0,
  "1h30": 25.0,
  "2h": 30.0,
};

export const KAYAK_PRICES: Record<Duration, number> = {
  "30min": 7.5,
  "1h": 13.0,
  "1h30": 19.5,
  "2h": 24.0,
};

export const HYBRIDE_PRICES: Record<Duration, number> = {
  "30min": 8.75,
  "1h": 15.0,
  "1h30": 22.5,
  "2h": 27.0,
};

export function getActivityPrice(
  activity: ActivityType,
  duration: Duration
): number {
  if (activity === "paddle") return PADDLE_PRICES[duration];
  if (activity === "kayak") return KAYAK_PRICES[duration];
  if (activity === "hybride") return HYBRIDE_PRICES[duration];
  return 0;
}

export const SNACKING_PRICES = {
  dejeuner: 13.0,
  gouter: 7.0,
} as const;

export const BIERE_SUPPLEMENT = 2.5;

export const DEJEUNER_DESC = {
  sansBiere: "Panini ou Hot Dog ou Croque Monsieur + Crêpe ou Glace ou Cookie + 1 Boisson au choix (Soda, eau ou café)",
  avecBiere: "Panini ou Hot Dog ou Croque Monsieur + Crêpe ou Glace ou Cookie + 1 Boisson au choix (Soda, eau, café ou Bière)",
} as const;

export type GuidedArticleTemplate = { name: string; price: number };

export const GUIDED_ARTICLES: Record<string, GuidedArticleTemplate[]> = {
  "Paninis": [
    { name: "Panini", price: 7.00 },
  ],
  "Snacking": [
    { name: "Croque Monsieur", price: 7.00 },
    { name: "Hot Dog & Chips", price: 6.50 },
    { name: "Cookies", price: 4.00 },
    { name: "Glaces", price: 3.50 },
    { name: "Chips", price: 1.50 },
    { name: "Bonbons", price: 1.00 },
  ],
  "Crêpes": [
    { name: "Crêpe sucrée maison", price: 5.00 },
  ],
  "Boissons": [
    { name: "Boisson froide (eau, sodas)", price: 2.50 },
    { name: "Boisson chaude (café, latté, thé, chocolat chaud)", price: 4.00 },
  ],
  "Bar": [
    { name: "Bière (Leffe, Heineken)", price: 5.00 },
    { name: "Verre de vin (Rosé, Blanc)", price: 5.50 },
    { name: "Spritz (Apérol, Limoncello, Sarti)", price: 10.00 },
    { name: "Bouteille de vin (Rosé, Blanc)", price: 20.00 },
    { name: "Bouteille de Prosecco", price: 25.00 },
  ],
};

export const DURATION_LABELS: Record<Duration, string> = {
  "30min": "30 min",
  "1h": "1h",
  "1h30": "1h30",
  "2h": "2h",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  paddle: "Stand Up Paddle",
  kayak: "Kayak",
  hybride: "Hybride (Paddle + Kayak)",
  none: "Aucune activité",
};

export const CLIENT_TYPE_LABELS = {
  entreprise: "Entreprise",
  scolaire: "Établissement scolaire",
  loisirs: "Service Jeunesse",
} as const;

export const DURATIONS: Duration[] = ["30min", "1h", "1h30", "2h"];

export const ENTERPRISE_DISCOUNT_RATES = [5, 8, 10, 15];
export const SCHOOL_DISCOUNT_RATES = [4.5, 5, 9.5, 10, 15];
