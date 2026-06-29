import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Label } from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";
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

// Color by quadrant position (meaningful for this chart's axes)
function getMoneyballColor(age: number, impact: number, meanAge: number, meanImpact: number): string {
  if (age < meanAge && impact > meanImpact) return "#4ade80"; // green — young + high impact (hidden gem)
  if (age >= meanAge && impact > meanImpact) return "#facc15"; // yellow — established star
  if (age < meanAge && impact <= meanImpact) return "#94a3b8"; // gray — developing
  return "#ef4444"; // red — declining
}

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
          Cada punto es un jugador. <strong className="text-white">Eje horizontal</strong> = edad, 
          <strong className="text-white">eje vertical</strong> = cuánto aporta al equipo. 
          Las líneas punteadas marcan los promedios. Los cuadrantes te indican qué tipo de jugador es.
        </p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 py-2 text-sm">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#4ade80]" /> Joya oculta (joven + alto impacto)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#facc15]" /> Estrella consolidada</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#94a3b8]" /> En desarrollo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#ef4444]" /> Rendimiento decreciente</span>
      </div>
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
              label={{ value: "Edad del jugador →", position: "bottom", fill: "#aaa", fontSize: 12, offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="impact_score"
              name="Impact Score"
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Impact Score (aporte al equipo) ↑", angle: -90, position: "insideLeft", fill: "#aaa", fontSize: 12 }}
            />
            {/* Quadrant reference lines */}
            <ReferenceLine x={meanAge} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <ReferenceLine y={meanImpact} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            {/* Quadrant labels */}
            <ReferenceLine y={meanImpact + (meanImpact * 0.8)} stroke="transparent">
              <Label value="🌟 Joya oculta" position="insideTopLeft" fill="rgba(74,222,128,0.6)" fontSize={11} />
            </ReferenceLine>
            <ReferenceLine y={meanImpact + (meanImpact * 0.8)} stroke="transparent">
              <Label value="⚡ Estrella consolidada" position="insideTopRight" fill="rgba(250,204,21,0.6)" fontSize={11} />
            </ReferenceLine>
            <ReferenceLine y={meanImpact - (Math.abs(meanImpact) * 0.8)} stroke="transparent">
              <Label value="📈 En desarrollo" position="insideBottomLeft" fill="rgba(148,163,184,0.5)" fontSize={11} />
            </ReferenceLine>
            <ReferenceLine y={meanImpact - (Math.abs(meanImpact) * 0.8)} stroke="transparent">
              <Label value="⚠️ Rendimiento decreciente" position="insideBottomRight" fill="rgba(239,68,68,0.5)" fontSize={11} />
            </ReferenceLine>
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.15)' }} />
            <Scatter name="Jugadores" data={validData}>
              {validData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getMoneyballColor(entry.age, Number(entry.impact_score), meanAge, meanImpact)} opacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
