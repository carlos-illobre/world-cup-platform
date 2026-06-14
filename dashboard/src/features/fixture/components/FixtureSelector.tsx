import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Skeleton } from "@/shared/components/Skeleton";
import { UI_LABELS } from "@/shared/constants/uiLabels";
import {
  selectFechaSeleccionada,
  selectNumeroPartidoSeleccionado,
  seleccionarFecha,
  seleccionarPartido,
} from "@/features/fixture/fixtureSlice";
import { resetearJugadorSeleccionado } from "@/features/squad/squadSlice";
import {
  useGetFechasJornadaQuery,
  useGetPartidosPorFechaQuery,
} from "@/features/fixture/fixtureApi";
import { MatchDateChip } from "@/features/fixture/components/MatchDateChip";
import { MatchCard } from "@/features/fixture/components/MatchCard";

/**
 * Selector en cascada del fixture del Mundial.
 * Muestra el carrusel de fechas y, debajo, los partidos de la fecha activa.
 */
export function FixtureSelector() {
  const dispatch = useAppDispatch();
  const fechaSeleccionada = useAppSelector(selectFechaSeleccionada);
  const numeroPartidoSeleccionado = useAppSelector(selectNumeroPartidoSeleccionado);

  const {
    data: fechasJornada = [],
    isLoading: cargandoFechas,
  } = useGetFechasJornadaQuery();

  const {
    data: partidos = [],
    isLoading: cargandoPartidos,
  } = useGetPartidosPorFechaQuery(fechaSeleccionada ?? "", {
    skip: !fechaSeleccionada,
  });

  function handleSeleccionarFecha(fechaId: string) {
    dispatch(seleccionarFecha(fechaId));
    dispatch(resetearJugadorSeleccionado());
  }

  function handleSeleccionarPartido(matchNumber: number) {
    dispatch(seleccionarPartido(matchNumber));
    dispatch(resetearJugadorSeleccionado());
  }

  return (
    <div className="glass-panel rounded-2xl p-3 sm:p-4">
      {/* Carrusel de fechas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {cargandoFechas ? (
          <Skeleton className="h-12 w-40 shrink-0 rounded-xl" />
        ) : (
          fechasJornada.map((fechaJornada) => {
            const tienePartidoSeleccionado =
              numeroPartidoSeleccionado !== null &&
              partidos.some((p) => p.match_number === numeroPartidoSeleccionado) &&
              fechaJornada.id === fechaSeleccionada;

            return (
              <MatchDateChip
                key={fechaJornada.id}
                fechaJornada={fechaJornada}
                isActive={fechaJornada.id === fechaSeleccionada}
                hasSelectedMatch={tienePartidoSeleccionado}
                onSelect={handleSeleccionarFecha}
              />
            );
          })
        )}
      </div>

      {/* Grid de partidos */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!fechaSeleccionada ? (
          <p className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
            {UI_LABELS.fixture.selectDateHint}
          </p>
        ) : cargandoPartidos ? (
          <>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </>
        ) : partidos.length === 0 ? (
          <p className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
            {UI_LABELS.fixture.noMatchesForDate}
          </p>
        ) : (
          partidos.map((partido) => (
            <MatchCard
              key={partido.id}
              partido={partido}
              isSelected={partido.match_number === numeroPartidoSeleccionado}
              onSelect={handleSeleccionarPartido}
            />
          ))
        )}
      </div>
    </div>
  );
}
