from src.optimization.decision_engine import (
    calculate_diagnostic_score,
    recommend_action
)


def diagnosis_node(state):
    diagnosis = []

    for server in state["servers"]:
        score = server.get("diagnostic_score", 0)

        action = recommend_action(
            score,
            server["server_id"]
        )

        diagnosis.append({
            "server_id": server["server_id"],
            "diagnostic_score": score,
            "recommended_action": action,
            "memory_warning": server.get("memory_warning", 0)
        })

    return {"diagnosis": diagnosis}
