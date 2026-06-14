import { useAppSelector } from "@/app/hooks";
import { selectNumeroPartidoSeleccionado } from "@/features/fixture/fixtureSlice";
import { selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import { useGetReportePreparacionQuery } from "@/features/injury-risk/injuryRiskApi";
import { InjuryRiskVerdict } from "@/features/injury-risk/components/InjuryRiskVerdict";
import { PhysiologicalPanel } from "@/features/injury-risk/components/PhysiologicalPanel";
import { GeoclimaticInfoPanel } from "@/features/injury-risk/components/GeoclimaticInfoPanel";
import { HeartRateMonitor } from "@/features/injury-risk/components/HeartRateMonitor";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { Skeleton } from "@/shared/components/Skeleton";
import { UI_LABELS } from "@/shared/constants/uiLabels";

/**
 * Dashboard principal de riesgo de lesión.
 * Orquesta todos los paneles del diagnóstico cuando hay selección completa
 * (partido + jugador). Consume RTK Query directamente sin prop drilling.
 */
export function InjuryRiskDashboard() {
  const numeroPartido = useAppSelector(selectNumeroPartidoSeleccionado);
  const jugadorId = useAppSelector(selectJugadorSeleccionadoId);

  const {
    data: reporte,
    isLoading,
  } = useGetReportePreparacionQuery(
    { matchNumber: numeroPartido!, jugadorId: jugadorId! },
    { skip: !numeroPartido || !jugadorId },
  );

  const mostrarSkeleton = isLoading || !reporte;
  const jugador = reporte?.player;
  const contextoPartido = reporte?.match_context;

  return (
    <>
      {/* Veredicto de riesgo de lesión */}
      {mostrarSkeleton ? (
        <div className="glass-panel space-y-3 rounded-2xl px-7 py-5">
          <Skeleton className="mx-auto h-7 w-2/3" />
          <Skeleton className="mx-auto h-4 w-5/6" />
          <Skeleton className="mx-auto h-4 w-3/4" />
        </div>
      ) : (
        <InjuryRiskVerdict inferencia={reporte.ai_inference} />
      )}

      {/* Paneles de análisis */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[1fr_320px]">
        <PhysiologicalPanel jugador={jugador} loading={mostrarSkeleton} />

        <div className="flex flex-col gap-4 sm:gap-5">
          <GeoclimaticInfoPanel contextoPartido={contextoPartido} loading={mostrarSkeleton} />

          <GlassPanel title={UI_LABELS.panels.heartRate}>
            {mostrarSkeleton || !jugador ? (
              <Skeleton className="h-[110px] w-full" />
            ) : (
              <HeartRateMonitor
                series={jugador.stats.heart_rate_series}
                frecuenciaActual={jugador.stats.heart_rate_bpm}
              />
            )}
          </GlassPanel>
        </div>
      </div>
    </>
  );
}
