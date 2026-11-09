from typing import TypedDict, Any


class TokenScaleState(TypedDict, total=False):
    servers: list[dict[str, Any]]
    optimization_servers: list[dict[str, Any]]
    diagnosis: list[dict[str, Any]]
    forecasts: list[dict[str, Any]]
    allocations: dict[str, float]
    optimization_result: dict[str, Any]
    capacity_budget: float
    max_units_per_server: float
    validation: dict[str, Any]
    simulation_results: list[dict[str, Any]]
    explanation: str
    errors: list[str]
