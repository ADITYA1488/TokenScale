from src.optimization.validator import validate_allocations


def simulate_throughput(
    baseline_throughput,
    allocated_units,
    gain_per_unit
):
    return baseline_throughput * (
        1 + gain_per_unit * allocated_units
    )


def compare_scenarios(
    servers,
    allocations,
    capacity_budget,
    max_units_per_server
):
    validation = validate_allocations(
        allocations,
        capacity_budget,
        max_units_per_server
    )

    if not validation["valid"]:
        raise ValueError(
            f"Invalid allocation: {validation['errors']}"
        )

    results = []

    for server in servers:
        server_id = server["server_id"]
        units = allocations.get(server_id, 0)
        baseline = server["baseline_throughput"]

        simulated = simulate_throughput(
            baseline,
            units,
            server["simulated_gain_per_unit"]
        )

        results.append({
            "server_id": server_id,
            "allocated_units": units,
            "baseline_throughput": baseline,
            "simulated_throughput": simulated,
            "simulated_gain": simulated - baseline
        })

    return results
