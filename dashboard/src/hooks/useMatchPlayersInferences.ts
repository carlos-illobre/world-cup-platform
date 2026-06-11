import { useQuery } from "@tanstack/react-query";
import {
  fetchMatchPlayersInferences,
  type MatchPlayersInferencesResponse,
} from "@/lib/api/match-inferences";

type MatchInferencesData = MatchPlayersInferencesResponse["data"];

interface UseMatchPlayersInferencesResult {
  data: MatchInferencesData | null;
  loading: boolean;
  error: string | null;
}

/** Carga el plantel de ambas selecciones con inferencia IA. */
export function useMatchPlayersInferences(
  matchNumber: number | null,
): UseMatchPlayersInferencesResult {
  const query = useQuery({
    queryKey: ["match-players-inferences", matchNumber ?? 0],
    queryFn: ({ signal }) => fetchMatchPlayersInferences(matchNumber!, signal),
    enabled: Boolean(matchNumber),
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
