# WORKFLOW STANDAR — SPHEREx Cosmic Expedition

> Panduan workflow seragam untuk semua agent AI, developer, dan kolaborator.  
> Ikuti panduan ini agar semua sesi kerja menghasilkan output yang konsisten.

---

## 1. The Golden Rule

**Sebelum mengubah satu baris kode pun, baca dokumentasi yang relevan.**

Urutan membaca yang wajib:
1. `AGENTS.md` (root) — aturan global yang tidak boleh dilanggar
2. `docs/00-START-HERE.md` — orientasi cepat
3. `docs/ARCHITECTURE.md` — struktur sistem saat ini
4. `docs/API-CONTRACT.md` — kontrak API (jika menyentuh integrasi)
5. File audit relevan di `docs/audit/` (modul yang akan disentuh)

---

## 2. Fase Kerja Standard

Setiap sesi kerja mengikuti empat fase ini:

### Fase A: ORIENT (Orientasi)
**Tujuan:** Pahami konteks sebelum menyentuh kode.

Checklist:
- [ ] Baca `AGENTS.md` root (aturan global)
- [ ] Baca `docs/00-START-HERE.md`
- [ ] Tentukan module/area yang akan disentuh (backend/frontend/arvr)
- [ ] Baca dokumentasi audit relevan: `docs/audit/{modul}-audit.md`
- [ ] Baca `docs/ARCHITECTURE.md` untuk memahami integration points
- [ ] Inspect kode sumber yang relevan (`backend/`, `frontend/`, atau `arvr/`)
- [ ] Verifikasi branch aktif dan git status

Waktu estimasi: 5–15 menit.

### Fase B: PLAN (Perencanaan)
**Tujuan:** Rumuskan rencana yang jelas SEBELUM implementasi.

Harus dipastikan:
- Acceptance criteria yang jelas dan measurable
- Daftar file yang akan diubah
- Daftar file yang TIDAK akan disentuh
- Dependensi dan risiko yang diidentifikasi
- Testing plan yang konkret

Output: Tulis rencana secara eksplisit. Tandai asumsi sebagai `ASSUMPTION`.

### Fase C: IMPLEMENT (Implementasi)
**Tujuan:** Eksekusi dengan scope yang dikontrol.

Prinsip:
- Satu task pada satu waktu
- Perubahan sekecil mungkin
- Reuse existing architecture
- Zero hardcoded secrets
- Handle error dan edge case

Selama implementasi:
- Jangan modifikasi file di luar scope yang sudah didefinisikan
- Jika menemukan masalah tak terduga, **stop dan report**, jangan auto-fix hal lain
- Comment kode jika logic tidak obvious

### Fase D: VERIFY (Verifikasi)
**Tujuan:** Konfirmasi implementasi benar-benar bekerja.

Wajib dijalankan:
```bash
# Frontend
node frontend/build.mjs                    # Build check

# AR/VR
npm run check:content --prefix arvr        # Content integrity
npm run build --prefix arvr                # Type + build check

# Backend (jika ada test runner)
python -m pytest backend/tests/            # Jika test ada
```

Report yang harus ditulis:
- Files changed: daftar lengkap
- Behavior added/changed: deskripsi konkret
- API fields used: nama field yang dipakai
- Assumptions: apa yang diasumsikan
- Tests run: perintah yang dijalankan
- Test results: output actual (jangan fabricate!)
- Known limitations: apa yang belum selesai/belum bisa ditest

---

## 3. Protocol Handoff Antar-Agent

Ketika agent A selesai dan agent B mengambil alih:

**Agent A (selesai) HARUS:**
1. Tulis report menggunakan template di Section 4
2. List exact files yang berubah
3. List test commands yang sudah dijalankan dan hasilnya
4. Identify unresolved issues dan blockers

**Agent B (mulai) HARUS:**
1. Baca report dari agent A
2. Verifikasi state kode secara langsung (jangan percaya klaim verbal)
3. Jalankan ulang test untuk baseline
4. Konfirmasi starting state sebelum mulai

**Jangan:**
- Trust klaim "feature is ready" tanpa evidence
- Skip membaca dokumentasi meski "sudah tau konteksnya"
- Assume kode berjalan tanpa menjalankannya

---

## 4. Template Report Agent

Setiap agent yang menyelesaikan task HARUS menulis report ini:

```markdown
## Agent Report — [Task Name]

**Date:** YYYY-MM-DD  
**Branch:** [branch name]  
**Status:** COMPLETE / PARTIAL / BLOCKED  

### Files Changed
| File | Change Type | Summary |
|------|-------------|---------|
| path/to/file | Modified/Created/Deleted | Brief description |

### Behavior Added/Changed
- Deskripsi konkret behavior baru
- Apa yang berubah dari sebelumnya

### API Fields Used
- `field_name` from `/endpoint` — purpose

### Assumptions Made
- `ASSUMPTION: [apa yang diasumsikan dan kenapa]`

### Tests Run
\`\`\`
command yang dijalankan
output actual
\`\`\`

### Test Results
- PASS/FAIL: jumlah
- Keterangan jika ada yang fail

### Known Limitations
1. Limitation 1 dan kenapa
2. Limitation 2 dan kenapa

### Required Owner Actions
1. Action yang perlu dilakukan owner
2. Credential/key yang perlu di-set
```

---

## 5. Protocol Perubahan Arsitektural

Jika ada keputusan yang mempengaruhi lebih dari satu workstream:

1. **Stop** — jangan implement dulu
2. **Document** di `docs/DECISIONS.md` menggunakan template yang ada
3. **Notify** owner tentang keputusan ini
4. **Wait** approval sebelum proceed

Hal-hal yang termasuk architectural decision:
- Perubahan struktur API endpoint
- Perubahan format response/contract
- Perubahan routing atau deployment config
- Perubahan interpretasi data saintifik
- Perubahan handoff state antara 2D dan XR

---

## 6. Data & Scientific Integrity Protocol

Karena ini NASA project, ikuti rules ini dengan ketat:

### Labeling Data
```
FACT          = Data terverifikasi dari arsip NASA/IRSA
CANDIDATE     = Data yang belum bisa dikonfirmasi
DEMO          = Data peraga, bukan observasi nyata
LOCAL FALLBACK = Data lokal karena koneksi offline
LIVE DR1      = Data dari SPHEREx Data Release 1
LIVE QR3      = Data dari SPHEREx Quick Release 3
```

Yang TIDAK Boleh Dilakukan:
- Label data demo sebagai "real NASA data"
- Klaim temporal comparison sebagai "confirmed discovery"
- Use framing seperti "Planet X found" atau "new discovery"
- Merge different detector bands menjadi RGB tanpa disclaimer

---

## 7. Git & Deployment Protocol

**PENTING: Semua git operations dilakukan HANYA oleh repository owner.**

Agent dilarang: `git commit`, `git push`, `git merge`, dan deployment.

Agent boleh: `git status`, `git diff`, `git log`, `git branch`.

Secrets: API keys hanya di environment variables, TIDAK DI CODE. Variabel wajib: `NASA_API_KEY` di Vercel project settings.

---

## 8. Quick Reference: Commands

```bash
# Backend (dari root project)
cd backend && python -m uvicorn main:app --reload --port 8000

# Frontend
node frontend/build.mjs

# AR/VR
cd arvr
npm run dev           # Dev server HTTPS
npm run build         # Type check + production build
npm run vr            # Build + serve untuk headset
npm run smoke:xr      # Playwright smoke test (butuh preview server di port 4173)
npm run check:content # Validasi hotspot content
```

---

## 9. Referensi Silang Dokumentasi

| Topik | Dokumen |
|-------|---------|
| Project mission & science | `PLAN.md` (root) |
| Global agent rules | `AGENTS.md` (root) |
| Technical architecture | `docs/ARCHITECTURE.md` |
| API contracts | `docs/API-CONTRACT.md` |
| Design system | `frontend/DESIGN.md` |
| Architectural decisions | `docs/DECISIONS.md` |
| Release checklist | `docs/QA-CHECKLIST.md` |
| Backend status | `docs/audit/backend-audit.md` |
| Frontend status | `docs/audit/frontend-audit.md` |
| AR/VR status | `docs/audit/arvr-audit.md` |
| XR setup & deployment | `arvr/HANDOFF.md` |
| XR feature roadmap | `arvr/docs/PLAN.md` |
| Backend setup | `backend/README.md` |
