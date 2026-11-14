# 🚀 SPHEREX COSMIC EXPEDITION - MULAI DI SINI

> **Panduan Entry Point untuk Semua Agent AI & Developer**  
> Terakhir diperbarui: 14 November 2026

---

## 🎯 Apa Ini?

Ini adalah **NASA Space Apps Challenge 2026** project untuk Challenge **"Planet X and SPHEREx"**.

Proyek ini adalah **Scientific Exploration Experience** yang membantu user:
1. Eksplorasi observasi SPHEREx (infrared sky survey NASA)
2. Membandingkan gambar langit lintas waktu (multi-epoch)
3. Mencari sumber yang bergerak/berubah
4. Visualisasi immersive dalam AR/VR

---

## 📁 Struktur Repository

```
mainProjectSPHRX/
├── backend/          → FastAPI (Python) - NASA IRSA SIA2, FITS processing
├── frontend/         → Vanilla HTML/CSS/JS - Web Explorer UI
├── arvr/             → React + Three.js + WebXR - Immersive 3D/AR/VR
├── docs/             → Dokumentasi (BACA INI!)
│   ├── 00-START-HERE.md        ← **ANDA DI SINI**
│   ├── WORKFLOW.md             ← Workflow standar agent
│   ├── ARCHITECTURE.md         ← Arsitektur teknis lengkap
│   ├── API-CONTRACT.md         ← Kontrak API backend-frontend
│   ├── DECISIONS.md            ← Log keputusan arsitektural
│   ├── QA-CHECKLIST.md         ← Checklist sebelum deploy
│   └── audit/                  ← Hasil audit teknis per modul
└── .agents/
    ├── rules/                  ← Aturan workspace
    └── skills/                 ← Skill definitions untuk agent
```

---

## ⚡ Quick Start untuk Agent Baru

### 1️⃣ **Audit Project** (Jika Pertama Kali)
```bash
# Baca file-file ini DULU:
- docs/00-START-HERE.md        (ini)
- docs/WORKFLOW.md              (cara kerja standar)
- docs/ARCHITECTURE.md          (arsitektur sistem)
- docs/API-CONTRACT.md          (kontrak backend-frontend)
- AGENTS.md                     (aturan global)
```

Atau gunakan skill:
```
/audit-project
```

### 2️⃣ **Planning Feature Baru**
```
/plan-feature <deskripsi fitur>
```

### 3️⃣ **Implementasi Task**
```
/implement-task <issue number atau deskripsi>
```

---

## 🧭 Navigasi Dokumentasi Berdasarkan Role

### 🎨 **Frontend/UI Developer**
1. `docs/ARCHITECTURE.md` → Section "Frontend Architecture"
2. `docs/audit/frontend-audit.md` → Status implementasi frontend
3. `frontend/DESIGN.md` → Design tokens & UI specs
4. `docs/API-CONTRACT.md` → API yang bisa dipakai

### ⚙️ **Backend/API Developer**
1. `docs/ARCHITECTURE.md` → Section "Backend Architecture"
2. `docs/audit/backend-audit.md` → Status implementasi backend
3. `backend/README.md` → Setup & endpoints
4. `docs/API-CONTRACT.md` → Kontrak yang harus dipenuhi

### 🥽 **AR/VR/XR Developer**
1. `docs/ARCHITECTURE.md` → Section "XR Architecture"
2. `docs/audit/arvr-audit.md` → Status implementasi AR/VR
3. `arvr/HANDOFF.md` → Setup & deployment AR/VR
4. `arvr/docs/PLAN.md` → Roadmap fitur XR

### 🧪 **QA/Testing**
1. `docs/QA-CHECKLIST.md` → Checklist lengkap
2. `docs/API-CONTRACT.md` → Kontrak yang harus diverifikasi
3. `docs/WORKFLOW.md` → Testing workflow

### 🏗️ **DevOps/Deployment**
1. `docs/ARCHITECTURE.md` → Section "Deployment Architecture"
2. Root `vercel.json` → Multi-service routing config
3. `docs/WORKFLOW.md` → Deployment procedure

---

## 🎓 Prinsip Kerja Proyek Ini

### ✅ HARUS DILAKUKAN:
- ✅ Baca dokumentasi yang relevan SEBELUM coding
- ✅ Verifikasi source code sebelum membuat asumsi
- ✅ Jalankan test setelah modifikasi
- ✅ Report hasil test yang REAL (jangan fabricate)
- ✅ Bedakan data NASA REAL vs mock/fixture
- ✅ Preserve existing uncommitted changes
- ✅ Keep changes small & phase-specific

### ❌ DILARANG:
- ❌ NEVER commit, push, merge, atau deploy (owner yang handle)
- ❌ NEVER expose API keys atau secrets
- ❌ NEVER overwrite unrelated files
- ❌ NEVER rewrite modules tanpa alasan teknis kuat
- ❌ NEVER invent astronomical observations/metadata
- ❌ NEVER claim feature works tanpa testing

---

## 🔬 Scientific Integrity Rules

Ini NASA Challenge, jadi **scientific honesty** adalah prioritas:

1. **Data Provenance**: Setiap data harus jelas sumbernya (IRSA/NASA APOD/Local)
2. **Label Jujur**:
   - `FACT` = Data terverifikasi dari katalog
   - `CANDIDATE` = Belum dikonfirmasi
   - `DEMO/ILLUSTRATION` = Data peraga/ilustrasi
   - `LOCAL FALLBACK` = Data lokal karena offline
3. **Temporal Comparison**: 2 frame ≠ "discovery" atau "Planet X". Harus labeled sebagai "candidate signal"
4. **FITS Data**: Perlakukan sebagai scientific data, bukan ordinary image

---

## 🤖 Skill/Command yang Tersedia

### Audit & Analysis
- `/audit-project` - Comprehensive audit read-only
- `/code-review` - Review kualitas code

### Planning
- `/plan-feature` - Convert requirement → technical issue

### Implementation
- `/implement-task` - Implement approved task dengan test
- `/frontend-ui-ux` - Frontend-specific implementation

### Quality Assurance
- `/qa-validation` - Validate feature sebelum deploy

---

## 📞 Hubungi/Tanyakan Owner Jika:

1. Need to rotate NASA API key
2. Need to create git commit/push
3. Need to deploy to production
4. Uncertainty tentang scientific data interpretation
5. Breaking change pada API contract
6. Need access ke external service credentials

---

## 🔄 Update Terakhir

**Status Project:** Production-ready, Phase 5.1 Complete
- ✅ Backend: FastAPI dengan IRSA SIA2 + NASA APIs
- ✅ Frontend: Vanilla HTML/CSS/JS dengan bottom sheet mobile
- ✅ AR/VR: React + Three.js + WebXR (Quest 3, mobile AR)
- ✅ Integration: Unified DR1 + QR3 SPHEREx data
- ✅ Tests: 127 automated checks passing

**Branch Aktif:** `feat/mobile-frontend-improvements`

---

## 📚 Next Steps

1. Baca `docs/WORKFLOW.md` untuk memahami workflow standar
2. Baca `docs/ARCHITECTURE.md` untuk technical deep-dive
3. Pilih task dari project board atau minta owner assign task
4. Ikuti protocol di `docs/WORKFLOW.md`

---

**Selamat Coding! 🚀🔭**
