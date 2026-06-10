"""Construcción del catálogo de jugadores y partidos para el dashboard."""

from datetime import datetime

import pandas as pd

from app.core.constants import (
    FixtureColumns,
    PlayerColumns,
)
from app.core.exceptions import MatchDateNotFoundError, MatchNotFoundError
from app.core.team_flags import build_flag_url
from app.domain.dashboard_schemas import (
    MatchDateSchema,
    MatchDaySchema,
    MatchListItemSchema,
    MatchOptionSchema,
    MatchTeamSchema,
    PlayerOptionSchema,
)


class DashboardCatalogService:
    """Genera listas de jugadores y partidos a partir de los CSV precargados."""

    def __init__(
        self,
        fixture_dataframe: pd.DataFrame,
        combined_dataframe: pd.DataFrame,
        players_dataframe: pd.DataFrame,
        nationality_to_fifa: dict[str, str],
    ) -> None:
        self._fixture = fixture_dataframe
        self._combined = combined_dataframe
        self._players = players_dataframe
        self._nationality_to_fifa = nationality_to_fifa

    def build_player_options(self) -> list[PlayerOptionSchema]:
        """Jugadores con perfil biomédico disponible para el combobox."""
        return self._build_player_options(eligible_team_codes=None, query=None)

    def build_player_options_for_match(
        self,
        match_number: int,
        query: str | None = None,
    ) -> tuple[list[PlayerOptionSchema], str, str]:
        """Jugadores elegibles para un partido (selecciones local y visitante)."""
        match_row = self._find_match_row(match_number)
        home_code = str(match_row[FixtureColumns.HOME_FIFA_CODE])
        away_code = str(match_row[FixtureColumns.AWAY_FIFA_CODE])
        players = self._build_player_options(
            eligible_team_codes={home_code, away_code},
            query=query,
        )
        return players, home_code, away_code

    def build_match_dates(self) -> list[MatchDateSchema]:
        """Fechas del fixture agrupadas por kickoff (sin partidos anidados)."""
        fixture = self._with_kickoff_date()
        match_dates: list[MatchDateSchema] = []

        for day_index, (kickoff_date, day_matches) in enumerate(
            fixture.groupby("kickoff_date", sort=True),
            start=1,
        ):
            parsed_date = datetime.strptime(str(kickoff_date), "%Y-%m-%d")
            match_dates.append(
                MatchDateSchema(
                    id=str(kickoff_date),
                    label=f"Jornada {day_index}",
                    date=parsed_date.strftime("%b %d"),
                    match_count=len(day_matches),
                )
            )

        return match_dates

    def build_matches_for_date(self, kickoff_date: str) -> list[MatchListItemSchema]:
        """Partidos de una fecha de kickoff concreta."""
        fixture = self._with_kickoff_date()
        day_matches = fixture[fixture["kickoff_date"] == kickoff_date]

        if day_matches.empty:
            raise MatchDateNotFoundError(
                f"La fecha '{kickoff_date}' no existe en el fixture.",
            )

        return [
            self._to_match_list_item(row)
            for _, row in day_matches.sort_values(FixtureColumns.MATCH_NUMBER).iterrows()
        ]

    def build_match_days(self) -> list[MatchDaySchema]:
        """Partidos del fixture agrupados por fecha de kickoff (API v1)."""
        fixture = self._with_kickoff_date()

        match_days: list[MatchDaySchema] = []
        for day_index, (kickoff_date, day_matches) in enumerate(
            fixture.groupby("kickoff_date", sort=True),
            start=1,
        ):
            parsed_date = datetime.strptime(str(kickoff_date), "%Y-%m-%d")
            match_options = [
                self._to_match_option(row)
                for _, row in day_matches.sort_values(FixtureColumns.MATCH_NUMBER).iterrows()
            ]
            match_days.append(
                MatchDaySchema(
                    id=f"d{day_index}",
                    label=f"Matchday {day_index}",
                    date=parsed_date.strftime("%b %d"),
                    matches=match_options,
                )
            )

        return match_days

    def is_player_eligible_for_match(self, player_name: str, match_number: int) -> bool:
        """Verifica si el jugador pertenece a alguna de las selecciones del partido."""
        players, _, _ = self.build_player_options_for_match(match_number)
        normalized_name = player_name.strip().lower()
        return any(player.name.strip().lower() == normalized_name for player in players)

    def _with_kickoff_date(self) -> pd.DataFrame:
        fixture = self._fixture.copy()
        fixture["kickoff_date"] = fixture[FixtureColumns.KICKOFF_AT].str.split().str[0]
        return fixture

    def _find_match_row(self, match_number: int) -> pd.Series:
        matches = self._fixture[
            self._fixture[FixtureColumns.MATCH_NUMBER] == match_number
        ]
        if matches.empty:
            raise MatchNotFoundError(
                f"El partido con número {match_number} no existe en el fixture.",
            )
        return matches.iloc[0]

    def _build_player_options(
        self,
        eligible_team_codes: set[str] | None,
        query: str | None,
    ) -> list[PlayerOptionSchema]:
        mapped_names = self._combined[PlayerColumns.SHORT_NAME].drop_duplicates()
        players = self._players[
            self._players[PlayerColumns.SHORT_NAME].isin(mapped_names)
        ].drop_duplicates(PlayerColumns.SHORT_NAME)

        normalized_query = query.strip().lower() if query else None
        options: list[PlayerOptionSchema] = []

        for _, row in players.iterrows():
            nationality = str(row[PlayerColumns.NATIONALITY_NAME])
            team_code = self._nationality_to_fifa.get(nationality, "UNK")

            if eligible_team_codes is not None and team_code not in eligible_team_codes:
                continue

            short_name = str(row[PlayerColumns.SHORT_NAME])
            if normalized_query and normalized_query not in short_name.lower():
                if normalized_query not in nationality.lower():
                    continue

            flag_url = build_flag_url(
                team_code,
                row.get(PlayerColumns.NATION_FLAG_URL),
            )
            face_url = str(row.get(PlayerColumns.PLAYER_FACE_URL, ""))
            if not face_url.startswith("http"):
                face_url = "https://i.pravatar.cc/300?u=player"

            options.append(
                PlayerOptionSchema(
                    id=short_name,
                    name=short_name,
                    national_team=nationality,
                    team_code=team_code,
                    flag_url=flag_url,
                    face_url=face_url,
                )
            )

        return sorted(options, key=lambda player: player.name)

    def _to_match_option(self, row: pd.Series) -> MatchOptionSchema:
        venue = f"{row[FixtureColumns.VENUE_NAME]}, {row[FixtureColumns.CITY_NAME]}"
        return MatchOptionSchema(
            id=str(int(row[FixtureColumns.MATCH_NUMBER])),
            home=self._to_match_team(
                str(row[FixtureColumns.HOME_TEAM_NAME]),
                str(row[FixtureColumns.HOME_FIFA_CODE]),
            ),
            away=self._to_match_team(
                str(row[FixtureColumns.AWAY_TEAM_NAME]),
                str(row[FixtureColumns.AWAY_FIFA_CODE]),
            ),
            venue=venue,
        )

    def _to_match_list_item(self, row: pd.Series) -> MatchListItemSchema:
        match_number = int(row[FixtureColumns.MATCH_NUMBER])
        venue = f"{row[FixtureColumns.VENUE_NAME]}, {row[FixtureColumns.CITY_NAME]}"
        return MatchListItemSchema(
            id=str(match_number),
            match_number=match_number,
            home=self._to_match_team(
                str(row[FixtureColumns.HOME_TEAM_NAME]),
                str(row[FixtureColumns.HOME_FIFA_CODE]),
            ),
            away=self._to_match_team(
                str(row[FixtureColumns.AWAY_TEAM_NAME]),
                str(row[FixtureColumns.AWAY_FIFA_CODE]),
            ),
            venue=venue,
            kickoff_at=str(row[FixtureColumns.KICKOFF_AT]),
        )

    @staticmethod
    def _to_match_team(name: str, fifa_code: str) -> MatchTeamSchema:
        return MatchTeamSchema(
            name=name,
            code=fifa_code,
            flag_url=build_flag_url(fifa_code),
        )
