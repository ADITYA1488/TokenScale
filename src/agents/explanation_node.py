def explanation_node(state):
    lines = [
        "TokenScale Infrastructure Decision Report",
        "=" * 42,
        "",
        "Server Diagnosis:"
    ]

    for item in state.get("diagnosis", []):
        lines.append(
            f"- {item['server_id']}: {item['recommended_action']}"
        )

    lines.extend(["", "Throughput Forecasts:"])

    for item in state.get("forecasts", []):
        lines.append(
            f"- {item['server_id']}: "
            f"{item['predicted_next_throughput']} tokens/s "
            f"({item['forecast_method']})"
        )

    lines.extend([
        "",
        "Resource Allocation:",
        str(state.get("allocations", {})),
        "",
        "Validation:",
        str(state.get("validation", {}))
    ])

    if state.get("validation", {}).get("valid", False):
        lines.extend(["", "Simulation Results:"])

        for item in state.get("simulation_results", []):
            lines.append(
                f"- {item['server_id']}: "
                f"{item['baseline_throughput']} -> "
                f"{item['simulated_throughput']} tokens/s "
                f"(simulated gain: {item['simulated_gain']})"
            )
    else:
        lines.extend([
            "",
            "Simulation skipped: allocation validation failed.",
            str(state.get("validation", {}).get("errors", []))
        ])

    lines.extend([
        "",
        "Note: Throughput improvements are hypothetical "
        "and depend on configured gain assumptions."
    ])

    return {"explanation": "\n".join(lines)}
