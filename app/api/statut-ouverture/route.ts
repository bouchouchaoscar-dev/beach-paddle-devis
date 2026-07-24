import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveStatut } from "@/lib/statut";
import type { StatutRow } from "@/lib/statut";

export const dynamic = "force-dynamic";

// Client local avec fetch no-store pour bypasser le Next.js Data Cache.
// Le client singleton de lib/supabase.ts laisse Next.js mettre en cache
// les requêtes fetch internes — ce client force chaque requête à aller
// directement en base sans passer par le cache.
const supabaseFresh = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) } }
);

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-api-secret");
  if (!secret || secret !== process.env.STATUT_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseFresh
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
