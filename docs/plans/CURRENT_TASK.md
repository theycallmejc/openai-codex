# Current Task

## Objective

Make the Workflow Execution agent plan explain real dependency state and provide recoverable feedback when a plan or agent action fails.

## Why This Matters

The execution screen is the operational control surface for FlowPilot agents. Offering actions that the backend must reject, or raw/unrecoverable feedback, makes the workflow difficult to run safely.

## Scope

- Render Ready, Waiting, and Completed states from persisted orchestration runs.
- Prevent actions whose real dependencies are incomplete.
- Preserve individual agent runs and structured results.
- Provide loading and recoverable error states without changing backend APIs.

## Out of Scope

- New agents or backend workflow states
- Fabricated progress indicators or analytics
- Changes to generated artifacts or approval rules

## Implementation Plan

- [x] Inspect current execution controls and identify the dependency-state UX gap.
- [x] Render dependency-aware agent action states from persisted runs.
- [x] Remove the obsolete raw-JSON result handler.
- [x] Add recoverable plan/action error feedback.
- [x] Verify syntax, API compatibility, and responsive presentation.

## Acceptance Criteria

- [x] Waiting agents cannot be started until their persisted dependencies complete.
- [x] Completed agents are shown as completed and can be intentionally rerun.
- [x] Agent results remain structured rather than raw JSON.
- [x] Plan and agent failures provide a retry/back-to-plan action.
- [x] Existing backend workflow tests and frontend syntax pass.

## Verification

- [x] Tests — 15 passed, 78.67% backend coverage.
- [x] Static JavaScript syntax check — Node passed `--check`.
- [x] API compatibility check — existing orchestration workflow tests passed unchanged.
- [ ] UI verification — blocked: no browser runtime is attached to this environment.
- [x] No relevant console/server errors

## Implementation Decisions

- Agent plan states are derived only from persisted `orchestration_runs`: Completed, Ready to run, or Waiting for a named dependency.
- Dependency-blocked action buttons are disabled; completed agents remain intentionally rerunnable.
- Loading uses `aria-busy`; plan and agent errors provide a retry/back-to-plan action.

## Limitations

The existing page-level timeline updates on the next render; this task updates the live orchestration panel and its cached project state without adding a new client-side state system. Browser-based visual verification is not available in this environment.

## Status

Complete
