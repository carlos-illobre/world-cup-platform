import { INJURY_API_BASE_URL } from "@/lib/api/config";
import type {
  MatchDate,
  MatchListItem,
  PlayerOption,
  PredictionResponse,
} from "@/lib/predictions.types";

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${INJURY_API_BASE_URL}${path}`, {
    signal,
    // Evita la página de advertencia de ngrok en planes gratuitos.
    headers: { "ngrok-skip-browser-warning": "true" },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Fechas de jornada para el carrusel superior. */
export async function fetchMatchDates(signal?: AbortSignal): Promise<MatchDate[]> {
  const payload = await fetchJson<{ data: MatchDate[] }>(
    "/api/v3/mundial/fixture/jornadas",
    signal,
  );
  return payload.data;
}

/** Partidos de una fecha concreta (YYYY-MM-DD). */
export async function fetchMatchesByDate(
  kickoffDate: string,
  signal?: AbortSignal,
): Promise<MatchListItem[]> {
  const payload = await fetchJson<{ data: MatchListItem[] }>(
    `/api/v3/mundial/fixture/jornadas/${encodeURIComponent(kickoffDate)}/partidos`,
    signal,
  );
  return payload.data;
}

/** Jugadores elegibles para un partido, con filtro opcional server-side. */
export async function fetchPlayersByMatch(
  matchNumber: number,
  searchQuery?: string,
  signal?: AbortSignal,
): Promise<PlayerOption[]> {
  const params = new URLSearchParams();
  if (searchQuery?.trim()) {
    params.set("q", searchQuery.trim());
  }
  const query = params.toString();
  const path = `/api/v3/mundial/partidos/${matchNumber}/plantilla${query ? `?${query}` : ""}`;
  const payload = await fetchJson<{ data: PlayerOption[] }>(path, signal);
  return payload.data;
}

/** Informe de preparación enriquecido para el dashboard. */
export async function fetchReadinessReport(
  matchNumber: number,
  playerId: string,
  signal?: AbortSignal,
): Promise<PredictionResponse> {
  const encodedPlayerId = encodeURIComponent(playerId);
  return fetchJson<PredictionResponse>(
    `/api/v3/mundial/partidos/${matchNumber}/jugadores/${encodedPlayerId}/diagnostico`,
    signal,
  );
}
