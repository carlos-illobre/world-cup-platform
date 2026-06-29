import { AlertTriangle, ThermometerSun, Mountain, Wind } from "lucide-react";
import { GlassPanel } from "@/shared/components/GlassPanel";
import type { ImpactoClimatico } from "@/shared/types/injuryRisk.types";

// Human-readable labels for climate features
const CLIMATE_FEATURE_LABELS: Record<string, string> = {
  climate_heat_stress: "Estrés por calor",
  climate_heat_x_recurrent: "Calor × Lesión recurrente",
  climate_heat_x_injury_freq: "Calor × Frecuencia lesión",
  climate_altitude_factor: "Factor altitud",
  climate_altitude_x_age: "Altitud × Edad",
  climate_temp_differential: "Diferencial de temperatura",
  climate_humidity_differential: "Diferencial de humedad",
  climate_altitude_differential: "Diferencial de altitud",
  climate_adaptation_stress: "Estrés de adaptación",
  climate_dehydration_risk: "Riesgo deshidratación",
  climate_is_high_altitude: "Altitud elevada (>1500m)",
  climate_is_extreme_heat: "Calor extremo (>32°C)",
};

interface ClimateImpactPanelProps {
  climateImpact: ImpactoClimatico | null | undefined;
  playerCountry?: string;
}

/**
 * Panel que muestra cómo las condiciones climáticas del estadio
 * afectan la predicción de riesgo de lesión del jugador.
 *
 * Solo se muestra cuando hay datos climáticos disponibles y
 * el impacto es > 0 (las condiciones realmente afectan al jugador).
 */
export function ClimateImpactPanel({
  climateImpact,
  playerCountry,
}: ClimateImpactPanelProps) {
  if (!climateImpact || climateImpact.adjustment_points <= 0) {
    return null;
  }

  const severity =
    climateImpact.adjustment_points > 15
      ? "high"
      : climateImpact.adjustment_points > 5
        ? "moderate"
        : "low";

  const severityColor = {
    high: "text-red-400",
    moderate: "text-amber-400",
    low: "text-emerald-400",
  }[severity];

  const severityBg = {
    high: "bg-red-500/10 border-red-500/30",
    moderate: "bg-amber-500/10 border-amber-500/30",
    low: "bg-emerald-500/10 border-emerald-500/30",
  }[severity];

  return (
    <GlassPanel title="Impacto Climático en Riesgo">
      {/* Summary badge */}
      <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${severityBg}`}>
        <AlertTriangle className={`h-4 w-4 ${severityColor}`} />
        <span className={`text-sm font-bold ${severityColor}`}>
          +{climateImpact.adjustment_points.toFixed(1)} pts riesgo
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          por condiciones del estadio
        </span>
      </div>

      {/* Venue conditions */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-lg bg-black/20 p-2">
          <ThermometerSun className="mb-1 h-4 w-4 text-orange-400" />
          <span className="text-xs text-muted-foreground">Temp</span>
          <span className="text-sm font-bold text-foreground">
            {climateImpact.venue_temp_c}°C
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-black/20 p-2">
          <Wind className="mb-1 h-4 w-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">Humedad</span>
          <span className="text-sm font-bold text-foreground">
            {climateImpact.venue_humidity_pct}%
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-black/20 p-2">
          <Mountain className="mb-1 h-4 w-4 text-purple-400" />
          <span className="text-xs text-muted-foreground">Altitud</span>
          <span className="text-sm font-bold text-foreground">
            {climateImpact.venue_elevation_m}m
          </span>
        </div>
      </div>

      {/* Top contributing factors */}
      {climateImpact.top_factors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Factores principales
          </p>
          {climateImpact.top_factors.map((factor, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md bg-black/10 px-2.5 py-1.5"
            >
              <span className="text-xs text-foreground">
                {CLIMATE_FEATURE_LABELS[factor.feature] || factor.feature}
              </span>
              <span className={`text-xs font-bold ${factor.contribution > 2 ? "text-red-400" : "text-amber-400"}`}>
                +{factor.contribution.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Explanation footer */}
      <p className="mt-3 text-xs leading-tight text-muted-foreground/80">
        El modelo ajusta el riesgo base según interacciones clima × perfil del
        jugador{playerCountry ? ` (adaptado a ${playerCountry})` : ""}.
        Basado en literatura de medicina deportiva (Ekstrand et al., FIFA Medical Reports).
      </p>
    </GlassPanel>
  );
}
