"use client";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  accent?: "orange" | "teal";
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  accent = "orange",
}: SegmentedControlProps<T>) {
  const activeColor = accent === "orange" ? "#0071E3" : "#0071E3";

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-surface-border">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-3 ${size === "sm" ? "py-1 text-xs" : "py-2 text-sm"} rounded-lg font-medium transition-all duration-200 flex-1 justify-center ${
              active
                ? "shadow-soft"
                : "text-ink-secondary hover:text-ink hover:bg-white/50"
            }`}
            style={
              active
                ? { backgroundColor: "white", color: activeColor }
                : {}
            }
          >
            {opt.icon && <span>{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
