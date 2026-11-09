# TokenScale
### Memory-Aware Predictive LLM Infrastructure Optimizer

TokenScale is an experimental LLM infrastructure optimization platform that analyzes inference telemetry, forecasts short-term throughput, identifies potential resource bottlenecks, and recommends capacity allocation decisions using constrained optimization.

It combines telemetry analytics, machine learning experiments, diagnostic heuristics, linear programming, simulation, and workflow orchestration in a unified dashboard.

> **Project status:** Functional simulation-based MVP. TokenScale currently analyzes historical telemetry and evaluates hypothetical allocation decisions. It does not directly control production GPU infrastructure.

---

## 1. Problem Statement

LLM inference infrastructure must balance throughput, latency, GPU memory utilization, and available compute capacity.

Traditional resource allocation approaches may not adequately account for:

- Variations in inference workload.
- Queue and request behaviour.
- GPU utilization and VRAM occupancy.
- Time-to-first-token (TTFT).
- End-to-end inference latency.
- Different resource requirements across inference servers.

TokenScale explores a telemetry-driven approach to infrastructure decision support.

## 2. Objectives

- Collect and analyze inference, GPU, and CPU telemetry.
- Engineer features relevant to LLM inference performance.
- Forecast the next observed throughput for inference servers.
- Identify potential latency and resource risks.
- Allocate a limited capacity budget using linear programming.
- Validate allocation decisions against configured constraints.
- Simulate hypothetical throughput outcomes.
- Present results through an interactive dashboard.

## 3. System Architecture

```text
              HISTORICAL TELEMETRY
                       |
          +------------+------------+
          |            |            |
       Inference       GPU          CPU
       Metrics       Metrics      Metrics
          |            |            |
          +------------+------------+
                       |
               DATA PROCESSING
                       |
               FEATURE ENGINEERING
                       |
          +------------+-------------+
          |            |             |
      Forecasting   Diagnostics   Resource
       Pipeline      Engine       Analysis
          |            |             |
          +------------+-------------+
                       |
               OPTIMIZATION ENGINE
                       |
                Linear Programming
                       |
              ALLOCATION VALIDATION
                       |
                 SIMULATION
                       |
                LANGGRAPH WORKFLOW
                       |
                 FASTAPI BACKEND
                       |
              REACT DASHBOARD
```

## 4. Technology Stack

| Component | Technologies |
|---|---|
| Programming | Python, TypeScript |
| Data processing | Pandas, NumPy |
| Machine learning | Scikit-learn, XGBoost |
| Optimization | SciPy Linear Programming |
| Workflow orchestration | LangGraph |
| Backend | FastAPI, Pydantic |
| Frontend | React, TypeScript, Vite |
| Visualization | ECharts |
| Styling | Tailwind CSS / project CSS |
| Telemetry source | FreeInference / OpenInfra |

## 5. Core Modules

### A. Telemetry Collection and Processing

TokenScale uses historical inference infrastructure telemetry containing:

- Inference throughput.
- Running and queued requests.
- TTFT and end-to-end latency.
- Token usage and cache hit rate.
- GPU compute utilization.
- GPU VRAM occupancy.
- GPU memory bandwidth utilization.
- GPU power consumption.
- CPU utilization and memory usage.

The collected telemetry is stored as CSV files and processed into aligned feature datasets.

Missing measurements are preserved as missing values rather than automatically interpreted as zero.

### B. Feature Engineering

Engineered features include:

- Average total tokens.
- Queue-to-running-request ratio.
- KV/token cache usage ratio.
- Rolling throughput measurements.
- Previous-observation performance metrics.
- GPU and CPU resource indicators.
- Memory and compute utilization differences.

Historical GPU and CPU measurements are aligned with inference observations using backward timestamp matching.

### C. Throughput Forecasting

The forecasting experiment compares:

1. Persistence forecasting.
2. Rolling-average forecasting.
3. XGBoost regression.

A chronological per-server train/validation/test split is used to reduce temporal leakage.

The forecasting target is the next available telemetry observation.

Persistence was selected based on the available validation results. XGBoost did not outperform the simpler baseline in the collected sample.

### D. Diagnostic Engine

The diagnostic engine uses latency violation measurements to calculate a prioritization score:

\[
D = 0.5V_{TTFT} + 0.5V_{E2E}
\]

Where:

- \(V_{TTFT}\) represents TTFT violation percentage.
- \(V_{E2E}\) represents end-to-end latency violation percentage.

The resulting score is used to generate diagnostic recommendations.

Inactive inference workloads are handled separately.

Memory warnings are maintained as a separate risk indicator.

### E. Constrained Optimization

The allocation engine uses SciPy's `linprog` implementation.

The objective maximizes risk-adjusted throughput gain:

\[
\max \sum_i x_i
\frac{T_iG_i}{1+R_i/100}
\]

Where:

- \(x_i\): allocation assigned to server \(i\).
- \(T_i\): baseline throughput.
- \(G_i\): configured simulated gain per allocation unit.
- \(R_i\): combined diagnostic and memory risk score.

Subject to:

\[
\sum_i x_i \leq C
\]

\[
0 \leq x_i \leq X_{\max}
\]

Where:

- \(C\): total capacity budget.
- \(X_{\max}\): maximum allocation per server.

Servers must satisfy the configured SLO eligibility condition and have positive baseline throughput.

High VRAM occupancy is treated as a risk penalty rather than an automatic exclusion in the current optimizer.

### F. Allocation Validation

The validation module checks:

- Total allocation against the capacity budget.
- Non-negative allocation values.
- Maximum allocation per server.
- Invalid and non-finite allocation values.

Invalid allocation decisions are prevented from proceeding through the simulation workflow.

### G. Simulation Engine

The simulation estimates throughput using:

\[
T_{sim}=T_{base}(1+Gx)
\]

Where:

- \(T_{sim}\): simulated throughput.
- \(T_{base}\): baseline throughput.
- \(G\): configured gain per allocation unit.
- \(x\): allocated units.

The gain parameter is an experimental assumption, not a measured infrastructure response.

### H. LangGraph Workflow

LangGraph coordinates the decision pipeline:

```text
START
  |
Diagnosis
  |
Forecasting
  |
Optimization
  |
Validation
  |
  +---- Invalid ----> Explanation
  |
 Valid
  |
Simulation
  |
Explanation
  |
 END
```

The workflow separates numerical decision logic from the final explanation and coordinates the execution of the individual modules.

## 6. Dashboard

The React dashboard provides seven sections:

| Section | Purpose |
|---|---|
| Command Center | Infrastructure overview and key metrics |
| Telemetry | Historical inference, GPU, and CPU measurements |
| Forecasting | Observed versus predicted throughput |
| Diagnostics | Server-level diagnostic recommendations |
| Optimizer | Capacity configuration and allocation |
| Simulation | Hypothetical scenario results |
| Experiments | Methodology, assumptions, and limitations |

## 7. Example Optimization Result

An example run using a capacity budget of 10 units and a maximum of 4 units per server produced:

| Server | Allocated Units | Simulated Throughput |
|---|---:|---:|
| rtx6000b-qwen36 | 4 | 365.4 tokens/s |
| rtx6000b-bge-m3 | 0 | 0.0 tokens/s |
| h200a-glm53-flash | 2 | 186.67 tokens/s |
| h200a-replica-a | 4 | 307.68 tokens/s |

- Total allocation: 10 units.
- Unused capacity: 0 units.
- Allocation validation: Passed.

The aggregate simulated throughput was approximately 859.75 tokens/s, compared with a baseline of 730.6 tokens/s.

**These are outputs from the configured simulation model, not measured production throughput improvements.**

## 8. Installation and Setup

### Prerequisites

- Python 3.10 or later.
- Node.js and npm.
- Git.

### Clone the repository

```bash
git clone https://github.com/<YOUR_USERNAME>/TokenScale.git
cd TokenScale
```

### Backend setup

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the backend:

```bash
uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

Health endpoint:

```text
http://127.0.0.1:8000/health
```

### Frontend setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

### Required project data

The current backend expects the following files:

```text
data/
├── raw/
│   ├── sglang_history.csv
│   ├── gpu_history.csv
│   └── cpu_history.csv
│
outputs/
├── unified_server_decisions.csv
├── optimization_input.csv
```

The forecasting, telemetry, and optimization endpoints read these prepared datasets.

Ensure the required data and output files are available before starting the dashboard.

## 9. API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend health check |
| GET | `/telemetry` | Retrieve historical telemetry |
| GET | `/forecasts` | Retrieve server-level forecasts |
| POST | `/optimize` | Execute the decision workflow |

Interactive API documentation is available through FastAPI's Swagger interface at `/docs`.

## 10. Experimental Limitations

TokenScale is currently a research and simulation-oriented MVP.

Important limitations:

1. Forecasting uses the next available telemetry observation rather than a long-horizon forecast.
2. Persistence forecasting performed better than the tested XGBoost model on the available sample.
3. The telemetry endpoint serves historical CSV snapshots rather than continuous live streaming.
4. The simulated gain per allocation unit is hypothetical.
5. The optimizer does not directly modify GPU scheduling, batching, or KV-cache allocation in a running inference engine.
6. Diagnostic scores are prioritization heuristics and do not independently prove physical bottlenecks.
7. The current experiments do not establish production-level cost or latency improvements.

## 11. Future Improvements

- Integrate directly with vLLM or SGLang serving metrics.
- Implement live telemetry ingestion.
- Extend forecasting with longer observation windows.
- Evaluate walk-forward forecasting across larger datasets.
- Calibrate simulation gains using controlled experiments.
- Incorporate explicit GPU memory and KV-cache capacity models.
- Explore prefill/decode-aware scheduling.
- Evaluate multi-objective optimization across throughput, latency, and memory.
- Add safe execution interfaces after simulation validation.

## 12. Project Structure

```text
TokenScale/
│
├── data/
│   ├── raw/
│   └── processed/
│
├── src/
│   ├── agents/
│   ├── api/
│   ├── data/
│   ├── forecasting/
│   ├── optimization/
│   └── simulation/
│
├── experiments/
│
├── outputs/
│
├── frontend/
│
├── requirements.txt
├── README.md
└── .gitignore
```

## 13. Author

**Add your name and GitHub profile here.**

Project: TokenScale — Memory-Aware Predictive LLM Infrastructure Optimizer.

---

*Built as an experimental exploration of predictive analytics, constrained optimization, and resource-aware LLM inference infrastructure.*
