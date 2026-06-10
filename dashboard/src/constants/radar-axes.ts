import { UI_LABELS } from "@/constants/ui-labels";
import type { RadarMetrics } from "@/lib/predictions.types";

export interface RadarAxisConfig {
  key: keyof RadarMetrics;
  label: string;
  color: string;
}

/** Configuración de ejes del gráfico radar (etiquetas en castellano). */
export const RADAR_AXES: RadarAxisConfig[] = [
  { key: "cardio", label: UI_LABELS.radar.cardio, color: "oklch(0.82 0.22 142)" },
  {
    key: "engagement",
    label: UI_LABELS.radar.engagement,
    color: "oklch(0.72 0.18 232)",
  },
  {
    key: "recovery",
    label: UI_LABELS.radar.recovery,
    color: "oklch(0.6 0.24 320)",
  },
  {
    key: "respiratory",
    label: UI_LABELS.radar.respiratory,
    color: "oklch(0.65 0.24 25)",
  },
  {
    key: "endurance",
    label: UI_LABELS.radar.endurance,
    color: "oklch(0.88 0.18 100)",
  },
];
