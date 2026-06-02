import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  fetchQontoOrganization,
  fetchQontoTransactions,
  applyRulesWithCustom,
  txDate,
  txSaison,
  SYNC_FROM_DATE,
  type QontoRule,
} from "@/lib/qonto";

export const maxDuration = 60;

/**
 * POST /api/qonto-full-sync
 * 1. Reset : supprime toutes les qonto_transactions + charges Qonto 2026
 * 2. Sync complète depuis SYNC_FROM_DATE (2026-03-01)
 * 3. Retourne rapport détaillé
 */
export async function POST() {
  try {
    // ── ÉTAPE 1 : Reset propre ──────────────────────────────────────────────

    const { error: txErr } = await supabase
      .from("qonto_transactions")
      .delete()
      .not("id", "is", null);
    if (txErr) return NextResponse.json({ error: `reset qonto_transactions: ${txErr.message}` }, { status: 500 });

    const { error: chargesErr } = await supabase
      .from("charges")
      .delete()
      .in("created_by", ["qonto_sync", "qonto_approve"])
      .eq("saison", "2026");
    if (chargesErr) return NextResponse.json({ error: `reset charges: ${chargesErr.message}` }, { status: 500 });

    // ── ÉTAPE 2 : Sync complète depuis mars 2026 ────────────────────────────

    const org = await fetchQontoOrganization();
    const bankAccount = org.bank_accounts?.[0];
    if (!bankAccount) {
      return NextResponse.json({ error: "Aucun compte bancaire Qonto trouvé" }, { status: 400 });
    }

    const transactions = await fetchQontoTransactions(bankAccount.slug, SYNC_FROM_DATE);

    const { data: customRulesRaw } = await supabase
      .from("qonto_rules")
      .select("*")
      .order("created_at", { ascending: true });
    const customRules: QontoRule[] = (customRulesRaw ?? []) as QontoRule[];

    const toInsert: Record<string, unknown>[] = [];
    const chargesToInsert: Record<string, unknown>[] = [];
    const stats = { inclus: 0, exclu: 0, en_attente: 0 };

    for (const tx of transactions) {
      const result = applyRulesWithCustom(tx, customRules);
      const date = txDate(tx.settled_at, tx.emitted_at || undefined);
      const saison = txSaison(tx.settled_at, tx.emitted_at || undefined);
      const montant = Math.round(tx.amount * 100) / 100;

      const fournisseurFinal = result.statut === "inclus"
        ? (result.fournisseur ?? tx.label)
        : null;

      toInsert.push({
        qonto_id: tx.transaction_id,
        date,
        montant,
        libelle: tx.label,
        statut: result.statut,
        categorie: result.categorie ?? null,
        fournisseur: fournisseurFinal,
        auto_rule: result.auto_rule ?? null,
        memoriser: false,
        saison,
      });

      stats[result.statut]++;

      if (result.statut === "inclus" && result.categorie) {
        chargesToInsert.push({
          date,
          montant,
          categorie: result.categorie,
          fournisseur: result.fournisseur ?? tx.label,
          description: `Import Qonto — ${tx.label}`,
          mode_paiement: "CB",
          statut_paiement: "paye",
          saison,
          created_by: "qonto_sync",
        });
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("qonto_transactions").insert(toInsert);
      if (error) return NextResponse.json({ error: `qonto_transactions insert: ${error.message}` }, { status: 500 });
    }

    if (chargesToInsert.length > 0) {
      const { error } = await supabase.from("charges").insert(chargesToInsert);
      if (error) return NextResponse.json({ error: `charges insert: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      total_fetched: transactions.length,
      sync_from: SYNC_FROM_DATE,
      inclus: stats.inclus,
      exclu: stats.exclu,
      en_attente: stats.en_attente,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
