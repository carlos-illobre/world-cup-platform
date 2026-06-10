import { BarChart } from "@/components/dashboard/BarChart";
import { Skeleton } from "@/components/dashboard/Panel";
import { UI_LABELS } from "@/constants/ui-labels";
import type { PlayerStats } from "@/lib/predictions.types";

interface TrainingChartsSectionProps {
  training: PlayerStats["training"] | undefined;
  loading: boolean;
}

/** Gráficos de barras de duración, carga e intensidad de entrenamiento. */
export function TrainingChartsSection({
  training,
  loading,
}: TrainingChartsSectionProps) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border/60 pt-4 sm:grid-cols-2">
      {loading || !training ? (
        <>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </>
      ) : (
        <>
          <BarChart
            title={UI_LABELS.stats.trainingDurationLoad}
            series={[
              {
                label: UI_LABELS.stats.duration,
                values: training.duration,
                tint: "mixed",
              },
            ]}
          />
          <BarChart
            title={UI_LABELS.stats.loadIntensity}
            series={[
              {
                label: UI_LABELS.stats.load,
                values: training.load,
                tint: "green",
              },
              {
                label: UI_LABELS.stats.intensity,
                values: training.intensity,
                tint: "blue",
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
