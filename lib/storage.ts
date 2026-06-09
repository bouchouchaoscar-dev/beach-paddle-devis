import type { DevisRecord } from "./types";
import { supabase } from "./supabase";
import { getSession } from "./auth";
import { deleteCalendarEventByDevisId } from "./calendar";
import { buildAutoDescription } from "./autoDescription";

// ── localStorage helpers (fallback) ─────────────────────────────────────────

const LS_KEY = "bp_devis_list";

function lsGetAll(): DevisRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as DevisRecord[]) : [];
  } catch {
    return [];
  }
}

function lsSave(record: DevisRecord): void {
  if (typeof window === "undefined") return;
  const list = lsGetAll();
  const idx = list.findIndex((d) => d.id === record.id);
  if (idx >= 0) list[idx] = record;
  else list.unshift(record);
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function lsDelete(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(lsGetAll().filter((d) => d.id !== id)));
}

// ── Supabase row → DevisRecord ───────────────────────────────────────────────

function rowToRecord(row: { donnees_completes: unknown }): DevisRecord {
  return row.donnees_completes as DevisRecord;
}

// ── Public API (all async) ───────────────────────────────────────────────────

export async function getDevisList(): Promise<DevisRecord[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("donnees_completes")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.warn("[storage] Supabase read failed, falling back to localStorage:", error?.message);
    return lsGetAll();
  }

  // Supabase is the single source of truth — localStorage is NOT merged.
  // Old localStorage records can be cleared with clearLocalCache().
  return data.map(rowToRecord);
}

export async function saveDevis(record: DevisRecord): Promise<{ source: "supabase" | "localStorage" }> {
  const session = getSession();

  const { error } = await supabase.from("documents").upsert(
    {
      id: record.id,
      numero: record.numero,
      type: record.documentType,
      client_nom: record.clientName,
      client_type: record.clientType,
      client_adresse: record.formData.clientAddress || null,
      date_document: new Date().toISOString().split("T")[0],
      date_prestation: record.date || null,
      montant_total: record.totalBrut,
      montant_remise: record.totalBrut - record.totalNet,
      montant_final: record.totalNet,
      acompte: record.formData.acompteVerse ?? 0,
      donnees_completes: record,
      created_by: session?.username ?? "",
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("[storage] Supabase write failed, falling back to localStorage:", error.message);
    lsSave(record);
    return { source: "localStorage" };
  }

  return { source: "supabase" };
}

export async function deleteDevis(id: string): Promise<void> {
  lsDelete(id);
  await deleteCalendarEventByDevisId(id); // best-effort — no throw if no event
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) {
    console.warn("[storage] Supabase delete failed:", error.message);
    throw new Error(error.message);
  }
}

export async function updateDevisHeure(id: string, heure: string): Promise<void> {
  const record = await getDevisById(id);
  if (!record) return;
  const newFormData = { ...record.formData, heureDebut: heure };
  newFormData.prestationDescription = buildAutoDescription(newFormData);
  await saveDevis({ ...record, formData: newFormData });
}

export function clearLocalCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_KEY);
}

export function localCacheCount(): number {
  return lsGetAll().length;
}

export async function getDevisById(id: string): Promise<DevisRecord | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("donnees_completes")
    .eq("id", id)
    .single();

  if (error || !data) {
    return lsGetAll().find((d) => d.id === id) ?? null;
  }

  return rowToRecord(data);
}

/** Generates next document number for a given date: N°JJ/MM/AA-XXX */
export async function generateNumero(date: string): Promise<string> {
  const [year, month, day] = date.split("-");
  const yy = year.slice(-2);
  const prefix = `N°${day}/${month}/${yy}-`;

  const { data, error } = await supabase
    .from("documents")
    .select("numero")
    .like("numero", `${prefix}%`);

  const source: string[] = error || !data ? lsGetAll().map((d) => d.numero) : data.map((r) => r.numero);

  const nums = source
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
