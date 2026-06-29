import { useState, useEffect, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";
import { fetchJson } from "@/shared/lib/apiClient";

interface ScatterPoint {
  name: string;
  cluster: string;
  country: string;
  pc1: number;
  pc2: number;
}

interface ClusterScatterResponse {
  items: ScatterPoint[];
  explained_variance: number[];
  total_explained: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as ScatterPoint;
    return (
      <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-1 font-display font-bold text-white">{d.name}</p>
        <p className="text-xs text-gray-200">
          País: <span className="font-semibold text-white">{d.country}</span>
        </p>
        <p className="text-xs text-gray-200">
          Perfil:{" "}
          <span
            className="font-semibold"
            style={{ color: CLUSTER_COLORS[d.cluster] || "#fff" }}
          >
            {CLUSTER_NAMES[d.cluster] || `Cluster ${d.cluster}`}
          </span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PC1: {d.pc1.toFixed(3)} | PC2: {d.pc2.toFixed(3)}
        </p>
      </div>
    );
  }
  return null;
};

export function ClusterScatterChart() {
  const [data, setData] = useState<ClusterScatterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchJson<ClusterScatterResponse>("/api/v1/players/clusters/scatter")
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Group data by cluster for separate Scatter series (enables legend)
  const clusterGroups = useMemo(() => {
    if (!data?.items) return {};
    const groups: Record<string, ScatterPoint[]> = {};
    for (const point of data.items) {
      if (!groups[point.cluster]) groups[point.cluster] = [];
      groups[point.cluster].push(point);
    }
    return groups;
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-purple-300 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
        </div>
        <span className="text-sm text-gray-500">
          Calculando PCA sobre los 10 features del clustering...
        </span>
      </div>
    );
  }

  if (error || !data || data.items.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No se pudo cargar la visualización de clusters (backend no disponible).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-200">
            Visualización 2D de Clusters (PCA)
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            Proyección de las 10 dimensiones a 2 componentes principales.
            Varianza explicada: <strong className="text-purple-300">{(data.total_explained * 100).toFixed(1)}%</strong>
            {" "}(PC1: {(data.explained_variance[0] * 100).toFixed(1)}%, PC2: {(data.explained_variance[1] * 100).toFixed(1)}%)
          </p>
        </div>
        <span className="text-xs text-gray-500 bg-black/40 px-2 py-1 rounded">
          {data.items.length} jugadores
        </span>
      </div>

      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              type="number"
              dataKey="pc1"
              name="PC1"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{
                value: "Componente Principal 1",
                position: "bottom",
                offset: 15,
                style: { fill: "#9ca3af", fontSize: 12 },
              }}
            />
            <YAxis
              type="number"
              dataKey="pc2"
              name="PC2"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{
                value: "Componente Principal 2",
                angle: -90,
                position: "left",
                offset: 5,
                style: { fill: "#9ca3af", fontSize: 12 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value: string) => (
                <span className="text-xs text-gray-300">{value}</span>
              )}
            />
            {Object.entries(clusterGroups).map(([clusterId, points]) => (
              <Scatter
                key={clusterId}
                name={CLUSTER_NAMES[clusterId] || `Cluster ${clusterId}`}
                data={points}
                fill={CLUSTER_COLORS[clusterId] || "#888"}
              >
                {points.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={CLUSTER_COLORS[clusterId] || "#888"}
                    fillOpacity={0.7}
                    stroke={CLUSTER_COLORS[clusterId] || "#888"}
                    strokeOpacity={0.9}
                    r={4}
                  />
                ))}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        <strong className="text-gray-300">¿Qué es PCA?</strong> Principal Component Analysis reduce las 10 dimensiones
        originales a 2 ejes que capturan la mayor variabilidad posible. Jugadores cercanos en este gráfico
        tienen estadísticas similares. Los colores representan los 5 clusters asignados por K-Means.
        La separación visual entre grupos confirma que el clustering encontró patrones reales en los datos.
      </p>
    </div>
  );
}
