"use client";

import type { DevisFormData, ClientType } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumericInput } from "@/components/ui/NumericInput";


interface Props {
  form: DevisFormData;
  onChange: (patch: Partial<DevisFormData>) => void;
}

const CLIENT_OPTIONS: { value: ClientType; label: string }[] = [
  { value: "entreprise", label: "Entreprise" },
  { value: "scolaire", label: "Établissement scolaire" },
  { value: "loisirs", label: "Service Jeunesse" },
];

export function BlocClient({ form, onChange }: Props) {
  return (
    <section className="card p-6 space-y-5">
      <div>
        <p className="section-title">1 — Informations client</p>
      </div>

      {/* Date + Heure */}
      <div>
        {/* Toggle positionné en haut à droite du bloc, hors grille pour ne pas casser l'alignement */}
        <div className="flex justify-end mb-2">
          <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
            <span className="text-xs text-ink-muted">Date à définir</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={!!form.dateADefinir}
                onChange={(e) => {
                  onChange({
                    dateADefinir: e.target.checked,
                    ...(e.target.checked ? { date: "", heureDebut: "" } : {}),
                  });
                }}
                className="sr-only"
              />
              <div
                className="w-9 h-5 rounded-full transition-colors duration-200"
                style={{ backgroundColor: form.dateADefinir ? "#E8820C" : "#D1D0CC" }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200"
                  style={{ left: form.dateADefinir ? "18px" : "2px" }}
                />
              </div>
            </div>
          </label>
        </div>

        {form.dateADefinir ? (
          <div className="flex items-center h-10 px-3.5 rounded-xl border border-dashed border-surface-border bg-surface-muted/50 text-sm text-ink-muted italic">
            Date et heure à définir ultérieurement
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date de la prestation</label>
              <DatePicker
                value={form.date}
                onChange={(v) => onChange({ date: v })}
              />
            </div>
            <div>
              <label className="label">Heure de début <span className="text-ink-muted font-normal">(optionnel)</span></label>
              <select
                value={form.heureDebut}
                onChange={(e) => onChange({ heureDebut: e.target.value })}
                className="input-field appearance-none cursor-pointer"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C9890' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" }}
              >
                <option value="">— Non définie</option>
                {Array.from({ length: 29 }, (_, i) => {
                  const totalMinutes = 8 * 60 + i * 30;
                  const h = Math.floor(totalMinutes / 60);
                  const m = totalMinutes % 60;
                  const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                  return <option key={val} value={val}>{val}</option>;
                })}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Type de client */}
      <div>
        <label className="label">Type de client</label>
        <SegmentedControl
          options={CLIENT_OPTIONS}
          value={form.clientType}
          onChange={(v) =>
            onChange({
              clientType: v,
              discount: {
                ...form.discount,
                discountEnabled: true,
                accompagnatorsEnabled: true,
                extraDiscountEnabled: true,
                discountRate: 10,
                extraDiscountRate: 10,
              },
            })
          }
          accent="orange"
        />
      </div>

      {/* Nom client */}
      <div>
        <label className="label">
          {form.clientType === "entreprise" ? "Nom de l'entreprise" : "Nom de l'établissement"}
          <span className="text-brand-red ml-1">*</span>
        </label>
        <input
          type="text"
          value={form.clientName}
          onChange={(e) => onChange({ clientName: e.target.value })}
          className="input-field"
          placeholder={
            form.clientType === "entreprise"
              ? "ex: Société ACME"
              : "ex: École Jean Moulin"
          }
          required
        />
      </div>

      {/* Adresse */}
      <div>
        <label className="label">Adresse client <span className="text-ink-muted font-normal">(optionnel)</span></label>
        <input
          type="text"
          value={form.clientAddress}
          onChange={(e) => onChange({ clientAddress: e.target.value })}
          className="input-field"
          placeholder="15 rue de la Paix, 75001 Paris"
        />
      </div>

      {/* Description prestation */}
      <div>
        <label className="label">Description de la prestation</label>
        <textarea
          value={form.prestationDescription}
          onChange={(e) => onChange({ prestationDescription: e.target.value })}
          rows={2}
          className="input-field resize-none"
          placeholder="ex: 1h30 de kayak le 28 mai à partir de 14h pour un team building"
        />
      </div>

      {/* Participants */}
      <div>
        <label className="label">Nombre de participants <span className="text-brand-red">*</span></label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={() => onChange({ participantsCount: Math.max(1, form.participantsCount - 1) })}
              className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <NumericInput
              inputMode="numeric"
              value={form.participantsCount}
              min={1}
              max={500}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 1) onChange({ participantsCount: v });
              }}
              className="w-20 h-9 border border-surface-border bg-white text-center text-sm font-bold text-ink outline-none font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => onChange({ participantsCount: Math.min(500, form.participantsCount + 1) })}
              className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <span className="text-sm text-ink-secondary">personne{form.participantsCount > 1 ? "s" : ""}</span>
        </div>
      </div>
    </section>
  );
}
