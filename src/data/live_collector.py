
import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATABASE_PATH = PROJECT_ROOT / "data" / "live" / "tokenscale_live.db"

DASHBOARD_URL = "https://openinfra.freeinference.org/api/dashboard"
HISTORY_URL = "https://openinfra.freeinference.org/api/history?hours=2"

POLL_INTERVAL_SECONDS = 60
REQUEST_TIMEOUT = (5, 20)
MAX_RETRIES = 3
FRESHNESS_LIMIT_SECONDS = 300

METRIC_IDENTITIES = {
    "sglang": "server_id",
    "gpu": "gpu_id",
    "cpu": "node_id",
}


def utc_now():
    return datetime.now(timezone.utc)


def timestamp_to_datetime(timestamp_ms):
    return datetime.fromtimestamp(
        timestamp_ms / 1000,
        tz=timezone.utc
    )


def fetch_json(session, url):
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            response = session.get(
                url,
                timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()

            data = response.json()

            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object.")

            return data

        except (requests.RequestException, ValueError) as exc:
            last_error = exc

            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)

    raise RuntimeError(
        f"Failed to fetch {url}: {last_error}"
    )


def validate_history(history):
    if not isinstance(history, dict):
        raise ValueError("Invalid history response.")

    required_groups = ["sglang", "gpu", "cpu"]

    for group in required_groups:
        records = history.get(group)

        if not isinstance(records, list) or not records:
            raise ValueError(
                f"Missing or empty telemetry group: {group}"
            )

        identity_field = METRIC_IDENTITIES[group]

        for record in records:
            if not isinstance(record, dict):
                raise ValueError(
                    f"Invalid record in {group}."
                )

            if not record.get(identity_field):
                raise ValueError(
                    f"Missing {identity_field} in {group} record."
                )

            timestamp = record.get("ts")

            if not isinstance(timestamp, (int, float)):
                raise ValueError(
                    f"Invalid timestamp in {group} record."
                )

            if timestamp <= 0:
                raise ValueError(
                    f"Non-positive timestamp in {group} record."
                )

    if not isinstance(history.get("generated_at"), (int, float)):
        raise ValueError("Missing history generation timestamp.")


def initialize_database(connection):
    connection.execute("""
        CREATE TABLE IF NOT EXISTS telemetry_records (
            metric_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            payload TEXT NOT NULL,
            source_generated_at INTEGER NOT NULL,
            fetched_at TEXT NOT NULL,

            PRIMARY KEY (
                metric_type,
                entity_id,
                timestamp_ms
            )
        )
    """)

    connection.execute("""
        CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp
        ON telemetry_records(timestamp_ms)
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS dashboard_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            generated_at INTEGER NOT NULL,
            fetched_at TEXT NOT NULL,
            from_cache INTEGER NOT NULL,
            payload TEXT NOT NULL
        )
    """)

    connection.commit()


def store_history(connection, history, fetched_at):
    generated_at = int(history["generated_at"])
    inserted_counts = {}

    for group, identity_field in METRIC_IDENTITIES.items():
        records = history[group]
        inserted = 0

        for record in records:
            entity_id = str(record[identity_field])
            timestamp_ms = int(record["ts"])

            payload = json.dumps(
                record,
                separators=(",", ":"),
                allow_nan=False
            )

            cursor = connection.execute("""
                INSERT OR IGNORE INTO telemetry_records (
                    metric_type,
                    entity_id,
                    timestamp_ms,
                    payload,
                    source_generated_at,
                    fetched_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                group,
                entity_id,
                timestamp_ms,
                payload,
                generated_at,
                fetched_at
            ))

            inserted += cursor.rowcount

        inserted_counts[group] = inserted

    return inserted_counts


def store_dashboard_snapshot(connection, dashboard, fetched_at):
    generated_at = dashboard.get("generated_at")

    if not isinstance(generated_at, (int, float)):
        raise ValueError("Dashboard timestamp is missing.")

    payload = json.dumps(
        dashboard,
        separators=(",", ":"),
        allow_nan=False
    )

    connection.execute("""
        INSERT INTO dashboard_snapshots (
            generated_at,
            fetched_at,
            from_cache,
            payload
        )
        VALUES (?, ?, ?, ?)
    """, (
        int(generated_at),
        fetched_at,
        int(bool(dashboard.get("from_cache", False))),
        payload
    ))


def get_latest_timestamps(connection):
    results = {}

    for group in METRIC_IDENTITIES:
        row = connection.execute("""
            SELECT MAX(timestamp_ms)
            FROM telemetry_records
            WHERE metric_type = ?
        """, (group,)).fetchone()

        results[group] = row[0]

    return results


def collect_once():
    fetched_at = utc_now().isoformat()

    with requests.Session() as session:
        dashboard = fetch_json(session, DASHBOARD_URL)
        history = fetch_json(session, HISTORY_URL)

    validate_history(history)

    with sqlite3.connect(DATABASE_PATH) as connection:
        initialize_database(connection)

        with connection:
            inserted = store_history(
                connection,
                history,
                fetched_at
            )

            store_dashboard_snapshot(
                connection,
                dashboard,
                fetched_at
            )

        latest = get_latest_timestamps(connection)

    now = utc_now()

    print("\n========== TokenScale Live Collector ==========")
    print("Fetched at:", fetched_at)
    print("Fleet status:", dashboard.get("fleet"))
    print("History cache:", history.get("from_cache"))
    print("History grain:", history.get("grain_ms"), "ms")

    for group, count in inserted.items():
        latest_timestamp = latest[group]

        if latest_timestamp is None:
            print(f"{group}: NO DATA")
            continue

        age = (
            now - timestamp_to_datetime(latest_timestamp)
        ).total_seconds()

        status = (
            "FRESH"
            if 0 <= age <= FRESHNESS_LIMIT_SECONDS
            else "STALE"
        )

        print(
            f"{group}: {count} new records | "
            f"latest age: {age:.1f}s | {status}"
        )

    print("Database:", DATABASE_PATH)
    print("================================================\n")

    return inserted


def run_forever():
    print("Starting TokenScale live telemetry collector.")
    print("Polling interval:", POLL_INTERVAL_SECONDS, "seconds")
    print("Press CTRL+C to stop.\n")

    while True:
        started = time.monotonic()

        try:
            collect_once()

        except Exception as exc:
            print("COLLECTION ERROR:", str(exc))

        elapsed = time.monotonic() - started
        sleep_time = max(
            0,
            POLL_INTERVAL_SECONDS - elapsed
        )

        try:
            time.sleep(sleep_time)

        except KeyboardInterrupt:
            print("\nCollector stopped.")
            break


if __name__ == "__main__":
    try:
        run_forever()
    except KeyboardInterrupt:
        print("\nCollector stopped.")
