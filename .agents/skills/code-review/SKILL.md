---
name: code-review
description: Independently reviews implementation changes for correctness, security, maintainability, and acceptance criteria.
---

# Independent Code Review

Review the assigned issue and implementation diff.

Do not modify source code.

Check:

1. Does the implementation satisfy every acceptance criterion?
2. Are there logical bugs or edge cases?
3. Are API contracts used correctly?
4. Are there security or privacy problems?
5. Is there duplicated or unnecessarily complex code?
6. Are error and loading states handled?
7. Are tests sufficient?
8. Are scientific data and metadata handled correctly where applicable?

Classify findings:
- BLOCKER
- CRITICAL
- MAJOR
- MINOR
- SUGGESTION

Every finding must include:
- Severity.
- File path and relevant location.
- Explanation.
- Reproduction or reasoning.
- Recommended correction.

Do not approve changes merely because tests pass.
Do not invent problems.
Finish with APPROVE, REQUEST CHANGES, or NEEDS MORE INFORMATION.