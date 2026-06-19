import { useState, useEffect, useRef } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { Search, Filter, MapPin, Activity, Shield, LayoutGrid, BarChart2 } from "lucide-react";
import { fetchJson } from "@/shared/lib/apiClient";
import { MoneyballChart } from "@/features/scouting/components/MoneyballChart";
import { BeeswarmChart } from "@/features/scouting/components/BeeswarmChart";
import { TopClusterBarChart } from "@/features/scouting/components/TopClusterBarChart";
import { ScoutingRadarChart } from "@/features/scouting/components/ScoutingRadarChart";
import { InjuryImpactChart } from "@/features/scouting/components/InjuryImpactChart";
import { XgOverperfChart } from "@/features/scouting/components/XgOverperfChart";
import { CLUSTER_NAMES } from "@/features/scouting/constants";

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
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Nuevos estados para Analytics
  const [viewMode, setViewMode] = useState<"grid" | "analytics">("grid");
  const [clusterAverages, setClusterAverages] = useState<any>(null);
  const [top10Data, setTop10Data] = useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>("3");
  const [selectedPlayerForRadar, setSelectedPlayerForRadar] = useState<any>(null);

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
        
        const data = await fetchJson(`/api/v1/players?${query.toString()}`);
        setPlayers(data.items || []);
        
        // Auto-seleccionar primer jugador para el Radar si hay datos
        if (data.items && data.items.length > 0) {
          setSelectedPlayerForRadar(data.items[0]);
        }
      } catch (err) {
        console.error("Error fetching players:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [debouncedSearchTerm, country]);

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
              Player Profiling & Scouting
              <span className="bg-neon-blue/20 text-neon-blue text-sm px-3 py-1 rounded-full border border-neon-blue/30 font-bold tracking-widest uppercase">
                AI Powered
              </span>
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              Identifica ineficiencias de mercado, analiza el Impact Score predictivo y descubre roles tácticos latentes mediante el algoritmo de clustering K-Means.
            </p>
          </div>

          {/* View Toggles */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            <button 
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "grid" ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "text-gray-300 hover:text-white"}`}
            >
              <LayoutGrid className="w-4 h-4" /> Grid de Jugadores
            </button>
            <button 
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "analytics" ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "text-gray-300 hover:text-white"}`}
            >
              <BarChart2 className="w-4 h-4" /> Visual Analytics
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 relative z-40 shadow-lg">
          <div className="relative flex-1 group" ref={searchRef}>
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-300 group-focus-within:text-neon-blue transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar jugador por nombre... (Impacta los gráficos)" 
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

          <div className="relative md:w-64 shrink-0 group">
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

        {/* LOADING STATE */}
        {loading && viewMode === "grid" && (
          <div className="flex flex-col items-center justify-center py-20 opacity-70">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-neon-blue mb-4"></div>
            <p className="text-neon-blue text-sm font-medium animate-pulse">Buscando jugadores...</p>
          </div>
        )}

        {/* ===================== VIEW MODE: ANALYTICS ===================== */}
        {viewMode === "analytics" && (
          <div className="space-y-8 animate-in fade-in duration-500">
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
                  <span className="text-sm font-bold text-gray-300">Seleccionar Clúster para Ranking Mundial:</span>
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
                  <span className="text-sm font-bold text-gray-300">Seleccionar Jugador para Radar:</span>
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
        {viewMode === "grid" && !loading && players.length === 0 ? (
          <div className="text-center py-20 bg-black/20 rounded-xl border border-white/5 flex flex-col items-center justify-center">
            <Search className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-1">Sin resultados</h3>
            <p className="text-gray-300 text-sm">No se encontraron jugadores que coincidan con los filtros seleccionados.</p>
          </div>
        ) : viewMode === "grid" && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in fade-in duration-500">
            {players.map((p: any) => (
              <div key={p.id} className="group relative bg-[#141414] border border-white/5 rounded-2xl p-5 hover:bg-[#1a1a1a] hover:border-neon-blue/40 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none group-hover:bg-neon-blue/10 transition-colors"></div>
                
                <div className="relative z-10 flex items-start gap-4 mb-5">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-16 h-16 rounded-full object-cover border-2 border-white/10 group-hover:border-neon-blue/50 transition-colors bg-black/50" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black border-2 border-white/10 flex items-center justify-center shadow-inner group-hover:border-neon-blue/50 transition-colors">
                      <span className="text-2xl font-bold text-gray-300">{p.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-lg font-bold text-white truncate group-hover:text-neon-blue transition-colors">{p.name}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-gray-300 mt-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{p.country}</span>
                    </div>
                    <div className="text-sm text-gray-300 mt-0.5 truncate font-medium">
                      {p.position} • {p.club}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 space-y-3 mt-auto pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium"><Activity className="w-3.5 h-3.5" /> Impact Score</span>
                    <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 drop-shadow-sm">
                      {p.impact_score ? p.impact_score.toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium"><Shield className="w-3.5 h-3.5" /> Cluster</span>
                    <span className="text-xs uppercase tracking-wider font-bold bg-neon-blue/10 text-neon-blue border border-neon-blue/20 px-2 py-1 rounded-md">
                      {p.cluster || "Unassigned"}
                    </span>
                  </div>
                  {/* FIFA Attributes Mini-Badges */}
                  {p.attributes && p.attributes.overall && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded font-bold">OVR {p.attributes.overall}</span>
                      {p.attributes.pace && <span className="text-[10px] bg-green-500/15 text-green-300 px-1.5 py-0.5 rounded">PAC {p.attributes.pace}</span>}
                      {p.attributes.shooting && <span className="text-[10px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded">SHO {p.attributes.shooting}</span>}
                      {p.attributes.passing && <span className="text-[10px] bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded">PAS {p.attributes.passing}</span>}
                      {p.attributes.dribbling && <span className="text-[10px] bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded">DRI {p.attributes.dribbling}</span>}
                      {p.attributes.defending && <span className="text-[10px] bg-cyan-500/15 text-cyan-300 px-1.5 py-0.5 rounded">DEF {p.attributes.defending}</span>}
                      {p.attributes.physical && <span className="text-[10px] bg-orange-500/15 text-orange-300 px-1.5 py-0.5 rounded">PHY {p.attributes.physical}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
