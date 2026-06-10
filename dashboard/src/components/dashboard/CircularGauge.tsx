interface CircularGaugeProps {
  value: number; // 0-100
  topLabel: string;
  bottomLabel: string;
}

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function CircularGauge({ value, topLabel, bottomLabel }: CircularGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const offset = CIRC - (clamped / 100) * CIRC;

  return (
    <div className="relative aspect-square w-full max-w-[200px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="gaugeStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.72 0.18 232)" />
            <stop offset="55%" stopColor="oklch(0.82 0.22 142)" />
            <stop offset="100%" stopColor="oklch(0.88 0.18 100)" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="oklch(0.3 0.03 252 / 0.7)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#gaugeStroke)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ filter: "drop-shadow(0 0 8px oklch(0.82 0.22 142 / 0.6))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-glow-green text-[0.65rem] font-bold tracking-[0.2em]">
          {topLabel}
        </span>
        <span className="font-display text-4xl font-extrabold text-neon-yellow drop-shadow-[0_0_14px_oklch(0.88_0.18_100_/_0.5)]">
          {Math.round(clamped)}%
        </span>
        <span className="text-[0.6rem] font-semibold tracking-[0.25em] text-muted-foreground">
          {bottomLabel}
        </span>
      </div>
    </div>
  );
}
