from fastapi import APIRouter

from services.object_service import get_object_record


ROUTER = APIRouter(prefix="/api/objects", tags=["Objects"])
router = ROUTER

BASE_DIR = Path(__file__).resolve().parent.parent
JSON_KAMUS = str(BASE_DIR / "kamus_object.json")

DEFAULT_RCW36 = {
    "id": "rcw-36",
    "name": "RCW 36 Emission Nebula",
    "type": "Emission Nebula / H II Region",
    "description": "A compact star-forming H II emission nebula situated within Cloud C of the Vela Molecular Ridge. Ionized by massive embedded O/B stars and observed by SPHEREx across 96 infrared spectral channels.",
    "ra": 134.8708,
    "dec": -43.7533,
    "ra_hms": "08h 59m 29s",
    "dec_dms": "-43°45′12″",
    "constellation": "Vela",
    "distance": "~700 pc (2,300 light-years)",
    "source": "NASA ADS / SIMBAD Gum 20 / IPAC IRSA SPHEREx QR3 Catalog"
}


@router.get("/{object_id}")
def get_object_info(object_id: str):
    obj_key = object_id.lower()
    if not os.path.exists(JSON_KAMUS):
        if obj_key in ("rcw-36", "rcw", "rcw36"):
            return DEFAULT_RCW36
        raise HTTPException(status_code=404, detail=f"File database '{JSON_KAMUS}' tidak ditemukan di folder")
        
    try:
        with open(JSON_KAMUS, "r") as file:
            data = json.load(file)
            if obj_key in data:
                return data[obj_key]
            if obj_key in ("rcw-36", "rcw", "rcw36"):
                return DEFAULT_RCW36
            raise HTTPException(status_code=404, detail=f"Objek '{object_id}' tidak ada di database")
    except HTTPException:
        raise
    except Exception as e:
        if obj_key in ("rcw-36", "rcw", "rcw36"):
            return DEFAULT_RCW36
        raise HTTPException(status_code=500, detail=str(e))
