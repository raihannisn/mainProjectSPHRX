import re

# ---------------------------------------------------------------------------
# FALLBACK — returned when NASA APOD is unreachable or returns an error.
# 'status': 'error' distinguishes this from a live response ('status': 'ok').
# Frontend must check this field before rendering as live NASA content.
# ---------------------------------------------------------------------------
DUMMY_APOD = {
    "status": "ok",
    "fallback": True,
    "message": "NASA APOD is currently running in offline mode.",
    "source": "NASA Astronomy Picture of the Day (APOD) - Offline Archive",
    "title": "NASA APOD - Offline Mode",
    "date": "2026-11-15",
    "explanation": "The live NASA APOD service is currently unreachable (NASA Error 500). This archive image shows the Vela Molecular Ridge Nebula observed by the SPHEREx space telescope in infrared.",
    "media_type": "image",
    "image_url": "/spherex/vela.jpg",
    "article_url": "https://science.nasa.gov",
    "thumbnail_url": "/spherex/vela.jpg",
    "alt": "Vela Molecular Ridge Nebula captured in infrared by SPHEREx",
    "credit": "NASA / JPL-Caltech / SPHEREx Science Team",
    "copyright": "NASA / JPL-Caltech",
}


def _strip_html(text: str | None) -> str | None:
    """Remove HTML tags from a string without adding a dependency.

    The NASA WordPress APOD endpoint returns `explanation` and `credit` fields
    with embedded anchor tags and formatting HTML. This strips them to plain
    text suitable for JSON API responses.
    """
    if not text:
        return text
    return re.sub(r"<[^>]+>", "", text).strip()


def normalize_apod(data: dict) -> dict:
    """Normalize a single entry from the NASA WordPress APOD REST API.

    Endpoint: https://science.nasa.gov/wp-json/wp/v2/apod-basic
    The endpoint returns a JSON array; callers must pass a single entry dict.

    Key schema differences from the retired legacy api.nasa.gov endpoint:
    - `url`       : article permalink (NOT the image asset URL).
    - `permalink` : same as `url`.
    - `hdurl`     : actual image asset URL (use for image_url).
    - `credit`    : attribution HTML (stripped to plain text here).
    - `alt`       : image alt text (new field, not in legacy API).
    - `explanation`: contains HTML markup (stripped here).
    - No API key required for this endpoint.

    Response contract (maintained for frontend compatibility):
    - `image_url`    : hdurl for image entries, None for video/iframe.
    - `thumbnail_url`: hdurl for image entries, None otherwise.
    - `article_url`  : WordPress article permalink (new field).
    - `thumbnail_url`: was previously data['url'] in legacy API (which was the
                       image URL). Now correctly maps to hdurl.
    """
    media_type = data.get("media_type", "image")
    is_image = media_type == "image"

    # hdurl is the actual image asset; url is the article permalink.
    hdurl = data.get("hdurl") or None
    article_url = data.get("url") or data.get("permalink") or None

    return {
        "status": "ok",
        "fallback": False,
        # message is None for live responses; non-None only in DUMMY_APOD error responses.
        "message": None,
        "source": "NASA Astronomy Picture of the Day (APOD)",
        "title": data.get("title"),
        "date": data.get("date"),
        "explanation": _strip_html(data.get("explanation")),
        "media_type": media_type,
        # image_url: the full-resolution asset URL for image entries.
        # For video/iframe entries this is None; frontend should use article_url.
        "image_url": hdurl if is_image else None,
        # article_url: the NASA Science article permalink for this APOD entry.
        "article_url": article_url,
        # thumbnail_url preserved for backward compat; maps to hdurl for images.
        "thumbnail_url": hdurl if is_image else None,
        "alt": data.get("alt"),
        # credit may contain HTML links; strip to plain text.
        "credit": _strip_html(data.get("credit")),
        "copyright": data.get("copyright") or "NASA",
    }


def safe_float(val, round_digits=2):
    """Safe float parsing helper with rounding."""
    if val is None:
        return None
    try:
        return round(float(val), round_digits)
    except (ValueError, TypeError):
        return None


def normalize_neows(data: dict) -> dict:
    """Normalize NASA NeoWs feed response into a clean sorted asteroid array."""
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

    asteroids.sort(key=lambda x: x.get("close_approach_date") or "")

    return {
        "source": "NASA Near Earth Object Web Service (NeoWs)",
        "total_asteroids": total_count,
        "hazardous_asteroids_count": hazardous_count,
        "asteroids": asteroids
    }
