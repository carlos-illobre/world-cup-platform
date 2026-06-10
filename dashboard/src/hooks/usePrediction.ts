import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { fetchReadinessReport } from "@/lib/api/injury-api";
import type { PredictionResponse } from "@/lib/predictions.types";

type PredictionData = PredictionResponse["data"];

interface PredictionResult {
  data: PredictionData | null;
  loading: boolean;
  error: string | null;
}

/** Consulta el informe de preparación cuando hay partido y jugador seleccionados. */
export function usePrediction(
  playerName: string | null,
  matchNumber: number | null,
): PredictionResult {
  const query = useQuery({
    queryKey: queryKeys.readinessReport(matchNumber ?? 0, playerName ?? ""),
    queryFn: ({ signal }) =>
      fetchReadinessReport(matchNumber!, playerName!, signal).then(
        (response) => response.data,
      ),
    enabled: Boolean(playerName && matchNumber),
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
