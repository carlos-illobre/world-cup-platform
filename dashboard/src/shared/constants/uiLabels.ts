/**
 * Textos visibles del dashboard en castellano.
 * Fuente única de verdad para toda la interfaz de usuario.
 */
export const UI_LABELS = {
  app: {
    brand: "Fixar",
    brandSuffix: "Analytics",
    pageTitle: "Fixar Analytics — Panel de Riesgo de Lesiones",
    pageDescription:
      "Predicciones de riesgo de lesión impulsadas por IA para los partidos del Mundial de Fútbol.",
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
  fixture: {
    selectDateHint: "Seleccioná una fecha para ver los partidos disponibles.",
    noMatchesForDate: "No hay partidos programados para esta fecha.",
    versus: "VS",
  },
  errors: {
    catalogLoadFailed: "No se pudo cargar el catálogo:",
    predictionLoadFailed: "No se pudo cargar el diagnóstico de riesgo:",
  },
  selectionGuide: {
    title: "Seleccioná fecha, partido y jugador para analizar el riesgo de lesión",
    description:
      "Elegí una fecha, un partido y un jugador. El modelo de IA calculará el riesgo de lesión, estrés por altitud y un veredicto de aptitud para jugar.",
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
    squadInference: "Plantel del partido — Riesgo de Lesión por Jugador",
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
  injuryRiskVerdict: {
    title: (label: string, classNumber: number) =>
      `DIAGNÓSTICO IA: ${label} (Clase ${classNumber})`,
    justificationPrefix: "Justificación técnica del modelo:",
  },
  squad: {
    playerCount: (count: number) => `${count} jug.`,
    endpointPending: "Endpoint todavía no disponible",
    endpointDetail: (matchNumber: number, error: string) =>
      `Esperando GET /api/v3/mundial/partidos/${matchNumber}/plantilla-con-diagnostico. Detalle: ${error}`,
  },
} as const;
