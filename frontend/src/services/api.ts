
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function fetchJSON(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function checkHealth() {
  return fetchJSON("/health");
}

export async function getTelemetry() {
  return fetchJSON("/telemetry");
}

export async function getForecasts() {
  return fetchJSON("/forecasts");
}

export async function runOptimization(
  capacityBudget: number,
  maxUnitsPerServer: number
) {
  return fetchJSON("/optimize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      capacity_budget: capacityBudget,
      max_units_per_server: maxUnitsPerServer
    })
  });
}
