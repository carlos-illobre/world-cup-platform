import { CalendarDays, MapPin } from "lucide-react";
import { Skeleton } from "@/components/dashboard/Panel";
import { UI_LABELS } from "@/constants/ui-labels";
import type { MatchDate, MatchListItem } from "@/lib/predictions.types";

interface MatchScheduleSelectorProps {
  matchDates: MatchDate[];
  matches: MatchListItem[];
  selectedDate: string | null;
  selectedMatchNumber: number | null;
  datesLoading: boolean;
  matchesLoading: boolean;
  onDateChange: (dateId: string) => void;
  onMatchChange: (matchNumber: number) => void;
  className?: string;
}

/**
 * Selector en cascada: carrusel de fechas y, debajo, partidos de la fecha activa.
 */
export function MatchScheduleSelector({
  matchDates,
  matches,
  selectedDate,
  selectedMatchNumber,
  datesLoading,
  matchesLoading,
  onDateChange,
  onMatchChange,
  className,
}: MatchScheduleSelectorProps) {
  return (
    <div className={`glass-panel rounded-2xl p-3 sm:p-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {datesLoading ? (
          <Skeleton className="h-12 w-40 shrink-0 rounded-xl" />
        ) : (
          matchDates.map((matchDate) => {
            const isActive = matchDate.id === selectedDate;
            const hasSelectedMatch =
              selectedMatchNumber !== null &&
              matches.some(
                (match) =>
                  match.match_number === selectedMatchNumber &&
                  matchDate.id === selectedDate,
              );

            return (
              <button
                key={matchDate.id}
                type="button"
                onClick={() => onDateChange(matchDate.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 transition-colors ${
                  isActive
                    ? "border-neon-blue/70 bg-neon-blue/15"
                    : "border-border bg-secondary/40 hover:border-neon-blue/40"
                }`}
              >
                <CalendarDays
                  className={`h-4 w-4 ${isActive ? "text-neon-blue" : "text-muted-foreground"}`}
                />
                <span className="flex flex-col text-left leading-tight">
                  <span
                    className={`text-sm font-bold ${isActive ? "text-glow-blue" : "text-foreground/90"}`}
                  >
                    {matchDate.label}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {matchDate.date}
                  </span>
                </span>
                {hasSelectedMatch && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-neon-green shadow-[0_0_8px_var(--neon-green)]" />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!selectedDate ? (
          <p className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
            {UI_LABELS.schedule.selectDateHint}
          </p>
        ) : matchesLoading ? (
          <>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </>
        ) : matches.length === 0 ? (
          <p className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
            {UI_LABELS.schedule.noMatchesForDate}
          </p>
        ) : (
          matches.map((match) => {
            const isSelected = match.match_number === selectedMatchNumber;

            return (
              <button
                key={match.id}
                type="button"
                onClick={() => onMatchChange(match.match_number)}
                className={`glass flex flex-col items-center gap-2 rounded-xl px-3 py-3 text-center transition-all ${
                  isSelected
                    ? "border-neon-green/70 neon-ring-green"
                    : "hover:border-neon-blue/50"
                }`}
              >
                <div className="flex w-full items-center justify-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <img
                      src={match.home.flag_url}
                      alt={match.home.name}
                      width={40}
                      height={28}
                      className="h-7 w-10 rounded-sm object-cover ring-1 ring-border"
                    />
                    <span className="text-xs font-bold text-foreground/90">
                      {match.home.code}
                    </span>
                  </div>
                  <span className="font-display text-sm font-extrabold text-glow-blue">
                    {UI_LABELS.matchTimeline.versus}
                  </span>
                  <div className="flex flex-col items-center gap-1">
                    <img
                      src={match.away.flag_url}
                      alt={match.away.name}
                      width={40}
                      height={28}
                      className="h-7 w-10 rounded-sm object-cover ring-1 ring-border"
                    />
                    <span className="text-xs font-bold text-foreground/90">
                      {match.away.code}
                    </span>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-neon-blue" />
                  <span className="truncate">{match.venue}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
