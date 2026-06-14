import { UI_LABELS } from "@/shared/constants/uiLabels";
import type { MetricasRadar } from "@/shared/types/injuryRisk.types";

export interface ConfigEjeRadar {
  key: keyof MetricasRadar;
  label: string;
  color: string;
}

/** Configuración de los 5 ejes del gráfico radar de métricas fisiológicas. */
export const EJES_RADAR: ConfigEjeRadar[] = [
  { key: "cardio", label: UI_LABELS.radar.cardio, color: "oklch(0.82 0.22 142)" },
  { key: "engagement", label: UI_LABELS.radar.engagement, color: "oklch(0.72 0.18 232)" },
  { key: "recovery", label: UI_LABELS.radar.recovery, color: "oklch(0.6 0.24 320)" },
  { key: "respiratory", label: UI_LABELS.radar.respiratory, color: "oklch(0.65 0.24 25)" },
  { key: "endurance", label: UI_LABELS.radar.endurance, color: "oklch(0.88 0.18 100)" },
];
