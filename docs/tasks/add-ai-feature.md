# Add AI Feature

1. Read `AGENTS.md` and `docs/ai/AI_ARCHITECTURE.md`; inspect existing providers, agents, schemas, and evaluations before adding anything.
2. Define exact user value, input scope, output schema, review requirement, and safe failure behaviour.
3. Reuse centralized orchestration/provider abstractions; do not add duplicate providers or scatter raw model calls.
4. Validate structured output, preserve user work if AI fails, and add loading, error, retry, and review states to the UI.
5. Mock providers in unit tests. Add deterministic evaluation cases or metrics when the capability changes generation quality. Do not claim capabilities, confidence, or progress that are not real.
