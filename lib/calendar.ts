import { supabase } from "./supabase";
import { getSession } from "./auth";

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
  entreprise:      { text: "#0071E3", bg: "rgba(0,113,227,0.10)",  solid: "#0071E3", label: "Entreprise" },
  scolaire:        { text: "#16A34A", bg: "rgba(22,163,74,0.10)",  solid: "#16A34A", label: "Scolaire" },
  loisirs:         { text: "#EA580C", bg: "rgba(234,88,12,0.10)",  solid: "#EA580C", label: "Service Jeunesse" },
  service_jeunesse:{ text: "#EA580C", bg: "rgba(234,88,12,0.10)",  solid: "#EA580C", label: "Service Jeunesse" },
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
    .order("date_event", { ascending: true });
  if (error) { console.warn("[calendar] fetch error", error.message); return []; }
  // Filter client-side — resilient if supprime_manuellement column not yet added
  return ((data ?? []) as CalendarEvent[]).filter(e => !e.supprime_manuellement);
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
