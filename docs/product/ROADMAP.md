# FlowPilot Roadmap

## Completed

- Governed requirement-to-QA workflow with persisted artifacts and approval gates
- Workspace and workflow dashboard, review inbox, audit history, and workflow execution UI
- Deterministic requirement, risk, review, test, and traceability capabilities
- Structured generated-artifact review with targeted remediation where safe
- Scoped workflow copilot and keyboard-first command palette
- Offline evaluation suite with representative datasets, deterministic checks, and regression comparison
- Risk Agent v2 coverage for RBAC permission controls and secure file-upload controls, verified by the curated evaluation suite
- Risk Agent reliability fix: complete-word matching prevents secure-file-upload false positives from unrelated terms such as `profile`
- Workflow execution agent-plan reliability: dependency-aware actions, structured recovery states, and removal of an obsolete raw-JSON handler

## Current

- Keep workflow execution, error recovery, and review UX operational as backend behaviours evolve
- Expand validation and version-aware review of generated artifacts without fabricating AI quality claims

## Next

- Configurable model-provider abstraction and separately labelled live-model evaluation
- GitHub and pull-request analysis integration, read-only first
- CI/CD failure analysis and controlled remediation proposals
- Kubernetes, observability, and incident-management investigation agents

## Later

- Jira and Slack integrations
- Curated RAG/knowledge-base support
- Enterprise RBAC and production identity
- Advanced evaluation datasets, model judges, and policy-gated remediation
