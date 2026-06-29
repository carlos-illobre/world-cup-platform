import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { PlayerAvatar } from "@/shared/components/PlayerAvatar";
import { seleccionarJugador, selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import type { JugadorConInferencia } from "@/shared/types/injuryRisk.types";

interface PlayerInferenceRowProps {
  jugador: JugadorConInferencia;
}

/** Fila de jugador con indicador visual de vulnerabilidad física. */
export function PlayerInferenceRow({ jugador }: PlayerInferenceRowProps) {
  const dispatch = useAppDispatch();
  const jugadorSeleccionadoId = useAppSelector(selectJugadorSeleccionadoId);
  const inferenceClass = jugador.ai_inference?.class ?? -1;
  const riskScore = (jugador.ai_inference as any)?.risk_score ?? null;
  const isSelected = jugador.id === jugadorSeleccionadoId;

  // Visual indicators based on risk level
  const riskConfig = inferenceClass >= 2
    ? { color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", label: "Crítico", barColor: "bg-red-500" }
    : inferenceClass === 1
      ? { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", label: "Moderado", barColor: "bg-yellow-500" }
      : inferenceClass === 0
        ? { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "Apto", barColor: "bg-green-500" }
        : { color: "text-gray-500", bg: "bg-white/5 border-white/10", label: "N/A", barColor: "bg-gray-600" };

  return (
    <li>
      <button
        type="button"
        onClick={() => dispatch(seleccionarJugador(jugador.id))}
        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
          isSelected
            ? "border-neon-blue/70 bg-neon-blue/10"
            : "border-transparent hover:border-neon-blue/40 hover:bg-secondary/40"
        }`}
      >
        <PlayerAvatar faceUrl={jugador.face_url} playerName={jugador.name} size="md" />
        
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground/90">
            {jugador.name}
          </span>
        </div>

        {/* Risk indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {riskScore != null && (
            <div className="w-16 flex flex-col items-end gap-0.5">
              <span className={`text-xs font-bold ${riskConfig.color}`}>
                {riskScore.toFixed(0)}%
              </span>
              <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${riskConfig.barColor}`} style={{ width: `${Math.min(riskScore, 100)}%` }} />
              </div>
            </div>
          )}
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold border ${riskConfig.bg} ${riskConfig.color}`}>
            {riskConfig.label}
          </span>
        </div>
      </button>
    </li>
  );
}
