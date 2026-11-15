# SPHEREx Cosmic Expedition — Master Design & Engineering Overhaul Blueprint
> **Dokumen Panduan Arsitektur, Sistem Desain UI/UX, Audit Baseline, dan Workflow Standar**  
> *Versi: 3.0 — Disintesiskan secara komprehensif dari seluruh dokumentasi teknis (`AGENTS.md`, `AUDIT_BASELINE.md`, `WORKFLOW.md`, `INTEGRATION_ARCHITECTURE.md`, `FRONTEND_TO_ARVR_DESIGN_MIGRATION_IMPLEMENTATION.md`, `DYNAMIC_ISLAND_NAVBAR_IMPLEMENTATION.md`, `WORMHOLE_LOADING_ANIMATION_IMPLEMENTATION.md`, dan `.agents/skills/frontend-ui-ux`).*

---

## 📋 DAFTAR ISI
1. [Ringkasan Eksekutif & Karakter Proyek](#1-ringkasan-eksekutif--karakter-proyek)
2. [Master Prompt Siap Pakai (Untuk Junior Engineer / AI Agent)](#2-master-prompt-siap-pakai-untuk-junior-engineer--ai-agent)
3. [Arsitektur Sistem & Pemahaman Audit Baseline](#3-arsitektur-sistem--pemahaman-audit-baseline)
4. [Standar Alur Kerja 4-Fase (Standard Engineering Workflow)](#4-standar-alur-kerja-4-fase-standard-engineering-workflow)
5. [Protokol Handoff & Laporan Antar-Engineer](#5-protokol-handoff--laporan-antar-engineer)
6. [Aturan Absolut & Pantangan Desain (The Non-Negotiables)](#6-aturan-absolut--pantangan-desain-the-non-negotiables)
7. [Sistem Desain & Token Visual (Design Tokens)](#7-sistem-desain--token-visual-design-tokens)
8. [Resep Lengkap Glassmorphism 4-Lapisan (Frosted Glass Blueprint)](#8-resep-lengkap-glassmorphism-4-lapisan-frosted-glass-blueprint)
9. [Spesifikasi Komponen Kunci (Button, Card, HUD, Chips)](#9-spesifikasi-komponen-kunci-button-card-hud-chips)
10. [Arsitektur Navbar Dynamic Island](#10-arsitektur-navbar-dynamic-island)
11. [Sistem Transisi Wormhole & Ambient Audio](#11-sistem-transisi-wormhole--ambient-audio)
12. [Tata Surya 3D Interaktif (SolarSystem3D)](#12-tata-surya-3d-interaktif-solarsystem3d)
13. [Protokol Integritas Ilmiah NASA & Pelabelan Data](#13-protokol-integritas-ilmiah-nasa--pelabelan-data)
14. [Checklist Pengujian & Verifikasi Build](#14-checklist-pengujian--verifikasi-build)

---

## 1. Ringkasan Eksekutif & Karakter Proyek

SPHEREx Cosmic Expedition dibangun untuk **NASA Space Apps Challenge**. Ini bukan sekadar website landing page komersial, galeri gambar statis, atau game sci-fi dengan neon berlebihan. Ini adalah **Instrumen Eksplorasi Ilmiah (*Calm Scientific Instrument*)** yang menghubungkan observasi spektroskopi inframerah nyata dari survei SPHEREx NASA (*IRSA/IPAC Caltech*) dengan antarmuka eksplorasi modern (*WebXR, Three.js, React*).

### Pilar Karakter Produk:
1. **Calm Scientific Instrument**: Bersih, presisi, berwibawa, dan tenang. Visual berfokus pada keindahan data astronomis nyata, bukan glow berlebihan pada setiap sudut.
2. **Deep Space & Frosted Glass**: Latar belakang hitam kosmis (*deep space void*), dipadukan dengan permukaan kaca buram (*glassmorphic frosted surface*) ultra-tipis, pantulan kilau atas (*specular highlight*), dan saturasi optik mendalam.
3. **Thin Editorial Typography**: Tipografi ramping (*light/regular weights*), hierarki hierarkis jelas, dan kontras tajam di atas kanvas gelap astronomi.
4. **Physical Weight & Meaningful Motion**: Setiap animasi (Dynamic Island morph, Wormhole portal, orbital spin) memiliki inersia dan bobot nyata, bukan sekadar efek fade transparan murahan.

---

## 2. Master Prompt Siap Pakai (Untuk Junior Engineer / AI Agent)

> *Salin blok prompt di bawah ini ke Junior Software Engineer atau AI Coding Assistant saat hendak memulai pengerjaan fitur:*

```markdown
Kamu adalah Software Engineer yang bertugas mengimplementasikan atau memperbaiki fitur di SPHEREx Cosmic Expedition. Proyek ini berskala besar dengan arsitektur hybrid (`backend/` FastAPI, `frontend/` Vanilla HTML referensi, `arvr/` React 19 + Three.js produksi).

IKUTI ATURAN TEKNIS, AUDIT BASELINE, DAN WORKFLOW INI SECARA MUTLAK:

1. THE GOLDEN RULE (ORIENTASI & DOKUMENTASI):
   - SEBELUM MENGUBAH SATU BARIS KODE PUN, baca dokumentasi relevan: `AGENTS.md`, `docs/AUDIT_BASELINE.md`, `docs/WORKFLOW.md`, `docs/MASTER_DESIGN_OVERHAUL_PROMPT.md`.
   - Kenali klasifikasi bukti teknis: VERIFIED (terbukti di kode), ASSUMPTION (dugaan yang butuh validasi), MISSING (belum ada), UNKNOWN (belum dipastikan).
   - Jangan pernah membuat asumsi tanpa memeriksa source code dan git status terlebih dahulu.

2. WORKFLOW 4-FASE:
   - FASE A (ORIENT): Pelajari modul yang disentuh, cek git status, pahami dependensi dan data flow.
   - FASE B (PLAN): Buat rencana konkret, tentukan daftar file yang diubah dan file yang TIDAK boleh disentuh.
   - FASE C (IMPLEMENT): Eksekusi fase-spesifik, jangan ubah modul yang tidak terkait, zero hardcoded API keys.
   - FASE D (VERIFY): Jalankan tes nyata (`check:content`, `tsc --noEmit`, `vite build`). Jangan memalsukan hasil tes!

3. ATURAN DESAIN UI/UX & GLASSMORPHISM:
   - Palet Warna Wajib: Electric Sky-Blue (`#38bdf8`), Luminous Cyan/Teal (`#4fe3d6`), Deep Blue (`#0ea5e9`), dan Warm Solar Gold (`#fde047` / `#e5c07b`).
   - ATURAN KETAT TANPA WARNA PINK/PURPLE: Seluruh elemen (partikel, bintang, kurva SVG, tag, koordinat ilustratif, nebula wormhole) DILARANG menggunakan warna ungu/pink/magenta (#b18cff, #ef5b53, dsb.).
   - Tipografi: Gunakan font tipis elegan (`font-weight: 300` untuk body/deskripsi, `400/500` untuk judul/label).
   - Formula Glassmorphism Kaca Buram:
     * Background: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(13,27,52,0.42) 50%, rgba(6,15,30,0.6) 100%)`
     * Optical blur: `backdrop-filter: blur(28px–32px) saturate(190%–200%)`
     * Specular Top Highlight: `box-shadow: inset 0 1.5px 1px 0 rgba(255,255,255,0.28), 0 16px 36px rgba(0, 0, 0, 0.45)`
     * Hairline Border: `border: 1px solid rgba(79, 227, 214, 0.28)`

4. DYNAMIC ISLAND NAVBAR:
   - Pertahankan morfosis 3-state: `top` (bar penuh di scrollY <= 8), `island` (kapsul melayang di scrollY > 24), dan `island-open` (menu mobile).
   - Garis animasi linear gradient di sekeliling navbar HANYA boleh aktif saat melayang (`data-state="island"`), dan wajib hilang saat kembali ke posisi statis atas (`data-state="top"`).
   - Opsi bahasa EN/ID dan tombol titik dekoratif telah dihapus (jangan dimunculkan kembali).

5. SISTEM TRANSISI WORMHOLE:
   - Navigasi antar-halaman dari selector navbar WAJIB memanggil `runWormhole({ origin, label, waitForScene, minMs }, () => navigate(to))`.
   - `origin` berpusat langsung pada elemen tombol yang diklik (`originOf(event.currentTarget)`).
   - Durasi 2D dibuat cepat (`minMs: 380`), sedangkan transisi ke XR menunggu kesiapan 3D (`waitForScene: true`, `minMs: 650`).

6. TATA SURYA 3D (SolarSystem3D):
   - Tampilkan 8 planet lengkap dengan proporsi realistis (Jupiter/Saturnus terbesar), cincin Saturnus 3D miring dengan Divisi Cassini.
   - Starfield wajib menggunakan `THREE.InstancedMesh` (1 draw call untuk seluruh bintang).
   - Batasi pixel ratio: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))` untuk menjaga 60 FPS stabil.
   - Inti matahari menggunakan glow halus (dual-layer additive sprite pulse) tanpa post-processing bloom yang berat.

7. INTEGRITAS DATA NASA & GIT:
   - Bedakan data asli (`FACT / ● LIVE NASA ARCHIVE`) dengan data simulasi (`DEMO / CANDIDATE / ILLUSTRATIVE`).
   - PERATURAN GIT: Dilarang `git commit`, `git push`, `git merge`, atau deployment (hanya repository owner).
```

---

## 3. Arsitektur Sistem & Pemahaman Audit Baseline

Berdasarkan audit teknis read-only (`docs/AUDIT_BASELINE.md`), sistem SPHEREx mengadopsi arsitektur hybrid yang terbagi dalam tiga modul utama:

```
                          SPHEREx Cosmic Expedition
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
   [ backend/ ]                 [ frontend/ ]                  [ arvr/ ]
  FastAPI + Astropy            Vanilla HTML/CSS             React 19 + Three.js
  IRSA / IPAC Queries           Design Reference             Active Web App + WebXR
  (Python 3.10+)                (Read-Only Baseline)         (Vite + Tailwind/Custom CSS)
```

### 3.1 Status Modul yang Diverifikasi (`VERIFIED`)
1. **`backend/`**:
   - FastAPI melayani endpoint metadata, citra astronomi FITS, APOD, NEO, dan status sistem.
   - Menggunakan dependensi astrofisika: `astropy`, `astroquery`, `numpy`, `matplotlib`, `httpx`.
   - Memiliki file produk data riil: `backend/level2_2025W36_...cutout.fits` (5,060,160 bytes, valid SPHEREx Level 2 Quick Release 3).
2. **`frontend/`**:
   - `frontend/spherex-expedition.html` adalah **desain referensi historis (READ-ONLY)**. Jangan disalin mentah, jangan di-route terpisah, dan jangan memindahkan node DOM-nya secara imperatif.
3. **`arvr/`**:
   - Aplikasi klien web produksi aktif. Menangani rute 2D (`GatewayScreen`, `SkyExplorerScreen`, `ObservationComparisonScreen`, `CosmicGuideScreen`) dan scene 3D WebXR (`SolarSystemHub`, `SpherexTable`, `BodyExplorer`).

### 3.2 Endpoint API Utama yang Tersedia:
| Route | Method | Deskripsi | Status Audit |
|---|---|---|---|
| `/api/status` | GET | Status kesehatan backend & engine data | `VERIFIED` |
| `/api/image/t1` | GET | Citra FITS PNG Epoch 1 (`hasil_gambar.png`) | `VERIFIED` |
| `/api/image/t2` | GET | Citra FITS PNG Epoch 2 (`hasil_gambar_2.png`) | `VERIFIED` |
| `/api/metadata/fits` | GET | Ekstraksi header FITS (`TELESCOP`, `DATE-OBS`, `RA`, `DEC`) | `VERIFIED` |
| `/api/objects/{object_id}` | GET | Kamus data target astronomis | `VERIFIED` |
| `/api/nasa/apod` | GET | NASA Astronomy Picture of the Day live dengan fallback | `VERIFIED` |

### 3.3 Discovered Technical Risks & Gaps (Wajib Diperhatikan):
- **Keamanan Kunci API**: Dilarang meletakkan API key NASA di kode sumber. Kunci wajib melalui environment variable `NASA_API_KEY`.
- **Target Katalog**: Target resmi tantangan (Barnard's Star, WISE 0855-0714, Epsilon Indi B, RW Aurigae, R Draconis) harus ditangani dengan pembedaan data riil vs ilustratif secara jujur.
- **Citra Temporal (T2)**: File citra kedua harus ditandai jelas apakah merupakan observasi berbeda atau replika sampel.

---

## 4. Standar Alur Kerja 4-Fase (Standard Engineering Workflow)

Setiap sesi pekerjaan fitur atau perbaikan antarmuka WAJIB mematuhi siklus **ORIENT $\rightarrow$ PLAN $\rightarrow$ IMPLEMENT $\rightarrow$ VERIFY** (`docs/WORKFLOW.md`):

```
 ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
 │ FASE A:       │     │ FASE B:       │     │ FASE C:       │     │ FASE D:       │
 │    ORIENT     │ ──► │     PLAN      │ ──► │   IMPLEMENT   │ ──► │    VERIFY     │
 └───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
  Baca docs, cek        Tentukan scope,       Coding terarah,       Build tsc, test,
  git status,           identifikasi risiko   reuse komponen,       laporan faktual
  pahami konteks.       & no-touch files.     zero secrets.         tanpa fabrikasi.
```

### Fase A: ORIENT (Orientasi)
- [ ] Baca `AGENTS.md` (aturan non-negotiable repository).
- [ ] Baca `docs/AUDIT_BASELINE.md` dan `docs/WORKFLOW.md`.
- [ ] Tentukan modul yang akan disentuh (`arvr/`, `backend/`, dsb.).
- [ ] Jalankan `git status` untuk memeriksa uncommitted changes milik developer/pengguna lain (JANGAN DITIMPA).
- [ ] Periksa branch yang aktif.

### Fase B: PLAN (Perencanaan)
- [ ] Tulis acceptance criteria yang terukur.
- [ ] Tentukan daftar file yang **akan diubah**.
- [ ] Tentukan daftar file yang **TIDAK BOLEH disentuh**.
- [ ] Identifikasi dependensi visual/logika dan tandai setiap dugaan sebagai `ASSUMPTION`.

### Fase C: IMPLEMENT (Implementasi)
- [ ] Satu tugas pada satu waktu (*controlled scope*).
- [ ] Gunakan kembali (*reuse*) komponen arsitektur yang sudah ada.
- [ ] Terapkan token CSS terstandarisasi (`fe-*`).
- [ ] Jangan pernah mengubah modul di luar cakupan tugas.
- [ ] Jika terjadi masalah tak terduga: **Stop dan laporkan**, jangan melakukan auto-fix di luar tugas.

### Fase D: VERIFY (Verifikasi)
- [ ] Jalankan pengecekan konten: `npm run check:content --prefix arvr`.
- [ ] Jalankan typecheck TypeScript: `npx tsc --noEmit --prefix arvr`.
- [ ] Jalankan build produksi: `npm run build --prefix arvr`.
- [ ] Catat hasil aktual (status keluar kode 0, ukuran bundle, log error bila ada). Dilarang keras merekayasa hasil tes!

---

## 5. Protokol Handoff & Laporan Antar-Engineer

Ketika seorang engineer menyelesaikan tugas dan menyerahkannya ke engineer berikutnya (atau saat berkolaborasi dengan AI Agent), format laporan baku berikut WAJIB disertakan:

```markdown
## Engineering Handover Report — [Nama Fitur / Tugas]

**Date:** YYYY-MM-DD  
**Branch:** [branch-name]  
**Status:** COMPLETE / PARTIAL / BLOCKED  

### 1. Files Changed
| File Path | Status | Ringkasan Perubahan |
|---|---|---|
| `arvr/src/frontend/components/...` | Modified | Deskripsi ringkas |

### 2. Behavior Added / Changed
- Deskripsi fungsionalitas baru yang ditambahkan
- Dampak perubahan terhadap komponen yang berdekatan

### 3. Design Tokens & Components Used
- Token CSS: misal `var(--teal)`, `var(--glass-blur)`
- Komponen: misal `SolarSystem3D`, `runWormhole()`

### 4. Assumptions & Technical Decisions
- `ASSUMPTION: [apa yang diasumsikan dan alasannya]`
- Keputusan arsitektur yang diambil (jika menyentuh multi-modul, rujuk `docs/DECISIONS.md`)

### 5. Verification Commands & Results
```bash
npm run check:content --prefix arvr   # Output aktual
npx tsc --noEmit --prefix arvr         # Output aktual
npm run build --prefix arvr            # Output aktual
```

### 6. Known Limitations & Next Steps
- Catatan hal yang sengaja belum dicakup atau butuh integrasi backend lanjutan.
```

---

## 6. Aturan Absolut & Pantangan Desain (The Non-Negotiables)

1. **NO PINK / MAGENTA / PURPLE RULE**:
   - Seluruh warna ungu/violet/pink diwarisi dari prototipe lama telah dihapus sepenuhnya.
   - Dilarang keras menggunakan kode warna: `#b18cff`, `#ef5b53`, `#b72e59`, `#9a5572`, `#d889a8`, `#ad83f1`, `rgba(175, 140, 255, ...)`, atau `150,120,255`.
   - Gunakan selalu **Electric Sky-Blue (`#38bdf8`)**, **Teal (`#4fe3d6`)**, atau **Warm Gold (`#fde047` / `#e5c07b`)**.

2. **PERTAHANKAN STRUKTUR DYNAMIC ISLAND**:
   - Navbar di `TopBar.tsx` menggunakan state `top`, `island`, dan `island-open`.
   - Jangan pernah mengganti struktur DOM pulau dengan navbar statis konvensional.
   - Pertahankan spacer layout (`.fe-topbar-spacer`) agar tidak ada loncatan konten (*layout shift / CLS*).

3. **BATASAN GIT STRICT (NON-NEGOTIABLE)**:
   - Dilarang `git commit`, `git push`, `git merge`, dan deployment langsung. Seluruh operasi tersebut merupakan hak prerogatif pemilik repository (*repository owner*).

4. **PERFORMA 60 FPS & BATASAN KANVAS**:
   - Dilarang menganimasikan filter blur berulang kali di RAF. Animasikan hanya `transform` dan `opacity`.
   - Batasi Device Pixel Ratio (DPR) maksimal 1.5 pada kanvas WebGL.
   - Starfield wajib menggunakan `THREE.InstancedMesh`.

---

## 7. Sistem Desain & Token Visual (Design Tokens)

Definisi token CSS resmi di `arvr/src/frontend/styles/frontend.css`:

```css
:root {
  /* Palet Warna Utama (Strict Cosmic Palette) */
  --teal: #4fe3d6;
  --teal-rgb: 79, 227, 214;
  --sky-blue: #38bdf8;
  --sky-blue-rgb: 56, 189, 248;
  --deep-blue: #0ea5e9;
  --gold: #fde047;
  --gold-warm: #e5c07b;
  --amber: #f59e0b;
  --danger: #f87171;

  /* Ruang Angkasa & Latar Belakang (Space Canvas) */
  --fe-bg: #030712;
  --fe-bg-subtle: #060f1e;
  --fe-card-bg: rgba(13, 27, 52, 0.38);
  --fe-card-border: rgba(79, 227, 214, 0.28);

  /* Tipografi Editorial */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  --font-weight-thin: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Glassmorphism Specs */
  --glass-blur: 28px;
  --glass-saturate: 190%;
  --glass-specular: inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.28);
  --glass-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);

  /* Durasi & Easing */
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 180ms;
  --dur-normal: 280ms;
  --dur-morph: 380ms;
}
```

---

## 8. Resep Lengkap Glassmorphism 4-Lapisan (Frosted Glass Blueprint)

Seluruh Card, HUD, Modal, dan Container utama harus menerapkan resep 4-lapisan ini:

```css
/* FORMULA KACA BURAM RESMI: .fe-glass-surface */
.fe-glass-surface {
  /* Lapisan 1: Gradien Latar Semi-Transparan (Depth Gradient) */
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(13, 27, 52, 0.42) 45%,
    rgba(6, 15, 30, 0.58) 100%
  );

  /* Lapisan 2: Optical Blur Mendalam + Saturasi Optik */
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);

  /* Lapisan 3: Hairline Border Teal Presisi */
  border: 1px solid rgba(79, 227, 214, 0.26);

  /* Lapisan 4: Dual Specular Reflection (Pantulan Cahaya Atas & Bayangan Luar) */
  box-shadow: 
    inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.28),
    0 16px 36px rgba(0, 0, 0, 0.42);

  border-radius: 18px;
  color: #e2e8f0;
}

/* Fallback Elegan untuk Browser Tanpa Dukungan Backdrop Filter */
@supports not (backdrop-filter: blur(1px)) {
  .fe-glass-surface {
    background: rgba(8, 17, 34, 0.94);
  }
}
```

---

## 9. Spesifikasi Komponen Kunci (Button, Card, HUD, Chips)

### A. Primary Action Button (`.fe-btn-primary`)
Kapsul bercahaya teal-cyan dengan specular highlight atas yang tajam:
```css
.fe-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 26px;
  border-radius: 999px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #030712;
  background: linear-gradient(135deg, #4fe3d6 0%, #38bdf8 50%, #0ea5e9 100%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 
    inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.5),
    0 8px 24px rgba(79, 227, 214, 0.35);
  cursor: pointer;
  transition: all 0.22s var(--ease-spring);
  text-decoration: none;
}

.fe-btn-primary:hover {
  transform: translateY(-1.5px);
  box-shadow: 
    inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.6),
    0 12px 30px rgba(56, 189, 248, 0.45);
}

.fe-btn-primary:active {
  transform: translateY(0.5px) scale(0.98);
}
```

### B. Active Selector Button (`.fe-nav-link.active`)
Kapsul kaca transparan dengan pendaran lembut:
```css
.fe-nav-link.active {
  color: #ffffff;
  font-weight: 500;
  background: linear-gradient(135deg, rgba(79, 227, 214, 0.22) 0%, rgba(56, 189, 248, 0.12) 100%);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(79, 227, 214, 0.45);
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 0 16px rgba(79, 227, 214, 0.22);
}
```

### C. Scientific Telemetry & Metadata Card (`.fe-hud-card`)
Card kaca buram penampil informasi citra observasi dan spektroskopi:
```css
.fe-hud-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(13, 27, 52, 0.45) 50%, rgba(6, 15, 30, 0.6) 100%);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border: 1px solid rgba(79, 227, 214, 0.28);
  border-radius: 18px;
  box-shadow: inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.25), 0 16px 36px rgba(0, 0, 0, 0.45);
  padding: 18px 22px;
}
```

---

## 10. Arsitektur Navbar Dynamic Island

Navbar mengelola transisi morfosis fisik:
- **`top`**: Selebar layar penuh, menyatu tenang dengan background saat posisi scroll di atas (`scrollY <= 8`).
- **`island`**: Kapsul melayang di tengah layar saat di-scroll ke bawah (`scrollY > 24`).
- **`island-open`**: Menu mobile yang mengembang ke bawah tanpa membuat layout meloncat.

### Aturan Animasi Linear Gradient Border:
- **HANYA muncul saat floating** (`data-state="island"` atau `data-state="island-open"`).
- Otomatis **nonaktif / hilang** saat kembali ke posisi atas (`data-state="top"`).

```css
/* Border Animasi Mengalir HANYA saat Floating */
.fe-topbar[data-state="island"] .fe-island,
.fe-topbar[data-state="island-open"] .fe-island {
  border: 1px solid transparent;
  background-image: 
    linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(13, 27, 52, 0.42) 45%, rgba(6, 15, 30, 0.58) 100%),
    linear-gradient(90deg, #4fe3d6, #38bdf8, #0ea5e9, #4fe3d6);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  background-size: 100% 100%, 200% 100%;
  animation: fe-island-border-flow 6s linear infinite;
}

@keyframes fe-island-border-flow {
  0% { background-position: 0% 0%, 0% 0%; }
  100% { background-position: 0% 0%, 200% 0%; }
}

.fe-topbar[data-state="top"] .fe-island {
  border: 1px solid rgba(255, 255, 255, 0.08);
  animation: none;
}
```

---

## 11. Sistem Transisi Wormhole & Ambient Audio

Semua navigasi antar-halaman web menggunakan portal wormhole responsif:

```tsx
import { originOf, runWormhole } from '../wormhole'
import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()

const handleNavClick = (event: React.MouseEvent<HTMLElement>, to: string) => {
  if (location.pathname === to) return
  event.preventDefault()

  // Buka portal tepat dari titik tengah elemen yang diklik
  const origin = originOf(event.currentTarget)
  const isToXR = to.startsWith('/xr')

  void runWormhole(
    {
      origin,
      label: 'Membuka Sky Explorer…',
      waitForScene: isToXR,       // false untuk transisi cepat 2D, true untuk 3D XR
      minMs: isToXR ? 650 : 380, // Snappy floor
    },
    () => navigate(to)
  )
}
```

- **Ambient Audio**: Musik latar kosmis dikelola via `src/frontend/audio/ambientAudio.ts` singleton. Status toggle `♪ / ♪̸` persisten di `localStorage['spherex.ambient.music']`.

---

## 12. Tata Surya 3D Interaktif (SolarSystem3D) — Stylized / Cartoon CGI

Kanvas landing page (`SolarSystem3D.tsx`) menampilkan tata surya 3D bergaya **Stylized / Cartoon CGI (seperti Spider-Verse / anime)** berkinerja tinggi:

1. **Warna Saturated & Solid (Pop Cartoon Materials)**:
   - Warna planet pop, flat, dan berani tanpa tekstur foto-realistis gelap yang kusam:
     - **Merkurius**: Solid silver-slate (`#94a3b8`) dengan kawah poligon grafis.
     - **Venus**: Kuning keemasan cerah berseri (`#fef08a` / `#facc15`).
     - **Bumi & Bulan**: Samudra biru cerah (`#0ea5e9`), benua hijau zamrud kartun (`#22c55e`), dan pusaran awan komik putih. Bulan berupa bola putih mini bergaya anime.
     - **Mars**: Merah menyala superhero (`#ef4444`) dengan bayangan crimson dan tudung es kutub putih bersih.
     - **Jupiter**: Raksasa oranye-tangerine (`#f97316`) dengan pita garis kontras krem-kuning dan Great Red Spot komik ikonik (`#dc2626`).
     - **Saturnus**: Madu emas saturated (`#fde047`) dengan cincin kartun grafis bercahaya bergradasi kontras tinggi dan celah divisi Cassini.
     - **Uranus**: Raksasa es mint-cyan akwamarin (`#2dd4bf`).
     - **Neptunus**: Biru safir elektrik anime (`#2563eb`) dengan garis badai metana biru muda (`#38bdf8`).
2. **Pencahayaan Terang (Anti-Gelap)**:
   - `AmbientLight` berintensitas tinggi (`1.45`) memastikan seluruh permukaan planet berwarna solid, cerah, dan terbebas dari bayangan hitam berlumpur.
   - `PointLight` matahari berintensitas `6.5` dan `DirectionalLight` (`0.65`) dari arah kamera memberikan kontras pop yang hidup.
3. **Orbit Berupa Trail Menyala (Glowing Neon Speedlines)**:
   - Menggantikan garis kawat tipis dengan **jejak menyala (speedline anime / neon trail)** yang membentang $\sim 100^\circ$ di belakang setiap planet yang bergerak.
   - Menggunakan `THREE.Line` dengan vertex color gradient yang memudar dari 1.0 (sangat terang tepat di belakang planet) hingga 0.0 (ekor jejak) dan blending additive, terpasang langsung pada orbit pivot untuk performa 60 FPS tanpa beban CPU.
4. **Framing Kamera Responsif (Anti-Kepotong di HP/Tablet/Laptop)**:
   - Perhitungan dinamis `targetHalfSpan = 15.6` dengan margin aman $14\%$ memastikan orbit Neptunus tidak pernah terpotong di layar mana pun.
   - Pada layar sempit/mobile portrait (`aspect < 1`), kamera otomatis mundur (*zoom out*), sementara pada desktop widescreen kamera maju untuk tampilan heroik.
5. **Starfield InstancedMesh & Batasan DPR**:
   - 750 bintang 3D tetap menggunakan `THREE.InstancedMesh` (hanya 1 single draw call).
   - Pixel ratio dibatasi maksimal `1.5` (`Math.min(window.devicePixelRatio, 1.5)`) demi menjamin 60 FPS stabil.
6. **Interaktivitas Raycaster**:
   - Raycaster mendeteksi planet saat didekati kursor dan menampilkan pill nama planet serta jarak AU di HUD bawah.

---

## 13. Protokol Integritas Ilmiah NASA & Pelabelan Data

Setiap data yang ditampilkan wajib mengikuti aturan taksonomi ketat:

```
FACT          = Data terverifikasi dari arsip NASA IRSA SPHEREx
CANDIDATE     = Titik data kandidat yang belum dikonfirmasi
DEMO          = Data peraga/sampel, bukan observasi nyata
LOCAL FALLBACK= Data lokal karena sambungan offline
LIVE QR3      = Data dari SPHEREx Quick Release 3 (aktual)
```

### Pantangan Keras Integritas Data:
- Jangan pernah melabeli data demo sebagai data observasi NASA nyata.
- Jangan mengklaim perbandingan citra temporal sebagai "penemuan planet/objek baru".
- Jangan menggabungkan filter detektor inframerah yang berbeda menjadi citra warna RGB palsu tanpa tanda *disclaimer*.
- Jangan menyatakan gambar astronomi 2D sebagai model volume 3D fisik.

---

## 14. Checklist Pengujian & Verifikasi Build

Setiap engineer yang selesai melakukan perubahan WAJIB menjalankan verifikasi:

```bash
# Masuk ke direktori frontend produksi
cd arvr

# 1. Validasi integritas hotspot dan konten
npm run check:content

# 2. Pemeriksaan tipe TypeScript tanpa emit file
npx tsc --noEmit

# 3. Pengujian build produksi Vite
npm run build
```

**Kriteria Lulus Wajib:**
- `check-content: 54 hotspots OK`
- `tsc --noEmit` keluar dengan kode `0` (tanpa error tipe).
- `vite build` selesai dengan kode `0` dan ringkasan asset terkompilasi.
- Seluruh tombol ("Enter expedition", "Explore capabilities", "NASA APOD Highlight") dapat diklik dan transisi wormhole berjalan mulus.

---
*Dokumen ini merupakan panduan tunggal resmi arsitektur UI/UX, audit baseline, dan workflow SPHEREx Cosmic Expedition.*
