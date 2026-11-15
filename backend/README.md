# SPHEREx Cosmic Explorer API 🌌🔭

> **NASA Space Apps Challenge Backend Engine**  
> High-performance, modular FastAPI backend for exploring NASA SPHEREx mission data, infrared spectral cutouts, real-time IVOA SIA2 observation queries, and normalized NASA Open APIs.

---

## 🛠️ Teknologi yang Digunakan

- **[FastAPI](https://fastapi.tiangolo.com/)**: Modern, high-performance web framework for Python async APIs.
- **[Astropy](https://www.astropy.org/)**: The core Python package for professional astronomy and astrophysics, used for raw FITS parsing and coordinate systems.
- **[Astroquery](https://astroquery.readthedocs.io/)**: Programmatic interface for querying NASA/IPAC Infrared Science Archive (IRSA) via IVOA SIA2/TAP protocols.
- **[HTTPX](https://www.python-httpx.org/)**: Asynchronous, non-blocking HTTP client for external NASA APIs.
- **[Uvicorn](https://www.uvicorn.org/)**: Lightning-fast ASGI web server implementation.
- **[NumPy](https://numpy.org/) & [Matplotlib](https://matplotlib.org/)**: Image reconstruction and array calculations for infrared cutout generation.

---

## 🚀 Cara Instalasi & Menjalankan di Lokal

### 1. Prasyarat
Pastikan Python 3.10+ sudah terpasang di sistem kamu.

### 2. Buat & Aktifkan Virtual Environment
```bash
# Clone atau buka direktori backend
cd backend

# Buat virtual environment
python3 -m venv .venv

# Aktifkan virtual environment
# Di macOS / Linux:
source .venv/bin/activate
# Di Windows:
# .venv\Scripts\activate
```

### 3. Install Dependensi
```bash
pip install -r requirements.txt
```

### 4. Jalankan Server Development
```bash
uvicorn main:app --reload --port 8000
```
Server akan aktif di `http://localhost:8000`.

---

## 📡 Daftar Endpoint Utama

### 1. Antarmuka & Sistem (System)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/` | **Root Redirect**: Secara otomatis mengalihkan pengguna ke dashboard `/mission-control`. |
| `GET` | `/mission-control` | **Mission Control UI**: Interactive API documentation, test bench, dan visualizer berpenampilan modern SaaS. |
| `GET` | `/api/status` | Status kesiapan backend, engine astrofisika yang aktif, dan arsip data IRSA. |
| `GET` | `/docs` | Dokumentasi interaktif OpenAPI / Swagger UI standar. |

### 2. Pencarian Observasi Dinamis SPHEREx (IRSA SIA2)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/spherex/observations` | Melakukan pencarian dinamis katalog observasi teleskop SPHEREx langsung ke NASA/IPAC IRSA via IVOA SIA2 (Simple Image Access v2). |

**Query Parameters:**
- `ra` (*float*, wajib): Right Ascension dalam derajat (`0.0` s/d `360.0`).
- `dec` (*float*, wajib): Declination dalam derajat (`-90.0` s/d `90.0`).
- `radius` (*float*, opsional, default: `0.05`): Radius pencarian sudut dalam derajat.
- `collection` (*str*, opsional, default: `'spherex_qr3'`): Nama koleksi rilis data IRSA.
- `start_date` (*str*, opsional): Filter tanggal mulai observasi (`YYYY-MM-DD`).
- `end_date` (*str*, opsional): Filter tanggal akhir observasi (`YYYY-MM-DD`).
- `detector` (*str*, opsional): Filter detektor spektrometer (`D1` - `D6` atau `SPHEREx-D1`).

### 3. Citra & Metadata FITS Ilmiah (SPHEREx Data)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/image/t1` | Menyajikan citra inframerah cutout 2D rekonstruksi file FITS mentah (Time 1). Dilengkapi HTTP caching. |
| `GET` | `/api/image/t2` | Menyajikan citra inframerah cutout 2D rekonstruksi file FITS mentah (Time 2). |
| `GET` | `/api/metadata/fits` | Membaca dan memvalidasi header biner file observasi FITS asli teleskop SPHEREx (RA, DEC, Telescope, Observation Date). |

### 4. Ensiklopedia Astronomi & NASA Open APIs
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/objects/{object_id}` | Basis data objek tata surya & komet untuk kebutuhan hotspot WebXR/AR dan Frontend (contoh: `mars`, `halley`, `jupiter`). |
| `GET` | `/api/nasa/apod` | Mengambil Astronomy Picture of the Day resmi dari NASA, lengkap dengan fallback graceful degradation jika server NASA sedang down. |
| `GET` | `/api/nasa/neows` | Menarik dan menormalisasi 50+ data asteroid Near-Earth Objects dari NASA NeoWs feed. |

### 5. Uji SPHEREx Voice-over (Gemini TTS)

Demo terpisah ini menyediakan naskah statis Bahasa Indonesia dan Inggris yang
disimpan di Backend. Browser hanya menerima audio WAV; Gemini API key tetap
berada di environment Backend.

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/voiceover-test` | Halaman uji mandiri untuk memilih naskah/bahasa/suara dan memutar audio. |
| `GET` | `/api/agent/voiceover/scripts?language=id` | Mengambil naskah yang disediakan Backend (`id` atau `en`). |
| `POST` | `/api/agent/voiceover` | Menghasilkan dan mengembalikan audio WAV untuk naskah yang diizinkan. |
| `POST` | `/api/agent/chat` | Menghasilkan jawaban Cosmic Guide Bahasa Indonesia/Inggris melalui Gemini. |
| `POST` | `/api/agent/voice/transcribe?language=id` | Mentranskripsikan klip PTT (maks. 8 MB) tanpa menyimpan audio di aplikasi. |
| `POST` | `/api/agent/voice/session` | Menerbitkan token ephemeral untuk sesi Continuous Voice Gemini Live demo. |
| `POST` | `/api/agent/voiceover/text` | Menghasilkan audio WAV dari jawaban Agent (maksimum 500 karakter). |

Chat mengirim maksimal 10 pesan terakhir, dengan batas 500 karakter per pesan.
Push-to-Talk mengunggah audio hanya setelah pengguna menghentikan rekaman;
Backend mengirimnya ke Gemini 3.5 Transcribe, meminta penghapusan file sementara
segera setelah transkripsi, dan meneruskan teks ke endpoint chat yang sama.
Model file API Gemini menyimpan file selama 48 jam secara default, sehingga
penghapusan langsung tetap dicoba pada setiap hasil atau kegagalan transkripsi.
Continuous Voice menggunakan Gemini Live melalui WebSocket browser dan token
ephemeral satu kali: token hanya dapat memulai sesi dalam 1 menit dan berakhir
setelah 5 menit. Fitur Live dan token masih preview. Endpoint sesi dinonaktifkan
secara default; untuk demo lokal, atur `GEMINI_LIVE_DEMO_ENABLED=true`. Penerbitan
token dibatasi satu kali per menit per IP di setiap proses backend. Aplikasi belum
memiliki autentikasi pengguna, sehingga fitur ini tidak boleh dipublikasikan
sebelum autentikasi diterapkan dan pembatas rate limit dibuat terdistribusi.
Untuk menguji Continuous Voice secara lokal, hentikan Uvicorn dengan `Ctrl+C`,
atur flag di terminal Backend yang sama, lalu jalankan ulang:

```powershell
$env:GEMINI_LIVE_DEMO_ENABLED = "true"
uvicorn main:app --reload --port 8000
```

Jangan aktifkan flag demo ini pada deployment publik.
Panduan dan narasi proaktif Frontend hanya aktif setelah pengguna menyalakannya
di Cosmic Guide; preferensi disimpan lokal di browser dan default-nya nonaktif.
Panduan dipicu oleh pemilihan objek, pembukaan tampilan perbandingan, atau
kesiapan tampilan detail, dengan cooldown/deduplikasi dan tanpa menyela chat,
mikrofon, atau audio yang sedang berjalan. Audio memakai TTS Backend; jika
browser menolak autoplay, teks tetap tampil dan dapat diputar manual. Riwayat
dan konteks dipertahankan selama sesi halaman yang sama; navigasi ke aplikasi
AR terpisah memerlukan integrasi event host yang belum tersedia pada demo ini.
Endpoint Agent membatasi permintaan hingga 20 kali per menit per alamat client
di setiap proses backend. Pada tahap ini, chat belum menggunakan data objek atau
observasi SPHEREx/JPL yang terverifikasi. Jika FE mengirim ID objek, Backend
mencari ID tersebut di `kamus_object.json`; label atau fakta dari browser tidak
diteruskan sebagai sumber fakta. Record katalog dan tautan ke endpoint record
disertakan bila ID ditemukan, tetapi katalog belum menyimpan provenance sumber
aslinya sehingga informasinya bukan bukti observasi resmi. ID yang tidak dikenal
tidak memperoleh sumber katalog. Gemini memakai model `gemini-3.5-flash-lite`
melalui Interactions API. Jika objek tidak ditemukan dan pengguna bertanya
tentang pengamatan SPHEREx, Agent membedakan metode survei umum (inframerah-dekat
0,75 sampai 5,0 mikrometer) dari bukti pengamatan target; klaim target tentang
debu, gas, atau bintang memerlukan data terverifikasi.

Endpoint NASA memakai `NASA_API_KEY` dari environment Backend jika tersedia;
tanpa itu, service memakai key publik terbatas NASA `DEMO_KEY`. Jangan
menyimpan key pribadi di source control.

Untuk pengujian lokal di Windows PowerShell, buat API key Gemini melalui
[Google AI Studio](https://aistudio.google.com/apikey), lalu atur hanya di
terminal Backend (jangan kirim key melalui chat atau commit ke Git):

```powershell
cd backend
$env:GEMINI_API_KEY = "ISI_KEY_LOKAL_DI_SINI"
uvicorn main:app --reload --port 8000
```

Buka `http://localhost:8000/voiceover-test`. Variabel yang diatur dengan
`$env:` hanya berlaku pada terminal tersebut. Jika key belum diatur, halaman
dan daftar naskah tetap dapat dibuka, tetapi pembuatan audio akan mengembalikan
pesan konfigurasi yang jelas. `GEMINI_API_KEY` digunakan server untuk chat dan
TTS; key tidak dikirim ke browser. Audio naskah statis di-cache dalam memori
proses, sedangkan teks jawaban chat tidak disimpan di Interactions API.
Jika Gemini menolak permintaan, periksa terminal Uvicorn untuk status dan pesan
diagnostik provider; jangan membagikan API key.
Sebelum dipublikasikan, tambahkan autentikasi dan rate limit terdistribusi
sesuai kebijakan aplikasi; pembatas per proses saat ini tidak dibagi antar-worker.

---

## 📂 Struktur Direktori

```text
backend/
├── routes/              # Routing endpoint modular FastAPI (APIRouter)
│   ├── __init__.py
│   ├── images.py        # /api/image/t1, /api/image/t2
│   ├── metadata.py      # /api/metadata/fits
│   ├── objects.py       # /api/objects/{object_id}
│   ├── nasa.py          # /api/nasa/apod, /api/nasa/neows
│   ├── spherex.py       # /api/spherex/observations (IRSA SIA2)
│   ├── system.py        # /mission-control, /api/status
│   └── agent.py         # /api/agent chat and voice-over routes
├── services/            # Business logic eksternal & data fetching
│   ├── __init__.py
│   ├── nasa_service.py  # Handler NASA APOD & NeoWs
│   ├── spherex_service.py # Handler query SIA2 / TAP NASA IRSA
│   ├── gemini_tts_provider.py # Gemini TTS provider adapter
│   ├── gemini_agent_provider.py # Gemini text-generation adapter
│   ├── gemini_live_provider.py # Ephemeral tokens for Gemini Live demo sessions
│   ├── gemini_transcription_provider.py # Upload/transcribe/delete PTT audio
│   ├── agent_service.py  # Mission Liaison persona and conversation prompt
│   ├── object_service.py # Validated lookup of backend object-catalog records
│   └── voiceover_service.py # Bilingual scripts, dynamic speech, and cache
├── utils/               # Normalisasi data JSON & helper sanitasi
│   ├── __init__.py
│   └── normalizers.py
├── templates/           # Frontend ringkas vanilla HTML/CSS/JS
│   ├── mission_control.html
│   └── voiceover_test.html # Isolated Gemini TTS test page
├── tests/                # Backend unit tests
│   ├── test_agent.py
│   └── test_voiceover.py
├── main.py              # Application entrypoint & root redirect
├── requirements.txt     # Dependensi Python
├── Procfile             # Konfigurasi deployment web process
├── vercel.json          # Konfigurasi deployment serverless Vercel
└── README.md            # Dokumentasi resmi proyek
```

Frontend Cosmic Guide pada branch `feat/mobile-frontend-improvements` berada di
`frontend/spherex-expedition.html`. Atur `window.SPHEREX_API_BASE` sebelum script
aplikasi jika frontend dan backend berjalan pada origin yang berbeda.

---

## ☁️ Deployment

Proyek ini telah dikonfigurasi agar kompatibel dengan **Vercel** (`vercel.json`), **Railway**, dan platform cloud container berbasis ASGI lainnya menggunakan `Procfile`.
