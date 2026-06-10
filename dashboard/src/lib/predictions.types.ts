// Shared types for the Fixar Analytics prediction API.

export type AiClass = 0 | 1 | 2;

export interface RadarMetrics {
  cardio: number;
  endurance: number;
  engagement: number;
  respiratory: number;
  recovery: number;
}

export interface PlayerStats {
  sleep_quality: number; // %
  hydration: number; // %
  body_temp: number; // celsius
  stress: "LOW" | "MODERATE" | "HIGH";
  fatigue_index: number; // %
  heart_rate_bpm: number;
  heart_rate_series: number[];
  training: { duration: number[]; load: number[]; intensity: number[] };
}

export interface PlayerData {
  id: string;
  name: string;
  number: number;
  national_team: string;
  team_code: string;
  flag_url: string;
  face_url: string;
  rating_label: string; // e.g. "EXCELLENT"
  stats: PlayerStats;
  radar: RadarMetrics;
}

export interface MatchTeam {
  name: string;
  code: string; // 3-letter, e.g. "MEX"
  flag_url: string;
}

export interface MatchContext {
  id: string;
  label: string;
  opponent: string;
  venue: string;
  stadium_url: string;
  home: MatchTeam;
  away: MatchTeam;
  weather: {
    temp_c: number;
    humidity: number;
    altitude: number;
  };
}

export interface AiInference {
  class: AiClass;
  label: string;
  justification: string;
}

export interface PredictionResponse {
  data: {
    player: PlayerData;
    match_context: MatchContext;
    ai_inference: AiInference;
  };
}

// ---- Selection list option types ----

export interface PlayerOption {
  id: string;
  name: string;
  national_team: string;
  team_code: string;
  flag_url: string;
  face_url: string;
}

export interface MatchOption {
  id: string;
  home: MatchTeam;
  away: MatchTeam;
  venue: string;
}

export interface MatchDay {
  id: string;
  label: string; // e.g. "Matchday 1"
  date: string; // e.g. "Jun 14"
  matches: MatchOption[];
}

/** Fecha de jornada (API v2). */
export interface MatchDate {
  id: string;
  label: string;
  date: string;
  match_count: number;
}

/** Partido resumido para el carrusel (API v2). */
export interface MatchListItem {
  id: string;
  match_number: number;
  home: MatchTeam;
  away: MatchTeam;
  venue: string;
  kickoff_at: string;
}
