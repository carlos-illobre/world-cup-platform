import { useState, useEffect, useRef, useMemo } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { Search } from "lucide-react";
import { SquadCharts } from "@/features/optimizer/components/SquadCharts";

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
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar país (ej: Argentina, Brasil, España...)"
          className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neon-blue transition-all"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                onChange(c.value);
                setInput(c.label);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 ${
                c.value === value
                  ? "bg-neon-blue/10 text-neon-blue font-bold"
                  : "text-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export function SquadOptimizerPage() {
  const [country, setCountry] = useState("");
  const [squad, setSquad] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSquad = async () => {
    if (!country) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${INJURY_API_BASE_URL}/api/v1/squads/${encodeURIComponent(country)}`
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

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <AppHeader />

        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-2xl font-display font-bold text-white mb-2">
            Optimizador de Plantillas
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Plantilla óptima de 26 jugadores generada por Programación Lineal (PuLP). 
            Maximiza el Impact Score total penalizando -5 puntos por cada lesión histórica, 
            respetando restricciones posicionales (3 GK, 7-10 DF, 6-10 MF, 5-8 FW).
          </p>

          <div className="flex gap-4 mb-6">
            <CountryAutocomplete value={country} onChange={setCountry} />
            <button
              onClick={fetchSquad}
              className="bg-neon-blue text-black font-bold py-2.5 px-6 rounded-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50 shrink-0"
              disabled={loading || !country}
            >
              {loading ? "Cargando..." : "⚡ Generar Plantilla"}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue" />
            </div>
          )}

          {squad && squad.players && (
            <div>
              {/* Squad Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-2xl font-black text-white">{squad.squad_size}</span>
                  <p className="text-sm text-gray-300 mt-1">Jugadores</p>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-2xl font-black text-neon-blue">
                    {(
                      squad.players.reduce((acc: number, p: any) => acc + (p.age || 0), 0) /
                      squad.squad_size
                    ).toFixed(1)}
                  </span>
                  <p className="text-sm text-gray-300 mt-1">Edad Promedio</p>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-2xl font-black text-purple-400">
                    {squad.players
                      .reduce((acc: number, p: any) => acc + (p.impact_score || 0), 0)
                      .toFixed(1)}
                  </span>
                  <p className="text-sm text-gray-300 mt-1">Impacto Total</p>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-2xl font-black text-red-400">
                    {squad.players.reduce(
                      (acc: number, p: any) => acc + (p.total_injuries || 0),
                      0
                    )}
                  </span>
                  <p className="text-sm text-gray-300 mt-1">Lesiones Históricas</p>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-4">
                Plantilla Óptima — {squad.country} ({squad.squad_size} Jugadores)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {squad.players.map((p: any, i: number) => (
                  <div
                    key={i}
                    className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-neon-blue/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt={p.name}
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-gray-300 text-sm font-bold">
                          {p.name?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white truncate">{p.name}</h4>
                        <p className="text-gray-300 text-sm truncate">
                          {p.position_category} • {p.club}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 text-xs flex justify-between border-t border-white/10 pt-2">
                      <span className="text-neon-blue">
                        Impacto: {p.impact_score?.toFixed(1)}
                      </span>
                      <span
                        className={`font-bold ${
                          (p.adjusted_score || 0) >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        Adj: {p.adjusted_score?.toFixed(1) ?? "N/A"}
                      </span>
                      <span className="text-red-400">🩺 {p.total_injuries}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Visual analytics charts */}
              <SquadCharts players={squad.players} />
            </div>
          )}

          {/* Empty state */}
          {!squad && !loading && !error && (
            <div className="text-center py-12 text-gray-300">
              <div className="text-5xl mb-4 opacity-30">🏆</div>
              <p className="text-lg font-medium mb-1">Seleccioná un país</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                El algoritmo de Programación Lineal calculará la plantilla óptima de 26 jugadores
                maximizando el impacto colectivo y minimizando el riesgo de lesiones.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
