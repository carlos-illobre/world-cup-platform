import { Target } from "lucide-react";
import { useAppSelector } from "@/app/hooks";
import { selectFechaSeleccionada, selectNumeroPartidoSeleccionado } from "@/features/fixture/fixtureSlice";
import { selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import { UI_LABELS } from "@/shared/constants/uiLabels";

/**
 * Guía de selección — pantalla de estado vacío que indica al usuario
 * los pasos necesarios para iniciar el análisis de riesgo de lesión.
 */
export function SelectionGuide() {
  const fechaSeleccionada = useAppSelector(selectFechaSeleccionada);
  const numeroPartido = useAppSelector(selectNumeroPartidoSeleccionado);
  const jugadorId = useAppSelector(selectJugadorSeleccionadoId);

  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-4 rounded-2xl px-6 py-20 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-neon-blue/15 ring-1 ring-neon-blue/40">
        <Target className="h-8 w-8 text-neon-blue" />
      </div>
      <h2 className="font-display text-xl font-extrabold tracking-wide text-foreground sm:text-2xl">
        {UI_LABELS.selectionGuide.title}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {UI_LABELS.selectionGuide.description}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wider">
        <span className={fechaSeleccionada ? "text-neon-green" : "text-muted-foreground"}>
          {fechaSeleccionada
            ? UI_LABELS.selectionGuide.dateSelected
            : UI_LABELS.selectionGuide.stepDate}
        </span>
        <span className="text-border">|</span>
        <span className={numeroPartido ? "text-neon-green" : "text-muted-foreground"}>
          {numeroPartido
            ? UI_LABELS.selectionGuide.matchSelected
            : UI_LABELS.selectionGuide.stepMatch}
        </span>
        <span className="text-border">|</span>
        <span className={jugadorId ? "text-neon-green" : "text-muted-foreground"}>
          {jugadorId
            ? UI_LABELS.selectionGuide.playerSelected
            : UI_LABELS.selectionGuide.stepPlayer}
        </span>
      </div>
    </div>
  );
}
