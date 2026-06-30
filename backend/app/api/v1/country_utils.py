import re
import unicodedata

import pandas as pd


def normalize_country_key(value) -> str:
    if value is None or pd.isna(value):
        return ""

    text = str(value).strip()
    text = strip_country_prefix(text)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def strip_country_prefix(value: str) -> str:
    text = str(value).strip()
    return re.sub(r"^[a-z]{2,3}\s+", "", text, count=1).strip()


COUNTRY_ALIASES = {
    "boznia": "Bosnia-Herzegovina",
    "boznia y herzegovina": "Bosnia-Herzegovina",
    "bosnia": "Bosnia-Herzegovina",
    "bosnia and herzegovina": "Bosnia-Herzegovina",
    "bosnia herzegovina": "Bosnia-Herzegovina",
    "bosnia y herzegovina": "Bosnia-Herzegovina",
    "bosnia herz": "Bosnia-Herzegovina",
    "republica checa": "Czechia",
    "rep checa": "Czechia",
    "czech republic": "Czechia",
    "czechia": "Czechia",
    "chequia": "Czechia",
    "turquia": "Türkiye",
    "turkiye": "Türkiye",
    "turkey": "Türkiye",
    "turkiye": "Türkiye",
    "suecia": "Sweden",
    "sweden": "Sweden",
    "irak": "Iraq",
    "iraq": "Iraq",
    "rd del congo": "Congo DR",
    "dr congo": "Congo DR",
    "congo dr": "Congo DR",
    "congo rd": "Congo DR",
    "republica democratica del congo": "Congo DR",
    "democratic republic of the congo": "Congo DR",
    "democratic republic congo": "Congo DR",
}

PLAYOFF_TEAM_OVERRIDES = {
    "UEPD": {"name": "Czechia", "code": "CZE", "iso2_code": "cz"},
    "UEPA": {"name": "Bosnia-Herzegovina", "code": "BIH", "iso2_code": "ba"},
    "UEPC": {"name": "Türkiye", "code": "TUR", "iso2_code": "tr"},
    "UEPB": {"name": "Sweden", "code": "SWE", "iso2_code": "se"},
    "FP02": {"name": "Iraq", "code": "IRQ", "iso2_code": "iq"},
    "FP01": {"name": "Congo DR", "code": "COD", "iso2_code": "cd"},
}

PLAYOFF_NAME_OVERRIDES = {
    "winner uefa playoff d": PLAYOFF_TEAM_OVERRIDES["UEPD"],
    "winner uefa playoff a": PLAYOFF_TEAM_OVERRIDES["UEPA"],
    "winner uefa playoff c": PLAYOFF_TEAM_OVERRIDES["UEPC"],
    "winner uefa playoff b": PLAYOFF_TEAM_OVERRIDES["UEPB"],
    "winner fifa playoff 2": PLAYOFF_TEAM_OVERRIDES["FP02"],
    "winner fifa playoff 1": PLAYOFF_TEAM_OVERRIDES["FP01"],
}


def canonicalize_country_name(value) -> str:
    text = strip_country_prefix(str(value).strip()) if value is not None else ""
    key = normalize_country_key(text)
    return COUNTRY_ALIASES.get(key, text)


def playoff_team_override(team_name=None, team_code=None):
    if team_code:
        override = PLAYOFF_TEAM_OVERRIDES.get(str(team_code).strip().upper())
        if override:
            return override

    if team_name:
        return PLAYOFF_NAME_OVERRIDES.get(normalize_country_key(team_name))

    return None


def country_mask(df: pd.DataFrame, column: str, value) -> pd.Series:
    if df.empty or column not in df.columns:
        return pd.Series([False] * len(df), index=df.index)

    wanted = normalize_country_key(canonicalize_country_name(value))
    keys = df[column].map(lambda item: normalize_country_key(canonicalize_country_name(item)))
    return keys == wanted


def resolve_country_in_df(df: pd.DataFrame, column: str, value) -> str:
    if df.empty or column not in df.columns:
        return canonicalize_country_name(value)

    mask = country_mask(df, column, value)
    if mask.any():
        return str(df.loc[mask, column].iloc[0])

    return canonicalize_country_name(value)
