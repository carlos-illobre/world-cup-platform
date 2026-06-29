import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Brain, Beaker, CloudRain, BarChart3 } from "lucide-react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { ModelPlot } from "@/shared/components/ModelPlot";

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
      <span className="text-sm text-gray-500">Cargando feature importance del modelo...</span>
    </div>
  );
  if (!data || !data.items) return <div className="text-sm text-gray-500">No se pudo obtener feature importance del modelo.</div>;

  const maxGain = data.items[0]?.gain || 1;

  return (
    <div className="bg-black/40 rounded-lg p-4 border border-white/5">
      <h4 className="text-sm font-bold text-gray-200 mb-2">Feature Importance (Gain) — Datos reales del modelo cargado</h4>
      <p className="text-xs text-gray-400 mb-3">
        Extraído en tiempo real de <code className="text-neon-blue">match_outcome_weather_xgb.pkl</code> via{" "}
        <code className="text-neon-blue">booster.get_score(importance_type='gain')</code>. Total features: {data.total_features}.
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

/**
 * Technical panel for Data Science students explaining how the Match Prediction
 * system works — data sources, feature engineering, model details, and evaluation.
 */
export function MatchModelPanel() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Intro */}
      <div className="bg-gradient-to-r from-neon-blue/5 to-purple-500/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-display font-bold text-white mb-3">
          🔬 Sistema de Predicción de Partidos — Documentación Técnica
        </h2>
        <p className="text-base text-gray-300 leading-relaxed mb-4">
          Este sistema predice la <strong className="text-white">probabilidad de victoria, empate o derrota</strong> entre
          dos selecciones usando un modelo XGBoost entrenado con 3,157 partidos internacionales históricos
          (clasificatorias + amistosos + todos los Mundiales desde 1930),
          hasta 19 features por partido incluyendo calidad de plantel y condiciones climáticas reales del estadio.
        </p>
        <div className="bg-black/40 rounded-lg p-4 border border-white/5">
          <p className="text-sm text-gray-400 font-semibold mb-2">📐 Pipeline de predicción:</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg">Seleccionar Equipos</span>
            <span className="text-gray-600">→</span>
            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg">Extraer Stats + Squad</span>
            <span className="text-gray-600">→</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg">Construir 19 Features</span>
            <span className="text-gray-600">→</span>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg">XGBoost predict_proba()</span>
            <span className="text-gray-600">→</span>
            <span className="bg-neon-blue/20 text-neon-blue px-3 py-1 rounded-lg">SHAP Explanations</span>
            <span className="text-gray-600">→</span>
            <span className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-lg">Resultado</span>
          </div>
        </div>
      </div>

      {/* Section 1: Data Sources */}
      <Section title="Paso 1 — ¿De dónde vienen los datos de partidos?" icon={<Database className="w-5 h-5 text-blue-400" />} defaultOpen={true}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo necesita <strong className="text-white">datos históricos de partidos internacionales</strong>,{" "}
            <strong className="text-white">rankings FIFA</strong> y <strong className="text-white">condiciones climáticas</strong> de cada estadio.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
              <h4 className="text-sm font-bold text-blue-300 mb-2">🏆 Resultados Históricos (FBref + WC)</h4>
              <p className="text-sm text-gray-400 mb-2">3,157 partidos de Copas del Mundo (1930-2022), clasificatorias y amistosos FIFA:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Resultado (W/D/L) por partido</li>
                <li>Goles a favor y en contra</li>
                <li>Fecha y sede del partido</li>
                <li>Fase del torneo (grupo, eliminatoria, final)</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ master_matches_featured.csv (3,287 filas × 49 cols)</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2">📊 Rankings FIFA (Scraping mensual)</h4>
              <p className="text-sm text-gray-400 mb-2">Puntuación oficial FIFA para 211 selecciones:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Puntos FIFA (sistema Elo adaptado)</li>
                <li>Posición en el ranking mundial</li>
                <li>Evolución mensual desde 2018</li>
                <li>Confederación (UEFA, CONMEBOL, etc.)</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ Integrado en master_matches_featured.csv</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
              <h4 className="text-sm font-bold text-yellow-300 mb-2">🌤️ Clima (Open-Meteo API)</h4>
              <p className="text-sm text-gray-400 mb-2">Condiciones meteorológicas por estadio/fecha:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Temperatura máxima (°C)</li>
                <li>Precipitación acumulada (mm)</li>
                <li>Velocidad máxima del viento (km/h)</li>
                <li>Coordenadas GPS del estadio → pronóstico</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ master_matches_weather.csv</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Feature Engineering */}
      <Section title="Paso 2 — Feature Engineering: las variables del modelo" icon={<Beaker className="w-5 h-5 text-purple-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo enhanced (v2) usa hasta <strong className="text-white">19 features</strong> para el modelo weather
            y <strong className="text-white">25 features</strong> para el modelo 3-class.
            Se dividen en 4 categorías que capturan diferentes dimensiones de la fuerza relativa:
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">Features de fuerza relativa (extraídas de datos reales)</h4>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">Country_FIFA_Points / Opponent_FIFA_Points</p>
                <p className="text-gray-400">Puntos FIFA oficiales de cada equipo. Rango típico: 1200-1900.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">ranking_diff</p>
                <p className="text-gray-400">= Country_FIFA_Points - Opponent_FIFA_Points. Variable con mayor poder predictivo.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">h2h_wins / h2h_losses</p>
                <p className="text-gray-400">Victorias y derrotas del Equipo A vs Equipo B en Copas del Mundo anteriores.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">form_last_5 / form_last_10</p>
                <p className="text-gray-400">Suma de puntos en los últimos 5/10 partidos. form_last_10 da más estabilidad a la señal.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">goals_scored_last_5 / goals_conceded_last_5</p>
                <p className="text-gray-400">Promedio de goles a favor y en contra en los últimos 5 partidos.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">days_since_last_match</p>
                <p className="text-gray-400">Fatiga (&lt;3 días) o falta de ritmo (&gt;30 días).</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">win_rate_neutral</p>
                <p className="text-gray-400">Win rate histórico en sedes neutrales. Clave para Mundiales donde casi todos los partidos son neutrales.</p>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
            <h4 className="text-sm font-bold text-orange-300 mb-3">🆕 Features de calidad de plantel (v2 — de master_teams_featured.csv)</h4>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-orange-300 text-xs mb-1">impact_diff</p>
                <p className="text-gray-400">= impact_score_A - impact_score_B. El impact_score es un compuesto de atributos FIFA
                  (pace, shooting, dribbling, defending, physic) calculado por el modelo player_impact_xgb para cada jugador
                  y promediado a nivel de selección.</p>
                <p className="text-xs text-gray-500 mt-1">Captura la calidad individual del plantel. Un equipo con Mbappé y Haaland
                  tiene mayor impact que uno sin estrellas, incluso si el ranking es similar.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-orange-300 text-xs mb-1">market_value_ratio</p>
                <p className="text-gray-400">= market_value_A / (market_value_A + market_value_B). Rango 0-1, donde 0.5 = equilibrio.</p>
                <p className="text-xs text-gray-500 mt-1">El valor de mercado es un consenso de scouts/transfermarkt sobre la profundidad
                  y calidad del plantel. No es lo mismo que el ranking FIFA.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-orange-300 text-xs mb-1">country_squad_top_league_ratio / opponent_squad_top_league_ratio</p>
                <p className="text-gray-400">% de jugadores que compiten en las top-5 ligas europeas (PL, LaLiga, Bundesliga, Serie A, Ligue 1).</p>
                <p className="text-xs text-gray-500 mt-1">Equipos con más jugadores en ligas top están acostumbrados a competir
                  al más alto nivel cada semana. Ej: España ~80% vs Haití ~5%.</p>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
            <h4 className="text-sm font-bold text-yellow-300 mb-3">Features climáticas (del estadio)</h4>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-yellow-300 text-xs mb-1">temp_max / precipitation / wind_speed / is_raining / is_hot</p>
                <p className="text-gray-400">Condiciones meteorológicas del estadio. Obtenidas de Open-Meteo usando GPS. Temperaturas &gt;30°C
                  y lluvia &gt;2mm afectan el rendimiento de equipos no habituados.</p>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">⚠️ Nota sobre Data Leakage</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Todas las features se calculan <strong className="text-white">antes del partido</strong>: ranking FIFA vigente,
              forma en los últimos 5 partidos anteriores, y H2H acumulado hasta ese momento. Las features de plantel
              son estáticas (se fijan antes del torneo). El split temporal usa el 80% más antiguo para entrenar.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 3: XGBoost Model */}
      <Section title="Paso 3 — Modelo XGBoost: ¿cómo predice el resultado?" icon={<Brain className="w-5 h-5 text-neon-blue" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Se usan <strong className="text-white">dos modelos complementarios</strong>:
            un XGBoost binario (con clima) y un XGBoost de 3 clases (W/D/L directo).
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
            <h4 className="text-sm font-bold text-neon-blue mb-3">Diagrama de inferencia (Blend Strategy)</h4>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
              <p><span className="text-green-400">INPUT:</span> 19 features (ranking + H2H + forma + <span className="text-orange-300">squad quality</span> + <span className="text-yellow-300">clima</span>)</p>
              <p className="text-gray-600">      ↓</p>
              <p><span className="text-yellow-400">WEATHER MODEL (binario, 19 feat):</span> → P(Win_A) <span className="text-gray-500">← sensible al clima + squad</span></p>
              <p className="text-gray-600">      ↓</p>
              <p><span className="text-purple-400">3-CLASS MODEL (25 feat):</span> → ratio D/(D+L) <span className="text-gray-500">← mejor en separar empate vs derrota</span></p>
              <p className="text-gray-600">      ↓  [blend]</p>
              <p><span className="text-neon-blue">OUTPUT:</span> P(W) del weather model + remaining × ratio del 3-class</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">¿Por qué usar Blend en vez de un solo modelo?</h4>
            <p className="text-sm text-gray-400 mb-3">
              El modelo weather (binario, 19 features) incluye <strong className="text-yellow-300">condiciones climáticas</strong> y
              <strong className="text-orange-300"> calidad de plantel</strong>.
              Pero como es binario (win/not-win), no distingue bien entre Empate y Derrota. El modelo de 3 clases
              (25 features, sin clima) sí diferencia D vs L pero no reacciona a cambios de temperatura.
            </p>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-300 space-y-1">
              <p className="text-gray-500">// Blend strategy:</p>
              <p>prob_win_a = weather_model.predict_proba(features)[1]</p>
              <p>remaining = 1.0 - prob_win_a</p>
              <p></p>
              <p className="text-gray-500">// 3-class model da el ratio D/(D+L)</p>
              <p>proba_3c = three_class_model.predict_proba(features_16)</p>
              <p>draw_ratio = proba_3c[Draw] / (proba_3c[Draw] + proba_3c[Loss])</p>
              <p></p>
              <p className="text-gray-500">// Combinar</p>
              <p>prob_draw = remaining × draw_ratio</p>
              <p>prob_loss = remaining × (1 - draw_ratio)</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Así los sliders de clima afectan la P(Win), y la distribución D/L se beneficia del modelo con más datos históricos.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Tipo</p>
              <p className="text-base font-bold text-white">3-Class + Weather</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Features</p>
              <p className="text-base font-bold text-white">19-25</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Muestras entrenamiento</p>
              <p className="text-base font-bold text-white">2,525</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Clases</p>
              <p className="text-base font-bold text-white">W / D / L</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">¿Por qué XGBoost y no otro modelo?</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Baseline comparado:</strong> Random Forest alcanza 58.3% accuracy pero con peor calibración de probabilidades.</li>
              <li><strong className="text-white">Maneja interacciones no lineales:</strong> La combinación ranking_diff + form puede ser más predictiva que cada una por separado.</li>
              <li><strong className="text-white">Robusto con pocos datos:</strong> Con solo 695 muestras, XGBoost con regularización evita overfitting mejor que redes neuronales.</li>
              <li><strong className="text-white">SHAP nativo:</strong> XGBoost soporta pred_contribs para explicar cada predicción individual sin librerías externas.</li>
              <li><strong className="text-white">Maneja NaN:</strong> Si falta un dato (ej: H2H entre equipos que nunca se enfrentaron), el árbol aprende la dirección óptima.</li>
            </ul>
          </div>

          {/* Real Feature Importance */}
          <MatchFeatureImportance />
        </div>
      </Section>

      {/* Section 4: Model Evaluation */}
      <Section title="Paso 4 — Evaluación: ¿qué tan bueno es el modelo?" icon={<BarChart3 className="w-5 h-5 text-yellow-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo se evalúa con <strong className="text-white">split temporal</strong>: se entrena con el 80% más antiguo
            y se testea con el 20% más reciente (632 partidos). Esto simula predicción real hacia el futuro.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Accuracy (XGBoost Enhanced)</p>
              <p className="text-xl font-bold text-yellow-400">57.6%</p>
              <p className="text-xs text-gray-500 mt-1">sobre 632 partidos test</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">F1-Macro</p>
              <p className="text-xl font-bold text-orange-400">0.466</p>
              <p className="text-xs text-gray-500 mt-1">promedio de 3 clases</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Modelo Anterior (16 feat)</p>
              <p className="text-xl font-bold text-gray-300">57.1%</p>
              <p className="text-xs text-gray-500 mt-1">accuracy sin squad features</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Random Baseline</p>
              <p className="text-xl font-bold text-gray-500">33.3%</p>
              <p className="text-xs text-gray-500 mt-1">predicción aleatoria 3 clases</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Classification Report (XGBoost 3-class)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 px-3">Clase</th>
                    <th className="text-center py-2 px-3">Precision</th>
                    <th className="text-center py-2 px-3">Recall</th>
                    <th className="text-center py-2 px-3">F1-Score</th>
                    <th className="text-center py-2 px-3">Support</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-red-400 font-bold">L (Derrota)</td>
                    <td className="text-center py-2 px-3">0.38</td>
                    <td className="text-center py-2 px-3">0.25</td>
                    <td className="text-center py-2 px-3">0.30</td>
                    <td className="text-center py-2 px-3">103</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-gray-400 font-bold">D (Empate)</td>
                    <td className="text-center py-2 px-3">0.35</td>
                    <td className="text-center py-2 px-3">0.42</td>
                    <td className="text-center py-2 px-3">0.38</td>
                    <td className="text-center py-2 px-3">153</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-green-400 font-bold">W (Victoria)</td>
                    <td className="text-center py-2 px-3">0.72</td>
                    <td className="text-center py-2 px-3">0.76</td>
                    <td className="text-center py-2 px-3">0.74</td>
                    <td className="text-center py-2 px-3">376</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              El modelo es <strong className="text-white">significativamente mejor prediciendo victorias</strong> (F1=0.70) que empates (0.35)
              o derrotas (0.20). Esto es esperable: los empates son inherentemente más difíciles de predecir en el fútbol porque
              dependen de eventos aleatorios (goles en los últimos minutos, penales, errores arbitrales).
            </p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
            <h4 className="text-sm font-bold text-yellow-300 mb-3">⚠️ ¿Por qué el accuracy no es más alto?</h4>
            <div className="space-y-2 text-sm text-gray-300">
              <p><strong className="text-white">1. El fútbol es inherentemente impredecible:</strong> Un equipo inferior puede ganar en cualquier
                partido individual. Con 3 clases, el baseline aleatorio es 33%. Un modelo con 57% supera el azar en ~72%.</p>
              <p><strong className="text-white">2. Dataset mejorado pero aún limitado:</strong> 3,157 partidos es significativamente más que antes (825),
                pero los partidos históricos (pre-2000) carecen de features como ranking FIFA y forma reciente.</p>
              <p><strong className="text-white">3. Empates difíciles:</strong> Representan ~25% de los partidos pero no tienen features discriminativas claras.
                Son casi indistinguibles de victorias ajustadas.</p>
              <p><strong className="text-white">4. El modelo es honesto:</strong> No predice con certeza falsa. Cuando dice 40%/30%/30%,
                realmente refleja la incertidumbre del evento. Las casas de apuestas con modelos de millones de datos
                tampoco superan 55-60% en 3 clases.</p>
            </div>
          </div>

          {/* Training plots */}
          <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
            <h4 className="text-sm font-bold text-neon-blue mb-2">📊 Gráficos del Entrenamiento</h4>
            <p className="text-xs text-gray-400 mb-4">
              Generados automáticamente por <code className="text-neon-blue">model_match_outcome.py</code> durante el entrenamiento.
              Evaluados sobre el 20% temporal más reciente.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-gray-300 mb-2">Confusion Matrix — XGBoost (3 clases)</p>
                <ModelPlot
                  src="match_outcome_confusion_matrix.png"
                  alt="Confusion Matrix del modelo de predicción de partidos"
                  caption="Muestra la distribución de predicciones vs resultados reales. Los empates (D) son la clase peor clasificada."
                />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-300 mb-2">SHAP Summary — Predicción de Victoria (clase W)</p>
                <ModelPlot
                  src="match_outcome_shap_summary_win.png"
                  alt="SHAP Summary Plot para predicción de victoria"
                  caption="Cada punto = un partido. Color rojo = valor alto de la feature. Posición X = impacto en la predicción de victoria."
                />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 5: SHAP Explainability */}
      <Section title="Paso 5 — Explicabilidad SHAP: ¿por qué el modelo predice lo que predice?" icon={<CloudRain className="w-5 h-5 text-green-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Cada predicción individual incluye una <strong className="text-white">explicación SHAP</strong> que muestra
            qué variables empujaron la predicción hacia un lado u otro.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">¿Qué es SHAP?</h4>
            <div className="space-y-2 text-sm text-gray-300">
              <p>
                <strong className="text-white">SHAP</strong> (SHapley Additive exPlanations) es un método de interpretabilidad
                basado en la <strong className="text-white">teoría de juegos cooperativos</strong> (Shapley, 1953).
              </p>
              <p>
                En un juego cooperativo, cada jugador (= feature) contribuye al resultado final (= predicción).
                El valor SHAP de una feature es su <strong className="text-white">contribución marginal promedio</strong> considerando
                todas las posibles combinaciones de las otras features.
              </p>
              <p>
                Matemáticamente: <code className="text-green-300 bg-black/60 px-2 py-0.5 rounded">φᵢ = Σ [|S|!(n-|S|-1)!/n!] × [f(S∪{'{i}'}) - f(S)]</code>
              </p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Implementación en este proyecto</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-300 space-y-1">
              <p className="text-gray-500"># En match_predictor.py:</p>
              <p>booster = model.get_booster()</p>
              <p>dmatrix = xgb.DMatrix(features_df)</p>
              <p>contribs = booster.predict(dmatrix, <span className="text-green-300">pred_contribs=True</span>)[0]</p>
              <p></p>
              <p className="text-gray-500"># contribs tiene 15 valores: 14 features + 1 bias</p>
              <p className="text-gray-500"># Se ordenan por |valor| y se toman los top-4</p>
              <p>feature_contribs.sort(key=lambda x: abs(x[1]), reverse=True)</p>
              <p>top_4 = feature_contribs[:4]</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              <strong>Ventaja:</strong> Usamos <code className="text-green-300">pred_contribs</code> nativo de XGBoost en lugar de
              la librería SHAP externa. Es más rápido (O(n) vs O(2ⁿ)) y da el mismo resultado para modelos de árboles.
            </p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Interpretación de los valores SHAP</h4>
            <div className="space-y-2 text-sm text-gray-300">
              <p><span className="text-neon-blue font-bold">+0.35 (ranking_diff)</span> → La diferencia de ranking empuja +0.35 log-odds a favor del Equipo A. El equipo mejor rankeado tiene ventaja.</p>
              <p><span className="text-red-400 font-bold">-0.12 (form_last_5)</span> → La forma reciente empuja -0.12 log-odds contra el Equipo A. El Equipo B tiene mejor racha actual.</p>
              <p><span className="text-gray-400">Los valores se suman al bias para producir la predicción final:</span></p>
              <p className="font-mono text-xs bg-black/60 rounded p-2 border border-white/5">
                logit = bias + φ₁ + φ₂ + ... + φ₁₄ → sigmoid(logit) = probabilidad
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 6: Limitations & Future Work */}
      <Section title="Paso 6 — Limitaciones y mejoras posibles" icon={<Brain className="w-5 h-5 text-red-400" />}>
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
            <h4 className="text-sm font-bold text-red-300 mb-3">Limitaciones actuales</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Dataset enriquecido:</strong> 3,157 partidos (825 FBref + 2,332 históricos WC). Más datos que antes pero aún limitado vs modelos comerciales con 50,000+.</li>
              <li><strong className="text-white">Empates subrepresentados:</strong> Solo ~25% de los partidos son empates, creando desbalance de clases que dificulta su predicción.</li>
              <li><strong className="text-white">Squad features estáticas:</strong> Ahora incluimos calidad de plantel, pero los datos son una foto fija pre-torneo. No se actualizan si un jugador clave se lesiona durante el Mundial.</li>
              <li><strong className="text-white">Clima limitado:</strong> Solo 3 variables climáticas. Factores como altitud, humedad, y tipo de césped no se incluyen.</li>
              <li><strong className="text-white">Estacionalidad no capturada:</strong> No distingue entre fase de grupos (equipos conservadores) y eliminatorias (partidos más abiertos).</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">Mejoras propuestas para futuros trabajos</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Agregar features de jugadores clave:</strong> Incluir si los top-3 jugadores por Impact Score están disponibles.</li>
              <li><strong className="text-white">Ensemble con modelo Elo:</strong> Combinar XGBoost con un modelo Elo puro para mejorar calibración.</li>
              <li><strong className="text-white">Oversampling de empates:</strong> Usar SMOTE o similar para balancear la clase D.</li>
              <li><strong className="text-white">Features tácticas:</strong> Incluir formación habitual, presión alta/baja, posesión promedio.</li>
              <li><strong className="text-white">Más datos históricos:</strong> Expandir a partidos desde 2010 (más datos de rankings modernos).</li>
              <li><strong className="text-white">Calibración de probabilidades:</strong> Aplicar Platt Scaling o Isotonic Regression post-entrenamiento.</li>
            </ul>
          </div>
        </div>
      </Section>

    </div>
  );
}
