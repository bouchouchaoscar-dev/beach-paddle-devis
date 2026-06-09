"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DevisRecord } from "@/lib/types";
import { getDevisList, deleteDevis, saveDevis, generateId, generateNumero, clearLocalCache, localCacheCount } from "@/lib/storage";
import { formatPrice, calculateDevis } from "@/lib/calculations";
import { DURATION_LABELS } from "@/lib/pricing";
import { DocumentPreview } from "@/components/document/DocumentPreview";

type FilterType = "all" | "devis" | "facture";

// ── Badge styles ─────────────────────────────────────────────────────────────
const CLIENT_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  entreprise:  { bg: "rgba(0,113,227,0.10)",   color: "#0071E3", label: "Entreprise" },
  association: { bg: "rgba(124,58,237,0.10)",  color: "#7C3AED", label: "Assoc." },
  scolaire:    { bg: "rgba(22,163,74,0.10)",   color: "#16A34A", label: "Établissement scolaire" },
  loisirs:     { bg: "rgba(232,130,12,0.12)",  color: "#B45309", label: "Service Jeunesse" },
};

function formatHeure(h: string): string {
  if (!h) return "";
  const [hh, mm] = h.split(":");
  return mm === "00" ? `${parseInt(hh)}h` : `${parseInt(hh)}h${mm}`;
}

function formatPrestationDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y.slice(2)}`;
}

function ActivityIcon({ activity }: { activity?: string }) {
  if (activity === "paddle") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12 C5 8, 9 8, 12 12 C15 16, 19 16, 22 12"/>
        <path d="M2 17 C5 13, 9 13, 12 17 C15 21, 19 21, 22 17"/>
      </svg>
    );
  }
  if (activity === "kayak") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M2 12 L6 8 M22 12 L18 8"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>
    );
  }
  if (activity === "mega_paddle") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h20M4 20V14l8-6 8 6v6M10 20v-5h4v5"/>
      </svg>
    );
  }
  // hybride
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9 C5 6, 9 6, 12 9 C15 12, 19 12, 22 9"/>
      <line x1="2" y1="15" x2="22" y2="15"/>
    </svg>
  );
}

export default function HistoriquePage() {
  const router = useRouter();
  const [records, setRecords] = useState<DevisRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedRecord, setSelectedRecord] = useState<DevisRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [cacheCount, setCacheCount] = useState(0);

  useEffect(() => {
    getDevisList().then(setRecords);
    setCacheCount(localCacheCount());
  }, []);

  async function refresh() {
    setRecords(await getDevisList());
  }

  async function handleDelete(id: string) {
    await deleteDevis(id);
    setConfirmDelete(null);
    await refresh();
  }

  async function handleDuplicate(record: DevisRecord) {
    const today = new Date().toISOString().split("T")[0];
    const newRecord: DevisRecord = {
      ...record,
      id: generateId(),
      numero: await generateNumero(today),
      date: today,
      createdAt: Date.now(),
    };
    await saveDevis(newRecord);
    await refresh();
  }

  async function handleConvertToFacture(record: DevisRecord) {
    const today = new Date().toISOString().split("T")[0];
    const newRecord: DevisRecord = {
      ...record,
      id: generateId(),
      numero: await generateNumero(today),
      date: today,
      createdAt: Date.now(),
      documentType: "facture",
      formData: { ...record.formData, documentType: "facture" },
    };
    await saveDevis(newRecord);
    await refresh();
    setFilter("facture");
  }

  const filtered = records.filter((r) => {
    const matchSearch =
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.numero.toLowerCase().includes(search.toLowerCase()) ||
      (r.prestationDescription?.toLowerCase() ?? "").includes(search.toLowerCase());
    const matchFilter = filter === "all" || r.documentType === filter;
    return matchSearch && matchFilter;
  });

  const formatCreatedAt = (ts: number) => {
    return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div
          className="flex items-start justify-between mb-6"
          style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Archives</h1>
            <p className="text-sm text-ink-secondary mt-0.5">
              {records.length} document{records.length !== 1 ? "s" : ""} enregistré
              {records.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cacheCount > 0 && (
              <button
                onClick={() => {
                  clearLocalCache();
                  setCacheCount(0);
                  getDevisList().then(setRecords);
                }}
                className="btn-secondary gap-1.5 text-xs text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                title="Supprimer les anciens devis stockés localement sur cet appareil"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                Vider cache local ({cacheCount})
              </button>
            )}
            <button onClick={() => router.push("/dashboard")} className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouveau devis
            </button>
          </div>
        </div>

        {/* Filters */}
        <div
          className="flex flex-col sm:flex-row gap-3 mb-5"
          style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
        >
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par client, numéro…"
              className="input-field pl-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-surface-border">
            {(["all", "devis", "facture"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filter === f
                    ? "bg-white shadow-soft text-brand-orange"
                    : "text-ink-secondary hover:text-ink hover:bg-white/50"
                }`}
              >
                {f === "all" ? "Tous" : f === "devis" ? "Devis" : "Factures"}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            style={{ opacity: 0, animation: "fadeIn 0.4s ease 0.2s forwards" }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(0,113,227,0.08)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-ink mb-1">
              {search || filter !== "all" ? "Aucun résultat" : "Aucun document"}
            </h3>
            <p className="text-sm text-ink-muted max-w-xs">
              {search
                ? `Aucun document ne correspond à "${search}"`
                : "Génère ton premier devis pour qu'il apparaisse ici"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((record, idx) => {
              const fd = record.formData;
              const clientBadge = CLIENT_BADGE[record.clientType] ?? CLIENT_BADGE.entreprise;
              const isFacture = record.documentType === "facture";
              const hasRemise = record.totalNet !== record.totalBrut;

              // Ligne 2 — infos activité
              const activityLabel =
                fd?.activity === "paddle" ? "Paddle" :
                fd?.activity === "kayak" ? "Kayak" :
                fd?.activity === "hybride" ? "Paddle + Kayak" :
                fd?.activity === "mega_paddle" ? "MégaPaddle" : null;
              const activityBadgeStyle = fd?.activity === "mega_paddle"
                ? { backgroundColor: "rgba(13,148,136,0.12)", color: "#0D9488" }
                : { backgroundColor: "rgba(0,113,227,0.10)", color: "#0071E3" };
              const durationLabel = fd?.duration ? DURATION_LABELS[fd.duration] : null;

              const isGroupeAccomp =
                (record.clientType === "scolaire" || record.clientType === "loisirs" || record.clientType === "association") &&
                fd?.discount?.accompagnatorsEnabled &&
                (fd?.discount?.accompagnatorsCount ?? 0) > 0;
              const nbAccomp = fd?.discount?.accompagnatorsCount ?? 0;
              const nbEleves = Math.max(0, (record.participantsCount ?? 0) - nbAccomp);

              const prestationDate = (!fd?.dateADefinir && record.date) ? formatPrestationDate(record.date) : null;
              const heureLabel = (!fd?.dateADefinir && fd?.heureDebut) ? formatHeure(fd.heureDebut) : null;

              return (
                <div
                  key={record.id}
                  className="card hover:shadow-elevated transition-all duration-200 group"
                  style={{ opacity: 0, animation: `slideUp 0.35s cubic-bezier(0.16,1,0.3,1) ${idx * 40 + 200}ms forwards` }}
                >
                  {/* ── DESKTOP : 2 lignes ── */}
                  <div className="hidden sm:block px-5 py-3.5">
                    {/* Ligne haute : identité + numéro | prix */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ backgroundColor: clientBadge.bg, color: clientBadge.color }}
                      >
                        {clientBadge.label}
                      </span>
                      <span className="text-sm font-bold text-ink">{record.clientName}</span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={
                          isFacture
                            ? { backgroundColor: "rgba(124,58,237,0.10)", color: "#7C3AED" }
                            : { backgroundColor: "rgba(110,110,115,0.10)", color: "#6E6E73" }
                        }
                      >
                        {isFacture ? "Facture" : "Devis"}
                      </span>
                      <span className="text-xs text-ink-muted font-mono">{record.numero}</span>
                      <div className="flex-1" />
                      {/* Prix à droite */}
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-base font-bold font-mono" style={{ color: "#0071E3" }}>{formatPrice(record.totalNet)}</span>
                        {hasRemise && (
                          <span className="text-xs text-ink-muted line-through font-mono">{formatPrice(record.totalBrut)}</span>
                        )}
                      </div>
                    </div>
                    {/* Ligne basse : chips | boutons */}
                    <div className="flex items-center gap-1.5">
                      {activityLabel && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", ...activityBadgeStyle }}>
                          <ActivityIcon activity={fd?.activity} />
                          {activityLabel}
                        </span>
                      )}
                      {durationLabel && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "rgba(232,130,12,0.12)", color: "#B45309" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          {durationLabel}
                        </span>
                      )}
                      {record.participantsCount > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "rgba(22,163,74,0.10)", color: "#16A34A" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                          {isGroupeAccomp ? `${nbEleves}él. + ${nbAccomp}acc.` : `${record.participantsCount} pers.`}
                        </span>
                      )}
                      {prestationDate && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {prestationDate}{heureLabel && ` · ${heureLabel}`}
                        </span>
                      )}
                      <div className="flex-1" />
                      {/* Boutons toujours visibles */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setSelectedRecord(record)} className="p-2 rounded-lg text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light transition-colors" title="Voir / Télécharger">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                        <button onClick={() => router.push("/dashboard?edit=" + record.id)} className="p-2 rounded-lg text-ink-muted hover:text-[#0071E3] hover:bg-[rgba(0,113,227,0.08)] transition-colors" title="Modifier">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        {record.documentType === "devis" && (
                          <button onClick={() => handleConvertToFacture(record)} className="p-2 rounded-lg text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light transition-colors" title="Convertir en facture">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                              <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                            </svg>
                          </button>
                        )}
                        <button onClick={() => handleDuplicate(record)} className="p-2 rounded-lg text-ink-muted hover:text-brand-orange hover:bg-brand-orange-light transition-colors" title="Dupliquer">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                        <button onClick={() => setConfirmDelete(record.id)} className="p-2 rounded-lg text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-colors" title="Supprimer">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── MOBILE : layout empilé ── */}
                  <div className="sm:hidden p-4">
                    {/* Ligne 1 : badges + nom + numéro */}
                    <div className="flex items-start gap-2 flex-wrap mb-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ backgroundColor: clientBadge.bg, color: clientBadge.color }}
                      >
                        {clientBadge.label}
                      </span>
                      <span className="text-sm font-bold text-ink leading-tight">{record.clientName}</span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={
                          isFacture
                            ? { backgroundColor: "rgba(124,58,237,0.10)", color: "#7C3AED" }
                            : { backgroundColor: "rgba(110,110,115,0.10)", color: "#6E6E73" }
                        }
                      >
                        {isFacture ? "Facture" : "Devis"}
                      </span>
                      <span className="text-xs text-ink-muted font-mono ml-auto shrink-0">{record.numero}</span>
                    </div>
                    {/* Ligne 2 : chips */}
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {activityLabel && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", ...activityBadgeStyle }}>
                          <ActivityIcon activity={fd?.activity} />
                          {activityLabel}
                        </span>
                      )}
                      {durationLabel && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "rgba(232,130,12,0.12)", color: "#B45309" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          {durationLabel}
                        </span>
                      )}
                      {record.participantsCount > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "rgba(22,163,74,0.10)", color: "#16A34A" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                          {isGroupeAccomp ? `${nbEleves}él. + ${nbAccomp}acc.` : `${record.participantsCount} pers.`}
                        </span>
                      )}
                      {prestationDate && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {prestationDate}{heureLabel && ` · ${heureLabel}`}
                        </span>
                      )}
                    </div>
                    {/* Ligne 3 : prix + date */}
                    <div className="flex items-center gap-3 mb-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold font-mono" style={{ color: "#0071E3" }}>{formatPrice(record.totalNet)}</span>
                        {hasRemise && (
                          <span className="text-xs text-ink-muted line-through font-mono">{formatPrice(record.totalBrut)}</span>
                        )}
                      </div>
                      <span className="text-xs text-ink-muted">Créé le {formatCreatedAt(record.createdAt)}</span>
                    </div>
                    {/* Actions mobile */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-border">
                      <button onClick={() => setSelectedRecord(record)} className="flex-1 flex items-center justify-center h-10 rounded-xl bg-surface-muted text-ink-muted active:text-brand-teal active:bg-brand-teal-light transition-colors" title="Voir">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                      <button onClick={() => router.push("/dashboard?edit=" + record.id)} className="flex-1 flex items-center justify-center h-10 rounded-xl bg-surface-muted text-ink-muted active:text-[#0071E3] active:bg-[rgba(0,113,227,0.08)] transition-colors" title="Modifier">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {record.documentType === "devis" && (
                        <button onClick={() => handleConvertToFacture(record)} className="flex-1 flex items-center justify-center h-10 rounded-xl bg-surface-muted text-ink-muted active:text-brand-teal active:bg-brand-teal-light transition-colors" title="→ Facture">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                          </svg>
                        </button>
                      )}
                      <button onClick={() => handleDuplicate(record)} className="flex-1 flex items-center justify-center h-10 rounded-xl bg-surface-muted text-ink-muted active:text-brand-orange active:bg-brand-orange-light transition-colors" title="Dupliquer">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <button onClick={() => setConfirmDelete(record.id)} className="flex-1 flex items-center justify-center h-10 rounded-xl bg-surface-muted text-ink-muted active:text-brand-red active:bg-brand-red-light transition-colors" title="Supprimer">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-float p-6 max-w-sm w-full mx-4" style={{ opacity: 0, animation: "scaleIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(224,49,49,0.1)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E03131" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-ink mb-1">Supprimer ce document ?</h3>
            <p className="text-sm text-ink-secondary mb-5">Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
                style={{ backgroundColor: "#E03131" }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {selectedRecord && (
        <DocumentPreview
          form={selectedRecord.formData}
          calc={calculateDevis(selectedRecord.formData)}
          onClose={() => setSelectedRecord(null)}
          onFormChange={() => {}}
          readOnly
          existingNumero={selectedRecord.numero}
        />
      )}
    </>
  );
}
