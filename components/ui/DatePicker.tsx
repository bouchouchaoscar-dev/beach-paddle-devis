"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_LOWER = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const DAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(str: string): string {
  if (!str) return "";
  const d = parseDate(str);
  if (!d) return "";
  return `${d.getDate()} ${MONTHS_LOWER[d.getMonth()]} ${d.getFullYear()}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Returns 0 = Monday, 6 = Sunday
function getFirstDayOfWeek(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export function DatePicker({ value, onChange }: Props) {
  const today = new Date();
  const selected = parseDate(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(
    () => selected?.getFullYear() ?? today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    () => selected?.getMonth() ?? today.getMonth()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleOpen() {
    if (!open && selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
    setOpen(o => !o);
  }

  function handleDayClick(day: number) {
    if (isPast(day)) return;
    onChange(toDateStr(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  function isSelected(day: number) {
    return !!selected &&
      selected.getFullYear() === viewYear &&
      selected.getMonth() === viewMonth &&
      selected.getDate() === day;
  }

  function isToday(day: number) {
    return today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day;
  }

  function isPast(day: number) {
    return toDateStr(new Date(viewYear, viewMonth, day)) < toDateStr(today);
  }

  const navBtn: React.CSSProperties = {
    width: "32px", height: "32px", borderRadius: "10px",
    border: "1px solid #E5E5EA", background: "white",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0,
    transition: "background 0.12s, border-color 0.12s",
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          width: "100%", height: "40px", padding: "0 12px",
          border: `1px solid ${open ? "#0071E3" : "#D2D2D7"}`,
          borderRadius: "10px", background: "white",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "8px", cursor: "pointer",
          fontSize: "14px", color: value ? "#1D1D1F" : "#8E8E93",
          transition: "border-color 0.15s",
          outline: "none",
        }}
      >
        <span>{value ? formatDisplay(value) : "Choisir une date"}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke={open ? "#0071E3" : "#8E8E93"} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300,
          background: "white", borderRadius: "16px",
          border: "1px solid #D2D2D7",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          padding: "16px", minWidth: "288px",
          userSelect: "none",
        }}>
          {/* Month / year navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <button type="button" onClick={prevMonth} style={navBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#1D1D1F" }}>
                {MONTHS[viewMonth]}
              </span>
              {/* Year with prev/next */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button type="button" onClick={() => setViewYear(y => y - 1)} style={{
                  ...navBtn, width: "22px", height: "22px", borderRadius: "6px",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6E6E73" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#6E6E73", minWidth: "36px", textAlign: "center" }}>
                  {viewYear}
                </span>
                <button type="button" onClick={() => setViewYear(y => y + 1)} style={{
                  ...navBtn, width: "22px", height: "22px", borderRadius: "6px",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6E6E73" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
            <button type="button" onClick={nextMonth} style={navBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
            {DAYS.map(d => (
              <div key={d} style={{
                textAlign: "center", fontSize: "11px", fontWeight: 600,
                color: "#8E8E93", padding: "4px 0",
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const sel = isSelected(day);
              const tod = isToday(day);
              const past = isPast(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  style={{
                    height: "36px", borderRadius: "9px", border: "none",
                    cursor: past ? "not-allowed" : "pointer", fontSize: "13px",
                    fontWeight: sel ? 700 : tod ? 600 : 400,
                    backgroundColor: past
                      ? "transparent"
                      : sel
                        ? "#0071E3"
                        : tod
                          ? "rgba(0,113,227,0.1)"
                          : "transparent",
                    color: past ? "#D2D2D7" : sel ? "white" : tod ? "#0071E3" : "#1D1D1F",
                    transition: "background-color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (past || sel) return;
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      tod ? "rgba(0,113,227,0.18)" : "rgba(0,0,0,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (past || sel) return;
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      tod ? "rgba(0,113,227,0.1)" : "transparent";
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ marginTop: "12px", borderTop: "1px solid #F2F2F2", paddingTop: "10px" }}>
            <button
              type="button"
              onClick={() => {
                const str = toDateStr(today);
                onChange(str);
                setOpen(false);
              }}
              style={{
                width: "100%", padding: "7px", borderRadius: "8px",
                border: "none", background: "rgba(0,113,227,0.06)",
                color: "#0071E3", fontSize: "12px", fontWeight: 600,
                cursor: "pointer", transition: "background 0.12s",
              }}
            >
              Aujourd&apos;hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
