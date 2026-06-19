import { Activity } from "lucide-react";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { formatearFrecuenciaCardiaca } from "@/shared/lib/formatters";

interface HeartRateMonitorProps {
  series: number[];
  frecuenciaActual: number;
}

const HR_WIDTH = 280;
const HR_HEIGHT = 70;

/** Monitor de frecuencia cardíaca con gráfico de línea y valor actual. */
export function HeartRateMonitor({ series, frecuenciaActual }: HeartRateMonitorProps) {
  if (!series || series.length === 0) {
    return (
      <div className="flex h-[115px] flex-col items-center justify-center text-xs text-muted-foreground gap-2">
        <Activity className="h-5 w-5 opacity-40" />
        <span>Sin datos de ritmo cardíaco</span>
      </div>
    );
  }

  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = Math.max(max - min, 1);

  const path = series
    .map((valor, i) => {
      const x = (i / (series.length - 1)) * HR_WIDTH;
      const y = HR_HEIGHT - ((valor - min) / range) * (HR_HEIGHT - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <div className="flex items-stretch gap-3">
        <div className="flex flex-col justify-between py-1 text-xs font-semibold text-muted-foreground">
          <span>500</span>
          <span>300</span>
          <span>200</span>
          <span>100</span>
        </div>
        <svg
          viewBox={`0 0 ${HR_WIDTH} ${HR_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-[70px] w-full"
        >
          <defs>
            <linearGradient id="hrLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="oklch(0.72 0.18 232)" />
              <stop offset="100%" stopColor="oklch(0.85 0.16 210)" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((gridLine) => (
            <line
              key={gridLine}
              x1={0}
              x2={HR_WIDTH}
              y1={HR_HEIGHT * gridLine}
              y2={HR_HEIGHT * gridLine}
              stroke="oklch(0.6 0.05 240 / 0.12)"
              strokeWidth={1}
            />
          ))}
          <path
            d={path}
            fill="none"
            stroke="url(#hrLine)"
            strokeWidth={1.8}
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 4px oklch(0.72 0.18 232 / 0.6))" }}
          />
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
          {UI_LABELS.heartRate.load}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {UI_LABELS.heartRate.current}
          </span>
          <span className="flex items-center gap-1 font-display text-lg font-bold text-foreground">
            <Activity className="h-4 w-4 text-neon-red" />
            {formatearFrecuenciaCardiaca(frecuenciaActual)}
          </span>
        </span>
      </div>
    </div>
  );
}
