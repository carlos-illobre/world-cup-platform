import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Label } from "recharts";
import { CLUSTER_COLORS, CLUSTER_NAMES } from "../constants";
import { useMemo } from "react";

interface InjuryImpactChartProps {
  data: any[];
}

// Color by quadrant: impact vs injuries
function getInjuryColor(injuries: number, impact: number, meanInjuries: number): string {
  if (injuries <= meanInjuries && impact > 0) return "#4ade80"; // green — ideal (high impact, low injuries)
  if (injuries > meanInjuries && impact > 0) return "#facc15"; // yellow — talent but fragile
  if (injuries <= meanInjuries && impact <= 0) return "#94a3b8"; // gray — safe but low impact
  return "#ef4444"; // red — risky and low impact
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
    return data.filter((p) => p.total_injuries != null && p.impact_score != null);
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
          Cada punto es un jugador. <strong className="text-white">Eje horizontal</strong> = cuántas lesiones ha tenido en su carrera. 
          <strong className="text-white">Eje vertical</strong> = cuánto aporta al equipo. 
          El algoritmo de selección óptima penaliza jugadores con muchas lesiones, 
          por eso los del cuadrante <strong className="text-green-400">superior izquierdo</strong> son los candidatos ideales.
        </p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 py-2 text-sm">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#4ade80]" /> Ideal (alto impacto + sano)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#facc15]" /> Talentoso pero frágil</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#94a3b8]" /> Seguro pero bajo impacto</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#ef4444]" /> No recomendado</span>
      </div>
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
              label={{ value: "Nº de lesiones en su carrera →", position: "bottom", fill: "#aaa", fontSize: 12, offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="impact_score"
              name="Impact Score"
              tick={{ fill: "#bbb", fontSize: 13 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              label={{ value: "Impact Score (aporte al equipo) ↑", angle: -90, position: "insideLeft", fill: "#aaa", fontSize: 12 }}
            />
            <ReferenceLine x={meanInjuries} stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            {/* Quadrant labels */}
            <ReferenceLine y={2} stroke="transparent">
              <Label value="✅ Ideal: alto impacto + pocas lesiones" position="insideTopLeft" fill="rgba(74,222,128,0.6)" fontSize={10} />
            </ReferenceLine>
            <ReferenceLine y={2} stroke="transparent">
              <Label value="⚠️ Alto impacto pero frágil" position="insideTopRight" fill="rgba(250,204,21,0.6)" fontSize={10} />
            </ReferenceLine>
            <ReferenceLine y={-2} stroke="transparent">
              <Label value="🔄 Bajo perfil pero sano" position="insideBottomLeft" fill="rgba(148,163,184,0.5)" fontSize={10} />
            </ReferenceLine>
            <ReferenceLine y={-2} stroke="transparent">
              <Label value="❌ Bajo impacto + lesiones" position="insideBottomRight" fill="rgba(239,68,68,0.5)" fontSize={10} />
            </ReferenceLine>
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }} />
            <Scatter name="Jugadores" data={validData} opacity={0.75}>
              {validData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getInjuryColor(Number(entry.total_injuries), Number(entry.impact_score), meanInjuries)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
