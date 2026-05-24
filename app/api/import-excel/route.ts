import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

function xlDateToStr(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split("T")[0];
}

export async function POST() {
  const filePath = path.join(process.cwd(), "data", "chiffres_beach_paddle.xlsx");

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Fichier non trouvé : data/chiffres_beach_paddle.xlsx" }, { status: 404 });
  }

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Chiffres"];

  if (!ws) {
    return NextResponse.json({ error: 'Feuille "Chiffres" introuvable' }, { status: 400 });
  }

  const data = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: true,
  }) as (string | number)[][];

  const headerRow = data[0] ?? [];

  // Find month blocks — Excel date serials are ~40000–50000
  const blocks: { headerCol: number; dateStr: string }[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const v = headerRow[c];
    if (typeof v === "number" && v > 40000 && v < 50000) {
      blocks.push({ headerCol: c, dateStr: xlDateToStr(v) });
    }
  }

  const entries: { date: string; montant: number; saison: string }[] = [];

  for (const blk of blocks) {
    const dayCol = blk.headerCol - 2;
    const amtCol = blk.headerCol; // same column as header (confirmed)
    const [yyyy, mm] = blk.dateStr.split("-");

    for (let r = 2; r < 36; r++) {
      if (r >= data.length) break;
      const dayRaw = data[r]?.[dayCol];
      const amtRaw = data[r]?.[amtCol];

      if (!dayRaw || amtRaw === "" || amtRaw === undefined || amtRaw === null) continue;

      const dayMatch = String(dayRaw).match(/\d+/);
      const day = dayMatch ? parseInt(dayMatch[0]) : null;
      const amt =
        typeof amtRaw === "number"
          ? amtRaw
          : parseFloat(String(amtRaw).replace(/[^0-9.-]/g, ""));

      if (day && day >= 1 && day <= 31 && !isNaN(amt) && amt > 0) {
        const dateStr = `${yyyy}-${mm}-${String(day).padStart(2, "0")}`;
        entries.push({ date: dateStr, montant: amt, saison: yyyy });
      }
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ inserted: 0, total: 0, message: "Aucune donnée trouvée" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check existing import_excel dates to avoid duplicates
  const { data: existing } = await supabase
    .from("ca_entries")
    .select("date")
    .eq("source", "import_excel");

  const existingDates = new Set((existing ?? []).map((e: { date: string }) => e.date));
  const toInsert = entries.filter((e) => !existingDates.has(e.date));

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, total: entries.length, message: "Déjà importé" });
  }

  let inserted = 0;
  let errors = 0;

  // Batch insert in chunks of 100
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100).map((e) => ({
      date: e.date,
      montant: e.montant,
      source: "import_excel",
      saison: e.saison,
      created_by: "import",
    }));

    const { error } = await supabase.from("ca_entries").insert(batch);
    if (error) {
      console.error("[import-excel] batch error:", error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  return NextResponse.json({ inserted, errors, total: entries.length });
}
