import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check, UserRound } from "lucide-react";
import { UI_LABELS } from "@/constants/ui-labels";
import type { PlayerOption } from "@/lib/predictions.types";

interface PlayerComboboxProps {
  players: PlayerOption[];
  value: string | null;
  onChange: (playerName: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Combobox con autocompletado para selección de jugadores.
 * Filtra por nombre y agrupa resultados por selección nacional.
 */
export function PlayerCombobox({
  players,
  value,
  onChange,
  disabled = false,
  className,
}: PlayerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = players.find((p) => p.id === value) ?? null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? players.filter(
          (player) =>
            player.name.toLowerCase().includes(normalizedQuery) ||
            player.national_team.toLowerCase().includes(normalizedQuery),
        )
      : players;

    const groupMap = new Map<string, PlayerOption[]>();
    for (const player of filtered) {
      const teamPlayers = groupMap.get(player.national_team) ?? [];
      teamPlayers.push(player);
      groupMap.set(player.national_team, teamPlayers);
    }
    return Array.from(groupMap.entries());
  }, [players, query]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((isOpen) => !isOpen)}
        className={`glass flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:border-neon-blue/60"
        }`}
      >
        {selected ? (
          <>
            <img
              src={selected.face_url}
              alt={selected.name}
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-neon-blue/40"
            />
            <span className="flex-1 truncate font-bold text-foreground">
              {selected.name}
            </span>
            <img
              src={selected.flag_url}
              alt={selected.national_team}
              width={22}
              height={16}
              className="h-4 w-[22px] shrink-0 rounded-sm object-cover ring-1 ring-border"
            />
          </>
        ) : (
          <>
            <UserRound className="h-5 w-5 shrink-0 text-neon-blue" />
            <span className="flex-1 truncate font-semibold text-muted-foreground">
              {disabled
                ? UI_LABELS.playerCombobox.disabledPlaceholder
                : UI_LABELS.playerCombobox.placeholder}
            </span>
          </>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neon-blue transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="glass-panel absolute z-40 mt-2 w-full overflow-hidden rounded-xl p-1.5">
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2.5 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={UI_LABELS.playerCombobox.searchPlaceholder}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-1.5 max-h-[320px] overflow-y-auto">
            {groups.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {UI_LABELS.playerCombobox.emptyResults}
              </p>
            )}
            {groups.map(([teamName, teamPlayers]) => (
              <div key={teamName} className="mb-1">
                <div className="flex items-center gap-2 px-2.5 py-1">
                  <img
                    src={teamPlayers[0].flag_url}
                    alt={teamName}
                    width={18}
                    height={13}
                    className="h-[13px] w-[18px] rounded-sm object-cover ring-1 ring-border"
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {teamName}
                  </span>
                </div>
                {teamPlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => {
                      onChange(player.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neon-blue/15 ${
                      player.id === value ? "bg-neon-blue/10" : ""
                    }`}
                  >
                    <img
                      src={player.face_url}
                      alt={player.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
                    />
                    <span
                      className={`flex-1 truncate text-sm font-semibold ${
                        player.id === value ? "text-glow-blue" : "text-foreground/90"
                      }`}
                    >
                      {player.name}
                    </span>
                    <img
                      src={player.flag_url}
                      alt={player.national_team}
                      width={20}
                      height={14}
                      className="h-[14px] w-5 shrink-0 rounded-sm object-cover ring-1 ring-border"
                    />
                    {player.id === value && (
                      <Check className="h-4 w-4 shrink-0 text-neon-green" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
