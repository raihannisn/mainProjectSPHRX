from fastapi import APIRouter, HTTPException
from astropy.io import fits
from pathlib import Path
import os

router = APIRouter(prefix="/api/metadata", tags=["Metadata"])

BASE_DIR = Path(__file__).resolve().parent.parent
FITS_FILE_1 = str(BASE_DIR / "level2_2025W36_2B_0696_1D1_spx_l2b-v20-2025-271-cutout.fits")


@router.get("/fits")
def get_fits_metadata():
    if not os.path.exists(FITS_FILE_1):
        raise HTTPException(status_code=404, detail="File FITS asli tidak ditemukan di server")
    
    try:
        hdul = fits.open(FITS_FILE_1)
        header = hdul[0].header
        
        metadata = {
            "telescope": header.get("TELESCOP", "SPHEREx"),
            "observation_date": header.get("DATE-OBS", "Unknown"),
            "right_ascension": header.get("RA", "Unknown"),
            "declination": header.get("DEC", "Unknown"),
            "data_source": "NASA IRSA Caltech (.fits format)",
            "status": "Validated from raw file"
        }
        hdul.close()
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
