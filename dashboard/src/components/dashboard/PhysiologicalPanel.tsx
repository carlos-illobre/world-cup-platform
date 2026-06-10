import { Droplet, Thermometer } from "lucide-react";
import { Panel, Skeleton } from "@/components/dashboard/Panel";
import { StatBar } from "@/components/dashboard/StatBar";
import { RadarChart } from "@/components/dashboard/RadarChart";
import { InfoBox } from "@/components/dashboard/InfoBox";
import { PlayerProfileSection } from "@/components/dashboard/PlayerProfileSection";
import { TrainingChartsSection } from "@/components/dashboard/TrainingChartsSection";
import { STRESS_LEVEL_META } from "@/constants/stress-levels";
import { UI_LABELS } from "@/constants/ui-labels";
import { translateRatingLabel, translateStressLevel } from "@/lib/display-mappers";
import { formatTemperature } from "@/lib/formatters";
import type { PlayerData } from "@/lib/predictions.types";

interface PhysiologicalPanelProps {
  player: PlayerData | undefined;
  loading: boolean;
}

/** Panel principal de recuperación fisiológica y estrés por altitud. */
export function PhysiologicalPanel({ player, loading }: PhysiologicalPanelProps) {
  const stressMeta = player
    ? STRESS_LEVEL_META[player.stats.stress]
    : STRESS_LEVEL_META.LOW;
  const StressIcon = stressMeta.Icon;

  return (
    <Panel title={UI_LABELS.panels.physiological}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr] xl:grid-cols-[210px_1fr_230px]">
        <div className="flex flex-col gap-4">
          <div className="mx-auto aspect-square w-full max-w-[210px]">
            {loading || !player ? (
              <Skeleton className="h-full w-full rounded-full" />
            ) : (
              <RadarChart data={player.radar} />
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-4">
          {loading || !player ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : (
            <>
              <StatBar
                label={UI_LABELS.stats.sleepQuality}
                value={player.stats.sleep_quality}
                rightTag={translateRatingLabel(player.rating_label)}
              />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <StatBar
                    label={UI_LABELS.stats.hydrationLevel}
                    value={player.stats.hydration}
                  />
                </div>
                <Droplet className="h-7 w-7 shrink-0 text-neon-blue drop-shadow-[0_0_8px_oklch(0.72_0.18_232_/_0.6)]" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InfoBox
              icon={<Thermometer className="h-4 w-4 text-neon-blue" />}
              label={UI_LABELS.stats.bodyTemperature}
              loading={loading}
              value={player ? formatTemperature(player.stats.body_temp) : ""}
            />
            <div className="glass rounded-xl px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                {UI_LABELS.stats.stressLevel}
              </span>
              {loading || !player ? (
                <Skeleton className="mt-1 h-6 w-16" />
              ) : (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="font-display text-xl font-extrabold"
                    style={{ color: stressMeta.color }}
                  >
                    {translateStressLevel(player.stats.stress)}
                  </span>
                  <StressIcon
                    className="h-5 w-5"
                    style={{ color: stressMeta.color }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <PlayerProfileSection player={player} loading={loading} />
      </div>

      <TrainingChartsSection training={player?.stats.training} loading={loading} />
    </Panel>
  );
}
