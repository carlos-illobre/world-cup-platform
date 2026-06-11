import { MatchScheduleSelector } from "@/components/dashboard/MatchScheduleSelector";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { PlayerSelectionBar } from "@/components/dashboard/PlayerSelectionBar";
import { MatchSquadInferencePanel } from "@/components/dashboard/MatchSquadInferencePanel";
import { ErrorBanner } from "@/components/dashboard/ErrorBanner";
import { UI_LABELS } from "@/constants/ui-labels";
import { useMatchDates } from "@/hooks/useMatchDates";
import { useMatchesByDate } from "@/hooks/useMatchesByDate";
import { usePlayersByMatch } from "@/hooks/usePlayersByMatch";
import { usePrediction } from "@/hooks/usePrediction";
import { useDashboardStore } from "@/stores/dashboardStore";

/** Página principal del panel de predicción de lesiones. */
export function DashboardPage() {
  const selectedDate = useDashboardStore((s) => s.selectedDate);
  const selectedMatchNumber = useDashboardStore((s) => s.selectedMatchNumber);
  const selectedPlayerName = useDashboardStore((s) => s.selectedPlayerName);
  const setSelectedDate = useDashboardStore((s) => s.setSelectedDate);
  const setSelectedMatchNumber = useDashboardStore((s) => s.setSelectedMatchNumber);
  const setSelectedPlayerName = useDashboardStore((s) => s.setSelectedPlayerName);
  const hasCompleteSelection = useDashboardStore((s) => s.hasCompleteSelection);

  const {
    matchDates,
    loading: datesLoading,
    error: datesError,
  } = useMatchDates();

  const {
    matches,
    loading: matchesLoading,
    error: matchesError,
  } = useMatchesByDate(selectedDate);

  const {
    players,
    loading: playersLoading,
    error: playersError,
  } = usePlayersByMatch(selectedMatchNumber);

  const {
    data,
    loading: predictionLoading,
    error: predictionError,
  } = usePrediction(selectedPlayerName, selectedMatchNumber);

  const catalogError = datesError ?? matchesError ?? playersError;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-5">
        <DashboardHeader />

        <MatchScheduleSelector
          matchDates={matchDates}
          matches={matches}
          selectedDate={selectedDate}
          selectedMatchNumber={selectedMatchNumber}
          datesLoading={datesLoading}
          matchesLoading={matchesLoading}
          onDateChange={setSelectedDate}
          onMatchChange={setSelectedMatchNumber}
        />

        <PlayerSelectionBar
          players={players}
          selectedPlayerName={selectedPlayerName}
          matchSelected={Boolean(selectedMatchNumber)}
          loading={playersLoading}
          onPlayerChange={setSelectedPlayerName}
        />

        {selectedMatchNumber && (
          <MatchSquadInferencePanel
            matchNumber={selectedMatchNumber}
            selectedPlayerId={selectedPlayerName}
            onPlayerSelect={setSelectedPlayerName}
          />
        )}



        {catalogError && (
          <ErrorBanner
            message={`${UI_LABELS.errors.catalogLoadFailed} ${catalogError}`}
          />
        )}

        {predictionError && (
          <ErrorBanner
            message={`${UI_LABELS.errors.predictionLoadFailed} ${predictionError}`}
          />
        )}

        {!hasCompleteSelection() && !predictionError && (
          <DashboardEmptyState
            hasDateSelected={Boolean(selectedDate)}
            hasMatchSelected={Boolean(selectedMatchNumber)}
            hasPlayerSelected={Boolean(selectedPlayerName)}
          />
        )}

        {hasCompleteSelection() && (
          <DashboardContent data={data} loading={predictionLoading} />
        )}
      </div>
    </main>
  );
}
