import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Allow up to 5 minutes on Vercel (Pro: 300 s, Hobby: 60 s)
export const maxDuration = 300;

const PROMPT = `Analyse cette feuille de comptabilité et extrais toutes les données en JSON structuré avec trois tableaux :
charges_diverses (objet, date, montant),
charges_metro (objet, date, montant),
charges_employes (employe, nb_heures, date, montant).
Les dates sont au format 'JJ-mois' (ex: 1-juin). L'année est 2025.
Retourne uniquement le JSON, sans texte.`;

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
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4,
    mai: 5, juin: 6, juillet: 7, août: 8, aout: 8,
    septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  };
  const match = String(dateStr).match(/(\d+)[- ]?([a-zA-Zéèûôîêâàùüïëäÿœæ]+)/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const moisKey = match[2].toLowerCase().trim();
  const mois = moisFr[moisKey];
  if (!mois || day < 1 || day > 31) return null;
  return `${year}-${String(mois).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const dir = path.join(process.cwd(), "public", "data", "compta-2025");
  const dirExists = fs.existsSync(dir);
  const files = dirExists ? fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort() : [];

  const diag = {
    dirPath: dir,
    dirExists,
    filesFound: files.length,
    fileNames: files,
    hasApiKey: !!(apiKey),
  };

  if (!apiKey) {
    return NextResponse.json({
      error: "ANTHROPIC_API_KEY non configurée. Ajouter la clé sur Vercel : Settings → Environment Variables.",
      diag,
    }, { status: 500 });
  }

  if (!dirExists) {
    return NextResponse.json({
      error: "Dossier public/data/compta-2025/ introuvable.",
      diag,
    }, { status: 404 });
  }

  if (files.length === 0) {
    return NextResponse.json({
      error: "Aucune image PNG/JPG dans public/data/compta-2025/.",
      diag,
    }, { status: 404 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const anthropic = new Anthropic({ apiKey });

  let totalCharges = 0;
  let totalSessions = 0;
  const errors: string[] = [];
  const report: { file: string; charges: number; sessions: number }[] = [];

  for (const file of files) {
    let fileCharges = 0;
    let fileSessions = 0;

    const filePath = path.join(dir, file);
    const imgBuffer = fs.readFileSync(filePath);
    const base64 = imgBuffer.toString("base64");
    const mimeType = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    let parsed: {
      charges_diverses?: { objet: string; date: string; montant: number }[];
      charges_metro?: { objet: string; date: string; montant: number }[];
      charges_employes?: { employe: string; nb_heures: number; date: string; montant: number }[];
    };

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType as "image/png" | "image/jpeg", data: base64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { errors.push(`${file}: pas de JSON dans la réponse`); continue; }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      errors.push(`${file}: ${err instanceof Error ? err.message : "erreur Anthropic"}`);
      continue;
    }

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
      if (!error) { totalCharges++; fileCharges++; }
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
      if (!error) { totalCharges++; fileCharges++; }
    }

    // Insert work sessions + salary charges
    for (const item of parsed.charges_employes ?? []) {
      const date = parseFrDate(item.date);
      const heures = typeof item.nb_heures === "number" ? item.nb_heures : parseFloat(String(item.nb_heures));
      const montant = typeof item.montant === "number" ? item.montant : parseFloat(String(item.montant));
      if (!date || isNaN(heures) || isNaN(montant)) continue;

      const nom = String(item.employe).trim();

      // Find or create employee
      let empId: string | null = null;
      const { data: existingEmp } = await supabase
        .from("employees")
        .select("id")
        .ilike("nom", nom)
        .maybeSingle();

      if (existingEmp) {
        empId = existingEmp.id;
      } else {
        const { data: newEmp } = await supabase
          .from("employees")
          .insert({ nom, tarif_horaire: heures > 0 ? Math.round((montant / heures) * 100) / 100 : 10, actif: true, saison_debut: "2025" })
          .select("id")
          .single();
        empId = newEmp?.id ?? null;
      }

      if (empId) {
        await supabase.from("work_sessions").insert({
          employee_id: empId, date, heures, montant,
          saison: "2025", created_by: "import",
        });
        fileSessions++;
        totalSessions++;
      }

      // Salary charge entry
      const { error: eSalaire } = await supabase.from("charges").insert({
        date, montant, categorie: "salaire", fournisseur: nom,
        description: `${heures}h — ${nom}`, saison: "2025",
        statut_paiement: "paye", created_by: "import",
      });
      if (!eSalaire) { totalCharges++; fileCharges++; }
    }

    report.push({ file, charges: fileCharges, sessions: fileSessions });
  }

  return NextResponse.json({
    charges: totalCharges,
    sessions: totalSessions,
    files: files.length,
    fileNames: files,
    report,
    errors: errors.length > 0 ? errors : undefined,
    diag,
  });
}
