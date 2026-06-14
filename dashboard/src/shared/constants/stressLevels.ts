import { TrendingDown, TrendingUp, Minus, type LucideIcon } from "lucide-react";
import type { NivelEstres } from "@/shared/types/injuryRisk.types";

export interface MetaNivelEstres {
  color: string;
  Icon: LucideIcon;
  label: string;
}

/** Metadatos visuales y etiquetas en castellano por nivel de estrés fisiológico. */
export const STRESS_LEVEL_META: Record<NivelEstres, MetaNivelEstres> = {
  LOW: { color: "var(--neon-green)", Icon: TrendingDown, label: "BAJO" },
  MODERATE: { color: "var(--neon-yellow)", Icon: Minus, label: "MODERADO" },
  HIGH: { color: "var(--neon-red)", Icon: TrendingUp, label: "ALTO" },
};
