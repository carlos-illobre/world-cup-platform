import { useState, useEffect, useRef, useMemo } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { Search, Zap, FlaskConical, Thermometer, Shield, TrendingUp } from "lucide-react";
import { SquadCharts } from "@/features/optimizer/components/SquadCharts";
import { OptimizerModelPanel } from "@/features/optimizer/components/OptimizerModelPanel";

// Countries that have squads in optimal_squads.csv (all 48 WC teams)
const SQUAD_COUNTRIES = [
  { label: "Alemania (Germany)", value: "Germany" },
  { label: "Arabia Saudita", value: "Saudi Arabia" },
  { label: "Argelia (Algeria)", value: "Algeria" },
  { label: "Argentina", value: "Argentina" },
  { label: "Australia", value: "Australia" },
  { label: "Austria", value: "Austria" },
  { label: "Bélgica (Belgium)", value: "Belgium" },
  { label: "Bosnia-Herzegovina", value: "Bosnia and Herzegovina" },
  { label: "Brasil (Brazil)", value: "Brazil" },
  { label: "Cabo Verde", value: "Cape Verde" },
  { label: "Canadá (Canada)", value: "Canada" },
  { label: "Catar (Qatar)", value: "Qatar" },
  { label: "Chequia (Czechia)", value: "Czechia" },
  { label: "Colombia", value: "Colombia" },
  { label: "Congo DR", value: "Congo DR" },
  { label: "Corea del Sur", value: "Korea Republic" },
  { label: "Costa de Marfil", value: "Côte d'Ivoire" },
  { label: "Croacia (Croatia)", value: "Croatia" },
  { label: "Curazao (Curaçao)", value: "Curaçao" },
  { label: "Ecuador", value: "Ecuador" },
  { label: "Egipto (Egypt)", value: "Egypt" },
  { label: "Escocia (Scotland)", value: "Scotland" },
  { label: "España (Spain)", value: "Spain" },
  { label: "Estados Unidos (USA)", value: "United States" },
  { label: "Francia (France)", value: "France" },
  { label: "Ghana", value: "Ghana" },
  { label: "Haití", value: "Haiti" },
  { label: "Holanda (Netherlands)", value: "Netherlands" },
  { label: "Inglaterra (England)", value: "England" },
  { label: "Irak (Iraq)", value: "Iraq" },
  { label: "Irán (IR Iran)", value: "IR Iran" },
  { label: "Japón (Japan)", value: "Japan" },
  { label: "Jordania (Jordan)", value: "Jordan" },
  { label: "Marruecos (Morocco)", value: "Morocco" },
  { label: "México (Mexico)", value: "Mexico" },
  { label: "Noruega (Norway)", value: "Norway" },
  { label: "Nueva Zelanda", value: "New Zealand" },
  { label: "Panamá (Panama)", value: "Panama" },
  { label: "Paraguay", value: "Paraguay" },
  { label: "Portugal", value: "Portugal" },
  { label: "Senegal", value: "Senegal" },
  { label: "Sudáfrica (South Africa)", value: "South Africa" },
  { label: "Suecia (Sweden)", value: "Sweden" },
  { label: "Suiza (Switzerland)", value: "Switzerland" },
  { label: "Túnez (Tunisia)", value: "Tunisia" },
  { label: "Turquía (Türkiye)", value: "Türkiye" },
  { label: "Uruguay", value: "Uruguay" },
  { label: "Uzbekistán (Uzbekistan)", value: "Uzbekistan" },
];

// --- Country Autocomplete ---
function CountryAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = SQUAD_COUNTRIES.find((c) => c.value === value);
    if (match) setInput(match.label);
  }, [value]);

  const filtered = useMemo(() => {
    if (!input.trim()) return SQUAD_COUNTRIES;
    const q = input.toLowerCase();
    return SQUAD_COUNTRIES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
    );
  }, [input]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar país (ej: Argentina, Brasil, España...)"
          className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neon-blue transition-all"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((c) => (
            <button key={c.value} type="button" onClick={() => { onChange(c.value); setInput(c.label); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 ${c.value === value ? "bg-neon-blue/10 text-neon-blue font-bold" : "text-gray-200"}`}
            >{c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Weight Slider ---
function WeightSlider({ label, value, onChange, color, description }: {
  label: string; value: number; onChange: (v: number) => void; color: string; description: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-300 font-medium">{label}</label>
        <span className={`text-sm font-bold ${color} bg-black/40 px-2 py-0.5 rounded`}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value * 100}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-neon-blue [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neon-blue [&::-webkit-slider-thumb]:appearance-none"
      />
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

// --- Composite Score Bar ---
function CompositeBar({ player }: { player: any }) {
  const maxScore = 100;
  const perf = Math.max(0, player.perf_score || 0);
  const risk = Math.max(0, player.injury_risk || 0);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${(perf / maxScore) * 100}%` }} title={`Rendimiento: ${perf.toFixed(0)}`} />
      </div>
      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden flex justify-end">
        <div className="h-full bg-red-500 rounded-r-full" style={{ width: `${(risk / maxScore) * 100}%` }} title={`Riesgo: ${risk.toFixed(0)}`} />
      </div>
    </div>
  );
}

// --- Main Page ---
export function SquadOptimizerPage() {
  const [viewMode, setViewMode] = useState<"decision" | "model">("decision");
  const [country, setCountry] = useState("");
  const [squad, setSquad] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimization weights
  const [wPerf, setWPerf] = useState(0.5);
  const [wInjury, setWInjury] = useState(0.3);
  const [wClimate, setWClimate] = useState(0.1);
  const [wAge, setWAge] = useState(0.1);

  // Climate context
  const [stadiumTemp, setStadiumTemp] = useState<number | null>(null);
  const [useClimate, setUseClimate] = useState(false);

  const fetchSquad = async () => {
    if (!country) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${INJURY_API_BASE_URL}/api/v1/squads/optimize/${encodeURIComponent(country)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            w_performance: wPerf,
            w_injury: wInjury,
            w_climate: wClimate,
            w_age: wAge,
            stadium_temp: useClimate ? stadiumTemp : null,
          }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        throw new Error(errData.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setSquad(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al conectar con el servidor");
      setSquad(null);
    }
    setLoading(false);
  };

  // Auto-trigger optimization when weights or country change (debounced 600ms)
  useEffect(() => {
    if (!country) return;
    const timer = setTimeout(() => {
      fetchSquad();
    }, 600);
    return () => clearTimeout(timer);
  }, [country, wPerf, wInjury, wClimate, wAge, useClimate, stadiumTemp]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">
              {viewMode === "decision"
                ? "Optimizador de Plantillas — Selección Inteligente"
                : "Modelo & Validación — Optimización de Plantillas"}
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              {viewMode === "decision"
                ? "Genera la plantilla óptima de 26 jugadores usando Programación Lineal Multi-Objetivo con rendimiento normalizado por posición, riesgo de lesión calibrado y adaptación climática."
                : "Documentación técnica del algoritmo de optimización para estudiantes de Ciencia de Datos."
              }
            </p>
            {viewMode === "decision" && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 font-bold">PuLP CBC Solver</span>
                <span className="text-[10px] text-gray-500">Programación Lineal Entera · Impact Score via XGBoost</span>
              </div>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("decision")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === "decision"
                  ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" /> Panel de Decisión
            </button>
            <button
              onClick={() => setViewMode("model")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === "model"
                  ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <FlaskConical className="w-4 h-4" /> Modelo & Validación
            </button>
          </div>
        </div>

        {/* Model & Validation View */}
        {viewMode === "model" && <OptimizerModelPanel />}

        {/* Decision View */}
        {viewMode === "decision" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Country + Weights */}
            <div className="lg:col-span-1 space-y-4">
              {/* Country selector */}
              <div className="glass-panel p-5 rounded-2xl">
                <h3 className="text-base font-display font-bold text-white mb-3">Selección</h3>
                <CountryAutocomplete value={country} onChange={setCountry} />
                <button
                  onClick={fetchSquad}
                  className="w-full mt-3 bg-neon-blue text-black font-bold py-2.5 px-6 rounded-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50"
                  disabled={loading || !country}
                >
                  {loading ? "Optimizando..." : "⚡ Optimizar Plantilla"}
                </button>
              </div>

              {/* Weights panel */}
              <div className="glass-panel p-5 rounded-2xl">
                <h3 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-neon-blue" /> Pesos del Objetivo
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Ajustá la importancia relativa de cada dimensión. El solver recalcula la plantilla óptima.
                </p>
                <div className="space-y-4">
                  <WeightSlider label="⚽ Rendimiento" value={wPerf} onChange={setWPerf}
                    color="text-emerald-400" description="Percentil de impacto dentro de su posición" />
                  <WeightSlider label="🏥 Riesgo Lesión" value={wInjury} onChange={setWInjury}
                    color="text-red-400" description="Penalización por historial de lesiones + edad" />
                  <WeightSlider label="🌡️ Clima" value={wClimate} onChange={setWClimate}
                    color="text-yellow-400" description="Bonus por adaptación al clima del estadio" />
                  <WeightSlider label="📅 Balance Etario" value={wAge} onChange={setWAge}
                    color="text-purple-400" description="Preferencia por rango 24-31 años" />
                </div>
              </div>

              {/* Climate context */}
              <div className="glass-panel p-5 rounded-2xl">
                <h3 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-yellow-400" /> Contexto Climático
                </h3>
                <label className="flex items-center gap-2 text-sm text-gray-300 mb-3 cursor-pointer">
                  <input type="checkbox" checked={useClimate} onChange={(e) => setUseClimate(e.target.checked)}
                    className="rounded border-white/20 bg-black/40 text-neon-blue focus:ring-neon-blue" />
                  Activar adaptación climática
                </label>
                {useClimate && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-300">Temp. del estadio (°C)</label>
                      <span className="text-sm font-bold text-white bg-black/40 px-2 py-0.5 rounded">
                        {stadiumTemp ?? 25}°C
                      </span>
                    </div>
                    <input type="range" min={-5} max={45} step={1} value={stadiumTemp ?? 25}
                      onChange={(e) => setStadiumTemp(Number(e.target.value))}
                      className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-neon-blue [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neon-blue [&::-webkit-slider-thumb]:appearance-none"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                      <span>-5°C (Canadá invierno)</span>
                      <span>45°C (Houston verano)</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  El bonus climático favorece jugadores nacidos en zonas climáticas similares al estadio.
                </p>
              </div>
            </div>

            {/* Right: Results */}
            <div className="lg:col-span-2 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-neon-blue" />
                    <span className="text-sm text-gray-400">Resolviendo ILP con PuLP...</span>
                  </div>
                </div>
              )}

              {squad && squad.players && (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <span className="text-xl font-black text-white">{squad.squad_size}</span>
                      <p className="text-xs text-gray-400 mt-1">Jugadores</p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <span className="text-xl font-black text-neon-blue">
                        {squad.analytics?.avg_age?.toFixed(1)}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">Edad Promedio</p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <span className="text-xl font-black text-emerald-400">
                        {squad.analytics?.total_composite_score?.toFixed(0)}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">Score Total</p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <span className="text-xl font-black text-red-400">
                        {squad.analytics?.avg_injury_risk?.toFixed(0)}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">Riesgo Prom.</p>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <span className="text-xl font-black text-yellow-400">
                        {squad.analytics?.avg_climate_adaptation?.toFixed(0)}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">Adapt. Clima</p>
                    </div>
                  </div>

                  {/* Algorithm info badge */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-2 flex items-center gap-3">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-gray-300">
                      <strong className="text-emerald-300">Solución óptima</strong> encontrada por {squad.algorithm?.name}.
                      Pesos: Rendimiento {((squad.weights_used?.performance ?? 0) * 100).toFixed(0)}%
                      | Lesión {((squad.weights_used?.injury ?? 0) * 100).toFixed(0)}%
                      | Clima {((squad.weights_used?.climate ?? 0) * 100).toFixed(0)}%
                      | Edad {((squad.weights_used?.age ?? 0) * 100).toFixed(0)}%
                    </p>
                  </div>

                  {/* Selected Players */}
                  <div>
                    <h3 className="text-lg font-bold text-white mb-3">
                      Plantilla Óptima — {squad.country} ({squad.squad_size} de {squad.total_available} disponibles)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {squad.players.map((p: any, i: number) => (
                        <div key={i}
                          className="bg-black/30 border border-white/5 rounded-xl p-4 hover:border-neon-blue/30 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.name}
                                className="w-10 h-10 rounded-full object-cover border border-white/10" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-gray-300 text-sm font-bold">
                                {p.name?.charAt(0) || "?"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white truncate">{p.name}</h4>
                              <p className="text-gray-400 text-xs truncate">
                                {p.position_category} • {p.club} • {p.age?.toFixed(0)} años
                              </p>
                              {p.cluster && (
                                <p className="text-xs text-purple-300 truncate mt-0.5">{p.cluster}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-lg font-black ${(p.composite_score ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {p.composite_score?.toFixed(1)}
                              </span>
                              <p className="text-[10px] text-gray-500">composite</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <CompositeBar player={p} />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                              <span className="text-emerald-400">Rend: {p.perf_score?.toFixed(0)}</span>
                              <span className="text-red-400">Riesgo: {p.injury_risk?.toFixed(0)}</span>
                              <span className="text-yellow-400">Clima: {p.climate_score?.toFixed(0)}</span>
                              <span className="text-purple-400">Edad: {p.age_score?.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Near-Miss Excluded Players */}
                  {squad.excluded_near_miss && squad.excluded_near_miss.length > 0 && (
                    <div>
                      <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                        <span className="text-yellow-400">⚠️</span> Jugadores Cerca del Corte (No Seleccionados)
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Estos jugadores estuvieron cerca de entrar. Un cambio pequeño en los pesos podría incluirlos.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {squad.excluded_near_miss.map((p: any, i: number) => (
                          <div key={i}
                            className="bg-black/20 border border-yellow-500/10 rounded-lg p-3 flex items-center gap-3 opacity-75"
                          >
                            <div className="w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-gray-400 text-xs font-bold">
                              {p.name?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-300 truncate">{p.name}</p>
                              <p className="text-xs text-gray-500">{p.position_category} • {p.club}</p>
                            </div>
                            <span className="text-sm font-bold text-yellow-400">{p.composite_score?.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visual Analytics Charts */}
                  <SquadCharts players={squad.players} />
                </div>
              )}

              {/* Empty state */}
              {!squad && !loading && !error && (
                <div className="glass-panel rounded-2xl p-12 text-center">
                  <div className="text-5xl mb-4 opacity-30">🏆</div>
                  <p className="text-lg font-medium text-gray-300 mb-1">Seleccioná un país y ajustá los pesos</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    El algoritmo de Programación Lineal Multi-Objetivo calculará la plantilla óptima
                    considerando rendimiento, riesgo de lesión, adaptación climática y balance etario.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
