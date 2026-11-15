# Master Plan: Cosmic Guide untuk Objek Orbit AR/VR

Dokumen ini menjadi prompt kerja untuk Fable 5.2. Tujuannya adalah mengintegrasikan Cosmic Guide yang sudah ada dengan objek yang dipilih pada pengalaman orbit AR/VR, menyelaraskannya dengan desain FE terbaru, lalu mengintegrasikan hasilnya ke branch integrasi dengan aman.

## Konteks Repository

- Branch kerja yang dimaksud: `feature/spherex-mission-liaison-agent`.
- Branch tujuan yang disebut sebagai branch `integrasi`: verifikasi nama sebenarnya sebelum bertindak. Repository sebelumnya memiliki `integration/ai-fe-sync`; pastikan apakah itu branch tujuan yang dimaksud. Jangan menebak atau berpindah branch tanpa memeriksa.
- Pada pemeriksaan terakhir, branch fitur bersih dan mengikuti remote. Commit merge `274deeb` dari `integration/ai-fe-sync` belum ada di branch fitur saat itu. Verifikasi ulang branch, status worktree, dan riwayat commit sebelum mengubah apa pun.
- Jangan menghapus, menimpa, me-reset, atau mengabaikan pekerjaan yang sudah ada di branch mana pun. Jangan force-push. Jangan commit, push, atau deploy kecuali diminta secara eksplisit.

## Tujuan

Pengguna dapat memilih objek pada orbit di AR atau VR, lalu bertanya kepada Cosmic Guide tentang objek tersebut. AI menerima konteks objek yang benar dari aplikasi, menjawab berdasarkan data yang tersedia, mengikuti maksud pertanyaan terbaru, dan meminta klarifikasi jika nama objek yang disebut tidak cocok.

Pertahankan arsitektur hybrid saat ini:

- Backend: FastAPI di `backend/`.
- Frontend utama dan referensi desain: `frontend/`.
- Aplikasi React/Vite, Three.js, dan WebXR: `arvr/`.

Baca `docs/INTEGRATION_ARCHITECTURE.md` dan audit yang relevan di `docs/audit/`. Cocokkan dokumentasi dengan implementasi branch yang benar-benar aktif; jangan menganggap dokumentasi selalu mutakhir.

## Alur Pengalaman Pengguna

1. Pengguna melihat objek di orbit pada AR/VR dan memilih objek atau membuka panel detailnya.
2. Aplikasi mendapatkan identitas objek dari state dan sumber data yang sudah ada. Kirim ID kanonis dan nama; sertakan koordinat, metadata, atau konteks observasi hanya jika tersedia dan relevan.
3. Pengguna membuka Cosmic Guide atau mengirim pertanyaan melalui teks/suara. Frontend meneruskan pertanyaan terbaru beserta konteks objek yang dipilih melalui kontrak API Agent yang sudah ada.
4. Backend mencari data objek dan konteks terkait. Jawaban hanya menggunakan informasi yang relevan dan tersedia; data katalog dibedakan dari hasil observasi atau bukti yang diverifikasi secara independen.
5. Jika pengguna menyebut objek lain atau nama ambigu yang tidak cocok dengan objek terpilih, AI tidak boleh menggantinya diam-diam dengan objek terpilih. AI harus menyatakan ketidakcocokan dan meminta klarifikasi singkat.
6. Jawaban ditampilkan memakai desain FE terbaru. Pemilihan objek dan konteks percakapan tetap konsisten saat pengguna berpindah antara orbit AR/VR, layar Cosmic Guide, teks, dan fitur suara yang tersedia.

## Tahapan Kerja

### Tahap 1: Pemeriksaan branch dan pemetaan implementasi

- Catat branch aktif, target branch yang tersedia, status worktree, dan perbedaan penting di antara branch.
- Hentikan perubahan jika ada perubahan lokal yang berisiko tertimpa atau nama branch integrasi belum jelas.
- Telusuri alur Cosmic Guide yang sudah ada: endpoint/backend Agent, pemilihan objek di FE, state objek orbit AR/VR, event bridge, routing, serta desain FE terbaru.
- Periksa kontrak event yang ada. Dokumentasi mencatat event `cosmic:ask-guide` dengan payload `{ body, hotspotId, guidePrompt }`; verifikasi di source dan pertahankan kompatibilitas jika kontrak tersebut masih digunakan.
- Buat peta singkat dari objek yang dipilih hingga request backend sebelum mengubah kode.

### Tahap 2: Penyelarasan identitas dan konteks objek

- Tentukan satu sumber kebenaran untuk objek yang dipilih dan cara konteks tersebut diteruskan ke Agent.
- Jangan menganggap ID Solar System di `arvr/content/bodies/` otomatis sama dengan ID katalog backend di `backend/kamus_object.json`.
- Jangan membuat alias atau pemetaan objek tanpa bukti di data/config yang ada. Jika objek orbit belum didukung katalog/backend, Cosmic Guide harus menjelaskan keterbatasan data, bukan mengarang fakta.
- Teruskan hanya konteks minimum yang dibutuhkan Agent, dengan tipe/validasi yang sesuai kontrak aplikasi.

### Tahap 3: Integrasi AR/VR ke Cosmic Guide

- Gunakan API dan service Agent yang sudah ada; jangan membuat Agent atau backend duplikat khusus AR/VR.
- Hubungkan pemilihan objek orbit ke pembukaan atau pengiriman pertanyaan Cosmic Guide melalui pola state, event, atau navigasi yang memang digunakan aplikasi.
- Pastikan pergantian objek memperbarui konteks untuk pertanyaan berikutnya tanpa menyalahartikan pesan sebelumnya.
- Pertahankan jalur teks dan suara yang telah tersedia. Tangani kegagalan API secara eksplisit dengan pesan yang sesuai.
- Implementasikan UI mengikuti hierarki, komponen, dan gaya dari desain FE terbaru. Jika ada beberapa desain yang saling bertentangan, identifikasi sumber yang dimaksud dan minta keputusan sebelum melakukan perubahan besar.

### Tahap 4: Grounding dan perilaku jawaban

- Jawab pertanyaan terbaru secara langsung dan hanya gunakan field backend yang relevan.
- Gunakan konteks objek terpilih hanya jika nama/ID cocok atau rujukan percakapan jelas.
- Untuk nama yang tidak cocok atau ambigu, minta klarifikasi; jangan menyamakan nama tersebut dengan objek yang kebetulan sedang dipilih.
- Jangan membuat observasi SPHEREx, pengukuran, jarak, tanggal, deteksi, atau sitasi.
- Perlakukan field `source` pada record sebagai label katalog, bukan sitasi yang otomatis memverifikasi klaim.
- Jika data objek tidak tersedia, nyatakan keterbatasan tersebut dan tawarkan langkah lanjutan yang spesifik, bukan jawaban katalog yang dibuat-buat.

### Tahap 5: Pengujian dan pemeriksaan UX

- Tambahkan atau sesuaikan tes terfokus untuk alur pemilihan objek, konteks request, target yang tidak cocok, dan data yang tidak tersedia.
- Jalankan tes backend serta build/lint atau smoke test FE dan AR/VR yang relevan dan sudah tersedia.
- Verifikasi secara fungsional setidaknya:
  - memilih objek A lalu bertanya menghasilkan konteks A;
  - memilih objek B memperbarui konteks untuk pertanyaan berikutnya;
  - menyebut nama yang tidak cocok menghasilkan klarifikasi, bukan jawaban tentang objek terpilih;
  - objek tanpa record backend tidak menghasilkan detail yang direka;
  - tampilan Cosmic Guide tetap konsisten dengan desain FE terbaru dan tidak merusak navigasi AR/VR;
  - kegagalan jaringan atau backend terlihat jelas, bukan sukses palsu.
- Laporkan hasil tes aktual; jangan menyatakan hal yang belum dijalankan sebagai lulus.

### Tahap 6: Integrasi branch

- Implementasikan dan validasi perubahan pada branch kerja yang benar terlebih dahulu.
- Sebelum mengintegrasikan ke branch tujuan, periksa ulang status dan riwayat kedua branch serta tinjau seluruh diff.
- Pertahankan commit dan perubahan yang sudah ada di branch tujuan. Gunakan strategi yang tidak menulis ulang riwayat dan integrasikan hanya perubahan yang diperlukan.
- Jika ada konflik, perubahan lokal yang tidak terkait, atau branch tujuan tidak jelas, berhenti dan laporkan file serta konflik yang spesifik untuk mendapatkan arahan.
- Jangan melakukan reset destruktif, force-push, commit, push, atau deploy tanpa izin eksplisit.

## Kriteria Penerimaan

- Cosmic Guide menerima konteks objek orbit yang dipilih pengguna dengan konsisten di AR dan VR.
- Backend Agent yang sudah ada digunakan kembali; tidak ada implementasi Agent duplikat.
- Jawaban berlandaskan data backend dan benar-benar menjawab pertanyaan terbaru.
- Nama objek yang tidak cocok memicu klarifikasi, bukan substitusi objek diam-diam.
- Data yang tidak tersedia atau error upstream disampaikan dengan jujur.
- Perubahan mengikuti desain FE terbaru dan mempertahankan fungsi yang sudah ada pada branch integrasi.
- Tes relevan lulus dan hasil build/smoke test dilaporkan berdasarkan eksekusi nyata.

## Laporan Akhir yang Diminta

Laporkan:

1. Branch sumber dan branch tujuan yang benar-benar digunakan.
2. File yang berubah dan ringkasan alur objek orbit ke Agent.
3. Cara konteks objek diselaraskan antara AR/VR, FE, dan backend.
4. Strategi integrasi branch serta konflik atau keputusan yang masih menunggu.
5. Tes/build/smoke test yang benar-benar dijalankan dan hasilnya.
6. Status commit, push, dan deploy secara eksplisit; jangan mengklaim berhasil bila belum dilakukan.
