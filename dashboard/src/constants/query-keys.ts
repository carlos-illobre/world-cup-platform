/** Claves centralizadas para React Query (single source of truth). */
export const queryKeys = {
  matchDates: ["match-dates"] as const,
  matchesByDate: (kickoffDate: string) => ["matches", kickoffDate] as const,
  playersByMatch: (matchNumber: number, searchQuery?: string) =>
    ["players", matchNumber, searchQuery ?? ""] as const,
  readinessReport: (matchNumber: number, playerId: string) =>
    ["readiness-report", matchNumber, playerId] as const,
};
