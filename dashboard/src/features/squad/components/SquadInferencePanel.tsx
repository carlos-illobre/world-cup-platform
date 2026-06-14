import { GlassPanel } from "@/shared/components/GlassPanel";
import { Skeleton } from "@/shared/components/Skeleton";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { useAppSelector } from "@/app/hooks";
import { selectNumeroPartidoSeleccionado } from "@/features/fixture/fixtureSlice";
import { useGetInferenciaPlantillaQuery } from "@/features/squad/squadApi";
import { TeamSquadColumn } from "@/features/squad/components/TeamSquadColumn";

/**
 * Panel que muestra los planteles de ambos equipos del partido seleccionado
 * con el nivel de riesgo de lesión de cada jugador según el modelo IA.
 */
export function SquadInferencePanel() {
  const numeroPartido = useAppSelector(selectNumeroPartidoSeleccionado);

  const {
    data,
    isLoading,
    error,
  } = useGetInferenciaPlantillaQuery(numeroPartido!, {
    skip: !numeroPartido,
  });

  if (!numeroPartido) return null;

  return (
    <GlassPanel title={UI_LABELS.panels.squadInference}>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-neon-yellow/40 bg-neon-yellow/5 px-4 py-6 text-center text-sm text-foreground/80">
          <p className="font-semibold text-neon-yellow">
            {UI_LABELS.squad.endpointPending}
          </p>
          <p className="mt-1 text-muted-foreground">
            {UI_LABELS.squad.endpointDetail(
              numeroPartido,
              error instanceof Error ? error.message : String(error),
            )}
          </p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TeamSquadColumn plantilla={data.home} />
          <TeamSquadColumn plantilla={data.away} />
        </div>
      ) : null}
    </GlassPanel>
  );
}
