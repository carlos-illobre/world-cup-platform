import { useAppSelector } from "@/app/hooks";
import { useState, useSyncExternalStore } from "react";
import { AppHeader } from "@/shared/components/AppHeader";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FixtureSelector } from "@/features/fixture/components/FixtureSelector";
import { PlayerSelectionBar } from "@/features/squad/components/PlayerSelectionBar";
import { SquadInferencePanel } from "@/features/squad/components/SquadInferencePanel";
import { InjuryRiskDashboard } from "@/features/injury-risk/components/InjuryRiskDashboard";
import { WhatIfSimulator } from "@/features/injury-risk/components/WhatIfSimulator";
import { InjuryModelPanel } from "@/features/injury-risk/components/InjuryModelPanel";
import { SelectionGuide } from "@/features/onboarding/components/SelectionGuide";
import { selectNumeroPartidoSeleccionado } from "@/features/fixture/fixtureSlice";
import { selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import {
  useGetFechasJornadaQuery,
  useGetPartidosPorFechaQuery,
} from "@/features/fixture/fixtureApi";
import { useGetJugadoresPorPartidoQuery } from "@/features/squad/squadApi";
import { useGetReportePreparacionQuery } from "@/features/injury-risk/injuryRiskApi";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { selectFechaSeleccionada } from "@/features/fixture/fixtureSlice";
import { HeartPulse, FlaskConical } from "lucide-react";
import {
  getInjuryModel,
  setInjuryModel as setInjuryModelStore,
  subscribeInjuryModel,
} from "@/features/injury-risk/injuryModelStore";

/** Página principal del sistema de predicción de riesgo de lesiones del Mundial. */
export function InjuryRiskPage() {
  const [viewMode, setViewMode] = useState<"decision" | "model">("decision");
  const injuryModel = useSyncExternalStore(subscribeInjuryModel, getInjuryModel, getInjuryModel);
  const setInjuryModel = setInjuryModelStore;
  const fechaSeleccionada = useAppSelector(selectFechaSeleccionada);
  const numeroPartido = useAppSelector(selectNumeroPartidoSeleccionado);
  const jugadorId = useAppSelector(selectJugadorSeleccionadoId);

  const seleccionCompleta = Boolean(numeroPartido && jugadorId);

  // Queries para detectar errores de carga del catálogo
  const { error: errorFechas } = useGetFechasJornadaQuery();
  const { error: errorPartidos } = useGetPartidosPorFechaQuery(
    fechaSeleccionada ?? "",
    { skip: !fechaSeleccionada },
  );
  const { error: errorJugadores } = useGetJugadoresPorPartidoQuery(
    { matchNumber: numeroPartido! },
    { skip: !numeroPartido },
  );

  const { error: errorDiagnostico } = useGetReportePreparacionQuery(
    { matchNumber: numeroPartido!, jugadorId: jugadorId!, model: injuryModel },
    { skip: !seleccionCompleta },
  );

  const errorCatalogo = errorFechas ?? errorPartidos ?? errorJugadores;

  const mensajeErrorCatalogo = errorCatalogo
    ? `${UI_LABELS.errors.catalogLoadFailed} ${errorCatalogo instanceof Error ? errorCatalogo.message : String(errorCatalogo)}`
    : null;

  const mensajeErrorDiagnostico = errorDiagnostico
    ? `${UI_LABELS.errors.predictionLoadFailed} ${errorDiagnostico instanceof Error ? errorDiagnostico.message : String(errorDiagnostico)}`
    : null;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">
              {viewMode === "decision" ? "Inteligencia Táctica — Desgaste Físico" : "Modelo & Validación — Predicción de Lesiones"}
            </h1>
            <p className="text-gray-300 max-w-2xl text-base">
              {viewMode === "decision"
                ? "Identifica las vulnerabilidades físicas de ambos equipos para explotar los puntos débiles del rival y proteger a tus jugadores clave."
                : "Documentación técnica del pipeline de predicción de lesiones para estudiantes de Ciencia de Datos."
              }
            </p>
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
              <HeartPulse className="w-4 h-4" /> Panel de Decisión
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
        {viewMode === "model" && <InjuryModelPanel />}

        {/* Decision View — Tactical Intelligence */}
        {viewMode === "decision" && (
          <div className="space-y-5">
            {/* Model selector for decision view */}
            <div className="flex items-center gap-3 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
              <span className="text-xs text-gray-400 font-medium shrink-0">Algoritmo:</span>
              <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                <button
                  onClick={() => setInjuryModel("xgboost")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    injuryModel === "xgboost"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  XGBoost
                </button>
                <button
                  onClick={() => setInjuryModel("random_forest")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    injuryModel === "random_forest"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Random Forest
                </button>
              </div>
              <span className="text-[10px] text-gray-500 ml-auto hidden md:inline">
                {injuryModel === "xgboost"
                  ? "Gradient Boosting · 123 features · AUC 0.622"
                  : "Bagging · 17 features · AUC 0.671"}
              </span>
            </div>

            <FixtureSelector />

            {mensajeErrorCatalogo && <ErrorBanner message={mensajeErrorCatalogo} />}

            {!numeroPartido && !mensajeErrorCatalogo && (
              <div className="mx-auto w-full max-w-4xl">
                <SelectionGuide />
              </div>
            )}

            {/* Squad vulnerability map + player search — the main decision tool */}
            {numeroPartido && (
              <>
                <PlayerSelectionBar />
                <SquadInferencePanel />
              </>
            )}

            {/* Individual player deep dive (optional — select from the list above) */}
            {seleccionCompleta && (
              <>
                <InjuryRiskDashboard />
                <WhatIfSimulator />
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
