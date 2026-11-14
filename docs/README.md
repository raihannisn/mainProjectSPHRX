# ?? SPHEREx Documentation Index

> Panduan lengkap navigasi dokumentasi  
> Updated: 14 November 2026

---

## ?? Quick Start

### Baru Pertama Kali?
1. **`docs/00-START-HERE.md`** — Entry point & orientasi
2. **`docs/WORKFLOW.md`** — Workflow standar
3. Pilih dokumentasi sesuai role

---

## Dokumentasi Core

| File | Kapan Dibaca |
|------|-------------|
| `docs/00-START-HERE.md` | Pertama kali join |
| `docs/WORKFLOW.md` | Setiap mulai sesi baru |
| `docs/ARCHITECTURE.md` | Sebelum implement fitur |
| `AGENTS.md` (root) | WAJIB sebelum ubah kode |
| `PLAN.md` (root) | Untuk product vision |

---

## Per Role

### ?? Frontend
1. `docs/ARCHITECTURE.md` (Section 6)
2. `docs/audit/frontend-audit.md`
3. `frontend/DESIGN.md`
4. `docs/API-CONTRACT.md`

### ?? Backend
1. `docs/ARCHITECTURE.md` (Section 3-4)
2. `docs/audit/backend-audit.md`
3. `backend/README.md`
4. `docs/API-CONTRACT.md`

### ?? AR/VR
1. `docs/ARCHITECTURE.md` (Section 7)
2. `docs/audit/arvr-audit.md`
3. `arvr/HANDOFF.md`
4. `arvr/docs/PLAN.md`

### ?? QA
1. `docs/QA-CHECKLIST.md`
2. `docs/API-CONTRACT.md`
3. `docs/WORKFLOW.md` (Fase D)

### ??? DevOps
1. `docs/ARCHITECTURE.md` (Section 10)
2. Root `vercel.json`
3. `docs/WORKFLOW.md` (Section 7)

---

## Quick Commands

```bash
# Frontend
node frontend/build.mjs

# Backend
cd backend && python -m uvicorn main:app --reload

# AR/VR
cd arvr
npm run dev
npm run build
npm run smoke:xr
```

---

## Rules

? **HARUS:** Baca `AGENTS.md`, verify code, run tests, label data jujur

? **DILARANG:** commit/push/deploy, expose secrets, invent data, claim discoveries

---

## FAQ

**Q: Mulai dari mana?**  
A: `docs/00-START-HERE.md` ? `docs/WORKFLOW.md` ? `AGENTS.md`

**Q: API apa saja yang ada?**  
A: `docs/API-CONTRACT.md` or `docs/ARCHITECTURE.md` Section 4

**Q: Implement feature baru?**  
A: `docs/WORKFLOW.md` Fase A ? B ? C ? D

**Q: Git workflow?**  
A: Owner only. Agent hanya inspect (`git status`, `git diff`)

---

?? **Selamat coding di SPHEREx Cosmic Expedition!** ??
