import { useState, useEffect } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { LayoutGrid, BarChart2 } from "lucide-react";
import { TournamentBracket } from "@/features/tournament/TournamentBracket";

interface TeamPrediction {
  team: string;
  predicted_group_points: number;
  loading?: boolean;
}

interface FormationResult {
  team: string;
  recommended_formation: string;
  formation_win_probabilities: Record<string, number>;
}

const TEAM_POINTS_FEATURES = [
  "squad_total_market_value",
  "squad_avg_market_value",
  "squad_total_injuries",
  "squad_total_wc_goals",
  "squad_avg_wc_goals",
  "squad_total_wc_assists",
  "squad_total_allcomps_goals",
  "squad_total_allcomps_assists",
  "squad_avg_age",
  "squad_median_age",
  "squad_total_caps",
  "squad_avg_caps",
  "squad_injury_burden",
  "squad_depth_DF",
  "squad_depth_FW",
  "squad_depth_GK",
  "squad_depth_MF",
  "squad_top_league_ratio",
  "squad_avg_impact_score",
];

export function GroupsSimulatorPage() {
  const [viewMode, setViewMode] = useState<"business" | "datascience">("business");
  const [groups, setGroups] = useState<Record<string, any[]>>({});
  const [predictions, setPredictions] = useState<Record<string, TeamPrediction>>({});
  const [formations, setFormations] = useState<Record<string, FormationResult>>({});
  const [teamDetails, setTeamDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Load groups
  useEffect(() => {
    fetch(`${INJURY_API_BASE_URL}/api/v1/teams/groups`)
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.data || {});
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  // Simulate group fixtures and load real 3/1/0 standings when groups are loaded.
  useEffect(() => {
    const allTeams = Object.values(groups).flat().map((t) => t.team);
    if (allTeams.length === 0) return;

    fetch(`${INJURY_API_BASE_URL}/api/v1/tournament/simulate?_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        const next: Record<string, TeamPrediction> = {};
        Object.values(data.group_stage || {})
          .flat()
          .forEach((team: any) => {
            next[team.team] = {
              team: team.team,
              predicted_group_points: Number(team.pts ?? team.predicted_points ?? 0),
            };
          });
        setPredictions(next);
      })
      .catch(() => {
        const next: Record<string, TeamPrediction> = {};
        allTeams.forEach((team) => {
          next[team] = { team, predicted_group_points: 0 };
        });
        setPredictions(next);
      });
  }, [groups]);

  // Load formations + team details for data science view
  useEffect(() => {
    if (viewMode !== "datascience") return;
    const allTeams = Object.values(groups).flat().map((t) => t.team);

    allTeams.forEach((team) => {
      if (!formations[team]) {
        fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(team)}/formation`)
          .then((r) => r.json())
          .then((data) => {
            setFormations((prev) => ({ ...prev, [team]: data.data }));
          })
          .catch(() => {});
      }
      if (!teamDetails[team]) {
        fetch(`${INJURY_API_BASE_URL}/api/v1/teams/${encodeURIComponent(team)}`)
          .then((r) => r.json())
          .then((data) => {
            setTeamDetails((prev) => ({ ...prev, [team]: data.data }));
          })
          .catch(() => {});
      }
    });
  }, [viewMode, groups]);

  const getGroupPredictions = (groupTeams: any[]) => {
    return groupTeams
      .map((t) => ({
        ...t,
        predicted_points: predictions[t.team]?.predicted_group_points ?? null,
      }))
      .sort((a, b) => (b.predicted_points ?? 0) - (a.predicted_points ?? 0));
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">
              Simulador de Fase de Grupos
              <span className="ml-3 bg-neon-blue/20 text-neon-blue text-sm px-3 py-1 rounded-full border border-neon-blue/30 font-bold tracking-widest uppercase">
                AI Powered
              </span>
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              Simulación de la fase de grupos del Mundial 2026 con puntos de tabla reales:
              3 por victoria, 1 por empate y 0 por derrota.
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

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-neon-blue"></div>
          </div>
        )}

        {/* ==================== BUSINESS VIEW ==================== */}
        {!loading && viewMode === "business" && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(groups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupName, teams]) => {
                const sorted = getGroupPredictions(teams);
                return (
                  <div
                    key={groupName}
                    className="glass-panel rounded-2xl p-5 border border-white/5"
                  >
                    <h3 className="text-lg font-bold text-neon-blue mb-3">
                      Grupo {groupName}
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-xs border-b border-white/10">
                          <th className="text-left py-2 pl-2">#</th>
                          <th className="text-left py-2">Selección</th>
                          <th className="text-right py-2 pr-2">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((team, idx) => (
                          <tr
                            key={team.team}
                            className={`border-b border-white/5 ${
                              idx < 2
                                ? "bg-green-500/10 border-l-2 border-l-green-400"
                                : ""
                            }`}
                          >
                            <td className="py-2.5 pl-2 text-gray-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 font-medium text-white">
                              {team.team}
                            </td>
                            <td className="py-2.5 pr-2 text-right font-bold">
                              {team.predicted_points !== null ? (
                                <span
                                  className={
                                    idx < 2 ? "text-green-400" : "text-gray-300"
                                  }
                                >
                                  {team.predicted_points}
                                </span>
                              ) : (
                                <span className="text-gray-500 animate-pulse">
                                  ...
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sorted.length >= 2 && (
                      <div className="mt-3 text-xs text-green-400/80 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                        Top 2 clasifican a octavos de final
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Tournament Bracket - Full simulation */}
          <TournamentBracket />
          </>
        )}

        {/* ==================== DATA SCIENCE VIEW ==================== */}
        {!loading && viewMode === "datascience" && (
          <div className="space-y-8">
            {/* Model Info */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5">
              <h3 className="text-xl font-bold text-white mb-3">
                🤖 Modelo: match_outcome_weather_xgb + tabla 3/1/0
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Algoritmo</p>
                  <p className="text-lg font-bold text-neon-blue">XGBoost Classifier</p>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Regla de puntos</p>
                  <p className="text-lg font-bold text-yellow-400">3 / 1 / 0</p>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Salida</p>
                  <p className="text-lg font-bold text-purple-400">Tabla real</p>
                </div>
              </div>
              <p className="text-sm text-gray-300">
                El simulador predice el resultado de cada partido del grupo y después suma
                puntos de tabla: victoria 3, empate 1, derrota 0. Por eso los puntos siempre
                son enteros y nunca valores decimales.
              </p>
              <div className="mt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Features del squad disponibles
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
            </div>

            {/* Groups with features + formation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(groups)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, teams]) => (
                  <div
                    key={groupName}
                    className="glass-panel rounded-2xl p-5 border border-white/5"
                  >
                    <h3 className="text-lg font-bold text-neon-blue mb-4">
                      Grupo {groupName}
                    </h3>
                    {teams.map((t) => {
                      const details = teamDetails[t.team];
                      const formation = formations[t.team];
                      const pred = predictions[t.team];
                      return (
                        <div
                          key={t.team}
                          className="mb-4 last:mb-0 bg-black/20 rounded-xl p-4 border border-white/5"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-white">{t.team}</span>
                            <span className="text-sm font-mono text-neon-blue">
                              {pred
                                ? `${pred.predicted_group_points} pts`
                                : "..."}
                            </span>
                          </div>

                          {/* Formation */}
                          {formation && (
                            <div className="mb-2">
                              <span className="text-xs text-gray-400">
                                Formación recomendada:{" "}
                              </span>
                              <span className="text-sm font-bold text-yellow-400">
                                {formation.recommended_formation}
                              </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(
                                  formation.formation_win_probabilities || {}
                                )
                                  .slice(0, 5)
                                  .map(([fm, prob]) => (
                                    <span
                                      key={fm}
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        fm === formation.recommended_formation
                                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                                          : "bg-white/5 text-gray-400"
                                      }`}
                                    >
                                      {fm}: {((prob as number) * 100).toFixed(1)}%
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Features */}
                          {details && (
                            <details className="text-xs text-gray-400 mt-2">
                              <summary className="cursor-pointer hover:text-gray-200 transition-colors">
                                Ver 19 features del modelo
                              </summary>
                              <div className="mt-2 grid grid-cols-2 gap-1">
                                {TEAM_POINTS_FEATURES.map((f) => (
                                  <div key={f} className="flex justify-between">
                                    <span className="text-gray-500 truncate mr-1">
                                      {f.replace("squad_", "")}
                                    </span>
                                    <span className="text-gray-300 font-mono">
                                      {details[f] != null
                                        ? typeof details[f] === "number"
                                          ? details[f].toFixed(2)
                                          : details[f]
                                        : "—"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
