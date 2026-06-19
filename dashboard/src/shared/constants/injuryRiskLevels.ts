import { CheckCircle2, AlertTriangle, ShieldAlert, HelpCircle, type LucideIcon } from "lucide-react";
import type { ClaseRiesgo } from "@/shared/types/injuryRisk.types";

export interface EstiloNivelRiesgo {
  accent: string;
  glow: string;
  Icon: LucideIcon;
  etiquetaEstado: string;
  etiquetaVeredicto: string;
}

/**
 * Estilos visuales y etiquetas en castellano para cada nivel de riesgo de lesión.
 * Clase 0 = seguro (verde), 1 = precaución (amarillo), 2 = riesgo (rojo).
 */
export const ESTILOS_NIVEL_RIESGO: Record<ClaseRiesgo, EstiloNivelRiesgo> = {
  [-1]: {
    accent: "hsl(var(--muted-foreground))",
    glow: "transparent",
    Icon: HelpCircle,
    etiquetaEstado: "SIN DATOS",
    etiquetaVeredicto: "INFORMACIÓN NO DISPONIBLE",
  },
  0: {
    accent: "var(--neon-green)",
    glow: "var(--glow-green)",
    Icon: CheckCircle2,
    etiquetaEstado: "ESTADO SEGURO",
    etiquetaVeredicto: "APTO PARA JUGAR",
  },
  1: {
    accent: "var(--neon-yellow)",
    glow: "var(--glow-yellow)",
    Icon: AlertTriangle,
    etiquetaEstado: "ESTADO DE PRECAUCIÓN",
    etiquetaVeredicto: "MONITOREAR DE CERCA",
  },
  2: {
    accent: "var(--neon-red)",
    glow: "var(--glow-red)",
    Icon: ShieldAlert,
    etiquetaEstado: "ESTADO DE RIESGO",
    etiquetaVeredicto: "LIMITAR MINUTOS",
  },
};

/** Etiqueta combinada para la barra de veredicto de riesgo. */
export function obtenerEtiquetaRiesgo(clase: ClaseRiesgo): string {
  const estilo = ESTILOS_NIVEL_RIESGO[clase];
  return `${estilo.etiquetaEstado} / ${estilo.etiquetaVeredicto}`;
}
