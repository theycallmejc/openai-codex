# Add an Integration

For future GitHub, Jenkins, Kubernetes, or similar systems:

1. Start read-only and use least-privilege credentials.
2. Introduce a controlled tool abstraction rather than exposing credentials or unrestricted execution to an AI agent.
3. Define timeouts, safe retries, failure isolation, observability, and audit logging.
4. Require explicit human approval before sensitive writes or remediation.
5. Mock integration calls in automated tests; normal tests must not require a live account.
