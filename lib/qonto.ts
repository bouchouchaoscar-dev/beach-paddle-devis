// Qonto API v2 — client + règles métier

export const QONTO_BASE = "https://thirdparty.qonto.com/v2";
export const SYNC_FROM_DATE = "2026-03-01";

// ── Types ──────────────────────────────────────────────────────────────────

export interface QontoTransaction {
  transaction_id: string;
  amount: number;           // en EUR (décimal)
  local_amount: number;
  side: "debit" | "credit";
  operation_type: string;
  currency: string;
  label: string;
  settled_at: string;       // ISO 8601
  emitted_at: string;
  status: string;
  note?: string;
  reference?: string;
}

export interface QontoBankAccount {
  slug: string;
  iban: string;
  bic: string;
  currency: string;
  balance: number;
  name: string;
}

export interface QontoOrganization {
  slug: string;
  legal_name: string;
  bank_accounts: QontoBankAccount[];
}

export interface QontoRule {
  id: string;
  libelle_contains: string;
  action: "inclus" | "exclu";
  categorie: string | null;
  created_at: string;
}

export interface QontoDbTransaction {
  id: string;
  qonto_id: string;
  date: string;
  montant: number;
  libelle: string;
  statut: "inclus" | "exclu" | "en_attente";
  categorie: string | null;
  fournisseur: string | null;
  auto_rule: string | null;
  memoriser: boolean;
  saison: string;
  created_at: string;
}

export interface RuleResult {
  statut: "inclus" | "exclu" | "en_attente";
  categorie?: string;
  auto_rule?: string;
}

// ── API helpers ────────────────────────────────────────────────────────────

function qontoAuth(): string {
  const login = process.env.QONTO_LOGIN;
  const secret = process.env.QONTO_SECRET_KEY;
  if (!login || !secret) throw new Error("QONTO_LOGIN ou QONTO_SECRET_KEY manquant");
  return `${login}:${secret}`;
}

export async function fetchQontoOrganization(): Promise<QontoOrganization> {
  const res = await fetch(`${QONTO_BASE}/organization`, {
    headers: { Authorization: qontoAuth() },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qonto organization ${res.status}: ${text}`);
  }
  const data = await res.json();
  return (data.organization ?? data) as QontoOrganization;
}

export async function fetchQontoTransactions(
  slug: string,
  settledAtFrom: string
): Promise<QontoTransaction[]> {
  const all: QontoTransaction[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      slug,
      settled_at_from: settledAtFrom,
      status: "completed",
      current_page: String(page),
      per_page: "100",
    });

    const res = await fetch(`${QONTO_BASE}/transactions?${params}`, {
      headers: { Authorization: qontoAuth() },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Qonto transactions ${res.status}: ${text}`);
    }

    const data = await res.json();
    const txs: QontoTransaction[] = data.transactions ?? [];
    all.push(...txs);

    if (!data.meta?.next_page || txs.length === 0) break;
    page++;
    if (page > 10) break; // limite sécurité : 1000 transactions max
  }

  return all;
}

// ── Règles métier ──────────────────────────────────────────────────────────

const DEFAULT_EXCLUSIONS = [
  "NETFLIX", "AMAZON PRIME", "SPOTIFY",
  "SFR", "ORANGE", "FREE", "BOUYGUES",
  "ABONNEMENT", "PRELEVEMENT",
];

export function applyDefaultRules(tx: QontoTransaction): RuleResult {
  const label = tx.label.toUpperCase();
  const date = tx.settled_at.slice(0, 10);

  // Virements reçus (credit) exclus sauf SGC SAINT MAUR
  if (tx.side === "credit" && !label.includes("SGC SAINT MAUR")) {
    return { statut: "exclu", auto_rule: "income" };
  }

  // Exclusions par mot-clé
  for (const kw of DEFAULT_EXCLUSIONS) {
    if (label.includes(kw)) {
      return { statut: "exclu", auto_rule: `exclu:${kw}` };
    }
  }

  // Inclusions automatiques
  if (label.includes("SGC SAINT MAUR")) {
    return { statut: "inclus", categorie: "autre", auto_rule: "inclus:SGC_SAINT_MAUR" };
  }
  if (label.includes("CARREFOUR ORMESSON")) {
    return { statut: "inclus", categorie: "restauration_autre", auto_rule: "inclus:CARREFOUR_ORMESSON" };
  }
  if (label.includes("LIDL") && label.includes("CHENNEVIERES")) {
    return { statut: "inclus", categorie: "restauration_autre", auto_rule: "inclus:LIDL_CHENNEVIERES" };
  }
  if (label.includes("PANEM")) {
    return { statut: "inclus", categorie: "restauration_autre", auto_rule: "inclus:PANEM" };
  }
  if (label.includes("METRO") && date >= "2026-05-31") {
    return { statut: "inclus", categorie: "restauration_metro", auto_rule: "inclus:METRO" };
  }

  return { statut: "en_attente" };
}

export function applyRulesWithCustom(
  tx: QontoTransaction,
  customRules: QontoRule[]
): RuleResult {
  const label = tx.label.toUpperCase();

  // Règles personnalisées en priorité
  for (const rule of customRules) {
    if (label.includes(rule.libelle_contains.toUpperCase())) {
      return {
        statut: rule.action,
        categorie: rule.categorie ?? undefined,
        auto_rule: `custom:${rule.libelle_contains}`,
      };
    }
  }

  return applyDefaultRules(tx);
}

export function txDate(settledAt: string): string {
  return settledAt.slice(0, 10);
}

export function txSaison(settledAt: string): string {
  return settledAt.slice(0, 4);
}
