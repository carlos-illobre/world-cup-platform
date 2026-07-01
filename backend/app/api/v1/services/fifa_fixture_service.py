from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

from app.api.v1.country_utils import canonicalize_country_name, normalize_country_key


FIFA_COMPETITION_ID = "17"
FIFA_2026_SEASON_ID = "285023"
FIFA_FIXTURE_URL = "https://api.fifa.com/api/v3/calendar/matches"
WORLD_CUP_MATCHES_CSV = Path("data/csv/world_cup_matches.csv")


def _localized_text(values: Any) -> str | None:
    if not values:
        return None
    if isinstance(values, str):
        return values
    if isinstance(values, list):
        for item in values:
            if isinstance(item, dict) and item.get("Description"):
                return str(item["Description"])
    return None


def _team_name(team: dict[str, Any] | None) -> str | None:
    if not team:
        return None
    return (
        _localized_text(team.get("TeamName"))
        or team.get("ShortClubName")
        or team.get("Abbreviation")
        or team.get("IdCountry")
    )


def _build_team_lookup(teams_df: pd.DataFrame) -> dict[str, int]:
    lookup: dict[str, int] = {}
    if teams_df.empty:
        return lookup

    source = teams_df.reset_index() if "id" not in teams_df.columns else teams_df.copy()
    for _, row in source.iterrows():
        team_id = int(row.get("id"))
        code = str(row.get("fifa_code", "")).strip().upper()
        name = str(row.get("team_name", "")).strip()
        aliases = {code, name, canonicalize_country_name(name)}

        if code == "BIH":
            aliases.update({"Bosnia and Herzegovina", "Bosnia y Herzegovina"})
        elif code == "COD":
            aliases.update({"DR Congo", "Congo DR", "RD del Congo"})
        elif code == "CIV":
            aliases.update({"Cote d'Ivoire", "Cote d Ivoire", "Costa de Marfil"})
        elif code == "KOR":
            aliases.update({"Republica de Corea", "República de Corea", "Korea Republic"})
        elif code == "RSA":
            aliases.update({"Sudafrica", "Sudáfrica", "South Africa"})
        elif code == "TUR":
            aliases.update({"Turquia", "Türkiye", "Turkey"})
        elif code == "CUR":
            aliases.update({"Curacao", "Curaçao"})
        elif code == "IRN":
            aliases.update({"Iran", "IR Iran", "IR Irán"})
        elif code == "CPV":
            aliases.update({"Cabo Verde", "Cape Verde"})
        elif code == "USA":
            aliases.update({"EE. UU.", "Estados Unidos", "United States"})

        for alias in aliases:
            key = normalize_country_key(alias)
            if key:
                lookup[key] = team_id

    return lookup


def _resolve_team_id(team: dict[str, Any] | None, lookup: dict[str, int]) -> int | None:
    if not team:
        return None

    candidates = [
        team.get("Abbreviation"),
        team.get("IdCountry"),
        team.get("ShortClubName"),
        _team_name(team),
    ]
    for candidate in candidates:
        key = normalize_country_key(canonicalize_country_name(candidate))
        if key in lookup:
            return lookup[key]
    return None


def _stage_id(match: dict[str, Any], existing_stage_id: Any) -> int | None:
    if pd.notna(existing_stage_id):
        try:
            return int(existing_stage_id)
        except (TypeError, ValueError):
            pass

    match_number = int(match.get("MatchNumber") or 0)
    if match_number <= 72:
        return 1
    if match_number <= 88:
        return 2
    if match_number <= 96:
        return 3
    if match_number <= 100:
        return 4
    if match_number <= 102:
        return 5
    if match_number == 103:
        return 6
    if match_number == 104:
        return 7
    return None


async def fetch_fifa_world_cup_2026_matches() -> list[dict[str, Any]]:
    params = {
        "language": "es",
        "count": "500",
        "idCompetition": FIFA_COMPETITION_ID,
        "idSeason": FIFA_2026_SEASON_ID,
    }
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        response = await client.get(FIFA_FIXTURE_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    matches = payload.get("Results") or []
    if not isinstance(matches, list) or not matches:
        raise ValueError("FIFA no devolvió partidos para la Copa Mundial 2026")
    return matches


def merge_fifa_matches(
    current_matches: pd.DataFrame,
    teams_df: pd.DataFrame,
    fifa_matches: list[dict[str, Any]],
) -> tuple[pd.DataFrame, dict[str, Any]]:
    if current_matches.empty:
        raise ValueError("No está cargado world_cup_matches.csv")

    updated = current_matches.copy()
    team_lookup = _build_team_lookup(teams_df)
    updated_count = 0
    resolved_teams = 0
    unresolved: list[int] = []
    score_updates = 0

    extra_columns = {
        "fifa_match_id": None,
        "fifa_stage_name": None,
        "fifa_group_name": None,
        "home_score": None,
        "away_score": None,
        "match_status": None,
        "winner_team_id": None,
        "last_fifa_sync_at": None,
    }
    for column, default in extra_columns.items():
        if column not in updated.columns:
            updated[column] = default

    now = datetime.now(timezone.utc).isoformat()

    for match in fifa_matches:
        match_number = match.get("MatchNumber")
        if match_number is None:
            continue
        row_mask = updated["match_number"].astype(int) == int(match_number)
        if not row_mask.any():
            continue

        idx = updated.index[row_mask][0]
        home_id = _resolve_team_id(match.get("Home"), team_lookup)
        away_id = _resolve_team_id(match.get("Away"), team_lookup)

        if home_id is not None:
            updated.at[idx, "home_team_id"] = home_id
            resolved_teams += 1
        if away_id is not None:
            updated.at[idx, "away_team_id"] = away_id
            resolved_teams += 1
        if home_id is None or away_id is None:
            unresolved.append(int(match_number))

        updated.at[idx, "fifa_match_id"] = match.get("IdMatch")
        updated.at[idx, "kickoff_at"] = match.get("Date") or updated.at[idx, "kickoff_at"]
        stage_name = _localized_text(match.get("StageName"))
        group_name = _localized_text(match.get("GroupName"))
        updated.at[idx, "fifa_stage_name"] = stage_name
        updated.at[idx, "fifa_group_name"] = group_name
        if pd.isna(updated.at[idx, "match_label"]) or not str(updated.at[idx, "match_label"]).strip():
            updated.at[idx, "match_label"] = stage_name or group_name
        updated.at[idx, "stage_id"] = _stage_id(match, updated.at[idx, "stage_id"])
        updated.at[idx, "match_status"] = match.get("MatchStatus")
        updated.at[idx, "last_fifa_sync_at"] = now

        home_score = match.get("HomeTeamScore")
        away_score = match.get("AwayTeamScore")
        if home_score is not None:
            updated.at[idx, "home_score"] = home_score
            score_updates += 1
        if away_score is not None:
            updated.at[idx, "away_score"] = away_score
            score_updates += 1

        winner = match.get("Winner")
        winner_id = None
        if winner and match.get("Home") and str(match["Home"].get("IdTeam")) == str(winner):
            winner_id = home_id
        elif winner and match.get("Away") and str(match["Away"].get("IdTeam")) == str(winner):
            winner_id = away_id
        updated.at[idx, "winner_team_id"] = winner_id
        updated_count += 1

    updated = updated.sort_values("match_number").reset_index(drop=True)
    stats = {
        "source": "FIFA API",
        "fifa_url": FIFA_FIXTURE_URL,
        "season_id": FIFA_2026_SEASON_ID,
        "matches_received": len(fifa_matches),
        "matches_updated": updated_count,
        "team_slots_resolved": resolved_teams,
        "score_fields_updated": score_updates,
        "unresolved_match_numbers": sorted(set(unresolved)),
        "synced_at": now,
    }
    return updated, stats


async def refresh_world_cup_matches(data: dict[str, pd.DataFrame], persist: bool = True) -> dict[str, Any]:
    fifa_matches = await fetch_fifa_world_cup_2026_matches()
    updated, stats = merge_fifa_matches(
        data.get("world_cup_matches", pd.DataFrame()),
        data.get("world_cup_teams", pd.DataFrame()),
        fifa_matches,
    )
    data["world_cup_matches"] = updated
    if persist:
        updated.to_csv(WORLD_CUP_MATCHES_CSV, index=False)
    return stats
