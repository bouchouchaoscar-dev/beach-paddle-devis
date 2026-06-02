"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  type CalendarEvent,
  getCalendarEventsInRange,
  updateCalendarEvent,
  createCalendarEvent,
  deleteCalendarEvent,
  getClientStyle,
} from "@/lib/calendar";
import { getSession } from "@/lib/auth";

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
// SVG Icons (inline, no emoji)
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
// EventPill — compact pill for month / week / day views
// ─────────────────────────────────────────────────────────────────────────────

function EventPill({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const cs = getClientStyle(event.type_client);
  const days = daysUntil(event.date_event);
  const warn = !event.acompte_recu && days >= 0 && days < 7;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left px-1.5 py-[2px] rounded-[5px] text-[11px] font-semibold flex items-center gap-1 hover:brightness-95 transition-all truncate"
      style={{ backgroundColor: cs.bg, color: cs.text }}
    >
      <ActivityIcon activite={event.activite} s={10} />
      <span className="truncate flex-1">
        {event.heure_debut ? `${formatH(event.heure_debut)} ` : ""}
        {event.nom_client || event.titre}
      </span>
      {event.acompte_recu && <span className="shrink-0 opacity-80"><IcoCheck s={9}/></span>}
      {warn && <span className="shrink-0" style={{ color: "#EA580C" }}><IcoWarn s={9}/></span>}
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
  onEventClick,
  onDayClick,
}: {
  currentDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
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
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
        {JOURS_COURTS.map((j) => (
          <div key={j} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {j}
          </div>
        ))}
      </div>
      {/* Grid */}
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
                  <EventPill key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
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
  onEventClick,
  onDayClick,
}: {
  currentDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onEventClick: (ev: CalendarEvent) => void;
  onDayClick: (d: Date) => void;
}) {
  const days = useMemo(() => getWeekDays(currentDate), [currentDate]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
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
      {/* Time grid */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Hour labels */}
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
        {/* Day columns */}
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
                const cs = getClientStyle(ev.type_client);
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="absolute left-0.5 right-0.5 rounded-lg px-1.5 sm:px-2 py-1 text-left hover:brightness-95 transition-all overflow-hidden group"
                    style={{
                      top: `${top + 2}px`,
                      minHeight: "40px",
                      backgroundColor: cs.bg,
                      color: cs.text,
                      borderLeft: `2.5px solid ${cs.text}`,
                    }}
                  >
                    <div className="text-[11px] font-bold truncate leading-tight">{ev.nom_client || ev.titre}</div>
                    {ev.heure_debut && (
                      <div className="text-[10px] opacity-75 mt-0.5">{formatH(ev.heure_debut)}</div>
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
  onEventClick,
}: {
  currentDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
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
            <EventPill key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
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
            const cs = getClientStyle(ev.type_client);
            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="absolute left-2 right-2 sm:left-3 sm:right-3 rounded-xl px-3 py-2.5 text-left hover:brightness-95 transition-all"
                style={{
                  top: `${top + 2}px`,
                  minHeight: "52px",
                  backgroundColor: cs.bg,
                  color: cs.text,
                  borderLeft: `3px solid ${cs.text}`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <ActivityIcon activite={ev.activite} s={12} />
                  <span className="text-sm font-bold">{ev.nom_client || ev.titre}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] opacity-75">
                  {ev.heure_debut && <span>{formatH(ev.heure_debut)}</span>}
                  {ev.nb_personnes != null && <span>{ev.nb_personnes} pers.</span>}
                  {ev.montant != null && <span>{formatPrice(ev.montant)}</span>}
                  {ev.acompte_recu && <span className="flex items-center gap-1"><IcoCheck s={10}/> Acompte OK</span>}
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
  onClose,
  onUpdate,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const cs = getClientStyle(event.type_client);
  const days = daysUntil(event.date_event);
  const warn = !event.acompte_recu && days >= 0 && days < 7;
  const [acompte, setAcompte] = useState(event.acompte_recu);
  const [acompteMontant, setAcompteMontant] = useState(event.acompte_montant?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // manual edit fields
  const [titre, setTitre] = useState(event.titre);
  const [date, setDate] = useState(event.date_event);
  const [heure, setHeure] = useState(event.heure_debut ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");

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

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(event.id);
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
        <div className="h-[3px] w-full" style={{ backgroundColor: cs.solid }} />

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
            <h3 className="text-base font-bold text-gray-900 leading-snug">
              {event.manuel ? titre : (event.nom_client || event.titre)}
            </h3>
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
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <IcoCal s={13} />
                <span>{longDateLabel(event.date_event)}{event.heure_debut ? ` · ${formatH(event.heure_debut)}` : ""}</span>
              </div>

              {/* Stats grid */}
              {(event.nb_personnes != null || event.montant != null) && (
                <div className="grid grid-cols-2 gap-2">
                  {event.nb_personnes != null && (
                    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <IcoUsers s={11} />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Participants</span>
                      </div>
                      <div className="text-sm font-bold text-gray-800">{event.nb_personnes} pers.</div>
                    </div>
                  )}
                  {event.montant != null && (
                    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Montant</div>
                      <div className="text-sm font-bold" style={{ color: "#0071E3" }}>{formatPrice(event.montant)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Acompte block */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Acompte</div>
                    {acompte && event.acompte_montant && (
                      <div className="text-xs text-gray-500 mt-0.5">{formatPrice(event.acompte_montant)} reçu</div>
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
                {warn && !acompte && (
                  <div className="flex items-center gap-2 text-[11px] font-medium px-4 py-2.5 bg-orange-50 border-t border-orange-100" style={{ color: "#EA580C" }}>
                    <IcoWarn s={12} />
                    Acompte non reçu — prestation dans {days === 0 ? "aujourd'hui" : `${days}j`}
                  </div>
                )}
                {acompte && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Montant reçu</label>
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
          <div className="flex items-center gap-2 pt-1">
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
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-10 px-3 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors hover:bg-red-50 disabled:opacity-50"
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
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-10 px-3 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors hover:bg-red-50 disabled:opacity-50"
                  style={{ color: "#E03131" }}
                >
                  <IcoTrash s={14} />
                  <span className="hidden sm:inline">Retirer</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const today = useMemo(todayDate, []);
  const mountedRef = useRef(false);

  // Default to semaine on mobile
  useEffect(() => {
    if (window.innerWidth < 640) setView("semaine");
  }, []);

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
      await loadEvents();
    } finally {
      setSyncing(false);
    }
  }, [loadEvents]);

  // On mount: auto-sync
  useEffect(() => {
    handleSync();
    mountedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On range change after mount: reload
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

  async function handleDeleteEvent(id: string) {
    await deleteCalendarEvent(id);
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

        {/* View switcher — mobile (icon) */}
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
            onEventClick={setSelectedEvent}
            onDayClick={(day) => { setCurrentDate(day); setView("jour"); }}
          />
        )}
        {view === "semaine" && (
          <WeekView
            currentDate={currentDate}
            today={today}
            eventsByDate={eventsByDate}
            onEventClick={setSelectedEvent}
            onDayClick={(day) => { setCurrentDate(day); setView("jour"); }}
          />
        )}
        {view === "jour" && (
          <DayView
            currentDate={currentDate}
            today={today}
            eventsByDate={eventsByDate}
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
