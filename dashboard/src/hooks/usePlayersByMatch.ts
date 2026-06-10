import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { fetchPlayersByMatch } from "@/lib/api/injury-api";
import type { PlayerOption } from "@/lib/predictions.types";

interface PlayersByMatchResult {
  players: PlayerOption[];
  loading: boolean;
  error: string | null;
}

/** Carga jugadores elegibles para el partido seleccionado. */
export function usePlayersByMatch(
  matchNumber: number | null,
  searchQuery?: string,
): PlayersByMatchResult {
  const query = useQuery({
    queryKey: queryKeys.playersByMatch(matchNumber ?? 0, searchQuery),
    queryFn: ({ signal }) =>
      fetchPlayersByMatch(matchNumber!, searchQuery, signal),
    enabled: Boolean(matchNumber),
    staleTime: 2 * 60 * 1000,
  });

  return {
    players: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
