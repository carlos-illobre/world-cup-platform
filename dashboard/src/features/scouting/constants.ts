/**
 * Cluster constants derived from the K-Means algorithm in model_clustering.py.
 * The clustering uses 10 per-90 features (goals, assists, shots, tackles, crosses, etc.)
 * and assigns each outfield player to one of 5 tactical profiles.
 *
 * Cluster mapping is programmatic — determined by which centroid has the highest
 * value in the defining metric for each role.
 */

export const CLUSTER_COLORS: Record<string, string> = {
  "0": "#10b981", // Emerald — Positional defenders
  "1": "#3b82f6", // Blue — Volume wingers
  "2": "#8b5cf6", // Purple — Ball winners / destroyers
  "3": "#f43f5e", // Rose — Efficient attackers / creators
  "4": "#eab308", // Yellow — Box strikers / finishers
};

export const CLUSTER_NAMES: Record<string, string> = {
  "0": "Defensor Posicional",
  "1": "Carrilero / Extremo",
  "2": "Destructor / Recuperador",
  "3": "Atacante Eficiente / Creador",
  "4": "Goleador / Delantero de Área",
};

export const CLUSTER_DESCRIPTIONS: Record<string, string> = {
  "0": "Jugadores conservadores con baja participación ofensiva directa. Dominan la organización táctica.",
  "1": "Extremos activos con elevado volumen de centros, regates y faltas sufridas.",
  "2": "Jugadores defensivos muy activos. Alta tasa de entradas ganadas e intercepciones.",
  "3": "Mediapuntas o creadores resolutivos. Alta producción de goles y asistencias por minuto.",
  "4": "Finalizadores netos. Alto volumen de disparos, tiros a puerta y fueras de juego.",
};
