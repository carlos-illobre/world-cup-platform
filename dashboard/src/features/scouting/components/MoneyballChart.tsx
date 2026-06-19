import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";
import { ClusterLegend } from "./ClusterLegend";
import { useMemo } from "react";

interface MoneyballChartProps {
  data: any[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-1 font-display font-bold text-white">{d.name}</p>
        <p className="text-xs text-gray-200">Edad: <span className="font-semibold text-white">{d.age?.toFixed(1)}</span></p>
        <p className="text-xs text-gray-200">Impact Score: <span className="font-semibold text-neon-blue">{Number(d.impact_score).toFixed(2)}</span></p>
        <p className="text-xs text-gray-200">Perfil: <span className="font-semibold" style={{ color: CLUSTER_COLORS[d.cluster] || "#fff" }}>
          {CLUSTER_NAMES[d.cluster] || d.cluster}
        </span></p>
        <p className="text-xs text-gray-200 mt-1">{d.country} • {d.club}</p>
      </div>
    );
  }
  return null;
};

export function MoneyballChart({ data }: MoneyballChartProps) {
  const { validData, meanAge, meanImpact } = useMemo(() => {
    const valid = data.filter((p) => p.age != null && p.impact_score != null);
    const mAge = valid.length > 0 ? valid.reduce((s, p) => s + p.age, 0) / valid.length : 27;
    const mImpact = valid.length > 0 ? valid.reduce((s, p) => s + Number(p.impact_score), 0) / valid.length : 0;
    return { validData: valid, meanAge: mAge, meanImpact: mImpact };
  }, [data]);

  return (
    <div className="flex h-[450px] w-full flex-col rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-3">
        <h3 className="font-display text-xl font-bold text-white">Moneyball: Impacto vs Edad</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
          Identifica <strong className="text-green-400">oportunidades de scouting</strong> en el cuadrante 
          <strong className="text-neon-blue"> superior izquierdo</strong> (jóvenes con alto impacto = 
          mayor ventana de retorno sobre la inversión). Los jugadores en el cuadrante inferior derecho
          son veteranos con impacto decreciente.
        </p>
      </div>
      <ClusterLegend />
      <div className="flex-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="age"
              name="Edad"
              domain={['dataMin - 1', 'dataMax + 1']}
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Edad →", position: "bottom", fill: "#aaa", fontSize: 13, offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="impact_score"
              name="Impact Score"
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Impact Score ↑", angle: -90, position: "insideLeft", fill: "#aaa", fontSize: 13 }}
            />
            {/* Quadrant reference lines */}
            <ReferenceLine x={meanAge} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <ReferenceLine y={meanImpact} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.15)' }} />
            <Scatter name="Jugadores" data={validData}>
              {validData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CLUSTER_COLORS[entry.cluster] || "#aaa4d8"} opacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
