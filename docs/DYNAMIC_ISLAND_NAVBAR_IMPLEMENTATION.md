# Spesifikasi: Navbar Dynamic Island SPHEREx

## 1. Tujuan

Saat pengguna menggulir ke bawah, navbar SPHEREx berubah dari bar penuh menjadi **kapsul melayang** bergaya Dynamic Island. Perubahannya terasa seperti satu objek yang *bermorfosis* (melebar, menyempit, membulat), bukan dua elemen yang bertukar tempat. Saat kembali ke atas, kapsul melebur kembali menjadi bar penuh.

Dokumen ini hanya spesifikasi. Kode aplikasi belum diubah.

**Prinsip rasa (untuk jadi pegangan saat ada keputusan kecil):**
- Halus dan tenang, bukan ramai. Gerakan harus terasa fisik dan punya bobot, bukan sekadar fade.
- Kapsul adalah *objek yang hidup*: ia bisa mengembang sedikit saat disentuh atau di-hover, lalu kembali ke bentuk ringkas.
- Tidak pernah menghalangi konten, tidak pernah membuat layout meloncat.

---

## 2. Cara membaca kode (hemat token)

1. Baca `workflow` / `plan.md` proyek lebih dulu untuk konvensi.
2. Buka hanya `arvr/src/frontend/components/TopBar.tsx` dan blok navbar di `arvr/src/frontend/styles/frontend.css` (cari `topbar`, `.nav`, `header`, `@media`).
3. Cari cara halaman menggulir: apakah `window`, atau container dengan `overflow: auto` (cari `overflow-y`, `100vh`, `.app`, `.page`). Ini menentukan target listener scroll (lihat bagian 5).
4. Jangan baca halaman Gateway, Sky Explorer, Comparison, dan Cosmic Guide secara penuh. Cukup cek bagaimana mereka memakai `TopBar` dan apakah ada padding atas yang menyesuaikan tinggi navbar.

---

## 3. Kondisi saat ini

- Navbar React bersama ada di `arvr/src/frontend/components/TopBar.tsx`, dipakai Gateway, Sky Explorer, Comparison, dan Cosmic Guide.
- Gaya ada di `arvr/src/frontend/styles/frontend.css`.
- Isi yang wajib tetap ada: brand SPHEREx, tautan navigasi, status backend, tombol bahasa, tautan 3D/WebXR.
- Di layar kecil, tautan navigasi saat ini disembunyikan. Implementasi baru harus memberi akses ke semua rute.

---

## 4. Model state

Satu komponen, tiga state visual. State disimpan di `TopBar` dan diekspos lewat atribut pada `<header>` (misal `data-state`), bukan lewat banyak class yang saling tumpang tindih.

| State | Kapan | Bentuk | Isi yang terlihat |
|---|---|---|---|
| `top` | scroll di posisi atas | Bar penuh selebar viewport, sudut hampir datar, latar sama seperti desain sekarang | Brand, semua tautan, status backend, bahasa, 3D/WebXR |
| `island` | scroll melewati ambang | Kapsul terpusat, melayang dengan jarak dari tepi atas, sudut sangat membulat | Desktop: brand, tautan, ikon status, bahasa, 3D/WebXR dalam versi padat. Mobile: brand, penanda rute aktif, tombol menu |
| `island-open` | menu mobile dibuka, atau kapsul diperluas lewat hover/fokus | Kapsul memanjang ke bawah (tetap berbentuk kapsul/rounded rect), seperti Dynamic Island yang mengembang | Daftar tautan lengkap, bahasa, status, 3D/WebXR |

### Ambang dan histeresis

- Masuk ke `island` saat `scrollY > 24`.
- Kembali ke `top` hanya saat `scrollY <= 8`.
- Selisih 24 vs 8 mencegah kedip (flicker) kalau pengguna berhenti tepat di sekitar ambang atau saat momentum scroll di iOS memantul.
- Saat halaman pertama dimuat dengan scroll sudah di bawah ambang (reload, restore scroll, deep link `#anchor`), langsung set ke `island` **tanpa animasi** (tidak ada morph saat mount).

---

## 5. Arahan implementasi

### 5.1 Struktur dan cakupan

- Ubah hanya `TopBar.tsx` dan aturan terkait di `frontend.css`.
- Jangan memindahkan navbar ke tiap halaman, jangan mengubah struktur routing.
- Struktur markup yang disarankan:
  - `<header>` sebagai pembungkus penuh lebar (menangani posisi `fixed`, padding safe-area, dan `pointer-events`).
  - Di dalamnya satu elemen "pulau" (`div`) yang **berubah lebar/radius/tinggi**. Semua isi navbar hidup di dalam pulau ini.
  - `<nav aria-label="...">` di dalam pulau untuk tautan, supaya landmark tetap benar.
- Header pembungkus memakai `pointer-events: none`, dan pulau memakai `pointer-events: auto`, supaya area kosong di kiri-kanan kapsul tidak memblokir klik ke konten di bawahnya.

### 5.2 Scroll

- Tentukan target scroll yang benar: kalau body menggulir, pakai `window`; kalau ada container menggulir, pakai elemen itu (lewat ref/selector yang stabil). Jangan menebak. Verifikasi dengan Playwright (bagian 9).
- Listener `scroll` bersifat **passive** (`{ passive: true }`), dibatasi lewat `requestAnimationFrame` (satu pembaruan per frame), dan dibersihkan saat unmount.
- Hanya panggil `setState` ketika state berubah (jangan set di setiap event scroll), supaya React tidak re-render berlebihan.
- Saat berpindah rute, pertahankan state yang masuk akal: kalau halaman baru mulai dari atas, state kembali ke `top` lewat kejadian scroll yang wajar. Jangan reset paksa yang memutus animasi.
- Tangani resize dan perubahan orientasi: hitung ulang breakpoint, tutup menu yang terbuka bila melewati breakpoint desktop.

### 5.3 Layout stabil (tanpa loncatan)

- Saat navbar `fixed`, pertahankan **spacer** setinggi navbar `top` agar konten tidak naik. Tinggi spacer dibaca dari satu custom property CSS (misal `--nav-h`), bukan angka yang tersebar.
- Spacer **tidak ikut berubah** saat navbar jadi kapsul. Konten tidak boleh bergeser sama sekali selama transisi.
- Cek halaman yang punya `padding-top` sendiri untuk kompensasi navbar, supaya tidak jadi dobel atau kurang.

### 5.4 Bentuk dan material kapsul

- Lebar responsif dengan `max-width`: kapsul tidak menempel ke tepi layar. Beri jarak horizontal minimum (misal `12px`, lewat `calc(100% - 24px)`) dan batas atas sekitar `min(960px, ...)` di desktop. Nilai pasti disesuaikan dengan konten.
- Sudut sangat membulat (`border-radius` besar, misal `999px` untuk keadaan tertutup). Untuk `island-open`, gunakan radius besar yang tetap bagus saat tinggi bertambah (misal `28px`), bukan `999px` yang bisa membuat bentuk aneh.
- Latar semi-transparan dengan `backdrop-filter: blur(...)` yang konsisten dengan tema sekarang.
- Border tipis dan bayangan lembut agar kapsul terpisah dari konten di bawahnya, baik di atas latar gelap maupun terang.
- Sediakan **fallback** bila `backdrop-filter` tidak didukung: latar lebih solid (`@supports not (backdrop-filter: blur(1px))`).
- `top` kapsul memakai `max(12px, env(safe-area-inset-top))` agar aman di perangkat dengan notch.

### 5.5 Gerak (morph)

- Animasikan **properti yang murah**: `transform`, `opacity`, dan untuk morph bentuk gunakan `width`, `max-width`, `border-radius`, `padding`, `top` dalam satu transisi terkoordinasi. Hindari menganimasikan `backdrop-filter`, `box-shadow` berat, atau `filter`.
- Durasi 280 sampai 420 ms. Easing bergaya pegas (spring-like), misal `cubic-bezier(0.32, 0.72, 0, 1)` atau mirip, agar terasa punya bobot. Satu set token dipakai di semua transisi:
  - `--island-duration`
  - `--island-ease`
- Isi kapsul tidak ikut "terjepit" saat menyempit:
  - Elemen yang disembunyikan memudar lebih dulu (opacity ke 0 dalam kira-kira 120 ms), baru lebar menyempit.
  - Elemen yang muncul memudar masuk sedikit **terlambat** (delay kecil) setelah lebar cukup.
  - Gunakan `overflow: hidden` pada pulau dan `white-space: nowrap` agar teks tidak melipat selama transisi.
- Penanda rute aktif (garis/pil di bawah atau di belakang tautan aktif) boleh meluncur ke posisi baru saat rute berganti, tetapi tidak wajib. Prioritaskan kestabilan dulu.
- Interaksi mikro (opsional, hemat): kapsul membesar sangat sedikit (`scale(1.02)`) saat hover/press di desktop dan sentuhan di mobile. Jangan berlebihan.
- Hormati `prefers-reduced-motion: reduce`: nonaktifkan morph panjang dan efek pegas. Perubahan state tetap terjadi, tetapi instan atau dengan fade singkat (maks 100 ms).

### 5.6 Layar kecil (di bawah breakpoint tablet)

- State `island` menampilkan: brand, **nama rute aktif** (teks singkat, terpotong dengan ellipsis bila perlu), dan tombol menu.
- Tombol menu:
  - area sentuh minimal `44 × 44px`;
  - `aria-expanded`, `aria-controls` mengarah ke id panel tautan;
  - label aksesibel berubah sesuai state ("Buka menu" / "Tutup menu") dan mengikuti bahasa aktif.
- Panel tautan di `island-open` muncul sebagai perluasan kapsul ke bawah (bukan dropdown terpisah yang menimpa), berisi semua rute: Gateway, Sky Explorer, Comparison, Cosmic Guide. Di dalamnya juga tersedia tombol bahasa, status backend, dan tautan 3D/WebXR bila tidak muat di bar.
- Menu menutup saat: memilih tautan, menekan `Escape`, menyentuh area di luar kapsul, atau rute berubah. Setelah menutup lewat keyboard, fokus kembali ke tombol menu.
- Saat menu terbuka, jangan mengunci scroll halaman kecuali memang diperlukan. Bila dikunci, pulihkan dengan benar saat tertutup.
- Tidak boleh ada overflow horizontal, termasuk di lebar `320px`.

### 5.7 Desktop

- State `island` tetap menampilkan tautan utama dalam versi padat (jarak antar tautan lebih rapat, ikon status kecil menggantikan teks panjang).
- `island-open` (opsional di desktop) dapat dipicu hover/`focus-within` untuk menampilkan label lengkap. Beri jeda singkat sebelum menutup (misal 150 ms) agar tidak berkedip saat kursor bergerak.
- Tautan 3D/WebXR dan tombol bahasa tetap bisa dijangkau tanpa membuka apa pun, atau dengan satu langkah yang jelas.

### 5.8 Navigasi dan aksesibilitas

- Tautan tetap memakai `NavLink` yang ada. Rute aktif memakai `aria-current="page"` dan gaya yang jelas.
- Perpindahan rute tidak boleh meng-*unmount* navbar atau memutus animasi.
- Urutan tab logis: brand, tautan, status, bahasa, 3D/WebXR, tombol menu.
- Fokus terlihat (`:focus-visible`) dengan kontras cukup, baik di bar penuh maupun di kapsul.
- Kontras teks dan ikon memenuhi WCAG AA di atas latar kapsul, termasuk saat konten di belakang kapsul berwarna terang.
- Status backend jangan hanya mengandalkan warna. Sertakan teks singkat atau label aksesibel.

### 5.9 Hal yang tidak boleh diubah

- Endpoint dan logika status backend.
- Mekanisme bahasa (hanya tampilan tombolnya yang boleh menyesuaikan).
- React Router dan struktur rute.
- Pengalaman WebXR/AR/VR.
- Tampilan halaman lain di luar penyesuaian padding/spacer yang diperlukan.

---

## 6. Token desain (satu tempat, mudah diatur)

Definisikan sebagai custom property di blok navbar pada `frontend.css`:

- `--nav-h` — tinggi bar penuh (dipakai juga oleh spacer)
- `--island-top` — jarak kapsul dari tepi atas
- `--island-max-w` — lebar maksimum kapsul
- `--island-radius` / `--island-radius-open`
- `--island-duration`, `--island-ease`
- `--island-bg`, `--island-border`, `--island-shadow`, `--island-blur`

Semua nilai warna mengikuti tema yang sudah ada. Jangan menambahkan palet baru.

---

## 7. Kasus tepi yang harus ditangani

- Reload di tengah halaman (state langsung `island`, tanpa animasi).
- Navigasi ke rute baru saat state `island` (tidak berkedip, tidak loncat).
- Scroll sangat lambat di sekitar ambang (histeresis mencegah kedip).
- Rotasi layar dan resize melewati breakpoint saat menu terbuka.
- Bar alamat browser mobile yang mengecil/membesar (jangan memakai `100vh` untuk penempatan).
- Konten halaman dengan elemen `sticky` atau `fixed` lain di bagian atas (tidak saling menimpa kapsul).
- Layar `320px` dan layar ultra lebar.
- Bahasa dengan teks lebih panjang (EN vs ID) tidak merusak lebar kapsul.
- Peramban tanpa dukungan `backdrop-filter`.

---

## 8. Kriteria penerimaan

- Navbar penuh tampil di posisi teratas; melewati ambang berubah menjadi kapsul melebar yang terpusat; kembali ke atas memulihkan tampilan penuh.
- Transisi terasa sebagai satu morph halus, tanpa isi yang terjepit atau melipat, tanpa kedip di sekitar ambang.
- Tidak ada loncatan layout pada konten saat state berganti (CLS mendekati 0 untuk navbar).
- Tautan Gateway, Sky Explorer, Comparison, dan Cosmic Guide dapat diakses di semua ukuran layar; penanda rute aktif benar.
- Status backend, tombol bahasa, dan tautan 3D/WebXR tetap berfungsi.
- Menu mobile dapat dibuka dan ditutup lewat sentuhan, keyboard, `Escape`, dan klik di luar; fokus kembali ke tombol menu setelah menutup.
- Tidak ada overflow horizontal di `320px` hingga desktop lebar.
- Kapsul tidak menimpa konten penting; klik di area kosong sekitar kapsul tetap mengenai konten di bawahnya.
- Fokus keyboard terlihat; animasi diminimalkan saat `prefers-reduced-motion: reduce`.
- Reload di tengah halaman langsung menampilkan kapsul tanpa animasi masuk.
- Tidak ada error atau warning baru di console; tidak ada re-render berlebihan saat menggulir.

---

## 9. Verifikasi

1. `cd arvr` lalu `npm run build` harus lolos tanpa error TypeScript.
2. **Playwright**, di viewport 320x640, 390x844, 768x1024, 1280x800, 1440x900:
   - screenshot di posisi atas, setelah melewati ambang, dan setelah kembali ke atas;
   - pastikan state berganti benar: baca `data-state` pada header setelah `window.scrollTo` / scroll container;
   - cek `scrollWidth <= innerWidth` (tanpa overflow horizontal);
   - ukur posisi elemen konten pertama sebelum dan sesudah state berganti. Selisihnya harus 0;
   - buka dan tutup menu mobile; cek `aria-expanded`, fokus, `Escape`, klik di luar;
   - berpindah antar semua rute dan pastikan state serta penanda aktif benar;
   - reload dengan scroll di bawah ambang; kapsul langsung tampil tanpa transisi.
3. Uji keyboard: Tab melewati semua kontrol dengan urutan logis dan fokus terlihat.
4. Uji `prefers-reduced-motion: reduce` (`page.emulateMedia({ reducedMotion: 'reduce' })`).
5. Uji tombol bahasa, status backend, dan tautan WebXR.
6. Cek console: tidak ada error atau warning baru.

---

## 10. Format laporan akhir

- Ringkasan perubahan per file (tanpa menempel kode panjang).
- Target scroll yang dipakai (window atau container) dan alasannya.
- Nilai token yang dipilih dan alasannya, bila berbeda dari saran di dokumen ini.
- Hasil verifikasi (path screenshot, hasil pengecekan overflow dan layout shift).
- Hal yang belum beres atau butuh keputusan Rafli.
