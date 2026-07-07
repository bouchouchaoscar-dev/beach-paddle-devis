"use client";

import type { DevisFormData, CalculationResult } from "@/lib/types";
import { formatPrice } from "@/lib/calculations";
import { ACTIVITY_LABELS, DURATION_LABELS } from "@/lib/pricing";

interface Props {
  form: DevisFormData;
  calc: CalculationResult;
  onGenerate: () => void;
}

function LineItem({
  label,
  sub,
  amount,
  color,
}: {
  label: string;
  sub?: string;
  amount: string;
  color?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-surface-border last:border-0" style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <p className="text-sm font-medium text-ink" style={color ? { color } : {}}>
          {label}
        </p>
        {sub && <p className="text-xs text-ink-muted">{sub}</p>}
      </div>
      <span
        className="text-sm font-bold font-mono shrink-0"
        style={color ? { color } : {}}
      >
        {amount}
      </span>
    </div>
  );
}

export function AperçuDevis({ form, calc, onGenerate }: Props) {
  const n = form.participantsCount;
  const hasActivity = form.activity !== "none";
  const hasDiscount = calc.totalDiscount > 0;

  return (
    <div className="sticky top-20">
      <div className="card overflow-hidden">
        {/* Header */}
        <div
          className="border-b border-surface-border"
          style={{
            padding: "20px 20px 18px",
            background: "linear-gradient(135deg, rgba(0,113,227,0.05) 0%, rgba(0,82,163,0.03) 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Aperçu</h3>
            {form.clientName && (
              <span className="text-xs text-ink-secondary bg-white px-2 py-1 rounded-lg border border-surface-border max-w-32 truncate">
                {form.clientName}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1" style={{ marginTop: "14px" }}>
            <span className="text-3xl font-bold tracking-tight" style={{ color: "#0071E3" }}>
              {formatPrice(calc.totalNet)}
            </span>
          </div>
          {n > 0 && calc.totalNet > 0 && (
            <p className="text-xs text-ink-muted" style={{ marginTop: "6px" }}>
              soit{" "}
              <span className="font-semibold font-mono">
                {formatPrice(Math.round((calc.totalNet / n) * 100) / 100)}
              </span>{" "}
              par personne
            </p>
          )}
        </div>

        {/* Lines */}
        <div style={{ padding: "20px 20px 4px" }}>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider" style={{ marginBottom: "12px" }}>
            Détail ({n} pers.)
          </p>

          {hasActivity && (
            <LineItem
              label={ACTIVITY_LABELS[form.activity]}
              sub={`${DURATION_LABELS[form.duration]} — ${formatPrice(calc.activityPricePerPerson)}/pers.`}
              amount={formatPrice(calc.activitySubtotal)}
              color="#0071E3"
            />
          )}

          {form.coach.enabled && calc.coachSubtotal > 0 && (
            <LineItem
              label={form.coach.description || "Coach Beach Paddle"}
              sub="Forfait groupe"
              amount={formatPrice(calc.coachSubtotal)}
            />
          )}

          {form.snackingItems.map((item) => {
            const price =
              item.pricePerPerson !== null
                ? item.pricePerPerson
                : (item.manualPrice ?? 0);
            return (
              <LineItem
                key={item.id}
                label={item.label}
                sub={`${formatPrice(price)}/pers.`}
                amount={formatPrice(price * n)}
              />
            );
          })}

          {(hasActivity || form.coach.enabled || form.snackingItems.length > 0) && (
            <div className="flex items-center justify-between border-t-2 border-surface-border" style={{ padding: "12px 0 4px" }}>
              <span className="text-sm font-semibold text-ink">Sous-total</span>
              <span className="text-sm font-bold font-mono text-ink">
                {formatPrice(calc.totalBrut)}
              </span>
            </div>
          )}

          {/* Remise */}
          {hasDiscount && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {calc.accompagnatorsCost > 0 && (
                <div className="flex items-center justify-between" style={{ padding: "5px 0" }}>
                  <span className="text-xs" style={{ color: "#E03131" }}>
                    Accompagnateurs offerts ({form.discount.accompagnatorsCount})
                  </span>
                  <span className="text-xs font-bold font-mono" style={{ color: "#E03131" }}>
                    -{formatPrice(calc.accompagnatorsCost)}
                  </span>
                </div>
              )}
              {calc.extraDiscountAmount > 0 && (
                <div className="flex items-center justify-between" style={{ padding: "5px 0" }}>
                  <span className="text-xs" style={{ color: "#E03131" }}>
                    Remise {form.discount.extraDiscountRate}%
                  </span>
                  <span className="text-xs font-bold font-mono" style={{ color: "#E03131" }}>
                    -{formatPrice(calc.extraDiscountAmount)}
                  </span>
                </div>
              )}
              {calc.discountAmount > 0 && (
                <div className="flex items-center justify-between" style={{ padding: "5px 0" }}>
                  <span className="text-xs" style={{ color: "#E03131" }}>
                    Remise groupe {form.discount.discountRate}%
                  </span>
                  <span className="text-xs font-bold font-mono" style={{ color: "#E03131" }}>
                    -{formatPrice(calc.discountAmount)}
                  </span>
                </div>
              )}
              <div
                className="flex items-center justify-between rounded-lg"
                style={{ backgroundColor: "rgba(224,49,49,0.08)", padding: "10px 12px", marginTop: "4px" }}
              >
                <span className="text-xs font-semibold" style={{ color: "#E03131" }}>
                  Remise totale {calc.totalDiscountRateIsExact ? "=" : "≈"} {calc.totalDiscountRate}%
                </span>
                <span className="text-xs font-bold font-mono" style={{ color: "#E03131" }}>
                  -{formatPrice(calc.totalDiscount)}
                </span>
              </div>
            </div>
          )}

          {/* Total final */}
          <div
            className="flex items-center justify-between rounded-xl border-2"
            style={{
              borderColor: "#0071E3",
              backgroundColor: "rgba(0,113,227,0.04)",
              padding: "14px 14px",
              marginTop: "14px",
            }}
          >
            <span className="text-sm font-bold text-ink">
              {hasDiscount ? "TOTAL AVEC REMISE" : "TOTAL"}
            </span>
            <span className="text-lg font-bold font-mono" style={{ color: "#1D1D1F" }}>
              {formatPrice(calc.totalNet)}
            </span>
          </div>

          {calc.totalNet > 0 && form.documentType !== "facture" && (
            <div
              className="rounded-xl"
              style={{
                backgroundColor: "#FFF5F5",
                border: "1.5px solid #F0A0A0",
                padding: "10px 12px",
                marginTop: "10px",
              }}
            >
              <p className="text-xs font-semibold italic leading-relaxed" style={{ color: "#D94F04" }}>
                Acompte de 30% demandé pour valider la réservation —{" "}
                <span className="font-bold not-italic">
                  soit {formatPrice(Math.round(calc.totalNet * 0.3 * 100) / 100)}
                </span>
              </p>
              <p className="text-xs italic mt-1" style={{ color: "#D94F04", opacity: 0.8 }}>
                La date sera bloquée dès réception de l&apos;acompte.
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: "16px 20px 20px" }}>
          <button
            type="button"
            onClick={onGenerate}
            disabled={!form.clientName || calc.totalNet === 0}
            className="btn-primary w-full py-3 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Générer le document
          </button>
          {(!form.clientName || calc.totalNet === 0) && (
            <p className="text-xs text-center text-ink-muted mt-2">
              {!form.clientName
                ? "Renseigne le nom du client"
                : "Ajoute une activité ou une prestation"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
