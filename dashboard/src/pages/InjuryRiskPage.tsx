import { useAppSelector } from "@/app/hooks";
import { useState } from "react";
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

/** Página principal del sistema de predicción de riesgo de lesiones del Mundial. */
export function InjuryRiskPage() {
  const [viewMode, setViewMode] = useState<"decision" | "model">("decision");
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
    { matchNumber: numeroPartido!, jugadorId: jugadorId! },
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
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-5">
        <AppHeader />

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">
              {viewMode === "decision" ? "Inteligencia Táctica — Desgaste Físico" : "Modelo & Validación — Predicción de Lesiones"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {viewMode === "decision"
                ? "Identifica las vulnerabilidades físicas de ambos equipos para explotar los puntos débiles del rival y proteger a tus jugadores clave."
                : "Documentación técnica del pipeline de predicción de lesiones para estudiantes de Ciencia de Datos."
              }
            </p>
          </div>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("decision")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === "decision" ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "text-gray-300 hover:text-white"}`}
            >
              <HeartPulse className="w-4 h-4" /> Panel de Decisión
            </button>
            <button
              onClick={() => setViewMode("model")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === "model" ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]" : "text-gray-300 hover:text-white"}`}
            >
              <FlaskConical className="w-4 h-4" /> Modelo & Validación
            </button>
          </div>
        </div>

        {/* Model & Validation View */}
        {viewMode === "model" && <InjuryModelPanel />}

        {/* Decision View — Tactical Intelligence */}
        {viewMode === "decision" && (
          <>
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
          </>
        )}
      </div>
    </main>
  );
}
