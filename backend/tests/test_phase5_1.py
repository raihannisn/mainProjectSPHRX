import asyncio
import os
import sys

# Ensure backend in sys.path
sys.path.insert(0, os.path.abspath("backend"))

from services.spherex_service import (
    query_spherex_observations,
    generate_fits_preview,
    KNOWN_RCW36_CALIBRATIONS,
    _get_previews_cache_dir,
    _MEMORY_PREVIEW_CACHE,
    MAX_FITS_BYTES
)
from fastapi import HTTPException

async def test_spectral_calibration():
    print("\n--- 1. Testing Spectral WCS Calibration & Fallback ---")
    cal_dr1 = KNOWN_RCW36_CALIBRATIONS[("2025W22_2B_0536_1", "SPHEREx-D4")]
    cal_qr3 = KNOWN_RCW36_CALIBRATIONS[("2026W23_2A_0030_2", "SPHEREx-D4")]

    # Assert CWAVE and CBAND values
    assert cal_dr1["cwave"] == 2.4489, f"DR1 CWAVE expected 2.4489, got {cal_dr1['cwave']}"
    assert cal_dr1["cband"] == 0.0602, f"DR1 CBAND expected 0.0602, got {cal_dr1['cband']}"
    assert cal_dr1["wcs_wave"] == 2.4474, f"DR1 WCS-WAVE expected 2.4474, got {cal_dr1['wcs_wave']}"
    assert cal_dr1["wcs_band"] == 0.0611, f"DR1 WCS-BAND expected 0.0611, got {cal_dr1['wcs_band']}"

    assert cal_qr3["cwave"] == 2.4679, f"QR3 CWAVE expected 2.4679, got {cal_qr3['cwave']}"
    assert cal_qr3["cband"] == 0.0691, f"QR3 CBAND expected 0.0691, got {cal_qr3['cband']}"
    assert cal_qr3["wcs_wave"] == 2.4679, f"QR3 WCS-WAVE expected 2.4679, got {cal_qr3['wcs_wave']}"
    assert cal_qr3["wcs_band"] == 0.0710, f"QR3 WCS-BAND expected 0.0710, got {cal_qr3['wcs_band']}"

    print(f"DR1 Cal: CWAVE={cal_dr1['cwave']} um, CBAND={cal_dr1['cband']} um (WCS-WAVE={cal_dr1['wcs_wave']} um)")
    print(f"QR3 Cal: CWAVE={cal_qr3['cwave']} um, CBAND={cal_qr3['cband']} um (WCS-WAVE={cal_qr3['wcs_wave']} um)")
    print("Spectral WCS calibration verification passed.")

def test_bandpass_overlap_math():
    print("\n--- 2. Testing Bandpass Overlap Mathematical Formulas ---")
    # A. WCS-WAVE rectangular overlap
    w1, bw1 = 2.4474, 0.0611
    w2, bw2 = 2.4679, 0.0710
    min1, max1 = w1 - bw1/2, w1 + bw1/2
    min2, max2 = w2 - bw2/2, w2 + bw2/2

    inter_min = max(min1, min2)
    inter_max = min(max1, max2)
    inter_len = inter_max - inter_min
    assert abs(inter_len - 0.04555) < 1e-5, f"Expected 0.04555 um overlap, got {inter_len}"

    narrower_ratio = inter_len / min(bw1, bw2)
    union_len = bw1 + bw2 - inter_len
    iou = inter_len / union_len

    print(f"WCS-WAVE: Overlap={inter_len:.5f} um, Narrower%={narrower_ratio*100:.2f}%, IoU={iou*100:.2f}%")
    assert abs(narrower_ratio * 100 - 74.55) < 0.1, f"Expected ~74.55% (74.6%), got {narrower_ratio*100:.2f}%"
    assert abs(iou * 100 - 52.63) < 0.1, f"Expected ~52.63% (52.6%), got {iou*100:.2f}%"

    # B. CWAVE/CBAND rectangular overlap
    cw1, cb1 = 2.4489, 0.0602
    cw2, cb2 = 2.4679, 0.0691
    c_inter = min(cw1 + cb1/2, cw2 + cb2/2) - max(cw1 - cb1/2, cw2 - cb2/2)
    c_narrow = c_inter / min(cb1, cb2)
    c_iou = c_inter / (cb1 + cb2 - c_inter)
    print(f"CWAVE/CBAND: Overlap={c_inter:.5f} um, Narrower%={c_narrow*100:.2f}%, IoU={c_iou*100:.2f}%")
    assert abs(c_narrow * 100 - 75.83) < 0.1, f"Expected ~75.83% (75.8%), got {c_narrow*100:.2f}%"
    assert abs(c_iou * 100 - 54.57) < 0.1, f"Expected ~54.57% (54.6%), got {c_iou*100:.2f}%"
    print("Bandpass overlap calculation verification passed.")

def test_quality_flags():
    print("\n--- 3. Testing Quality Flag Interpretation ---")
    cal_dr1 = KNOWN_RCW36_CALIBRATIONS[("2025W22_2B_0536_1", "SPHEREx-D4")]
    flag = cal_dr1["quality_flag"]
    assert flag == 2097152, f"Expected flag 2097152, got {flag}"
    assert flag == (1 << 21), "Flag 2097152 must equal bit 21 (1 << 21)"
    
    # Check that bits 0-20 are strictly 0
    lower_bits = flag & ((1 << 21) - 1)
    assert lower_bits == 0, f"Expected lower bits 0..20 to be 0, got {lower_bits}"
    print(f"Flag 2097152: Bit 21 (SOURCE) is SET, Bits 0..20 (Defects/Cosmic rays) are CLEAR.")
    print("Quality flag bitmask verification passed.")

async def test_vercel_cache_compatibility():
    print("\n--- 4. Testing Vercel Cache & In-Memory LRU ---")
    cache_dir = _get_previews_cache_dir()
    print(f"Effective preview cache dir: {cache_dir}")
    assert os.path.exists(cache_dir), "Cache dir must exist"

    # Test in-memory cache put and get
    test_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    test_val = (b"test_png_bytes", {"vmin": 1.0, "vmax": 10.0})
    await _MEMORY_PREVIEW_CACHE.put(test_key, test_val)
    retrieved = await _MEMORY_PREVIEW_CACHE.get(test_key)
    assert retrieved is not None and retrieved[0] == b"test_png_bytes"
    print("In-Memory LRU cache get/put verified.")

async def test_shared_normalization():
    print("\n--- 5. Testing Shared Normalization Previews ---")
    # Cutout URL from DR1
    url = "https://irsa.ipac.caltech.edu/ibe/cutout?ra=134.8708&dec=-43.7533&size=0.05&path=spherex/dr1/level2/2025W22_2B/l2b-v27-2026-200/4/level2_2025W22_2B_0536_1D4_spx_l2b-v27-2026-200.fits"
    
    png_bytes, meta = await generate_fits_preview(
        fits_url=url,
        ra=134.8708,
        dec=-43.7533,
        size=0.05,
        shared_vmin=2.0541,
        shared_vmax=241.3688
    )
    assert png_bytes[:8] == b'\x89PNG\r\n\x1a\n', "Invalid PNG signature"
    assert meta["shared_scale"] is True, "Expected shared_scale to be True"
    assert abs(meta["vmin"] - 2.0541) < 1e-4, f"Expected vmin 2.0541, got {meta['vmin']}"
    assert abs(meta["vmax"] - 241.3688) < 1e-4, f"Expected vmax 241.3688, got {meta['vmax']}"
    assert "Shared AsinhStretch" in meta["stretch"]
    print(f"Shared preview rendered: stretch={meta['stretch']}, vmin={meta['vmin']}, vmax={meta['vmax']}")

async def test_ssrf_and_resource_guards():
    print("\n--- 6. Testing SSRF & Resource Guards ---")
    # 1. Reject non-https
    try:
        await generate_fits_preview("http://irsa.ipac.caltech.edu/ibe/data/spherex/test.fits")
        assert False, "Should reject http scheme"
    except HTTPException as e:
        assert e.status_code == 400
        print("  ✓ Non-HTTPS rejected with 400")

    # 2. Reject untrusted domain
    try:
        await generate_fits_preview("https://attacker.com/ibe/data/spherex/test.fits")
        assert False, "Should reject attacker domain"
    except HTTPException as e:
        assert e.status_code == 400
        print("  ✓ Untrusted hostname rejected with 400")

    # 3. Reject disallowed path
    try:
        await generate_fits_preview("https://irsa.ipac.caltech.edu/etc/passwd")
        assert False, "Should reject disallowed path"
    except HTTPException as e:
        assert e.status_code == 400
        print("  ✓ Disallowed path rejected with 400")

    # 4. Path traversal attempt
    try:
        await generate_fits_preview("https://irsa.ipac.caltech.edu/ibe/data/spherex/../../../etc/passwd")
        assert False, "Should reject traversal path"
    except HTTPException as e:
        assert e.status_code == 400
        print("  ✓ Path traversal rejected with 400")

    # 5. Upstream redirect rejection (follow_redirects=False SSRF guard)
    from unittest.mock import patch, AsyncMock
    mock_redirect_resp = AsyncMock()
    mock_redirect_resp.status_code = 302
    mock_redirect_resp.headers = {"Location": "https://attacker.com/evil.fits"}

    with patch("httpx.AsyncClient.get", return_value=mock_redirect_resp):
        try:
            # Bypass cache by unique URL
            await generate_fits_preview("https://irsa.ipac.caltech.edu/ibe/data/spherex/test_redirect_guard_xyz.fits")
            assert False, "Should reject 302 redirect from upstream"
        except HTTPException as e:
            assert e.status_code == 400
            assert "redirect" in str(e.detail).lower() or "pengalihan" in str(e.detail).lower()
            print("  ✓ Upstream 302 redirect rejected with 400 (SSRF guard)")

    # 6. Upstream oversized response via Content-Length (> 15 MB)
    mock_oversized_cl_resp = AsyncMock()
    mock_oversized_cl_resp.status_code = 200
    mock_oversized_cl_resp.headers = {"content-length": str(16 * 1024 * 1024)}  # 16 MB

    with patch("httpx.AsyncClient.get", return_value=mock_oversized_cl_resp):
        try:
            await generate_fits_preview("https://irsa.ipac.caltech.edu/ibe/data/spherex/test_oversized_cl_guard_xyz.fits")
            assert False, "Should reject Content-Length > 15MB"
        except HTTPException as e:
            assert e.status_code == 413
            assert "15 MB" in str(e.detail)
            print("  ✓ Oversized Content-Length (>15 MB) rejected with 413")

    # 7. Upstream oversized response via streaming body (> 15 MB)
    mock_stream_resp = AsyncMock()
    mock_stream_resp.status_code = 200
    mock_stream_resp.headers = {}
    async def fake_stream():
        # Yield 16 MB in chunks
        chunk = b"X" * (1024 * 1024)
        for _ in range(16):
            yield chunk
    mock_stream_resp.aiter_bytes = fake_stream

    with patch("httpx.AsyncClient.get", return_value=mock_stream_resp):
        try:
            await generate_fits_preview("https://irsa.ipac.caltech.edu/ibe/data/spherex/test_stream_guard_xyz.fits")
            assert False, "Should reject streamed bytes > 15MB"
        except HTTPException as e:
            assert e.status_code == 413
            assert "15 MB" in str(e.detail)
            print("  ✓ Streamed body exceeding 15 MB terminated with 413")

    print("SSRF and resource protection tests passed.")

async def main():
    print("==================================================")
    print("PHASE 5.1 COMPREHENSIVE BACKEND VERIFICATION SUITE")
    print("==================================================")
    await test_spectral_calibration()
    test_bandpass_overlap_math()
    test_quality_flags()
    await test_vercel_cache_compatibility()
    await test_shared_normalization()
    await test_ssrf_and_resource_guards()
    print("\n==================================================")
    print("ALL PHASE 5.1 BACKEND CHECKS PASSED (6/6 SUITES)!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(main())
