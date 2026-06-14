interface StatBarProps {
  label: string;
  value: number;   // 0-100
  valueLabel?: string;
  rightTag?: string;
}

/** Barra de progreso con etiqueta y valor. Usada para estadísticas fisiológicas. */
export function StatBar({ label, value, valueLabel, rightTag }: StatBarProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-lg font-bold text-foreground">
            {valueLabel ?? `${Math.round(value)}%`}
          </span>
          {rightTag && (
            <span className="text-glow-green text-xs font-bold tracking-widest">
              {rightTag}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: "var(--gradient-bar)",
            boxShadow: "var(--glow-blue)",
          }}
        />
      </div>
    </div>
  );
}
