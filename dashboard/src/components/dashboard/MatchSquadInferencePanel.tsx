import { useMemo } from "react";
import { Panel, Skeleton } from "@/components/dashboard/Panel";
import { AI_INFERENCE_STYLES } from "@/constants/ai-inference";
import { useMatchPlayersInferences } from "@/hooks/useMatchPlayersInferences";
import type {
  PlayerWithInference,
  TeamSquadInference,
} from "@/lib/api/match-inferences";

interface MatchSquadInferencePanelProps {
  matchNumber: number | null;
  selectedPlayerId: string | null;
  onPlayerSelect: (playerId: string) => void;
}

/** Orden: rojos (2) → amarillos (1) → verdes (0), luego alfabético. */
function sortByRisk(players: PlayerWithInference[]): PlayerWithInference[] {
  return [...players].sort((a, b) => {
    if (a.ai_inference.class !== b.ai_inference.class) {
      return b.ai_inference.class - a.ai_inference.class;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Panel con dos columnas (una por selección) listando los jugadores del
 * partido seleccionado con su inferencia IA. Click selecciona al jugador.
 */
export function MatchSquadInferencePanel({
  matchNumber,
  selectedPlayerId,
  onPlayerSelect,
}: MatchSquadInferencePanelProps) {
  const { data, loading, error } = useMatchPlayersInferences(matchNumber);

  const sortedHome = useMemo(
    () => (data ? sortByRisk(data.home.players) : []),
    [data],
  );
  const sortedAway = useMemo(
    () => (data ? sortByRisk(data.away.players) : []),
    [data],
  );

  if (!matchNumber) return null;

  return (
    <Panel title="Plantel del partido — Inferencia IA por jugador">
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-neon-yellow/40 bg-neon-yellow/5 px-4 py-6 text-center text-sm text-foreground/80">
          <p className="font-semibold text-neon-yellow">
            Endpoint todavía no disponible
          </p>
          <p className="mt-1 text-muted-foreground">
            Esperando{" "}
            <code className="rounded bg-secondary/60 px-1.5 py-0.5 text-[11px]">
              GET /api/v3/mundial/partidos/{matchNumber}/plantilla-con-diagnostico
            </code>
            . Detalle: {error}
          </p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TeamColumn
            squad={{ team: data.home.team, players: sortedHome }}
            selectedPlayerId={selectedPlayerId}
            onPlayerSelect={onPlayerSelect}
          />
          <TeamColumn
            squad={{ team: data.away.team, players: sortedAway }}
            selectedPlayerId={selectedPlayerId}
            onPlayerSelect={onPlayerSelect}
          />
        </div>
      ) : null}
    </Panel>
  );
}

interface TeamColumnProps {
  squad: TeamSquadInference;
  selectedPlayerId: string | null;
  onPlayerSelect: (playerId: string) => void;
}

function TeamColumn({
  squad,
  selectedPlayerId,
  onPlayerSelect,
}: TeamColumnProps) {
  return (
    <div className="glass flex flex-col gap-2 rounded-xl p-3">
      <header className="flex items-center gap-2 border-b border-border/60 pb-2">
        <img
          src={squad.team.flag_url}
          alt={squad.team.name}
          width={28}
          height={20}
          className="h-5 w-7 rounded-sm object-cover ring-1 ring-border"
        />
        <h3 className="font-display text-sm font-extrabold tracking-wide text-foreground">
          {squad.team.name}
        </h3>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
          {squad.players.length} jug.
        </span>
      </header>

      <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
        {squad.players.map((player) => {
          const style = AI_INFERENCE_STYLES[player.ai_inference.class];
          const isSelected = player.id === selectedPlayerId;
          return (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onPlayerSelect(player.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${isSelected
                    ? "border-neon-blue/70 bg-neon-blue/10"
                    : "border-transparent hover:border-neon-blue/40 hover:bg-secondary/40"
                  }`}
                style={
                  isSelected
                    ? { boxShadow: "0 0 0 1px var(--neon-blue) inset" }
                    : undefined
                }
              >
                <img
                  src={player.face_url}
                  alt={player.name}
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/90">
                  {player.name}
                </span>
                <img
                  src={player.flag_url}
                  alt={player.national_team}
                  width={20}
                  height={14}
                  className="h-[14px] w-5 shrink-0 rounded-sm object-cover ring-1 ring-border"
                />
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                  style={{
                    color: style.accent,
                    border: `1px solid ${style.accent}`,
                    boxShadow: `inset 0 0 8px color-mix(in oklab, ${style.accent} 18%, transparent), ${style.glow}`,
                  }}
                  title={`${style.statusLabel} — ${style.verdictLabel}`}
                >
                  C{player.ai_inference.class}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
