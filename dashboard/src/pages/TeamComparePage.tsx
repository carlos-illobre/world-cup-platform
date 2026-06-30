import { useState, useEffect, useRef, useMemo } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { LayoutGrid, BarChart2, Search, Trophy, Shield, Swords, Brain } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CompareModelPanel } from "@/features/compare/components/CompareModelPanel";

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

const RADAR_METRICS = [
  { key: "squad_avg_age", label: "Edad Promedio", invert: true },
  { key: "squad_avg_market_value", label: "Valor Mercado" },
  { key: "squad_injury_burden", label: "Carga Lesiones", invert: true },
  { key: "squad_total_allcomps_goals", label: "Goles Totales" },
  { key: "squad_top_league_ratio", label: "Ratio Top Liga" },
  { key: "squad_avg_impact_score", label: "Impact Score" },
];

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
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
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
              onClick={() => { onChange(t.value); setInput(t.label); setOpen(false); }}
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

// --- Confidence Badge ---
function ConfidenceBadge({ entropy }: { entropy: number | null }) {
  if (entropy == null) return null;
  let label: string, color: string, bgColor: string;
  if (entropy < 0.60) {
    label = "Alta confianza";
    color = "text-green-400";
    bgColor = "bg-green-500/10 border-green-500/30";
  } else if (entropy < 0.85) {
    label = "Media confianza";
    color = "text-yellow-400";
    bgColor = "bg-yellow-500/10 border-yellow-500/30";
  } else {
    label = "Baja confianza";
    color = "text-red-400";
    bgColor = "bg-red-500/10 border-red-500/30";
  }
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${bgColor} ${color}`}>
      {label} (H={entropy.toFixed(2)})
    </span>
  );
}

// --- Compute Shannon entropy ---
function computeEntropy(probs: { win_A: number; draw: number; win_B: number }): number {
  const vals = [probs.win_A, probs.draw, probs.win_B].filter((p) => p > 0);
  const H = -vals.reduce((sum, p) => sum + p * Math.log2(p), 0);
  return H / Math.log2(3); // Normalized to [0, 1]
}

// --- Generate algorithmic verdict ---
function getTeamVerdict(
  teamA: string, teamB: string,
  predA: any, predB: any,
  h2h: any, dataA: any, dataB: any
): string {
  if (!predA || !predB) return "";

  const ptsA = predA?.predicted_group_points ?? 0;
  const ptsB = predB?.predicted_group_points ?? 0;

  const h2hAdv = h2h?.probabilities
    ? (h2h.probabilities.win_A > h2h.probabilities.win_B ? teamA : teamB)
    : null;

  const injA = dataA?.squad_injury_burden ?? 0;
  const injB = dataB?.squad_injury_burden ?? 0;
  const injAdv = injA < injB ? teamA : injB < injA ? teamB : null;

  const depthA = (dataA?.squad_depth_DF ?? 0) + (dataA?.squad_depth_MF ?? 0) + (dataA?.squad_depth_FW ?? 0);
  const depthB = (dataB?.squad_depth_DF ?? 0) + (dataB?.squad_depth_MF ?? 0) + (dataB?.squad_depth_FW ?? 0);
  const depthAdv = depthA > depthB ? teamA : depthB > depthA ? teamB : null;

  // Composite score: predicted pts (40%) + H2H probability (30%) + injury (15%) + depth (15%)
  const h2hScore = h2h?.probabilities
    ? { A: h2h.probabilities.win_A, B: h2h.probabilities.win_B }
    : { A: 0.5, B: 0.5 };

  const scoreA = (ptsA / 9) * 0.4 + h2hScore.A * 0.3 + (1 - injA / Math.max(injA + injB, 1)) * 0.15 + (depthA / Math.max(depthA + depthB, 1)) * 0.15;
  const scoreB = (ptsB / 9) * 0.4 + h2hScore.B * 0.3 + (1 - injB / Math.max(injA + injB, 1)) * 0.15 + (depthB / Math.max(depthA + depthB, 1)) * 0.15;

  const diff = Math.abs(scoreA - scoreB) / Math.max(scoreA, scoreB, 0.01);
  const winner = scoreA > scoreB ? teamA : teamB;
  const loser = scoreA > scoreB ? teamB : teamA;

  if (diff > 0.25) {
    return `${winner} tiene una ventaja clara sobre ${loser}. El modelo predice más puntos de grupo, mayor probabilidad de victoria en H2H directo${injAdv === winner ? ', menor carga de lesiones' : ''}${depthAdv === winner ? ' y mayor profundidad de plantilla' : ''}.`;
  } else if (diff > 0.10) {
    return `${winner} tiene una ligera ventaja por balance global (predicción + H2H + salud del plantel), pero ${loser} podría superarlo en contextos específicos como condiciones climáticas adversas o en un enfrentamiento táctico favorable.`;
  } else {
    return `Ambas selecciones están extremadamente parejas. La diferencia entre ${teamA} y ${teamB} es mínima según el modelo — la decisión depende del contexto táctico, condiciones del estadio y momento de forma.`;
  }
}

export function TeamComparePage() {
  const [viewMode, setViewMode] = useState<"business" | "datascience">("business");
  const [teamA, setTeamA] = useState("Argentina");
  const [teamB, setTeamB] = useState("France");
  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);
  const [predA, setPredA] = useState<any>(null);
  const [predB, setPredB] = useState<any>(null);
  const [formationA, setFormationA] = useState<any>(null);
  const [formationB, setFormationB] = useState<any>(null);
  const [h2hPrediction, setH2hPrediction] = useState<any>(null);
  const [h2hRfPrediction, setH2hRfPrediction] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<"xgboost" | "random_forest" | "both">("both");
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [groupsData, setGroupsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Climate conditions — user-provided because they depend on
  // the specific match date/venue which is unknown for a hypothetical comparison
  const [tempMax, setTempMax] = useState(25);
  const [precipitation, setPrecipitation] = useState(0);
  const [windSpeed, setWindSpeed] = useState(10);
  const [selectedStadium, setSelectedStadium] = useState<number | null>(null);
  const [matchDate, setMatchDate] = useState("");
  const [stadiums, setStadiums] = useState<any[]>([]);
  const [matchDates, setMatchDates] = useState<any[]>([]);
  const [weatherSource, setWeatherSource] = useState<"manual" | "api" | "error">("manual");
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Fetch all teams for global normalization + stadiums list
  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/teams/`)
      .then((r) => r.json())
      .then((d) => setAllTeams(d.data || []))
      .catch(() => {});
    fetch(`${INJURY_API_BASE_URL}/api/v1/teams/groups`)
      .then((r) => r.json())
      .then((d) => setGroupsData(d.data || {}))
      .catch(() => {});
    fetch(`${INJURY_API_BASE_URL}/api/v1/matches/stadiums`)
      .then((r) => r.json())
      .then((d) => setStadiums(d.data || []))
      .catch(() => {});
    fetch(`${INJURY_API_BASE_URL}/api/v1/matches/dates`)
      .then((r) => r.json())
      .then((d) => setMatchDates(d.data || []))
      .catch(() => {});
  }, []);

  // Auto-fetch weather when stadium + date are both selected
  useEffect(() => {
    if (!selectedStadium || !matchDate) return;
    setWeatherLoading(true);
    fetch(`${INJURY_API_BASE_URL}/api/v1/matches/stadiums/${selectedStadium}/weather?date=${matchDate}`)
      .then((r) => {
        if (!r.ok) throw new Error("no data");
        return r.json();
      })
      .then((d) => {
        const w = d.weather;
        if (w) {
          setTempMax(Math.round(w.temp_max ?? 25));
          setPrecipitation(Math.round(w.precipitation ?? 0));
          setWindSpeed(Math.round(w.wind_speed ?? 10));
          setWeatherSource("api");
        }
        setWeatherLoading(false);
      })
      .catch(() => {
        setWeatherSource("error");
        setWeatherLoading(false);
      });
  }, [selectedStadium, matchDate]);

  // Fetch team A data
  useEffect(() => {
    if (!teamA) return;
    setLoading(true);
    Promise.all([
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamA)}`).then((r) => r.json()),
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamA)}/prediction`).then((r) => r.json()),
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamA)}/formation`).then((r) => r.json()),
    ]).then(([detail, pred, form]) => {
      setDataA(detail.data);
      setPredA(pred.data);
      setFormationA(form.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamA]);

  // Fetch team B data
  useEffect(() => {
    if (!teamB) return;
    setLoading(true);
    Promise.all([
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamB)}`).then((r) => r.json()),
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamB)}/prediction`).then((r) => r.json()),
      fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(teamB)}/formation`).then((r) => r.json()),
    ]).then(([detail, pred, form]) => {
      setDataB(detail.data);
      setPredB(pred.data);
      setFormationB(form.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamB]);

  // Fetch H2H direct prediction — uses user-provided climate conditions
  useEffect(() => {
    if (!teamA || !teamB) return;
    const timer = setTimeout(() => {
      fetch(`${INJURY_API_BASE_URL}/api/v1/matches/predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_a: teamA, team_b: teamB, temp_max: tempMax, precipitation, wind_speed: windSpeed }),
      })
        .then((r) => r.json())
        .then(setH2hPrediction)
        .catch(() => setH2hPrediction(null));

      // Also fetch RF prediction
      fetch(`${INJURY_API_BASE_URL}/api/v1/models/compare/match-outcome/predict-comparison?team_a=${encodeURIComponent(teamA)}&team_b=${encodeURIComponent(teamB)}&temp_max=${tempMax}&precipitation=${precipitation}&wind_speed=${windSpeed}`)
        .then((r) => r.json())
        .then((data) => setH2hRfPrediction(data.random_forest))
        .catch(() => setH2hRfPrediction(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [teamA, teamB, tempMax, precipitation, windSpeed]);

  // Radar data with GLOBAL normalization (vs all 48 teams)
  const radarData = useMemo(() => {
    if (!dataA || !dataB) return [];
    return RADAR_METRICS.map((m) => {
      const valA = Number(dataA[m.key]) || 0;
      const valB = Number(dataB[m.key]) || 0;
      // Global min/max from all teams
      let globalMin = valA, globalMax = valA;
      allTeams.forEach((t: any) => {
        const v = Number(t.squad_stats?.[m.key.replace('squad_', '')] ?? t[m.key]) || 0;
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      });
      // Fallback if allTeams not loaded
      if (globalMax === globalMin) { globalMax = Math.max(valA, valB, 1); globalMin = 0; }
      const range = globalMax - globalMin || 1;
      const normA = m.invert ? (1 - (valA - globalMin) / range) * 100 : ((valA - globalMin) / range) * 100;
      const normB = m.invert ? (1 - (valB - globalMin) / range) * 100 : ((valB - globalMin) / range) * 100;
      return { metric: m.label, [teamA]: Math.max(0, Math.min(100, normA)), [teamB]: Math.max(0, Math.min(100, normB)), rawA: valA, rawB: valB };
    });
  }, [dataA, dataB, teamA, teamB, allTeams]);

  // Find team's group info
  const getTeamGroup = (teamName: string) => {
    if (!groupsData) return null;
    for (const [grp, teams] of Object.entries(groupsData) as [string, any[]][]) {
      const found = teams.find((t: any) => t.team === teamName);
      if (found) return { group: grp, teams };
    }
    return null;
  };

  const groupInfoA = getTeamGroup(teamA);
  const groupInfoB = getTeamGroup(teamB);
  const h2hEntropy = h2hPrediction?.probabilities ? computeEntropy(h2hPrediction.probabilities) : null;
  const verdict = getTeamVerdict(teamA, teamB, predA, predB, h2hPrediction, dataA, dataB);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">
              Comparador de Selecciones
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              Compara dos selecciones con predicción H2H directa, puntos de grupo simulados,
              formación táctica y métricas de squad — todo basado en modelos XGBoost entrenados con datos reales.
              Las condiciones climáticas deben ingresarse manualmente ya que dependen del estadio y la fecha.
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
              <LayoutGrid className="w-4 h-4" /> Panel de Decisión
            </button>
            <button
              onClick={() => setViewMode("datascience")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === "datascience"
                  ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <BarChart2 className="w-4 h-4" /> Modelo & Validación
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

          {/* Climate conditions — fetched from Open-Meteo based on stadium + date */}
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold text-gray-300">🌤️ Condiciones Climáticas del Estadio</span>
              {weatherSource === "api" && (
                <span className="text-xs text-green-400/90 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg font-medium">✓ Datos reales de Open-Meteo</span>
              )}
              {weatherSource === "manual" && (
                <span className="text-xs text-yellow-400/90 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg font-medium">✎ Valores manuales</span>
              )}
              {weatherSource === "error" && (
                <span className="text-xs text-red-400/90 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg font-medium">✗ No se pudo obtener — ingresá manualmente</span>
              )}
            </div>

            {/* Stadium + Date selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Estadio (sede del partido)</label>
                <select
                  value={selectedStadium ?? ""}
                  onChange={(e) => setSelectedStadium(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-neon-blue"
                >
                  <option value="">— Seleccionar estadio —</option>
                  {stadiums.map((s) => (
                    <option key={s.id} value={s.id}>{s.stadium} ({s.city}, {s.country})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Fecha del partido</label>
                <select
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-neon-blue"
                >
                  <option value="">— Seleccionar fecha —</option>
                  {matchDates.map((d) => (
                    <option key={d.id} value={d.id}>
                      {new Date(d.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })} — {d.match_count} partido{d.match_count !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {weatherLoading && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-400">Consultando Open-Meteo...</span>
              </div>
            )}

            {/* Sliders — show actual values (from API or manual) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-gray-400 text-xs">🌡️ Temperatura (°C)</label>
                  <span className="text-xs font-bold text-white bg-black/40 px-2 py-0.5 rounded">{tempMax}°C</span>
                </div>
                <input
                  type="range" min={-10} max={50} step={1} value={tempMax}
                  onChange={(e) => { setTempMax(Number(e.target.value)); setWeatherSource("manual"); }}
                  className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-neon-blue"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-gray-400 text-xs">🌧️ Precipitación (mm)</label>
                  <span className="text-xs font-bold text-white bg-black/40 px-2 py-0.5 rounded">{precipitation} mm</span>
                </div>
                <input
                  type="range" min={0} max={50} step={1} value={precipitation}
                  onChange={(e) => { setPrecipitation(Number(e.target.value)); setWeatherSource("manual"); }}
                  className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-neon-blue"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-gray-400 text-xs">💨 Viento (km/h)</label>
                  <span className="text-xs font-bold text-white bg-black/40 px-2 py-0.5 rounded">{windSpeed} km/h</span>
                </div>
                <input
                  type="range" min={0} max={100} step={1} value={windSpeed}
                  onChange={(e) => { setWindSpeed(Number(e.target.value)); setWeatherSource("manual"); }}
                  className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-neon-blue"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Seleccioná un estadio y una fecha para obtener el clima real desde Open-Meteo. También podés ajustar manualmente con los sliders.
            </p>
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

            {/* Algorithm selector */}
            <div className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
              <span className="text-xs text-gray-400 font-medium shrink-0">Algoritmo H2H:</span>
              <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                <button
                  onClick={() => setSelectedModel("xgboost")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedModel === "xgboost"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  XGBoost
                </button>
                <button
                  onClick={() => setSelectedModel("random_forest")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedModel === "random_forest"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Random Forest
                </button>
                <button
                  onClick={() => setSelectedModel("both")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedModel === "both"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Comparar
                </button>
              </div>
            </div>

            {/* === H2H Direct Prediction === */}
            {h2hPrediction?.probabilities && (
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Swords className="w-5 h-5 text-neon-blue" />
                    Predicción Enfrentamiento Directo (H2H)
                  </h3>
                  <ConfidenceBadge entropy={h2hEntropy} />
                </div>

                {/* BOTH models comparison */}
                {selectedModel === "both" && h2hRfPrediction?.probabilities && (
                  <div className="space-y-3 mb-4">
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">XGBoost</span>
                      </div>
                      <div className="flex justify-between items-center px-2">
                        <span className="text-2xl font-black text-amber-300">{(h2hPrediction.probabilities.win_A * 100).toFixed(0)}%</span>
                        <span className="text-lg font-bold text-gray-400">{(h2hPrediction.probabilities.draw * 100).toFixed(0)}%</span>
                        <span className="text-2xl font-black text-amber-300">{(h2hPrediction.probabilities.win_B * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-black/40 rounded-full flex overflow-hidden mt-2">
                        <div style={{ width: `${h2hPrediction.probabilities.win_A * 100}%` }} className="bg-amber-400" />
                        <div style={{ width: `${h2hPrediction.probabilities.draw * 100}%` }} className="bg-gray-500" />
                        <div style={{ width: `${h2hPrediction.probabilities.win_B * 100}%` }} className="bg-amber-600" />
                      </div>
                    </div>
                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Random Forest</span>
                      </div>
                      <div className="flex justify-between items-center px-2">
                        <span className="text-2xl font-black text-cyan-300">{(h2hRfPrediction.probabilities.win_A * 100).toFixed(0)}%</span>
                        <span className="text-lg font-bold text-gray-400">{(h2hRfPrediction.probabilities.draw * 100).toFixed(0)}%</span>
                        <span className="text-2xl font-black text-cyan-300">{(h2hRfPrediction.probabilities.win_B * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-black/40 rounded-full flex overflow-hidden mt-2">
                        <div style={{ width: `${h2hRfPrediction.probabilities.win_A * 100}%` }} className="bg-cyan-400" />
                        <div style={{ width: `${h2hRfPrediction.probabilities.draw * 100}%` }} className="bg-gray-500" />
                        <div style={{ width: `${h2hRfPrediction.probabilities.win_B * 100}%` }} className="bg-cyan-600" />
                      </div>
                    </div>
                    <div className={`text-center text-xs px-3 py-2 rounded-lg border ${
                      h2hPrediction.prediction === h2hRfPrediction.prediction
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                    }`}>
                      {h2hPrediction.prediction === h2hRfPrediction.prediction
                        ? `✓ Ambos coinciden: ${h2hPrediction.prediction}`
                        : `⚠ XGBoost: ${h2hPrediction.prediction} | RF: ${h2hRfPrediction.prediction}`}
                    </div>
                  </div>
                )}

                {/* Single model view */}
                {selectedModel !== "both" && (() => {
                  const pred = selectedModel === "random_forest" && h2hRfPrediction?.probabilities
                    ? h2hRfPrediction : h2hPrediction;
                  return (
                    <>
                      <div className="flex justify-between items-end mb-3 px-4">
                        <div className="flex flex-col items-center">
                          <span className="text-3xl font-black text-neon-blue">
                            {(pred.probabilities.win_A * 100).toFixed(0)}%
                          </span>
                          <span className="text-sm text-gray-300 mt-1">{teamA}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xl font-bold text-gray-400">
                            {(pred.probabilities.draw * 100).toFixed(0)}%
                          </span>
                          <span className="text-xs text-gray-400">Empate</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-3xl font-black text-purple-400">
                            {(pred.probabilities.win_B * 100).toFixed(0)}%
                          </span>
                          <span className="text-sm text-gray-300 mt-1">{teamB}</span>
                        </div>
                      </div>
                      <div className="w-full h-4 bg-gray-800 rounded-full flex overflow-hidden shadow-inner">
                        <div style={{ width: `${pred.probabilities.win_A * 100}%` }} className="bg-neon-blue transition-all duration-500" />
                        <div style={{ width: `${pred.probabilities.draw * 100}%` }} className="bg-gray-500 transition-all duration-500" />
                        <div style={{ width: `${pred.probabilities.win_B * 100}%` }} className="bg-purple-500 transition-all duration-500" />
                      </div>
                    </>
                  );
                })()}

                {/* Probability bar — original single model (fallback for "both" when RF is loading) */}
                {selectedModel === "both" && !h2hRfPrediction?.probabilities && (
                  <>
                    <div className="flex justify-between items-end mb-3 px-4">
                      <div className="flex flex-col items-center">
                        <span className="text-3xl font-black text-neon-blue">
                          {(h2hPrediction.probabilities.win_A * 100).toFixed(0)}%
                        </span>
                        <span className="text-sm text-gray-300 mt-1">{teamA}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xl font-bold text-gray-400">
                          {(h2hPrediction.probabilities.draw * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs text-gray-400">Empate</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-3xl font-black text-purple-400">
                          {(h2hPrediction.probabilities.win_B * 100).toFixed(0)}%
                        </span>
                        <span className="text-sm text-gray-300 mt-1">{teamB}</span>
                      </div>
                    </div>
                    <div className="w-full h-4 bg-gray-800 rounded-full flex overflow-hidden shadow-inner">
                      <div style={{ width: `${h2hPrediction.probabilities.win_A * 100}%` }} className="bg-neon-blue transition-all duration-500" />
                      <div style={{ width: `${h2hPrediction.probabilities.draw * 100}%` }} className="bg-gray-500 transition-all duration-500" />
                      <div style={{ width: `${h2hPrediction.probabilities.win_B * 100}%` }} className="bg-purple-500 transition-all duration-500" />
                    </div>
                  </>
                )}

                {/* Weather conditions used */}
                <div className="mt-3 flex justify-center gap-4 text-xs text-gray-400 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                  <span>🌡️ {tempMax}°C</span>
                  <span>🌧️ {precipitation}mm</span>
                  <span>💨 {windSpeed} km/h</span>
                  <span className={weatherSource === "api" ? "text-green-400/80 font-medium" : "text-yellow-400/80 font-medium"}>
                    {weatherSource === "api" ? "← Open-Meteo real" : "← manual"}
                  </span>
                </div>

                {/* SHAP Explanations */}
                {h2hPrediction.explanations?.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {h2hPrediction.explanations.map((exp: any, i: number) => (
                      <div key={i} className={`bg-black/30 px-3 py-2 rounded-lg border-l-3 ${exp.weight > 0 ? "border-l-neon-blue" : "border-l-red-500"}`}>
                        <span className="text-sm text-white font-medium">{exp.feature}</span>
                        <span className={`ml-2 text-sm font-bold ${exp.weight > 0 ? "text-neon-blue" : "text-red-400"}`}>
                          {exp.weight_display}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Data sources */}
                {h2hPrediction.data_sources && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">FIFA Pts {teamA}</p>
                      <p className="text-sm font-bold text-white">{h2hPrediction.data_sources.team_a_fifa_points}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">FIFA Pts {teamB}</p>
                      <p className="text-sm font-bold text-white">{h2hPrediction.data_sources.team_b_fifa_points}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">H2H Victorias {teamA}</p>
                      <p className="text-sm font-bold text-white">{h2hPrediction.data_sources.h2h_wins_a}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">Ranking Diff</p>
                      <p className="text-sm font-bold text-white">{h2hPrediction.data_sources.ranking_diff?.toFixed(0)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === Predicted Group Points === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h3 className="text-lg font-bold text-neon-blue mb-1">{teamA}</h3>
                <p className="text-4xl font-black text-white">
                  {predA?.predicted_group_points?.toFixed(1) ?? "—"} <span className="text-lg text-gray-400 font-normal">pts</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">Puntos predichos fase de grupos</p>
                {groupInfoA && (
                  <div className="mt-3 bg-black/30 rounded-lg p-3 border border-white/5">
                    <p className="text-xs text-gray-400 mb-1">Grupo {groupInfoA.group.replace('Group ', '')}</p>
                    <div className="flex flex-wrap gap-1">
                      {groupInfoA.teams.filter((t: any) => t.team !== teamA).map((t: any) => (
                        <span key={t.team} className="text-xs bg-white/5 text-gray-300 px-2 py-0.5 rounded">{t.team}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h3 className="text-lg font-bold text-purple-400 mb-1">{teamB}</h3>
                <p className="text-4xl font-black text-white">
                  {predB?.predicted_group_points?.toFixed(1) ?? "—"} <span className="text-lg text-gray-400 font-normal">pts</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">Puntos predichos fase de grupos</p>
                {groupInfoB && (
                  <div className="mt-3 bg-black/30 rounded-lg p-3 border border-white/5">
                    <p className="text-xs text-gray-400 mb-1">Grupo {groupInfoB.group.replace('Group ', '')}</p>
                    <div className="flex flex-wrap gap-1">
                      {groupInfoB.teams.filter((t: any) => t.team !== teamB).map((t: any) => (
                        <span key={t.team} className="text-xs bg-white/5 text-gray-300 px-2 py-0.5 rounded">{t.team}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* === Formation Comparison === */}
            {(formationA || formationB) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formationA && (
                  <div className="glass-panel rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-neon-blue" />
                      <h4 className="text-base font-bold text-white">Formación {teamA}</h4>
                    </div>
                    <p className="text-3xl font-black text-neon-blue mb-2">{formationA.recommended_formation}</p>
                    <p className="text-xs text-gray-400">
                      P(Victoria) con esta formación: {((formationA.formation_win_probabilities?.[formationA.recommended_formation] ?? 0) * 100).toFixed(1)}%
                    </p>
                    {formationA.historical_formations && Object.keys(formationA.historical_formations).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Formaciones históricas usadas:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(formationA.historical_formations).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([f, cnt]: any) => (
                            <span key={f} className="text-xs bg-neon-blue/10 text-neon-blue px-2 py-0.5 rounded border border-neon-blue/20">{f} ({cnt})</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {formationB && (
                  <div className="glass-panel rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-purple-400" />
                      <h4 className="text-base font-bold text-white">Formación {teamB}</h4>
                    </div>
                    <p className="text-3xl font-black text-purple-400 mb-2">{formationB.recommended_formation}</p>
                    <p className="text-xs text-gray-400">
                      P(Victoria) con esta formación: {((formationB.formation_win_probabilities?.[formationB.recommended_formation] ?? 0) * 100).toFixed(1)}%
                    </p>
                    {formationB.historical_formations && Object.keys(formationB.historical_formations).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Formaciones históricas usadas:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(formationB.historical_formations).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([f, cnt]: any) => (
                            <span key={f} className="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">{f} ({cnt})</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* === Radar Chart (globally normalized) === */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5">
              <h3 className="text-lg font-bold text-white mb-2 text-center">
                Radar Comparativo (normalizado vs. 48 selecciones)
              </h3>
              <p className="text-xs text-gray-400 text-center mb-4">
                Cada eje muestra la posición relativa dentro del rango global de todas las selecciones del torneo.
                100% = mejor del torneo, 0% = peor del torneo.
              </p>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar name={teamA} dataKey={teamA} stroke="#00f0ff" fill="#00f0ff" fillOpacity={0.2} strokeWidth={2} />
                  <Radar name={teamB} dataKey={teamB} stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* === Stat Cards with Advantage Badges === */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RADAR_METRICS.map((m) => {
                const valA = dataA?.[m.key] ?? 0;
                const valB = dataB?.[m.key] ?? 0;
                const adv = m.invert
                  ? (valA < valB ? teamA : valA > valB ? teamB : null)
                  : (valA > valB ? teamA : valA < valB ? teamB : null);
                return (
                  <div key={m.key} className="bg-[#141414] rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{m.label}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-neon-blue font-bold text-lg">
                        {typeof valA === "number" ? valA.toFixed(2) : valA ?? "—"}
                      </span>
                      <span className="text-purple-400 font-bold text-lg">
                        {typeof valB === "number" ? valB.toFixed(2) : valB ?? "—"}
                      </span>
                    </div>
                    {adv && (
                      <div className="mt-2">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                          adv === teamA ? "bg-neon-blue/10 text-neon-blue border border-neon-blue/30" : "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                        }`}>
                          <Trophy className="w-3 h-3 inline mr-1" /> Ventaja: {adv}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* === Algorithmic Verdict === */}
            {verdict && (
              <div className="bg-gradient-to-r from-neon-blue/5 to-purple-500/5 border border-neon-blue/20 rounded-xl p-5">
                <h3 className="text-base font-bold text-neon-blue mb-2 flex items-center gap-2">
                  <Brain className="w-5 h-5" /> Veredicto del Algoritmo
                </h3>
                <p className="text-sm text-gray-200 leading-relaxed">{verdict}</p>
                <p className="text-xs text-gray-300 mt-3">
                  Basado en: Puntos predichos de grupo (40%) + Probabilidad H2H directa (30%) + Carga de lesiones inversa (15%) + Profundidad de plantel (15%).
                  Modelo de partidos: XGBoost blend (weather + 3-class), 57.1% accuracy. Datos: FBref + Mundiales 1930-2022 + FIFA Rankings.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== DATA SCIENCE VIEW ==================== */}
        {viewMode === "datascience" && dataA && dataB && (
          <CompareModelPanel
            teamA={teamA}
            teamB={teamB}
            dataA={dataA}
            dataB={dataB}
            predA={predA}
            predB={predB}
            formationA={formationA}
            formationB={formationB}
            h2hPrediction={h2hPrediction}
            weatherInput={{ tempMax, precipitation, windSpeed, source: weatherSource }}
          />
        )}
      </div>
    </main>
  );
}
