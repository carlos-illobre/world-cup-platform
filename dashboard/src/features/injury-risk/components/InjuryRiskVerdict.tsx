import { ESTILOS_NIVEL_RIESGO, obtenerEtiquetaRiesgo } from "@/shared/constants/injuryRiskLevels";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import type { InferenciaRiesgoLesion } from "@/shared/types/injuryRisk.types";

interface InjuryRiskVerdictProps {
  inferencia: InferenciaRiesgoLesion;
}

/**
 * Barra de veredicto de riesgo de lesión.
 * Muestra el diagnóstico del modelo IA con color y estilo según la clase de riesgo.
 */
export function InjuryRiskVerdict({ inferencia }: InjuryRiskVerdictProps) {
  const estilo = ESTILOS_NIVEL_RIESGO[inferencia.class];
  const { Icon } = estilo;
  const etiquetaDisplay = obtenerEtiquetaRiesgo(inferencia.class);

  return (
    <div
      className="glass-panel relative overflow-hidden rounded-2xl px-5 py-4 sm:px-7 sm:py-5"
      style={{
        borderColor: estilo.accent,
        boxShadow: `${estilo.glow}, inset 0 0 24px color-mix(in oklab, ${estilo.accent} 12%, transparent)`,
      }}
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: estilo.accent, boxShadow: estilo.glow }}
      />
      <div className="flex items-center justify-center gap-3">
        <Icon
          className="h-6 w-6 shrink-0"
          style={{ color: estilo.accent, filter: `drop-shadow(${estilo.glow})` }}
        />
        <h2
          className="font-display text-center text-lg font-extrabold tracking-wide sm:text-2xl"
          style={{ color: estilo.accent, textShadow: estilo.glow }}
        >
          {UI_LABELS.injuryRiskVerdict.title(etiquetaDisplay, inferencia.class)}
        </h2>
      </div>
      <p className="mx-auto mt-3 max-w-4xl text-center text-sm leading-relaxed text-foreground/85">
        <span className="font-bold text-foreground">
          {UI_LABELS.injuryRiskVerdict.justificationPrefix}{" "}
        </span>
        {inferencia.justification}
      </p>
    </div>
  );
}
