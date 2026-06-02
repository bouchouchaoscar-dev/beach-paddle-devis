import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  // 1. Vider toutes les transactions Qonto
  const { error: txErr } = await supabase
    .from("qonto_transactions")
    .delete()
    .not("id", "is", null);

  if (txErr) {
    return NextResponse.json({ error: `qonto_transactions: ${txErr.message}` }, { status: 500 });
  }

  // 2. Supprimer uniquement les charges importées via Qonto, saison 2026
  //    Les charges manuelles, PDF et autres saisons ne sont pas touchées
  const { error: chargesErr } = await supabase
    .from("charges")
    .delete()
    .in("created_by", ["qonto_sync", "qonto_approve"])
    .eq("saison", "2026");

  if (chargesErr) {
    return NextResponse.json({ error: `charges: ${chargesErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
