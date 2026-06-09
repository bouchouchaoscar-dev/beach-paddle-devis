"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  type CalendarEvent,
  type AcompteEntry,
  getCalendarEventsInRange,
  getAcompteEntries,
  updateCalendarEvent,
  createCalendarEvent,
  deleteCalendarEvent,
  getClientStyle,
} from "@/lib/calendar";
import { getSession } from "@/lib/auth";
import { getDevisById, updateDevisHeure, deleteDevis, saveDevis } from "@/lib/storage";
import { calculateDevis } from "@/lib/calculations";
import { buildAutoDescription } from "@/lib/autoDescription";
import { DURATION_LABELS, DURATIONS } from "@/lib/pricing";
import { DocumentPreview } from "@/components/document/DocumentPreview";
import type { DevisRecord, ActivityType, Duration } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const JOURS_LONGS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MOIS_NOMS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h → 20h
const SLOT_PX = 64;
const ACT_LABELS: Record<string, string> = {
  paddle: "Paddle",
  kayak: "Kayak",
  hybride: "Paddle + Kayak",
};

const TYPE_SHORT: Record<string, string> = {
  entreprise:      "Entr.",
  association:     "Assoc.",
  scolaire:        "École",
  loisirs:         "S.J.",
  service_jeunesse:"S.J.",
};

const TYPE_EMOJI: Record<string, string> = {
  entreprise:      "🏢",
  association:     "🤝",
  scolaire:        "🏫",
  loisirs:         "🎯",
  service_jeunesse:"🎯",
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment detection
// ─────────────────────────────────────────────────────────────────────────────

type PaymentCas = 1 | 2 | 3 | 4;
interface PaymentDetection {
  cas: PaymentCas;
  montant?: number;
}

const PAYMENT_TOL = 0.5; // ±0.50€ max — évite les faux positifs sur montants proches

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function weekStart(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay();
  copy.setDate(copy.getDate() + (dow === 0 ? -6 : 1 - dow));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getWeekDays(anchor: Date): Date[] {
  const start = weekStart(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatH(h: string) {
  const [hh, mm] = h.split(":");
  return !mm || mm === "00" ? `${parseInt(hh)}h` : `${parseInt(hh)}h${mm}`;
}

function formatPrice(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formatPriceExact(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const now = todayDate();
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function longDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${JOURS_LONGS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MOIS_NOMS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────────────────────────────────────

const IcoChevL = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IcoChevR = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IcoPlus = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IcoSync = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const IcoX = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcoTrash = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IcoCheck = ({ s = 11 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IcoWarn = ({ s = 11 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IcoCal = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IcoUsers = ({ s = 11 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
// Filled circle check — "payé en intégralité"
const IcoCheckFull = ({ s = 11 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
  </svg>
);

const IcoPencil = ({ s = 11 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TIME_OPTS = Array.from({ length: 25 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function ActivityIcon({ activite, s = 11 }: { activite?: string | null; s?: number }) {
  if (activite === "paddle")
    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l4 4m14 14l-4-4M17 3l-4 4-4-4M7 21l4-4 4 4"/></svg>;
  if (activite === "kayak")
    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20M5 7l7 5 7-5M5 17l7-5 7 5"/></svg>;
  if (activite === "hybride")
    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EventPill
// ─────────────────────────────────────────────────────────────────────────────

function EventPill({
  event,
  payment,
  onClick,
}: {
  event: CalendarEvent;
  payment?: PaymentDetection;
  onClick: () => void;
}) {
  const cs = getClientStyle(event.type_client);
  const days = daysUntil(event.date_event);
  const isPaymentDetected = payment && payment.cas !== 4;
  const warn = !event.acompte_recu && !isPaymentDetected && days >= 0 && days < 7;

  // Override pill color for fully paid events
  const pillBg = payment?.cas === 2 ? "rgba(21,128,61,0.13)" : cs.bg;
  const pillColor = payment?.cas === 2 ? "#15803d" : cs.text;

  const typeLabel = event.type_client ? (TYPE_SHORT[event.type_client] ?? null) : null;
  const typeEmoji = event.manuel ? "📅" : (event.type_client ? (TYPE_EMOJI[event.type_client] ?? "") : "");

  const name = event.nom_client || event.titre;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left px-1.5 rounded-[6px] hover:brightness-95 transition-all overflow-hidden"
      style={{ backgroundColor: pillBg, color: pillColor }}
    >
      {/* ── Mobile : colonne 3 lignes ── */}
      <div className="flex flex-col items-start py-1 gap-[1px] sm:hidden" style={{ minHeight: 52 }}>
        {/* Ligne 1 : emoji + type */}
        <span className="text-[9px] font-bold opacity-75 uppercase tracking-wide leading-none whitespace-nowrap">
          {typeEmoji}{typeLabel ? ` ${typeLabel}` : ""}
        </span>
        {/* Ligne 2 : nom tronqué */}
        <span className="text-[10px] font-bold leading-tight w-full overflow-hidden whitespace-nowrap" style={{ textOverflow: "ellipsis", display: "block" }}>
          {name}
        </span>
        {/* Ligne 3 : heure + indicateurs paiement */}
        <div className="flex items-center gap-0.5">
          {event.heure_debut && (
            <span className="text-[9px] opacity-65 font-medium leading-none">{formatH(event.heure_debut)}</span>
          )}
          {payment?.cas === 2 && <IcoCheckFull s={8}/>}
          {payment?.cas === 1 && <IcoCheck s={8}/>}
          {warn && <span style={{ color: "#EA580C" }}><IcoWarn s={8}/></span>}
        </div>
      </div>

      {/* ── Desktop : ligne horizontale ── */}
      <div className="hidden sm:flex items-center gap-0.5 py-[3px] min-h-[24px]">
        {typeEmoji && (
          <span className="shrink-0 text-[11px] leading-none mr-0.5">{typeEmoji}</span>
        )}
        {typeLabel && (
          <span className="shrink-0 text-[9px] font-bold opacity-70 uppercase tracking-wide leading-none whitespace-nowrap">
            {typeLabel} ·&nbsp;
          </span>
        )}
        <span className="truncate flex-1 text-[12px] font-bold leading-tight">{name}</span>
        {event.heure_debut && (
          <span className="shrink-0 text-[9px] opacity-65 font-medium ml-0.5 whitespace-nowrap">{formatH(event.heure_debut)}</span>
        )}
        {payment?.cas === 2 && (
          <span className="shrink-0 ml-0.5" style={{ color: "#15803d" }}><IcoCheckFull s={10}/></span>
        )}
        {payment?.cas === 1 && (
          <span className="shrink-0 ml-0.5" style={{ color: "#16A34A" }}><IcoCheck s={9}/></span>
        )}
        {(!payment || payment.cas === 4) && event.acompte_recu && (
          <span className="shrink-0 opacity-70 ml-0.5"><IcoCheck s={9}/></span>
        )}
        {warn && (
          <span className="shrink-0 ml-0.5" style={{ color: "#EA580C" }}><IcoWarn s={9}/></span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month View
// ─────────────────────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  today,
  eventsByDate,
  paymentByEventId,
  onEventClick,
  onDayClick,
}: {
  currentDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  paymentByEventId: Map<string, PaymentDetection>;
  onEventClick: (ev: CalendarEvent) => void;
  onDayClick: (d: Date) => void;
}) {
  const grid = useMemo(
    () => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );
  const MAX = 3;

  return (
    <div className="flex flex-col h-full select-none">
      <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
        {JOURS_COURTS.map((j) => (
          <div key={j} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {j}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: "repeat(6, minmax(0, 1fr))" }}>
        {grid.map((day, idx) => {
          const iso = toISO(day);
          const isToday = isSameDay(day, today);
          const isCurMonth = day.getMonth() === currentDate.getMonth();
          const dayEvs = eventsByDate.get(iso) ?? [];
          const overflow = dayEvs.length - MAX;
          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={`relative border-b border-r border-gray-100 cursor-pointer transition-colors p-1 sm:p-1.5 ${
                isCurMonth ? "hover:bg-slate-50/70" : "bg-gray-50/40"
              }`}
            >
              <div className="flex justify-end mb-0.5 sm:mb-1">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[11px] sm:text-xs font-semibold rounded-full transition-colors ${
                    isToday
                      ? "bg-[#0071E3] text-white"
                      : isCurMonth
                      ? "text-gray-800 hover:bg-gray-100"
                      : "text-gray-300"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-[2px]">
                {dayEvs.slice(0, MAX).map((ev) => (
                  <EventPill
                    key={ev.id}
                    event={ev}
                    payment={paymentByEventId.get(ev.id)}
                    onClick={() => onEventClick(ev)}
                  />
                ))}
                {overflow > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDayClick(day); }}
                    className="text-[10px] font-semibold text-[#0071E3] pl-1 text-left hover:underline"
                  >
                    +{overflow} autre{overflow > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Week View
// ─────────────────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  today,
  eventsByDate,
  paymentByEventId,
  onEventClick,
  onDayClick,
}: {
  currentDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  paymentByEventId: Map<string, PaymentDetection>;
  onEventClick: (ev: CalendarEvent) => void;
  onDayClick: (d: Date) => void;
}) {
  const days = useMemo(() => getWeekDays(currentDate), [currentDate]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex shrink-0 border-b border-gray-100 bg-white">
        <div className="w-10 sm:w-14 shrink-0" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className="flex-1 py-2 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {JOURS_COURTS[i]}
              </div>
              <div
                className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 mx-auto mt-0.5 rounded-full text-xs sm:text-sm font-bold ${
                  isToday ? "bg-[#0071E3] text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-1 overflow-y-auto">
        <div className="w-10 sm:w-14 shrink-0 relative" style={{ height: `${HOURS.length * SLOT_PX}px` }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-1 sm:right-2 text-[9px] sm:text-[10px] text-gray-400 font-medium"
              style={{ top: `${(h - 7) * SLOT_PX}px`, transform: "translateY(-50%)" }}
            >
              {h}h
            </div>
          ))}
        </div>
        {days.map((day, di) => {
          const iso = toISO(day);
          const dayEvs = eventsByDate.get(iso) ?? [];
          const isToday = isSameDay(day, today);
          return (
            <div
              key={di}
              className={`flex-1 relative border-l border-gray-100 ${isToday ? "bg-blue-50/15" : ""}`}
              style={{ height: `${HOURS.length * SLOT_PX}px` }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full border-t border-gray-100"
                  style={{ top: `${(h - 7) * SLOT_PX}px` }}
                />
              ))}
              {dayEvs.map((ev) => {
                let top = 0;
                if (ev.heure_debut) {
                  const [hh, mm] = ev.heure_debut.split(":").map(Number);
                  top = Math.max(0, hh - 7 + (mm || 0) / 60) * SLOT_PX;
                }
                const payment = paymentByEventId.get(ev.id);
                const cs = getClientStyle(ev.type_client);
                const cardBg = payment?.cas === 2 ? "rgba(21,128,61,0.13)" : cs.bg;
                const cardColor = payment?.cas === 2 ? "#15803d" : cs.text;
                const borderColor = payment?.cas === 2 ? "#15803d" : cs.text;
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="absolute left-0.5 right-0.5 rounded-lg px-1.5 sm:px-2 py-1 text-left hover:brightness-95 transition-all overflow-hidden"
                    style={{
                      top: `${top + 2}px`,
                      minHeight: "40px",
                      backgroundColor: cardBg,
                      color: cardColor,
                      borderLeft: `2.5px solid ${borderColor}`,
                    }}
                  >
                    {/* Top row: emoji + type + name + heure */}
                    <div className="flex items-center gap-0.5 leading-tight">
                      {(ev.manuel ? "📅" : (ev.type_client ? (TYPE_EMOJI[ev.type_client] ?? "") : "")) && (
                        <span className="shrink-0 text-[10px] leading-none mr-0.5">
                          {ev.manuel ? "📅" : (TYPE_EMOJI[ev.type_client ?? ""] ?? "")}
                        </span>
                      )}
                      <span className="hidden sm:inline shrink-0 text-[8px] font-bold opacity-65 uppercase tracking-wide whitespace-nowrap">
                        {ev.type_client ? ((TYPE_SHORT[ev.type_client] ?? "") + " · ") : ""}
                      </span>
                      <span className="truncate flex-1 text-[11px] font-bold">{ev.nom_client || ev.titre}</span>
                      {ev.heure_debut && (
                        <span className="shrink-0 text-[9px] opacity-65 font-medium ml-0.5 whitespace-nowrap">{formatH(ev.heure_debut)}</span>
                      )}
                    </div>
                    {/* Payment row */}
                    {(payment?.cas === 2 || payment?.cas === 1) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {payment.cas === 2 && <IcoCheckFull s={8}/>}
                        {payment.cas === 1 && <IcoCheck s={8}/>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day View
// ─────────────────────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  today,
  eventsByDate,
  paymentByEventId,
  onEventClick,
}: {
  currentDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  paymentByEventId: Map<string, PaymentDetection>;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const iso = toISO(currentDate);
  const dayEvs = eventsByDate.get(iso) ?? [];
  const withTime = dayEvs.filter((e) => e.heure_debut);
  const noTime = dayEvs.filter((e) => !e.heure_debut);
  const isToday = isSameDay(currentDate, today);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {JOURS_LONGS[(currentDate.getDay() + 6) % 7]}
        </div>
        <div className={`text-2xl font-bold tracking-tight mt-0.5 ${isToday ? "text-[#0071E3]" : "text-gray-900"}`}>
          {currentDate.getDate()} {MOIS_NOMS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </div>
        {dayEvs.length === 0 && (
          <div className="text-sm text-gray-400 mt-1">Aucun événement ce jour</div>
        )}
      </div>
      {noTime.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1.5 shrink-0">
          {noTime.map((ev) => (
            <EventPill
              key={ev.id}
              event={ev}
              payment={paymentByEventId.get(ev.id)}
              onClick={() => onEventClick(ev)}
            />
          ))}
        </div>
      )}
      <div className="flex flex-1 overflow-y-auto">
        <div className="w-10 sm:w-16 shrink-0 relative" style={{ height: `${HOURS.length * SLOT_PX}px` }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-1 sm:right-2 text-[10px] text-gray-400 font-medium"
              style={{ top: `${(h - 7) * SLOT_PX}px`, transform: "translateY(-50%)" }}
            >
              {h}h
            </div>
          ))}
        </div>
        <div
          className="flex-1 relative border-l border-gray-100"
          style={{ height: `${HOURS.length * SLOT_PX}px` }}
        >
          {HOURS.map((h) => (
            <div key={h} className="absolute w-full border-t border-gray-100" style={{ top: `${(h - 7) * SLOT_PX}px` }} />
          ))}
          {withTime.map((ev) => {
            const [hh, mm] = (ev.heure_debut || "8:00").split(":").map(Number);
            const top = Math.max(0, hh - 7 + (mm || 0) / 60) * SLOT_PX;
            const payment = paymentByEventId.get(ev.id);
            const cs = getClientStyle(ev.type_client);
            const cardBg = payment?.cas === 2 ? "rgba(21,128,61,0.13)" : cs.bg;
            const cardColor = payment?.cas === 2 ? "#15803d" : cs.text;
            const borderColor = payment?.cas === 2 ? "#15803d" : cs.text;
            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="absolute left-2 right-2 sm:left-3 sm:right-3 rounded-xl px-3 py-2.5 text-left hover:brightness-95 transition-all"
                style={{
                  top: `${top + 2}px`,
                  minHeight: "52px",
                  backgroundColor: cardBg,
                  color: cardColor,
                  borderLeft: `3px solid ${borderColor}`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-[16px] leading-none">
                    {ev.manuel ? "📅" : (TYPE_EMOJI[ev.type_client ?? ""] ?? "")}
                  </span>
                  <div className="min-w-0">
                    {ev.type_client && !ev.manuel && (
                      <div className="text-[9px] font-bold opacity-60 uppercase tracking-wider leading-none mb-0.5">
                        {TYPE_SHORT[ev.type_client] ?? ""}
                      </div>
                    )}
                    <div className="text-sm font-bold truncate">{ev.nom_client || ev.titre}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] opacity-75">
                  {ev.heure_debut && <span>{formatH(ev.heure_debut)}</span>}
                  {ev.nb_personnes != null && <span>{ev.nb_personnes} pers.</span>}
                  {ev.montant != null && <span>{formatPrice(ev.montant)}</span>}
                  {payment?.cas === 2 && (
                    <span className="flex items-center gap-1" style={{ color: "#15803d" }}>
                      <IcoCheckFull s={10}/> Payé intégralement
                    </span>
                  )}
                  {payment?.cas === 1 && (
                    <span className="flex items-center gap-1" style={{ color: "#16A34A" }}>
                      <IcoCheck s={10}/> Acompte reçu
                    </span>
                  )}
                  {(!payment || payment.cas === 4) && ev.acompte_recu && (
                    <span className="flex items-center gap-1"><IcoCheck s={10}/> Acompte OK</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Year View
// ─────────────────────────────────────────────────────────────────────────────

function YearView({
  year,
  today,
  eventsByDate,
  onMonthClick,
}: {
  year: number;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onMonthClick: (m: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 overflow-y-auto flex-1">
      {Array.from({ length: 12 }, (_, m) => {
        const grid = getMonthGrid(year, m);
        return (
          <button
            key={m}
            onClick={() => onMonthClick(m)}
            className="rounded-2xl border border-gray-200 p-3 sm:p-4 hover:border-[#0071E3] hover:shadow-md transition-all text-left bg-white"
          >
            <div className="text-xs font-bold text-gray-700 mb-2.5">{MOIS_NOMS[m]}</div>
            <div className="grid grid-cols-7 gap-px mb-1">
              {JOURS_COURTS.map((j) => (
                <div key={j} className="text-[7px] text-gray-300 text-center font-bold">{j[0]}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {grid.map((day, idx) => {
                const iso = toISO(day);
                const isCurM = day.getMonth() === m;
                const isT = isSameDay(day, today);
                const hasEv = isCurM && (eventsByDate.get(iso)?.length ?? 0) > 0;
                const evColor = hasEv ? getClientStyle(eventsByDate.get(iso)![0].type_client).solid : null;
                return (
                  <div
                    key={idx}
                    className={`relative flex items-center justify-center rounded-sm text-[8px] font-medium ${
                      isT
                        ? "bg-[#0071E3] text-white rounded-full"
                        : isCurM
                        ? "text-gray-700"
                        : "text-gray-200"
                    }`}
                    style={{ width: "18px", height: "18px" }}
                  >
                    {isCurM ? day.getDate() : ""}
                    {hasEv && !isT && (
                      <span
                        className="absolute bottom-[1px] w-[4px] h-[4px] rounded-full"
                        style={{ backgroundColor: evColor ?? "#0071E3" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

function EventModal({
  event,
  payment,
  onClose,
  onUpdate,
  onDelete,
}: {
  event: CalendarEvent;
  payment?: PaymentDetection;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  onDelete: (id: string, devisId?: string | null) => Promise<void>;
}) {
  const cs = getClientStyle(event.type_client);
  const days = daysUntil(event.date_event);
  const isPaymentDetected = payment && payment.cas !== 4;
  const warn = !event.acompte_recu && !isPaymentDetected && days >= 0 && days < 7;
  const [acompte, setAcompte] = useState(event.acompte_recu);
  const [acompteMontant, setAcompteMontant] = useState(event.acompte_montant?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<DevisRecord | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [editingHeure, setEditingHeure] = useState(false);

  // quick-edit fields (non-manual events)
  const [nomClient, setNomClient] = useState(event.nom_client ?? "");
  const [nbPersonnes, setNbPersonnes] = useState<number>(event.nb_personnes ?? 0);
  const [activite, setActivite] = useState(event.activite ?? "");
  const [duration, setDuration] = useState<Duration | "">("");
  const [editingNom, setEditingNom] = useState(false);
  const [editingNb, setEditingNb] = useState(false);
  const [editingActiv, setEditingActiv] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  // cached devis record — loaded once on mount for non-manual events
  const [devisRecord, setDevisRecord] = useState<DevisRecord | null>(null);

  useEffect(() => {
    if (!event.devis_id) return;
    getDevisById(event.devis_id).then((r) => {
      if (!r) return;
      setDevisRecord(r);
      setDuration(r.formData.duration ?? "");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // manual edit fields
  const [titre, setTitre] = useState(event.titre);
  const [date, setDate] = useState(event.date_event);
  const [heure, setHeure] = useState(event.heure_debut ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");

  async function openPreview() {
    if (!event.devis_id) return;
    setLoadingPreview(true);
    try {
      const record = await getDevisById(event.devis_id);
      if (record) {
        // Rebuild description from current form data to guarantee POUR block = activity row
        const rebuiltDesc = buildAutoDescription(record.formData);
        const freshFormData = { ...record.formData, prestationDescription: rebuiltDesc };
        const freshRecord = { ...record, formData: freshFormData };
        // Persist if stale (covers records saved before this fix)
        if (rebuiltDesc !== record.formData.prestationDescription) {
          saveDevis(freshRecord).catch(() => {});
        }
        setDevisRecord(freshRecord);
        setPreviewRecord(freshRecord);
      }
    } finally {
      setLoadingPreview(false);
    }
  }

  async function toggleAcompte(val: boolean) {
    setAcompte(val);
    setSaving(true);
    try {
      await onUpdate(event.id, {
        acompte_recu: val,
        acompte_montant: val && acompteMontant ? parseFloat(acompteMontant) : null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveAcompteMontant() {
    await onUpdate(event.id, { acompte_montant: acompteMontant ? parseFloat(acompteMontant) : null });
  }

  async function saveManual() {
    setSaving(true);
    try {
      await onUpdate(event.id, { titre, date_event: date, heure_debut: heure || null, notes: notes || null });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function saveHeure(val: string) {
    setSaving(true);
    try {
      await onUpdate(event.id, { heure_debut: val || null });
      if (event.devis_id) await updateDevisHeure(event.devis_id, val);
      setHeure(val);
      setEditingHeure(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveCalendarField(
    field: "nom_client" | "nb_personnes" | "activite",
    value: string | number
  ) {
    setSavingField(field);
    try {
      const calPatch: Partial<CalendarEvent> = {};
      if (field === "nom_client") {
        const actLabel = activite ? (ACT_LABELS[activite] ?? null) : null;
        calPatch.nom_client = value as string;
        calPatch.titre = [actLabel, value as string].filter(Boolean).join(" — ") || (value as string);
      } else if (field === "activite") {
        const actLabel = value ? (ACT_LABELS[value as string] ?? null) : null;
        const nom = nomClient || event.nom_client || event.titre;
        calPatch.activite = (value as string) || null;
        calPatch.titre = [actLabel, nom].filter(Boolean).join(" — ") || nom;
      } else if (field === "nb_personnes") {
        calPatch.nb_personnes = value as number;
      }

      if (event.devis_id) {
        const record = devisRecord ?? await getDevisById(event.devis_id);
        if (record) {
          const newFormData = { ...record.formData };
          if (field === "nom_client") newFormData.clientName = value as string;
          if (field === "nb_personnes") newFormData.participantsCount = value as number;
          if (field === "activite") newFormData.activity = ((value as string) || "none") as ActivityType;
          newFormData.prestationDescription = buildAutoDescription(newFormData);
          const calc = calculateDevis(newFormData);
          if (field === "nb_personnes" || field === "activite") calPatch.montant = calc.totalNet;
          const updatedRecord = {
            ...record,
            formData: newFormData,
            ...(field === "nom_client" ? { clientName: value as string } : {}),
            ...(field === "nb_personnes" ? { participantsCount: value as number } : {}),
            totalBrut: calc.totalBrut,
            totalNet: calc.totalNet,
          };
          await saveDevis(updatedRecord);
          setDevisRecord(updatedRecord);
        }
      }

      await onUpdate(event.id, calPatch);
      if (field === "nom_client") setEditingNom(false);
      if (field === "nb_personnes") setEditingNb(false);
      if (field === "activite") setEditingActiv(false);
    } finally {
      setSavingField(null);
    }
  }

  async function saveDuration(val: Duration) {
    setSavingField("duration");
    try {
      const record = devisRecord ?? (event.devis_id ? await getDevisById(event.devis_id) : null);
      if (!record) return;
      const newFormData = { ...record.formData, duration: val };
      newFormData.prestationDescription = buildAutoDescription(newFormData);
      const calc = calculateDevis(newFormData);
      const updatedRecord = { ...record, formData: newFormData, totalBrut: calc.totalBrut, totalNet: calc.totalNet };
      await saveDevis(updatedRecord);
      await onUpdate(event.id, { montant: calc.totalNet });
      setDevisRecord(updatedRecord);
      setDuration(val);
      setEditingDuration(false);
    } finally {
      setSavingField(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(event.id, event.devis_id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "slideUp 0.28s cubic-bezier(0.16,1,0.3,1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[3px] w-full" style={{ backgroundColor: payment?.cas === 2 ? "#15803d" : cs.solid }} />

        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-2 pb-0 sm:hidden">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: cs.bg, color: cs.text }}
              >
                {cs.label}
              </span>
              {event.activite && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500">
                  <ActivityIcon activite={event.activite} s={10} />
                  {ACT_LABELS[event.activite] ?? event.activite}
                </span>
              )}
              {event.manuel && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                  Manuel
                </span>
              )}
            </div>
            {event.manuel ? (
              <h3 className="text-base font-bold text-gray-900 leading-snug">{titre}</h3>
            ) : editingNom ? (
              <input
                autoFocus
                value={nomClient}
                onChange={(e) => setNomClient(e.target.value)}
                onBlur={() => saveCalendarField("nom_client", nomClient)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCalendarField("nom_client", nomClient);
                  if (e.key === "Escape") setEditingNom(false);
                }}
                disabled={savingField === "nom_client"}
                className="w-full text-base font-bold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] disabled:opacity-50"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-gray-900 leading-snug">
                  {nomClient || event.nom_client || event.titre}
                </h3>
                {!savingField && (
                  <button
                    onClick={() => setEditingNom(true)}
                    className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    title="Modifier le nom"
                  >
                    <IcoPencil s={11} />
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
          >
            <IcoX s={15} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {!event.manuel ? (
            <>
              {/* Date & heure */}
              <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                <IcoCal s={13} />
                <span>{longDateLabel(event.date_event)}</span>
                {!editingHeure ? (
                  heure ? (
                    <div className="flex items-center gap-1">
                      <span>· {formatH(heure)}</span>
                      <button
                        onClick={() => setEditingHeure(true)}
                        className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Modifier l'heure"
                      >
                        <IcoPencil s={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingHeure(true)}
                      className="text-xs font-semibold ml-0.5 hover:underline"
                      style={{ color: "#0071E3" }}
                    >
                      + Ajouter une heure
                    </button>
                  )
                ) : (
                  <select
                    autoFocus
                    value={heure}
                    onChange={(e) => saveHeure(e.target.value)}
                    onBlur={() => setEditingHeure(false)}
                    disabled={saving}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] disabled:opacity-50"
                  >
                    <option value="">— Non définie</option>
                    {TIME_OPTS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Stats grid — activité + participants éditables */}
              <div className="grid grid-cols-2 gap-2">
                {/* Activité */}
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activité</span>
                    {!editingActiv && !savingField && (
                      <button onClick={() => setEditingActiv(true)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors" title="Modifier">
                        <IcoPencil s={9}/>
                      </button>
                    )}
                  </div>
                  {editingActiv ? (
                    <select
                      autoFocus
                      value={activite}
                      onChange={(e) => { setActivite(e.target.value); saveCalendarField("activite", e.target.value); }}
                      onBlur={() => setEditingActiv(false)}
                      disabled={savingField === "activite"}
                      className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-[#0071E3] bg-white disabled:opacity-50"
                    >
                      <option value="">—</option>
                      <option value="paddle">Paddle</option>
                      <option value="kayak">Kayak</option>
                      <option value="hybride">Hybride</option>
                    </select>
                  ) : (
                    <div className="text-sm font-bold text-gray-800 flex items-center gap-1">
                      <ActivityIcon activite={activite || null} s={11} />
                      {activite ? (ACT_LABELS[activite] ?? activite) : <span className="font-normal text-gray-400">—</span>}
                      {savingField === "activite" && <span className="text-[10px] text-gray-400">...</span>}
                    </div>
                  )}
                </div>

                {/* Durée */}
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Durée</span>
                    {!editingDuration && !savingField && (
                      <button onClick={() => setEditingDuration(true)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors" title="Modifier">
                        <IcoPencil s={9}/>
                      </button>
                    )}
                  </div>
                  {editingDuration ? (
                    <select
                      autoFocus
                      value={duration}
                      onChange={(e) => saveDuration(e.target.value as Duration)}
                      onBlur={() => setEditingDuration(false)}
                      disabled={savingField === "duration"}
                      className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-[#0071E3] bg-white disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {DURATIONS.map((d) => (
                        <option key={d} value={d}>{DURATION_LABELS[d]}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm font-bold text-gray-800">
                      {duration ? DURATION_LABELS[duration] : <span className="font-normal text-gray-400">—</span>}
                      {savingField === "duration" && <span className="text-[10px] text-gray-400 ml-1">...</span>}
                    </div>
                  )}
                </div>

                {/* Participants */}
                {event.nb_personnes != null && (
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <IcoUsers s={10} />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Personnes</span>
                      </div>
                      {!editingNb && !savingField && (
                        <button onClick={() => setEditingNb(true)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors" title="Modifier">
                          <IcoPencil s={9}/>
                        </button>
                      )}
                    </div>
                    {editingNb ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setNbPersonnes(p => Math.max(1, p - 1))} className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-xs font-bold hover:bg-gray-300 shrink-0">−</button>
                        <span className="text-sm font-bold text-gray-800 w-7 text-center tabular-nums">{nbPersonnes}</span>
                        <button onClick={() => setNbPersonnes(p => p + 1)} className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-xs font-bold hover:bg-gray-300 shrink-0">+</button>
                        <button
                          onClick={() => saveCalendarField("nb_personnes", nbPersonnes)}
                          disabled={savingField === "nb_personnes"}
                          className="ml-0.5 text-[11px] font-bold text-white px-1.5 py-0.5 rounded disabled:opacity-50"
                          style={{ backgroundColor: "#0071E3" }}
                        >OK</button>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-gray-800">
                        {nbPersonnes} pers.
                        {savingField === "nb_personnes" && <span className="text-[10px] text-gray-400 ml-1">...</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Montant */}
                {event.montant != null && (
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Montant</div>
                    <div className="text-sm font-bold" style={{ color: "#0071E3" }}>{formatPrice(event.montant)}</div>
                  </div>
                )}
              </div>

              {/* Payment detection block */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                {/* Auto-detection result */}
                <div className={`px-4 py-3 flex items-start gap-3 ${
                  payment?.cas === 2 ? "bg-green-50" :
                  payment?.cas === 1 ? "bg-emerald-50/70" :
                  "bg-gray-50"
                }`}>
                  {payment?.cas === 2 && (
                    <>
                      <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center shrink-0 mt-0.5 text-white">
                        <IcoCheckFull s={14}/>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-green-800">Payé en intégralité</div>
                        <div className="text-xs text-green-700 mt-0.5">
                          {formatPriceExact(payment.montant!)} — détecté automatiquement
                        </div>
                      </div>
                    </>
                  )}
                  {payment?.cas === 1 && (
                    <>
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5 text-white">
                        <IcoCheck s={13}/>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-800">Acompte 30% reçu</div>
                        <div className="text-xs text-emerald-700 mt-0.5">
                          {formatPriceExact(payment.montant!)} — détecté automatiquement
                          {event.montant != null && (
                            <span className="text-emerald-500"> (attendu {formatPriceExact(event.montant * 0.3)})</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {(!payment || payment.cas === 4) && (
                    <>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white ${warn ? "bg-orange-400" : "bg-gray-300"}`}>
                        <IcoWarn s={13}/>
                      </div>
                      <div>
                        <div className={`text-sm font-semibold ${warn ? "text-orange-700" : "text-gray-500"}`}>
                          Aucun paiement détecté
                        </div>
                        {warn && (
                          <div className="text-xs mt-0.5" style={{ color: "#EA580C" }}>
                            Prestation dans {days === 0 ? "aujourd'hui" : `${days} jour${days > 1 ? "s" : ""}`}
                          </div>
                        )}
                        {!warn && event.montant != null && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Acompte attendu : {formatPriceExact(event.montant * 0.3)}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Manual override toggle */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <div>
                    <div className="text-xs font-semibold text-gray-600">
                      {isPaymentDetected ? "Confirmer manuellement" : "Valider manuellement"}
                    </div>
                    {acompte && event.acompte_montant && (
                      <div className="text-xs text-gray-400 mt-0.5">{formatPrice(event.acompte_montant)} enregistré</div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAcompte(!acompte)}
                    disabled={saving}
                    className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 shrink-0"
                    style={{ backgroundColor: acompte ? "#16A34A" : "#D1D5DB" }}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                      style={{ transform: `translateX(${acompte ? "22px" : "3px"})` }}
                    />
                  </button>
                </div>

                {/* Amount input */}
                {acompte && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      Montant confirmé
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={acompteMontant}
                        onChange={(e) => setAcompteMontant(e.target.value)}
                        onBlur={saveAcompteMontant}
                        placeholder="0"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A]"
                      />
                      <span className="text-sm text-gray-500 font-medium">€</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Manual event edit form */
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Titre</label>
                <input
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                  />
                </div>
                <div className="w-28">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Heure</label>
                  <input
                    type="time"
                    value={heure}
                    onChange={(e) => setHeure(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {confirmingDelete ? (
              /* ── Confirmation de suppression ── */
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-800 mb-0.5">Supprimer cet événement ?</p>
                <p className="text-xs text-red-600 mb-2">
                  {event.nom_client || event.titre} — {longDateLabel(event.date_event)}
                </p>
                {event.devis_id && (
                  <div className="flex items-start gap-1.5 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 mb-3">
                    <IcoWarn s={12} />
                    <span className="text-xs text-orange-700 leading-snug">
                      Le devis lié sera également supprimé des archives.
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 h-9 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                    style={{ backgroundColor: "#E03131" }}
                  >
                    {deleting ? "Suppression..." : "Confirmer"}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="flex-1 h-9 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Aperçu du devis button — only for devis-linked events */}
                {!event.manuel && event.devis_id && (
                  <button
                    onClick={openPreview}
                    disabled={loadingPreview}
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "#0071E3", color: "#fff" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    {loadingPreview ? "Chargement..." : "Aperçu du devis"}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  {event.manuel ? (
                    <>
                      <button
                        onClick={saveManual}
                        disabled={saving}
                        className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                        style={{ backgroundColor: "#0071E3" }}
                      >
                        {saving ? "Sauvegarde..." : "Enregistrer"}
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="h-10 px-3 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors hover:bg-red-50"
                        style={{ color: "#E03131" }}
                      >
                        <IcoTrash s={14} />
                        Supprimer
                      </button>
                    </>
                  ) : (
                    <>
                      <a
                        href="/historique"
                        className="flex-1 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-colors hover:bg-blue-100"
                        style={{ color: "#0071E3", backgroundColor: "#EBF4FF" }}
                      >
                        Voir dans Archives
                      </a>
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="h-10 px-3 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors hover:bg-red-50"
                        style={{ color: "#E03131" }}
                      >
                        <IcoTrash s={14} />
                        <span className="hidden sm:inline">Retirer</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DocumentPreview overlay */}
      {previewRecord && (
        <DocumentPreview
          form={previewRecord.formData}
          calc={calculateDevis(previewRecord.formData)}
          onClose={() => setPreviewRecord(null)}
          onFormChange={() => {}}
          readOnly
          existingNumero={previewRecord.numero}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Event Modal
// ─────────────────────────────────────────────────────────────────────────────

function AddEventModal({
  defaultDate,
  onClose,
  onSave,
}: {
  defaultDate: string;
  onClose: () => void;
  onSave: (ev: Partial<CalendarEvent>) => Promise<void>;
}) {
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [heure, setHeure] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim() || !date) return;
    setSaving(true);
    try {
      await onSave({ titre: titre.trim(), date_event: date, heure_debut: heure || null, notes: notes || null, manuel: true, acompte_recu: false });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl px-5 pt-5 pb-6"
        style={{ animation: "slideUp 0.28s cubic-bezier(0.16,1,0.3,1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex sm:hidden justify-center mb-3">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Nouvel événement manuel</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <IcoX s={15} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Titre *</label>
            <input
              required
              autoFocus
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Réunion, Blocage date..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Date *</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
              />
            </div>
            <div className="w-28">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Heure</label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optionnel..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !titre.trim()}
          className="mt-4 w-full h-11 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
          style={{ backgroundColor: "#0071E3" }}
        >
          {saving ? "Création..." : "Créer l'événement"}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

type ViewType = "mois" | "semaine" | "jour" | "annee";

const VIEW_OPTS: { key: ViewType; short: string; long: string }[] = [
  { key: "jour",    short: "J",  long: "Jour" },
  { key: "semaine", short: "S",  long: "Semaine" },
  { key: "mois",    short: "M",  long: "Mois" },
  { key: "annee",   short: "A",  long: "Année" },
];

export default function CalendarPage() {
  const [view, setView] = useState<ViewType>("mois");
  const [currentDate, setCurrentDate] = useState(todayDate);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [acompteEntries, setAcompteEntries] = useState<AcompteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const today = useMemo(todayDate, []);
  const mountedRef = useRef(false);

  // Compute fetch range
  const fetchRange = useMemo(() => {
    if (view === "annee") {
      const y = currentDate.getFullYear();
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    if (view === "mois") {
      const grid = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
      return { from: toISO(grid[0]), to: toISO(grid[41]) };
    }
    if (view === "semaine") {
      const days = getWeekDays(currentDate);
      return { from: toISO(days[0]), to: toISO(days[6]) };
    }
    return { from: toISO(currentDate), to: toISO(currentDate) };
  }, [view, currentDate]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCalendarEventsInRange(fetchRange.from, fetchRange.to);
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [fetchRange]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch("/api/calendar-sync", { method: "POST" });
      const [eventsData, acomptes] = await Promise.all([
        getCalendarEventsInRange(fetchRange.from, fetchRange.to),
        getAcompteEntries(),
      ]);
      setEvents(eventsData);
      setAcompteEntries(acomptes);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [fetchRange]);

  // On mount: auto-sync (loads both events and acompte entries)
  useEffect(() => {
    handleSync();
    mountedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On range change after mount: reload events only
  useEffect(() => {
    if (mountedRef.current) loadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRange]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date_event) ?? [];
      list.push(ev);
      map.set(ev.date_event, list);
    }
    return map;
  }, [events]);

  // Pre-compute payment detection for all non-manual events
  const paymentByEventId = useMemo(() => {
    const map = new Map<string, PaymentDetection>();
    const nonManual = events.filter(ev => !ev.manuel && (ev.montant ?? 0) > 0);
    if (nonManual.length === 0 || acompteEntries.length === 0) return map;

    // Build all candidate matches with their precision score
    type Candidate = { eventId: string; entryId: string; cas: 1 | 2; diff: number; montant: number };
    const candidates: Candidate[] = [];

    for (const ev of nonManual) {
      const mont = ev.montant!;
      const expected30 = mont * 0.3;
      for (const e of acompteEntries) {
        const diffFull = Math.abs(e.montant - mont);
        if (diffFull <= PAYMENT_TOL)
          candidates.push({ eventId: ev.id, entryId: e.id, cas: 2, diff: diffFull, montant: e.montant });
        const diff30 = Math.abs(e.montant - expected30);
        if (diff30 <= PAYMENT_TOL)
          candidates.push({ eventId: ev.id, entryId: e.id, cas: 1, diff: diff30, montant: e.montant });
      }
    }

    // Greedy: assign best match first; each entry → at most one event
    candidates.sort((a, b) => a.diff - b.diff || b.cas - a.cas); // smaller diff first; cas 2 before cas 1
    const usedEntries = new Set<string>();
    const matchedEvents = new Set<string>();
    for (const c of candidates) {
      if (usedEntries.has(c.entryId) || matchedEvents.has(c.eventId)) continue;
      map.set(c.eventId, { cas: c.cas, montant: c.montant });
      usedEntries.add(c.entryId);
      matchedEvents.add(c.eventId);
    }
    return map;
  }, [events, acompteEntries]);

  function navigate(delta: number) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === "mois")    d.setMonth(d.getMonth() + delta);
      else if (view === "semaine") d.setDate(d.getDate() + delta * 7);
      else if (view === "jour")    d.setDate(d.getDate() + delta);
      else                         d.setFullYear(d.getFullYear() + delta);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }

  function goToday() {
    setCurrentDate(todayDate());
  }

  function headerTitle() {
    if (view === "annee")   return `${currentDate.getFullYear()}`;
    if (view === "mois")    return `${MOIS_NOMS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "semaine") {
      const days = getWeekDays(currentDate);
      const f = days[0], l = days[6];
      if (f.getMonth() === l.getMonth())
        return `${f.getDate()}–${l.getDate()} ${MOIS_NOMS[f.getMonth()]} ${f.getFullYear()}`;
      return `${f.getDate()} ${MOIS_NOMS[f.getMonth()]} – ${l.getDate()} ${MOIS_NOMS[l.getMonth()]} ${l.getFullYear()}`;
    }
    return `${JOURS_LONGS[(currentDate.getDay() + 6) % 7]} ${currentDate.getDate()} ${MOIS_NOMS[currentDate.getMonth()]}`;
  }

  async function handleUpdateEvent(id: string, patch: Partial<CalendarEvent>) {
    await updateCalendarEvent(id, patch);
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setSelectedEvent((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  async function handleDeleteEvent(id: string, devisId?: string | null) {
    await deleteCalendarEvent(id); // soft-delete — survives sync
    if (devisId) await deleteDevis(devisId); // also removes devis from archives
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedEvent(null);
  }

  async function handleSaveManual(ev: Partial<CalendarEvent>) {
    const newEv = await createCalendarEvent({
      titre: ev.titre ?? "",
      date_event: ev.date_event ?? toISO(currentDate),
      heure_debut: ev.heure_debut ?? null,
      type_client: null,
      nom_client: null,
      activite: null,
      nb_personnes: null,
      montant: null,
      acompte_recu: false,
      acompte_montant: null,
      notes: ev.notes ?? null,
      manuel: true,
      created_by: getSession()?.username ?? "",
    });
    if (newEv.date_event >= fetchRange.from && newEv.date_event <= fetchRange.to) {
      setEvents((prev) =>
        [...prev, newEv].sort((a, b) => a.date_event.localeCompare(b.date_event))
      );
    }
  }

  const isAtToday = isSameDay(currentDate, today);

  return (
    <div className="flex flex-col bg-white" style={{ height: "calc(100dvh - 56px)" }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 sm:px-5 h-13 sm:h-14 border-b border-gray-100 bg-white shrink-0" style={{ minHeight: "52px" }}>
        {/* Nav arrows */}
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <IcoChevL s={15} />
          </button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <IcoChevR s={15} />
          </button>
        </div>

        {/* Title + today */}
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">
            {headerTitle()}
          </h1>
          {!isAtToday && (
            <button
              onClick={goToday}
              className="text-[11px] font-semibold shrink-0 hidden sm:block transition-colors hover:underline"
              style={{ color: "#0071E3" }}
            >
              {"Aujourd'hui"}
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* View switcher — desktop */}
        <div className="hidden sm:flex items-center rounded-xl border border-gray-200 p-0.5 gap-0.5 bg-gray-50">
          {VIEW_OPTS.map(({ key, long }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all ${
                view === key
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {long}
            </button>
          ))}
        </div>

        {/* View switcher — mobile */}
        <div className="flex sm:hidden items-center rounded-xl border border-gray-200 p-0.5 gap-0.5 bg-gray-50">
          {VIEW_OPTS.map(({ key, short }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                view === key
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-400"
              }`}
            >
              {short}
            </button>
          ))}
        </div>

        {/* Sync + Add */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Synchroniser avec les archives"
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <span className={syncing ? "block animate-spin" : "block"}>
              <IcoSync s={14} />
            </span>
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#0071E3" }}
          >
            <IcoPlus s={12} />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="shrink-0 h-0.5 bg-gray-100 overflow-hidden">
          <div className="h-full bg-[#0071E3] animate-pulse" style={{ width: "60%" }} />
        </div>
      )}

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-hidden relative">
        {view === "mois" && (
          <MonthView
            currentDate={currentDate}
            today={today}
            eventsByDate={eventsByDate}
            paymentByEventId={paymentByEventId}
            onEventClick={setSelectedEvent}
            onDayClick={(day) => { setCurrentDate(day); setView("jour"); }}
          />
        )}
        {view === "semaine" && (
          <WeekView
            currentDate={currentDate}
            today={today}
            eventsByDate={eventsByDate}
            paymentByEventId={paymentByEventId}
            onEventClick={setSelectedEvent}
            onDayClick={(day) => { setCurrentDate(day); setView("jour"); }}
          />
        )}
        {view === "jour" && (
          <DayView
            currentDate={currentDate}
            today={today}
            eventsByDate={eventsByDate}
            paymentByEventId={paymentByEventId}
            onEventClick={setSelectedEvent}
          />
        )}
        {view === "annee" && (
          <YearView
            year={currentDate.getFullYear()}
            today={today}
            eventsByDate={eventsByDate}
            onMonthClick={(m) => {
              const d = new Date(currentDate.getFullYear(), m, 1);
              d.setHours(0, 0, 0, 0);
              setCurrentDate(d);
              setView("mois");
            }}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          payment={paymentByEventId.get(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
        />
      )}
      {showAdd && (
        <AddEventModal
          defaultDate={toISO(currentDate)}
          onClose={() => setShowAdd(false)}
          onSave={handleSaveManual}
        />
      )}
    </div>
  );
}
