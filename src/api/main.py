
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.api.service import run_optimization, load_telemetry, load_forecasts

app = FastAPI(
    title="TokenScale API",
    description="Memory-aware predictive LLM infrastructure optimizer",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OptimizationRequest(BaseModel):
    capacity_budget: float = Field(default=10, gt=0)
    max_units_per_server: float = Field(default=4, gt=0)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "TokenScale"}


@app.get("/telemetry")
def get_telemetry():
    try:
        return load_telemetry()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/forecasts")
def get_forecasts():
    try:
        return load_forecasts()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/optimize")
def optimize(request: OptimizationRequest):
    try:
        result = run_optimization(
            capacity_budget=request.capacity_budget,
            max_units_per_server=request.max_units_per_server
        )

        return {
            "diagnosis": result.get("diagnosis", []),
            "forecasts": result.get("forecasts", []),
            "allocations": result.get("allocations", {}),
            "validation": result.get("validation", {}),
            "simulation_results": result.get("simulation_results", []),
            "explanation": result.get("explanation", "")
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
