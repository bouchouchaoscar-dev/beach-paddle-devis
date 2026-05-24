import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurée" }, { status: 500 });
  }

  let data: {
    saison: string;
    totalCA: number;
    totalCharges: number;
    resultat: number;
    marge: number;
    joursOuverts: number;
    caMoyen: number;
    monthlyCA: { mois: string; ca: number }[];
    chargesByCategory: { categorie: string; montant: number }[];
    top5Days: { label: string; ca: number }[];
  };

  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const prompt = `Tu es analyste pour une base nautique (Beach Paddle, Saint-Maur-des-Fossés).
Analyse ces données et génère 5 observations pertinentes et actionnables en français pour le gérant.
Sois précis avec les chiffres.

Saison ${data.saison} :
- CA total : ${data.totalCA}€
- Charges totales : ${data.totalCharges}€
- Résultat net : ${data.resultat}€
- Marge : ${data.marge}%
- Jours ouverts : ${data.joursOuverts}
- CA moyen par jour ouvert : ${data.caMoyen}€

CA par mois : ${JSON.stringify(data.monthlyCA)}

Charges par catégorie : ${JSON.stringify(data.chargesByCategory)}

Top 5 meilleures journées : ${JSON.stringify(data.top5Days)}

Format : retourne UNIQUEMENT un tableau JSON de 5 strings, chaque string étant une observation courte et directe. Exemple : ["Observation 1...", "Observation 2...", ...]`;

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return NextResponse.json({ insights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
