from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import sys

# Memastikan direktori backend terdaftar di sys.path
# agar import bekerja saat dijalankan dari backend/ atau root workspace
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_BACKEND_ENV = BACKEND_DIR / ".env"
if _BACKEND_ENV.is_file():
    load_dotenv(dotenv_path=_BACKEND_ENV)

from routes.images import router as images_router
from routes.metadata import router as metadata_router
from routes.objects import router as objects_router
from routes.nasa import router as nasa_router
from routes.spherex import router as spherex_router
from routes.system import router as system_router
from routes.ai import router as ai_router
from starlette.staticfiles import StaticFiles

app = FastAPI(
    title="SPHEREx Cosmic Explorer API",
    description="Backend engine untuk NASA Space Apps Challenge - Planet X & SPHEREx",
    version="1.3.0"
)

_SPHEREX_STATIC = BACKEND_DIR.parent / "arvr" / "public" / "spherex"
if _SPHEREX_STATIC.is_dir():
    app.mount("/spherex", StaticFiles(directory=str(_SPHEREX_STATIC)), name="spherex")

# --- CORS (Biar Vercel & WebXR bisa akses) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://nasa-spherex-backend.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROOT REDIRECT KE MISSION CONTROL ---
@app.get("/", tags=["System"], summary="Redirect to Mission Control Dashboard")
def root_redirect():
    """Mengalihkan secara otomatis ke antarmuka interaktif Mission Control."""
    return RedirectResponse(url="/mission-control")

# --- REGISTER ROUTERS ---
app.include_router(images_router)
app.include_router(metadata_router)
app.include_router(objects_router)
app.include_router(nasa_router)
app.include_router(spherex_router)
app.include_router(system_router)
app.include_router(ai_router)
