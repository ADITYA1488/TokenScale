from pathlib import Path
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_optimization_endpoint():
    response = client.post(
        "/optimize",
        json={
            "capacity_budget": 10,
            "max_units_per_server": 4
        }
    )

    assert response.status_code == 200

    result = response.json()

    assert "allocations" in result
    assert "validation" in result
    assert "simulation_results" in result
    assert result["validation"]["valid"] is True


def test_invalid_capacity():
    response = client.post(
        "/optimize",
        json={
            "capacity_budget": -1,
            "max_units_per_server": 4
        }
    )

    assert response.status_code == 422



def test_missing_input_files(monkeypatch):
    import src.api.service as service

    monkeypatch.setattr(
        service,
        "OUTPUT_DIR",
        Path("/tmp/tokenscale_missing_test")
    )

    try:
        service.run_optimization(10, 4)
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError:
        pass



def test_missing_input_files(monkeypatch):
    import src.api.service as service

    monkeypatch.setattr(
        service,
        "OUTPUT_DIR",
        Path("/tmp/tokenscale_missing_test")
    )

    try:
        service.run_optimization(10, 4)
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError:
        pass



def test_missing_input_files(monkeypatch):
    import src.api.service as service

    monkeypatch.setattr(
        service,
        "OUTPUT_DIR",
        Path("/tmp/tokenscale_missing_test")
    )

    try:
        service.run_optimization(10, 4)
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError:
        pass



def test_missing_input_files(monkeypatch):
    import src.api.service as service

    monkeypatch.setattr(
        service,
        "OUTPUT_DIR",
        Path("/tmp/tokenscale_missing_test")
    )

    try:
        service.run_optimization(10, 4)
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError:
        pass
