import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SOURCE = "import_excel_compta_2025";

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const results: Record<string, number | string> = {};

  // Delete charges from import
  const { count: chargesCount, error: chargesErr } = await supabase
    .from("charges").delete({ count: "exact" }).eq("created_by", SOURCE);
  if (chargesErr) results.charges_error = chargesErr.message;
  else results.charges_deleted = chargesCount ?? 0;

  // Delete work_sessions from import
  const { count: sessionsCount, error: sessionsErr } = await supabase
    .from("work_sessions").delete({ count: "exact" }).eq("created_by", SOURCE);
  if (sessionsErr) results.sessions_error = sessionsErr.message;
  else results.sessions_deleted = sessionsCount ?? 0;

  // Delete employees created by import (saison_debut='2025' + created_by=SOURCE)
  const { count: empCount, error: empErr } = await supabase
    .from("employees").delete({ count: "exact" }).eq("created_by", SOURCE);
  if (empErr) results.employees_error = empErr.message;
  else results.employees_deleted = empCount ?? 0;

  console.log("[reset-compta-2025]", results);
  return NextResponse.json({ ok: true, deleted: results });
}
