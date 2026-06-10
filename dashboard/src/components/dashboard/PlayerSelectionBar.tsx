import { PlayerCombobox } from "@/components/dashboard/PlayerCombobox";
import { UI_LABELS } from "@/constants/ui-labels";
import type { PlayerOption } from "@/lib/predictions.types";

interface PlayerSelectionBarProps {
  players: PlayerOption[];
  selectedPlayerName: string | null;
  matchSelected: boolean;
  loading: boolean;
  onPlayerChange: (playerName: string) => void;
}

/** Barra central con el buscador de jugadores (habilitado tras elegir partido). */
export function PlayerSelectionBar({
  players,
  selectedPlayerName,
  matchSelected,
  loading,
  onPlayerChange,
}: PlayerSelectionBarProps) {
  const disabled = !matchSelected || loading;

  return (
    <div className="flex items-center justify-center">
      <div className="glass flex w-full max-w-md items-center gap-3 rounded-xl px-3 py-2 sm:px-5">
        <span className="hidden shrink-0 text-sm font-semibold text-muted-foreground sm:inline">
          {UI_LABELS.header.selectPlayer}
        </span>
        <PlayerCombobox
          players={players}
          value={selectedPlayerName}
          onChange={onPlayerChange}
          disabled={disabled}
          className="w-full"
        />
      </div>
    </div>
  );
}
