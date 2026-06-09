"use client";

import { useState, useCallback, useMemo, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BlocClient } from "@/components/dashboard/BlocClient";
import { BlocActivite } from "@/components/dashboard/BlocActivite";
import { BlocSnacking } from "@/components/dashboard/BlocSnacking";
import { BlocRemise } from "@/components/dashboard/BlocRemise";
import { AperçuDevis } from "@/components/dashboard/AperçuDevis";
import { DocumentPreview } from "@/components/document/DocumentPreview";
import { calculateDevis } from "@/lib/calculations";
import { getDefaultForm } from "@/lib/defaultForm";
import { getDevisById } from "@/lib/storage";
import { buildAutoDescription } from "@/lib/autoDescription";
import type { DevisFormData, DevisRecord } from "@/lib/types";


function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDescriptionManual = useRef(false);
  const [editingRecord, setEditingRecord] = useState<DevisRecord | null>(null);

  const [form, setForm] = useState<DevisFormData>(() => {
    const defaultForm = getDefaultForm();
    return { ...defaultForm, prestationDescription: buildAutoDescription(defaultForm) };
  });

  const [showPreview, setShowPreview] = useState(false);

  // Load existing record if ?edit=ID is in the URL
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    getDevisById(editId).then((record) => {
      if (!record) return;
      setEditingRecord(record);
      isDescriptionManual.current = true;
      setForm(record.formData);
    });
  }, [searchParams]);

  const onChange = useCallback((patch: Partial<DevisFormData>) => {
    if ("prestationDescription" in patch) {
      isDescriptionManual.current = true;
      setForm((prev) => ({ ...prev, ...patch }));
      return;
    }

    const isActivityOrDuration = "activity" in patch || "duration" in patch;
    if (isActivityOrDuration || "clientType" in patch) {
      isDescriptionManual.current = false;
    }

    const isAutoTrigger =
      isActivityOrDuration ||
      ["heureDebut", "participantsCount", "snackingItems", "coach", "clientType", "discount", "date", "dateADefinir",
       "megaPaddleCount", "megaEscapeCount"].some(
        (f) => f in patch
      );

    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (!isAutoTrigger) return next;
      const autoDesc = buildAutoDescription(next);
      if (isActivityOrDuration || !isDescriptionManual.current) {
        return { ...next, prestationDescription: autoDesc };
      }
      return next;
    });
  }, []);

  const calc = useMemo(() => calculateDevis(form), [form]);

  function handleReset() {
    if (confirm(editingRecord ? "Annuler la modification et créer un nouveau document ?" : "Réinitialiser le formulaire ?")) {
      isDescriptionManual.current = false;
      setEditingRecord(null);
      router.replace("/dashboard");
      const freshForm = getDefaultForm();
      setForm({ ...freshForm, prestationDescription: buildAutoDescription(freshForm) });
    }
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div
            style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
          >
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {editingRecord ? "Modifier le document" : "Nouveau document"}
            </h1>
            <p className="text-sm text-ink-secondary mt-0.5">
              {editingRecord
                ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold" style={{ color: "#0071E3" }}>{editingRecord.numero}</span>
                    <span>·</span>
                    <span>{editingRecord.clientName}</span>
                    {editingRecord.documentType === "facture" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>Facture</span>
                    )}
                  </span>
                )
                : "Remplis le formulaire puis génère le devis ou la facture"
              }
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="btn-ghost text-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.1"/>
            </svg>
            {editingRecord ? "Annuler" : "Réinitialiser"}
          </button>
        </div>

        {/* Layout 2 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* Colonne gauche — formulaire */}
          <div className="space-y-4">
            <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}>
              <BlocClient form={form} onChange={onChange} />
            </div>
            <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards" }}>
              <BlocActivite form={form} onChange={onChange} />
            </div>
            <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.25s forwards" }}>
              <BlocSnacking form={form} onChange={onChange} />
            </div>
            <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.3s forwards" }}>
              <BlocRemise form={form} onChange={onChange} />
            </div>
          </div>

          {/* Colonne droite — aperçu */}
          <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.35s forwards" }}>
            <AperçuDevis
              form={form}
              calc={calc}
              onGenerate={() => setShowPreview(true)}
            />
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      {showPreview && (
        <DocumentPreview
          form={form}
          calc={calc}
          onClose={() => setShowPreview(false)}
          onFormChange={onChange}
          existingId={editingRecord?.id}
          existingNumero={editingRecord?.numero}
        />
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
