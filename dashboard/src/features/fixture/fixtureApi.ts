import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import type { FechaJornada, PartidoResumido } from "@/shared/types/injuryRisk.types";

/**
 * API RTK Query para el fixture del Mundial.
 * Endpoints: fechas de jornada y partidos por fecha.
 */
export const fixtureApi = createApi({
  reducerPath: "fixtureApi",
  baseQuery: fetchBaseQuery({ baseUrl: INJURY_API_BASE_URL }),
  tagTypes: ["FechasJornada", "Partidos"],
  endpoints: (builder) => ({
    /** Obtiene todas las fechas de jornada disponibles. */
    getFechasJornada: builder.query<FechaJornada[], void>({
      query: () => "/api/v3/mundial/fixture/jornadas",
      transformResponse: (response: { data: FechaJornada[] }) => response.data,
      providesTags: ["FechasJornada"],
      keepUnusedDataFor: 5 * 60,
    }),

    /** Obtiene los partidos de una fecha de jornada específica. */
    getPartidosPorFecha: builder.query<PartidoResumido[], string>({
      query: (fechaId) =>
        `/api/v3/mundial/fixture/jornadas/${encodeURIComponent(fechaId)}/partidos`,
      transformResponse: (response: { data: PartidoResumido[] }) => response.data,
      providesTags: (_result, _error, fechaId) => [{ type: "Partidos", id: fechaId }],
      keepUnusedDataFor: 5 * 60,
    }),
  }),
});

export const { useGetFechasJornadaQuery, useGetPartidosPorFechaQuery } = fixtureApi;
