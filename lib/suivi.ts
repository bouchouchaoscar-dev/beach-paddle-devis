import { supabase } from "./supabase";
import type { SuiviReference, SuiviMouvement, MouvementType, MouvementCompte } from "./suivi-types";

export async function getSuiviReference(): Promise<SuiviReference | null> {
  const { data, error } = await supabase
    .from("suivi_reference")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as SuiviReference;
}

export async function upsertSuiviReference(
  montant: number,
  note: string | null,
  existingId?: string
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  if (existingId) {
    const { error } = await supabase
      .from("suivi_reference")
      .update({ montant, note, updated_at: now })
      .eq("id", existingId);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase
    .from("suivi_reference")
    .insert({ montant, note, created_at: now, updated_at: now });
  return { error: error?.message ?? null };
}

export async function getSuiviMouvements(): Promise<SuiviMouvement[]> {
  const { data, error } = await supabase
    .from("suivi_mouvements")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as SuiviMouvement[];
}

export async function addSuiviMouvement(
  date: string,
  type: MouvementType,
  compte: MouvementCompte,
  montant: number,
  note: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("suivi_mouvements")
    .insert({ date, type, compte, montant, note, created_at: new Date().toISOString() });
  return { error: error?.message ?? null };
}

export async function updateSuiviMouvement(
  id: string,
  date: string,
  type: MouvementType,
  compte: MouvementCompte,
  montant: number,
  note: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("suivi_mouvements")
    .update({ date, type, compte, montant, note })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteSuiviMouvement(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("suivi_mouvements").delete().eq("id", id);
  return { error: error?.message ?? null };
}
