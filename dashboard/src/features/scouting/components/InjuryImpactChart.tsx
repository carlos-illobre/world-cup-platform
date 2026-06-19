import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";
import { ClusterLegend } from "./ClusterLegend";
import { useMemo } from "react";

interface InjuryImpactChartProps {
  data: any[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-1 font-display font-bold text-white">{d.name}</p>
        <p className="text-xs text-gray-200">
          Lesiones históricas: <span className="font-bold text-red-400">{d.total_injuries}</span>
        </p>
        <p className="text-xs text-gray-200">
          Impact Score: <span className="font-bold text-neon-blue">{Number(d.impact_score).toFixed(2)}</span>
        </p>
        <p className="text-xs text-gray-200">
          Adjusted Score: <span className={`font-bold ${d.adjusted > 0 ? "text-green-400" : "text-red-400"}`}>
            {d.adjusted?.toFixed(1)}
          </span>
        </p>
        <p className="text-xs text-gray-200">
          Perfil: <span style={{ color: CLUSTER_COLORS[d.cluster] || "#fff" }}>
            {CLUSTER_NAMES[d.cluster] || d.cluster}
          </span>
        </p>
        <p className="text-xs text-gray-200 mt-1">{d.country} • {d.club}</p>
      </div>
    );
  }
  return null;
};

export function InjuryImpactChart({ data }: InjuryImpactChartProps) {
  const validData = useMemo(() => {
    return data
      .filter((p) => p.total_injuries != null && p.impact_score != null)
      .map((p) => ({
        ...p,
        // Simulated adjusted_score = impact - (injuries * 5 penalty factor)
        adjusted: Number(p.impact_score) - (Number(p.total_injuries) * 0.3),
      }));
  }, [data]);

  const meanInjuries = useMemo(() => {
    if (validData.length === 0) return 0;
    return validData.reduce((s, p) => s + Number(p.total_injuries), 0) / validData.length;
  }, [validData]);

  return (
    <div className="flex h-[450px] w-full flex-col rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-3">
        <h3 className="font-display text-xl font-bold text-white">
          Trade-Off: Impacto vs Riesgo de Lesión
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
          Visualiza la tensión central del <strong className="text-white">Squad Optimizer</strong>: 
          el algoritmo de Programación Lineal penaliza 5 puntos por cada lesión histórica. 
          Los jugadores en el cuadrante <strong className="text-green-400">superior izquierdo</strong> (alto impacto + pocas lesiones) 
          son los candidatos ideales. Los del <strong className="text-red-400">inferior derecho</strong> 
          (bajo impacto + muchas lesiones) probablemente fueron excluidos de la plantilla óptima.
        </p>
      </div>
      <ClusterLegend />
      <div className="flex-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="total_injuries"
              name="Lesiones"
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Lesiones históricas →", position: "bottom", fill: "#aaa", fontSize: 13, offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="impact_score"
              name="Impact Score"
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Impact Score ↑", angle: -90, position: "insideLeft", fill: "#aaa", fontSize: 13 }}
            />
            <ReferenceLine x={meanInjuries} stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }} />
            <Scatter name="Jugadores" data={validData} opacity={0.75}>
              {validData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CLUSTER_COLORS[entry.cluster] || "#aaa4d8"}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
