"""Pruebas de integración de la API REST v2 del dashboard."""

from urllib.parse import quote


class TestDashboardAPIv2:
    """Flujo progresivo fecha → partido → jugador → pronóstico."""

    def test_list_match_dates(self, api_client):
        response = api_client.get("/api/v2/match-dates")
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["data"]) > 0
        first_date = payload["data"][0]
        assert "id" in first_date
        assert "match_count" in first_date
        assert "matches" not in first_date

    def test_list_matches_by_date(self, api_client):
        dates_response = api_client.get("/api/v2/match-dates")
        kickoff_date = dates_response.json()["data"][0]["id"]

        response = api_client.get(f"/api/v2/match-dates/{kickoff_date}/matches")
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["data"]) > 0
        assert "match_number" in payload["data"][0]
        assert "kickoff_at" in payload["data"][0]

    def test_list_matches_by_invalid_date(self, api_client):
        response = api_client.get("/api/v2/match-dates/2099-01-01/matches")
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "match_date_not_found"

    def test_list_players_for_match(self, api_client):
        response = api_client.get("/api/v2/matches/1/players")
        assert response.status_code == 200
        payload = response.json()
        assert payload["meta"]["match_number"] == 1
        assert len(payload["data"]) > 0

    def test_list_players_for_match_with_query(self, api_client):
        all_players_response = api_client.get("/api/v2/matches/1/players")
        sample_name = all_players_response.json()["data"][0]["name"]
        query_fragment = sample_name.split()[-1]

        response = api_client.get(
            "/api/v2/matches/1/players",
            params={"q": query_fragment},
        )
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["data"]) >= 1
        assert any(query_fragment.lower() in player["name"].lower() for player in payload["data"])

    def test_list_players_for_invalid_match(self, api_client):
        response = api_client.get("/api/v2/matches/99999/players")
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "match_not_found"

    def test_readiness_report_success(self, api_client):
        players_response = api_client.get("/api/v2/matches/1/players")
        player_name = players_response.json()["data"][0]["name"]

        response = api_client.get(
            f"/api/v2/matches/1/players/{quote(player_name, safe='')}/readiness-report",
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["data"]["player"]["name"] == player_name
        assert "ai_inference" in payload["data"]

    def test_readiness_report_player_not_in_match(self, api_client):
        response = api_client.get(
            "/api/v2/matches/1/players/Jugador%20Inexistente/readiness-report",
        )
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "player_not_found"
