import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { fetchMatchDates } from "@/lib/api/injury-api";
import type { MatchDate } from "@/lib/predictions.types";

interface MatchDatesResult {
  matchDates: MatchDate[];
  loading: boolean;
  error: string | null;
}

/** Carga las fechas de jornada para el carrusel superior. */
export function useMatchDates(): MatchDatesResult {
  const query = useQuery({
    queryKey: queryKeys.matchDates,
    queryFn: ({ signal }) => fetchMatchDates(signal),
    staleTime: 5 * 60 * 1000,
  });

  return {
    matchDates: query.data ?? [],
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
