import { GlassPanel } from "@/shared/components/GlassPanel";
import { Skeleton } from "@/shared/components/Skeleton";
import { useAppSelector } from "@/app/hooks";
import { selectNumeroPartidoSeleccionado, selectSimulatedTeams } from "@/features/fixture/fixtureSlice";
import { useGetInferenciaPlantillaQuery } from "@/features/squad/squadApi";
import { TeamSquadColumn } from "@/features/squad/components/TeamSquadColumn";
import { Shield, Target } from "lucide-react";
import type { JugadorConInferencia } from "@/shared/types/injuryRisk.types";

function getTacticalInsight(players: JugadorConInferencia[], teamName: string): string {
  const countVulnerable = players.filter(p => (p.ai_inference?.class ?? 0) >= 1).length;
  const countCritical = players.filter(p => (p.ai_inference?.class ?? 0) >= 2).length;

  if (countCritical > 3) return `${countCritical} jugadores en riesgo crítico. Plantel muy exigido físicamente.`;
  if (countVulnerable > 5) return `${countVulnerable} jugadores con desgaste moderado. Posible rotación necesaria.`;
  if (countVulnerable > 2) return `${countVulnerable} jugadores con algún desgaste, pero plantel mayormente disponible.`;
  return "Plantel en buenas condiciones físicas generales.";
}

/**
 * Panel principal de inteligencia táctica: muestra ambos planteles
 * ordenados por vulnerabilidad física con recomendaciones de explotación.
 */
export function SquadInferencePanel() {
  const numeroPartido = useAppSelector(selectNumeroPartidoSeleccionado);
  const simulatedTeams = useAppSelector(selectSimulatedTeams);

  const {
    data,
    isLoading,
    error,
  } = useGetInferenciaPlantillaQuery(
    { matchNumber: numeroPartido!, teams: simulatedTeams || undefined },
    { skip: !numeroPartido },
  );

  if (!numeroPartido) return null;

  const homePlayers = data?.home?.players || [];
  const awayPlayers = data?.away?.players || [];
  const homeTeamName = data?.home?.team?.name || "Equipo A";
  const awayTeamName = data?.away?.team?.name || "Equipo B";

  return (
    <div className="space-y-4">
      {/* Tactical Summary Bar */}
      {data && (
        <div className="glass-panel rounded-2xl px-5 py-4">
          <h3 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-neon-blue" />
            Estado Físico de Ambos Equipos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-gray-300 font-bold uppercase mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-neon-blue" /> {homeTeamName}
              </p>
              <p className="text-sm text-gray-300">{getTacticalInsight(homePlayers, homeTeamName)}</p>
            </div>
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-gray-300 font-bold uppercase mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-neon-blue" /> {awayTeamName}
              </p>
              <p className="text-sm text-gray-300">{getTacticalInsight(awayPlayers, awayTeamName)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Squad columns */}
      <GlassPanel title="Mapa de Vulnerabilidades — Ambos Equipos">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-neon-yellow/40 bg-neon-yellow/5 px-4 py-6 text-center text-sm text-foreground/80">
            <p className="font-semibold text-neon-yellow">
              No se pudo cargar los planteles para este partido.
            </p>
            <p className="mt-1 text-muted-foreground">
              Si es un partido de knockout, presioná "Predecir equipos" en la tarjeta del partido.
            </p>
          </div>
        ) : data ? (
          <>
            <p className="text-sm text-gray-400 mb-3">
              Jugadores ordenados de mayor a menor riesgo de lesión. Clickeá un jugador para ver su diagnóstico completo.
              Los jugadores <span className="text-red-400 font-bold">en rojo</span> están más vulnerables — son los que conviene presionar si son rivales, o descansar si son propios.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TeamSquadColumn plantilla={data.home} />
              <TeamSquadColumn plantilla={data.away} />
            </div>
          </>
        ) : null}
      </GlassPanel>
    </div>
  );
}
