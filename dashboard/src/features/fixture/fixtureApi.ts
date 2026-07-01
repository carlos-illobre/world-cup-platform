import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import { resolvePlayoffMatch, resolvePlayoffTeam } from "@/shared/lib/playoffTeams";
import type {
  FechaJornada,
  FixtureRefreshResult,
  PartidoResumido,
  ContextoPartido,
} from "@/shared/types/injuryRisk.types";

/**
 * API RTK Query para el fixture del Mundial.
 * Endpoints: fechas de jornada y partidos por fecha.
 */
export const fixtureApi = createApi({
  reducerPath: "fixtureApi",
  baseQuery: fetchBaseQuery({ baseUrl: INJURY_API_BASE_URL }),
  tagTypes: ["FechasJornada", "Partidos", "ContextoPartido"],
  endpoints: (builder) => ({
    refreshFifaFixture: builder.mutation<FixtureRefreshResult, void>({
      query: () => ({
        url: "/api/v1/matches/refresh-fifa",
        method: "POST",
      }),
      invalidatesTags: ["FechasJornada", "Partidos", "ContextoPartido"],
    }),

    /** Obtiene todas las fechas de jornada disponibles. */
    getFechasJornada: builder.query<FechaJornada[], void>({
      query: () => `/api/v1/matches/dates?_t=${Date.now()}`,
      transformResponse: (response: { data: FechaJornada[] }) => response.data,
      providesTags: ["FechasJornada"],
      keepUnusedDataFor: 0,
    }),

    /** Obtiene los partidos de una fecha de jornada específica. */
    getPartidosPorFecha: builder.query<PartidoResumido[], string>({
      query: (fechaId) =>
        `/api/v1/matches/dates/${encodeURIComponent(fechaId)}/matches?_t=${Date.now()}`,
      transformResponse: (response: { data: PartidoResumido[] }) =>
        response.data.map(resolvePlayoffMatch),
      providesTags: (_result, _error, fechaId) => [{ type: "Partidos", id: fechaId }],
      keepUnusedDataFor: 0,
    }),

    /** Obtiene el contexto geoclimático de un partido. */
    getPartidoContexto: builder.query<ContextoPartido, number>({
      query: (matchNumber) => `/api/v1/matches/${matchNumber}/context?_t=${Date.now()}`,
      transformResponse: (response: { data: ContextoPartido }) => ({
        ...response.data,
        home: resolvePlayoffTeam(response.data.home),
        away: resolvePlayoffTeam(response.data.away),
      }),
      providesTags: (_result, _error, matchNumber) => [{ type: "ContextoPartido", id: matchNumber }],
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useRefreshFifaFixtureMutation,
  useGetFechasJornadaQuery,
  useGetPartidosPorFechaQuery,
  useGetPartidoContextoQuery,
} = fixtureApi;
