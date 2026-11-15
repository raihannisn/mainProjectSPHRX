"""The object catalog holds non-ASCII characters (degree, prime, double prime).

It must be read as UTF-8 on every platform: on Windows the default codec is
cp1252, which turned "-43°45′12″" into mojibake in the Sky Explorer HUD.
"""
from routes.objects import get_object_info


def test_rcw36_sexagesimal_declination_is_not_mojibake():
    info = get_object_info("rcw-36")
    assert info["dec_dms"] == "-43°45′12″"
    assert "Â" not in info["dec_dms"] and "â" not in info["dec_dms"]
