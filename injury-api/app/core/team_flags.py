"""Utilidades para banderas de selecciones (single source of truth FIFA → ISO2)."""

# Códigos FIFA del Mundial 2026 → ISO 3166-1 alpha-2 (flagcdn.com)
FIFA_TO_ISO2: dict[str, str] = {
    "MEX": "mx",
    "RSA": "za",
    "KOR": "kr",
    "UEPD": "eu",
    "CAN": "ca",
    "UEPA": "eu",
    "QAT": "qa",
    "SUI": "ch",
    "BRA": "br",
    "MAR": "ma",
    "HAI": "ht",
    "SCO": "gb-sct",
    "USA": "us",
    "PAR": "py",
    "AUS": "au",
    "UEPC": "eu",
    "GER": "de",
    "CUR": "cw",
    "CIV": "ci",
    "ECU": "ec",
    "NED": "nl",
    "JPN": "jp",
    "UEPB": "eu",
    "TUN": "tn",
    "BEL": "be",
    "EGY": "eg",
    "IRN": "ir",
    "NZL": "nz",
    "ESP": "es",
    "CPV": "cv",
    "KSA": "sa",
    "URU": "uy",
    "FRA": "fr",
    "SEN": "sn",
    "FP02": "un",
    "NOR": "no",
    "ARG": "ar",
    "ALG": "dz",
    "AUT": "at",
    "JOR": "jo",
    "POR": "pt",
    "FP01": "un",
    "UZB": "uz",
    "COL": "co",
    "ENG": "gb-eng",
    "CRO": "hr",
    "GHA": "gh",
    "PAN": "pa",
}


def build_flag_url(fifa_code: str, fallback_url: str | None = None) -> str:
    """Construye URL de bandera; usa fallback del CSV FIFA si el código no está mapeado."""
    if fallback_url and isinstance(fallback_url, str) and fallback_url.startswith("http"):
        return fallback_url
    iso2 = FIFA_TO_ISO2.get(fifa_code, "un")
    return f"https://flagcdn.com/w160/{iso2}.png"
