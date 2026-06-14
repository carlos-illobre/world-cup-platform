import { BarChart } from "@/shared/components/BarChart";
import { Skeleton } from "@/shared/components/Skeleton";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import type { MetricasFisiologicas } from "@/shared/types/injuryRisk.types";

interface TrainingLoadChartsProps {
  entrenamiento: MetricasFisiologicas["training"] | undefined;
  loading: boolean;
}

/** Gráficos de barras de duración, carga e intensidad de entrenamiento. */
export function TrainingLoadCharts({ entrenamiento, loading }: TrainingLoadChartsProps) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border/60 pt-4 sm:grid-cols-2">
      {loading || !entrenamiento ? (
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
                values: entrenamiento.duration,
                tint: "mixed",
              },
            ]}
          />
          <BarChart
            title={UI_LABELS.stats.loadIntensity}
            series={[
              {
                label: UI_LABELS.stats.load,
                values: entrenamiento.load,
                tint: "green",
              },
              {
                label: UI_LABELS.stats.intensity,
                values: entrenamiento.intensity,
                tint: "blue",
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
