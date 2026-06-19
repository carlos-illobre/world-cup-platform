import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check, UserRound } from "lucide-react";
import { PlayerAvatar } from "@/shared/components/PlayerAvatar";
import { TeamFlag } from "@/shared/components/TeamFlag";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import type { OpcionJugador } from "@/shared/types/injuryRisk.types";

interface PlayerSearchComboboxProps {
  jugadores: OpcionJugador[];
  jugadorSeleccionadoId: string | null;
  onChange: (jugadorId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Combobox con autocompletado para seleccionar un jugador del partido.
 * Filtra por nombre o selección nacional y agrupa resultados por equipo.
 */
export function PlayerSearchCombobox({
  jugadores,
  jugadorSeleccionadoId,
  onChange,
  disabled = false,
  className,
}: PlayerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const jugadorSeleccionado = jugadores.find((j) => j.id === jugadorSeleccionadoId) ?? null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const gruposPorEquipo = useMemo(() => {
    const normalizedQuery = busqueda.trim().toLowerCase();
    const filtrados = normalizedQuery
      ? jugadores.filter(
          (j) =>
            j.name.toLowerCase().includes(normalizedQuery) ||
            j.national_team.toLowerCase().includes(normalizedQuery),
        )
      : jugadores;

    const grupoPorEquipo = new Map<string, OpcionJugador[]>();
    for (const jugador of filtrados) {
      const equipoJugadores = grupoPorEquipo.get(jugador.national_team) ?? [];
      equipoJugadores.push(jugador);
      grupoPorEquipo.set(jugador.national_team, equipoJugadores);
    }
    return Array.from(grupoPorEquipo.entries());
  }, [jugadores, busqueda]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`glass flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-neon-blue/60"
        }`}
      >
        {jugadorSeleccionado ? (
          <>
            <PlayerAvatar
              faceUrl={jugadorSeleccionado.face_url}
              playerName={jugadorSeleccionado.name}
              size="sm"
              className="ring-neon-blue/40"
            />
            <span className="flex-1 truncate font-bold text-foreground">
              {jugadorSeleccionado.name}
            </span>
            <TeamFlag
              flagUrl={jugadorSeleccionado.flag_url}
              teamName={jugadorSeleccionado.national_team}
              size="xs"
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

      {/* Dropdown */}
      {open && (
        <div className="glass-panel absolute z-40 mt-2 w-full overflow-hidden rounded-xl p-1.5">
          {/* Búsqueda */}
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2.5 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={UI_LABELS.playerCombobox.searchPlaceholder}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Resultados agrupados por equipo */}
          <div className="mt-1.5 max-h-[320px] overflow-y-auto">
            {gruposPorEquipo.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {UI_LABELS.playerCombobox.emptyResults}
              </p>
            )}
            {gruposPorEquipo.map(([nombreEquipo, jugadoresEquipo]) => (
              <div key={nombreEquipo} className="mb-1">
                <div className="flex items-center gap-2 px-2.5 py-1">
                  <TeamFlag
                    flagUrl={jugadoresEquipo[0].flag_url}
                    teamName={nombreEquipo}
                    size="xs"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {nombreEquipo}
                  </span>
                </div>
                {jugadoresEquipo.map((jugador) => (
                  <button
                    key={jugador.id}
                    type="button"
                    onClick={() => {
                      onChange(jugador.id);
                      setOpen(false);
                      setBusqueda("");
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neon-blue/15 ${
                      jugador.id === jugadorSeleccionadoId ? "bg-neon-blue/10" : ""
                    }`}
                  >
                    <PlayerAvatar
                      faceUrl={jugador.face_url}
                      playerName={jugador.name}
                      size="md"
                    />
                    <span
                      className={`flex-1 truncate text-sm font-semibold ${
                        jugador.id === jugadorSeleccionadoId
                          ? "text-glow-blue"
                          : "text-foreground/90"
                      }`}
                    >
                      {jugador.name}
                    </span>
                    <TeamFlag
                      flagUrl={jugador.flag_url}
                      teamName={jugador.national_team}
                      size="sm"
                    />
                    {jugador.id === jugadorSeleccionadoId && (
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
