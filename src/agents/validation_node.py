from src.optimization.validator import validate_allocations


def validation_node(state):
    result = validate_allocations(
        allocations=state["allocations"],
        capacity_budget=state["capacity_budget"],
        max_units_per_server=state["max_units_per_server"]
    )

    return {"validation": result}
