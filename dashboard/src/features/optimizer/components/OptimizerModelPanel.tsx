import { useState } from "react";
import {
  ChevronDown, ChevronRight, Database, Brain, Beaker,
  Thermometer, BarChart3, AlertTriangle
} from "lucide-react";

function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/5 transition-colors">
        {icon}
        <h3 className="text-lg font-display font-bold flex-1 text-white">{title}</h3>
        {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/5 pt-4">{children}</div>}
    </div>
  );
}

/**
 * Technical panel for Data Science students explaining how the Squad Optimizer
 * works — data sources, mathematical formulation, algorithm choice, limitations.
 */
export function OptimizerModelPanel() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Intro */}
      <div className="bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-display font-bold text-white mb-3">
          🔬 Optimizador de Plantillas — Documentación Técnica
        </h2>
        <p className="text-base text-gray-300 leading-relaxed mb-4">
          Este sistema selecciona la <strong className="text-white">plantilla óptima de 26 jugadores</strong> para
          cada selección usando <strong className="text-white">Programación Lineal Multi-Objetivo</strong> (PuLP/CBC).
          La v2 corrige el sesgo posicional del v1, incorpora riesgo de lesión calibrado,
          adaptación climática y balance etario.
        </p>
        <div className="bg-black/40 rounded-lg p-4 border border-white/5">
          <p className="text-sm text-gray-400 font-semibold mb-2">📐 Pipeline de optimización:</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg">Datos FBref + FIFA</span>
            <span className="text-gray-600">→</span>
            <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg">Score por Posición</span>
            <span className="text-gray-600">→</span>
            <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-lg">Riesgo Lesión</span>
            <span className="text-gray-600">→</span>
            <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg">Clima + Edad</span>
            <span className="text-gray-600">→</span>
            <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg">PuLP LP Solver</span>
            <span className="text-gray-600">→</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-lg">Plantilla Óptima</span>
          </div>
        </div>
      </div>

      {/* Section 1: Data Sources */}
      <Section title="Paso 1 — Datos de entrada: ¿de dónde salen los datos?" icon={<Database className="w-5 h-5 text-blue-400" />} defaultOpen={true}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El optimizador combina <strong className="text-white">3 fuentes de datos reales</strong> para construir
            un perfil multi-dimensional de cada jugador disponible.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-blue-500/20">
              <h4 className="text-sm font-bold text-blue-300 mb-2">📊 Rendimiento (FBref)</h4>
              <p className="text-sm text-gray-400 mb-2">Stats de 1,257 jugadores en selecciones + clubes:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li><strong className="text-white">On-Off:</strong> Diferencial de rendimiento del equipo con/sin el jugador</li>
                <li><strong className="text-white">PPM:</strong> Puntos por partido cuando juega</li>
                <li><strong className="text-white">G+A per 90:</strong> Contribución ofensiva directa</li>
                <li>Tackles, intercepciones, centros per 90</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ master_players_clustered.csv</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-red-500/20">
              <h4 className="text-sm font-bold text-red-300 mb-2">🏥 Lesiones (Transfermarkt)</h4>
              <p className="text-sm text-gray-400 mb-2">Historial completo de lesiones por jugador:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li><strong className="text-white">total_injuries:</strong> Cantidad total de lesiones registradas</li>
                <li><strong className="text-white">total_days_out:</strong> Días acumulados de baja</li>
                <li><strong className="text-white">avg_days_out:</strong> Gravedad promedio por lesión</li>
                <li><strong className="text-white">Age:</strong> Factor de riesgo por envejecimiento</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ master_injuries_featured.csv</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
              <h4 className="text-sm font-bold text-yellow-300 mb-2">🌡️ Clima (Open-Meteo + Stadiums)</h4>
              <p className="text-sm text-gray-400 mb-2">Contexto ambiental del torneo:</p>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li><strong className="text-white">Birth Country:</strong> Proxy de aclimatación natural</li>
                <li><strong className="text-white">Stadium temp/elevation:</strong> Condiciones del partido</li>
                <li><strong className="text-white">Zona climática:</strong> Hot/Temperate/Cold/Altitude</li>
                <li>16 estadios con coordenadas GPS reales</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2 italic">→ world_cup_stadiums.csv + Birth Country</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Mathematical Formulation */}
      <Section title="Paso 2 — Formulación Matemática: el problema de optimización" icon={<Beaker className="w-5 h-5 text-purple-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El problema se formula como un <strong className="text-white">Integer Linear Program (ILP)</strong> con
            variables binarias. Cada jugador tiene x<sub>i</sub> ∈ {"{0, 1}"} que indica si es seleccionado.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">Función Objetivo (v2 — Multi-Objetivo Ponderada)</h4>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-sm text-gray-300 space-y-2">
              <p className="text-purple-300 font-bold">max Σᵢ composite_score(i) × xᵢ</p>
              <p className="text-gray-500 mt-2">donde:</p>
              <p>composite_score(i) = w_perf × <span className="text-blue-300">perf_percentile(i)</span></p>
              <p className="pl-24">- w_inj × <span className="text-red-300">injury_risk(i)</span></p>
              <p className="pl-24">+ w_clim × <span className="text-yellow-300">climate_adaptation(i)</span></p>
              <p className="pl-24">+ w_age × <span className="text-green-300">age_fitness(i)</span></p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">Restricciones</h4>
            <div className="bg-black/60 rounded-lg p-4 border border-white/5 font-mono text-sm text-gray-300 space-y-1">
              <p><span className="text-green-400">R1:</span> Σᵢ xᵢ = 26 &nbsp;&nbsp;&nbsp;<span className="text-gray-500">(tamaño del plantel)</span></p>
              <p><span className="text-green-400">R2:</span> 3 ≤ Σ(GK) ≤ 3 &nbsp;&nbsp;&nbsp;<span className="text-gray-500">(porteros)</span></p>
              <p><span className="text-green-400">R3:</span> 7 ≤ Σ(DF) ≤ 10 &nbsp;&nbsp;<span className="text-gray-500">(defensores)</span></p>
              <p><span className="text-green-400">R4:</span> 6 ≤ Σ(MF) ≤ 10 &nbsp;&nbsp;<span className="text-gray-500">(mediocampistas)</span></p>
              <p><span className="text-green-400">R5:</span> 5 ≤ Σ(FW) ≤ 8 &nbsp;&nbsp;&nbsp;<span className="text-gray-500">(delanteros)</span></p>
              <p><span className="text-green-400">R6:</span> xᵢ ∈ {"{0, 1}"} &nbsp;&nbsp;&nbsp;<span className="text-gray-500">(binarias)</span></p>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Componentes del Score (todos normalizados a 0-100)</h4>
            <div className="space-y-3">
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-blue-300 text-xs mb-1">perf_percentile(i) — Rendimiento normalizado por posición</p>
                <p className="text-sm text-gray-400">= rank_within_position(impact_score_raw) × 100</p>
                <p className="text-xs text-gray-500 mt-1">
                  El impact_score_raw = z(On-Off) + z(PPM) + z(G+A/90). En v1, esto favorecía atacantes porque
                  G+A/90 es siempre más alto para FW. La v2 normaliza <strong className="text-white">dentro de cada posición</strong>,
                  eliminando el sesgo. Un defensor top es tan valioso como un atacante top.
                </p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-red-300 text-xs mb-1">injury_risk(i) — Riesgo compuesto de lesión</p>
                <p className="text-sm text-gray-400">= clip(injuries/Q95 × 40, 0, 40) + clip(days_out/Q95 × 30, 0, 30) + clip((age-32)×5, 0, 20) + clip(avg_days/60 × 10, 0, 10)</p>
                <p className="text-xs text-gray-500 mt-1">
                  En v1, era simplemente "total_injuries × 5" (constante arbitraria). La v2 usa un compuesto
                  que considera gravedad (días), frecuencia (cantidad), y factor etario. Los cuantiles Q95
                  auto-calibran los rangos con la distribución real del dataset.
                </p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-yellow-300 text-xs mb-1">climate_adaptation(i) — Bonus climático</p>
                <p className="text-sm text-gray-400">= f(birth_country_zone, stadium_temp, stadium_elevation)</p>
                <p className="text-xs text-gray-500 mt-1">
                  Mapea el país de nacimiento a zonas climáticas (hot/temperate/cold/altitude) y compara contra
                  las condiciones del estadio. Ej: Un jugador nacido en Nigeria tiene +30% bonus si la temp &gt; 30°C.
                  Sin contexto climático, todos reciben 50 (neutral).
                </p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-white/5">
                <p className="font-mono text-green-300 text-xs mb-1">age_fitness(i) — Perfil etario</p>
                <p className="text-sm text-gray-400">= exp(-0.5 × ((age - 27.5) / 4)²) × 100</p>
                <p className="text-xs text-gray-500 mt-1">
                  Distribución gaussiana centrada en 27.5 años con σ=4. Jugadores entre 24-31 reciben score alto.
                  Menores de 20 o mayores de 34 son penalizados suavemente (no excluidos, solo rankeados más bajo).
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3: Algorithm Choice */}
      <Section title="Paso 3 — ¿Por qué Programación Lineal y no otro algoritmo?" icon={<Brain className="w-5 h-5 text-emerald-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            Se evaluaron múltiples enfoques. La Programación Lineal Entera (ILP) fue elegida por sus
            <strong className="text-white"> garantías de optimalidad</strong> en problemas de selección con restricciones.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2 px-3">Método</th>
                  <th className="text-center py-2 px-3">Optimalidad</th>
                  <th className="text-center py-2 px-3">Velocidad</th>
                  <th className="text-center py-2 px-3">Restricciones</th>
                  <th className="text-center py-2 px-3">Interpretabilidad</th>
                  <th className="text-left py-2 px-3">Limitación</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-white/5 bg-emerald-500/5">
                  <td className="py-2 px-3 font-bold text-emerald-300">ILP (PuLP) ✓</td>
                  <td className="text-center py-2 px-3">✅ Exacta</td>
                  <td className="text-center py-2 px-3">✅ &lt;100ms</td>
                  <td className="text-center py-2 px-3">✅ Nativas</td>
                  <td className="text-center py-2 px-3">✅ Total</td>
                  <td className="py-2 px-3 text-xs text-gray-500">Objetivo debe ser lineal</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Algoritmo Genético</td>
                  <td className="text-center py-2 px-3">⚠️ Aprox.</td>
                  <td className="text-center py-2 px-3">⚠️ Lento</td>
                  <td className="text-center py-2 px-3">✅ Flexibles</td>
                  <td className="text-center py-2 px-3">❌ Black box</td>
                  <td className="py-2 px-3 text-xs text-gray-500">No garantiza óptimo global</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Greedy Heurístico</td>
                  <td className="text-center py-2 px-3">❌ Subóptimo</td>
                  <td className="text-center py-2 px-3">✅ Instantáneo</td>
                  <td className="text-center py-2 px-3">⚠️ Manual</td>
                  <td className="text-center py-2 px-3">✅ Simple</td>
                  <td className="py-2 px-3 text-xs text-gray-500">Decisiones locales, no globales</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">RL (Reinforcement Learning)</td>
                  <td className="text-center py-2 px-3">⚠️ Aprox.</td>
                  <td className="text-center py-2 px-3">❌ Muy lento</td>
                  <td className="text-center py-2 px-3">✅ Flexibles</td>
                  <td className="text-center py-2 px-3">❌ Black box</td>
                  <td className="py-2 px-3 text-xs text-gray-500">Requiere simulador + mucho entrenamiento</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Pareto Multi-Obj (NSGA-II)</td>
                  <td className="text-center py-2 px-3">✅ Frente Pareto</td>
                  <td className="text-center py-2 px-3">⚠️ Moderado</td>
                  <td className="text-center py-2 px-3">✅ Flexibles</td>
                  <td className="text-center py-2 px-3">⚠️ Requiere elegir</td>
                  <td className="py-2 px-3 text-xs text-gray-500">Presenta opciones, no una solución</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-emerald-500/20">
            <h4 className="text-sm font-bold text-emerald-300 mb-3">¿Por qué ILP es ideal para este problema?</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Garantía de optimalidad:</strong> El solver CBC encuentra la solución matemáticamente óptima, no una aproximación. Para 50 jugadores y 26 selecciones, se resuelve en &lt;100ms.</li>
              <li><strong className="text-white">Restricciones posicionales naturales:</strong> Las restricciones del fútbol (exactamente 3 GK, mínimo 7 DF) se expresan directamente como desigualdades lineales.</li>
              <li><strong className="text-white">Transparencia total:</strong> Se puede explicar exactamente por qué cada jugador fue incluido o excluido — es la contribución marginal al objetivo.</li>
              <li><strong className="text-white">Parametrizable:</strong> Cambiar pesos o restricciones no requiere re-entrenar — solo re-resolver (instantáneo).</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Ventajas sobre el Greedy (v1 implícito)</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Un enfoque greedy ordenaría todos los jugadores por score y tomaría los mejores 26 respetando mínimos.
              El problema es que un greedy puede elegir 8 FW "buenos" y dejar solo 5 DF de baja calidad.
              El ILP evalúa <strong className="text-white">todas las combinaciones válidas</strong> y encuentra
              la que maximiza la suma total, balanceando calidad en todas las posiciones.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 4: Climate Integration */}
      <Section title="Paso 4 — Integración Climática: ¿aporta valor real?" icon={<Thermometer className="w-5 h-5 text-yellow-400" />}>
        <div className="space-y-4">
          <p className="text-base text-gray-300 leading-relaxed">
            El Mundial 2026 se juega en <strong className="text-white">EE.UU., México y Canadá</strong> — tres países
            con climas extremadamente diferentes. Un partido en Houston a 38°C no es lo mismo que uno en
            Vancouver a 12°C.
          </p>

          <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
            <h4 className="text-sm font-bold text-yellow-300 mb-3">Hipótesis científica</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              La literatura de fisiología deportiva (Mohr et al., 2012; Nybo et al., 2014) demuestra que:
            </p>
            <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside mt-2">
              <li>Temperaturas &gt;30°C reducen la distancia total recorrida en ~5-8%</li>
              <li>Jugadores de zonas tropicales mantienen mejor rendimiento en calor extremo</li>
              <li>La altitud &gt;1500m reduce VO₂max en jugadores no aclimatados</li>
              <li>El efecto es más marcado en la 2da mitad (fatiga acumulada + termorregulación)</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-white/5">
            <h4 className="text-sm font-bold text-gray-200 mb-3">Implementación: proxy con Birth Country</h4>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">
              Sin acceso a datos biométricos de aclimatación, usamos el <strong className="text-white">país de nacimiento</strong> como
              proxy de tolerancia climática natural. Es una simplificación (un brasileño puede vivir en
              Noruega hace 10 años), pero captura la tendencia poblacional.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-black/60 rounded-lg p-3 border border-red-500/20 text-center">
                <p className="text-xs text-gray-500 mb-1">🌡️ Hot Zone</p>
                <p className="text-sm text-red-300 font-bold">+30% bonus</p>
                <p className="text-xs text-gray-500">si temp &gt; 30°C</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-blue-500/20 text-center">
                <p className="text-xs text-gray-500 mb-1">❄️ Cold Zone</p>
                <p className="text-sm text-blue-300 font-bold">+30% bonus</p>
                <p className="text-xs text-gray-500">si temp &lt; 10°C</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-green-500/20 text-center">
                <p className="text-xs text-gray-500 mb-1">🌿 Temperate</p>
                <p className="text-sm text-green-300 font-bold">Neutral</p>
                <p className="text-xs text-gray-500">adaptable a ambos</p>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-purple-500/20 text-center">
                <p className="text-xs text-gray-500 mb-1">🏔️ Altitude</p>
                <p className="text-sm text-purple-300 font-bold">+20% bonus</p>
                <p className="text-xs text-gray-500">si elev &gt; 1500m</p>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
            <h4 className="text-sm font-bold text-orange-300 mb-2">⚠️ Limitación honesta del factor climático</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              El peso default del clima es w=0.1 (10% de la decisión). Esto es intencional: el efecto climático
              <strong className="text-white"> nunca debería dominar</strong> la selección. Un jugador de clase mundial
              siempre debe ir aunque el clima no lo favorezca. El bonus climático solo desempata entre jugadores
              de nivel similar. El usuario puede ajustar el peso a 0 para desactivarlo completamente.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 5: v1 vs v2 Comparison */}
      <Section title="Paso 5 — Mejoras v2 vs v1: ¿qué cambió?" icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}>
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2 px-3">Aspecto</th>
                  <th className="text-left py-2 px-3">v1 (Original)</th>
                  <th className="text-left py-2 px-3">v2 (Actual)</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3 font-bold">Score de rendimiento</td>
                  <td className="py-2 px-3 text-red-300">impact_score_raw global (sesgo atacante)</td>
                  <td className="py-2 px-3 text-green-300">Percentil dentro de posición (justo)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3 font-bold">Penalización lesiones</td>
                  <td className="py-2 px-3 text-red-300">-5 × total_injuries (arbitraria)</td>
                  <td className="py-2 px-3 text-green-300">Score compuesto calibrado con Q95</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3 font-bold">Clima</td>
                  <td className="py-2 px-3 text-red-300">No considerado</td>
                  <td className="py-2 px-3 text-green-300">Bonus por adaptación climática</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3 font-bold">Edad</td>
                  <td className="py-2 px-3 text-red-300">No considerada</td>
                  <td className="py-2 px-3 text-green-300">Gaussiana centrada en 27.5</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3 font-bold">Parametrizable</td>
                  <td className="py-2 px-3 text-red-300">No (hardcodeado)</td>
                  <td className="py-2 px-3 text-green-300">Sí (pesos ajustables en real-time)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold">Jugadores excluidos</td>
                  <td className="py-2 px-3 text-red-300">No visibles</td>
                  <td className="py-2 px-3 text-green-300">Top 10 "near miss" mostrados</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-cyan-500/20">
            <h4 className="text-sm font-bold text-cyan-300 mb-3">Ejemplo: Argentina con v1 vs v2</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/60 rounded-lg p-3 border border-red-500/20">
                <p className="text-xs font-bold text-red-300 mb-2">v1 — Problemas detectados</p>
                <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                  <li>TODOS los defensores tienen score negativo</li>
                  <li>Messi (38 años, muchas lesiones) seleccionado igual</li>
                  <li>No distingue entre un DF top y uno mediocre</li>
                  <li>Penalización lineal no refleja gravedad real</li>
                </ul>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-green-500/20">
                <p className="text-xs font-bold text-green-300 mb-2">v2 — Correcciones</p>
                <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                  <li>Defensores comparados solo contra defensores</li>
                  <li>Messi tiene composite alto (rendimiento excepcional supera riesgo)</li>
                  <li>Romero es el DF #1 por su percentil posicional</li>
                  <li>La edad de Messi penaliza suavemente vía age_score</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 6: Limitations & Extensions */}
      <Section title="Paso 6 — Limitaciones y extensiones posibles" icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}>
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-orange-500/20">
            <h4 className="text-sm font-bold text-orange-300 mb-3">⚠️ Limitaciones honestas del modelo actual</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">No modela sinergias entre jugadores:</strong> El modelo asume que el valor de cada jugador es independiente. En realidad, Messi + Di María juntos valen más que la suma de sus partes. Esto requeriría un modelo cuadrático (QP), más complejo.</li>
              <li><strong className="text-white">Birth Country ≠ aclimatación real:</strong> Un jugador brasileño que vive en Manchester hace 8 años está más adaptado al frío que al calor. Sin datos de residencia actual, es una simplificación.</li>
              <li><strong className="text-white">Los pesos son subjetivos:</strong> Los defaults (50/30/10/10) son razonables pero no están calibrados empíricamente. No existe un "ground truth" de plantilla óptima contra el cual validar.</li>
              <li><strong className="text-white">No considera estado de forma actual:</strong> Un jugador lesionado HOY no debería ir, pero el modelo usa stats históricas. Integrar datos "en tiempo real" de lesiones actuales mejoraría la decisión.</li>
              <li><strong className="text-white">impact_score_raw (R² = -0.06):</strong> El modelo XGBoost que predice impact tiene R² negativo. Sin embargo, usamos el valor calculado directamente (no predicho), así que esto no invalida el optimizer, pero evidencia que el score podría refinarse.</li>
            </ul>
          </div>

          <div className="bg-black/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-bold text-purple-300 mb-3">🚀 Extensiones para estudiantes</h4>
            <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
              <li><strong className="text-white">Multi-Objetivo Pareto (NSGA-II):</strong> En vez de ponderar, generar el frente de Pareto performance-vs-risk y dejar que el DT elija su punto preferido.</li>
              <li><strong className="text-white">Restricciones tácticas:</strong> Mínimo 1 zurdo en defensa, máximo 2 jugadores del mismo club, diversidad de perfiles de clustering.</li>
              <li><strong className="text-white">Programación Estocástica:</strong> Modelar la incertidumbre de lesiones como variable aleatoria y optimizar el Expected Value.</li>
              <li><strong className="text-white">Validación contra DTs reales:</strong> Comparar la plantilla generada contra la que eligió el DT en Qatar 2022 para medir el "gap" de decisión.</li>
              <li><strong className="text-white">Integrar xG overperformance:</strong> Jugadores que consistentemente superan su xG podrían tener un bonus de "clutch factor" en momentos decisivos.</li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
