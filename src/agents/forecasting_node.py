def forecasting_node(state):
    forecasts = []

    for server in state["servers"]:
        forecasts.append({
            "server_id": server["server_id"],
            "predicted_next_throughput": server[
                "predicted_next_throughput"
            ],
            "forecast_method": server["forecast_method"]
        })

    return {"forecasts": forecasts}
