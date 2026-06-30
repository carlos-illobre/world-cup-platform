import { useState, useEffect, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { fetchJson } from "@/shared/lib/apiClient";

interface ScatterPoint {
  name: string;
  cluster: string;
  country: string;
  pc1: number;
  pc2: number;
  probability?: number;
}

const HDBSCAN_COLORS: Record<string, string> = {
  "-1": "#444444",
  "0": "#f59e0b",
  "1": "#ef4444",
  "2": "#8b5cf6",
  "3": "#06b6d4",
  "4": "#10b981",
  "5": "#f97316",
  "6": "#ec4899",
  "7": "#3b82f6",
  "8": "#a855f7",
  "9": "#eab308",
  "10": "#6b7280",
  "11": "#374151",
};

const HDBSCAN_NAMES: Record<string, string> = {
  "-1": "Polivalente (sin perfil puro)",
  "0": "Atacante de Volumen",
  "1": "Destructor Puro",
  "2": "Mediocampista Combativo",
  "3": "Ancla Defensiva",
  "4": "Creador Letal",
  "5": "Goleador Puro",
  "6": "Mediapunta Resolutivo",
  "7": "Asistidor Especialista",
  "8": "Finalizador Discreto",
  "9": "Oportunista de Área",
  "10": "Portero / Inactivo",
  "11": "Suplente sin Minutos",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as ScatterPoint;
    const isNoise = d.cluster === "-1";
    return (
      <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-1 font-display font-bold text-white">{d.name}</p>
        <p className="text-xs text-gray-200">
          País: <span className="font-semibold text-white">{d.country}</span>
        </p>
        <p className="text-xs text-gray-200">
          Cluster:{" "}
          <span className="font-semibold" style={{ color: HDBSCAN_COLORS[d.cluster] || "#888" }}>
            {isNoise ? "Ruido (no asignado)" : `Cluster ${d.cluster}`}
          </span>
        </p>
        {d.probability != null && (
          <p className="text-xs text-gray-400 mt-1">
            Probabilidad: {(d.probability * 100).toFixed(0)}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function HdbscanScatterChart() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<any>("/api/v1/models/compare/clustering/scatter")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const hdbscanGroups = useMemo(() => {
    if (!data?.hdbscan) return {};
    const groups: Record<string, ScatterPoint[]> = {};
    for (const point of data.hdbscan) {
      if (!groups[point.cluster]) groups[point.cluster] = [];
      groups[point.cluster].push(point);
    }
    return groups;
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
        </div>
        <span className="text-sm text-gray-500">Cargando scatter HDBSCAN...</span>
      </div>
    );
  }

  if (!data || !data.hdbscan || data.hdbscan.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No se pudo cargar la visualización HDBSCAN.
      </div>
    );
  }

  const noiseCount = (hdbscanGroups["-1"] || []).length;
  const clusteredCount = data.hdbscan.length - noiseCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-200">
            Visualización 2D — HDBSCAN
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            Misma proyección PCA. Puntos grises = ruido (no asignado).
            Varianza explicada: <strong className="text-cyan-300">{(data.total_explained * 100).toFixed(1)}%</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/30">
            {clusteredCount} clasificados
          </span>
          <span className="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded border border-white/10">
            {noiseCount} ruido
          </span>
        </div>
      </div>

      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number" dataKey="pc1" name="PC1"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{ value: "PC1", position: "bottom", offset: 15, style: { fill: "#9ca3af", fontSize: 12 } }}
            />
            <YAxis
              type="number" dataKey="pc2" name="PC2"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{ value: "PC2", angle: -90, position: "left", offset: 5, style: { fill: "#9ca3af", fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value: string) => <span className="text-xs text-gray-300">{value}</span>}
            />
            {/* Render noise first (background), then clusters on top */}
            {Object.entries(hdbscanGroups)
              .sort(([a], [b]) => (a === "-1" ? -1 : b === "-1" ? 1 : 0))
              .map(([clusterId, points]) => (
                <Scatter
                  key={clusterId}
                  name={HDBSCAN_NAMES[clusterId] || `Cluster ${clusterId}`}
                  data={points}
                  fill={HDBSCAN_COLORS[clusterId] || "#888"}
                >
                  {points.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={HDBSCAN_COLORS[clusterId] || "#888"}
                      fillOpacity={clusterId === "-1" ? 0.2 : 0.8}
                      r={clusterId === "-1" ? 2 : 5}
                    />
                  ))}
                </Scatter>
              ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        <strong className="text-gray-300">Interpretación:</strong> Los puntos de color intenso son
        jugadores que HDBSCAN asignó con alta confianza a un cluster (regiones de alta densidad).
        Los puntos grises pequeños son "ruido" — jugadores en zonas de transición entre perfiles
        que no encajan claramente en ningún grupo. Esto revela la naturaleza continua del fútbol:
        la mayoría de jugadores son polivalentes.
      </p>
    </div>
  );
}
