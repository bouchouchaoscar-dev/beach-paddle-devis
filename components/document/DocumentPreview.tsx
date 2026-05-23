"use client";

import { useState, useRef, useEffect } from "react";
import type { DevisFormData, CalculationResult, DocumentType } from "@/lib/types";
import { DocumentTemplate } from "./DocumentTemplate";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { calculateDevis, formatPrice } from "@/lib/calculations";
import { saveDevis, generateNumero, generateId } from "@/lib/storage";
import type { DevisRecord } from "@/lib/types";

interface Props {
  form: DevisFormData;
  calc: CalculationResult;
  onClose: () => void;
  onFormChange: (patch: Partial<DevisFormData>) => void;
}

export function DocumentPreview({ form, calc, onClose, onFormChange }: Props) {
  const [documentType, setDocumentType] = useState<DocumentType>(form.documentType);
  const [acompteVerse, setAcompteVerse] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [todayStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [numero, setNumero] = useState<string>("");

  useEffect(() => {
    generateNumero(todayStr).then(setNumero);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  const acompteNum = parseFloat(acompteVerse) || 0;
  const calcWithAcompte = calculateDevis(form, acompteNum > 0 ? acompteNum : undefined);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleDownloadPDF() {
    setGenerating(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      const el = document.getElementById("document-template");
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      const fileName = `${documentType === "facture" ? "Facture" : "Devis"}_${numero.replace("N°", "").replace("/", "-")}_${form.clientName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      pdf.save(fileName);

      // Auto-save to history
      if (!saved) {
        const record: DevisRecord = {
          id: generateId(),
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
          formData: { ...form, documentType },
        };
        await saveDevis(record);
        setSaved(true);
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative z-10 flex flex-col h-full bg-surface border-l border-surface-border"
        style={{
          width: "min(92vw, 1020px)",
          opacity: 0,
          animation: "slideInRight 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="btn-ghost p-2"
              title="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-ink">Aperçu du document</p>
              <p className="text-xs text-ink-muted">{numero}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Doc type toggle */}
            <SegmentedControl
              options={[
                { value: "devis", label: "Devis" },
                { value: "facture", label: "Facture" },
              ]}
              value={documentType}
              onChange={(v) => {
                setDocumentType(v);
                onFormChange({ documentType: v });
              }}
              size="sm"
              accent="orange"
            />

            {/* Acompte (facture only) */}
            {documentType === "facture" && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-ink-secondary whitespace-nowrap">Acompte versé :</label>
                <button
                  type="button"
                  onClick={() => setAcompteVerse(String(Math.round(calc.totalNet * 0.3 * 100) / 100))}
                  className="flex items-center justify-center h-7 px-2.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-80 active:scale-95"
                  style={{ backgroundColor: "#0071E3", flexShrink: 0 }}
                >
                  30%
                </button>
                <div className="flex items-center gap-0">
                  <button
                    type="button"
                    onClick={() => setAcompteVerse((v) => String(Math.max(0, (parseFloat(v) || 0) - 10)))}
                    className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <div className="relative">
                    <input
                      type="number"
                      value={acompteVerse}
                      min={0}
                      step={10}
                      placeholder="0"
                      onChange={(e) => setAcompteVerse(e.target.value)}
                      className="w-24 h-9 border border-surface-border bg-white text-center text-sm font-bold text-ink outline-none font-mono pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcompteVerse((v) => String((parseFloat(v) || 0) + 10))}
                    className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleDownloadPDF}
              disabled={generating || !numero}
              className="btn-primary gap-2"
            >
              {generating ? (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {generating ? "Génération…" : "Télécharger PDF"}
            </button>
          </div>
        </div>

        {/* Document preview area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          style={{ backgroundColor: "#E5E5EA" }}
        >
          <div className="flex justify-center py-8 px-4">
            <div
              className="bg-white shadow-float"
              style={{
                width: "210mm",
                minHeight: "297mm",
                transformOrigin: "top center",
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

        {/* Footer status */}
        <div className="px-5 py-3 border-t border-surface-border bg-white shrink-0 flex items-center justify-between">
          <div className="text-xs text-ink-muted">
            {saved && (
              <span className="flex items-center gap-1.5 text-green-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Sauvegardé dans l&apos;historique
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
