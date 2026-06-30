import { useState, useEffect, useRef, useMemo } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { LayoutGrid, BarChart2, Search, Trophy } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from "recharts";

const TEAM_OPTIONS = [
  { label: "Argentina", value: "Argentina" },
  { label: "Alemania (Germany)", value: "Germany" },
  { label: "Arabia Saudita", value: "Saudi Arabia" },
  { label: "Argelia (Algeria)", value: "Algeria" },
  { label: "Australia", value: "Australia" },
  { label: "Austria", value: "Austria" },
  { label: "Bélgica (Belgium)", value: "Belgium" },
  { label: "Bosnia-Herzegovina", value: "Bosnia-Herzegovina" },
  { label: "Brasil (Brazil)", value: "Brazil" },
  { label: "Cabo Verde", value: "Cape Verde" },
  { label: "Canadá", value: "Canada" },
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
  { label: "México", value: "Mexico" },
  { label: "Noruega (Norway)", value: "Norway" },
  { label: "Nueva Zelanda", value: "New Zealand" },
  { label: "Panamá", value: "Panama" },
  { label: "Paraguay", value: "Paraguay" },
  { label: "Portugal", value: "Portugal" },
  { label: "Senegal", value: "Senegal" },
  { label: "Sudáfrica (South Africa)", value: "South Africa" },
  { label: "Suecia (Sweden)", value: "Sweden" },
  { label: "Suiza (Switzerland)", value: "Switzerland" },
  { label: "Túnez (Tunisia)", value: "Tunisia" },
  { label: "Turquía (Türkiye)", value: "Türkiye" },
  { label: "Uruguay", value: "Uruguay" },
  { label: "Uzbekistán", value: "Uzbekistan" },
];

const TEAM_POINTS_FEATURES = [
  "squad_total_market_value", "squad_avg_market_value",
  "squad_total_injuries", "squad_total_wc_goals", "squad_avg_wc_goals",
  "squad_total_wc_assists", "squad_total_allcomps_goals",
  "squad_total_allcomps_assists", "squad_avg_age", "squad_median_age",
  "squad_total_caps", "squad_avg_caps", "squad_injury_burden",
  "squad_depth_DF", "squad_depth_FW", "squad_depth_GK", "squad_depth_MF",
  "squad_top_league_ratio", "squad_avg_impact_score",
];

const RADAR_METRICS = [
  { key: "squad_avg_age", label: "Edad Promedio", invert: true },
  { key: "squad_avg_market_value", label: "Valor Mercado" },
  { key: "squad_injury_burden", label: "Carga Lesiones", invert: true },
  { key: "squad_total_allcomps_goals", label: "Goles Totales" },
  { key: "squad_top_league_ratio", label: "Ratio Top Liga" },
  { key: "squad_avg_impact_score", label: "Impact Score" },
];

const formatGroupPoints = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return String(Math.max(0, Math.min(9, Math.round(Number(value)))));
};

// --- Autocomplete Component ---
function TeamAutocomplete({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = TEAM_OPTIONS.find((t) => t.value === value);
    if (match) setInput(match.label);
  }, [value]);

  const filtered = useMemo(() => {
    if (!input.trim()) return TEAM_OPTIONS;
    const q = input.toLowerCase();
    return TEAM_OPTIONS.filter(
      (t) => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q)
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
      <label className="block text-gray-300 text-sm font-medium mb-1.5">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar selección..."
          className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue transition-all"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                onChange(t.value);
                setInput(t.label);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 ${
                t.value === value ? "bg-neon-blue/10 text-neon-blue font-bold" : "text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamComparePage() {
  const [viewMode, setViewMode] = useState<"business" | "datascience">("business");
  const [teamA, setTeamA] = useState("Argentina");
  const [teamB, setTeamB] = useState("France");
  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);
  const [predA, setPredA] = useState<any>(null);
  const [predB, setPredB] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch team data
  useEffect(() => {
    if (!teamA) return;
    setLoading(true);
    Promise.all([
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamA)}`).then((r) => r.json()),
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamA)}/prediction`).then((r) => r.json()),
    ]).then(([detail, pred]) => {
      setDataA(detail.data);
      setPredA(pred.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamA]);

  useEffect(() => {
    if (!teamB) return;
    setLoading(true);
    Promise.all([
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamB)}`).then((r) => r.json()),
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamB)}/prediction`).then((r) => r.json()),
    ]).then(([detail, pred]) => {
      setDataB(detail.data);
      setPredB(pred.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamB]);

  // Normalize radar data
  const radarData = useMemo(() => {
    if (!dataA || !dataB) return [];
    return RADAR_METRICS.map((m) => {
      const valA = dataA[m.key] ?? 0;
      const valB = dataB[m.key] ?? 0;
      const maxVal = Math.max(valA, valB, 1);
      return {
        metric: m.label,
        [teamA]: m.invert ? (1 - valA / (maxVal * 1.2)) * 100 : (valA / (maxVal * 1.2)) * 100,
        [teamB]: m.invert ? (1 - valB / (maxVal * 1.2)) * 100 : (valB / (maxVal * 1.2)) * 100,
        rawA: valA,
        rawB: valB,
      };
    });
  }, [dataA, dataB, teamA, teamB]);

  const getAdvantage = (key: string, invert = false) => {
    if (!dataA || !dataB) return null;
    const a = dataA[key] ?? 0;
    const b = dataB[key] ?? 0;
    if (invert) return a < b ? teamA : a > b ? teamB : null;
    return a > b ? teamA : a < b ? teamB : null;
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">
              Comparador de Selecciones
              <span className="ml-3 bg-neon-blue/20 text-neon-blue text-sm px-3 py-1 rounded-full border border-neon-blue/30 font-bold tracking-widest uppercase">
                AI Powered
              </span>
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              Compara dos selecciones usando métricas de squad reales y una estimación
              redondeada de puntos de grupo.
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("business")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === "business"
                  ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Vista Negocio
            </button>
            <button
              onClick={() => setViewMode("datascience")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === "datascience"
                  ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <BarChart2 className="w-4 h-4" /> Vista Ciencia de Datos
            </button>
          </div>
        </div>

        {/* Team Selectors */}
        <div className="glass-panel rounded-2xl p-6 mb-8 border border-white/5">
          <div className="flex flex-col md:flex-row gap-6">
            <TeamAutocomplete label="Selección A" value={teamA} onChange={setTeamA} />
            <div className="flex items-end justify-center">
              <span className="text-2xl font-bold text-gray-500 pb-2">VS</span>
            </div>
            <TeamAutocomplete label="Selección B" value={teamB} onChange={setTeamB} />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
          </div>
        )}

        {/* ==================== BUSINESS VIEW ==================== */}
        {viewMode === "business" && dataA && dataB && (
          <div className="space-y-8">
            {/* Predicted Points Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 border border-white/5 text-center">
                <h3 className="text-xl font-bold text-neon-blue mb-2">{teamA}</h3>
                <p className="text-4xl font-black text-white">
                  {formatGroupPoints(predA?.predicted_group_points)}
                </p>
                <p className="text-sm text-gray-400 mt-1">Puntos predichos (grupo)</p>
              </div>
              <div className="glass-panel rounded-2xl p-6 border border-white/5 text-center">
                <h3 className="text-xl font-bold text-purple-400 mb-2">{teamB}</h3>
                <p className="text-4xl font-black text-white">
                  {formatGroupPoints(predB?.predicted_group_points)}
                </p>
                <p className="text-sm text-gray-400 mt-1">Puntos predichos (grupo)</p>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5">
              <h3 className="text-lg font-bold text-white mb-4 text-center">
                Radar Comparativo
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar
                    name={teamA}
                    dataKey={teamA}
                    stroke="#00f0ff"
                    fill="#00f0ff"
                    fillOpacity={0.2}
                  />
                  <Radar
                    name={teamB}
                    dataKey={teamB}
                    stroke="#a855f7"
                    fill="#a855f7"
                    fillOpacity={0.2}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Stat Cards with Advantage Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RADAR_METRICS.map((m) => {
                const adv = getAdvantage(m.key, m.invert);
                return (
                  <div
                    key={m.key}
                    className="bg-[#141414] rounded-xl p-4 border border-white/5"
                  >
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                      {m.label}
                    </p>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-neon-blue font-bold text-lg">
                          {dataA[m.key] != null
                            ? typeof dataA[m.key] === "number"
                              ? dataA[m.key].toFixed(2)
                              : dataA[m.key]
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-400 font-bold text-lg">
                          {dataB[m.key] != null
                            ? typeof dataB[m.key] === "number"
                              ? dataB[m.key].toFixed(2)
                              : dataB[m.key]
                            : "—"}
                        </span>
                      </div>
                    </div>
                    {adv && (
                      <div className="mt-2">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                            adv === teamA
                              ? "bg-neon-blue/10 text-neon-blue border border-neon-blue/30"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                          }`}
                        >
                          <Trophy className="w-3 h-3 inline mr-1" />
                          Ventaja: {adv}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== DATA SCIENCE VIEW ==================== */}
        {viewMode === "datascience" && dataA && dataB && (
          <div className="space-y-8">
            {/* Model Info */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5">
              <h3 className="text-xl font-bold text-white mb-3">
                🤖 Modelo de referencia: team_points_xgb_model
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                El modelo utiliza 19 features derivadas del squad (datos reales de
                master_teams_featured.csv). En esta pantalla se muestra el valor redondeado
                para mantener los puntos como enteros de tabla.
              </p>
              <div className="flex flex-wrap gap-2">
                {TEAM_POINTS_FEATURES.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded border border-purple-500/20"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Features Table */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 overflow-x-auto">
              <h3 className="text-lg font-bold text-white mb-4">
                Comparación de Features (19 variables)
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="text-left py-2">Feature</th>
                    <th className="text-right py-2 text-neon-blue">{teamA}</th>
                    <th className="text-right py-2 text-purple-400">{teamB}</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAM_POINTS_FEATURES.map((f) => (
                    <tr key={f} className="border-b border-white/5">
                      <td className="py-2 text-gray-300 font-mono text-xs">{f}</td>
                      <td className="py-2 text-right text-white font-mono">
                        {dataA[f] != null
                          ? typeof dataA[f] === "number"
                            ? dataA[f].toFixed(3)
                            : dataA[f]
                          : "—"}
                      </td>
                      <td className="py-2 text-right text-white font-mono">
                        {dataB[f] != null
                          ? typeof dataB[f] === "number"
                            ? dataB[f].toFixed(3)
                            : dataB[f]
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Prediction Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h4 className="text-base font-bold text-neon-blue mb-2">
                  Predicción {teamA}
                </h4>
                <p className="text-3xl font-black text-white">
                  {formatGroupPoints(predA?.predicted_group_points)} pts
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Modelo: {predA?.model_used ?? "team_points_xgb_model"}
                </p>
              </div>
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h4 className="text-base font-bold text-purple-400 mb-2">
                  Predicción {teamB}
                </h4>
                <p className="text-3xl font-black text-white">
                  {formatGroupPoints(predB?.predicted_group_points)} pts
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Modelo: {predB?.model_used ?? "team_points_xgb_model"}
                </p>
              </div>
            </div>

            {/* Feature Explanation */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5">
              <h4 className="text-base font-bold text-white mb-3">
                📖 Descripción de las Features
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-300">
                <div><strong className="text-white">squad_total_market_value:</strong> Valor total de mercado del squad (€)</div>
                <div><strong className="text-white">squad_avg_market_value:</strong> Valor promedio por jugador (€)</div>
                <div><strong className="text-white">squad_total_injuries:</strong> Total histórico de lesiones del squad</div>
                <div><strong className="text-white">squad_total_wc_goals:</strong> Goles totales en Mundiales</div>
                <div><strong className="text-white">squad_avg_wc_goals:</strong> Promedio de goles WC por jugador</div>
                <div><strong className="text-white">squad_total_wc_assists:</strong> Asistencias en Mundiales</div>
                <div><strong className="text-white">squad_total_allcomps_goals:</strong> Goles en todas las competiciones</div>
                <div><strong className="text-white">squad_total_allcomps_assists:</strong> Asistencias totales</div>
                <div><strong className="text-white">squad_avg_age:</strong> Edad promedio del plantel</div>
                <div><strong className="text-white">squad_median_age:</strong> Mediana de edad</div>
                <div><strong className="text-white">squad_total_caps:</strong> Total de internacionalidades</div>
                <div><strong className="text-white">squad_avg_caps:</strong> Promedio de caps por jugador</div>
                <div><strong className="text-white">squad_injury_burden:</strong> Carga total de lesiones (días perdidos)</div>
                <div><strong className="text-white">squad_depth_DF/FW/GK/MF:</strong> Profundidad por posición</div>
                <div><strong className="text-white">squad_top_league_ratio:</strong> % jugadores en ligas top-5</div>
                <div><strong className="text-white">squad_avg_impact_score:</strong> Promedio de Impact Score AI</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
