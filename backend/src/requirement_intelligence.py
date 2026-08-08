"""Explainable requirement intelligence used when no external LLM is configured."""
from __future__ import annotations

import re


DIMENSIONS = {
    "clarity": (r"\b(users?|customers?|admins?|system)\b", "Name who performs the action."),
    "business_rules": (r"\b(must|only|cannot|unless|rule|within)\b", "State the rules and validation limits."),
    "acceptance_criteria": (r"\b(given|when|then|acceptance)\b", "Add testable Given / When / Then outcomes."),
    "constraints": (r"\b(limit|within|constraint|permission|secure|performance)\b", "Add constraints such as permissions, limits, or timing."),
    "edge_cases": (r"\b(error|fail|invalid|duplicate|expired|retry|edge)\b", "Describe invalid, duplicate, and failure behaviour."),
    "security": (r"\b(auth|permission|secure|password|token|privacy|audit)\b", "Clarify authentication, authorization, and audit needs."),
}


def analyze_requirement(raw_requirement: str) -> dict:
    text = re.sub(r"\s+", " ", raw_requirement).strip()
    lower = text.lower()
    dimensions = []
    questions = []
    for name, (pattern, missing_message) in DIMENSIONS.items():
        present = bool(re.search(pattern, lower))
        dimensions.append({"dimension": name.replace("_", " ").title(), "status": "Good" if present else "Missing", "evidence": "Relevant detail detected in the requirement." if present else missing_message})
        if not present and name in {"acceptance_criteria", "edge_cases", "security"}:
            questions.append({"dimension": name.replace("_", " ").title(), "question": missing_message})
    actor = "the user" if re.search(r"\buser\b", lower) else "the relevant actor"
    proposal = "\n\n".join([
        "User story\nAs " + actor + ", I want " + text.rstrip(".") + " so that the intended outcome is clear.",
        "Acceptance criteria\n- Given a valid actor\n- When they perform the requested action\n- Then the expected outcome is recorded\n- And invalid input produces a safe, clear error",
        "Edge cases\n- Handle duplicate submissions, invalid input, and unavailable dependencies.",
        "Security and constraints\n- Define authorization, audit requirements, and applicable limits.",
    ])
    overall = "Ready for workflow" if not questions else "Needs clarification"
    return {"mode": "explainable_rules", "overall": overall, "dimensions": dimensions, "questions": questions, "proposed_requirement": proposal}
