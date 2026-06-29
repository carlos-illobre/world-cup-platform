import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Brain, Target, Layers, BarChart3 } from "lucide-react";
import { CLUSTER_NAMES, CLUSTER_COLORS } from "../constants";
import { fetchJson } from "@/shared/lib/apiClient";

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
        </div>
      </Section>

      {/* Section 3: Clustering */}
      <Section title="Paso 3 — ¿Cómo se agrupan los jugadores por estilo? (K-Means)" icon={<Layers className="w-5 h-5 text-purple-400" />} color="purple-400">
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El algoritmo <strong className="text-white">K-Means</strong> agrupa jugadores que <em>juegan de forma similar</em> según sus estadísticas reales, 
            sin importar su posición nominal. Un mediocampista ofensivo puede quedar en el mismo cluster que un delantero 
            si ambos generan goles y asistencias a tasas similares.
          </p>

          {/* Conceptual diagram */}
          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">¿Cómo funciona K-Means? (en simple)</h4>
            <div className="space-y-2 text-sm text-gray-300">
              <p>1️⃣ <strong className="text-white">Se eligen 5 puntos al azar</strong> como "centroides" iniciales en el espacio de 10 dimensiones.</p>
              <p>2️⃣ <strong className="text-white">Cada jugador se asigna</strong> al centroide más cercano (por distancia euclidiana).</p>
              <p>3️⃣ <strong className="text-white">Se recalcula cada centroide</strong> como el promedio de todos los jugadores asignados a él.</p>
              <p>4️⃣ <strong className="text-white">Se repiten pasos 2-3</strong> hasta que los centroides no se mueven (convergencia). Máximo 300 iteraciones.</p>
              <p>5️⃣ <strong className="text-white">Se repite TODO 15 veces</strong> (n_init=15) con diferentes puntos iniciales y se queda con la mejor solución (menor inertia).</p>
            </div>
          </div>

          {/* Input features */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Features de entrada (10 estadísticas per 90 min)</h4>
            <p className="text-xs text-gray-400 mb-3">Todas normalizadas con StandardScaler (media=0, std=1) antes de entrenar — imprescindible para K-Means porque usa distancia euclidiana.</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { f: "goals_per_90", desc: "Goles cada 90 min" },
                { f: "assists_per_90", desc: "Asistencias cada 90 min" },
                { f: "shots_per_90", desc: "Tiros al arco cada 90 min" },
                { f: "sot_per_90", desc: "Tiros a puerta cada 90 min" },
                { f: "tackles_won_per_90", desc: "Entradas ganadas cada 90 min" },
                { f: "interceptions_per_90", desc: "Intercepciones cada 90 min" },
                { f: "crosses_per_90", desc: "Centros cada 90 min" },
                { f: "fouls_committed_per_90", desc: "Faltas cometidas cada 90 min" },
                { f: "fouls_drawn_per_90", desc: "Faltas recibidas cada 90 min" },
                { f: "offsides_per_90", desc: "Fueras de juego cada 90 min" },
              ].map(({ f, desc }) => (
                <div key={f} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-purple-300 shrink-0">{f}</span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              <strong>¿Por qué per 90?</strong> Para no penalizar a suplentes que juegan menos minutos. Un jugador que mete 5 goles en 500 minutos 
              es más eficiente que uno que mete 10 en 3000. Per 90 normaliza por tiempo de juego.
            </p>
          </div>

          {/* Evaluation */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Métricas de evaluación del clustering</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">Silhouette Score</p>
                <p className="text-xl font-bold text-purple-400">0.312</p>
                <p className="text-xs text-gray-500 mt-1">Rango: -1 a 1. Mayor = mejor separación.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">Inertia (WCSS)</p>
                <p className="text-xl font-bold text-gray-300">4,891</p>
                <p className="text-xs text-gray-500 mt-1">Suma de distancias² al centroide</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">k elegido</p>
                <p className="text-xl font-bold text-white">5</p>
                <p className="text-xs text-gray-500 mt-1">Método: Elbow + Silhouette</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-gray-200">¿0.312 es bueno?</strong> Para datos deportivos de alta dimensión con solapamiento natural entre posiciones, sí. 
              Un mediocampista ofensivo puede estar entre "Creador" y "Extremo" — ese solapamiento es inherente al dominio y no un defecto del modelo. 
              Un Silhouette de 0.7+ solo se obtiene con datos sintéticos o dominios con separación perfecta.
            </p>
          </div>

          {/* Cluster results */}
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Resultado: Los 5 perfiles descubiertos</h4>
            <p className="text-xs text-gray-400 mb-3">Los nombres fueron asignados manualmente interpretando qué features dominan en cada centroide:</p>
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

      {/* Section 5: How to interpret */}
      <Section title="Paso 5 — ¿Cómo se conecta todo en el Panel de Decisión?" icon={<Brain className="w-5 h-5 text-green-400" />} color="green-400">
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El Panel de Decisión (la pestaña de la izquierda) combina los tres modelos/features en un <strong className="text-white">sistema de recomendación por reglas</strong> que asigna estrellas y veredictos.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-green-500/20">
            <h4 className="text-sm font-bold text-green-300 mb-3">Lógica del veredicto (sin ML — basado en reglas)</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-300 space-y-1 mb-3">
              <p className="text-gray-500">// Pseudocódigo del cálculo de recomendación</p>
              <p>score = 0</p>
              <p></p>
              <p className="text-blue-300">// Factor 1: Nivel absoluto (Overall FIFA)</p>
              <p>if overall &gt;= 84: score += 3  <span className="text-gray-600">// Élite mundial</span></p>
              <p>if overall &gt;= 79: score += 2  <span className="text-gray-600">// Selección top</span></p>
              <p>if overall &gt;= 75: score += 1  <span className="text-gray-600">// Internacional</span></p>
              <p>if overall &lt; 70:  score -= 2  <span className="text-gray-600">// Liga menor</span></p>
              <p></p>
              <p className="text-purple-300">// Factor 2: Aporte relativo (Impact Score)</p>
              <p>if impact &gt; 3.5: score += 1-2</p>
              <p></p>
              <p className="text-red-300">// Factor 3: Disponibilidad (Lesiones)</p>
              <p>if lesiones &gt; 10: score -= 2</p>
              <p>if lesiones &lt;= 5:  score += 1</p>
              <p></p>
              <p className="text-yellow-300">// Factor 4: Eficiencia (xG Overperf)</p>
              <p>if xG_overperf &gt; 0.5: score += 1</p>
              <p></p>
              <p className="text-green-300">// Veredicto final</p>
              <p>if score &gt;= 5: "Altamente Recomendado" ⭐⭐⭐⭐⭐</p>
              <p>if score &gt;= 3: "Recomendado" ⭐⭐⭐⭐</p>
              <p>if score &gt;= 1: "Opción Viable" ⭐⭐⭐</p>
              <p>if score &gt;= -1: "Con Reservas" ⭐⭐</p>
              <p>else: "No Recomendado" ⭐</p>
            </div>
            <p className="text-xs text-gray-400">
              <strong className="text-gray-200">¿Por qué reglas y no otro modelo?</strong> Porque el veredicto necesita ser explicable y auditable. 
              Un DT tiene que poder decir "lo recomiendo porque su overall es 86 y tiene pocas lesiones" — no "porque el modelo dijo 0.87". 
              Las reglas son transparentes y ajustables.
            </p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Contexto adaptativo (País)</h4>
            <p className="text-sm text-gray-300">
              Cuando el usuario filtra por un país específico, los umbrales se relajan porque el DT de una selección menor 
              tiene un pool limitado de jugadores. Un Overall de 70 puede ser "excelente" para Cabo Verde pero "insuficiente" 
              en una vista global. El sistema detecta si hay un filtro de país activo y ajusta la evaluación.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
