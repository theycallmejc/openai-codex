# AI Architecture

## Current provider

No runtime LLM provider is configured. FlowPilot labels its generation as deterministic and operates locally without model credentials.

## Current entry points

- `requirement_intelligence.analyze_requirement` identifies deterministic readiness signals, questions, and a proposed structured requirement.
- `orchestration.execute` runs the Requirement, Risk, and Review agents from a small registered dependency graph.
- Workflow routes generate analysis, backlog/acceptance criteria, QA scenarios, traceability, and review findings as persisted artifacts.
- Assistant endpoints provide deterministic, project-scoped guidance with persisted conversation history.

## Existing agents

| Agent | Current responsibility |
|---|---|
| Requirement | Extract readiness dimensions and clarification gaps |
| Risk | Detect selected password, payment, deletion, and retry signals |
| Review | Surface missing requirement-intelligence dimensions before approval |
| QA Agent | Generate positive, negative, and boundary test scenarios during workflow execution |
| Review Agent | Detect coverage, duplicate, vague-result, orphan-link, and security-sensitive-test issues |
| Traceability Agent | Generate requirement/business-rule/acceptance-criterion/test relationships |

## Prompt handling and structured output

There are no model prompts at runtime. Agent metadata tracks a `deterministic-v1` prompt-version label for comparison purposes. Outputs are dictionaries persisted as versioned artifacts and consumed by the UI; application-critical relationships use stable IDs.

## Context and failure handling

Orchestration context is scoped to one persisted workflow and completed dependency results. Assistant conversations are project-scoped. Workflow transitions enforce approval gates, invalid transitions produce structured errors, and failed workflows can return to the saved requirement boundary. No chain-of-thought is stored or exposed.

## Target architecture (planned)

```text
User → Workflow → AI orchestrator → specialized agent → schema/validator
     → human approval where required → versioned artifact and traceability
```

Future provider integrations should use a centralized adapter, explicit model/prompt versioning, timeouts, safe failure isolation, validation, evaluation, and audit records. Candidate agents include Requirement, Risk, QA, Review, Traceability, and Artifact agents. This is planned architecture, not current behaviour.
