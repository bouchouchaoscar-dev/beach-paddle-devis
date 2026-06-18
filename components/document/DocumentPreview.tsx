"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import type { DevisFormData, CalculationResult, DocumentType } from "@/lib/types";
import { DocumentTemplate } from "./DocumentTemplate";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { calculateDevis, formatPrice } from "@/lib/calculations";
import { saveDevis, generateNumero, generateId } from "@/lib/storage";
import { NumericInput } from "@/components/ui/NumericInput";
import type { DevisRecord } from "@/lib/types";
import { getSession } from "@/lib/auth";

// 210mm at 96 dpi
const DOC_NATURAL_WIDTH = 794;

// ── Standalone component to avoid focus loss on mobile ───────────────────────
// Defined OUTSIDE DocumentPreview so React never remounts it on parent re-renders.
interface AcompteControlsProps {
  acompteVerse: string;
  setAcompteVerse: React.Dispatch<React.SetStateAction<string>>;
  totalNet: number;
  compact?: boolean;
}

function AcompteControls({ acompteVerse, setAcompteVerse, totalNet, compact }: AcompteControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {!compact && <label className="text-xs text-ink-secondary whitespace-nowrap">Acompte versé :</label>}
      <button
        type="button"
        onClick={() => setAcompteVerse(String(Math.round(totalNet * 0.3 * 100) / 100))}
        className="flex items-center justify-center h-8 px-2.5 rounded-full text-xs font-bold text-white hover:opacity-80 active:scale-95 transition-all"
        style={{ backgroundColor: "#0071E3", flexShrink: 0 }}
      >
        30%
      </button>
      <div className="flex items-center gap-0">
        {!compact && (
          <button
            type="button"
            onClick={() => setAcompteVerse((v) => String(Math.max(0, (parseFloat(v.replace(",", ".")) || 0) - 10)))}
            className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        )}
        <div className="relative">
          <NumericInput
            inputMode="decimal"
            value={acompteVerse}
            placeholder="0"
            pattern="[0-9]*[.,]?[0-9]*"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            onChange={(e) => setAcompteVerse(e.target.value)}
            className={`${compact ? "w-20 rounded-lg" : "w-24"} h-9 border border-surface-border bg-white text-center text-sm font-bold text-ink outline-none font-mono pr-6`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
        </div>
        {!compact && (
          <button
            type="button"
            onClick={() => setAcompteVerse((v) => String((parseFloat(v.replace(",", ".")) || 0) + 10))}
            className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  form: DevisFormData;
  calc: CalculationResult;
  onClose: () => void;
  onFormChange: (patch: Partial<DevisFormData>) => void;
  /** Rouvrir un document existant depuis l'historique — pas de nouvelle sauvegarde */
  readOnly?: boolean;
  /** Numéro existant (historique ou modification) — évite de regénérer un nouveau numéro */
  existingNumero?: string;
  /** ID existant (modification) — réutilise l'ID pour mettre à jour le même enregistrement */
  existingId?: string;
}

export function DocumentPreview({ form, calc, onClose, onFormChange, readOnly, existingNumero, existingId }: Props) {
  const [documentType, setDocumentType] = useState<DocumentType>(form.documentType);
  const [acompteVerse, setAcompteVerse] = useState<string>(() =>
    form.acompteVerse !== undefined && form.acompteVerse > 0 ? String(form.acompteVerse) : ""
  );
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "local" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [todayStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [numero, setNumero] = useState<string>(existingNumero ?? "");

  // Stable record ID — generated once (or reuse existing for updates)
  const recordId = useRef<string>(existingId ?? generateId());

  // Refs to always read latest props in async callbacks without adding effect deps
  const formRef = useRef(form);
  const calcRef = useRef(calc);
  formRef.current = form;
  calcRef.current = calc;
  // Tracks whether the initial save completed (gate for the debounced resave)
  const hasSavedOnce = useRef(false);

  // Document scaling for mobile
  const [docScale, setDocScale] = useState(() =>
    typeof window !== "undefined" ? Math.min(1, window.innerWidth / DOC_NATURAL_WIDTH) : 1
  );
  const [docNaturalHeight, setDocNaturalHeight] = useState(1123); // ~297mm fallback

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const docInnerRef = useRef<HTMLDivElement>(null);

  // ── Sauvegarde au montage ────────────────────────────────────────────────────
  // La sauvegarde se déclenche dès l'ouverture de la preview (pas au téléchargement).
  // Sur mobile, le téléchargement peut être interrompu → séparer les deux actions.
  useEffect(() => {
    if (readOnly) return; // historique : ne pas re-sauvegarder

    let cancelled = false;
    setSaveStatus("saving");

    const run = async () => {
      try {
        const n = existingNumero ?? (await generateNumero(todayStr));
        if (cancelled) return;
        setNumero(n);

        const record: DevisRecord = {
          id: recordId.current,
          numero: n,
          date: form.date,
          createdAt: Date.now(),
          clientType: form.clientType,
          clientName: form.clientName,
          prestationDescription: form.prestationDescription,
          participantsCount: form.participantsCount,
          totalBrut: calc.totalBrut,
          totalNet: calc.totalNet,
          documentType,
          formData: { ...form, documentType },
        };

        const { source } = await saveDevis(record);
        if (cancelled) return;
        hasSavedOnce.current = true;
        setSaveStatus(source === "localStorage" ? "local" : "saved");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        console.error("[DocumentPreview] Sauvegarde échouée:", msg);
        setSaveStatus("error");
        setSaveError(msg);
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resauvegarde quand documentType ou acompte change ────────────────────────
  // Garde la facture à jour dans Supabase sans attendre le téléchargement PDF.
  // Autorisé quand : nouveau doc (readOnly=false) ou existingId fourni (update depuis historique).
  useEffect(() => {
    const canSave = !readOnly || !!existingId;
    const isReady = hasSavedOnce.current || !!existingId;
    if (!canSave || !isReady) return;
    const timer = setTimeout(() => {
      const f = formRef.current;
      const c = calcRef.current;
      const acompteNum = parseFloat(acompteVerse.replace(",", ".")) || 0;
      const updatedRecord: DevisRecord = {
        id: recordId.current,
        numero,
        date: f.date,
        createdAt: Date.now(),
        clientType: f.clientType,
        clientName: f.clientName,
        prestationDescription: f.prestationDescription,
        participantsCount: f.participantsCount,
        totalBrut: c.totalBrut,
        totalNet: c.totalNet,
        documentType,
        formData: {
          ...f,
          documentType,
          acompteVerse: acompteNum > 0 ? acompteNum : undefined,
        },
      };
      saveDevis(updatedRecord).catch((e: unknown) =>
        console.error("[DocumentPreview] Resave failed:", e instanceof Error ? e.message : e)
      );
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acompteVerse, documentType]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Recalculate scale when container resizes
  useEffect(() => {
    function calcScale() {
      if (!scrollAreaRef.current) return;
      const available = scrollAreaRef.current.clientWidth;
      setDocScale(Math.min(1, available / DOC_NATURAL_WIDTH));
    }
    calcScale();
    window.addEventListener("resize", calcScale);
    return () => window.removeEventListener("resize", calcScale);
  }, []);

  // Measure natural document height so the outer wrapper matches
  useEffect(() => {
    if (!docInnerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setDocNaturalHeight(entry.contentRect.height);
        }
      }
    });
    ro.observe(docInnerRef.current);
    return () => ro.disconnect();
  }, []);

  const acompteNum = parseFloat(acompteVerse.replace(",", ".")) || 0;
  const calcWithAcompte = calculateDevis(form, acompteNum > 0 ? acompteNum : undefined);

  // ── Téléchargement PDF ───────────────────────────────────────────────────────
  async function handleDownloadPDF() {
    setGenerating(true);
    setPdfError(null);
    try {
      const activityLabel =
        form.activity === "paddle" ? "Paddle" :
        form.activity === "kayak" ? "Kayak" :
        form.activity === "hybride" ? "Paddle-Kayak" : "";
      const safeClient = form.clientName.replace(/[/\\:*?"<>|]/g, " ").trim();
      const datePart = (!form.dateADefinir && form.date) ? (() => {
        const [y, m, d] = form.date.split("-");
        return `${d}-${m}-${y.slice(2)}`;
      })() : "";
      const fileName = [documentType === "facture" ? "Facture" : "Devis", activityLabel, safeClient, datePart]
        .filter(Boolean)
        .join(" ") + ".pdf";

      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form,
          calc: calcWithAcompte,
          numero,
          documentType,
          acompteVerse: acompteNum > 0 ? acompteNum : undefined,
          documentDate: todayStr,
          fileName,
          username: getSession()?.username,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || `Erreur serveur ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Approche universelle : a.download déclenche le téléchargement sur desktop/Android.
      // Sur iOS Safari, a.download est ignoré et le PDF s'ouvre dans le lecteur natif
      // (partageable via la feuille de partage iOS).
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      // Re-sauvegarder avec le documentType et l'acompte définitifs.
      // La sauvegarde au montage utilisait l'état initial — si l'utilisateur
      // a basculé en facture ou saisi un acompte, on met à jour le record.
      // On sauvegarde aussi depuis les archives (readOnly=true) si on connaît
      // l'existingId (mise à jour sans doublon) pour persister l'acompte saisi.
      if (numero && (!readOnly || existingId)) {
        const updatedRecord: import("@/lib/types").DevisRecord = {
          id: recordId.current,
          numero,
          date: form.date,
          createdAt: Date.now(),
          clientType: form.clientType,
          clientName: form.clientName,
          prestationDescription: form.prestationDescription,
          participantsCount: form.participantsCount,
          totalBrut: calc.totalBrut,
          totalNet: calc.totalNet,
          documentType,
          formData: {
            ...form,
            documentType,
            acompteVerse: acompteNum > 0 ? acompteNum : undefined,
          },
        };
        saveDevis(updatedRecord).catch((e: unknown) =>
          console.error("[PDF] Re-save failed:", e instanceof Error ? e.message : e)
        );
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
      console.error("[PDF] Génération échouée:", msg);
      setPdfError(msg);
    } finally {
      setGenerating(false);
    }
  }

  const DownloadBtn = ({ fullWidth }: { fullWidth?: boolean }) => (
    <button
      onClick={handleDownloadPDF}
      disabled={generating || !numero}
      className={`btn-primary gap-2 ${fullWidth ? "w-full py-3" : ""}`}
    >
      {generating ? (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {generating ? "Génération…" : "Télécharger PDF"}
    </button>
  );


  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 flex flex-col h-full bg-surface border-l border-surface-border w-full sm:w-auto"
        style={{
          width: undefined,
          maxWidth: "min(92vw, 1020px)",
          opacity: 0,
          animation: "slideInRight 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        {/* ── HEADER DESKTOP (sm+) ───────────────────────────────── */}
        <div className="hidden sm:flex items-center justify-between px-5 py-4 border-b border-surface-border bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost p-2" title="Fermer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-ink">Aperçu du document</p>
              <p className="text-xs text-ink-muted">{numero || "Chargement…"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SegmentedControl
              options={[{ value: "devis", label: "Devis" }, { value: "facture", label: "Facture" }]}
              value={documentType}
              onChange={(v) => { setDocumentType(v); onFormChange({ documentType: v }); }}
              size="sm"
              accent="orange"
            />
            {documentType === "facture" && <AcompteControls acompteVerse={acompteVerse} setAcompteVerse={setAcompteVerse} totalNet={calc.totalNet} />}
            <DownloadBtn />
          </div>
        </div>

        {/* ── HEADER MOBILE (< sm) ───────────────────────────────── */}
        <div className="flex sm:hidden flex-col border-b border-surface-border bg-white shrink-0">
          {/* Row 1 — close + title */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-ink-secondary hover:bg-surface-muted active:scale-95 transition-all shrink-0"
              title="Fermer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Aperçu du document</p>
              <p className="text-xs text-ink-muted font-mono truncate">{numero || "Chargement…"}</p>
            </div>
          </div>

          {/* Row 2 — toggle + acompte compact */}
          <div className="flex items-center gap-2 px-4 pb-2 flex-wrap">
            <SegmentedControl
              options={[{ value: "devis", label: "Devis" }, { value: "facture", label: "Facture" }]}
              value={documentType}
              onChange={(v) => { setDocumentType(v); onFormChange({ documentType: v }); }}
              size="sm"
              accent="orange"
            />
            {documentType === "facture" && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-ink-secondary">Acompte :</span>
                <AcompteControls acompteVerse={acompteVerse} setAcompteVerse={setAcompteVerse} totalNet={calc.totalNet} compact />
              </div>
            )}
          </div>

          {/* Row 3 — download full width */}
          <div className="px-4 pb-3">
            <DownloadBtn fullWidth />
          </div>
        </div>

        {/* ── DOCUMENT AREA ─────────────────────────────────────── */}
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ backgroundColor: "#E5E5EA" }}
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
            {/*
              Outer box: occupies exactly the scaled visual space so the scroll
              area knows the correct height. Inner box: natural A4 size, scaled.
            */}
            <div
              style={{
                position: "relative",
                width: `${DOC_NATURAL_WIDTH * docScale}px`,
                height: `${docNaturalHeight * docScale}px`,
                flexShrink: 0,
              }}
            >
              <div
                ref={docInnerRef}
                className="bg-white shadow-float"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${DOC_NATURAL_WIDTH}px`,
                  transformOrigin: "top left",
                  transform: `scale(${docScale})`,
                }}
              >
                <DocumentTemplate
                  form={form}
                  calc={calcWithAcompte}
                  numero={numero}
                  documentType={documentType}
                  acompteVerse={acompteNum > 0 ? acompteNum : undefined}
                  documentDate={todayStr}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────── */}
        <div className="px-4 sm:px-5 py-3 border-t border-surface-border bg-white shrink-0 flex items-center justify-between">
          <div className="text-xs text-ink-muted">
            {pdfError && (
              <span className="flex items-center gap-1.5 text-red-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Erreur PDF — {pdfError}
              </span>
            )}
            {!pdfError && saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-ink-muted">
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Sauvegarde…
              </span>
            )}
            {!pdfError && saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-green-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Sauvegardé
              </span>
            )}
            {!pdfError && saveStatus === "local" && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Sauvegardé (hors-ligne)
              </span>
            )}
            {!pdfError && saveStatus === "error" && (
              <span className="flex items-center gap-1.5 text-red-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Erreur sauvegarde — {saveError}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted font-mono">
            Total : <span className="font-bold" style={{ color: "#0071E3" }}>{formatPrice(calcWithAcompte.totalNet)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
