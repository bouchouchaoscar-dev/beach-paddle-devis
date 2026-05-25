"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";
import { getCaEntries, getCharges } from "@/lib/compta";
import { formatPrice } from "@/lib/calculations";
import {
  CURRENT_SAISON, MOIS_LABELS, SAISONS,
  CHARGE_LABELS, CHARGE_COLORS,
  type CaEntry, type Charge, type ChargeCategory,
} from "@/lib/compta-types";

const CATEGORIES = Object.keys(CHARGE_LABELS) as ChargeCategory[];

export default function ResultatPage() {
  const [saison, setSaison] = useState(CURRENT_SAISON);
  const [caEntries, setCaEntries] = useState<CaEntry[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);

  const isAll = saison === "all";

  const load = useCallback(async () => {
    setLoading(true);
    const [ca, ch] = await Promise.all([
      getCaEntries(isAll ? undefined : saison),
      getCharges(isAll ? undefined : saison),
    ]);
    setCaEntries(ca);
    setCharges(ch);
    setLoading(false);
  }, [saison, isAll]);

  useEffect(() => { load(); }, [load]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const totalCA = caEntries.reduce((s, e) => s + e.montant, 0);
  const totalCharges = charges.reduce((s, c) => s + c.montant, 0);
  const resultat = totalCA - totalCharges;
  const marge = totalCA > 0 ? (resultat / totalCA) * 100 : 0;

  const chargesByCategory = CATEGORIES.map((cat) => ({
    name: CHARGE_LABELS[cat],
    value: charges.filter((c) => c.categorie === cat).reduce((s, c) => s + c.montant, 0),
    color: CHARGE_COLORS[cat],
  })).filter((c) => c.value > 0);

  const monthlyData = MOIS_LABELS.map((label, i) => {
    const m = String(i + 1).padStart(2, "0");
    const prefix = `${saison}-${m}`;
    const ca = caEntries.filter((e) => e.date.startsWith(prefix)).reduce((s, e) => s + e.montant, 0);
    const ch = charges.filter((c) => c.date.startsWith(prefix)).reduce((s, c) => s + c.montant, 0);
    const res = ca - ch;
    const mg = ca > 0 ? (res / ca) * 100 : null;
    return { label, ca, charges: ch, resultat: res, marge: mg };
  }).filter((m) => m.ca > 0 || m.charges > 0);

  // For "all" mode: per-season table
  const perSeasonData = SAISONS.map((yr) => {
    const ca = caEntries.filter((e) => e.saison === yr).reduce((s, e) => s + e.montant, 0);
    const ch = charges.filter((c) => c.saison === yr).reduce((s, c) => s + c.montant, 0);
    const res = ca - ch;
    const mg = ca > 0 ? (res / ca) * 100 : null;
    return { yr, ca, charges: ch, resultat: res, marge: mg };
  }).filter((r) => r.ca > 0 || r.charges > 0).reverse();

  const margeColor = (m: number | null) => {
    if (m === null) return "text-ink-muted";
    if (m >= 30) return "text-green-600";
    if (m >= 10) return "text-amber-600";
    return "text-brand-red";
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-surface-border rounded-xl px-3 py-2 shadow-elevated text-xs">
        <p className="font-semibold text-ink">{payload[0].name}</p>
        <p className="text-ink-secondary font-mono">{formatPrice(payload[0].value)}</p>
        <p className="text-ink-muted">{totalCharges > 0 ? ((payload[0].value / totalCharges) * 100).toFixed(1) : 0}%</p>
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
          <h1 className="text-2xl font-bold tracking-tight text-ink">Résultat</h1>
          <p className="text-sm text-ink-secondary mt-0.5">Compte de résultat simplifié</p>
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
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {[
          { label: "Chiffre d'affaires", value: formatPrice(totalCA), color: "#0071E3", icon: "M22 12 18 12 15 21 9 3 6 12 2 12" },
          { label: "Charges totales", value: formatPrice(totalCharges), color: "#E03131", icon: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" },
          { label: "Résultat net", value: formatPrice(resultat), color: resultat >= 0 ? "#16A34A" : "#E03131", icon: "M12 1 12 23M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
          { label: "Marge nette", value: `${marge.toFixed(1)}%`, color: marge >= 20 ? "#16A34A" : marge >= 5 ? "#F59E0B" : "#E03131", icon: "M18 20V10M12 20V4M6 20v-6" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-ink-muted font-medium mb-1">{kpi.label}</p>
            <p className="text-xl font-bold font-mono tracking-tight" style={{ color: kpi.color }}>
              {loading ? <span className="inline-block w-20 h-6 rounded-lg bg-surface-muted animate-pulse" /> : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Chart + Table ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-5 gap-5"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}
      >
        {/* Pie chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink mb-4">Répartition des charges</h2>
          {chargesByCategory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-sm text-ink-muted">Aucune charge enregistrée</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chargesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chargesByCategory.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {chargesByCategory.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-ink-secondary">{c.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-ink">{formatPrice(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Monthly table / Per-season table */}
        <div className="card p-5 lg:col-span-3 overflow-x-auto">
          <h2 className="text-sm font-semibold text-ink mb-4">
            {isAll ? "Tableau par saison — toutes les années" : `Tableau mensuel — Saison ${saison}`}
          </h2>
          {(isAll ? perSeasonData : monthlyData).length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-ink-muted">
              Aucune donnée
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  {[isAll ? "Saison" : "Mois", "CA", "Charges", "Résultat", "Marge"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-ink-muted pb-2 pr-4 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {isAll
                  ? perSeasonData.map((row) => (
                      <tr key={row.yr} className="hover:bg-surface-muted transition-colors">
                        <td className="py-2 pr-4 text-ink font-semibold text-xs">{row.yr}</td>
                        <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: "#0071E3" }}>{formatPrice(row.ca)}</td>
                        <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: "#E03131" }}>{formatPrice(row.charges)}</td>
                        <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: row.resultat >= 0 ? "#16A34A" : "#E03131" }}>
                          {row.resultat >= 0 ? "+" : ""}{formatPrice(row.resultat)}
                        </td>
                        <td className={`py-2 font-mono text-xs font-semibold ${margeColor(row.marge)}`}>
                          {row.marge !== null ? `${row.marge.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))
                  : monthlyData.map((row) => (
                      <tr key={row.label} className="hover:bg-surface-muted transition-colors">
                        <td className="py-2 pr-4 text-ink font-medium text-xs">{row.label}</td>
                        <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: "#0071E3" }}>{formatPrice(row.ca)}</td>
                        <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: "#E03131" }}>{formatPrice(row.charges)}</td>
                        <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: row.resultat >= 0 ? "#16A34A" : "#E03131" }}>
                          {row.resultat >= 0 ? "+" : ""}{formatPrice(row.resultat)}
                        </td>
                        <td className={`py-2 font-mono text-xs font-semibold ${margeColor(row.marge)}`}>
                          {row.marge !== null ? `${row.marge.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-border">
                  <td className="pt-2 pr-4 text-xs font-bold text-ink">Total</td>
                  <td className="pt-2 pr-4 font-mono font-bold text-xs" style={{ color: "#0071E3" }}>{formatPrice(totalCA)}</td>
                  <td className="pt-2 pr-4 font-mono font-bold text-xs" style={{ color: "#E03131" }}>{formatPrice(totalCharges)}</td>
                  <td className="pt-2 pr-4 font-mono font-bold text-xs" style={{ color: resultat >= 0 ? "#16A34A" : "#E03131" }}>
                    {resultat >= 0 ? "+" : ""}{formatPrice(resultat)}
                  </td>
                  <td className={`pt-2 font-mono text-xs font-bold ${margeColor(marge)}`}>{marge.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Result summary card ── */}
      <div
        className="card p-5"
        style={{
          opacity: 0,
          animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s forwards",
          borderLeft: `4px solid ${resultat >= 0 ? "#16A34A" : "#E03131"}`,
        }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <p className="text-xs text-ink-muted font-medium">{isAll ? "Résumé toutes saisons" : `Résumé saison ${saison}`}</p>
            <p className="text-lg font-bold text-ink mt-0.5">
              CA {formatPrice(totalCA)} — Charges {formatPrice(totalCharges)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-muted">Résultat net</p>
            <p className="text-2xl font-bold font-mono" style={{ color: resultat >= 0 ? "#16A34A" : "#E03131" }}>
              {resultat >= 0 ? "+" : ""}{formatPrice(resultat)}
            </p>
            <p className="text-sm text-ink-muted">{marge.toFixed(1)}% de marge</p>
          </div>
        </div>
      </div>
    </div>
  );
}
