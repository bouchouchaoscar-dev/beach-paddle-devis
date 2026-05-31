import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  let body: {
    transaction_id: string;
    categorie: string;
    fournisseur?: string;
    memoriser: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { transaction_id, categorie, fournisseur, memoriser } = body;
  if (!transaction_id || !categorie) {
    return NextResponse.json({ error: "transaction_id et categorie requis" }, { status: 400 });
  }

  // Fetch transaction from DB
  const { data: tx, error: fetchErr } = await supabase
    .from("qonto_transactions")
    .select("*")
    .eq("id", transaction_id)
    .single();

  if (fetchErr || !tx) {
    return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });
  }

  // Insert into charges
  const { error: chargeErr } = await supabase.from("charges").insert({
    date: tx.date,
    montant: tx.montant,
    categorie,
    fournisseur: fournisseur || tx.libelle,
    description: `Import Qonto — ${tx.libelle}`,
    mode_paiement: "CB",
    statut_paiement: "paye",
    saison: tx.saison,
    created_by: "qonto_approve",
  });

  if (chargeErr) {
    return NextResponse.json({ error: `charge: ${chargeErr.message}` }, { status: 500 });
  }

  // Update transaction status
  const { error: updateErr } = await supabase
    .from("qonto_transactions")
    .update({ statut: "inclus", categorie, fournisseur: fournisseur || tx.libelle })
    .eq("id", transaction_id);

  if (updateErr) {
    return NextResponse.json({ error: `update: ${updateErr.message}` }, { status: 500 });
  }

  // Memorize rule if requested
  if (memoriser && tx.libelle) {
    const keyword = tx.libelle.split(" ").slice(0, 3).join(" ").toUpperCase();
    await supabase.from("qonto_rules").insert({
      libelle_contains: keyword,
      action: "inclus",
      categorie,
    });
  }

  return NextResponse.json({ ok: true });
}
