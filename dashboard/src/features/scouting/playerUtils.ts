/**
 * Scouting Scoring System — Weighted Percentile Rank with Moneyball Adjustment
 * =============================================================================
 *
 * PURPOSE: This page helps scouts find players with high impact relative to their
 * "cost" (overall rating, age, injury risk). The star system rewards players who
 * "punch above their weight" — contributing more than their reputation suggests.
 *
 * ALGORITHM:
 * 1. Each metric is converted to a percentile rank [0,1] via empirical CDF breakpoints
 *    derived from the dataset (N=1,257 World Cup-eligible players).
 * 2. A base_quality score is computed as a weighted sum of ranks.
 * 3. A value_bonus measures how much impact exceeds what overall "promises":
 *    value_bonus = rank_impact - rank_overall
 *    Positive → "bargain" (delivers more than expected)
 *    Negative → "overpriced" (famous but underdelivers)
 * 4. Final score: base_quality × (1 + 0.20 × value_bonus)
 *    The ±20% adjustment rewards bargains and penalizes overpriced players.
 * 5. Stars assigned from quantile thresholds of the full dataset distribution.
 *
 * BREAKPOINTS: Generated from master_players_enriched.csv using df[col].quantile()
 * at 5% intervals. See evaluate_scoring.py for the full derivation.
 *
 * Dataset: master_players_enriched.csv (N=1,257)
 * Computed: 2026-06-29
 */

// Friendly names for clusters (no algorithm name)
export const STYLE_NAMES: Record<string, string> = {
  "0": "Defensor",
  "1": "Extremo / Carrilero",
  "2": "Volante Defensivo",
  "3": "Creador / Mediapunta",
  "4": "Goleador",
};

// ═══════════════════════════════════════════════════════════
// PERCENTILE BREAKPOINTS (empirical CDF, 5% intervals)
// Source: df[col].quantile(range(0, 1.05, 0.05))
// ═══════════════════════════════════════════════════════════

/** Overall FIFA rating (N=1257, mean=70.87, std=7.30) */
const OVERALL_BREAKPOINTS: [number, number][] = [
  [47, 0.00], [59, 0.05], [62, 0.10], [64, 0.15], [65, 0.20], [66, 0.25],
  [67, 0.30], [68, 0.35], [69, 0.40], [70, 0.45], [71, 0.50], [72, 0.55],
  [73, 0.60], [73, 0.65], [75, 0.70], [76, 0.75], [77, 0.80], [79, 0.85],
  [80, 0.90], [83, 0.95], [93, 1.00],
];

/** Impact score (N=1257, mean=0.00, std=1.95) — Z-score sum of G+A/90 + PPM + On/Off */
const IMPACT_BREAKPOINTS: [number, number][] = [
  [-11.35, 0.00], [-2.93, 0.05], [-2.17, 0.10], [-1.67, 0.15], [-1.32, 0.20],
  [-1.08, 0.25], [-0.86, 0.30], [-0.66, 0.35], [-0.44, 0.40], [-0.28, 0.45],
  [-0.04, 0.50], [0.16, 0.55], [0.33, 0.60], [0.58, 0.65], [0.78, 0.70],
  [1.06, 0.75], [1.31, 0.80], [1.61, 0.85], [2.10, 0.90], [2.80, 0.95],
  [14.67, 1.00],
];

/** Injuries per year (N=1257, mean=0.70, std=0.74) — total_injuries / (age - 17) */
const INJURIES_YEAR_BREAKPOINTS: [number, number][] = [
  [0.000, 0.00], [0.073, 0.05], [0.092, 0.10], [0.111, 0.15], [0.140, 0.20],
  [0.170, 0.25], [0.221, 0.30], [0.273, 0.35], [0.326, 0.40], [0.391, 0.45],
  [0.486, 0.50], [0.583, 0.55], [0.680, 0.60], [0.775, 0.65], [0.874, 0.70],
  [0.981, 0.75], [1.091, 0.80], [1.274, 0.85], [1.512, 0.90], [2.039, 0.95],
  [7.119, 1.00],
];

/** xG Overperformance — FW only (N=354, mean=0.05, std=2.93) */
const XG_FW_BREAKPOINTS: [number, number][] = [
  [-11.28, 0.00], [-4.59, 0.05], [-3.03, 0.10], [-1.88, 0.15], [-1.08, 0.20],
  [-0.54, 0.25], [-0.24, 0.30], [0.00, 0.35], [0.00, 0.40], [0.00, 0.45],
  [0.06, 0.50], [0.10, 0.55], [0.10, 0.60], [0.20, 0.65], [0.30, 0.70],
  [0.44, 0.75], [0.90, 0.80], [1.61, 0.85], [2.92, 0.90], [5.16, 0.95],
  [15.24, 1.00],
];

/** Age (N=1257, mean=27.92, std=4.27) */
const AGE_BREAKPOINTS: [number, number][] = [
  [17.7, 0.00], [21.3, 0.05], [22.7, 0.10], [23.5, 0.15], [24.1, 0.20],
  [24.9, 0.25], [25.4, 0.30], [26.0, 0.35], [26.5, 0.40], [27.2, 0.45],
  [27.7, 0.50], [28.2, 0.55], [28.7, 0.60], [29.4, 0.65], [30.0, 0.70],
  [30.6, 0.75], [31.6, 0.80], [32.5, 0.85], [33.8, 0.90], [35.2, 0.95],
  [43.4, 1.00],
];

// ═══════════════════════════════════════════════════════════
// WEIGHTS & THRESHOLDS
// ═══════════════════════════════════════════════════════════

/**
 * Base quality weights — validated via Logistic Regression against real
 * season performance data (all_competitions_stats_standard.csv, N=1,225).
 *
 * Optimization targets:
 *   - is_starter: played >=P75 minutes (AUC 0.61)
 *   - is_efficient: top 25% G+A/90 (AUC 0.80)
 *   - is_valuable: starter AND efficient (AUC 0.61)
 *
 * Final weights = average of optimal weights across all 3 targets.
 * Availability (injuries) got 0% because empirically, players with more
 * injuries are often starters with long careers — the correlation is POSITIVE
 * with playing time. We keep a small weight (5%) for World Cup context where
 * short-term availability matters more than in a full season.
 */
const BASE_WEIGHTS = {
  overall: 0.30,       // Validated: ~31% optimal
  impact: 0.30,        // Validated: ~29% optimal
  availability: 0.05,  // Empirically 0%, kept at 5% for WC tournament context
  xg: 0.35,           // Validated: ~39% optimal — strongest predictor of contribution
} as const;

/**
 * Value adjustment factor — validated optimal: 0.15
 * Tested range [0, 0.50] in steps of 0.05 against 3 targets.
 * Best avg AUC at 0.15 (AUC=0.6530 vs 0.6515 at 0.00).
 * The improvement is small but consistent — the Moneyball effect exists
 * but is modest when measured against actual season performance.
 */
const VALUE_ADJUSTMENT = 0.15;

/**
 * Star thresholds from the moneyball_norm distribution quantiles.
 * Recomputed with validated weights (30/30/5/35, factor=0.15).
 * Distribution: 5★=5%, 4★=15%, 3★=30%, 2★=30%, 1★=20%
 */
const STAR_THRESHOLDS = {
  five: 0.7672,   // P95
  four: 0.6244,   // P80
  three: 0.4558,  // P50
  two: 0.2959,    // P20
} as const;

// ═══════════════════════════════════════════════════════════
// HELPER: Linear interpolation on empirical CDF
// ═══════════════════════════════════════════════════════════

function valueToPercentile(value: number, breakpoints: [number, number][]): number {
  if (value <= breakpoints[0][0]) return 0;
  if (value >= breakpoints[breakpoints.length - 1][0]) return 1;

  for (let i = 1; i < breakpoints.length; i++) {
    const [prevVal, prevPct] = breakpoints[i - 1];
    const [currVal, currPct] = breakpoints[i];
    if (value <= currVal) {
      const t = (currVal === prevVal) ? 1 : (value - prevVal) / (currVal - prevVal);
      return prevPct + t * (currPct - prevPct);
    }
  }
  return 1;
}

// ═══════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════

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
  const position = String(player.position || "");

  const careerYears = Math.max(age - 17, 1);
  const injuriesPerYear = injuries / careerYears;

  const reasons: string[] = [];

  // Step 1: Compute percentile ranks
  const rankOverall = valueToPercentile(overall, OVERALL_BREAKPOINTS);
  const rankImpact = valueToPercentile(impact, IMPACT_BREAKPOINTS);
  const rankAvailability = 1 - valueToPercentile(injuriesPerYear, INJURIES_YEAR_BREAKPOINTS);
  const isFW = position.includes("FW");
  const rankXg = isFW ? valueToPercentile(xg, XG_FW_BREAKPOINTS) : 0.5;

  // Step 2: Base quality (weighted sum of ranks)
  const baseQuality =
    BASE_WEIGHTS.overall * rankOverall +
    BASE_WEIGHTS.impact * rankImpact +
    BASE_WEIGHTS.availability * rankAvailability +
    BASE_WEIGHTS.xg * rankXg;

  // Step 3: Value bonus (Moneyball adjustment)
  // Positive = player contributes more than their overall "promises"
  // Negative = player is "overpriced" relative to actual contribution
  const valueBonus = rankImpact - rankOverall;
  const clampedBonus = Math.max(-1, Math.min(1, valueBonus));

  // Step 4: Final Moneyball score
  const rawScore = baseQuality * (1 + VALUE_ADJUSTMENT * clampedBonus);

  // Normalize to [0, 1] using empirical min/max from dataset
  // Recomputed with validated weights (30/30/5/35, factor=0.15)
  const SCORE_MIN = 0.1200;
  const SCORE_MAX = 0.9448;
  const normalizedScore = Math.max(0, Math.min(1, (rawScore - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)));

  // Step 5: Generate reasons
  if (rankOverall >= 0.95) reasons.push(`Élite mundial (Overall ${overall}, top 5%)`);
  else if (rankOverall >= 0.85) reasons.push(`Selección top (Overall ${overall}, top 15%)`);
  else if (rankOverall >= 0.75) reasons.push(`Nivel internacional (Overall ${overall}, top 25%)`);
  else if (rankOverall >= 0.50) reasons.push(`Nivel competitivo (Overall ${overall})`);
  else if (rankOverall >= 0.25) reasons.push(`Nivel limitado (Overall ${overall})`);
  else reasons.push(`Nivel insuficiente (Overall ${overall || "N/A"})`);

  if (rankImpact >= 0.90) reasons.push(`Aporte excepcional al equipo (top 10%)`);
  else if (rankImpact >= 0.75) reasons.push(`Alto aporte al equipo (top 25%)`);
  else if (rankImpact >= 0.50) reasons.push(`Aporte promedio`);
  else if (rankImpact >= 0.25) reasons.push(`Bajo aporte relativo`);
  else reasons.push(`Aporte muy bajo (bottom 25%)`);

  if (rankAvailability >= 0.75) reasons.push(`Alta disponibilidad (${injuriesPerYear.toFixed(1)} lesiones/año)`);
  else if (rankAvailability >= 0.50) reasons.push(`Disponibilidad normal (${injuriesPerYear.toFixed(1)} lesiones/año)`);
  else if (rankAvailability >= 0.15) reasons.push(`Riesgo moderado de baja (${injuriesPerYear.toFixed(1)} lesiones/año)`);
  else reasons.push(`Alto riesgo de baja (${injuriesPerYear.toFixed(1)} lesiones/año)`);

  if (isFW) {
    if (rankXg >= 0.90) reasons.push(`Finalizador élite (xG: +${xg.toFixed(1)}, top 10%)`);
    else if (rankXg >= 0.75) reasons.push(`Buen finalizador (xG: +${xg.toFixed(1)})`);
    else if (rankXg >= 0.25) reasons.push(`Eficiencia goleadora normal (xG: ${xg.toFixed(1)})`);
    else reasons.push(`Subconvierte oportunidades (xG: ${xg.toFixed(1)}, bottom 25%)`);
  }

  // Value bonus reason (the Moneyball insight)
  if (valueBonus > 0.15) reasons.push(`💰 Ganga: rinde por encima de su nivel técnico`);
  else if (valueBonus < -0.30) reasons.push(`⚠️ Sobrevalorado: rinde por debajo de lo esperado`);

  if (age >= 35) reasons.push(`${Math.floor(age)} años: riesgo de declive`);
  else if (age <= 22 && rankImpact >= 0.50) reasons.push(`${Math.floor(age)} años: alta proyección`);

  // Step 6: Assign stars
  let stars: number;
  let label: string;
  let color: string;
  let bgColor: string;

  if (normalizedScore >= STAR_THRESHOLDS.five) {
    stars = 5; label = "Altamente Recomendado"; color = "text-green-400"; bgColor = "bg-green-500/10 border-green-500/30";
  } else if (normalizedScore >= STAR_THRESHOLDS.four) {
    stars = 4; label = "Recomendado"; color = "text-green-300"; bgColor = "bg-green-500/5 border-green-500/20";
  } else if (normalizedScore >= STAR_THRESHOLDS.three) {
    stars = 3; label = "Opción Viable"; color = "text-yellow-400"; bgColor = "bg-yellow-500/10 border-yellow-500/30";
  } else if (normalizedScore >= STAR_THRESHOLDS.two) {
    stars = 2; label = "Con Reservas"; color = "text-orange-400"; bgColor = "bg-orange-500/10 border-orange-500/30";
  } else {
    stars = 1; label = "No Recomendado"; color = "text-red-400"; bgColor = "bg-red-500/10 border-red-500/30";
  }

  return { label, color, bgColor, reasons, stars };
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

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

/**
 * Impact score to stars — standalone utility.
 * Thresholds from impact_score_raw percentiles (N=1257):
 * P95=2.80, P75=1.06, P50=-0.04, P25=-1.08
 */
export function impactToStars(impact: number | null): number {
  if (impact == null) return 0;
  if (impact > 2.80) return 5;   // >P95
  if (impact > 1.06) return 4;   // >P75
  if (impact > -0.04) return 3;  // >P50
  if (impact > -1.08) return 2;  // >P25
  return 1;                       // <P25
}
