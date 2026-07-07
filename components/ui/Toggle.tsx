"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  size?: "sm" | "md";
}

export function Toggle({ checked, onChange, label, size = "md" }: ToggleProps) {
  const w = size === "sm" ? "w-8" : "w-10";
  const h = size === "sm" ? "h-4" : "h-6";
  const thumb = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const translate = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => e.key === " " && onChange(!checked)}
        className={`relative inline-flex items-center ${h} ${w} shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 cursor-pointer`}
        style={{ backgroundColor: checked ? "#0071E3" : "#C7C7CC" }}
      >
        <span
          className={`pointer-events-none inline-block ${thumb} rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
            checked ? translate : "translate-x-0.5"
          }`}
        />
      </div>
      {label && <span className="text-sm font-medium text-ink-secondary">{label}</span>}
    </label>
  );
}
