import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PROMPT = `Tu es un extracteur de données comptables.
Analyse cette image d'une feuille Excel de comptabilité Beach Paddle et extrais TOUTES les lignes de données en JSON.

La feuille contient 3 tableaux côte à côte :

1. CHARGES DIVERSES (gauche) : colonnes Objet, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES DIVERSES.
2. CHARGES METRO (milieu) : colonnes Objet, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES METRO.
3. CHARGES EMPLOYÉS (droite) : colonnes Employé, Nombre d'heures, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES EMPLOYÉS.
   IMPORTANT : en juillet il y a jusqu'à 4 blocs CHARGES EMPLOYÉS côte à côte. Tu DOIS parcourir et extraire les lignes de CHAQUE bloc, de gauche à droite, sans en omettre aucun. Toutes les lignes employé de tous les blocs doivent apparaître dans le même tableau "charges_employes".

Format JSON attendu :
{"charges_diverses":[{"objet":"...","date":"...","montant":0}],"charges_metro":[{"objet":"...","date":"...","montant":0}],"charges_employes":[{"employe":"...","nb_heures":0,"date":"...","montant":0}]}

Les dates sont au format JJ-mois (ex: 1-juin). Les montants sont des nombres sans symbole €.
Retourne UNIQUEMENT le JSON, sans texte.`;

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY manquante", { status: 500, headers: { "Content-Type": "text/plain" } });
  }

  const filePath = path.join(process.cwd(), "public", "data", "compta-2025", "compta_2025_juillet.png");
  if (!fs.existsSync(filePath)) {
    return new Response(`PNG introuvable : ${filePath}`, { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const base64 = fs.readFileSync(filePath).toString("base64");
  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text : "(réponse vide)";

    return NextResponse.json({
      rawText,
      length: rawText.length,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
