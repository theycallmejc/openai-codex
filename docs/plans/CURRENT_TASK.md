# Current Task

## Objective

Prevent the Risk Agent's secure file-upload rule from falsely matching unrelated words such as `profile`.

## Why This Matters

Risk findings influence workflow review. A high-severity false positive creates misleading work and reduces trust in deterministic, explainable automation.

## Scope

- Reproduce the false-positive match from the file-upload rule.
- Change keyword matching to recognize complete words only.
- Preserve all existing curated Risk Agent coverage.
- Add a regression test and run the evaluation suite.

## Out of Scope

- New risk domains, provider changes, or model evaluation
- Broad agent redesign or UI work
- Changes to the curated evaluation expectations

## Implementation Plan

- [x] Reproduce the false-positive profile scenario.
- [x] Implement complete-word deterministic rule matching.
- [x] Add a focused regression test.
- [x] Run the complete evaluation suite.
- [x] Record verification and limitations.

## Acceptance Criteria

- [x] A profile-only requirement produces no file-upload risk.
- [x] A real file-upload requirement still produces the secure file-upload risk.
- [x] Existing Risk Agent cases remain valid.
- [x] No live API is called from unit tests.
- [x] Evaluation report remains fully passing.

## Verification

- [x] Tests — 15 passed, 78.67% backend coverage.
- [x] Evaluation suite and baseline comparison — 8/8 passed; no regressions from the Risk Agent v2 baseline.
- [x] Application run if backend behaviour changes — API workflow exercised through isolated FastAPI TestClient databases.
- [x] UI verification if applicable — not applicable; no UI change.
- [x] No relevant console/server errors

## Implementation Decisions

- Risk detection now tokenizes the lowercased requirement and matches complete tokens, rather than matching arbitrary substrings.
- The file rule continues to match a standalone `file` token and retains its existing mitigation.

## Limitations

The rule engine remains keyword-based. Token matching prevents embedded-word false positives, but it does not recognize all synonyms or multiword domain concepts.

## Status

Complete
