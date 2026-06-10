import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { DevisRecord } from "@/lib/types";

export const maxDuration = 60;

const ACTIVITY_LABELS: Record<string, string> = {
  paddle: "Paddle",
  kayak: "Kayak",
  hybride: "Paddle + Kayak",
  mega_paddle: "MégaPaddle",
};

export async function POST() {
  const log: string[] = [];

  try {
    // 1. ALL documents — no date_prestation filter (some old records have it null
    //    but a valid date inside donnees_completes.formData.date)
    const { data: rawDocs, error: docsErr } = await supabase
      .from("documents")
      .select("id, client_nom, client_type, date_prestation, montant_final, acompte, donnees_completes")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (docsErr) return NextResponse.json({ error: docsErr.message, log }, { status: 500 });

    const allDocs = rawDocs ?? [];
    log.push(`📋 Total documents récupérés: ${allDocs.length}`);

    // Keep only docs with an effective date (column OR formData.date)
    const documents = allDocs.filter(doc => {
      if (doc.date_prestation) return true;
      const fd = (doc.donnees_completes as DevisRecord)?.formData;
      return !!(fd?.date && !fd?.dateADefinir);
    });

    const withColOnly = allDocs.filter(d => d.date_prestation && !(d.donnees_completes as DevisRecord)?.formData?.date).length;
    const withFormOnly = allDocs.filter(d => {
      const fd = (d.donnees_completes as DevisRecord)?.formData;
      return !d.date_prestation && !!(fd?.date && !fd?.dateADefinir);
    }).length;
    log.push(`📅 Docs avec date_prestation colonne: ${allDocs.filter(d => d.date_prestation).length}`);
    log.push(`📅 Docs avec date dans formData seulement: ${withFormOnly} (manqués par ancienne logique!)`);
    log.push(`📅 Docs sans date du tout: ${allDocs.length - documents.length}`);
    log.push(`✅ Total à synchroniser: ${documents.length}`);
    void withColOnly;

    // 2. All non-manual calendar events (managed by sync)
    const { data: existing, error: existErr } = await supabase
      .from("calendar_events")
      .select("id, devis_id, supprime_manuellement")
      .eq("manuel", false)
      .limit(5000);

    if (existErr) return NextResponse.json({ error: existErr.message, log }, { status: 500 });

    const existingMap = new Map<string, string>(); // devis_id → event.id (active only)
    const suppressedDevisIds = new Set<string>(); // devis_ids never to re-create
    for (const ev of existing ?? []) {
      if (!ev.devis_id) continue;
      if (ev.supprime_manuellement) {
        suppressedDevisIds.add(ev.devis_id as string);
      } else {
        existingMap.set(ev.devis_id as string, ev.id as string);
      }
    }
    log.push(`🗓️ Événements calendrier existants (non-manuels actifs): ${existingMap.size}`);
    log.push(`🚫 Devis avec événement supprimé manuellement (ne seront pas re-créés): ${suppressedDevisIds.size}`);

    const docIds = new Set(documents.map((d) => d.id as string));
    let created = 0, updated = 0, deleted = 0;
    const createErrors: string[] = [];
    const updateErrors: string[] = [];

    // 3. Upsert events for each document
    for (const doc of documents) {
      if (suppressedDevisIds.has(doc.id as string)) {
        log.push(`⏭️ Skip (supprimé manuellement): ${doc.client_nom}`);
        continue;
      }

      const fd = (doc.donnees_completes as DevisRecord)?.formData;
      const activite = fd?.activity && fd.activity !== "none" ? fd.activity : null;
      const actLabel = activite ? (ACTIVITY_LABELS[activite] ?? null) : null;
      const titre = [actLabel, doc.client_nom].filter(Boolean).join(" — ") || doc.client_nom || "Sans titre";

      // Use effective date: column first, then formData.date as fallback
      const dateEvent = (doc.date_prestation as string) || fd?.date || null;
      if (!dateEvent) {
        log.push(`⚠️ Date introuvable pour: ${doc.client_nom} (id: ${(doc.id as string).slice(0, 8)})`);
        continue;
      }

      const payload = {
        devis_id: doc.id as string,
        titre,
        date_event: dateEvent,
        heure_debut: fd?.heureDebut?.trim() || null,
        type_client: (doc.client_type as string) ?? null,
        nom_client: (doc.client_nom as string) ?? null,
        activite,
        nb_personnes: fd?.participantsCount ?? null,
        montant: (doc.montant_final as number) ?? null,
        acompte_recu: ((doc.acompte as number) ?? 0) > 0,
        acompte_montant: ((doc.acompte as number) ?? 0) > 0 ? (doc.acompte as number) : null,
        manuel: false,
        created_by: "sync",
      };

      const existingId = existingMap.get(doc.id as string);
      if (existingId) {
        const { error: upErr } = await supabase.from("calendar_events").update(payload).eq("id", existingId);
        if (upErr) {
          updateErrors.push(`${doc.client_nom}: ${upErr.message}`);
          log.push(`❌ Update échoué pour ${doc.client_nom}: ${upErr.message}`);
        } else {
          updated++;
          log.push(`🔄 Mis à jour: ${doc.client_nom} — ${dateEvent}`);
        }
      } else {
        const { error: insErr } = await supabase.from("calendar_events").insert(payload);
        if (insErr) {
          // Fallback: find by devis_id (may exist with different date if constraint was violated)
          log.push(`❌ Insert échoué pour ${doc.client_nom} (${dateEvent}): ${insErr.message}`);
          if (insErr.message.includes("unique") || insErr.message.includes("duplicate") || insErr.code === "23505") {
            log.push(`   → Contrainte UNIQUE détectée! Exécute sql_calendar_events_fix.sql dans Supabase.`);
          }
          const { data: fallback } = await supabase
            .from("calendar_events")
            .select("id")
            .eq("devis_id", doc.id as string)
            .maybeSingle();
          if (fallback) {
            await supabase.from("calendar_events").update(payload).eq("id", fallback.id);
            updated++;
            log.push(`   → Fallback update OK`);
          } else {
            createErrors.push(`${doc.client_nom} (${dateEvent}): ${insErr.message}`);
          }
        } else {
          created++;
          log.push(`✨ Créé: ${doc.client_nom} — ${dateEvent}`);
        }
      }
    }

    // 4. Delete orphaned events (devis deleted from archives)
    const orphanEntries = Array.from(existingMap.entries())
      .filter(([devisId]) => !docIds.has(devisId));
    for (const [devisId, eventId] of orphanEntries) {
      await supabase.from("calendar_events").delete().eq("id", eventId);
      deleted++;
      log.push(`🗑️ Supprimé (orphelin, devis_id: ${devisId.slice(0, 8)})`);
    }

    log.push(`\n📊 Résultat: ${created} créés, ${updated} mis à jour, ${deleted} supprimés`);
    if (createErrors.length > 0) log.push(`⚠️ Erreurs création: ${createErrors.join("; ")}`);

    return NextResponse.json({ ok: true, created, updated, deleted, log, createErrors });
  } catch (err) {
    log.push(`💥 Exception: ${String(err)}`);
    return NextResponse.json({ error: String(err), log }, { status: 500 });
  }
}
