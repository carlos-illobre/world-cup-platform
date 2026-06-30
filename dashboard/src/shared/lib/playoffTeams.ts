import type {
  EquipoNacional,
  InferenciaPlantillaPartido,
  JugadorConInferencia,
  OpcionJugador,
  PartidoResumido,
} from "@/shared/types/injuryRisk.types";

const PLAYOFF_TEAM_OVERRIDES: Record<string, EquipoNacional> = {
  UEPD: {
    name: "Czechia",
    code: "CZE",
    flag_url: "https://flagcdn.com/w320/cz.png",
  },
  UEPA: {
    name: "Bosnia-Herzegovina",
    code: "BIH",
    flag_url: "https://flagcdn.com/w320/ba.png",
  },
  UEPC: {
    name: "Türkiye",
    code: "TUR",
    flag_url: "https://flagcdn.com/w320/tr.png",
  },
  UEPB: {
    name: "Sweden",
    code: "SWE",
    flag_url: "https://flagcdn.com/w320/se.png",
  },
  FP02: {
    name: "Iraq",
    code: "IRQ",
    flag_url: "https://flagcdn.com/w320/iq.png",
  },
  FP01: {
    name: "Congo DR",
    code: "COD",
    flag_url: "https://flagcdn.com/w320/cd.png",
  },
};

const PLAYOFF_NAME_TO_CODE: Record<string, string> = {
  "winner uefa playoff d": "UEPD",
  "winner uefa playoff a": "UEPA",
  "winner uefa playoff c": "UEPC",
  "winner uefa playoff b": "UEPB",
  "winner fifa playoff 2": "FP02",
  "winner fifa playoff 1": "FP01",
};

function normalizeTeamKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolvePlayoffTeam(team: EquipoNacional): EquipoNacional {
  const byCode = PLAYOFF_TEAM_OVERRIDES[team.code?.toUpperCase()];
  if (byCode) return byCode;

  const overrideCode = PLAYOFF_NAME_TO_CODE[normalizeTeamKey(team.name ?? "")];
  if (overrideCode) return PLAYOFF_TEAM_OVERRIDES[overrideCode];

  return team;
}

export function resolvePlayoffMatch(partido: PartidoResumido): PartidoResumido {
  return {
    ...partido,
    home: resolvePlayoffTeam(partido.home),
    away: resolvePlayoffTeam(partido.away),
  };
}

export function resolvePlayoffPlayerTeam<T extends OpcionJugador | JugadorConInferencia>(
  jugador: T,
): T {
  const team = resolvePlayoffTeam({
    name: jugador.national_team,
    code: jugador.team_code,
    flag_url: jugador.flag_url,
  });

  return {
    ...jugador,
    national_team: team.name,
    team_code: team.code,
    flag_url: team.flag_url,
  };
}

export function resolvePlayoffSquadInference(
  data: InferenciaPlantillaPartido,
): InferenciaPlantillaPartido {
  return {
    ...data,
    home: {
      team: resolvePlayoffTeam(data.home.team),
      players: data.home.players.map(resolvePlayoffPlayerTeam),
    },
    away: {
      team: resolvePlayoffTeam(data.away.team),
      players: data.away.players.map(resolvePlayoffPlayerTeam),
    },
  };
}
