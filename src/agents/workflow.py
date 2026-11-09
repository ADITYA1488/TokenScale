from langgraph.graph import StateGraph, START, END

from src.agents.workflow_state import TokenScaleState
from src.agents.diagnosis_node import diagnosis_node
from src.agents.forecasting_node import forecasting_node
from src.agents.optimization_node import optimization_node
from src.agents.validation_node import validation_node
from src.agents.simulation_node import simulation_node
from src.agents.explanation_node import explanation_node


def route_after_validation(state):
    if state["validation"]["valid"]:
        return "simulation"
    return "explanation"


def build_tokenscale_graph():
    graph = StateGraph(TokenScaleState)

    graph.add_node("diagnosis", diagnosis_node)
    graph.add_node("forecasting", forecasting_node)
    graph.add_node("optimization", optimization_node)
    graph.add_node("validation", validation_node)
    graph.add_node("simulation", simulation_node)
    graph.add_node("explanation", explanation_node)

    graph.add_edge(START, "diagnosis")
    graph.add_edge("diagnosis", "forecasting")
    graph.add_edge("forecasting", "optimization")
    graph.add_edge("optimization", "validation")

    graph.add_conditional_edges(
        "validation",
        route_after_validation,
        {
            "simulation": "simulation",
            "explanation": "explanation"
        }
    )

    graph.add_edge("simulation", "explanation")
    graph.add_edge("explanation", END)

    return graph.compile()
