import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";
import type {
  OpcionJugador,
  InferenciaPlantillaPartido,
  InferenciaPlantillaResponse,
} from "@/shared/types/injuryRisk.types";

/**
 * API RTK Query para los planteles del partido.
 * Endpoints: jugadores por partido (búsqueda) e inferencias por plantel completo.
 */
export const squadApi = createApi({
  reducerPath: "squadApi",
  baseQuery: fetchBaseQuery({ baseUrl: INJURY_API_BASE_URL }),
  tagTypes: ["Plantilla", "InferenciaPlantilla"],
  endpoints: (builder) => ({
    /** Obtiene los jugadores de un partido con filtro de búsqueda opcional. */
    getJugadoresPorPartido: builder.query<
      OpcionJugador[],
      { matchNumber: number; searchQuery?: string }
    >({
      query: ({ matchNumber, searchQuery }) => {
        const params = new URLSearchParams();
        if (searchQuery?.trim()) {
          params.set("q", searchQuery.trim());
        }
        const query = params.toString();
        return `/api/v3/mundial/partidos/${matchNumber}/plantilla${query ? `?${query}` : ""}`;
      },
      transformResponse: (response: { data: OpcionJugador[] }) => response.data,
      providesTags: (_result, _error, { matchNumber }) => [
        { type: "Plantilla", id: matchNumber },
      ],
      keepUnusedDataFor: 2 * 60,
    }),

    /** Obtiene el plantel completo de ambos equipos con inferencia de riesgo pre-calculada. */
    getInferenciaPlantilla: builder.query<InferenciaPlantillaPartido, number>({
      query: (matchNumber) =>
        `/api/v3/mundial/partidos/${matchNumber}/plantilla-con-diagnostico`,
      transformResponse: (response: InferenciaPlantillaResponse) => response.data,
      providesTags: (_result, _error, matchNumber) => [
        { type: "InferenciaPlantilla", id: matchNumber },
      ],
      keepUnusedDataFor: 2 * 60,
    }),
  }),
});

export const {
  useGetJugadoresPorPartidoQuery,
  useGetInferenciaPlantillaQuery,
} = squadApi;
