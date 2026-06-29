import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { PlayerSearchCombobox } from "@/features/squad/components/PlayerSearchCombobox";
import { seleccionarJugador, selectJugadorSeleccionadoId } from "@/features/squad/squadSlice";
import { selectNumeroPartidoSeleccionado, selectSimulatedTeams } from "@/features/fixture/fixtureSlice";
import { useGetJugadoresPorPartidoQuery } from "@/features/squad/squadApi";
import { UI_LABELS } from "@/shared/constants/uiLabels";

/**
 * Barra de selección de jugador.
 * Habilitada únicamente tras elegir un partido — consume Redux y RTK Query directamente.
 */
export function PlayerSelectionBar() {
  const dispatch = useAppDispatch();
  const jugadorSeleccionadoId = useAppSelector(selectJugadorSeleccionadoId);
  const numeroPartido = useAppSelector(selectNumeroPartidoSeleccionado);
  const simulatedTeams = useAppSelector(selectSimulatedTeams);

  const { data: jugadores = [], isLoading } = useGetJugadoresPorPartidoQuery(
    { matchNumber: numeroPartido!, teams: simulatedTeams || undefined },
    { skip: !numeroPartido },
  );

  const disabled = !numeroPartido || isLoading;

  function handleSeleccionarJugador(jugadorId: string) {
    dispatch(seleccionarJugador(jugadorId));
  }

  return (
    <div className="flex items-center justify-center">
      <div className="glass flex w-full max-w-md items-center gap-3 rounded-xl px-3 py-2 sm:px-5">
        <span className="hidden shrink-0 text-sm font-semibold text-muted-foreground sm:inline">
          {UI_LABELS.header.selectPlayer}
        </span>
        <PlayerSearchCombobox
          jugadores={jugadores}
          jugadorSeleccionadoId={jugadorSeleccionadoId}
          onChange={handleSeleccionarJugador}
          disabled={disabled}
          className="w-full"
        />
      </div>
    </div>
  );
}
