import { Target } from "lucide-react";
import { UI_LABELS } from "@/constants/ui-labels";

interface DashboardEmptyStateProps {
  hasDateSelected: boolean;
  hasMatchSelected: boolean;
  hasPlayerSelected: boolean;
}

/** Estado vacío cuando aún no hay selección completa. */
export function DashboardEmptyState({
  hasDateSelected,
  hasMatchSelected,
  hasPlayerSelected,
}: DashboardEmptyStateProps) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-4 rounded-2xl px-6 py-20 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-neon-blue/15 ring-1 ring-neon-blue/40">
        <Target className="h-8 w-8 text-neon-blue" />
      </div>
      <h2 className="font-display text-xl font-extrabold tracking-wide text-foreground sm:text-2xl">
        {UI_LABELS.emptyState.title}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {UI_LABELS.emptyState.description}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wider">
        <span
          className={
            hasDateSelected ? "text-neon-green" : "text-muted-foreground"
          }
        >
          {hasDateSelected
            ? UI_LABELS.emptyState.dateSelected
            : UI_LABELS.emptyState.stepDate}
        </span>
        <span className="text-border">|</span>
        <span
          className={
            hasMatchSelected ? "text-neon-green" : "text-muted-foreground"
          }
        >
          {hasMatchSelected
            ? UI_LABELS.emptyState.matchSelected
            : UI_LABELS.emptyState.stepMatch}
        </span>
        <span className="text-border">|</span>
        <span
          className={
            hasPlayerSelected ? "text-neon-green" : "text-muted-foreground"
          }
        >
          {hasPlayerSelected
            ? UI_LABELS.emptyState.playerSelected
            : UI_LABELS.emptyState.stepPlayer}
        </span>
      </div>
    </div>
  );
}
