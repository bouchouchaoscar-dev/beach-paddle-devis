"use client";

import { useState, useEffect } from "react";
import type { DevisFormData } from "@/lib/types";
import { Toggle } from "@/components/ui/Toggle";
import {
  ENTERPRISE_DISCOUNT_RATES,
  SCHOOL_DISCOUNT_RATES,
} from "@/lib/pricing";

interface Props {
  form: DevisFormData;
  onChange: (patch: Partial<DevisFormData>) => void;
}

const ANIM = { opacity: 0, animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards" } as const;

// Mapping label remise selon le type de client
function getDiscountLabel(type: string): string {
  switch (type) {
    case "entreprise":       return "Remise exceptionnelle groupe Entreprise";
    case "organisme_public": return "Remise exceptionnelle Organisme public";
    case "association":      return "Remise exceptionnelle groupe Association";
    case "scolaire":         return "Remise exceptionnelle Établissement scolaire";
    case "loisirs":          return "Remise exceptionnelle Service Jeunesse";
    default:                 return "Remise exceptionnelle";
  }
}

// Stepper partagé pour le nombre d'accompagnateurs
function AccomptStepper({
  count,
  onDecrement,
  onIncrement,
}: {
  count: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" style={ANIM}>
      <label className="text-sm text-ink-secondary">Nombre d&apos;accompagnateurs :</label>
      <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={onDecrement}
          className="flex items-center justify-center w-8 h-8 rounded-l-lg border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div className="w-14 h-8 border border-surface-border bg-white text-center flex items-center justify-center text-sm font-bold font-mono text-ink">
          {count}
        </div>
        <button
          type="button"
          onClick={onIncrement}
          className="flex items-center justify-center w-8 h-8 rounded-r-lg border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  );
}

export function BlocRemise({ form, onChange }: Props) {
  const { clientType, discount } = form;

  const [rateStr, setRateStr] = useState(String(discount.discountRate));
  const [extraRateStr, setExtraRateStr] = useState(String(discount.extraDiscountRate));

  useEffect(() => {
    setRateStr((prev) => {
      const parsed = parseFloat(prev.replace(",", "."));
      return parsed === discount.discountRate ? prev : String(discount.discountRate);
    });
  }, [discount.discountRate]);

  useEffect(() => {
    setExtraRateStr((prev) => {
      const parsed = parseFloat(prev.replace(",", "."));
      return parsed === discount.extraDiscountRate ? prev : String(discount.extraDiscountRate);
    });
  }, [discount.extraDiscountRate]);

  function patchDiscount(patch: Partial<DevisFormData["discount"]>) {
    onChange({ discount: { ...discount, ...patch } });
  }

  function handleRateChange(raw: string) {
    setRateStr(raw);
    const val = parseFloat(raw.replace(",", "."));
    if (!isNaN(val)) patchDiscount({ discountRate: Math.min(100, Math.max(0, val)) });
  }

  function handleRateBlur() {
    const val = parseFloat(rateStr.replace(",", "."));
    const clamped = isNaN(val) ? discount.discountRate : Math.min(100, Math.max(0, val));
    setRateStr(String(clamped));
    patchDiscount({ discountRate: clamped });
  }

  function handleExtraRateChange(raw: string) {
    setExtraRateStr(raw);
    const val = parseFloat(raw.replace(",", "."));
    if (!isNaN(val)) patchDiscount({ extraDiscountRate: Math.min(100, Math.max(0, val)) });
  }

  function handleExtraRateBlur() {
    const val = parseFloat(extraRateStr.replace(",", "."));
    const clamped = isNaN(val) ? discount.extraDiscountRate : Math.min(100, Math.max(0, val));
    setExtraRateStr(String(clamped));
    patchDiscount({ extraDiscountRate: clamped });
  }

  // ── Bloc commun : preset % buttons + saisie libre + stepper ──────────────
  function DiscountRateRow({ rates }: { rates: number[] }) {
    return (
      <div className="flex flex-wrap gap-2">
        {rates.map((rate) => (
          <button
            key={rate}
            type="button"
            onClick={() => patchDiscount({ discountRate: rate })}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all duration-200 ${
              discount.discountRate === rate
                ? "border-brand-red bg-brand-red-light text-brand-red"
                : "border-surface-border bg-white text-ink-secondary hover:border-brand-red/40"
            }`}
          >
            {rate}%
          </button>
        ))}
        <div className="flex items-center gap-0">
          <button
            type="button"
            onClick={() => patchDiscount({ discountRate: Math.max(0, discount.discountRate - 1) })}
            className="flex items-center justify-center w-8 h-9 rounded-l-lg border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <input
            type="text"
            inputMode="decimal"
            value={rateStr}
            onChange={(e) => handleRateChange(e.target.value)}
            onBlur={handleRateBlur}
            onFocus={(e) => e.target.select()}
            className="w-16 h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink focus:outline-none focus:border-brand-red/60"
          />
          <button
            type="button"
            onClick={() => patchDiscount({ discountRate: Math.min(100, discount.discountRate + 1) })}
            className="flex items-center justify-center w-8 h-9 rounded-r-lg border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
    );
  }

  // ── Entreprise ────────────────────────────────────────────────────────────
  if (clientType === "entreprise") {
    return (
      <section className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="section-title mb-0">4 — Remise groupe</p>
          <Toggle
            checked={discount.discountEnabled}
            onChange={(v) => patchDiscount({ discountEnabled: v })}
            size="sm"
          />
        </div>

        {discount.discountEnabled && (
          <div className="space-y-4" style={ANIM}>
            <div>
              <label className="label">{getDiscountLabel("entreprise")}</label>
              <DiscountRateRow rates={ENTERPRISE_DISCOUNT_RATES} />
            </div>
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
              style={{ backgroundColor: "rgba(224,49,49,0.06)", borderLeft: "3px solid #E03131" }}
            >
              <span className="text-ink-secondary">REMISE EXCEPTIONNELLE GROUPE ENTREPRISE</span>
              <span className="font-bold font-mono" style={{ color: "#E03131" }}>-{discount.discountRate}%</span>
            </div>
          </div>
        )}

        {!discount.discountEnabled && (
          <p className="text-sm text-ink-muted italic">Aucune remise appliquée</p>
        )}
      </section>
    );
  }

  // ── Association ───────────────────────────────────────────────────────────
  if (clientType === "association") {
    const hasAnyDiscount = discount.discountEnabled || discount.accompagnatorsEnabled;
    return (
      <section className="card p-6 space-y-5">
        <p className="section-title">4 — Remises</p>

        {/* Remise groupe */}
        <div className="border border-surface-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Remise groupe</span>
            <Toggle
              checked={discount.discountEnabled}
              onChange={(v) => patchDiscount({ discountEnabled: v })}
              size="sm"
            />
          </div>
          {discount.discountEnabled && (
            <div className="space-y-3" style={ANIM}>
              <label className="label">{getDiscountLabel("association")}</label>
              <DiscountRateRow rates={ENTERPRISE_DISCOUNT_RATES} />
            </div>
          )}
        </div>

        {/* Accompagnateurs offerts */}
        <div className="border border-surface-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Toggle
              checked={discount.accompagnatorsEnabled}
              onChange={(v) => patchDiscount({ accompagnatorsEnabled: v })}
              label="Accompagnateurs offerts"
            />
          </div>
          {discount.accompagnatorsEnabled && (
            <AccomptStepper
              count={discount.accompagnatorsCount}
              onDecrement={() => patchDiscount({ accompagnatorsCount: Math.max(0, discount.accompagnatorsCount - 1) })}
              onIncrement={() => patchDiscount({ accompagnatorsCount: discount.accompagnatorsCount + 1 })}
            />
          )}
        </div>

        {/* Résumé */}
        {hasAnyDiscount ? (
          <div
            className="px-4 py-3 rounded-xl text-sm space-y-1"
            style={{ backgroundColor: "rgba(124,58,237,0.06)", borderLeft: "3px solid #7C3AED" }}
          >
            <span className="text-xs font-semibold" style={{ color: "#7C3AED" }}>
              REMISE EXCEPTIONNELLE GROUPE ASSOCIATION
            </span>
            {discount.discountEnabled && (
              <div className="flex justify-between text-xs" style={{ color: "#7C3AED" }}>
                <span>Remise groupe</span>
                <span className="font-bold font-mono">-{discount.discountRate}%</span>
              </div>
            )}
            {discount.accompagnatorsEnabled && discount.accompagnatorsCount > 0 && (
              <div className="flex justify-between text-xs" style={{ color: "#7C3AED" }}>
                <span>{discount.accompagnatorsCount} accompagnateur{discount.accompagnatorsCount > 1 ? "s" : ""} offert{discount.accompagnatorsCount > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted italic">Aucune remise appliquée</p>
        )}
      </section>
    );
  }

  // ── Scolaire / loisirs / organisme_public / particulier ──────────────────
  const label = getDiscountLabel(clientType);

  return (
    <section className="card p-6 space-y-5">
      <p className="section-title">4 — Remises</p>

      {/* Accompagnateurs */}
      <div className="border border-surface-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Toggle
            checked={discount.accompagnatorsEnabled}
            onChange={(v) => patchDiscount({ accompagnatorsEnabled: v })}
            label="Accompagnateurs offerts"
          />
        </div>
        {discount.accompagnatorsEnabled && (
          <AccomptStepper
            count={discount.accompagnatorsCount}
            onDecrement={() => patchDiscount({ accompagnatorsCount: Math.max(0, discount.accompagnatorsCount - 1) })}
            onIncrement={() => patchDiscount({ accompagnatorsCount: discount.accompagnatorsCount + 1 })}
          />
        )}
      </div>

      {/* Remise supplémentaire */}
      <div className="border border-surface-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Toggle
            checked={discount.extraDiscountEnabled}
            onChange={(v) => patchDiscount({ extraDiscountEnabled: v })}
            label="Remise supplémentaire"
          />
        </div>
        {discount.extraDiscountEnabled && (
          <div className="space-y-3" style={ANIM}>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_DISCOUNT_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => patchDiscount({ extraDiscountRate: rate })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all duration-200 ${
                    discount.extraDiscountRate === rate
                      ? "border-brand-red bg-brand-red-light text-brand-red"
                      : "border-surface-border bg-white text-ink-secondary hover:border-brand-red/40"
                  }`}
                >
                  {rate}%
                </button>
              ))}
              <div className="flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => patchDiscount({ extraDiscountRate: Math.max(0, discount.extraDiscountRate - 1) })}
                  className="flex items-center justify-center w-8 h-9 rounded-l-lg border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  value={extraRateStr}
                  onChange={(e) => handleExtraRateChange(e.target.value)}
                  onBlur={handleExtraRateBlur}
                  onFocus={(e) => e.target.select()}
                  className="w-16 h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink focus:outline-none focus:border-brand-red/60"
                />
                <button
                  type="button"
                  onClick={() => patchDiscount({ extraDiscountRate: Math.min(100, discount.extraDiscountRate + 1) })}
                  className="flex items-center justify-center w-8 h-9 rounded-r-lg border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Résumé */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
        style={{ backgroundColor: "rgba(224,49,49,0.06)", borderLeft: "3px solid #E03131" }}
      >
        <span className="text-ink-secondary text-xs">{label}</span>
      </div>
    </section>
  );
}
