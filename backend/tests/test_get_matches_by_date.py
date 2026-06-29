"""
Test de integración para GET /api/v1/matches/dates/2026-06-11/matches.

Verifica que el rival de Korea Republic sea Czechia (CZE) usando datos reales.

Diagnóstico del bug:
- El servidor retorna "Winner UEFA Playoff D" (UEPD) en vez de "Czechia" (CZE).
- El CSV actual tiene team_id=4 como Czechia (correcto).
- El servidor probablemente carga una versión cacheada/desactualizada de world_cup_teams.csv
  donde team_id=4 era un placeholder de playoff.
- Además, match 2 (kickoff: 2026-06-11 22:00-06) aparece bajo fecha 2026-06-12,
  lo que indica un posible bug en el filtrado por fecha.
"""
import pytest
import pandas as pd
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi import Request, Response
from fastapi.testclient import TestClient

from app.api.v1.endpoints.matches import get_matches_by_date
from app.main import app

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "csv"

FECHA = "2026-06-12"


# ---------------------------------------------------------------------------
# Test de integración (contra la app real con TestClient)
# ---------------------------------------------------------------------------

class TestIntegrationMatchesJune12:
    """Test de integración contra el endpoint real."""

    @pytest.fixture
    def client(self):
        """TestClient que levanta la app con lifespan (carga CSVs reales)."""
        with TestClient(app) as c:
            yield c

    def test_korea_match_has_czechia_as_rival(self, client):
        """
        El endpoint /dates/2026-06-12/matches NO debería contener el partido
        de Korea vs Czechia (match 2), ya que ese partido tiene kickoff_at
        '2026-06-11 22:00:00-06' cuya fecha local es 2026-06-11.

        Si aparece, es un bug de filtrado de fecha.
        Si aparece con 'UEPD' como rival, los datos de teams están desactualizados.
        """
        resp = client.get("/api/v1/matches/dates/2026-06-12/matches")
        assert resp.status_code == 200

        data = resp.json()["data"]

        # Buscar si hay un partido de Korea en esta fecha
        korea_match = None
        for match in data:
            if match["home"]["code"] == "KOR" or match["away"]["code"] == "KOR":
                korea_match = match
                break

        # Match 2 (Korea) NO debería estar en 2026-06-12
        # porque su kickoff_at local es 2026-06-11
        assert korea_match is None, (
            f"Match de Korea apareció en fecha 2026-06-12 pero su kickoff local es 2026-06-11. "
            f"Rival mostrado: {korea_match['away'] if korea_match else 'N/A'}. "
            f"Esto indica un bug en el filtrado por fecha del endpoint."
        )

    def test_matches_on_june_12_are_correct(self, client):
        """
        En 2026-06-12 solo deberían estar:
        - Match 3: Canada vs Bosnia and Herzegovina (kickoff 2026-06-12 15:00-04)
        - Match 4: United States vs Paraguay (kickoff 2026-06-12 21:00-07)
        """
        resp = client.get("/api/v1/matches/dates/2026-06-12/matches")
        assert resp.status_code == 200

        data = resp.json()["data"]
        match_numbers = sorted([m["match_number"] for m in data])

        assert match_numbers == [3, 4], (
            f"Se esperaban matches [3, 4] en 2026-06-12 pero se obtuvieron {match_numbers}"
        )

    def test_match3_away_team_is_not_placeholder(self, client):
        """
        Match 3 away (team_id=6) debe ser Bosnia and Herzegovina (BIH),
        NO un placeholder como 'Winner UEFA Playoff A'.
        """
        resp = client.get("/api/v1/matches/dates/2026-06-12/matches")
        data = resp.json()["data"]

        match3 = next((m for m in data if m["match_number"] == 3), None)
        assert match3 is not None, "Match 3 no encontrado en la respuesta"

        away = match3["away"]
        assert away["code"] != "UEPA", (
            f"Match 3 away team es un placeholder '{away['name']}' ({away['code']}). "
            f"Debería ser Bosnia and Herzegovina (BIH). "
            f"El CSV world_cup_teams.csv tiene datos desactualizados en el servidor."
        )
        assert away["code"] == "BIH"
        assert away["name"] == "Bosnia and Herzegovina"


# ---------------------------------------------------------------------------
# Test unitario (con datos cargados directamente del CSV)
# ---------------------------------------------------------------------------

class TestUnitMatchesJune11KoreaRival:
    """
    Test unitario: Korea vs Czechia está en 2026-06-11.
    Confirma que con los CSVs actuales, el rival es Czechia.
    """

    @pytest.fixture
    def request_response(self):
        data = {
            "world_cup_matches": pd.read_csv(DATA_DIR / "world_cup_matches.csv"),
            "world_cup_teams": pd.read_csv(DATA_DIR / "world_cup_teams.csv").set_index("id"),
            "stadium_mapping": pd.read_csv(DATA_DIR / "stadium_mapping.csv").set_index("stadium_id"),
            "stadiums_geo": pd.read_csv(DATA_DIR / "world_cup_stadiums.csv").set_index("ID"),
        }
        request = MagicMock(spec=Request)
        request.app.state.data = data
        request.base_url = "http://testserver/"
        response = MagicMock(spec=Response)
        response.headers = {}
        return request, response

    @patch("app.api.v1.endpoints.matches.get_venue_geoclimatic_info", return_value=None)
    def test_korea_rival_is_czechia_on_june_11(self, mock_geo, request_response):
        """Con los CSVs actuales, Korea vs Czechia está en 2026-06-11."""
        request, response = request_response
        result = get_matches_by_date(request, response, "2026-06-11")

        korea_match = next(
            (m for m in result["data"]
             if m["home"]["code"] == "KOR" or m["away"]["code"] == "KOR"),
            None
        )
        assert korea_match is not None, "No se encontró partido de Korea en 2026-06-11"

        rival = korea_match["away"] if korea_match["home"]["code"] == "KOR" else korea_match["home"]
        assert rival["code"] == "CZE", (
            f"Rival de Korea debería ser CZE pero es '{rival['code']}' ({rival['name']})"
        )
        assert rival["name"] == "Czechia"

    @patch("app.api.v1.endpoints.matches.get_venue_geoclimatic_info", return_value=None)
    def test_korea_match_not_in_june_12(self, mock_geo, request_response):
        """Match 2 (Korea) NO debe aparecer en 2026-06-12 (su fecha local es 2026-06-11)."""
        request, response = request_response
        result = get_matches_by_date(request, response, "2026-06-12")

        korea_match = next(
            (m for m in result["data"]
             if m["home"]["code"] == "KOR" or m["away"]["code"] == "KOR"),
            None
        )
        assert korea_match is None, (
            "El partido de Korea (kickoff 2026-06-11 22:00-06) no debería "
            "aparecer en la fecha 2026-06-12. Bug de filtrado por fecha."
        )
