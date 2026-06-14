import { INJURY_API_BASE_URL } from "@/lib/api/config";
import type { AiClass, MatchTeam } from "@/lib/predictions.types";

/**
 * Item de jugador enriquecido con la inferencia IA, para el listado por partido.
 * Replica los campos de PlayerOption y agrega `ai_inference`.
 */
export interface PlayerWithInference {
  id: string;
  name: string;
  national_team: string;
  team_code: string;
  flag_url: string;
  face_url: string;
  ai_inference: {
    class: AiClass;
    label: string;
  };
}

/** Agrupación por selección dentro del partido. */
export interface TeamSquadInference {
  team: MatchTeam;
  players: PlayerWithInference[];
}

/** Payload completo del endpoint. */
export interface MatchPlayersInferencesResponse {
  data: {
    match_number: number;
    home: TeamSquadInference;
    away: TeamSquadInference;
  };
}

/**
 * Solicita el listado de jugadores de ambas selecciones de un partido
 * con su inferencia IA pre-calculada.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  DISEÑO DE ENDPOINT PROPUESTO (a implementar en el backend FastAPI):
 *
 *  GET /api/v3/mundial/partidos/{match_number}/plantilla-con-diagnostico
 *
 *  Path params:
 *    - match_number: int  (número de partido, igual al usado en
 *                          /api/v3/mundial/partidos/{match_number}/plantilla)
 *
 *  Response 200 application/json:
 *  {
 *    "data": {
 *      "match_number": 17,
 *      "home": {
 *        "team": {
 *          "name": "Mexico",
 *          "code": "MEX",
 *          "flag_url": "https://.../mex.png"
 *        },
 *        "players": [
 *          {
 *            "id": "mex-001",
 *            "name": "Guillermo Ochoa",
 *            "national_team": "Mexico",
 *            "team_code": "MEX",
 *            "flag_url": "https://.../mex.png",
 *            "face_url": "https://.../ochoa.jpg",
 *            "ai_inference": {
 *              "class": 2,            // 0 = verde, 1 = amarillo, 2 = rojo
 *              "label": "LIMITAR MINUTOS"
 *            }
 *          }
 *          // ... resto del plantel
 *        ]
 *      },
 *      "away": { ...mismo formato que home }
 *    }
 *  }
 *
 *  Notas para el backend:
 *   - Devolver los 2 planteles completos (no sólo titulares).
 *   - `ai_inference.class` debe coincidir con la clase que devuelve
 *     /readiness-report para ese jugador+partido (misma fuente).
 *   - El orden interno no importa: el frontend ordena por clase
 *     (2 rojo → 1 amarillo → 0 verde) y luego por nombre.
 *   - Cachear server-side por (match_number) durante unos minutos
 *     ya que recorrer inferencias de ~46 jugadores puede ser costoso.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function fetchMatchPlayersInferences(
  matchNumber: number,
  signal?: AbortSignal,
): Promise<MatchPlayersInferencesResponse["data"]> {
  const response = await fetch(
    `${INJURY_API_BASE_URL}/api/v3/mundial/partidos/${matchNumber}/plantilla-con-diagnostico`,
    {
      signal,
      headers: { "ngrok-skip-browser-warning": "true" },
    },
  );
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  const payload = (await response.json()) as MatchPlayersInferencesResponse;
  return payload.data;
}
