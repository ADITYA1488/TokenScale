
from pathlib import Path
import pandas as pd

from src.agents.workflow import build_tokenscale_graph


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "outputs"

tokenscale_graph = build_tokenscale_graph()


def run_optimization(capacity_budget: float, max_units_per_server: float):
    decisions_path = OUTPUT_DIR / "unified_server_decisions.csv"
    optimization_path = OUTPUT_DIR / "optimization_input.csv"

    if not decisions_path.exists() or not optimization_path.exists():
        raise FileNotFoundError("Required optimization input CSV files are missing.")

    servers = pd.read_csv(decisions_path).to_dict("records")
    optimization_servers = pd.read_csv(optimization_path).to_dict("records")

    initial_state = {
        "servers": servers,
        "optimization_servers": optimization_servers,
        "capacity_budget": capacity_budget,
        "max_units_per_server": max_units_per_server,
        "errors": []
    }

    return tokenscale_graph.invoke(initial_state)


def load_telemetry():
    files = {
        "inference": PROJECT_ROOT / "data" / "raw" / "sglang_history.csv",
        "gpu": PROJECT_ROOT / "data" / "raw" / "gpu_history.csv",
        "cpu": PROJECT_ROOT / "data" / "raw" / "cpu_history.csv",
    }

    selected_columns = {
        "inference": [
            "ts", "server_id", "gen_throughput",
            "running", "queued", "ttft_avg_s",
            "e2e_latency_avg_s", "token_usage",
            "cache_hit_rate"
        ],
        "gpu": [
            "ts", "node_id", "gpu_id",
            "utilization_pct", "memory_pct",
            "memory_util_pct", "power_w"
        ],
        "cpu": [
            "ts", "node_id", "cpu_util_pct",
            "mem_used_mb", "mem_total_mb",
            "mem_available_mb"
        ]
    }

    telemetry = {}

    for name, path in files.items():
        if not path.exists():
            raise FileNotFoundError(f"Telemetry file not found: {path}")

        df = pd.read_csv(path)
        columns = [col for col in selected_columns[name] if col in df.columns]
        df = df[columns].copy()

        if "ts" in df.columns:
            df["ts"] = pd.to_datetime(
                df["ts"], unit="ms", utc=True
            ).dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        df = df.astype(object).where(pd.notna(df), None)
        telemetry[name] = df.to_dict(orient="records")

    return telemetry


def load_forecasts():
    decisions_path = OUTPUT_DIR / "unified_server_decisions.csv"

    if not decisions_path.exists():
        raise FileNotFoundError("Forecasting data file is missing.")

    df = pd.read_csv(decisions_path)

    required_columns = [
        "server_id",
        "gen_throughput",
        "predicted_next_throughput",
        "forecast_method"
    ]

    missing = [col for col in required_columns if col not in df.columns]

    if missing:
        raise ValueError(f"Missing forecasting columns: {missing}")

    df = df[required_columns].copy()
    df = df.astype(object).where(pd.notna(df), None)

    return df.to_dict(orient="records")
