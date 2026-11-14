---
name: audit-project
description: Performs a comprehensive read-only audit of the current SPHEREx repository, including frontend, backend, XR implementation, API integration, Git status, architecture, and technical risks. Use before planning or implementing new features.
---

# SPHEREx Repository Audit

## Mission

Perform a comprehensive, strictly read-only audit of the current repository.

Do not modify, create, delete, install, commit, deploy, or publish anything.

## 1. Read Project Instructions

Read the following files if they exist:

- AGENTS.md
- PLAN.md
- API_CONTRACT.md
- README.md
- Relevant files inside docs/
- Relevant workspace rules inside .agents/rules/
- Relevant skills when needed

Report missing files explicitly.

## 2. Repository Inspection

Inspect:

1. Repository folder structure.
2. Documentation and project configuration.
3. Package manager and dependencies.
4. Frontend architecture and application entry points.
5. Backend architecture and API endpoints.
6. Frontend-to-backend integration.
7. XR/AR/VR implementation.
8. Existing tests and build scripts.
9. Git repository, current branch, and working-tree status.
10. TODOs, incomplete features, and technical risks.

Do not assume that a folder named frontend or backend represents a functional application.

## 3. Security Restrictions

- Never expose API keys, tokens, passwords, or credentials.
- Do not read or print the contents of .env files.
- Do not expose sensitive configuration values.
- Do not execute destructive commands.
- Do not install dependencies.

## 4. Scientific Integrity

For SPHEREx-related functionality:

- Do not invent astronomical observations or metadata.
- Distinguish real NASA/archive data from mock or fixture data.
- Verify actual API response structures where possible.
- Inspect coordinate, timestamp, observation, and provenance handling.
- Identify unsupported scientific assumptions.
- Do not claim a 2D astronomical image represents a physically accurate 3D volume.

## 5. Evidence Classification

Classify findings as:

- VERIFIED: directly supported by inspected source code or configuration.
- UNKNOWN: cannot be established from available evidence.
- ASSUMPTION: a reasonable interpretation that still needs validation.
- MISSING: expected file, feature, or information does not exist.

Reference actual file paths for important findings.

## 6. Audit Report

Produce the following sections:

1. Executive Summary
2. Project Overview
3. Existing Architecture
4. Technology Stack
5. Frontend Implementation Status
6. Backend and API Integration Status
7. XR/AR/VR Implementation Status
8. Data Provenance and Scientific Integrity
9. Tests and Build Configuration
10. Git Status
11. Technical Debt and Risks
12. Missing Components
13. Recommended Development Priorities
14. Proposed Development Roadmap

## 7. Final Restrictions

Do not implement any recommendation.

Do not modify any file.

Do not start another agent or delegate implementation tasks.

Finish by identifying the most important blockers and propose a prioritized task breakdown.

Wait for explicit human approval before implementation.