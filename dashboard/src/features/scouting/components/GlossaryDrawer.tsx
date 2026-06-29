import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { CLUSTER_COLORS, CLUSTER_NAMES, CLUSTER_DESCRIPTIONS } from "../constants";

/**
 * Floating glossary button + drawer that explains all scouting metrics
 * in plain language. Helps non-technical users understand the dashboard.
 */
export function GlossaryDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-neon-blue/90 px-4 py-3 text-black font-bold shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:bg-neon-blue transition-all hover:scale-105"
        aria-label="Abrir glosario de métricas"
      >
        <HelpCircle className="w-5 h-5" />
        <span className="text-sm hidden sm:inline">Glosario</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-full max-w-md transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full overflow-y-auto bg-[#0f0f0f] border-l border-white/10 p-6 custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold text-white">
              📖 Glosario de Métricas
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              aria-label="Cerrar glosario"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            Todas las métricas mostradas en este dashboard son calculadas por
            nuestros modelos de Machine Learning. Aquí explicamos cada una en
            lenguaje simple.
          </p>

          {/* Impact Score */}
          <section className="mb-6 rounded-xl border border-neon-blue/20 bg-black/40 p-4">
            <h3 className="text-lg font-bold text-neon-blue mb-2">
              ⚡ Impact Score
            </h3>
            <p className="text-sm text-gray-300 mb-3">
              Mide <strong className="text-white">cuánto aporta un jugador a su equipo</strong> comparado con los demás.
              No es un dato de FIFA — se calcula con datos reales de rendimiento.
            </p>
            <div className="bg-black/50 rounded-lg p-3 border border-white/5 mb-3">
              <code className="text-xs text-purple-300">
                Impact = Z(G+A/90) + Z(PPM) + Z(On/Off)
              </code>
            </div>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li>
                <strong className="text-white">G+A/90:</strong> Goles +
                Asistencias cada 90 minutos jugados
              </li>
              <li>
                <strong className="text-white">PPM:</strong> Puntos por partido
                del equipo cuando juega este jugador
              </li>
              <li>
                <strong className="text-white">On/Off:</strong> Diferencia de
                goles del equipo con/sin el jugador en cancha
              </li>
              <li>
                <strong className="text-white">Z(...):</strong> Estandarización
                para que cada componente pese lo mismo
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-white/5 space-y-1 text-xs">
              <p>
                <span className="text-green-400">▲ Positivo (&gt;0):</span>{" "}
                Aporta más que el promedio
              </p>
              <p>
                <span className="text-yellow-400">● Cerca de 0:</span> Rendimiento
                promedio
              </p>
              <p>
                <span className="text-red-400">▼ Negativo (&lt;0):</span> Por
                debajo del promedio
              </p>
            </div>
          </section>

          {/* xG Overperformance */}
          <section className="mb-6 rounded-xl border border-yellow-500/20 bg-black/40 p-4">
            <h3 className="text-lg font-bold text-yellow-400 mb-2">
              🎯 xG Overperformance
            </h3>
            <p className="text-sm text-gray-300 mb-2">
              Diferencia entre los <strong className="text-white">goles reales</strong> que marcó un
              jugador y los <strong className="text-white">goles esperados (xG)</strong> según la
              calidad de sus oportunidades.
            </p>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li>
                <strong className="text-green-400">Positivo:</strong> El jugador
                convierte mejor que lo esperado (gran finalizador)
              </li>
              <li>
                <strong className="text-red-400">Negativo:</strong> Desaprovecha
                oportunidades claras (mala definición o mala suerte)
              </li>
              <li>
                <strong className="text-gray-300">Ejemplo:</strong> Un xG
                Overperf de +0.3 significa que marca 0.3 goles más por partido
                de lo que sus oportunidades predicen
              </li>
            </ul>
          </section>

          {/* Cluster / Perfil Táctico */}
          <section className="mb-6 rounded-xl border border-purple-500/20 bg-black/40 p-4">
            <h3 className="text-lg font-bold text-purple-400 mb-2">
              🧬 Perfil Táctico (Cluster K-Means)
            </h3>
            <p className="text-sm text-gray-300 mb-3">
              Un algoritmo de inteligencia artificial agrupa a los jugadores por{" "}
              <strong className="text-white">cómo juegan realmente</strong> (no por
              su posición nominal). Usa 10 estadísticas por 90 min: goles,
              asistencias, tiros, entradas, centros, etc.
            </p>
            <div className="space-y-2">
              {Object.entries(CLUSTER_NAMES).map(([id, name]) => (
                <div key={id} className="flex items-start gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: CLUSTER_COLORS[id] }}
                  />
                  <div>
                    <span className="text-sm font-bold text-white">{name}</span>
                    <p className="text-xs text-gray-400">
                      {CLUSTER_DESCRIPTIONS[id]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Z-Score */}
          <section className="mb-6 rounded-xl border border-white/10 bg-black/40 p-4">
            <h3 className="text-lg font-bold text-gray-200 mb-2">
              📐 Z-Score (Estandarización)
            </h3>
            <p className="text-sm text-gray-300 mb-2">
              Es una forma de medir <strong className="text-white">"qué tan lejos del promedio"</strong> está
              un valor. Se calcula como:
            </p>
            <div className="bg-black/50 rounded-lg p-3 border border-white/5 mb-2">
              <code className="text-xs text-gray-300">
                Z = (valor - promedio) / desviación estándar
              </code>
            </div>
            <ul className="space-y-1 text-xs text-gray-400">
              <li><strong className="text-white">Z = 0</strong> → exactamente en el promedio</li>
              <li><strong className="text-white">Z = +1</strong> → una desviación por encima (top ~16%)</li>
              <li><strong className="text-white">Z = +2</strong> → dos desviaciones (top ~2.5%, élite)</li>
              <li><strong className="text-white">Z = -1</strong> → una desviación por debajo del promedio</li>
            </ul>
          </section>

          {/* FIFA Attributes */}
          <section className="mb-6 rounded-xl border border-white/10 bg-black/40 p-4">
            <h3 className="text-lg font-bold text-gray-200 mb-2">
              🎮 Atributos FIFA
            </h3>
            <p className="text-sm text-gray-300 mb-2">
              Puntuaciones de 0 a 99 del motor de juego FIFA/EA Sports FC.
              Representan las habilidades técnicas del jugador:
            </p>
            <ul className="space-y-1 text-xs text-gray-400">
              <li><strong className="text-green-300">PAC (Ritmo):</strong> Velocidad y aceleración</li>
              <li><strong className="text-red-300">SHO (Tiro):</strong> Precisión y potencia de disparo</li>
              <li><strong className="text-blue-300">PAS (Pase):</strong> Visión de juego y precisión de pases</li>
              <li><strong className="text-purple-300">DRI (Regate):</strong> Control de balón y agilidad</li>
              <li><strong className="text-cyan-300">DEF (Defensa):</strong> Marcaje, entradas y posicionamiento defensivo</li>
              <li><strong className="text-orange-300">PHY (Físico):</strong> Fuerza, resistencia y salto</li>
              <li><strong className="text-yellow-300">OVR (Overall):</strong> Puntuación general del jugador</li>
            </ul>
          </section>

          {/* Lesiones */}
          <section className="rounded-xl border border-red-500/20 bg-black/40 p-4">
            <h3 className="text-lg font-bold text-red-400 mb-2">
              🏥 Lesiones Históricas
            </h3>
            <p className="text-sm text-gray-300">
              Cantidad total de lesiones registradas en la carrera del jugador
              (fuente: Transfermarkt). Un número alto no necesariamente indica
              fragilidad actual — pero el Squad Optimizer lo penaliza con -5 puntos
              por lesión al seleccionar la plantilla ideal.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
