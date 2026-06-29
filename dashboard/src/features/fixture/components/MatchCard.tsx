import { useState } from "react";
import { MapPin, Mountain, Thermometer, Droplets, Sparkles } from "lucide-react";
import { TeamFlag } from "@/shared/components/TeamFlag";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import type { PartidoResumido } from "@/shared/types/injuryRisk.types";

interface MatchCardProps {
  partido: PartidoResumido;
  isSelected: boolean;
  onSelect: (matchNumber: number) => void;
  onSimulateTeams?: (matchNumber: number, homeTeam: string, awayTeam: string) => void;
}

/** Card de partido con banderas de los equipos, resultado VS y sede. */
export function MatchCard({ partido, isSelected, onSelect, onSimulateTeams }: MatchCardProps) {
  const [simulating, setSimulating] = useState(false);
  const [simulatedTeams, setSimulatedTeams] = useState<{ home: string; away: string } | null>(null);

  const hasTBD = partido.home.code === "TBD" || partido.away.code === "TBD";
  const displayHome = simulatedTeams ? { ...partido.home, name: simulatedTeams.home, code: simulatedTeams.home.slice(0, 3).toUpperCase() } : partido.home;
  const displayAway = simulatedTeams ? { ...partido.away, name: simulatedTeams.away, code: simulatedTeams.away.slice(0, 3).toUpperCase() } : partido.away;
  async function handleSimulate(e: React.MouseEvent) {
    e.stopPropagation();
    setSimulating(true);
    try {
      const res = await fetch(`${INJURY_API_BASE_URL}/api/v1/tournament/simulate`);
      if (!res.ok) throw new Error("Simulation failed");
      const data = await res.json();

      // Find this match in the knockout rounds
      const matchNum = partido.match_number;
      const allMatches = [
        ...(data.knockout?.round_of_32 || []),
        ...(data.knockout?.round_of_16 || []),
        ...(data.knockout?.quarter_finals || []),
        ...(data.knockout?.semi_finals || []),
        ...(data.knockout?.third_place || []),
        ...(data.knockout?.final || []),
      ];
      const simMatch = allMatches.find((m: any) => m.match_number === matchNum);
      if (simMatch) {
        setSimulatedTeams({ home: simMatch.team_a, away: simMatch.team_b });
        // Notify parent so it can trigger squad reload with the correct teams
        onSimulateTeams?.(matchNum, simMatch.team_a, simMatch.team_b);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(partido.match_number)}
      className={`glass flex flex-col items-center gap-2 rounded-xl px-3 py-3 text-center transition-all ${
        isSelected
          ? "border-neon-green/70 neon-ring-green"
          : "hover:border-neon-blue/50"
      }`}
    >
      {partido.stadium_url && (
        <img
          src={partido.stadium_url}
          alt={partido.venue}
          loading="lazy"
          className="mb-1 h-20 w-full rounded-lg object-cover ring-1 ring-border/50"
        />
      )}
      <div className="flex w-full items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <TeamFlag flagUrl={displayHome.flag_url} teamName={displayHome.name} size="md" />
          <span className="text-xs font-bold text-foreground/90">{displayHome.code}</span>
        </div>

        <span className="font-display text-sm font-extrabold text-glow-blue">
          {UI_LABELS.fixture.versus}
        </span>

        <div className="flex flex-col items-center gap-1">
          <TeamFlag flagUrl={displayAway.flag_url} teamName={displayAway.name} size="md" />
          <span className="text-xs font-bold text-foreground/90">{displayAway.code}</span>
        </div>
      </div>

      {/* Simulate button for TBD matches */}
      {hasTBD && !simulatedTeams && (
        <button
          type="button"
          onClick={handleSimulate}
          disabled={simulating}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-500/30 transition-all disabled:opacity-50"
        >
          <Sparkles className="w-3 h-3" />
          {simulating ? "Simulando..." : "Predecir equipos"}
        </button>
      )}
      {simulatedTeams && (
        <span className="text-[10px] text-purple-400 font-medium mt-0.5">✨ Predicción del simulador</span>
      )}

      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0 text-neon-blue" />
        <span className="truncate">{partido.venue}</span>
      </span>

      {partido.weather && (
        <div className="mt-2 flex w-full items-center justify-center gap-3 border-t border-white/5 pt-2 text-xs text-muted-foreground">
          {partido.weather.altitude != null && (
            <div className="flex items-center gap-1" title="Altitud">
              <Mountain className="h-3 w-3 text-neon-blue" />
              <span>{partido.weather.altitude}m</span>
            </div>
          )}
          {partido.weather.temp_c != null && (
            <div className="flex items-center gap-1" title="Temperatura">
              <Thermometer className="h-3 w-3 text-neon-orange" />
              <span>{partido.weather.temp_c}°C</span>
            </div>
          )}
          {partido.weather.humidity != null && (
            <div className="flex items-center gap-1" title="Humedad">
              <Droplets className="h-3 w-3 text-neon-blue" />
              <span>{partido.weather.humidity}%</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
