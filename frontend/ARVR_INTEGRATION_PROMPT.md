# Prompt Integrasi Frontend ke AR/VR

Salin prompt di bawah ini untuk engineer atau coding agent yang mengerjakan integrasi.

---

## Tugas

Integrasikan pengalaman frontend SPHEREx yang saat ini berada di `frontend/` ke aplikasi React/Vite AR/VR di `arvr/`, supaya pengguna dapat memulai dari UI frontend lalu berpindah ke pengalaman 3D/WebXR dalam satu aplikasi dan satu sistem routing.

## Hasil yang diinginkan

- Jadikan aplikasi React/Vite di `arvr/` sebagai host tunggal untuk UI frontend dan pengalaman AR/VR.
- Jadikan halaman Gateway/desain frontend sebagai layar awal. Pertahankan identitas visual, layout, warna, tipografi, copy, dan hierarki UX yang sudah ada di `frontend/spherex-expedition.html`; jangan menggantinya dengan desain dashboard atau UI generik.
- Pindahkan perilaku layar frontend yang masih diperlukan—Gateway, Explorer, Comparison, serta Cosmic Guide bila masih didukung—ke komponen React dan route yang dikelola oleh satu React Router.
- Pertahankan halaman AR/VR yang sudah ada, termasuk Solar System Hub, Body Explorer, dan Surface Explorer. Tambahkan navigasi yang jelas antara pengalaman 2D dan 3D/XR.
- Pertahankan konteks target/observasi saat berpindah dari frontend ke AR/VR jika datanya tersedia; jangan mengarang nilai atau metadata yang tidak disediakan.

## Routing dan deployment

- Petakan seluruh layar ke satu router di aplikasi `arvr/`. Usulan route:
  - `/` — Gateway frontend dan titik masuk aplikasi.
  - `/explorer`, `/comparison`, dan `/guide/:objectId` — layar frontend yang dimigrasikan.
  - `/xr` — Solar System Hub.
  - `/xr/body/:id` dan `/xr/surface/:siteId` — route AR/VR yang sudah tersedia.
- Pertahankan deep link AR/VR yang sudah digunakan. Jika perlu mengubah route, sediakan redirect/alias yang kompatibel.
- Periksa `vercel.json` root dan konfigurasi deploy `arvr/`. Atur agar route aplikasi dilayani oleh satu aplikasi frontend/AR/VR, sedangkan `/api/*` tetap menuju backend. Perhatikan `base: '/xr/'`, asset URL, refresh pada deep link, dan cakupan service worker; jangan mengubahnya tanpa memeriksa dampaknya.
- Jangan memakai iframe atau hanya menautkan ke deployment frontend terpisah sebagai pengganti integrasi.

## Desain dan aset

- UI frontend harus tetap terasa sebagai desain frontend yang sama setelah dimigrasikan ke React. Ambil style dan perilakunya sebagai referensi, bukan menyalin seluruh file HTML beserta script globalnya ke dalam React.
- Pindahkan hanya aset yang benar-benar diperlukan. Letakkan di struktur aset `arvr/` yang sesuai dan pastikan path-nya bekerja pada development maupun production di bawah base path Vite.
- Jangan menghapus, memindahkan, atau mengganti aset AR/VR yang sudah digunakan.
- Pertahankan layout responsif, aksesibilitas, state loading/error, dan fallback 2D ketika WebXR tidak tersedia.

## Batasan teknis

- Sebelum mengubah kode, periksa `PLAN.md`, `AGENTS.md`, `API_CONTRACT.md`, `docs/INTEGRATION_ARCHITECTURE.md`, audit frontend/ARVR, serta route dan komponen yang benar-benar ada.
- Hormati kontrak API yang terverifikasi. Jangan menebak bentuk response atau menaruh API key di browser.
- Pertahankan arsitektur backend FastAPI; jangan memindahkan tanggung jawab backend ke frontend.
- Buat perubahan bertahap dan minimal. Hindari rewrite besar yang tidak diperlukan.
- Catat keputusan perubahan arsitektur/routing di `docs/DECISIONS.md` jika file tersebut tersedia atau diwajibkan oleh aturan proyek.
- Jangan commit, push, merge, atau deploy.

## Acceptance criteria

1. Aplikasi dimulai dari Gateway dengan desain frontend yang dikenali dan berfungsi.
2. Navigasi Gateway → Explorer/Comparison → AR/VR berjalan dalam satu aplikasi dan satu router, tanpa iframe atau frontend terpisah.
3. Route AR/VR lama dan deep link-nya tetap berfungsi atau memiliki alias/redirect yang jelas.
4. Route frontend dan AR/VR dapat dibuka langsung serta tetap berfungsi setelah refresh.
5. Aset, service worker, dan Vite base path bekerja pada development dan build production.
6. `/api/*` tetap dirutekan ke backend dan kegagalan API ditampilkan secara eksplisit.
7. Build/type-check dan test relevan lulus. Laporkan perintah dan hasil aktual; jangan mengklaim deployment sudah diverifikasi jika belum dideploy.

Mulai dengan merangkum route dan alur state saat ini, lalu implementasikan integrasi. Jangan berhenti pada rencana saja kecuali ada konflik arsitektur atau requirement yang membutuhkan keputusan pemilik proyek.
