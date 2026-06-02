import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  let body: { transaction_id: string; memoriser: boolean; keyword?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { transaction_id, memoriser, keyword } = body;
  if (!transaction_id) {
    return NextResponse.json({ error: "transaction_id requis" }, { status: 400 });
  }

  // Fetch transaction for the label (needed for rule creation)
  const { data: tx, error: fetchErr } = await supabase
    .from("qonto_transactions")
    .select("libelle")
    .eq("id", transaction_id)
    .single();

  if (fetchErr || !tx) {
    return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });
  }

  // Update transaction status
  const { error: updateErr } = await supabase
    .from("qonto_transactions")
    .update({ statut: "exclu" })
    .eq("id", transaction_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Memorize exclusion rule if requested — utilise le mot clé fourni par l'UI
  if (memoriser) {
    const kw = keyword?.trim()
      || tx.libelle?.replace(/[^A-Z0-9\s]/gi, " ").trim().split(/\s+/).find((w: string) => w.length > 2)
      || tx.libelle;
    if (kw) {
      await supabase.from("qonto_rules").insert({
        libelle_contains: kw.toUpperCase(),
        action: "exclu",
        categorie: null,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
