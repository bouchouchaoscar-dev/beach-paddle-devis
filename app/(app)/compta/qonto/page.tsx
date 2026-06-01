"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { CHARGE_LABELS, type ChargeCategory } from "@/lib/compta-types";
import { formatPrice } from "@/lib/calculations";
import type { QontoDbTransaction, QontoRule } from "@/lib/qonto";
import { saveImmobilisation } from "@/lib/compta";

const CATEGORIES: ChargeCategory[] = [
  "restauration_metro", "restauration_autre", "equipement", "salaire", "autre",
];

type ExpandedState = {
  id: string;
  action: "inclure" | "exclure" | "immobiliser";
  categorie: ChargeCategory;
  fournisseur: string;
  memoriser: boolean;
  immoNom: string;
  immoDuree: number;
};

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short",
  });
}

// ── Checkbox ────────────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
        checked || indeterminate
          ? "bg-brand-teal border-brand-teal"
          : "border-surface-border hover:border-brand-teal bg-white"
      }`}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 6 5 9 10 3"/>
        </svg>
      )}
      {indeterminate && !checked && (
        <div className="w-2 h-0.5 bg-white rounded-full" />
      )}
    </button>
  );
}

export default function QontoPage() {
  const [transactions, setTransactions] = useState<QontoDbTransaction[]>([]);
  const [rules, setRules] = useState<QontoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<ExpandedState | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "inclus" | "regles">("pending");

  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategorie, setBulkCategorie] = useState<ChargeCategory>("autre");
  const [showBulkInclude, setShowBulkInclude] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: txs }, { data: r }] = await Promise.all([
      supabase.from("qonto_transactions").select("*").order("date", { ascending: false }),
      supabase.from("qonto_rules").select("*").order("created_at", { ascending: false }),
    ]);
    setTransactions((txs ?? []) as QontoDbTransaction[]);
    setRules((r ?? []) as QontoRule[]);
    setLoading(false);
  }, []);

  const SYNC_COOLDOWN_MS = 10 * 60 * 1000;
  const hasMountedRef = useRef(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/qonto-sync", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem("qonto_last_sync", String(Date.now()));
      await load();
    } catch {
      // silent failure — will retry next page open
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      const lastSync = parseInt(localStorage.getItem("qonto_last_sync") ?? "0");
      if (Date.now() - lastSync > SYNC_COOLDOWN_MS) {
        handleSync();
      }
    }
  }, [load, handleSync]);

  const pendingTxs = transactions.filter((t) => t.statut === "en_attente");
  const inclusTxs = transactions.filter((t) => t.statut === "inclus");
  const allVisibleTxs = activeTab === "pending" ? pendingTxs : inclusTxs;
  const visibleTxs = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allVisibleTxs;
    return allVisibleTxs.filter((t) =>
      t.libelle.toLowerCase().includes(q) ||
      String(t.montant).includes(q) ||
      (t.fournisseur ?? "").toLowerCase().includes(q)
    );
  })();

  function switchTab(tab: typeof activeTab) {
    setActiveTab(tab);
    setSelectedIds(new Set());
    setExpanded(null);
    setShowBulkInclude(false);
    setSearchQuery("");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (visibleTxs.every((t) => selectedIds.has(t.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleTxs.map((t) => t.id)));
    }
  }

  const allSelected = visibleTxs.length > 0 && visibleTxs.every((t) => selectedIds.has(t.id));
  const someSelected = visibleTxs.some((t) => selectedIds.has(t.id)) && !allSelected;
  const selectedCount = Array.from(selectedIds).filter((id) => visibleTxs.some((t) => t.id === id)).length;

  function openExpand(tx: QontoDbTransaction, action: "inclure" | "exclure" | "immobiliser") {
    if (expanded?.id === tx.id && expanded.action === action) { setExpanded(null); return; }
    setExpanded({
      id: tx.id, action,
      categorie: (tx.categorie as ChargeCategory) ?? "autre",
      fournisseur: tx.fournisseur ?? tx.libelle ?? "",
      memoriser: false,
      immoNom: tx.libelle ?? "",
      immoDuree: 3,
    });
  }

  async function handleApprove() {
    if (!expanded || expanded.action !== "inclure") return;
    setProcessing(expanded.id);
    try {
      const res = await fetch("/api/qonto-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: expanded.id, categorie: expanded.categorie, fournisseur: expanded.fournisseur, memoriser: expanded.memoriser }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExpanded(null);
      await load();
    } finally { setProcessing(null); }
  }

  async function handleReject(txId: string, memoriser = false) {
    setProcessing(txId);
    try {
      const res = await fetch("/api/qonto-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: txId, memoriser }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExpanded(null);
      await load();
    } finally { setProcessing(null); }
  }

  async function handleImmobiliser() {
    if (!expanded || expanded.action !== "immobiliser") return;
    if (!expanded.immoNom.trim()) return;
    const tx = transactions.find((t) => t.id === expanded.id);
    if (!tx) return;
    setProcessing(expanded.id);
    try {
      await saveImmobilisation({
        nom: expanded.immoNom.trim(),
        date_achat: tx.date,
        montant_total: tx.montant,
        duree_amortissement: expanded.immoDuree,
        methode: "lineaire",
        fournisseur: expanded.fournisseur || undefined,
        description: `Depuis Qonto : ${tx.libelle}`,
        annee_achat: tx.date.slice(0, 4),
        actif: true,
        created_by: "",
      });
      await supabase.from("qonto_transactions").update({ statut: "immobilise" }).eq("id", expanded.id);
      setExpanded(null);
      await load();
    } finally { setProcessing(null); }
  }

  async function handleBulkAction(action: "exclude" | "include" | "delete", categorie?: string) {
    const ids = Array.from(selectedIds).filter((id) => visibleTxs.some((t) => t.id === id));
    if (!ids.length) return;
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/qonto-bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, categorie }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelectedIds(new Set());
      setShowBulkInclude(false);
      setShowDeleteConfirm(false);
      await load();
    } finally { setBulkProcessing(false); }
  }

  async function handleDeleteRule(id: string) {
    await supabase.from("qonto_rules").delete().eq("id", id);
    await load();
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 text-ink-secondary text-sm">
          <svg className="animate-spin shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-32">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s forwards" }}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              <line x1="6" y1="15" x2="10" y2="15"/><line x1="14" y1="15" x2="16" y2="15"/>
            </svg>
            Qonto
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5 flex items-center gap-1.5">
            {syncing && (
              <svg className="animate-spin shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
            {syncing ? "Synchronisation en cours…" : "Synchronisation automatique à l'ouverture"}
          </p>
        </div>
      </div>

      {/* Tabs — full width on mobile */}
      <div
        className="flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-surface-border w-full sm:w-fit"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {([
          { id: "pending" as const, label: "En attente", count: pendingTxs.length, countColor: pendingTxs.length > 0 ? "bg-orange-500" : undefined },
          { id: "inclus" as const, label: "Incluses", count: inclusTxs.length },
          { id: "regles" as const, label: "Règles", count: rules.length },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => switchTab(tab.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id ? "bg-white shadow-soft text-brand-teal" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 rounded-full text-[9px] sm:text-[10px] font-bold ${
                tab.countColor ? `${tab.countColor} text-white` : "bg-surface-border text-ink-secondary"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: En attente + Incluses ── */}
      {(activeTab === "pending" || activeTab === "inclus") && (
        <div className="space-y-3" style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}>
          {/* Search bar */}
          <div className="relative w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une transaction..."
              className="input-field !pl-9 !py-1.5 text-sm w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {visibleTxs.length === 0 ? (
            <div className="card p-10 text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${searchQuery.trim() ? "bg-surface-muted" : "bg-green-50"}`}>
                {searchQuery.trim() ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </div>
              <p className="text-sm font-semibold text-ink">
                {searchQuery.trim() ? "Aucune transaction trouvée" : (activeTab === "pending" ? "Aucune transaction en attente" : "Aucune transaction incluse")}
              </p>
              <p className="text-xs text-ink-secondary mt-1">
                {searchQuery.trim() ? `Aucun résultat pour "${searchQuery.trim()}"` : "Synchronisez pour importer les dernières transactions"}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* Select-all header */}
              <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-surface-border bg-surface-muted/30">
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleSelectAll} />
                <span className="text-xs text-ink-secondary">
                  {selectedCount > 0
                    ? `${selectedCount} sélectionnée${selectedCount > 1 ? "s" : ""}`
                    : `${visibleTxs.length} transaction${visibleTxs.length > 1 ? "s" : ""}`}
                </span>
                {activeTab === "inclus" && (
                  <span className="ml-auto text-xs text-ink-muted">
                    Total : <strong className="text-ink">{formatPrice(inclusTxs.reduce((s, t) => s + t.montant, 0))}</strong>
                  </span>
                )}
              </div>

              <div className="divide-y divide-surface-border">
                {visibleTxs.map((tx) => {
                  const isChecked = selectedIds.has(tx.id);
                  const isExpandedHere = expanded?.id === tx.id;
                  const isLoading = processing === tx.id;

                  return (
                    <div key={tx.id} className={`group ${isChecked ? "bg-brand-teal-light/20" : ""}`}>
                      {/* Main row */}
                      <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors ${isExpandedHere ? "bg-surface-muted/50" : "hover:bg-surface-muted/20"}`}>
                        <Checkbox checked={isChecked} onChange={() => toggleSelect(tx.id)} />

                        {/* Libellé + date sous le libellé sur mobile */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{tx.libelle}</p>
                          <p className="text-[11px] text-ink-muted font-mono mt-0.5 sm:hidden">{fmtDate(tx.date)}</p>
                          {activeTab === "inclus" && tx.categorie && (
                            <p className="text-[11px] text-ink-muted mt-0.5">{CHARGE_LABELS[tx.categorie as ChargeCategory] ?? tx.categorie}</p>
                          )}
                        </div>

                        {/* Date: desktop uniquement */}
                        <div className="hidden sm:block shrink-0 text-xs text-ink-muted font-mono w-14">{fmtDate(tx.date)}</div>

                        {/* Montant */}
                        <div className="shrink-0 text-sm font-bold text-ink tabular-nums font-mono">{formatPrice(tx.montant)}</div>

                        {activeTab === "pending" ? (
                          <>
                            {/* Mobile : icônes seules */}
                            <div className="flex items-center gap-1 shrink-0 sm:hidden">
                              <button onClick={() => openExpand(tx, "inclure")} disabled={isLoading}
                                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
                                  isExpandedHere && expanded?.action === "inclure"
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-green-50 text-green-700 border-green-200 active:bg-green-100"
                                }`}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                              <button onClick={() => openExpand(tx, "exclure")} disabled={isLoading}
                                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
                                  isExpandedHere && expanded?.action === "exclure"
                                    ? "bg-red-600 text-white border-red-600"
                                    : "bg-red-50 text-red-600 border-red-200 active:bg-red-100"
                                }`}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                              <button onClick={() => openExpand(tx, "immobiliser")} disabled={isLoading}
                                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
                                  isExpandedHere && expanded?.action === "immobiliser"
                                    ? "bg-amber-600 text-white border-amber-600"
                                    : "bg-amber-50 text-amber-700 border-amber-200 active:bg-amber-100"
                                }`}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                              </button>
                            </div>
                            {/* Desktop : icône + texte */}
                            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                              <button onClick={() => openExpand(tx, "inclure")} disabled={isLoading}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                  isExpandedHere && expanded?.action === "inclure"
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                }`}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                Inclure
                              </button>
                              <button onClick={() => openExpand(tx, "exclure")} disabled={isLoading}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                  isExpandedHere && expanded?.action === "exclure"
                                    ? "bg-red-600 text-white border-red-600"
                                    : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                }`}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                                Exclure
                              </button>
                              <button onClick={() => openExpand(tx, "immobiliser")} disabled={isLoading}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                  isExpandedHere && expanded?.action === "immobiliser"
                                    ? "bg-amber-600 text-white border-amber-600"
                                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                }`}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                                Immobiliser
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">incluse</span>
                            {/* Toujours visible sur mobile, hover sur desktop */}
                            <button onClick={() => handleReject(tx.id, false)} disabled={isLoading}
                              className="sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Formulaire inline (pending uniquement) */}
                      {isExpandedHere && expanded && activeTab === "pending" && (
                        <div className="px-3 sm:px-4 pb-4 pt-3 bg-surface-muted/40 border-t border-surface-border">
                          {expanded.action === "immobiliser" ? (
                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                              <div className="sm:flex-1 sm:min-w-[160px]">
                                <label className="label">Nom du bien</label>
                                <input type="text" value={expanded.immoNom} onChange={(e) => setExpanded((s) => s ? { ...s, immoNom: e.target.value } : s)} className="input-field !py-1.5 !text-sm w-full" placeholder="ex: Flotte Kayak" />
                              </div>
                              <div>
                                <label className="label">Durée d&apos;amortissement</label>
                                <select value={expanded.immoDuree} onChange={(e) => setExpanded((s) => s ? { ...s, immoDuree: parseInt(e.target.value) } : s)} className="input-field !py-1.5 !text-sm w-full sm:w-auto">
                                  {[2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} ans ({d} saisons)</option>)}
                                </select>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={handleImmobiliser} disabled={!!processing || !expanded.immoNom.trim()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
                                  {processing === tx.id ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                                  Confirmer
                                </button>
                                <button onClick={() => setExpanded(null)} className="px-3 py-1.5 rounded-lg bg-surface-muted text-ink-secondary text-xs font-medium hover:bg-surface-border transition-colors">Annuler</button>
                              </div>
                            </div>
                          ) : expanded.action === "inclure" ? (
                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                              <div>
                                <label className="label">Catégorie</label>
                                <select value={expanded.categorie} onChange={(e) => setExpanded((s) => s ? { ...s, categorie: e.target.value as ChargeCategory } : s)} className="input-field !py-1.5 !text-sm w-full sm:w-auto">
                                  {CATEGORIES.map((c) => <option key={c} value={c}>{CHARGE_LABELS[c]}</option>)}
                                </select>
                              </div>
                              <div className="sm:flex-1 sm:min-w-[160px]">
                                <label className="label">Fournisseur</label>
                                <input type="text" value={expanded.fournisseur} onChange={(e) => setExpanded((s) => s ? { ...s, fournisseur: e.target.value } : s)} className="input-field !py-1.5 !text-sm w-full" />
                              </div>
                              <div className="flex items-center justify-between sm:justify-start sm:items-end gap-3">
                                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                                  <input type="checkbox" checked={expanded.memoriser} onChange={(e) => setExpanded((s) => s ? { ...s, memoriser: e.target.checked } : s)} className="w-3.5 h-3.5 rounded accent-brand-teal" />
                                  Mémoriser
                                </label>
                                <div className="flex gap-2">
                                  <button onClick={handleApprove} disabled={!!processing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                                    {processing === tx.id ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                    Confirmer
                                  </button>
                                  <button onClick={() => setExpanded(null)} className="px-3 py-1.5 rounded-lg bg-surface-muted text-ink-secondary text-xs font-medium hover:bg-surface-border transition-colors">Annuler</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                                <input type="checkbox" checked={expanded.memoriser} onChange={(e) => setExpanded((s) => s ? { ...s, memoriser: e.target.checked } : s)} className="w-3.5 h-3.5 rounded accent-red-500" />
                                Mémoriser cette exclusion
                              </label>
                              <div className="flex gap-2">
                                <button onClick={() => handleReject(tx.id, expanded.memoriser)} disabled={!!processing}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                                  {processing === tx.id ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                                  Confirmer l&apos;exclusion
                                </button>
                                <button onClick={() => setExpanded(null)} className="px-3 py-1.5 rounded-lg bg-surface-muted text-ink-secondary text-xs font-medium hover:bg-surface-border transition-colors">Annuler</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Règles ── */}
      {activeTab === "regles" && (
        <div className="space-y-4" style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border bg-surface-muted/30">
              <h2 className="text-sm font-semibold text-ink">Règles mémorisées</h2>
              <p className="text-xs text-ink-secondary mt-0.5">Appliquées en priorité lors de la prochaine synchronisation</p>
            </div>
            {rules.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-secondary">
                Aucune règle mémorisée — utilisez &quot;Mémoriser pour la suite&quot; lors du traitement
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {rules.map((rule) => (
                  <div key={rule.id} className="group flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-surface-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-medium text-ink truncate">contient &quot;{rule.libelle_contains}&quot;</p>
                      {rule.categorie && <p className="text-[11px] text-ink-muted mt-0.5">→ {CHARGE_LABELS[rule.categorie as ChargeCategory] ?? rule.categorie}</p>}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${rule.action === "inclus" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {rule.action}
                    </span>
                    {/* Toujours visible sur mobile */}
                    <button onClick={() => handleDeleteRule(rule.id)}
                      className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-3">Règles par défaut (non modifiables)</h3>
            <div className="space-y-2 text-xs text-ink-secondary">
              {[
                { label: "SGC SAINT MAUR", action: "inclus", cat: "Autre" },
                { label: "CARREFOUR ORMESS", action: "inclus", cat: "Restauration autre" },
                { label: "LIDL CHENNEVIERES", action: "inclus", cat: "Restauration autre" },
                { label: "PANEM", action: "inclus", cat: "Restauration autre" },
                { label: "METRO FRANCE (≥ 31/05/2026)", action: "inclus", cat: "Restauration Métro" },
                { label: "Virements reçus", action: "exclu", cat: null },
                { label: "NETFLIX / SPOTIFY / SFR…", action: "exclu", cat: null },
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2 flex-wrap">
                  <span className={`shrink-0 inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${r.action === "inclus" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{r.action}</span>
                  <span className="font-mono">{r.label}</span>
                  {r.cat && <span className="text-ink-muted">→ {r.cat}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Barre d'actions groupées flottante ── */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-2xl">
          <div className="bg-zinc-900 text-white rounded-2xl shadow-2xl border border-zinc-700 overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold shrink-0">
                {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
              </span>
              <div className="w-px h-4 bg-zinc-600 shrink-0" />

              {activeTab === "pending" && (
                <button
                  onClick={() => { setShowBulkInclude((v) => !v); setShowDeleteConfirm(false); }}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-500 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Inclure {selectedCount}
                </button>
              )}

              <button
                onClick={() => handleBulkAction("exclude")}
                disabled={bulkProcessing}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-700 text-white text-xs font-semibold hover:bg-zinc-600 disabled:opacity-50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Exclure {selectedCount}
              </button>

              <button
                onClick={() => { setShowDeleteConfirm((v) => !v); setShowBulkInclude(false); }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-600 transition-colors ml-auto"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
                <span className="hidden sm:inline">Supprimer {selectedCount}</span>
                <span className="sm:hidden">{selectedCount}</span>
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {showBulkInclude && (
              <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-zinc-700 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-300">Catégorie :</span>
                  <select
                    value={bulkCategorie}
                    onChange={(e) => setBulkCategorie(e.target.value as ChargeCategory)}
                    className="rounded-lg bg-zinc-800 border border-zinc-600 text-white text-xs px-2 py-1.5 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CHARGE_LABELS[c]}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => handleBulkAction("include", bulkCategorie)}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors"
                >
                  {bulkProcessing
                    ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  }
                  Confirmer l&apos;inclusion
                </button>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="px-3 sm:px-4 pb-3 pt-2 border-t border-zinc-700 flex flex-wrap items-center gap-3">
                <span className="text-xs text-red-300 font-medium">Supprimer définitivement {selectedCount} transaction{selectedCount > 1 ? "s" : ""} ?</span>
                <button
                  onClick={() => handleBulkAction("delete")}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {bulkProcessing ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : null}
                  Supprimer
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-xs text-zinc-400 hover:text-white transition-colors">Annuler</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
