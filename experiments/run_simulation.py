from pathlib import Path
import json
import pandas as pd
from datetime import datetime, timezone

from src.simulation.simulator import compare_scenarios
from src.optimization.optimizer import optimize_allocation


def run_experiment(
    servers,
    capacity_budget,
    max_units_per_server,
    output_path="outputs/simulation_results.csv"
):
    optimization = optimize_allocation(
        servers,
        capacity_budget,
        max_units_per_server
    )

    results = compare_scenarios(
        servers,
        optimization["allocations"],
        capacity_budget,
        max_units_per_server
    )

    df = pd.DataFrame(results)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output, index=False)

    metadata = {
        "experiment_timestamp": datetime.now(timezone.utc).isoformat(),
        "capacity_budget": capacity_budget,
        "max_units_per_server": max_units_per_server,
        "allocation_method": "risk_aware_linear_optimization",
        "gain_assumption": {
            server["server_id"]: server["simulated_gain_per_unit"]
            for server in servers
        },
        "allocations": optimization["allocations"],
        "unused_capacity": optimization["unused_capacity"],
        "simulation_type": "hypothetical"
    }

    metadata_path = output.with_name("simulation_metadata.json")
    metadata_path.write_text(json.dumps(metadata, indent=4))

    return optimization, df, metadata
