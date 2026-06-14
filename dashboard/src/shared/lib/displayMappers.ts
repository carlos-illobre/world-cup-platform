import { STRESS_LEVEL_META } from "@/shared/constants/stressLevels";
import type { NivelEstres } from "@/shared/types/injuryRisk.types";

const MAPA_CALIFICACION: Record<string, string> = {
  EXCELLENT: "EXCELENTE",
  GOOD: "BUENO",
  FAIR: "REGULAR",
};

/** Traduce la etiqueta de calificación del jugador al castellano. */
export function traducirCalificacion(ratingLabel: string): string {
  return MAPA_CALIFICACION[ratingLabel] ?? ratingLabel;
}

/** Traduce el nivel de estrés al castellano. */
export function traducirNivelEstres(estres: NivelEstres): string {
  return STRESS_LEVEL_META[estres].label;
}
