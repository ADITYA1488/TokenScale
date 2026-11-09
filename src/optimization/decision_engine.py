
def calculate_diagnostic_score(ttft_violation_pct, e2e_violation_pct):
    return (
        0.5 * ttft_violation_pct
        + 0.5 * e2e_violation_pct
    )


def recommend_action(diagnostic_score, server_id):
    if server_id == "rtx6000b-bge-m3":
        return "Investigate inactive inference workload"

    if diagnostic_score >= 10:
        return "Prioritize latency investigation"

    if diagnostic_score >= 3:
        return "Monitor latency and queue behaviour"

    return "Continue monitoring"
