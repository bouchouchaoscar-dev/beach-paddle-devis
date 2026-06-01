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

export async function POST(req: Request) {
  const url = new URL(req.url);
  const fullSync = url.searchParams.get("full") === "true";

  try {
    // 1. Fetch Qonto organization → bank account slug
    const org = await fetchQontoOrganization();
    const bankAccount = org.bank_accounts?.[0];
    if (!bankAccount) {
      return NextResponse.json({ error: "Aucun compte bancaire Qonto trouvé" }, { status: 400 });
    }

    // 2. Determine sync start date (incremental unless ?full=true)
    let syncFrom = SYNC_FROM_DATE;
    if (!fullSync) {
      const { data: latestTx } = await supabase
        .from("qonto_transactions")
        .select("date")
        .order("date", { ascending: false })
        .limit(1)
        .single();
      if (latestTx?.date) {
        // Go back 2 days as a safety buffer to catch late-settled transactions
        const d = new Date(latestTx.date + "T12:00:00Z");
        d.setDate(d.getDate() - 2);
        syncFrom = d.toISOString().slice(0, 10);
      }
    }

    // 3. Fetch Qonto transactions since syncFrom
    const transactions = await fetchQontoTransactions(bankAccount.slug, syncFrom);

    // 4. Load already-imported qonto_ids to avoid duplicates (safety net)
    const { data: existingRows } = await supabase
      .from("qonto_transactions")
      .select("qonto_id");
    const existingIds = new Set<string>((existingRows ?? []).map((r: { qonto_id: string }) => r.qonto_id));

    // 5. Load custom rules
    const { data: customRulesRaw } = await supabase
      .from("qonto_rules")
      .select("*")
      .order("created_at", { ascending: true });
    const customRules: QontoRule[] = (customRulesRaw ?? []) as QontoRule[];

    // 6. Process new transactions
    const toInsert: Record<string, unknown>[] = [];
    const chargesToInsert: Record<string, unknown>[] = [];
    const stats = { inclus: 0, exclu: 0, en_attente: 0 };

    for (const tx of transactions) {
      if (existingIds.has(tx.transaction_id)) continue;

      const result = applyRulesWithCustom(tx, customRules);
      const date = txDate(tx.settled_at);
      const saison = txSaison(tx.settled_at);
      const montant = Math.round(tx.amount * 100) / 100;

      toInsert.push({
        qonto_id: tx.transaction_id,
        date,
        montant,
        libelle: tx.label,
        statut: result.statut,
        categorie: result.categorie ?? null,
        fournisseur: result.statut === "inclus" ? tx.label : null,
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
          fournisseur: tx.label,
          description: `Import Qonto — ${tx.label}`,
          mode_paiement: "CB",
          statut_paiement: "paye",
          saison,
          created_by: "qonto_sync",
        });
      }
    }

    // 7. Bulk insert
    if (toInsert.length > 0) {
      const { error } = await supabase.from("qonto_transactions").insert(toInsert);
      if (error) return NextResponse.json({ error: `qonto_transactions: ${error.message}` }, { status: 500 });
    }

    if (chargesToInsert.length > 0) {
      const { error } = await supabase.from("charges").insert(chargesToInsert);
      if (error) return NextResponse.json({ error: `charges: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      nouveau: toInsert.length,
      total_fetched: transactions.length,
      sync_from: syncFrom,
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
