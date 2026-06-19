import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import type { ReportePreparacion, ReportePreparacionResponse } from "@/shared/types/injuryRisk.types";

/**
 * API RTK Query para el diagnóstico de riesgo de lesión.
 * Endpoint principal: reporte de preparación por jugador y partido.
 */
export const injuryRiskApi = createApi({
  reducerPath: "injuryRiskApi",
  baseQuery: fetchBaseQuery({ baseUrl: INJURY_API_BASE_URL }),
  tagTypes: ["ReportePreparacion"],
  endpoints: (builder) => ({
    /** Obtiene el reporte de preparación completo para un jugador en un partido específico. */
    getReportePreparacion: builder.query<
      ReportePreparacion,
      { matchNumber: number; jugadorId: string }
    >({
      query: ({ matchNumber, jugadorId }) =>
        `/api/v1/injuries/risk/${encodeURIComponent(jugadorId)}?match=${matchNumber}`,
      transformResponse: (response: ReportePreparacionResponse) => response.data,
      providesTags: (_result, _error, { matchNumber, jugadorId }) => [
        { type: "ReportePreparacion", id: `${matchNumber}-${jugadorId}` },
      ],
    }),
  }),
});

export const { useGetReportePreparacionQuery } = injuryRiskApi;
