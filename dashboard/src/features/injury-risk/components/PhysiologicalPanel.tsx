import { Droplet, Thermometer } from "lucide-react";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { StatBar } from "@/shared/components/StatBar";
import { RadarChart } from "@/shared/components/RadarChart";
import { InfoBox } from "@/shared/components/InfoBox";
import { Skeleton } from "@/shared/components/Skeleton";
import { PlayerProfileCard } from "@/features/injury-risk/components/PlayerProfileCard";
import { TrainingLoadCharts } from "@/features/injury-risk/components/TrainingLoadCharts";
import { STRESS_LEVEL_META } from "@/shared/constants/stressLevels";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { traducirCalificacion, traducirNivelEstres } from "@/shared/lib/displayMappers";
import { formatearTemperatura } from "@/shared/lib/formatters";
import type { DatosJugador } from "@/shared/types/injuryRisk.types";

interface PhysiologicalPanelProps {
  jugador: DatosJugador | undefined;
  loading: boolean;
}

/**
 * Panel principal de recuperación fisiológica y estrés por altitud.
 * Muestra: radar de métricas, barras de calidad de sueño e hidratación,
 * temperatura, nivel de estrés, perfil del jugador y gráficos de entrenamiento.
 */
export function PhysiologicalPanel({ jugador, loading }: PhysiologicalPanelProps) {
  const metaEstres = jugador
    ? STRESS_LEVEL_META[jugador.stats.stress]
    : STRESS_LEVEL_META.LOW;
  const StressIcon = metaEstres.Icon;

  return (
    <GlassPanel title={UI_LABELS.panels.physiological}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_1fr] xl:grid-cols-[252px_1fr_230px]">
        {/* Gráfico Radar */}
        <div className="flex flex-col gap-4">
          <div className="mx-auto aspect-square w-full max-w-[252px]">
            {loading || !jugador ? (
              <Skeleton className="h-full w-full rounded-full" />
            ) : (
              <RadarChart data={jugador.radar} />
            )}
          </div>
        </div>

        {/* Barras de estadísticas fisiológicas */}
        <div className="flex flex-col justify-center gap-4">
          {loading || !jugador ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : (
            <>
              <StatBar
                label={UI_LABELS.stats.sleepQuality}
                value={jugador.stats.sleep_quality}
                rightTag={traducirCalificacion(jugador.rating_label)}
              />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <StatBar
                    label={UI_LABELS.stats.hydrationLevel}
                    value={jugador.stats.hydration}
                  />
                </div>
                <Droplet className="h-7 w-7 shrink-0 text-neon-blue drop-shadow-[0_0_8px_oklch(0.72_0.18_232_/_0.6)]" />
              </div>
            </>
          )}

          {/* Temperatura y nivel de estrés */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBox
              icon={<Thermometer className="h-4 w-4 text-neon-blue" />}
              label={UI_LABELS.stats.bodyTemperature}
              loading={loading}
              value={jugador ? formatearTemperatura(jugador.stats.body_temp) : ""}
            />
            <div className="glass rounded-xl px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                {UI_LABELS.stats.stressLevel}
              </span>
              {loading || !jugador ? (
                <Skeleton className="mt-1 h-6 w-16" />
              ) : (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="font-display text-xl font-extrabold"
                    style={{ color: metaEstres.color }}
                  >
                    {traducirNivelEstres(jugador.stats.stress)}
                  </span>
                  <StressIcon
                    className="h-5 w-5"
                    style={{ color: metaEstres.color }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Perfil del jugador con foto y gauge de fatiga */}
        <PlayerProfileCard jugador={jugador} loading={loading} />
      </div>

      {/* Gráficos de carga de entrenamiento */}
      <TrainingLoadCharts
        entrenamiento={jugador?.stats.training}
        loading={loading}
      />
    </GlassPanel>
  );
}
