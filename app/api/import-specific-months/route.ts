import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

// Month prefix → PNG filename
const MONTH_TO_FILE: Record<string, string> = {
  "2025-04": "compta_2025_avril.png",
  "2025-05": "compta_2025_mai.png",
  "2025-06": "compta_2025_juin.png",
  "2025-07": "compta_2025_juillet.png",
  "2025-08": "compta_2025_aout.png",
  "2025-09": "compta_2025_septembre.png",
};

const PROMPT = `Tu es un extracteur de données comptables.
Analyse cette image d'une feuille Excel de comptabilité Beach Paddle et extrais TOUTES les lignes de données en JSON.

La feuille contient 3 tableaux côte à côte :

1. CHARGES DIVERSES (gauche) : colonnes Objet, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES DIVERSES.

2. CHARGES METRO (milieu) : colonnes Objet, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES METRO.

3. CHARGES EMPLOYÉS (droite) : colonnes Employé, Nombre d'heures, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES EMPLOYÉS.
   Attention : en juillet il peut y avoir plusieurs blocs CHARGES EMPLOYÉS côte à côte.

Format JSON attendu :
{
  "charges_diverses": [{"objet": "...", "date": "...", "montant": 0}],
  "charges_metro": [{"objet": "...", "date": "...", "montant": 0}],
  "charges_employes": [{"employe": "...", "nb_heures": 0, "date": "...", "montant": 0}]
}

Les dates sont au format JJ-mois (ex: 1-juin).
Les montants sont des nombres sans symbole €.
Retourne UNIQUEMENT le JSON, sans texte.`;

const FOURNISSEUR_CATEGORIE: Record<string, string> = {
  metro: "restauration_metro",
  métro: "restauration_metro",
  carrefour: "restauration_autre",
  lidl: "restauration_autre",
  intermarché: "restauration_autre",
  intermarch: "restauration_autre",
  aldi: "restauration_autre",
  monoprix: "restauration_autre",
  "leroy merlin": "equipement",
  bricoman: "equipement",
  decathlon: "equipement",
  bricorama: "equipement",
};

function guessCategorie(objet: string): string {
  const lower = (objet ?? "").toLowerCase();
  for (const [key, cat] of Object.entries(FOURNISSEUR_CATEGORIE)) {
    if (lower.includes(key)) return cat;
  }
  return "autre";
}

function parseFrDate(dateStr: string, year = 2025): string | null {
  const moisFr: Record<string, number> = {
    jan: 1, janv: 1, janvier: 1,
    fev: 2, fév: 2, févr: 2, fevr: 2, février: 2, fevrier: 2,
    mar: 3, mars: 3,
    avr: 4, avril: 4,
    mai: 5,
    jun: 6, juin: 6,
    juil: 7, juillet: 7,
    aou: 8, aout: 8, août: 8,
    sep: 9, sept: 9, septembre: 9,
    oct: 10, octobre: 10,
    nov: 11, novembre: 11,
    dec: 12, déc: 12, décembre: 12, decembre: 12,
  };
  const match = String(dateStr).match(/(\d+)[- ]?([a-zA-Zéèûôîêâàùüïëäÿœæ]+)/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const moisKey = match[2].toLowerCase().trim();
  const mois = moisFr[moisKey];
  if (!mois || day < 1 || day > 31) return null;
  return `${year}-${String(mois).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface ParsedSheet {
  charges_diverses?: { objet: string; date: string; montant: number }[];
  charges_metro?: { objet: string; date: string; montant: number }[];
  charges_employes?: { employe: string; nb_heures: number; date: string; montant: number }[];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { months?: string[] };
  const months: string[] = body.months ?? ["2025-04", "2025-07", "2025-09"];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante." }, { status: 500 });
  }

  const dir = path.join(process.cwd(), "public", "data", "compta-2025");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const anthropic = new Anthropic({ apiKey });

  let totalCharges = 0;
  let totalSessions = 0;
  const report: {
    month: string;
    file: string;
    deleted: { charges: number; sessions: number };
    extracted: { diverses: number; metro: number; employes: number };
    inserted: { charges: number; sessions: number };
    error: string | null;
  }[] = [];

  for (const month of months) {
    const file = MONTH_TO_FILE[month];
    const entry = {
      month,
      file: file ?? "(inconnu)",
      deleted: { charges: 0, sessions: 0 },
      extracted: { diverses: 0, metro: 0, employes: 0 },
      inserted: { charges: 0, sessions: 0 },
      error: null as string | null,
    };

    if (!file) {
      entry.error = `Aucun fichier PNG mappé pour ${month}`;
      report.push(entry);
      continue;
    }

    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      entry.error = `Fichier introuvable : ${filePath}`;
      report.push(entry);
      continue;
    }

    // 1. Delete existing charges/sessions for this month only
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const { count: deletedCharges } = await supabase
      .from("charges")
      .delete({ count: "exact" })
      .gte("date", startDate)
      .lte("date", endDate);

    const { count: deletedSessions } = await supabase
      .from("work_sessions")
      .delete({ count: "exact" })
      .gte("date", startDate)
      .lte("date", endDate);

    entry.deleted.charges = deletedCharges ?? 0;
    entry.deleted.sessions = deletedSessions ?? 0;

    // 2. Extract from PNG via Claude Vision
    const imgBuffer = fs.readFileSync(filePath);
    const base64 = imgBuffer.toString("base64");
    const mimeType = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    let parsed: ParsedSheet;
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType as "image/png" | "image/jpeg", data: base64 } },
            { type: "text", text: PROMPT },
          ],
        }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        entry.error = `Pas de JSON dans la réponse Claude`;
        report.push(entry);
        continue;
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      entry.error = err instanceof Error ? err.message : "Erreur Anthropic";
      report.push(entry);
      continue;
    }

    entry.extracted.diverses = parsed.charges_diverses?.length ?? 0;
    entry.extracted.metro = parsed.charges_metro?.length ?? 0;
    entry.extracted.employes = parsed.charges_employes?.length ?? 0;

    // 3. Insert charges_metro
    for (const item of parsed.charges_metro ?? []) {
      const date = parseFrDate(item.date);
      const montant = typeof item.montant === "number" ? item.montant : parseFloat(String(item.montant));
      if (!date || isNaN(montant)) continue;
      const { error } = await supabase.from("charges").insert({
        date, montant, categorie: "restauration_metro",
        fournisseur: "Métro", description: item.objet,
        saison: "2025", statut_paiement: "paye", created_by: "import",
      });
      if (!error) { entry.inserted.charges++; totalCharges++; }
    }

    // 4. Insert charges_diverses
    for (const item of parsed.charges_diverses ?? []) {
      const date = parseFrDate(item.date);
      const montant = typeof item.montant === "number" ? item.montant : parseFloat(String(item.montant));
      if (!date || isNaN(montant)) continue;
      const categorie = guessCategorie(item.objet);
      const { error } = await supabase.from("charges").insert({
        date, montant, categorie, fournisseur: item.objet,
        description: item.objet, saison: "2025", statut_paiement: "paye", created_by: "import",
      });
      if (!error) { entry.inserted.charges++; totalCharges++; }
    }

    // 5. Insert work sessions + salary charges
    for (const item of parsed.charges_employes ?? []) {
      const date = parseFrDate(item.date);
      const heures = typeof item.nb_heures === "number" ? item.nb_heures : parseFloat(String(item.nb_heures));
      const montant = typeof item.montant === "number" ? item.montant : parseFloat(String(item.montant));
      if (!date || isNaN(heures) || isNaN(montant)) continue;

      const nom = String(item.employe).trim();
      let empId: string | null = null;
      const { data: existingEmp } = await supabase
        .from("employees").select("id").ilike("nom", nom).maybeSingle();

      if (existingEmp) {
        empId = existingEmp.id;
      } else {
        const { data: newEmp } = await supabase
          .from("employees")
          .insert({ nom, tarif_horaire: heures > 0 ? Math.round((montant / heures) * 100) / 100 : 10, actif: true, saison_debut: "2025" })
          .select("id").single();
        empId = newEmp?.id ?? null;
      }

      if (empId) {
        await supabase.from("work_sessions").insert({
          employee_id: empId, date, heures, montant,
          saison: "2025", created_by: "import",
        });
        entry.inserted.sessions++;
        totalSessions++;
      }

      const { error: eSalaire } = await supabase.from("charges").insert({
        date, montant, categorie: "salaire", fournisseur: nom,
        description: `${heures}h — ${nom}`, saison: "2025",
        statut_paiement: "paye", created_by: "import",
      });
      if (!eSalaire) { entry.inserted.charges++; totalCharges++; }
    }

    report.push(entry);
  }

  return NextResponse.json({ totalCharges, totalSessions, months, report });
}
