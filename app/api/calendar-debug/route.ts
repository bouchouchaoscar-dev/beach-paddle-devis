import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { DevisRecord } from "@/lib/types";

export const maxDuration = 30;

export async function GET() {
  const errors: string[] = [];

  // 1. All documents (no date filter — we check in JS)
  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("id, numero, client_nom, client_type, date_prestation, donnees_completes")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (docsErr) {
    errors.push(`documents fetch: ${docsErr.message}`);
    return NextResponse.json({ error: docsErr.message, errors }, { status: 500 });
  }

  // 2. All calendar events
  const { data: events, error: evErr } = await supabase
    .from("calendar_events")
    .select("id, devis_id, date_event, titre, manuel, supprime_manuellement, created_by")
    .limit(5000);

  if (evErr) {
    errors.push(`calendar_events fetch: ${evErr.message}`);
  }

  const allDocs = docs ?? [];
  const allEvents = events ?? [];

  // 3. Classify documents
  const totalDocs = allDocs.length;
  let docsWithDateColumn = 0;
  let docsWithDateInFormData = 0;

  const docsWithAnyDate: Array<{
    id: string; numero: string; clientName: string; date: string;
    dateSource: "column" | "formData" | "both"; hasDateColumn: boolean; hasDateFormData: boolean;
  }> = [];

  for (const doc of allDocs) {
    const fd = (doc.donnees_completes as DevisRecord)?.formData;
    const hasCol = !!doc.date_prestation;
    const hasForm = !!(fd?.date && !fd?.dateADefinir);
    if (hasCol) docsWithDateColumn++;
    if (hasForm) docsWithDateInFormData++;
    if (hasCol || hasForm) {
      const effectiveDate = (doc.date_prestation as string) || (fd?.date ?? "");
      docsWithAnyDate.push({
        id: doc.id as string,
        numero: doc.numero as string,
        clientName: doc.client_nom as string,
        date: effectiveDate,
        dateSource: hasCol && hasForm ? "both" : hasCol ? "column" : "formData",
        hasDateColumn: hasCol,
        hasDateFormData: hasForm,
      });
    }
  }

  // 4. Index active (non-manual, non-suppressed) calendar events by devis_id
  const activeEventsByDevisId = new Map<string, string>(); // devis_id → event.id
  for (const ev of allEvents) {
    if (ev.devis_id && !ev.supprime_manuellement && !ev.manuel) {
      activeEventsByDevisId.set(ev.devis_id as string, ev.id as string);
    }
  }

  // 5. Missing = doc with a date but no active calendar event
  const missing = docsWithAnyDate
    .filter(d => !activeEventsByDevisId.has(d.id))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    totalDocs,
    docsWithDateColumn,
    docsWithDateInFormData,
    docsWithAnyDate: docsWithAnyDate.length,
    calendarEventsTotal: allEvents.length,
    calendarEventsNonManual: allEvents.filter(e => !e.manuel).length,
    calendarEventsActive: allEvents.filter(e => !e.manuel && !e.supprime_manuellement).length,
    missingCount: missing.length,
    missing,
    errors,
  });
}
