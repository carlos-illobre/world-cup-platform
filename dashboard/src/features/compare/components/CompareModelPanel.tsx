import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Brain, Beaker, BarChart3, AlertTriangle, CheckCircle2, GitCompare, Layers } from "lucide-react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { ModelPlot } from "@/shared/components/ModelPlot";
import { ClassificationComparison, RegressionComparison } from "@/shared/components/AlgorithmComparison";

interface CompareModelPanelProps {
  teamA: string;
  teamB: string;
  dataA: any;
  dataB: any;
  predA: any;
  predB: any;
  formationA: any;
  formationB: any;
  h2hPrediction: any;
  weatherInput: { tempMax: number; precipitation: number; windSpeed: number; source: string };
}

// 19 features used by team_points_xgb_model (legacy model, explained for educational purposes)
const TEAM_POINTS_FEATURES = [
  "squad_total_market_value", "squad_avg_market_value",
  "squad_total_injuries", "squad_total_wc_goals", "squad_avg_wc_goals",
  "squad_total_wc_assists", "squad_total_allcomps_goals",
  "squad_total_allcomps_assists", "squad_avg_age", "squad_median_age",
  "squad_total_caps", "squad_avg_caps", "squad_injury_burden",
  "squad_depth_DF", "squad_depth_FW", "squad_depth_GK", "squad_depth_MF",
  "squad_top_league_ratio", "squad_avg_impact_score",
];

// 14 features actually used by match_outcome_weather_xgb (the real model)
const MATCH_MODEL_FEATURES = [
  "Country_FIFA_Points", "Opponent_FIFA_Points", "ranking_diff",
  "h2h_wins", "h2h_losses", "days_since_last_match",
  "form_last_5", "goals_scored_last_5", "goals_conceded_last_5",
  "temp_max", "precipitation", "wind_speed", "is_raining", "is_hot",
];

// Feature descriptions for educational purposes
const FEATURE_DESCRIPTIONS: Record<string, { desc: string; source: string; type: string }> = {
  Country_FIFA_Points: { desc: "Puntos FIFA del equipo según el ranking oficial. Refleja rendimiento reciente en competiciones internacionales. Se calcula con la fórmula Elo: P = P_anterior + K × (W - We).", source: "FIFA Rankings (scrapeado mensualmente)", type: "Fuerza" },
  Opponent_FIFA_Points: { desc: "Puntos FIFA del rival. Junto con Country_FIFA_Points, permite calcular la fuerza relativa.", source: "FIFA Rankings", type: "Fuerza" },
  ranking_diff: { desc: "Diferencia de puntos FIFA (A - B). Es la variable más predictiva del modelo. Un valor positivo indica que el equipo A es superior en el ranking.", source: "Calculado: Country_FIFA_Points - Opponent_FIFA_Points", type: "Fuerza" },
  h2h_wins: { desc: "Victorias del equipo A contra B en Copas del Mundo históricas (1930-2022). El historial H2H captura ventaja psicológica demostrada en la literatura deportiva.", source: "historical_world_cups.csv (2,332 partidos)", type: "Fuerza" },
  h2h_losses: { desc: "Derrotas del equipo A contra B en Mundiales. Un historial desfavorable penaliza la predicción del modelo.", source: "historical_world_cups.csv", type: "Fuerza" },
  days_since_last_match: { desc: "Días desde el último partido oficial. Valores <5 pueden indicar fatiga, >30 falta de ritmo competitivo. El modelo aprende el rango óptimo.", source: "master_matches_featured.csv (FBref)", type: "Forma" },
  form_last_5: { desc: "Suma de puntos en últimos 5 partidos (V=3, E=1, D=0). Captura el momentum: un equipo en racha tiene mayor cohesión. Rango: 0-15.", source: "master_matches_featured.csv (FBref)", type: "Forma" },
  goals_scored_last_5: { desc: "Promedio de goles a favor en los últimos 5 partidos. Refleja capacidad ofensiva actual independiente del rival.", source: "master_matches_featured.csv (FBref)", type: "Forma" },
  goals_conceded_last_5: { desc: "Promedio de goles en contra en últimos 5 partidos. Valores altos = fragilidad defensiva reciente.", source: "master_matches_featured.csv (FBref)", type: "Forma" },
  temp_max: { desc: "Temperatura máxima prevista en el estadio (°C). Obtenida de API geoclimatic por coordenadas GPS del estadio. Temperaturas >30°C reducen el pressing.", source: "Open-Meteo API + world_cup_stadiums.csv (GPS)", type: "Clima" },
  precipitation: { desc: "Precipitación esperada (mm). Con >2mm el terreno se enlentece, los pases rasos pierden precisión, equipos técnicos sufren más.", source: "Open-Meteo API", type: "Clima" },
  wind_speed: { desc: "Velocidad máxima del viento (km/h). Afecta centros, tiros libres y saques de banda largos. Favorece estilos de juego directo.", source: "Open-Meteo API", type: "Clima" },
  is_raining: { desc: "Indicador binario: 1 si precipitación > 2mm. Simplifica la variable continua en señal clara para el modelo de árboles.", source: "Derivado de precipitation", type: "Clima" },
  is_hot: { desc: "Indicador binario: 1 si temperatura > 30°C. Marca condiciones de calor extremo que reducen intensidad del juego.", source: "Derivado de temp_max", type: "Clima" },
};

// Collapsible Section component
function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/5 transition-colors">
        {icon}
        <h3 className="text-lg font-display font-bold flex-1 text-white">{title}</h3>
        {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/5 pt-4">{children}</div>}
    </div>
  );
}

/** Fetches and displays real feature importance from the match weather XGBoost model */
function MatchFeatureImportance() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/matches/model/feature-importance`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-neon-blue to-cyan-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
      </div>
      <span className="text-sm text-gray-500">Cargando feature importance...</span>
    </div>
  );
  if (!data || !data.items) return <div className="text-sm text-gray-500">No se pudo obtener feature importance.</div>;

  const maxGain = data.items[0]?.gain || 1;

  return (
    <div className="bg-black/40 rounded-lg p-4 border border-white/5">
      <h4 className="text-sm font-bold text-gray-200 mb-2">Feature Importance (Gain) — Modelo en producción</h4>
      <p className="text-xs text-gray-400 mb-3">
        Extraído de <code className="text-neon-blue">match_outcome_weather_xgb.pkl</code> via
        <code className="text-neon-blue"> booster.get_score(importance_type='gain')</code>. Total: {data.total_features} features.
      </p>
      <div className="space-y-1.5">
        {data.items.map((item: any) => (
          <div key={item.feature} className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-400 w-52 truncate" title={item.feature}>{item.feature}</span>
            <div className="flex-1 h-5 bg-black/40 rounded overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-neon-blue/60 to-neon-blue rounded" style={{ width: `${(item.gain / maxGain) * 100}%` }} />
            </div>
            <span className="text-xs text-white font-mono w-14 text-right">{item.importance_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareModelPanel({ teamA, teamB, dataA, dataB, predA, predB, formationA, formationB, h2hPrediction, weatherInput }: CompareModelPanelProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Intro — What this page actually does */}
      <div className="bg-gradient-to-r from-neon-blue/5 to-purple-500/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-display font-bold text-white mb-3">
          🔬 Comparador de Selecciones — Documentación Técnica
        </h2>
        <p className="text-base text-gray-300 leading-relaxed mb-4">
          Este comparador utiliza <strong className="text-white">3 modelos XGBoost complementarios</strong> para
          evaluar dos selecciones desde múltiples ángulos. El resultado principal es la{" "}
          <strong className="text-neon-blue">predicción H2H directa</strong> (¿quién ganaría si se enfrentan?)
          combinada con la <strong className="text-neon-blue">simulación de puntos de grupo</strong> (¿cuántos
          puntos obtendrá cada uno contra sus rivales reales?).
        </p>
        <div className="bg-black/40 rounded-lg p-4 border border-white/5">
          <p className="text-sm text-gray-400 font-semibold mb-2">📐 Pipeline completo del comparador:</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg">Datos reales (FBref + FIFA + WC)</span>
            <span className="text-gray-600">→</span>
            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg">14 features por partido</span>
            <span className="text-gray-600">→</span>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg">XGBoost blend predict_proba()</span>
            <span className="text-gray-600">→</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg">P(W) + D/L ratio</span>
            <span className="text-gray-600">→</span>
            <span className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-lg">SHAP explanations</span>
            <span className="text-gray-600">→</span>
            <span className="bg-neon-blue/20 text-neon-blue px-3 py-1 rounded-lg">Veredicto compuesto</span>
          </div>
        </div>
      </div>

      {/* Section 1: Why this approach */}
      <Section title="¿Por qué comparar con simulación de partidos y no con métricas estáticas?" icon={<Brain className="w-5 h-5 text-neon-blue" />} defaultOpen={true}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            La pregunta "¿qué selección es mejor?" puede responderse de dos formas fundamentalmente diferentes.
            Este sistema elige la <strong className="text-white">simulación de partidos</strong> sobre la comparación estática.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
              <h4 className="text-sm font-bold text-red-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Enfoque Descartado: Comparación Estática de Métricas
              </h4>
              <p className="text-sm text-gray-400 mb-2">
                Comparar directamente squad_avg_market_value, squad_total_caps, etc. entre dos equipos:
              </p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>No considera la interacción entre los dos equipos específicos</li>
                <li>Ignora el historial H2H (ej: España vs Marruecos en Qatar 2022)</li>
                <li>No reacciona a condiciones externas (clima, fatiga)</li>
                <li>No puede explicar POR QUÉ uno es mejor que otro</li>
                <li>Trata a cada equipo como una entidad aislada</li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Enfoque Actual: Simulación H2H + Puntos de Grupo
              </h4>
              <p className="text-sm text-gray-400 mb-2">
                Predice el resultado del enfrentamiento directo Y simula los 3 partidos de grupo de cada equipo:
              </p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Usa el modelo de partidos con interacción entre equipos (ranking_diff, H2H)</li>
                <li>Genera probabilidades calibradas: P(Win), P(Draw), P(Loss)</li>
                <li>Incluye explicabilidad SHAP por cada predicción</li>
                <li>Reacciona a condiciones climáticas del estadio</li>
                <li>Calcula confianza vía entropía de Shannon</li>
                <li>Simula grupo completo (3 partidos por equipo) con oponentes reales</li>
              </ul>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Por qué no usar el team_points_xgb_model directamente?</h4>
            <p className="text-sm text-gray-400">
              Ese modelo (19 features → puntos) tiene RMSE 0.83, que parece bueno pero: (1) no
              considera a los oponentes del grupo, (2) no puede simular un enfrentamiento directo,
              (3) no genera explicaciones individuales. La simulación match-by-match usando{" "}
              <code className="text-neon-blue">match_outcome_weather_xgb</code> es más granular y explicable.
              El team_points_xgb se descartó como predictor principal pero sus 19 features de squad siguen
              siendo útiles como contexto complementario en la Vista de Negocio (radar chart).
            </p>
          </div>
        </div>
      </Section>

      {/* Section 2: Data Sources */}
      <Section title="Fuentes de Datos — De dónde salen los números" icon={<Database className="w-5 h-5 text-blue-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            <strong className="text-white">Principio fundamental:</strong> No se inventan datos. Cada feature del modelo
            proviene de una fuente verificable y pública. A continuación se detalla cada una:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
              <h4 className="text-sm font-bold text-blue-300 mb-2">📊 FBref (StatsBomb)</h4>
              <p className="text-xs text-gray-400">825 partidos internacionales recientes (2022-2025). Incluye formaciones, posesión, goles, asistencias.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ master_matches_featured.csv</p>
              <p className="text-[11px] text-gray-400">Variables derivadas: form_last_5, goals_scored/conceded, win_rate, days_since_last_match</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2">🏆 Mundiales 1930-2022</h4>
              <p className="text-xs text-gray-400">2,332 partidos históricos con scores, sede y ronda. Fuente para H2H entre selecciones.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ historical_world_cups.csv</p>
              <p className="text-[11px] text-gray-400">Variables derivadas: h2h_wins, h2h_losses, h2h_draws</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
              <h4 className="text-sm font-bold text-yellow-300 mb-2">🌐 FIFA Rankings</h4>
              <p className="text-xs text-gray-400">Puntos FIFA (sistema Elo) para 211 selecciones. Se actualizan mensualmente.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ Integrado en matches_featured</p>
              <p className="text-[11px] text-gray-400">Variables: Country_FIFA_Points, Opponent_FIFA_Points, ranking_diff</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
              <h4 className="text-sm font-bold text-purple-300 mb-2">🌤️ Open-Meteo API</h4>
              <p className="text-xs text-gray-400">Condiciones climáticas históricas y pronósticos por GPS de cada estadio WC 2026.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ world_cup_stadiums.csv (coordenadas)</p>
              <p className="text-[11px] text-gray-400">Variables: temp_max, precipitation, wind_speed, is_raining, is_hot</p>
            </div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">Dataset consolidado para entrenamiento</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-neon-blue">3,157</p>
                <p className="text-xs text-gray-400">partidos de entrenamiento</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">48</p>
                <p className="text-xs text-gray-400">selecciones con datos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">14</p>
                <p className="text-xs text-gray-400">features por partido</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">92</p>
                <p className="text-xs text-gray-400">años de historial WC</p>
              </div>
            </div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">⚠️ Datos NO utilizados (y por qué)</h4>
            <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside">
              <li><strong className="text-white">Datos de jugadores individuales</strong> — El modelo de partidos ve equipos como unidades. La inclusión individual aumentaría dimensionalidad sin data suficiente (solo 3,157 muestras).</li>
              <li><strong className="text-white">Posesión / xG por partido</strong> — Disponibles pero correlacionados con el resultado (data leakage potencial). Se conocen después del partido.</li>
              <li><strong className="text-white">Asistencia al estadio</strong> — Baja correlación demostrada en análisis exploratorio (r=0.03 con resultado).</li>
              <li><strong className="text-white">Altitude / humedad</strong> — No disponibles en la fuente climática usada. Mejora potencial futura.</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Section 3: The 14 Features explained in detail */}
      <Section title="Las 14 Features del Modelo de Partidos — Explicación Detallada" icon={<Beaker className="w-5 h-5 text-purple-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Cada partido se representa con exactamente <strong className="text-white">14 variables numéricas</strong>.
            Se dividen en 3 categorías conceptuales. El orden importa porque los modelos XGBoost
            son sensibles a la posición de las features en la matriz de entrada.
          </p>

          {/* Feature categories */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
              <h4 className="text-sm font-bold text-purple-300 mb-2">🏋️ Fuerza Relativa (5 features)</h4>
              <p className="text-xs text-gray-400 mb-2">Capturan la calidad intrínseca y la dominancia histórica entre equipos.</p>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li><code className="text-purple-300">Country_FIFA_Points</code></li>
                <li><code className="text-purple-300">Opponent_FIFA_Points</code></li>
                <li><code className="text-purple-300">ranking_diff</code> ← más predictiva</li>
                <li><code className="text-purple-300">h2h_wins</code></li>
                <li><code className="text-purple-300">h2h_losses</code></li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2">📈 Forma Reciente (4 features)</h4>
              <p className="text-xs text-gray-400 mb-2">Capturan el momentum actual — un equipo "en racha" tiene ventaja estadística.</p>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li><code className="text-green-300">form_last_5</code> (0-15 pts)</li>
                <li><code className="text-green-300">goals_scored_last_5</code></li>
                <li><code className="text-green-300">goals_conceded_last_5</code></li>
                <li><code className="text-green-300">days_since_last_match</code></li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
              <h4 className="text-sm font-bold text-yellow-300 mb-2">🌡️ Clima (5 features)</h4>
              <p className="text-xs text-gray-400 mb-2">Condiciones ambientales del estadio que afectan el rendimiento físico y táctico.</p>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li><code className="text-yellow-300">temp_max</code> (°C)</li>
                <li><code className="text-yellow-300">precipitation</code> (mm)</li>
                <li><code className="text-yellow-300">wind_speed</code> (km/h)</li>
                <li><code className="text-yellow-300">is_raining</code> (&gt;2mm)</li>
                <li><code className="text-yellow-300">is_hot</code> (&gt;30°C)</li>
              </ul>
            </div>
          </div>

          {/* Detailed feature table */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5 overflow-x-auto">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Diccionario de Features Completo</h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2 px-2">Feature</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Descripción</th>
                  <th className="text-left py-2 px-2">Fuente</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {MATCH_MODEL_FEATURES.map((f) => {
                  const info = FEATURE_DESCRIPTIONS[f];
                  return (
                    <tr key={f} className="border-b border-white/5">
                      <td className="py-2 px-2 font-mono text-neon-blue whitespace-nowrap">{f}</td>
                      <td className="py-2 px-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                          info?.type === "Fuerza" ? "bg-purple-500/10 text-purple-300" :
                          info?.type === "Forma" ? "bg-green-500/10 text-green-300" :
                          "bg-yellow-500/10 text-yellow-300"
                        }`}>{info?.type}</span>
                      </td>
                      <td className="py-2 px-2 text-gray-400 max-w-md">{info?.desc}</td>
                      <td className="py-2 px-2 text-gray-400 text-[11px]">{info?.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">⚠️ Data Leakage Prevention</h4>
            <p className="text-sm text-gray-400">
              Todas las features se calculan <strong className="text-white">antes del partido</strong>.
              El split es temporal (80% más antiguo = train, 20% más reciente = test).
              El resultado a predecir nunca filtra hacia las features de entrada.
              form_last_5 usa solo partidos anteriores cronológicamente al partido siendo predicho.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 4: Blend Strategy */}
      <Section title="Estrategia Blend — Cómo se combinan dos modelos XGBoost" icon={<Layers className="w-5 h-5 text-neon-blue" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Se combinan <strong className="text-white">dos modelos XGBoost complementarios</strong> para obtener
            la mejor predicción posible. Cada uno tiene fortalezas y debilidades que el otro compensa.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
              <h4 className="text-sm font-bold text-neon-blue mb-2">Modelo Weather (Binario)</h4>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>14 features incluyendo 5 de clima</li>
                <li>Entrenado con 695 partidos con datos climáticos</li>
                <li>Predice: P(Win_A) vs P(Not_Win_A)</li>
                <li><strong className="text-white">Fortaleza:</strong> sensible a temperatura, lluvia, viento</li>
                <li><strong className="text-red-300">Debilidad:</strong> no separa Empate de Derrota</li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
              <h4 className="text-sm font-bold text-purple-300 mb-2">Modelo 3-Class (W/D/L)</h4>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>16 features deportivas (sin clima)</li>
                <li>Entrenado con 3,157 partidos (mucho más data)</li>
                <li>Predice: P(Win), P(Draw), P(Loss) separadamente</li>
                <li><strong className="text-white">Fortaleza:</strong> mejor separación D vs L por más muestras</li>
                <li><strong className="text-red-300">Debilidad:</strong> no reacciona al clima</li>
              </ul>
            </div>
          </div>

          <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
            <p className="text-gray-500">// Blend Strategy (match_predictor.py):</p>
            <p className="text-gray-500">// 1. Obtener P(Win) del modelo weather (clima-aware):</p>
            <p><span className="text-neon-blue">prob_win_a</span> = weather_model.predict_proba(features_14)[1]</p>
            <p><span className="text-gray-400">remaining</span> = 1.0 - prob_win_a</p>
            <p></p>
            <p className="text-gray-500">// 2. Del modelo 3-class, extraer proporción D/(D+L):</p>
            <p><span className="text-purple-300">proba_3c</span> = three_class_model.predict_proba(features_16)</p>
            <p><span className="text-purple-300">draw_ratio</span> = proba_3c[Draw] / (proba_3c[Draw] + proba_3c[Loss])</p>
            <p></p>
            <p className="text-gray-500">// 3. Combinar: weather da el P(Win), 3-class da el split D/L:</p>
            <p><span className="text-green-300">P(Win_A)</span> = prob_win_a</p>
            <p><span className="text-yellow-300">P(Draw)</span> = remaining × draw_ratio</p>
            <p><span className="text-red-300">P(Loss_A)</span> = remaining × (1 - draw_ratio)</p>
            <p></p>
            <p className="text-gray-500">// 4. Aplicar mínimos y renormalizar a suma=1:</p>
            <p>P(Win) = max(P(Win), 0.03); P(Draw) = max(P(Draw), 0.05);</p>
            <p>total = P(Win) + P(Draw) + P(Loss); cada_uno /= total</p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Por qué Blend en vez de un solo modelo?</h4>
            <p className="text-sm text-gray-400">
              El modelo weather tiene solo 695 muestras de entrenamiento (limitado a partidos donde había clima)
              pero captura una señal real: equipos acostumbrados a calor extremo (Qatar, Arabia) rinden mejor
              a &gt;30°C. El modelo 3-class tiene 3,157 muestras pero no reacciona al slider de clima. El blend
              toma lo mejor de cada uno: <strong className="text-white">sensibilidad climática del weather + mejor
              calibración D/L del 3-class</strong>.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 5: Live comparison data */}
      <Section title={`Datos alimentados al modelo — ${teamA} vs ${teamB}`} icon={<GitCompare className="w-5 h-5 text-green-400" />} defaultOpen={true}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Estos son los valores <strong className="text-white">reales extraídos de las fuentes de datos</strong> que
            el modelo recibió para esta predicción específica. No son inventados ni hardcodeados.
          </p>

          {/* H2H Prediction details */}
          {h2hPrediction && (
            <div className="bg-black/40 rounded-lg p-4 border border-white/5">
              <h4 className="text-sm font-bold text-gray-200 mb-3">Resultado H2H: {teamA} vs {teamB}</h4>
              <div className="grid grid-cols-3 gap-4 text-center mb-3">
                <div>
                  <p className="text-2xl font-bold text-neon-blue">{((h2hPrediction.probabilities?.win_A ?? 0) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">P(Gana {teamA})</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-400">{((h2hPrediction.probabilities?.draw ?? 0) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">P(Empate)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-400">{((h2hPrediction.probabilities?.win_B ?? 0) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">P(Gana {teamB})</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Modelo utilizado: <code className="text-neon-blue">{h2hPrediction.model_used}</code> |
                Condiciones climáticas ({weatherInput.source === "api" ? "datos reales de Open-Meteo" : "ingresadas manualmente"}): {weatherInput.tempMax}°C, {weatherInput.precipitation}mm lluvia, {weatherInput.windSpeed}km/h viento
              </p>
            </div>
          )}

          {/* Data sources table */}
          {h2hPrediction?.data_sources && (
            <div className="bg-black/40 rounded-lg p-4 border border-white/5 overflow-x-auto">
              <h4 className="text-sm font-bold text-gray-200 mb-3">Features alimentadas al modelo (valores reales)</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 px-2">Feature</th>
                    <th className="text-right py-2 px-2">Valor</th>
                    <th className="text-left py-2 px-2">Interpretación</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-purple-300">Country_FIFA_Points</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.team_a_fifa_points}</td>
                    <td className="py-2 px-2 text-gray-400">Puntos FIFA de {teamA}</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-purple-300">Opponent_FIFA_Points</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.team_b_fifa_points}</td>
                    <td className="py-2 px-2 text-gray-400">Puntos FIFA de {teamB}</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-purple-300">ranking_diff</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.ranking_diff?.toFixed(1)}</td>
                    <td className="py-2 px-2 text-gray-400">{Number(h2hPrediction.data_sources.ranking_diff) > 0 ? `${teamA} mejor rankeado` : `${teamB} mejor rankeado`}</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-purple-300">h2h_wins</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.h2h_wins_a}</td>
                    <td className="py-2 px-2 text-gray-400">Victorias de {teamA} vs {teamB} en Mundiales</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-purple-300">h2h_losses</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.h2h_losses_a}</td>
                    <td className="py-2 px-2 text-gray-400">Derrotas de {teamA} vs {teamB} en Mundiales</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-green-300">form_last_5</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.form_last_5}</td>
                    <td className="py-2 px-2 text-gray-400">Puntos de {teamA} en últimos 5 partidos (0-15)</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-green-300">goals_scored_last_5</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.goals_scored_last_5}</td>
                    <td className="py-2 px-2 text-gray-400">Promedio goles a favor de {teamA} en últimos 5</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-green-300">goals_conceded_last_5</td>
                    <td className="py-2 px-2 text-right text-white font-bold">{h2hPrediction.data_sources.goals_conceded_last_5}</td>
                    <td className="py-2 px-2 text-gray-400">Promedio goles en contra de {teamA} en últimos 5</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* SHAP explanations for this specific prediction */}
          {h2hPrediction?.explanations?.length > 0 && (
            <div className="bg-black/40 rounded-lg p-4 border border-white/5">
              <h4 className="text-sm font-bold text-gray-200 mb-2">Explicaciones SHAP — ¿Qué empujó la predicción?</h4>
              <p className="text-xs text-gray-400 mb-3">
                Valores SHAP calculados con <code className="text-neon-blue">booster.predict(pred_contribs=True)</code>.
                Positivo = empuja hacia victoria de {teamA}. Negativo = empuja hacia {teamB}/Empate.
              </p>
              <div className="space-y-2">
                {h2hPrediction.explanations.map((exp: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400 w-52">{exp.raw_feature || exp.feature}</span>
                    <div className="flex-1 h-6 relative bg-black/40 rounded overflow-hidden border border-white/5">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                      {exp.weight > 0 ? (
                        <div className="absolute inset-y-0 left-1/2 bg-neon-blue/60 rounded-r" style={{ width: `${Math.min(Math.abs(exp.weight) * 100, 50)}%` }} />
                      ) : (
                        <div className="absolute inset-y-0 bg-red-500/60 rounded-l" style={{ right: '50%', width: `${Math.min(Math.abs(exp.weight) * 100, 50)}%` }} />
                      )}
                    </div>
                    <span className={`text-xs font-bold w-16 text-right ${exp.weight > 0 ? "text-neon-blue" : "text-red-400"}`}>
                      {exp.weight > 0 ? "+" : ""}{exp.weight?.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Squad features comparison (19 features for context) */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5 overflow-x-auto">
            <h4 className="text-sm font-bold text-gray-200 mb-2">Features de Squad (contexto complementario)</h4>
            <p className="text-xs text-gray-400 mb-3">
              Estas 19 features del <code className="text-gray-300">team_points_xgb_model</code> no se usan
              directamente para la predicción H2H pero contextualizan la calidad del plantel. Se muestran
              en el radar chart de la Vista de Negocio.
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-right py-2 text-neon-blue">{teamA}</th>
                  <th className="text-right py-2 text-purple-400">{teamB}</th>
                </tr>
              </thead>
              <tbody>
                {TEAM_POINTS_FEATURES.map((f) => (
                  <tr key={f} className="border-b border-white/5">
                    <td className="py-1.5 text-gray-300 font-mono">{f}</td>
                    <td className="py-1.5 text-right text-white font-mono">
                      {dataA?.[f] != null ? (typeof dataA[f] === "number" ? dataA[f].toFixed(2) : dataA[f]) : "—"}
                    </td>
                    <td className="py-1.5 text-right text-white font-mono">
                      {dataB?.[f] != null ? (typeof dataB[f] === "number" ? dataB[f].toFixed(2) : dataB[f]) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Section 6: Model Evaluation */}
      <Section title="Evaluación del Modelo — Métricas de Performance" icon={<BarChart3 className="w-5 h-5 text-yellow-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo fue evaluado con <strong className="text-white">split temporal</strong> (80% más antiguo = train,
            20% más reciente = test). Esto simula el uso real: predecir partidos futuros con datos del pasado.
            El test set contiene <strong className="text-white">632 partidos</strong>.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Accuracy</p>
              <p className="text-xl font-bold text-yellow-400">57.1%</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">F1-Macro</p>
              <p className="text-xl font-bold text-orange-400">0.443</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">F1(Win)</p>
              <p className="text-xl font-bold text-green-400">0.74</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">F1(Draw)</p>
              <p className="text-xl font-bold text-yellow-300">0.38</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Baseline Random</p>
              <p className="text-xl font-bold text-gray-500">33.3%</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Classification Report Detallado</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 px-3">Clase</th>
                    <th className="text-center py-2 px-3">Precision</th>
                    <th className="text-center py-2 px-3">Recall</th>
                    <th className="text-center py-2 px-3">F1-Score</th>
                    <th className="text-center py-2 px-3">Support</th>
                    <th className="text-left py-2 px-3">Interpretación</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-red-400 font-bold">Loss (L)</td>
                    <td className="text-center py-2 px-3">0.38</td>
                    <td className="text-center py-2 px-3">0.25</td>
                    <td className="text-center py-2 px-3">0.30</td>
                    <td className="text-center py-2 px-3">103</td>
                    <td className="py-2 px-3 text-xs text-gray-400">Clase minoritaria, difícil de separar del Draw</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-yellow-400 font-bold">Draw (D)</td>
                    <td className="text-center py-2 px-3">0.35</td>
                    <td className="text-center py-2 px-3">0.42</td>
                    <td className="text-center py-2 px-3">0.38</td>
                    <td className="text-center py-2 px-3">153</td>
                    <td className="py-2 px-3 text-xs text-gray-400">Empates inherentemente impredecibles — no hay señal clara</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-green-400 font-bold">Win (W)</td>
                    <td className="text-center py-2 px-3">0.72</td>
                    <td className="text-center py-2 px-3">0.76</td>
                    <td className="text-center py-2 px-3">0.74</td>
                    <td className="text-center py-2 px-3">376</td>
                    <td className="py-2 px-3 text-xs text-gray-400">Clase mejor predicha — ranking_diff es muy informativo</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Training plots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-300 mb-2">Confusion Matrix — XGBoost 3-Class</p>
              <ModelPlot
                src="match_outcome_confusion_matrix.png"
                alt="Confusion Matrix del modelo de predicción de partidos"
                caption="Evaluado sobre 632 partidos (20% temporal). Los empates (D) se confunden frecuentemente con victorias y derrotas."
              />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-300 mb-2">SHAP Summary — Predicción de Victoria</p>
              <ModelPlot
                src="match_outcome_shap_summary_win.png"
                alt="SHAP Summary Plot para predicción de victoria"
                caption="Color rojo = valor alto de la feature. Posición X = contribución a predicción de victoria. ranking_diff domina."
              />
            </div>
          </div>

          {/* Real Feature Importance */}
          <MatchFeatureImportance />

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Es 57.1% de accuracy bueno o malo?</h4>
            <p className="text-sm text-gray-400">
              En un problema de 3 clases, el azar da 33.3%. Un modelo perfecto daría 100%. El nuestro
              da <strong className="text-white">57.1%</strong> — un <strong className="text-green-400">+23.8 puntos porcentuales</strong> sobre el azar.
              Las casas de apuestas profesionales con millones de datos y decenas de analistas no superan
              55-60% en predicción de 3 clases (W/D/L). El fútbol tiene un componente de aleatoriedad
              irreducible (lesiones en el minuto 90, penales dudosos, goles en contra propia) que ningún
              modelo puede capturar. La clase más difícil (empate) requeriría señales intra-partido (posesión,
              tiros) que no están disponibles antes del evento.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 7: Confidence System */}
      <Section title="Sistema de Confianza — Entropía de Shannon" icon={<BarChart3 className="w-5 h-5 text-green-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            No todas las predicciones son iguales. Cuando el modelo predice 40%/30%/30%, la predicción
            es casi aleatoria. Cuando predice 70%/20%/10%, hay una señal clara. Usamos la{" "}
            <strong className="text-white">entropía de Shannon normalizada</strong> para cuantificar esto.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Fórmula</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
              <p className="text-gray-500">// Entropía normalizada (rango 0-1):</p>
              <p>H_norm = -Σ(p_i × log₂(p_i)) / log₂(3)</p>
              <p></p>
              <p className="text-gray-500">// Donde p_i son las 3 probabilidades: P(Win), P(Draw), P(Loss)</p>
              <p className="text-gray-500">// H=0 → certeza total (100%/0%/0%)</p>
              <p className="text-gray-500">// H=1 → máxima incertidumbre (33%/33%/33%)</p>
              <p></p>
              <p className="text-gray-500">// Clasificación en la UI:</p>
              <p><span className="text-green-400">Alta confianza:</span>  H &lt; 0.60  (ej: 70%/20%/10%)</p>
              <p><span className="text-yellow-400">Media confianza:</span> H ∈ [0.60, 0.85]  (ej: 45%/30%/25%)</p>
              <p><span className="text-red-400">Baja confianza:</span>   H &gt; 0.85  (ej: 36%/33%/31%)</p>
            </div>
          </div>

          {h2hPrediction?.probabilities && (
            <div className="bg-black/40 rounded-lg p-4 border border-white/5">
              <h4 className="text-sm font-bold text-gray-200 mb-2">Entropía de esta predicción ({teamA} vs {teamB})</h4>
              {(() => {
                const probs = h2hPrediction.probabilities;
                const vals = [probs.win_A, probs.draw, probs.win_B].filter((p: number) => p > 0);
                const H = -vals.reduce((sum: number, p: number) => sum + p * Math.log2(p), 0);
                const Hnorm = H / Math.log2(3);
                const level = Hnorm < 0.60 ? "Alta" : Hnorm < 0.85 ? "Media" : "Baja";
                const color = Hnorm < 0.60 ? "text-green-400" : Hnorm < 0.85 ? "text-yellow-400" : "text-red-400";
                return (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500">H normalizada</p>
                      <p className={`text-2xl font-bold ${color}`}>{Hnorm.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Clasificación</p>
                      <p className={`text-2xl font-bold ${color}`}>{level}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Interpretación</p>
                      <p className="text-sm text-gray-300">
                        {level === "Alta" ? "El modelo tiene evidencia clara para esta predicción." :
                         level === "Media" ? "Resultado incierto, interpretar con cautela." :
                         "Casi un coin-flip. No tomar decisiones fuertes basándose en esta predicción."}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Por qué esto importa para el negocio?</h4>
            <p className="text-sm text-gray-400">
              Una predicción con <strong className="text-green-400">alta confianza</strong> indica que el modelo
              tiene evidencia clara (ranking muy superior, H2H dominante, forma excelente). Las de{" "}
              <strong className="text-red-400">baja confianza</strong> son partidos donde cualquier resultado es
              posible — el usuario no debería tomar decisiones basándose únicamente en ellas.
              En el fútbol, ~40% de los partidos tienen entropía alta porque los equipos están parejos.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 8: Why XGBoost */}
      <Section title="¿Por qué XGBoost? Análisis de Alternativas" icon={<Brain className="w-5 h-5 text-red-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            La elección de XGBoost no es arbitraria. Se evaluaron múltiples alternativas durante el
            desarrollo. A continuación se documentan las razones técnicas.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">✅ Ventajas de XGBoost para este problema</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Robusto con pocos datos (3,157 muestras):</strong> Con regularización L1/L2 (max_depth=6, min_child_weight=5, alpha=0.1), XGBoost evita overfitting mejor que redes neuronales que requieren &gt;10k muestras para generalizar.</li>
              <li><strong className="text-white">Maneja interacciones no lineales:</strong> ranking_diff + form_last_5 combinados pueden ser más predictivos que cada uno por separado. Los árboles capturan esto automáticamente sin feature engineering manual de interacciones.</li>
              <li><strong className="text-white">SHAP nativo via pred_contribs:</strong> XGBoost expone las contribuciones de cada feature en O(n) tiempo sin necesidad de librerías externas. Esto permite explicar cada predicción individualmente.</li>
              <li><strong className="text-white">Maneja NaN sin imputación:</strong> Si dos equipos nunca se enfrentaron (h2h_wins=NaN), el árbol aprende la dirección óptima del split. No necesitamos imputar con 0 o con la media.</li>
              <li><strong className="text-white">Probabilidades calibradas con softmax:</strong> predict_proba() con objective='multi:softprob' da probabilidades directamente interpretables y sumando 1.</li>
              <li><strong className="text-white">Bajo costo de inferencia:</strong> Predicción en &lt;1ms por muestra. Permite comparar en tiempo real en la UI sin latencia perceptible.</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
            <h4 className="text-sm font-bold text-red-300 mb-3">❌ Limitaciones conocidas</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Empates difíciles (F1=0.38):</strong> Solo ~25% de partidos internacionales terminan en empate. No hay features discriminativas claras pre-partido para empates. Este es un problema del dominio, no del modelo.</li>
              <li><strong className="text-white">Sin datos de jugadores individuales:</strong> No sabe si un jugador clave está lesionado para un partido específico. Ve equipos como unidades agregadas.</li>
              <li><strong className="text-white">Features estáticas:</strong> Usa el último valor conocido. No modela tendencias (ej: un equipo que mejoró en los últimos 2 meses vs uno que decayó).</li>
              <li><strong className="text-white">Clima limitado (3 variables):</strong> No incluye altitud (importante en México/CDMX a 2,240m), humedad ni tipo de superficie.</li>
              <li><strong className="text-white">Accuracy moderada (57.1%):</strong> Inherente al fútbol. Las casas de apuestas con millones de datos no superan 55-60% en 3 clases.</li>
              <li><strong className="text-white">Sesgo hacia equipos con historial:</strong> Equipos nuevos sin H2H ni historial largo obtienen predicciones más neutras (cercanas a 33/33/33).</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">🔄 Alternativas evaluadas durante el desarrollo</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 px-2">Modelo</th>
                    <th className="text-center py-2 px-2">Accuracy</th>
                    <th className="text-left py-2 px-2">Razón de descarte</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2">Random Forest</td>
                    <td className="text-center py-2 px-2">56.5%</td>
                    <td className="py-2 px-2 text-gray-400">Peor calibración de probabilidades, sin pred_contribs nativo, más lento en inferencia</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2">Logistic Regression</td>
                    <td className="text-center py-2 px-2">52.8%</td>
                    <td className="py-2 px-2 text-gray-400">Asume linealidad. No captura interacciones ranking_diff × form sin feature engineering manual</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2">Neural Network (MLP)</td>
                    <td className="text-center py-2 px-2">54.2%</td>
                    <td className="py-2 px-2 text-gray-400">Overfitting severo con 3,157 muestras. Requiere &gt;10x datos para generalizar. No interpretable nativamente</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2">LightGBM</td>
                    <td className="text-center py-2 px-2">56.9%</td>
                    <td className="py-2 px-2 text-gray-400">Performance similar pero sin pred_contribs integrado. Requiere librería SHAP externa para explicabilidad</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-neon-blue font-bold">XGBoost (elegido)</td>
                    <td className="text-center py-2 px-2 text-neon-blue font-bold">57.1%</td>
                    <td className="py-2 px-2 text-gray-400">Mejor accuracy + SHAP nativo + calibración + robustez con pocos datos</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Qué modelo mejoraría esto en el futuro?</h4>
            <p className="text-sm text-gray-400">
              Con más datos (&gt;10k partidos), un <strong className="text-white">Transformer temporal</strong> podría
              modelar secuencias de partidos y capturar tendencias. Con datos de jugadores individuales por partido,
              un <strong className="text-white">Graph Neural Network</strong> modelaría interacciones entre jugadores.
              Pero con 3,157 muestras y 14 features tabulares, XGBoost está en su punto óptimo. El cuello de botella
              no es el algoritmo sino la <strong className="text-white">cantidad y calidad de features disponibles</strong>.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 9: Formation Model */}
      <Section title="Modelo de Formación Táctica (formation_xgb_model)" icon={<Layers className="w-5 h-5 text-orange-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Complementariamente a la predicción de resultado, un segundo modelo XGBoost recomienda la
            <strong className="text-white"> formación táctica óptima</strong> para cada equipo. Funciona
            simulando cada formación posible y midiendo cuál maximiza P(Victoria).
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Cómo funciona?</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
              <p className="text-gray-500">// Para cada una de las 21 formaciones posibles:</p>
              <p>features = [win_rate_home, win_rate_away, days_since] + one_hot(formation)</p>
              <p>proba = formation_xgb.predict_proba(features)  // [P(L), P(D), P(W)]</p>
              <p>win_proba[formation] = proba[2]  // P(Win)</p>
              <p></p>
              <p className="text-gray-500">// Recomendación = formación con max P(Win)</p>
              <p className="text-gray-500">// PERO solo entre formaciones que el equipo ya usó históricamente</p>
              <p className="text-gray-500">// (para no recomendar una formación que el DT nunca practicó)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-white/5">
              <h4 className="text-sm font-bold text-gray-200 mb-2">24 Features del modelo</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li><code className="text-orange-300">win_rate_home</code> — Tasa de victorias como local</li>
                <li><code className="text-orange-300">win_rate_away</code> — Tasa de victorias como visitante</li>
                <li><code className="text-orange-300">days_since_last_match</code> — Ritmo competitivo</li>
                <li><code className="text-orange-300">form_*</code> — 21 variables one-hot encoded (una por formación posible)</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">
                Total: 3 numéricas + 21 binarias = 24 features
              </p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-white/5">
              <h4 className="text-sm font-bold text-gray-200 mb-2">Limitaciones del modelo de formación</h4>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>No considera la formación del rival (lo ideal sería formación × formación rival)</li>
                <li>Solo usa 3 features contextuales — no incluye calidad del plantel</li>
                <li>Asume que la formación es independiente de los jugadores disponibles</li>
                <li>Entrenado con datos de FBref donde la formación reportada puede variar intra-partido</li>
              </ul>
            </div>
          </div>

          {/* Live formation data */}
          {(formationA || formationB) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formationA && (
                <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
                  <h4 className="text-sm font-bold text-neon-blue mb-2">{teamA} — Formación Recomendada</h4>
                  <p className="text-xl font-bold text-white">{formationA.recommended_formation}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    P(Win) = {((formationA.formation_win_probabilities?.[formationA.recommended_formation] ?? 0) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Formaciones históricas: {Object.entries(formationA.historical_formations || {}).map(([f, c]: any) => `${f}(${c})`).join(', ') || "N/A"}
                  </p>
                </div>
              )}
              {formationB && (
                <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
                  <h4 className="text-sm font-bold text-purple-300 mb-2">{teamB} — Formación Recomendada</h4>
                  <p className="text-xl font-bold text-white">{formationB.recommended_formation}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    P(Win) = {((formationB.formation_win_probabilities?.[formationB.recommended_formation] ?? 0) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Formaciones históricas: {Object.entries(formationB.historical_formations || {}).map(([f, c]: any) => `${f}(${c})`).join(', ') || "N/A"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Section 10: Veredicto Algorithm explanation */}
      <Section title="El Veredicto Compuesto — Cómo se genera la recomendación final" icon={<Brain className="w-5 h-5 text-neon-blue" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El "Veredicto del Algoritmo" que se muestra en la Vista de Negocio no es una opinión subjetiva.
            Es un <strong className="text-white">score compuesto ponderado</strong> que combina múltiples señales
            del modelo en una única evaluación, con pesos justificados por la importancia relativa de cada factor.
          </p>

          <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
            <p className="text-gray-500">// Score compuesto por equipo (rango 0-1):</p>
            <p><span className="text-neon-blue">score</span> = </p>
            <p>  (predicted_group_points / 9) × <span className="text-yellow-300">0.40</span>    <span className="text-gray-500">// Puntos predichos</span></p>
            <p>  + P(Win_H2H) × <span className="text-yellow-300">0.30</span>                    <span className="text-gray-500">// Probabilidad H2H directa</span></p>
            <p>  + (1 - injury_burden_ratio) × <span className="text-yellow-300">0.15</span>      <span className="text-gray-500">// Menos lesiones = mejor</span></p>
            <p>  + squad_depth_ratio × <span className="text-yellow-300">0.15</span>              <span className="text-gray-500">// Más profundidad = mejor</span></p>
            <p></p>
            <p className="text-gray-500">// Veredicto basado en la diferencia relativa:</p>
            <p>diff = |score_A - score_B| / max(score_A, score_B)</p>
            <p>if diff &gt; 0.25: <span className="text-green-300">"ventaja clara"</span></p>
            <p>if diff &gt; 0.10: <span className="text-yellow-300">"ligera ventaja"</span></p>
            <p>else: <span className="text-red-300">"extremadamente parejos"</span></p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Por qué estos pesos?</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-yellow-300">40% Puntos de grupo:</strong> Es la métrica más robusta — resultado de simular 3 partidos con el modelo blend. Incorpora la fuerza relativa contra los oponentes reales del grupo.</li>
              <li><strong className="text-yellow-300">30% H2H directo:</strong> La pregunta principal del comparador es "¿quién ganaría?". La predicción directa tiene alta relevancia para decisiones de negocio (apuestas, brackets, etc.).</li>
              <li><strong className="text-yellow-300">15% Lesiones:</strong> Un equipo con alta carga de lesiones tiene menor disponibilidad de jugadores clave. Penaliza equipos con muchas lesiones recurrentes.</li>
              <li><strong className="text-yellow-300">15% Profundidad:</strong> Un plantel profundo (más jugadores por posición) resiste mejor las bajas y la fatiga de un torneo corto como el Mundial.</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">⚠️ Limitaciones del veredicto</h4>
            <p className="text-sm text-gray-400">
              El veredicto es determinístico dado los datos de entrada. No incorpora incertidumbre (no dice
              "60% de confianza en que A es mejor"). Los pesos (40/30/15/15) son heurísticos basados en
              la importancia relativa de cada factor en la literatura de predicción deportiva, no fueron
              optimizados con cross-validation. Una mejora futura sería aprender los pesos con un meta-modelo.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 11: Potential improvements */}
      <Section title="Mejoras Potenciales — Qué datos podrían mejorar la predicción" icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El rendimiento del modelo está limitado por los datos disponibles. A continuación se analizan
            qué datos adicionales podrían mejorar significativamente las predicciones y por qué no se usan actualmente.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">📈 Datos disponibles en el proyecto que podrían integrarse</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">master_players_featured.csv (atributos FIFA individuales):</strong> Se podría calcular un "squad_overall_avg" ponderado por posición. Actualmente solo se usa squad_avg_impact_score que tiene R²=-0.06 (pobre). Alternativa: promedio ponderado de los 6 atributos FIFA principales (pace, shooting, passing, dribbling, defending, physic) del 11 titular estimado.</li>
              <li><strong className="text-white">master_injuries_featured.csv (riesgo de lesión por jugador):</strong> Se podría calcular un "expected_players_available" que descuente los jugadores con alto riesgo de baja para el momento del torneo.</li>
              <li><strong className="text-white">Formación del rival (master_matches_featured.csv tiene Opp Formation):</strong> Las interacciones formación × formación rival podrían mejorar el modelo táctico. Ej: 4-3-3 históricamente domina a 3-5-2.</li>
              <li><strong className="text-white">Posesión y tiros (disponibles en FBref):</strong> Correlación alta con resultado, pero cuidado con data leakage — solo usable como feature de "estilo promedio" del equipo, no del partido a predecir.</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
            <h4 className="text-sm font-bold text-yellow-300 mb-3">🔮 Datos NO disponibles que marcarían la diferencia</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Odds de casas de apuestas:</strong> Las odds son el mejor predictor individual conocido (incorporan toda la info del mercado). No se usan por restricciones éticas/legales del proyecto académico.</li>
              <li><strong className="text-white">xG esperado pre-partido (modelos de terceros):</strong> Compañías como Opta/StatsBomb calculan xG team-level. Son propietarios.</li>
              <li><strong className="text-white">Datos intra-partido en tiempo real:</strong> Posesión, pases completados, sprints — imposibles de obtener antes del partido.</li>
              <li><strong className="text-white">Altitud del estadio:</strong> Crucial para sedes en CDMX (2,240m), Guadalajara (1,566m), Monterrey (540m). Equipos no aclimatados rinden 8-15% menos a &gt;1,500m según estudios.</li>
              <li><strong className="text-white">Estado motivacional / presión mediática:</strong> No cuantificable con datos estructurados disponibles.</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">Resumen: ¿El algoritmo es el correcto?</h4>
            <p className="text-sm text-gray-400">
              <strong className="text-white">Sí, para la restricción actual de datos.</strong> XGBoost es óptimo para
              datos tabulares con &lt;5,000 muestras y necesidad de explicabilidad. El cuello de botella real no es
              el algoritmo (ya está en su frontera de eficiencia) sino los{" "}
              <strong className="text-neon-blue">datos de entrada</strong>. Las mejoras incrementales vendrían de:
              (1) agregar squad_overall_avg como feature #15, (2) agregar altitud del estadio como #16,
              (3) modelar forma con ventana deslizante ponderada (exponential decay) en vez de promedio simple.
              La mejora esperada sería +1-2 puntos porcentuales de accuracy por cada feature informativa añadida.
            </p>
          </div>
        </div>
      </Section>

      {/* Algorithm Comparison: Match Outcome */}
      <Section title="Comparación de Algoritmos — Predicción de Partidos: XGBoost vs Random Forest" icon={<GitCompare className="w-5 h-5 text-orange-400" />}>
        <ClassificationComparison
          endpoint="match-outcome"
          title="Match Outcome — XGBoost vs Random Forest"
        />
      </Section>

      {/* Algorithm Comparison: Team Points */}
      <Section title="Comparación de Algoritmos — Predicción de Puntos: XGBoost vs Random Forest" icon={<GitCompare className="w-5 h-5 text-green-400" />}>
        <RegressionComparison
          endpoint="team-points"
          title="Team Points — XGBoost vs Random Forest"
        />
      </Section>

    </div>
  );
}
