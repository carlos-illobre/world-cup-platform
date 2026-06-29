import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";
import { useMemo } from "react";

interface XgOverperfChartProps {
  data: any[];
}

// Color by xG overperformance value (the X axis — what this chart is about)
function getXgColor(xg: number): string {
  if (xg > 1) return "#4ade80";    // strong overperformer
  if (xg > 0) return "#86efac";    // slight overperformer
  if (xg > -1) return "#94a3b8";   // neutral
  return "#ef4444";                  // underperformer
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-1 font-display font-bold text-white">{d.name}</p>
        <p className="text-xs text-gray-200">xG Overperformance: <span className="font-semibold text-yellow-400">{Number(d.xg_overperformance).toFixed(3)}</span></p>
        <p className="text-xs text-gray-200">Impact Score: <span className="font-semibold text-neon-blue">{Number(d.impact_score).toFixed(2)}</span></p>
        <p className="text-xs text-gray-200">Perfil: <span className="font-semibold" style={{ color: CLUSTER_COLORS[d.cluster] || "#fff" }}>
          {CLUSTER_NAMES[d.cluster] || d.cluster}
        </span></p>
        <p className="text-xs text-gray-200 mt-1">{d.country} • {d.position}</p>
      </div>
    );
  }
  return null;
};

export function XgOverperfChart({ data }: XgOverperfChartProps) {
  const validData = useMemo(() => {
    return data.filter(
      (p) => p.xg_overperformance != null && p.impact_score != null
    );
  }, [data]);

  return (
    <div className="flex h-[450px] w-full flex-col rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-3">
        <h3 className="font-display text-xl font-bold text-white">xG Overperformance vs Impact Score</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
          <strong className="text-white">Eje horizontal:</strong> Diferencia entre goles reales y goles esperados 
          (positivo = mejor finalizador). <strong className="text-white">Eje vertical:</strong> Contribución total al equipo. 
          Los jugadores arriba a la derecha son los <strong className="text-yellow-400">perfiles más valiosos</strong>: 
          aportan mucho Y definen bien.
        </p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 py-2 text-sm">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#4ade80]" /> Supera ampliamente sus xG (+1)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#86efac]" /> Supera ligeramente sus xG</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#94a3b8]" /> Rendimiento normal</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#ef4444]" /> Desperdicia oportunidades (-1)</span>
      </div>
      <div className="flex-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="xg_overperformance"
              name="xG Overperformance"
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "xG Overperformance (goles reales - esperados) →", position: "bottom", fill: "#aaa", fontSize: 12, offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="impact_score"
              name="Impact Score"
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Impact Score (aporte al equipo) ↑", angle: -90, position: "insideLeft", fill: "#aaa", fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.15)' }} />
            <Scatter name="Jugadores" data={validData}>
              {validData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getXgColor(Number(entry.xg_overperformance))} opacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
