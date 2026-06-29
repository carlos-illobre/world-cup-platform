import { X, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";
import { CLUSTER_NAMES, CLUSTER_COLORS } from "../constants";

interface ComparePanelProps {
  players: any[];
  onRemove: (id: string) => void;
  onClose: () => void;
}

const COMPARE_COLORS = ["#00f0ff", "#f43f5e", "#eab308", "#10b981"];

const RADAR_AXES = [
  { key: "pace", label: "Ritmo" },
  { key: "shooting", label: "Tiro" },
  { key: "passing", label: "Pase" },
  { key: "dribbling", label: "Regate" },
  { key: "defending", label: "Defensa" },
  { key: "physical", label: "Físico" },
];

function getVerdict(players: any[]): string {
  if (players.length < 2) return "";
  
  // Score each player: impact (40%) + xg_overperf (20%) + low injuries (20%) + overall (20%)
  const scored = players.map((p) => {
    const impact = Number(p.impact_score) || 0;
    const xg = Number(p.xg_overperformance) || 0;
    const injuries = Number(p.total_injuries) || 0;
    const overall = Number(p.attributes?.overall) || 0;
    const composite = impact * 0.4 + xg * 0.2 + (1 - injuries / 20) * 0.2 + (overall / 100) * 0.2;
    return { ...p, composite };
  });
  
  scored.sort((a, b) => b.composite - a.composite);
  const best = scored[0];
  const second = scored[1];
  
  const diff = ((best.composite - second.composite) / Math.abs(second.composite || 1)) * 100;
  
  if (diff > 30) {
    return `${best.name} es claramente superior: mayor impacto, mejor eficiencia goleadora y menor riesgo combinado.`;
  } else if (diff > 10) {
    return `${best.name} tiene ventaja por balance global (impacto + salud + eficiencia), pero ${second.name} puede ser mejor en nichos específicos.`;
  } else {
    return `Están muy parejos. La decisión depende del contexto táctico: revisa los atributos FIFA y el perfil para elegir según la necesidad del equipo.`;
  }
}

export function ComparePanel({ players, onRemove, onClose }: ComparePanelProps) {
  if (players.length === 0) return null;

  // Build radar data
  const radarData = RADAR_AXES.map((axis) => {
    const point: any = { subject: axis.label };
    players.forEach((p, i) => {
      point[`player${i}`] = Number(p.attributes?.[axis.key]) || 0;
    });
    return point;
  });

  // Metrics comparison table
  const metrics = [
    { key: "impact_score", label: "Impact Score", format: (v: any) => v != null ? Number(v).toFixed(2) : "—", higher: true },
    { key: "xg_overperformance", label: "xG Overperf", format: (v: any) => v != null ? (Number(v) > 0 ? "+" : "") + Number(v).toFixed(3) : "—", higher: true },
    { key: "total_injuries", label: "Lesiones", format: (v: any) => v != null ? String(v) : "—", higher: false },
    { key: "age", label: "Edad", format: (v: any) => v != null ? String(Math.floor(v)) : "—", higher: false },
    { key: "overall", label: "Overall FIFA", format: (v: any) => v != null ? String(v) : "—", higher: true, nested: "attributes" },
  ];

  const verdict = players.length >= 2 ? getVerdict(players) : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* Panel */}
      <div className="relative w-full max-w-5xl mx-4 bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">
              Comparación de Jugadores
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {players.length} jugador{players.length !== 1 ? "es" : ""} seleccionado{players.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Headers */}
        <div className="grid gap-4 p-6" style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}>
          {players.map((p, i) => (
            <div key={p.id} className="relative flex flex-col items-center text-center p-4 rounded-xl border border-white/5 bg-black/30">
              <button
                onClick={() => onRemove(p.id)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="w-16 h-16 rounded-full object-cover border-2 mb-2" style={{ borderColor: COMPARE_COLORS[i] }} />
              ) : (
                <div className="w-16 h-16 rounded-full bg-black/50 border-2 flex items-center justify-center mb-2" style={{ borderColor: COMPARE_COLORS[i] }}>
                  <span className="text-xl font-bold text-gray-300">{p.name.charAt(0)}</span>
                </div>
              )}
              <h3 className="font-bold text-white text-sm">{p.name}</h3>
              <p className="text-xs text-gray-400">{p.country} • {p.position}</p>
              <p className="text-xs text-gray-500">{p.club}</p>
              <span className="mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${CLUSTER_COLORS[p.cluster]}20`, color: CLUSTER_COLORS[p.cluster] }}>
                {CLUSTER_NAMES[p.cluster] || "—"}
              </span>
            </div>
          ))}
        </div>

        {/* Radar Chart Overlay */}
        <div className="px-6 pb-4">
          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-300 mb-2">Comparación de Atributos FIFA</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#ccc", fontSize: 26 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  {players.map((p, i) => (
                    <Radar
                      key={p.id}
                      name={p.name}
                      dataKey={`player${i}`}
                      stroke={COMPARE_COLORS[i]}
                      fill={COMPARE_COLORS[i]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: "12px", color: "#ccc" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Metrics Table */}
        <div className="px-6 pb-4">
          <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-bold text-gray-400 p-3 uppercase tracking-wider">Métrica</th>
                  {players.map((p, i) => (
                    <th key={p.id} className="text-center text-xs font-bold p-3 uppercase tracking-wider" style={{ color: COMPARE_COLORS[i] }}>
                      {p.name.split(" ").pop()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => {
                  const values = players.map((p) => {
                    const raw = metric.nested ? p[metric.nested]?.[metric.key] : p[metric.key];
                    return raw != null ? Number(raw) : null;
                  });
                  const validValues = values.filter((v): v is number => v != null);
                  const best = metric.higher
                    ? Math.max(...validValues)
                    : Math.min(...validValues);

                  return (
                    <tr key={metric.key} className="border-b border-white/5 last:border-0">
                      <td className="text-sm text-gray-300 p-3 font-medium">{metric.label}</td>
                      {players.map((p, i) => {
                        const raw = metric.nested ? p[metric.nested]?.[metric.key] : p[metric.key];
                        const numVal = raw != null ? Number(raw) : null;
                        const isBest = numVal != null && numVal === best && validValues.length > 1;
                        return (
                          <td key={p.id} className="text-center p-3">
                            <span className={`text-sm font-bold ${isBest ? "text-green-400" : "text-white"}`}>
                              {metric.format(raw)}
                            </span>
                            {isBest && <Trophy className="inline w-3 h-3 ml-1 text-green-400" />}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Verdict */}
        {verdict && (
          <div className="px-6 pb-6">
            <div className="bg-gradient-to-r from-neon-blue/5 to-purple-500/5 border border-neon-blue/20 rounded-xl p-4">
              <h3 className="text-sm font-bold text-neon-blue mb-2 flex items-center gap-2">
                🤖 Veredicto del Algoritmo
              </h3>
              <p className="text-sm text-gray-200 leading-relaxed">{verdict}</p>
              <p className="text-xs text-gray-300 mt-2">
                Basado en: Impact Score (40%) + xG Overperformance (20%) + Historial de Lesiones (20%) + Overall FIFA (20%)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
