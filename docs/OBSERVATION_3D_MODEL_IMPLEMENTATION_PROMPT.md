# Prompt Implementasi: Lanjutan Model 3D AR/VR di Viewport Observasi

Salin prompt di bawah ini untuk coding agent (CLI) yang melanjutkan integrasi model 3D AR/VR ke UI 2D.

---

## Wajib dibaca dulu (urutan dari `docs/WORKFLOW.md`)

1. `AGENTS.md` (root) — aturan global yang tidak boleh dilanggar.
2. `docs/00-START-HERE.md` dan `docs/WORKFLOW.md` — ikuti Fase A ORIENT → B PLAN → C IMPLEMENT → D VERIFY.
3. `docs/ARCHITECTURE.md` (Section 6 Frontend, 7 XR), `docs/DECISIONS.md`, `docs/QA_CHECKLIST.md`.
4. `docs/audit/frontend-audit.md` dan `docs/audit/arvr-audit.md`.
5. `.agents/rules/projekspherex.md` dan skill `.agents/skills/` yang relevan (`implement-task`, `frontend-ui-ux`, `qa-validation`).
6. `arvr/HANDOFF.md`, `arvr/.clinerules`, `arvr/docs/PLAN.md` — aturan modul AR/VR.
7. **`docs/OBSERVATION_3D_MODEL_INTEGRATION_PLAN.md`** — apa yang sudah dibuat, keputusan yang menunggu owner, dan daftar *Deferred*.

Cek `git status` dan `git diff` sebelum mengedit; pertahankan semua perubahan yang sudah ada.

## Konteks singkat

- Sky Explorer (`arvr/src/frontend/components/SkyExplorerScreen.tsx`) punya pemilih model **Sky · Mars · Moon · Bennu** (`?model=`). Mode body me-render `ModelViewer3D.tsx`, yang memakai ulang `BodyExplorer` + `Hotspots` dari `arvr/src/xr/`.
- Toggle hotspot = `settings.pins` di `useXRApp` (dipakai juga oleh scene XR). Toggle VR/AR → `/xr/body/<id>?intent=vr|ar` (mode picker terbuka; sesi immersive harus dimulai dari tap pengguna).
- Konten body: `arvr/content/bodies/<id>.json` (divalidasi `npm run check:content`).

## Tugas

Kerjakan **satu** item dari bagian *Deferred* di rencana (atau yang diminta owner), dengan scope sekecil mungkin. Contoh: tambah body baru ke pemilih (butuh file konten + hotspot dulu), teks HUD EN/ID, atau "Ask the Guide" dengan konteks hotspot terpilih.

## Batasan UI/UX (permintaan tim)

- **Jangan ubah besar layout/UX.** Pertahankan posisi, spacing, warna, tipografi, kartu HUD, dock, dan Dynamic Island `TopBar.tsx`.
- Tambahkan hanya kontrol yang dibutuhkan, **ringkas, berupa toggle/tombol kecil** di toolbar atau pemilih yang sudah ada. Jangan tambah panel baru bila kartu HUD yang ada bisa dipakai.
- CSS baru ditambahkan di akhir `frontend.css`; jangan ubah rule lama tanpa alasan dan catatan.
- Target sentuh minimal 44px (`--hit-target`), fokus terlihat, hormati `prefers-reduced-motion`.

## Integritas ilmiah

- Label jujur wajib: **Fact / Illustration / Candidate (unconfirmed)**; bentuk prosedural = Illustration.
- Tampilkan kredit NASA/CC0 dari konten (`textureCredit`, `modelCredit`, `source`).
- Jangan ganti preview FITS di Comparison dengan 3D; jangan klaim model 3D sebagai data SPHEREx.

## Dependency

- Jangan tambah dependency kecuali benar-benar perlu. Jika perlu, catat alasannya di rencana dan di `docs/DECISIONS.md`.

## QA, smoke test & Playwright (wajib, Fase D)

Setiap perubahan **harus** punya smoke test, dan UI dicek dengan screenshot Playwright:

```bash
cd arvr
npm run build                                   # check:content + tsc + vite build
# dev server untuk smoke 3D:  $env:XR_HTTP='1'; npx vite --port 5173
node scripts/smoke-observation-3d.mjs           # perluas skrip ini untuk perilaku baru
node scripts/design-migration-qa.mjs --base=http://localhost:5173 --phase=<nama> --stub   # bandingkan dengan baseline
npm run smoke:xr                                # butuh preview build di port 4173 (XR_HTTP=1)
cd ..; node frontend/build.mjs
```

- Screenshot minimal: desktop 1280×800, 390×844, 360×800 → `docs/observation-3d/`. Lihat sendiri hasilnya (overlap, teks terpotong, kontrol menutupi model).
- Bandingkan hasil dengan baseline sebelum perubahan; regresi baru = harus diperbaiki, bukan dimatikan.
- **Jangan skip/disable test.** Laporkan hasil yang benar-benar dijalankan (PASS/FAIL/SKIP + alasan). Jangan fabricate.

## Selesai bila

- Acceptance criteria item terpenuhi, semua perintah di atas lulus (atau kegagalan lama dibuktikan identik dengan baseline).
- Rencana `docs/OBSERVATION_3D_MODEL_INTEGRATION_PLAN.md` diperbarui (Scope/Deferred/Testing) dan laporan memakai template di `docs/WORKFLOW.md` Section 4.
- Ikuti aturan git di `AGENTS.md` (commit/push/merge hanya oleh owner atau atas izin eksplisitnya).
