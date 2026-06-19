import { useState, useEffect, useRef, useMemo } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { Search } from "lucide-react";

/**
 * Maps Spanish country names to the English names used in the backend data.
 * Also includes the English name as key so it works with either language.
 */
const COUNTRY_MAP: Record<string, string> = {
  // Spanish → English
  "argelia": "Algeria", "argentina": "Argentina", "australia": "Australia",
  "austria": "Austria", "bélgica": "Belgium", "belgica": "Belgium",
  "bosnia": "Bosnia-Herzegovina", "bosnia-herzegovina": "Bosnia-Herzegovina",
  "brasil": "Brazil", "canadá": "Canada", "canada": "Canada",
  "cabo verde": "Cape Verde", "colombia": "Colombia",
  "congo": "Congo DR", "república democrática del congo": "Congo DR",
  "croacia": "Croatia", "curazao": "Curaçao", "curaçao": "Curaçao",
  "chequia": "Czechia", "república checa": "Czechia",
  "costa de marfil": "Côte d'Ivoire", "côte d'ivoire": "Côte d'Ivoire",
  "ecuador": "Ecuador", "egipto": "Egypt", "inglaterra": "England",
  "francia": "France", "alemania": "Germany", "ghana": "Ghana",
  "haití": "Haiti", "haiti": "Haiti", "irán": "IR Iran", "iran": "IR Iran",
  "irak": "Iraq", "iraq": "Iraq", "japón": "Japan", "japon": "Japan",
  "jordania": "Jordan", "corea del sur": "Korea Republic",
  "corea": "Korea Republic", "república de corea": "Korea Republic",
  "méxico": "Mexico", "mexico": "Mexico", "marruecos": "Morocco",
  "países bajos": "Netherlands", "holanda": "Netherlands",
  "nueva zelanda": "New Zealand", "noruega": "Norway",
  "panamá": "Panama", "panama": "Panama", "paraguay": "Paraguay",
  "portugal": "Portugal", "catar": "Qatar", "qatar": "Qatar",
  "arabia saudita": "Saudi Arabia", "escocia": "Scotland",
  "senegal": "Senegal", "sudáfrica": "South Africa",
  "sudafrica": "South Africa", "españa": "Spain", "espana": "Spain",
  "suecia": "Sweden", "suiza": "Switzerland", "túnez": "Tunisia",
  "tunez": "Tunisia", "turquía": "Türkiye", "turquia": "Türkiye",
  "estados unidos": "United States", "eeuu": "United States",
  "usa": "United States", "uruguay": "Uruguay", "uzbekistán": "Uzbekistan",
  "uzbekistan": "Uzbekistan",
  // English (pass-through)
  "algeria": "Algeria", "belgium": "Belgium", "brazil": "Brazil",
  "croatia": "Croatia", "czechia": "Czechia", "egypt": "Egypt",
  "england": "England", "france": "France", "germany": "Germany",
  "haiti": "Haiti", "japan": "Japan", "jordan": "Jordan",
  "morocco": "Morocco", "netherlands": "Netherlands",
  "norway": "Norway", "spain": "Spain", "sweden": "Sweden",
  "switzerland": "Switzerland", "tunisia": "Tunisia",
};

// Display list: show both Spanish and English for autocomplete
const TEAM_OPTIONS = [
  { label: "Argentina", value: "Argentina" },
  { label: "Alemania (Germany)", value: "Germany" },
  { label: "Arabia Saudita", value: "Saudi Arabia" },
  { label: "Argelia (Algeria)", value: "Algeria" },
  { label: "Australia", value: "Australia" },
  { label: "Austria", value: "Austria" },
  { label: "Bélgica (Belgium)", value: "Belgium" },
  { label: "Bosnia-Herzegovina", value: "Bosnia-Herzegovina" },
  { label: "Brasil (Brazil)", value: "Brazil" },
  { label: "Cabo Verde", value: "Cape Verde" },
  { label: "Canadá", value: "Canada" },
  { label: "Catar (Qatar)", value: "Qatar" },
  { label: "Chequia (Czechia)", value: "Czechia" },
  { label: "Colombia", value: "Colombia" },
  { label: "Congo DR", value: "Congo DR" },
  { label: "Corea del Sur", value: "Korea Republic" },
  { label: "Costa de Marfil", value: "Côte d'Ivoire" },
  { label: "Croacia (Croatia)", value: "Croatia" },
  { label: "Curazao (Curaçao)", value: "Curaçao" },
  { label: "Ecuador", value: "Ecuador" },
  { label: "Egipto (Egypt)", value: "Egypt" },
  { label: "Escocia (Scotland)", value: "Scotland" },
  { label: "España (Spain)", value: "Spain" },
  { label: "Estados Unidos (USA)", value: "United States" },
  { label: "Francia (France)", value: "France" },
  { label: "Ghana", value: "Ghana" },
  { label: "Haití", value: "Haiti" },
  { label: "Holanda (Netherlands)", value: "Netherlands" },
  { label: "Inglaterra (England)", value: "England" },
  { label: "Irak (Iraq)", value: "Iraq" },
  { label: "Irán (IR Iran)", value: "IR Iran" },
  { label: "Japón (Japan)", value: "Japan" },
  { label: "Jordania (Jordan)", value: "Jordan" },
  { label: "Marruecos (Morocco)", value: "Morocco" },
  { label: "México", value: "Mexico" },
  { label: "Noruega (Norway)", value: "Norway" },
  { label: "Nueva Zelanda", value: "New Zealand" },
  { label: "Panamá", value: "Panama" },
  { label: "Paraguay", value: "Paraguay" },
  { label: "Portugal", value: "Portugal" },
  { label: "Senegal", value: "Senegal" },
  { label: "Sudáfrica (South Africa)", value: "South Africa" },
  { label: "Suecia (Sweden)", value: "Sweden" },
  { label: "Suiza (Switzerland)", value: "Switzerland" },
  { label: "Túnez (Tunisia)", value: "Tunisia" },
  { label: "Turquía (Türkiye)", value: "Türkiye" },
  { label: "Uruguay", value: "Uruguay" },
  { label: "Uzbekistán", value: "Uzbekistan" },
];

// Descriptions for each SHAP feature to explain what it means
const FEATURE_DESCRIPTIONS: Record<string, string> = {
  ranking_diff: "Diferencia de puntos FIFA entre ambos equipos. Es el predictor más fuerte: cuando la brecha es grande, el equipo mejor rankeado tiene ventaja estadística histórica significativa.",
  Country_FIFA_Points: "Puntos FIFA del Equipo A según el ranking oficial. Se obtiene del registro más reciente en la base de datos de rankings (scrapeados mensualmente desde la fuente FIFA).",
  Opponent_FIFA_Points: "Puntos FIFA del Equipo B. Un puntaje más alto indica mayor fortaleza competitiva reciente a nivel internacional.",
  h2h_wins: "Número de victorias del Equipo A contra el Equipo B en Copas del Mundo anteriores. El historial de enfrentamientos directos tiene peso psicológico demostrado en la literatura deportiva.",
  h2h_losses: "Derrotas del Equipo A contra el Equipo B. Un historial desfavorable penaliza la predicción.",
  days_since_last_match: "Días transcurridos desde el último partido oficial del equipo. Valores bajos (< 5 días) pueden indicar fatiga acumulada, mientras que valores muy altos pueden indicar falta de ritmo competitivo.",
  form_last_5: "Suma de puntos en los últimos 5 partidos (V=3, E=1, D=0). Captura el momentum: un equipo 'en racha' tiene mayor confianza y cohesión. Rango: 0 (5 derrotas) a 15 (5 victorias).",
  goals_scored_last_5: "Promedio de goles a favor en los últimos 5 partidos. Refleja la efectividad ofensiva actual, independiente del rival enfrentado.",
  goals_conceded_last_5: "Promedio de goles en contra en los últimos 5 partidos. Valores altos indican fragilidad defensiva reciente.",
  temp_max: "Temperatura máxima en el estadio (°C). Se obtiene de la API Open-Meteo usando las coordenadas GPS del estadio. Temperaturas extremas (>30°C) pueden afectar el rendimiento de equipos no habituados.",
  precipitation: "Precipitación esperada (mm). Con lluvia >2mm el terreno se vuelve más lento, los pases por tierra pierden precisión y los equipos técnicos se ven más afectados.",
  wind_speed: "Velocidad del viento máxima (km/h). Vientos fuertes afectan los centros, saques de banda largos y la trayectoria de tiros libres — favoreciendo estilos de juego directo.",
  is_raining: "Indicador binario: 1 si precipitación > 2mm. Simplifica la variable continua en una señal clara de 'condiciones de lluvia' para el modelo.",
  is_hot: "Indicador binario: 1 si temperatura > 30°C. Marca condiciones de calor extremo que históricamente reducen la intensidad del pressing y el ritmo de juego.",
};

// --- Autocomplete Input Component ---
interface TeamAutocompleteProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

function TeamAutocomplete({ label, value, onChange }: TeamAutocompleteProps) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    const match = TEAM_OPTIONS.find((t) => t.value === value);
    if (match) setInput(match.label);
  }, [value]);

  const filtered = useMemo(() => {
    if (!input.trim()) return TEAM_OPTIONS;
    const q = input.toLowerCase();
    return TEAM_OPTIONS.filter(
      (t) => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q)
    );
  }, [input]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(team: typeof TEAM_OPTIONS[0]) {
    onChange(team.value);
    setInput(team.label);
    setOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    setOpen(true);
    // Try to resolve from map
    const resolved = COUNTRY_MAP[e.target.value.toLowerCase().trim()];
    if (resolved) onChange(resolved);
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-gray-300 text-sm font-medium mb-1.5">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-300" />
        <input
          value={input}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder="Buscar país..."
          className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue transition-all"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleSelect(t)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 ${
                t.value === value ? "bg-neon-blue/10 text-neon-blue font-bold" : "text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export function MatchPredictionPage() {
  const [teamA, setTeamA] = useState("Argentina");
  const [teamB, setTeamB] = useState("France");
  const [temp, setTemp] = useState(25);
  const [precip, setPrecip] = useState(0);
  const [wind, setWind] = useState(10);
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predictMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${INJURY_API_BASE_URL}/api/v1/matches/predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_a: teamA,
          team_b: teamB,
          temp_max: temp,
          precipitation: precip,
          wind_speed: wind,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        throw new Error(errData.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setPrediction(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al conectar con el servidor");
      setPrediction(null);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <AppHeader />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Predicción de Partidos
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Simulador XGBoost que predice probabilidades de victoria usando datos reales 
              de ranking FIFA, forma reciente, historial H2H y condiciones climáticas.
            </p>

            <div className="space-y-5">
              <TeamAutocomplete label="Equipo A (Local)" value={teamA} onChange={setTeamA} />
              <TeamAutocomplete label="Equipo B (Visitante)" value={teamB} onChange={setTeamB} />

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Condiciones Climáticas del Estadio
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-300 text-xs mb-1">🌡️ Temp (°C)</label>
                    <input
                      type="number"
                      value={temp}
                      onChange={(e) => setTemp(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-neon-blue outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-xs mb-1">🌧️ Lluvia (mm)</label>
                    <input
                      type="number"
                      value={precip}
                      onChange={(e) => setPrecip(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-neon-blue outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-xs mb-1">💨 Viento (km/h)</label>
                    <input
                      type="number"
                      value={wind}
                      onChange={(e) => setWind(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-neon-blue outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={predictMatch}
                className="w-full bg-neon-blue text-black font-bold py-3 rounded-xl mt-2 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50"
                disabled={loading || !teamA || !teamB}
              >
                {loading ? "Calculando predicción..." : "⚡ Predecir Partido"}
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Results Panel */}
          {prediction && (
            <div className="glass-panel p-6 rounded-2xl flex flex-col">
              <h3 className="text-2xl font-display font-bold text-white text-center mb-3">
                {prediction.team_a} vs {prediction.team_b}
              </h3>

              {/* Weather Display */}
              {prediction.weather && (
                <div className="flex justify-center gap-5 text-sm text-gray-300 mb-5 bg-black/30 px-4 py-2.5 rounded-lg border border-white/5">
                  <span>🌡️ {prediction.weather.temp_max}°C</span>
                  <span>🌧️ {prediction.weather.precipitation}mm</span>
                  <span>💨 {prediction.weather.wind_speed} km/h</span>
                </div>
              )}

              {/* Probability Display */}
              <div className="w-full flex justify-between items-end mb-3 px-4">
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-neon-blue">
                    {(prediction.probabilities.win_A * 100).toFixed(0)}%
                  </span>
                  <span className="text-sm text-gray-300 mt-1">{prediction.team_a}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-gray-300">
                    {(prediction.probabilities.draw * 100).toFixed(0)}%
                  </span>
                  <span className="text-sm text-gray-300">Empate</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-purple-400">
                    {(prediction.probabilities.win_B * 100).toFixed(0)}%
                  </span>
                  <span className="text-sm text-gray-300 mt-1">{prediction.team_b}</span>
                </div>
              </div>

              <div className="w-full h-5 bg-gray-800 rounded-full flex overflow-hidden shadow-inner">
                <div
                  style={{ width: `${prediction.probabilities.win_A * 100}%` }}
                  className="bg-neon-blue transition-all duration-500"
                />
                <div
                  style={{ width: `${prediction.probabilities.draw * 100}%` }}
                  className="bg-gray-500 transition-all duration-500"
                />
                <div
                  style={{ width: `${prediction.probabilities.win_B * 100}%` }}
                  className="bg-purple-500 transition-all duration-500"
                />
              </div>

              {/* Predicted winner */}
              <p className="text-center mt-4 text-sm text-gray-300">
                Predicción del modelo:{" "}
                <strong className="text-white text-base">{prediction.prediction}</strong>
              </p>

              {/* SHAP Explainability */}
              {prediction.explanations && prediction.explanations.length > 0 && (
                <div className="w-full mt-6 pt-5 border-t border-white/10">
                  <h4 className="text-base font-bold text-white mb-2">
                    🤖 ¿Por qué el modelo llegó a esta conclusión?
                  </h4>
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5 mb-4">
                    <p className="text-sm text-gray-200 leading-relaxed">
                      El modelo <strong className="text-neon-blue">XGBoost (match_outcome_weather_xgb)</strong> evaluó 
                      14 variables simultáneamente para estimar la probabilidad de victoria. Cada variable tiene un 
                      <strong className="text-yellow-300"> peso SHAP</strong> que indica cuánto empujó la predicción 
                      hacia un lado u otro. A continuación se muestran los 4 factores más decisivos:
                    </p>
                  </div>

                  <div className="space-y-3">
                    {prediction.explanations.map((exp: any, i: number) => {
                      const desc = FEATURE_DESCRIPTIONS[exp.raw_feature] || null;
                      return (
                        <div
                          key={i}
                          className={`bg-black/30 px-4 py-4 rounded-xl border-l-4 ${
                            exp.weight > 0 ? "border-l-neon-blue" : "border-l-red-500"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="text-white font-bold text-base">{exp.feature}</span>
                              {desc && (
                                <p className="text-sm text-gray-300 mt-1 leading-relaxed">{desc}</p>
                              )}
                            </div>
                            <span
                              className={`font-bold text-lg shrink-0 ml-3 ${
                                exp.weight > 0 ? "text-neon-blue" : "text-red-400"
                              }`}
                            >
                              {exp.weight_display}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              exp.weight > 0 
                                ? "bg-neon-blue/10 text-neon-blue border border-neon-blue/30" 
                                : "bg-red-500/10 text-red-400 border border-red-500/30"
                            }`}>
                              {exp.weight > 0 ? "↑" : "↓"} {exp.impact}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* What is SHAP explanation */}
                  <div className="mt-4 bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                    <p className="text-xs text-gray-300 leading-relaxed">
                      <strong className="text-purple-300">¿Qué es SHAP?</strong> — SHAP (SHapley Additive Explanations) 
                      es un método de interpretabilidad de modelos de Machine Learning basado en la teoría de juegos cooperativos. 
                      Cada valor SHAP indica la contribución marginal de una variable a la predicción final. 
                      Un valor positivo (+) empuja la predicción hacia la victoria del Equipo A, 
                      mientras que un valor negativo (-) empuja hacia empate o victoria del Equipo B.
                    </p>
                  </div>
                </div>
              )}

              {/* Data sources - explained */}
              {prediction.data_sources && (
                <div className="w-full mt-5 pt-4 border-t border-white/5">
                  <details className="text-sm text-gray-200" open>
                    <summary className="cursor-pointer hover:text-white transition-colors font-bold text-base mb-3">
                      📊 Datos reales alimentados al modelo
                    </summary>
                    <p className="text-sm text-gray-300 mb-4">
                      Estos son los valores <strong className="text-white">reales extraídos de las fuentes de datos</strong> (FBref, FIFA Rankings, 
                      historial de World Cups) que el modelo recibió como input. No son inventados ni hardcodeados — 
                      se obtienen del último partido registrado de cada selección en <code className="text-purple-300">master_matches_featured.csv</code>.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Puntos FIFA — {prediction.team_a}</p>
                        <p className="text-lg font-bold text-white">{prediction.data_sources.team_a_fifa_points}</p>
                        <p className="text-xs text-gray-400 mt-1">Puntuación FIFA oficial que refleja el rendimiento reciente de la selección en competiciones internacionales.</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Puntos FIFA — {prediction.team_b}</p>
                        <p className="text-lg font-bold text-white">{prediction.data_sources.team_b_fifa_points}</p>
                        <p className="text-xs text-gray-400 mt-1">A mayor puntaje, mejor posición en el ranking mundial y mayor probabilidad base de victoria.</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Diferencial de Ranking</p>
                        <p className="text-lg font-bold text-white">{prediction.data_sources.ranking_diff}</p>
                        <p className="text-xs text-gray-400 mt-1">Diferencia de puntos FIFA entre ambos equipos. Positivo = Equipo A está mejor rankeado. Es la variable con mayor poder predictivo del modelo.</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Victorias H2H ({prediction.team_a})</p>
                        <p className="text-lg font-bold text-white">{prediction.data_sources.h2h_wins_a}</p>
                        <p className="text-xs text-gray-400 mt-1">Victorias históricas del Equipo A contra el Equipo B en Copas del Mundo anteriores.</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Forma reciente (últimos 5)</p>
                        <p className="text-lg font-bold text-white">{prediction.data_sources.form_last_5}</p>
                        <p className="text-xs text-gray-400 mt-1">Suma de puntos en los últimos 5 partidos (Victoria=3, Empate=1, Derrota=0). Captura el momentum psicológico del equipo.</p>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Promedio goles/5 partidos</p>
                        <p className="text-lg font-bold text-white">{prediction.data_sources.goals_scored_last_5}</p>
                        <p className="text-xs text-gray-400 mt-1">Promedio de goles a favor en los últimos 5 partidos. Refleja la capacidad ofensiva actual del equipo.</p>
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {/* Model methodology explanation */}
              <div className="w-full mt-5 pt-4 border-t border-white/5">
                <details className="text-sm text-gray-200">
                  <summary className="cursor-pointer hover:text-white transition-colors font-bold text-base">
                    🔬 ¿Cómo funciona este modelo?
                  </summary>
                  <div className="mt-3 space-y-3 text-sm text-gray-300 leading-relaxed">
                    <p>
                      <strong className="text-white">1. Algoritmo:</strong> XGBoost Classifier (Gradient Boosting con árboles de decisión). 
                      Entrenado con 695 partidos internacionales históricos donde se conocía el resultado y las condiciones climáticas.
                    </p>
                    <p>
                      <strong className="text-white">2. Variables de entrada (14 features):</strong> El modelo recibe puntos FIFA de ambos equipos, 
                      diferencial de ranking, victorias/derrotas en enfrentamientos directos (H2H), días desde el último partido, 
                      forma reciente (últimos 5 partidos), goles a favor y en contra recientes, temperatura máxima, precipitación, 
                      velocidad del viento, y dos indicadores binarios (¿está lloviendo? ¿hace calor extremo?).
                    </p>
                    <p>
                      <strong className="text-white">3. Salida:</strong> El modelo genera la probabilidad de que el Equipo A gane. 
                      Luego se distribuye el resto entre empate (27% base empírico del fútbol internacional) y victoria del Equipo B.
                    </p>
                    <p>
                      <strong className="text-white">4. Fuentes de datos:</strong> Los datos provienen de FBref (estadísticas de partidos), 
                      FIFA Rankings históricos (scrapeados mensualmente), Open-Meteo API (clima por coordenadas del estadio), y 
                      resultados históricos de Copas del Mundo para el cálculo H2H.
                    </p>
                    <p>
                      <strong className="text-white">5. ¿Qué son los Puntos FIFA y el Ranking FIFA?</strong> El Ranking FIFA es una clasificación 
                      oficial que publica la FIFA mensualmente para las 211 selecciones del mundo. Cada selección acumula 
                      <strong className="text-neon-blue"> Puntos FIFA</strong> en función de sus resultados: se ganan más puntos por vencer a un rival 
                      de mayor ranking, en partidos oficiales de mayor importancia (Copa del Mundo &gt; Clasificatoria &gt; Amistoso), 
                      y se pierden por derrotas. El sistema usa la fórmula Elo adaptada: P = P_anterior + K × (W - We), donde 
                      K depende de la importancia del torneo, W es el resultado real y We es el resultado esperado basado en la 
                      diferencia de puntos previa. Argentina (1889 pts) tiene más puntos que Francia (1852 pts) porque acumuló 
                      más victorias ponderadas en el período reciente. Esta diferencia de 37 puntos es la variable 
                      <strong className="text-yellow-300"> ranking_diff</strong> que alimenta directamente al modelo.
                    </p>
                    <p>
                      <strong className="text-white">6. Limitaciones:</strong> El modelo tiene un accuracy del 50% para 3 clases (W/D/L). 
                      Los empates son inherentemente difíciles de predecir en el fútbol. Las probabilidades deben interpretarse como 
                      tendencias, no como certezas.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Empty state when no prediction yet */}
          {!prediction && !error && (
            <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4 opacity-30">⚽</div>
              <h3 className="text-xl font-bold text-gray-300 mb-2">Simulador de Partidos</h3>
              <p className="text-sm text-gray-300 max-w-sm">
                Seleccioná dos equipos y condiciones climáticas, luego presioná 
                "Predecir Partido" para ver las probabilidades calculadas por el 
                modelo XGBoost con datos reales de FIFA Rankings, forma reciente y H2H.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
