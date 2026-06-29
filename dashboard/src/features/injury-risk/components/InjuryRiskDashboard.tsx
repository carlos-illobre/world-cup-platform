import { useAppSelector } from "@/app/hooks";
import { selectNumeroPartidoSeleccionado } from "@/features/fixture/fixtureSlice";
import { selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import { useGetReportePreparacionQuery } from "@/features/injury-risk/injuryRiskApi";
import { InjuryRiskVerdict } from "@/features/injury-risk/components/InjuryRiskVerdict";
import { GeoclimaticInfoPanel } from "@/features/injury-risk/components/GeoclimaticInfoPanel";
import { ClimateImpactPanel } from "@/features/injury-risk/components/ClimateImpactPanel";
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

      {/* Row 2: Jugador (left) | Resumen Cuerpo Técnico (right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Left: Player photo + gauge + radar */}
        <GlassPanel title="Jugador">
          <div className="flex items-stretch gap-4">
            {/* Left side: Large Radar */}
            <div className="flex flex-col items-center justify-center flex-1 min-w-0">
              {mostrarSkeleton ? (
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
              ) : jugador && (
                <>
                  <div className="w-full max-w-[320px] aspect-square">
                    <RadarChart data={jugador.radar} />
                  </div>
                  <p className="text-[9px] text-gray-500 text-center leading-tight mt-1">
                    Perfil físico estimado (no proviene de sensores biométricos)
                  </p>
                </>
              )}
            </div>

            {/* Right side: Photo + Name + Gauge stacked */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              {mostrarSkeleton ? (
                <Skeleton className="h-[140px] w-[140px] rounded-2xl" />
              ) : (
                <div className="relative">
                  {!jugador?.face_url || imageError ? (
                    <div className="flex h-[140px] w-[140px] items-center justify-center rounded-2xl bg-secondary/80 ring-2 ring-neon-blue/40">
                      <UserRound className="h-1/2 w-1/2 text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={jugador.face_url}
                      alt={jugador?.name}
                      onError={() => setImageError(true)}
                      className="h-[140px] w-[140px] rounded-2xl object-cover ring-2 ring-neon-blue/40"
                    />
                  )}
                </div>
              )}
              {mostrarSkeleton ? (
                <Skeleton className="h-4 w-20" />
              ) : jugador && (
                <div className="text-center">
                  <p className="text-xs font-display font-bold text-white">{jugador.name}</p>
                  <p className="text-xs text-gray-400">{jugador.national_team}</p>
                </div>
              )}
              {/* Gauge below photo */}
              {mostrarSkeleton ? (
                <Skeleton className="h-[100px] w-[100px] rounded-full" />
              ) : jugador && (
                <div className="scale-[0.75] origin-top">
                  <CircularGauge
                    value={jugador.stats.fatigue_index}
                    topLabel={traducirCalificacion(jugador.rating_label)}
                    bottomLabel="Índice de Riesgo"
                  />
                </div>
              )}
            </div>
          </div>
        </GlassPanel>

        {/* Right: Decision summary for coaching staff */}
        {!mostrarSkeleton && jugador ? (
          <GlassPanel title="📋 Resumen para el Cuerpo Técnico">
            <div className="flex flex-col gap-3 h-full justify-center">
              <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Riesgo de Lesión</p>
                <p className={`text-2xl font-bold ${jugador.stats.fatigue_index > 70 ? "text-red-400" : jugador.stats.fatigue_index > 30 ? "text-yellow-400" : "text-green-400"}`}>
                  {jugador.stats.fatigue_index.toFixed(0)}%
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Recuperación Estimada</p>
                <p className={`text-2xl font-bold ${jugador.radar.recovery > 70 ? "text-green-400" : jugador.radar.recovery > 50 ? "text-yellow-400" : "text-red-400"}`}>
                  {jugador.radar.recovery.toFixed(0)}/99
                </p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                <p className="text-gray-400 text-xs uppercase font-semibold mb-1">Decisión Sugerida</p>
                <p className={`text-lg font-bold ${jugador.stats.fatigue_index > 70 ? "text-red-400" : jugador.stats.fatigue_index > 50 ? "text-yellow-400" : "text-green-400"}`}>
                  {jugador.stats.fatigue_index > 70
                    ? "⛔ Descanso recomendado"
                    : jugador.stats.fatigue_index > 50
                      ? "⚠️ Monitorear carga"
                      : "✅ Apto para jugar"
                  }
                </p>
              </div>
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel title="📋 Resumen">
            <Skeleton className="h-[180px] w-full rounded-lg" />
          </GlassPanel>
        )}
      </div>

      {/* Row 3: Geoclimático | Impacto Climático */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <GeoclimaticInfoPanel contextoPartido={contextoPartido} loading={mostrarSkeleton} />

        {!mostrarSkeleton && reporte?.ai_inference?.climate_impact ? (
          <ClimateImpactPanel
            climateImpact={reporte.ai_inference.climate_impact}
            playerCountry={jugador?.national_team}
          />
        ) : (
          <GlassPanel title="Impacto Climático">
            <p className="text-sm text-muted-foreground">
              {mostrarSkeleton ? <Skeleton className="h-4 w-full" /> : "Sin datos climáticos para este partido."}
            </p>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
