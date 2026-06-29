"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { saveDevis, generateNumero, generateId, getDevisById } from "@/lib/storage";
import type { DevisRecord, FactureLibreLigne, ClientType } from "@/lib/types";
import { formatPrice } from "@/lib/calculations";

interface LigneState {
  id: string;
  description: string;
  montantStr: string;
}

function parseMontant(s: string): number {
  return parseFloat(s.replace(",", ".").trim()) || 0;
}

function newLigne(): LigneState {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    description: "",
    montantStr: "",
  };
}

const CLIENT_TYPE_OPTIONS: { value: ClientType; label: string }[] = [
  { value: "entreprise", label: "Entreprise / Société" },
  { value: "association", label: "Association" },
  { value: "scolaire", label: "Établissement scolaire" },
  { value: "loisirs", label: "Service Jeunesse / Loisirs" },
  { value: "organisme_public", label: "Organisme public" },
  { value: "particulier", label: "Particulier" },
];

function FactureLibreForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = getSession();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clientType, setClientType] = useState<ClientType>("entreprise");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [objet, setObjet] = useState("");
  const [lignes, setLignes] = useState<LigneState[]>([newLigne()]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");

  // Load from duplicate param
  useEffect(() => {
    const dupId = searchParams?.get("duplicate");
    if (!dupId) return;
    getDevisById(dupId).then((record) => {
      if (!record || record.documentType !== "facture_libre") return;
      setDate(new Date().toISOString().slice(0, 10));
      setClientType(record.clientType);
      setClientName(record.clientName);
      setClientAddress(record.formData?.clientAddress || "");
      setObjet(record.prestationDescription || "");
      setNotes(record.notes || "");
      if (record.lignes && record.lignes.length > 0) {
        setLignes(record.lignes.map((l) => ({
          id: generateId(),
          description: l.description,
          montantStr: String(l.montant),
        })));
      }
    });
  }, [searchParams]);

  const total = lignes.reduce((sum, l) => sum + parseMontant(l.montantStr), 0);

  function updateLigne(idx: number, patch: Partial<LigneState>) {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLigne() {
    if (lignes.length >= 5) return;
    setLignes((prev) => [...prev, newLigne()]);
  }

  function removeLigne(idx: number) {
    if (lignes.length <= 1) return;
    setLignes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setError("");

    if (!clientName.trim()) {
      setError("Le nom du client est requis.");
      return;
    }
    const validLignes = lignes.filter((l) => l.description.trim() && parseMontant(l.montantStr) > 0);
    if (validLignes.length === 0) {
      setError("Au moins une ligne avec description et montant est requise.");
      return;
    }

    setSubmitting(true);
    setSaved(false);
    setPdfUrl(null);
    try {
      const numero = await generateNumero(date);

      const lignesData: FactureLibreLigne[] = validLignes.map((l) => ({
        id: l.id,
        description: l.description.trim(),
        montant: parseMontant(l.montantStr),
      }));

      const totalNet = lignesData.reduce((s, l) => s + l.montant, 0);

      const record: DevisRecord = {
        id: generateId(),
        numero,
        date,
        createdAt: Date.now(),
        clientType,
        clientName: clientName.trim(),
        prestationDescription: objet.trim(),
        participantsCount: 0,
        totalBrut: totalNet,
        totalNet,
        documentType: "facture_libre",
        lignes: lignesData,
        notes: notes.trim() || undefined,
        formData: {
          date,
          dateADefinir: false,
          heureDebut: "",
          clientType,
          clientName: clientName.trim(),
          clientFirstName: "",
          clientLastName: "",
          clientAddress: clientAddress.trim(),
          prestationDescription: objet.trim(),
          participantsCount: 0,
          activity: "none",
          duration: "1h",
          megaPaddleCount: 0,
          megaEscapeCount: 0,
          coach: { enabled: false, description: "", price: 0 },
          snackingItems: [],
          discount: {
            discountRate: 0,
            discountEnabled: false,
            accompagnatorsEnabled: false,
            accompagnatorsCount: 0,
            extraDiscountEnabled: false,
            extraDiscountRate: 0,
          },
          documentType: "facture_libre",
        },
      };

      // 1. Save first — type "facture_libre" est mappé en "facture" côté Supabase dans storage.ts
      const saveResult = await saveDevis(record);
      if (saveResult.source === "localStorage") {
        // Supabase a refusé l'insertion — on continue quand même mais on prévient
        console.warn("[facture-libre] Supabase write failed, saved to localStorage only");
      }
      setSaved(true);

      // 2. Generate PDF
      const fileName = `Facture_libre_${numero.replace(/[°/]/g, "_")}.pdf`;
      const res = await fetch("/api/generate-pdf-libre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero,
          date,
          clientType,
          clientName: record.clientName,
          clientAddress: clientAddress.trim(),
          objet: objet.trim(),
          lignes: lignesData,
          notes: notes.trim() || undefined,
          username: session?.username,
          fileName,
        }),
      });

      if (!res.ok) throw new Error("Facture enregistrée mais erreur lors de la génération du PDF.");

      // 3. Créer le blob URL — on affiche un lien cliquable dans le DOM
      // (iOS Safari bloque a.click() après async, mais un vrai <a> dans le DOM fonctionne)
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfFileName(fileName);
      setPdfUrl(url);
    } catch (e) {
      setError((e as Error).message || "Erreur inattendue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div
        className="flex items-center gap-3 mb-6"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s forwards" }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Facture personnalisée</h1>
          <p className="text-sm text-ink-muted mt-0.5">Facture libre sans lien à une prestation</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Section 1 — Client */}
        <div
          className="card p-5"
          style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
        >
          <h2 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#0071E3" }}>1</span>
            Informations client
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden">
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Date de la facture</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field min-w-0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Type de client</label>
              <select
                value={clientType}
                onChange={(e) => setClientType(e.target.value as ClientType)}
                className="input-field"
              >
                {CLIENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Nom du client <span className="text-brand-red">*</span></label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nom de la société / personne"
                className="input-field"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Adresse (optionnelle)</label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Adresse complète"
                className="input-field"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Objet de la facture</label>
              <input
                type="text"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Ex : Prestation de communication, Mise à disposition de matériel…"
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Lignes */}
        <div
          className="card p-5"
          style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
        >
          <h2 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#0071E3" }}>2</span>
            Lignes de facturation
            <span className="text-xs font-normal text-ink-muted ml-1">({lignes.length}/5)</span>
          </h2>

          <div className="space-y-2.5">
            {lignes.map((ligne, idx) => (
              <div key={ligne.id} className="flex items-center gap-2.5">
                <div className="flex-1 grid grid-cols-[1fr_120px] gap-2">
                  <input
                    type="text"
                    value={ligne.description}
                    onChange={(e) => updateLigne(idx, { description: e.target.value })}
                    placeholder={`Description ligne ${idx + 1}`}
                    className="input-field"
                  />
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={ligne.montantStr}
                      onChange={(e) => updateLigne(idx, { montantStr: e.target.value })}
                      placeholder="0,00"
                      className="input-field pr-6 font-mono text-right"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted pointer-events-none">€</span>
                  </div>
                </div>
                <button
                  onClick={() => removeLigne(idx)}
                  disabled={lignes.length === 1}
                  className="p-2 rounded-lg text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
                  title="Supprimer cette ligne"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {lignes.length < 5 && (
            <button
              onClick={addLigne}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light px-3 py-2 rounded-lg transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Ajouter une ligne
            </button>
          )}

          {/* Total preview */}
          <div className="mt-4 pt-4 border-t border-surface-border flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="text-lg font-bold font-mono" style={{ color: "#0071E3" }}>
              {formatPrice(total)}
            </span>
          </div>
        </div>

        {/* Section 3 — Notes */}
        <div
          className="card p-5"
          style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards" }}
        >
          <h2 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: "#0071E3" }}>3</span>
            Notes <span className="text-xs font-normal text-ink-muted ml-1">(optionnel)</span>
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations complémentaires, conditions de paiement…"
            rows={3}
            className="input-field resize-none"
          />
        </div>

        {/* Success + Download link */}
        {saved && !error && (
          <div className="space-y-3">
            <div className="px-4 py-3 rounded-xl text-sm font-medium text-green-700 bg-green-50 border border-green-200 flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Facture enregistrée dans les archives
            </div>

            {pdfUrl ? (
              <div className="pb-6 space-y-2">
                {/* Vrai lien <a> dans le DOM — fonctionne sur iOS Safari */}
                <a
                  href={pdfUrl}
                  download={pdfFileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full h-12 text-sm gap-2 flex items-center justify-center no-underline"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Télécharger la facture PDF
                </a>
                <button
                  onClick={() => router.push("/historique")}
                  className="w-full h-10 text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  Voir les archives →
                </button>
              </div>
            ) : (
              <div className="pb-6 flex items-center justify-center gap-2 text-sm text-ink-muted h-12">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Génération du PDF…
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        {/* Submit — masqué une fois enregistré */}
        {!saved && (
          <div
            className="pb-6"
            style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.25s forwards" }}
          >
            <button
              onClick={handleSubmit}
              disabled={submitting || !clientName.trim() || total === 0}
              className="btn-primary w-full h-12 text-sm gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Enregistrement…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Générer et télécharger la facture
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FactureLibrePage() {
  return (
    <Suspense fallback={null}>
      <FactureLibreForm />
    </Suspense>
  );
}
