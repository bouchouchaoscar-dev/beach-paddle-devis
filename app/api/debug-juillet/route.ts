import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function GET() {
  const steps: Record<string, string> = {};

  // ── Étape 1 : START ──
  steps.step1 = "START OK";

  // ── Étape 2 : Supabase createClient ──
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  steps.supabase_url_defined = supabaseUrl ? "yes" : "UNDEFINED";
  steps.supabase_key_defined = supabaseKey ? "yes" : "UNDEFINED";
  steps.supabase_url_value = supabaseUrl ? supabaseUrl.slice(0, 40) + "..." : "UNDEFINED";

  try {
    new URL(supabaseUrl ?? "");
    steps.step2_url_parse = "URL valide";
  } catch (e) {
    steps.step2_url_parse = `URL INVALIDE: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    createClient(supabaseUrl ?? "", supabaseKey ?? "");
    steps.step2_supabase = "SUPABASE OK";
  } catch (e) {
    steps.step2_supabase = `SUPABASE ERREUR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // ── Étape 3 : Lire le PNG ──
  const filePath = path.join(process.cwd(), "public", "data", "compta-2025", "compta_2025_juillet.png");
  try {
    const exists = fs.existsSync(filePath);
    steps.step3_file_exists = exists ? "yes" : "NOT FOUND";
    if (exists) {
      const buf = fs.readFileSync(filePath);
      const base64 = buf.toString("base64");
      steps.step3_file = `FILE OK — taille: ${buf.length} bytes, base64: ${base64.length} chars`;
    }
  } catch (e) {
    steps.step3_file = `FILE ERREUR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // ── Étape 4 : Claude Vision (sans parsing) ──
  const apiKey = process.env.ANTHROPIC_API_KEY;
  steps.anthropic_key_defined = apiKey ? "yes" : "UNDEFINED";

  try {
    const base64 = fs.readFileSync(filePath).toString("base64");
    const anthropic = new Anthropic({ apiKey: apiKey ?? "" });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
          { type: "text", text: "Réponds uniquement: OK" },
        ],
      }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "(vide)";
    steps.step4_vision = `VISION OK — réponse: "${text.slice(0, 50)}"`;
  } catch (e) {
    steps.step4_vision = `VISION ERREUR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({ ok: true, steps });
}
