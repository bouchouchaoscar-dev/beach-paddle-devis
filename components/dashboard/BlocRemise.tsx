"use client";

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

export function BlocRemise({ form, onChange }: Props) {
  const { clientType, discount } = form;

  function patchDiscount(patch: Partial<DevisFormData["discount"]>) {
    onChange({ discount: { ...discount, ...patch } });
  }

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
          <div
            className="space-y-4"
            style={{ opacity: 0, animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <div>
              <label className="label">Remise exceptionnelle groupe entreprise</label>
              <div className="flex flex-wrap gap-2">
                {ENTERPRISE_DISCOUNT_RATES.map((rate) => (
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
                  <div className="w-14 h-9 border border-surface-border bg-white text-center flex items-center justify-center text-sm font-bold font-mono text-ink">
                    {discount.discountRate}%
                  </div>
                  <button
                    type="button"
                    onClick={() => patchDiscount({ discountRate: Math.min(100, discount.discountRate + 1) })}
                    className="flex items-center justify-center w-8 h-9 rounded-r-lg border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
              style={{
                backgroundColor: "rgba(224,49,49,0.06)",
                borderLeft: "3px solid #E03131",
              }}
            >
              <span className="text-ink-secondary">REMISE EXCEPTIONNELLE GROUPE ENTREPRISE</span>
              <span className="font-bold font-mono" style={{ color: "#E03131" }}>
                -{discount.discountRate}%
              </span>
            </div>
          </div>
        )}

        {!discount.discountEnabled && (
          <p className="text-sm text-ink-muted italic">Aucune remise appliquée</p>
        )}
      </section>
    );
  }

  // Scolaire / loisirs
  const label =
    clientType === "scolaire"
      ? "REMISE EXCEPTIONNELLE ÉTABLISSEMENT SCOLAIRE"
      : "REMISE EXCEPTIONNELLE SERVICE JEUNESSE";

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
          <div
            className="flex items-center gap-3"
            style={{ opacity: 0, animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <label className="text-sm text-ink-secondary whitespace-nowrap">Nombre d&apos;accompagnateurs :</label>
            <div className="flex items-center gap-0">
              <button
                type="button"
                onClick={() => patchDiscount({ accompagnatorsCount: Math.max(0, discount.accompagnatorsCount - 1) })}
                className="flex items-center justify-center w-8 h-8 rounded-l-lg border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <input
                type="number"
                value={discount.accompagnatorsCount}
                min={0}
                max={50}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 0) patchDiscount({ accompagnatorsCount: v });
                }}
                className="w-14 h-8 border border-surface-border bg-white text-center text-sm font-bold text-ink outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => patchDiscount({ accompagnatorsCount: discount.accompagnatorsCount + 1 })}
                className="flex items-center justify-center w-8 h-8 rounded-r-lg border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
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
          <div
            className="space-y-3"
            style={{ opacity: 0, animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
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
                <div className="w-14 h-9 border border-surface-border bg-white text-center flex items-center justify-center text-sm font-bold font-mono text-ink">
                  {discount.extraDiscountRate}%
                </div>
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
        style={{
          backgroundColor: "rgba(224,49,49,0.06)",
          borderLeft: "3px solid #E03131",
        }}
      >
        <span className="text-ink-secondary text-xs">{label}</span>
      </div>
    </section>
  );
}
