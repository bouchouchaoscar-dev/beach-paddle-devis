"use client";

import { useState, useEffect, useCallback } from "react";
import { getStatutRow, setStatut, resolveStatut } from "@/lib/statut";
import type { StatutValue, StatutResult } from "@/lib/statut";

const STATUTS: {
  value: StatutValue;
  label: string;
  sublabel: string;
  activeBg: string;
  activeBorder: string;
  idleBg: string;
  idleBorder: string;
  idleText: string;
}[] = [
  {
    value: "ouvert",
    label: "OUVERT",
    sublabel: "La base est ouverte",
    activeBg: "#16A34A",
    activeBorder: "#15803D",
    idleBg: "#F0FDF4",
    idleBorder: "#86EFAC",
    idleText: "#15803D",
  },
  {
    value: "incertain",
    label: "INCERTAIN",
    sublabel: "Météo mitigée",
    activeBg: "#D97706",
    activeBorder: "#B45309",
    idleBg: "#FFFBEB",
    idleBorder: "#FCD34D",
    idleText: "#92400E",
  },
  {
    value: "ferme_aujourdhui",
    label: "FERMÉ\nAUJOURD'HUI",
    sublabel: "Météo défavorable",
    activeBg: "#DC2626",
    activeBorder: "#B91C1C",
    idleBg: "#FFF1F2",
    idleBorder: "#FCA5A5",
    idleText: "#991B1B",
  },
  {
    value: "ferme_saison",
    label: "FERMÉ\nSAISON",
    sublabel: "Fermeture permanente",
    activeBg: "#334155",
    activeBorder: "#1E293B",
    idleBg: "#F8FAFC",
    idleBorder: "#94A3B8",
    idleText: "#1E293B",
  },
];

const STATUT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ouvert:          { label: "OUVERT",           color: "#15803D", bg: "#F0FDF4" },
  incertain:       { label: "INCERTAIN",         color: "#92400E", bg: "#FFFBEB" },
  ferme_aujourdhui:{ label: "FERMÉ AUJOURD'HUI", color: "#991B1B", bg: "#FFF1F2" },
  ferme_saison:    { label: "FERMÉ POUR LA SAISON", color: "#334155", bg: "#F1F5F9" },
  auto:            { label: "Non défini",        color: "#6E6E73", bg: "#F5F5F7" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatutPage() {
  const [result, setResult] = useState<StatutResult | null>(null);
  const [saving, setSaving] = useState<StatutValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const row = await getStatutRow();
    setResult(resolveStatut(row));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSet(statut: StatutValue) {
    if (saving) return;
    setSaving(statut);
    setError(null);
    try {
      await setStatut(statut);
      await load();
    } catch {
      setError("Erreur lors de la mise à jour. Vérifiez votre connexion.");
    } finally {
      setSaving(null);
    }
  }

  const activeStatut = result?.statut ?? null;
  const info = activeStatut ? STATUT_LABELS[activeStatut] : null;
  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-ink">Statut d&apos;ouverture</h1>
        <p className="text-sm text-ink-muted mt-0.5 capitalize">{todayLabel}</p>
      </div>

      {/* Statut actuel */}
      <div
        className="rounded-2xl p-5 border-2 transition-colors duration-300"
        style={info
          ? { backgroundColor: info.bg, borderColor: activeStatut === "auto" ? "#D2D2D7" : "transparent" }
          : { backgroundColor: "#F5F5F7", borderColor: "#D2D2D7" }
        }
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Statut actuel</p>
        {result === null ? (
          <div className="h-7 w-40 bg-surface-border rounded-lg animate-pulse" />
        ) : (
          <>
            <p
              className="text-2xl font-black tracking-tight"
              style={{ color: info?.color ?? "#6E6E73" }}
            >
              {info?.label ?? "Non défini"}
            </p>
            {result.statut === "auto" ? (
              <p className="text-sm text-ink-muted mt-1">Aucun statut défini pour aujourd&apos;hui.</p>
            ) : result.misAJourLe ? (
              <p className="text-xs text-ink-muted mt-1">Mis à jour le {formatTime(result.misAJourLe)}</p>
            ) : null}
          </>
        )}
      </div>

      {/* 4 gros boutons */}
      <div className="grid grid-cols-2 gap-3">
        {STATUTS.map((s) => {
          const isActive = activeStatut === s.value;
          const isLoading = saving === s.value;
          const disabled = saving !== null;

          return (
            <button
              key={s.value}
              onClick={() => handleSet(s.value)}
              disabled={disabled}
              className="relative rounded-2xl border-2 font-bold text-left transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed"
              style={{
                minHeight: 96,
                padding: "16px 18px",
                backgroundColor: isActive ? s.activeBg : s.idleBg,
                borderColor: isActive ? s.activeBorder : s.idleBorder,
                color: isActive ? "#FFFFFF" : s.idleText,
                opacity: disabled && !isLoading ? 0.6 : 1,
              }}
            >
              {/* Checkmark or spinner */}
              {isActive && !isLoading && (
                <span className="absolute top-3 right-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
              )}
              {isLoading && (
                <span className="absolute top-3 right-3">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                </span>
              )}
              <span className="block text-base font-black leading-tight whitespace-pre-line">
                {s.label}
              </span>
              <span
                className="block text-xs font-medium mt-1 leading-tight"
                style={{ opacity: isActive ? 0.85 : 0.7 }}
              >
                {s.sublabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Note expiration */}
      <p className="text-xs text-ink-muted text-center px-2">
        Les statuts &quot;Ouvert&quot;, &quot;Incertain&quot; et &quot;Fermé aujourd&apos;hui&quot; s&apos;appliquent uniquement au jour J.
        &quot;Fermé saison&quot; persiste jusqu&apos;au prochain changement.
      </p>

      {/* Erreur */}
      {error && (
        <div className="rounded-xl p-3 border text-sm font-medium"
          style={{ backgroundColor: "#FFF1F2", borderColor: "#FCA5A5", color: "#991B1B" }}>
          {error}
        </div>
      )}

      {/* Info route API */}
      <div className="rounded-xl p-4 bg-surface-muted border border-surface-border">
        <p className="text-xs font-semibold text-ink-secondary mb-1">Route de lecture externe</p>
        <code className="text-xs text-ink-muted break-all font-mono">
          GET /api/statut-ouverture
        </code>
        <p className="text-xs text-ink-muted mt-1">Protégée par <code className="font-mono">x-api-secret</code> header.</p>
      </div>
    </div>
  );
}
