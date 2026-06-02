"use client";

import type { DevisFormData, ActivityType } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import {
  PADDLE_PRICES,
  KAYAK_PRICES,
  HYBRIDE_PRICES,
  DURATIONS,
  DURATION_LABELS,
  getActivityPrice,
} from "@/lib/pricing";
import { formatPrice } from "@/lib/calculations";

interface Props {
  form: DevisFormData;
  onChange: (patch: Partial<DevisFormData>) => void;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string; icon: React.ReactNode }[] = [
  {
    value: "paddle",
    label: "Paddle",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l4-4 4 4 4-4 4 4"/><path d="M3 7l4 4 4-4 4 4 4-4"/>
      </svg>
    ),
  },
  {
    value: "kayak",
    label: "Kayak",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h20M12 2v20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
      </svg>
    ),
  },
  {
    value: "hybride",
    label: "Hybride",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
  },
];

export function BlocActivite({ form, onChange }: Props) {
  const pricePerPerson = getActivityPrice(form.activity, form.duration);

  return (
    <section className="card p-6 space-y-5">
      <p className="section-title">2 — Activité nautique</p>

      {/* Type activité */}
      <div>
        <label className="label">Type d&apos;activité</label>
        <SegmentedControl
          options={ACTIVITY_OPTIONS}
          value={form.activity}
          onChange={(v) => onChange({ activity: v })}
          accent="teal"
        />
      </div>

      {/* Durée */}
      <div>
        <label className="label">Durée</label>
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((dur) => {
            const paddleP = PADDLE_PRICES[dur];
            const kayakP = KAYAK_PRICES[dur];
            const displayPrice =
              form.activity === "paddle"
                ? paddleP
                : form.activity === "kayak"
                ? kayakP
                : HYBRIDE_PRICES[dur];
            const active = form.duration === dur;

            return (
              <button
                key={dur}
                type="button"
                onClick={() => onChange({ duration: dur })}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 text-center transition-all duration-200 ${
                  active
                    ? "border-brand-teal bg-brand-teal-light"
                    : "border-surface-border bg-white hover:border-brand-teal/40 hover:bg-brand-teal-light/40"
                }`}
              >
                <span className={`text-sm font-bold ${active ? "text-brand-teal" : "text-ink"}`}>
                  {DURATION_LABELS[dur]}
                </span>
                <span className={`text-xs mt-0.5 font-mono ${active ? "text-brand-teal-dark" : "text-ink-muted"}`}>
                  {formatPrice(displayPrice)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prix résumé */}
      {form.activity !== "none" && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
          style={{
            backgroundColor: "rgba(0,113,227,0.06)",
            borderLeft: "3px solid #0071E3",
          }}
        >
          <span className="text-ink-secondary">
            {form.activity === "paddle"
              ? "Stand Up Paddle"
              : form.activity === "kayak"
              ? "Kayak"
              : "Hybride"}{" "}
            — {DURATION_LABELS[form.duration]}
          </span>
          <span className="font-bold font-mono" style={{ color: "#0071E3" }}>
            {formatPrice(pricePerPerson)} / pers.
          </span>
        </div>
      )}

      {/* Coach option */}
      <div className="border border-surface-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Toggle
            checked={form.coach.enabled}
            onChange={(v) => onChange({ coach: { ...form.coach, enabled: v } })}
            label="Coach Beach Paddle (encadrant)"
          />
        </div>
        {form.coach.enabled && (
          <div
            className="grid grid-cols-2 gap-3 animate-slide-up"
            style={{ opacity: 0, animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <div>
              <label className="label">Description</label>
              <input
                type="text"
                value={form.coach.description}
                onChange={(e) =>
                  onChange({ coach: { ...form.coach, description: e.target.value } })
                }
                className="input-field"
                placeholder="Coach Beach Paddle"
              />
            </div>
            <div>
              <label className="label">Prix forfait (groupe)</label>
              <div className="flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => onChange({ coach: { ...form.coach, price: Math.max(0, form.coach.price - 5) } })}
                  className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <div className="h-9 border border-surface-border bg-white flex items-center justify-center gap-1 px-3 text-sm font-bold font-mono text-ink min-w-[5rem]">
                  {form.coach.price}
                  <span className="text-ink-muted font-normal">€</span>
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ coach: { ...form.coach, price: form.coach.price + 5 } })}
                  className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
