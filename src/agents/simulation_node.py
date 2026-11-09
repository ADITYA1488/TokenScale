from src.simulation.simulator import compare_scenarios


def simulation_node(state):
    if not state["validation"]["valid"]:
        raise ValueError(
            "Simulation blocked: allocation validation failed."
        )

    results = compare_scenarios(
        servers=state["optimization_servers"],
        allocations=state["allocations"],
        capacity_budget=state["capacity_budget"],
        max_units_per_server=state["max_units_per_server"]
    )

    return {"simulation_results": results}
