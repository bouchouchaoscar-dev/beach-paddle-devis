import type { CaEntry, Charge, Employee, WorkSession } from "./compta-types";
import { supabase } from "./supabase";
import { getSession } from "./auth";

function createdBy() {
  return getSession()?.username ?? "";
}

// ── CA Entries ───────────────────────────────────────────────────────────────

export async function getCaEntries(saison?: string): Promise<CaEntry[]> {
  if (saison) {
    const { data, error } = await supabase
      .from("ca_entries").select("*").order("date", { ascending: false }).eq("saison", saison);
    if (error) { console.warn("[compta] getCaEntries error", error.message); return []; }
    return (data ?? []) as CaEntry[];
  }

  // No saison filter: paginate to bypass Supabase's 1000-row default cap.
  // Root cause: 1011 rows total, oldest 2016 entries fall beyond row 1000
  // and were silently excluded from the "all seasons" view.
  const PAGE = 1000;
  const all: CaEntry[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("ca_entries").select("*").order("date", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) { console.warn("[compta] getCaEntries paginate error", error.message); break; }
    if (!data?.length) break;
    all.push(...(data as CaEntry[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function saveCaEntry(entry: Omit<CaEntry, "id" | "created_at">): Promise<void> {
  const { error } = await supabase.from("ca_entries").insert({
    ...entry,
    created_by: createdBy(),
  });
  if (error) throw new Error(error.message);
}

export async function updateCaEntry(id: string, patch: Partial<CaEntry>): Promise<void> {
  const { error } = await supabase.from("ca_entries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCaEntry(id: string): Promise<void> {
  const { error } = await supabase.from("ca_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Charges ──────────────────────────────────────────────────────────────────

export async function getCharges(saison?: string): Promise<Charge[]> {
  let q = supabase.from("charges").select("*").order("date", { ascending: false });
  if (saison) q = q.eq("saison", saison);
  const { data, error } = await q;
  if (error) { console.warn("[compta] getCharges error", error.message); return []; }
  return (data ?? []) as Charge[];
}

export async function saveCharge(charge: Omit<Charge, "id" | "created_at">): Promise<void> {
  const { error } = await supabase.from("charges").insert({
    ...charge,
    created_by: createdBy(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteCharge(id: string): Promise<void> {
  const { error } = await supabase.from("charges").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Employees ────────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("nom", { ascending: true });
  if (error) { console.warn("[compta] getEmployees error", error.message); return []; }
  return (data ?? []) as Employee[];
}

export async function saveEmployee(emp: Omit<Employee, "id" | "created_at">): Promise<void> {
  const { error } = await supabase.from("employees").insert(emp);
  if (error) throw new Error(error.message);
}

export async function updateEmployee(id: string, patch: Partial<Employee>): Promise<void> {
  const { error } = await supabase.from("employees").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}


// ── Work Sessions ────────────────────────────────────────────────────────────

export async function getWorkSessions(saison?: string): Promise<WorkSession[]> {
  let q = supabase.from("work_sessions").select("*").order("date", { ascending: false });
  if (saison) q = q.eq("saison", saison);
  const { data, error } = await q;
  if (error) { console.warn("[compta] getWorkSessions error", error.message); return []; }
  return (data ?? []) as WorkSession[];
}

export async function saveWorkSession(session: Omit<WorkSession, "id" | "created_at">): Promise<void> {
  const { error } = await supabase.from("work_sessions").insert({
    ...session,
    created_by: createdBy(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteWorkSession(id: string): Promise<void> {
  const { error } = await supabase.from("work_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
