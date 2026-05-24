"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { getCaEntries, saveCaEntry, deleteCaEntry } from "@/lib/compta";
import { formatPrice } from "@/lib/calculations";
import { MOIS_FULL, MOIS_LABELS, CURRENT_SAISON, SAISONS, type CaEntry } from "@/lib/compta-types";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const CHART_COLOR = "#0071E3";
const CHART_GREEN = "#16A34A";

export default function ChiffresPage() {
  const [saison, setSaison] = useState(CURRENT_SAISON);
  const [selectedMois, setSelectedMois] = useState(new Date().getMonth());
  const [entries, setEntries] = useState<CaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; total: number } | null>(null);
  const [form, setForm] = useState({ date: today(), montant: "", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setImportDone(localStorage.getItem("bp_excel_imported") === "1");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCaEntries(saison);
    setEntries(data);
    setLoading(false);
  }, [saison]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const moisPad = String(selectedMois + 1).padStart(2, "0");
  const monthKey = `${saison}-${moisPad}`;
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

  const todayEntry = entries.find((e) => e.date === form.date);

  const dailyData = monthEntries
    .map((e) => ({ day: parseInt(e.date.split("-")[2]), ca: e.montant, id: e.id }))
    .sort((a, b) => a.day - b.day);

  const monthlyData = MOIS_LABELS.map((label, i) => {
    const m = String(i + 1).padStart(2, "0");
    const sum = entries.filter((e) => e.date.startsWith(`${saison}-${m}`)).reduce((s, e) => s + e.montant, 0);
    return { label, ca: sum };
  });

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
      setForm({ date: today(), montant: "", notes: "" });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCaEntry(id);
    await load();
  }

  async function handleImportExcel() {
    setImporting(true);
    try {
      const res = await fetch("/api/import-excel", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ inserted: data.inserted, total: data.total });
        localStorage.setItem("bp_excel_imported", "1");
        setImportDone(true);
        await load();
      }
    } finally {
      setImporting(false);
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
          {/* Saison */}
          <select
            value={saison}
            onChange={(e) => setSaison(e.target.value)}
            className="input-field !w-auto !py-1.5 !px-3 text-sm font-medium"
          >
            {[...SAISONS].reverse().map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {/* Import Excel */}
          {!importDone && (
            <button
              onClick={handleImportExcel}
              disabled={importing}
              className="btn-secondary gap-2 text-xs"
            >
              {importing ? (
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              )}
              Importer historique Excel
            </button>
          )}
          {importResult && (
            <span className="text-xs text-green-600 font-medium">
              {importResult.inserted} entrées importées
            </span>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {[
          { label: `CA saison ${saison}`, value: formatPrice(saisonTotal), color: "#0071E3" },
          { label: `CA ${MOIS_FULL[selectedMois]}`, value: formatPrice(monthTotal), color: "#16A34A" },
          { label: "Meilleur jour", value: bestDay ? formatPrice(bestDay.montant) : "—", sub: bestDay ? fmtDate(bestDay.date) : undefined, color: "#F59E0B" },
          { label: "Meilleur mois", value: bestMonth ? formatPrice(bestMonth[1]) : "—", sub: bestMonth ? fmtMonthKey(bestMonth[0]) : undefined, color: "#8B5CF6" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-ink-muted font-medium mb-1">{kpi.label}</p>
            <p className="text-xl font-bold font-mono tracking-tight" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
            {kpi.sub && <p className="text-xs text-ink-muted mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Entry + Monthly list ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
      >
        {/* Form */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Saisir une recette</h2>

          {todayEntry && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              CA déjà saisi ce jour : {formatPrice(todayEntry.montant)}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <input
                type="number"
                value={form.montant}
                min={0}
                step={0.5}
                placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                className="input-field font-mono"
              />
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

        {/* Monthly list */}
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
          ) : monthEntries.length === 0 ? (
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
                {monthEntries
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-muted group transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-ink-muted w-14">{fmtDate(e.date)}</span>
                        {e.notes && (
                          <span className="text-xs text-ink-muted truncate max-w-[100px]" title={e.notes}>
                            {e.notes}
                          </span>
                        )}
                        {e.source === "import_excel" && (
                          <span className="badge text-[10px] bg-surface-muted text-ink-muted">Excel</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono" style={{ color: "#0071E3" }}>
                          {formatPrice(e.montant)}
                        </span>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
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
      </div>

      {/* ── Charts ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards" }}
      >
        {/* Daily line */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">
            CA journalier — {MOIS_FULL[selectedMois]} {saison}
          </h2>
          {dailyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Pas de données pour ce mois</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8E8E93" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  formatter={(v) => [formatPrice(v as number), "CA"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D2D2D7", boxShadow: "0 4px 16px -4px rgba(0,0,0,0.08)" }}
                />
                <Line type="monotone" dataKey="ca" stroke={CHART_COLOR} strokeWidth={2} dot={{ r: 3, fill: CHART_COLOR }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly bars */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">CA mensuel — Saison {saison}</h2>
          {saisonTotal === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Pas de données pour cette saison</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
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
      </div>
    </div>
  );
}
