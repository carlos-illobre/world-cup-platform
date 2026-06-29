/** URL base del microservicio de predicción de lesiones (FastAPI). */
export const INJURY_API_BASE_URL =
  typeof window === "undefined"
    ? "http://backend:8000"
    : (import.meta.env.VITE_INJURY_API_BASE_URL ?? "http://localhost:8000");

/**
 * Función genérica para fetch JSON — usada como base para RTK Query
 * y para llamadas manuales cuando sea necesario.
 */
export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${INJURY_API_BASE_URL}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Error en la solicitud (${response.status})`);
  }
  return response.json() as Promise<T>;
}
