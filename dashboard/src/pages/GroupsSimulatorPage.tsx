import { useState, useEffect } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { LayoutGrid, BarChart2, ChevronDown, ChevronRight, Trophy, Shield, AlertTriangle, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { TournamentBracket } from "@/features/tournament/TournamentBracket";
import { GroupsModelPanel } from "@/features/groups-simulator/components/GroupsModelPanel";

// ─── Types ───────────────────────────────────────────────────────────
interface MatchDetail {
  opponent: string;
  prob_win: number;
  prob_draw: number;
  prob_loss: number;
  expected_points: number;
  entropy: number;
  confidence: "alta" | "media" | "baja";
  explanations: any[];
  data_sources: Record<string, any>;
}

interface TeamGroupResult {
  team: string;
  last_5: string | null;
  predicted_points: number;
  confidence: "alta" | "media" | "baja";
  avg_entropy: number;
  matches: MatchDetail[];
}

interface GroupsDetailedResponse {
  groups: Record<string, TeamGroupResult[]>;
  best_third_place: { team: string; group: string; points: number; confidence: string }[];
  methodology: {
    approach: string;
    description: string;
    models_used: string[];
    features_count: number;
    training_samples: number;
    test_accuracy: string;
    confidence_method: string;
  };
}

// ─── Utility Components ──────────────────────────────────────────────

function FormDots({ form }: { form: string | null }) {
  if (!form) return null;
  const results = form.split(",").map(r => r.trim());
  return (
    <div className="flex gap-0.5 items-center">
      {results.map((r, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${
            r === "W" ? "bg-green-400" :
            r === "D" ? "bg-yellow-400" :
            "bg-red-400"
          }`}
          title={r === "W" ? "Victoria" : r === "D" ? "Empate" : "Derrota"}
        />
      ))}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const config = {
    alta: { icon: CheckCircle2, class: "bg-green-500/10 text-green-400 border-green-500/30" },
    media: { icon: Target, class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
    baja: { icon: AlertTriangle, class: "bg-red-500/10 text-red-400 border-red-500/30" },
  }[confidence] || { icon: AlertTriangle, class: "bg-gray-500/10 text-gray-400 border-gray-500/30" };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border ${config.class}`}>
      <Icon className="w-2.5 h-2.5" />
      {confidence}
    </span>
  );
}

function ProbabilityBar({ probWin, probDraw, probLoss }: { probWin: number; probDraw: number; probLoss: number }) {
  return (
    <div className="w-full h-2 bg-black/40 rounded-full flex overflow-hidden">
      <div style={{ width: `${probWin * 100}%` }} className="bg-green-400 transition-all duration-300" />
      <div style={{ width: `${probDraw * 100}%` }} className="bg-yellow-400 transition-all duration-300" />
      <div style={{ width: `${probLoss * 100}%` }} className="bg-red-400 transition-all duration-300" />
    </div>
  );
}

// ─── Team Match Details (expandable) ─────────────────────────────────

function TeamMatchDetails({ matches, teamName }: { matches: MatchDetail[]; teamName: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Ver {matches.length} partidos simulados
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 animate-in fade-in duration-200">
          {matches.map((m, i) => (
            <div key={i} className="bg-black/30 rounded-lg p-3 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-white">
                  {teamName} vs {m.opponent}
                </span>
                <ConfidenceBadge confidence={m.confidence} />
              </div>
              <ProbabilityBar probWin={m.prob_win} probDraw={m.prob_draw} probLoss={m.prob_loss} />
              <div className="flex justify-between mt-1.5 text-[11px]">
                <span className="text-green-400">{(m.prob_win * 100).toFixed(0)}% V</span>
                <span className="text-yellow-400">{(m.prob_draw * 100).toFixed(0)}% E</span>
                <span className="text-red-400">{(m.prob_loss * 100).toFixed(0)}% D</span>
                <span className="text-gray-300 font-bold">→ {m.expected_points.toFixed(1)} pts</span>
              </div>
              {m.explanations && m.explanations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-xs text-gray-400 mb-1">Factores clave (SHAP):</p>
                  {m.explanations.map((exp: any, j: number) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className={`${exp.weight > 0 ? "text-green-400" : "text-red-400"}`}>
                        {exp.weight > 0 ? "+" : ""}{exp.weight?.toFixed(3)}
                      </span>
                      <span className="text-gray-400">{exp.feature}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Backtesting Component ───────────────────────────────────────────

function BacktestPanel() {
  const [year, setYear] = useState(2022);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = (y: number) => {
    setLoading(true);
    setError(null);
    fetch(`${INJURY_API_BASE_URL}/api/v1/tournament/backtest/${y}`)
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-white/5 mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Backtesting — Validación con Mundiales Pasados
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Evalúa la precisión del modelo prediciendo resultados de mundiales reales.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            {[2022, 2018, 2014, 2010, 2006, 2002].map(y => (
              <option key={y} value={y}>Mundial {y}</option>
            ))}
          </select>
          <button
            onClick={() => runBacktest(year)}
            disabled={loading}
            className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-2 px-5 rounded-lg transition-all disabled:opacity-50 text-sm"
          >
            {loading ? "Calculando..." : "Ejecutar Backtest"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="animate-in fade-in duration-300">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Año</p>
              <p className="text-xl font-bold text-white">{data.year}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Accuracy del Modelo</p>
              <p className="text-xl font-bold text-purple-400">{data.accuracy_pct}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Aciertos / Total</p>
              <p className="text-xl font-bold text-white">{data.correct_predictions}/{data.predicted_matches}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
              <p className="text-xs text-gray-500">Baseline Aleatorio</p>
              <p className="text-xl font-bold text-gray-500">33.3%</p>
            </div>
          </div>

          {/* Match results */}
          <div className="max-h-96 overflow-y-auto rounded-lg border border-white/5">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-black/80">
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2 px-3">Partido</th>
                  <th className="text-center py-2 px-3">Score</th>
                  <th className="text-center py-2 px-3">Real</th>
                  <th className="text-center py-2 px-3">Predicho</th>
                  <th className="text-center py-2 px-3">✓</th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((m: any, i: number) => (
                  <tr key={i} className={`border-b border-white/5 ${m.correct ? "bg-green-500/5" : m.correct === false ? "bg-red-500/5" : ""}`}>
                    <td className="py-2 px-3 text-gray-200">{m.team_a} vs {m.team_b}</td>
                    <td className="py-2 px-3 text-center text-white font-mono">{m.score}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded ${m.actual === "W" ? "bg-green-500/20 text-green-300" : m.actual === "D" ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"}`}>
                        {m.actual}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {m.predicted ? (
                        <span className={`px-1.5 py-0.5 rounded ${m.predicted === "W" ? "bg-green-500/20 text-green-300" : m.predicted === "D" ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"}`}>
                          {m.predicted}
                        </span>
                      ) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {m.correct === true && <span className="text-green-400">✓</span>}
                      {m.correct === false && <span className="text-red-400">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Context */}
          <div className="mt-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
            <p className="text-xs text-gray-300">
              <strong className="text-purple-300">Interpretación:</strong> {data.context?.note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────

export function GroupsSimulatorPage() {
  const [viewMode, setViewMode] = useState<"business" | "datascience">("business");
  const [groupsData, setGroupsData] = useState<GroupsDetailedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<"xgboost" | "random_forest">("xgboost");

  // Load detailed group simulation
  useEffect(() => {
    setLoading(true);
    const params = selectedModel !== "xgboost" ? `?model=${selectedModel}` : "";
    fetch(`${INJURY_API_BASE_URL}/api/v1/tournament/simulate-groups-detailed${params}`)
      .then(r => r.json())
      .then(data => {
        setGroupsData(data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, [selectedModel]);

  const groupEntries = groupsData?.groups
    ? Object.entries(groupsData.groups).sort(([a], [b]) => a.localeCompare(b))
    : [];

  const filteredGroups = activeGroup
    ? groupEntries.filter(([name]) => name === activeGroup)
    : groupEntries;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">
              Simulador de Fase de Grupos
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              Predicción de resultados para las 48 selecciones del Mundial 2026.
              Cada partido se simula individualmente con XGBoost usando ranking FIFA,
              forma reciente, historial H2H y condiciones climáticas.
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

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-neon-blue"></div>
            <p className="text-sm text-gray-400 animate-pulse">Simulando 144 partidos de fase de grupos...</p>
          </div>
        )}

        {/* ==================== BUSINESS VIEW ==================== */}
        {!loading && viewMode === "business" && groupsData && (
          <>
            {/* Algorithm selector */}
            <div className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-lg px-4 py-2.5 mb-4">
              <span className="text-xs text-gray-400 font-medium shrink-0">Algoritmo:</span>
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
              </div>
              <span className="text-[10px] text-gray-500 ml-auto hidden md:inline">
                {selectedModel === "xgboost"
                  ? "Blend Strategy (Weather + 3-Class) · 19 features · Acc 57.6%"
                  : "Bagging 300 árboles · 10 features · Acc 72.2%"}
              </span>
              {loading && (
                <div className="w-3 h-3 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Group Filter Tabs */}
            <div className="mb-6 flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveGroup(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !activeGroup
                    ? "bg-neon-blue text-black"
                    : "bg-black/30 text-gray-400 hover:text-white border border-white/10"
                }`}
              >
                Todos
              </button>
              {groupEntries.map(([name]) => (
                <button
                  key={name}
                  onClick={() => setActiveGroup(activeGroup === name ? null : name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeGroup === name
                      ? "bg-neon-blue text-black"
                      : "bg-black/30 text-gray-400 hover:text-white border border-white/10"
                  }`}
                >
                  {name.replace("Group ", "")}
                </button>
              ))}
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map(([groupName, teams]) => (
                <div
                  key={groupName}
                  className="glass-panel rounded-2xl p-5 border border-white/5"
                >
                  <h3 className="text-lg font-bold text-neon-blue mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {groupName}
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs border-b border-white/10">
                        <th className="text-left py-2 pl-2">#</th>
                        <th className="text-left py-2">Selección</th>
                        <th className="text-center py-2">Forma</th>
                        <th className="text-center py-2">Conf.</th>
                        <th className="text-right py-2 pr-2">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team, idx) => (
                        <tr
                          key={team.team}
                          className={`border-b border-white/5 ${
                            idx < 2
                              ? "bg-green-500/5 border-l-2 border-l-green-400"
                              : idx === 2
                              ? "bg-yellow-500/5 border-l-2 border-l-yellow-400/50"
                              : ""
                          }`}
                        >
                          <td className="py-2.5 pl-2 text-gray-400 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 font-medium text-white text-sm">
                            {team.team}
                          </td>
                          <td className="py-2.5 text-center">
                            <FormDots form={team.last_5} />
                          </td>
                          <td className="py-2.5 text-center">
                            <ConfidenceBadge confidence={team.confidence} />
                          </td>
                          <td className="py-2.5 pr-2 text-right font-bold">
                            <span className={idx < 2 ? "text-green-400" : "text-gray-300"}>
                              {team.predicted_points.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Legend */}
                  <div className="mt-3 flex flex-col gap-1">
                    <div className="text-xs text-green-400/90 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      Top 2 clasifican directamente
                    </div>
                    <div className="text-xs text-yellow-400/80 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                      3° puede avanzar como mejor tercero
                    </div>
                  </div>

                  {/* Expandable match details */}
                  {teams.slice(0, 2).map(team => (
                    <TeamMatchDetails
                      key={team.team}
                      matches={team.matches}
                      teamName={team.team}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Best Third Place */}
            {groupsData.best_third_place && groupsData.best_third_place.length > 0 && (
              <div className="mt-8 glass-panel rounded-2xl p-5 border border-white/5">
                <h3 className="text-lg font-bold text-yellow-300 mb-3 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Mejores 3ros que avanzan a octavos ({groupsData.best_third_place.length} equipos)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {groupsData.best_third_place.map(t => (
                    <div key={t.team} className="bg-black/30 rounded-lg p-3 border border-yellow-500/20 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{t.team}</p>
                        <p className="text-xs text-gray-400">{t.group}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-yellow-300">{t.points.toFixed(1)}</p>
                        <ConfidenceBadge confidence={t.confidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tournament Bracket */}
            <TournamentBracket model={selectedModel} />

            {/* Backtesting */}
            <BacktestPanel />
          </>
        )}

        {/* ==================== DATA SCIENCE VIEW ==================== */}
        {!loading && viewMode === "datascience" && (
          <GroupsModelPanel
            methodology={groupsData?.methodology || null}
            groupsData={groupsData?.groups || null}
          />
        )}
      </div>
    </main>
  );
}
