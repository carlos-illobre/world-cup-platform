/**
 * User-facing labels and utilities for the Scouting Grid.
 * Translates technical metrics into decision-oriented language.
 */

// Friendly names for clusters (no algorithm name)
export const STYLE_NAMES: Record<string, string> = {
  "0": "Defensor",
  "1": "Extremo / Carrilero",
  "2": "Volante Defensivo",
  "3": "Creador / Mediapunta",
  "4": "Goleador",
};

// Get recommendation verdict for a player
// When `countryContext` is provided, evaluation is relative to that country's options.
// When null (global view), evaluation uses absolute world-class standards.
export function getPlayerVerdict(player: any, countryContext: string | null = null): {
  label: string;
  color: string;
  bgColor: string;
  reasons: string[];
  stars: number;
} {
  const impact = Number(player.impact_score) || 0;
  const injuries = Number(player.total_injuries) || 0;
  const xg = Number(player.xg_overperformance) || 0;
  const age = Number(player.age) || 27;
  const overall = Number(player.attributes?.overall) || 0;

  const reasons: string[] = [];
  let score = 0;

  // Adjust thresholds based on context
  const isGlobalView = !countryContext;

  if (isGlobalView) {
    // GLOBAL VIEW: Absolute world-class standards for World Cup level
    // Overall is the primary gate — must be elite to score high
    if (overall >= 84) { score += 3; reasons.push(`Élite mundial (Overall ${overall})`); }
    else if (overall >= 79) { score += 2; reasons.push(`Nivel de selección top (Overall ${overall})`); }
    else if (overall >= 75) { score += 1; reasons.push(`Competitivo a nivel internacional (Overall ${overall})`); }
    else if (overall >= 70) { score += 0; reasons.push(`Nivel justo para selección menor (Overall ${overall})`); }
    else { score -= 2; reasons.push(`Nivel insuficiente para competencia mundial (Overall ${overall || "N/A"})`); }

    // Impact matters but less than absolute quality at global level
    if (impact > 3.5) { score += 1; reasons.push("Máximo aporte relativo a su equipo"); }
    else if (impact > 2.0) { score += 1; }
    else if (impact < -0.5) { score -= 1; reasons.push("Bajo aporte a su equipo"); }

  } else {
    // COUNTRY VIEW: Relative to the country's pool of available players
    // Here impact and availability matter more — this DT has limited options
    if (impact > 2.5) { score += 3; reasons.push("El de mayor aporte en su selección"); }
    else if (impact > 1.0) { score += 2; reasons.push("Jugador clave para esta selección"); }
    else if (impact > 0) { score += 1; reasons.push("Aporte positivo al equipo"); }
    else { score -= 1; reasons.push("Bajo aporte relativo al plantel"); }

    // Overall still matters but with lower bar (relative to country's reality)
    if (overall >= 78) { score += 2; reasons.push(`Nivel destacado para su selección (Overall ${overall})`); }
    else if (overall >= 70) { score += 1; reasons.push(`Buen nivel para su selección (Overall ${overall})`); }
    else if (overall < 62) { score -= 1; reasons.push(`Nivel técnico limitado (Overall ${overall || "N/A"})`); }
  }

  // Injury risk (same in both contexts)
  if (injuries > 10) { score -= 2; reasons.push(`${injuries} lesiones históricas: alto riesgo de baja`); }
  else if (injuries > 5) { score -= 1; reasons.push(`${injuries} lesiones: riesgo moderado`); }
  else { score += 1; reasons.push(`Buena disponibilidad (${injuries} lesiones)`); }

  // xG overperformance
  if (xg > 0.5) { score += 1; reasons.push("Define partidos: convierte más de lo esperado"); }
  else if (xg < -0.5) { score -= 1; reasons.push("Desperdicia oportunidades claras"); }

  // Age (context-aware)
  if (isGlobalView) {
    if (age >= 34) { score -= 1; reasons.push(`${Math.floor(age)} años: riesgo de declive físico`); }
    else if (age <= 23 && overall >= 75) { score += 1; reasons.push(`${Math.floor(age)} años con proyección`); }
  } else {
    // For a small country, a 34yo veteran might be their best option
    if (age >= 36 && overall < 72) { score -= 1; reasons.push(`${Math.floor(age)} años: considerar recambio`); }
    else if (age <= 23 && impact > 0) { score += 1; reasons.push(`${Math.floor(age)} años: futuro del equipo`); }
  }

  // Determine verdict + stars
  if (score >= 5) return { label: "Altamente Recomendado", color: "text-green-400", bgColor: "bg-green-500/10 border-green-500/30", reasons, stars: 5 };
  if (score >= 3) return { label: "Recomendado", color: "text-green-300", bgColor: "bg-green-500/5 border-green-500/20", reasons, stars: 4 };
  if (score >= 1) return { label: "Opción Viable", color: "text-yellow-400", bgColor: "bg-yellow-500/10 border-yellow-500/30", reasons, stars: 3 };
  if (score >= -1) return { label: "Con Reservas", color: "text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/30", reasons, stars: 2 };
  return { label: "No Recomendado", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/30", reasons, stars: 1 };
}

// Get top 2-3 strengths from FIFA attributes
export function getTopStrengths(attributes: any): { label: string; value: number }[] {
  if (!attributes) return [];
  
  const attrs = [
    { key: "pace", label: "Velocidad", value: Number(attributes.pace) || 0 },
    { key: "shooting", label: "Definición", value: Number(attributes.shooting) || 0 },
    { key: "passing", label: "Pase", value: Number(attributes.passing) || 0 },
    { key: "dribbling", label: "Técnica", value: Number(attributes.dribbling) || 0 },
    { key: "defending", label: "Marca", value: Number(attributes.defending) || 0 },
    { key: "physical", label: "Potencia", value: Number(attributes.physical) || 0 },
  ];

  return attrs
    .filter(a => a.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

// Convert impact score to stars (1-5)
// The impact_score_raw is a Z-score sum (mean≈0, std≈1.5 for each component, sum of 3).
// Distribution: ~68% between -1.5 and +1.5, ~95% between -3 and +3.
// Calibrated thresholds for meaningful differentiation:
export function impactToStars(impact: number | null): number {
  if (impact == null) return 0;
  if (impact > 3.5) return 5;   // Top ~2% — world class
  if (impact > 2.0) return 4;   // Top ~10% — excellent
  if (impact > 0.8) return 3;   // Above average
  if (impact > -0.5) return 2;  // Average / slightly below
  return 1;                     // Well below average
}
