"""Deterministic, validated orchestration primitives for FlowPilot workflows."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.src.requirement_intelligence import analyze_requirement


@dataclass(frozen=True)
class AgentSpec:
    name: str
    purpose: str
    tools: tuple[str, ...]
    prompt_version: str = "deterministic-v1"
    max_attempts: int = 2


REGISTRY = {
    "requirement": AgentSpec("requirement", "Extract requirement gaps and acceptance signals.", ("read_requirement", "save_result")),
    "risk": AgentSpec("risk", "Identify failure, security, and duplicate-submission risks.", ("read_requirement", "save_result"), prompt_version="deterministic-risk-v2"),
    "review": AgentSpec("review", "Review readiness and block human approval when gaps remain.", ("read_requirement", "read_result", "save_result")),
}


def plan(requirement: str) -> list[dict[str, Any]]:
    return [
        {"agent": "requirement", "goal": REGISTRY["requirement"].purpose, "depends_on": []},
        {"agent": "risk", "goal": REGISTRY["risk"].purpose, "depends_on": ["requirement"]},
        {"agent": "review", "goal": REGISTRY["review"].purpose, "depends_on": ["requirement", "risk"], "approval_required": True},
    ]


def execute(agent: str, context: dict[str, Any]) -> dict[str, Any]:
    if agent not in REGISTRY:
        raise ValueError("Unknown agent")
    requirement = context["requirement"]
    if agent == "requirement":
        result = analyze_requirement(requirement)
        if not result["dimensions"]:
            raise ValueError("Requirement analysis returned no dimensions")
        return result
    if agent == "risk":
        lower = requirement.lower()
        risks = []
        for term, label, severity, mitigation in (
            ("password", "Password", "High", "Define expiry, reuse, and audit controls."),
            ("payment", "Payment", "High", "Protect authorization and duplicate charges."),
            ("permission", "Permission", "High", "Enforce least privilege, audit role changes, and test unauthorized access."),
            ("file", "Secure file upload", "High", "Validate type and size, isolate malware findings, store files securely, and audit access."),
            ("delete", "Delete", "Medium", "Define confirmation and recovery behaviour."),
            ("retry", "Retry", "Medium", "Define idempotency and timeout handling."),
        ):
            if term in lower:
                risks.append({"risk": label + " flow needs explicit controls", "severity": severity, "mitigation": mitigation})
        return {"risks": risks, "status": "Needs review" if risks else "No specific risk signals detected"}
    intelligence = context.get("results", {}).get("requirement", {})
    missing = [item["dimension"] for item in intelligence.get("dimensions", []) if item.get("status") != "Good"]
    return {"findings": missing, "status": "Needs human review" if missing else "Ready for approval"}
