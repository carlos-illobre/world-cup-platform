import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Brain, Beaker, BarChart3, AlertTriangle, CheckCircle2, GitCompare } from "lucide-react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { ModelPlot } from "@/shared/components/ModelPlot";
import { ClassificationComparison } from "@/shared/components/AlgorithmComparison";

interface GroupsModelPanelProps {
  methodology: {
    approach: string;
    description: string;
    models_used: string[];
    features_count: number;
    training_samples: number;
    test_accuracy: string;
    confidence_method: string;
  } | null;
  groupsData: Record<string, any[]> | null;
}

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

export function GroupsModelPanel({ methodology, groupsData }: GroupsModelPanelProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Intro — Pipeline Real */}
      <div className="bg-gradient-to-r from-neon-blue/5 to-purple-500/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-display font-bold text-white mb-3">
          🔬 Simulador de Grupos — Documentación Técnica
        </h2>
        <p className="text-base text-gray-300 leading-relaxed mb-4">
          Este sistema predice los <strong className="text-white">puntos esperados en fase de grupos</strong> para
          cada selección. A diferencia de un modelo de regresión simple, el enfoque es{" "}
          <strong className="text-neon-blue">simulación partido a partido</strong>: se predicen los 3 partidos
          de grupo de cada equipo individualmente usando el modelo XGBoost enhanced (v2) con
          features de ranking, forma, historial H2H, calidad de plantel y condiciones climáticas,
          y se calcula E[pts] = P(Win)×3 + P(Draw)×1.
        </p>
        <div className="bg-black/40 rounded-lg p-4 border border-white/5">
          <p className="text-sm text-gray-400 font-semibold mb-2">📐 Pipeline de predicción de grupos:</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg">Leer Grupo</span>
            <span className="text-gray-600">→</span>
            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg">3 Partidos × Equipo</span>
            <span className="text-gray-600">→</span>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg">XGBoost predict_proba()</span>
            <span className="text-gray-600">→</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg">Blend W + D/L ratio</span>
            <span className="text-gray-600">→</span>
            <span className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-lg">Σ E[pts]</span>
            <span className="text-gray-600">→</span>
            <span className="bg-neon-blue/20 text-neon-blue px-3 py-1 rounded-lg">Ranking + Entropía</span>
          </div>
        </div>
      </div>

      {/* Section 1: Why simulation > regression */}
      <Section title="¿Por qué simulación partido a partido en vez de regresión directa?" icon={<Brain className="w-5 h-5 text-neon-blue" />} defaultOpen={true}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
              <h4 className="text-sm font-bold text-red-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Enfoque Descartado: Regresión Directa
              </h4>
              <p className="text-sm text-gray-400 mb-2">
                El modelo <code className="text-gray-300">team_points_xgb_model</code> (XGBoost Regressor, 19 features)
                predecía directamente los puntos finales del grupo:
              </p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>RMSE: 0.83 (parece bueno pero el rango es solo 0-9)</li>
                <li>No considera a los oponentes específicos del grupo</li>
                <li>No puede explicar POR QUÉ un equipo clasifica</li>
                <li>No reacciona a cambios de clima o condiciones</li>
                <li>No permite análisis "what-if"</li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Enfoque Actual: Simulación Match-by-Match
              </h4>
              <p className="text-sm text-gray-400 mb-2">
                Se predicen los 3 partidos individuales y se suman los puntos esperados:
              </p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Usa el modelo de partidos (57.1% accuracy, 14 features)</li>
                <li>Considera la fuerza relativa de cada oponente</li>
                <li>Incluye H2H histórico real entre equipos del grupo</li>
                <li>Reacciona a condiciones climáticas del estadio</li>
                <li>Genera explicaciones SHAP por cada partido</li>
                <li>Calcula confianza individual por predicción</li>
              </ul>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">Fórmula de Puntos Esperados</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
              <p className="text-gray-500"># Para cada partido del equipo en el grupo:</p>
              <p>probs = blend_model.predict_proba(features_14)</p>
              <p>expected_pts = P(Win) × 3 + P(Draw) × 1 + P(Loss) × 0</p>
              <p></p>
              <p className="text-gray-500"># Total del grupo:</p>
              <p>total_pts = Σ expected_pts(match_1, match_2, match_3)</p>
              <p></p>
              <p className="text-gray-500"># Confianza (entropía de Shannon normalizada):</p>
              <p>H = -Σ p_i × log₂(p_i) / log₂(3)</p>
              <p className="text-gray-500"># H=0 → certeza total, H=1 → máxima incertidumbre</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Data Sources */}
      <Section title="Fuentes de Datos" icon={<Database className="w-5 h-5 text-blue-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Todos los datos provienen de fuentes públicas verificables. No se inventan estadísticas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
              <h4 className="text-sm font-bold text-blue-300 mb-2">📊 FBref</h4>
              <p className="text-xs text-gray-400">825 partidos recientes (2022-2025) con formaciones, posesión, goles.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ master_matches_featured.csv</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2">🏆 Mundiales 1930-2022</h4>
              <p className="text-xs text-gray-400">2,332 partidos históricos con scores, sede, ronda.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ historical_world_cups.csv</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
              <h4 className="text-sm font-bold text-yellow-300 mb-2">🌐 FIFA Rankings</h4>
              <p className="text-xs text-gray-400">Puntos FIFA actualizados (sistema Elo) para 211 selecciones.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ Integrado en matches_featured</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
              <h4 className="text-sm font-bold text-purple-300 mb-2">🌤️ Open-Meteo</h4>
              <p className="text-xs text-gray-400">Condiciones climáticas por coordenadas GPS de cada estadio.</p>
              <p className="text-[11px] text-gray-400 mt-1 italic">→ world_cup_stadiums.csv</p>
            </div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">Dataset total</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
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
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3: Feature Engineering */}
      <Section title="Las 19 Features del Modelo Weather Enhanced (v2)" icon={<Beaker className="w-5 h-5 text-purple-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo enhanced (v2) usa <strong className="text-white">19 features</strong> para el modelo weather
            y <strong className="text-white">25 features</strong> para el 3-class. Se dividen en 4 categorías:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
              <h4 className="text-sm font-bold text-purple-300 mb-2">Fuerza Relativa (5)</h4>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li><code className="text-purple-300">Country_FIFA_Points</code></li>
                <li><code className="text-purple-300">Opponent_FIFA_Points</code></li>
                <li><code className="text-purple-300">ranking_diff</code> (más predictiva)</li>
                <li><code className="text-purple-300">h2h_wins</code></li>
                <li><code className="text-purple-300">h2h_losses</code></li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2">Forma Reciente (4)</h4>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li><code className="text-green-300">form_last_5</code></li>
                <li><code className="text-green-300">goals_scored_last_5</code></li>
                <li><code className="text-green-300">goals_conceded_last_5</code></li>
                <li><code className="text-green-300">days_since_last_match</code></li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
              <h4 className="text-sm font-bold text-orange-300 mb-2">🆕 Squad Quality (5)</h4>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li><code className="text-orange-300">impact_diff</code></li>
                <li><code className="text-orange-300">market_value_ratio</code></li>
                <li><code className="text-orange-300">squad_avg_impact_score</code> (A)</li>
                <li><code className="text-orange-300">squad_top_league_ratio</code> (A)</li>
                <li><code className="text-orange-300">win_rate_neutral</code></li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
              <h4 className="text-sm font-bold text-yellow-300 mb-2">Clima (5)</h4>
              <ul className="text-xs text-gray-400 space-y-1.5">
                <li><code className="text-yellow-300">temp_max</code></li>
                <li><code className="text-yellow-300">precipitation</code></li>
                <li><code className="text-yellow-300">wind_speed</code></li>
                <li><code className="text-yellow-300">is_raining</code></li>
                <li><code className="text-yellow-300">is_hot</code></li>
              </ul>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
            <h4 className="text-sm font-bold text-orange-300 mb-2">¿Por qué agregar features de plantel?</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              El modelo anterior solo capturaba la fuerza del equipo via ranking FIFA (un solo número agregado).
              Pero dos equipos con ranking similar pueden tener planteles muy diferentes: uno con estrellas
              individuales (alto impact_score) vs uno con jugadores de ligas menores (bajo top_league_ratio).
              Las nuevas features agregan <strong className="text-white">3 dimensiones ortogonales</strong> al ranking:
              talento individual (impact), profundidad económica (market_value), y competitividad del entorno (top_league).
            </p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">⚠️ Data Leakage Prevention</h4>
            <p className="text-sm text-gray-400">
              Todas las features se calculan <strong className="text-white">antes del partido</strong>.
              Las features de plantel son estáticas (fijadas antes del torneo).
              El split es temporal (80% más antiguo = train, 20% reciente = test).
            </p>
          </div>
        </div>
      </Section>

      {/* Section 4: Blend Strategy */}
      <Section title="Estrategia Blend: Dos Modelos Complementarios" icon={<Brain className="w-5 h-5 text-neon-blue" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Se combinan dos modelos XGBoost para obtener la mejor predicción posible:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
              <h4 className="text-sm font-bold text-neon-blue mb-2">Modelo Weather (Binario)</h4>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>14 features incluyendo clima</li>
                <li>Entrenado con 695 partidos con datos climáticos</li>
                <li>Predice: P(Win_A) vs P(Not_Win_A)</li>
                <li><strong className="text-white">Ventaja:</strong> sensible a temperatura, lluvia, viento</li>
                <li><strong className="text-red-300">Limitación:</strong> no separa Empate de Derrota</li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
              <h4 className="text-sm font-bold text-purple-300 mb-2">Modelo 3-Class (W/D/L)</h4>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>16 features deportivas (sin clima)</li>
                <li>Entrenado con 3,157 partidos</li>
                <li>Predice: P(Win), P(Draw), P(Loss)</li>
                <li><strong className="text-white">Ventaja:</strong> mejor separación D vs L</li>
                <li><strong className="text-red-300">Limitación:</strong> no reacciona al clima</li>
              </ul>
            </div>
          </div>

          <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
            <p className="text-gray-500">// Blend Strategy implementada en match_predictor.py:</p>
            <p><span className="text-neon-blue">prob_win_a</span> = weather_model.predict_proba(features_14)[1]</p>
            <p><span className="text-gray-400">remaining</span> = 1.0 - prob_win_a</p>
            <p></p>
            <p className="text-gray-500">// Del modelo 3-class extraemos la proporción D/(D+L):</p>
            <p><span className="text-purple-300">proba_3c</span> = three_class.predict_proba(features_16)</p>
            <p><span className="text-purple-300">draw_ratio</span> = proba_3c[D] / (proba_3c[D] + proba_3c[L])</p>
            <p></p>
            <p className="text-gray-500">// Resultado final:</p>
            <p><span className="text-green-300">P(Win)</span> = prob_win_a        <span className="text-gray-500">← del weather model</span></p>
            <p><span className="text-yellow-300">P(Draw)</span> = remaining × draw_ratio</p>
            <p><span className="text-red-300">P(Loss)</span> = remaining × (1 - draw_ratio)</p>
          </div>
        </div>
      </Section>

      {/* Section 5: Model Evaluation */}
      <Section title="Evaluación del Modelo" icon={<BarChart3 className="w-5 h-5 text-yellow-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Evaluado con split temporal (80% antiguo → train, 20% reciente → test = 632 partidos):
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Accuracy</p>
              <p className="text-xl font-bold text-yellow-400">57.6%</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">F1-Macro</p>
              <p className="text-xl font-bold text-orange-400">0.466</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">F1(Win)</p>
              <p className="text-xl font-bold text-green-400">0.73</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">F1(Draw)</p>
              <p className="text-xl font-bold text-yellow-300">0.37</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Baseline Random</p>
              <p className="text-xl font-bold text-gray-500">33.3%</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Classification Report</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 px-3">Clase</th>
                    <th className="text-center py-2 px-3">Precision</th>
                    <th className="text-center py-2 px-3">Recall</th>
                    <th className="text-center py-2 px-3">F1</th>
                    <th className="text-center py-2 px-3">Support</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-red-400 font-bold">Loss</td>
                    <td className="text-center py-2 px-3">0.38</td>
                    <td className="text-center py-2 px-3">0.25</td>
                    <td className="text-center py-2 px-3">0.30</td>
                    <td className="text-center py-2 px-3">103</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-yellow-400 font-bold">Draw</td>
                    <td className="text-center py-2 px-3">0.35</td>
                    <td className="text-center py-2 px-3">0.42</td>
                    <td className="text-center py-2 px-3">0.38</td>
                    <td className="text-center py-2 px-3">153</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-green-400 font-bold">Win</td>
                    <td className="text-center py-2 px-3">0.72</td>
                    <td className="text-center py-2 px-3">0.76</td>
                    <td className="text-center py-2 px-3">0.74</td>
                    <td className="text-center py-2 px-3">376</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Real training plots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-300 mb-2">Confusion Matrix</p>
              <ModelPlot
                src="match_outcome_confusion_matrix.png"
                alt="Confusion Matrix del modelo de predicción de partidos"
                caption="Distribución de predicciones vs resultados reales. Empates (D) = clase peor clasificada."
              />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-300 mb-2">SHAP Summary — Victoria</p>
              <ModelPlot
                src="match_outcome_shap_summary_win.png"
                alt="SHAP Summary Plot para predicción de victoria"
                caption="Color rojo = valor alto. Posición X = impacto en predicción de victoria."
              />
            </div>
          </div>

          {/* Real Feature Importance */}
          <MatchFeatureImportance />
        </div>
      </Section>

      {/* Section 6: Confidence & Entropy */}
      <Section title="Sistema de Confianza (Entropía de Shannon)" icon={<BarChart3 className="w-5 h-5 text-green-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            No todas las predicciones son iguales. Cuando el modelo predice 40%/30%/30%, es muy distinto
            a 70%/20%/10%. Usamos la <strong className="text-white">entropía de Shannon</strong> para cuantificar
            la incertidumbre de cada predicción.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Cálculo</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
              <p className="text-gray-500">// Entropía normalizada (rango 0-1):</p>
              <p>H_normalized = -Σ(p_i × log₂(p_i)) / log₂(3)</p>
              <p></p>
              <p className="text-gray-500">// Clasificación:</p>
              <p><span className="text-green-400">Alta confianza:</span>  H &lt; 0.60  (ej: 70%/20%/10%)</p>
              <p><span className="text-yellow-400">Media confianza:</span> H ∈ [0.60, 0.85]  (ej: 45%/30%/25%)</p>
              <p><span className="text-red-400">Baja confianza:</span>   H &gt; 0.85  (ej: 36%/33%/31%)</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">¿Por qué esto importa para el negocio?</h4>
            <p className="text-sm text-gray-400">
              Una predicción con <strong className="text-green-400">alta confianza</strong> indica que el modelo
              tiene evidencia clara (ranking muy superior, H2H dominante). Las de{" "}
              <strong className="text-red-400">baja confianza</strong> son esencialmente coin-flips donde
              cualquier resultado es posible — el usuario no debería tomar decisiones fuertes basándose en ellas.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 7: Limitations & Why XGBoost */}
      <Section title="¿Por qué XGBoost? Ventajas, Desventajas y Alternativas" icon={<Brain className="w-5 h-5 text-red-400" />}>
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">✅ Ventajas de XGBoost para este problema</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Robusto con pocos datos:</strong> Con 3,157 muestras y 14 features, XGBoost con regularización (max_depth=6, min_child=5) evita overfitting mejor que redes neuronales.</li>
              <li><strong className="text-white">Maneja interacciones no lineales:</strong> ranking_diff + form combinados pueden ser más predictivos que cada uno por separado. Los árboles capturan esto automáticamente.</li>
              <li><strong className="text-white">SHAP nativo (pred_contribs):</strong> Explicabilidad O(n) sin librerías externas. Cada predicción incluye la contribución de cada feature.</li>
              <li><strong className="text-white">Maneja NaN:</strong> Si dos equipos nunca se enfrentaron (h2h=0), el árbol aprende la dirección óptima del split sin imputación.</li>
              <li><strong className="text-white">Probabilidades calibradas:</strong> predict_proba() con softmax da probabilidades directamente interpretables.</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
            <h4 className="text-sm font-bold text-red-300 mb-3">❌ Limitaciones</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Empates difíciles:</strong> Solo ~25% de partidos son empate. El modelo tiene F1=0.38 en esta clase — no hay features discriminativas claras para empates.</li>
              <li><strong className="text-white">Sin datos de jugadores individuales:</strong> No sabe si Messi está lesionado. El modelo ve equipos como unidad.</li>
              <li><strong className="text-white">Features estáticas:</strong> Usa el último valor conocido de cada feature. No modela la evolución temporal (ej: un equipo que mejoró en los últimos 2 meses).</li>
              <li><strong className="text-white">Clima genérico:</strong> Solo 3 variables. No incluye altitud, humedad, ni tipo de césped.</li>
              <li><strong className="text-white">Accuracy moderada:</strong> 57.1% — mejor que azar (33%) pero las casas de apuestas con millones de datos tampoco superan 55-60% en 3 clases.</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">🔄 Alternativas consideradas</h4>
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
                    <td className="py-2 px-2 text-xs text-gray-400">Peor calibración, sin pred_contribs nativo</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2">Logistic Regression</td>
                    <td className="text-center py-2 px-2">~52%</td>
                    <td className="py-2 px-2 text-xs text-gray-400">No captura interacciones, lineal</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-2">Neural Network</td>
                    <td className="text-center py-2 px-2">~54%</td>
                    <td className="py-2 px-2 text-xs text-gray-400">Overfitting con 3K muestras, opaca</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-neon-blue font-bold">XGBoost (actual)</td>
                    <td className="text-center py-2 px-2 text-neon-blue font-bold">57.1%</td>
                    <td className="py-2 px-2 text-xs text-neon-blue">Mejor accuracy + explicabilidad + robustez</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 8: Live predictions analysis */}
      {groupsData && (
        <Section title="Análisis de Predicciones Generadas" icon={<BarChart3 className="w-5 h-5 text-orange-400" />}>
          <div className="space-y-4">
            <p className="text-base text-gray-300 leading-relaxed">
              Estadísticas sobre las predicciones recién calculadas para las 48 selecciones:
            </p>
            {(() => {
              const allTeams = Object.values(groupsData).flat();
              const allMatches = allTeams.flatMap((t: any) => t.matches || []);
              const highConf = allMatches.filter((m: any) => m.confidence === "alta").length;
              const medConf = allMatches.filter((m: any) => m.confidence === "media").length;
              const lowConf = allMatches.filter((m: any) => m.confidence === "baja").length;
              const avgEntropy = allMatches.reduce((s: number, m: any) => s + (m.entropy || 0), 0) / allMatches.length;
              const maxPts = Math.max(...allTeams.map((t: any) => t.predicted_points || 0));
              const minPts = Math.min(...allTeams.map((t: any) => t.predicted_points || 0));

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                    <p className="text-xs text-gray-500">Total Partidos Simulados</p>
                    <p className="text-xl font-bold text-white">{allMatches.length}</p>
                  </div>
                  <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                    <p className="text-xs text-gray-500">Confianza Alta / Media / Baja</p>
                    <p className="text-lg font-bold">
                      <span className="text-green-400">{highConf}</span>
                      <span className="text-gray-500"> / </span>
                      <span className="text-yellow-400">{medConf}</span>
                      <span className="text-gray-500"> / </span>
                      <span className="text-red-400">{lowConf}</span>
                    </p>
                  </div>
                  <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                    <p className="text-xs text-gray-500">Entropía Promedio</p>
                    <p className="text-xl font-bold text-orange-400">{avgEntropy.toFixed(3)}</p>
                  </div>
                  <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                    <p className="text-xs text-gray-500">Rango de Pts Predichos</p>
                    <p className="text-xl font-bold text-white">{minPts.toFixed(1)} — {maxPts.toFixed(1)}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </Section>
      )}

      {/* Section 9: Methodology metadata from API */}
      {methodology && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5">
          <h4 className="text-sm font-bold text-purple-300 mb-3">📋 Metadata del Endpoint</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400"><strong className="text-white">Approach:</strong> {methodology.approach}</p>
              <p className="text-gray-400 mt-1"><strong className="text-white">Features:</strong> {methodology.features_count}</p>
              <p className="text-gray-400 mt-1"><strong className="text-white">Training samples:</strong> {methodology.training_samples.toLocaleString()}</p>
              <p className="text-gray-400 mt-1"><strong className="text-white">Test accuracy:</strong> {methodology.test_accuracy}</p>
            </div>
            <div>
              <p className="text-gray-400"><strong className="text-white">Modelos:</strong></p>
              <ul className="text-xs text-gray-400 list-disc list-inside mt-1">
                {methodology.models_used.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
              <p className="text-gray-400 mt-2"><strong className="text-white">Confianza:</strong></p>
              <p className="text-xs text-gray-400 mt-1">{methodology.confidence_method}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed border-t border-white/5 pt-3">
            {methodology.description}
          </p>
        </div>
      )}

      {/* Algorithm Comparison Section */}
      <Section title="Comparación de Algoritmos — XGBoost vs Random Forest" icon={<GitCompare className="w-5 h-5 text-orange-400" />} defaultOpen={false}>
        <ClassificationComparison
          endpoint="match-outcome"
          title="Match Outcome — XGBoost vs Random Forest"
        />
      </Section>
    </div>
  );
}
