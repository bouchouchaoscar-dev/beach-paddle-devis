"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { getCaEntries, saveCaEntry, updateCaEntry, deleteCaEntry } from "@/lib/compta";
import { formatPrice } from "@/lib/calculations";
import { MOIS_FULL, MOIS_LABELS, SAISONS, type CaEntry } from "@/lib/compta-types";
import { NumericInput } from "@/components/ui/NumericInput";
import { DatePicker } from "@/components/ui/DatePicker";
import { useComptaSaison } from "../ComptaSaisonProvider";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const CHART_COLOR = "#0071E3";

// Custom tooltip for daily chart showing acompte detail
function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { acompte: number; solde: number } }[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const total = payload[0].value;
  const acompte = payload[0].payload.acompte ?? 0;
  const solde = payload[0].payload.solde ?? 0;
  return (
    <div style={{ background: "white", border: "1px solid #D2D2D7", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 16px -4px rgba(0,0,0,0.08)" }}>
      <p style={{ fontWeight: 700, color: "#1D1D1F" }}>Jour {label} — {formatPrice(total)}</p>
      {acompte > 0 && (
        <p style={{ color: "#0071E3", marginTop: 2 }}>dont acompte : {formatPrice(acompte)}</p>
      )}
      {solde > 0 && (
        <p style={{ color: "#16A34A", marginTop: 2 }}>dont solde : {formatPrice(solde)}</p>
      )}
    </div>
  );
}

export default function ChiffresPage() {
  const { saison, setSaison } = useComptaSaison();
  const [selectedMois, setSelectedMois] = useState(new Date().getMonth());
  const [entries, setEntries] = useState<CaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: today(),
    montant: "",
    notes: "",
    includeAcompte: false,
    acompteMontant: "",
    acompteClient: "",
    includeSolde: false,
    soldeMontant: "",
    soldeClient: "",
  });
  const [editingEntry, setEditingEntry] = useState<CaEntry | null>(null);
  const [editForm, setEditForm] = useState({ montant: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  const isAll = saison === "all";

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCaEntries(isAll ? undefined : saison);
    setEntries(data);
    setLoading(false);
  }, [saison, isAll]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const moisPad = String(selectedMois + 1).padStart(2, "0");
  const monthKey = saison !== "all" ? `${saison}-${moisPad}` : "";
  const monthEntries = entries.filter((e) => e.date.startsWith(monthKey));
  const monthTotal = monthEntries.reduce((s, e) => s + e.montant, 0);
  const saisonTotal = entries.reduce((s, e) => s + e.montant, 0);

  const sortedDesc = [...entries].sort((a, b) => b.montant - a.montant);
  const bestDay = sortedDesc[0] ?? null;

  const bestMonth = (() => {
    const byMonth: Record<string, number> = {};
    entries.forEach((e) => {
      const m = e.date.slice(0, 7);
      byMonth[m] = (byMonth[m] ?? 0) + e.montant;
    });
    const best = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
    return best ?? null;
  })();

  // CA entry (not acompte) for the selected date
  const todayCaEntry = entries.find((e) => e.date === form.date && e.source !== "acompte" && e.source !== "solde");

  // For "all" mode
  const byYear = SAISONS.reduce<Record<string, number>>((acc, yr) => {
    acc[yr] = entries.filter((e) => e.saison === yr).reduce((s, e) => s + e.montant, 0);
    return acc;
  }, {});
  const yearsWithCA = Object.entries(byYear).filter(([, v]) => v > 0);
  const bestYearEntry = [...yearsWithCA].sort((a, b) => b[1] - a[1])[0] ?? null;
  const avgPerYear = yearsWithCA.length > 0 ? saisonTotal / yearsWithCA.length : 0;
  const yearlyData = yearsWithCA
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([yr, ca]) => ({ label: yr, ca }));

  // Daily chart data: aggregate by day, track acompte portion
  const dailyData = (() => {
    const byDay: Record<number, { ca: number; acompte: number; solde: number }> = {};
    monthEntries.forEach((e) => {
      const day = parseInt(e.date.split("-")[2]);
      if (!byDay[day]) byDay[day] = { ca: 0, acompte: 0, solde: 0 };
      if (e.source === "acompte") byDay[day].acompte += e.montant;
      else if (e.source === "solde") byDay[day].solde += e.montant;
      else byDay[day].ca += e.montant;
    });
    return Object.entries(byDay)
      .map(([d, data]) => ({ day: parseInt(d), ca: data.ca + data.acompte + data.solde, acompte: data.acompte, solde: data.solde }))
      .sort((a, b) => a.day - b.day);
  })();

  const monthlyData = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
    const m = String(i + 1).padStart(2, "0");
    const sum = entries.filter((e) => e.date.startsWith(`${saison}-${m}`)).reduce((s, e) => s + e.montant, 0);
    return { label: MOIS_LABELS[i], ca: sum };
  });

  // Group monthly entries by date for display
  const monthEntriesByDate = (() => {
    const groups: Record<string, CaEntry[]> = {};
    [...monthEntries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((e) => {
        if (!groups[e.date]) groups[e.date] = [];
        groups[e.date].push(e);
      });
    return groups;
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSave() {
    const montant = parseFloat(form.montant);
    if (!form.date || isNaN(montant) || montant <= 0) return;
    setSaving(true);
    try {
      await saveCaEntry({
        date: form.date,
        montant,
        source: "manuel",
        notes: form.notes || undefined,
        saison: form.date.slice(0, 4),
        created_by: "",
      });
      if (form.includeAcompte) {
        const acompteMontant = parseFloat(form.acompteMontant);
        if (!isNaN(acompteMontant) && acompteMontant > 0) {
          await saveCaEntry({
            date: form.date,
            montant: acompteMontant,
            source: "acompte",
            notes: form.acompteClient || undefined,
            saison: form.date.slice(0, 4),
            created_by: "",
          });
        }
      }
      if (form.includeSolde) {
        const soldeMontant = parseFloat(form.soldeMontant);
        if (!isNaN(soldeMontant) && soldeMontant > 0) {
          await saveCaEntry({
            date: form.date,
            montant: soldeMontant,
            source: "solde",
            notes: form.soldeClient || undefined,
            saison: form.date.slice(0, 4),
            created_by: "",
          });
        }
      }
      setForm({ date: today(), montant: "", notes: "", includeAcompte: false, acompteMontant: "", acompteClient: "", includeSolde: false, soldeMontant: "", soldeClient: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCaEntry(id);
    await load();
  }

  function openEdit(e: CaEntry) {
    setEditingEntry(e);
    setEditForm({ montant: String(e.montant), notes: e.notes ?? "" });
  }

  async function handleUpdateEntry() {
    if (!editingEntry) return;
    const montant = parseFloat(editForm.montant);
    if (isNaN(montant) || montant <= 0) return;
    setEditSaving(true);
    try {
      await updateCaEntry(editingEntry.id, { montant, notes: editForm.notes || undefined });
      setEditingEntry(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  const fmtMonthKey = (mk: string) => {
    const [y, m] = mk.split("-");
    return `${MOIS_FULL[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s forwards" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Chiffre d&apos;affaires</h1>
          <p className="text-sm text-ink-secondary mt-0.5">Suivi quotidien des recettes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={saison}
            onChange={(e) => setSaison(e.target.value)}
            className="input-field !w-auto !py-1.5 !px-3 text-sm font-medium"
          >
            <option value="all">Toutes les saisons</option>
            {[...SAISONS].reverse().map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {(isAll
          ? [
              { label: "CA total depuis 2016", value: formatPrice(saisonTotal), color: "#0071E3" },
              { label: "Meilleure saison", value: bestYearEntry ? bestYearEntry[0] : "—", sub: bestYearEntry ? formatPrice(bestYearEntry[1]) : undefined, color: "#F59E0B" },
              { label: "CA moyen / saison", value: formatPrice(avgPerYear), color: "#16A34A" },
              { label: "Saisons actives", value: String(yearsWithCA.length), color: "#8B5CF6" },
            ]
          : [
              { label: `CA saison ${saison}`, value: formatPrice(saisonTotal), color: "#0071E3" },
              { label: `CA ${MOIS_FULL[selectedMois]}`, value: formatPrice(monthTotal), color: "#16A34A" },
              { label: "Meilleur jour", value: bestDay ? formatPrice(bestDay.montant) : "—", sub: bestDay ? fmtDate(bestDay.date) : undefined, color: "#F59E0B" },
              { label: "Meilleur mois", value: bestMonth ? formatPrice(bestMonth[1]) : "—", sub: bestMonth ? fmtMonthKey(bestMonth[0]) : undefined, color: "#8B5CF6" },
            ]
        ).map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-ink-muted font-medium mb-1">{kpi.label}</p>
            <p className="text-xl font-bold font-mono tracking-tight" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
            {kpi.sub && <p className="text-xs text-ink-muted mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Entry form + Monthly list ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
      >
        {/* Form */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Saisir une recette</h2>

          {todayCaEntry && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              CA déjà saisi ce jour : {formatPrice(todayCaEntry.montant)}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="label">Date</label>
              <DatePicker
                value={form.date}
                onChange={(d) => setForm((f) => ({ ...f, date: d }))}
                allowPast
              />
            </div>
            <div>
              <label className="label">CA du jour (€)</label>
              <div className="flex items-center gap-0">
                <button type="button" onClick={() => setForm((f) => ({ ...f, montant: String(Math.max(0, (parseFloat(f.montant) || 0) - 10)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <div className="relative flex-1">
                  <NumericInput
                    inputMode="decimal"
                    value={form.montant}
                    min={0}
                    step={10}
                    placeholder="0"
                    onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                    className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                </div>
                <button type="button" onClick={() => setForm((f) => ({ ...f, montant: String((parseFloat(f.montant) || 0) + 10) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>
            <div>
              <label className="label">Notes (optionnel)</label>
              <input
                type="text"
                value={form.notes}
                placeholder="Ex : journée anniversaire, météo…"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="input-field"
              />
            </div>

            {/* Acompte toggle */}
            <div className="border-t border-surface-border pt-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setForm((f) => ({ ...f, includeAcompte: !f.includeAcompte }))}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    form.includeAcompte ? "bg-blue-500" : "bg-surface-border"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    form.includeAcompte ? "translate-x-4" : "translate-x-0"
                  }`} />
                </div>
                <span className="text-sm font-medium text-ink">Inclure un acompte reçu</span>
              </label>

              {form.includeAcompte && (
                <div className="mt-3 space-y-2.5 pl-1">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="label">Montant acompte (€)</label>
                      <div className="flex items-center gap-0">
                        <button type="button" onClick={() => setForm((f) => ({ ...f, acompteMontant: String(Math.max(0, (parseFloat(f.acompteMontant) || 0) - 10)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <div className="relative flex-1">
                          <NumericInput
                            inputMode="decimal"
                            value={form.acompteMontant}
                            min={0}
                            step={10}
                            placeholder="0"
                            onChange={(e) => setForm((f) => ({ ...f, acompteMontant: e.target.value }))}
                            className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                        </div>
                        <button type="button" onClick={() => setForm((f) => ({ ...f, acompteMontant: String((parseFloat(f.acompteMontant) || 0) + 10) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="label">De qui</label>
                      <input
                        type="text"
                        value={form.acompteClient}
                        placeholder="Nom client / groupe"
                        onChange={(e) => setForm((f) => ({ ...f, acompteClient: e.target.value }))}
                        className="input-field"
                      />
                    </div>
                  </div>
                  {form.montant && form.acompteMontant && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs">
                      <span className="text-ink-secondary">Total du jour</span>
                      <span className="font-bold font-mono text-blue-600">
                        {formatPrice((parseFloat(form.montant) || 0) + (parseFloat(form.acompteMontant) || 0))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Solde reçu toggle */}
            <div className="border-t border-surface-border pt-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setForm((f) => ({ ...f, includeSolde: !f.includeSolde }))}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    form.includeSolde ? "bg-green-500" : "bg-surface-border"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    form.includeSolde ? "translate-x-4" : "translate-x-0"
                  }`} />
                </div>
                <span className="text-sm font-medium text-ink">Solde reçu (complément de paiement)</span>
              </label>

              {form.includeSolde && (
                <div className="mt-3 space-y-2.5 pl-1">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="label">Montant solde (€)</label>
                      <div className="flex items-center gap-0">
                        <button type="button" onClick={() => setForm((f) => ({ ...f, soldeMontant: String(Math.max(0, (parseFloat(f.soldeMontant) || 0) - 10)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <div className="relative flex-1">
                          <NumericInput
                            inputMode="decimal"
                            value={form.soldeMontant}
                            min={0}
                            step={10}
                            placeholder="0"
                            onChange={(e) => setForm((f) => ({ ...f, soldeMontant: e.target.value }))}
                            className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                        </div>
                        <button type="button" onClick={() => setForm((f) => ({ ...f, soldeMontant: String((parseFloat(f.soldeMontant) || 0) + 10) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="label">De qui</label>
                      <input
                        type="text"
                        value={form.soldeClient}
                        placeholder="Nom client / groupe"
                        onChange={(e) => setForm((f) => ({ ...f, soldeClient: e.target.value }))}
                        className="input-field"
                      />
                    </div>
                  </div>
                  {form.soldeMontant && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50 border border-green-100 text-xs">
                      <span className="text-ink-secondary">Solde à enregistrer</span>
                      <span className="font-bold font-mono text-green-600">
                        {formatPrice(parseFloat(form.soldeMontant) || 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.montant}
            className="btn-primary w-full"
          >
            {saving ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            )}
            Enregistrer
          </button>
        </div>

        {/* Monthly list / Per-year table */}
        {isAll ? (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink mb-4">CA par saison</h2>
            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-9 rounded-lg bg-surface-muted animate-pulse" />)}</div>
            ) : yearlyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm font-medium text-ink">Aucune donnée</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {[...yearlyData].reverse().map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-muted transition-colors">
                    <span className="text-sm font-semibold text-ink">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (row.ca / (bestYearEntry?.[1] ?? 1)) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold font-mono w-24 text-right" style={{ color: "#0071E3" }}>{formatPrice(row.ca)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 pt-3 mt-1 border-t border-surface-border">
                  <span className="text-xs font-semibold text-ink-secondary">Total cumulé</span>
                  <span className="text-base font-bold font-mono" style={{ color: "#0071E3" }}>{formatPrice(saisonTotal)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink">Détail mensuel</h2>
              <select
                value={selectedMois}
                onChange={(e) => setSelectedMois(parseInt(e.target.value))}
                className="input-field !w-auto !py-1 !px-2.5 text-xs"
              >
                {MOIS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-9 rounded-lg bg-surface-muted animate-pulse" />
                ))}
              </div>
            ) : Object.keys(monthEntriesByDate).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-teal-light flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <p className="text-sm font-medium text-ink">Aucune donnée</p>
                <p className="text-xs text-ink-muted mt-0.5">Saisir le CA journalier ci-contre</p>
              </div>
            ) : (
              <>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {Object.entries(monthEntriesByDate).map(([date, dayEntries]) => {
                    const dayTotal = dayEntries.reduce((s, e) => s + e.montant, 0);
                    const mainEntry = dayEntries.find((e) => e.source !== "acompte" && e.source !== "solde") ?? dayEntries[0];
                    const acompteEntries = dayEntries.filter((e) => e.source === "acompte");
                    const soldeEntries = dayEntries.filter((e) => e.source === "solde");
                    const AcompteBadges = ({ className }: { className?: string }) => (
                      <>
                        {acompteEntries.map((a) => (
                          <span
                            key={a.id}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0 ${className ?? ""}`}
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Acompte{a.notes ? ` ${a.notes}` : ""} {formatPrice(a.montant)}
                            <button
                              onClick={(ev) => { ev.stopPropagation(); handleDelete(a.id); }}
                              className="ml-0.5 leading-none hover:text-red-500 transition-colors"
                              title="Supprimer cet acompte"
                            >×</button>
                          </span>
                        ))}
                      </>
                    );
                    const SoldeBadges = ({ className }: { className?: string }) => (
                      <>
                        {soldeEntries.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-green-50 text-green-600 border border-green-100 flex-shrink-0 ${className ?? ""}`}
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Solde{s.notes ? ` ${s.notes}` : ""} {formatPrice(s.montant)}
                            <button
                              onClick={(ev) => { ev.stopPropagation(); handleDelete(s.id); }}
                              className="ml-0.5 leading-none hover:text-red-500 transition-colors"
                              title="Supprimer ce solde"
                            >×</button>
                          </span>
                        ))}
                      </>
                    );

                    return (
                      <div
                        key={date}
                        className="px-3 py-2 rounded-lg hover:bg-surface-muted group transition-colors"
                      >
                        {/* Single row: date + badges (desktop inline) + montant + buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-xs font-mono text-ink-muted w-14 flex-shrink-0">{fmtDate(date)}</span>
                            {mainEntry.source !== "acompte" && mainEntry.source !== "solde" && mainEntry.notes && (
                              <span className="text-xs text-ink-muted truncate max-w-[80px]" title={mainEntry.notes}>
                                {mainEntry.notes}
                              </span>
                            )}
                            {mainEntry.source === "import_excel" && (
                              <span className="badge text-[10px] bg-surface-muted text-ink-muted flex-shrink-0">Excel</span>
                            )}
                            {/* Badges inline — desktop only */}
                            {acompteEntries.length > 0 && <AcompteBadges className="hidden sm:inline-flex" />}
                            {soldeEntries.length > 0 && <SoldeBadges className="hidden sm:inline-flex" />}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-sm font-bold font-mono" style={{ color: "#0071E3" }}>
                              {formatPrice(dayTotal)}
                            </span>
                            <button
                              onClick={() => openEdit(mainEntry)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(mainEntry.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                          </div>
                        </div>
                        {/* Badges second line — mobile only */}
                        {(acompteEntries.length > 0 || soldeEntries.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-1 pl-14 sm:hidden">
                            <AcompteBadges />
                            <SoldeBadges />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-border">
                  <span className="text-xs font-medium text-ink-secondary">Total {MOIS_FULL[selectedMois]}</span>
                  <span className="text-base font-bold font-mono" style={{ color: "#16A34A" }}>
                    {formatPrice(monthTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <div
        className={`grid grid-cols-1 ${isAll ? "" : "lg:grid-cols-2"} gap-5`}
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards" }}
      >
        {isAll ? (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink mb-4">CA par saison — comparaison</h2>
            {yearlyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Pas de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yearlyData} margin={{ top: 4, right: 16, bottom: 24, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8E8E93" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} tickFormatter={(v) => `${v}€`} />
                  <Tooltip
                    formatter={(v) => [formatPrice(v as number), "CA"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D2D2D7", boxShadow: "0 4px 16px -4px rgba(0,0,0,0.08)" }}
                  />
                  <Bar dataKey="ca" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <>
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">
                CA journalier — {MOIS_FULL[selectedMois]} {saison}
              </h2>
              {dailyData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Pas de données pour ce mois</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyData} margin={{ top: 4, right: 16, bottom: 24, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8E8E93" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} tickFormatter={(v) => `${v}€`} />
                    <Tooltip content={<DailyTooltip />} />
                    <Line type="monotone" dataKey="ca" stroke={CHART_COLOR} strokeWidth={2} dot={{ r: 3, fill: CHART_COLOR }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">CA mensuel — Saison {saison}</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 16, bottom: 36, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8E8E93" }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} tickFormatter={(v) => `${v}€`} />
                  <Tooltip
                    formatter={(v) => [formatPrice(v as number), "CA"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D2D2D7", boxShadow: "0 4px 16px -4px rgba(0,0,0,0.08)" }}
                  />
                  <Bar dataKey="ca" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* ── Edit CA modal ── */}
      {editingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          onClick={() => setEditingEntry(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    {editingEntry.source === "solde" ? "Modifier le solde reçu" : editingEntry.source === "acompte" ? "Modifier l'acompte" : "Modifier la recette"}
                  </h3>
                  {editingEntry.source === "acompte" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                      Acompte
                    </span>
                  )}
                  {editingEntry.source === "solde" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-green-50 text-green-600 border border-green-100">
                      Solde
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted mt-0.5">{fmtDate(editingEntry.date)}</p>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <div className="flex items-center gap-0">
                <button type="button" onClick={() => setEditForm((f) => ({ ...f, montant: String(Math.max(0, (parseFloat(f.montant) || 0) - 1)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <div className="relative flex-1">
                  <NumericInput
                    inputMode="decimal"
                    value={editForm.montant}
                    min={0}
                    step={1}
                    autoFocus
                    onChange={(e) => setEditForm((f) => ({ ...f, montant: e.target.value }))}
                    className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                </div>
                <button type="button" onClick={() => setEditForm((f) => ({ ...f, montant: String((parseFloat(f.montant) || 0) + 1) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>
            <div>
              <label className="label">{editingEntry.source === "acompte" || editingEntry.source === "solde" ? "De qui (client / groupe)" : "Notes (optionnel)"}</label>
              <input
                type="text"
                value={editForm.notes}
                placeholder={editingEntry.source === "acompte" || editingEntry.source === "solde" ? "Nom client / groupe" : "Ex : journée anniversaire…"}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="input-field"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingEntry(null)} className="btn-secondary flex-1">
                Annuler
              </button>
              <button onClick={handleUpdateEntry} disabled={editSaving || !editForm.montant} className="btn-primary flex-1">
                {editSaving ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
