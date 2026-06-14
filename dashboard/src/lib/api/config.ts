/** URL base del microservicio de predicción de lesiones (FastAPI). */
export const INJURY_API_BASE_URL =
  import.meta.env.VITE_INJURY_API_BASE_URL ??
  "http://localhost:8000";
