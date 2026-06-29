import { useAppSelector } from "@/app/hooks";
import { selectNumeroPartidoSeleccionado } from "@/features/fixture/fixtureSlice";
import { selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import { useGetReportePreparacionQuery } from "@/features/injury-risk/injuryRiskApi";
import { InjuryRiskVerdict } from "@/features/injury-risk/components/InjuryRiskVerdict";
import { GeoclimaticInfoPanel } from "@/features/injury-risk/components/GeoclimaticInfoPanel";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { CircularGauge } from "@/shared/components/CircularGauge";
import { RadarChart } from "@/shared/components/RadarChart";
import { Skeleton } from "@/shared/components/Skeleton";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { traducirCalificacion } from "@/shared/lib/displayMappers";
import { UserRound } from "lucide-react";
import { useState, useEffect } from "react";

/**
 * Dashboard principal de riesgo de lesión — vista de decisión.
 * Layout compacto orientado a responder: "¿Puede jugar este partido sí o no?"
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

  const [imageError, setImageError] = useState(false);
  useEffect(() => { setImageError(false); }, [jugador?.face_url]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Row 1: Veredicto de riesgo — la decisión principal */}
      {mostrarSkeleton ? (
        <div className="glass-panel space-y-3 rounded-2xl px-7 py-5">
          <Skeleton className="mx-auto h-7 w-2/3" />
          <Skeleton className="mx-auto h-4 w-5/6" />
        </div>
      ) : (
        <InjuryRiskVerdict inferencia={reporte.ai_inference} />
      )}

      {/* Row 2: Three-column layout — Player | Radar | Context */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Column 1: Player profile + Risk gauge */}
        <GlassPanel title="Jugador">
          <div className="flex flex-col items-center gap-4">
            {/* Photo */}
            {mostrarSkeleton ? (
              <Skeleton className="h-[160px] w-[160px] rounded-2xl" />
            ) : (
              <div className="relative">
                {!jugador?.face_url || imageError ? (
                  <div className="flex h-[160px] w-[160px] items-center justify-center rounded-2xl bg-secondary/80 ring-2 ring-neon-blue/40">
                    <UserRound className="h-1/2 w-1/2 text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={jugador.face_url}
                    alt={jugador?.name}
                    onError={() => setImageError(true)}
                    className="h-[160px] w-[160px] rounded-2xl object-cover ring-2 ring-neon-blue/40"
                  />
                )}
              </div>
            )}

            {/* Name and team */}
            {mostrarSkeleton ? (
              <Skeleton className="h-6 w-40" />
            ) : jugador && (
              <div className="text-center">
                <p className="text-lg font-display font-bold text-white">{jugador.name}</p>
                <p className="text-sm text-gray-400">{jugador.national_team}</p>
              </div>
            )}

            {/* Risk Gauge */}
            {mostrarSkeleton ? (
              <Skeleton className="h-[180px] w-[180px] rounded-full" />
            ) : jugador && (
              <CircularGauge
                value={jugador.stats.fatigue_index}
                topLabel={traducirCalificacion(jugador.rating_label)}
                bottomLabel="Índice de Riesgo"
              />
            )}
          </div>
        </GlassPanel>

        {/* Column 2: Physiological Radar */}
        <GlassPanel title="Perfil Físico Estimado">
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {mostrarSkeleton ? (
              <Skeleton className="h-[250px] w-[250px] rounded-full" />
            ) : jugador && (
              <>
                <div className="w-full max-w-[280px] aspect-square">
                  <RadarChart data={jugador.radar} />
                </div>
                <p className="text-xs text-gray-500 text-center leading-relaxed px-3">
                  Estimado a partir de minutos jugados, edad e historial de lesiones. 
                  No proviene de sensores biométricos.
                </p>
              </>
            )}
          </div>
        </GlassPanel>

        {/* Column 3: Geoclimatic context */}
        <GeoclimaticInfoPanel contextoPartido={contextoPartido} loading={mostrarSkeleton} />
      </div>

      {/* Row 3: Quick decision summary */}
      {!mostrarSkeleton && jugador && (
        <div className="glass-panel rounded-2xl px-6 py-4">
          <h3 className="text-base font-display font-bold text-white mb-3">📋 Resumen para el Cuerpo Técnico</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Riesgo de Lesión</p>
              <p className={`text-xl font-bold ${jugador.stats.fatigue_index > 70 ? "text-red-400" : jugador.stats.fatigue_index > 30 ? "text-yellow-400" : "text-green-400"}`}>
                {jugador.stats.fatigue_index.toFixed(0)}%
              </p>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Recuperación Estimada</p>
              <p className={`text-xl font-bold ${jugador.radar.recovery > 70 ? "text-green-400" : jugador.radar.recovery > 50 ? "text-yellow-400" : "text-red-400"}`}>
                {jugador.radar.recovery.toFixed(0)}/99
              </p>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Decisión Sugerida</p>
              <p className={`text-base font-bold ${jugador.stats.fatigue_index > 70 ? "text-red-400" : jugador.stats.fatigue_index > 50 ? "text-yellow-400" : "text-green-400"}`}>
                {jugador.stats.fatigue_index > 70
                  ? "⛔ Descanso recomendado"
                  : jugador.stats.fatigue_index > 50
                    ? "⚠️ Monitorear carga"
                    : "✅ Apto para jugar"
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
