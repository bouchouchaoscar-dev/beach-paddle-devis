"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSuiviReference,
  upsertSuiviReference,
  getSuiviMouvements,
  addSuiviMouvement,
  updateSuiviMouvement,
  deleteSuiviMouvement,
} from "@/lib/suivi";
import { DatePicker } from "@/components/ui/DatePicker";
import { formatPrice } from "@/lib/calculations";
import type { SuiviReference, SuiviMouvement, MouvementType, MouvementCompte } from "@/lib/suivi-types";

// ── Toast ──────────────────────────────────────────────────────────────────

type ToastItem = { id: number; message: string; type: "success" | "error" };

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  function show(message: string, type: "success" | "error" = "success") {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  return { toasts, show };
}

// ── Helpers ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function parseMontant(s: string): number {
  return parseFloat(s.replace(",", "."));
}

// ── Icons (inline SVG) ─────────────────────────────────────────────────────

function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconX() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SuiviPage() {
  const { toasts, show } = useToast();
  const [reference, setReference] = useState<SuiviReference | null>(null);
  const [mouvements, setMouvements] = useState<SuiviMouvement[]>([]);
  const [loading, setLoading] = useState(true);

  // Reference editing
  const [editingRef, setEditingRef] = useState(false);
  const [refDraft, setRefDraft] = useState("");
  const [refNoteDraft, setRefNoteDraft] = useState("");
  const [savingRef, setSavingRef] = useState(false);

  // Add form
  const [form, setForm] = useState({
    date: todayStr(),
    type: "virement" as MouvementType,
    compte: "Qonto" as MouvementCompte,
    montant: "",
    note: "",
  });
  const [adding, setAdding] = useState(false);

  // Edit modal
  const [editingMvt, setEditingMvt] = useState<SuiviMouvement | null>(null);
  const [editDraft, setEditDraft] = useState({
    date: "",
    type: "virement" as MouvementType,
    compte: "Qonto" as MouvementCompte,
    montant: "",
    note: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [ref, mvts] = await Promise.all([getSuiviReference(), getSuiviMouvements()]);
    setReference(ref);
    setMouvements(mvts);
    setLoading(false);
  }, []);

  // Refetch silencieux des mouvements après mutation — pas de setLoading, tri serveur conservé
  const refetchMouvements = useCallback(async () => {
    const mvts = await getSuiviMouvements();
    setMouvements(mvts);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Computed ─────────────────────────────────────────────────────────────

  const totalDeduit = mouvements.reduce((s, m) => s + m.montant, 0);
  const partRestante = (reference?.montant ?? 0) - totalDeduit;

  // ── Reference ─────────────────────────────────────────────────────────────

  function startEditRef() {
    setRefDraft(reference ? String(reference.montant) : "");
    setRefNoteDraft(reference?.note ?? "");
    setEditingRef(true);
  }

  async function saveRef() {
    const val = parseMontant(refDraft);
    if (isNaN(val) || val < 0) { show("Montant invalide", "error"); return; }
    setSavingRef(true);
    const { error } = await upsertSuiviReference(val, refNoteDraft || null, reference?.id);
    if (error) { show(error, "error"); } else { await load(); setEditingRef(false); show("Montant de référence mis à jour"); }
    setSavingRef(false);
  }

  // ── Add mouvement ──────────────────────────────────────────────────────────

  async function handleAdd() {
    const val = parseMontant(form.montant);
    if (isNaN(val) || val <= 0) { show("Montant invalide", "error"); return; }
    setAdding(true);
    const { error } = await addSuiviMouvement(form.date, form.type, form.compte, val, form.note || null);
    if (error) { show(error, "error"); } else {
      setForm({ date: todayStr(), type: "virement", compte: "Qonto", montant: "", note: "" });
      await refetchMouvements();
      show("Mouvement ajouté");
    }
    setAdding(false);
  }

  // ── Edit mouvement ────────────────────────────────────────────────────────

  function startEditMvt(mvt: SuiviMouvement) {
    setEditingMvt(mvt);
    setEditDraft({ date: mvt.date, type: mvt.type, compte: mvt.compte, montant: String(mvt.montant), note: mvt.note ?? "" });
  }

  async function saveEditMvt() {
    if (!editingMvt) return;
    const val = parseMontant(editDraft.montant);
    if (isNaN(val) || val <= 0) { show("Montant invalide", "error"); return; }
    setSavingEdit(true);
    const { error } = await updateSuiviMouvement(editingMvt.id, editDraft.date, editDraft.type, editDraft.compte, val, editDraft.note || null);
    if (error) { show(error, "error"); } else { setEditingMvt(null); await refetchMouvements(); show("Mouvement mis à jour"); }
    setSavingEdit(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deletingId) return;
    const { error } = await deleteSuiviMouvement(deletingId);
    if (error) { show(error, "error"); } else { await refetchMouvements(); show("Mouvement supprimé"); }
    setDeletingId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl shadow-elevated text-sm font-medium text-white transition-all duration-300 ${
              t.type === "error" ? "bg-red-500" : "bg-green-600"
            }`}
            style={{ animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s forwards" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Suivi</h1>
          <p className="text-sm text-ink-secondary mt-0.5">Part personnelle — virements et paiements carte</p>
        </div>
      </div>

      {/* KPIs */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {/* Référence */}
        <div className="card p-4">
          <p className="text-xs text-ink-muted font-medium mb-1">Montant de référence</p>
          {editingRef ? (
            <div className="space-y-2 mt-1">
              <input
                type="text"
                inputMode="decimal"
                value={refDraft}
                onChange={(e) => setRefDraft(e.target.value)}
                placeholder="0"
                className="input-field !py-1.5 !text-base font-mono font-bold"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveRef(); if (e.key === "Escape") setEditingRef(false); }}
              />
              <input
                type="text"
                value={refNoteDraft}
                onChange={(e) => setRefNoteDraft(e.target.value)}
                placeholder="Note (optionnel)"
                className="input-field !py-1.5 !text-xs"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={saveRef}
                  disabled={savingRef}
                  className="btn-primary flex-1 py-1.5 text-xs justify-center gap-1"
                >
                  <IconCheck /> Enregistrer
                </button>
                <button
                  onClick={() => setEditingRef(false)}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  <IconX />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                {loading ? (
                  <span className="inline-block w-28 h-7 rounded-lg bg-surface-muted animate-pulse" />
                ) : reference ? (
                  <>
                    <p className="text-xl font-bold font-mono tracking-tight" style={{ color: "#0071E3" }}>
                      {formatPrice(reference.montant)}
                    </p>
                    {reference.note && (
                      <p className="text-xs text-ink-muted mt-0.5">{reference.note}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink-muted italic">Non défini</p>
                )}
              </div>
              <button
                onClick={startEditRef}
                className="btn-ghost p-1.5 shrink-0 text-ink-muted hover:text-ink"
                title="Modifier le montant de référence"
              >
                <IconPencil />
              </button>
            </div>
          )}
        </div>

        {/* Total déduit */}
        <div className="card p-4">
          <p className="text-xs text-ink-muted font-medium mb-1">Total déduit</p>
          {loading ? (
            <span className="inline-block w-24 h-7 rounded-lg bg-surface-muted animate-pulse" />
          ) : (
            <p className="text-xl font-bold font-mono tracking-tight" style={{ color: "#E03131" }}>
              {formatPrice(totalDeduit)}
            </p>
          )}
          {!loading && mouvements.length > 0 && (
            <p className="text-xs text-ink-muted mt-0.5">{mouvements.length} mouvement{mouvements.length > 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Part restante */}
        <div
          className="card p-4"
          style={{ borderLeft: `3px solid ${partRestante >= 0 ? "#16A34A" : "#E03131"}` }}
        >
          <p className="text-xs text-ink-muted font-medium mb-1">Part restante</p>
          {loading ? (
            <span className="inline-block w-28 h-7 rounded-lg bg-surface-muted animate-pulse" />
          ) : (
            <p
              className="text-2xl font-bold font-mono tracking-tight"
              style={{ color: partRestante >= 0 ? "#16A34A" : "#E03131" }}
            >
              {formatPrice(partRestante)}
            </p>
          )}
          {!loading && reference && (
            <p className="text-xs text-ink-muted mt-0.5">
              {reference.montant > 0
                ? `${((partRestante / reference.montant) * 100).toFixed(0)}% restant`
                : ""}
            </p>
          )}
        </div>
      </div>

      {/* Empty state — no reference */}
      {!loading && !reference && (
        <div
          className="card p-8 flex flex-col items-center text-center gap-3"
          style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(124,58,237,0.08)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
              <polyline points="16 17 22 17 22 11"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Pas encore de montant de référence</p>
            <p className="text-xs text-ink-muted mt-1">Clique sur le crayon dans la carte ci-dessus pour définir ton montant de départ.</p>
          </div>
          <button onClick={startEditRef} className="btn-primary text-xs mt-1">
            Définir le montant de référence
          </button>
        </div>
      )}

      {/* Add form */}
      <div
        className="card p-5 space-y-4"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards", position: "relative", zIndex: 10 }}
      >
        <h2 className="text-sm font-semibold text-ink">Ajouter un mouvement</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Date */}
          <div>
            <label className="text-xs font-medium text-ink-muted block mb-1">Date</label>
            <DatePicker
              value={form.date}
              onChange={(v) => setForm((p) => ({ ...p, date: v }))}
              allowPast
            />
          </div>

          {/* Montant */}
          <div>
            <label className="text-xs font-medium text-ink-muted block mb-1">Montant (€)</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost px-2.5 py-2 text-base font-bold leading-none shrink-0"
                onClick={() => {
                  const v = parseMontant(form.montant);
                  if (!isNaN(v) && v > 1) setForm((p) => ({ ...p, montant: String(Math.round((v - 1) * 100) / 100) }));
                }}
              >−</button>
              <input
                type="text"
                inputMode="decimal"
                value={form.montant}
                onChange={(e) => setForm((p) => ({ ...p, montant: e.target.value }))}
                placeholder="0,00"
                className="input-field text-center font-mono font-semibold flex-1 min-w-0"
              />
              <button
                type="button"
                className="btn-ghost px-2.5 py-2 text-base font-bold leading-none shrink-0"
                onClick={() => {
                  const v = parseMontant(form.montant);
                  setForm((p) => ({ ...p, montant: String(Math.round((!isNaN(v) ? v + 1 : 1) * 100) / 100) }));
                }}
              >+</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-ink-muted block mb-1">Type</label>
            <div className="flex rounded-lg overflow-hidden border border-surface-border">
              {(["virement", "carte"] as MouvementType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, type: t }))}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    form.type === t
                      ? "bg-brand-teal text-white"
                      : "bg-white text-ink-secondary hover:bg-surface-muted"
                  }`}
                  style={form.type === t ? { backgroundColor: "#7C3AED" } : undefined}
                >
                  {t === "virement" ? "Virement" : "Paiement carte"}
                </button>
              ))}
            </div>
          </div>

          {/* Compte */}
          <div>
            <label className="text-xs font-medium text-ink-muted block mb-1">Compte</label>
            <div className="flex rounded-lg overflow-hidden border border-surface-border">
              {(["Qonto", "SumUp"] as MouvementCompte[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, compte: c }))}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    form.compte === c
                      ? "text-white"
                      : "bg-white text-ink-secondary hover:bg-surface-muted"
                  }`}
                  style={form.compte === c ? { backgroundColor: "#0071E3" } : undefined}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="text-xs font-medium text-ink-muted block mb-1">Note <span className="font-normal">(optionnel)</span></label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            placeholder="Description du mouvement…"
            className="input-field"
          />
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !form.montant}
          className="btn-primary w-full justify-center py-2.5"
          style={adding ? undefined : { backgroundColor: "#7C3AED" }}
        >
          {adding ? (
            <>
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Ajout…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Ajouter
            </>
          )}
        </button>
      </div>

      {/* Mouvements list */}
      <div
        className="space-y-2"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards" }}
      >
        <h2 className="text-sm font-semibold text-ink px-1">Mouvements ({mouvements.length})</h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 w-32 rounded bg-surface-muted mb-2" />
                <div className="h-3 w-48 rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        ) : mouvements.length === 0 ? (
          <div className="card p-6 flex items-center justify-center text-sm text-ink-muted">
            Aucun mouvement enregistré
          </div>
        ) : (
          <div className="space-y-2">
            {mouvements.map((mvt) => (
              <div
                key={mvt.id}
                className="card p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-ink font-mono">{formatDate(mvt.date)}</span>
                    {/* Type badge */}
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: mvt.type === "virement" ? "#7C3AED" : "#0071E3" }}
                    >
                      {mvt.type === "virement" ? "Virement" : "Carte"}
                    </span>
                    {/* Compte badge */}
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: mvt.compte === "Qonto" ? "rgba(0,113,227,0.1)" : "rgba(22,163,74,0.1)",
                        color: mvt.compte === "Qonto" ? "#0071E3" : "#16A34A",
                      }}
                    >
                      {mvt.compte}
                    </span>
                  </div>
                  {mvt.note && (
                    <p className="text-xs text-ink-muted truncate">{mvt.note}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold font-mono" style={{ color: "#E03131" }}>
                    −{formatPrice(mvt.montant)}
                  </span>
                  <button
                    onClick={() => startEditMvt(mvt)}
                    className="btn-ghost p-1.5 text-ink-muted hover:text-ink"
                    title="Modifier"
                  >
                    <IconPencil />
                  </button>
                  <button
                    onClick={() => setDeletingId(mvt.id)}
                    className="btn-ghost p-1.5 text-ink-muted hover:text-red-500"
                    title="Supprimer"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingMvt && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingMvt(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-elevated w-full max-w-md p-5 space-y-4"
            style={{ animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards", position: "relative", zIndex: 1 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Modifier le mouvement</h3>
              <button onClick={() => setEditingMvt(null)} className="btn-ghost p-1.5 text-ink-muted">
                <IconX />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-muted block mb-1">Date</label>
                <DatePicker
                  value={editDraft.date}
                  onChange={(v) => setEditDraft((p) => ({ ...p, date: v }))}
                  allowPast
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted block mb-1">Montant (€)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDraft.montant}
                  onChange={(e) => setEditDraft((p) => ({ ...p, montant: e.target.value }))}
                  className="input-field font-mono font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-muted block mb-1">Type</label>
                <div className="flex rounded-lg overflow-hidden border border-surface-border">
                  {(["virement", "carte"] as MouvementType[]).map((t) => (
                    <button key={t} type="button"
                      onClick={() => setEditDraft((p) => ({ ...p, type: t }))}
                      className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${editDraft.type === t ? "text-white" : "bg-white text-ink-secondary hover:bg-surface-muted"}`}
                      style={editDraft.type === t ? { backgroundColor: "#7C3AED" } : undefined}
                    >
                      {t === "virement" ? "Virement" : "Carte"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted block mb-1">Compte</label>
                <div className="flex rounded-lg overflow-hidden border border-surface-border">
                  {(["Qonto", "SumUp"] as MouvementCompte[]).map((c) => (
                    <button key={c} type="button"
                      onClick={() => setEditDraft((p) => ({ ...p, compte: c }))}
                      className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${editDraft.compte === c ? "text-white" : "bg-white text-ink-secondary hover:bg-surface-muted"}`}
                      style={editDraft.compte === c ? { backgroundColor: "#0071E3" } : undefined}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted block mb-1">Note</label>
              <input
                type="text"
                value={editDraft.note}
                onChange={(e) => setEditDraft((p) => ({ ...p, note: e.target.value }))}
                placeholder="Description…"
                className="input-field"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingMvt(null)} className="btn-ghost flex-1 justify-center py-2 text-xs">
                Annuler
              </button>
              <button
                onClick={saveEditMvt}
                disabled={savingEdit}
                className="btn-primary flex-1 justify-center py-2 text-xs"
                style={{ backgroundColor: "#7C3AED" }}
              >
                {savingEdit ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeletingId(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-elevated w-full max-w-sm p-5 space-y-4"
            style={{ animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <h3 className="text-sm font-bold text-ink">Supprimer ce mouvement ?</h3>
            <p className="text-xs text-ink-secondary">Cette action est irréversible.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)} className="btn-ghost flex-1 justify-center py-2 text-xs">
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 justify-center py-2 text-xs font-semibold rounded-lg text-white transition-colors"
                style={{ backgroundColor: "#E03131" }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
