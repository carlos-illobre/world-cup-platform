/**
 * Textos visibles del dashboard en castellano.
 * Fuente única de verdad para toda la interfaz de usuario.
 */
export const UI_LABELS = {
  app: {
    brand: "Fixar",
    brandSuffix: "Analytics",
    pageTitle: "Fixar Analytics — Panel de Preparación de Jugadores",
    pageDescription:
      "Predicciones impulsadas por IA sobre recuperación fisiológica, estrés por altitud y aptitud para jugar.",
  },
  header: {
    selectPlayer: "Seleccionar jugador:",
  },
  playerCombobox: {
    placeholder: "Buscar jugador…",
    disabledPlaceholder: "Seleccioná un partido primero…",
    searchPlaceholder: "Escribí el nombre del jugador…",
    emptyResults: "No se encontraron jugadores.",
  },
  schedule: {
    selectDateHint: "Seleccioná una fecha para ver los partidos disponibles.",
    noMatchesForDate: "No hay partidos programados para esta fecha.",
  },
  matchTimeline: {
    versus: "VS",
  },
  errors: {
    catalogLoadFailed: "No se pudo cargar el catálogo:",
    predictionLoadFailed: "No se pudo cargar la predicción:",
  },
  emptyState: {
    title: "Seleccioná fecha, partido y jugador para comenzar el análisis",
    description:
      "Elegí una fecha, un partido y un jugador. El motor de IA calculará la preparación, el estrés por altitud y un veredicto de aptitud para jugar.",
    stepDate: "1 · Elegir fecha",
    stepMatch: "2 · Elegir partido",
    stepPlayer: "3 · Elegir jugador",
    dateSelected: "✓ Fecha seleccionada",
    matchSelected: "✓ Partido seleccionado",
    playerSelected: "✓ Jugador seleccionado",
  },
  panels: {
    physiological: "Recuperación Fisiológica y Estrés por Altitud",
    geoclimatic: "Información Geoclimática",
    heartRate: "Frecuencia Cardíaca",
  },
  stats: {
    sleepQuality: "Calidad del Sueño",
    hydrationLevel: "Nivel de Hidratación",
    bodyTemperature: "Temperatura Corporal",
    stressLevel: "Nivel de Estrés",
    fatigueIndex: "ÍNDICE DE FATIGA",
    trainingDurationLoad: "Duración y Carga de Entrenamiento",
    loadIntensity: "Carga e Intensidad",
    duration: "DURACIÓN",
    load: "CARGA",
    intensity: "INTENSIDAD",
  },
  geo: {
    venue: "Estadio",
    altitude: "Altitud",
    temperature: "Temp.",
    humidity: "Humedad",
    stadiumAlt: (venue: string) => `Estadio ${venue}`,
  },
  heartRate: {
    load: "CARGA",
    current: "Actual:",
    bpm: "LPM",
  },
  radar: {
    cardio: "CARDIO",
    engagement: "COMPROMISO",
    recovery: "RECUPERACIÓN",
    respiratory: "RESPIRATORIO",
    endurance: "RESISTENCIA",
  },
  aiInference: {
    title: (label: string, classNumber: number) =>
      `INFERENCIA IA: ${label} (Clase ${classNumber})`,
    justificationPrefix: "Justificación técnica de la IA:",
  },
  versus: "VS",
} as const;
