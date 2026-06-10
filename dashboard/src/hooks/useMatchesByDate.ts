import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { fetchMatchesByDate } from "@/lib/api/injury-api";
import type { MatchListItem } from "@/lib/predictions.types";

interface MatchesByDateResult {
  matches: MatchListItem[];
  loading: boolean;
  error: string | null;
}

/** Carga los partidos de una fecha seleccionada. */
export function useMatchesByDate(kickoffDate: string | null): MatchesByDateResult {
  const query = useQuery({
    queryKey: queryKeys.matchesByDate(kickoffDate ?? ""),
    queryFn: ({ signal }) => fetchMatchesByDate(kickoffDate!, signal),
    enabled: Boolean(kickoffDate),
    staleTime: 5 * 60 * 1000,
  });

  return {
    matches: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
