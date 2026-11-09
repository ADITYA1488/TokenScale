import pytest

from src.simulation.simulator import compare_scenarios


def test_valid_allocation_runs_simulation():
    servers = [{
        "server_id": "server-a",
        "baseline_throughput": 100,
        "simulated_gain_per_unit": 0.05
    }]

    result = compare_scenarios(
        servers,
        {"server-a": 2},
        capacity_budget=10,
        max_units_per_server=4
    )

    assert result[0]["simulated_throughput"] == pytest.approx(110)


def test_invalid_allocation_is_rejected():
    servers = [{
        "server_id": "server-a",
        "baseline_throughput": 100,
        "simulated_gain_per_unit": 0.05
    }]

    with pytest.raises(ValueError):
        compare_scenarios(
            servers,
            {"server-a": 6},
            capacity_budget=10,
            max_units_per_server=4
        )
