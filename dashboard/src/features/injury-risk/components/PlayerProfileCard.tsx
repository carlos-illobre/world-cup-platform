import { CircularGauge } from "@/shared/components/CircularGauge";
import { Skeleton } from "@/shared/components/Skeleton";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { traducirCalificacion } from "@/shared/lib/displayMappers";
import type { DatosJugador } from "@/shared/types/injuryRisk.types";

interface PlayerProfileCardProps {
  jugador: DatosJugador | undefined;
  loading: boolean;
}

/**
 * Card de perfil del jugador: foto con dorsal y medidor circular de índice de fatiga.
 */
export function PlayerProfileCard({ jugador, loading }: PlayerProfileCardProps) {
  return (
    <div className="relative flex flex-col items-center justify-center md:col-span-2 xl:col-span-1 xl:col-auto">
      {/* Foto del jugador con dorsal */}
      <div className="relative flex w-full items-end justify-center">
        {loading || !jugador ? (
          <Skeleton className="h-[200px] w-[200px] rounded-2xl" />
        ) : (
          <>
            <img
              src={jugador.face_url}
              alt={jugador.name}
              width={220}
              height={220}
              className="h-auto max-h-[220px] w-auto rounded-2xl object-cover ring-2 ring-neon-blue/40 drop-shadow-[0_10px_30px_oklch(0.1_0.02_250_/_0.6)]"
            />
            <span className="absolute bottom-1 right-2 font-display text-5xl font-black text-foreground/90 drop-shadow-[0_0_12px_oklch(0.72_0.18_232_/_0.5)]">
              {jugador.number}
            </span>
          </>
        )}
      </div>

      {/* Gauge de índice de fatiga */}
      <div className="-mt-4">
        {loading || !jugador ? (
          <Skeleton className="aspect-square w-[200px] rounded-full" />
        ) : (
          <CircularGauge
            value={jugador.stats.fatigue_index}
            topLabel={traducirCalificacion(jugador.rating_label)}
            bottomLabel={UI_LABELS.stats.fatigueIndex}
          />
        )}
      </div>
    </div>
  );
}
