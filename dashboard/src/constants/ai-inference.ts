import { CheckCircle2, AlertTriangle, ShieldAlert, type LucideIcon } from "lucide-react";
import type { AiClass } from "@/lib/predictions.types";

export interface AiInferenceStyle {
  accent: string;
  glow: string;
  Icon: LucideIcon;
  statusLabel: string;
  verdictLabel: string;
}

/** Estilos y textos en castellano para cada clase de inferencia IA. */
export const AI_INFERENCE_STYLES: Record<AiClass, AiInferenceStyle> = {
  0: {
    accent: "var(--neon-green)",
    glow: "var(--glow-green)",
    Icon: CheckCircle2,
    statusLabel: "ESTADO SEGURO",
    verdictLabel: "APTO PARA JUGAR",
  },
  1: {
    accent: "var(--neon-yellow)",
    glow: "var(--glow-yellow)",
    Icon: AlertTriangle,
    statusLabel: "ESTADO DE PRECAUCIÓN",
    verdictLabel: "MONITOREAR DE CERCA",
  },
  2: {
    accent: "var(--neon-red)",
    glow: "var(--glow-red)",
    Icon: ShieldAlert,
    statusLabel: "ESTADO DE RIESGO",
    verdictLabel: "LIMITAR MINUTOS",
  },
};

/** Etiqueta combinada mostrada en la barra de inferencia IA. */
export function getAiInferenceDisplayLabel(aiClass: AiClass): string {
  const style = AI_INFERENCE_STYLES[aiClass];
  return `${style.statusLabel} / ${style.verdictLabel}`;
}
