# PLAN: Mobile Responsive Layout — Sky Explorer (SPHEREx / Cosmic Expedition)

> Tujuan: tampilan mobile yang **lega, rapi, dan langit-nya jadi bintang utama**.
> Dikerjakan **engineer**, dengan desain mengikuti gaya proyek (navy gelap, aksen teal, kartu glass, label mono kecil).
> **Desktop tidak boleh berubah sama sekali.**

---

## 0. TL;DR

Di desktop (gambar 2), semua panel melayang rapi di sekeliling kanvas langit. Di mobile (gambar 1), **panel-panel yang sama ditumpuk menjadi satu kolom panjang** di dalam layar sempit, sehingga:

- kanvas langit nyaris tidak terlihat (tertutup kartu-kartu),
- halaman harus di-scroll (ada scrollbar), padahal ini pengalaman interaktif,
- kartu hint "DRAG TO ORBIT" menimpa kartu "ALL-SKY EXPLORER / DEMO DATA",
- tombol bawah (Reset view / Recenter / Audio off / Exit) **terpotong** di tepi layar,
- tiga tombol besar (Ask the Guide, Compare, Back to source image) memakan setengah layar,
- tombol-tombol kecil di kanan atas berdempetan dengan kartu lain.

**Solusi inti:** di mobile, **kanvas jadi layar penuh**, semua informasi dipindah ke **satu bottom sheet** yang bisa ditarik (3 ukuran), kontrol jadi **dock ikon** kecil, dan elemen sekunder muncul **sesuai kebutuhan** (tidak selalu terlihat).

### Aturan emas
1. Semua perubahan **hanya berlaku di mobile** lewat `@media (max-width: 767px)` (+ landscape khusus). Di ≥ 768 px, tampilan **identik** dengan sekarang.
2. Tidak mengubah fungsi, teks, urutan logika, atau styling desktop. Hanya **menambah file override** yang dimuat paling akhir.
3. Semua class/atribut baru berawalan **`zr-`** (responsive). Tidak ada selector global.
4. Feature flag: `ZR.config.enabled`. Kalau `false`, mobile kembali seperti sekarang.
5. Kompatibel dengan fitur lain yang sudah direncanakan: **zoom-in objek (`zx-`)** dan **chatbot Cosmic Guide (`cg-`)**.

---

## 1. Diagnosis Masalah (dari Screenshot)

| # | Masalah di mobile (gambar 1) | Penyebab | Perbaikan (bagian) |
|---|---|---|---|
| 1 | Kanvas langit tertutup, hanya terlihat samar di belakang kartu | Panel diposisikan `static` dan menumpuk satu kolom | Kanvas `fixed` layar penuh, panel jadi overlay (§3) |
| 2 | Halaman bisa di-scroll (scrollbar kanan) | Tinggi konten > viewport, body scroll | Kunci scroll body, scroll hanya di dalam sheet (§4.1) |
| 3 | Hint "DRAG TO ORBIT" menindih "ALL-SKY EXPLORER / DATA" | Dua elemen berebut posisi di pojok kiri atas | Hint jadi toast sementara (§5.4) |
| 4 | Tombol dock bawah terpotong ("Audio off", "Exit" separuh) | Tinggi layar tidak cukup, tidak ada `dvh`/safe-area | Dock `fixed` ikon-saja + safe area (§5.3) |
| 5 | Tiga tombol aksi besar (±56 px tinggi masing-masing) | Ukuran desktop dipakai ulang | Baris aksi ringkas di sheet (§5.2) |
| 6 | Rail 4 tombol bulat di kanan atas berdempetan dengan kartu | Tidak ada ruang bebas | Rail vertikal kecil, kanan tengah-atas, jarak aman (§5.5) |
| 7 | Dua kartu info (judul objek + deskripsi + tabel metadata) memenuhi layar | Semua ditampilkan sekaligus | Sheet 3 tingkat: peek / half / full (§4) |
| 8 | Font label mono sangat kecil dan rapat | Skala desktop | Skala tipografi mobile (§6) |
| 9 | Header dan "TARGET SELECTED" memakan 2 baris tinggi | Elemen terpisah | Top bar 48 px + chip status (§5.1) |

---

## 2. Breakpoint & Perangkat Uji

| Nama | Aturan CSS | Perilaku |
|---|---|---|
| **Desktop** | `min-width: 1024px` | **Tidak berubah** |
| **Tablet** | `768px – 1023px` | Layout desktop dipertahankan; cek tumpang tindih saja (§9) |
| **Phone besar / tablet portrait kecil** | `481px – 767px` | Layout mobile (bottom sheet), sheet lebih lebar & bergaya kartu |
| **Phone** | `≤ 480px` | Layout mobile penuh |
| **Phone kecil** | `≤ 360px` atau `max-height: 600px` | Mode ekstra ringkas (§7) |
| **Landscape phone** | `max-height: 500px and (orientation: landscape)` | Panel samping, bukan bottom sheet (§8) |

**Matriks uji wajib (Chrome DevTools + perangkat nyata minimal 2):**
320×568 · 360×640 · 375×667 · 390×844 · 412×915 · 430×932 · 667×375 (landscape) · 844×390 (landscape) · 768×1024 · 1024×768.

---

## 3. Layout Target Mobile (Portrait)

```
┌────────────────────────────────┐
│ (S) SPHEREx / COSMIC    EN | ID│  ← Top bar 48 px
├────────────────────────────────┤
│ TARGET SELECTED · FACT      (◈)│  ← chip status (kiri)   rail (kanan)
│                             (◎)│
│                             (♪)│
│       K A N V A S              │
│       L A N G I T              │
│       (layar penuh)         (🤖)│
│                                │
│   ⓘ Drag to orbit · pinch zoom │  ← toast 4 dtk, lalu hilang
│                                │
│ ┌────────────────────────────┐ │
│ │ ━━━  (handle)              │ │  ← Bottom sheet (PEEK ≈ 112 px)
│ │ RCW 36 Emission Nebula     │ │
│ │ [✦ Guide] [⇄ Compare] [⋯]  │ │
│ └────────────────────────────┘ │
│  ⟲ Reset   ◎ Center  🔈  ⏻ Exit │  ← Dock ikon 56 px (fixed bawah)
└────────────────────────────────┘
```

Prinsip tata letak:
- **Kanvas:** `position: fixed; inset: 0;` tinggi `100dvh`. Selalu terlihat, minimal **55% tinggi layar** pada kondisi sheet "peek".
- **Zona sentuh bebas:** area tengah kanvas **tidak ditutup** elemen permanen, supaya drag/pinch lancar.
- **Satu sumber informasi:** semua teks objek ada di **bottom sheet**, bukan kartu-kartu terpisah.
- **Satu baris kontrol:** dock ikon di paling bawah (di bawah sheet).

---

## 4. Bottom Sheet (Komponen Baru Utama)

Berisi semua yang sekarang tersebar: judul objek, deskripsi, metadata, source context, tombol aksi.

### 4.1 Tiga tingkat (snap points)

| Tingkat | Tinggi | Isi yang terlihat |
|---|---|---|
| **PEEK** (default saat objek terpilih) | ≈ 112 px | Handle, nama objek, badge FACT, baris aksi (Ask the Guide, Compare, ⋯) |
| **HALF** | ≈ 50 dvh | + deskripsi + metadata grid (Object ID, Classification, RA, Dec, Observation, Timestamp) |
| **FULL** | ≈ 85 dvh (sisakan 15% kanvas di atas) | + Source context, "Back to source image", semua detail; konten scroll **di dalam sheet** |
| **HIDDEN** | 0 | Belum ada objek terpilih → sheet disembunyikan, kanvas dan hint tampil bersih |

### 4.2 Interaksi
- **Tarik handle** ke atas/bawah → snap ke tingkat terdekat (dengan kecepatan/flick).
- **Tap handle / judul** → siklus PEEK → HALF → PEEK.
- **Tap area kanvas** di luar sheet saat HALF/FULL → turun ke PEEK.
- Saat sheet FULL, scroll konten di dalam sheet; saat sudah mentok atas dan ditarik turun → sheet turun tingkat.
- `touch-action: none` hanya di handle; konten sheet `touch-action: pan-y`; kanvas tetap `touch-action: none` (drag orbit & pinch zoom tidak boleh terganggu).
- Objek berganti → sheet kembali ke PEEK dengan animasi kecil (konten fade-swap 150 ms).
- Tombol Back browser / gesture back: menutup tingkat FULL → HALF → PEEK sebelum meninggalkan halaman (opsional, lihat §11).

### 4.3 Visual
- Glass sesuai gaya proyek: `background: linear-gradient(...navy 70–80%)`, `border-top: 1px solid rgba(teal,.25)`, `backdrop-filter: blur(12px)` (matikan di perangkat lemah), radius atas 20 px.
- Bayangan atas lembut supaya terpisah dari kanvas.
- Handle: pil 36×4 px, warna teal 40%.
- Padding horizontal 16 px; jarak antar-seksi 12 px.
- Safe area bawah ditangani oleh **dock**, bukan sheet (sheet duduk tepat di atas dock).

### 4.4 Sketsa kode (inti logika)

```js
// zr-sheet.js
const SNAP = { hidden: 0, peek: 112, half: () => innerHeight * 0.5, full: () => innerHeight * 0.85 };
let state = 'hidden', startY = 0, startH = 0, dragging = false, lastY = 0, lastT = 0, vy = 0;

handle.addEventListener('pointerdown', e => {
  dragging = true; startY = e.clientY; startH = sheet.offsetHeight;
  sheet.classList.add('zr-dragging');           // matikan transition saat drag
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dy = startY - e.clientY;
  sheet.style.height = clamp(startH + dy, SNAP.peek, SNAP.full()) + 'px';
  vy = (lastY - e.clientY) / (e.timeStamp - lastT || 1); lastY = e.clientY; lastT = e.timeStamp;
});
handle.addEventListener('pointerup', () => {
  dragging = false; sheet.classList.remove('zr-dragging');
  setState(nearestSnap(sheet.offsetHeight, vy));  // flick: vy > 0.5 → naik, < -0.5 → turun
});
```

Hanya memanipulasi `height`/`transform` elemen sheet. Pakai `transform: translateY` bila ingin 60 fps lebih stabil (opsi lanjutan).

---

## 5. Spesifikasi Per Elemen (Mobile)

### 5.1 Top bar
- Tinggi **48 px** + `padding-top: env(safe-area-inset-top)`.
- Kiri: logo "S" (28 px) + "SPHEREx / COSMIC EXPEDITION". Di ≤ 360 px, teks dipersingkat (`SPHEREx` saja, sisanya disembunyikan dengan `display:none` pada span "/ COSMIC EXPEDITION").
- Kanan: toggle **EN / ID** tetap terlihat, ukuran sentuh ≥ 44 px (padding tak terlihat).
- **"LOCAL DEMO"**: di mobile jadi **titik indikator kecil** (dot teal) tanpa teks; teks muncul via `title`/long-press, atau pindah ke dalam sheet (HALF). Tidak ada informasi yang dihapus, hanya dipindah.
- Latar semi-transparan + blur ringan; tidak menutupi kanvas (kanvas tetap di bawahnya).

### 5.2 Baris aksi di sheet (pengganti 3 tombol besar)
- PEEK: tiga tombol **sejajar satu baris**, tinggi 40 px, `flex: 1`, label disingkat via ikon + teks pendek:
  - `Ask the Guide ↗` → ikon ✦ + "Guide"
  - `Compare observations →` → ikon ⇄ + "Compare"
  - `Back to source image` → masuk ke menu **⋯** (overflow) di PEEK; terlihat penuh di HALF/FULL.
- Teks lengkap tetap ada: sebagai `aria-label` dan tampil penuh di HALF/FULL.
- Ukuran sentuh ≥ 44 px (boleh dengan padding vertikal tak terlihat).
- **Ask the Guide** tetap memakai handler yang ada (tidak diubah). Bila nanti dihubungkan ke chatbot, itu dikerjakan di plan chatbot.

### 5.3 Dock kontrol bawah (Reset view / Recenter / Audio / Exit)
- `position: fixed; bottom: 0; left: 0; right: 0;` tinggi **56 px** + `padding-bottom: env(safe-area-inset-bottom)`.
- Empat tombol **ikon dengan label kecil di bawahnya** (10–11 px) atau ikon saja di ≤ 360 px; rata dengan jarak sama (`justify-content: space-around`).
- Ukuran tiap target **≥ 44 × 44 px**.
- Urutan sama dengan desktop: Reset view, Recenter, Audio, Exit.
- **Exit** diberi jarak lebih / warna netral agar tidak tersentuh tak sengaja (opsional: konfirmasi ringan bila fitur Exit saat ini tidak punya konfirmasi — **tanyakan dulu**, jangan menambah perilaku tanpa persetujuan).
- Label "Audio off/on" mengikuti state yang ada (ikon speaker berganti).

### 5.4 Hint "DRAG TO ORBIT · SCROLL TO ZOOM"
- Mobile: teks diganti **"Drag to orbit · pinch to zoom"** (dwibahasa; "scroll" tidak relevan di sentuh).
- Tampil sebagai **toast** di atas sheet/dock, **4 detik**, lalu fade-out; **tidak muncul lagi** setelah user melakukan gesture pertama (drag/pinch). Boleh disimpan di `sessionStorage`.
- Tidak boleh menimpa kartu lain (posisi `fixed`, di tengah bawah, `bottom: dock + sheet + 12px`).

### 5.5 Rail tombol kanan atas (◈ ◎ ♪ 🤖)
- Tetap **vertikal** di kanan, tetapi:
  - ukuran tombol **40 px** (visual) dengan area sentuh 44 px,
  - jarak antar tombol 8 px,
  - posisi `top: calc(48px + safe-area + 12px); right: 12px;`,
  - latar rail glass tipis, tidak melebar.
- Jangan berdempetan dengan chip status di kiri (lihat 5.6): beri `max-width` pada chip agar ada jarak ≥ 12 px dari rail.
- Tombol robot chatbot (sudah ada) tetap ada di rail; **jangan dipindah**.
- Di ≤ 360 px / `max-height: 600px`: rail bisa **dilipat** menjadi satu tombol "⋮" yang membuka rail (opsional, §7).

### 5.6 Chip status "TARGET SELECTED · FACT"
- Satu chip ringkas kiri atas di bawah top bar: `TARGET SELECTED` + badge `FACT` (satu baris, font mono 11 px).
- Kartu **"ALL-SKY EXPLORER / DEMO DATA — Vela Molecular Ridge — RA/DEC"**: di mobile **masuk ke sheet HALF** sebagai baris konteks (subjudul), bukan kartu terpisah di atas kanvas. Informasinya sama, hanya pindah tempat.

### 5.7 Label di kanvas (titik objek)
- Titik/hotspot objek di kanvas: area sentuh **≥ 44 px** (lingkaran transparan di sekitar titik), terutama karena titik kecil (±14 px) sulit disentuh jari.
- Label teks di dekat titik ("RCW 36") ukuran ≥ 11 px dan tidak menimpa rail/sheet (bila bertabrakan, sembunyikan label, tampilkan di sheet).

---

## 6. Skala Tipografi & Jarak (Mobile)

| Elemen | Desktop sekarang | Target mobile |
|---|---|---|
| Judul objek (di sheet) | ±20 px | 18–20 px, weight 600 |
| Deskripsi | ±13 px | 14 px, line-height 1.5 |
| Label mono (TARGET SELECTED, OBJECT ID…) | ±10 px | **11 px** (jangan lebih kecil), letter-spacing dikurangi sedikit |
| Nilai metadata | ±11 px | 13 px |
| Tombol/aksi | ±12 px | 13–14 px |
| Dock label | — | 10–11 px |

- Padding kartu/sheet: **16 px**; jarak antar elemen: **8 / 12 / 16 px** (skala tetap, jangan angka acak).
- Gunakan `clamp()` untuk skala halus antara 320 → 767 px, mis. `font-size: clamp(13px, 3.4vw, 15px)`.
- Metadata grid: **2 kolom × 3 baris** (seperti sekarang) tetapi dengan `gap: 12px 16px`; di ≤ 340 px jadi 1 kolom.

---

## 7. Mode Ekstra Ringkas (≤ 360 px atau tinggi ≤ 600 px)

- Top bar 44 px, judul disingkat jadi "SPHEREx".
- Dock hanya ikon (tanpa label).
- Sheet PEEK 96 px (hanya nama + 2 tombol aksi + ⋯).
- Rail kanan dilipat jadi satu tombol ⋮.
- Matikan `backdrop-filter` dan animasi dekoratif.

---

## 8. Landscape Phone (`max-height: 500px` & landscape)

Bottom sheet tidak cocok (tinggi terlalu sedikit). Gunakan **panel samping**:

```
┌──────────────────────────────────────────────────┐
│ (S) SPHEREx   [EN|ID]                  ◈ ◎ ♪ 🤖  │ 40 px
├───────────────────────────────┬──────────────────┤
│                               │ RCW 36 Emission  │
│        K A N V A S            │ Nebula   [FACT]  │
│                               │ [Guide][Compare] │
│                               │ metadata… (scroll)│
├───────────────────────────────┴──────────────────┤
│        ⟲ Reset   ◎ Center   🔈 Audio   ⏻ Exit    │ 44 px
└──────────────────────────────────────────────────┘
```
- Panel kanan lebar `min(320px, 42vw)`, tinggi penuh di antara top bar dan dock, scroll internal.
- Rail tombol pindah ke top bar (horizontal) agar tidak menghabiskan lebar.
- Respect `env(safe-area-inset-left/right)` (notch).

---

## 9. Tablet (768–1023 px)

- Layout desktop dipertahankan. **Cek dan perbaiki hanya jika ada tumpang tindih**:
  - kartu info kiri vs kartu "RCW 36…" vs panel tombol kanan,
  - tabel metadata kanan bawah vs dock bawah,
  - rail kanan atas vs tombol lain.
- Bila ada tabrakan: kecilkan lebar kartu (`max-width: 36vw`) atau geser via override `@media (min-width: 768px) and (max-width: 1023px)`. Jangan mengubah nilai desktop ≥ 1024 px.

---

## 10. Cara Implementasi (Tanpa Menyentuh Kode Lama)

### 10.1 File baru
```
/assets/zr
  zr-responsive.css   ← semua override, dibungkus @media
  zr-map.js           ← memetakan elemen lama ke atribut data-zr (tanpa ubah HTML)
  zr-sheet.js         ← logika bottom sheet (§4)
  zr-toast.js         ← hint sementara (§5.4)
```
Dimuat **paling akhir** setelah `zx` dan `cg`:

```html
<link rel="stylesheet" href="assets/zr/zr-responsive.css">
<script type="module" src="assets/zr/zr-map.js"></script>
```

### 10.2 Pemetaan elemen lama → `data-zr`
Karena HTML lama tidak diedit, buat satu file yang menandai elemen lewat selector yang sudah ada:

```js
// zr-map.js — HANYA file ini yang tahu selector lama
const MAP = {
  topbar:   '/* selector header */',
  langtoggle:'/* selector EN|ID */',
  status:   '/* selector TARGET SELECTED */',
  context:  '/* selector kartu ALL-SKY EXPLORER */',
  objcard:  '/* selector kartu judul+deskripsi objek */',
  meta:     '/* selector tabel metadata */',
  source:   '/* selector Source context */',
  actions:  '/* selector panel Ask/Compare/Back */',
  rail:     '/* selector grup tombol kanan atas */',
  dock:     '/* selector grup Reset/Recenter/Audio/Exit */',
  hint:     '/* selector DRAG TO ORBIT */',
  canvas:   '/* selector kanvas langit */'
};
Object.entries(MAP).forEach(([k, sel]) => {
  const el = document.querySelector(sel);
  if (el) el.setAttribute('data-zr', k);
});
```
CSS override lalu memakai `[data-zr="dock"]` dst. Jika markup lama berubah, **cukup perbaiki satu file ini**.

### 10.3 Memindahkan kartu ke sheet tanpa merusak fungsi
Pendekatan yang disarankan (urut dari paling aman):
1. **CSS-only dulu:** ubah `position` kartu menjadi `static` di dalam kontainer sheet baru **tidak mungkin** tanpa memindahkan node. Jadi gunakan **pemindahan node DOM** (`sheetBody.append(el)`), **bukan** meng-clone. Memindahkan node mempertahankan event listener dan update teks otomatis.
2. Pemindahan dilakukan **hanya di mobile** dan **dikembalikan ke posisi semula** saat layar melebar ≥ 768 px (simpan `placeholder` komentar/anchor tempat asal: `el.__zrHome = {parent, next}`).
3. Gunakan `matchMedia('(max-width: 767px)')` + listener `change` supaya rotasi/resize ditangani dua arah.
4. Setelah dikembalikan di desktop, **tidak ada gaya inline tersisa** (bersihkan `style` dan class `zr-`).

> Jika ada keberatan memindahkan node (mis. framework yang me-render ulang): fallback ke **render ulang ringan** isi sheet dari state objek (nama, deskripsi, metadata). Diskusikan dengan lead sebelum memilih.

### 10.4 Kunci scroll halaman (hanya mobile)
```css
@media (max-width: 767px) {
  html.zr-on, html.zr-on body { height: 100dvh; overflow: hidden; overscroll-behavior: none; }
}
```
`zr-on` ditambahkan oleh `zr-map.js` hanya ketika flag aktif dan viewport mobile.

### 10.5 Kerangka CSS (acuan, sesuaikan token proyek)

```css
@media (max-width: 767px) {
  :root { --zr-top: calc(48px + env(safe-area-inset-top, 0px));
          --zr-dock: calc(56px + env(safe-area-inset-bottom, 0px));
          --zr-peek: 112px; }

  [data-zr="canvas"] { position: fixed; inset: 0; height: 100dvh; touch-action: none; }

  [data-zr="topbar"] { position: fixed; top: 0; left: 0; right: 0; height: var(--zr-top);
                       padding-top: env(safe-area-inset-top, 0px); z-index: 30; }

  [data-zr="rail"]   { position: fixed; top: calc(var(--zr-top) + 12px); right: 12px; z-index: 30; }

  [data-zr="dock"]   { position: fixed; left: 0; right: 0; bottom: 0; height: var(--zr-dock);
                       padding-bottom: env(safe-area-inset-bottom, 0px);
                       display: flex; justify-content: space-around; align-items: center; z-index: 40; }

  .zr-sheet { position: fixed; left: 0; right: 0; bottom: var(--zr-dock);
              height: var(--zr-peek); max-height: 85dvh;
              border-radius: 20px 20px 0 0; z-index: 35;
              transition: height .28s cubic-bezier(.22,1,.36,1); }
  .zr-sheet.zr-dragging { transition: none; }
  .zr-sheet[data-state="hidden"] { height: 0; visibility: hidden; }
  .zr-sheet__body { overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; }
}
```

### 10.6 z-index (cek angka asli dulu!)
Urutan target dari bawah ke atas: kanvas < label kanvas < rail/top bar (30) < sheet (35) < dock (40) < toast hint (45) < **chat Cosmic Guide halaman penuh (`cg-`, 60)** < dialog/modal bawaan. Catat angka final di komentar CSS.

---

## 11. Interaksi dengan Fitur Lain

- **Chatbot (`cg-`):** di mobile chat membuka halaman penuh (`#/guide/{id}`). Saat halaman chat aktif, sheet dan dock **disembunyikan** (`visibility:hidden`), muncul lagi saat kembali. Router hash `zr` **tidak boleh** memakai prefiks `#/guide/`.
- **Zoom-in (`zx-`):** saat transisi zoom berjalan, sheet turun ke HIDDEN (animasi 200 ms) dan kembali ke PEEK saat user kembali ke Sky Explorer. Overlay `#zx-root` harus menutupi top bar, rail, sheet, dan dock (z-index lebih tinggi selama transisi).
- **Audio:** perilaku tombol audio tidak berubah; hanya posisi/ukuran.
- **Bahasa EN/ID:** semua teks baru (hint, label dock singkat) dwibahasa dan ikut toggle.
- **Back browser:** opsional menutup sheet FULL → HALF → PEEK memakai `history.pushState` ringan. **Tanyakan dulu** (lihat §14), karena menyentuh perilaku navigasi.

---

## 12. Aksesibilitas & Performa

- Semua target sentuh **≥ 44 × 44 px**; kontras teks ≥ 4.5:1 di atas latar glass.
- Sheet: `role="region"`, `aria-label="Object details"`; handle punya `role="button"`, `aria-expanded`, dan bisa dioperasikan keyboard (Enter/Space siklus, panah atas/bawah).
- `prefers-reduced-motion`: transisi sheet jadi 0 ms (langsung snap), toast tanpa animasi.
- Hormati `env(safe-area-inset-*)` di semua sisi (notch, home indicator).
- Gunakan `100dvh` (bukan `100vh`) agar tidak terpotong address bar mobile.
- `backdrop-filter` hanya di sheet dan top bar; matikan di perangkat lemah (`hardwareConcurrency <= 4`) atau saat FPS kanvas turun.
- Animasi hanya `transform`/`opacity`/`height` sheet; hindari layout thrash saat drag.
- Hindari hover-only: semua state penting punya padanan tap.
- Zoom browser jangan dinonaktifkan (`maximum-scale`) kecuali sudah begitu sekarang; kanvas saja yang `touch-action: none`.

---

## 13. Tahapan Pengerjaan

| # | Tugas | Estimasi | Selesai bila |
|---|---|---|---|
| R1 | Audit: catat selector lama, ukur ulang layout di 5 ukuran layar, isi `zr-map.js` | 0.5 hari | Semua elemen punya `data-zr` yang benar |
| R2 | Kanvas layar penuh + kunci scroll + top bar + dock (`fixed`, safe area) | 1 hari | Tidak ada scroll halaman; dock tidak terpotong di 320×568 |
| R3 | Bottom sheet (PEEK/HALF/FULL, drag, snap) + pemindahan node ke sheet | 2 hari | Semua info objek ada di sheet; fungsi tombol lama tetap jalan |
| R4 | Rail ringkas, chip status, toast hint, area sentuh titik objek | 1 hari | Tidak ada elemen yang menimpa elemen lain |
| R5 | Tipografi & jarak mobile, mode ≤ 360 px / tinggi ≤ 600 px | 0.5 hari | Lolos matriks perangkat §2 |
| R6 | Landscape phone (panel samping) | 1 hari | 667×375 & 844×390 rapi |
| R7 | Cek tablet 768–1023 + regresi desktop ≥ 1024 | 0.5 hari | Desktop pixel-identical (bandingkan screenshot sebelum/sesudah) |
| R8 | Integrasi dengan `zx` & `cg`, aksesibilitas, QA lintas browser | 1 hari | Checklist §15 lulus |

**Total ±7–8 hari kerja.** R1–R3 sudah memberikan perbaikan terbesar; bisa dirilis lebih dulu sebagai tahap 1.

---

## 14. Pertanyaan Terbuka (Konfirmasi sebelum R3)

1. **Memindahkan node DOM ke sheet** diperbolehkan? (Rekomendasi: ya, dengan dikembalikan saat layar melebar.) Atau lebih aman me-render ulang isi sheet dari state?
2. **Tombol Exit:** boleh ditambah konfirmasi di mobile agar tidak kepencet? (Menambah perilaku baru, jadi perlu persetujuan.)
3. **"Back to source image"** boleh dipindah ke menu ⋯ saat PEEK (tampil penuh saat HALF/FULL)?
4. **Tombol Back browser** boleh dipakai untuk menutup sheet bertahap?
5. **Landscape phone:** cukup panel samping seperti §8, atau cukup minta user memutar ke portrait?
6. **"LOCAL DEMO"** boleh jadi titik indikator di mobile (teks di dalam sheet)?

---

## 15. Kriteria Penerimaan (QA)

**Layout**
- [ ] Di semua ukuran §2, **tidak ada scroll halaman** dan tidak ada elemen terpotong atau saling menimpa.
- [ ] Kanvas langit terlihat **≥ 55% tinggi layar** saat sheet PEEK.
- [ ] Dock selalu terlihat penuh, termasuk di iPhone dengan home indicator dan di 320×568.
- [ ] Hint tidak menimpa kartu apa pun, dan hilang setelah 4 detik / gesture pertama.
- [ ] Rail kanan tidak menyentuh chip status maupun sheet.

**Interaksi**
- [ ] Drag/pinch di kanvas tetap mulus; tidak ada drag yang "bocor" ke sheet atau sebaliknya.
- [ ] Sheet snap 3 tingkat dengan drag, flick, dan tap; konten FULL bisa di-scroll internal.
- [ ] Ganti objek → sheet kembali PEEK, konten berganti tanpa kedip.
- [ ] Tombol Ask the Guide, Compare, Back to source image, Reset, Recenter, Audio, Exit, EN/ID **berfungsi persis seperti sebelumnya**.
- [ ] Rotasi portrait ↔ landscape tidak merusak state (objek terpilih, audio, bahasa tetap).

**Regresi**
- [ ] Desktop ≥ 1024 px **identik** dengan sebelum perubahan (perbandingan screenshot).
- [ ] `ZR.config.enabled = false` ⇒ mobile persis seperti sekarang.
- [ ] Chatbot (`cg-`) dan zoom-in (`zx-`) tetap bekerja di mobile dan tidak tertimpa layer.

**Perangkat uji:** Chrome Android, Safari iOS (minimal 1 iPhone dengan notch), Samsung Internet jika memungkinkan, Chrome/Firefox desktop (regresi).
