import { CircularGauge } from "@/components/dashboard/CircularGauge";
import { Skeleton } from "@/components/dashboard/Panel";
import { UI_LABELS } from "@/constants/ui-labels";
import { translateRatingLabel } from "@/lib/display-mappers";
import type { PlayerData } from "@/lib/predictions.types";

interface PlayerProfileSectionProps {
  player: PlayerData | undefined;
  loading: boolean;
}

/** Foto del jugador con dorsal y medidor circular de fatiga. */
export function PlayerProfileSection({ player, loading }: PlayerProfileSectionProps) {
  return (
    <div className="relative flex flex-col items-center justify-center md:col-span-2 xl:col-span-1 xl:col-auto">
      <div className="relative flex w-full items-end justify-center">
        {loading || !player ? (
          <Skeleton className="h-[200px] w-[200px] rounded-2xl" />
        ) : (
          <>
            <img
              src={player.face_url}
              alt={player.name}
              width={220}
              height={220}
              className="h-auto max-h-[220px] w-auto rounded-2xl object-cover ring-2 ring-neon-blue/40 drop-shadow-[0_10px_30px_oklch(0.1_0.02_250_/_0.6)]"
            />
            <span className="absolute bottom-1 right-2 font-display text-5xl font-black text-foreground/90 drop-shadow-[0_0_12px_oklch(0.72_0.18_232_/_0.5)]">
              {player.number}
            </span>
          </>
        )}
      </div>
      <div className="-mt-4">
        {loading || !player ? (
          <Skeleton className="aspect-square w-[200px] rounded-full" />
        ) : (
          <CircularGauge
            value={player.stats.fatigue_index}
            topLabel={translateRatingLabel(player.rating_label)}
            bottomLabel={UI_LABELS.stats.fatigueIndex}
          />
        )}
      </div>
    </div>
  );
}
