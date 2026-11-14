---
name: plan-feature
description: Converts a project requirement into an implementation-ready technical issue with scope, dependencies, architecture, and acceptance criteria.
---

# Feature Planning

Read AGENTS.md, PLAN.md, docs/AUDIT_BASELINE.md, and relevant technical documentation.

When given a feature request:

1. Understand the user problem.
2. Inspect relevant existing implementation.
3. Identify affected modules and dependencies.
4. Define the proposed architecture.
5. Identify risks and unknowns.
6. Define scope and explicit out-of-scope items.
7. Write measurable acceptance criteria.
8. Define test requirements.
9. Estimate complexity as LOW, MEDIUM, or HIGH.
10. Break large features into independent tasks.

Output a GitHub-ready issue in Markdown.

Do not implement code.
Do not invent API contracts.
Do not overwrite existing architecture without justification.
Wait for human approval.