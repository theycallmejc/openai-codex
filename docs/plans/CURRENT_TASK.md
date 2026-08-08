# Current Task

## Objective

Close the measured Risk Agent coverage gaps for RBAC and file-upload requirements while preserving the deterministic, explainable architecture.

## Why This Matters

The production evaluation suite currently fails these two curated cases. Improving this capability without a measured regression test would undermine FlowPilot's AI-quality controls.

## Scope

- Inspect the Risk Agent rules and the RBAC/file-upload evaluation fixtures.
- Add only justified deterministic risk signals and mitigations.
- Add or adjust targeted tests and run the evaluation comparison.
- Record the verified result in evaluation documentation and completed work.

## Out of Scope

- Adding a live LLM provider or model judge
- Broad agent redesign
- New external integrations or unrelated UI redesign

## Implementation Plan

- [x] Reproduce the two evaluation failures.
- [x] Define precise RBAC and file-upload risk rules.
- [x] Implement and unit-test the smallest correct change.
- [x] Run the complete evaluation suite against a baseline.
- [x] Record results and limitations.

## Acceptance Criteria

- [x] RBAC expected risk signal passes in the curated evaluation.
- [x] File-upload expected risk signal passes in the curated evaluation.
- [x] Existing Risk Agent cases remain valid.
- [x] No live API is called from unit tests.
- [x] Evaluation report proves the measured change.

## Verification

- [x] Tests — 15 passed, 78.61% backend coverage.
- [x] Evaluation suite and baseline comparison — 8/8 passed; RBAC and file-upload improved; no regressions.
- [x] Application run if backend behaviour changes — API workflow exercised through isolated FastAPI TestClient databases.
- [x] UI verification if applicable — not applicable; no UI change.
- [x] No relevant console/server errors

## Implementation Decisions

- Added a permission-control risk rule with least-privilege, audit, and unauthorized-access mitigation.
- Added a secure file-upload risk rule with type/size validation, malware isolation, secure storage, and audit mitigation.
- Versioned the Risk Agent metadata as `deterministic-risk-v2`; no live model was introduced.

## Limitations

The Risk Agent remains a deterministic keyword rule set. The 8/8 result proves coverage for the curated core suite only; it does not establish broad production-domain coverage.

## Status

Complete
