# Dokumentasi Teknis: Fitur Perbandingan Observasi SPHEREx (/comparison)
> **Master Blueprint & Technical Implementation Guide**  
> *Sesuai dengan Standar Desain Sistem di `docs/MASTER_DESIGN_OVERHAUL_PROMPT.md` dan `docs/INTEGRATION_ARCHITECTURE.md`*

Dokumen ini menjelaskan arsitektur teknis, integrasi API, manajemen state, visualisasi interaktif, dan optimalisasi performa pada halaman **Observation Comparison Tool** (`/comparison`) di proyek SPHEREx Cosmic Expedition.

---

## 1. Overview & Tujuan Ilmiah

Halaman `/comparison` dirancang sebagai instrumen perbandingan observasi multi-epoch interaktif yang mematuhi filosofi **Calm Scientific Instrument**: bersih, presisi, berwibawa, dan tenang tanpa efek neon yang berlebihan. Halaman ini menghubungkan observasi spektroskopi inframerah nyata dari survei NASA SPHEREx (*Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer*) dengan antarmuka penjelajahan modern berbasis WebXR.

### Konteks & Target Observasi: RCW 36
Secara default, halaman ini membandingkan dua snapshot observasi inframerah pada **RCW 36 Emission Nebula** (wilayah pembentukan bintang masif di *Cloud C Vela Molecular Ridge*, ~700 pc dari Bumi):
* **Epoch T1 (Observation A):** 28 Mei 2025 (SPHEREx DR1, Detektor D4, $\lambda_{\text{eff}} \approx 2.4489\ \mu\text{m}$).
* **Epoch T2 (Observation B):** 04 Juni 2026 (SPHEREx QR3, Detektor D4, $\lambda_{\text{eff}} \approx 2.4679\ \mu\text{m}$).
* **Rentang Temporal ($\Delta t$):** 371 Hari.

### Tujuan Ilmiah (Scientific Goals)
1. **Analisis Variabilitas Astrofisika:** Mengidentifikasi fluktuasi kecerahan akibat pemanasan debu circumstellar di sekitar gugus protobintang muda.
2. **Pelacakan Garis Emisi Gas Terionisasi:** Memeriksa perubahan garis emisi hidrogen terionisasi ($Br$-$\gamma$ pada rentang $2.4\ \mu\text{m}$) yang mengindikasikan proses akresi materi bintang muda.
3. **Integritas Data Spektral:** Menampilkan batasan saintifik (*disclosures*), seperti perbedaan sempit filter (*bandpass geometric overlap* 75.8%) dan kepatuhan flag kualitas Level 2 (*Bit 21 SOURCE detected*).

---

## 2. Arsitektur Komponen & UI Dashboard

Antarmuka dibangun dengan pendekatan modular di atas React 19, TypeScript, Vite, dan Three.js, disusun dalam struktur dashboard saintifik 2 kolom:

```
                    ┌────────────────────────────────────────────────────────┐
                    │               ObservationComparisonScreen.tsx          │
                    │               (Root Page & State Coordinator)          │
                    └───────────────────────────┬────────────────────────────┘
                                                │
         ┌───────────────────────┬──────────────┴────────┬───────────────────────┐
         ▼                       ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ComparisonStarfield│  │     TopBar       │    │  Comparison View │    │  Timeline & Meta │
│(30 FPS Three.js) │   │ (Dynamic Island) │    │  (Wipe / Blink / │    │ (T1 ➔ T2 Track & │
└──────────────────┘   └──────────────────┘    │      Side)       │    │    SVG Badges)   │
                                               └────────┬─────────┘    └──────────────────┘
                                                        │
                                                        ▼
                        ┌────────────────────────────────────────────────────────┐
                        │             Two-Column Scientific Dashboard            │
                        ├──────────────────────────┬─────────────────────────────┤
                        │ Column 1: Epoch Telemetry│ Column 2: Science & AI Guide│
                        │ - Epoch T1 Card (DR1)    │ - Target Astrometry Card    │
                        │ - Epoch T2 Card (QR3)    │ - Cosmic AI Assistant Card  │
                        │ - FITS Download Links    │   (Typewriter + Live Gemini)│
                        └──────────────────────────┴─────────────────────────────┘
                                                        │
                                                        ▼
                                       ┌──────────────────────────────────┐
                                       │ Scientific Integrity Disclosures │
                                       │  (Photometry, Bandpass, Flag)    │
                                       └──────────────────────────────────┘
```

### Rincian Komponen Utama

| Komponen / Bagian | File Sumber | Peran & Tanggung Jawab |
| :--- | :--- | :--- |
| **`ObservationComparisonScreen`** | `arvr/src/frontend/components/ObservationComparisonScreen.tsx` | Komponen utama yang mengatur data observasi, parameter URL (`?target=`), mode perbandingan, gesture slider dengan pointer capture, serta navigasi transisi wormhole. |
| **`ComparisonStarfield`** | `arvr/src/frontend/components/ComparisonStarfield.tsx` | Background kanvas Three.js menggunakan `THREE.Points` (1 draw call) dengan pembatas 30 FPS dan degradasi memori otomatis saat unmount. |
| **`TopBar`** | `arvr/src/frontend/components/TopBar.tsx` | Navigasi Dynamic Island terpusat dengan efek transisi wormhole overlay antar rute. |
| **`Interactive Wipe Slider`** | Internal `ObservationComparisonScreen.tsx` | Menampilkan Layer T1 di atas Layer T2 menggunakan CSS `clip-path` dan handle divider neon cyan (`#4fe3d6`) dengan penjajaran sub-pixel presisi. |
| **`Blink Comparator Stage`** | Internal `ObservationComparisonScreen.tsx` | Menampilkan T1 dan T2 secara bergantian menggunakan cross-fade opacity halus, dock kontrol melayang (*frosted dock*), tombol play/pause, dan pemilihan kecepatan. |
| **`Unified Timeline Scrubber`** | Internal `ObservationComparisonScreen.tsx` | Timeline interaktif yang berfungsi ganda sebagai indikator rentang waktu ($\Delta t = 371\text{ Hari}$) dan scrubber interaktif yang langsung menggeser slider saat disentuh/diklik. |
| **`Epoch Observation Cards`** | Internal `ObservationComparisonScreen.tsx` | 2 kartu telemetri observasi (`.fe-epoch-card`) berdesain kaca buram 4-lapisan dengan grid metrik spektral dan tombol unduh data FITS riil. |
| **`Target & Cosmic AI Card`** | Internal `ObservationComparisonScreen.tsx` | Kartu profil astrometri objek RCW 36 dan asisten AI Gemini terintegrasi dengan efek mesin tik (*typewriter*) dan tombol skip. |

---

## 3. Integrasi API Endpoints

Halaman `/comparison` berinteraksi dengan backend FastAPI (`backend/routes/`) melalui fungsi pembungkus di `arvr/src/frontend/api.ts`.

### 3.1. `GET /api/objects/{object_id}`
Mengambil informasi katalog dan koordinat astrometri objek.

* **URL:** `GET http://127.0.0.1:8000/api/objects/rcw-36`
* **Response `200 OK` (JSON):**
```json
{
  "id": "rcw-36",
  "name": "RCW 36 Emission Nebula",
  "type": "Emission Nebula / H II Region",
  "description": "A compact star-forming H II emission nebula situated within Cloud C of the Vela Molecular Ridge. Ionized by massive embedded O/B stars and observed by SPHEREx across 96 infrared spectral channels.",
  "ra": 134.8708,
  "dec": -43.7533,
  "ra_hms": "08h 59m 29s",
  "dec_dms": "-43°45′12″",
  "constellation": "Vela",
  "distance": "~700 pc (2,300 light-years)",
  "source": "NASA ADS / SIMBAD Gum 20 / IPAC IRSA SPHEREx QR3 Catalog"
}
```

### 3.2. `GET /api/image/t1` dan `GET /api/image/t2`
Mengembalikan file citra biner (PNG) hasil pra-pemrosesan data FITS SPHEREx Level 2 untuk masing-masing epoch.

* **Headers:** `Cache-Control: public, max-age=3600`
* **Content-Type:** `image/png`
* **Mekanisme Fallback:** Jika file hasil prosesan astronomi lokal belum diekspor, endpoint secara otomatis mengembalikan static assets bawaan (`/spherex/blink-a.png` dan `/spherex/blink-b.png`).

### 3.3. `POST /api/ai/chat`
Menyediakan analisis interaktif berbasis Large Language Model (Gemini 2.5/3.5) terhadap data pengamatan astronomi.

* **URL:** `POST http://127.0.0.1:8000/api/ai/chat`
* **Request Body (JSON):**
```json
{
  "message": "[Konteks Observasi SPHEREx: Objek RCW 36, Koordinat RA 134.8708° DEC -43.7533°, T1: 2025-05-28 (2.4489 µm, DR1), T2: 2026-06-04 (2.4679 µm, QR3), Overlap 75.8%]. Pertanyaan: Apa perbedaan observasi inframerah T1 vs T2 pada RCW 36?"
}
```
* **Response `200 OK` (JSON):**
```json
{
  "reply": "Perbandingan observasi inframerah SPHEREx T1 (2.45 µm) dan T2 (2.47 µm) pada nebula RCW 36 memperlihatkan variasi pancaran emisi termal debu antarbintang di sekitar gugus protobintang Cloud C Vela. Rentang waktu 371 hari ini memberikan konfirmasi stabilitas fotometri katalog serta mendeteksi garis Br-gamma hidrogen terionisasi yang dipengaruhi oleh laju akresi materi pada bintang muda bermassa besar."
}
```

---

## 4. State Management

Manajemen state diatur secara reaktif menggunakan gabungan React hooks lokal dan Zustand global store untuk handoff ke WebXR:

```
┌────────────────────────────────────────────────────────┐
│                   React Local State                    │
├──────────────────────────┬─────────────────────────────┤
│ mode: 'wipe'|'blink'|'side'│ sliderPos: 0-100 (number) │
│ blinkEpoch: 'A' | 'B'    │ blinkPlaying: boolean       │
│ blinkSpeed: 'normal'|'fast'│ isDragging: boolean       │
│ object: ObjectInfo | null│ aiFullText / aiDisplayedText│
└──────────────────────────┴─────────────────────────────┘
                             │
                             ▼ (Handoff via 'Inspect in 3D WebXR')
┌────────────────────────────────────────────────────────┐
│                 Zustand (useXRApp Store)               │
├────────────────────────────────────────────────────────┤
│ observationDataA: DEFAULT_OBS_T1                       │
│ observationDataB: DEFAULT_OBS_T2                       │
│ route: /xr/body/spherex?target=rcw-36&obs=...&obs2=... │
└────────────────────────────────────────────────────────┘
```

1. **Slider Drag Tracking & Sub-pixel Centering:**
   * Menggunakan `sliderContainerRef = useRef<HTMLDivElement>(null)`.
   * Saat pointer ditekan, dieksekusi `e.currentTarget.setPointerCapture(e.pointerId)` agar pergeseran tetap mulus meskipun jari/kursor keluar dari area kanvas.
   * Nilai `sliderPos` (0–100%) dikendalikan via CSS `left: ${sliderPos}%` dan `transform: translateX(-50%)` pada wiper handle, serta `clip-path: polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` pada Layer T1.
2. **Unified Timeline Scrubber:**
   * Track bar `.fe-timeline-interactive-track` dapat diklik atau digeser untuk langsung mengubah posisi `sliderPos`.
   * Tombol dot Epoch T1 dan T2 memiliki pemicu `onClick` untuk mengalihkan perbandingan ke ujung $0\%$ atau $100\%$.
3. **Blink Loop Engine:**
   * Dikendalikan oleh `setInterval` di dalam `useEffect`. Interval diatur ke `850ms` (mode normal) atau `450ms` (mode cepat).
   * Nilai state `blinkEpoch` bergantian antara `'A'` dan `'B'`, memicu transisi cross-fade opacity.

---

## 5. Standar UI/UX, Glassmorphism & Animasi

Seluruh elemen antarmuka diimplementasikan secara ketat berdasarkan panduan di `docs/MASTER_DESIGN_OVERHAUL_PROMPT.md`:

### 5.1. Formula Kaca Buram 4-Lapisan (.fe-glass-surface)
Diterapkan pada kartu telemetri, panel AI, timeline, dan catatan integritas:
```css
.fe-glass-surface {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(13, 27, 52, 0.42) 45%,
    rgba(6, 15, 30, 0.58) 100%
  );
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border: 1px solid rgba(79, 227, 214, 0.26);
  box-shadow: 
    inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.28),
    0 16px 36px rgba(0, 0, 0, 0.42);
  border-radius: 20px;
  color: #e2e8f0;
}
```

### 5.2. Aturan Ketat Palet Warna (No Pink/Purple Rule)
* **Warna yang Diizinkan:** Electric Sky-Blue (`#38bdf8`), Luminous Cyan/Teal (`#4fe3d6`), Deep Blue (`#0ea5e9`), dan Warm Solar Gold (`#fde047` / `#e5c07b`).
* **Warna Dilarang:** Dilarang keras menggunakan warna ungu, violet, atau pink/magenta (`#b18cff`, `#ef5b53`, dsb.).

### 5.3. Tipografi Editorial Ramping
Menggunakan `font-weight: 300` untuk deskripsi ilmiah dan body text, serta `font-weight: 500/600` untuk judul dan data numerik mono.

### 5.4. Spesifikasi Tombol Tindakan Utama (.fe-btn-primary.fe-btn-gold)
```css
.fe-btn-primary.fe-btn-gold {
  background: linear-gradient(135deg, #fde047 0%, #e5c07b 45%, #d97706 100%);
  color: #0f172a;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.6),
    0 8px 24px rgba(245, 158, 11, 0.35);
  border-radius: 999px;
  cursor: pointer;
}
```

### 5.5. Transisi Navigasi Wormhole Portal
Navigasi ke `/explorer` atau `/xr/body/spherex` mengaktifkan transisi wormhole:
```typescript
void runWormhole({ origin: originOf(event.currentTarget), minMs: 380 }, () => navigate(path))
```

---

## 6. Strategi Optimasi Performa (Anti-Lag & Mobile Ready)

Halaman `/comparison` dirancang untuk berjalan stabil di **60 FPS** di semua perangkat:

1. **Akselerasi GPU Penuh:**
   * Menggunakan `clip-path: polygon(...)` dan `transform: translate3d(...)`.
   * **Zero Layout Shift (CLS = 0):** Tidak ada manipulasi `width` atau `margin` pada perbandingan citra.
   * Properti `will-change: transform, opacity` dan `will-change: left` diterapkan secara tepat sasaran.
2. **Three.js Background Ter-throttle (ComparisonStarfield):**
   * Menggunakan 350 partikel bintang dalam 1 objek `THREE.Points` (**1 draw call**).
   * Animasi rotasi di-throttle maksimal **30 FPS**.
   * Batasan pixel ratio maksimal **1.5** (`Math.min(window.devicePixelRatio || 1, 1.5)`).
   * Pembersihan memori WebGL lengkap (`dispose()` geometri & material) saat unmount.
3. **Responsivitas 2 Kolom ke 1 Kolom:**
   * Pada layar desktop ($\ge 920\text{px}$), dashboard tersusun berdampingan dalam grid `1.05fr : 0.95fr`.
   * Pada layar tablet/mobile ($< 920\text{px}$), layout bertumpuk (*stacked*) secara mulus tanpa pemotongan konten.

---

## 7. Integrasi AI & Mekanisme Fail-Safe

Fitur tanya jawab cerdas mengintegrasikan data pengamatan teleskop dengan model AI secara kontekstual:

```
[User Action: Klik Chip / Kirim Pertanyaan]
                    │
                    ▼
[Kemas Konteks Ilmiah Objek & SPHEREx Parameters]
                    │
                    ▼
       [POST /api/ai/chat ke Backend]
                    │
      ┌─────────────┴─────────────┐
      ▼                           ▼
[Backend Sukses]           [Backend Error / Timeout]
      │                           │
      ▼                           ▼
[Typewriter Effect]        [Bilingual Fallback Text]
```

### Multi-Tier Fallback Handling:
1. **Tier 1 (Backend Error Recovery):** Jika kuota Gemini habis, `backend/services/ai_service.py` mengembalikan sintesis ilmiah default.
2. **Tier 2 (Frontend Client Fail-Safe):** Jika server backend lokal offline, blok `catch` di FE langsung menampilkan penjelasan ilmiah dwibahasa mengenai dinamika protobintang RCW 36.
3. **Tier 3 (Image Placeholder):** Jika citra FITS preview gagal dimuat, ditampilkan kartu placeholder astronomi bertema dark space dengan label metadata yang rapi.

---

## 8. Verifikasi & Pengujian

Implementasi ini telah diverifikasi melalui suite pengujian otomatis:
* **TypeScript & Build:** `cd arvr && npm run build` lulus 100% tanpa error (`✓ built in 7.04s`).
* **Selector Compatibility:** Mempertahankan seluruh selector yang dibutuhkan oleh skrip `tests/test-master-integration.mjs` (`.fe-epoch-card`, `.fe-tab`, `.fe-epoch-downloads a`, dan `.fe-scientific-notes`).
