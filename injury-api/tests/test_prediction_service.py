"""Pruebas de integración del servicio y la API REST."""


class TestInjuryPredictionService:
    """Pruebas del servicio de inferencia (capa de negocio)."""

    def test_predict_known_player_and_match(self, prediction_service):
        result = prediction_service.predict_match_injury_risk(
            player_name="K. De Bruyne",
            match_number=1,
        )

        assert result.player_name == "K. De Bruyne"
        assert result.match.match_number == 1
        assert result.match.venue_name == "Estadio Azteca"
        assert result.injury_risk.risk_level in (0, 1, 2)
        assert result.injury_risk.risk_label in ("healthy", "low_risk", "critical_risk")
        assert result.weather.ambient_temperature_celsius > 0

    def test_match_not_found_raises(self, prediction_service):
        from app.core.exceptions import MatchNotFoundError

        with pytest.raises(MatchNotFoundError):
            prediction_service.predict_match_injury_risk(
                player_name="K. De Bruyne",
                match_number=99999,
            )

    def test_player_not_found_raises(self, prediction_service):
        from app.core.exceptions import PlayerNotFoundError

        with pytest.raises(PlayerNotFoundError):
            prediction_service.predict_match_injury_risk(
                player_name="Jugador Inexistente XYZ",
                match_number=1,
            )


class TestInjuryPredictionAPI:
    """Pruebas del endpoint REST."""

    def test_health_endpoint(self, api_client):
        response = api_client.get("/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ok"
        assert payload["model_ready"] is True

    def test_predict_endpoint_success(self, api_client):
        response = api_client.post(
            "/api/v1/injury-predictions",
            json={"player_name": "K. De Bruyne", "match_number": 1},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["player_name"] == "K. De Bruyne"
        assert payload["match"]["venue_name"] == "Estadio Azteca"
        assert "injury_risk" in payload

    def test_predict_endpoint_match_not_found(self, api_client):
        response = api_client.post(
            "/api/v1/injury-predictions",
            json={"player_name": "K. De Bruyne", "match_number": 99999},
        )
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "match_not_found"

    def test_openapi_docs_available(self, api_client):
        docs_response = api_client.get("/docs")
        assert docs_response.status_code == 200

        openapi_response = api_client.get("/openapi.json")
        assert openapi_response.status_code == 200
        schema = openapi_response.json()
        assert schema["info"]["title"] == "World Cup 2026 Injury Risk API"
        assert "/api/v1/injury-predictions" in schema["paths"]

    def test_root_redirects_to_docs(self, api_client):
        response = api_client.get("/", follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == "/docs"

    def test_players_catalog_endpoint(self, api_client):
        response = api_client.get("/api/v1/players")
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["players"]) > 0
        assert "name" in payload["players"][0]

    def test_match_days_catalog_endpoint(self, api_client):
        response = api_client.get("/api/v1/match-days")
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["match_days"]) > 0
        assert len(payload["match_days"][0]["matches"]) > 0

    def test_dashboard_injury_prediction_get(self, api_client):
        response = api_client.get(
            "/api/v1/injury-predictions",
            params={"player_name": "K. De Bruyne", "match_number": 1},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["data"]["player"]["name"] == "K. De Bruyne"
        assert "ai_inference" in payload["data"]
        assert "class" in payload["data"]["ai_inference"]

    def test_startup_log_endpoint(self, api_client):
        response = api_client.get("/api/v1/startup-log")
        assert response.status_code == 200
        payload = response.json()
        assert payload["total_entries"] > 0
        messages = [entry["message"] for entry in payload["entries"]]
        assert any("MUNDIAL 2026" in message for message in messages)
        assert any("Fixture unificado correctamente" in message for message in messages)
