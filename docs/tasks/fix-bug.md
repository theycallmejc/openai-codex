# Fix Bug

Follow this sequence exactly:

1. **Reproduce** the reported behaviour with a test, request, or reliable manual path.
2. **Root cause**: inspect the responsible code and identify the cause, not a symptom.
3. **Minimal correct fix**: preserve unrelated behaviour; refactor only where necessary.
4. **Regression test**: cover the failure and the intended behaviour.
5. **Verify**: run relevant tests and the application/UI when applicable.

Do not randomly refactor around a bug or claim a fix without reproduction and verification.
