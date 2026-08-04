# Security and Responsible-AI Review

This is a local, synthetic-data hackathon MVP. It accepts no credentials, calls no external service, and uses deterministic templates rather than an LLM.

- Pydantic limits and normalizes input; parameterized SQLite statements prevent SQL injection.
- The UI uses `textContent` for dynamic output; API errors use sanitized envelopes with correlation IDs.
- Automated workflow validation prevents invalid downstream artifacts. Every stage outcome is recorded with a system actor, rules version, timestamp, and reason.
- The default deployment must remain loopback-only. Authentication, CSRF protection, rate limits, encrypted storage, and tamper-evident audit logs are required before shared or production use.
- Do not submit real client data, personal information, secrets, or proprietary requirements.
