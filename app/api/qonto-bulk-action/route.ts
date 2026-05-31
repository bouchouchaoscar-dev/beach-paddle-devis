import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type BulkAction = "exclude" | "include" | "delete";

export async function POST(request: NextRequest) {
  let body: { ids: string[]; action: BulkAction; categorie?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { ids, action, categorie } = body;
  if (!ids?.length || !action) {
    return NextResponse.json({ error: "ids et action requis" }, { status: 400 });
  }

  if (action === "delete") {
    const { error } = await supabase
      .from("qonto_transactions")
      .delete()
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (action === "exclude") {
    const { error } = await supabase
      .from("qonto_transactions")
      .update({ statut: "exclu" })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (action === "include") {
    if (!categorie) {
      return NextResponse.json({ error: "categorie requise pour l'action include" }, { status: 400 });
    }

    // Fetch only pending transactions to avoid double-inserting charges
    const { data: txs, error: fetchErr } = await supabase
      .from("qonto_transactions")
      .select("*")
      .in("id", ids)
      .eq("statut", "en_attente");

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!txs?.length) return NextResponse.json({ ok: true, count: 0 });

    // Insert charges
    const charges = txs.map((tx) => ({
      date: tx.date,
      montant: tx.montant,
      categorie,
      fournisseur: tx.fournisseur || tx.libelle,
      description: `Import Qonto — ${tx.libelle}`,
      mode_paiement: "CB",
      statut_paiement: "paye",
      saison: tx.saison,
      created_by: "qonto_approve",
    }));

    const { error: chargeErr } = await supabase.from("charges").insert(charges);
    if (chargeErr) return NextResponse.json({ error: chargeErr.message }, { status: 500 });

    // Update statut
    const { error: updateErr } = await supabase
      .from("qonto_transactions")
      .update({ statut: "inclus", categorie })
      .in("id", txs.map((t) => t.id));
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: txs.length });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
