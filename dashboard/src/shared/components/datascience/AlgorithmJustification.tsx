interface ModelSpec {
  name: string;
  type: "xgboost" | "random_forest" | "kmeans" | "hdbscan" | "ilp" | "other";
  shortDesc: string;
}

interface AlgorithmJustificationProps {
  modelA: ModelSpec;
  modelB: ModelSpec;
  /** Why these two were chosen as the comparison pair */
  rationale?: string;
}

const PROPERTY_TABLE: Array<{
  property: string;
  xgboost: string;
  random_forest: string;
  kmeans: string;
  hdbscan: string;
  ilp: string;
}> = [
  {
    property: "Tipo",
    xgboost: "Gradient Boosting (secuencial)",
    random_forest: "Bagging (paralelo)",
    kmeans: "Particionamiento esférico",
    hdbscan: "Basado en densidad jerárquico",
    ilp: "Optimización combinatoria",
  },
  {
    property: "Sesgo / Varianza",
    xgboost: "Bajo sesgo, alta varianza controlada con regularización",
    random_forest: "Sesgo moderado, baja varianza por promediado",
    kmeans: "Sesgo fuerte (asume clusters esféricos, igual tamaño)",
    hdbscan: "Bajo sesgo, detecta formas arbitrarias",
    ilp: "Solución exacta sujeta a constraints (no estadística)",
  },
  {
    property: "Sobreajuste",
    xgboost: "Regularización L1/L2 + learning rate + profundidad máx",
    random_forest: "Bootstrap + max_features aleatorias por split",
    kmeans: "No aplica (algoritmo determinista)",
    hdbscan: "Parámetro min_samples controla densidad mínima",
    ilp: "No aplica",
  },
  {
    property: "Interpretabilidad",
    xgboost: "SHAP values nativo (exact TreeSHAP, O(n))",
    random_forest: "Feature importance por impureza (menos preciso)",
    kmeans: "Centroides directamente interpretables",
    hdbscan: "Dendrograma de condensación, membership probabilities",
    ilp: "Coeficientes de la función objetivo + dual variables",
  },
  {
    property: "Velocidad inferencia",
    xgboost: "Rápido (evaluación secuencial de árboles)",
    random_forest: "Rápido (evaluación paralela de árboles)",
    kmeans: "O(n·k·i) — muy rápido",
    hdbscan: "O(n² log n) — más lento en n grandes",
    ilp: "Depende del solver (CBC/GLPK) y tamaño del problema",
  },
  {
    property: "Manejo de outliers",
    xgboost: "Sensible — outliers en target pueden afectar",
    random_forest: "Más robusto por promediado",
    kmeans: "Muy sensible — outliers distorsionan centroides",
    hdbscan: "Robusto — puntos de ruido etiquetados como -1",
    ilp: "No aplica",
  },
];

function getModelKey(type: ModelSpec["type"]): keyof (typeof PROPERTY_TABLE)[0] {
  if (type === "xgboost") return "xgboost";
  if (type === "random_forest") return "random_forest";
  if (type === "kmeans") return "kmeans";
  if (type === "hdbscan") return "hdbscan";
  if (type === "ilp") return "ilp";
  return "xgboost";
}

const MODEL_COLOR: Record<ModelSpec["type"], string> = {
  xgboost: "text-amber-300",
  random_forest: "text-cyan-300",
  kmeans: "text-purple-300",
  hdbscan: "text-green-300",
  ilp: "text-emerald-300",
  other: "text-gray-300",
};

/**
 * Comparative theory table explaining why two specific algorithms were chosen.
 * Used in every Data Science panel to justify the algorithm choice.
 */
export function AlgorithmJustification({
  modelA,
  modelB,
  rationale,
}: AlgorithmJustificationProps) {
  const keyA = getModelKey(modelA.type);
  const keyB = getModelKey(modelB.type);

  return (
    <div className="space-y-4">
      {rationale && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-200 leading-relaxed">{rationale}</p>
        </div>
      )}

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <h4 className={`text-sm font-bold mb-1 ${MODEL_COLOR[modelA.type]}`}>
            🅰 {modelA.name}
          </h4>
          <p className="text-xs text-gray-400">{modelA.shortDesc}</p>
        </div>
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4">
          <h4 className={`text-sm font-bold mb-1 ${MODEL_COLOR[modelB.type]}`}>
            🅱 {modelB.name}
          </h4>
          <p className="text-xs text-gray-400">{modelB.shortDesc}</p>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 bg-white/5 border border-white/10 border-r-0 rounded-tl-lg text-gray-400 font-semibold uppercase tracking-wider">
                Propiedad
              </th>
              <th className={`text-left py-2 px-3 bg-white/5 border-y border-white/10 ${MODEL_COLOR[modelA.type]} font-bold`}>
                {modelA.name}
              </th>
              <th className={`text-left py-2 px-3 bg-white/5 border border-white/10 border-l-0 rounded-tr-lg ${MODEL_COLOR[modelB.type]} font-bold`}>
                {modelB.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {PROPERTY_TABLE.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors">
                <td className="py-2.5 px-3 border-b border-white/5 font-semibold text-gray-300">
                  {row.property}
                </td>
                <td className="py-2.5 px-3 border-b border-white/5 text-gray-400 leading-relaxed">
                  {row[keyA]}
                </td>
                <td className="py-2.5 px-3 border-b border-white/5 text-gray-400 leading-relaxed">
                  {row[keyB]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
