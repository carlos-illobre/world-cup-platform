import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Brain, Target, Layers, BarChart3, GitCompare } from "lucide-react";
import { CLUSTER_NAMES, CLUSTER_COLORS } from "../constants";
import { fetchJson } from "@/shared/lib/apiClient";
import { ClusterScatterChart } from "./ClusterScatterChart";
import { HdbscanScatterChart } from "./HdbscanScatterChart";
import { ModelPlot } from "@/shared/components/ModelPlot";
import { ClusteringComparison, RegressionComparison } from "@/shared/components/AlgorithmComparison";

interface ModelInfoPanelProps {
  clusterAverages: any;
  totalPlayers: number;
}

function Section({ title, icon, children, defaultOpen = false, color = "white" }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; color?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/5 transition-colors">
        {icon}
        <h3 className={`text-lg font-display font-bold flex-1 text-${color}`}>{title}</h3>
        {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/5 pt-4">{children}</div>}
    </div>
  );
}

function RealImpactFeatureImportance() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<any>("/api/v1/players/model/feature-importance")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex flex-col items-center justify-center py-8 gap-3"><div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-neon-blue to-cyan-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" /></div><span className="text-sm text-gray-500">Cargando feature importance del modelo...</span></div>;
  if (!data || !data.items) return <div className="text-sm text-gray-500">No se pudo obtener feature importance (modelo no cargado).</div>;

  const maxGain = data.items[0]?.gain || 1;

  return (
    <div className="bg-black/40 rounded-lg p-4 border border-white/5">
      <h4 className="text-sm font-bold text-gray-200 mb-2">Feature Importance (Gain) — Datos reales del modelo cargado</h4>
      <p className="text-xs text-gray-400 mb-3">
        Extraído en tiempo real de <code className="text-neon-blue">player_impact_xgb_enriched.pkl</code> via <code className="text-neon-blue">booster.get_score(importance_type='gain')</code>. 
        Gain mide cuánto contribuye cada feature a reducir el error en los splits del árbol. Total: {data.total_features} features.
      </p>
      <div className="space-y-1.5">
        {data.items.slice(0, 12).map((item: any) => (
          <div key={item.feature} className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-400 w-44 truncate" title={item.feature}>{item.feature}</span>
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

export function ModelInfoPanel({ clusterAverages, totalPlayers }: ModelInfoPanelProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Intro */}
      <div className="bg-gradient-to-r from-purple-500/5 to-neon-blue/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-display font-bold text-white mb-3">🔬 Laboratorio de Modelos — Documentación Técnica</h2>
        <p className="text-base text-gray-300 leading-relaxed mb-4">
          Esta sección explica paso a paso <strong className="text-white">cómo se construyeron los modelos</strong> que alimentan 
          el Panel de Decisión. Está pensada para estudiantes y científicos de datos que quieran entender las decisiones 
          de diseño, reproducir los resultados o proponer mejoras.
        </p>
        <div className="bg-black/40 rounded-lg p-4 border border-white/5">
          <p className="text-sm text-gray-400 font-semibold mb-2">📐 Pipeline resumido:</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg">1. Scraping</span>
            <span className="text-gray-600">→</span>
            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg">2. Limpieza</span>
            <span className="text-gray-600">→</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg">3. Feature Engineering</span>
            <span className="text-gray-600">→</span>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg">4. Modelado</span>
            <span className="text-gray-600">→</span>
            <span className="bg-neon-blue/20 text-neon-blue px-3 py-1 rounded-lg">5. API + Dashboard</span>
          </div>
        </div>
      </div>

      {/* Section 1: Data Sources */}
      <Section title="Paso 1 — ¿De dónde vienen los datos?" icon={<Database className="w-5 h-5 text-blue-400" />} defaultOpen={true} color="blue-400">
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Todos los datos son <strong className="text-white">reales y scrapeados</strong> de fuentes públicas. 
            No se inventó ningún dato ni se usaron APIs de pago.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
              <h4 className="text-sm font-bold text-blue-300 mb-2">🌐 FBref (Sports Reference)</h4>
              <p className="text-sm text-gray-400 mb-2">Estadísticas reales de rendimiento de los jugadores en todas sus competiciones.</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Goles, asistencias, minutos jugados (por 90 min)</li>
                <li>Expected Goals (xG) — modelo estadístico de StatsBomb</li>
                <li>Puntos por partido del equipo (PPM)</li>
                <li>Diferencial On/Off — cómo rinde el equipo con y sin el jugador</li>
                <li>Entradas, intercepciones, centros, faltas (10 métricas per 90)</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ Genera: master_players_enriched.csv (1,186 jugadores × 152 columnas)</p>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
              <h4 className="text-sm font-bold text-red-300 mb-2">🏥 Transfermarkt</h4>
              <p className="text-sm text-gray-400 mb-2">Historial completo de lesiones + valores de mercado.</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Tipo de lesión, fecha inicio/fin, días de baja</li>
                <li>Partidos perdidos por lesión</li>
                <li>Valor de mercado en EUR</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ Genera: master_injuries_featured.csv (8,611 registros de lesiones)</p>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-bold text-green-300 mb-2">🎮 EA Sports FC (FIFA)</h4>
              <p className="text-sm text-gray-400 mb-2">Atributos técnicos de cada jugador del videojuego (0-99).</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>6 atributos principales: Ritmo, Tiro, Pase, Regate, Defensa, Físico</li>
                <li>34 sub-atributos detallados (compostura, reacciones, etc.)</li>
                <li>Overall, Potencial, Valor, Salario</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ Se usa como INPUT del modelo de Impact Score (40 features)</p>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
              <h4 className="text-sm font-bold text-yellow-300 mb-2">🌤️ Open-Meteo + FIFA Rankings</h4>
              <p className="text-sm text-gray-400 mb-2">Datos contextuales para el modelo de predicción de partidos.</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Temperatura, lluvia, viento por estadio/fecha</li>
                <li>Rankings FIFA históricos mensuales por país</li>
                <li>Resultados H2H de Copas del Mundo anteriores</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ Genera: master_matches_featured.csv (825 partidos × 48 features)</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Impact Score */}
      <Section title="Paso 2 — ¿Cómo se calcula el Nivel de Aporte (Impact Score)?" icon={<Target className="w-5 h-5 text-neon-blue" />} defaultOpen={true} color="white">
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El Impact Score mide <strong className="text-white">cuánto aporta un jugador a su equipo</strong> comparado con los demás 1,186 jugadores del dataset. 
            Se calcula en dos etapas:
          </p>

          {/* Etapa 1: Target variable */}
          <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
            <h4 className="text-sm font-bold text-neon-blue mb-3">Etapa 1: Crear la variable objetivo (target) desde datos REALES</h4>
            <p className="text-sm text-gray-300 mb-3">
              Primero se define "qué significa aportar" usando 3 estadísticas reales de FBref (no de FIFA):
            </p>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 mb-3 font-mono text-sm">
              <p className="text-purple-300">impact_score_raw = Z(G+A/90) + Z(PPM) + Z(On/Off)</p>
            </div>
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex gap-3">
                <span className="text-neon-blue font-bold shrink-0">G+A/90:</span>
                <span>Goles + Asistencias cada 90 minutos jugados. Mide producción ofensiva directa normalizada por tiempo.</span>
              </div>
              <div className="flex gap-3">
                <span className="text-neon-blue font-bold shrink-0">PPM:</span>
                <span>Points Per Match — promedio de puntos del equipo en los partidos donde este jugador participa. Si el equipo gana más cuando él juega, su PPM es alto.</span>
              </div>
              <div className="flex gap-3">
                <span className="text-neon-blue font-bold shrink-0">On/Off:</span>
                <span>Diferencia de goles del equipo CON el jugador vs SIN el jugador en cancha. Un On/Off de +0.5 significa que el equipo mete 0.5 goles más por partido cuando él está.</span>
              </div>
              <div className="flex gap-3">
                <span className="text-purple-400 font-bold shrink-0">Z(...):</span>
                <span>Z-score = (valor - media) / desviación_estándar. Normaliza cada componente para que todos pesen igual. Un Z de +2 significa "dos desviaciones por encima del promedio" (top ~2.5%).</span>
              </div>
            </div>
          </div>

          {/* Etapa 2: Modelo predictivo */}
          <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
            <h4 className="text-sm font-bold text-neon-blue mb-3">Etapa 2: Entrenar un modelo para PREDECIR el impact desde atributos FIFA</h4>
            <p className="text-sm text-gray-300 mb-3">
              <strong className="text-white">¿Por qué?</strong> Porque el impact_score_raw solo existe para jugadores con suficientes datos en FBref. 
              El modelo aprende la relación entre los 40 atributos FIFA (que existen para todos) y el impact real, 
              permitiendo estimar el aporte de cualquier jugador.
            </p>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 mb-3">
              <p className="text-xs text-gray-400 mb-1">Diagrama conceptual:</p>
              <div className="text-sm font-mono text-gray-300 space-y-1">
                <p><span className="text-green-400">INPUT (40 features FIFA):</span> overall, pace, shooting, passing, dribbling, defending, physic, composure, reactions, potential, wage_eur, ...</p>
                <p className="text-gray-600">          ↓  [XGBoost Regressor: 200 árboles, profundidad 6]</p>
                <p><span className="text-yellow-400">OUTPUT (target):</span> impact_score_raw predicho</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">R² (test)</p>
                <p className="text-lg font-bold text-green-400">0.847</p>
                <p className="text-xs text-gray-500">Explica 84.7% de la varianza</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">RMSE</p>
                <p className="text-lg font-bold text-yellow-400">0.412</p>
                <p className="text-xs text-gray-500">Error promedio ±0.41 puntos</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">MAE</p>
                <p className="text-lg font-bold text-blue-400">0.298</p>
                <p className="text-xs text-gray-500">Mediana error: 0.3</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">Train/Test</p>
                <p className="text-lg font-bold text-gray-300">80/20</p>
                <p className="text-xs text-gray-500">Split estratificado</p>
              </div>
            </div>
          </div>

          {/* Feature Importance — fetched from real model */}
          <RealImpactFeatureImportance />

          {/* SHAP Summary from training */}
          <div className="bg-black/40 rounded-lg p-4 border border-neon-blue/20">
            <h4 className="text-sm font-bold text-neon-blue mb-2">📊 SHAP Summary Plot — Del entrenamiento original</h4>
            <p className="text-xs text-gray-400 mb-3">
              Generado con <code className="text-neon-blue">shap.summary_plot()</code> durante el entrenamiento de <code className="text-neon-blue">model_player_impact.py</code>. 
              Muestra cómo cada feature contribuye a la predicción del Impact Score.
            </p>
            <ModelPlot src="player_impact_shap_summary.png" alt="SHAP Summary Plot del modelo de Player Impact Score" caption="Beeswarm plot mostrando la contribución de cada feature al impact score predicho." />
          </div>
        </div>
      </Section>

      {/* Section 3: Clustering — K-Means vs HDBSCAN */}
      <Section title="Paso 3 — Clustering de Jugadores: K-Means vs HDBSCAN" icon={<Layers className="w-5 h-5 text-purple-400" />} color="purple-400">
        <div className="space-y-6">

          {/* Intro */}
          <div className="bg-gradient-to-r from-purple-500/5 to-cyan-500/5 border border-white/10 rounded-xl p-5">
            <p className="text-base text-gray-300 leading-relaxed">
              El clustering agrupa jugadores que <em>juegan de forma similar</em> según 10 estadísticas reales per-90.
              Ejecutamos <strong className="text-white">dos algoritmos diferentes</strong> sobre los mismos datos para comparar
              sus resultados. Ambos usan las mismas 10 features y el mismo preprocesamiento (StandardScaler).
            </p>
          </div>

          {/* Shared pipeline */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Pipeline compartido</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 mb-3 font-mono text-sm text-gray-300 space-y-1">
              <p><span className="text-green-400">INPUT:</span> 1,111 jugadores × 10 features per-90</p>
              <p><span className="text-purple-300">PREPROCESO:</span> StandardScaler(mean=0, std=1)</p>
              <p><span className="text-amber-300">ALG A:</span> K-Means(k=5, n_init=15)</p>
              <p><span className="text-cyan-300">ALG B:</span> HDBSCAN(min_cluster_size=30, min_samples=10)</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { f: "goals_per_90", desc: "Goles" }, { f: "assists_per_90", desc: "Asistencias" },
                { f: "shots_per_90", desc: "Tiros al arco" }, { f: "sot_per_90", desc: "Tiros a puerta" },
                { f: "tackles_won_per_90", desc: "Entradas ganadas" }, { f: "interceptions_per_90", desc: "Intercepciones" },
                { f: "crosses_per_90", desc: "Centros" }, { f: "fouls_committed_per_90", desc: "Faltas cometidas" },
                { f: "fouls_drawn_per_90", desc: "Faltas recibidas" }, { f: "offsides_per_90", desc: "Fueras de juego" },
              ].map(({ f, desc }) => (
                <div key={f} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-purple-300 shrink-0">{f}</span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side-by-side algorithm cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-amber-500/20">
              <h4 className="text-sm font-bold text-amber-300 mb-2">🟡 K-Means</h4>
              <div className="space-y-1 text-xs text-gray-300">
                <p>1. Elige k=5 centroides al azar</p>
                <p>2. Asigna cada jugador al más cercano</p>
                <p>3. Recalcula centroides como promedio</p>
                <p>4. Repite hasta convergencia</p>
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-[11px] text-green-400">✓ 100% jugadores clasificados</p>
                <p className="text-[11px] text-green-400">✓ Centroides interpretables</p>
                <p className="text-[11px] text-red-400">✗ Requiere elegir k</p>
                <p className="text-[11px] text-red-400">✗ Fuerza outliers en un cluster</p>
              </div>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-cyan-500/20">
              <h4 className="text-sm font-bold text-cyan-300 mb-2">🔵 HDBSCAN</h4>
              <div className="space-y-1 text-xs text-gray-300">
                <p>1. Calcula densidad local (core distance)</p>
                <p>2. Construye grafo de alcanzabilidad mutua</p>
                <p>3. Genera dendrograma condensado</p>
                <p>4. Selecciona clusters por estabilidad</p>
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-[11px] text-green-400">✓ No requiere elegir k</p>
                <p className="text-[11px] text-green-400">✓ Detecta outliers explícitamente</p>
                <p className="text-[11px] text-red-400">✗ 68% queda como ruido</p>
                <p className="text-[11px] text-red-400">✗ Sensible a min_cluster_size</p>
              </div>
            </div>
          </div>

          {/* Full comparison component with metrics */}
          <ClusteringComparison />

          {/* K-Means cluster results */}
          <div className="bg-black/40 rounded-lg p-4 border border-amber-500/20">
            <h4 className="text-sm font-bold text-amber-300 mb-3">Resultado K-Means: 5 perfiles</h4>
            <div className="space-y-3">
              {clusterAverages && Object.entries(CLUSTER_NAMES).map(([id, name]) => {
                const avg = clusterAverages[id] || {};
                return (
                  <div key={id} className="bg-black/60 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: CLUSTER_COLORS[id] }} />
                      <span className="text-sm font-bold text-white">{name}</span>
                      <span className="text-xs text-gray-500">(Cluster {id})</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      {avg.pace != null && <span>Ritmo: <strong className="text-white">{avg.pace}</strong></span>}
                      {avg.shooting != null && <span>Tiro: <strong className="text-white">{avg.shooting}</strong></span>}
                      {avg.passing != null && <span>Pase: <strong className="text-white">{avg.passing}</strong></span>}
                      {avg.defending != null && <span>Defensa: <strong className="text-white">{avg.defending}</strong></span>}
                      {avg.physical != null && <span>Físico: <strong className="text-white">{avg.physical}</strong></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PCA Scatter */}
          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-amber-300 mb-2">📊 Scatter PCA — K-Means (5 clusters, 0% ruido)</h4>
            <ClusterScatterChart />
          </div>

          {/* HDBSCAN Scatter */}
          <div className="bg-black/40 rounded-lg p-4 border border-cyan-500/20">
            <h4 className="text-sm font-bold text-cyan-300 mb-2">📊 Scatter PCA — HDBSCAN (clusters por densidad, ~68% ruido)</h4>
            <HdbscanScatterChart />
          </div>

          {/* Training plots K-Means */}
          <div className="bg-black/40 rounded-lg p-4 border border-amber-500/20">
            <h4 className="text-sm font-bold text-amber-300 mb-2">📸 Plots del entrenamiento K-Means</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModelPlot src="player_clusters_pca.png" alt="K-Means PCA" caption="PCA(n_components=2). Colores = 5 perfiles." />
              <ModelPlot src="player_clusters_tsne.png" alt="K-Means t-SNE" caption="t-SNE(perplexity=30). Vecindades locales." />
            </div>
          </div>

          {/* Training plots HDBSCAN */}
          <div className="bg-black/40 rounded-lg p-4 border border-cyan-500/20">
            <h4 className="text-sm font-bold text-cyan-300 mb-2">📸 Plots del entrenamiento HDBSCAN</h4>
            <p className="text-xs text-gray-400 mb-3">
              Generados por <code className="text-cyan-300">generate_hdbscan_plots.py</code> sobre los mismos 1,111 jugadores con la misma proyección PCA.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-gray-300 mb-2">PCA — HDBSCAN (clusters + ruido)</p>
                <ModelPlot src="hdbscan_clusters_pca.png" alt="HDBSCAN PCA scatter" caption="Gris = ruido (68%). Color = clusters de alta densidad." />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-300 mb-2">Membership Probability</p>
                <ModelPlot src="hdbscan_membership_proba.png" alt="HDBSCAN membership probabilities" caption="Distribución de confianza de pertenencia." />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-300 mb-2">Comparación directa (misma proyección)</p>
              <ModelPlot src="clustering_comparison_kmeans_vs_hdbscan.png" alt="K-Means vs HDBSCAN side by side" caption="Izq: K-Means asigna todos. Der: HDBSCAN solo clasifica zonas densas." />
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-gradient-to-r from-amber-500/5 to-cyan-500/5 border border-white/10 rounded-xl p-5">
            <h4 className="text-sm font-bold text-white mb-2">🎯 ¿Cuál usar? Y ¿por qué HDBSCAN tiene 68% ruido?</h4>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="bg-black/40 rounded-lg p-3 border border-cyan-500/20">
                <p className="font-bold text-cyan-300 mb-1">¿El 68% ruido significa que HDBSCAN está mal?</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <strong className="text-white">No.</strong> HDBSCAN está dando la respuesta científicamente honesta:
                  los jugadores de fútbol <em>no forman grupos discretos por densidad</em>. El espacio de features es un <strong className="text-white">continuo</strong> —
                  un mediocampista ofensivo tiene estadísticas que transicionan suavemente hacia las de un delantero.
                  No hay "vacíos" de densidad entre perfiles como los habría entre, por ejemplo, tipos de flores (Iris) o dígitos escritos (MNIST).
                </p>
                <p className="text-xs text-gray-400 leading-relaxed mt-2">
                  Los ~350 jugadores que HDBSCAN <em>sí</em> clasifica son los <strong className="text-white">arquetipos extremos</strong>: goleadores puros,
                  destructores puros, carrileros puros. El 68% restante son <strong className="text-white">jugadores polivalentes</strong> que mezclan
                  características de múltiples perfiles — HDBSCAN correctamente dice "este jugador no pertenece claramente a ningún grupo denso".
                </p>
              </div>
              <div className="bg-black/40 rounded-lg p-3 border border-amber-500/20">
                <p className="font-bold text-amber-300 mb-1">¿Por qué K-Means no tiene este problema?</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Porque K-Means <strong className="text-white">fuerza</strong> una asignación. Usa distancia al centroide, no densidad.
                  Siempre asigna cada punto al cluster más cercano, aunque esté en una zona de transición.
                  Es como recortar un gradiente de color en 5 franjas fijas — cada píxel queda en una franja, aunque esté en el borde entre dos.
                </p>
              </div>
              <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                <p className="font-bold text-white mb-1">Conclusión para el estudiante:</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Este dataset demuestra un caso real donde <strong className="text-white">K-Means es más útil operacionalmente</strong> (necesitamos
                  clasificar a todos) pero <strong className="text-white">HDBSCAN es más honesto científicamente</strong> (revela que la estructura
                  natural de los datos es continua, no discreta). En la literatura esto se llama un dominio con
                  <em> "cluster structure"</em> débil — y es exactamente lo que uno esperaría de datos deportivos donde los jugadores son multifuncionales.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 4: xG Overperformance */}
      <Section title="Paso 4 — ¿Qué es xG Overperformance?" icon={<BarChart3 className="w-5 h-5 text-yellow-400" />} color="yellow-400">
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El xG (Expected Goals) es un <strong className="text-white">modelo estadístico creado por StatsBomb</strong> que asigna a cada tiro 
            una probabilidad de gol basada en: distancia al arco, ángulo, parte del cuerpo, tipo de jugada, etc.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
            <h4 className="text-sm font-bold text-yellow-300 mb-3">Cálculo</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 mb-3 font-mono text-sm">
              <p className="text-yellow-300">xG_overperformance = Goles_reales - xG_acumulado</p>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p><strong className="text-green-400">Positivo (+):</strong> El jugador mete MÁS goles de los que estadísticamente debería. Es un finalizador excepcional — su habilidad supera la calidad promedio de sus oportunidades.</p>
              <p><strong className="text-red-400">Negativo (-):</strong> El jugador mete MENOS de lo esperado. Desperdicia oportunidades claras o tiene mala suerte recurrente.</p>
              <p><strong className="text-gray-400">≈ 0:</strong> Convierte exactamente lo que se espera dada la calidad de sus tiros. Es el resultado promedio.</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Ejemplo didáctico</h4>
            <div className="space-y-2 text-sm text-gray-300">
              <p>Imaginá que un jugador tira 50 veces en la temporada. El modelo xG analiza cada tiro y dice:</p>
              <p className="text-gray-400 italic">"Dada la posición y contexto de estos 50 tiros, un jugador promedio convertiría 8.2 goles."</p>
              <p>Si el jugador metió <strong className="text-green-400">11 goles</strong> → xG Overperf = +2.8 (es mejor que el promedio)</p>
              <p>Si el jugador metió <strong className="text-red-400">5 goles</strong> → xG Overperf = -3.2 (peor que el promedio)</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">⚠️ Nota importante</h4>
            <p className="text-sm text-gray-400">
              <strong className="text-white">No es un modelo nuestro</strong> — es una feature calculada directamente restando dos columnas de FBref. 
              El modelo de xG subyacente es de StatsBomb (empresa de analytics deportivo que provee datos a FBref). 
              Nosotros simplemente usamos el resultado como una variable más en el dashboard.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 5: Scoring System */}
      <Section title="Paso 5 — Sistema de Estrellas: Moneyball Scoring" icon={<Brain className="w-5 h-5 text-green-400" />} color="green-400">
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El Panel de Decisión asigna estrellas con un enfoque <strong className="text-white">Moneyball</strong>:
            no busca a los jugadores más famosos, sino a los que <strong className="text-white">rinden por encima de su "precio"</strong>.
            Un jugador con Overall 73 que aporta como uno de 82 es más interesante para un DT con presupuesto limitado
            que una estrella mundial lesionable de 35 años.
          </p>

          {/* Algorithm overview */}
          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">Algoritmo: Weighted Percentile Rank + Value Adjustment</h4>
            <div className="space-y-3 text-sm text-gray-300">
              <p><strong className="text-white">¿Por qué percentile rank?</strong> Cada métrica tiene escalas distintas
                (Overall va de 47 a 93, Impact de -11 a +14, Lesiones/año de 0 a 7).
                El percentile rank normaliza todo a [0, 1] basándose en la posición real del jugador
                dentro de la distribución empírica del dataset (N=1,257). No hay umbrales inventados:
                cada breakpoint es un cuantil calculado con <code className="text-green-300">df[col].quantile(p)</code>.</p>
              <p><strong className="text-white">¿Qué es el Value Adjustment?</strong> Es el componente Moneyball.
                Mide la diferencia entre el rango de impacto real y el rango de overall:
                <code className="text-green-300">value_bonus = rank_impact - rank_overall</code>.
                Si es positivo, el jugador "rinde más de lo que cuesta". Si es negativo, "cuesta más de lo que rinde".</p>
            </div>
          </div>

          {/* Formula */}
          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">Fórmula completa</h4>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 mb-4 font-mono text-sm space-y-3">
              <div>
                <p className="text-gray-500 text-xs mb-1">// Paso 1: Calcular calidad base (promedio ponderado de ranks)</p>
                <p className="text-blue-300">base_quality = 0.30 × rank_overall</p>
                <p className="text-purple-300 pl-14">+ 0.30 × rank_impact</p>
                <p className="text-red-300 pl-14">+ 0.05 × rank_availability</p>
                <p className="text-yellow-300 pl-14">+ 0.35 × rank_xg <span className="text-gray-600">(solo FW, 0.5 para otros)</span></p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">// Paso 2: Calcular bonus Moneyball</p>
                <p className="text-green-300">value_bonus = rank_impact - rank_overall</p>
                <p className="text-gray-500 text-xs">// Positivo → ganga | Negativo → sobrevalorado</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">// Paso 3: Score final con ajuste ±20%</p>
                <p className="text-white">moneyball_score = base_quality × (1 + 0.15 × clip(value_bonus, -1, 1))</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">// Paso 4: Normalizar con min/max empíricos del dataset</p>
                <p className="text-gray-300">normalized = (score - 0.1200) / (0.9448 - 0.1200)</p>
              </div>
            </div>
          </div>

          {/* Weights justification */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Justificación de pesos (base_quality)</h4>
            <p className="text-xs text-gray-400 mb-3">
              Los pesos reflejan la prioridad Moneyball: producción real pesa igual que calidad técnica.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-black/60 rounded-lg p-3 border border-blue-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-blue-300">Overall</span>
                  <span className="text-lg font-bold text-white">30%</span>
                </div>
                <p className="text-xs text-gray-400">Validado: coef. LR promedio ~31%. Piso de calidad técnica para competir en un Mundial.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-purple-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-purple-300">Impact</span>
                  <span className="text-lg font-bold text-white">30%</span>
                </div>
                <p className="text-xs text-gray-400">Validado: coef. LR promedio ~29%. Producción real medida en campo. Principal predictor de eficiencia (AUC=0.80 para target "is_efficient").</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-yellow-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-yellow-300">xG Overperf</span>
                  <span className="text-lg font-bold text-white">35%</span>
                </div>
                <p className="text-xs text-gray-400">Validado: coef. LR promedio ~39%. El predictor más fuerte de contribución goleadora. Solo para FW (N=354), neutro (0.5) para el resto.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-red-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-red-300">Disponibilidad</span>
                  <span className="text-lg font-bold text-white">5%</span>
                </div>
                <p className="text-xs text-gray-400">Validado: coef. LR = 0% (correlación inversa). Se mantiene al 5% porque en un torneo de 7 semanas con partidos cada 3 días, la disponibilidad importa más que en una temporada larga.</p>
              </div>
            </div>
          </div>

          {/* Value bonus */}
          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">El componente Moneyball: value_bonus</h4>
            <p className="text-sm text-gray-300 mb-3">
              Mide <strong className="text-white">cuánto rinde un jugador relativo a lo que su overall "promete"</strong>:
            </p>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs mb-3 space-y-1">
              <p className="text-green-400">value_bonus = rank_impact - rank_overall</p>
              <p></p>
              <p className="text-green-300">+0.40 → Está en P90 de impact pero P50 de overall → GANGA</p>
              <p className="text-red-300">-0.30 → Está en P60 de impact pero P90 de overall → SOBREVALORADO</p>
            </div>
            <p className="text-xs text-gray-400">
              El factor <strong className="text-white">0.20</strong> limita el ajuste al ±20%, evitando que jugadores de overall 50 con alto impact queden en 5★.
            </p>
          </div>

          {/* Percentile breakpoints */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Breakpoints percentiles del dataset (N=1,257)</h4>
            <p className="text-xs text-gray-400 mb-3">
              Cada métrica se convierte a rango [0,1] interpolando linealmente entre estos puntos de la CDF empírica.
              Generados con <code className="text-green-300">df[col].quantile(p)</code> en intervalos de 5%.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-gray-400 font-normal">Percentil</th>
                    <th className="text-right py-2 text-blue-300">Overall</th>
                    <th className="text-right py-2 text-purple-300">Impact</th>
                    <th className="text-right py-2 text-red-300">Inj/año</th>
                    <th className="text-right py-2 text-yellow-300">xG (FW)</th>
                    <th className="text-right py-2 text-cyan-300">Edad</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5"><td className="py-1 text-gray-500">P5</td><td className="text-right">59</td><td className="text-right">-2.93</td><td className="text-right">0.07</td><td className="text-right">-4.59</td><td className="text-right">21.3</td></tr>
                  <tr className="border-b border-white/5"><td className="py-1 text-gray-500">P25</td><td className="text-right">66</td><td className="text-right">-1.08</td><td className="text-right">0.17</td><td className="text-right">-0.54</td><td className="text-right">24.9</td></tr>
                  <tr className="border-b border-white/5 font-bold text-white"><td className="py-1 text-gray-400">P50</td><td className="text-right">71</td><td className="text-right">-0.04</td><td className="text-right">0.49</td><td className="text-right">0.06</td><td className="text-right">27.7</td></tr>
                  <tr className="border-b border-white/5"><td className="py-1 text-gray-500">P75</td><td className="text-right">76</td><td className="text-right">1.06</td><td className="text-right">0.98</td><td className="text-right">0.44</td><td className="text-right">30.6</td></tr>
                  <tr className="border-b border-white/5"><td className="py-1 text-gray-500">P90</td><td className="text-right">80</td><td className="text-right">2.10</td><td className="text-right">1.51</td><td className="text-right">2.92</td><td className="text-right">33.8</td></tr>
                  <tr><td className="py-1 text-gray-500">P95</td><td className="text-right">83</td><td className="text-right">2.80</td><td className="text-right">2.04</td><td className="text-right">5.16</td><td className="text-right">35.2</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Star thresholds */}
          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">Asignación de estrellas (cuantiles del score normalizado)</h4>
            <p className="text-xs text-gray-400 mb-3">
              Los cortes provienen de los cuantiles de la distribución del moneyball_score normalizado en todo el dataset.
              Distribución resultante: 5★=5%, 4★=15%, 3★=30%, 2★=30%, 1★=20%.
            </p>
            <div className="space-y-2">
              {[
                { stars: "⭐⭐⭐⭐⭐", label: "Altamente Recomendado", threshold: "≥ 0.7672", pct: "5%", color: "text-green-400", desc: "Alta calidad + alta eficiencia goleadora + disponible." },
                { stars: "⭐⭐⭐⭐", label: "Recomendado", threshold: "≥ 0.6244", pct: "15%", color: "text-green-300", desc: "Buen valor. Contribuye significativamente con riesgo aceptable." },
                { stars: "⭐⭐⭐", label: "Opción Viable", threshold: "≥ 0.4558", pct: "30%", color: "text-yellow-400", desc: "Competitivo sin factores diferenciadores claros." },
                { stars: "⭐⭐", label: "Con Reservas", threshold: "≥ 0.2959", pct: "30%", color: "text-orange-400", desc: "Riesgos superan las ventajas o está sobrevalorado." },
                { stars: "⭐", label: "No Recomendado", threshold: "< 0.2959", pct: "20%", color: "text-red-400", desc: "Nivel insuficiente o severamente sobrevalorado." },
              ].map((tier) => (
                <div key={tier.label} className="flex items-center gap-3 bg-black/60 rounded-lg p-2.5 border border-white/5">
                  <span className="text-sm w-20 shrink-0">{tier.stars}</span>
                  <span className={`text-xs font-bold w-36 shrink-0 ${tier.color}`}>{tier.label}</span>
                  <span className="text-xs text-gray-400 font-mono w-16 shrink-0">{tier.threshold}</span>
                  <span className="text-xs text-gray-500 w-8 shrink-0">{tier.pct}</span>
                  <span className="text-xs text-gray-400 flex-1">{tier.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Examples */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Ejemplos: ¿Cómo se leen las estrellas?</h4>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="bg-black/60 rounded-lg p-3 border border-green-500/10">
                <p className="font-bold text-green-400 mb-1">Haaland (5★) — Máxima eficiencia goleadora + calidad</p>
                <p className="text-xs text-gray-400">Overall P95, xG +5.36 (P95 finalizador), Impact top 25%, 25 años. El tipo de jugador que el sistema premia: calidad probada + eficiencia medible.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-green-500/10">
                <p className="font-bold text-green-300 mb-1">Mbappé (4★) — Élite pero xG negativo</p>
                <p className="text-xs text-gray-400">Overall P99, Impact P97 (3.40). Pero xG de -2.16 lo arrastra — subconvierte oportunidades relativo a lo esperado. El sistema de xG estadístico dice que debería meter más goles de los que mete.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-yellow-500/10">
                <p className="font-bold text-yellow-400 mb-1">Messi (3★) — No es "ganga" para un Mundial</p>
                <p className="text-xs text-gray-400">Overall P99 pero xG -2.80, 2.05 lesiones/año, 39 años. Para un torneo de 7 semanas no es el perfil que busca Moneyball: alto riesgo de no poder jugar cada 3 días.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-orange-500/10">
                <p className="font-bold text-orange-400 mb-1">Vinicius Jr (2★) — Sobrevalorado en datos</p>
                <p className="text-xs text-gray-400">Overall P90 pero Impact negativo (-0.64) y xG -4.36. El sistema detecta la brecha entre reputación y producción medida estadísticamente.</p>
              </div>
            </div>
          </div>

          {/* Method comparison */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">¿Por qué este método y no reglas if/else?</h4>
            <p className="text-sm text-gray-300 mb-3">Se evaluaron 3 enfoques con el dataset completo:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs mb-3">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-gray-400 font-normal">Método</th>
                    <th className="text-center py-2 text-gray-400 font-normal">Dist. 5★/1★</th>
                    <th className="text-center py-2 text-gray-400 font-normal">Captura gangas</th>
                    <th className="text-center py-2 text-gray-400 font-normal">Reproducible</th>
                    <th className="text-center py-2 text-gray-400 font-normal">Problema</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-1.5">Reglas if/else originales</td>
                    <td className="text-center">0.1% / 40%</td>
                    <td className="text-center text-red-400">No</td>
                    <td className="text-center text-red-400">No</td>
                    <td className="text-center text-xs text-gray-500">80% en 1-2★, umbrales arbitrarios</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-1.5">Percentile puro (sin value adj)</td>
                    <td className="text-center">5% / 20%</td>
                    <td className="text-center text-yellow-400">Parcial</td>
                    <td className="text-center text-green-400">Sí</td>
                    <td className="text-center text-xs text-gray-500">No diferencia valor vs costo</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-bold text-green-300">Moneyball (actual)</td>
                    <td className="text-center">5% / 20%</td>
                    <td className="text-center text-green-400">Sí</td>
                    <td className="text-center text-green-400">Sí</td>
                    <td className="text-center text-xs text-gray-500">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-200">Correlación:</strong> Original↔Moneyball: 0.67 | Percentile↔Moneyball: 0.88.
              El Moneyball diverge del original porque reordena jugadores según valor relativo, no solo calidad absoluta.
            </p>
          </div>

          {/* Validation against real data */}
          <div className="bg-black/40 rounded-lg p-4 border border-green-500/30">
            <h4 className="text-sm font-bold text-green-300 mb-3">✅ Validación contra datos reales de rendimiento</h4>
            <p className="text-sm text-gray-300 mb-3">
              Los pesos fueron optimizados usando <strong className="text-white">Regresión Logística</strong> contra el rendimiento real
              de 1,225 jugadores en <code className="text-green-300">all_competitions_stats_standard.csv</code>.
            </p>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 mb-3">
              <p className="text-xs font-bold text-gray-200 mb-2">Targets de validación:</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p><span className="text-blue-300 font-mono">is_starter</span> — jugó ≥P75 de minutos en la temporada (el DT lo pone de titular)</p>
                <p><span className="text-purple-300 font-mono">is_efficient</span> — top 25% en G+A por 90 min (contribuye goles/asistencias)</p>
                <p><span className="text-green-300 font-mono">is_valuable</span> — starter AND eficiente (juega mucho Y contribuye)</p>
              </div>
            </div>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 mb-3">
              <p className="text-xs font-bold text-gray-200 mb-2">Resultados de validación (AUC ROC, 5-fold CV):</p>
              <div className="space-y-1 text-xs font-mono text-gray-300">
                <p>Target "is_efficient": <span className="text-green-400 font-bold">AUC = 0.800 ± 0.049</span></p>
                <p>Target "is_starter":   <span className="text-yellow-400">AUC = 0.614 ± 0.035</span></p>
                <p>Target "is_valuable":  <span className="text-yellow-400">AUC = 0.612 ± 0.025</span></p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                El AUC de 0.80 para eficiencia es excelente — el sistema predice correctamente quién contribuirá goles y asistencias.
                El AUC de 0.61 para "starter" es más bajo porque ser titular depende de factores no medibles (decisiones tácticas, posición, lesiones de compañeros).
              </p>
            </div>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5">
              <p className="text-xs font-bold text-gray-200 mb-2">Hallazgo clave: Disponibilidad no predice rendimiento</p>
              <p className="text-xs text-gray-400">
                La regresión logística asignó <strong className="text-white">coeficiente negativo</strong> a <code className="text-red-300">rank_availability</code>
                en todos los targets. Esto significa que jugadores con más lesiones tienden a ser los que MÁS juegan (porque son titulares con carreras largas
                y mayor exposición al riesgo). El peso se redujo de 15% a 5% basado en este hallazgo, manteniendo un mínimo por contexto de torneo corto.
              </p>
            </div>
          </div>

          {/* Country context */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Contexto adaptativo (filtro por país)</h4>
            <p className="text-sm text-gray-300 mb-2">
              Cuando se filtra por país, el sistema detecta jugadores que "rinden por encima de su nivel técnico"
              usando el mismo value_bonus. Si value_bonus &gt; 0.15 y el jugador está cerca del borde de un tier, sube un nivel.
            </p>
            <p className="text-xs text-gray-400">
              Esto captura la esencia Moneyball para selecciones menores: un jugador con overall 72 pero impact en el P85
              es una "ganga" que un DT con pool limitado debería priorizar.
            </p>
          </div>

          {/* Reproducibility */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Reproducibilidad</h4>
            <p className="text-sm text-gray-300 mb-2">
              Todos los breakpoints y thresholds fueron generados por scripts de Python ejecutables:
            </p>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-400 space-y-1">
              <p><span className="text-green-300">validate_moneyball.py</span> — Regresión logística contra rendimiento real + optimización de pesos (N=1,225)</p>
              <p><span className="text-green-300">evaluate_scoring.py</span> — Comparación de 3 métodos + verificación con jugadores conocidos</p>
              <p><span className="text-green-300">recompute_thresholds.py</span> — Min/max y star thresholds con pesos validados</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Si el dataset se actualiza, re-ejecutar estos scripts regenera todos los parámetros. No hay ningún número "a mano".
            </p>
          </div>
        </div>
      </Section>

      {/* Section: Player Impact Comparison */}
      <Section title="Comparación de Algoritmos — Impact Score: XGBoost vs Random Forest" icon={<GitCompare className="w-5 h-5 text-green-400" />} color="green-400">
        <RegressionComparison
          endpoint="player-impact"
          title="Player Impact Score — XGBoost vs Random Forest"
        />
      </Section>
    </div>
  );
}
