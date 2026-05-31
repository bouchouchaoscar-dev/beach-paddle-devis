import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PROMPT = `Analyse cette facture ou ce ticket de caisse.
Réponds UNIQUEMENT avec ce JSON exact, sans texte avant ni après, sans backticks, sans markdown :
{"date":"YYYY-MM-DD","montant_total":0,"fournisseur":"nom","description":"résumé en une phrase","categorie":"autre"}

Valeurs pour categorie : "restauration_metro" (Metro/Métro), "restauration_autre" (supermarché alimentaire), "equipement" (matériel/sport/outillage), "autre" (tout autre cas).
Si plusieurs tickets sur une même image ou page, retourne un tableau JSON.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[analyze-receipt] ANTHROPIC_API_KEY absente");
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurée" }, { status: 500 });
  }
  console.log("[analyze-receipt] API key présente, longueur:", apiKey.length);

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

  const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type ImageMediaType = typeof validImageTypes[number];
  const isPdf = mimeType === "application/pdf";
  const isImage = validImageTypes.includes(mimeType as ImageMediaType);

  console.log("[analyze-receipt] mimeType:", mimeType, "| isPdf:", isPdf, "| isImage:", isImage, "| base64 length:", base64.length);

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: `Format non supporté : ${mimeType}. Utilisez une image (JPG, PNG) ou un PDF.` },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

  const fileBlock: ContentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType as ImageMediaType, data: base64 } };

  try {
    console.log("[analyze-receipt] Envoi à Claude, type:", isPdf ? "document/pdf" : "image");

    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [fileBlock, { type: "text", text: PROMPT }],
        }],
      },
      isPdf ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : {}
    );

    const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    console.log("[analyze-receipt] Réponse brute Claude:", rawText);
    console.log("[analyze-receipt] stop_reason:", response.stop_reason, "| input_tokens:", response.usage.input_tokens, "| output_tokens:", response.usage.output_tokens);

    if (!rawText) {
      console.error("[analyze-receipt] Réponse Claude vide");
      return NextResponse.json({ error: "Réponse Claude vide", _raw: rawText }, { status: 422 });
    }

    const jsonMatch = rawText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[analyze-receipt] Pas de JSON dans la réponse:", rawText);
      return NextResponse.json({ error: "Pas de JSON dans la réponse IA", _raw: rawText }, { status: 422 });
    }

    let parsed: Record<string, unknown> | Record<string, unknown>[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[analyze-receipt] Erreur JSON.parse:", parseErr, "| texte:", jsonMatch[0]);
      return NextResponse.json({ error: "JSON malformé dans la réponse IA", _raw: rawText }, { status: 422 });
    }

    console.log("[analyze-receipt] JSON parsé:", JSON.stringify(parsed));

    // Always return { data, _raw } so the client can debug
    return NextResponse.json({ data: parsed, _raw: rawText });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[analyze-receipt] Erreur Claude:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
