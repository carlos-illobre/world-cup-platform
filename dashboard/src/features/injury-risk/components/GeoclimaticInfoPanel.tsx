import { Droplets, MapPin, Mountain, Thermometer } from "lucide-react";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { Skeleton } from "@/shared/components/Skeleton";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import {
  formatearAltitud,
  formatearTemperatura,
  formatearHumedad,
} from "@/shared/lib/formatters";
import type { ContextoPartido } from "@/shared/types/injuryRisk.types";

interface GeoInfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
}

function GeoInfoRow({ icon, label, value, loading }: GeoInfoRowProps) {
  return (
    <li className="flex items-center gap-2.5 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      {icon}
      <span className="text-sm font-medium text-muted-foreground">{label}:</span>
      {loading ? (
        <Skeleton className="ml-auto h-5 w-20" />
      ) : (
        <span className="ml-auto font-display text-sm font-bold text-foreground">
          {value}
        </span>
      )}
    </li>
  );
}

interface GeoclimaticInfoPanelProps {
  contextoPartido: ContextoPartido | undefined;
  loading: boolean;
}

/**
 * Panel de información geoclimática del partido:
 * foto del estadio, sede, altitud, temperatura y humedad.
 */
export function GeoclimaticInfoPanel({
  contextoPartido,
  loading,
}: GeoclimaticInfoPanelProps) {
  return (
    <GlassPanel title={UI_LABELS.panels.geoclimatic}>
      {/* Foto del estadio */}
      {loading || !contextoPartido ? (
        <Skeleton className="mb-4 h-28 w-full rounded-xl" />
      ) : (
        <img
          src={contextoPartido.stadium_url}
          alt={UI_LABELS.geo.stadiumAlt(contextoPartido.venue)}
          loading="lazy"
          width={900}
          height={500}
          className="mb-4 h-28 w-full rounded-xl object-cover ring-1 ring-border"
        />
      )}

      {/* Datos geoclimáticos */}
      <ul className="space-y-2.5">
        <GeoInfoRow
          icon={<MapPin className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.venue}
          loading={loading}
          value={contextoPartido?.venue ?? ""}
        />
        <GeoInfoRow
          icon={<Mountain className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.altitude}
          loading={loading}
          value={contextoPartido ? formatearAltitud(contextoPartido.weather.altitude) : ""}
        />
        <GeoInfoRow
          icon={<Thermometer className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.temperature}
          loading={loading}
          value={contextoPartido ? formatearTemperatura(contextoPartido.weather.temp_c) : ""}
        />
        <GeoInfoRow
          icon={<Droplets className="h-4 w-4 text-neon-blue" />}
          label={UI_LABELS.geo.humidity}
          loading={loading}
          value={contextoPartido ? formatearHumedad(contextoPartido.weather.humidity) : ""}
        />
      </ul>
    </GlassPanel>
  );
}
