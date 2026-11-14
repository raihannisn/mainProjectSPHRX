# SPHEREx Agent Kit

This folder is a repository-ready coordination kit for the NASA Space Apps 2026 challenge **Planet X and SPHEREx**.

## Files

- `PLAN.md` — product mission, science context, data sources, user journey, scope, architecture, risks, ownership, and demo flow.
- `AGENTS.md` — global rules for all coding/research agents.
- `API_CONTRACT.md` — provisional record of the deployed backend routes and the evidence needed to confirm actual payloads.
- `AGENT_PROMPTS.md` — copy-ready prompts for the orchestrator, frontend, API, XR, science review, and QA agents.
- `skills/frontend-ui-ux/SKILL.md` — role-specific skill for the frontend/UI/UX agent.
- `docs/DECISIONS.md` — shared decision log.
- `docs/QA_CHECKLIST.md` — release readiness checklist.

## How to use

1. Copy these files into the root of the project repository. Merge `AGENTS.md` with an existing root instruction file rather than overwriting valuable project-specific rules.
2. Give the orchestrator the **Initial orchestrator prompt** from `AGENT_PROMPTS.md`.
3. Require a repository/deployment audit before agents start coding.
4. Assign one owner to each workstream and use the handoff format in `AGENTS.md`.
5. Update `API_CONTRACT.md` only after the backend owner supplies observed response samples.
6. Use `docs/DECISIONS.md` when a decision changes the API, scientific interpretation, routing, or XR handoff.
7. Run `docs/QA_CHECKLIST.md` before the final demo.

## Important limitation

The current API contract is provisional because the OpenAPI schema supplied for this planning pass leaves successful JSON response shapes unspecified. The deployed `/xr` page also did not expose readable source/UI details to automated inspection. The kit deliberately marks these as verification tasks instead of pretending they are known.
