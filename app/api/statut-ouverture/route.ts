import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveStatut } from "@/lib/statut";
import type { StatutRow } from "@/lib/statut";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-api-secret");
  if (!secret || secret !== process.env.STATUT_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("statut_ouverture")
    .select("id, statut, date_jour, mis_a_jour")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[statut-ouverture] Supabase error:", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  const { statut, misAJourLe } = resolveStatut(data as StatutRow | null);

  return NextResponse.json(
    { statut, misAJourLe },
    { headers: { "Cache-Control": "no-store, no-cache" } }
  );
}
