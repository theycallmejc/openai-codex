# Artifact Field Mapping

| Input | Deterministic output | Traceability link |
|---|---|---|
| Raw requirement | `REQ-001` analysis and functional requirements | `source_requirement_id` |
| Functional requirement | `BRD-001` scope item | `REQ-001-FR-*` |
| Functional requirement | `STORY-*` and `AC-*` | Story source requirement |
| Acceptance criterion | `TC-*` positive, negative, boundary cases | `criterion_id` |
| Test suite | Traceability result and `QAH-001` | Criteria and test counts |

Generated artifacts are persisted as versioned deterministic JSON under a project. Audit events record `system` as actor, stage, outcome, rules version, reason, and timestamp.
