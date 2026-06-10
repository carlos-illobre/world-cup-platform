import { Droplets, MapPin, Mountain, Thermometer } from "lucide-react";
import { Panel, Skeleton } from "@/components/dashboard/Panel";
import { GeoRow } from "@/components/dashboard/GeoRow";
import { UI_LABELS } from "@/constants/ui-labels";
import { formatAltitude, formatTemperature } from "@/lib/formatters";
import type { MatchContext } from "@/lib/predictions.types";

interface GeoclimaticPanelProps {
  matchContext: MatchContext | undefined;
  loading: boolean;
}

/** Panel de información geoclimática del partido. */
export function GeoclimaticPanel({ matchContext, loading }: GeoclimaticPanelProps) {
  return (
    <Panel title={UI_LABELS.panels.geoclimatic}>
      {loading || !matchContext ? (
        <Skeleton className="mb-4 h-28 w-full rounded-xl" />
      ) : (
        <img
          src={matchContext.stadium_url}
          alt={UI_LABELS.geo.stadiumAlt(matchContext.venue)}
          loading="lazy"
          width={900}
          height={500}
          className="mb-4 h-28 w-full rounded-xl object-cover ring-1 ring-border"
        />
      )}
      <ul className="space-y-2.5">
        <GeoRow
          icon={<MapPin className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.venue}
          loading={loading}
          value={matchContext?.venue ?? ""}
        />
        <GeoRow
          icon={<Mountain className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.altitude}
          loading={loading}
          value={
            matchContext ? formatAltitude(matchContext.weather.altitude) : ""
          }
        />
        <GeoRow
          icon={<Thermometer className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.temperature}
          loading={loading}
          value={
            matchContext ? formatTemperature(matchContext.weather.temp_c) : ""
          }
        />
        <GeoRow
          icon={<Droplets className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.humidity}
          loading={loading}
          value={
            matchContext
              ? `${matchContext.weather.humidity.toFixed(1)}%`
              : ""
          }
        />
      </ul>
    </Panel>
  );
}
