import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error: e1, count: c1 } = await supabase
    .from("charges")
    .delete({ count: "exact" })
    .eq("saison", "2025");

  const { error: e2, count: c2 } = await supabase
    .from("work_sessions")
    .delete({ count: "exact" })
    .eq("saison", "2025");

  const { error: e3, count: c3 } = await supabase
    .from("employees")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (e1 || e2 || e3) {
    return NextResponse.json(
      { error: [e1?.message, e2?.message, e3?.message].filter(Boolean).join(" | ") },
      { status: 500 }
    );
  }

  return NextResponse.json({ charges: c1 ?? 0, sessions: c2 ?? 0, employees: c3 ?? 0 });
}
