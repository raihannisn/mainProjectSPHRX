
# SPHEREX COSMIC EXPEDITION

## Project Context
Read docs/INTEGRATION_ARCHITECTURE.md
and relevant docs/audit/ files before implementation.

## Architecture
- backend/: FastAPI.
- frontend/: Vanilla HTML/CSS/JavaScript.
- arvr/: React, Vite, Three.js, WebXR.

Preserve the existing hybrid architecture.
Do not rewrite modules unnecessarily.

## Development Rules
- Work inside the current repository.
- Preserve existing uncommitted changes.
- Never expose API keys or secrets.
- Never overwrite unrelated files.
- Keep changes small and phase-specific.
- Verify source code before making assumptions.
- Run relevant tests after modifications.
- Never fabricate test results.

## Git Restrictions
- Never commit.
- Never push.
- Never merge.
- Never deploy.
- Repository owner handles commits and deployment.

## Execution
- Work on one implementation phase at a time.
- Read relevant documentation only.
- Report changed files and actual test results.
- Stop when the requested phase is complete.
