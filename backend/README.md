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
│   └── system.py        # /mission-control, /api/status
├── services/            # Business logic eksternal & data fetching
│   ├── __init__.py
│   ├── nasa_service.py  # Handler NASA APOD & NeoWs
│   └── spherex_service.py # Handler query SIA2 / TAP NASA IRSA
├── utils/               # Normalisasi data JSON & helper sanitasi
│   ├── __init__.py
│   └── normalizers.py
├── templates/           # Frontend ringkas vanilla HTML/CSS/JS
│   └── mission_control.html
├── main.py              # Application entrypoint & root redirect
├── requirements.txt     # Dependensi Python
├── Procfile             # Konfigurasi deployment web process
├── vercel.json          # Konfigurasi deployment serverless Vercel
└── README.md            # Dokumentasi resmi proyek
```

---

## ☁️ Deployment

Proyek ini telah dikonfigurasi agar kompatibel dengan **Vercel** (`vercel.json`), **Railway**, dan platform cloud container berbasis ASGI lainnya menggunakan `Procfile`.
