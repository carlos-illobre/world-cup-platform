import { TeamFlag } from "@/shared/components/TeamFlag";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { PlayerInferenceRow } from "@/features/squad/components/PlayerInferenceRow";
import type { PlantillaConInferencia, JugadorConInferencia } from "@/shared/types/injuryRisk.types";

interface TeamSquadColumnProps {
  plantilla: PlantillaConInferencia;
}

/** Ordena jugadores: mayor riesgo (2) → precaución (1) → seguro (0), luego alfabético. */
function ordenarPorNivelRiesgo(jugadores: JugadorConInferencia[]): JugadorConInferencia[] {
  return [...jugadores].sort((a, b) => {
    const classA = a.ai_inference?.class ?? -1;
    const classB = b.ai_inference?.class ?? -1;
    if (classA !== classB) {
      return classB - classA;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Columna del plantel de un equipo con jugadores ordenados por riesgo de lesión. */
export function TeamSquadColumn({ plantilla }: TeamSquadColumnProps) {
  const jugadoresOrdenados = ordenarPorNivelRiesgo(plantilla.players);

  return (
    <div className="glass flex flex-col gap-2 rounded-xl p-3">
      <header className="flex items-center gap-2 border-b border-border/60 pb-2">
        <TeamFlag
          flagUrl={plantilla.team.flag_url}
          teamName={plantilla.team.name}
          size="sm"
          className="h-5 w-7"
        />
        <h3 className="font-display text-sm font-extrabold tracking-wide text-foreground">
          {plantilla.team.name}
        </h3>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">
          {UI_LABELS.squad.playerCount(plantilla.players.length)}
        </span>
      </header>

      <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
        {jugadoresOrdenados.map((jugador) => (
          <PlayerInferenceRow key={jugador.id} jugador={jugador} />
        ))}
      </ul>
    </div>
  );
}
