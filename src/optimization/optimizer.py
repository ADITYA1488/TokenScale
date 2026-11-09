
from scipy.optimize import linprog
import numpy as np


def optimize_allocation(
    servers,
    capacity_budget,
    max_units_per_server
):
    eligible = [
        server for server in servers
        if server.get("slo_status", False)
        and server.get("baseline_throughput", 0) > 0
    ]

    if not eligible:
        return {
            "success": True,
            "allocations": {},
            "unused_capacity": capacity_budget
        }

    scores = []

    for server in eligible:
        baseline = float(server["baseline_throughput"])
        gain = float(server["simulated_gain_per_unit"])
        diagnostic_risk = float(server.get("diagnostic_score", 0) or 0)
        memory_risk = float(server.get("memory_warning", 0) or 0)

        total_risk = diagnostic_risk + memory_risk

        score = (
            baseline * gain
            / (1 + total_risk / 100)
        )

        scores.append(score)

    scores = np.array(scores, dtype=float)

    result = linprog(
        c=-scores,
        A_ub=[np.ones(len(eligible))],
        b_ub=[capacity_budget],
        bounds=[(0, max_units_per_server)] * len(eligible),
        method="highs"
    )

    if not result.success:
        raise RuntimeError(result.message)

    allocations = {
        server["server_id"]: float(units)
        for server, units in zip(eligible, result.x)
    }

    return {
        "success": True,
        "allocations": allocations,
        "unused_capacity": float(
            capacity_budget - result.x.sum()
        )
    }
