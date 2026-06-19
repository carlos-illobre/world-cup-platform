import { useState } from "react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { Trophy, ChevronRight } from "lucide-react";

interface MatchResult {
  match_number: number;
  label: string;
  team_a: string;
  team_b: string;
  prob_a: number;
  prob_b: number;
  winner: string;
  loser: string;
}

interface TournamentData {
  group_stage: Record<string, { team: string; predicted_points: number }[]>;
  best_third_place: { team: string; group: string; points: number }[];
  knockout: {
    round_of_32: MatchResult[];
    round_of_16: MatchResult[];
    quarter_finals: MatchResult[];
    semi_finals: MatchResult[];
    third_place: MatchResult[];
    final: MatchResult[];
  };
  champion: string | null;
  model_info: { group_model: string; match_model: string; note: string };
}

function MatchCard({ match }: { match: MatchResult }) {
  const isAWinner = match.winner === match.team_a;
  return (
    <div className="bg-black/30 rounded-lg p-3 border border-white/5 hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isAWinner ? "text-green-400 font-bold" : "text-gray-300"}`}>
            {match.team_a}
          </p>
        </div>
        <span className={`text-xs font-mono shrink-0 ${isAWinner ? "text-green-400" : "text-gray-500"}`}>
          {(match.prob_a * 100).toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${!isAWinner ? "text-green-400 font-bold" : "text-gray-300"}`}>
            {match.team_b}
          </p>
        </div>
        <span className={`text-xs font-mono shrink-0 ${!isAWinner ? "text-green-400" : "text-gray-500"}`}>
          {(match.prob_b * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center gap-1.5">
        <ChevronRight className="w-3 h-3 text-green-400" />
        <span className="text-xs text-green-300 font-bold">Avanza: {match.winner}</span>
      </div>
    </div>
  );
}

function RoundSection({ title, matches, color }: { title: string; matches: MatchResult[]; color: string }) {
  if (!matches || matches.length === 0) return null;
  return (
    <div className="mb-8">
      <h4 className={`text-lg font-display font-bold mb-3 ${color}`}>
        {title} <span className="text-sm text-gray-400 font-normal">({matches.length} partidos)</span>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {matches.map((m) => (
          <MatchCard key={m.match_number} match={m} />
        ))}
      </div>
    </div>
  );
}

export function TournamentBracket() {
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${INJURY_API_BASE_URL}/api/v1/tournament/simulate`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Error al simular el torneo");
    }
    setLoading(false);
  };

  return (
    <div className="mt-10 pt-8 border-t border-white/10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Simulador de Torneo Completo
          </h3>
          <p className="text-sm text-gray-300 mt-1 max-w-2xl">
            Simula las 104 partidos del Mundial: predice quién clasifica de cada grupo, 
            resuelve los cruces de octavos hasta la final usando el modelo XGBoost de predicción 
            de partidos de forma recursiva.
          </p>
        </div>
        <button
          onClick={simulate}
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50 shrink-0 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
        >
          {loading ? "Simulando 104 partidos..." : "🏆 Simular Torneo Completo"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-yellow-400 mb-4" />
          <p className="text-yellow-300 animate-pulse">Calculando predicciones para las 7 rondas...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Champion */}
          {data.champion && (
            <div className="text-center py-6 bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-yellow-500/10 rounded-2xl border border-yellow-500/30">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <p className="text-sm text-gray-300 uppercase tracking-widest">Campeón Predicho</p>
              <p className="text-4xl font-display font-black text-yellow-300 mt-1">{data.champion}</p>
              <p className="text-xs text-gray-400 mt-2">
                Según los modelos: {data.model_info.group_model.split("(")[0]} + {data.model_info.match_model.split("(")[0]}
              </p>
            </div>
          )}

          {/* Best 3rd Place */}
          {data.best_third_place && data.best_third_place.length > 0 && (
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <h4 className="text-sm font-bold text-gray-300 mb-2">Mejores 3ros que avanzan ({data.best_third_place.length} equipos)</h4>
              <div className="flex flex-wrap gap-2">
                {data.best_third_place.map((t) => (
                  <span key={t.team} className="text-xs bg-blue-500/10 text-blue-300 px-2 py-1 rounded border border-blue-500/20">
                    {t.team} ({t.group}, {t.points.toFixed(1)} pts)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Knockout Rounds */}
          <RoundSection title="Octavos de Final (Round of 32)" matches={data.knockout.round_of_32} color="text-white" />
          <RoundSection title="Octavos de Final (Round of 16)" matches={data.knockout.round_of_16} color="text-blue-300" />
          <RoundSection title="Cuartos de Final" matches={data.knockout.quarter_finals} color="text-purple-300" />
          <RoundSection title="Semifinales" matches={data.knockout.semi_finals} color="text-orange-300" />
          <RoundSection title="Tercer Puesto" matches={data.knockout.third_place} color="text-gray-300" />
          <RoundSection title="🏆 Final" matches={data.knockout.final} color="text-yellow-300" />

          {/* Model Info */}
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mt-6">
            <h4 className="text-sm font-bold text-purple-300 mb-2">🔬 Metodología</h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              <strong>Fase de Grupos:</strong> Se usa <code className="text-purple-300">team_points_xgb_model</code> (XGBoost Regressor, 19 features de squad) 
              para predecir los puntos de cada selección. Los 2 primeros de cada grupo + los 8 mejores terceros avanzan.
            </p>
            <p className="text-sm text-gray-300 leading-relaxed mt-2">
              <strong>Fase de Eliminación:</strong> Se usa <code className="text-purple-300">match_outcome_weather_xgb</code> (XGBoost Classifier, 14 features) 
              de forma recursiva — el ganador predicho de cada partido alimenta el siguiente cruce del bracket.
              Las condiciones climáticas se asumen neutras (25°C, sin lluvia) para los knockout.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mt-2">
              <strong>Limitación:</strong> {data.model_info.note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
