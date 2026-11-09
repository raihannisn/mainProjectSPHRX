from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import sys

# Memastikan direktori backend terdaftar di sys.path
# agar import bekerja saat dijalankan dari backend/ atau root workspace
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routes.images import router as images_router
from routes.metadata import router as metadata_router
from routes.objects import router as objects_router
from routes.nasa import router as nasa_router
from routes.spherex import router as spherex_router
from routes.system import router as system_router

app = FastAPI(
    title="SPHEREx Cosmic Explorer API",
    description="Backend engine untuk NASA Space Apps Challenge - Planet X & SPHEREx",
    version="1.2.0"
)

# --- CORS (Biar Vercel & WebXR bisa akses) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REGISTER ROUTERS ---
app.include_router(images_router)
app.include_router(metadata_router)
app.include_router(objects_router)
app.include_router(nasa_router)
app.include_router(spherex_router)
app.include_router(system_router)
