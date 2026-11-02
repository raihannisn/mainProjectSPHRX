# --- DATA DUMMY / FALLBACK JIKA SERVER NASA DOWN ---
DUMMY_APOD = {
    "status": "error",
    "message": "NASA APOD sedang tidak tersedia, silakan coba lagi nanti",
    "source": "NASA Astronomy Picture of the Day (APOD)",
    "title": "NASA APOD Unavailable",
    "date": None,
    "explanation": "NASA APOD sedang tidak tersedia, silakan coba lagi nanti",
    "media_type": "image",
    "image_url": None,
    "thumbnail_url": None,
    "copyright": "NASA"
}


def normalize_apod(data: dict) -> dict:
    """Mengubah payload NASA APOD menjadi format JSON yang simpel dan konsisten."""
    return {
        "source": "NASA Astronomy Picture of the Day (APOD)",
        "title": data.get("title"),
        "date": data.get("date"),
        "explanation": data.get("explanation"),
        "media_type": data.get("media_type", "image"),
        "image_url": data.get("hdurl") or data.get("url"),
        "thumbnail_url": data.get("url"),
        "copyright": data.get("copyright", "Public Domain")
    }


def safe_float(val, round_digits=2):
    """Helper untuk parsing float yang aman dengan pembulatan."""
    if val is None:
        return None
    try:
        return round(float(val), round_digits)
    except (ValueError, TypeError):
        return None


def normalize_neows(data: dict) -> dict:
    """Mengubah format kompleks NASA NeoWs menjadi array asteroid yang bersih dan terurut."""
    near_earth_objects = data.get("near_earth_objects", {})
    total_count = data.get("element_count", 0)
    asteroids = []
    hazardous_count = 0

    for date_str, items in near_earth_objects.items():
        for item in items:
            is_hazardous = bool(item.get("is_potentially_hazardous_asteroid", False))
            if is_hazardous:
                hazardous_count += 1

            close_list = item.get("close_approach_data", [])
            close_data = close_list[0] if close_list else {}
            vel = close_data.get("relative_velocity", {})
            dist = close_data.get("miss_distance", {})
            est_diam = item.get("estimated_diameter", {})
            meters = est_diam.get("meters", {})
            km = est_diam.get("kilometers", {})

            asteroids.append({
                "id": item.get("id"),
                "name": item.get("name", "").strip("()"),
                "is_potentially_hazardous": is_hazardous,
                "absolute_magnitude_h": item.get("absolute_magnitude_h"),
                "close_approach_date": close_data.get("close_approach_date", date_str),
                "close_approach_date_full": close_data.get("close_approach_date_full"),
                "orbiting_body": close_data.get("orbiting_body", "Earth"),
                "estimated_diameter": {
                    "min_meters": safe_float(meters.get("estimated_diameter_min")),
                    "max_meters": safe_float(meters.get("estimated_diameter_max")),
                    "min_km": safe_float(km.get("estimated_diameter_min"), 4),
                    "max_km": safe_float(km.get("estimated_diameter_max"), 4),
                },
                "relative_velocity": {
                    "km_per_second": safe_float(vel.get("kilometers_per_second")),
                    "km_per_hour": safe_float(vel.get("kilometers_per_hour")),
                },
                "miss_distance": {
                    "kilometers": safe_float(dist.get("kilometers")),
                    "lunar": safe_float(dist.get("lunar")),
                    "astronomical": safe_float(dist.get("astronomical"), 6),
                },
                "nasa_jpl_url": item.get("nasa_jpl_url")
            })

    # Urutkan asteroid berdasarkan tanggal pendekatan terdekat
    asteroids.sort(key=lambda x: x.get("close_approach_date") or "")

    return {
        "source": "NASA Near Earth Object Web Service (NeoWs)",
        "total_asteroids": total_count,
        "hazardous_asteroids_count": hazardous_count,
        "asteroids": asteroids
    }
