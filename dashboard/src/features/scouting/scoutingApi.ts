import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { INJURY_API_BASE_URL } from "@/shared/lib/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerSummary {
  id: string;
  name: string;
  photo_url: string;
  country: string;
  age: number | null;
  position: string;
  club: string;
  cluster: string | null;
  impact_score: number | null;
  total_injuries: number | null;
  attributes: {
    pace: number | null;
    shooting: number | null;
    passing: number | null;
    dribbling: number | null;
    defending: number | null;
    physical: number | null;
    overall: number | null;
  };
}

export interface PlayerSearchResponse {
  items: PlayerSummary[];
  total: number;
}

export interface CountriesResponse {
  items: string[];
}

// ─── API slice ─────────────────────────────────────────────────────────────────

export const scoutingApi = createApi({
  reducerPath: "scoutingApi",
  baseQuery: fetchBaseQuery({ baseUrl: INJURY_API_BASE_URL }),
  tagTypes: ["Players", "Countries"],
  endpoints: (builder) => ({
    /** Search players by name and/or country */
    searchPlayers: builder.query<
      PlayerSearchResponse,
      { name?: string; country?: string; limit?: number }
    >({
      query: ({ name = "", country = "", limit = 20 }) => {
        const params = new URLSearchParams();
        if (name.trim()) params.set("name", name.trim());
        if (country.trim()) params.set("country", country.trim());
        params.set("limit", String(limit));
        return `/api/v1/players/?${params.toString()}`;
      },
      providesTags: ["Players"],
      keepUnusedDataFor: 60,
    }),

    /** Get the list of all available countries */
    getCountries: builder.query<string[], void>({
      query: () => "/api/v1/players/countries",
      transformResponse: (response: CountriesResponse) => response.items,
      providesTags: ["Countries"],
      keepUnusedDataFor: 5 * 60,
    }),
  }),
});

export const { useSearchPlayersQuery, useGetCountriesQuery } = scoutingApi;
