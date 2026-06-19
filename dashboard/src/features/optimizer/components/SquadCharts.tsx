import { useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ReferenceLine,
} from "recharts";

// Position colors
const POS_COLORS: Record<string, string> = {
  GK: "#eab308",
  DF: "#10b981",
  MF: "#3b82f6",
  FW: "#f43f5e",
};

const POS_LABELS: Record<string, string> = {
  GK: "Porteros",
  DF: "Defensores",
  MF: "Mediocampistas",
  FW: "Delanteros",
};

interface SquadChartsProps {
  players: any[];
}

// --- 1. Position Distribution Donut ---
function PositionDonut({ players }: SquadChartsProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
    players.forEach((p) => {
      const pos = p.position_category || "MF";
      if (pos in counts) counts[pos]++;
      else counts["MF"]++;
    });
    return Object.entries(counts).map(([pos, count]) => ({
      name: POS_LABELS[pos] || pos,
      value: count,
      pos,
    }));
  }, [players]);

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-5 flex flex-col">
      <h4 className="font-display text-lg font-bold text-white mb-1">Distribución por Posición</h4>
      <p className="text-sm text-muted-foreground mb-3">
        Composición del plantel seleccionado por línea. El optimizer respeta: 3 GK, 7-10 DF, 6-10 MF, 5-8 FW.
      </p>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              stroke="none"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {data.map((entry) => (
                <Cell key={entry.pos} fill={POS_COLORS[entry.pos] || "#888"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              itemStyle={{ color: "#fff" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        {data.map((d) => (
          <div key={d.pos} className="flex items-center gap-1.5 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: POS_COLORS[d.pos] }} />
            <span className="text-gray-200">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 2. Adjusted Score Bar Chart (ranked) ---
function AdjustedScoreRanking({ players }: SquadChartsProps) {
  const sorted = useMemo(() => {
    return [...players]
      .filter((p) => p.adjusted_score != null)
      .sort((a, b) => (a.adjusted_score ?? 0) - (b.adjusted_score ?? 0))
      .map((p) => ({
        name: p.name?.split(" ").slice(-1)[0] || "?", // Last name only for space
        fullName: p.name,
        adjusted_score: p.adjusted_score,
        position_category: p.position_category,
      }));
  }, [players]);

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-5 flex flex-col">
      <h4 className="font-display text-lg font-bold text-white mb-1">Ranking por Adjusted Score</h4>
      <p className="text-sm text-muted-foreground mb-3">
        Score de impacto penalizado por lesiones. Verde = contribución neta positiva. Rojo = el riesgo médico reduce su aporte.
      </p>
      <div className="flex-1 min-h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#bbb", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
            <YAxis
              type="category"
              dataKey="name"
              width={70}
              tick={{ fill: "#ddd", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              formatter={(value: number, _name: string, props: any) => [
                `${value.toFixed(1)}`,
                `${props.payload.fullName} (${props.payload.position_category})`,
              ]}
              labelStyle={{ color: "#fff" }}
            />
            <Bar dataKey="adjusted_score" radius={[0, 4, 4, 0]}>
              {sorted.map((entry, i) => (
                <Cell
                  key={i}
                  fill={(entry.adjusted_score ?? 0) >= 0 ? "#10b981" : "#f43f5e"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- 3. Age vs Adjusted Score Scatter ---
function AgeVsAdjustedScatter({ players }: SquadChartsProps) {
  const data = useMemo(() => {
    return players
      .filter((p) => p.age != null && p.adjusted_score != null)
      .map((p) => ({
        age: p.age,
        adjusted_score: p.adjusted_score,
        name: p.name,
        position_category: p.position_category,
      }));
  }, [players]);

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-5 flex flex-col">
      <h4 className="font-display text-lg font-bold text-white mb-1">Edad vs Score Ajustado</h4>
      <p className="text-sm text-muted-foreground mb-3">
        Detecta si el optimizer favoreció juventud o experiencia. Cuadrante superior izquierdo = pilares futuros del equipo.
      </p>
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 25, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="age"
              name="Edad"
              domain={["dataMin - 1", "dataMax + 1"]}
              tick={{ fill: "#bbb", fontSize: 12 }}
              label={{ value: "Edad →", position: "bottom", fill: "#aaa", fontSize: 12, offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="adjusted_score"
              name="Adj. Score"
              tick={{ fill: "#bbb", fontSize: 12 }}
              label={{ value: "Adj. Score ↑", angle: -90, position: "insideLeft", fill: "#aaa", fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              formatter={(value: number) => value.toFixed(1)}
              labelFormatter={() => ""}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl text-sm">
                    <p className="font-bold text-white">{d.name}</p>
                    <p className="text-gray-200">Edad: {d.age?.toFixed(1)} • {d.position_category}</p>
                    <p className="text-gray-200">Adj. Score: <span className={d.adjusted_score >= 0 ? "text-green-400" : "text-red-400"}>{d.adjusted_score?.toFixed(1)}</span></p>
                  </div>
                );
              }}
            />
            <Scatter name="Jugadores" data={data}>
              {data.map((entry, i) => (
                <Cell key={i} fill={POS_COLORS[entry.position_category] || "#888"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        {Object.entries(POS_LABELS).map(([pos, label]) => (
          <div key={pos} className="flex items-center gap-1.5 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: POS_COLORS[pos] }} />
            <span className="text-gray-200">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 4. Injuries by Position (Stacked Bar) ---
function InjuriesByPosition({ players }: SquadChartsProps) {
  const data = useMemo(() => {
    const groups: Record<string, { total: number; count: number }> = {};
    players.forEach((p) => {
      const pos = p.position_category || "MF";
      if (!groups[pos]) groups[pos] = { total: 0, count: 0 };
      groups[pos].total += p.total_injuries || 0;
      groups[pos].count++;
    });
    return Object.entries(groups).map(([pos, { total, count }]) => ({
      position: POS_LABELS[pos] || pos,
      pos,
      totalInjuries: total,
      avgInjuries: count > 0 ? +(total / count).toFixed(1) : 0,
      players: count,
    }));
  }, [players]);

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-5 flex flex-col">
      <h4 className="font-display text-lg font-bold text-white mb-1">Carga de Lesiones por Línea</h4>
      <p className="text-sm text-muted-foreground mb-3">
        Total de lesiones históricas acumuladas por posición. Identifica dónde se concentra el riesgo médico del plantel.
      </p>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="position" tick={{ fill: "#ddd", fontSize: 13 }} axisLine={false} />
            <YAxis tick={{ fill: "#bbb", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              formatter={(value: number, name: string) => {
                if (name === "totalInjuries") return [`${value} lesiones`, "Total"];
                return [value, name];
              }}
              labelStyle={{ color: "#fff", fontWeight: "bold" }}
            />
            <Bar dataKey="totalInjuries" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.pos} fill={POS_COLORS[entry.pos] || "#888"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Avg injuries per player */}
      <div className="flex justify-center gap-5 mt-2 text-sm text-gray-200">
        {data.map((d) => (
          <span key={d.pos}>
            {d.position}: <strong>{d.avgInjuries}</strong> promedio/jugador
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Combined Export ---
export function SquadCharts({ players }: SquadChartsProps) {
  if (!players || players.length === 0) return null;

  return (
    <div className="space-y-6 mt-8">
      <h3 className="text-xl font-display font-bold text-white border-b border-white/10 pb-2">
        📊 Análisis Visual del Plantel
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PositionDonut players={players} />
        <InjuriesByPosition players={players} />
      </div>
      <AdjustedScoreRanking players={players} />
      <AgeVsAdjustedScatter players={players} />
    </div>
  );
}
