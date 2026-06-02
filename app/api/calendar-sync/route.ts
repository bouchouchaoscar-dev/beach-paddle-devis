import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { DevisRecord } from "@/lib/types";

export const maxDuration = 60;

const ACTIVITY_LABELS: Record<string, string> = {
  paddle: "Paddle",
  kayak: "Kayak",
  hybride: "Paddle + Kayak",
};

export async function POST() {
  try {
    // 1. All documents with a prestation date
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .select("id, client_nom, client_type, date_prestation, montant_final, acompte, donnees_completes")
      .not("date_prestation", "is", null);

    if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });
    const documents = docs ?? [];

    // 2. All non-manual calendar events (managed by sync)
    const { data: existing, error: existErr } = await supabase
      .from("calendar_events")
      .select("id, devis_id")
      .eq("manuel", false);

    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });

    const existingMap = new Map<string, string>(); // devis_id → event.id
    for (const ev of existing ?? []) {
      if (ev.devis_id) existingMap.set(ev.devis_id, ev.id);
    }

    const docIds = new Set(documents.map((d) => d.id as string));
    let created = 0, updated = 0, deleted = 0;

    // 3. Upsert events for each document
    for (const doc of documents) {
      const fd = (doc.donnees_completes as DevisRecord)?.formData;
      const activite = fd?.activity && fd.activity !== "none" ? fd.activity : null;
      const actLabel = activite ? (ACTIVITY_LABELS[activite] ?? null) : null;
      const titre = [actLabel, doc.client_nom].filter(Boolean).join(" — ") || doc.client_nom || "Sans titre";

      const payload = {
        devis_id: doc.id as string,
        titre,
        date_event: doc.date_prestation as string,
        heure_debut: fd?.heureDebut?.trim() || null,
        type_client: doc.client_type as string ?? null,
        nom_client: doc.client_nom as string ?? null,
        activite,
        nb_personnes: fd?.participantsCount ?? null,
        montant: (doc.montant_final as number) ?? null,
        acompte_recu: (doc.acompte as number ?? 0) > 0,
        acompte_montant: (doc.acompte as number ?? 0) > 0 ? (doc.acompte as number) : null,
        manuel: false,
        created_by: "sync",
      };

      const existingId = existingMap.get(doc.id as string);
      if (existingId) {
        await supabase.from("calendar_events").update(payload).eq("id", existingId);
        updated++;
      } else {
        await supabase.from("calendar_events").insert(payload);
        created++;
      }
    }

    // 4. Delete orphaned events (devis deleted from archives)
    const orphanIds = Array.from(existingMap.entries())
      .filter(([devisId]) => !docIds.has(devisId))
      .map(([, eventId]) => eventId);
    for (const eventId of orphanIds) {
      await supabase.from("calendar_events").delete().eq("id", eventId);
      deleted++;
    }

    return NextResponse.json({ ok: true, created, updated, deleted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
