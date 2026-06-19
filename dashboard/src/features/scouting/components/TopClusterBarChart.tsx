import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";

interface TopClusterBarChartProps {
  data: any[];
  clusterId: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-white/10 bg-black/80 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-1 font-display font-bold text-white">{data.name}</p>
        <p className="text-xs text-gray-300">Club: <span className="font-semibold text-white">{data.club}</span></p>
        <p className="text-xs text-gray-300">Impacto: <span className="font-semibold text-neon-blue">{Number(data.impact_score).toFixed(2)}</span></p>
      </div>
    );
  }
  return null;
};

export function TopClusterBarChart({ data, clusterId }: TopClusterBarChartProps) {
  const color = CLUSTER_COLORS[clusterId] || "#3b82f6";
  const clusterName = CLUSTER_NAMES[clusterId] || `Clúster ${clusterId}`;

  // Reverse data so the highest impact is at the top of the horizontal bar chart
  const reversedData = [...data].reverse();

  return (
    <div className="flex h-[400px] w-full flex-col rounded-xl border border-white/5 bg-black/20 p-5">
      <div className="mb-4">
        <h3 className="font-display text-xl font-bold text-white">Ranking Mundial: {clusterName}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
          Los 10 jugadores con mayor <strong className="text-white">Impact Score</strong> dentro de este perfil táctico.
          El Impact Score se calcula como la suma estandarizada de G+A/90, PPM del equipo y diferencial On/Off.
          Útil para scouting de reemplazos con el mismo molde táctico.
        </p>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={reversedData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
            <XAxis 
              type="number" 
              dataKey="impact_score" 
              tick={{ fill: "#bbb", fontSize: 13 }} 
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={120}
              tick={{ fill: "#ddd", fontSize: 13 }} 
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
            <Bar dataKey="impact_score" radius={[0, 4, 4, 0]}>
              {reversedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
