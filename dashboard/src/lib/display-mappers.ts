import { STRESS_LEVEL_META } from "@/constants/stress-levels";
import type { PlayerStats } from "@/lib/predictions.types";

const RATING_LABEL_MAP: Record<string, string> = {
  EXCELLENT: "EXCELENTE",
  GOOD: "BUENO",
  FAIR: "REGULAR",
};

/** Traduce la etiqueta de calificación del jugador al castellano. */
export function translateRatingLabel(ratingLabel: string): string {
  return RATING_LABEL_MAP[ratingLabel] ?? ratingLabel;
}

/** Traduce el nivel de estrés al castellano. */
export function translateStressLevel(stress: PlayerStats["stress"]): string {
  return STRESS_LEVEL_META[stress].label;
}
