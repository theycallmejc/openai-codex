# FlowPilot engineering instructions

## Product

FlowPilot is an AI-assisted workflow and QA orchestration platform. Its current conceptual flow is: Requirement → AI analysis → workflow planning → specialized agents → risk/QA review → human approval → traceability → QA artifact. Evolve it toward broader AI-assisted SDLC and DevOps support without premature overengineering.

## Engineering rules

Before changing code, inspect the relevant files, understand current behaviour, identify the root cause, and preserve working functionality. Implement incrementally; run relevant tests; run the application when relevant; and visually verify UI changes when browser tooling is available. Fix regressions before completion. Do not rewrite working systems merely for style preference, though a larger clean change is appropriate when it is genuinely justified.

When a task results in code changes, commit completed, verified changes and push the commit to the tracked remote branch before reporting completion. Do not push unverified or unrelated changes.

## Frontend

The current frontend is semantic HTML, CSS, and lightweight vanilla JavaScript. Prefer reusable classes, CSS variables, modular JavaScript, and lightweight dependencies. Do not add an SPA framework without a strong reason.

Keep the interface clean, premium, technical, AI-native, and restrained. Avoid generic dashboards, excessive cards/gradients, neon clichés, fake analytics or AI scores, dead controls, and empty space. Create an AI feel through contextual help, real agent activity, workflow state, traceability, intelligent feedback, and restrained motion.

## Backend and AI

The backend is Python/FastAPI. Keep the conceptual separation route → service/workflow logic → AI/integration layer clear. Improve validation, safe errors, persistence, authorization, logging, and external-provider failure handling when justified. Never expose raw Python exceptions.

Do not scatter raw LLM calls across route files. Prefer centralized providers, orchestration, prompts, agents, schemas, validators, tools, and evaluations. Never fabricate confidence, progress, or operational statistics; do not expose chain-of-thought. Prefer structured outputs and human review for application-critical AI changes.

Future external tools must follow: AI proposes → application validates → user approves when required → tool executes → audit records the result. Never execute arbitrary model-generated shell commands.

## Testing and verification

Run tests before and after significant work. Mock LLMs, external APIs, and future GitHub/Jenkins/Kubernetes integrations; normal unit tests must not call live services. For UI work, check layout, overflow, typography, loading, errors, responsive behaviour, themes, and console errors at approximately 1920×1080, 1440×900, 1280×800, 768×1024, and 390×844 when browser tooling exists. Do not claim visual verification unless it occurred.

## Task tracking and definition of done

When working from `docs/plans/CURRENT_TASK.md`, update its status, acceptance criteria, implementation decisions, limitations, ROADMAP where appropriate, and `docs/plans/COMPLETED.md` for verified major work. A task is complete only when intended behaviour works, relevant tests pass, no significant regression remains, relevant UI is verified, failure states are handled, code is maintainable, and meaningful documentation is current.
