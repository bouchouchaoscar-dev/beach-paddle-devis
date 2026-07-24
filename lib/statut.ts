import { supabase } from "./supabase";

export type StatutValue = "ouvert" | "incertain" | "ferme_aujourdhui" | "ferme_saison";
export type StatutEffectif = StatutValue | "auto";

export interface StatutRow {
  id: number;
  statut: StatutValue;
  date_jour: string; // YYYY-MM-DD (Europe/Paris)
  mis_a_jour: string; // ISO 8601 UTC
}

export interface StatutResult {
  statut: StatutEffectif;
  misAJourLe: string | null;
}

export function parisToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

export function resolveStatut(row: StatutRow | null): StatutResult {
  if (!row) return { statut: "auto", misAJourLe: null };
  // ferme_saison ne s'expire jamais
  if (row.statut === "ferme_saison") return { statut: "ferme_saison", misAJourLe: row.mis_a_jour };
  // Les autres statuts expirent si la date stockée n'est pas aujourd'hui (Paris)
  if (row.date_jour !== parisToday()) return { statut: "auto", misAJourLe: row.mis_a_jour };
  return { statut: row.statut, misAJourLe: row.mis_a_jour };
}

export async function getStatutRow(): Promise<StatutRow | null> {
  const { data, error } = await supabase
    .from("statut_ouverture")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) { console.warn("[statut] getStatutRow error", error.message); return null; }
  return data as StatutRow | null;
}

export async function setStatut(statut: StatutValue): Promise<void> {
  const { error } = await supabase
    .from("statut_ouverture")
    .upsert(
      { id: 1, statut, date_jour: parisToday(), mis_a_jour: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw new Error(error.message);
}
