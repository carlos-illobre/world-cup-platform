import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis, ReferenceLine } from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";
import { ClusterLegend } from "./ClusterLegend";
import { useMemo } from "react";

interface BeeswarmChartProps {
  data: any[];
}

// Deterministic pseudo-random jitter based on string hash
function hashJitter(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return ((hash % 1000) / 1000 - 0.5) * 0.55;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-1 font-display font-bold text-white">{d.name}</p>
        <p className="text-xs text-gray-200">
          Impact Score: <span className="font-bold text-neon-blue">{Number(d.impact_score).toFixed(2)}</span>
        </p>
        <p className="text-xs text-gray-200">
          Perfil: <span className="font-semibold" style={{ color: CLUSTER_COLORS[d.original_cluster] || "#fff" }}>
            {CLUSTER_NAMES[d.original_cluster] || `Cluster ${d.original_cluster}`}
          </span>
        </p>
        <p className="text-xs text-gray-200 mt-1">{d.country} • {d.club}</p>
      </div>
    );
  }
  return null;
};

export function BeeswarmChart({ data }: BeeswarmChartProps) {
  const { jitteredData, globalMean } = useMemo(() => {
    const valid = data.filter((p) => p.impact_score != null && p.cluster != null);
    const mean = valid.length > 0
      ? valid.reduce((sum, p) => sum + Number(p.impact_score), 0) / valid.length
      : 0;

    const jittered = valid.map((p) => ({
      ...p,
      jittered_cluster: Number(p.cluster) + hashJitter(p.name || String(p.id)),
      original_cluster: String(p.cluster),
    }));

    return { jitteredData: jittered, globalMean: mean };
  }, [data]);

  return (
    <div className="flex h-[450px] w-full flex-col rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-3">
        <h3 className="font-display text-xl font-bold text-white">
          Distribución de Impact Score por Perfil Táctico
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
          Cada punto es un jugador posicionado horizontalmente según su <strong className="text-white">Impact Score</strong> (métrica compuesta de G+A/90 + PPM + On/Off) 
          y verticalmente por su perfil K-Means. La línea punteada marca el promedio global. 
          Los puntos a la derecha de la línea están rindiendo por encima del promedio.
        </p>
      </div>
      <ClusterLegend />
      <div className="flex-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              type="number"
              dataKey="impact_score"
              name="Impact Score"
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Impact Score →", position: "bottom", fill: "#aaa", fontSize: 13, offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="jittered_cluster"
              name="Perfil"
              domain={[-0.5, 4.5]}
              ticks={[0, 1, 2, 3, 4]}
              tickFormatter={(val) => {
                const names: Record<number, string> = { 0: "Defensor", 1: "Carrilero", 2: "Destructor", 3: "Creador", 4: "Goleador" };
                return names[val] || "";
              }}
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <ZAxis type="number" range={[25, 25]} />
            {/* Mean reference line */}
            <ReferenceLine
              x={globalMean}
              stroke="rgba(255,255,255,0.3)"
              strokeDasharray="4 4"
              label={{ value: `μ=${globalMean.toFixed(1)}`, fill: "#aaa", fontSize: 10, position: "top" }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }} />
            <Scatter name="Jugadores" data={jitteredData} opacity={0.75}>
              {jitteredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CLUSTER_COLORS[entry.original_cluster] || "#aaa4d8"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
