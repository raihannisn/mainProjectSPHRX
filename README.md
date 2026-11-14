# SPHEREx Cosmic Expedition

> **NASA Space Apps Challenge 2026** — Planet X and SPHEREx  
> Production-ready scientific exploration experience with AR/VR integration

---

## 🚀 Quick Start

**Baru pertama kali?** Baca **`docs/00-START-HERE.md`** untuk orientasi lengkap.

**Sudah familiar?** Lihat workflow di **`docs/WORKFLOW.md`**.

---

## 📦 What's This?

Scientific exploration tool untuk eksplorasi observasi infrared SPHEREx dari NASA:
- **Backend**: FastAPI dengan NASA IRSA SIA2 integration
- **Frontend**: Vanilla HTML/CSS/JS explorer dengan mobile support
- **AR/VR**: React + Three.js + WebXR (Quest 3, mobile AR)

**Status:** ✅ Production-ready (Phase 5.1 Complete, 127 tests passed)

---

## 📁 Repository Structure

```
mainProjectSPHRX/
├── backend/          → FastAPI service (Python)
├── frontend/         → Web explorer (Vanilla HTML/CSS/JS)
├── arvr/             → AR/VR module (React + Three.js + WebXR)
├── docs/             → Documentation (START HERE!)
│   ├── 00-START-HERE.md     ← Entry point
│   ├── WORKFLOW.md          ← Standard workflow
│   ├── ARCHITECTURE.md      ← Technical architecture
│   ├── API-CONTRACT.md      ← API contracts
│   └── ...
├── AGENTS.md         → Global rules (BACA SEBELUM CODE!)
├── PLAN.md           → Product mission & science context
└── vercel.json       → Multi-service deployment config
```

---

## 🎯 Documentation Navigator

| Role | Start Here |
|------|------------|
| **New Agent/Developer** | `docs/00-START-HERE.md` |
| **Frontend** | `docs/00-START-HERE.md` → `docs/ARCHITECTURE.md` (Section 6) |
| **Backend/API** | `docs/00-START-HERE.md` → `docs/ARCHITECTURE.md` (Section 3-4) |
| **AR/VR/XR** | `docs/00-START-HERE.md` → `arvr/HANDOFF.md` |
| **QA/Testing** | `docs/QA-CHECKLIST.md` |
| **DevOps** | `docs/ARCHITECTURE.md` (Section 10) |

Full documentation index: **`docs/README.md`**

---

## 📜 Core Documentation Files

| File | Purpose | Read When |
|------|---------|-----------|
| `docs/00-START-HERE.md` | Entry point & quick orientation | First time |
| `docs/WORKFLOW.md` | Standard workflow untuk semua agent | Every session |
| `docs/ARCHITECTURE.md` | Complete technical architecture | Before implementing |
| `AGENTS.md` | Global rules, restrictions, protocols | **BEFORE ANY CODE CHANGE** |
| `PLAN.md` | Product mission & scientific context | Understanding vision |
| `docs/API-CONTRACT.md` | API endpoint contracts | API integration |
| `docs/DECISIONS.md` | Architectural decision log | When decisions made |
| `docs/QA-CHECKLIST.md` | Release readiness checklist | Before deployment |

---

## ⚡ Quick Commands

```bash
# Frontend
node frontend/build.mjs

# Backend (local dev)
cd backend
python -m uvicorn main:app --reload --port 8000

# AR/VR
cd arvr
npm run dev           # Dev server HTTPS
npm run build         # Production build
npm run smoke:xr      # Smoke tests
npm run check:content # Validate content
```

---

## 🛡️ Important Rules

### ✅ MUST DO:
- Read `AGENTS.md` before changing ANY code
- Verify source code before making assumptions
- Run tests after modifications
- Report REAL test results (don't fabricate!)
- Label data with honest provenance (FACT/CANDIDATE/DEMO)

### ❌ NEVER:
- `git commit`, `git push`, `git merge`, or deploy (owner only!)
- Expose API keys or secrets
- Overwrite unrelated files
- Invent astronomical observations
- Claim "Planet X found" or "confirmed discovery"

---

## 🔬 Scientific Integrity

Ini NASA Challenge — scientific honesty adalah prioritas:
- **FACT**: Verified data dari NASA/IRSA
- **CANDIDATE**: Unverified detection
- **DEMO**: Illustrative data
- **LOCAL FALLBACK**: Offline fallback

Don't claim discoveries without scientific verification pipeline!

---

## 🤝 Contributing Workflow

1. **Orient** → Baca docs yang relevan
2. **Plan** → Write clear acceptance criteria
3. **Implement** → Small, focused changes
4. **Verify** → Run tests, report results

Full workflow: **`docs/WORKFLOW.md`**

---

## 📞 Contact Owner For:
- Git operations (commit/push/deploy)
- NASA API key rotation
- Production deployment
- Breaking API changes
- Scientific data interpretation questions

---

**Built with:** FastAPI, Astropy, React 19, Three.js, Vite, TypeScript, WebXR

**Live:** Production deployment on Vercel Services

**Branch:** `feat/mobile-frontend-improvements`

