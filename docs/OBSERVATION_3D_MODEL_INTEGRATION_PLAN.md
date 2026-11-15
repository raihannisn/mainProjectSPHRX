# Rencana & Laporan: Model 3D AR/VR di Viewport Observasi (Sky Explorer)

> Branch: `feat/3d-observation` (dibuat dari `integrasi`) · Tanggal: 2026-11-15
> Prompt lanjutan untuk agent: [`OBSERVATION_3D_MODEL_IMPLEMENTATION_PROMPT.md`](OBSERVATION_3D_MODEL_IMPLEMENTATION_PROMPT.md)
> Status: **implemented, menunggu review owner** (lihat bagian 9: keputusan yang perlu disetujui).

Dokumen ini mengikuti `docs/WORKFLOW.md` (Fase A → D) dan format issue `.github/ISSUE_TEMPLATE/feature.md`.

---

## 1. Context

Permintaan tim (WhatsApp + voice note, diterjemahkan): ganti tampilan observasi 2D dengan **model 3D** dari aplikasi AR/VR kami, **tanpa** mengubah besar layout/UX yang sudah dibuat nyaman. Tambahkan hanya yang dibutuhkan fitur kami, ringkas dalam bentuk tombol toggle — misalnya **satu toggle untuk menampilkan/menyembunyikan hotspot** (jumlahnya banyak). Setiap perubahan wajib punya smoke test dan dicek dengan screenshot Playwright.

Temuan Fase A (ORIENT) — `VERIFIED` dari source:

- `arvr/src/xr/` di repo ini **sudah berisi** kode AR/VR kami (sama dengan `ADZaheer/nasa-arvr` `main`, termasuk fix VR/AR terbaru), plus tambahan tim (handoff observasi, `Hud` "2D Explorer", `ModePicker` `?intent=`). Jadi **tidak perlu menyalin source atau aset** — semua model, tekstur, GLB, dan 54 hotspot sudah ada di `arvr/public/` dan `arvr/content/`.
- Viewport utama Sky Explorer (`SkyExplorerScreen.tsx` → `.fe-viewport`) menampilkan `SkyScene3D`: piringan langit dekoratif (porting dari disc CSS 2D lama) dengan 3 marker target. Model 3D planet/bulan/asteroid kami **hanya** bisa dilihat dengan pindah ke rute `/xr` layar penuh.
- `ObservationComparisonScreen.tsx` menampilkan preview FITS asli (A/B). Itu **data ilmiah 2D** dan sengaja **tidak** diganti 3D (aturan: "Do not imply that a 2D astronomical image represents a physically accurate 3D volume").

## 2. Objective

Viewport observasi di Sky Explorer bisa menampilkan model 3D kami (Mars, Bulan, Bennu) secara inline — bisa diputar/zoom, dengan pin hotspot yang bisa diklik — sementara layout, kartu HUD, dock, dan alur target/observasi SPHEREx tetap sama.

## 3. Scope (yang diimplementasikan)

| Bagian | Perubahan | File |
|---|---|---|
| Viewer 3D inline | Komponen baru: `<Canvas>` sendiri + `OrbitControls`, me-render `BodyExplorer` dari XR (globe bertekstur NASA / GLB Bennu + `Hotspots`), framing otomatis untuk layar lebar & portrait, fallback teks bila WebGL gagal | `arvr/src/frontend/components/ModelViewer3D.tsx` (baru) |
| Pemilih model ringkas | Satu segmented control kecil di pojok viewport: **Sky · Mars · Moon · Bennu** (`role="radiogroup"`). State di URL `?model=` (bisa dibagikan, sesuai aturan URL-state) | `SkyExplorerScreen.tsx`, `frontend.css` |
| Toggle hotspot | Satu tombol `⦿` di toolbar yang sudah ada (hanya muncul saat model 3D aktif). Memakai setting XR yang sama (`settings.pins`), jadi pilihan ikut terbawa ke scene VR/AR | `SkyExplorerScreen.tsx` |
| Toggle VR/AR | Tombol `VR` / `AR` di toolbar, **hanya muncul bila perangkat mendukung WebXR** (`useDeviceCaps`). Membuka `/xr/body/<id>?intent=vr|ar` dengan mode picker terbuka, sehingga sesi immersive dimulai dari tap asli di dalam XR (syarat user-gesture browser) | `SkyExplorerScreen.tsx`, `arvr/src/xr/ModePicker.tsx` |
| HUD | Kartu HUD yang **sama** (tidak ada panel baru) diisi info model: nama, jumlah hotspot, label jujur, kredit. Klik pin → judul + detail hotspot + label **Fact / Illustration / Candidate** + link sumber | `SkyExplorerScreen.tsx` |
| Tombol XR di HUD | Saat model 3D aktif, "Enter 3D Table (XR)" menjadi "Open Mars in 3D / XR" (ke `/xr/body/<id>`) | `SkyExplorerScreen.tsx` |
| Judul 3D | `BodyExplorer` mendapat prop `showTitle` (default `true` → XR tidak berubah); viewer inline mematikannya karena HUD sudah menampilkan nama | `arvr/src/xr/BodyExplorer.tsx` |
| Fix kecil | Bennu sempat berlabel "Illustration" sesaat ketika JSON konten belum termuat (`<Asteroid>` dipasang tanpa URL model). Kini menunggu konten, sama seperti planet. Berlaku juga di scene XR | `arvr/src/xr/BodyExplorer.tsx` |
| Smoke test | `scripts/smoke-observation-3d.mjs` (74 cek, 3 viewport, API di-stub) + screenshot ke `docs/observation-3d/` | baru |

## 4. Out of Scope (tidak disentuh)

- Layout, spacing, warna, tipografi, Dynamic Island `TopBar.tsx`, dock, urutan kartu HUD. CSS baru **hanya ditambahkan di akhir** `frontend.css`; tidak ada rule lama yang diubah.
- `ObservationComparisonScreen.tsx` (preview FITS tetap 2D), API/backend, `api.ts`, routing di `App.tsx`, `vercel.json`, service worker.
- Scene SPHEREx table, Solar System hub, surface walk — tetap di `/xr`.
- Default viewport tetap **Sky** (target RCW 36 + pencarian observasi). Lihat keputusan D1 di bagian 9.

## 5. Technical Requirements

- **Architecture:** reuse komponen XR yang ada (`BodyExplorer`, `Hotspots`, `useBodyContent`, `useXRApp`, `useDeviceCaps`). Viewer memakai `<Canvas>` terpisah dari `XRRoot`; tidak ada sesi WebXR di halaman 2D. Seleksi hotspot dibersihkan saat ganti model / keluar, agar tidak bocor ke scene XR.
- **Dependencies:** **tidak ada dependency baru.** `@react-three/fiber`, `@react-three/drei` (`OrbitControls`), `three` sudah ada di `arvr/package.json`.
- **API:** tidak ada field API baru. Konten model dari `arvr/content/bodies/{mars,moon,bennu}.json` (sudah tervalidasi `check:content`).
- **Base path produksi:** tekstur/model dimuat lewat URL modifier `/xr/` di `src/xr/loading.ts` (di-import eksplisit oleh viewer). Sudah diuji pada build produksi di jalur `/explorer` (lihat bagian 8).
- **UI/UX:** target sentuh 44px (`--hit-target`) di semua viewport; fokus terlihat; `prefers-reduced-motion` mematikan damping/transisi.

## 6. Kejujuran ilmiah & kredit

- Tag HUD: `● 3D MODEL` (tekstur/model NASA), `● ILLUSTRATION` bila asteroid jatuh ke bentuk prosedural, dan untuk pin terpilih: label dari konten (`Fact` / `Illustration` / `Candidate (unconfirmed)`).
- Baris Source: kredit tekstur/model dari JSON konten (mis. "NASA 3D Resources (Viking-era global colour mosaic), public domain"); untuk pin, link sumber pin.
- Model planet bukan data SPHEREx; target/observasi SPHEREx tetap di mode **Sky** dengan label provenance yang lama.

## 7. Acceptance Criteria

- [x] Viewport Explorer bisa menampilkan model 3D Mars/Moon/Bennu inline, bisa diputar & di-zoom.
- [x] Satu toggle menampilkan/menyembunyikan semua hotspot; status `aria-pressed` benar.
- [x] Tombol VR/AR hanya muncul bila didukung, dan membuka scene yang sama dengan mode picker.
- [x] Layout & kartu HUD tidak berubah; tidak ada overlap/overflow baru (harness QA tim sama dengan baseline `integrasi`).
- [x] Mode Sky (RCW 36 + observasi) tetap berfungsi persis seperti sebelumnya.
- [x] Label jujur + kredit NASA tampil.
- [x] Build, smoke test, dan screenshot Playwright (desktop, 390×844, 360×800) lulus.

## 8. Testing (hasil aktual, Fase D)

Dijalankan di Windows, Edge (`playwright-core`, channel `msedge`), 2026-11-15.

| Tes | Perintah | Hasil |
|---|---|---|
| Content + type + build | `npm run build --prefix arvr` | PASS — `check-content: 54 hotspots OK`, `tsc` bersih, `built in 5.73s` |
| Frontend build | `node frontend/build.mjs` | PASS |
| Smoke 3D (dev) | `node arvr/scripts/smoke-observation-3d.mjs` (dev server `XR_HTTP=1 npx vite --port 5173`) | **74/74 PASS** |
| Smoke 3D (build produksi, jalur `/explorer` + aset `/xr/`) | sama, `--base=` server lokal yang meniru rewrite `vercel.json` | **68/68 PASS** (6 cek dev-only di-SKIP, dilaporkan eksplisit); 0 request aset gagal |
| Smoke XR | `npm run smoke:xr --prefix arvr` (preview 4173) | PASS — semua tempat di VR & AR |
| Harness QA desain tim | `node arvr/scripts/design-migration-qa.mjs --stub` | 24 layar: overflow 0, overlap 0, truncation 0, obstruction 0. Explorer `smallTargets`/`console` **identik** dengan baseline `integrasi` (diukur ulang di mesin yang sama) |
| Master integration | `node tests/test-master-integration.mjs` (backend lokal port 8000) | 23 PASS / 10 FAIL — **identik** dengan `integrasi` tanpa perubahan ini (10 FAIL sudah ada sebelumnya: Gateway capability cards, target ilustratif, disclosure Comparison, touch target responsive) |
| Backend | `python -m pytest backend/tests` | 6/6 PASS **dengan** `pytest-asyncio` (`--asyncio-mode=auto`). Tanpa plugin itu 4 tes async gagal: plugin tidak ada di `requirements.txt` (sudah begitu sebelum branch ini) |

Screenshot: `docs/observation-3d/explorer-{sky,mars}-{desktop-1280x800,390x844,360x800}.png` dan `explorer-mars-hotspot-desktop-1280x800.png`.

Belum bisa diuji di sini: Meta Quest 3 / Android AR asli (tombol VR/AR tidak muncul di desktop tanpa WebXR; alurnya diuji lewat `?intent=vr` + `smoke:xr` emulator).

## 9. Keputusan yang perlu disetujui owner

- **D1 — Default viewport.** Default tetap `Sky`, karena HUD, pencarian observasi RCW 36, dan tes tim bergantung padanya. Model 3D satu tap via pemilih. Kalau tim ingin model 3D tampil pertama kali, ubah satu baris: `DEFAULT_MODEL` di `SkyExplorerScreen.tsx` (mis. `'mars'`).
- **D2 — `?intent=vr|ar` di semua scene.** Sebelumnya hanya membuka mode picker di hub; kini di scene mana pun (dicatat di `docs/DECISIONS.md`).
- **D3 — Aturan git.** `AGENTS.md`/`WORKFLOW.md` melarang agent commit/push. Branch ini di-commit & di-push atas permintaan langsung Adnaan (anggota tim) sebagai PR ke `main` untuk direview — **tidak** di-merge.

## 10. Deferred (berikutnya)

1. Body lain di viewport (Bumi, Jupiter, dst.) — perlu file konten + hotspot dulu (`content/bodies/`).
2. Bahasa Indonesia untuk teks HUD mode 3D (layar 2D saat ini English; hotspot sudah EN/ID lewat `localHotspot`).
3. "Ask the Guide" dengan konteks body/hotspot terpilih (sekarang tetap memakai target langit).
4. Layer gambar NASA (elevasi Mars) di viewer inline — sudah ada di XR (`LayerPicker3D`).
5. Uji perangkat asli Quest 3 / Galaxy A16 untuk alur tombol VR/AR.

## 11. Agent Report — Model 3D di viewport observasi

**Date:** 2026-11-15 · **Branch:** `feat/3d-observation` · **Status:** COMPLETE (menunggu review)

### Files Changed
| File | Change Type | Summary |
|------|-------------|---------|
| `arvr/src/frontend/components/ModelViewer3D.tsx` | Created | Viewer 3D inline (BodyExplorer + OrbitControls + framing) |
| `arvr/src/frontend/components/SkyExplorerScreen.tsx` | Modified | Pemilih model, toggle hotspot & VR/AR, isi HUD mode 3D |
| `arvr/src/frontend/styles/frontend.css` | Modified (append) | Gaya `.model3d*`, `.fe-model-switch`, `.fe-xr-toggle` |
| `arvr/src/xr/BodyExplorer.tsx` | Modified | Prop `showTitle`; asteroid menunggu konten (fix label sesaat) |
| `arvr/src/xr/ModePicker.tsx` | Modified | `?intent=vr|ar` membuka picker di semua scene |
| `arvr/scripts/smoke-observation-3d.mjs` | Created | Smoke test + screenshot |
| `docs/observation-3d/*.png` | Created | Bukti screenshot |
| `docs/OBSERVATION_3D_MODEL_INTEGRATION_PLAN.md`, `docs/OBSERVATION_3D_MODEL_IMPLEMENTATION_PROMPT.md` | Created | Rencana/laporan + prompt agent |
| `docs/README.md`, `docs/DECISIONS.md` | Modified | Link indeks + catatan keputusan |

### API Fields Used
- Tidak ada field API baru. Mode Sky tetap memakai `/api/objects/{id}` dan `/api/spherex/observations` seperti sebelumnya.

### Assumptions Made
- `ASSUMPTION:` "tampilan observasi 2D" = viewport utama Sky Explorer (bukan preview FITS di Comparison, yang harus tetap 2D demi integritas ilmiah).
- `ASSUMPTION:` branch acuan `integration` = `integrasi` (tidak ada branch bernama `integration`; `integrasi` paling baru, commit "sebelum final ar vr integration").

### Known Limitations
1. Tombol VR/AR tidak terlihat di desktop tanpa WebXR (by design); belum diuji di headset asli dari halaman 2D.
2. Teks HUD mode 3D berbahasa Inggris (seperti layar 2D lainnya).

### Required Owner Actions
1. Review PR; putuskan D1 (default viewport).
2. Uji tombol VR/AR di Quest 3 / Android setelah deploy HTTPS.
