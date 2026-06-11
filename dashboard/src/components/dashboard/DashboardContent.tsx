import { PhysiologicalPanel } from "@/components/dashboard/PhysiologicalPanel";
import { GeoclimaticPanel } from "@/components/dashboard/GeoclimaticPanel";
import { HeartRateChart } from "@/components/dashboard/HeartRateChart";
import { AIInferenceBar } from "@/components/dashboard/AIInferenceBar";
import { Panel, Skeleton } from "@/components/dashboard/Panel";
import { UI_LABELS } from "@/constants/ui-labels";
import type { PredictionResponse } from "@/lib/predictions.types";

type PredictionData = PredictionResponse["data"];

interface DashboardContentProps {
  data: PredictionData | null;
  loading: boolean;
}

/** Contenido principal del dashboard cuando hay selección completa. */
export function DashboardContent({ data, loading }: DashboardContentProps) {
  const showSkeleton = loading || !data;
  const player = data?.player;
  const matchContext = data?.match_context;

  return (
    <>

      {showSkeleton || !data ? (
        <div className="glass-panel space-y-3 rounded-2xl px-7 py-5">
          <Skeleton className="mx-auto h-7 w-2/3" />
          <Skeleton className="mx-auto h-4 w-5/6" />
          <Skeleton className="mx-auto h-4 w-3/4" />
        </div>
      ) : (
        <AIInferenceBar inference={data.ai_inference} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[1fr_320px]">
        <PhysiologicalPanel player={player} loading={showSkeleton} />

        <div className="flex flex-col gap-4 sm:gap-5">
          <GeoclimaticPanel matchContext={matchContext} loading={showSkeleton} />

          <Panel title={UI_LABELS.panels.heartRate}>
            {showSkeleton || !player ? (
              <Skeleton className="h-[110px] w-full" />
            ) : (
              <HeartRateChart
                series={player.stats.heart_rate_series}
                current={player.stats.heart_rate_bpm}
              />
            )}
          </Panel>
        </div>
      </div>

    </>
  );
}
