import type {
  PlayerOption,
  MatchDay,
  MatchTeam,
  PredictionResponse,
  AiClass,
} from "./predictions.types";

/** Flag image from flagcdn (2-letter ISO). */
const flag = (iso2: string) => `https://flagcdn.com/w160/${iso2}.png`;
/** Deterministic face photo per player. */
const face = (img: number) => `https://i.pravatar.cc/300?img=${img}`;
/** Deterministic stadium photo per match. */
const stadium = (id: string) =>
  `https://picsum.photos/seed/fixar-${id}/900/500`;

interface TeamSeed {
  name: string;
  code: string;
  iso2: string;
}

const TEAMS: Record<string, TeamSeed> = {
  BEL: { name: "Belgium", code: "BEL", iso2: "be" },
  CRO: { name: "Croatia", code: "CRO", iso2: "hr" },
  POL: { name: "Poland", code: "POL", iso2: "pl" },
  NED: { name: "Netherlands", code: "NED", iso2: "nl" },
  MEX: { name: "Mexico", code: "MEX", iso2: "mx" },
  ESP: { name: "Spain", code: "ESP", iso2: "es" },
  BRA: { name: "Brazil", code: "BRA", iso2: "br" },
  ARG: { name: "Argentina", code: "ARG", iso2: "ar" },
  FRA: { name: "France", code: "FRA", iso2: "fr" },
};

const team = (code: string): MatchTeam => {
  const t = TEAMS[code];
  return { name: t.name, code: t.code, flag_url: flag(t.iso2) };
};

interface PlayerSeed {
  name: string;
  number: number;
  team: string; // team code
  img: number;
}

const PLAYER_SEED: Record<string, PlayerSeed> = {
  p1: { name: "K. De Bruyne", number: 7, team: "BEL", img: 12 },
  p2: { name: "R. Lukaku", number: 9, team: "BEL", img: 13 },
  p3: { name: "L. Modric", number: 10, team: "CRO", img: 14 },
  p4: { name: "J. Gvardiol", number: 20, team: "CRO", img: 15 },
  p5: { name: "R. Lewandowski", number: 9, team: "POL", img: 16 },
  p6: { name: "P. Zielinski", number: 19, team: "POL", img: 17 },
  p7: { name: "V. van Dijk", number: 4, team: "NED", img: 18 },
  p8: { name: "C. Gakpo", number: 11, team: "NED", img: 33 },
  p9: { name: "H. Lozano", number: 22, team: "MEX", img: 51 },
  p10: { name: "Pedri", number: 8, team: "ESP", img: 52 },
};

/** Player options for the search combobox (grouped client-side by national team). */
export const PLAYER_OPTIONS: PlayerOption[] = Object.entries(PLAYER_SEED).map(
  ([id, s]) => {
    const t = TEAMS[s.team];
    return {
      id,
      name: s.name,
      national_team: t.name,
      team_code: t.code,
      flag_url: flag(t.iso2),
      face_url: face(s.img),
    };
  },
);

interface MatchSeed {
  home: string; // team code
  away: string;
  venue: string;
  temp_c: number;
  humidity: number;
  altitude: number;
}

const MATCH_SEED: Record<string, MatchSeed> = {
  m1: {
    home: "MEX",
    away: "POL",
    venue: "Estadio Azteca, Mexico City",
    temp_c: 21.2,
    humidity: 51.3,
    altitude: 2240,
  },
  m2: {
    home: "ESP",
    away: "NED",
    venue: "Santiago Bernabéu, Madrid",
    temp_c: 18.6,
    humidity: 44.2,
    altitude: 667,
  },
  m3: {
    home: "BEL",
    away: "CRO",
    venue: "King Baudouin, Brussels",
    temp_c: 16.4,
    humidity: 62.1,
    altitude: 56,
  },
  m4: {
    home: "BRA",
    away: "CRO",
    venue: "Maracanã, Rio de Janeiro",
    temp_c: 29.4,
    humidity: 78.0,
    altitude: 8,
  },
  m5: {
    home: "ARG",
    away: "FRA",
    venue: "Estadio Monumental, Buenos Aires",
    temp_c: 23.1,
    humidity: 57.6,
    altitude: 25,
  },
};

/** Match timeline: days each containing match cards. */
export const MATCH_DAYS: MatchDay[] = [
  {
    id: "d1",
    label: "Matchday 1",
    date: "Jun 14",
    matches: ["m1", "m2"].map(toMatchOption),
  },
  {
    id: "d2",
    label: "Matchday 2",
    date: "Jun 18",
    matches: ["m3", "m4"].map(toMatchOption),
  },
  {
    id: "d3",
    label: "Matchday 3",
    date: "Jun 22",
    matches: ["m5"].map(toMatchOption),
  },
];

function toMatchOption(id: string) {
  const m = MATCH_SEED[id];
  return {
    id,
    home: team(m.home),
    away: team(m.away),
    venue: m.venue,
  };
}

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const t = (h ^= h >>> 16) >>> 0;
    return t / 4294967296;
  };
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function classify(fatigue: number, sleep: number, hydration: number): AiClass {
  const risk = fatigue - (sleep + hydration) / 4;
  if (risk < 20) return 0;
  if (risk < 45) return 1;
  return 2;
}

const LABELS: Record<AiClass, string> = {
  0: "STATUS SAFE",
  1: "STATUS CAUTION",
  2: "STATUS AT RISK",
};

const VERDICTS: Record<AiClass, string> = {
  0: "FIT TO PLAY",
  1: "MONITOR CLOSELY",
  2: "RESTRICT MINUTES",
};

function justification(
  cls: AiClass,
  altitude: number,
  fatigue: number,
): string {
  const fatigueWord =
    fatigue < 40 ? "Moderate" : fatigue < 60 ? "Elevated" : "High";
  if (cls === 0) {
    return `Outstanding sleep quality score and high hydration parameters successfully offset the ${altitude.toLocaleString()}m altitude respiratory stress. Cumulative Fatigue Index is strictly under control at ${fatigue}% (${fatigueWord}).`;
  }
  if (cls === 1) {
    return `Recovery markers are acceptable but altitude respiratory load at ${altitude.toLocaleString()}m is pushing the Cumulative Fatigue Index to ${fatigue}% (${fatigueWord}). Recommend reduced training volume and active monitoring.`;
  }
  return `Sleep deficit combined with ${altitude.toLocaleString()}m altitude stress has driven the Cumulative Fatigue Index to ${fatigue}% (${fatigueWord}). Injury risk is significant — limit exposure and prioritize recovery.`;
}

export function buildPrediction(
  playerId: string,
  matchId: string,
): PredictionResponse {
  const pSeed = PLAYER_SEED[playerId] ?? PLAYER_SEED.p1;
  const mSeed = MATCH_SEED[matchId] ?? MATCH_SEED.m1;
  const pTeam = TEAMS[pSeed.team];
  const homeTeam = team(mSeed.home);
  const awayTeam = team(mSeed.away);
  const rnd = seededRandom(`${playerId}:${matchId}`);

  const altitudeFactor = Math.min(mSeed.altitude / 2500, 1); // higher = harder
  const sleep_quality = Math.round(72 + rnd() * 24 - altitudeFactor * 6);
  const hydration = Math.round(70 + rnd() * 26 - altitudeFactor * 4);
  const body_temp = round(36.3 + rnd() * 0.8, 1);
  const fatigue_index = Math.round(28 + altitudeFactor * 30 + rnd() * 18);

  const stress: "LOW" | "MODERATE" | "HIGH" =
    fatigue_index < 40 ? "LOW" : fatigue_index < 60 ? "MODERATE" : "HIGH";

  const heart_rate_bpm = Math.round(64 + altitudeFactor * 14 + rnd() * 8);
  const heart_rate_series = Array.from({ length: 48 }, (_, i) => {
    const base = heart_rate_bpm;
    return Math.round(base + Math.sin(i / 2.2) * 7 + (rnd() - 0.5) * 12);
  });

  const series = (n: number, base: number, spread: number) =>
    Array.from({ length: n }, () => Math.round(base + rnd() * spread));

  const cls = classify(fatigue_index, sleep_quality, hydration);

  const rating_label =
    sleep_quality >= 85 ? "EXCELLENT" : sleep_quality >= 70 ? "GOOD" : "FAIR";

  return {
    data: {
      player: {
        id: playerId,
        name: pSeed.name,
        number: pSeed.number,
        national_team: pTeam.name,
        team_code: pTeam.code,
        flag_url: flag(pTeam.iso2),
        face_url: face(pSeed.img),
        rating_label,
        stats: {
          sleep_quality,
          hydration,
          body_temp,
          stress,
          fatigue_index,
          heart_rate_bpm,
          heart_rate_series,
          training: {
            duration: series(8, 30, 60),
            load: series(7, 40, 55),
            intensity: series(7, 35, 60),
          },
        },
        radar: {
          cardio: Math.round(60 + rnd() * 38),
          endurance: Math.round(58 + rnd() * 40),
          engagement: Math.round(55 + rnd() * 42),
          respiratory: Math.round(50 + rnd() * 45 - altitudeFactor * 10),
          recovery: Math.round(60 + rnd() * 38),
        },
      },
      match_context: {
        id: matchId,
        label: `${homeTeam.code} vs ${awayTeam.code}`,
        opponent:
          pTeam.code === homeTeam.code ? awayTeam.name : homeTeam.name,
        venue: mSeed.venue,
        stadium_url: stadium(matchId),
        home: homeTeam,
        away: awayTeam,
        weather: {
          temp_c: mSeed.temp_c,
          humidity: mSeed.humidity,
          altitude: mSeed.altitude,
        },
      },
      ai_inference: {
        class: cls,
        label: `${LABELS[cls]} / ${VERDICTS[cls]}`,
        justification: justification(cls, mSeed.altitude, fatigue_index),
      },
    },
  };
}
