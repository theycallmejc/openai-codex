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

- [ ] Reproduce the two evaluation failures.
- [ ] Define precise RBAC and file-upload risk rules.
- [ ] Implement and unit-test the smallest correct change.
- [ ] Run the complete evaluation suite against a baseline.
- [ ] Record results and limitations.

## Acceptance Criteria

- [ ] RBAC expected risk signal passes in the curated evaluation.
- [ ] File-upload expected risk signal passes in the curated evaluation.
- [ ] Existing Risk Agent cases remain valid.
- [ ] No live API is called from unit tests.
- [ ] Evaluation report proves the measured change.

## Verification

- [ ] Tests
- [ ] Evaluation suite and baseline comparison
- [ ] Application run if backend behaviour changes
- [ ] UI verification if applicable
- [ ] No relevant console/server errors

## Status

Not Started
