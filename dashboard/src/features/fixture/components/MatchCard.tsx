import { MapPin, Mountain, Thermometer, Droplets } from "lucide-react";
import { TeamFlag } from "@/shared/components/TeamFlag";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import type { PartidoResumido } from "@/shared/types/injuryRisk.types";

interface MatchCardProps {
  partido: PartidoResumido;
  isSelected: boolean;
  onSelect: (matchNumber: number) => void;
}

/** Card de partido con banderas de los equipos, resultado VS y sede. */
export function MatchCard({ partido, isSelected, onSelect }: MatchCardProps) {
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
          <TeamFlag flagUrl={partido.home.flag_url} teamName={partido.home.name} size="md" />
          <span className="text-xs font-bold text-foreground/90">{partido.home.code}</span>
        </div>

        <span className="font-display text-sm font-extrabold text-glow-blue">
          {UI_LABELS.fixture.versus}
        </span>

        <div className="flex flex-col items-center gap-1">
          <TeamFlag flagUrl={partido.away.flag_url} teamName={partido.away.name} size="md" />
          <span className="text-xs font-bold text-foreground/90">{partido.away.code}</span>
        </div>
      </div>

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
