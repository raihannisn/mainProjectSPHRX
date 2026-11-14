---
name: qa-validation
description: Validates an implementation through available tests, linting, builds, and functional checks.
---

# Quality Assurance

Read the assigned issue and relevant project documentation.

Validate:

1. Acceptance criteria.
2. Existing automated tests.
3. Relevant new tests.
4. Lint checks.
5. Production build.
6. API integration and error handling.
7. UI loading, empty, and failure states.
8. Regression risks.

Rules:
- Do not install dependencies without approval.
- Do not alter source code during validation.
- Do not expose secrets.
- Do not claim a test passed if it was not executed.
- Report environment limitations clearly.

Output:
- Test name.
- Command or procedure.
- Result: PASS, FAIL, or BLOCKED.
- Evidence.
- Remaining risks.

Finish with an overall QA verdict.