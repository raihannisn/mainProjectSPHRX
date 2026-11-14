# PLAN: Zoom-In Seamless dari Sky Explorer → Object Scene → Object Detail

> Fitur tambahan (additive only) untuk **SPHEREx / Cosmic Expedition**.
> Dokumen ini untuk **Desainer (HTML/CSS)** dan **Engineer (JS)**.

---

## 0. TL;DR

Saat user **klik sebuah objek** di Sky Explorer (gambar 1), kamera **langsung zoom-in** ke objek itu, lalu masuk ke **Object Scene** (gaya gambar 2: judul besar di tengah, chip tujuan, panel misi). Dari situ transisi ke **Object Detail** (gaya gambar 4, halaman baru yang belum ada) harus **mulus tanpa layar loading yang "memutus"** (gambar 3). Triknya: **loading dikerjakan di background selama animasi zoom berlangsung**, sehingga saat kamera sampai, aset sudah siap.

### Aturan emas (jangan dilanggar)
1. **Jangan mengubah** fitur, markup, atau styling Sky Explorer yang sudah ada.
2. Semua kode/CSS baru memakai prefix **`zx-`** (class/id) dan namespace JS **`ZX`** supaya tidak bentrok.
3. Fitur dibungkus **feature flag** (`ZX.config.enabled`). Kalau `false`, perilaku lama 100% sama.
4. Hook ke klik objek lewat **event listener tambahan** (capture/delegation), bukan mengedit handler lama.

---

## 1. Peta Gambar Referensi

| Gambar | Layar | Peran di plan ini | Status |
|---|---|---|---|
| 1 | Sky Explorer (titik objek, panel "Ask the Guide", tabel metadata) | **Titik awal** — tempat klik terjadi | Sudah ada |
| 2 | Object Scene / "Choose a destination" (orbit, chip, misi) | **Tujuan zoom-in pertama** | **Baru** |
| 3 | "Preparing Mars… 94%" | **Fase loading** — dibuat nyaris tak terlihat | **Baru** |
| 4 | Object Detail (planet 3D, hotspot, layer gambar NASA) | **Tujuan akhir** | **Baru (belum ada sama sekali)** |

> **Asumsi** (konfirmasi ke PM bila beda): Gambar 2–4 adalah referensi gaya dari AR Cosmic Expedition. Kita membangun versi yang cocok dengan visual SPHEREx (tema gelap navy + aksen teal) tanpa mengubah tampilan Sky Explorer.

---

## 2. Alur Pengguna (User Flow)

```
[A] Sky Explorer
     │  hover objek      → prefetch ringan dimulai
     │  klik objek       → LOCK input, mulai transisi
     ▼
[B] Zoom Dolly (±1.4 s)  ← kamera masuk ke objek, UI lama memudar
     │  (di background: preload aset Object Detail)
     ▼
[C] Object Scene (gaya gambar 2)
     │  judul + chip + panel misi muncul bertahap
     │  user pilih tujuan / tekan "Explore" (atau auto-lanjut)
     ▼
[D] Zoom-through (±1.0 s)  ← objek membesar mengisi layar, crossfade
     │  (loading bar HANYA muncul jika aset belum siap > 600 ms)
     ▼
[E] Object Detail (gaya gambar 4)
     │  tombol "← Back" → reverse transition ke [A]
```

**Tujuan UX:** user merasakan **satu gerakan kamera tak terputus** dari langit → objek → detail. Tidak ada layar kosong, tidak ada lompatan.

---

## 3. Arsitektur (Additive Module)

Tambahkan **satu file JS + satu file CSS** baru. Sky Explorer tidak diedit.

```
/assets
  /zx
    zx-transition.js     ← orkestrator state machine + timeline
    zx-preloader.js      ← prefetch + decode aset
    zx-scene.js          ← Object Scene (gambar 2)
    zx-detail.js         ← Object Detail (gambar 4)
    zx.css               ← semua style baru, prefix .zx-
    /data
      objects.json       ← registry objek yang bisa dimasuki
    /textures            ← lowres (LQIP) + fullres per objek
```

Dimuat paling akhir di HTML:

```html
<link rel="stylesheet" href="assets/zx/zx.css">
<script type="module" src="assets/zx/zx-transition.js"></script>
```

### 3.1 Kontainer baru (overlay di atas Sky Explorer, tidak menyentuh DOM lama)

```html
<div id="zx-root" class="zx-root" aria-hidden="true">
  <canvas id="zx-bg" class="zx-layer zx-layer--bg"></canvas>   <!-- cuplikan/zoom visual -->
  <section id="zx-scene" class="zx-layer zx-layer--scene" hidden></section>
  <section id="zx-detail" class="zx-layer zx-layer--detail" hidden></section>
  <div id="zx-veil" class="zx-veil"></div>                      <!-- crossfade penutup -->
  <div id="zx-loader" class="zx-loader" hidden></div>           <!-- fallback saja -->
</div>
```

`#zx-root` default `pointer-events: none; opacity: 0`. Aktif hanya saat transisi.

### 3.2 State machine

```
IDLE → ARMED(hover) → ZOOMING_IN → SCENE → ZOOMING_THROUGH → DETAIL
                                      ▲                         │
                                      └──── REVERSING ◄─────────┘
                            (error/cancel) → RECOVER → IDLE
```

Satu sumber kebenaran: `ZX.state`. Setiap transisi lewat fungsi `go(nextState)` yang menolak transisi ilegal (cegah klik ganda).

---

## 4. Hook ke Sky Explorer (tanpa ubah kode lama)

1. Identifikasi elemen objek (titik bercahaya di gambar 1: RCW 36, titik ungu, titik oranye `demo-tile-01`).
2. Pasang **event delegation** pada kontainer Sky Explorer:

```js
skyContainer.addEventListener('click', (e) => {
  const node = e.target.closest('[data-zx-id], .sky-node'); // sesuaikan selector existing
  if (!node || !ZX.config.enabled) return;
  const id = node.dataset.zxId ?? mapNodeToId(node);        // mapping, bukan ubah markup
  const rect = node.getBoundingClientRect();
  ZX.open(id, { origin: { x: rect.left + rect.width/2, y: rect.top + rect.height/2 } });
}, { capture: false });
```

3. Jika markup lama tidak punya `data-*`, buat **`objects.json` + fungsi `mapNodeToId()`** (berdasar teks label / index). **Jangan** edit elemen lama.
4. Hover: `pointerenter` pada node → `ZX.preloader.warm(id)`.
5. Hanya objek yang ada di `objects.json` yang memicu zoom. Objek lain berperilaku seperti biasa.

### Skema `objects.json`
```json
{
  "mars": {
    "label": "Mars",
    "scene": { "title": "Choose a destination", "chips": ["Gale Crater", "Jezero Crater"] },
    "assets": {
      "lqip": "textures/mars-32.jpg",
      "mid":  "textures/mars-1k.jpg",
      "full": "textures/mars-4k.jpg",
      "elevation": "textures/mars-mola-2k.jpg"
    },
    "hotspots": [{ "name": "Olympus Mons", "lat": 18.6, "lon": -133.8 }]
  }
}
```
> Data demo harus tetap diberi label **"Illustration / Demo"** seperti kebiasaan UI sekarang. Jangan menampilkan klaim sains yang belum terverifikasi.

---

## 5. Timeline Animasi (Detail untuk Desainer + Engineer)

Gunakan **satu master timeline** (Web Animations API atau GSAP bila sudah ada di proyek; kalau tidak, WAAPI + `requestAnimationFrame`). Semua gerakan hanya `transform` dan `opacity` (GPU-friendly).

### Fase B — Zoom Dolly (0 → 1400 ms)

| t (ms) | Aksi | Easing |
|---|---|---|
| 0 | Lock input, `ZX.state = ZOOMING_IN`, `#zx-root` fade-in 0→1 (120 ms) | linear |
| 0–1400 | Layer snapshot Sky Explorer: **scale 1 → 6**, `transform-origin` = titik objek yang diklik, **blur 0 → 6px** (opsional, hanya jika FPS aman) | `cubic-bezier(.65,0,.2,1)` |
| 0–500 | UI lama (panel kiri/kanan/atas) **opacity 1 → 0** dan translate halus keluar | `ease-out` |
| 200–1000 | Objek yang diklik "dipinjam": clone-nya **bergerak ke tengah layar** dan membesar (shared-element transition) | `cubic-bezier(.22,1,.36,1)` |
| 800–1400 | Background berganti ke starfield `#zx-bg` (crossfade 600 ms) | `ease-in-out` |

### Fase C — Object Scene (1400 → ~2400 ms)
- Judul objek ("Choose a destination" / nama objek) fade+rise: 0→1, `translateY(12px→0)`, 500 ms.
- Chip dan panel misi muncul **stagger 60 ms** per item.
- Orbit/garis halus (SVG) menggambar diri (`stroke-dashoffset`) selama 900 ms.
- Objek di tengah **melayang pelan** (idle loop 8 s, `translateY ±4px`).
- Tombol aksi utama: **"Explore"** (atau auto-lanjut setelah 1.2 s jika `ZX.config.autoAdvance`).

### Fase D — Zoom-Through (±1000 ms)
- Objek di tengah: **scale 1 → 3.2**, mengisi layar. Elemen Scene (judul, chip) **fade-out 0→250 ms**.
- Mulai **crossfade** ke Object Detail pada t = 500 ms (objek detail dimulai dari scale 0.9 → 1, opacity 0 → 1, 500 ms). Karena ukuran objek di detail ≈ ukuran objek di akhir zoom, user melihat **satu objek yang sama**, bukan dua layar berbeda.
- Panel detail (hotspot, layer NASA, tombol Back) stagger-in setelah t = 800 ms.

> **Durasi total ideal 2.4–3.0 s.** Jangan lebih dari 3.5 s. Sediakan `ZX.config.speed` (default 1) untuk tuning.

---

## 6. Trik Seamless Loading (INTI fitur ini)

Tujuan: **user tidak pernah menunggu layar loading.** Waktu animasi (±2.4 s) dipakai sebagai waktu loading.

### 6.1 Prefetch bertingkat
1. **Hover (ARMED)**: ambil `lqip` + `mid` saja (kecil, <150 KB). Pakai `fetch` + `AbortController` supaya bisa dibatalkan bila hover pindah.
2. **Klik**: langsung mulai `full` + `elevation` secara paralel **bersamaan dengan fase B**.
3. Gunakan `<link rel="preload">` / `fetch({priority:'high'})` bila didukung.

### 6.2 Decode sebelum dipakai (hindari jank)
```js
async function loadImage(url, signal) {
  const res = await fetch(url, { signal });
  const blob = await res.blob();
  return createImageBitmap(blob);        // decode off-main-thread
}
```
- Untuk `<img>` biasa: `await img.decode()` sebelum ditampilkan.
- Jika pakai three.js: upload tekstur lebih awal dengan `renderer.initTexture(tex)` dan **`renderer.compileAsync(scene, camera)`** agar shader tidak "stutter" saat pertama dirender.

### 6.3 Progressive reveal (LQIP → mid → full)
- Tampilkan **`lqip`** (32 px, di-blur) dari frame pertama Object Scene — instan, tak ada kosong.
- Swap ke `mid` begitu siap, lalu `full`, dengan **crossfade 300 ms** (dua layer `<canvas>`/`<img>` bertumpuk). User hanya merasakan objek "menajam".
- Untuk objek 3D: mulai dengan material tekstur `lqip`, ganti `map` saat `full` siap (`material.needsUpdate = true`).

### 6.4 "Loader" hanya sebagai jaring pengaman
```js
const MAX_SILENT_WAIT = 600; // ms setelah zoom-through selesai
await Promise.race([ready, delay(MAX_SILENT_WAIT)]);
if (!ready.done) showLoader({ subtle: true });   // gaya gambar 3, tapi tipis di bawah objek
```
- Jika aset siap sebelum animasi selesai (kasus normal) → **loader tidak pernah muncul**.
- Jika koneksi lambat → muncul **loader halus gaya gambar 3** (persen + "Preparing {object}…") **di atas objek yang sudah terlihat**, bukan layar kosong. Progress dihitung dari byte yang diterima.
- Jangan pernah menampilkan persentase palsu yang loncat 0→94 sekaligus. Pakai progres nyata (`Content-Length` / `ReadableStream`).

### 6.5 Trik pendukung
- **Shared-element:** satu elemen objek yang sama dipakai dari Sky Explorer → Scene → Detail (tidak dibuat ulang), sehingga tidak ada "pop".
- **Snapshot Sky Explorer:** ambil `canvas.toBlob()` / `html2canvas`-free approach (pakai `drawImage` dari canvas existing) untuk dijadikan layer zoom, agar Sky Explorer asli tidak perlu dianimasikan atau diubah.
- **Pause render Sky Explorer** selama transisi (`ZX.hooks.pauseSky()`) untuk menghemat GPU, **resume** saat kembali. Kalau tidak ada API pause, abaikan (jangan mengubah kode lama).
- **Cache** bitmap di memori + Cache Storage/Service Worker supaya kunjungan kedua instan.
- **`requestIdleCallback`** untuk prewarm objek lain yang kemungkinan dibuka berikutnya (maks 1–2).
- **`content-visibility: auto`** dan `will-change: transform, opacity` hanya selama animasi, lalu dilepas.
- **View Transitions API** (opsional, progressive enhancement) untuk shared-element bila browser mendukung; fallback ke WAAPI.

---

## 7. Spesifikasi Desain untuk Desainer

### 7.1 Object Scene (referensi gambar 2)
- Judul besar tengah (±28–36 px, weight 500), subjudul kecil di bawahnya.
- Baris chip tujuan di kiri atas (pill, border tipis, state aktif memakai aksen teal sistem SPHEREx).
- Panel misi kecil (kartu semi-transparan, border 1 px) di atas-tengah.
- Hint di kiri bawah: "Drag to rotate · click a body".
- **Ikuti token warna & font yang sudah ada di Sky Explorer** (navy gelap, aksen teal, font mono kecil untuk label). Jangan memakai palet oranye/biru dari referensi mentah.

### 7.2 Object Detail (referensi gambar 4) — **halaman baru**
- Objek 3D/2D besar di tengah, dapat di-drag untuk rotasi, scroll untuk zoom.
- Judul + "N hotspots, point, tap or look to explore".
- Pill lokasi "Stand on the surface" (kiri atas).
- Legenda hotspot: **Fact / Illustration / Candidate (unconfirmed)** — pertahankan label kejujuran data.
- Kartu "Image layer" (toggle Colour ↔ Elevation) + atribusi sumber (NASA, domain publik).
- Tombol **← Back** (kiri atas), **Menu** (kanan atas), konsisten dengan kontrol ikon kanan di Sky Explorer.

### 7.3 Loader (gambar 3, fallback)
- Hanya cincin kecil + persen + "Preparing {name}…" di bawah objek.
- Latar **transparan/blur ringan**, bukan penutup solid.
- Tinggi z-index di atas Detail, di bawah tombol Back.

### 7.4 Mikro-interaksi
- Hover objek di Sky Explorer: **cursor pointer + ring tipis** (via layer overlay `zx-`, tanpa ubah style lama).
- Klik: ring mengembang sebagai "konfirmasi" 150 ms sebelum zoom.

### 7.5 Aksesibilitas
- `prefers-reduced-motion: reduce` → ganti zoom dengan **crossfade 250 ms**, tanpa scale/blur.
- Fokus keyboard: `Enter`/`Space` pada objek memicu zoom yang sama; `Esc` = Back.
- `aria-live="polite"` untuk status "Opening {object}…" dan "Ready".
- Kontras teks ≥ 4.5:1; target sentuh ≥ 44 px.

---

## 8. Pseudocode Orkestrator (untuk Engineer)

```js
export const ZX = { state: 'IDLE', config: { enabled: true, speed: 1, autoAdvance: false } };

ZX.open = async function (id, { origin }) {
  if (ZX.state !== 'IDLE' && ZX.state !== 'ARMED') return;
  const obj = registry[id]; if (!obj) return;

  go('ZOOMING_IN');
  const ac = new AbortController();
  const ready = preloader.loadAll(obj.assets, { signal: ac.signal });   // jalan di background

  await timeline.zoomDolly(origin, obj);       // ±1400 ms
  go('SCENE');
  await scene.show(obj);                       // ±1000 ms, lqip tampil instan
  await userAdvanceOrAuto();                   // klik "Explore" / auto

  go('ZOOMING_THROUGH');
  const zoom = timeline.zoomThrough();         // ±1000 ms
  await Promise.all([zoom, raceWithLoader(ready, 600)]);

  await detail.mount(obj, await ready);        // swap lqip→full, hotspot, layer
  go('DETAIL');
};

ZX.back = async function () {
  if (ZX.state !== 'DETAIL') return;
  go('REVERSING');
  await timeline.reverse();                    // kebalikan fase D→B
  restoreSky();                                // kembalikan Sky Explorer apa adanya
  go('IDLE');
};
```

### Aturan penting implementasi
- **Cancel-safe:** klik Back / `Esc` di tengah transisi harus membatalkan fetch dan membalik animasi dari posisi saat itu (jangan "lompat").
- **Tidak ada race:** abaikan klik saat `state !== IDLE`.
- **Cleanup:** setelah kembali, `dispose()` tekstur/canvas, lepas listener, kosongkan `#zx-root`, supaya memori tidak bocor.
- **Error:** jika aset gagal → tampilkan toast kecil "Couldn't load {object}. Try again." lalu **kembali ke Sky Explorer** (RECOVER). Jangan membiarkan user terjebak di layar kosong.

---

## 9. Performa & Budget

| Metrik | Target |
|---|---|
| FPS selama transisi | ≥ 55 fps di laptop menengah, ≥ 30 fps di HP menengah |
| Aset `lqip` | < 5 KB |
| Aset `mid` | < 200 KB |
| Aset `full` | < 1.5 MB (WebP/AVIF; sediakan JPG fallback) |
| Waktu klik → gerakan pertama | < 50 ms |
| Loader terlihat | < 5% sesi pada koneksi normal |
| CLS/jank | 0 layout shift (hanya `transform`/`opacity`) |

- Deteksi perangkat lemah (`navigator.hardwareConcurrency <= 4` atau FPS rendah di 10 frame pertama) → matikan blur, kurangi durasi 30%.
- Format gambar: WebP/AVIF; ukuran tekstur kelipatan 2 bila dipakai WebGL.

---

## 10. Checklist "Jangan Ubah Fitur Lain"

- [ ] Tidak ada edit pada CSS/JS/HTML Sky Explorer yang sudah ada (hanya menambah `<link>` + `<script>` di akhir halaman).
- [ ] Semua class baru berawalan `zx-`; tidak ada selector global (`body`, `*`, `canvas`) di `zx.css`.
- [ ] `ZX.config.enabled = false` ⇒ aplikasi identik dengan sebelumnya.
- [ ] Toggle bahasa **EN / ID** tetap berfungsi; semua teks baru punya kunci terjemahan EN & ID.
- [ ] Tombol audio, "Reset view", "Recenter", "Exit", "Ask the Guide", "Compare observations" tidak terpengaruh.
- [ ] Setelah Back, posisi/zoom/target Sky Explorer **kembali persis seperti sebelum klik**.

---

## 11. Tahapan Pengerjaan (Milestone)

| # | Tugas | Pemilik | Estimasi | Selesai bila |
|---|---|---|---|---|
| M1 | Registry `objects.json` + mapping node → id + feature flag | Engineer | 0.5 hari | Klik objek tercatat di console tanpa efek visual |
| M2 | `#zx-root` + layer snapshot + zoom dolly (fase B) | Engineer + Desainer | 1.5 hari | Zoom mulus dari klik sampai tengah layar |
| M3 | Object Scene (gambar 2) HTML/CSS + animasi masuk | Desainer | 1.5 hari | Scene tampil sesuai desain, EN/ID ok |
| M4 | Preloader bertingkat + LQIP→full | Engineer | 1.5 hari | Aset siap sebelum zoom-through selesai (jaringan normal) |
| M5 | Object Detail (gambar 4) halaman baru: objek, hotspot, layer toggle | Desainer + Engineer | 3 hari | Detail interaktif, drag/zoom jalan |
| M6 | Zoom-through + crossfade shared-element | Engineer | 1 hari | Tidak terlihat sambungan antara Scene dan Detail |
| M7 | Loader fallback + error recovery + cancel/reverse | Engineer | 1 hari | Throttle "Slow 3G" tetap tidak menampilkan layar kosong |
| M8 | Reduced-motion, keyboard, uji lintas browser/perangkat | Semua | 1 hari | Checklist §10 & §12 lulus |

Total ±11 hari kerja. M1–M4 bisa diselesaikan lebih dulu sebagai demo internal.

---

## 12. Kriteria Penerimaan (QA)

1. Klik objek → zoom dimulai < 50 ms, tanpa kedip putih/hitam.
2. Dari klik sampai Detail, **tidak ada momen layar kosong** (cek dengan rekam layar frame-by-frame).
3. Throttling **Fast 3G**: loader halus muncul **di atas objek**, tidak menutup seluruh layar.
4. Throttling **Offline**: toast error + kembali ke Sky Explorer dengan state utuh.
5. Klik ganda cepat / spam klik tidak merusak state.
6. Back di tengah animasi membalik mulus dari posisi saat itu.
7. `prefers-reduced-motion` ⇒ hanya crossfade.
8. Fitur lain (audio, Guide, Compare, bahasa, Reset/Recenter/Exit) bekerja identik dengan sebelum fitur ini.
9. Uji di: Chrome, Safari (iOS/macOS), Firefox, dan satu HP Android menengah.

---

## 13. Pertanyaan Terbuka (konfirmasi sebelum M2)

1. Objek mana saja di Sky Explorer yang boleh dimasuki di rilis pertama? (rekomendasi: 1 objek demo dulu, lalu skalakan.)
2. Apakah Object Scene (gambar 2) langsung auto-lanjut ke Detail, atau menunggu user memilih tujuan/tekan "Explore"?
3. Object Detail pakai **3D (three.js)** atau cukup **2D bergerak parallax** untuk MVP? (2D jauh lebih ringan, 3D lebih mirip gambar 4.)
4. Sumber gambar/tekstur resmi dan lisensinya (NASA/JPL domain publik atau data SPHEREx terverifikasi)? Sampai ada, tetap berlabel **Demo/Illustration**.
5. Apakah ada library animasi yang sudah dipakai (GSAP, Framer, dll.) supaya tidak menambah dependensi baru?
