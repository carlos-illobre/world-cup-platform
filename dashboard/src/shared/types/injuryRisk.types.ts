/**
 * Tipos de dominio del sistema de predicción de riesgo de lesiones del Mundial.
 * Fuente única de verdad para todas las entidades del negocio.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Clasificación de riesgo IA (resultado de inferencia)
// ─────────────────────────────────────────────────────────────────────────────

/** Clase de riesgo: -1 = sin datos, 0 = seguro, 1 = precaución, 2 = riesgo */
export type ClaseRiesgo = -1 | 0 | 1 | 2;

/** Nivel de estrés fisiológico del jugador */
export type NivelEstres = "LOW" | "MODERATE" | "HIGH";

// ─────────────────────────────────────────────────────────────────────────────
// Métricas del jugador
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricasRadar {
  cardio: number;
  endurance: number;
  engagement: number;
  respiratory: number;
  recovery: number;
}

export interface MetricasFisiologicas {
  sleep_quality: number;      // porcentaje (0-100)
  hydration: number;           // porcentaje (0-100)
  body_temp: number;           // grados Celsius
  stress: NivelEstres;
  fatigue_index: number;       // porcentaje (0-100)
  heart_rate_bpm: number;
  heart_rate_series: number[];
  training: {
    duration: number[];
    load: number[];
    intensity: number[];
  };
}

export interface DatosJugador {
  id: string;
  name: string;
  number: number;
  national_team: string;
  team_code: string;
  flag_url: string;
  face_url: string;
  rating_label: string;        // "EXCELLENT" | "GOOD" | "FAIR"
  stats: MetricasFisiologicas;
  radar: MetricasRadar;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto del partido (fixture)
// ─────────────────────────────────────────────────────────────────────────────

export interface EquipoNacional {
  name: string;
  code: string;                // código de 3 letras, ej: "MEX"
  flag_url: string;
}

export interface CondicionesClimaticas {
  temp_c: number;
  humidity: number;
  altitude: number;            // metros sobre el nivel del mar
}

export interface ContextoPartido {
  id: string;
  label: string;
  opponent: string;
  venue: string;
  stadium_url: string;
  home: EquipoNacional;
  away: EquipoNacional;
  weather: CondicionesClimaticas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inferencia de riesgo de lesión (resultado del modelo IA)
// ─────────────────────────────────────────────────────────────────────────────

export interface FactorClimatico {
  feature: string;
  contribution: number;
}

export interface ImpactoClimatico {
  adjustment_points: number;
  venue_temp_c: number;
  venue_humidity_pct: number;
  venue_elevation_m: number;
  top_factors: FactorClimatico[];
}

export interface InferenciaRiesgoLesion {
  class: ClaseRiesgo;
  label: string;
  justification: string;
  model_used?: string;
  risk_proba?: number;
  base_risk_score?: number;
  climate_impact?: ImpactoClimatico | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporte de preparación (respuesta completa del diagnóstico)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportePreparacion {
  player: DatosJugador;
  match_context: ContextoPartido;
  ai_inference: InferenciaRiesgoLesion;
}

export interface ReportePreparacionResponse {
  data: ReportePreparacion;
}

// ─────────────────────────────────────────────────────────────────────────────
// Opciones para selección en el UI
// ─────────────────────────────────────────────────────────────────────────────

export interface OpcionJugador {
  id: string;
  name: string;
  national_team: string;
  team_code: string;
  flag_url: string;
  face_url: string;
}

export interface FechaJornada {
  id: string;
  label: string;
  date: string;
  match_count: number;
}

export interface PartidoResumido {
  id: string;
  match_number: number;
  home: EquipoNacional;
  away: EquipoNacional;
  venue: string;
  stadium_url?: string;
  kickoff_at: string;
  weather?: CondicionesClimaticas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de inferencia por plantel completo
// ─────────────────────────────────────────────────────────────────────────────

export interface JugadorConInferencia {
  id: string;
  name: string;
  national_team: string;
  team_code: string;
  flag_url: string;
  face_url: string;
  ai_inference: {
    class: ClaseRiesgo;
    label: string;
  };
}

export interface PlantillaConInferencia {
  team: EquipoNacional;
  players: JugadorConInferencia[];
}

export interface InferenciaPlantillaPartido {
  match_number: number;
  home: PlantillaConInferencia;
  away: PlantillaConInferencia;
}

export interface InferenciaPlantillaResponse {
  data: InferenciaPlantillaPartido;
}
