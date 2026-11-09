
import math


def validate_allocations(
    allocations,
    capacity_budget,
    max_units_per_server
):
    errors = []

    if not math.isfinite(capacity_budget) or capacity_budget < 0:
        errors.append("Invalid capacity budget")

    if not math.isfinite(max_units_per_server) or max_units_per_server < 0:
        errors.append("Invalid per-server allocation limit")

    total_allocated = 0.0

    for server_id, units in allocations.items():
        if not isinstance(units, (int, float)) or not math.isfinite(units):
            errors.append(f"Invalid allocation for {server_id}")
            continue

        total_allocated += units

        if units < 0:
            errors.append(f"Negative allocation for {server_id}")

        if units > max_units_per_server + 1e-9:
            errors.append(f"Per-server limit exceeded for {server_id}")

    if total_allocated > capacity_budget + 1e-9:
        errors.append("Capacity budget exceeded")

    return {
        "valid": len(errors) == 0,
        "total_allocated": total_allocated,
        "unused_capacity": capacity_budget - total_allocated,
        "errors": errors
    }
