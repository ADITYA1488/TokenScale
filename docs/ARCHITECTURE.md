# TokenScale — Architecture Notes

## 1. Architectural Overview

TokenScale follows a modular architecture that separates data processing, forecasting, diagnostics, optimization, validation, simulation, and presentation.

The main execution path is:

```text
Historical Data
      |
      v
Data Processing
      |
      v
Feature Engineering
      |
      +-------------------+
      |                   |
      v                   v
Forecasting          Diagnostics
      |                   |
      +---------+---------+
                |
                v
         Optimization
                |
                v
           Validation
                |
          +-----+-----+
          |           |
        Valid       Invalid
          |           |
          v           v
      Simulation   Explanation
          |
          v
      Explanation
          |
          v
       API Layer
          |
          v
    React Dashboard
```

## 2. Module Responsibilities

### Data Layer

Responsible for loading and preparing historical inference, GPU, and CPU telemetry.

### Forecasting Layer

Compares forecasting methods and provides the selected next-observation throughput prediction.

### Diagnostics Layer

Calculates latency-based diagnostic scores and generates server recommendations.

### Optimization Layer

Uses linear programming to determine allocation quantities under capacity and per-server constraints.

### Validation Layer

Checks allocation feasibility before simulation.

### Simulation Layer

Calculates hypothetical throughput outcomes from baseline throughput, allocated units, and configured gain assumptions.

### Agent Layer

Uses LangGraph to coordinate the diagnostic, forecasting, optimization, validation, simulation, and explanation nodes.

### API Layer

FastAPI exposes telemetry, forecasting, health, and optimization endpoints.

### Frontend Layer

React provides the interactive dashboard and presents the outputs of the backend workflow.

## 3. Decision Flow

1. Load server telemetry and prepared optimization inputs.
2. Generate server diagnosis and forecasting results.
3. Select eligible servers.
4. Calculate risk-adjusted allocation scores.
5. Solve the constrained allocation problem.
6. Validate the resulting allocation.
7. Run simulation only if validation succeeds.
8. Generate an explanation report.
9. Return results through the API.

## 4. Design Principles

- Separate numerical decision logic from workflow orchestration.
- Preserve missing telemetry rather than treating it as zero.
- Use chronological evaluation for forecasting.
- Validate optimization outputs before simulation.
- Separate observed measurements from hypothetical results.
- Keep the current execution mode advisory and simulation-only.

## 5. Current System Boundary

The current implementation consumes prepared historical CSV data. It does not directly manage a serving engine, provision GPUs, change batching policies, or modify KV-cache allocation.

A future serving-engine integration can be developed independently without replacing the current decision pipeline.