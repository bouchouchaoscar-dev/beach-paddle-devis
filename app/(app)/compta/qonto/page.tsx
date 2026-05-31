"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CHARGE_LABELS, type ChargeCategory } from "@/lib/compta-types";
import { formatPrice } from "@/lib/calculations";
import type { QontoDbTransaction, QontoRule } from "@/lib/qonto";

const CATEGORIES: ChargeCategory[] = [
  "restauration_metro", "restauration_autre", "equipement", "salaire", "autre",
];

interface SyncReport {
  nouveau: number;
  total_fetched: number;
  inclus: number;
  exclu: number;
  en_attente: number;
}

type ExpandedState = {
  id: string;
  action: "inclure" | "exclure";
  categorie: ChargeCategory;
  fournisseur: string;
  memoriser: boolean;
};

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short",
  });
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${color}`}>
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[11px] font-medium mt-0.5">{label}</span>
    </div>
  );
}

export default function QontoPage() {
  const [transactions, setTransactions] = useState<QontoDbTransaction[]>([]);
  const [rules, setRules] = useState<QontoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "inclus" | "regles">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: txs }, { data: r }] = await Promise.all([
      supabase
        .from("qonto_transactions")
        .select("*")
        .order("date", { ascending: false }),
      supabase
        .from("qonto_rules")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    setTransactions((txs ?? []) as QontoDbTransaction[]);
    setRules((r ?? []) as QontoRule[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingTxs = transactions.filter((t) => t.statut === "en_attente");
  const inclusTxs = transactions.filter((t) => t.statut === "inclus");

  async function handleSync() {
    setSyncing(true);
    setSyncReport(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/qonto-sync", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncError(data.error);
      } else {
        setSyncReport(data as SyncReport);
        await load();
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSyncing(false);
    }
  }

  function openExpand(tx: QontoDbTransaction, action: "inclure" | "exclure") {
    if (expanded?.id === tx.id && expanded.action === action) {
      setExpanded(null);
      return;
    }
    setExpanded({
      id: tx.id,
      action,
      categorie: (tx.categorie as ChargeCategory) ?? "autre",
      fournisseur: tx.fournisseur ?? tx.libelle ?? "",
      memoriser: false,
    });
  }

  async function handleApprove() {
    if (!expanded || expanded.action !== "inclure") return;
    setProcessing(expanded.id);
    try {
      const res = await fetch("/api/qonto-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: expanded.id,
          categorie: expanded.categorie,
          fournisseur: expanded.fournisseur,
          memoriser: expanded.memoriser,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExpanded(null);
      await load();
    } finally {
      setProcessing(null);
    }
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
    } finally {
      setProcessing(null);
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Header */}
      <div
        className="flex items-start justify-between flex-wrap gap-4"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s forwards" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
              <line x1="6" y1="15" x2="10" y2="15"/>
              <line x1="14" y1="15" x2="16" y2="15"/>
            </svg>
            Qonto
          </h1>
          <p className="text-sm text-ink-secondary mt-0.5">Transactions bancaires — synchronisation automatique</p>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-primary gap-2 shrink-0"
          style={{ backgroundColor: "#0071E3" }}
        >
          {syncing ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Synchronisation…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Synchroniser Qonto
            </>
          )}
        </button>
      </div>

      {/* Sync error */}
      {syncError && (
        <div
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          style={{ opacity: 0, animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards" }}
        >
          <strong>Erreur de synchronisation :</strong> {syncError}
        </div>
      )}

      {/* Sync report */}
      {syncReport && (
        <div
          className="card p-4"
          style={{ opacity: 0, animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards" }}
        >
          <p className="text-xs font-semibold text-ink-secondary mb-3 uppercase tracking-wider">
            Rapport de synchronisation — {syncReport.nouveau} nouvelle{syncReport.nouveau !== 1 ? "s" : ""} transaction{syncReport.nouveau !== 1 ? "s" : ""} sur {syncReport.total_fetched} récupérées
          </p>
          <div className="flex flex-wrap gap-3">
            <StatBadge label="Incluses auto" value={syncReport.inclus} color="bg-green-50 border-green-200 text-green-700" />
            <StatBadge label="Exclues auto" value={syncReport.exclu} color="bg-zinc-50 border-zinc-200 text-zinc-500" />
            <StatBadge label="En attente" value={syncReport.en_attente} color="bg-orange-50 border-orange-200 text-orange-600" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-surface-border w-fit"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {([
          {
            id: "pending" as const,
            label: "En attente",
            count: pendingTxs.length,
            countColor: pendingTxs.length > 0 ? "bg-orange-500" : undefined,
          },
          { id: "inclus" as const, label: "Incluses", count: inclusTxs.length },
          { id: "regles" as const, label: "Règles", count: rules.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-white shadow-soft text-brand-teal"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                tab.countColor
                  ? `${tab.countColor} text-white`
                  : "bg-surface-muted text-ink-secondary"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: En attente ── */}
      {activeTab === "pending" && (
        <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}>
          {pendingTxs.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-ink">Aucune transaction en attente</p>
              <p className="text-xs text-ink-secondary mt-1">Synchronisez pour importer les dernières transactions</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-surface-border">
                {pendingTxs.map((tx) => {
                  const isExpandedHere = expanded?.id === tx.id;
                  const isLoading = processing === tx.id;

                  return (
                    <div key={tx.id}>
                      {/* Main row */}
                      <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isExpandedHere ? "bg-surface-muted/50" : "hover:bg-surface-muted/30"}`}>
                        <div className="shrink-0 text-xs text-ink-muted font-mono w-16">
                          {fmtDate(tx.date)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{tx.libelle}</p>
                        </div>
                        <div className="shrink-0 text-sm font-bold text-ink tabular-nums font-mono">
                          {formatPrice(tx.montant)}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openExpand(tx, "inclure")}
                            disabled={isLoading}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              isExpandedHere && expanded?.action === "inclure"
                                ? "bg-green-600 text-white border-green-600"
                                : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            }`}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Inclure
                          </button>
                          <button
                            onClick={() => openExpand(tx, "exclure")}
                            disabled={isLoading}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              isExpandedHere && expanded?.action === "exclure"
                                ? "bg-red-600 text-white border-red-600"
                                : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                            }`}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Exclure
                          </button>
                        </div>
                      </div>

                      {/* Inline form */}
                      {isExpandedHere && expanded && (
                        <div className="px-4 pb-4 pt-2 bg-surface-muted/40 border-t border-surface-border">
                          {expanded.action === "inclure" ? (
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="label">Catégorie</label>
                                <select
                                  value={expanded.categorie}
                                  onChange={(e) => setExpanded((s) => s ? { ...s, categorie: e.target.value as ChargeCategory } : s)}
                                  className="input-field !py-1.5 !text-sm"
                                >
                                  {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{CHARGE_LABELS[c]}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex-1 min-w-[160px]">
                                <label className="label">Fournisseur</label>
                                <input
                                  type="text"
                                  value={expanded.fournisseur}
                                  onChange={(e) => setExpanded((s) => s ? { ...s, fournisseur: e.target.value } : s)}
                                  className="input-field !py-1.5 !text-sm"
                                  placeholder="Nom du fournisseur"
                                />
                              </div>
                              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer mb-1.5">
                                <input
                                  type="checkbox"
                                  checked={expanded.memoriser}
                                  onChange={(e) => setExpanded((s) => s ? { ...s, memoriser: e.target.checked } : s)}
                                  className="w-3.5 h-3.5 rounded accent-brand-teal"
                                />
                                Mémoriser pour la suite
                              </label>
                              <div className="flex gap-2 mb-0.5">
                                <button
                                  onClick={handleApprove}
                                  disabled={!!processing}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                                >
                                  {processing === tx.id ? (
                                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  )}
                                  Confirmer
                                </button>
                                <button
                                  onClick={() => setExpanded(null)}
                                  className="px-3 py-1.5 rounded-lg bg-surface-muted text-ink-secondary text-xs font-medium hover:bg-surface-border transition-colors"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={expanded.memoriser}
                                  onChange={(e) => setExpanded((s) => s ? { ...s, memoriser: e.target.checked } : s)}
                                  className="w-3.5 h-3.5 rounded accent-red-500"
                                />
                                Mémoriser cette exclusion pour la suite
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReject(tx.id, expanded.memoriser)}
                                  disabled={!!processing}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {processing === tx.id ? (
                                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                  )}
                                  Confirmer l&apos;exclusion
                                </button>
                                <button
                                  onClick={() => setExpanded(null)}
                                  className="px-3 py-1.5 rounded-lg bg-surface-muted text-ink-secondary text-xs font-medium hover:bg-surface-border transition-colors"
                                >
                                  Annuler
                                </button>
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

      {/* ── Tab: Incluses ── */}
      {activeTab === "inclus" && (
        <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}>
          {inclusTxs.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-sm text-ink-secondary">Aucune transaction incluse</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border bg-surface-muted/30">
                <p className="text-xs text-ink-secondary">
                  {inclusTxs.length} transaction{inclusTxs.length !== 1 ? "s" : ""} — total{" "}
                  <strong className="text-ink">{formatPrice(inclusTxs.reduce((s, t) => s + t.montant, 0))}</strong>
                </p>
              </div>
              <div className="divide-y divide-surface-border">
                {inclusTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/20 transition-colors group">
                    <div className="shrink-0 text-xs text-ink-muted font-mono w-16">{fmtDate(tx.date)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{tx.libelle}</p>
                      {tx.categorie && (
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {CHARGE_LABELS[tx.categorie as ChargeCategory] ?? tx.categorie}
                          {tx.auto_rule && <span className="ml-1.5 text-ink-muted/60">· {tx.auto_rule}</span>}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-sm font-bold text-ink tabular-nums font-mono">
                      {formatPrice(tx.montant)}
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                      incluse
                    </span>
                    <button
                      onClick={() => handleReject(tx.id, false)}
                      disabled={processing === tx.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-medium border border-red-200 hover:bg-red-100 transition-all disabled:opacity-40"
                      title="Exclure cette transaction"
                    >
                      Exclure
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Règles ── */}
      {activeTab === "regles" && (
        <div
          className="space-y-4"
          style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
        >
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
                  <div key={rule.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-surface-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-medium text-ink">
                        contient &quot;{rule.libelle_contains}&quot;
                      </p>
                      {rule.categorie && (
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          → {CHARGE_LABELS[rule.categorie as ChargeCategory] ?? rule.categorie}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      rule.action === "inclus"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {rule.action}
                    </span>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-50 transition-all"
                      title="Supprimer cette règle"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Default rules reference */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-3">Règles par défaut (non modifiables)</h3>
            <div className="space-y-1.5 text-xs text-ink-secondary">
              {[
                { label: "SGC SAINT MAUR", action: "inclus", cat: "Autre" },
                { label: "CARREFOUR ORMESSON", action: "inclus", cat: "Restauration autre" },
                { label: "LIDL CHENNEVIERES", action: "inclus", cat: "Restauration autre" },
                { label: "PANEM", action: "inclus", cat: "Restauration autre" },
                { label: "METRO (≥ 31/05/2026)", action: "inclus", cat: "Restauration Métro" },
                { label: "Virements reçus", action: "exclu", cat: null },
                { label: "NETFLIX / SPOTIFY / SFR…", action: "exclu", cat: null },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${r.action === "inclus" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {r.action}
                  </span>
                  <span className="font-mono">{r.label}</span>
                  {r.cat && <span className="text-ink-muted">→ {r.cat}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
