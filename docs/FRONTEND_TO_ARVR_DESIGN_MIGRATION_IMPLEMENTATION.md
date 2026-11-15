# Prompt: Migrasi Desain `frontend/` ke `arvr/` (Dynamic Island Dipertahankan)

Halo Cline. Tugasmu: membawa desain dan interaksi terbaik dari `frontend/spherex-expedition.html` ke aplikasi React di `arvr/`, supaya produk aktif punya **satu tampilan yang konsisten dan satu runtime**.

Tiga hal yang paling penting:

1. `frontend/spherex-expedition.html` adalah **referensi desain, read-only**. Jangan di-embed, jangan di-route, jangan disalin mentah.
2. **Dynamic Island navbar di `arvr/` sudah jadi dan harus tetap utuh.**
3. Perilaku dan data tetap milik React (API, store, URL, XR handoff). Yang dimigrasi hanya rasa visual dan pola responsifnya.

---

## 0. Urutan membaca (hemat token)

1. Baca **workflow `.md` dan `plan.md`** dulu, penuh. Ikuti konvensinya.
2. Jalankan `git status` dan `git diff --stat`. Perubahan yang belum di-commit di `TopBar.tsx` dan `frontend.css` adalah **pekerjaan pengguna**: pelajari dan kerjakan di sekitarnya, jangan di-reset atau ditimpa.
3. Untuk HTML referensi (~3000 baris), **jangan baca penuh**. Cari per kata kunci lalu baca potongan di sekitarnya: `#gateway`, `.cap`, `hc-`, `window.ZR`, `ZR RESPONSIVE`, `@media`, `.hud`, `compare`.
4. Untuk React, buka hanya file yang relevan per fase (lihat bagian 5). Jangan menjelajah seluruh `arvr/`.
5. Sebelum mengubah apa pun, tulis **inventaris singkat** (maks ~15 baris): pola mana yang sudah ada di arvr, mana yang masih celah.

---

## 1. Batasan arsitektur

- Layar dan routing aktif tetap di `arvr/src/frontend/` dengan React Router yang ada.
- Panggilan backend, query/URL state, pemilihan observasi, provenance, error, dan handoff XR tetap dikelola komponen React dan modul API/store yang sudah ada.
- Migrasikan pola desain secara selektif. **Jangan** salin HTML monolit, JavaScript inline, atau seluruh CSS lama.
- **Jangan** ubah kontrak backend, menambah runtime frontend kedua, mendesain ulang scene XR, atau menambah dependency tanpa alasan kuat.
- CSS baru memakai prefiks `fe-*` yang sudah ada dan tetap scoped. Hindari selector luas yang bisa menyentuh modul XR atau aplikasi lain.

---

## 2. Dynamic Island: wajib utuh

Navbar ada di `arvr/src/frontend/components/TopBar.tsx` dengan gaya di `arvr/src/frontend/styles/frontend.css`. Pertahankan:

- state `top`, `island`, dan `island-open`, termasuk perilaku scroll dan histeresisnya;
- spacer layout saat header `fixed`;
- tampilan desktop yang padat dan navigasi mobile yang bisa dibuka;
- tautan rute aktif, status backend, tombol bahasa, dan tautan 3D/WebXR;
- keyboard, klik di luar, `Escape`, reduced motion, dan perilaku responsif.

Aturan main:

- **Jangan** mengganti dengan `.topbar` lama, dan jangan menggabungkan DOM/CSS navbar lama ke dalamnya.
- **Jangan** mengubah `TopBar.tsx` hanya agar mirip navbar lama.
- Kalau mengubah token bersama (warna, spacing, z-index, `--nav-h`), **cek ulang ketiga state navbar** (penuh, kapsul, kapsul terbuka) di mobile dan desktop.
- Jangan memperkenalkan elemen `sticky/fixed` baru di bagian atas halaman yang bisa menimpa kapsul.

---

## 3. Peta migrasi desain

| Area | Yang dipertahankan dari referensi | Arah implementasi di arvr |
|---|---|---|
| Fondasi visual | Kanvas gelap ilmiah, aksen teal/violet/amber yang terukur, tipografi jelas, panel translusen, spacing konsisten, state fokus, dukungan reduced motion | Satukan atau selaraskan token `fe-*` yang ada. Hindari aturan global ganda |
| Gateway | Hierarki hero editorial, komposisi hero/art responsif, dekorasi kurva sinyal, grid kemampuan, dan tiga langkah perjalanan | Perhalus `GatewayScreen.tsx` dan style-nya. Pertahankan navigasi React, penanganan APOD live, dan konten yang jujur. Tandai seni tata surya dekoratif sebagai ilustratif |
| Sky Explorer | Viewport langit sebagai fokus, kontrol ringkas, HUD target/observasi kontekstual, cara inspeksi detail yang ramah mobile | Perhalus `SkyExplorerScreen.tsx` tanpa mengganti nilai dari API, URL selection, atau handoff XR |
| Detail Explorer di mobile | Pola HUD/sheet responsif di halaman lama (termasuk `window.ZR`) | Jika diadopsi, implementasikan dengan state dan lifecycle milik React. **Jangan** menyalin `adoptNodes()` atau memindahkan node DOM milik React secara imperatif |
| Comparison | Kartu observasi A/B yang jelas, kontrol mode, label gambar, pengungkapan integritas ilmiah | Perhalus `ObservationComparisonScreen.tsx`. Tampilkan hanya mode yang didukung komponen dan record/preview yang tersedia. Data yang hilang tetap dinyatakan eksplisit |
| Cosmic Guide | Spacing, panel, kontrol, dan konvensi responsif yang sama jika ada pola referensi yang cocok | Pertahankan `CosmicGuideScreen.tsx` dan perilakunya. Jangan membuat backend guide atau UI referensi yang tidak terkait |
| Interaksi bersama | Dialog aksesibel, umpan balik, kontrol seukuran sentuhan, fokus keyboard terlihat, reduced motion | Pertahankan handler dan kontrol semantik React. Porting hanya interaksi yang cocok dengan fitur produk yang sudah ada |

### Catatan kurasi khusus (dari keputusan sebelumnya)

- **Grid kemampuan di Gateway: 3 kartu**, yaitu Desktop 3D, WebXR AR, dan WebXR VR. Kartu **Gyroscope sengaja tidak dibawa** (dianggap tidak penting). Jika logika gyroscope dipakai fitur lain (misal kontrol sensor di Explorer), jangan disentuh, cukup tidak ditampilkan sebagai kartu.
- Gaya kartu holografik di referensi (modul `hc-`: permukaan kaca, garis scan atas, aksen per kartu, hover glow, shimmer, entrance bertahap) boleh diadaptasi untuk kartu kemampuan. Syaratnya: hormati `prefers-reduced-motion`, jangan menambah animasi terus-menerus yang berat di mobile, dan atur warna aksen untuk **3 kartu** (teal, violet, gold).
- Tombol atau interaksi umpan balik (misal like) hanya dibawa sebagai **gaya dan state visual** bila fiturnya memang ada di React. Jangan membuat penyimpanan atau backend baru untuk itu.
- Halaman lama punya riwayat **elemen yang saling menimpa** di Cosmic Expedition. Jangan membawa pola `position: absolute/fixed` dengan offset piksel tetap atau `100vh` dari referensi. Gunakan `flex/grid`, `clamp()`, `100dvh` dengan fallback, dan zona UI yang jelas.

---

## 4. Integritas data dan ilmiah

- Layar React dan kontrak API saat ini adalah **sumber kebenaran** untuk perilaku dan data. Halaman lama bisa berisi teks usang, nilai contoh, atau visual demo.
- **Jangan** menyalin koordinat contoh, tanggal, record observasi, atau konten gambar simulasi ke jalur data live React.
- Jaga agar status **live, tidak tersedia, ilustratif, kandidat, dan fallback** tetap berbeda secara visual dan berlabel jelas.
- Jangan menyiratkan gerak kontinu dari observasi yang terpisah, dan jangan menambah analisis kuantitatif/selisih kecuali data dan pemrosesannya memang mendukung.
- Metadata (waktu observasi, rilis, detektor, sumber, dsb.) hanya ditampilkan bila benar-benar tersedia.

---

## 5. Fase kerja

Kerjakan berurutan. Setelah tiap fase, cek singkat (build dan Playwright) sebelum lanjut.

### Fase 0: Baseline dan inventaris
1. Bandingkan bagian referensi dengan layar React yang sesuai (struktur dan aturan responsifnya).
2. Catat celah visual/interaksi. Jangan mengulang pekerjaan yang sudah ada.
3. Konfirmasi perilaku rute, siapa yang memegang scroll (`window` atau container), dan breakpoint sebelum mengubah asumsi layout.
4. Ambil screenshot "sebelum" (lihat bagian 6).

### Fase 1: Fondasi desain bersama
1. Selaraskan hanya token yang perlu: tipografi, spacing, permukaan, border, fokus, dan gerak.
2. Pastikan perubahan global tidak merusak Dynamic Island di ketiga state.

### Fase 2: Gateway (`GatewayScreen.tsx`)
1. Bandingkan komposisi React dengan referensi.
2. Port hanya detail visual dan perbaikan responsif yang belum ada. Pertahankan navigasi React, loading/error APOD, dan interaksi aksesibel.
3. Grid kemampuan 3 kartu sesuai catatan kurasi. Seni dekoratif diberi label ilustratif.

### Fase 3: Sky Explorer dan detail mobile (`SkyExplorerScreen.tsx`)
1. Pertahankan viewport langit sebagai konten utama. Konteks target/pencarian dan metadata tetap mudah dipahami.
2. Selaraskan HUD desktop dan layout mobile dengan perilaku responsif referensi.
3. Jika perlu sheet mobile yang bisa dilipat, modelkan `hidden/peek/expanded` di React. Sinkronkan dengan perubahan rute, perubahan viewport, dan cleanup komponen.
4. Pertahankan state target/observasi terpilih di alur URL dan store yang ada. Jangan mengganggu handoff XR.

### Fase 4: Comparison dan layar lain
1. Selaraskan kartu observasi, kontrol mode, label, peringatan, dan pembungkusan responsif.
2. Setiap mode tetap didukung data nyata layar React. Pertahankan state kosong, loading, dan error yang eksplisit.
3. Terapkan penyempurnaan bersama ke Cosmic Guide hanya bila cocok dengan layar dan perilakunya.

### Fase 5: Verifikasi responsif dan aksesibilitas
Lihat bagian 6.

---

## 6. Verifikasi (wajib, dengan Playwright)

Jangan menebak dari kode. Lihat render aslinya.

**Viewport:** 320x640, 390x844, 768x1024, 1280x800, 1440x900, dan landscape 844x390.

Untuk **Gateway, Sky Explorer, Comparison, dan Cosmic Guide**:

1. Screenshot di posisi scroll atas, setelah melewati ambang kapsul, dan (di mobile) saat menu terbuka.
2. Cek `scrollWidth <= innerWidth` (tanpa overflow horizontal).
3. Cek **tumpang tindih**: irisan bounding box antar elemen UI utama (navbar, HUD, kontrol, kartu, label) yang bukan parent-child. Targetnya nol.
4. Cek teks terpotong (`scrollWidth > clientWidth`) dan kontrol yang keluar layar.
5. Cek bahwa navbar tidak menutupi kontrol penting, dan posisi konten pertama **tidak bergeser** saat state navbar berganti.
6. Uji keyboard (urutan tab, fokus terlihat), area sentuh minimal ~44px, label aksesibel, dan `prefers-reduced-motion: reduce`.
7. Uji state **loading, kosong, dan error** di Explorer dan Comparison.
8. Uji perpindahan antar rute, perubahan query/URL, dan handoff ke XR.
9. Cek console: tidak ada error atau warning baru.

**Perintah (dari `arvr/`):**

```powershell
npm run build
npm run smoke:xr
```

Jalankan `smoke:xr` hanya jika prasyaratnya tersedia. **Laporkan hasil apa adanya.** Jangan menyatakan pengecekan lulus kalau tidak dijalankan.

---

## 7. Kriteria penerimaan

- Aplikasi aktif tetap memakai rute React di `arvr`. Tidak ada halaman lama yang di-embed atau di-route terpisah.
- Gateway, Explorer, Comparison, dan Guide berbagi bahasa visual yang koheren dan tetap mempertahankan perilaku React masing-masing.
- Perbaikan responsif dari referensi terbawa bila memang memperbaiki layar React yang sesuai, termasuk layout layar kecil dan akses detail Explorer.
- Dynamic Island tetap bekerja: state scroll, spacer, tautan desktop, menu mobile, status, bahasa, dan tautan XR.
- Data, metadata, query parameter, error, dan handoff XR Explorer tetap bersumber dari alur React/API/store yang ada.
- Comparison memakai record yang benar-benar tersedia dan mempertahankan pengungkapan integritas ilmiah. Konten demo lama tidak diperlakukan sebagai data live.
- Gateway menampilkan 3 kartu kemampuan (tanpa Gyroscope).
- Tidak ada overflow horizontal atau kontrol yang tak terjangkau di lebar kecil. Keyboard dan reduced motion tetap berfungsi.
- Tidak ada perubahan backend, routing, scene XR, dependency, atau deployment yang tidak terkait.

---

## 8. Cakupan perubahan yang diharapkan

File yang mungkin diubah, tergantung hasil perbandingan baseline:

- `arvr/src/frontend/styles/frontend.css`
- `arvr/src/frontend/components/GatewayScreen.tsx`
- `arvr/src/frontend/components/SkyExplorerScreen.tsx`
- `arvr/src/frontend/components/ObservationComparisonScreen.tsx`
- `arvr/src/frontend/components/CosmicGuideScreen.tsx`
- tes terfokus hanya bila interaksi yang dimigrasi memang menambah atau memperbaiki perilaku yang bisa diuji di setup yang ada

`frontend/spherex-expedition.html` **read-only** kecuali pemilik secara eksplisit memintanya diubah.

---

## 9. Format laporan akhir

- Inventaris awal: pola yang sudah ada vs celah yang ditemukan.
- Ringkasan perubahan per file (tanpa menempel kode panjang).
- Apa yang sengaja **tidak** dimigrasi dan alasannya (termasuk Gyroscope dan pola layout lama yang rawan menimpa).
- Bukti Dynamic Island masih utuh di ketiga state (path screenshot dan hasil cek).
- Hasil verifikasi: build, smoke, overflow, overlap, keyboard, reduced motion (jujur soal yang tidak dijalankan).
- Hal yang belum beres atau butuh keputusan Rafli.

Terima kasih, Cline. Kalau ada yang ambigu, pilih opsi paling aman yang tidak mengubah perilaku atau data, lalu catat asumsinya di laporan.
