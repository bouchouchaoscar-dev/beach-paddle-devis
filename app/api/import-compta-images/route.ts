import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

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

interface FileReport {
  file: string;
  extractedDiverses: number;
  extractedMetro: number;
  extractedEmployes: number;
  insertedCharges: number;
  insertedSessions: number;
  rawJson: string;
  error: string | null;
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const dir = path.join(process.cwd(), "public", "data", "compta-2025");
  const dirExists = fs.existsSync(dir);
  const files = dirExists
    ? fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort()
    : [];

  const diag = { dirPath: dir, dirExists, filesFound: files.length, fileNames: files, hasApiKey: !!apiKey };

  if (!apiKey) {
    return NextResponse.json({
      error: "ANTHROPIC_API_KEY non configurée. Ajouter la clé sur Vercel : Settings → Environment Variables.",
      diag,
    }, { status: 500 });
  }
  if (!dirExists) {
    return NextResponse.json({ error: "Dossier public/data/compta-2025/ introuvable.", diag }, { status: 404 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "Aucune image PNG/JPG dans public/data/compta-2025/.", diag }, { status: 404 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const anthropic = new Anthropic({ apiKey });

  let totalCharges = 0;
  let totalSessions = 0;
  const fileReports: FileReport[] = [];
  const globalErrors: string[] = [];

  for (const file of files) {
    const report: FileReport = {
      file,
      extractedDiverses: 0,
      extractedMetro: 0,
      extractedEmployes: 0,
      insertedCharges: 0,
      insertedSessions: 0,
      rawJson: "",
      error: null,
    };

    const filePath = path.join(dir, file);
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
      report.rawJson = text;

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        report.error = `Pas de JSON trouvé dans la réponse. Réponse brute : ${text.slice(0, 200)}`;
        globalErrors.push(`${file}: pas de JSON`);
        fileReports.push(report);
        continue;
      }

      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        report.error = `JSON invalide : ${parseErr instanceof Error ? parseErr.message : "erreur parse"}`;
        globalErrors.push(`${file}: JSON invalide`);
        fileReports.push(report);
        continue;
      }
    } catch (err) {
      report.error = err instanceof Error ? err.message : "Erreur Anthropic";
      globalErrors.push(`${file}: ${report.error}`);
      fileReports.push(report);
      continue;
    }

    report.extractedDiverses = parsed.charges_diverses?.length ?? 0;
    report.extractedMetro = parsed.charges_metro?.length ?? 0;
    report.extractedEmployes = parsed.charges_employes?.length ?? 0;

    // Insert charges_metro
    for (const item of parsed.charges_metro ?? []) {
      const date = parseFrDate(item.date);
      const montant = typeof item.montant === "number" ? item.montant : parseFloat(String(item.montant));
      if (!date || isNaN(montant)) continue;
      const { error } = await supabase.from("charges").insert({
        date, montant, categorie: "restauration_metro",
        fournisseur: "Métro", description: item.objet,
        saison: "2025", statut_paiement: "paye", created_by: "import",
      });
      if (!error) { totalCharges++; report.insertedCharges++; }
    }

    // Insert charges_diverses
    for (const item of parsed.charges_diverses ?? []) {
      const date = parseFrDate(item.date);
      const montant = typeof item.montant === "number" ? item.montant : parseFloat(String(item.montant));
      if (!date || isNaN(montant)) continue;
      const categorie = guessCategorie(item.objet);
      const { error } = await supabase.from("charges").insert({
        date, montant, categorie, fournisseur: item.objet,
        description: item.objet, saison: "2025", statut_paiement: "paye", created_by: "import",
      });
      if (!error) { totalCharges++; report.insertedCharges++; }
    }

    // Insert work sessions + salary charges
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
        totalSessions++;
        report.insertedSessions++;
      }

      const { error: eSalaire } = await supabase.from("charges").insert({
        date, montant, categorie: "salaire", fournisseur: nom,
        description: `${heures}h — ${nom}`, saison: "2025",
        statut_paiement: "paye", created_by: "import",
      });
      if (!eSalaire) { totalCharges++; report.insertedCharges++; }
    }

    fileReports.push(report);
  }

  return NextResponse.json({
    charges: totalCharges,
    sessions: totalSessions,
    files: files.length,
    fileNames: files,
    report: fileReports,
    errors: globalErrors.length > 0 ? globalErrors : undefined,
    diag,
  });
}
