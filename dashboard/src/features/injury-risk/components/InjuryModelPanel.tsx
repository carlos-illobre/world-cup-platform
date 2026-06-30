import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Brain, Beaker, Activity, AlertTriangle, Thermometer, GitCompare } from "lucide-react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { ModelPlot } from "@/shared/components/ModelPlot";
import { ClassificationComparison } from "@/shared/components/AlgorithmComparison";

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
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

/** Fetches and displays real feature importance from the XGBoost model */
function RealFeatureImportance() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/injuries/model/feature-importance`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex flex-col items-center justify-center py-8 gap-3"><div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" /></div><span className="text-sm text-gray-500">Cargando feature importance del modelo...</span></div>;
  if (!data || !data.items) return <div className="text-sm text-gray-500">No se pudo obtener feature importance del modelo.</div>;

  const maxGain = data.items[0]?.gain || 1;

  return (
    <div className="bg-black/40 rounded-lg p-4 border border-white/5">
      <h4 className="text-sm font-bold text-gray-200 mb-2">Feature Importance (Gain) — Datos reales del modelo cargado</h4>
      <p className="text-xs text-gray-500 mb-3">Extraído en tiempo real de <code className="text-red-300">injury_xgboost_model.pkl</code> via <code className="text-red-300">booster.get_score(importance_type='gain')</code>. Total features usados: {data.total_features}.</p>
      <div className="space-y-1.5">
        {data.items.slice(0, 15).map((item: any) => (
          <div key={item.feature} className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-400 w-48 truncate" title={item.feature}>{item.feature}</span>
            <div className="flex-1 h-5 bg-black/40 rounded overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-red-500/60 to-red-400 rounded" style={{ width: `${(item.gain / maxGain) * 100}%` }} />
            </div>
            <span className="text-xs text-white font-mono w-14 text-right">{item.importance_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fetches and displays risk distribution histogram */
function RiskDistribution() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/injuries/model/distribution`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex flex-col items-center justify-center py-8 gap-3"><div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-1/2" /></div><span className="text-sm text-gray-500">Calculando distribución de riesgo para ~200 jugadores...</span></div>;
  if (!data || !data.histogram) return <div className="text-sm text-gray-500">No se pudo calcular la distribución.</div>;

  const maxCount = Math.max(...data.histogram.map((b: any) => b.count), 1);

  return (
    <div className="bg-black/40 rounded-lg p-4 border border-white/5">
      <h4 className="text-sm font-bold text-gray-200 mb-2">Distribución de Riesgo Predicho — {data.stats.total_players} jugadores</h4>
      <p className="text-xs text-gray-500 mb-3">
        Histograma generado ejecutando <code className="text-red-300">predict_proba()</code> para cada jugador del dataset. 
        Media: <strong className="text-white">{data.stats.mean}%</strong>, Mediana: <strong className="text-white">{data.stats.median}%</strong>, Std: {data.stats.std}%.
      </p>
      <div className="relative h-40 flex items-end gap-1.5 px-2">
        {data.histogram.map((bucket: any) => {
          const heightPx = maxCount > 0 ? Math.max((bucket.count / maxCount) * 140, bucket.count > 0 ? 8 : 0) : 0;
          const color = bucket.min >= 70 ? "bg-red-500" : bucket.min >= 30 ? "bg-yellow-500" : "bg-green-500";
          return (
            <div key={bucket.bucket} className="flex-1 flex flex-col items-center justify-end h-full">
              {bucket.count > 0 && <span className="text-xs text-gray-300 mb-1 font-mono">{bucket.count}</span>}
              <div className={`w-full rounded-t ${color} transition-all`} style={{ height: `${heightPx}px` }} title={`${bucket.bucket}: ${bucket.count} jugadores`} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 px-2 mt-1">
        {data.histogram.map((bucket: any) => (
          <div key={bucket.bucket + "-label"} className="flex-1 text-center">
            <span className="text-[11px] text-gray-400">{bucket.min}%</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500 px-2">
        <span>← Bajo riesgo</span>
        <span>Alto riesgo →</span>
      </div>
    </div>
  );
}

/**
 * Technical panel for Data Science students explaining how the Injury Risk
 * prediction system works — data sources, feature engineering, model details.
 */
export function InjuryModelPanel() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Intro */}
      <div className="bg-gradient-to-r from-red-500/5 to-yellow-500/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-display font-bold text-white mb-3">🔬 Sistema de Predicción de Lesiones — Documentación Técnica</h2>
        <p className="text-base text-gray-300 leading-relaxed mb-4">
          Este sistema predice la <strong className="text-white">probabilidad de que un jugador se lesione</strong> usando un modelo XGBoost 
          entrenado con 8,611 registros históricos de lesiones y 123 features por jugador. También estima un perfil fisiológico 
          mediante correlaciones con datos de juego.
        </p>
        <div className="bg-black/40 rounded-lg p-4 border border-white/5">
          <p className="text-sm text-gray-400 font-semibold mb-2">📐 Pipeline del diagnóstico:</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg">Seleccionar Partido</span>
            <span className="text-gray-600">→</span>
            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg">Seleccionar Jugador</span>
            <span className="text-gray-600">→</span>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg">Construir 123 Features</span>
            <span className="text-gray-600">→</span>
            <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-lg">XGBoost predict_proba()</span>
            <span className="text-gray-600">→</span>
            <span className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-lg">+ Modulación Climática</span>
            <span className="text-gray-600">→</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg">Diagnóstico</span>
          </div>
        </div>
      </div>

      {/* Section 1: Data Sources */}
      <Section title="Paso 1 — Datos de entrada: ¿de dónde sale la información de lesiones?" icon={<Database className="w-5 h-5 text-blue-400" />} defaultOpen={true}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo necesita dos tipos de datos: el <strong className="text-white">historial de lesiones</strong> del jugador 
            y sus <strong className="text-white">estadísticas de juego</strong> actuales.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
              <h4 className="text-sm font-bold text-red-300 mb-2">🏥 Historial de Lesiones (Transfermarkt)</h4>
              <p className="text-sm text-gray-400 mb-2">8,611 registros de lesiones para 1,186 jugadores. Cada registro es una lesión individual con:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li><strong className="text-white">Tipo_Lesion:</strong> Diagnóstico (ej: "Hamstring Strain", "ACL Tear")</li>
                <li><strong className="text-white">Dias_Baja:</strong> Cuántos días estuvo fuera</li>
                <li><strong className="text-white">Partidos_Perdidos:</strong> Partidos no jugados</li>
                <li><strong className="text-white">Desde / Hasta:</strong> Fechas exactas de la baja</li>
              </ul>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
              <h4 className="text-sm font-bold text-blue-300 mb-2">📊 Estadísticas de Juego (FBref)</h4>
              <p className="text-sm text-gray-400 mb-2">~100 columnas de rendimiento real por jugador:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Minutos jugados, partidos titulares, partidos como suplente</li>
                <li>Goles, asistencias, tiros, entradas (per 90 y totales)</li>
                <li>PPM del equipo, diferencial On/Off</li>
                <li>Estadísticas de Copa del Mundo + todas las competiciones</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Feature Engineering */}
      <Section title="Paso 2 — Feature Engineering: ¿cómo se transforman los datos crudos en features?" icon={<Beaker className="w-5 h-5 text-purple-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo usa <strong className="text-white">123 features</strong>. Las más importantes son las que se calculan 
            iterativamente por jugador respetando el orden cronológico (para evitar data leakage):
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">Features de historial (calculadas rolling por jugador)</h4>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">injury_frequency</p>
                <p className="text-gray-400">= (Nº lesiones hasta la fecha) / (días desde primera lesión) × 365.25</p>
                <p className="text-xs text-gray-500 mt-1">Tasa anualizada de lesiones. Un valor de 3.0 = ~3 lesiones por año en promedio.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">days_since_last_injury</p>
                <p className="text-gray-400">= Fecha actual - Fecha de alta de la última lesión (en días)</p>
                <p className="text-xs text-gray-500 mt-1">Si hace poco que se recuperó, el riesgo de recaída es mayor.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">is_recurrent</p>
                <p className="text-gray-400">= 1 si el mismo tipo de lesión ya ocurrió antes, 0 si es nueva</p>
                <p className="text-xs text-gray-500 mt-1">Las lesiones recurrentes tienen mayor probabilidad de reaparecer (Meeuwisse et al., 2007).</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">injury_severity_score</p>
                <p className="text-gray-400">= Mapa de severidad: ACL/fractura → 5, desgarro → 4, muscular → 3, leve → 1</p>
                <p className="text-xs text-gray-500 mt-1">Regla de dominio médico-deportivo. Un historial de lesiones graves predice riesgo futuro.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-purple-300 text-xs mb-1">injury_count_last_12m / total_days_out_last_12m</p>
                <p className="text-gray-400">= Ventana rolling de 12 meses: cuántas lesiones tuvo y cuántos días estuvo fuera</p>
                <p className="text-xs text-gray-500 mt-1">Captura la densidad reciente — más relevante que el historial total.</p>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Features categóricas (encoded)</h4>
            <p className="text-xs text-gray-400 mb-2">4 columnas se convierten a numéricas con LabelEncoder estable (desde encoders.pkl del entrenamiento):</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { col: "Pos", example: "FW, MF, DF, GK" },
                { col: "Country", example: "Argentina, France, ..." },
                { col: "Tipo_Lesion", example: "Hamstring, ACL, Knee, ..." },
                { col: "League", example: "1.eng, 1.esp, 2.ger, ..." },
              ].map(({ col, example }) => (
                <div key={col} className="bg-black/60 rounded-lg p-3 border border-white/5">
                  <p className="text-xs font-mono text-purple-300">{col}</p>
                  <p className="text-xs text-gray-500 mt-1">{example}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">⚠️ Evitar Data Leakage</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Las features de historial se calculan con un loop <code className="text-purple-300">for i, row in group.iterrows()</code> donde 
              solo se miran registros <strong className="text-white">anteriores</strong> al actual (<code className="text-purple-300">past_slice = group.iloc[:i]</code>). 
              Esto garantiza que en el momento de la predicción, el modelo solo ve información disponible en ese punto temporal. 
              Si se usara un simple <code className="text-purple-300">.shift(1)</code> global se mezclarían datos entre jugadores distintos.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 3: XGBoost Model */}
      <Section title="Paso 3 — Modelo XGBoost: ¿cómo predice el riesgo?" icon={<Brain className="w-5 h-5 text-red-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El modelo es un <strong className="text-white">XGBoost Binary Classifier</strong> que predice P(lesión) dados los 123 features.
            La salida es <code className="text-red-300">predict_proba()[0][1]</code> — la probabilidad de la clase positiva (se lesiona).
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
            <h4 className="text-sm font-bold text-red-300 mb-3">Diagrama de inferencia</h4>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
              <p><span className="text-green-400">INPUT:</span> 123 features (stats + injury history + categoricals encoded)</p>
              <p className="text-gray-600">      ↓  [XGBClassifier.predict_proba()]</p>
              <p><span className="text-yellow-400">OUTPUT:</span> probabilidad 0.0 - 1.0</p>
              <p className="text-gray-600">      ↓  [umbrales de decisión]</p>
              <p><span className="text-red-400">DIAGNÓSTICO:</span></p>
              <p>  proba ≤ 0.30 → <span className="text-green-400">HEALTHY</span> (clase 0)</p>
              <p>  0.30 &lt; proba ≤ 0.70 → <span className="text-yellow-400">LOW_RISK</span> (clase 1)</p>
              <p>  proba &gt; 0.70 → <span className="text-red-400">CRITICAL_RISK</span> (clase 2)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Tipo</p>
              <p className="text-base font-bold text-white">Binary Classifier</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Features</p>
              <p className="text-base font-bold text-white">123</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Muestras entrenamiento</p>
              <p className="text-base font-bold text-white">8,611</p>
            </div>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Encoding</p>
              <p className="text-base font-bold text-white">encoders.pkl</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">¿Por qué XGBoost y no otro modelo?</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Maneja NaN nativamente</strong> — muchos jugadores tienen features faltantes y XGBoost aprende la dirección óptima de split para valores ausentes.</li>
              <li><strong className="text-white">Robusto a multicolinealidad</strong> — las 123 features tienen alta correlación entre sí (ej: goles vs tiros) pero los árboles no asumen independencia lineal.</li>
              <li><strong className="text-white">Escalable</strong> — entrena en segundos con 8,611 muestras × 123 features.</li>
              <li><strong className="text-white">Interpretable con SHAP</strong> — permite explicar por qué un jugador tiene riesgo alto (qué features contribuyen más).</li>
            </ul>
          </div>

          {/* Real Feature Importance from loaded model */}
          <RealFeatureImportance />

          {/* Real Risk Distribution */}
          <RiskDistribution />

          {/* SHAP & Training Plots from real model training */}
          <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
            <h4 className="text-sm font-bold text-red-300 mb-2">📊 Gráficos del Entrenamiento — Generados por el script de modelado</h4>
            <p className="text-xs text-gray-400 mb-4">
              Estos gráficos se generaron automáticamente durante el entrenamiento del modelo con <code className="text-red-300">model_injury_risk.py</code>. 
              Son los mismos que se usan en la documentación académica del proyecto.
            </p>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-300 mb-2">SHAP Summary Plot — Importancia global de features (Beeswarm)</p>
                <p className="text-xs text-gray-500 mb-2">Cada punto es una muestra del test set. El color indica el valor de la feature (rojo = alto, azul = bajo). La posición horizontal muestra el impacto en la predicción.</p>
                <ModelPlot src="injury_shap_summary.png" alt="SHAP Summary Plot del modelo de lesiones" caption="Generado con shap.summary_plot() sobre 1000 muestras del test set temporal." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-300 mb-2">Confusion Matrix (Test Set Temporal)</p>
                  <ModelPlot src="injury_confusion_matrix.png" alt="Confusion Matrix del XGBoost de lesiones" caption="Evaluado sobre el 20% temporal más reciente (2025-2026)." />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-300 mb-2">Curva ROC — XGBoost vs Logistic Regression</p>
                  <ModelPlot src="injury_roc_curve.png" alt="Curva ROC comparando XGBoost y Logistic Regression" caption="AUC del modelo seleccionado vs baseline sobre el test temporal." />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-300 mb-2">Feature Importance (Top 25 por Gain)</p>
                <ModelPlot src="injury_feature_importance.png" alt="Top 25 feature importances del modelo de lesiones" caption="Importancia por ganancia acumulada en los splits de XGBoost." />
              </div>

              <div>
                <p className="text-xs font-bold text-gray-300 mb-2">Curvas de Supervivencia (Kaplan-Meier) — Por Posición y Edad</p>
                <p className="text-xs text-gray-500 mb-2">Análisis de supervivencia con Cox Proportional Hazards (C-Index: 0.749). Muestra la probabilidad de permanecer sin lesión a lo largo del tiempo.</p>
                <ModelPlot src="injury_survival_curves.png" alt="Curvas de supervivencia por posición y grupo de edad" caption="Estimación Kaplan-Meier sobre datos de entrenamiento temporal." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-300 mb-2">SHAP Dependence: Dias_Baja</p>
                  <ModelPlot src="injury_shap_dep_1_Dias_Baja.png" alt="SHAP dependence plot para Dias_Baja" caption="Mean |SHAP| = 0.2502" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-300 mb-2">SHAP Dependence: injury_frequency</p>
                  <ModelPlot src="injury_shap_dep_2_injury_frequency.png" alt="SHAP dependence plot para injury_frequency" caption="Mean |SHAP| = 0.1470" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-300 mb-2">SHAP Dependence: injury_count_last_12m</p>
                  <ModelPlot src="injury_shap_dep_3_injury_count_last_12m.png" alt="SHAP dependence plot para injury_count_last_12m" caption="Mean |SHAP| = 0.0811" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Fallback: ¿qué pasa si el modelo falla?</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Si el modelo .pkl no carga o la inferencia falla por features inválidos, se activa una <strong className="text-white">fórmula de fallback</strong>:
            </p>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-300 mt-2">
              <p>risk = min(injury_freq × 8, 40) + min(severity × 5, 25) + max(0, (age-28) × 2) + min(total_injuries × 0.5, 20)</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">Esto garantiza que la pantalla nunca quede rota — siempre devuelve un diagnóstico, aunque sea con menor precisión.</p>
          </div>
        </div>
      </Section>

      {/* Section 4: Physiological Estimation */}
      <Section title="Paso 4 — Perfil Fisiológico: ¿cómo se estima sin sensores?" icon={<Activity className="w-5 h-5 text-green-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El radar fisiológico (cardio, endurance, respiratory, recovery) <strong className="text-red-400">NO es un modelo de Machine Learning</strong>. 
            Son estimaciones basadas en <strong className="text-white">correlaciones estadísticas</strong> con datos de juego disponibles.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
            <h4 className="text-sm font-bold text-yellow-300 mb-3">⚠️ Limitación importante</h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              Sin acceso a datos biométricos reales (GPS, pulsómetros, tests médicos), estas métricas son <em>proxies indirectos</em>. 
              No reemplazan un chequeo médico real. Se incluyen para dar una intuición visual del estado del jugador 
              basándose en lo que sí conocemos (minutos jugados, edad, historial de lesiones).
            </p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Fórmulas de estimación</h4>
            <div className="space-y-3">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-green-300 text-xs mb-1">cardio</p>
                <p className="text-sm text-gray-400">= 50 + (minutos_jugados / 3000) × 45</p>
                <p className="text-xs text-gray-500 mt-1">Lógica: cuantos más minutos a alto nivel, mayor capacidad cardiovascular demostrada. Rango: 40-99.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-green-300 text-xs mb-1">endurance</p>
                <p className="text-sm text-gray-400">= 45 + (Min% × 0.5) × factor_edad</p>
                <p className="text-xs text-gray-500 mt-1">Min% = % de minutos disponibles que completó. Mayor Min% = mayor confiabilidad física. Factor_edad mejora entre 20-30 años.</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-green-300 text-xs mb-1">recovery</p>
                <p className="text-sm text-gray-400">= 90 - (edad - 25) × 1.5 - min(days_out × 0.1, 20)</p>
                <p className="text-xs text-gray-500 mt-1">Penaliza por edad (los jóvenes se recuperan más rápido) y por carga de lesiones históricas (más días de baja = peor recovery).</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-green-300 text-xs mb-1">respiratory</p>
                <p className="text-sm text-gray-400">= cardio × 0.7 + recovery × 0.3</p>
                <p className="text-xs text-gray-500 mt-1">Blend de los otros dos. Proxy de fitness general.</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 5: What-If Simulation */}
      <Section title="Paso 5 — Simulador What-If: ¿cómo funciona?" icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El simulador permite <strong className="text-white">modificar dos features clave</strong> del modelo y re-ejecutar la predicción 
            en tiempo real para ver cómo cambia el riesgo. Esto es útil para responder preguntas como:
          </p>
          <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside mb-3">
            <li>"¿Qué pasa si este jugador juega 3 partidos en 15 días?" → se incrementa <code className="text-yellow-300">injury_frequency</code></li>
            <li>"¿Cuánto se reduce el riesgo si esperamos 6 meses desde su última lesión?" → se incrementa <code className="text-yellow-300">days_since_last_injury</code></li>
          </ul>

          <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
            <h4 className="text-sm font-bold text-yellow-300 mb-3">Implementación técnica</h4>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-300 space-y-1">
              <p className="text-gray-500">// El endpoint acepta overrides opcionales:</p>
              <p>GET /api/v1/injuries/risk/{'{player_id}'}?override_frequency=0.45&override_days_since=30</p>
              <p></p>
              <p className="text-gray-500">// En el backend, se reemplazan DESPUÉS de construir los features:</p>
              <p>features_df = build_injury_features(player_row, injuries_df)</p>
              <p className="text-yellow-300">features_df['injury_frequency'] = override_frequency  // ← inyección</p>
              <p className="text-yellow-300">features_df['days_since_last_injury'] = override_days_since</p>
              <p>proba = model.predict_proba(features_df)[0][1]  // re-predicción</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Esto es una forma de <strong className="text-gray-200">análisis de sensibilidad</strong>: 
              mantiene constantes 121 features y varía solo 2 para medir su influencia en la predicción. 
              Es análogo a SHAP pero más intuitivo para el usuario final.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 6: Climate Modulation */}
      <Section title="Paso 6 — Modulación Climática: ¿cómo el clima del estadio afecta la predicción?" icon={<Thermometer className="w-5 h-5 text-orange-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Cuando se selecciona un partido, el sistema obtiene la <strong className="text-white">temperatura, humedad y altitud</strong> del 
            estadio (via Open-Meteo API) y calcula <strong className="text-white">12 features de interacción</strong> entre las condiciones 
            climáticas y el perfil de vulnerabilidad del jugador. Estas features ajustan el score base del XGBoost.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
            <h4 className="text-sm font-bold text-orange-300 mb-3">Arquitectura: Modelo Base + Modulación</h4>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-xs text-gray-300 space-y-1">
              <p><span className="text-green-400">PASO 1:</span> XGBoost(123 features) → score_base (ej: 42%)</p>
              <p><span className="text-orange-400">PASO 2:</span> compute_climate_features(jugador, estadio) → ajuste (ej: +14.2 pts)</p>
              <p><span className="text-red-400">SALIDA:</span> score_final = min(score_base + ajuste, 99%) → 56.2%</p>
              <p></p>
              <p className="text-gray-500">// El ajuste está acotado a un máximo de +25 puntos</p>
              <p className="text-gray-500">// Si no hay datos climáticos (sin partido seleccionado), el ajuste es 0</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">¿Por qué modulación y no un modelo unificado?</h4>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">
              Se realizó un <strong className="text-white">experimento formal de reentrenamiento</strong> (script <code className="text-orange-300">model_injury_climate.py</code>) 
              incorporando las 12 features climáticas directamente al XGBoost (135 features totales):
            </p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">AUC-ROC sin clima</p>
                <p className="text-lg font-bold text-green-400">0.6272</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">AUC-ROC con clima</p>
                <p className="text-lg font-bold text-red-400">0.6221</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5 text-center">
                <p className="text-xs text-gray-500">Diferencia</p>
                <p className="text-lg font-bold text-yellow-400">-0.51%</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              <strong className="text-white">El modelo con clima fue peor.</strong> La causa: el dataset histórico de lesiones no registra 
              la temperatura/humedad real al momento de cada lesión. Sin esa "ground truth", el modelo no puede aprender la relación 
              clima → lesión. Por eso se usa modulación con pesos derivados de <strong className="text-white">literatura médica deportiva</strong> (Ekstrand et al., 2011; 
              FIFA Medical Report Qatar 2022).
            </p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Las 12 features de interacción clima × jugador</h4>
            <p className="text-xs text-gray-500 mb-3">No son datos crudos de temperatura. Son <em>interacciones</em> que capturan el mecanismo biológico:</p>
            <div className="space-y-2">
              {[
                { feat: "heat_stress", desc: "Índice de calor no lineal (activa >25°C, escala con humedad)", when: "Houston, Miami, Arlington" },
                { feat: "heat × recurrent", desc: "Calor × lesión muscular previa = músculo deshidratado se rompe", when: "Jugador con hamstring + calor" },
                { feat: "heat × injury_freq", desc: "Calor × alta frecuencia de lesiones = riesgo compuesto", when: "Jugador lesionable en verano" },
                { feat: "altitude_factor", desc: "O₂ reducido sobre 1000m → fatiga muscular", when: "Ciudad de México (2240m), Guadalajara (1566m)" },
                { feat: "altitude × age", desc: "Altitud + edad >28 = VO₂max decae → mayor riesgo", when: "Jugador veterano en CDMX" },
                { feat: "temp_differential", desc: "|temp_estadio - temp_habitual_país| → shock de adaptación", when: "Inglés (11°C) en Houston (34°C)" },
                { feat: "adaptation_stress", desc: "Score compuesto: cuán diferente es el ambiente del habitual", when: "Cualquier equipo en ambiente extraño" },
                { feat: "dehydration_risk", desc: "Calor × humedad × minutos jugados → proxy deshidratación", when: "Solo activa con temp >25°C" },
              ].map(({ feat, desc, when }) => (
                <div key={feat} className="bg-black/60 rounded-lg px-3 py-2 border border-white/5 flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-xs font-mono text-orange-300 w-44 shrink-0">{feat}</span>
                  <span className="text-xs text-gray-400 flex-1">{desc}</span>
                  <span className="text-[11px] text-gray-400 italic">{when}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
            <h4 className="text-sm font-bold text-orange-300 mb-3">Ejemplo concreto</h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              <strong className="text-white">Jugador:</strong> Inglés, 33 años, 2 lesiones musculares recurrentes, injury_freq = 2.1<br />
              <strong className="text-white">Estadio:</strong> NRG Stadium, Houston (34°C, 75% humedad, 10m altitud)<br />
              <strong className="text-white">Clima habitual de Inglaterra:</strong> 11°C, 80% humedad, 50m altitud
            </p>
            <div className="bg-black/60 rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-300 mt-3 space-y-1">
              <p>heat_stress = 0.37 <span className="text-gray-600">(alto: 34°C + humedad)</span></p>
              <p>heat × recurrent = 0.37 <span className="text-gray-600">(activo: lesión recurrente)</span></p>
              <p>temp_differential = 1.15 <span className="text-gray-600">(23°C de diferencia con casa)</span></p>
              <p>adaptation_stress = 0.63 <span className="text-gray-600">(ambiente muy diferente)</span></p>
              <p className="text-orange-300 pt-1 border-t border-white/5">→ Ajuste total: +14.2 puntos de riesgo</p>
              <p className="text-yellow-300">→ Score base 42% (LOW_RISK) → Score final 56% (monitorear carga)</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Origen de los datos climáticos</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              <strong className="text-white">No se inventan datos.</strong> La temperatura y humedad provienen de la 
              <strong className="text-white"> API Open-Meteo</strong> (Historical o Forecast según la fecha del partido). 
              Las coordenadas y altitud del estadio vienen de <code className="text-orange-300">world_cup_stadiums.csv</code> (16 estadios sede, datos geográficos reales).
              El clima promedio del país de origen se usa como referencia para calcular diferenciales de adaptación.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 7: How to read the dashboard */}
      <Section title="Paso 7 — ¿Cómo leer el Panel de Decisión?" icon={<Activity className="w-5 h-5 text-neon-blue" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El Panel de Decisión (pestaña izquierda) traduce toda esta complejidad técnica en una respuesta simple 
            para el cuerpo médico/técnico:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-bold text-green-400">HEALTHY</p>
              <p className="text-xs text-gray-400 mt-1">Riesgo &lt; 30%</p>
              <p className="text-xs text-gray-500">Puede jugar sin restricciones</p>
            </div>
            <div className="bg-yellow-500/5 rounded-lg p-4 border border-yellow-500/20 text-center">
              <p className="text-2xl mb-2">⚠️</p>
              <p className="text-sm font-bold text-yellow-400">LOW RISK</p>
              <p className="text-xs text-gray-400 mt-1">30% - 70%</p>
              <p className="text-xs text-gray-500">Monitorear y ajustar carga</p>
            </div>
            <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20 text-center">
              <p className="text-2xl mb-2">🚨</p>
              <p className="text-sm font-bold text-red-400">CRITICAL RISK</p>
              <p className="text-xs text-gray-400 mt-1">Riesgo &gt; 70%</p>
              <p className="text-xs text-gray-500">Considerar descanso o reserva médica</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">Radar fisiológico — interpretación</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Los 5 ejes del radar no son métricas de un sensor real — son <em>estimaciones correlacionales</em>. 
              Sirven para dar una <strong className="text-white">intuición visual rápida</strong> del estado físico estimado. 
              Un radar "encogido" en recovery sugiere que el jugador tuvo muchas lesiones y su capacidad de recuperación es menor. 
              Un radar amplio en cardio+endurance sugiere un jugador con alto volumen de juego demostrado.
            </p>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">Datos geoclimáticos — ¿por qué importan?</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              La altitud, temperatura y humedad del estadio afectan la fatiga muscular. Partidos a &gt;2000m de altitud 
              (como el Estadio Azteca) incrementan la demanda cardiovascular. El calor extremo (&gt;35°C) acelera la deshidratación. 
              Estos datos se obtienen en tiempo real de <strong className="text-white">Open-Meteo API</strong> usando las coordenadas GPS de cada estadio.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 8: Algorithm Comparison */}
      <Section title="Paso 8 — Comparación de Algoritmos: XGBoost vs Random Forest" icon={<GitCompare className="w-5 h-5 text-orange-400" />}>
        <ClassificationComparison
          endpoint="injury"
          title="Injury Prediction — XGBoost vs Random Forest"
        />
      </Section>
    </div>
  );
}
