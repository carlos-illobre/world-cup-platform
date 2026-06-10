import { TrendingDown, TrendingUp, Minus, type LucideIcon } from "lucide-react";
import type { PlayerStats } from "@/lib/predictions.types";

export type StressLevel = PlayerStats["stress"];

export interface StressLevelMeta {
  color: string;
  Icon: LucideIcon;
  label: string;
}

/** Metadatos visuales y etiquetas en castellano por nivel de estrés. */
export const STRESS_LEVEL_META: Record<StressLevel, StressLevelMeta> = {
  LOW: { color: "var(--neon-green)", Icon: TrendingDown, label: "BAJO" },
  MODERATE: { color: "var(--neon-yellow)", Icon: Minus, label: "MODERADO" },
  HIGH: { color: "var(--neon-red)", Icon: TrendingUp, label: "ALTO" },
};
