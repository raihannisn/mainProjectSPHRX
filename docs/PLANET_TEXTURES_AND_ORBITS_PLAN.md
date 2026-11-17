# Rencana: tekstur planet dari NASA + orbit elips asli (Solar System Hub 3D)

Status: **rencana, belum ada kode yang diubah.** Disusun 17 Nov 2026 setelah membaca `AGENTS.md`, `docs/EXPLORER_3D_MODELS.md`, `docs/DECISIONS.md`, `arvr/src/xr/{bodies,ephemeris,SolarSystemHub,BodyExplorer,layers}.ts(x)` dan `arvr/content/bodies/*.json`, lalu memeriksa sumber NASA langsung (HTTP) pada tanggal yang sama.

Dua permintaan:

1. Banyak planet belum bertekstur bagus. Cari tekstur/model dari **NASA saja** (tidak boleh sumber lain).
2. Orbit di hub masih lingkaran. Buat **elips sesuai data orbit NASA asli**.

---

## 1. Aturan yang mengikat (dari AGENTS.md dan DECISIONS.md)

- Hanya sumber NASA/JPL. Setiap aset punya `textureCredit` yang menyebut sumber, misi, dan lisensinya.
- Satu rekaman `arvr/content/bodies/{id}.json` per benda; deskripsi English **dan** Indonesia wajib; `hotspots` boleh kosong.
- Fallback narasi tidak boleh rusak: rekaman backend yang hilang tidak boleh menyembunyikan info bawaan, dan kegagalan Gemini TTS harus diberi label saat suara browser dipakai.
- `npm run build` di `arvr/` harus lulus (`check:content`, `tsc`, `vite build`).
- Jangan menulis ulang modul tanpa perlu. Perubahan kecil, per fase. **Tidak ada commit, push, atau deploy** dari agen.
- Jangan melakukan hotlink ke server NASA saat runtime. Semua tekstur diunduh saat build dan di-host sendiri (stabil, offline, tanpa masalah CORS).

## 2. Kondisi sekarang (terverifikasi di repo)

| Benda | Tekstur di repo | Tampilan sekarang |
|---|---|---|
| Mars | `public/textures/mars.jpg` (972.896 B = identik dengan `Mars.jpg` NASA 3D Resources) + layer elevasi MOLA | tekstur NASA, berlabel |
| Moon | `public/textures/moon.jpg` (LROC colour map, NASA SVS CGI Moon Kit) | tekstur NASA, berlabel |
| Bennu | `public/models/bennu.glb` (bentuk OSIRIS-REx, NASA 3D Resources) | model NASA |
| Mercury, Venus, Earth, Jupiter, Saturn, Uranus, Neptune, Sun | **tidak ada** (`texture: null` di JSON) | bola prosedural gaya holo, dilabeli "illustration" |

Mekanisme yang sudah ada dan akan dipakai ulang tanpa diubah bentuknya: field `texture` + `textureCredit` di JSON, `TexturedPlanet` di `BodyExplorer.tsx`, tampilan label "3D illustration" lewat `plainSphereIsIllustration`, dan `layers.ts` untuk layer data.

Orbit sekarang:

- `HoloOrbit` menggambar **lingkaran** berjari-jari `b.orbit`.
- Posisi planet: `hubXZ(b.orbit, longitudo)`. Hanya arah (longitudo heliosentris) yang asli, jaraknya selalu `b.orbit` konstan.
- `ephemeris.ts` **sudah memuat elemen Keplerian lengkap** (a, e, I, L, ϖ, Ω + laju per abad, JPL/Standish) dan fungsi `helioPosition()` yang menghasilkan posisi 3D asli. Jadi datanya sudah ada; yang kurang hanya cara menggambarnya.

## 3. Inventaris sumber NASA

Status: **[V]** = saya buka sendiri dan terverifikasi; **[?]** = belum terverifikasi, dikerjakan di Fase 0.

| Benda | Sumber NASA yang dipilih | Data/ukuran | Jenis | Catatan |
|---|---|---|---|---|
| **Mars** | NASA 3D Resources `Mars.jpg`, kredit NASA/JPL-Caltech (Viking, diproses USGS) **[V]** | 1440×720 | data nyata | sudah dipakai. Peningkatan opsional: Mars Trek (tile WMTS) **[?]** |
| **Moon** | NASA SVS CGI Moon Kit (LROC) | sudah ada | data nyata | tetap |
| **Venus** | NASA 3D Resources `Venus.jpg`, "stitched from Magellan RADAR imagery, gaps filled with global texture" **[V]** | 1440×720 (terukur) | data radar nyata + penambal celah | label harus menyebut penambalan celah; periksa visual apakah warnanya simulasi **[?]** |
| **Mercury** | **Mercury Trek** (NASA Solar System Treks), layer `Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m` **[V]** | tile 256 px JPEG, matriks 2×1 di zoom 0 lalu menggandakan tiap level; CRS Mercury lon -180..180, lat -90..90 (ekuirectangular); rakit di zoom 3 = 4096×2048 | data nyata (MESSENGER MDIS), **monokrom** | URL template terverifikasi: `https://trek.nasa.gov/tiles/Mercury/EQ/<layer>/1.0.0//{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg`. Nama layer warna (Enhanced Color) belum ditemukan **[?]** (satu tebakan nama dijawab 404). Merkurius memang abu-abu; monokrom itu jujur |
| **Earth** | **NASA GIBS** WMTS (EPSG:4326), layer `BlueMarble_NextGeneration` ("Blue Marble (MODIS)") atau `BlueMarble_ShadedRelief_Bathymetry` **[V]** | JPEG, tile 512 px, set `500m`, cakupan -180..180 / -90..90; statis (tanpa dimensi waktu) | data nyata (MODIS, Blue Marble) | kredit dari halaman produk; rakit di level yang memberi 4096×2048 lalu kecilkan. Alternatif: Visible Earth (halaman utama redirect 301; unduhan belum diperiksa **[?]**). `Earth.zip` (83,8 MB) di 3D Resources belum dibuka **[?]** |
| **Jupiter** | Photojournal **PIA07782** "Cassini's Best Maps of Jupiter (Cylindrical Map)", kredit NASA/JPL/Space Science Institute, JPEG `assets.science.nasa.gov/.../PIA07782.jpg` **[V]** | **3601×1801** (terukur, 2:1 ekuirectangular) | data nyata (Cassini ISS, 11-12 Des 2000, 36 citra) | kutub kurang jelas (dilihat miring melalui kabut), perlu dicatat. Alternatif Hubble PIA19643 (proyeksi peta datar belum diverifikasi **[?]**). `Jupiter.jpg` 3D Resources (720×360) dipakai hanya sebagai cadangan; halamannya sendiri bertentangan (Voyager vs HST) |
| **Saturn** | NASA 3D Resources `Saturn.jpg` **[V]** | 720×360 | **halaman NASA menyebutnya "Fictional"** | tidak boleh dipresentasikan sebagai data nyata. Peta global nyata (Cassini) belum ditemukan **[?]** |
| **Uranus** | 3D Resources `/uranus` ternyata halaman Photojournal PIA01391, foto Voyager 2 (bukan tekstur) **[V]** | foto piringan | data nyata, tapi bukan peta | folder `Uranus` ada di repo `nasa/NASA-3D-Resources` (isi berkas belum dibuka **[?]**) |
| **Neptune** | 3D Resources `Neptune.jpg` **[V]** | 720×360 | **"Texture created by Don Davis… fictional"** | seperti Saturn: ilustrasi seniman berkredit NASA/JPL |
| **Sun** | NASA SDO, `sdo.gsfc.nasa.gov/assets/img/latest/latest_2048_0171.jpg` (ada, 671 KB) **[V]** | citra piringan 2048 px, warna palsu per panjang gelombang | data nyata, **bukan peta bola** | tidak dipakai sebagai tekstur bola. Tetap `HoloSun` prosedural; SDO dipertimbangkan sebagai citra rujukan terpisah, bukan ganti tekstur |
| **Bennu** | model GLB OSIRIS-REx (sudah ada) | | NASA | tetap |

Lisensi/penggunaan (halaman NASA "Images and Media", diperbarui 27 Okt 2026): konten NASA umumnya tidak berhak cipta di AS dan boleh dipakai untuk edukasi/informasi, termasuk "computer graphical simulations" dan teks tekstur. **NASA harus disebut sebagai sumber, dan tidak boleh tersirat dukungan NASA.** Materi pihak ketiga yang bertanda hak cipta tidak termasuk. Hub 3D Resources: "free to download and use"; repo GitHub: "free and without copyright" tetapi memuat kontributor non-NASA (Ball Aerospace, DigitalSpace, dll.), jadi dicek per aset.

## 4. Tiga tingkat label (diterapkan konsisten di UI, kartu, dan narasi)

1. **Data NASA** - peta dari data misi (Mars, Moon, Venus, Mercury, Earth, Jupiter).
2. **Ilustrasi NASA** - tekstur buatan seniman berkredit NASA yang oleh halamannya sendiri disebut fiksi (Saturn, Neptune). Label: "Ilustrasi · NASA/JPL (bukan data misi)".
3. **Ilustrasi prosedural** - tidak ada peta NASA yang layak (Uranus kemungkinan, Sun). Dilabeli seperti sekarang.

Keputusan ini mengikuti aturan "jangan mengklaim lebih dari yang ada" yang dipakai di seluruh proyek. Jika tingkat 2 tidak diinginkan, Saturn/Neptune tetap tingkat 3 (lihat Bagian 8, pertanyaan 1).

## 5. Pipeline tekstur (Fase 2-3)

- Skrip baru `arvr/scripts/build-planet-textures.mjs` (pola sama dengan `build-layers.mjs`/`build-assets.mjs`): mengunduh atau merakit tile, mengubah ke ekuirectangular 2:1, menghasilkan `public/textures/<id>.jpg`.
- Anggaran ukuran: 2048×1024 JPEG q≈82, **≤ 500 KB per planet** dan total tambahan ≤ ~4 MB. Opsi 4096×2048 hanya untuk perangkat desktop jika terbukti perlu (Bagian 8, pertanyaan 3).
- Tiap berkas punya catatan asal di `public/textures/provenance.json`: URL sumber, tanggal unduh, SHA-256, ukuran piksel, kredit, jenis (data/ilustrasi).
- Rakit tile Trek/GIBS dengan gagal keras bila ada tile yang hilang (tidak menambal diam-diam), dan simpan URL GetCapabilities yang dipakai.
- `content/bodies/<id>.json`: isi `texture`, `textureCredit`, dan tandai `illustration` bila tingkat 2/3. Deskripsi EN + ID tetap (sudah ada). `npm run check:content` memeriksa kredit dan deskripsi.
- Pastikan berkas baru masuk `offline-manifest` dan service worker (`/xr/textures/...` sudah dialihkan di `vercel.json`).
- Render: `colorSpace = SRGB`, anisotropi 8 (sudah di `TexturedPlanet`). Tangani kutub (peta ekuirectangular menyempit) dan jahitan di longitudo 180°.
- Saturn: cincin tetap prosedural dengan kemiringan asli 26,73° dan lebar 1,24-2,27 R (sudah diterapkan). Tekstur cincin NASA dicari di Fase 0.

## 6. Orbit elips sesuai data NASA (Fase 1, tanpa aset baru)

**Data**

- Planet: elemen Keplerian JPL (Standish, tabel 1, berlaku 1800-2050) yang sudah ada di `ephemeris.ts`.
- Bennu: JPL SBDB. Diverifikasi 17 Nov 2026 lewat `ssd-api.jpl.nasa.gov/sbdb.api?sstr=Bennu`: e = 0,204, a = 1,13 AU, i = 6,03°, epoch JD 2455562,5. Cocok dengan konstanta di `ephemeris.ts`.
- Bulan terhadap Bumi: a ≈ 384.400 km, e ≈ 0,0549, i ≈ 5,14° (NASA Moon Fact Sheet; **angka ini dikonfirmasi ulang saat implementasi** **[?]**).

**Geometri**

1. Ambil jejak orbit dengan men-sampel `toXYZ(a, e, I, Ω, ω, M)` untuk M = 0..360° (128 titik; lebih rapat di dekat perihelion bila e besar).
2. Terapkan **satu skala seragam per orbit**: `k = hubOrbit(a) / a`. Bentuk elips (e), arah perihelion (ω), dan inklinasi tetap persis data NASA; hanya ukuran total yang dimampatkan seperti sekarang.
3. Posisi planet memakai `helioPosition(id, tanggal) × k`, **bukan lingkaran**. Planet otomatis berada tepat di jalurnya, dan kecepatannya berubah menurut hukum Kepler kedua (cepat di perihelion).
4. Matahari berada di **fokus**, bukan di pusat elips, dan hal ini muncul sendiri dari elemennya.
5. Inklinasi diikutkan apa adanya (Mercury 7°, Bennu 6°, lainnya 0-3,4°); sumbu y hub = kutub utara ekliptika.
6. Komponen baru `HoloOrbitEllipse` (titik-titik, warna, status hover) menggantikan `HoloOrbit` di hub; tanda tiap 15° dipertahankan. Bulan mengikuti elips kecil mengelilingi Bumi.
7. Opsional: penanda perihelion/aphelion dengan jarak asli dalam AU (dari a dan e).

**Harapan yang jujur:** eksentrisitas planet nyata kecil (Venus 0,007; Bumi 0,017; Neptunus 0,009), jadi elipsnya **memang tampak hampir bulat**. Yang jelas elips: Merkurius (e = 0,206), Bennu (0,204), Mars (0,093). Itu karena data aslinya, bukan kekurangan gambar. Jika ingin bentuk lebih terlihat, saklar "Exaggerate eccentricity" bisa ditambahkan dan **harus dilabeli** (bukan default).

**Teks:** "Real positions and orbital speeds" menjadi "Real orbits (ellipses, JPL elements)"; EN + ID di `i18n.ts`, `TimePanel`, dan kartu Explorer.

**Uji otomatis baru** `arvr/scripts/check-orbits.mjs` (`npm run check:orbits`): jarak minimum/maksimum jejak = a(1-e) / a(1+e) (toleransi 1e-6); posisi planet pada 5 tanggal berada di jejak (jarak ke polyline < toleransi); Matahari di fokus; tidak ada NaN.

## 7. Fase (satu per satu, berhenti di tiap akhir)

| Fase | Isi | Keluaran | Risiko |
|---|---|---|---|
| **0 Verifikasi** (tanpa kode) | buka folder `Images and Textures/` untuk Earth, Saturn, Uranus, Neptune, Venus di repo `nasa/NASA-3D-Resources`; cari nama layer warna Mercury Trek; cari peta global Cassini Saturn, Voyager 2 Uranus/Neptune di Photojournal; periksa visual `Venus.jpg`; konfirmasi nilai Bulan; cek proyeksi PIA19643; unduh sampel Blue Marble dari GIBS dan ukur | tabel Bagian 3 tanpa tanda `[?]` | kecil |
| **1 Orbit elips** | Bagian 6, tanpa aset baru | hub dengan elips + `check:orbits` | rendah (kode saja, bisa dibatalkan) |
| **2 Tekstur data nyata** | skrip build + Mercury, Venus, Earth, Jupiter (+ perapian Mars) | `public/textures/*.jpg`, `provenance.json`, JSON konten | sedang (ukuran, kutub) |
| **3 Ilustrasi NASA** | Saturn, Neptune (dan Uranus bila ada) sesuai hasil Fase 0 + label tingkat 2/3 | tekstur berlabel | sedang (kebijakan label) |
| **4 Konten, uji, performa** | deskripsi EN + ID, kredit, offline manifest, Playwright (HP dan desktop), frame time | build lulus, tangkapan layar | kecil |

## 8. Keputusan

1. **Saturn dan Neptune: DIPUTUSKAN (17 Nov 2026) = ilustrasi NASA berlabel (tingkat 2).** Tekstur NASA 3D Resources dipakai dengan label "Ilustrasi · NASA/JPL (bukan data misi)", sesuai bunyi halaman NASA ("Fictional").
2. Earth: Blue Marble statis (default, belum dijawab; awan harian ditunda).
3. Resolusi: 2048×1024 untuk semua perangkat (default, belum dijawab).
4. Elips: hanya data asli, tanpa saklar pembesar eksentrisitas (default, belum dijawab).

Poin 2-4 memakai default di atas sampai kamu mengubahnya.

### Hasil Fase 0 yang sudah dikerjakan (17 Nov 2026)

- **Uranus:** repo `nasa/NASA-3D-Resources` hanya punya folder bulan-bulannya (Ariel, Miranda, Oberon, Titania, Umbriel), **tidak ada folder Uranus**. Koreksi untuk tabel Bagian 3: Uranus tidak punya tekstur NASA yang bisa dipakai; tetap tingkat 3 (prosedural berlabel) sampai ada sumber.
- **Earth:** repo memuat `Earth (A).jpg` 1440×720 (1,4 MB, ekuirectangular) dan `Earth (B).jpg` 4095×4095 (bukan ekuirectangular). Earth (A) menjadi cadangan; sumber utama tetap GIBS Blue Marble.
- **Saturn, Neptune, Venus, Jupiter:** nama berkas dan ukuran di repo cocok dengan situs 3D Resources (`Saturn.jpg` 275.735 B, `Neptune.jpg` 210.528 B, `Venus.jpg` 1.166.974 B, `Jupiter.jpg` 225.878 B).
- **Belum:** nama layer warna Mercury Trek, peta data misi Saturn/Neptune/Uranus, proyeksi PIA19643, nilai Bulan, cincin Saturnus.

## 9. Hal di luar rencana yang saya temukan dan perlu kamu putuskan

- **Logo NASA Space Apps** yang baru dipasang di navbar memuat tulisan "NASA". Halaman NASA Brand Center menyatakan *Insignia, Logotype, dan citra identitas NASA bukan domain publik* dan penggunaannya perlu izin. Karena ini logo program tantangan, kemungkinan wajar bagi peserta, tetapi **konfirmasikan ke panitia Space Apps** sebelum deploy publik. Alternatif: logo proyek sendiri.
- Pedoman NASA tentang aplikasi AI melarang frasa "according to NASA" dalam keluaran AI. Cosmic Guide saat ini memakai "according to application records" (aman), tetapi prompt backend perlu diperiksa agar model tidak menulis kalimat bernada "NASA says".

## 10. Referensi dan status verifikasi (diperiksa 17 Nov 2026)

- NASA 3D Resources hub: https://science.nasa.gov/3d-resources/ (halaman Venus, Mars, Jupiter, Saturn, Neptune ada; Mercury dan Sun 404; Uranus mengarah ke PIA01391). Berkas teks: `https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/<benda>/<Benda>.jpg` (Venus 1440×720, Mars 1440×720, Jupiter/Saturn/Neptune 720×360, semua terunduh dan terukur).
- Repo: https://github.com/nasa/NASA-3D-Resources (folder `Images and Textures/` memuat Earth (A)/(B), Jupiter, Mars, Moon, Neptune, Pluto, Saturn, Uranus, Venus, dan bulan-bulannya; isi berkas belum dibuka).
- Mercury Trek / Solar System Treks: https://trek.nasa.gov/ ; contoh GetCapabilities terverifikasi: https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0/WMTSCapabilities.xml
- NASA GIBS: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml (layer `BlueMarble_NextGeneration`, `BlueMarble_ShadedRelief_Bathymetry`)
- Photojournal Jupiter: https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map (JPEG 3601×1801 terukur)
- Orbit: JPL Keplerian elements, https://ssd.jpl.nasa.gov/planets/approx_pos.html ; JPL SBDB API, https://ssd-api.jpl.nasa.gov/doc/sbdb.html ; Horizons API, https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Aturan penggunaan: https://www.nasa.gov/nasa-brand-center/images-and-media/
- Yang saya **tidak** dapat memverifikasi: tautan unduhan Blue Marble di Visible Earth/SVS (SVS gagal verifikasi sertifikat), nama layer warna Mercury Trek, peta global Saturn/Uranus/Neptune dari data misi, isi `Earth.zip`.

Fase 1 dimulai setelah keputusan Saturn/Neptune di atas. Bagian 9 (logo NASA, pedoman AI) masih menunggu keputusanmu.

---

## 11. Status pelaksanaan

- **Fase 0 (verifikasi): selesai sebagian** (lihat Bagian 8). Sisa: nama layer warna Mercury Trek, peta data misi Saturn/Neptune, proyeksi PIA19643, cincin Saturnus.
- **Fase 1 (orbit elips): selesai, 17 Nov 2026.**
  - `ephemeris.ts`: `orbitElements`, `orbitPathAU` (jejak penuh dari elemen JPL, disampel dalam anomali eksentrik), `MOON_ORBIT`, `moonOffset`, `moonPath`.
  - `holo.tsx`: `HoloOrbitPath` (garis dari titik nyata + tanda tiap 1/24 putaran, mengarah menjauhi Matahari).
  - `SolarSystemHub.tsx`: orbit digambar sebagai elips miring dengan Matahari di fokus; posisi tiap benda = posisi efemeris asli x satu faktor skala per orbit (bentuk, arah perihelion, inklinasi tetap persis data NASA). Bulan mengikuti elips e = 0,0549, i = 5,145 deg, periode 27,32 hari (fase Bulan tidak diikat ke tanggal sebenarnya; orientasi elips tetap).
  - Uji: `npm run check:orbits` (9 orbit x 5 tanggal + Bulan: jarak min/maks = a(1-e) / a(1+e), posisi benda berada di jejaknya, tanpa NaN). Sudah dimasukkan ke `npm run build`.
  - Terlihat jelas elips: Bennu, Merkurius, Mars. Planet lain hampir bulat karena eksentrisitas aslinya kecil, bukan karena digambar bulat.
  - Catatan tampilan: Matahari berukuran besar sehingga orbit planet dalam rapat di sekitarnya; ini keputusan ukuran, bukan orbit, dan bisa disetel terpisah.
- **Fase 2 (tekstur data nyata): selesai, 17 Nov 2026.** Mercury, Venus, Earth, Jupiter.
  - `arvr/scripts/build-planet-textures.mjs` mengunduh dari NASA saat build (bukan saat runtime), menyusun tile bila perlu, lalu menulis `public/textures/<id>.jpg` dan `public/textures/provenance.json` (URL sumber, tanggal, SHA-256 masukan dan keluaran, ukuran, kredit). Gagal keras bila ada tile atau berkas yang tidak bisa diambil. Jalankan ulang dengan `node scripts/build-planet-textures.mjs [id...]`.
  - Hasil (semua 2:1 ekuirectangular): Mercury 2048x1024 (415 KB, mosaik MDIS 166 m dari 128 tile Mercury Trek, monokrom), Venus 1440x720 (323 KB, tidak di-upscale), Earth 2048x1024 (233 KB, Blue Marble dari 50 tile GIBS), Jupiter 2048x1024 (283 KB, Cassini PIA07782 3601x1801). Total sekitar 1,2 MB, di bawah anggaran.
  - `content/bodies/{mercury,venus,earth,jupiter}.json` memuat `texture` dan `textureCredit`. Kredit Venus menyebut bahwa warna jingga buatan (radar tidak punya warna tampak).
  - `check-content` sekarang memeriksa: berkas tekstur ada di `public/`, `textureCredit` tidak kosong, dan sama dengan catatan di `provenance.json`.
  - Dicek di browser: keempat planet tampil bertekstur di Explorer.
  - Belum dikerjakan dari rencana Fase 2: perapian Mars (Mars Trek). Mars tetap memakai tekstur yang sudah ada.
  - Masih perlu dikonfirmasi: baris kredit resmi produk Blue Marble di halaman NASA (kredit sekarang deskriptif); nama layer warna Mercury Trek (sekarang monokrom, jujur untuk Merkurius).
- **Fase 3 (ilustrasi berlabel): selesai, 17 Nov 2026.**
  - **Saturn** dan **Neptune**: tekstur NASA 3D Resources (`Saturn.jpg`, `Neptune.jpg`, keduanya 720x360, diunduh skrip yang sama, 51 KB dan 48 KB, tidak di-upscale). Dicatat di `provenance.json` dengan `kind: "illustration"`, dan di `content/bodies/*.json` dengan `"textureKind": "illustration"` (kolom baru `textureKind` di `types.ts`, nilai bawaan `data`). Semua tekstur data lain kini juga memuat `"textureKind": "data"`.
  - **Label:** Explorer menampilkan "3D illustration", "Label: Illustration", dan baris sumber "Illustration, not mission data: ..." untuk keduanya, lewat jalur yang sama dengan bola prosedural (`BodyExplorer` menandai `shapeIsIllustration`). Neptune dikredit Don Davis dengan fitur awan JPL/Caltech; Saturn dikredit NASA/JPL-Caltech dan menyebut bahwa NASA menandainya fiksi.
  - **Cincin Saturnus** (di tampilan planet, bukan hanya chart hub): digambar dari NASA NSSDC Saturnian Rings Fact Sheet (terverifikasi 17 Nov 2026), dalam jari-jari khatulistiwa Saturnus: cincin C 1,239-1,526, B 1,526-1,950, Celah Cassini 1,950-2,030, A 2,030-2,270, Celah Encke 2,214. Opasitas mengikuti kedalaman optik, kecerahan mengikuti albedo. Kemiringan sumbu 26,73 derajat (NASA Saturn Fact Sheet). Ini gambar, bukan foto cincin; itu sebabnya seluruh Saturnus berlabel ilustrasi. Kamera dan orbit holo disesuaikan agar cincin muat.
  - **Uranus:** tidak ada sumber NASA yang layak, tetap bola prosedural berlabel ilustrasi (tingkat 3), tanpa perubahan.
  - **Pemeriksaan:** `check-content` kini juga memastikan `textureKind` valid, tekstur ilustrasi menyebut "illustration" di kreditnya, dan `textureKind` sama dengan `kind` di `provenance.json`.
  - **Keterbatasan:** sumbernya kecil (720x360), jadi tekstur Saturnus dan Neptunus terlihat lembut saat dibesarkan. Menaikkan resolusi tidak menambah detail, jadi tidak dilakukan.
- **Fase 4 (konten, uji, performa): selesai, 17 Nov 2026.**
  - **Konten:** ke-11 rekaman `content/bodies/*.json` memiliki deskripsi EN dan ID serta sumber; semua benda bertekstur punya `textureCredit`; ilustrasi memakai `textureKind: "illustration"`. Narasi bawaan tidak berubah.
  - **Uji otomatis baru:** `arvr/scripts/check-bodies.mjs` (Edge lewat playwright-core, seperti skrip QA lain). Untuk hub dan 11 benda pada HP 390x844 dan desktop 1280x800 (24 tampilan) ia memeriksa: tanpa error JavaScript, tidak ada aset gambar/model yang gagal, canvas 3D menggambar sesuatu, tekstur diminta dan dijawab 200 sebagai gambar, label cocok (data NASA vs ilustrasi), kredit NASA tampil di layar, tidak ada overflow horizontal. Hasil 17 Nov 2026: **24 dari 24 lulus**. Panggilan `/api/...` yang gagal tidak dianggap kegagalan (narasi punya fallback bawaan).
  - **Performa:** waktu bingkai (informasi, GPU headless) rata-rata 11-26 ms; hub desktop paling berat (sekitar 26 ms). Biaya efemeris per bingkai untuk 9 benda + Bulan diukur **0,011 ms**, jadi beban hub berasal dari render, bukan dari orbit elips. Alokasi `Vector3` per bingkai di hub dihapus.
  - **Offline:** `offline-manifest.json` memuat semua tekstur baru (`earth, jupiter, mercury, neptune, saturn, venus`); `provenance.json` dikecualikan dari manifes karena hanya untuk audit. Total tekstur baru sekitar 1,4 MB.
  - **QA:** bagian "Planet textures and orbits" ditambahkan ke `docs/QA_CHECKLIST.md`.
- **Belum / ditunda:** perapian Mars lewat Mars Trek; konfirmasi baris kredit resmi produk Blue Marble; tekstur warna Mercury (nama layer belum ditemukan); sumber data misi untuk Saturn, Neptune, Uranus; keputusan logo NASA Space Apps (Bagian 9).
