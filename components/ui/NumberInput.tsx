"use client";

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  label,
  prefix,
  suffix,
  className = "",
}: NumberInputProps) {
  function dec() {
    onChange(Math.max(min, value - step));
  }
  function inc() {
    onChange(Math.min(max, value + step));
  }

  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={dec}
          className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div className="flex items-center border border-surface-border bg-white px-3 h-9">
          {prefix && <span className="text-ink-muted text-sm mr-1">{prefix}</span>}
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            className="w-16 text-center text-sm font-semibold text-ink bg-transparent border-none outline-none font-mono"
          />
          {suffix && <span className="text-ink-muted text-sm ml-1">{suffix}</span>}
        </div>
        <button
          type="button"
          onClick={inc}
          className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  );
}
