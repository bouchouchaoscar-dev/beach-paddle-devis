"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart, Bar, Line, BarChart,
  PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { getCaEntries, getCharges, getImmobilisations } from "@/lib/compta";
import { formatPrice } from "@/lib/calculations";
import {
  MOIS_LABELS, SAISONS,
  CHARGE_LABELS, CHARGE_COLORS,
  type CaEntry, type Charge, type ChargeCategory,
  type Immobilisation,
  getDotationForYear, getVncTotal, getMonthlyDotation,
} from "@/lib/compta-types";
import { useComptaSaison } from "../ComptaSaisonProvider";

const CATEGORIES = Object.keys(CHARGE_LABELS) as ChargeCategory[];

export default function AnalysePage() {
  const { saison, setSaison } = useComptaSaison();
  const [caEntries, setCaEntries] = useState<CaEntry[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [immobilisations, setImmobilisations] = useState<Immobilisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsFetched, setInsightsFetched] = useState(false);

  const isAll = saison === "all";

  const load = useCallback(async () => {
    setLoading(true);
    setInsightsFetched(false);
    const [ca, ch, immo] = await Promise.all([
      getCaEntries(isAll ? undefined : saison),
      getCharges(isAll ? undefined : saison),
      getImmobilisations(),
    ]);
    setCaEntries(ca);
    setCharges(ch);
    setImmobilisations(immo);
    setLoading(false);
  }, [saison, isAll]);

  useEffect(() => { load(); }, [load]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const totalCA = caEntries.reduce((s, e) => s + e.montant, 0);
  const totalChargesExploitation = charges.reduce((s, c) => s + c.montant, 0);
  const currentYear = isAll ? new Date().getFullYear() : parseInt(saison);
  const totalDotations = immobilisations.filter((i) => i.actif).reduce((s, i) => {
    if (isAll) {
      const maxYear = new Date().getFullYear();
      const startYear = parseInt(i.annee_achat);
      let d = 0;
      for (let y = startYear; y <= maxYear; y++) d += getDotationForYear(i, y);
      return s + d;
    }
    return s + getDotationForYear(i, currentYear);
  }, 0);
  const totalCharges = totalChargesExploitation + totalDotations;
  const vncTotal = getVncTotal(immobilisations, isAll ? undefined : parseInt(saison));
  const resultat = totalCA - totalCharges;
  const marge = totalCA > 0 ? (resultat / totalCA) * 100 : 0;

  const joursOuverts = caEntries.filter((e) => e.montant > 0 && e.source !== "acompte" && e.source !== "solde").length;
  const caMoyen = joursOuverts > 0 ? totalCA / joursOuverts : 0;

  // Monthly CA vs Charges (single season) / Yearly (all seasons)
  const monthlyCAvsCharges = isAll
    ? SAISONS.map((yr) => {
        const ca = caEntries.filter((e) => e.saison === yr).reduce((s, e) => s + e.montant, 0);
        const chExp = charges.filter((c) => c.saison === yr).reduce((s, c) => s + c.montant, 0);
        const dot = immobilisations.filter((i) => i.actif).reduce((s, i) => s + getDotationForYear(i, parseInt(yr)), 0);
        const ch = chExp + dot;
        const res = ca - ch;
        return { label: yr, ca, charges: ch, resultat: res };
      }).filter((r) => r.ca > 0 || r.charges > 0)
    : MOIS_LABELS.map((label, i) => {
        const month = i + 1;
        const m = String(month).padStart(2, "0");
        const prefix = `${saison}-${m}`;
        const ca = caEntries.filter((e) => e.date.startsWith(prefix)).reduce((s, e) => s + e.montant, 0);
        const chExp = charges.filter((c) => c.date.startsWith(prefix)).reduce((s, c) => s + c.montant, 0);
        const dotMonth = immobilisations
          .filter((ii) => ii.actif)
          .reduce((s, immo) => s + getMonthlyDotation(immo, parseInt(saison), month), 0);
        const ch = Math.round((chExp + dotMonth) * 100) / 100;
        const res = ca - ch;
        return { label, ca, charges: ch, resultat: res };
      }).filter((m) => m.ca > 0 || m.charges > 0);

  // Multi-season CA comparison (always show last 4 for the monthly chart)
  const recentSaisons = SAISONS.slice(-4);
  const multiSeasonData = MOIS_LABELS.map((label, i) => {
    const m = String(i + 1).padStart(2, "0");
    const row: Record<string, string | number> = { label };
    recentSaisons.forEach((s) => {
      const sum = caEntries.filter((e) => e.saison === s && e.date.slice(5, 7) === m).reduce((acc, e) => acc + e.montant, 0);
      row[s] = sum;
    });
    return row;
  }).filter((r) => recentSaisons.some((s) => (r[s] as number) > 0));

  // Charges by category — dotations fusionnées dans Équipement
  const chargesByCat = CATEGORIES.map((cat) => ({
    name: CHARGE_LABELS[cat],
    value: charges.filter((c) => c.categorie === cat).reduce((s, c) => s + c.montant, 0)
      + (cat === "equipement" ? totalDotations : 0),
    color: CHARGE_COLORS[cat],
  })).filter((c) => c.value > 0);

  // Top 5 best days
  const top5Days = [...caEntries]
    .sort((a, b) => b.montant - a.montant)
    .slice(0, 5)
    .map((e) => ({
      label: new Date(e.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }),
      ca: e.montant,
    }));

  // ── AI Insights ────────────────────────────────────────────────────────────

  async function fetchInsights() {
    setInsightsLoading(true);
    try {
      const payload = {
        saison,
        totalCA,
        totalCharges,
        resultat,
        marge: parseFloat(marge.toFixed(1)),
        joursOuverts,
        caMoyen: parseFloat(caMoyen.toFixed(0)),
        monthlyCA: MOIS_LABELS.map((label, i) => {
          const m = String(i + 1).padStart(2, "0");
          const ca = caEntries.filter((e) => e.date.startsWith(`${saison}-${m}`)).reduce((s, e) => s + e.montant, 0);
          return { mois: label, ca };
        }).filter((m) => m.ca > 0),
        chargesByCategory: chargesByCat.map((c) => ({ categorie: c.name, montant: c.value })),
        top5Days,
      };

      const res = await fetch("/api/analyse-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setInsights(Array.isArray(data.insights) ? data.insights : []);
      setInsightsFetched(true);
    } catch {
      setInsights(["Impossible de générer les insights — vérifier la clé API Anthropic."]);
      setInsightsFetched(true);
    } finally {
      setInsightsLoading(false);
    }
  }

  const seasonColors: Record<string, string> = {
    [SAISONS[SAISONS.length - 1]]: "#0071E3",
    [SAISONS[SAISONS.length - 2]]: "#16A34A",
    [SAISONS[SAISONS.length - 3]]: "#F59E0B",
    [SAISONS[SAISONS.length - 4]]: "#D1D1D6",
  };

  const CustomTooltipPie = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-surface-border rounded-xl px-3 py-2 shadow-elevated text-xs">
        <p className="font-semibold text-ink">{payload[0].name}</p>
        <p className="font-mono text-ink-secondary">{formatPrice(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s forwards" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Analyse</h1>
          <p className="text-sm text-ink-secondary mt-0.5">Tableaux de bord et insights IA</p>
        </div>
        <select
          value={saison}
          onChange={(e) => setSaison(e.target.value)}
          className="input-field !w-auto !py-1.5 !px-3 text-sm font-medium"
        >
          <option value="all">Toutes les saisons</option>
          {[...SAISONS].reverse().map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ── KPIs ── */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {[
          { label: isAll ? "CA total depuis 2016" : "CA saison", value: formatPrice(totalCA), color: "#0071E3" },
          { label: "Charges", value: formatPrice(totalCharges), color: "#E03131" },
          { label: "Résultat net", value: formatPrice(resultat), color: resultat >= 0 ? "#16A34A" : "#E03131" },
          { label: "Marge", value: `${marge.toFixed(1)}%`, color: marge >= 20 ? "#16A34A" : marge >= 5 ? "#F59E0B" : "#E03131" },
          { label: isAll ? "Saisons actives" : "Jours ouverts", value: isAll ? String(monthlyCAvsCharges.length) : String(joursOuverts), color: "#8B5CF6" },
          { label: isAll ? "CA moyen / saison" : "CA / jour ouvert", value: formatPrice(isAll && monthlyCAvsCharges.length > 0 ? totalCA / monthlyCAvsCharges.length : caMoyen), color: "#0071E3" },
          { label: "VNC parc matériel", value: formatPrice(vncTotal), color: "#F59E0B" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-[11px] text-ink-muted font-medium mb-1 leading-tight">{kpi.label}</p>
            <p className="text-lg font-bold font-mono tracking-tight" style={{ color: kpi.color }}>
              {loading ? <span className="inline-block w-16 h-5 rounded-md bg-surface-muted animate-pulse" /> : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Charts row 1 ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
      >
        {/* CA vs Charges */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">{isAll ? "CA vs Charges — par saison" : `CA vs Charges — ${saison}`}</h2>
          {monthlyCAvsCharges.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Pas de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={monthlyCAvsCharges} margin={{ top: 4, right: 16, bottom: 24, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8E8E93" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  formatter={(v, name) => [formatPrice(v as number), name === "ca" ? "CA" : name === "charges" ? "Charges" : "Résultat"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D2D2D7" }}
                />
                <Legend formatter={(v) => v === "ca" ? "CA" : v === "charges" ? "Charges" : "Résultat"} iconSize={10} />
                <Bar dataKey="ca" fill="#0071E3" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="charges" fill="#E03131" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Line type="monotone" dataKey="resultat" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Multi-season comparison */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Comparaison CA par saison</h2>
          {multiSeasonData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Pas de données historiques</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={multiSeasonData} margin={{ top: 4, right: 16, bottom: 24, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8E8E93" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8E8E93" }} tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  formatter={(v, name) => [formatPrice(v as number), `Saison ${name}`]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D2D2D7" }}
                />
                <Legend formatter={(v) => `Saison ${v}`} iconSize={10} />
                {recentSaisons.map((s) => (
                  <Bar key={s} dataKey={s} fill={seasonColors[s] ?? "#D1D1D6"} radius={[3, 3, 0, 0]} opacity={0.85} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards" }}
      >
        {/* Charges breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Répartition des charges</h2>
          {chargesByCat.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Aucune charge</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={180}>
                <PieChart>
                  <Pie data={chargesByCat} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                    {chargesByCat.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltipPie />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {chargesByCat.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-ink-secondary flex-1 truncate">{c.name}</span>
                    <span className="font-mono font-semibold text-ink">{formatPrice(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top 5 days */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Top 5 meilleures journées</h2>
          {top5Days.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-ink-muted">Pas de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={top5Days} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8E8E93" }} tickFormatter={(v) => `${v}€`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#8E8E93" }} width={92} />
                <Tooltip
                  formatter={(v) => [formatPrice(v as number), "CA"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D2D2D7" }}
                />
                <Bar dataKey="ca" fill="#0071E3" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── AI Insights ── */}
      <div
        className="card p-5"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.25s forwards" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-teal-light flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-ink">Insights IA</h2>
          </div>
          <button
            onClick={fetchInsights}
            disabled={insightsLoading || loading}
            className="btn-secondary gap-2 text-xs"
            style={{ borderColor: "#0071E3", color: insightsLoading ? undefined : "#0071E3" }}
          >
            {insightsLoading ? (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.9"/></svg>
            )}
            {insightsFetched ? "Rafraîchir l'analyse" : "Générer l'analyse"}
          </button>
        </div>

        {insightsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-5 rounded-md bg-surface-muted animate-pulse" style={{ width: `${70 + Math.random() * 25}%` }} />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-brand-teal-light flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">Analyse non générée</p>
            <p className="text-xs text-ink-muted mt-0.5">Cliquer sur &quot;Générer l&apos;analyse&quot; pour obtenir des insights personnalisés</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold shrink-0 mt-0.5"
                  style={{ backgroundColor: "#0071E3", minWidth: "1.25rem" }}
                >
                  {i + 1}
                </span>
                <p className="text-sm text-ink leading-relaxed">{insight}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
