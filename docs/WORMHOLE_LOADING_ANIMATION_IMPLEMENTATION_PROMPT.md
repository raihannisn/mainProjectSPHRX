# Prompt Implementasi: Wormhole Loading di AR/VR

Implementasikan animasi wormhole dari `C:\Users\ahmad\Downloads\ax-wormhole-transition.html` secara selektif di aplikasi React/Vite pada `arvr/`.

## Batas inspeksi

- Baca hanya modul wormhole pada HTML tersebut, `TopBar.tsx`, dan komponen/titik pemanggil untuk masuk ke XR serta loading Explorer/Comparison.
- Jangan audit atau membaca ulang seluruh repo. Jangan gunakan subagent.
- Cek `git status` dan diff sebelum mengedit; pertahankan semua perubahan yang sudah ada.

## Perilaku yang diminta

- Gunakan **overlay wormhole penuh** saat pengguna secara sengaja masuk ke `/xr` dan memang ada transisi/loading scene. Gunakan posisi tombol pemicu sebagai origin jika mudah didapat.
- Untuk pencarian data Explorer/Comparison, gunakan indikator wormhole versi ringkas/lokal saja; jangan menutupi seluruh halaman atau navbar selama request biasa.
- Tampilkan hanya saat kerja nyata berlangsung. Jangan menambah delay buatan panjang atau progress palsu. Pastikan overlay selalu ditutup setelah sukses maupun error.
- Ambil visual canvas, cincin, star streak, dan palet dari modul sumber; jangan salin demo UI, tombol demo, script global `window.AX`, atau hook `ZX`.
- Integrasikan dengan lifecycle React, bersihkan animation frame/listener saat unmount, cegah pemanggilan ganda, dan hormati `prefers-reduced-motion`.
- Tambahkan toggle ambience yang aksesibel dan **aktif secara default**; gunakan MP3 `C:\Users\ahmad\Downloads\Hans Zimmer (Interstellar Main Theme) - Space 4k - no copyright Interstaller inspired Music.mp3` (pengguna menyatakan izinnya sudah diverifikasi). Pindahkan/copy ke asset `arvr/` yang sesuai tanpa mengubah file sumber; ikuti syarat lisensi/atribusi. Audio mengikuti lifecycle overlay, bervolume rendah, fade-out saat ditutup, mematuhi kebijakan autoplay browser, dan pilihan toggle tersimpan.
- Sediakan status aksesibel (`role="status"`, `aria-live`) dan teks Indonesia/Inggris yang mengikuti pola bahasa aplikasi.
- **Pertahankan Dynamic Island** di `TopBar.tsx`: jangan ubah state, scroll behavior, menu, spacer, atau desainnya. Overlay hanya menutupnya sementara selama transisi XR, lalu hilang bersih.
- Jangan ubah API, data, routing, atau XR scene behavior di luar pemicu loading yang diperlukan. Jangan tambah dependency.

## Selesai bila

- XR entry menampilkan lalu menghilangkan transisi wormhole dengan benar.
- Loading data tetap lokal dan non-blocking; kondisi error tidak meninggalkan overlay aktif.
- Reduced motion, perpindahan rute, unmount, dan Dynamic Island tetap berfungsi.
- `cd arvr; npm run build` lulus. Laporkan file yang diubah dan hasil perintah yang benar-benar dijalankan.

Implementasikan langsung dalam satu lintasan kecil; jika detail kecil belum pasti, ikuti pola React yang sudah ada dan jangan memperluas scope.
