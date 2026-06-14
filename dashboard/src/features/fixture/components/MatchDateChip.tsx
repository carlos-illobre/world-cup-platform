import { CalendarDays } from "lucide-react";
import type { FechaJornada } from "@/shared/types/injuryRisk.types";

interface MatchDateChipProps {
  fechaJornada: FechaJornada;
  isActive: boolean;
  hasSelectedMatch: boolean;
  onSelect: (fechaId: string) => void;
}

/** Chip interactivo de fecha de jornada del Mundial. */
export function MatchDateChip({
  fechaJornada,
  isActive,
  hasSelectedMatch,
  onSelect,
}: MatchDateChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(fechaJornada.id)}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 transition-colors ${
        isActive
          ? "border-neon-blue/70 bg-neon-blue/15"
          : "border-border bg-secondary/40 hover:border-neon-blue/40"
      }`}
    >
      <CalendarDays
        className={`h-4 w-4 ${isActive ? "text-neon-blue" : "text-muted-foreground"}`}
      />
      <span className="flex flex-col text-left leading-tight gap-1">
        <span
          className={`text-sm font-bold ${isActive ? "text-glow-blue" : "text-foreground/90"}`}
        >
          {fechaJornada.date}
        </span>
      </span>
      {hasSelectedMatch && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-neon-green shadow-[0_0_8px_var(--neon-green)]" />
      )}
    </button>
  );
}
