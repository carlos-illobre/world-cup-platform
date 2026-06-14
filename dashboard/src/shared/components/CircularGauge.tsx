interface CircularGaugeProps {
  value: number;       // 0-100
  topLabel: string;
  bottomLabel: string;
}

const GAUGE_SIZE = 200;
const GAUGE_STROKE = 14;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

/** Medidor circular de progreso — usado para mostrar el índice de fatiga. */
export function CircularGauge({ value, topLabel, bottomLabel }: CircularGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const strokeOffset = GAUGE_CIRCUMFERENCE - (clamped / 100) * GAUGE_CIRCUMFERENCE;

  return (
    <div className="relative aspect-square w-full max-w-[200px]">
      <svg viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`} className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="gaugeStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.72 0.18 232)" />
            <stop offset="55%" stopColor="oklch(0.82 0.22 142)" />
            <stop offset="100%" stopColor="oklch(0.88 0.18 100)" />
          </linearGradient>
        </defs>
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          fill="none"
          stroke="oklch(0.3 0.03 252 / 0.7)"
          strokeWidth={GAUGE_STROKE}
        />
        <circle
          cx={GAUGE_SIZE / 2}
          cy={GAUGE_SIZE / 2}
          r={GAUGE_RADIUS}
          fill="none"
          stroke="url(#gaugeStroke)"
          strokeWidth={GAUGE_STROKE}
          strokeLinecap="round"
          strokeDasharray={GAUGE_CIRCUMFERENCE}
          strokeDashoffset={strokeOffset}
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
