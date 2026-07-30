# Artifact Field Mapping

This document describes the implemented transformation and identifier lineage
from a raw requirement to QA test cases. It distinguishes explicit database
links from project-scoped relationships derived by the traceability agent.

## Identifier mapping

| Artifact | Example | Scope | Stability |
|---|---|---|---|
| Project | `PRJ-001` | Global | Never regenerated |
| Raw and structured requirement | `REQ-001` | Project | Stable for the single MVP requirement |
| Functional requirement | `REQ-001-FR-01` | Requirement | Deterministically derived |
| BRD | `BRD-001` | Project | Stable; revision increments |
| User story | `STORY-001` | Project | Stable by ordinal; revision increments |
| Acceptance criterion | `AC-001` | Project/story | Stable by ordinal; revision increments |
| Test case | `TC-001` | Project | Stable by ordinal; revision increments |
| Approval decision | `APR-001` | Project | Append-only |
| QA handoff | `QAH-001` | Project | Stable; revisioned record |

## Raw requirement to structured requirement

Both forms use `REQ-001`; the structured form is stored in
`requirements.structured_json`.

| Raw input or persisted field | Structured output |
|---|---|
| `raw_requirement` request field | Normalized `requirements.raw_text` |
| Normalized raw text | SHA-256 `content_hash` for duplicate detection |
| First sentence/words | `title`, `problem_statement`, and `objective` |
| Actor keywords in raw text | `actors[]`; defaults to labelled `User` |
| Sentences | `functional_requirements[]` |
| `REQ-001` and sentence ordinal | `REQ-001-FR-01`, `REQ-001-FR-02`, and so on |
| Constraint keywords | `constraints[]` |
| Unspecified facts | Explicit `assumptions[]` and `ambiguities[]` |
| Generator implementation | `generator_mode` and `rules_version` |

Every functional requirement contains `source_requirement_id = REQ-001`.
Validation rejects a mismatched source.

## Structured requirement to BRD

The BRD Agent consumes the current structured requirement and persists the
result as `BRD-001`.

| Structured requirement | BRD field |
|---|---|
| `requirement_id` | `requirement_id` |
| `title` | BRD title |
| `problem_statement` | `problem_statement` and executive summary context |
| `objective` | `goals[]` |
| `actors[]` | `stakeholders[]` |
| `functional_requirements[]` | `scope_in[]` and BRD `functional_requirements[]` |
| `constraints[]` | `constraints[]` |
| `assumptions[]` | `assumptions[]` |
| `ambiguities[]` | `risks[]` |
| MVP boundaries | `non_goals[]` and `scope_out[]` |
| Approval dependency | `dependencies[]` |

The `brds.requirement_id` foreign key explicitly links the BRD to the persisted
requirement. Regeneration preserves `BRD-001` and increments its revision.

## BRD requirement to user story

The Backlog Agent creates one story for each BRD functional requirement.

| BRD field | Story field |
|---|---|
| First stakeholder | `persona` |
| Functional-requirement statement | `need` |
| First BRD goal | `benefit` |
| MVP prioritization rule | `priority = MUST` |
| Functional-requirement ordinal | Stable story ordinal and `STORY-*` |

Stories are stored with a direct project foreign key. The current MVP does not
store a story-to-BRD join table; that relationship is derived from the single
current approved BRD within the same project. This is a documented limitation,
not an implied direct database link.

## Story to acceptance criterion

Each generated story has at least one criterion.

| Story/source field | Acceptance-criterion field |
|---|---|
| Approved source requirement ID | `given` context |
| Story persona and requested capability | `when` |
| Functional-requirement statement | `then` |
| Story internal ID | `acceptance_criteria.story_id` foreign key |
| Criterion ordinal | Stable `AC-*` identifier |

The repository enforces one story owner for every criterion. Backlog validation
rejects stories with no acceptance criteria.

## Acceptance criterion to test case

The QA Test Agent generates three tests for every approved criterion.

| Acceptance criterion | Test-case field |
|---|---|
| `public_id` | Explicit link through `test_case_criteria` |
| `given` | Test precondition |
| `when` | Execution step |
| `then` | Positive expected result and boundary context |
| Story priority | Test priority |
| QA rules | `FUNCTIONAL_POSITIVE`, `FUNCTIONAL_NEGATIVE`, and `BOUNDARY` |

The validator rejects unknown criterion links, untested criteria, or a
criterion missing any required test type.

## Traceability chain and matrix

```text
PRJ-001
  -> REQ-001
  -> BRD-001
  -> STORY-001
  -> AC-001
  -> TC-001, TC-002, TC-003
  -> QAH-001
```

Each traceability row contains:

| Matrix field | Source |
|---|---|
| `requirement_id` | Current project requirement |
| `brd_id` | Current approved project BRD |
| `story_id` | Story owning the criterion |
| `acceptance_criterion_id` | Criterion |
| `test_case_ids[]` | Explicit `test_case_criteria` links |

The Traceability Agent flags:

- A requirement with no BRD or stories as orphaned
- An acceptance criterion with no linked test as untested
- Coverage below 100 percent as invalid for QA handoff

## Approval and QA handoff mapping

`APR-*` records map each human decision to gate type, artifact reference,
artifact revision, actor, role, reason/comment, and timestamp. `QAH-001`
collects the approved BRD ID, story IDs, test IDs, coverage, assumptions,
unresolved risks, approval evidence, and deterministic-generator disclosure.

## Deferred mapping enhancements

- Multiple requirements per project
- Field-level source spans
- Direct story-to-BRD and story-to-functional-requirement join tables
- Manual trace-link repair
- Editable artifact revisions and comparison views
- Enterprise graph storage
