import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { PlayerAvatar } from "@/shared/components/PlayerAvatar";
import { TeamFlag } from "@/shared/components/TeamFlag";
import { ESTILOS_NIVEL_RIESGO } from "@/shared/constants/injuryRiskLevels";
import { seleccionarJugador, selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import type { JugadorConInferencia } from "@/shared/types/injuryRisk.types";

interface PlayerInferenceRowProps {
  jugador: JugadorConInferencia;
}

/** Fila de jugador en el panel de plantel con badge de nivel de riesgo de lesión. */
export function PlayerInferenceRow({ jugador }: PlayerInferenceRowProps) {
  const dispatch = useAppDispatch();
  const jugadorSeleccionadoId = useAppSelector(selectJugadorSeleccionadoId);
  const estilo = ESTILOS_NIVEL_RIESGO[jugador.ai_inference.class];
  const isSelected = jugador.id === jugadorSeleccionadoId;

  return (
    <li>
      <button
        type="button"
        onClick={() => dispatch(seleccionarJugador(jugador.id))}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
          isSelected
            ? "border-neon-blue/70 bg-neon-blue/10"
            : "border-transparent hover:border-neon-blue/40 hover:bg-secondary/40"
        }`}
        style={isSelected ? { boxShadow: "0 0 0 1px var(--neon-blue) inset" } : undefined}
      >
        <PlayerAvatar faceUrl={jugador.face_url} playerName={jugador.name} size="md" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/90">
          {jugador.name}
        </span>
        <TeamFlag
          flagUrl={jugador.flag_url}
          teamName={jugador.national_team}
          size="sm"
        />
        {/* Badge de nivel de riesgo */}
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
          style={{
            color: estilo.accent,
            border: `1px solid ${estilo.accent}`,
            boxShadow: `inset 0 0 8px color-mix(in oklab, ${estilo.accent} 18%, transparent), ${estilo.glow}`,
          }}
          title={`${estilo.etiquetaEstado} — ${estilo.etiquetaVeredicto}`}
        >
          C{jugador.ai_inference.class}
        </span>
      </button>
    </li>
  );
}
