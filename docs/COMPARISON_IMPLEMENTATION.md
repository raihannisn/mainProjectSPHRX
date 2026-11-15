# Implementasi Halaman Observation Comparison (`/comparison`)

Dokumen ini menjelaskan arsitektur, alur data, dan detail implementasi untuk halaman **Observation Comparison** pada proyek SPHEREx Cosmic Expedition. Halaman ini memungkinkan pengguna membandingkan dua citra observasi (T1 dan T2) dari teleskop SPHEREx.

## 1. Tujuan Fitur
- Menyajikan perbandingan visual antara dua epoch observasi (T1 dan T2) pada area langit yang sama.
- Memungkinkan pengguna melihat perubahan (variabilitas) objek astronomi, seperti debu protobintang atau garis emisi terionisasi.
- Menyediakan konteks ilmiah melalui panel informasi dan asisten AI (Cosmic Guide).

## 2. Arsitektur Komponen
Halaman ini dibangun menggunakan React (TypeScript) dan terdiri dari beberapa komponen utama:

| Komponen | Deskripsi |
| :--- | :--- |
| `ObservationComparisonScreen.tsx` | Komponen utama yang menangani *state* slider, mode blink, dan integrasi AI. |
| `ComparisonSlider` | Komponen *slider* interaktif untuk membandingkan gambar T1 dan T2 secara horizontal. |
| `BlinkComparator` | Mode yang secara otomatis menggantikan gambar T1 dan T2 dengan interval tertentu. |
| `InfoPanel` | Panel *glassmorphism* yang menampilkan metadata objek (nama, jarak, deskripsi). |
| `AIChatPanel` | Panel chat untuk berinteraksi dengan Cosmic Guide AI. |

## 3. Alur Data & API Endpoints
Halaman ini bergantung pada beberapa *endpoint* dari Backend FastAPI:

| Endpoint | Method | Fungsi |
| :--- | :--- | :--- |
| `/api/objects/{object_id}` | GET | Mengambil metadata objek (misal `rcw-36`). |
| `/api/image/t1` | GET | Mengambil citra observasi T1 (PNG). |
| `/api/image/t2` | GET | Mengambil citra observasi T2 (PNG). |
| `/api/ai/chat` | POST | Mengirim pertanyaan ke AI dan menerima jawaban. |

**Contoh Request AI:**
```json
POST /api/ai/chat
{
  "message": "Jelaskan perbedaan antara T1 dan T2 pada RCW 36."
}
```

**Contoh Response AI:**
```json
{
  "reply": "Perbedaan utama terletak pada intensitas emisi debu..."
}
```

## 4. State Management
State utama dikelola menggunakan `useState` di `ObservationComparisonScreen.tsx`:

- `sliderPos` (number): Posisi *slider* (0-100).
- `isBlinking` (boolean): Status mode blink.
- `showT1` (boolean): Menentukan gambar mana yang ditampilkan saat blink.
- `aiMessages` (array): Riwayat chat AI.
- `isAiLoading` (boolean): Status loading AI.

## 5. Animasi & Interaksi
- **Fade-in:** Hero section muncul dengan animasi `fadeInUp` (CSS keyframes).
- **Slider Glow:** Handle slider memiliki efek *glow* neon cyan menggunakan `box-shadow`.
- **Blink:** Transisi opacity antar gambar T1/T2.
- **AI Typewriter:** Jawaban AI dirender menggunakan `react-markdown` dan bisa ditambahkan efek *typewriter* (opsional).

## 6. Optimasi Performa
- Menggunakan CSS `transform` dan `opacity` untuk animasi (GPU-accelerated).
- Menghindari *layout shift* dengan tidak menganimasikan properti `width` atau `height`.
- Gambar di-*load* secara *lazy* jika memungkinkan.
- Mode blink menggunakan `setInterval` yang dibersihkan saat komponen di-*unmount*.

## 7. Integrasi AI (Cosmic Guide)
- Fungsi `handleSendMessage` mengirim POST request ke `${BASE_URL}/api/ai/chat`.
- `BASE_URL` ditentukan dari environment (`import.meta.env.DEV` untuk lokal, atau Vercel untuk production).
- Jawaban AI dirender dengan `ReactMarkdown` dan `remark-gfm` agar format Markdown (heading, bold, list) tampil rapi.

## 8. Responsivitas
- Layout menggunakan CSS Grid (`grid-template-columns: 1fr 1fr`) yang otomatis berubah menjadi satu kolom (`1fr`) pada layar di bawah 768px.
- Ukuran font menggunakan `clamp()` agar menyesuaikan lebar layar.
- Slider dan gambar memiliki `aspect-ratio: 16/9` untuk menjaga proporsi di semua device.
