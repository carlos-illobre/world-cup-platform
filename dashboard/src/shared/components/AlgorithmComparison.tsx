import { useState, useEffect } from "react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, ScatterChart, Scatter, Cell,
} from "recharts";
import { GitCompare, Trophy, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ModelPlot } from "@/shared/components/ModelPlot";

interface ComparisonMetrics {
  task: string;
  dataset_size: number;
  train_size?: number;
  test_size?: number;
  features_count: number;
  xgboost: Record<string, any>;
  random_forest: Record<string, any>;
  feature_importance_rf?: Record<string, number>;
}

interface ClusteringMetrics {
  task: string;
  dataset_size: number;
  features_count: number;
  features_used: string[];
  kmeans: Record<string, any>;
  hdbscan: Record<string, any>;
}

function MetricCard({ label, valueA, valueB, nameA, nameB, higherIsBetter = true }: {
  label: string; valueA: number; valueB: number;
  nameA: string; nameB: string; higherIsBetter?: boolean;
}) {
  const better = higherIsBetter ? (valueA > valueB ? "A" : "B") : (valueA < valueB ? "A" : "B");
  return (
    <div className="bg-black/40 rounded-lg p-3 border border-white/5">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-center justify-between">
        <div className={`text-center ${better === "A" ? "text-green-400" : "text-gray-300"}`}>
          <p className="text-lg font-bold">{typeof valueA === 'number' ? valueA.toFixed(4) : valueA}</p>
          <p className="text-[10px] text-gray-500">{nameA}</p>
        </div>
        <span className="text-gray-600 text-xs">vs</span>
        <div className={`text-center ${better === "B" ? "text-green-400" : "text-gray-300"}`}>
          <p className="text-lg font-bold">{typeof valueB === 'number' ? valueB.toFixed(4) : valueB}</p>
          <p className="text-[10px] text-gray-500">{nameB}</p>
        </div>
      </div>
      {better && (
        <div className="mt-1 flex justify-center">
          <span className="text-[10px] text-green-400 flex items-center gap-1">
            <Trophy className="w-2.5 h-2.5" />
            {better === "A" ? nameA : nameB}
          </span>
        </div>
      )}
    </div>
  );
}

function FeatureImportanceComparison({ rfImportance, title }: {
  rfImportance: Record<string, number>; title: string;
}) {
  const items = Object.entries(rfImportance).slice(0, 10).map(([feat, imp]) => ({
    feature: feat.length > 20 ? feat.slice(0, 18) + "..." : feat,
    fullName: feat,
    importance: imp * 100,
  }));

  return (
    <div className="bg-black/40 rounded-lg p-4 border border-white/5">
      <h4 className="text-sm font-bold text-gray-200 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={items} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis type="number" tick={{ fill: '#888', fontSize: 10 }} />
          <YAxis dataKey="feature" type="category" tick={{ fill: '#aaa', fontSize: 10 }} width={80} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          <Bar dataKey="importance" fill="#06b6d4" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Generic classification comparison (Match Outcome, Injury) */
export function ClassificationComparison({ endpoint, title }: {
  endpoint: string; title: string;
}) {
  const [data, setData] = useState<ComparisonMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/models/compare/${endpoint}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [endpoint]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse text-gray-500">Cargando comparación de modelos...</div>
    </div>
  );
  if (!data) return (
    <div className="text-gray-500 text-sm p-4">
      No se encontraron métricas de comparación. Ejecute train_alternative_models.py primero.
    </div>
  );

  const xgb = data.xgboost;
  const rf = data.random_forest;

  // Build comparison metrics
  const metrics: { label: string; xgb: number; rf: number; higherBetter: boolean }[] = [];
  if (xgb.accuracy != null && rf.accuracy != null) {
    metrics.push({ label: "Accuracy", xgb: xgb.accuracy, rf: rf.accuracy, higherBetter: true });
  }
  if (xgb.f1_macro != null && rf.f1_macro != null) {
    metrics.push({ label: "F1-Macro", xgb: xgb.f1_macro, rf: rf.f1_macro, higherBetter: true });
  }
  if (xgb.f1_score != null && rf.f1_score != null) {
    metrics.push({ label: "F1-Score", xgb: xgb.f1_score, rf: rf.f1_score, higherBetter: true });
  }
  if (xgb.auc_roc != null && rf.auc_roc != null) {
    metrics.push({ label: "AUC-ROC", xgb: xgb.auc_roc, rf: rf.auc_roc, higherBetter: true });
  }

  const chartData = metrics.map(m => ({
    name: m.label,
    XGBoost: m.xgb,
    RandomForest: m.rf,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-orange-500/5 to-purple-500/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <GitCompare className="w-6 h-6 text-orange-400" />
          <h2 className="text-xl font-display font-bold text-white">{title}</h2>
        </div>
        <p className="text-sm text-gray-300 mb-2">
          Comparación entrenada sobre los mismos datos ({data.dataset_size} muestras,{" "}
          {data.features_count} features). Split temporal 80/20 para evitar data leakage.
        </p>
        <div className="flex gap-4 text-xs text-gray-400">
          <span>Train: {data.train_size}</span>
          <span>Test: {data.test_size}</span>
        </div>
      </div>

      {/* Metrics comparison cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => (
          <MetricCard
            key={m.label}
            label={m.label}
            valueA={m.xgb}
            valueB={m.rf}
            nameA="XGBoost"
            nameB="Random Forest"
            higherIsBetter={m.higherBetter}
          />
        ))}
      </div>

      {/* Bar chart comparison */}
      {chartData.length > 0 && (
        <div className="bg-black/40 rounded-lg p-4 border border-white/5">
          <h4 className="text-sm font-bold text-gray-200 mb-3">Comparación Visual de Métricas</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} domain={[0, 1]} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
              <Legend />
              <Bar dataKey="XGBoost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="RandomForest" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feature Importance from RF */}
      {data.feature_importance_rf && (
        <FeatureImportanceComparison
          rfImportance={data.feature_importance_rf}
          title="Feature Importance — Random Forest (Gini Impurity)"
        />
      )}

      {/* Algorithm Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black/40 rounded-lg p-4 border border-amber-500/20">
          <h4 className="text-sm font-bold text-amber-300 mb-2">🌳 XGBoost</h4>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Boosting secuencial: cada árbol corrige errores del anterior</li>
            <li>Regularización L1/L2 incorporada (reduce overfitting)</li>
            <li>Maneja NaN nativamente (aprende dirección óptima)</li>
            <li>SHAP nativo via pred_contribs (explicabilidad)</li>
            <li>Mejor con datasets medianos y features correlacionadas</li>
          </ul>
          {xgb.hyperparameters && (
            <div className="mt-2 text-[10px] text-gray-500 font-mono">
              {Object.entries(xgb.hyperparameters).map(([k, v]) => (
                <span key={k} className="mr-2">{k}={String(v)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="bg-black/40 rounded-lg p-4 border border-cyan-500/20">
          <h4 className="text-sm font-bold text-cyan-300 mb-2">🌲 Random Forest</h4>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Bagging: múltiples árboles independientes en paralelo</li>
            <li>Menos propenso a overfitting (varianza reducida)</li>
            <li>No requiere tuning fino de hiperparámetros</li>
            <li>Robusto a outliers y datos ruidosos</li>
            <li>Mejor generalización con pocos datos</li>
          </ul>
          {rf.hyperparameters && (
            <div className="mt-2 text-[10px] text-gray-500 font-mono">
              {Object.entries(rf.hyperparameters).map(([k, v]) => (
                <span key={k} className="mr-2">{k}={String(v)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Training comparison plots */}
      {endpoint === "injury" && (
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Curva ROC — XGBoost vs Random Forest</h4>
            <p className="text-xs text-gray-400 mb-3">Muestra la capacidad de discriminación: cuanto más arriba y a la izquierda, mejor separa lesionados de no-lesionados. AUC = área bajo la curva (1.0 = perfecto, 0.5 = azar).</p>
            <ModelPlot src="injury_roc_comparison_xgb_rf.png" alt="Curva ROC comparativa XGBoost vs Random Forest" caption="Ambos modelos evaluados sobre el mismo test set temporal (1,723 muestras)." />
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Distribución de Probabilidades Predichas</h4>
            <p className="text-xs text-gray-400 mb-3">Histograma de las probabilidades que cada modelo asigna, separadas por clase real. Un buen modelo debería separar las distribuciones (verde a la izquierda, rojo a la derecha).</p>
            <ModelPlot src="injury_proba_distribution_xgb_rf.png" alt="Distribución de probabilidades XGBoost vs RF" caption="Verde = jugadores que NO se lesionaron. Rojo = jugadores que SÍ se lesionaron. Línea = umbral 0.5." />
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Confusion Matrix Comparativa</h4>
            <p className="text-xs text-gray-400 mb-3">Cuántos aciertos y errores comete cada modelo. La diagonal = predicciones correctas. Fuera de diagonal = errores.</p>
            <ModelPlot src="injury_confusion_matrix_comparison.png" alt="Confusion matrices lado a lado" caption="Izquierda: XGBoost. Derecha: Random Forest. Sobre el mismo test set." />
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Curva de Calibración</h4>
            <p className="text-xs text-gray-400 mb-3">¿Las probabilidades predichas son confiables? Si el modelo dice "60% riesgo", ¿realmente el 60% de esos jugadores se lesiona? La diagonal = calibración perfecta.</p>
            <ModelPlot src="injury_calibration_xgb_rf.png" alt="Curvas de calibración XGBoost vs RF" caption="Puntos por encima de la diagonal = modelo subestima el riesgo. Por debajo = sobreestima." />
          </div>
        </div>
      )}

      {endpoint === "match-outcome" && (
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Confusion Matrix — Partidos (3 clases)</h4>
            <p className="text-xs text-gray-400 mb-3">Muestra cómo cada modelo distribuye sus predicciones entre Victoria, Empate y Derrota. Los empates son la clase más difícil de predecir.</p>
            <ModelPlot src="match_confusion_matrix_comparison.png" alt="Confusion matrices de partidos" caption="Izquierda: XGBoost. Derecha: Random Forest. 632 partidos de test." />
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Distribución de P(Victoria) por resultado real</h4>
            <p className="text-xs text-gray-400 mb-3">¿Cuánta probabilidad de victoria asigna cada modelo según lo que realmente pasó? Un buen modelo da alta P(Win) a las victorias reales (verde) y baja a las derrotas (rojo).</p>
            <ModelPlot src="match_proba_distribution_xgb_rf.png" alt="Distribución de probabilidades de partidos" caption="Verde = victorias reales. Amarillo = empates. Rojo = derrotas." />
          </div>
        </div>
      )}

      {/* Verdict */}
      <div className="bg-black/40 rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Veredicto</h4>
        <p className="text-sm text-gray-300 leading-relaxed">
          {metrics.length > 0 && (() => {
            const rfWins = metrics.filter(m => m.higherBetter ? m.rf > m.xgb : m.rf < m.xgb).length;
            const xgbWins = metrics.length - rfWins;
            if (xgbWins > rfWins) {
              return `XGBoost gana en ${xgbWins} de ${metrics.length} métricas. Esto es esperable dado que XGBoost 
              optimiza secuencialmente los residuos (boosting), lo que típicamente supera al bagging de Random Forest 
              cuando los hiperparámetros están bien ajustados y el dataset tiene suficientes muestras.`;
            } else {
              return `Random Forest gana en ${rfWins} de ${metrics.length} métricas. Esto puede deberse a que 
              RF generaliza mejor con pocos datos, es menos sensible a overfitting, y su class_weight='balanced' 
              maneja el desbalanceo de clases más robustamente.`;
            }
          })()}
        </p>
      </div>
    </div>
  );
}

/** Regression comparison (Player Impact, Team Points) */
export function RegressionComparison({ endpoint, title }: {
  endpoint: string; title: string;
}) {
  const [data, setData] = useState<ComparisonMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/models/compare/${endpoint}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [endpoint]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse text-gray-500">Cargando comparación de modelos...</div>
    </div>
  );
  if (!data) return null;

  const xgb = data.xgboost;
  const rf = data.random_forest;

  const metrics = [
    { label: "RMSE", xgb: xgb.rmse, rf: rf.rmse, higherBetter: false },
    { label: "MAE", xgb: xgb.mae, rf: rf.mae, higherBetter: false },
  ];
  if (xgb.r2 != null && rf.r2 != null) {
    metrics.push({ label: "R²", xgb: xgb.r2, rf: rf.r2, higherBetter: true });
  }

  const chartData = metrics.map(m => ({ name: m.label, XGBoost: m.xgb, RandomForest: m.rf }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-green-500/5 to-blue-500/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <GitCompare className="w-6 h-6 text-green-400" />
          <h2 className="text-xl font-display font-bold text-white">{title}</h2>
        </div>
        <p className="text-sm text-gray-300">
          Regresión sobre {data.dataset_size} muestras, {data.features_count} features.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map(m => (
          <MetricCard
            key={m.label}
            label={m.label}
            valueA={m.xgb}
            valueB={m.rf}
            nameA="XGBoost"
            nameB="Random Forest"
            higherIsBetter={m.higherBetter}
          />
        ))}
      </div>

      <div className="bg-black/40 rounded-lg p-4 border border-white/5">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} />
            <YAxis tick={{ fill: '#888', fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
            <Legend />
            <Bar dataKey="XGBoost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="RandomForest" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.feature_importance_rf && (
        <FeatureImportanceComparison
          rfImportance={data.feature_importance_rf}
          title="Feature Importance — Random Forest"
        />
      )}

      {/* Training comparison plots for Player Impact */}
      {endpoint === "player-impact" && (
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Predicho vs Real — Scatter Plot</h4>
            <p className="text-xs text-gray-400 mb-3">Cada punto es un jugador. El eje X es su impact score real (calculado desde FBref) y el eje Y es lo que el modelo predijo. Cuanto más cerca de la diagonal, mejor.</p>
            <ModelPlot src="impact_predicted_vs_actual_xgb_rf.png" alt="Predicted vs Actual scatter" caption="XGBoost (R²=0.71) concentra puntos cerca de la diagonal. RF (R²=0.07) dispersa más." />
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Distribución de Residuos (Errores)</h4>
            <p className="text-xs text-gray-400 mb-3">Histograma del error (real - predicho). Un modelo perfecto tendría todos los residuos en 0. La distribución debería ser simétrica y centrada en 0.</p>
            <ModelPlot src="impact_residuals_xgb_rf.png" alt="Residual distributions" caption="XGBoost tiene residuos más concentrados en 0. RF tiene colas más largas (errores grandes)." />
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Feature Importance — XGBoost (Gain) vs RF (Gini)</h4>
            <p className="text-xs text-gray-400 mb-3">¿Qué features usa cada modelo para predecir? XGBoost usa Gain (reducción de error por splits), RF usa Gini (reducción de impureza). Notar que pueden priorizar features distintos.</p>
            <ModelPlot src="impact_feature_importance_comparison.png" alt="Feature importance comparison" caption="Las top features difieren: XGBoost puede priorizar 'overall' mientras RF distribuye más uniformemente." />
          </div>
        </div>
      )}
    </div>
  );
}

/** Clustering comparison (K-Means vs HDBSCAN) */
export function ClusteringComparison() {
  const [data, setData] = useState<ClusteringMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/models/compare/clustering`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse text-gray-500">Cargando comparación de clustering...</div>
    </div>
  );
  if (!data) return null;

  const km = data.kmeans;
  const hdb = data.hdbscan;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <GitCompare className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-display font-bold text-white">
            Clustering: K-Means vs HDBSCAN
          </h2>
        </div>
        <p className="text-sm text-gray-300">
          Ambos algoritmos se ejecutaron sobre los mismos {data.dataset_size} jugadores
          usando {data.features_count} features per-90 estandarizadas.
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Silhouette Score"
          valueA={km.silhouette_score}
          valueB={hdb.silhouette_score}
          nameA="K-Means"
          nameB="HDBSCAN"
          higherIsBetter={true}
        />
        <div className="bg-black/40 rounded-lg p-3 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">Clusters encontrados</p>
          <div className="flex justify-between">
            <div className="text-center">
              <p className="text-lg font-bold text-amber-400">{km.n_clusters}</p>
              <p className="text-[10px] text-gray-500">K-Means</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-cyan-400">{hdb.n_clusters}</p>
              <p className="text-[10px] text-gray-500">HDBSCAN</p>
            </div>
          </div>
        </div>
        <div className="bg-black/40 rounded-lg p-3 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">Puntos "ruido"</p>
          <div className="flex justify-between">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">0</p>
              <p className="text-[10px] text-gray-500">K-Means</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{hdb.noise_pct}%</p>
              <p className="text-[10px] text-gray-500">HDBSCAN</p>
            </div>
          </div>
        </div>
        <div className="bg-black/40 rounded-lg p-3 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">Jugadores clasificados</p>
          <div className="flex justify-between">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">100%</p>
              <p className="text-[10px] text-gray-500">K-Means</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-400">
                {(100 - hdb.noise_pct).toFixed(0)}%
              </p>
              <p className="text-[10px] text-gray-500">HDBSCAN</p>
            </div>
          </div>
        </div>
      </div>

      {/* Advantages/Disadvantages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black/40 rounded-lg p-4 border border-amber-500/20">
          <h4 className="text-sm font-bold text-amber-300 mb-3">K-Means (k=5)</h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-bold text-green-400 mb-1">✓ Ventajas</p>
              <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                {km.advantages?.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-red-400 mb-1">✗ Desventajas</p>
              <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                {km.disadvantages?.map((d: string, i: number) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-gray-500 font-mono">
            Params: n_clusters={km.hyperparameters?.n_clusters}, n_init={km.hyperparameters?.n_init}
          </div>
        </div>

        <div className="bg-black/40 rounded-lg p-4 border border-cyan-500/20">
          <h4 className="text-sm font-bold text-cyan-300 mb-3">HDBSCAN</h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-bold text-green-400 mb-1">✓ Ventajas</p>
              <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                {hdb.advantages?.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-red-400 mb-1">✗ Desventajas</p>
              <ul className="text-xs text-gray-400 space-y-0.5 list-disc list-inside">
                {hdb.disadvantages?.map((d: string, i: number) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-gray-500 font-mono">
            Params: min_cluster_size={hdb.hyperparameters?.min_cluster_size}, min_samples={hdb.hyperparameters?.min_samples}
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="bg-black/40 rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-bold text-gray-200 mb-2">📊 Interpretación</h4>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <strong className="text-purple-300">Silhouette:</strong> HDBSCAN obtiene un score más alto
            ({hdb.silhouette_score}) vs K-Means ({km.silhouette_score}) porque HDBSCAN solo mide los
            puntos que realmente pertenecen a un cluster (excluye ruido). Esto no significa que HDBSCAN
            sea "mejor" — simplemente es más selectivo.
          </p>
          <p>
            <strong className="text-purple-300">Ruido ({hdb.noise_pct}%):</strong> HDBSCAN marca como
            "ruido" a los jugadores que no encajan claramente en ningún perfil. En fútbol, muchos jugadores
            son polivalentes (mediocampistas que defienden y atacan), lo cual genera naturalmente
            zonas de transición entre clusters. K-Means fuerza una asignación incluso si el jugador
            está en la frontera.
          </p>
          <p>
            <strong className="text-purple-300">Recomendación:</strong> Para este dataset deportivo,
            K-Means es preferible para la <em>toma de decisiones</em> (todos los jugadores clasificados),
            mientras que HDBSCAN es útil para <em>identificar arquetipos puros</em> (los jugadores NO
            marcados como ruido son los representantes más claros de cada estilo).
          </p>
        </div>
      </div>
    </div>
  );
}
