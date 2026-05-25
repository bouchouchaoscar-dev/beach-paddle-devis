import { NextResponse, NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SOURCE = "import_excel_compta_2025";

const SHEET_MONTH: Record<string, number> = {
  avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalise(v: unknown): string {
  return String(v ?? "").toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseDate(raw: unknown, sheetMonth: number): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  // Excel serial date
  if (typeof raw === "number" && raw > 40000) {
    const d = new Date((raw - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  // Just a day number (1–31)
  if (typeof raw === "number" && raw >= 1 && raw <= 31) {
    return `2025-${String(sheetMonth).padStart(2, "0")}-${String(raw).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // DD/MM or DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slash) {
    const d = parseInt(slash[1]), m = parseInt(slash[2]);
    const y = slash[3] ? (parseInt(slash[3]) < 100 ? 2000 + parseInt(slash[3]) : parseInt(slash[3])) : 2025;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12)
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // French text "5 avril 2025" or "5 avr."
  const moisFr: Record<string, number> = {
    janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  };
  const fr = normalise(s).match(/(\d{1,2})[\s\-]?([a-z]+)/);
  if (fr) {
    const day = parseInt(fr[1]);
    const mKey = fr[2].replace(/\./g, "").substring(0, 4);
    const mNum = Object.entries(moisFr).find(([k]) => k.startsWith(mKey))?.[1] ?? 0;
    if (day >= 1 && day <= 31 && mNum > 0)
      return `2025-${String(mNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // Plain integer string "5"
  const num = parseInt(s);
  if (!isNaN(num) && num >= 1 && num <= 31)
    return `2025-${String(sheetMonth).padStart(2, "0")}-${String(num).padStart(2, "0")}`;
  return null;
}

function parseMontant(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  const n = parseFloat(String(raw).replace(/[^0-9.,\-]/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// Find a column index whose header matches any of the given keywords
function findCol(headers: string[], keywords: string[]): number {
  return headers.findIndex((h) =>
    keywords.some((k) => normalise(h).includes(normalise(k)))
  );
}

type SectionKind = "diverses" | "metro" | "employes";

function detectSectionKind(row: unknown[]): SectionKind | null {
  const merged = row.map((c) => normalise(c)).join(" ");
  if (merged.includes("employe")) return "employes";
  if (merged.includes("metro") || merged.includes("metrop")) return "metro";
  if (merged.includes("divers")) return "diverses";
  return null;
}

function guessCategorie(objet: string): string {
  const s = normalise(objet);
  if (s.includes("metro") || s.includes("metrop")) return "restauration_metro";
  if (["carrefour","lidl","intermarch","aldi","monoprix","casino","super u"].some((k) => s.includes(k))) return "restauration_autre";
  if (["leroy","bricoman","decathlon","bricorama","castorama"].some((k) => s.includes(k))) return "equipement";
  return "autre";
}

// ── Parse one sheet ───────────────────────────────────────────────────────────

type RawEntry =
  | { kind: "charge"; date: string; montant: number; categorie: string; fournisseur: string; description: string }
  | { kind: "employe"; nom: string; date: string; heures: number; montant: number };

function parseSheet(rows: unknown[][], sheetMonth: number): { entries: RawEntry[]; warnings: string[] } {
  const entries: RawEntry[] = [];
  const warnings: string[] = [];

  let i = 0;
  while (i < rows.length) {
    const row = rows[i] ?? [];
    const kind = detectSectionKind(row);

    if (!kind) { i++; continue; }

    // Next non-empty row = column headers
    let headerIdx = i + 1;
    while (headerIdx < rows.length && (rows[headerIdx] ?? []).every((c) => c === "" || c === null || c === undefined)) {
      headerIdx++;
    }
    if (headerIdx >= rows.length) break;

    const headers = (rows[headerIdx] ?? []).map((c) => String(c ?? ""));
    let dataIdx = headerIdx + 1;

    if (kind === "employes") {
      const colNom = findCol(headers, ["nom", "employe", "prenom", "prénom", "agent"]);
      const colDate = findCol(headers, ["date", "jour"]);
      const colH = findCol(headers, ["heure", "nb h", "nbh", "h travail"]);
      const colMt = findCol(headers, ["montant", "total", "salaire", "remun", "€"]);

      while (dataIdx < rows.length) {
        const r = rows[dataIdx] ?? [];
        // Stop on empty row or new section
        if (r.every((c) => c === "" || c === null || c === undefined)) { dataIdx++; break; }
        if (detectSectionKind(r)) break;

        const nom = colNom >= 0 ? String(r[colNom] ?? "").trim() : "";
        const rawDate = colDate >= 0 ? r[colDate] : null;
        const rawH = colH >= 0 ? r[colH] : null;
        const rawMt = colMt >= 0 ? r[colMt] : null;

        const date = parseDate(rawDate, sheetMonth);
        const heures = parseMontant(rawH);
        const montant = parseMontant(rawMt);

        if (nom && date && heures !== null && montant !== null && heures > 0 && montant > 0) {
          entries.push({ kind: "employe", nom, date, heures, montant });
        } else if (nom || rawDate || rawMt) {
          warnings.push(`Employé ignoré ligne ${dataIdx + 1}: nom="${nom}" date="${rawDate}" h="${rawH}" mt="${rawMt}"`);
        }
        dataIdx++;
      }
    } else {
      // Charges Diverses or Charges Métro
      const colDate = findCol(headers, ["date", "jour"]);
      const colObj = findCol(headers, ["objet", "description", "libelle", "article", "designation"]);
      const colMt = findCol(headers, ["montant", "total", "prix", "€", "ht"]);
      const colFou = findCol(headers, ["fournisseur", "magasin", "enseigne"]);

      while (dataIdx < rows.length) {
        const r = rows[dataIdx] ?? [];
        if (r.every((c) => c === "" || c === null || c === undefined)) { dataIdx++; break; }
        if (detectSectionKind(r)) break;

        const rawDate = colDate >= 0 ? r[colDate] : null;
        const objet = colObj >= 0 ? String(r[colObj] ?? "").trim() : "";
        const rawMt = colMt >= 0 ? r[colMt] : null;
        const fournisseur = colFou >= 0 ? String(r[colFou] ?? "").trim() : objet;

        const date = parseDate(rawDate, sheetMonth);
        const montant = parseMontant(rawMt);

        if (date && montant !== null && montant > 0) {
          const categorie = kind === "metro" ? "restauration_metro" : guessCategorie(fournisseur || objet);
          const fou = kind === "metro" ? (fournisseur || "Métro") : (fournisseur || objet);
          entries.push({ kind: "charge", date, montant, categorie, fournisseur: fou, description: objet });
        } else if (rawDate || rawMt || objet) {
          warnings.push(`Charge ignorée ligne ${dataIdx + 1}: date="${rawDate}" objet="${objet}" mt="${rawMt}"`);
        }
        dataIdx++;
      }
    }
    i = dataIdx;
  }

  return { entries, warnings };
}

// ── GET — debug ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const filePath = path.join(process.cwd(), "public", "data", "compta-2025", "Compta Beach Paddle-2025.xlsx");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Fichier public/data/compta-2025/Compta Beach Paddle-2025.xlsx introuvable" }, { status: 404 });
  }
  const wb = XLSX.readFile(filePath);
  const sheetParam = new URL(req.url).searchParams.get("sheet");

  if (sheetParam) {
    const ws = wb.Sheets[sheetParam];
    if (!ws) return NextResponse.json({ error: `Onglet "${sheetParam}" introuvable`, sheets: wb.SheetNames }, { status: 404 });
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as unknown[][];
    const month = SHEET_MONTH[normalise(sheetParam)] ?? 0;
    const { entries, warnings } = parseSheet(rows, month);
    return NextResponse.json({ sheet: sheetParam, totalRows: rows.length, firstRows: rows.slice(0, 20), parsed: entries.length, warnings, sample: entries.slice(0, 10) });
  }

  return NextResponse.json({ sheets: wb.SheetNames, hint: "Ajouter ?sheet=Avril pour inspecter un onglet" });
}

// ── POST — import ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const filePath = path.join(process.cwd(), "public", "data", "compta-2025", "Compta Beach Paddle-2025.xlsx");

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Fichier public/data/compta-2025/Compta Beach Paddle-2025.xlsx introuvable. Placer le fichier dans public/data/compta-2025/ et redéployer." }, { status: 404 });
  }

  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "true";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Optional reset: delete previous import
  if (reset) {
    await supabase.from("charges").delete().eq("created_by", SOURCE);
    await supabase.from("work_sessions").delete().eq("created_by", SOURCE);
    console.log("[import-compta-excel] Reset: anciennes entrées supprimées");
  }

  // Check existing dates to avoid duplicates (soft dedup)
  const { data: existingCharges } = await supabase
    .from("charges").select("date, montant, fournisseur").eq("created_by", SOURCE);
  const existingChargesSet = new Set(
    (existingCharges ?? []).map((c: { date: string; montant: number; fournisseur: string }) => `${c.date}|${c.montant}|${c.fournisseur}`)
  );

  const wb = XLSX.readFile(filePath);
  const targetSheets = wb.SheetNames.filter((n) => SHEET_MONTH[normalise(n)] !== undefined);

  console.log("[import-compta-excel] Onglets trouvés:", wb.SheetNames, "→ traitement:", targetSheets);

  let totalCharges = 0, totalSessions = 0, totalSkipped = 0;
  const allWarnings: string[] = [];
  const sheetStats: Record<string, { charges: number; sessions: number; skipped: number }> = {};

  for (const sheetName of targetSheets) {
    const month = SHEET_MONTH[normalise(sheetName)];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as unknown[][];

    const { entries, warnings } = parseSheet(rows, month);
    allWarnings.push(...warnings.map((w) => `[${sheetName}] ${w}`));

    let sheetCharges = 0, sheetSessions = 0, sheetSkipped = 0;

    for (const entry of entries) {
      if (entry.kind === "charge") {
        const key = `${entry.date}|${entry.montant}|${entry.fournisseur}`;
        if (existingChargesSet.has(key)) { sheetSkipped++; totalSkipped++; continue; }
        existingChargesSet.add(key);

        const { error } = await supabase.from("charges").insert({
          date: entry.date,
          montant: entry.montant,
          categorie: entry.categorie,
          fournisseur: entry.fournisseur,
          description: entry.description || undefined,
          saison: "2025",
          statut_paiement: "paye",
          created_by: SOURCE,
        });
        if (!error) { totalCharges++; sheetCharges++; }
        else allWarnings.push(`[${sheetName}] Erreur insert charge: ${error.message}`);

      } else {
        // Upsert employee
        const nom = entry.nom;
        let empId: string | null = null;
        const { data: existingEmp } = await supabase
          .from("employees").select("id").ilike("nom", nom).single();
        if (existingEmp) {
          empId = existingEmp.id;
        } else {
          const { data: newEmp, error: empErr } = await supabase
            .from("employees")
            .insert({ nom, tarif_horaire: entry.heures > 0 ? entry.montant / entry.heures : 10, actif: true, saison_debut: "2025" })
            .select("id").single();
          if (empErr) { allWarnings.push(`[${sheetName}] Erreur création employé ${nom}: ${empErr.message}`); continue; }
          empId = newEmp?.id ?? null;
        }

        if (!empId) continue;

        const { error: wsErr } = await supabase.from("work_sessions").insert({
          employee_id: empId,
          date: entry.date,
          heures: entry.heures,
          montant: entry.montant,
          saison: "2025",
          created_by: SOURCE,
        });
        if (!wsErr) { totalSessions++; sheetSessions++; }
        else allWarnings.push(`[${sheetName}] Erreur insert session: ${wsErr.message}`);

        // Charge salariale liée
        await supabase.from("charges").insert({
          date: entry.date,
          montant: entry.montant,
          categorie: "salaire",
          fournisseur: nom,
          description: `${entry.heures}h — ${nom}`,
          saison: "2025",
          statut_paiement: "paye",
          created_by: SOURCE,
        });
        sheetCharges++;
      }
    }

    sheetStats[sheetName] = { charges: sheetCharges, sessions: sheetSessions, skipped: sheetSkipped };
    console.log(`[import-compta-excel] ${sheetName}: ${sheetCharges} charges, ${sheetSessions} sessions, ${sheetSkipped} doublons`);
  }

  return NextResponse.json({
    inserted: { charges: totalCharges, sessions: totalSessions },
    skipped: totalSkipped,
    sheets: sheetStats,
    warnings: allWarnings.length > 0 ? allWarnings.slice(0, 20) : undefined,
  });
}
