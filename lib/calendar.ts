import { supabase } from "./supabase";
import { getSession } from "./auth";
import type { DevisRecord } from "./types";

export interface CalendarEvent {
  id: string;
  devis_id?: string | null;
  titre: string;
  date_event: string;
  heure_debut?: string | null;
  type_client?: string | null;
  nom_client?: string | null;
  activite?: string | null;
  nb_personnes?: number | null;
  montant?: number | null;
  acompte_recu: boolean;
  acompte_montant?: number | null;
  notes?: string | null;
  manuel: boolean;
  supprime_manuellement?: boolean;
  created_at: string;
  created_by: string;
}

export const CLIENT_STYLES: Record<string, { text: string; bg: string; solid: string; label: string }> = {
  entreprise:       { text: "#0071E3", bg: "rgba(0,113,227,0.10)",  solid: "#0071E3", label: "Entreprise" },
  association:      { text: "#7C3AED", bg: "rgba(124,58,237,0.10)", solid: "#7C3AED", label: "Association" },
  scolaire:         { text: "#16A34A", bg: "rgba(22,163,74,0.10)",  solid: "#16A34A", label: "Scolaire" },
  loisirs:          { text: "#EA580C", bg: "rgba(234,88,12,0.10)",  solid: "#EA580C", label: "Service Jeunesse" },
  service_jeunesse: { text: "#EA580C", bg: "rgba(234,88,12,0.10)",  solid: "#EA580C", label: "Service Jeunesse" },
  organisme_public: { text: "#0D9488", bg: "rgba(13,148,136,0.10)", solid: "#0D9488", label: "Org. public" },
  particulier:      { text: "#6E6E73", bg: "rgba(110,110,115,0.10)",solid: "#6E6E73", label: "Particulier" },
};

export const DEFAULT_STYLE = { text: "#6E6E73", bg: "rgba(110,110,115,0.10)", solid: "#6E6E73", label: "Manuel" };

export function getClientStyle(type?: string | null) {
  return type ? (CLIENT_STYLES[type] ?? DEFAULT_STYLE) : DEFAULT_STYLE;
}

export async function getCalendarEventsInRange(from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("date_event", from)
    .lte("date_event", to)
    .order("date_event", { ascending: true })
    .order("heure_debut", { ascending: true, nullsFirst: true });
  if (error) { console.warn("[calendar] fetch error", error.message); return []; }
  const all = (data ?? []) as CalendarEvent[];
  const visible = all.filter(e => !e.supprime_manuellement);
  console.log(`[calendar] fetched ${all.length} events (${visible.length} visible) ${from} → ${to}`, visible.map(e => ({ id: e.id.slice(0,8), date: e.date_event, titre: e.titre, devis_id: e.devis_id?.slice(0,8) })));
  return visible;
}

export async function updateCalendarEvent(id: string, patch: Partial<CalendarEvent>): Promise<void> {
  const { error } = await supabase.from("calendar_events").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createCalendarEvent(
  ev: Omit<CalendarEvent, "id" | "created_at">
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({ ...ev, created_by: getSession()?.username ?? "manuel" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CalendarEvent;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  // Try soft-delete first (requires supprime_manuellement column to exist)
  const { error } = await supabase.from("calendar_events").update({ supprime_manuellement: true }).eq("id", id);
  if (error) {
    // Column not yet migrated — fall back to hard delete
    const { error: delErr } = await supabase.from("calendar_events").delete().eq("id", id);
    if (delErr) throw new Error(delErr.message);
  }
}

export async function deleteCalendarEventByDevisId(devisId: string): Promise<void> {
  const { error } = await supabase.from("calendar_events").delete().eq("devis_id", devisId);
  if (error) console.warn("[calendar] deleteByDevisId error", error.message);
}

export interface AcompteEntry {
  id: string;
  montant: number;
  date: string;
  notes?: string;
}

export async function getAcompteEntries(): Promise<AcompteEntry[]> {
  try {
    const { data, error } = await supabase
      .from("ca_entries")
      .select("id, montant, date, notes")
      .eq("source", "acompte")
      .order("date", { ascending: false });
    if (error) { console.warn("[calendar] acompte entries error", error.message); return []; }
    return (data ?? []) as AcompteEntry[];
  } catch {
    return [];
  }
}

const CAL_ACT_LABELS: Record<string, string> = {
  paddle: "Paddle",
  kayak: "Kayak",
  hybride: "Paddle + Kayak",
  mega_paddle: "MégaPaddle",
};

/** Synchronise calendar_events depuis un DevisRecord sauvegardé (best-effort).
 *  Crée l'événement s'il n'existe pas encore, le met à jour sinon. */
export async function syncCalendarEventFromDevis(record: DevisRecord): Promise<void> {
  // Les factures n'apparaissent jamais dans le calendrier — elles sont liées au devis original
  if (record.documentType === "facture") return;

  const fd = record.formData;
  const dateEvent = fd.date || record.date;
  if (!dateEvent) return;

  const activite = fd.activity && fd.activity !== "none" ? fd.activity : null;
  const actLabel = activite ? (CAL_ACT_LABELS[activite] ?? null) : null;
  const titre =
    [actLabel, record.clientName].filter(Boolean).join(" — ") ||
    record.clientName ||
    "Sans titre";

  const payload = {
    titre,
    date_event: dateEvent,
    heure_debut: fd.heureDebut?.trim() || null,
    type_client: record.clientType,
    nom_client: record.clientName,
    activite,
    nb_personnes: fd.participantsCount ?? null,
    montant: record.totalNet,
  };

  // Chercher un événement existant lié à ce devis
  // select("*") évite les erreurs "column does not exist" si le schéma est incomplet
  const findResult = await supabase
    .from("calendar_events")
    .select("*")
    .eq("devis_id", record.id)
    .eq("manuel", false)
    .maybeSingle();

  if (findResult.error && findResult.error.code !== "42703") {
    // 42703 = undefined_column → colonne manquante, on continue (traité comme "pas d'event")
    console.warn("[calendar] syncCalendarEventFromDevis find error", findResult.error.message);
    return;
  }
  if (findResult.error) {
    console.warn("[calendar] colonne manquante:", findResult.error.message, "— exécute data/sql_calendar_events_fix.sql");
  }

  const existing = findResult.data as (Record<string, unknown> & { id: string }) | null;

  if (existing) {
    // Ne pas ressusciter un événement supprimé manuellement
    if (existing.supprime_manuellement === true) return;
    const { error } = await supabase
      .from("calendar_events")
      .update(payload)
      .eq("id", existing.id);
    if (error) console.warn("[calendar] syncCalendarEventFromDevis update error", error.message);
  } else {
    // Créer l'événement s'il n'existe pas encore
    const { error } = await supabase.from("calendar_events").insert({
      ...payload,
      devis_id: record.id,
      manuel: false,
      created_by: "sync",
    });
    if (error) console.warn("[calendar] syncCalendarEventFromDevis insert error", error.message);
  }
}

export async function getTodayEventCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { count, error } = await supabase
      .from("calendar_events")
      .select("*", { count: "exact", head: true })
      .eq("date_event", today);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
