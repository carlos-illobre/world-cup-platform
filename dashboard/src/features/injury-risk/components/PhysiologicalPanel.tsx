import { GlassPanel } from "@/shared/components/GlassPanel";
import { RadarChart } from "@/shared/components/RadarChart";
import { Skeleton } from "@/shared/components/Skeleton";
import { PlayerProfileCard } from "@/features/injury-risk/components/PlayerProfileCard";
import { STRESS_LEVEL_META } from "@/shared/constants/stressLevels";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { traducirNivelEstres } from "@/shared/lib/displayMappers";
import type { DatosJugador } from "@/shared/types/injuryRisk.types";

interface PhysiologicalPanelProps {
  jugador: DatosJugador | undefined;
  loading: boolean;
}

/**
 * Panel de perfil fisiológico estimado.
 * Muestra: radar de métricas (cardio, endurance, recovery, respiratory, engagement)
 * y el perfil del jugador con gauge de riesgo.
 * 
 * NOTA: Las métricas del radar son estimaciones correlacionales basadas en
 * minutos jugados, edad e historial de lesiones. No provienen de sensores biométricos.
 */
export function PhysiologicalPanel({ jugador, loading }: PhysiologicalPanelProps) {
  const metaEstres = jugador
    ? STRESS_LEVEL_META[jugador.stats.stress]
    : STRESS_LEVEL_META.LOW;
  const StressIcon = metaEstres.Icon;

  return (
    <GlassPanel title="Perfil Físico Estimado">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_230px]">
        {/* Gráfico Radar */}
        <div className="flex flex-col gap-4">
          <div className="mx-auto aspect-square w-full max-w-[280px]">
            {loading || !jugador ? (
              <Skeleton className="h-full w-full rounded-full" />
            ) : (
              <RadarChart data={jugador.radar} />
            )}
          </div>
          {!loading && jugador && (
            <p className="text-xs text-gray-500 text-center leading-relaxed px-2">
              Estimado a partir de minutos jugados, edad e historial de lesiones. No proviene de sensores biométricos.
            </p>
          )}
        </div>

        {/* Nivel de estrés fisiológico (derivado del risk score) */}
        <div className="flex flex-col justify-center gap-4">
          {loading || !jugador ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="glass rounded-xl px-5 py-4">
              <span className="text-sm font-medium text-muted-foreground">
                {UI_LABELS.stats.stressLevel}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="font-display text-2xl font-extrabold"
                  style={{ color: metaEstres.color }}
                >
                  {traducirNivelEstres(jugador.stats.stress)}
                </span>
                <StressIcon
                  className="h-6 w-6"
                  style={{ color: metaEstres.color }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Derivado del score de riesgo del modelo XGBoost (0-100). 
                Bajo: &lt;30%, Moderado: 30-60%, Alto: &gt;60%.
              </p>
            </div>
          )}
        </div>

        {/* Perfil del jugador con foto y gauge de fatiga */}
        <PlayerProfileCard jugador={jugador} loading={loading} />
      </div>
    </GlassPanel>
  );
}
