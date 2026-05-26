"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DevisRecord } from "@/lib/types";
import { getDevisList, deleteDevis, saveDevis, generateId, generateNumero, clearLocalCache, localCacheCount } from "@/lib/storage";
import { formatPrice, calculateDevis } from "@/lib/calculations";
import { CLIENT_TYPE_LABELS } from "@/lib/pricing";
import { DocumentPreview } from "@/components/document/DocumentPreview";

type FilterType = "all" | "devis" | "facture";

const CLIENT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  entreprise: { bg: "rgba(0,113,227,0.08)", color: "#0071E3" },
  scolaire: { bg: "rgba(0,113,227,0.08)", color: "#0071E3" },
  loisirs: { bg: "rgba(0,113,227,0.08)", color: "#0071E3" },
};

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

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
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
          <div className="space-y-2">
            {filtered.map((record, idx) => (
              <div
                key={record.id}
                className="card p-4 hover:shadow-elevated transition-all duration-200 group"
                style={{ opacity: 0, animation: `slideUp 0.35s cubic-bezier(0.16,1,0.3,1) ${idx * 40 + 200}ms forwards` }}
              >
                <div className="flex items-center gap-3">
                  {/* Icon — caché sur mobile pour gagner de la place */}
                  <div
                    className="w-10 h-10 rounded-xl hidden sm:flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(0,113,227,0.1)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-ink">{record.clientName}</span>
                      <span className="badge text-xs" style={CLIENT_TYPE_COLORS[record.clientType]}>
                        {CLIENT_TYPE_LABELS[record.clientType]}
                      </span>
                      <span className={`badge text-xs ${record.documentType === "facture" ? "bg-brand-teal-light text-brand-teal" : "bg-brand-orange-light text-brand-orange"}`}>
                        {record.documentType === "facture" ? "Facture" : "Devis"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-ink-muted font-mono">{record.numero}</span>
                      <span className="text-xs text-ink-muted">·</span>
                      <span className="text-xs text-ink-muted">
                        {record.formData?.dateADefinir || !record.date
                          ? <span className="italic">Date à définir</span>
                          : formatDate(record.date)}
                      </span>
                      {record.participantsCount > 0 && (
                        <>
                          <span className="text-xs text-ink-muted">·</span>
                          <span className="text-xs text-ink-muted">{record.participantsCount} pers.</span>
                        </>
                      )}
                    </div>
                    {record.prestationDescription && (
                      <p className="text-xs text-ink-muted mt-0.5 truncate max-w-md">
                        {record.prestationDescription}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold font-mono" style={{ color: "#0071E3" }}>
                      {formatPrice(record.totalNet)}
                    </div>
                    {record.totalNet !== record.totalBrut && (
                      <div className="text-xs text-ink-muted line-through font-mono">
                        {formatPrice(record.totalBrut)}
                      </div>
                    )}
                  </div>

                  {/* Bouton supprimer — toujours visible sur mobile */}
                  <button
                    onClick={() => setConfirmDelete(record.id)}
                    className="sm:hidden w-11 h-11 flex items-center justify-center rounded-xl text-ink-muted active:text-brand-red active:bg-brand-red-light bg-surface-muted shrink-0"
                    title="Supprimer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>

                  {/* Actions complètes — desktop uniquement, apparaît au hover */}
                  <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="p-2 rounded-lg text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light transition-colors"
                      title="Voir / Télécharger"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>

                    {record.documentType === "devis" && (
                      <button
                        onClick={() => handleConvertToFacture(record)}
                        className="p-2 rounded-lg text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light transition-colors"
                        title="Convertir en facture"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </button>
                    )}

                    <button
                      onClick={() => handleDuplicate(record)}
                      className="p-2 rounded-lg text-ink-muted hover:text-brand-orange hover:bg-brand-orange-light transition-colors"
                      title="Dupliquer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>

                    <button
                      onClick={() => setConfirmDelete(record.id)}
                      className="p-2 rounded-lg text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-colors"
                      title="Supprimer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
