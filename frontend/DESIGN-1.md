# DESIGN SPECIFICATION — SPHEREx Cosmic Expedition

> Dokumen ini adalah spesifikasi desain UI/UX, arsitektur informasi, visual direction, design tokens, dan developer handoff guide untuk **SPHEREx Cosmic Expedition**. Dibuat berdasarkan arahan produk pada [PLAN.md](file:///c:/Users/ahmad/OneDrive/Documents/AR,VR%20NASA/nasa-arvr/docs/PLAN.md) dan hasil audit teknis komponen XR yang ada di repositori.

---

## 1. Executive Summary & Product Promise

* **Nama Produk:** SPHEREx Cosmic Expedition
* **Format:** XR-First Web Experience (3D Celestial Sphere & Sky Tile Exploration) dengan dukungan multi-mode: WebXR Immersive VR, WebXR Handheld/Passthrough AR, Mobile Gyro, dan Desktop 3D Orbit fallback.
* **Product Promise:** Mengajak pengguna menjelajahi data observasi langit inframerah SPHEREx dalam lingkungan 3D spasial, memilih target astronomi (emisi nebula, galaksi, kandidat bergerak), memeriksa metadata ilmiah, dan membandingkan perubahan antar-observasi pada epoch waktu berbeda (T1 vs T2).
* **Prinsip Utama:**
  1. *3D Scene is the Hero:* UI disajikan sebagai HUD kontekstual / kartu spasial 3D, bukan dashboard 2D yang menutupi scene.
  2. *Scientific Clarity over Sci-Fi Decoration:* Data, timestamp, dan sumber diprioritaskan.
  3. *Show Change, Do Not Invent Motion:* Observasi antar-waktu disajikan sebagai snapshot diskret, bukan video animasi kontinu.
  4. *Honesty in Data:* Bedakan secara eksplisit objek terverifikasi katalog (*Fact*), kandidat (*Candidate*), dan data peraga (*Demo/Illustration*).

---

## 2. Design Tokens & Foundations

### 2.1 Color Palette

| Token Name | Hex / RGBA Value | Peran & Penggunaan |
|---|---|---|
| `--color-space-deep` | `#070B1F` | Background scene 3D WebGL / celestial sphere |
| `--color-panel-surface` | `rgba(11, 24, 32, 0.85)` | Latar belakang panel 3D (`uiMat('#0b1820')`) dan DOM Card |
| `--color-panel-border` | `rgba(79, 227, 214, 0.35)` | Rim / border panel spasial (`uiMat(UI.rim)`) |
| `--color-accent-teal` | `#4FE3D6` | Aksi utama, jalur orbit aktif, marker objek katalog (*Fact*) |
| `--color-accent-violet` | `#8B5CF6` / `#B18CFF` | Label spektral channel, marker kandidat (*Candidate*) |
| `--color-status-amber` | `#F59E0B` | Peringatan, data simulasi / peraga (*Demo / Illustration*) |
| `--color-text-primary` | `#FFFFFF` | Judul, heading kartu, nilai koordinat aktif |
| `--color-text-secondary`| `#C7CDE6` | Deskripsi badan teks, keterangan kontrol |
| `--color-text-muted` | `#8FB4FF` / `#8892B0` | Attribution, metadata FITS header, caption sumber |

### 2.2 Typography Hierarchy

* **Primary Interface Font:** Sans-Serif bersih (`Roboto` / `Inter`). Digunakan untuk judul, tombol aksi, dan narasi panduan.
* **Telemetry & Data Font:** Monospaced (`Roboto Mono` / `Courier New`). Digunakan secara konsisten untuk:
  * Koordinat Astronomi (misal: `RA 08h 59m 29s`, `Dec -43°45'12"`).
  * Observation Identifier (`PIA26354`, `SPHEREx_SURVEY_T1`).
  * Timestamp ISO-8601 (`2025-07-02T14:22:10Z`).
  * FITS Keyword metadata (`EXPTIME: 120s`, `WAVELEN: 2.4μm`).

### 2.3 Spatial Ergonomics (Headset VR & AR Rules)

* **Viewing Distance (VR):** Panel antarmuka 3D ditempatkan pada jarak optimal **1.1 m – 1.4 m** di depan mata pengguna.
* **Vertical Offset:** Diletakkan 10° – 15° di bawah ketinggian mata (eye level) untuk mencegah ketegangan leher (*neck fatigue*).
* **Target Size:** Target interaksi spasial minimal berukuran **0.12 m × 0.12 m** di world space dengan padding minimal 0.04 m.
* **Motion Comfort:**
  * Tidak ada rotasi kamera paksa (*forced yaw/pitch camera animation*).
  * Fade-through-black veil saat perpindahan rute/scene untuk mencegah motion sickness.
  * Target refresh rate headset: stabil pada **72 Hz**.

---

## 3. Information Architecture & Navigation

```text
COSMIC GATEWAY (/xr)
  ├── Mission Intro (Pengenalan misi & data inframerah SPHEREx)
  ├── Device Capability Checker (Deteksi otomatis VR, AR, Gyro, Desktop)
  └── CTA: [Enter Expedition]
            │
            ▼
IMMERSIVE SKY EXPLORER (/xr/body/:id?band=...&obs=...)
  ├── 3D Sky Environment (Celestial dome / All-sky representation)
  ├── Observation Layer (Petak citra observasi SPHEREx)
  ├── Target Hotspots (Pin penanda objek dengan klasifikasi Fact/Candidate/Demo)
  ├── Spatial HUD / Context Card:
  │     ├── Target Metadata (Nama, ID, Deskripsi singkat)
  │     ├── Provenance & Source Link (NASA/JPL)
  │     ├── Action: [Ask AI Guide]
  │     └── Action: [Compare Observations Across Time]
  └── Mode Dock (Reset View, Recenter VR, Audio, Exit)
            │
            ▼
SCREEN 2A: OBSERVATION COMPARISON (Spatial Sub-State)
  ├── Comparison Header (Observation A / T1 vs Observation B / T2)
  ├── Inspection Modes:
  │     ├── Mode 1: Blink Mode (Bergantian otomatis / manual antar T1 dan T2)
  │     ├── Mode 2: Side-by-Side (Dua panel spasial berdampingan di ruang 3D)
  │     └── Mode 3: Split / Wipe Slider (Transisi swipe komparasi citra)
  ├── Scientific Honesty Banner: "Discrete observations — not continuous video"
  └── Action: [Return to Sky Explorer]
```

---

## 4. Deliverable Frame Inventory (Figma Breakdown)

Berikut adalah 6 frame/artboard deliverable utama yang disiapkan untuk implementasi UI/UX:

### Frame 01 — Cosmic Gateway (`/xr`)
* **Ukuran Frame:** Desktop (1920×1080) dan Mobile (390×844).
* **Komponen:**
  * `TopBar`: Brand title `SPHEREx Cosmic Expedition`, language switch (`EN / ID`), connection badge.
  * `HeroSection`: Visual preview halus medan bintang inframerah, headline *"Journey Through 96 Infrared Colors"*, ringkasan misi 1 kalimat.
  * `CapabilityDock`: Menampilkan mode yang didukung perangkat (`Desktop 3D`, `Gyroscope`, `WebXR AR`, `WebXR VR`).
  * `EnterButton`: Tombol CTA utama masuk ke scene 3D.
  * `StepGuide`: 3 langkah eksplorasi: *Navigate Sky → Select Observation → Compare Across Time*.

### Frame 02 — Immersive Sky Explorer (`/xr/body/:id`)
* **Ukuran Frame:** Desktop 3D Viewport (1920×1080) & VR FOV Spec (1200×1200 stereoscopic reference).
* **Komponen:**
  * `SkyViewport`: Proyeksi petak observasi langit (Three.js canvas).
  * `HotspotMarker`: Pin bercahaya pada koordinat RA/Dec dengan status warna (`Fact` = Teal, `Candidate` = Violet, `Demo` = Amber).
  * `ContextHUD` (Desktop: DOM Overlay; VR: Spatial Glass Panel):
    * Judul objek (misal: *RCW 36 Emission Nebula*).
    * Tag kategori.
    * Ringkasan 25 kata + ekspansi detail 80 kata.
    * Kredit data NASA/JPL.
    * Tombol aksi: `Ask the Guide` dan `Compare Observations`.

### Frame 03 — Observation Comparison State (Screen 2A)
* **Ukuran Frame:** Desktop (1920×1080) & Spatial VR Dual-Panel layout.
* **Komponen:**
  * `ComparisonHeader`: Judul perbandingan wilayah target + ID Observasi A dan B.
  * `EpochMetadataCards`: Dua kartu ringkas menampilkan timestamp, filter band, dan ID sumber masing-masing epoch.
  * `ModeControls`: Tab pemilih mode `[Blink Comparator]`, `[Side-by-Side]`, dan `[Wipe Slider]`.
  * `HonestyNotice`: Badge amber permanen: *"Two separate observation snapshots — not continuous motion video"*.
  * `ExitButton`: Tombol kembali ke navigasi langit bebas.

### Frame 04 — AR Interaction States (Tabletop Mobile & Passthrough)
* **Ukuran Frame:** Mobile Portrait (390×844) & Quest Passthrough view.
* **Komponen & State:**
  * `State 4A (Scanning)`: Overlay panduan *"Point your camera at a flat table surface"*.
  * `State 4B (Reticle)`: Reticle melingkar cyan (`ARPlacement.tsx`) mengikuti kontur permukaan meja via WebXR Hit-Test.
  * `State 4C (Placed)`: Petak observasi SPHEREx terkunci di atas meja dengan piringan koordinat.
  * `State 4D (Reposition)`: Tombol `Move Model` untuk melepaskan anchor dan memindahkan petak.
  * `State 4E (No Hit-Test Fallback)`: Banner pemberitahuan jika perangkat tidak memiliki sensor ARCore/hit-test (*"Placed 0.8m in front of you"*).

### Frame 05 — VR Interaction States (Meta Quest / 6DoF)
* **Ukuran Frame:** VR Headset In-Camera Spatial View.
* **Komponen & State:**
  * `RaycastPointer`: Garis laser controller dengan reticle titik dan efek haptic saat mengenai marker target.
  * `GazeDwellIndicator`: Cincin progres melingkar 1.5 detik (`GazeDwell.tsx`) untuk interaksi hands-free.
  * `SpatialGlassCard`: Kartu 3D melayang dengan material glass semi-transparan (`GlassPanel`) dan teks 3D SDF (`Text`).
  * `WristPalette`: Menu cepat di pergelangan tangan kiri (Recentering origin, Audio toggle, FPS meter, Exit VR).

### Frame 06 — System, Empty & Edge States
* **Ukuran Frame:** Modular State Overlays (1920×1080 & 3D Cards).
* **Komponen & State:**
  * `LoadingState`: Garis progres tipis dengan latar belakang kosmik lembut (`SceneLoadTracker`).
  * `MissingDataState`: Kartu informatif saat citra/band tertentu belum tersedia (*"No observation data available for this band"*).
  * `APIErrorState`: Panel penanganan kesalahan dengan tombol `Retry Connection` dan opsi melihat sampel lokal offline.
  * `UnsupportedNotice`: Dialog ramah jika browser tidak mendukung WebXR (*"Opening 3D Desktop mode. Use Chrome on Android or Meta Quest Browser for immersive XR"*).

---

## 5. API Data Mapping & Frontend Contracts

Berdasarkan dokumentasi endpoint tim, berikut adalah pemetaan data aktual ke elemen antarmuka:

| Komponen Antarmuka | Endpoint / Sumber Data | Field yang Digunakan | Perilaku jika Field Kosong / Error |
|---|---|---|---|
| **Primary Sky Imagery** | `GET /api/image/t1` | Binary image stream (JPEG/PNG) | Fallback ke aset lokal `public/spherex/vela.jpg` |
| **Comparison Imagery** | `GET /api/image/t2` | Binary image stream (JPEG/PNG) | Nonaktifkan tombol Compare; tampilkan state *"Single observation available"* |
| **Observation Metadata** | `GET /api/metadata/fits` | `DATE-OBS`, `TELESCOP`, `INSTRUME` | Sembunyikan baris tanggal; tampilkan label *"Timestamp unverified"* |
| **Object Detail Card** | `GET /api/objects/{object_id}` | `object_name`, `ra`, `dec`, `type` | Gunakan fallback hotspot statis dari `content/bodies/` |

---

## 6. Event Integrations (Host Application Bridge)

Antarmuka UI XR berkomunikasi dengan modul AI Guide dan host application melalui event standar pada objek `window`:

### 6.1 Memicu AI Guide (`cosmic:ask-guide`)
Dipanggil saat pengguna menekan tombol `Ask the guide` pada kartu informasi objek:
```typescript
window.dispatchEvent(
  new CustomEvent('cosmic:ask-guide', {
    detail: {
      body: 'spherex',
      hotspotId: 'rcw-36',
      guidePrompt: 'Explain what SPHEREx observes in the Vela Molecular Ridge'
    }
  })
);
```

### 6.2 Kembali ke Web Viewer Eksternal (`cosmic:back-to-source`)
Dipanggil saat pengguna menekan tombol `Back to source image`:
```typescript
window.dispatchEvent(
  new CustomEvent('cosmic:back-to-source', {
    detail: {
      body: 'spherex',
      hotspotId: 'rcw-36',
      observation: 'PIA26354'
    }
  })
);
```

---

## 7. Developer Handoff Checklist

Sebelum desain dianggap siap untuk implementasi kode:
- [x] **Page Count Sesuai Scope:** 2 Halaman utama + 1 Comparison sub-state + 1 set mode overlays.
- [x] **Mars Surface Excluded:** Modul permukaan Mars, astronaut HUD, dan rover dipisahkan dari alur utama SPHEREx.
- [x] **Headset Ergonomics Respected:** Jarak pandang kartu 3D diatur pada 1.1–1.4 m dengan teks kontras tinggi.
- [x] **Fallback Paths Complete:** Tersedia fallback fungsional untuk Desktop (OrbitControls) dan Phone Gyro.
- [x] **Honesty & Validation:** Tidak ada klaim penemuan gerak palsu atau animasi video kontinu; snapshot diskret diberi label tegas.
- [x] **Reused Architecture:** Menggunakan struktur Zustand store (`useXRApp`), Three.js primitives (`ui3d.tsx`), dan WebXR store (`xrStore`) yang sudah ada di repositori.
