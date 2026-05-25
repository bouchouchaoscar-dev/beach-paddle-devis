import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function xlDateToStr(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split("T")[0];
}

export async function POST() {
  // Fichier dans /public/data/ pour être accessible depuis Vercel serverless
  const filePath = path.join(process.cwd(), "public", "data", "chiffres_beach_paddle.xlsx");

  if (!fs.existsSync(filePath)) {
    console.error("[import-excel] Fichier introuvable:", filePath);
    return NextResponse.json(
      { error: "Fichier non trouvé : public/data/chiffres_beach_paddle.xlsx" },
      { status: 404 }
    );
  }

  console.log("[import-excel] Lecture du fichier:", filePath);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Chiffres"];

  if (!ws) {
    const sheets = wb.SheetNames.join(", ");
    console.error("[import-excel] Feuille 'Chiffres' introuvable. Feuilles présentes:", sheets);
    return NextResponse.json(
      { error: `Feuille "Chiffres" introuvable. Feuilles présentes : ${sheets}` },
      { status: 400 }
    );
  }

  const data = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: true,
  }) as (string | number)[][];

  console.log("[import-excel] Feuille chargée:", data.length, "lignes,", (data[0] ?? []).length, "colonnes");

  const headerRow = data[0] ?? [];

  // Chaque mois est identifié par un serial Excel (> 40000) en ligne 0.
  // La colonne du serial = amtCol (montant dans les lignes de données).
  const blocks: { headerCol: number; dateStr: string }[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const v = headerRow[c];
    if (typeof v === "number" && v > 40000 && v < 55000) {
      blocks.push({ headerCol: c, dateStr: xlDateToStr(v) });
    }
  }

  console.log("[import-excel] Blocs mois détectés:", blocks.length);

  const entries: { date: string; montant: number; saison: string }[] = [];

  for (const blk of blocks) {
    const dayCol = blk.headerCol - 2; // col du nom/numéro de jour
    const amtCol = blk.headerCol;     // col du montant (= headerCol)
    const [yyyy, mm] = blk.dateStr.split("-");

    // Filtre sur années plausibles (le fichier contient parfois des serials fantômes)
    const year = parseInt(yyyy);
    if (year < 2016 || year > 2030) continue;

    let blockFound = 0;

    for (let r = 2; r < 42; r++) {
      if (r >= data.length) break;

      const dayRaw0 = data[r]?.[dayCol];        // col X-2 : numéro ou "SAM 09" ou nom seul
      const dayRaw1 = data[r]?.[dayCol + 1];    // col X-1 : numéro de jour (Layout B)
      const amtRaw  = data[r]?.[amtCol];        // col X   : montant

      let day: number | null = null;

      if (dayRaw0 !== "" && dayRaw0 !== undefined && dayRaw0 !== null) {
        // Layout A : "9" ou "SAM 09" → chiffre dans dayRaw0
        // Layout B : "DIM" (sans chiffre) → numéro de jour dans dayRaw1
        const match = String(dayRaw0).match(/\d+/);
        if (match) {
          day = parseInt(match[0]); // Layout A
        } else if (typeof dayRaw1 === "number") {
          day = dayRaw1; // Layout B : nom du jour + numéro entier dans la colonne suivante
        } else if (typeof dayRaw1 === "string" && /^\d+$/.test(dayRaw1.trim())) {
          day = parseInt(dayRaw1);
        }
      } else if (dayRaw1 !== "" && dayRaw1 !== undefined && dayRaw1 !== null) {
        // dayCol vide, dayCol+1 contient "SAM 2" (nom + numéro combinés, transition 2018-06)
        const match = String(dayRaw1).match(/\d+/);
        if (match) day = parseInt(match[0]);
      }

      if (!day) continue;

      const amt =
        typeof amtRaw === "number"
          ? amtRaw
          : parseFloat(String(amtRaw ?? "").replace(/[^0-9.-]/g, ""));

      if (day >= 1 && day <= 31 && !isNaN(amt) && amt > 0) {
        const dateStr = `${yyyy}-${mm}-${String(day).padStart(2, "0")}`;
        entries.push({ date: dateStr, montant: amt, saison: yyyy });
        blockFound++;
      }
    }

    if (blockFound > 0) {
      console.log(`[import-excel] ${blk.dateStr}: ${blockFound} entrées`);
    }
  }

  console.log("[import-excel] Total entrées parsées:", entries.length);

  if (entries.length === 0) {
    return NextResponse.json({ inserted: 0, total: 0, message: "Aucune donnée trouvée dans le fichier" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Vérifier les doublons sur la source import_excel
  const { data: existing, error: fetchErr } = await supabase
    .from("ca_entries")
    .select("date")
    .eq("source", "import_excel");

  if (fetchErr) {
    console.error("[import-excel] Erreur lecture Supabase:", fetchErr.message);
    return NextResponse.json(
      { error: `Erreur Supabase : ${fetchErr.message}` },
      { status: 500 }
    );
  }

  const existingDates = new Set((existing ?? []).map((e: { date: string }) => e.date));
  const toInsert = entries.filter((e) => !existingDates.has(e.date));

  console.log("[import-excel] Nouvelles entrées à insérer:", toInsert.length, "/ déjà en base:", existingDates.size);

  if (toInsert.length === 0) {
    return NextResponse.json({
      inserted: 0,
      total: entries.length,
      existing: existingDates.size,
      message: "Déjà importé",
    });
  }

  let inserted = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  // Insertion par batch de 100
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
      console.error("[import-excel] Erreur batch:", error.message);
      errorMessages.push(error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  console.log("[import-excel] Résultat: inserted=", inserted, "errors=", errors);

  return NextResponse.json({
    inserted,
    errors,
    total: entries.length,
    ...(errorMessages.length > 0 ? { errorDetail: errorMessages[0] } : {}),
  });
}
