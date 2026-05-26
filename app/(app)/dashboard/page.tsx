"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { BlocClient } from "@/components/dashboard/BlocClient";
import { BlocActivite } from "@/components/dashboard/BlocActivite";
import { BlocSnacking } from "@/components/dashboard/BlocSnacking";
import { BlocRemise } from "@/components/dashboard/BlocRemise";
import { AperçuDevis } from "@/components/dashboard/AperçuDevis";
import { DocumentPreview } from "@/components/document/DocumentPreview";
import { calculateDevis } from "@/lib/calculations";
import { getDefaultForm } from "@/lib/defaultForm";
import { DURATION_LABELS } from "@/lib/pricing";
import type { DevisFormData } from "@/lib/types";

function formatHeure(h: string): string {
  const [hh, mm] = h.split(":");
  return mm === "00" ? `${parseInt(hh)}h` : `${parseInt(hh)}h${mm}`;
}

const MONTHS_FR = [
  "janvier","février","mars","avril","mai","juin",
  "juillet","août","septembre","octobre","novembre","décembre",
];

function formatDateCourt(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `le ${d} ${MONTHS_FR[m - 1]}`;
}

function buildGroupPhrase(form: DevisFormData): string {
  const n = form.participantsCount;
  if (form.clientType === "scolaire" || form.clientType === "loisirs") {
    const z = form.discount.accompagnatorsCount;
    const y = Math.max(0, n - z);
    return `pour un groupe de ${n} personnes dont ${y} élèves et ${z} accompagnateurs`;
  }
  return `pour ${n} personnes`;
}

function buildAutoDescription(form: DevisFormData): string {
  const group = buildGroupPhrase(form);
  const durationLabel = DURATION_LABELS[form.duration];
  const datePart = (!form.dateADefinir && form.date) ? ` ${formatDateCourt(form.date)}` : "";
  const timePart = (!form.dateADefinir && form.heureDebut) ? ` à ${formatHeure(form.heureDebut)}` : "";
  const dateTime = datePart || timePart ? `,${datePart}${timePart}` : "";

  const parts: string[] = [];

  if (form.activity === "paddle") {
    parts.push(
      `Location de Paddles, leash, pagaies et gilets de sauvetage ${group} — ${durationLabel}${dateTime}.`
    );
  } else if (form.activity === "kayak") {
    parts.push(
      `Location de Kayaks, pagaies et gilets de sauvetage ${group} — ${durationLabel}${dateTime}.`
    );
  } else if (form.activity === "hybride") {
    parts.push(
      `Location de Paddles et Kayaks, leash, pagaies et gilets de sauvetage ${group} — ${durationLabel}${dateTime}.`
    );
  }

  for (const item of form.snackingItems) {
    const prefix = item.label.startsWith("Formule") ? "" : "Formule ";
    parts.push(`+ ${prefix}${item.label} incluse.`);
  }

  if (form.coach.enabled) {
    parts.push(`+ Encadrement et initiation par un Coach Beach Paddle.`);
  }

  return parts.join(" ");
}

export default function DashboardPage() {
  const isDescriptionManual = useRef(false);

  const [form, setForm] = useState<DevisFormData>(() => {
    const defaultForm = getDefaultForm();
    return { ...defaultForm, prestationDescription: buildAutoDescription(defaultForm) };
  });

  const [showPreview, setShowPreview] = useState(false);

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
      ["heureDebut", "participantsCount", "snackingItems", "coach", "clientType", "discount", "date", "dateADefinir"].some(
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
    if (confirm("Réinitialiser le formulaire ?")) {
      isDescriptionManual.current = false;
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
              Nouveau document
            </h1>
            <p className="text-sm text-ink-secondary mt-0.5">
              Remplis le formulaire puis génère le devis ou la facture
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
            Réinitialiser
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
        />
      )}
    </>
  );
}
