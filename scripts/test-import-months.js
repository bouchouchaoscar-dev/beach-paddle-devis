#!/usr/bin/env node
// Test script: test Claude Vision + Supabase insert for specific months
// Usage: node scripts/test-import-months.js [avril|juillet|septembre|all]
// Reads API keys from .env.local

const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Read .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) { console.error(".env.local introuvable"); process.exit(1); }
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}
loadEnv();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!ANTHROPIC_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Variables manquantes dans .env.local");
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function claudeVision(base64, mimeType, prompt) {
  const res = await httpPost(
    "https://api.anthropic.com/v1/messages",
    { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
        { type: "text", text: prompt },
      ]}],
    }
  );
  if (res.status !== 200) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.content?.[0]?.text ?? "";
}

async function supabaseInsert(table, row) {
  const res = await httpPost(
    `${SUPABASE_URL}/rest/v1/${table}`,
    { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
    row
  );
  if (res.status >= 400) return { error: JSON.stringify(res.body) };
  return { error: null };
}

async function supabaseSelect(table, filter) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=id`);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: "GET",
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } },
      (res) => { let raw = ""; res.on("data", (c) => (raw += c)); res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve([]); } }); }
    );
    req.on("error", reject);
    req.end();
  });
}

function parseFrDate(dateStr, year = 2025) {
  const moisFr = {
    jan:1, janv:1, janvier:1,
    fev:2, fév:2, févr:2, fevr:2, février:2, fevrier:2,
    mar:3, mars:3,
    avr:4, avril:4,
    mai:5,
    jun:6, juin:6,
    juil:7, juillet:7,
    aou:8, aout:8, "août":8,
    sep:9, sept:9, septembre:9,
    oct:10, octobre:10,
    nov:11, novembre:11,
    dec:12, "déc":12, décembre:12, decembre:12,
  };
  const m = String(dateStr).match(/(\d+)[- ]?([a-zA-Zéèûôîêâàùüïëäÿœæ]+)/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const mois = moisFr[m[2].toLowerCase().trim()];
  if (!mois || day < 1 || day > 31) return null;
  return `${year}-${String(mois).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function guessCategorie(objet) {
  const lower = (objet ?? "").toLowerCase();
  if (lower.includes("metro") || lower.includes("métro")) return "restauration_metro";
  if (["carrefour","lidl","intermarché","intermarch","aldi","monoprix"].some(k => lower.includes(k))) return "restauration_autre";
  if (["leroy merlin","bricoman","decathlon","bricorama"].some(k => lower.includes(k))) return "equipement";
  return "autre";
}

const PROMPT = `Tu es un extracteur de données comptables.
Analyse cette image d'une feuille Excel de comptabilité Beach Paddle et extrais TOUTES les lignes de données en JSON.

La feuille contient 3 tableaux côte à côte :

1. CHARGES DIVERSES (gauche) : colonnes Objet, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES DIVERSES.
2. CHARGES METRO (milieu) : colonnes Objet, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES METRO.
3. CHARGES EMPLOYÉS (droite) : colonnes Employé, Nombre d'heures, Date, Montant. Extraire toutes les lignes jusqu'à TOTAL CHARGES EMPLOYÉS.
   Attention : en juillet il peut y avoir plusieurs blocs CHARGES EMPLOYÉS côte à côte.

Format JSON attendu :
{"charges_diverses":[{"objet":"...","date":"...","montant":0}],"charges_metro":[{"objet":"...","date":"...","montant":0}],"charges_employes":[{"employe":"...","nb_heures":0,"date":"...","montant":0}]}

Les dates sont au format JJ-mois (ex: 1-juin). Les montants sont des nombres sans symbole €.
Retourne UNIQUEMENT le JSON, sans texte.`;

const MONTH_TO_FILE = {
  "2025-04": "compta_2025_avril.png",
  "2025-07": "compta_2025_juillet.png",
  "2025-09": "compta_2025_septembre.png",
};

const arg = process.argv[2] ?? "all";
const monthsToTest = arg === "all"
  ? Object.keys(MONTH_TO_FILE)
  : arg === "avril" ? ["2025-04"] : arg === "juillet" ? ["2025-07"] : arg === "septembre" ? ["2025-09"] : [arg];

const DRY_RUN = process.argv.includes("--dry");
if (DRY_RUN) console.log("⚠️  DRY RUN — aucune insertion Supabase\n");

const dir = path.join(__dirname, "../public/data/compta-2025");

(async () => {
  for (const month of monthsToTest) {
    const file = MONTH_TO_FILE[month];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`MOIS: ${month}  |  FICHIER: ${file}`);
    console.log("=".repeat(60));

    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) { console.error(`  ❌ Fichier introuvable: ${filePath}`); continue; }

    const size = fs.statSync(filePath).size;
    console.log(`  Taille: ${(size/1024).toFixed(1)} KB`);

    const base64 = fs.readFileSync(filePath).toString("base64");
    console.log(`  Base64 length: ${base64.length} chars`);

    console.log(`  → Appel Claude Vision...`);
    let rawText;
    try {
      rawText = await claudeVision(base64, "image/png", PROMPT);
      console.log(`\n  --- JSON BRUT CLAUDE ---`);
      console.log(rawText);
    } catch (e) {
      console.error(`  ❌ Erreur Claude: ${e.message}`);
      continue;
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { console.error(`  ❌ Pas de JSON trouvé dans la réponse`); continue; }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error(`  ❌ JSON invalide: ${e.message}`);
      continue;
    }

    const diverses = parsed.charges_diverses ?? [];
    const metro = parsed.charges_metro ?? [];
    const employes = parsed.charges_employes ?? [];
    console.log(`\n  --- EXTRACTION ---`);
    console.log(`  charges_diverses : ${diverses.length} lignes`);
    console.log(`  charges_metro    : ${metro.length} lignes`);
    console.log(`  charges_employes : ${employes.length} lignes`);

    if (DRY_RUN) { console.log(`\n  ⏭  DRY RUN — skip insertion`); continue; }

    console.log(`\n  → Insertion Supabase...`);
    let insCharges = 0, insSessions = 0, errCount = 0;

    for (const item of metro) {
      const date = parseFrDate(item.date);
      const montant = parseFloat(String(item.montant));
      if (!date || isNaN(montant)) { errCount++; continue; }
      const r = await supabaseInsert("charges", { date, montant, categorie: "restauration_metro", fournisseur: "Métro", description: item.objet, saison: "2025", statut_paiement: "paye", created_by: "import" });
      if (r.error) { console.error(`    ❌ charge metro: ${r.error}`); errCount++; } else insCharges++;
    }

    for (const item of diverses) {
      const date = parseFrDate(item.date);
      const montant = parseFloat(String(item.montant));
      if (!date || isNaN(montant)) { errCount++; continue; }
      const r = await supabaseInsert("charges", { date, montant, categorie: guessCategorie(item.objet), fournisseur: item.objet, description: item.objet, saison: "2025", statut_paiement: "paye", created_by: "import" });
      if (r.error) { console.error(`    ❌ charge diverse: ${r.error}`); errCount++; } else insCharges++;
    }

    for (const item of employes) {
      const date = parseFrDate(item.date);
      const heures = parseFloat(String(item.nb_heures));
      const montant = parseFloat(String(item.montant));
      if (!date || isNaN(heures) || isNaN(montant)) { errCount++; continue; }
      const nom = String(item.employe).trim();

      const existing = await supabaseSelect("employees", `nom=ilike.${encodeURIComponent(nom)}`);
      let empId = existing?.[0]?.id ?? null;
      if (!empId) {
        const newRes = await new Promise((res) => {
          const u = new URL(`${SUPABASE_URL}/rest/v1/employees`);
          const body = JSON.stringify({ nom, tarif_horaire: heures > 0 ? Math.round(montant/heures*100)/100 : 10, actif: true, saison_debut: "2025" });
          const req = https.request(
            { hostname: u.hostname, path: u.pathname, method: "POST",
              headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=representation", "Content-Length": Buffer.byteLength(body) } },
            (r2) => { let raw=""; r2.on("data",(c)=>raw+=c); r2.on("end",()=>{ try{ res(JSON.parse(raw)); }catch{ res([]); } }); }
          );
          req.on("error", () => res([]));
          req.write(body); req.end();
        });
        empId = newRes?.[0]?.id ?? null;
      }

      if (empId) {
        const r = await supabaseInsert("work_sessions", { employee_id: empId, date, heures, montant, saison: "2025", created_by: "import" });
        if (!r.error) insSessions++;
      }
      const r2 = await supabaseInsert("charges", { date, montant, categorie: "salaire", fournisseur: nom, description: `${heures}h — ${nom}`, saison: "2025", statut_paiement: "paye", created_by: "import" });
      if (!r2.error) insCharges++;
    }

    console.log(`\n  ✅ RÉSULTAT ${month}: +${insCharges} charges, +${insSessions} sessions, ${errCount} erreurs`);
  }
  console.log("\nTerminé.");
})();
