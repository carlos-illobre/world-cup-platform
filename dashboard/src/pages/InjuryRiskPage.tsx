import { useAppSelector } from "@/app/hooks";
import { AppHeader } from "@/shared/components/AppHeader";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FixtureSelector } from "@/features/fixture/components/FixtureSelector";
import { PlayerSelectionBar } from "@/features/squad/components/PlayerSelectionBar";
import { SquadInferencePanel } from "@/features/squad/components/SquadInferencePanel";
import { InjuryRiskDashboard } from "@/features/injury-risk/components/InjuryRiskDashboard";
import { SelectionGuide } from "@/features/onboarding/components/SelectionGuide";
import { GeoclimaticInfoPanel } from "@/features/injury-risk/components/GeoclimaticInfoPanel";
import { selectNumeroPartidoSeleccionado } from "@/features/fixture/fixtureSlice";
import { selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import {
  useGetFechasJornadaQuery,
  useGetPartidosPorFechaQuery,
  useGetPartidoContextoQuery,
} from "@/features/fixture/fixtureApi";
import { useGetJugadoresPorPartidoQuery } from "@/features/squad/squadApi";
import { useGetReportePreparacionQuery } from "@/features/injury-risk/injuryRiskApi";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import { selectFechaSeleccionada } from "@/features/fixture/fixtureSlice";

/** Página principal del sistema de predicción de riesgo de lesiones del Mundial. */
export function InjuryRiskPage() {
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
  
  // Query para obtener el contexto del partido independientemente del jugador
  const { data: contextoPartido, isLoading: isLoadingContexto, error: errorContexto } = useGetPartidoContextoQuery(
    numeroPartido!,
    { skip: !numeroPartido || seleccionCompleta }, // Skip if match not selected or player is selected (since dashboard handles it)
  );

  const { error: errorDiagnostico } = useGetReportePreparacionQuery(
    { matchNumber: numeroPartido!, jugadorId: jugadorId! },
    { skip: !seleccionCompleta },
  );

  const errorCatalogo = errorFechas ?? errorPartidos ?? errorJugadores ?? errorContexto;

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

        <FixtureSelector />

        <PlayerSelectionBar />

        {mensajeErrorCatalogo && <ErrorBanner message={mensajeErrorCatalogo} />}

        {mensajeErrorDiagnostico && <ErrorBanner message={mensajeErrorDiagnostico} />}

        {!seleccionCompleta && !mensajeErrorDiagnostico && (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[1fr_320px]">
            <SelectionGuide />
            <GeoclimaticInfoPanel contextoPartido={contextoPartido} loading={isLoadingContexto && Boolean(numeroPartido)} />
          </div>
        )}

        {seleccionCompleta && <InjuryRiskDashboard />}

        {numeroPartido && <SquadInferencePanel />}
      </div>
    </main>
  );
}
