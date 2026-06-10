import { RADAR_AXES } from "@/constants/radar-axes";
import type { RadarMetrics } from "@/lib/predictions.types";

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 72;

function getPoint(index: number, value: number) {
  const angle = (Math.PI * 2 * index) / RADAR_AXES.length - Math.PI / 2;
  const radius = (value / 100) * RADIUS;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function getLabelPoint(index: number) {
  const angle = (Math.PI * 2 * index) / RADAR_AXES.length - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * (RADIUS + 18),
    y: CENTER + Math.sin(angle) * (RADIUS + 16),
  };
}

/** Gráfico radar de métricas fisiológicas del jugador. */
export function RadarChart({ data }: { data: RadarMetrics }) {
  const polygon = RADAR_AXES.map((axis, index) => {
    const point = getPoint(index, data[axis.key]);
    return `${point.x},${point.y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="oklch(0.82 0.22 142 / 0.55)" />
          <stop offset="50%" stopColor="oklch(0.72 0.18 232 / 0.4)" />
          <stop offset="100%" stopColor="oklch(0.6 0.24 320 / 0.35)" />
        </radialGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={RADAR_AXES.map((_, index) => {
            const point = getPoint(index, scale * 100);
            return `${point.x},${point.y}`;
          }).join(" ")}
          fill="none"
          stroke="oklch(0.6 0.05 240 / 0.18)"
          strokeWidth={1}
        />
      ))}

      {RADAR_AXES.map((_, index) => {
        const point = getPoint(index, 100);
        return (
          <line
            key={index}
            x1={CENTER}
            y1={CENTER}
            x2={point.x}
            y2={point.y}
            stroke="oklch(0.6 0.05 240 / 0.18)"
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={polygon}
        fill="url(#radarFill)"
        stroke="oklch(0.82 0.22 142 / 0.9)"
        strokeWidth={1.5}
        style={{ filter: "drop-shadow(0 0 6px oklch(0.82 0.22 142 / 0.5))" }}
      />

      {RADAR_AXES.map((axis, index) => {
        const point = getPoint(index, data[axis.key]);
        return <circle key={axis.key} cx={point.x} cy={point.y} r={2.5} fill={axis.color} />;
      })}

      {RADAR_AXES.map((axis, index) => {
        const labelPoint = getLabelPoint(index);
        return (
          <text
            key={axis.key}
            x={labelPoint.x}
            y={labelPoint.y}
            fontSize={7.5}
            fontWeight={700}
            letterSpacing={0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="oklch(0.78 0.03 240)"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}
