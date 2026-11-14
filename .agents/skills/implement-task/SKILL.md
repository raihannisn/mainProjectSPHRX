---
name: implement-task
description: Implements one approved GitHub issue with controlled scope, tests, and Git safety.
---

# Task Implementation

Before coding, read:
- AGENTS.md
- Relevant workspace rules
- The assigned issue
- Relevant project documentation
- Relevant skills

Protocol:

1. Inspect current Git branch and working tree.
2. Confirm the task acceptance criteria.
3. Identify affected files.
4. Explain the implementation plan.
5. Implement only the assigned task.
6. Reuse existing architecture and components.
7. Avoid unnecessary dependencies.
8. Add or update relevant tests.
9. Run available lint, test, and build commands.
10. Inspect git diff.

Restrictions:
- Never work directly on main.
- Never overwrite unrelated changes.
- Never expose secrets.
- Never commit or push without explicit approval.
- Never claim tests passed unless they actually ran.

Final report:
- Files changed.
- Implementation summary.
- Tests performed.
- Test results.
- Known limitations.
- Remaining tasks.