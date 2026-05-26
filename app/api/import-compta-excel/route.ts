import { NextResponse, NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SOURCE = "import_excel_compta_2025";

// Fixed column indices (confirmed by inspecting the actual file)
const COL = {
  DIV_OBJET: 0, DIV_DATE: 3, DIV_MONTANT: 4,
  METRO_OBJET: 7, METRO_DATE: 10, METRO_MONTANT: 11,
  EMP_NOM: 14, EMP_HEURES: 16, EMP_DATE: 17, EMP_MONTANT: 18,
};

const SHEET_MONTH: Record<string, number> = {
  avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10,
};

function normalise(v: unknown): string {
  return String(v ?? "").toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Excel serial date → "YYYY-MM-DD"
function serialToISO(serial: unknown): string | null {
  if (typeof serial !== "number" || serial < 40000) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseMontant(raw: unknown): number | null {
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw).replace(/[^0-9.,\-]/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

type ChargeCategory = "restauration_metro" | "restauration_autre" | "equipement" | "salaire" | "autre";

function guessCategorie(objet: string): ChargeCategory {
  const s = normalise(objet);
  const resto = ["carrefour", "g20", "boulangerie", "boulang", "leclerc", "franprix",
    "intermarche", "lidl", "casino", "aldi", "monoprix", "pizza", "dejeuner",
    "coocki", "coocky", "cookie", "vins", "biere", "essence", "influenceur"];
  const equip = ["leroy merlin", "leroy", "bricoman", "decathlon", "bricorama", "castorama",
    "karcher", "enrouleur", "pompe", "passerelle"];
  if (equip.some((k) => s.includes(k))) return "equipement";
  if (resto.some((k) => s.includes(k))) return "restauration_autre";
  return "autre";
}

interface ParsedSheet {
  diverses: { date: string; montant: number; objet: string }[];
  metro: { date: string; montant: number; objet: string }[];
  employes: { nom: string; heures: number; date: string; montant: number }[];
  warnings: string[];
}

function parseSheet(rows: unknown[][], sheetName: string): ParsedSheet {
  const diverses: ParsedSheet["diverses"] = [];
  const metro: ParsedSheet["metro"] = [];
  const employes: ParsedSheet["employes"] = [];
  const warnings: string[] = [];

  // Data starts at row index 8 (0-based), ends just before the first "TOTAL" row
  const DATA_START = 8;
  let endIdx = rows.length;
  for (let i = DATA_START; i < rows.length; i++) {
    const cell = String(rows[i]?.[COL.DIV_OBJET] ?? "");
    if (cell.toUpperCase().startsWith("TOTAL")) { endIdx = i; break; }
  }

  for (let i = DATA_START; i < endIdx; i++) {
    const row = rows[i] ?? [];

    // ── CHARGES DIVERSES ──────────────────────────────────────────────────────
    const divObjet = String(row[COL.DIV_OBJET] ?? "").trim();
    const divDate = serialToISO(row[COL.DIV_DATE]);
    const divMt = parseMontant(row[COL.DIV_MONTANT]);
    if (divDate && divMt !== null && divMt > 0) {
      diverses.push({ date: divDate, montant: divMt, objet: divObjet });
    } else if (divObjet && row[COL.DIV_DATE] != null && !divDate) {
      // Warn only if a date cell exists but couldn't be parsed (not when simply empty)
      warnings.push(`[${sheetName}] Diverses ignorée ligne ${i + 1}: objet="${divObjet}" date invalide=${JSON.stringify(row[COL.DIV_DATE])} mt=${JSON.stringify(row[COL.DIV_MONTANT])}`);
    }

    // ── CHARGES METRO ─────────────────────────────────────────────────────────
    const metObjet = String(row[COL.METRO_OBJET] ?? "").trim();
    const metDate = serialToISO(row[COL.METRO_DATE]);
    const metMt = parseMontant(row[COL.METRO_MONTANT]);
    if (metDate && metMt !== null && metMt > 0) {
      metro.push({ date: metDate, montant: metMt, objet: metObjet });
    } else if (metObjet && row[COL.METRO_DATE] != null && !metDate) {
      warnings.push(`[${sheetName}] Métro ignorée ligne ${i + 1}: objet="${metObjet}" date invalide=${JSON.stringify(row[COL.METRO_DATE])} mt=${JSON.stringify(row[COL.METRO_MONTANT])}`);
    }

    // ── CHARGES EMPLOYÉS ──────────────────────────────────────────────────────
    const empNom = String(row[COL.EMP_NOM] ?? "").trim();
    const empDate = serialToISO(row[COL.EMP_DATE]);
    const empHeures = parseMontant(row[COL.EMP_HEURES]);
    const empMt = parseMontant(row[COL.EMP_MONTANT]);
    if (empNom && empDate && empHeures !== null && empHeures > 0 && empMt !== null && empMt > 0) {
      employes.push({ nom: empNom, heures: empHeures, date: empDate, montant: empMt });
    } else if (empNom && row[COL.EMP_DATE] != null && !empDate) {
      warnings.push(`[${sheetName}] Employé ignoré ligne ${i + 1}: nom="${empNom}" date invalide=${JSON.stringify(row[COL.EMP_DATE])} h=${JSON.stringify(row[COL.EMP_HEURES])} mt=${JSON.stringify(row[COL.EMP_MONTANT])}`);
    }
  }

  return { diverses, metro, employes, warnings };
}

// ── GET — debug ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const filePath = path.join(process.cwd(), "public", "data", "compta-2025", "Compta Beach Paddle-2025.xlsx");
  const diag = {
    cwd: process.cwd(),
    filePath,
    exists: fs.existsSync(filePath),
    dirContents: fs.existsSync(path.dirname(filePath)) ? fs.readdirSync(path.dirname(filePath)) : [],
  };

  if (!diag.exists) {
    return NextResponse.json({ error: "Fichier introuvable", diag }, { status: 404 });
  }

  const wb = XLSX.readFile(filePath);
  const sheetParam = new URL(req.url).searchParams.get("sheet");

  if (sheetParam) {
    const ws = wb.Sheets[sheetParam];
    if (!ws) return NextResponse.json({ error: `Onglet "${sheetParam}" introuvable`, sheets: wb.SheetNames }, { status: 404 });
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][];
    const parsed = parseSheet(rows, sheetParam);
    return NextResponse.json({
      sheet: sheetParam, totalRows: rows.length,
      diverses: parsed.diverses.length, metro: parsed.metro.length, employes: parsed.employes.length,
      warnings: parsed.warnings,
      sampleDiverses: parsed.diverses.slice(0, 5),
      sampleMetro: parsed.metro.slice(0, 5),
      sampleEmployes: parsed.employes.slice(0, 5),
    });
  }

  return NextResponse.json({ sheets: wb.SheetNames, diag, hint: "Ajouter ?sheet=Avril pour inspecter" });
}

// ── POST — import ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const filePath = path.join(process.cwd(), "public", "data", "compta-2025", "Compta Beach Paddle-2025.xlsx");

  if (!fs.existsSync(filePath)) {
    const dirPath = path.dirname(filePath);
    return NextResponse.json({
      error: "Fichier introuvable",
      diag: {
        cwd: process.cwd(),
        filePath,
        dirExists: fs.existsSync(dirPath),
        dirContents: fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [],
      },
    }, { status: 404 });
  }

  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "true";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  if (reset) {
    await supabase.from("charges").delete().eq("created_by", SOURCE);
    await supabase.from("work_sessions").delete().eq("created_by", SOURCE);
    console.log("[import-compta-excel] Reset effectué");
  }

  const wb = XLSX.readFile(filePath);
  const targetSheets = wb.SheetNames.filter((n) => SHEET_MONTH[normalise(n)] !== undefined);
  console.log("[import-compta-excel] Onglets à traiter:", targetSheets);

  // Employee cache to avoid duplicate lookups
  const empCache: Record<string, string> = {};

  let totalDiverses = 0, totalMetro = 0, totalSessions = 0;
  const allWarnings: string[] = [];
  const sheetStats: Record<string, { diverses: number; metro: number; sessions: number }> = {};

  for (const sheetName of targetSheets) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][];
    const { diverses, metro, employes, warnings } = parseSheet(rows, sheetName);
    allWarnings.push(...warnings);

    let sd = 0, sm = 0, se = 0;

    // ── Insert charges diverses ───────────────────────────────────────────────
    for (const e of diverses) {
      const categorie = guessCategorie(e.objet);
      const { error } = await supabase.from("charges").insert({
        date: e.date, montant: e.montant, categorie,
        fournisseur: e.objet.split(":")[0].trim() || e.objet,
        description: e.objet,
        saison: "2025", statut_paiement: "paye", created_by: SOURCE,
      });
      if (!error) { sd++; }
      else allWarnings.push(`[${sheetName}] Erreur charge diverse: ${error.message}`);
    }

    // ── Insert charges Métro ──────────────────────────────────────────────────
    for (const e of metro) {
      const { error } = await supabase.from("charges").insert({
        date: e.date, montant: e.montant, categorie: "restauration_metro" as ChargeCategory,
        fournisseur: "Métro",
        description: e.objet,
        saison: "2025", statut_paiement: "paye", created_by: SOURCE,
      });
      if (!error) { sm++; }
      else allWarnings.push(`[${sheetName}] Erreur charge Métro: ${error.message}`);
    }

    // ── Insert sessions employés ──────────────────────────────────────────────
    for (const e of employes) {
      // Upsert employee
      if (!empCache[e.nom]) {
        const { data: existing } = await supabase.from("employees").select("id").ilike("nom", e.nom).maybeSingle();
        if (existing) {
          empCache[e.nom] = existing.id;
        } else {
          const tarifHoraire = e.heures > 0 ? Math.round((e.montant / e.heures) * 100) / 100 : 10;
          const { data: newEmp, error: empErr } = await supabase
            .from("employees")
            .insert({ nom: e.nom, tarif_horaire: tarifHoraire, actif: true, saison_debut: "2025" })
            .select("id").single();
          if (empErr) { allWarnings.push(`[${sheetName}] Erreur création employé ${e.nom}: ${empErr.message}`); continue; }
          empCache[e.nom] = newEmp!.id;
        }
      }

      const empId = empCache[e.nom];
      const { error: wsErr } = await supabase.from("work_sessions").insert({
        employee_id: empId, date: e.date, heures: e.heures, montant: e.montant,
        saison: "2025", created_by: SOURCE,
      });
      if (wsErr) { allWarnings.push(`[${sheetName}] Erreur session ${e.nom}: ${wsErr.message}`); continue; }

      // Charge salariale liée
      await supabase.from("charges").insert({
        date: e.date, montant: e.montant, categorie: "salaire" as ChargeCategory,
        fournisseur: e.nom, description: `${e.heures}h — ${e.nom}`,
        saison: "2025", statut_paiement: "paye", created_by: SOURCE,
      });
      se++;
    }

    sheetStats[sheetName] = { diverses: sd, metro: sm, sessions: se };
    totalDiverses += sd; totalMetro += sm; totalSessions += se;
    console.log(`[import-compta-excel] ${sheetName}: ${sd} diverses, ${sm} Métro, ${se} sessions`);
  }

  return NextResponse.json({
    inserted: {
      charges_diverses: totalDiverses,
      charges_metro: totalMetro,
      sessions_employes: totalSessions,
      total_charges: totalDiverses + totalMetro + totalSessions,
    },
    sheets: sheetStats,
    warnings: allWarnings.length > 0 ? allWarnings.slice(0, 30) : undefined,
  });
}
