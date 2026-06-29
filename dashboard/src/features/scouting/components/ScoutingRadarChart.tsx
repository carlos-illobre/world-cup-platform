import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { CLUSTER_COLORS } from "../constants";

interface ScoutingRadarChartProps {
  playerData: any;
  clusterAverages: any;
}

const AXES = [
  { key: "pace", label: "Ritmo" },
  { key: "shooting", label: "Tiro" },
  { key: "passing", label: "Pase" },
  { key: "dribbling", label: "Regate" },
  { key: "defending", label: "Defensa" },
  { key: "physical", label: "Físico" },
];

export function ScoutingRadarChart({ playerData, clusterAverages }: ScoutingRadarChartProps) {
  if (!playerData || !clusterAverages) return null;

  const clusterId = playerData.cluster;
  const avg = clusterAverages[clusterId] || {};
  const playerColor = CLUSTER_COLORS[clusterId] || "#3b82f6";

  const chartData = AXES.map((axis) => {
    return {
      subject: axis.label,
      player: Number(playerData.attributes?.[axis.key] || 0),
      clusterAvg: Number(avg[axis.key] || 0),
      fullMark: 100,
    };
  });

  const hasData = chartData.some(d => d.player > 0);

  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-xl border border-white/5 bg-black/20 p-5 relative">
      <div className="absolute top-5 left-5 right-5">
        <h3 className="font-display text-xl font-bold text-white">Perfil Táctico vs Promedio del Clúster</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
          El área <strong className="text-white">coloreada</strong> muestra los atributos FIFA del jugador.
          El área <strong className="text-gray-400">gris</strong> es el promedio de todos los jugadores con el mismo perfil K-Means.
          Si el jugador supera al promedio en algún eje, tiene una ventaja comparativa en esa dimensión.
        </p>
      </div>
      <div className="mt-8 flex w-full flex-1 items-center justify-center">
        {!hasData ? (
          <div className="text-center text-sm text-gray-500">
            <p>Atributos no disponibles para este jugador.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#ccc", fontSize: 28 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#fff', fontSize: '12px' }}
            />
            {/* Promedio del Cluster - Sombreado de fondo */}
            <Radar
              name={`Promedio Clúster ${clusterId}`}
              dataKey="clusterAvg"
              stroke="rgba(255,255,255,0.3)"
              fill="rgba(255,255,255,0.1)"
              fillOpacity={0.5}
            />
            {/* Jugador - Línea sólida brillante */}
            <Radar
              name={playerData.name}
              dataKey="player"
              stroke={playerColor}
              strokeWidth={3}
              fill={playerColor}
              fillOpacity={0.4}
              style={{ filter: `drop-shadow(0 0 6px ${playerColor})` }}
            />
          </RadarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
