import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const PROMPT = `Analyse cette facture ou ce ticket de caisse.
Extrais en JSON : date (YYYY-MM-DD), montant_total (nombre), fournisseur (nom enseigne), description (résumé achats en une phrase), categorie ('restauration_metro' si Metro/Métro, 'restauration_autre' si supermarché alimentaire, 'equipement' si matériel/outillage/sport, 'autre' sinon).
Si plusieurs tickets sur une photo, retourne un tableau JSON.
Uniquement le JSON, sans texte.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurée" }, { status: 500 });
  }

  let body: { data: string; mimeType: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { data: base64, mimeType } = body;
  if (!base64 || !mimeType) {
    return NextResponse.json({ error: "data et mimeType requis" }, { status: 400 });
  }

  // Normalize mime type for Anthropic SDK
  const validMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type ImageMediaType = typeof validMimeTypes[number];
  const normalizedMime: ImageMediaType = validMimeTypes.includes(mimeType as ImageMediaType)
    ? (mimeType as ImageMediaType)
    : "image/jpeg";

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: normalizedMime,
                data: base64,
              },
            },
            {
              type: "text",
              text: PROMPT,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Pas de JSON dans la réponse IA" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
