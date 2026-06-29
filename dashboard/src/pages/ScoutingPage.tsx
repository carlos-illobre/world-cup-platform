import { useState, useEffect, useRef } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { Search, Filter, MapPin, Activity, Shield, LayoutGrid, FlaskConical, ArrowUpDown, X, Users, UserPlus, GitCompare, Sparkles, Star, ChevronDown, ChevronUp } from "lucide-react";
import { fetchJson } from "@/shared/lib/apiClient";
import { MoneyballChart } from "@/features/scouting/components/MoneyballChart";
import { BeeswarmChart } from "@/features/scouting/components/BeeswarmChart";
import { TopClusterBarChart } from "@/features/scouting/components/TopClusterBarChart";
import { ScoutingRadarChart } from "@/features/scouting/components/ScoutingRadarChart";
import { InjuryImpactChart } from "@/features/scouting/components/InjuryImpactChart";
import { XgOverperfChart } from "@/features/scouting/components/XgOverperfChart";
import { GlossaryDrawer } from "@/features/scouting/components/GlossaryDrawer";
import { ComparePanel } from "@/features/scouting/components/ComparePanel";
import { SimilarPlayersPanel } from "@/features/scouting/components/SimilarPlayersPanel";
import { ModelInfoPanel } from "@/features/scouting/components/ModelInfoPanel";
import { CLUSTER_NAMES, CLUSTER_COLORS } from "@/features/scouting/constants";
import { STYLE_NAMES, getPlayerVerdict, getTopStrengths } from "@/features/scouting/playerUtils";

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function ScoutingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [players, setPlayers] = useState<any[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [cluster, setCluster] = useState("");
  const [sortBy, setSortBy] = useState("impact_score_raw");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [maxAge, setMaxAge] = useState("");
  const [minAge, setMinAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Nuevos estados para Analytics
  const [viewMode, setViewMode] = useState<"grid" | "analytics">("grid");
  const [clusterAverages, setClusterAverages] = useState<any>(null);
  const [top10Data, setTop10Data] = useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>("3");
  const [selectedPlayerForRadar, setSelectedPlayerForRadar] = useState<any>(null);

  // Sort options for the dropdown
  const SORT_OPTIONS = [
    { value: "impact_score_raw", label: "Nivel de Aporte (mayor a menor)" },
    { value: "xg_overperformance", label: "Eficiencia Goleadora" },
    { value: "Age", label: "Edad" },
    { value: "total_injuries", label: "Disponibilidad (menos lesiones)" },
    { value: "overall", label: "Nivel General (FIFA)" },
    { value: "pace", label: "Velocidad" },
    { value: "shooting", label: "Definición" },
    { value: "passing", label: "Pase" },
    { value: "dribbling", label: "Técnica" },
    { value: "defending", label: "Marca" },
  ];

  // Decision tools state
  const [shortlist, setShortlist] = useState<any[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [similarPlayer, setSimilarPlayer] = useState<any>(null);

  const addToShortlist = (player: any) => {
    if (shortlist.find((p) => p.id === player.id)) return;
    if (shortlist.length >= 4) return; // max 4
    setShortlist([...shortlist, player]);
  };

  const removeFromShortlist = (id: string) => {
    setShortlist(shortlist.filter((p) => p.id !== id));
  };

  const isInShortlist = (id: string) => shortlist.some((p) => p.id === id);

  // Cargar paises y promedios de clusters al montar
  useEffect(() => {
    fetchJson("/api/v1/players/countries")
      .then((data) => setCountries(data.items || []))
      .catch(console.error);

    fetchJson("/api/v1/players/clusters/averages")
      .then(setClusterAverages)
      .catch(console.error);
  }, []);

  // Cargar jugadores (limit=100 para Moneyball/Beeswarm)
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const query = new URLSearchParams({ limit: "100" });
        if (debouncedSearchTerm) query.append("name", debouncedSearchTerm);
        if (country) query.append("country", country);
        if (cluster) query.append("cluster", cluster);
        if (sortBy) query.append("sort_by", sortBy);
        if (sortOrder) query.append("order", sortOrder);

        const data = await fetchJson(`/api/v1/players?${query.toString()}`);
        let items = data.items || [];

        // Client-side age filtering (backend doesn't support it natively)
        if (minAge) {
          items = items.filter((p: any) => p.age != null && p.age >= Number(minAge));
        }
        if (maxAge) {
          items = items.filter((p: any) => p.age != null && p.age <= Number(maxAge));
        }

        setPlayers(items);
        setTotalPlayers(data.total || items.length);

        // Auto-seleccionar primer jugador para el Radar si hay datos
        if (items.length > 0) {
          setSelectedPlayerForRadar(items[0]);
        }
      } catch (err) {
        console.error("Error fetching players:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [debouncedSearchTerm, country, cluster, sortBy, sortOrder, minAge, maxAge]);

  // Cargar Top 10 para el cluster seleccionado
  useEffect(() => {
    if (viewMode === "analytics") {
      fetchJson(`/api/v1/players?cluster=${selectedCluster}&sort_by=impact_score_raw&order=desc&limit=10`)
        .then((data) => setTop10Data(data.items || []))
        .catch(console.error);
    }
  }, [selectedCluster, viewMode]);

  // Cerrar autocompletado si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2 flex items-center gap-3">
              Scouting & Convocatoria
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              {viewMode === "grid"
                ? "Encuentra, compara y decide qué jugadores convocar. Cada tarjeta incluye una recomendación automática basada en rendimiento, salud y proyección."
                : "Panel técnico para científicos de datos: visualiza las distribuciones de los modelos, revisa métricas de evaluación y valida los algoritmos de clustering e impacto."
              }
            </p>
          </div>

          {/* View Toggles */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "grid" ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "text-gray-300 hover:text-white"}`}
            >
              <LayoutGrid className="w-4 h-4" /> Panel de Decisión
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "analytics" ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "text-gray-300 hover:text-white"}`}
            >
              <FlaskConical className="w-4 h-4" /> Modelo & Validación
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 mb-4 relative z-40 shadow-lg space-y-4">
          {/* Row 1: Search + Country */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group" ref={searchRef}>
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-neon-blue transition-colors" />
              <input
                type="text"
                placeholder="Buscar jugador por nombre..."
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => { if (searchTerm) setShowAutocomplete(true); }}
              />

              {/* Dropdown de Autocompletado */}
              {showAutocomplete && players.length > 0 && viewMode === "grid" && (
                <div className="absolute z-50 w-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                  {players.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-4 py-3 hover:bg-white/10 flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
                      onClick={() => {
                        setSearchTerm(p.name);
                        setShowAutocomplete(false);
                      }}
                    >
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="w-10 h-10 rounded-full object-cover bg-black/50 border border-white/10" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center border border-white/10">
                          <Search className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{p.name}</p>
                        <p className="text-gray-300 text-xs truncate">{p.country} • {p.position}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative md:w-52 shrink-0 group">
              <Filter className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-neon-blue transition-colors" />
              <select
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent appearance-none transition-all cursor-pointer hover:bg-black/70 shadow-inner"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">Todos los países</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Sort + Cluster + Age Range */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Sort By */}
            <div className="relative md:w-72 shrink-0 group">
              <ArrowUpDown className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-neon-blue transition-colors" />
              <select
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent appearance-none transition-all cursor-pointer hover:bg-black/70 shadow-inner"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Sort Direction */}
            <button
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="flex items-center gap-2 px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-black/70 transition-all shrink-0"
              title={sortOrder === "desc" ? "Mayor a menor" : "Menor a mayor"}
            >
              {sortOrder === "desc" ? "↓ Mayor primero" : "↑ Menor primero"}
            </button>

            {/* Cluster Filter */}
            <div className="relative md:w-56 shrink-0 group">
              <Shield className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-neon-blue transition-colors" />
              <select
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent appearance-none transition-all cursor-pointer hover:bg-black/70 shadow-inner"
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
              >
                <option value="">Todos los estilos</option>
                {Object.entries(STYLE_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            {/* Age Range */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400 whitespace-nowrap">Edad:</span>
              <input
                type="number"
                placeholder="Min"
                min="15"
                max="45"
                className="w-16 bg-black/50 border border-white/10 rounded-lg py-2.5 px-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-neon-blue"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
              />
              <span className="text-gray-500">—</span>
              <input
                type="number"
                placeholder="Max"
                min="15"
                max="45"
                className="w-16 bg-black/50 border border-white/10 rounded-lg py-2.5 px-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-neon-blue"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
              />
            </div>
          </div>

          {/* Active Filters Chips + Results Counter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              <span>Mostrando <strong className="text-white">{players.length}</strong> de <strong className="text-white">{totalPlayers}</strong> jugadores</span>
            </div>
            <div className="flex-1" />
            {country && (
              <span className="inline-flex items-center gap-1 text-sm bg-neon-blue/10 text-neon-blue border border-neon-blue/20 px-2.5 py-1 rounded-full">
                {country}
                <button onClick={() => setCountry("")} className="hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {cluster && (
              <span className="inline-flex items-center gap-1 text-sm border px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${CLUSTER_COLORS[cluster]}15`, borderColor: `${CLUSTER_COLORS[cluster]}40`, color: CLUSTER_COLORS[cluster] }}
              >
                {STYLE_NAMES[cluster] || cluster}
                <button onClick={() => setCluster("")} className="hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {minAge && (
              <span className="inline-flex items-center gap-1 text-sm bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-full">
                Edad ≥ {minAge}
                <button onClick={() => setMinAge("")} className="hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {maxAge && (
              <span className="inline-flex items-center gap-1 text-sm bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-full">
                Edad ≤ {maxAge}
                <button onClick={() => setMaxAge("")} className="hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {(country || cluster || minAge || maxAge) && (
              <button
                onClick={() => { setCountry(""); setCluster(""); setMinAge(""); setMaxAge(""); }}
                className="text-sm text-gray-500 hover:text-red-400 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && viewMode === "grid" && (
          <div className="flex flex-col items-center justify-center py-20 opacity-70">
            <div className="w-full max-w-sm space-y-3">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-neon-blue to-cyan-400 rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]" style={{ width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
              <p className="text-neon-blue text-sm font-medium text-center">Buscando jugadores...</p>
            </div>
          </div>
        )}

        {/* ===================== VIEW MODE: ANALYTICS (Data Science) ===================== */}
        {viewMode === "analytics" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Model Info Panel */}
            <ModelInfoPanel clusterAverages={clusterAverages} totalPlayers={totalPlayers} />

            {/* Separator */}
            <div className="border-t border-white/10 pt-6">
              <h2 className="text-2xl font-display font-bold text-white mb-2">Visualizaciones de Distribución</h2>
              <p className="text-sm text-gray-400 mb-6">Gráficos exploratorios para validar la separabilidad de clusters, detectar outliers y evaluar la relación entre features.</p>
            </div>

            {/* Row 1: Moneyball & Injury-Impact Trade-Off */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <MoneyballChart data={players} />
              <InjuryImpactChart data={players} />
            </div>

            {/* Row 1.5: xG Overperformance */}
            <XgOverperfChart data={players} />

            {/* Row 2: Beeswarm distribution */}
            <BeeswarmChart data={players} />

            {/* Row 3: Top 10 Bar Chart & Radar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 bg-black/30 border border-white/5 p-4 rounded-xl">
                  <span className="text-sm font-bold text-gray-300">Cluster para inspección:</span>
                  <select
                    className="bg-black/50 border border-white/10 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-neon-blue outline-none"
                    value={selectedCluster}
                    onChange={(e) => setSelectedCluster(e.target.value)}
                  >
                    {Object.entries(CLUSTER_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                </div>
                <TopClusterBarChart data={top10Data} clusterId={selectedCluster} />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 bg-black/30 border border-white/5 p-4 rounded-xl">
                  <span className="text-sm font-bold text-gray-300">Jugador para radar:</span>
                  <select
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-neon-blue outline-none"
                    value={selectedPlayerForRadar?.id || ""}
                    onChange={(e) => {
                      const p = players.find(player => String(player.id) === e.target.value);
                      if (p) setSelectedPlayerForRadar(p);
                    }}
                  >
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <ScoutingRadarChart playerData={selectedPlayerForRadar} clusterAverages={clusterAverages} />
              </div>
            </div>
          </div>
        )}

        {/* ===================== VIEW MODE: GRID ===================== */}

        {/* Data Legend - compact hint for end users */}
        {viewMode === "grid" && !loading && players.length > 0 && (
          <div className="mb-6 mt-4 bg-[#141414] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <span className="text-xl">💡</span>
            <p className="text-base text-gray-300">
              Cada tarjeta incluye una <strong className="text-white">recomendación automática</strong> basada en rendimiento, historial de lesiones y proyección. 
              Hacé hover para <strong className="text-neon-blue">comparar</strong> o <strong className="text-purple-400">buscar alternativas similares</strong>.
            </p>
          </div>
        )}

        {viewMode === "grid" && !loading && players.length === 0 ? (
          <div className="text-center py-20 bg-black/20 rounded-xl border border-white/5 flex flex-col items-center justify-center">
            <Search className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-1">Sin resultados</h3>
            <p className="text-gray-300 text-sm">No se encontraron jugadores que coincidan con los filtros seleccionados.</p>
          </div>
        ) : viewMode === "grid" && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {players.map((p: any) => {
              // User-friendly computed values
              const verdict = getPlayerVerdict(p, country || null);
              const topStrengths = getTopStrengths(p.attributes);
              const styleName = p.cluster != null ? (STYLE_NAMES[p.cluster] || "Desconocido") : "Sin clasificar";
              const clusterColor = p.cluster != null ? (CLUSTER_COLORS[p.cluster] || "#888") : "#888";

              // xG interpretation (user-friendly)
              const xgValue = p.xg_overperformance != null ? Number(p.xg_overperformance) : null;
              const xgLabel = xgValue == null
                ? null
                : xgValue > 0.3
                  ? "Define partidos"
                  : xgValue > 0
                    ? "Buen finalizador"
                    : xgValue > -0.3
                      ? "Finalizador promedio"
                      : "Desperdicia chances";
              const xgColor = xgValue == null ? "" : xgValue > 0 ? "text-green-400" : xgValue < -0.3 ? "text-red-400" : "text-gray-400";

              return (
              <div key={p.id} className="group relative bg-[#141414] border border-white/5 rounded-2xl p-5 hover:bg-[#1a1a1a] hover:border-neon-blue/40 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none group-hover:bg-neon-blue/10 transition-colors"></div>

                {/* Action buttons (visible on hover) */}
                <div className="absolute top-3 right-3 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => addToShortlist(p)}
                    disabled={isInShortlist(p.id)}
                    className={`p-1.5 rounded-lg border transition-all ${isInShortlist(p.id) ? "bg-neon-blue/20 border-neon-blue/40 text-neon-blue" : "bg-black/60 border-white/10 text-gray-400 hover:text-neon-blue hover:border-neon-blue/30"}`}
                    title={isInShortlist(p.id) ? "Ya está en la comparación" : "Agregar a comparación"}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSimilarPlayer(p)}
                    className="p-1.5 rounded-lg bg-black/60 border border-white/10 text-gray-400 hover:text-purple-400 hover:border-purple-400/30 transition-all"
                    title="Buscar jugadores similares"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Player identity */}
                <div className="relative z-10 flex items-start gap-4 mb-4">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-18 h-18 rounded-full object-cover border-2 border-white/10 group-hover:border-neon-blue/50 transition-colors bg-black/50" />
                  ) : (
                    <div className="w-18 h-18 rounded-full bg-gradient-to-br from-gray-800 to-black border-2 border-white/10 flex items-center justify-center shadow-inner group-hover:border-neon-blue/50 transition-colors">
                      <span className="text-2xl font-bold text-gray-300">{p.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-xl font-bold text-white truncate group-hover:text-neon-blue transition-colors">{p.name}</h3>
                    <div className="flex items-center gap-1.5 text-base text-gray-300 mt-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="truncate">{p.country}</span>
                    </div>
                    <div className="text-base text-gray-300 mt-0.5 truncate font-medium">
                      {p.position} • {p.club} • {p.age ? Math.floor(p.age) : "?"} años
                    </div>
                  </div>
                </div>

                {/* Recommendation Badge */}
                <div className={`relative z-10 rounded-lg border p-3 mb-3 ${verdict.bgColor}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-bold ${verdict.color}`}>{verdict.label}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < verdict.stars ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{verdict.reasons[0]}</p>
                </div>

                {/* Key info in user-friendly language */}
                <div className="relative z-10 space-y-2.5 pt-3 border-t border-white/5">
                  {/* Style of play */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 font-medium">Estilo de Juego</span>
                    <span className="text-sm font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5"
                      style={{ backgroundColor: `${clusterColor}15`, borderColor: `${clusterColor}40`, color: clusterColor }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: clusterColor }}></span>
                      {styleName}
                    </span>
                  </div>

                  {/* Finishing ability */}
                  {xgLabel && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 font-medium">Eficiencia Goleadora</span>
                      <span className={`text-sm font-medium ${xgColor}`}>{xgLabel}</span>
                    </div>
                  )}

                  {/* Availability */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 font-medium">Disponibilidad</span>
                    <span className={`text-sm font-medium ${(p.total_injuries || 0) > 8 ? "text-red-400" : (p.total_injuries || 0) > 4 ? "text-yellow-400" : "text-green-400"}`}>
                      {(p.total_injuries || 0) > 8 ? "Riesgo alto" : (p.total_injuries || 0) > 4 ? "Riesgo moderado" : "Buena"} ({p.total_injuries || 0} lesiones)
                    </span>
                  </div>

                  {/* Top strengths (simplified FIFA) */}
                  {topStrengths.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 font-medium">Fortalezas</span>
                      <div className="flex gap-1.5">
                        {topStrengths.map(s => (
                          <span key={s.label} className="text-xs bg-white/5 text-gray-200 px-2 py-0.5 rounded border border-white/10">
                            {s.label} {s.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Shortlist Bar */}
      {shortlist.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2">
            {shortlist.map((p) => (
              <div key={p.id} className="relative group/chip">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="w-10 h-10 rounded-full object-cover border-2 border-neon-blue/50" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-black/50 border-2 border-neon-blue/50 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-300">{p.name.charAt(0)}</span>
                  </div>
                )}
                <button
                  onClick={() => removeFromShortlist(p.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/chip:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
          <div className="h-8 w-px bg-white/10" />
          <button
            onClick={() => setShowCompare(true)}
            disabled={shortlist.length < 2}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${shortlist.length >= 2 ? "bg-neon-blue text-black hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "bg-white/5 text-gray-500 cursor-not-allowed"}`}
          >
            <GitCompare className="w-4 h-4" />
            Comparar ({shortlist.length})
          </button>
          <button
            onClick={() => setShortlist([])}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Compare Panel Modal */}
      {showCompare && shortlist.length >= 2 && (
        <ComparePanel
          players={shortlist}
          onRemove={removeFromShortlist}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Similar Players Drawer */}
      {similarPlayer && (
        <SimilarPlayersPanel
          player={similarPlayer}
          onClose={() => setSimilarPlayer(null)}
          onAddToCompare={addToShortlist}
        />
      )}

      <GlossaryDrawer />
    </main>
  );
}
