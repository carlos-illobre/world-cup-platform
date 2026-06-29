import { EJES_RADAR } from "@/shared/constants/radarAxes";
import type { MetricasRadar } from "@/shared/types/injuryRisk.types";

const RADAR_SIZE = 280;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 100;

function calcularPuntoPerfil(index: number, valor: number) {
  const angle = (Math.PI * 2 * index) / EJES_RADAR.length - Math.PI / 2;
  const radio = (valor / 100) * RADAR_RADIUS;
  return {
    x: RADAR_CENTER + Math.cos(angle) * radio,
    y: RADAR_CENTER + Math.sin(angle) * radio,
  };
}

function calcularPuntoEtiqueta(index: number) {
  const angle = (Math.PI * 2 * index) / EJES_RADAR.length - Math.PI / 2;
  return {
    x: RADAR_CENTER + Math.cos(angle) * (RADAR_RADIUS + 26),
    y: RADAR_CENTER + Math.sin(angle) * (RADAR_RADIUS + 22),
  };
}

/** Gráfico radar SVG de métricas fisiológicas del jugador. */
export function RadarChart({ data }: { data: MetricasRadar }) {
  const polygon = EJES_RADAR.map((eje, i) => {
    const punto = calcularPuntoPerfil(i, data[eje.key]);
    return `${punto.x},${punto.y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="h-full w-full">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="oklch(0.82 0.22 142 / 0.55)" />
          <stop offset="50%" stopColor="oklch(0.72 0.18 232 / 0.4)" />
          <stop offset="100%" stopColor="oklch(0.6 0.24 320 / 0.35)" />
        </radialGradient>
      </defs>

      {/* Grilla de referencia */}
      {[0.25, 0.5, 0.75, 1].map((escala) => (
        <polygon
          key={escala}
          points={EJES_RADAR.map((_, i) => {
            const p = calcularPuntoPerfil(i, escala * 100);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke="oklch(0.6 0.05 240 / 0.18)"
          strokeWidth={1}
        />
      ))}

      {/* Ejes de referencia */}
      {EJES_RADAR.map((_, i) => {
        const extremo = calcularPuntoPerfil(i, 100);
        return (
          <line
            key={i}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={extremo.x}
            y2={extremo.y}
            stroke="oklch(0.6 0.05 240 / 0.18)"
            strokeWidth={1}
          />
        );
      })}

      {/* Perfil del jugador */}
      <polygon
        points={polygon}
        fill="url(#radarFill)"
        stroke="oklch(0.82 0.22 142 / 0.9)"
        strokeWidth={1.5}
        style={{ filter: "drop-shadow(0 0 6px oklch(0.82 0.22 142 / 0.5))" }}
      />

      {/* Puntos en vértices */}
      {EJES_RADAR.map((eje, i) => {
        const punto = calcularPuntoPerfil(i, data[eje.key]);
        return <circle key={eje.key} cx={punto.x} cy={punto.y} r={3.5} fill={eje.color} />;
      })}

      {/* Etiquetas de ejes */}
      {EJES_RADAR.map((eje, i) => {
        const etiqueta = calcularPuntoEtiqueta(i);
        return (
          <text
            key={eje.key}
            x={etiqueta.x}
            y={etiqueta.y}
            fontSize={11}
            fontWeight={700}
            letterSpacing={0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="oklch(0.78 0.03 240)"
          >
            {eje.label}
          </text>
        );
      })}
    </svg>
  );
}
