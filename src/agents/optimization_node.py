from src.optimization.optimizer import optimize_allocation


def optimization_node(state):
    result = optimize_allocation(
        servers=state["optimization_servers"],
        capacity_budget=state["capacity_budget"],
        max_units_per_server=state["max_units_per_server"]
    )

    return {
        "allocations": result["allocations"],
        "optimization_result": result
    }
