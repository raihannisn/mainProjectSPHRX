# Implementasi: Agentic AI Text-to-Speech

Target branch: `final` (basis `origin/final`, commit `10dc38e`).
Sumber fitur: `origin/sebelum-overhaul` (commit `9ffc673`).
Status: Fase 1 dan Fase 2 sudah diimplementasikan (commit lokal di `final`). Suara asli belum diuji karena backend lokal belum punya `GEMINI_API_KEY`; pengujian memakai audio stub.

## 1. Tujuan

1. **Fase 1**: TTS agentic dari `sebelum-overhaul` (yang berjalan ketika objek diklik) menggantikan TTS di `final`. Tidak ada fitur lain yang berubah.
2. **Fase 2** (setelah Fase 1 terbukti jalan): tombol TTS berikon mic yang bersih di floating window Cosmic Agent, dengan layout rapi.

## 2. Temuan dari perbandingan dua branch

| Bagian | `sebelum-overhaul` | `final` |
| --- | --- | --- |
| Mesin suara `arvr/src/xr/agentSpeech.ts` | ada | identik |
| `requestAgentSpeech` di `arvr/src/frontend/api.ts` (`POST /api/agent/voiceover/text`) | ada | identik |
| Backend `voiceover_service.py`, `gemini_tts_provider.py`, `routes/agent.py` | ada | identik |
| Kartu `CatalogObjectCard3D` | terlihat, ada status suara dan tombol "Replay AI voice" yang bisa diklik | disembunyikan (`hidden`), suara tetap diputar otomatis tetapi tidak ada tombol |
| Klik planet di `SolarSystemHub` | memanggil `unlockAgentSpeech()` | sama |
| Rute `/xr`, `XRRoot`, `Hud` | ada | dihapus, semua 3D ada di `/explorer` |

Kesimpulan: mesin suara dan backend sudah sama. Yang hilang di `final` adalah **alur klik**: ringkasan dari agent, status suara, dan tombol putar ulang yang terlihat. Jadi Fase 1 bukan menyalin file mesin, melainkan mengembalikan alur itu ke Explorer milik `final`.

## 3. Fase 1: alur TTS agentic ketika objek diklik

### Perilaku yang dituju (sama dengan `sebelum-overhaul`)

1. Pengguna mengklik planet di Solar System. Klik itu membuka kunci audio browser.
2. Explorer mengambil record katalog objek, lalu meminta ringkasan dua kalimat ke Mission Liaison Agent.
3. Ringkasan itu dikirim ke `/api/agent/voiceover/text` dan diputar.
4. Kartu objek menampilkan ringkasan, status suara (memuat, memutar, siap, gagal), dan tombol putar ulang.
5. Pindah objek atau keluar menghentikan suara.

### Langkah kerja

1. **Ekstrak hook `useAgentNarration`** ke `arvr/src/xr/useAgentNarration.ts`. Isinya dipindahkan apa adanya dari `CatalogObjectCard3D.tsx` (efek pemuatan, state suara, `replaySpeech`). Hook mengembalikan `{ object, guideText, catalogMessage, speechStatus, speechError, canReplay, replay }`.
2. **`CatalogObjectCard3D.tsx`** memakai hook itu. Tampilan 3D-nya tidak berubah.
3. **`ModelViewer3D.tsx`**: kartu 3D tidak lagi dirender tersembunyi di viewer inline (`showObjectCard={false}`), supaya permintaan agent dan suara tidak berjalan dua kali.
4. **`SkyExplorerScreen.tsx`**: kartu objek (`.fe-hud-object`) memanggil `useAgentNarration` untuk body yang sedang dibuka, lalu menampilkan:
   - ringkasan agent di paragraf kartu (jatuh ke deskripsi lokal bila agent gagal),
   - satu baris status suara,
   - satu tombol bulat putar ulang (toggle: putar / hentikan).
5. **CSS** hanya ditambahkan di akhir `frontend.css` (`.fe-voice-row`, `.fe-voice-btn`). Tidak ada aturan lama yang diubah.

### Yang tidak boleh berubah

Homepage, wormhole, navbar, audio ambience, tombol Cosmic Agent, Comparison, tombol dock bawah, dan layout. Hanya isi kartu objek yang bertambah. Semua teks baru berbahasa Inggris.

### File yang disentuh

- `arvr/src/xr/useAgentNarration.ts` (baru)
- `arvr/src/xr/CatalogObjectCard3D.tsx`
- `arvr/src/frontend/components/ModelViewer3D.tsx`
- `arvr/src/frontend/components/SkyExplorerScreen.tsx`
- `arvr/src/frontend/styles/frontend.css` (tambahan di akhir)

### Kriteria selesai Fase 1

- Klik Mars dari Solar System: tepat satu permintaan `/api/agent/chat` dan satu `/api/agent/voiceover/text`, lalu suara terdengar.
- Tombol putar ulang memutar lagi tanpa permintaan baru.
- Pindah ke Moon menghentikan suara Mars.
- Backend mati: kartu menampilkan deskripsi lokal dan status gagal, tanpa error halaman.
- `npm run check:content`, `tsc --noEmit`, `vite build` lolos.
- Posisi tombol toolbar, tombol aksi, dan dock sama sebelum dan sesudah (`scripts/measure-layout.mjs`).
- Diuji dengan backend asli, bukan stub, sebelum lanjut ke Fase 2.

## 4. Fase 2: tombol mic di floating window Cosmic Agent

### Perilaku

- Satu tombol bulat berikon mic di header `CosmicGuideWindow`, di sebelah kiri tombol tutup. Ukuran dan gaya sama dengan `.cg-icon-btn`.
- Tombol adalah toggle (`aria-pressed`): menyala berarti setiap jawaban agent yang baru dibacakan.
- Saat suara sedang diputar, ikon berubah ke keadaan aktif. Klik lagi menghentikan suara dan mematikan toggle.
- Pilihan disimpan di `localStorage`, default mati, supaya tidak ada suara tanpa diminta.
- Membuka jawaban baru menghentikan suara sebelumnya. Menutup window menghentikan suara.

### Langkah kerja

1. `arvr/src/frontend/guide/MicIcon.tsx` (baru): ikon SVG garis tipis, `currentColor`, tanpa warna ungu atau pink.
2. `arvr/src/frontend/guide/useGuideSpeech.ts` (baru): memantau pesan bot terakhir, memanggil `requestAgentSpeech` lalu `playAgentSpeech`, dan mengelola stop serta status.
3. `CosmicGuideWindow.tsx`: tambah tombol di `.cg-head`, sambungkan ke hook.
4. CSS ditambahkan di akhir (`.cg-icon-btn--voice`, keadaan aktif). Header tetap satu baris di 320px.

### Kriteria selesai Fase 2

- Toggle menyala lalu kirim pertanyaan: jawaban dibacakan.
- Toggle mati: tidak ada permintaan voiceover.
- Target sentuh minimal 44px. Tidak ada tumpang tindih di 320, 390, 768, 1280.
- Berjalan di floating window dan di halaman `/guide`.

## 5. Hal yang perlu dikonfirmasi

1. **Arti ikon mic.** Rencana ini menganggap mic adalah tombol untuk membacakan jawaban agent (text-to-speech). Jika yang dimaksud adalah input suara (bicara ke agent), cakupannya berbeda.
2. **VR/AR.** `final` sudah tidak punya rute `/xr`. Rencana ini tidak mengembalikannya, sesuai "tanpa mengubah fitur lain".
3. **Bahasa suara.** Mengikuti pengaturan bahasa yang sudah ada (`en` / `id`), sama seperti `sebelum-overhaul`.

## 6. Aturan kerja

- Commit lokal dulu, tanpa atribusi AI. Tidak ada push atau PR tanpa perintah.
- Fase 2 baru dimulai setelah Fase 1 dikonfirmasi jalan.

## 7. Pembaruan: suara cadangan dan input mikrofon

- **Narator tidak lagi "unavailable" tanpa key.** Bila `/api/agent/voiceover/text` gagal (key belum ada, offline, rate limit), teks yang sama dibacakan suara bawaan browser (`arvr/src/xr/browserVoice.ts`). Kartu menampilkan "Replay voice (browser)". Begitu `GEMINI_API_KEY` terpasang, suara AI dipakai otomatis.
- **Mic adalah input suara.** Tombol mic bulat di baris input Cosmic Guide: tekan untuk merekam, tekan lagi untuk mengirim. Klip dikirim ke `/api/agent/voice/transcribe`; pengenal suara browser berjalan bersamaan dan dipakai bila backend gagal. Jawaban atas pertanyaan suara dibacakan.
- **Tombol header menjadi ikon speaker** (baca jawaban, mati secara default).
- **Mikrofon diblokir**: pesan jelas, tanpa error halaman. Mikrofon dilepas begitu rekaman berhenti; batas rekaman 30 detik.

### Agar suara AI asli dan chat bebas berjalan

1. Buat file `backend/.env` di folder backend yang dijalankan, isi `GEMINI_API_KEY=<key>`.
2. Restart backend (`uvicorn main:app`). Key hanya dibaca saat start.
3. Tanpa key: chat bebas dan transkripsi backend menjawab 503; narator dan mic tetap jalan lewat browser.
