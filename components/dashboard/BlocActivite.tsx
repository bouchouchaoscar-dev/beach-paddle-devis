"use client";

import type { DevisFormData, ActivityType } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import {
  PADDLE_PRICES,
  KAYAK_PRICES,
  HYBRIDE_PRICES,
  MEGA_PADDLE_PRICES,
  DURATIONS,
  DURATION_LABELS,
  getActivityPrice,
} from "@/lib/pricing";
import { formatPrice } from "@/lib/calculations";

interface Props {
  form: DevisFormData;
  onChange: (patch: Partial<DevisFormData>) => void;
}

const ANIM = { opacity: 0, animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards" } as const;

const ACTIVITY_OPTIONS: { value: ActivityType; label: string; icon: React.ReactNode }[] = [
  {
    value: "paddle",
    label: "Paddle",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="3" x2="15" y2="3"/>
        <line x1="12" y1="3" x2="12" y2="14"/>
        <path d="M8 14c0 4 1.8 6.5 4 6.5s4-2.5 4-6.5H8z"/>
      </svg>
    ),
  },
  {
    value: "kayak",
    label: "Kayak",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <path d="M5 7Q1 12 5 17Q9 12 5 7Z"/>
        <path d="M19 7Q23 12 19 17Q15 12 19 7Z"/>
      </svg>
    ),
  },
  {
    value: "hybride",
    label: "Hybride",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  {
    value: "mega_paddle",
    label: "MégaPaddle",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="20" x2="22" y2="20"/>
        <path d="M5 20V15l7-4 7 4v5"/>
        <line x1="9" y1="15" x2="9" y2="11"/>
        <line x1="15" y1="15" x2="15" y2="11"/>
        <line x1="9" y1="11" x2="15" y2="11"/>
      </svg>
    ),
  },
];

function CountStepper({
  label,
  value,
  min,
  onDecrement,
  onIncrement,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  onDecrement: () => void;
  onIncrement: () => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div className="w-14 h-9 border border-surface-border bg-white text-center flex items-center justify-center text-sm font-bold font-mono text-ink">
          {value}
        </div>
        <button
          type="button"
          onClick={onIncrement}
          className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}

export function BlocActivite({ form, onChange }: Props) {
  const pricePerPerson = getActivityPrice(form.activity, form.duration);
  const mp = form.megaPaddleCount ?? 1;
  const me = form.megaEscapeCount ?? 0;

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

      {/* MégaPaddle — sélection embarcations */}
      {form.activity === "mega_paddle" && (
        <div className="border border-surface-border rounded-xl p-4 space-y-4" style={ANIM}>
          <CountStepper
            label="Nombre de MégaPaddles"
            value={mp}
            min={me > 0 ? 0 : 1}
            onDecrement={() => onChange({ megaPaddleCount: Math.max(me > 0 ? 0 : 1, mp - 1) })}
            onIncrement={() => onChange({ megaPaddleCount: mp + 1 })}
          />
          <CountStepper
            label="Nombre de MégaScapes"
            value={me}
            min={0}
            onDecrement={() => onChange({ megaEscapeCount: Math.max(0, me - 1) })}
            onIncrement={() => onChange({ megaEscapeCount: me + 1 })}
            hint="Le MégaScape dispose de 4 sièges"
          />
          {mp === 0 && me === 0 && (
            <p className="text-xs text-brand-red font-medium">Au moins 1 embarcation requise</p>
          )}
        </div>
      )}

      {/* Durée */}
      <div>
        <label className="label">Durée</label>
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((dur) => {
            const displayPrice =
              form.activity === "paddle" ? PADDLE_PRICES[dur] :
              form.activity === "kayak" ? KAYAK_PRICES[dur] :
              form.activity === "mega_paddle" ? MEGA_PADDLE_PRICES[dur] :
              HYBRIDE_PRICES[dur];
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
            {form.activity === "paddle" ? "Stand Up Paddle" :
             form.activity === "kayak" ? "Kayak" :
             form.activity === "mega_paddle" ? "MégaPaddle" :
             "Hybride"}{" "}
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
            style={ANIM}
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
